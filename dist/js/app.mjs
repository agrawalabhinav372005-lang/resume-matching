/**
 * RESUME MATCHING — Application UI
 * Author: Abhinav Agrawal
 * github.com/agrawalabhinav372005-lang
 *
 * Browser-only resume screening tool. No server, no API keys needed.
 */

import {analyze, degreeOptions, extractProfile, normalizeSkills, parseJob, requirementsGroup, skillEvidence, weights} from './engine.mjs?v=work';
import {maxCharacters, readDocument} from './documents.mjs';
import {openWorkspace} from './storage.mjs?v=work';

// ── SVG icon paths ─────────────────────────────────────────────────────────
const paths = {
  layers:       '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  layout:       '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18m-12 0v12"/>',
  users:        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4m-3-12a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  briefcase:    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m-5 6a20 20 0 0 0 18 0m-9 1v3"/>',
  rotate:       '<path d="M3 11a9 9 0 1 1 2 7M3 5v6h6"/>',
  'file-stack': '<path d="M7 18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1m-3 12h4m-4-4h4"/><rect x="8" y="7" width="13" height="14" rx="2"/>',
  file:         '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Zm0 0v7h7M8 14h8m-8 3h6"/>',
  plus:         '<path d="M12 5v14M5 12h14"/>',
  upload:       '<path d="M12 15V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download:     '<path d="M12 3v12m-5-5 5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  target:       '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  search:       '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  compare:      '<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/>',
  x:            '<path d="m6 6 12 12M18 6 6 18"/>',
  edit:         '<path d="m14 6 4 4M5 19l4-1L20 7a2.8 2.8 0 0 0-4-4L5 14l-1 5Z"/>',
  menu:         '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

const $ = id => document.getElementById(id);

// ── App state ───────────────────────────────────────────────────────────────
const state = {
  profiles: [], jobs: [], results: null, selected: '', intakeJob: '', group: 'all',
  nextId: 0, epoch: 0, reading: false,
  search: '', statusFilter: '', comparison: new Set(), reviews: new Map(),
};

const views = {
  screening:  ['Screening',        'Screening workspace',    'Add a job, collect resumes, and review the evidence behind each match.'],
  candidates: ['Candidates',       'Candidate Profiles',     "Get to know each candidate's experience and see which roles fit their skills."],
  jobs:       ['Job Descriptions', 'Role Requirements',      'Review the skills and qualifications that matter for each role.'],
};

const criteria = {
  required:       'Required skills',
  preferred:      'Preferred skills',
  experience:     'Experience',
  education:      'Education',
  qualifications: 'Qualifications',
};

const reviewStatuses = {todo: 'To verify', 'follow-up': 'Follow up', reviewed: 'Evidence checked'};
const rankingGroups = {all: 'All candidates', ready: 'Requirements found', gaps: 'Needs verification'};
const comparisonLimit = 3;
let storage;
let revision = 0;
let pendingSave = Promise.resolve();

// ── Sidebar mobile toggle ───────────────────────────────────────────────────
const sidebar = $('sidebar');
const sidebarToggle = $('sidebar-toggle');

function setSidebarOpen(open) {
  sidebar.classList.toggle('open', open);
  sidebarToggle.setAttribute('aria-expanded', String(open));
}

sidebarToggle.addEventListener('click', () => setSidebarOpen(!sidebar.classList.contains('open')));
document.addEventListener('click', event => {
  if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
    setSidebarOpen(false);
  }
});
sidebar.addEventListener('click', event => {
  if (sidebar.classList.contains('open') && event.target.closest('nav a')) {
    setSidebarOpen(false);
    $('main').focus();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar.classList.contains('open') && !$('dialog').open) {
    setSidebarOpen(false);
    sidebarToggle.focus();
  }
});

// ── DOM helpers ─────────────────────────────────────────────────────────────
function icon(name, className = '') {
  const span = el('span', className);
  span.dataset.icon = name;
  fillIcon(span);
  return span;
}

function fillIcon(span) {
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (paths[span.dataset.icon] ?? '') + '</svg>';
}

function el(tag, className, ...children) {
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

function elLink(label, href) {
  const node = el('a', 'plain-link', label);
  node.href = href;
  return node;
}

function emptyState(iconName, title, description) {
  return el('div', 'empty-state', icon(iconName), el('strong', '', title), el('p', '', description));
}

// ── Data helpers ────────────────────────────────────────────────────────────
function sourceProfile(name, text, format, jobId, id = String(++state.nextId)) {
  return {id, ...extractProfile(name, text), format, jobId};
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
  meter.min = 0; meter.max = 100; meter.value = score;
  meter.setAttribute('aria-hidden', 'true');
  return el('div', 'score-display', scoreBadge(score), meter);
}

function avatar(profile) {
  const initials = profile.name.trim().split(/\s+/).slice(0, 2)
    .map(part => Array.from(part)[0]).join('').toUpperCase();
  const node = el('span', 'avatar', initials);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function tags(values, maximum, style) {
  maximum = maximum ?? Infinity;
  style = style ?? '';
  const group = el('div', 'tags');
  for (const value of values.slice(0, maximum)) group.append(el('span', 'tag ' + style, value));
  if (values.length > maximum) group.append(el('span', 'tag more', '+' + (values.length - maximum)));
  return group;
}

// ── View routing ─────────────────────────────────────────────────────────────
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

// ── Main render ──────────────────────────────────────────────────────────────
function render() {
  renderView();
  const matches = state.results?.pairs.flatMap(pair => pair.candidates)
    .filter(result => result.score !== null).length ?? 0;
  const metrics = [
    [state.profiles.length, 'Candidate profiles',  'users',     ''],
    [state.jobs.length,     'Job descriptions',     'briefcase', 'teal'],
    [matches,               'Matches scored',       'target',    'purple'],
  ];
  $('summary').replaceChildren(...metrics.map(function([value, title, name, tone]) {
    return el('div', 'metric', icon(name, 'icon-box ' + tone),
      el('div', '', el('strong', '', String(value)), el('small', '', title)));
  }));
  $('reset').disabled = !state.profiles.length && !state.jobs.length && !state.reading;
  $('run').disabled  = state.reading || !state.profiles.length || !state.jobs.length;
  $('run-note').textContent = state.reading ? 'Reading resume files...'
    : state.results ? 'Rankings update when resumes or job criteria change.'
    : !state.profiles.length || !state.jobs.length
      ? 'Add a resume and a job description to get started.'
      : '';
  renderInputs();
  renderRanking();
  renderCards();
}

// ── Inputs panel ──────────────────────────────────────────────────────────────
function renderInputs() {
  const intake = $('intake-role');
  intake.replaceChildren(new Option('No specific job', ''), ...state.jobs.map(job => new Option(job.title, job.id)));
  intake.value = state.intakeJob;
  intake.disabled = !state.jobs.length || state.reading;
  $('dropzone').disabled = state.reading;
  const resumeList = $('resume-preview');
  resumeList.replaceChildren(...state.profiles.slice(0, 2).map(function(profile) {
    return el('div', 'item-row',
      icon('file'),
      el('div', 'item-content', el('strong', 'item-name', profile.name),
        el('small', 'item-meta', state.jobs.find(job => job.id === profile.jobId)?.title ?? profile.format)),
      iconButton('Remove resume for ' + profile.name, 'x', function() { confirmRemove('profile', profile); })
    );
  }));
  if (state.profiles.length > 2)
    resumeList.append(el('div', 'view-all', elLink('View all ' + state.profiles.length + ' candidates \u2192', '#candidates')));

  const jobsEl = $('job-preview');
  if (!state.jobs.length) {
    jobsEl.replaceChildren(el('p', 'empty-hint', 'Add a job description to set matching criteria.'));
    return;
  }
  jobsEl.replaceChildren(...state.jobs.slice(0, 3).map(function(job) {
    return el('div', 'item-row',
      icon('briefcase'),
      el('div', 'item-content',
        el('strong', 'item-name', job.title),
        el('small', 'item-meta', quantity(job.requiredSkills.length, 'required skill'))
      ),
      iconButton('Edit ' + job.title, 'edit', function() { jobEditor(job); })
    );
  }));
  if (state.jobs.length > 3) jobsEl.append(elLink('View all ' + state.jobs.length + ' jobs \u2192', '#jobs'));
}

// ── Rankings ──────────────────────────────────────────────────────────────────
function selectedPair() {
  return state.results?.pairs.find(pair => pair.job.id === state.selected);
}

function reviewKey(job, profile) { return job.id + '/' + profile.id; }
function getReview(job, profile) {
  return state.reviews.get(reviewKey(job, profile)) ?? {status: 'todo', note: ''};
}
function workflowStatus(status) {
  return el('span', 'review-status ' + status, reviewStatuses[status]);
}

function renderGroups(pair) {
  const container = $('rank-groups');
  container.hidden = !pair?.candidates.length;
  if (container.hidden) return;
  const counts = {all: pair.candidates.length, ready: 0, gaps: 0};
  for (const result of pair.candidates) counts[requirementsGroup(result)]++;
  container.replaceChildren(...Object.entries(rankingGroups).map(([key, label]) => {
    const control = button(label + ' (' + counts[key] + ')', 'group-filter', () => {
      state.group = key;
      renderRanking();
      container.querySelector('[aria-pressed="true"]').focus();
    });
    control.setAttribute('aria-pressed', String(key === state.group));
    return control;
  }));
}

function rankCandidates(candidates) {
  let rank = 0, prior;
  return candidates.map(function(result, index) {
    if (result.score === null) return Object.assign({}, result, {rank: null});
    const key = [result.score, result.fraction.required, result.matched.required.length].join('/');
    if (key !== prior) rank = index + 1;
    prior = key;
    return Object.assign({}, result, {rank});
  });
}

function renderRanking() {
  const select = $('role-select');
  if (!state.jobs.some(job => job.id === state.selected)) state.selected = state.jobs[0]?.id ?? '';
  select.replaceChildren(...(state.jobs.length
    ? state.jobs.map(job => new Option(job.title, job.id))
    : [new Option('No jobs', '')]));
  select.value = state.selected;
  select.disabled = !state.jobs.length;

  const pair = selectedPair();
  renderGroups(pair);
  $('review-toolbar').hidden = !pair;
  $('candidate-search').value = state.search;
  $('status-filter').value = state.statusFilter;
  updateComparisonControls();
  $('export').disabled = !pair?.candidates.some(r => r.score !== null);

  if (!pair) {
    $('ranking').replaceChildren(emptyState('target', 'No rankings yet', 'Add a job and its candidate resumes to see the rankings here.'));
    return;
  }
  if (!pair.candidates.length) {
    $('review-toolbar').hidden = true;
    $('ranking').replaceChildren(emptyState('users', 'No candidates for this job', 'Assign resumes to this job or leave them unassigned to consider them for every job.'));
    return;
  }

  const query = state.search.trim().toLowerCase();
  const visible = rankCandidates(pair.candidates).filter(function(item) {
    var profile = item.profile, matched = item.matched;
    const text = [profile.name, ...profile.skills, ...matched.required, ...matched.preferred].join(' ').toLowerCase();
    return (!query || text.includes(query)) &&
           (state.group === 'all' || requirementsGroup(item) === state.group) &&
           (!state.statusFilter || getReview(pair.job, profile).status === state.statusFilter);
  });

  $('result-count').textContent = visible.length + ' of ' + quantity(pair.candidates.length, 'candidate');

  if (!visible.length) {
    $('ranking').replaceChildren(emptyState('search', 'No matches', 'Try a different group, name, skill, or review status.'));
    return;
  }

  const headings = ['Compare', 'Rank', 'Candidate', 'Match score', 'Required skills', 'Verification', ''];
  const headers = headings.map(function(label) {
    const header = el('th', '', label || el('span', 'visually-hidden', 'Actions'));
    header.scope = 'col';
    return header;
  });

  const rows = visible.map(function(result) {
    const profile = result.profile, score = result.score, matched = result.matched, rank = result.rank;
    const checked = el('input', 'compare-check');
    checked.type = 'checkbox';
    checked.checked = state.comparison.has(profile.id);
    checked.setAttribute('aria-label', 'Select ' + profile.name + ' for comparison');
    checked.addEventListener('change', function() {
      if (!checked.checked) state.comparison.delete(profile.id);
      else if (state.comparison.size < comparisonLimit) state.comparison.add(profile.id);
      else { checked.checked = false; notify('You can compare up to 3 candidates at a time.'); }
      updateComparisonControls();
    });
    const reviewBtn = button('Review match', 'plain-link evidence-button', function() { showResult(result, pair.job); });
    reviewBtn.setAttribute('aria-label', 'Review match for ' + profile.name);
    const group = requirementsGroup(result);
    const skills = el('div', 'coverage',
      el('span', 'help', pair.job.requiredSkills.length
        ? matched.required.length + ' of ' + pair.job.requiredSkills.length + ' found'
        : 'No required skills'),
      el('span', 'requirements-status ' + group, rankingGroups[group]),
      ...(matched.required.length ? [tags(matched.required, 2)] : []));
    return el('tr', '',
      el('td', '', checked),
      el('td', 'rank-cell', rank === null ? '\u2014' : String(rank)),
      el('td', '', el('div', 'candidate-cell', avatar(profile),
        el('div', '', el('strong', '', profile.name), el('small', '', experience(profile))))),
      el('td', '', scoreDisplay(score)),
      el('td', '', skills),
      el('td', '', workflowStatus(getReview(pair.job, profile).status)),
      el('td', '', reviewBtn)
    );
  });

  const table = el('table', '',
    el('caption', 'visually-hidden', 'Candidate rankings for ' + pair.job.title),
    el('thead', '', el('tr', '', ...headers)),
    el('tbody', '', ...rows)
  );
  $('ranking').replaceChildren(el('div', 'table-wrap', table));
}

function updateComparisonControls() {
  const count = state.comparison.size;
  $('compare').disabled = count < 2;
  $('compare-label').textContent = count ? 'Compare (' + count + ')' : 'Compare Candidates';
}

// ── Comparison dialog ─────────────────────────────────────────────────────────
function showComparison() {
  const pair = selectedPair();
  if (!pair) return;
  const candidates = pair.candidates.filter(r => state.comparison.has(r.profile.id));
  if (candidates.length < 2) return;
  const column = function(label, content) { const n = el('th', '', content ?? label); n.scope = 'col'; return n; };
  const row = function(label, body) {
    const heading = el('th', '', label); heading.scope = 'row';
    return el('tr', '', heading, ...candidates.map(result => el('td', '', body(result))));
  };
  const table = el('table', 'comparison-table',
    el('thead', '', el('tr', '', column('Criterion'),
      ...candidates.map(function(c) { return column(c.profile.name, el('div', 'candidate-cell', avatar(c.profile), c.profile.name)); }))),
    el('tbody', '',
      row('Match score',              r => scoreDisplay(r.score)),
      row('Required skills found',    r => r.matched.required.length    ? tags(r.matched.required)   : '\u2014'),
      row('Required skills missing',  r => r.missing.required.length    ? tags(r.missing.required, Infinity, 'missing') : '\u2014'),
      row('Preferred skills found',   r => r.matched.preferred.length   ? tags(r.matched.preferred)  : '\u2014'),
      row('Experience',               r => experience(r.profile)),
      row('Education',                r => lines(r.profile.education, 'No education listed')),
      row('Review status',            r => workflowStatus(getReview(pair.job, r.profile).status)),
      row('Actions',                  r => button('Review match', 'plain-link', function() { showResult(r, pair.job); }))
    )
  );
  showDialog('Compare Candidates', el('p', 'comparison-role', pair.job.title), el('div', 'table-wrap', table));
  $('dialog').classList.add('wide');
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function renderCards() {
  const cards = state.profiles.map(function(profile) {
    const jobRecs = state.results?.recommendations.find(item => item.profile.id === profile.id)?.jobs ?? [];
    const ranked = jobRecs.filter(isRecommendation);
    return el('article', 'panel card',
      el('div', 'card-head', avatar(profile), el('h3', 'card-title', profile.name),
        iconButton('Remove resume for ' + profile.name, 'x', function() { confirmRemove('profile', profile); })),
      el('p', 'card-meta', [state.jobs.find(job => job.id === profile.jobId)?.title, experience(profile), quantity(profile.skills.length, 'skill')].filter(Boolean).join(' · ')),
      profile.skills.length ? tags(profile.skills, 6) : el('p', 'card-meta', 'No skills detected.'),
      el('div', '', el('h4', '', 'Recommended jobs'),
        ranked.length ? recommendationRows(ranked.slice(0, 3))
          : el('p', 'card-meta', state.results ? 'No roles met the criteria.' : 'Run screening to see recommendations.')),
      el('div', 'card-actions', button('View profile', 'button secondary', function() { showProfile(profile); }))
    );
  });
  $('candidate-cards').replaceChildren(
    ...(cards.length ? cards : [emptyState('users', 'No candidates yet', 'Add a resume to extract a candidate profile.')])
  );

  const jobCards = state.jobs.map(function(job) {
    return el('article', 'panel card',
      el('div', 'card-head', icon('briefcase', 'icon-box teal'), el('h3', 'card-title', job.title)),
      el('p', 'card-meta', quantity(state.profiles.filter(profile => profile.jobId === job.id).length, 'assigned candidate')),
      el('div', '', el('h4', '', 'Required skills'),
        job.requiredSkills.length ? tags(job.requiredSkills) : el('p', 'card-meta', 'None specified.')),
      el('div', '', el('h4', '', 'Preferred skills'),
        job.preferredSkills.length ? tags(job.preferredSkills) : el('p', 'card-meta', 'None specified.')),
      el('p', 'card-meta',
        [job.years ? quantity(job.years, 'year') + ' min experience' : '', job.degree, ...job.certificates]
          .filter(Boolean).join(' \u00b7 ') || 'No experience or education criteria.'),
      el('div', 'card-actions', button('Edit criteria', 'button secondary', function() { jobEditor(job); }, 'edit'))
    );
  });
  $('job-cards').replaceChildren(
    ...(jobCards.length ? jobCards : [emptyState('briefcase', 'No jobs yet', 'Add a job description to review its requirements.')])
  );
}

function isRecommendation(result) {
  const skillsSpecified = result.job.requiredSkills.length || result.job.preferredSkills.length;
  return result.score > 0 && (!skillsSpecified || result.matched.required.length || result.matched.preferred.length);
}

function recommendationRows(results, interactive) {
  return el('div', 'mini-results', ...results.map(function(result) {
    return el('div', 'mini-row',
      interactive ? button(result.job.title, 'plain-link', function() { showResult(result, result.job); }) : el('span', '', result.job.title),
      scoreBadge(result.score)
    );
  }));
}

// ── Notifications ─────────────────────────────────────────────────────────────
let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);
  const box = $('notice');
  box.hidden = false;
  box.textContent = message;
  noticeTimer = setTimeout(function() { box.hidden = true; }, 4500);
}

// ── Dialog ─────────────────────────────────────────────────────────────────────
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
  return values.length
    ? el('ul', 'evidence-list', ...values.map(v => el('li', '', v)))
    : el('p', '', empty);
}

// ── Profile dialog ────────────────────────────────────────────────────────────
function showProfile(profile) {
  const scores = state.results?.recommendations.find(item => item.profile.id === profile.id)?.jobs ?? [];
  const recommended = scores.filter(isRecommendation);
  showDialog(profile.name,
    section('Assigned job', el('p', '', state.jobs.find(job => job.id === profile.jobId)?.title ?? 'No specific job')),
    section('Skills', profile.skills.length ? tags(profile.skills) : el('p', '', 'No skills detected.')),
    section('Education', lines(profile.education, 'No education evidence detected.')),
    section('Qualifications', lines(profile.qualifications, 'No qualification evidence detected.')),
    section('Experience', el('p', '', experience(profile) + ' \u00b7 ' + profile.experience.source),
      lines(profile.roles, 'No employment history detected.')),
    section('Job recommendations',
      recommended.length ? recommendationRows(recommended, true)
        : el('p', '', state.results ? 'No roles met the recommendation criteria.' : 'Add a job to see recommendations.')),
    ...(scores.length > recommended.length
      ? [section('Other job match scores', recommendationRows(scores.filter(r => !isRecommendation(r)), true))]
      : []),
    el('details', 'source-resume', el('summary', '', 'View resume text'), el('pre', '', profile.text)),
    el('div', 'form-actions', button('Edit resume', 'button secondary', () => resumeEditor(profile), 'edit'))
  );
}

// ── Follow-up questions ───────────────────────────────────────────────────────
function followUpQuestions(result, job) {
  const questions = result.missing.required.slice(0, 2)
    .map(skill => 'Can you walk me through a project where you used ' + skill + '?');
  if (result.fraction.experience !== null && result.fraction.experience < 1)
    questions.push('How much experience do you have with work similar to this role?');
  if (questions.length < 3 && result.missing.qualifications.length)
    questions.push('Can you confirm whether you hold ' + result.missing.qualifications[0] + '?');
  if (questions.length < 3 && result.fraction.education === 0)
    questions.push('Could you tell me about your completed education for this role\'s ' + job.degree + ' requirement?');
  return questions.slice(0, 3);
}

// ── Review form ───────────────────────────────────────────────────────────────
function reviewForm(job, profile) {
  const current = getReview(job, profile);
  const status = el('select', '', ...Object.entries(reviewStatuses).map(function([v, l]) { return new Option(l, v); }));
  status.value = current.status;
  const note = textarea('review-note', 'What did you verify? What would you ask next?', current.note);
  note.maxLength = 3000; note.rows = 3;
  const confirmation = el('span', 'help review-confirmation');
  confirmation.setAttribute('role', 'status');
  const form = el('form', 'review-form',
    field('Verification status', status),
    field('Notes for this role', note, 'Record what you checked against the original resume.'),
    el('div', 'form-actions', confirmation, submitButton('Save review'))
  );
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    state.reviews.set(reviewKey(job, profile), {status: status.value, note: note.value.trim()});
    renderRanking();
    confirmation.textContent = 'Saving review…';
    confirmation.textContent = await saveWorkspace() ? 'Review saved.' : 'Review updated for this session.';
  });
  return form;
}

// ── Result dialog ─────────────────────────────────────────────────────────────
function showResult(result, job) {
  const profile = result.profile, fraction = result.fraction,
        matched = result.matched, missing = result.missing, score = result.score;
  const total = Object.keys(weights).reduce(function(sum, key) {
    return sum + (fraction[key] === null ? 0 : weights[key]);
  }, 0);
  const details = [];
  for (const [key, label] of Object.entries(criteria)) {
    if (fraction[key] === null) continue;
    const points  = (fraction[key] * weights[key] / total * 100).toFixed(1);
    const maximum = (weights[key] / total * 100).toFixed(1);
    const title   = label + ' \u00b7 ' + points + ' of ' + maximum + ' points';
    if (key === 'experience') {
      details.push(section(title, el('p', '', 'Minimum ' + quantity(job.years, 'year') + ' \u00b7 Evidence ' + experience(profile) + ' \u00b7 ' + profile.experience.source)));
    } else if (key === 'education') {
      details.push(section(title, el('p', '', 'Minimum ' + job.degree + ' degree'), lines(profile.education, 'No degree evidence detected.')));
    } else {
      details.push(section(title,
        el('p', '', 'Found in the resume'),
        matched[key].length ? tags(matched[key]) : el('p', '', 'No matching terms found.'),
        ...(missing[key].length ? [el('p', '', 'Worth verifying'), tags(missing[key], Infinity, 'missing')] : [])
      ));
    }
  }
  const questions = followUpQuestions(result, job);
  const excerpts = skillEvidence(profile, matched.required);
  const skillsSummary = job.requiredSkills.length
    ? 'The resume shows ' + matched.required.length + ' of ' + job.requiredSkills.length + ' required skills.'
    : 'This role has no required skills listed.';
  showDialog(profile.name + ' \u00b7 ' + job.title,
    el('div', 'detail-score', scoreDisplay(score), el('p', 'help', total ? skillsSummary : 'This job has no scoring criteria.')),
    ...details,
    ...(excerpts.length ? [section('Resume evidence',
      el('ul', 'evidence-list', ...excerpts.map(({skill, line}) => el('li', '', el('strong', '', skill), el('p', '', line))))
    )] : []),
    ...(questions.length ? [section('Suggested follow-up questions', lines(questions, ''))] : []),
    section('Your review', reviewForm(job, profile)),
    el('div', 'form-actions', button('View candidate profile', 'button secondary', function() { showProfile(profile); }))
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function confirmAction(title, message, action, handler) {
  showDialog(title, el('p', 'help', message),
    el('div', 'form-actions',
      button('Cancel', 'button secondary', function() { $('dialog').close(); }),
      button(action, 'button subtle danger', function() { $('dialog').close(); handler(); })
    )
  );
}

function changed() {
  state.comparison.clear();
  recalculate();
  saveWorkspace();
}

function confirmRemove(kind, item) {
  const title = kind === 'profile' ? item.name : item.title;
  const explanation = kind === 'profile' ? 'This removes the resume and its review notes.' : 'This removes the job and its notes. Assigned resumes return to the general pool.';
  confirmAction('Remove ' + title + '?', explanation, 'Remove', function() {
    if (kind === 'profile') state.profiles = state.profiles.filter(p => p.id !== item.id);
    else {
      state.jobs = state.jobs.filter(j => j.id !== item.id);
      for (const profile of state.profiles) if (profile.jobId === item.id) profile.jobId = '';
      if (state.intakeJob === item.id) state.intakeJob = '';
    }
    for (const key of state.reviews.keys()) {
      const parts = key.split('/');
      if ((kind === 'profile' ? parts[1] : parts[0]) === item.id) state.reviews.delete(key);
    }
    changed();
  });
}

// ── Form helpers ──────────────────────────────────────────────────────────────
function field(label, control, help) {
  return el('label', 'field', el('span', '', label), control, ...(help ? [el('small', '', help)] : []));
}

function input(name, placeholder, value) {
  value = value ?? '';
  const control = el('input');
  control.name = name;
  control.placeholder = placeholder;
  control.value = value;
  return control;
}

function textarea(name, placeholder, value) {
  value = value ?? '';
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

// ── Paste editor ──────────────────────────────────────────────────────────────
function resumeEditor(profile) {
  const name = input('name', 'e.g. Priya Sharma', profile?.name);
  name.required = true; name.maxLength = 160;
  const content = textarea('resume', 'Paste the resume text here...', profile?.text);
  content.required = true;
  const job = el('select', '', new Option('No specific job', ''), ...state.jobs.map(item => new Option(item.title, item.id)));
  job.value = profile ? profile.jobId : state.intakeJob;
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const form = el('form', '',
    field('Candidate name', name),
    field('Assigned job', job, 'An unassigned resume can be considered for every job.'),
    field('Resume text', content),
    error,
    el('div', 'form-actions',
      button('Cancel', 'button secondary', function() { $('dialog').close(); }),
      submitButton(profile ? 'Save resume' : 'Add resume')
    )
  );
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!name.value.trim() || !content.value.trim()) {
      error.textContent = 'Please enter a name and resume text.';
      return;
    }
    const text = content.value.trim();
    const format = profile && profile.text === text ? profile.format : profile ? 'Edited text' : 'Pasted text';
    const updated = sourceProfile(name.value.trim(), text, format, job.value, profile?.id);
    if (profile) state.profiles = state.profiles.map(item => item.id === profile.id ? updated : item);
    else state.profiles.push(updated);
    if (profile && profile.text !== text) invalidateVerification(null, profile.id);
    $('dialog').close();
    changed();
    notify(profile ? 'Resume and rankings updated.' : 'Candidate added.');
  });
  showDialog(profile ? 'Edit resume' : 'Paste resume text', form);
}

// ── Job editor ────────────────────────────────────────────────────────────────
function splitTerms(value) {
  const terms = value.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
  return [...new Map(terms.map(t => [t.toLowerCase(), t])).values()];
}

function jobEditor(job) {
  const title       = input('title', 'e.g. Data Analyst', job ? job.title : undefined);
  title.maxLength   = 160; title.required = true;
  const description = textarea('description',
    'Required skills: SQL, Python\nPreferred skills: Tableau\n3 years of experience', job ? job.description : undefined);
  const required    = input('required', 'e.g. SQL, Python', job ? job.requiredSkills.join(', ') : undefined);
  const preferred   = input('preferred', 'e.g. Tableau', job ? job.preferredSkills.join(', ') : undefined);
  const cert        = input('certificates', 'e.g. PMP', job ? job.certificates.join(', ') : undefined);
  const years       = input('years', '0', job && job.years ? String(job.years) : undefined);
  years.type = 'number'; years.min = '0'; years.max = '80'; years.step = 'any';
  const degree = el('select', '', new Option('No minimum', ''), ...degreeOptions.map(o => new Option(o)));
  degree.value = job ? (job.degree ?? '') : '';
  const message = el('p', 'form-error');
  message.setAttribute('role', 'alert');
  const settings = el('div', '',
    field('Required skills', required, 'Separate with commas. Add any role-specific skills the parser missed.'),
    field('Preferred skills', preferred),
    el('div', 'field-row', field('Min. years experience', years), field('Min. education', degree)),
    field('Required certifications / qualifications', cert)
  );
  settings.hidden = !job;
  const save = submitButton(job ? 'Save job' : 'Extract criteria');

  function detect() {
    if (!description.value.trim()) { message.textContent = 'Paste a description to extract criteria, or enter manually.'; return; }
    const detected = parseJob(title.value, description.value);
    required.value  = detected.requiredSkills.join(', ');
    preferred.value = detected.preferredSkills.join(', ');
    cert.value      = detected.certificates.join(', ');
    years.value     = detected.years || '';
    degree.value    = detected.degree;
    showSettings('Criteria extracted — review and edit before saving.');
  }

  const manual      = button('Enter criteria manually', 'button subtle', function() { showSettings(''); });
  const detectAgain = button('Re-extract from description', 'button secondary', detect);
  detectAgain.hidden = !job;
  manual.hidden      = !!job;

  function showSettings(status) {
    settings.hidden = false; manual.hidden = true; detectAgain.hidden = false;
    save.textContent = 'Save job';
    message.textContent = status;
    message.classList.toggle('help', !!status);
  }

  const form = el('form', '',
    field('Job title', title), field('Job description', description),
    settings, message,
    el('div', 'form-actions',
      ...(job ? [button('Remove job', 'button subtle danger', function() { confirmRemove('job', job); })] : []),
      manual, detectAgain, save
    )
  );

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!title.value.trim()) { message.textContent = 'Enter a job title.'; return; }
    if (settings.hidden) { detect(); return; }
    const next = {
      id: job ? job.id : String(++state.nextId),
      title: title.value.trim(),
      description: description.value.trim(),
      requiredSkills:  normalizeSkills(splitTerms(required.value)),
      preferredSkills: normalizeSkills(splitTerms(preferred.value)),
      years: Number(years.value),
      degree: degree.value,
      certificates: splitTerms(cert.value),
    };
    if (!(next.requiredSkills.length || next.preferredSkills.length || next.years || next.degree || next.certificates.length)) {
      message.textContent = 'Add at least one criterion before saving.';
      return;
    }
    if (job) {
      state.jobs = state.jobs.map(j => j.id === job.id ? next : j);
      const fields = ['requiredSkills', 'preferredSkills', 'years', 'degree', 'certificates'];
      if (fields.some(key => JSON.stringify(job[key]) !== JSON.stringify(next[key]))) invalidateVerification(job.id, null);
    } else {
      state.jobs.push(next);
      state.selected = next.id;
      state.intakeJob = next.id;
      state.group = 'all';
    }
    $('dialog').close();
    changed();
    notify('Job criteria saved.');
  });

  showDialog(job ? 'Edit job description' : 'Add a job description', form);
}

// ── File upload ───────────────────────────────────────────────────────────────
function displayName(file, content) {
  const first = content.split(/\r?\n/).find(line => line.trim())?.trim() ?? '';
  const words = first.split(/\s+/);
  if (words.length >= 2 && words.length <= 5
    && !/\b(?:resume|curriculum|vitae|skills|experience|education|summary)\b/i.test(first)
    && /^[\p{Lu}][\p{L}\p{M}'\.\-]*(?:\s+[\p{Lu}][\p{L}\p{M}'\.\-]*){1,4}$/u.test(first))
    return first;
  return file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 160).trim() || 'Uploaded resume';
}

async function upload(files) {
  if (!files.length || state.reading) return;
  const epoch = state.epoch;
  const jobId = state.intakeJob;
  state.reading = true;
  render();
  const profiles = [], errors = [];
  for (const file of files) {
    if (epoch !== state.epoch) return;
    try {
      const content = await readDocument(file);
      profiles.push(sourceProfile(displayName(file, content), content, file.name.split('.').at(-1).toUpperCase(), jobId));
    } catch (error) {
      errors.push(file.name + ' \u00b7 ' + error.message);
    }
  }
  if (epoch !== state.epoch) return;
  state.reading = false;
  if (!state.jobs.some(job => job.id === jobId)) for (const profile of profiles) profile.jobId = '';
  if (profiles.length) { state.profiles.push(...profiles); changed(); } else render();
  if (errors.length) {
    const body = [el('p', 'help', profiles.length ? quantity(profiles.length, 'resume') + ' extracted.' : 'No profiles were added.'), lines(errors, '')];
    if (!$('dialog').open) showDialog('Some files could not be read', ...body);
    notify(errors.join(' \u00b7 '));
  } else notify(quantity(profiles.length, 'candidate profile') + ' extracted.');
}

// ── Core actions ──────────────────────────────────────────────────────────────
function recalculate() {
  state.results = state.profiles.length && state.jobs.length ? analyze(state.profiles, state.jobs) : null;
  render();
}

function invalidateVerification(jobId, profileId) {
  for (const [key, review] of state.reviews) {
    const [job, profile] = key.split('/');
    if ((jobId ? jobId === job : profileId === profile) && review.status === 'reviewed') {
      state.reviews.set(key, {...review, status: 'todo'});
    }
  }
}

function clearWorkspace() {
  state.epoch++;
  state.profiles = [];
  state.jobs = [];
  state.selected = '';
  state.intakeJob = '';
  state.group = 'all';
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

async function initializeWorkspace() {
  try {
    const store = await openWorkspace();
    const saved = await store.load();
    if (saved.data) {
      const {profiles, jobs, reviews} = saved.data;
      const restored = profiles.map(({name, text, format, jobId, id}) => sourceProfile(name, text, format, jobId, id));
      const reviewMap = new Map(reviews);
      state.profiles = restored;
      state.jobs = jobs;
      state.reviews = reviewMap;
      state.nextId = Math.max(0, ...restored.concat(jobs).map(item => Number(item.id)));
    }
    revision = saved.revision;
    storage = store;
    $('save-status').textContent = store.label;
  } catch {
    $('save-status').textContent = 'Saving unavailable. Changes last until you close this page.';
  }
  $('main').inert = false;
  recalculate();
}

function saveWorkspace() {
  if (!storage) return Promise.resolve(false);
  const data = structuredClone({
    profiles: state.profiles.map(({name, text, format, jobId, id}) => ({name, text, format, jobId, id})),
    jobs: state.jobs, reviews: [...state.reviews]
  });
  $('save-status').textContent = 'Saving…';
  pendingSave = pendingSave.then(async () => {
    try {
      revision = await storage.save(data, revision);
      $('save-status').textContent = storage.label;
      return true;
    } catch (error) {
      $('save-status').textContent = 'Changes not saved. ' + (error.message || 'Check storage availability.');
      return false;
    }
  });
  return pendingSave;
}

function exportRanking() {
  const pair = selectedPair();
  if (!pair) return;
  const rows = [['Job', 'Rank', 'Candidate', 'Match score (%)', 'Requirement group', 'Required skills found', 'Required skills missing', 'Experience (months)', 'Verification status']];
  for (const item of rankCandidates(pair.candidates)) {
    if (item.score === null) continue;
    rows.push([pair.job.title, item.rank, item.profile.name, Math.round(item.score), rankingGroups[requirementsGroup(item)],
      item.matched.required.join('; '), item.missing.required.join('; '),
      item.profile.experience.months ?? '',
      reviewStatuses[getReview(pair.job, item.profile).status]]);
  }
  const csv = rows.map(row => row.map(function(value) {
    const text = String(value);
    const safe = /^\s*[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], {type: 'text/csv;charset=utf-8'}));
  const link = el('a');
  link.href = url;
  link.download = 'candidate-ranking.csv';
  link.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-icon]').forEach(fillIcon);
window.addEventListener('hashchange', renderView);

$('close').addEventListener('click', function() { $('dialog').close(); });
$('dialog').addEventListener('click', function(e) { if (e.target === $('dialog')) $('dialog').close(); });

$('paste').addEventListener('click', () => resumeEditor());
$('add-candidate-view').addEventListener('click', () => resumeEditor());
$('add-job').addEventListener('click', function() { jobEditor(); });
$('start-job').addEventListener('click', function() { jobEditor(); });
$('add-job-view').addEventListener('click', function() { jobEditor(); });
$('intake-role').addEventListener('change', event => { state.intakeJob = event.target.value; });

$('role-select').addEventListener('change', function(event) {
  state.selected = event.target.value;
  state.group = 'all';
  state.comparison.clear();
  renderRanking();
});
$('candidate-search').addEventListener('input', function(event) {
  state.search = event.target.value;
  renderRanking();
});
$('status-filter').addEventListener('change', function(event) {
  state.statusFilter = event.target.value;
  renderRanking();
});

$('compare').addEventListener('click', showComparison);
$('run').addEventListener('click', function() {
  $('results-title').focus();
  $('results-title').scrollIntoView({block: 'start'});
});
$('export').addEventListener('click', exportRanking);
$('export').title = 'Export rankings for the selected job as CSV';

$('reset').addEventListener('click', function() {
  if (!state.profiles.length && !state.jobs.length && !state.reading) return;
  confirmAction('Clear workspace?',
    'This deletes the saved resumes, jobs, and review notes for this workspace.',
    'Clear workspace', clearWorkspace);
});

const dropzone = $('dropzone');
dropzone.addEventListener('click', function() { $('files').click(); });
['dragenter', 'dragover'].forEach(function(evt) {
  dropzone.addEventListener(evt, function(e) { e.preventDefault(); dropzone.classList.add('dragging'); });
});
dropzone.addEventListener('dragleave', function(event) {
  if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragging');
});
dropzone.addEventListener('drop', function(event) {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  void upload([...event.dataTransfer.files]);
});
$('files').addEventListener('change', function(event) {
  void upload([...event.target.files]);
  event.target.value = '';
});

// ── Init ──────────────────────────────────────────────────────────────────────
void initializeWorkspace();
