import {analyze, degreeOptions, extractProfile, normalizeSkills, parseJob, weights} from './engine.mjs';
import {maxCharacters, readDocument} from './documents.mjs';
import {sampleJobs, sampleResumes} from './sample.mjs';

const paths = {
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18m-12 0v12"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4m-3-12a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m-5 6a20 20 0 0 0 18 0m-9 1v3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  rotate: '<path d="M3 11a9 9 0 1 1 2 7M3 5v6h6"/>',
  flask: '<path d="M9 3h6m-5 0v7L5 19a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-9V3M8 15h8"/>',
  'file-stack': '<path d="M7 18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1m-3 12h4m-4-4h4"/><rect x="8" y="7" width="13" height="14" rx="2"/>',
  file: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Zm0 0v7h7M8 14h8m-8 3h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  compare: '<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="m14 6 4 4M5 19l4-1L20 7a2.8 2.8 0 0 0-4-4L5 14l-1 5Z"/>'
};
const $ = id => document.getElementById(id);
const state = {
  profiles: [], jobs: [], results: null, selected: '', sample: false, nextId: 0, epoch: 0, reading: false,
  search: '', statusFilter: '', comparison: new Set(), reviews: new Map()
};
const views = {
  screening: ['Screening', 'Résumé screening', 'See where each résumé fits and what to ask about in your next conversation.'],
  candidates: ['Candidates', 'Candidates', 'Get to know each candidate’s experience and see which roles fit their skills.'],
  jobs: ['Job descriptions', 'Job descriptions', 'Review the skills and qualifications that matter for each role.']
};
const criteria = {required: 'Required skills', preferred: 'Preferred skills', experience: 'Experience', education: 'Education', qualifications: 'Qualifications'};
const reviewStatuses = {'todo': 'To review', 'follow-up': 'Follow up', 'reviewed': 'Reviewed'};
const comparisonLimit = 3;

function icon(name, className = '') {
  const span = el('span', className);
  span.dataset.icon = name;
  fillIcon(span);
  return span;
}

function fillIcon(span) {
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[span.dataset.icon] + '</svg>';
}

function el(tag, className = '', ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function button(label, className, handler, iconName) {
  const node = el('button', className);
  node.type = 'button';
  if (iconName) node.append(icon(iconName));
  if (label) node.append(label);
  node.addEventListener('click', handler);
  return node;
}

function iconButton(label, iconName, handler) {
  const node = button('', 'icon-button', handler, iconName);
  node.setAttribute('aria-label', label);
  node.title = label;
  return node;
}

function sourceProfile(name, text, format) {
  return {id: String(++state.nextId), ...extractProfile(name, text), format};
}

function sourceJob(title, description) {
  return {id: String(++state.nextId), ...parseJob(title, description)};
}

function quantity(amount, word) {
  return amount + ' ' + word + (amount === 1 ? '' : 's');
}

function experience(profile) {
  const value = profile.experience.months;
  if (value === null) return 'Undated';
  if (value < 12) return quantity(value, 'month');
  const years = Math.round(value / 12 * 10) / 10;
  return quantity(years, 'year');
}

function formatScore(score) {
  return score === null ? 'Unscored' : Math.round(score) + '%';
}

function scoreBadge(score) {
  const color = score === null ? 'none' : score >= 80 ? '' : score >= 50 ? 'mid' : 'low';
  return el('span', 'score ' + color, formatScore(score));
}

function scoreDisplay(score) {
  if (score === null) return scoreBadge(score);
  const meter = el('meter', 'score-meter');
  meter.min = 0;
  meter.max = 100;
  meter.value = score;
  meter.setAttribute('aria-hidden', 'true');
  return el('div', 'score-display', scoreBadge(score), meter);
}

function avatar(profile) {
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase();
  const element = el('span', 'avatar a' + ((Number(profile.id) - 1) % 4), initials);
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function tags(values, maximum = Infinity, style = '') {
  const group = el('div', 'tags');
  for (const value of values.slice(0, maximum)) group.append(el('span', 'tag ' + style, value));
  if (values.length > maximum) group.append(el('span', 'tag more', '+' + (values.length - maximum)));
  return group;
}

function activeView() {
  const hash = location.hash.slice(1);
  return Object.hasOwn(views, hash) ? hash : 'screening';
}

function renderView() {
  const active = activeView();
  for (const key of Object.keys(views)) {
    $(key + '-view').hidden = key !== active;
    const link = document.querySelector('.sidebar a[href="#' + key + '"]');
    if (active === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const [view, title, subtitle] = views[active];
  $('breadcrumb').replaceChildren('Workspace ', el('span', 'slash', '/'), el('strong', '', view));
  $('title').textContent = title;
  $('subtitle').textContent = subtitle;
}

function render() {
  renderView();
  const matches = state.results?.pairs.flatMap(pair => pair.candidates).filter(result => result.score !== null).length ?? 0;
  const metrics = [
    [state.profiles.length, 'Candidate profiles', 'users', ''],
    [state.jobs.length, 'Job descriptions', 'briefcase', 'teal'],
    [matches, 'Matches scored', 'target', 'purple']
  ];
  $('summary').replaceChildren(...metrics.map(([value, title, name, tone]) =>
    el('div', 'metric', icon(name, 'icon-box ' + tone), el('div', '', el('strong', '', String(value)), el('small', '', title)))));
  const status = $('input-status');
  status.classList.toggle('neutral', !state.sample && !state.results);
  status.textContent = state.sample ? 'Sample workspace' : state.results ? 'Screening complete' : 'Workspace inputs';
  $('demo').disabled = state.reading || state.sample;
  $('run').disabled = state.reading || !state.profiles.length || !state.jobs.length;
  $('run-note').textContent = state.reading ? 'Reading résumé files…'
    : state.results ? 'Rankings are up to date.'
    : !state.profiles.length || !state.jobs.length ? 'Add a résumé and a job to get started.' : 'Ready to see how the résumés match?';
  renderInputs();
  renderRanking();
  renderCards();
}

function renderInputs() {
  const resumeList = $('resume-preview');
  resumeList.replaceChildren(...state.profiles.slice(0, 2).map(profile => {
    const row = el('div', 'item-row',
      icon('file'), el('div', 'item-content', el('strong', '', profile.name)),
      el('small', 'help', profile.format),
      iconButton('Remove résumé for ' + profile.name, 'x', () => confirmRemove('profile', profile)));
    return row;
  }));
  if (state.profiles.length > 2) {
    resumeList.append(el('div', 'view-all', elLink('View all ' + state.profiles.length + ' candidates', '#candidates')));
  }
  const jobs = $('job-preview');
  jobs.replaceChildren(...state.jobs.slice(0, 3).map(job => el('div', 'item-row',
    icon('briefcase'), el('div', 'item-content', el('strong', '', job.title), el('small', '', quantity(job.requiredSkills.length, 'required skill'))),
    iconButton('Edit ' + job.title, 'edit', () => jobEditor(job)))));
  if (!state.jobs.length) jobs.append(el('div', 'empty', 'Add a job description to set matching criteria.'));
  if (state.jobs.length > 3) jobs.append(elLink('View all ' + state.jobs.length + ' jobs', '#jobs'));
}

function elLink(label, href) {
  const node = el('a', 'plain-link', label);
  node.href = href;
  return node;
}

function selectedPair() {
  return state.results?.pairs.find(pair => pair.job.id === state.selected);
}

function reviewKey(job, profile) {
  return job.id + '/' + profile.id;
}

function getReview(job, profile) {
  return state.reviews.get(reviewKey(job, profile)) ?? {status: 'todo', note: ''};
}

function workflowStatus(status) {
  return el('span', 'review-status ' + status, reviewStatuses[status]);
}

function rankCandidates(candidates) {
  let rank = 0;
  let prior;
  return candidates.map((result, index) => {
    if (result.score === null) return {...result, rank: null};
    const key = [result.score, result.fraction.required, result.matched.required.length].join('/');
    if (key !== prior) rank = index + 1;
    prior = key;
    return {...result, rank};
  });
}

function renderRanking() {
  const select = $('role-select');
  if (!state.jobs.some(job => job.id === state.selected)) state.selected = state.jobs[0]?.id ?? '';
  select.replaceChildren(...(state.jobs.length ? state.jobs.map(job => new Option(job.title, job.id)) : [new Option('No jobs', '')]));
  select.value = state.selected;
  select.disabled = !state.jobs.length;
  const pair = selectedPair();
  $('review-toolbar').hidden = !pair;
  $('candidate-search').value = state.search;
  $('status-filter').value = state.statusFilter;
  updateComparisonControls();
  $('export').disabled = !pair?.candidates.some(result => result.score !== null);
  if (!pair) {
    $('ranking').replaceChildren(el('div', 'empty', 'Run screening to see candidate rankings for this job.'));
    return;
  }
  const query = state.search.trim().toLowerCase();
  const visible = rankCandidates(pair.candidates).filter(({profile, matched}) => {
    const text = [profile.name, ...profile.skills, ...matched.required, ...matched.preferred].join(' ').toLowerCase();
    return (!query || text.includes(query)) && (!state.statusFilter || getReview(pair.job, profile).status === state.statusFilter);
  });
  $('result-count').textContent = visible.length + ' of ' + quantity(pair.candidates.length, 'candidate');
  if (!visible.length) {
    $('ranking').replaceChildren(el('div', 'empty', 'No candidates match these filters. Try another name, skill, or review status.'));
    return;
  }
  const headings = ['Compare', 'Rank', 'Candidate', 'Match score', 'Required skills', 'Review status', ''];
  const headers = headings.map(label => {
    const header = el('th', '', label || el('span', 'visually-hidden', 'Evidence'));
    header.scope = 'col';
    return header;
  });
  const rows = visible.map(result => {
    const {profile, score, matched, rank} = result;
    const checked = el('input', 'compare-check');
    checked.type = 'checkbox';
    checked.checked = state.comparison.has(profile.id);
    checked.setAttribute('aria-label', 'Select ' + profile.name + ' for comparison');
    checked.addEventListener('change', () => {
      if (!checked.checked) state.comparison.delete(profile.id);
      else if (state.comparison.size < comparisonLimit) state.comparison.add(profile.id);
      else {
        checked.checked = false;
        notify('You can compare up to three candidates at a time.');
      }
      updateComparisonControls();
    });
    const evidenceButton = button('Review match', 'plain-link evidence-button', () => showResult(result, pair.job));
    evidenceButton.setAttribute('aria-label', 'Review match for ' + profile.name);
    const skills = el('div', 'coverage',
      el('span', 'help', pair.job.requiredSkills.length ? matched.required.length + ' of ' + pair.job.requiredSkills.length + ' found' : 'No required skills'),
      ...(matched.required.length ? [tags(matched.required, 2)] : []));
    return el('tr', '', el('td', '', checked), el('td', 'rank-cell', rank === null ? '—' : String(rank)),
      el('td', '', el('div', 'candidate-cell', avatar(profile), el('div', '', el('strong', '', profile.name), el('small', '', experience(profile))))),
      el('td', '', scoreDisplay(score)), el('td', '', skills), el('td', '', workflowStatus(getReview(pair.job, profile).status)), el('td', '', evidenceButton));
  });
  const table = el('table', '', el('caption', 'visually-hidden', 'Candidate rankings for ' + pair.job.title),
    el('thead', '', el('tr', '', ...headers)), el('tbody', '', ...rows));
  $('ranking').replaceChildren(el('div', 'table-wrap', table));
}

function updateComparisonControls() {
  const count = state.comparison.size;
  $('compare').disabled = count < 2;
  $('compare-label').textContent = count ? 'Compare (' + count + ')' : 'Compare candidates';
}

function showComparison() {
  const pair = selectedPair();
  if (!pair) return;
  const candidates = pair.candidates.filter(result => state.comparison.has(result.profile.id));
  if (candidates.length < 2) return;
  const column = (label, content) => {
    const node = el('th', '', content ?? label);
    node.scope = 'col';
    return node;
  };
  const row = (label, body) => {
    const heading = el('th', '', label);
    heading.scope = 'row';
    return el('tr', '', heading, ...candidates.map(result => el('td', '', body(result))));
  };
  const table = el('table', 'comparison-table',
    el('thead', '', el('tr', '', column('Criterion'),
      ...candidates.map(({profile}) => column(profile.name, el('div', 'candidate-cell', avatar(profile), profile.name))))),
    el('tbody', '',
      row('Match score', result => scoreDisplay(result.score)),
      row('Required skills found', result => result.matched.required.length ? tags(result.matched.required) : '—'),
      row('Required skills to verify', result => result.missing.required.length ? tags(result.missing.required, Infinity, 'missing') : '—'),
      row('Preferred skills found', result => result.matched.preferred.length ? tags(result.matched.preferred) : '—'),
      row('Experience', ({profile}) => experience(profile)),
      row('Education', ({profile}) => lines(profile.education, 'No education listed')),
      row('Review status', ({profile}) => workflowStatus(getReview(pair.job, profile).status)),
      row('Details', result => button('Review match', 'plain-link', () => showResult(result, pair.job)))));
  showDialog('Compare candidates', el('p', 'comparison-role', pair.job.title), el('div', 'table-wrap', table));
  $('dialog').classList.add('wide');
}

function renderCards() {
  const cards = state.profiles.map(profile => {
    const jobs = state.results?.recommendations.find(item => item.profile.id === profile.id)?.jobs ?? [];
    const ranked = jobs.filter(isRecommendation);
    return el('article', 'panel card',
      el('div', 'card-head', avatar(profile), el('h3', '', profile.name),
        iconButton('Remove résumé for ' + profile.name, 'x', () => confirmRemove('profile', profile))),
      el('p', '', experience(profile) + ' · ' + quantity(profile.skills.length, 'skill')),
      profile.skills.length ? tags(profile.skills, 6) : el('p', '', 'No skills detected.'),
      el('div', '', el('h4', '', 'Recommended jobs'),
        ranked.length ? recommendationRows(ranked.slice(0, 3)) : el('p', '', state.results ? 'No roles met the recommendation criteria.' : 'Run screening to see recommendations.')),
      el('div', 'card-actions', button('View profile', 'button secondary', () => showProfile(profile))));
  });
  $('candidate-cards').replaceChildren(...(cards.length ? cards : [el('div', 'panel empty', 'Add a résumé to extract a candidate profile.')]));
  const jobs = state.jobs.map(job => el('article', 'panel card',
    el('div', 'card-head', icon('briefcase', 'icon-box teal'), el('h3', '', job.title)),
    el('div', '', el('h4', '', 'Required skills'), job.requiredSkills.length ? tags(job.requiredSkills) : el('p', '', 'No required skills specified.')),
    el('div', '', el('h4', '', 'Preferred skills'), job.preferredSkills.length ? tags(job.preferredSkills) : el('p', '', 'No preferred skills specified.')),
    el('p', '', [job.years ? quantity(job.years, 'year') + ' minimum experience' : '', job.degree, ...job.certificates].filter(Boolean).join(' · ') || 'No experience, education, or credential criteria.'),
    el('div', 'card-actions', button('Edit criteria', 'button secondary', () => jobEditor(job), 'edit'))));
  $('job-cards').replaceChildren(...(jobs.length ? jobs : [el('div', 'panel empty', 'Add a job description to review its requirements.')]));
}

function isRecommendation(result) {
  const skillsSpecified = result.job.requiredSkills.length || result.job.preferredSkills.length;
  return result.score > 0 && (!skillsSpecified || result.matched.required.length || result.matched.preferred.length);
}

function recommendationRows(results, interactive = false) {
  return el('div', 'mini-results', ...results.map(result => el('div', 'mini-row',
    interactive ? button(result.job.title, 'plain-link', () => showResult(result, result.job)) : el('span', '', result.job.title),
    scoreBadge(result.score))));
}

let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);
  const box = $('notice');
  box.hidden = false;
  box.textContent = message;
  noticeTimer = setTimeout(() => { box.hidden = true; }, 6500);
}

function showDialog(title, ...body) {
  $('dialog').classList.remove('wide');
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren(...body);
  if (!$('dialog').open) $('dialog').showModal();
  else $('close').focus();
}

function section(title, ...children) {
  return el('section', 'detail-section', el('h3', '', title), ...children);
}

function lines(values, empty) {
  return values.length ? el('ul', 'evidence-list', ...values.map(value => el('li', '', value))) : el('p', '', empty);
}

function showProfile(profile) {
  const scores = state.results?.recommendations.find(item => item.profile.id === profile.id)?.jobs ?? [];
  const recommended = scores.filter(isRecommendation);
  showDialog(profile.name,
    section('Skills', profile.skills.length ? tags(profile.skills) : el('p', '', 'No skills detected.')),
    section('Education', lines(profile.education, 'No education evidence detected.')),
    section('Qualifications', lines(profile.qualifications, 'No qualification evidence detected.')),
    section('Experience', el('p', '', experience(profile) + ' · ' + profile.experience.source), lines(profile.roles, 'No employment history section detected.')),
    section('Job recommendations', recommended.length ? recommendationRows(recommended, true)
      : el('p', '', state.results ? 'No roles met the recommendation criteria.' : 'Run screening to see job recommendations.')),
    ...(scores.length > recommended.length ? [section('Other job match scores', recommendationRows(scores.filter(result => !isRecommendation(result)), true))] : []),
    el('details', 'source-resume', el('summary', '', 'View original résumé text'), el('pre', '', profile.text)));
}

function followUpQuestions(result, job) {
  const questions = result.missing.required.slice(0, 2).map(skill => 'Can you walk me through a project where you used ' + skill + '?');
  if (result.fraction.experience !== null && result.fraction.experience < 1) {
    questions.push('How much experience do you have with work similar to this role?');
  }
  if (questions.length < 3 && result.missing.qualifications.length) {
    questions.push('Can you confirm whether you hold ' + result.missing.qualifications[0] + '?');
  }
  if (questions.length < 3 && result.fraction.education === 0) {
    questions.push('Could you tell me about your completed education for this role’s ' + job.degree + ' degree requirement?');
  }
  return questions.slice(0, 3);
}

function reviewForm(job, profile) {
  const current = getReview(job, profile);
  const status = el('select', '', ...Object.entries(reviewStatuses).map(([value, label]) => new Option(label, value)));
  status.value = current.status;
  const note = textarea('review-note', 'What did you verify? What would you ask next?', current.note);
  note.maxLength = 3000;
  note.rows = 3;
  const confirmation = el('span', 'help review-confirmation');
  confirmation.setAttribute('role', 'status');
  const form = el('form', 'review-form',
    field('Status', status),
    field('Notes for this role', note, 'Notes stay in this browser session.'),
    el('div', 'form-actions', confirmation, submitButton('Save review')));
  form.addEventListener('submit', event => {
    event.preventDefault();
    state.reviews.set(reviewKey(job, profile), {status: status.value, note: note.value.trim()});
    confirmation.textContent = 'Review saved.';
    renderRanking();
  });
  return form;
}

function showResult(result, job) {
  const {profile, fraction, matched, missing, score} = result;
  const total = Object.keys(weights).reduce((sum, key) => sum + (fraction[key] === null ? 0 : weights[key]), 0);
  const details = [];
  for (const [key, label] of Object.entries(criteria)) {
    if (fraction[key] === null) continue;
    const points = (fraction[key] * weights[key] / total * 100).toFixed(1);
    const maximum = (weights[key] / total * 100).toFixed(1);
    const title = label + ' · ' + points + ' of ' + maximum + ' points';
    if (key === 'experience') {
      details.push(section(title, el('p', '', 'Minimum ' + quantity(job.years, 'year') + ' · Evidence ' + experience(profile) + ' · ' + profile.experience.source)));
    } else if (key === 'education') {
      details.push(section(title, el('p', '', 'Minimum ' + job.degree + ' degree'), lines(profile.education, 'No degree evidence detected.')));
    } else {
      details.push(section(title,
        el('p', '', 'Found in the résumé'), matched[key].length ? tags(matched[key]) : el('p', '', 'No matching terms found.'),
        ...(missing[key].length ? [el('p', '', 'Worth checking'), tags(missing[key], Infinity, 'missing')] : [])));
    }
  }
  const questions = followUpQuestions(result, job);
  const skillsSummary = job.requiredSkills.length
    ? 'The résumé shows ' + matched.required.length + ' of ' + job.requiredSkills.length + ' required skills.'
    : 'This role has no required skills listed.';
  showDialog(profile.name + ' · ' + job.title,
    el('div', 'detail-score', scoreDisplay(score), el('p', 'help', total ? skillsSummary : 'This job has no scoring criteria.')),
    ...details,
    ...(questions.length ? [section('Questions for your next conversation', lines(questions, ''))] : []),
    section('Your review', reviewForm(job, profile)),
    el('div', 'form-actions', button('View candidate profile', 'button secondary', () => showProfile(profile))));
}

function confirmAction(title, message, action, handler) {
  showDialog(title, el('p', 'help', message),
    el('div', 'form-actions',
      button('Cancel', 'button secondary', () => $('dialog').close()),
      button(action, 'button subtle danger', () => { $('dialog').close(); handler(); })));
}

function changed() {
  state.sample = false;
  state.results = null;
  state.comparison.clear();
  render();
}

function confirmRemove(kind, item) {
  const title = kind === 'profile' ? item.name : item.title;
  confirmAction('Remove ' + title + '?', 'This will remove the item and clear the current rankings.', 'Remove', () => {
    if (kind === 'profile') state.profiles = state.profiles.filter(profile => profile.id !== item.id);
    else state.jobs = state.jobs.filter(job => job.id !== item.id);
    for (const key of state.reviews.keys()) {
      const [jobId, profileId] = key.split('/');
      if ((kind === 'profile' ? profileId : jobId) === item.id) state.reviews.delete(key);
    }
    changed();
  });
}

function field(label, control, help) {
  return el('label', 'field', el('span', '', label), control, ...(help ? [el('small', '', help)] : []));
}

function input(name, placeholder, value = '') {
  const control = el('input');
  control.name = name;
  control.placeholder = placeholder;
  control.value = value;
  return control;
}

function textarea(name, placeholder, value = '') {
  const control = el('textarea');
  control.name = name;
  control.placeholder = placeholder;
  control.value = value;
  control.maxLength = maxCharacters;
  return control;
}

function submitButton(label) {
  const control = el('button', 'button primary', label);
  control.type = 'submit';
  return control;
}

function pasteEditor() {
  const name = input('name', 'e.g. Avery Brooks');
  name.required = true;
  name.maxLength = 160;
  const content = textarea('resume', 'Paste the résumé here…');
  content.required = true;
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const form = el('form', '', field('Candidate name', name), field('Résumé text', content),
    error, el('div', 'form-actions', button('Cancel', 'button secondary', () => $('dialog').close()), submitButton('Add résumé')));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!name.value.trim() || !content.value.trim()) {
      error.textContent = 'Enter a candidate name and résumé text.';
      return;
    }
    state.profiles.push(sourceProfile(name.value.trim(), content.value.trim(), 'Pasted text'));
    $('dialog').close();
    changed();
    notify('Candidate profile extracted.');
  });
  showDialog('Paste résumé', form);
}

function splitTerms(value) {
  const terms = value.split(/[,;\n]/).map(term => term.trim()).filter(Boolean);
  return [...new Map(terms.map(term => [term.toLowerCase(), term])).values()];
}

function jobEditor(job) {
  const title = input('title', 'e.g. Data Analyst', job?.title);
  title.maxLength = 160;
  title.required = true;
  const description = textarea('description', 'Required skills: SQL, Python\nPreferred skills: Tableau\n3 years of experience', job?.description);
  const required = input('required', 'e.g. SQL, Python', job?.requiredSkills.join(', '));
  const preferred = input('preferred', 'e.g. Tableau', job?.preferredSkills.join(', '));
  const cert = input('certificates', 'e.g. PMP', job?.certificates.join(', '));
  const years = input('years', '0', job?.years ? String(job.years) : '');
  years.type = 'number';
  years.min = '0';
  years.max = '80';
  years.step = 'any';
  const degree = el('select', '', new Option('No minimum', ''), ...degreeOptions.map(option => new Option(option)));
  degree.value = job?.degree ?? '';
  const message = el('p', 'form-error');
  message.setAttribute('role', 'alert');
  const settings = el('div', '', field('Required skills', required, 'Separate items with commas. Add any role-specific skills the parser missed.'),
    field('Preferred skills', preferred), el('div', 'form-row', field('Minimum years of experience', years), field('Minimum education', degree)),
    field('Required qualifications or certifications', cert));
  settings.hidden = !job;
  const save = submitButton(job ? 'Save job' : 'Extract criteria');
  function detect() {
    if (!description.value.trim()) {
      message.textContent = 'Paste a description to extract criteria, or enter criteria manually.';
      return;
    }
    const detected = parseJob(title.value, description.value);
    required.value = detected.requiredSkills.join(', ');
    preferred.value = detected.preferredSkills.join(', ');
    cert.value = detected.certificates.join(', ');
    years.value = detected.years || '';
    degree.value = detected.degree;
    showSettings('Criteria extracted. Review and edit the fields before saving.');
  }
  const manual = button('Enter criteria manually', 'button subtle', () => showSettings(''));
  const detectAgain = button('Extract from description', 'button secondary', detect);
  detectAgain.hidden = !job;
  manual.hidden = !!job;
  function showSettings(status) {
    settings.hidden = false;
    manual.hidden = true;
    detectAgain.hidden = false;
    save.textContent = 'Save job';
    message.textContent = status;
    message.classList.toggle('help', !!status);
  }
  const form = el('form', '', field('Job title', title), field('Job description', description),
    settings, message, el('div', 'form-actions',
      ...(job ? [button('Remove job', 'button subtle danger', () => confirmRemove('job', job))] : []),
      manual, detectAgain, save));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!title.value.trim()) {
      message.textContent = 'Enter a job title.';
      return;
    }
    if (settings.hidden) {
      detect();
      return;
    }
    const next = {id: job?.id ?? String(++state.nextId), title: title.value.trim(), description: description.value.trim(),
      requiredSkills: normalizeSkills(splitTerms(required.value)), preferredSkills: normalizeSkills(splitTerms(preferred.value)),
      years: Number(years.value), degree: degree.value, certificates: splitTerms(cert.value)};
    if (!(next.requiredSkills.length || next.preferredSkills.length || next.years || next.degree || next.certificates.length)) {
      message.textContent = 'Add at least one criterion before saving the job.';
      return;
    }
    if (job) state.jobs = state.jobs.map(current => current.id === job.id ? next : current);
    else state.jobs.push(next);
    $('dialog').close();
    changed();
    notify('Job criteria saved.');
  });
  showDialog(job ? 'Edit job description' : 'Add a job description', form);
}

function displayName(file, content) {
  const first = content.split(/\r?\n/).find(line => line.trim())?.trim() ?? '';
  const words = first.split(/\s+/);
  if (words.length >= 2 && words.length <= 5 && !/\b(?:résumé|resume|curriculum|vitae|skills|experience|education|summary)\b/i.test(first)
    && /^[\p{Lu}][\p{L}\p{M}'’.\-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’.\-]*){1,4}$/u.test(first)) return first;
  return file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 160).trim() || 'Uploaded résumé';
}

async function upload(files) {
  if (!files.length || state.reading) return;
  const epoch = state.epoch;
  state.reading = true;
  render();
  const profiles = [];
  const errors = [];
  for (const file of files) {
    if (epoch !== state.epoch) return;
    try {
      const content = await readDocument(file);
      profiles.push(sourceProfile(displayName(file, content), content, file.name.split('.').at(-1).toUpperCase()));
    } catch (error) {
      errors.push(file.name + ' · ' + error.message);
    }
  }
  if (epoch !== state.epoch) return;
  state.reading = false;
  if (profiles.length) {
    state.profiles.push(...profiles);
    changed();
  } else render();
  if (errors.length) {
    const body = [el('p', 'help', profiles.length ? quantity(profiles.length, 'résumé') + ' extracted.' : 'No profiles were added.'), lines(errors, '')];
    if (!$('dialog').open) showDialog('Some files could not be read', ...body);
    notify(errors.join(' · '));
  } else notify(quantity(profiles.length, 'candidate profile') + ' extracted.');
}

function recalculate() {
  state.results = analyze(state.profiles, state.jobs);
  render();
}

function clearWorkspace() {
  state.epoch++;
  state.profiles = [];
  state.jobs = [];
  state.selected = '';
  state.reading = false;
  resetReviews();
  changed();
}

function resetReviews() {
  state.reviews.clear();
  state.comparison.clear();
  state.search = '';
  state.statusFilter = '';
}

function loadSample() {
  state.epoch++;
  resetReviews();
  state.profiles = sampleResumes.map(([name, text]) => sourceProfile(name, text, 'Sample'));
  state.jobs = sampleJobs.map(([title, text]) => sourceJob(title, text));
  state.sample = true;
  state.reading = false;
  state.selected = state.jobs[0].id;
  recalculate();
}

function exportRanking() {
  const pair = selectedPair();
  if (!pair) return;
  const rows = [['Job', 'Rank', 'Candidate', 'Match score (%)', 'Required skills found', 'Required skills missing evidence', 'Experience (months)', 'Review status']];
  for (const {profile, score, matched, missing, rank} of rankCandidates(pair.candidates)) {
    if (score === null) continue;
    rows.push([pair.job.title, rank, profile.name, Math.round(score), matched.required.join('; '), missing.required.join('; '), profile.experience.months ?? '', reviewStatuses[getReview(pair.job, profile).status]]);
  }
  const csv = rows.map(row => row.map(value => {
    const text = String(value);
    const safe = /^\s*[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], {type: 'text/csv;charset=utf-8'}));
  const link = el('a');
  link.href = url;
  link.download = 'candidate-ranking.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll('[data-icon]').forEach(fillIcon);
window.addEventListener('hashchange', renderView);
$('close').addEventListener('click', () => $('dialog').close());
$('paste').addEventListener('click', pasteEditor);
$('add-candidate-view').addEventListener('click', pasteEditor);
$('add-job').addEventListener('click', () => jobEditor());
$('add-job-view').addEventListener('click', () => jobEditor());
$('role-select').addEventListener('change', event => {
  state.selected = event.target.value;
  state.comparison.clear();
  renderRanking();
});
$('candidate-search').addEventListener('input', event => {
  state.search = event.target.value;
  renderRanking();
});
$('status-filter').addEventListener('change', event => {
  state.statusFilter = event.target.value;
  renderRanking();
});
$('compare').addEventListener('click', showComparison);
$('run').addEventListener('click', () => { recalculate(); notify('Candidate rankings and job recommendations updated.'); });
$('export').addEventListener('click', exportRanking);
$('export').title = 'Export all candidates for the selected job';
$('reset').addEventListener('click', () => {
  if (!state.profiles.length && !state.jobs.length && !state.reading) return;
  confirmAction('Reset workspace?', 'This clears the résumés, jobs, scores, and review notes in this session.', 'Reset workspace', clearWorkspace);
});
$('demo').addEventListener('click', () => {
  if (state.profiles.length || state.jobs.length) {
    confirmAction('Replace workspace with samples?', 'This replaces the current résumés, jobs, scores, and review notes with fictional examples.', 'Load sample data', loadSample);
  } else loadSample();
});
const dropzone = $('dropzone');
dropzone.addEventListener('click', () => $('files').click());
for (const event of ['dragenter', 'dragover']) {
  dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); });
}
dropzone.addEventListener('dragleave', event => {
  if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragging');
});
dropzone.addEventListener('drop', event => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  void upload([...event.dataTransfer.files]);
});
$('files').addEventListener('change', event => {
  void upload([...event.target.files]);
  event.target.value = '';
});
loadSample();
