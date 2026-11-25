const skillGroups = {
  'Software & cloud': 'Python|JavaScript:JS,ECMAScript|TypeScript|React:React.js,ReactJS|Vue:Vue.js,VueJS|Angular|Node.js:NodeJS|Java|Kotlin|Swift|Go:Golang|Rust|C++|C#|.NET:dotnet|PHP|Ruby|HTML:HTML5|CSS:CSS3|SQL|PostgreSQL:Postgres|MySQL|MongoDB|Redis|Django|Flask|FastAPI|Spring Boot|Git|GitHub Actions|REST APIs:REST API,RESTful APIs,RESTful API|GraphQL|Docker|Kubernetes:K8s|Terraform|Ansible|Linux|AWS:Amazon Web Services|Azure:Microsoft Azure|Google Cloud:GCP,GCP Cloud|CI/CD:continuous integration and delivery|Jenkins|Agile|Scrum|Jira|Test automation:automated testing|Selenium|Playwright|Unit testing|Cybersecurity|Network administration',
  'Data & AI': 'Excel:Microsoft Excel,MS Excel|Power BI:PowerBI|Tableau|Looker|Data analysis:data analytics|Data visualization:data visualisation|Statistics:statistical analysis|Machine learning:ML|Deep learning|Natural language processing:NLP|Computer vision|PyTorch|TensorFlow|scikit-learn:sklearn|Pandas|NumPy|Apache Spark:PySpark,Apache PySpark|Airflow:Apache Airflow|dbt|Snowflake|BigQuery|ETL:data pipelines,ELT|A/B testing:AB testing,A/B tests|Forecasting|Experiment design:experimental design|R programming:R language,RStudio',
  'Design & product': 'Figma|Adobe Photoshop:Photoshop|Illustrator:Adobe Illustrator|UX design:user experience design|UI design:user interface design|User research:UX research|Usability testing|Wireframing:wireframes|Prototyping|Design systems|Accessibility:WCAG|Product management|Roadmapping:product roadmaps|Product strategy|Requirements gathering',
  'Business & operations': 'Project management|Change management|Stakeholder management|Risk management|Process improvement|Business analysis|Financial modeling:financial modelling|Financial reporting|Budget management:budgeting|Accounting|Bookkeeping|Tax preparation|Auditing|Procurement|Inventory management|Supply chain management|Logistics|Quality assurance:QA|Lean Six Sigma:Six Sigma|Salesforce|CRM|Lead generation|Account management|Customer service|Customer success|Digital marketing|SEO:search engine optimization|SEM:search engine marketing|Google Analytics:GA4|Copywriting|Content strategy|Recruiting:talent acquisition,recruitment|Payroll|People management:team management|Training and development:learning and development',
  'Healthcare & engineering': 'Patient care|Electronic health records:EHR,EMR|Clinical research|Infection control|AutoCAD|SolidWorks|MATLAB|CAD:computer-aided design|GD&T:geometric dimensioning and tolerancing|PLC programming|Electrical troubleshooting|Technical writing'
};
const norm = value => value.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑‒–—]/g, '-');
const fold = value => norm(value).toLowerCase().trim().replace(/\s+/g, ' ');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const canonicalSkills = new Map();
for (const group of Object.values(skillGroups)) {
  for (const entry of group.split('|')) {
    const [label, aliases = ''] = entry.split(':');
    for (const term of [label, ...aliases.split(',').filter(Boolean)]) canonicalSkills.set(fold(term), label);
  }
}
const skillPatterns = new Map();
for (const [term, label] of canonicalSkills) {
  const phrases = skillPatterns.get(label) ?? [];
  phrases.push(term);
  skillPatterns.set(label, phrases);
}

const headingTypes = {
  skills: /^(?:(?:core |technical |key |professional |additional |relevant )?skills(?: and tools)?|core competencies|technologies|technical proficiencies)$/i,
  education: /^(?:education(?: and training)?|academic background|academic qualifications)$/i,
  experience: /^(?:(?:relevant |professional |work |employment |career |technical )?experience|employment|employment history|work history|career history)$/i,
  qualifications: /^(?:qualifications|certifications?(?: and licen[cs]es)?|licen[cs]es(?: and certifications)?|credentials|professional development)$/i,
  other: /^(?:summary|profile|objective|professional summary|projects|personal projects|publications|awards|languages|interests|volunteering|volunteer experience|references|contact|about me)$/i
};
const degreeLevels = [
  ['Doctorate', /\b(?:ph\.?\s?d\.?|doctorate|doctoral degree|juris doctor|doctor of (?:philosophy|medicine|education))\b/i],
  ["Master’s", /\b(?:master(?:'s|s)?(?: degree| of [\w ]+)?|m\.?\s?(?:sc|tech|eng|ba|ca)|m\.\s?(?:s|a)\.?|ms degree|ma degree)\b/i],
  ["Bachelor’s", /\b(?:bachelor(?:'s|s)?(?: degree| of [\w ]+)?|b\.?\s?(?:sc|tech|eng|com|ba|ca)|b\.\s?(?:s|a)\.?|bs degree|ba degree)\b/i],
  ['Associate', /\b(?:associate(?:'s|s)? degree|associate of (?:arts|science|applied science)|a\.a\.s\.?)\b/i],
  ['High school', /\b(?:high school diploma|high school education|ged)\b/i]
];
const credentials = [
  ['PMP', /\b(?:PMP|project management professional)\b/i],
  ['CAPM', /\bCAPM\b/i],
  ['CPA', /\b(?:CPA|certified public accountant)\b/i],
  ['CFA', /\b(?:CFA|chartered financial analyst)\b/i],
  ['AWS Certified Solutions Architect', /\bAWS certified solutions architect\b/i],
  ['AWS Certified Cloud Practitioner', /\b(?:AWS certified cloud practitioner|AWS cloud practitioner)\b/i],
  ['Google Data Analytics Certificate', /\bGoogle data analytics(?: professional)? (?:certificate|certification)\b/i],
  ['Azure Fundamentals', /\b(?:Azure fundamentals|AZ-900)\b/i],
  ['CompTIA Security+', /\b(?:CompTIA )?Security\+(?!\w)/i],
  ['CISSP', /\bCISSP\b/i],
  ['Registered Nurse License', /\b(?:registered nurse licen[cs]e|RN licen[cs]e)\b/i],
  ['CPR certification', /\bCPR certifi(?:cation|ed|cate)\b/i],
  ['Certified ScrumMaster', /\b(?:certified scrum\s?master|CSM certification)\b/i],
  ['Lean Six Sigma Green Belt', /\bLean Six Sigma Green Belt\b/i]
];
const negative = /(?:\b(?:no|without|lacks?|lacking|never used|unfamiliar with|not certified in|preparing for|studying for)\s+(?:(?:prior |professional |practical )?experience (?:with|in|using)\s+|(?:a |an |any )?))/i;
const pending = /\b(?:in progress|expected|pursuing|planned|pending|candidate for|coursework (?:in|toward))\b/i;

function evidence(text, terms) {
  const normalized = fold(text);
  for (const term of terms) {
    if (term === 'go' && !/\b(?:Go|GO programming|go programming)\b/.test(text)) continue;
    const expression = new RegExp('(?<![\\p{L}\\p{N}_+#])' + escape(term).replace(/ /g, '\\s+') + '(?![\\p{L}\\p{N}_+#])', 'gu');
    for (const hit of normalized.matchAll(expression)) {
      const prefix = normalized.slice(0, hit.index).split(/[.;:]|\b(?:but|however)\b/).at(-1);
      const negation = prefix.match(negative);
      if (negation && prefix.slice(negation.index + negation[0].length).trim().split(/\s+/).length < 7) continue;
      return true;
    }
  }
  return false;
}

function skillsIn(lines) {
  return [...skillPatterns].filter(([, terms]) => lines.some(line => evidence(line, terms))).map(([label]) => label);
}

function distinct(items) {
  return [...new Map(items.map(item => [fold(item), item])).values()];
}

function candidateSections(text) {
  const sections = {skills: [], education: [], experience: [], qualifications: [], other: [], general: []};
  let section = 'general';
  for (const line of norm(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    const separator = line.indexOf(':');
    const heading = (separator < 0 ? line : line.slice(0, separator)).trim();
    const found = Object.entries(headingTypes).find(([, pattern]) => pattern.test(heading));
    if (found) {
      section = found[0];
      if (separator >= 0 && line.slice(separator + 1).trim()) sections[section].push(line.slice(separator + 1).trim());
    } else {
      sections[section].push(line);
    }
  }
  return sections;
}

const months = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const monthIndex = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const dateToken = '(?:(?:' + months + ')\\.?\\s+|(?:0?[1-9]|1[0-2])[/.-])?(?:19|20)\\d{2}';
const dateRange = new RegExp('\\b(' + dateToken + ')\\s*(?:-|to|through|until)\\s*(' + dateToken + '|present|current|now|ongoing|today)\\b', 'gi');

function monthOf(token, now, end) {
  if (/^(?:present|current|now|ongoing|today)$/i.test(token)) return now.getFullYear() * 12 + now.getMonth() + 1;
  const year = Number(token.slice(-4));
  const label = token.slice(0, -4).trim().toLowerCase();
  if (!label) return year * 12 + (end ? 12 : 0);
  const index = /^[0-9]/.test(label) ? Number.parseInt(label, 10) - 1 : monthIndex.indexOf(label.slice(0, 3));
  return year * 12 + index + (end ? 1 : 0);
}

function experienceFrom(sections, now) {
  const lines = sections.experience;
  const endOfCurrentMonth = now.getFullYear() * 12 + now.getMonth() + 1;
  const ordered = lines.flatMap(line => [...line.matchAll(dateRange)].map(([, from, to]) =>
    [monthOf(from, now, false), Math.min(monthOf(to, now, true), endOfCurrentMonth)]
  )).filter(([start, end]) => start < end).sort((a, b) => a[0] - b[0]);
  const periods = [];
  for (const [start, end] of ordered) {
    const previous = periods.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else periods.push([start, end]);
  }
  if (periods.length) {
    return { months: periods.reduce((total, [start, end]) => total + end - start, 0), source: 'Dated roles' };
  }
  for (const line of [...sections.general, ...lines, ...sections.other]) {
    const declared = line.match(/\b(\d{1,2}(?:\.\d+)?)\s*\+?\s*years?\s*(?:of\s+)?(?:[\w-]+\s+){0,4}experience\b/i);
    if (declared) return { months: Math.round(Number(declared[1]) * 12), source: 'Résumé statement' };
  }
  return {months: null, source: 'No duration detected'};
}

function degreeIn(line) {
  const index = degreeLevels.findIndex(([, pattern]) => pattern.test(line));
  return index < 0 ? null : {label: degreeLevels[index][0], level: degreeLevels.length - index, evidence: line, pending: pending.test(line)};
}

export function extractProfile(name, text, now = new Date()) {
  const sections = candidateSections(text);
  const general = sections.general.filter(line => fold(line) !== fold(name) && !/@[^\s]+\./.test(line));
  const main = [...general, ...sections.skills, ...sections.experience, ...sections.qualifications, ...sections.other];
  const education = distinct([...sections.education, ...[...sections.general, ...sections.qualifications].filter(line => degreeIn(line))]);
  const qualifications = distinct([
    ...sections.qualifications,
    ...[...sections.general, ...sections.education, ...sections.experience, ...sections.other].filter(line =>
      credentials.some(([, pattern]) => pattern.test(line)) || /\b(?:certificate in|certified in|licen[cs]ed as|certification in)\b/i.test(line)
      || /^(?:certified|licensed)\s+\w/i.test(line))
  ]);
  const explicitSkills = sections.skills.flatMap(line => line.split(/[,;|•·]/)).map(item => item.replace(/^[-*]\s+/, '').trim())
    .filter(item => item.length > 1 && item.length <= 45 && item.split(/\s+/).length <= 5 && !negative.test(item))
    .map(item => canonicalSkills.get(fold(item)) ?? item);
  return {
    name, text, skills: distinct([...skillsIn(main), ...explicitSkills]), education, qualifications,
    degrees: education.map(degreeIn).filter(Boolean),
    experience: experienceFrom(sections, now),
    roles: sections.experience,
    evidenceLines: main
  };
}

const jobHeaders = [
  ['preferred', /^(?:preferred(?: skills| qualifications)?|nice to have|bonus(?: skills)?|desired skills)\b\s*:?\s*/i],
  ['required', /^(?:requirements|required(?: skills| qualifications)?|minimum qualifications|must[- ]haves?|essential(?: skills| qualifications)?)\b\s*:?\s*/i],
  ['context', /^(?:responsibilities|what you(?:'ll| will) do|about (?:us|the role|the team)|benefits|job description|overview|compensation)\b\s*:?\s*/i]
];

export function parseJob(title, description) {
  const sections = {general: [], required: [], preferred: [], context: []};
  let section = 'general';
  for (const original of norm(description).split(/\r?\n/)) {
    const line = original.trim().replace(/^[-•*]\s+/, '');
    if (!line) continue;
    const header = jobHeaders.find(([, pattern]) => pattern.test(line));
    if (header) {
      section = header[0];
      const content = line.replace(header[1], '');
      if (content) sections[section].push(content);
    } else if (/\b(?:preferred|nice to have|a plus|desirable|optional)\b/i.test(line)) {
      sections.preferred.push(line);
    } else {
      sections[section].push(line);
    }
  }
  const required = [...sections.required, ...sections.general];
  const degree = required.map(degreeIn).filter(Boolean).sort((a, b) => a.level - b.level)[0];
  const years = required.flatMap(line => [...line.matchAll(/\b(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:(?:-|to)\s*\d{1,2}\s*)?years?\b/gi)].map(match => Number(match[1])));
  const preferredSkills = skillsIn(sections.preferred);
  const explicitlyRequired = new Set(skillsIn(sections.required));
  return {
    title, description, requiredSkills: skillsIn(required).filter(skill => !preferredSkills.includes(skill) || explicitlyRequired.has(skill)),
    preferredSkills, years: years.length ? Math.max(...years) : 0,
    degree: degree?.label ?? '',
    certificates: credentials.filter(([, pattern]) => required.some(line => pattern.test(line))).map(([label]) => label)
  };
}

export const degreeOptions = degreeLevels.map(([label]) => label).reverse();
export const weights = {required: 60, preferred: 15, experience: 15, education: 5, qualifications: 5};
export const normalizeSkills = items => distinct(items.map(item => canonicalSkills.get(fold(item)) ?? item));

function skillMatch(profile, skill) {
  return profile.skills.some(item => fold(item) === fold(skill))
    || profile.evidenceLines.some(line => evidence(line, skillPatterns.get(canonicalSkills.get(fold(skill))) ?? [fold(skill)]));
}

function certificateMatch(profile, certificate) {
  const recognized = credentials.find(([label]) => fold(label) === fold(certificate));
  return profile.qualifications.some(line => !pending.test(line) && !negative.test(line)
    && ((recognized && recognized[1].test(line)) || evidence(line, [fold(certificate)])));
}

export function scoreProfile(profile, job) {
  const missing = {};
  const matched = {};
  for (const [key, terms] of [
    ['required', job.requiredSkills],
    ['preferred', job.preferredSkills.filter(skill => !job.requiredSkills.some(required => fold(required) === fold(skill)))],
    ['qualifications', job.certificates]
  ]) {
    const match = key === 'qualifications' ? certificateMatch : skillMatch;
    matched[key] = terms.filter(term => match(profile, term));
    missing[key] = terms.filter(term => !matched[key].includes(term));
  }
  const minimumDegree = degreeOptions.indexOf(job.degree) + 1;
  const completedDegree = Math.max(0, ...profile.degrees.filter(degree => !degree.pending).map(degree => degree.level));
  const fraction = {
    required: job.requiredSkills.length ? matched.required.length / job.requiredSkills.length : null,
    preferred: matched.preferred.length + missing.preferred.length
      ? matched.preferred.length / (matched.preferred.length + missing.preferred.length) : null,
    experience: job.years ? Math.min(1, (profile.experience.months ?? 0) / (job.years * 12)) : null,
    education: minimumDegree ? Number(completedDegree >= minimumDegree) : null,
    qualifications: job.certificates.length ? matched.qualifications.length / job.certificates.length : null
  };
  const active = Object.keys(weights).filter(key => fraction[key] !== null);
  const denominator = active.reduce((total, key) => total + weights[key], 0);
  const score = denominator ? active.reduce((total, key) => total + fraction[key] * weights[key], 0) * 100 / denominator : null;
  return {score, matched, missing, fraction};
}

export function analyze(profiles, jobs) {
  const pairs = jobs.map(job => ({
    job,
    candidates: profiles.map(profile => ({profile, ...scoreProfile(profile, job)})).sort(compareScores)
  }));
  const recommendations = profiles.map(profile => ({
    profile,
    jobs: pairs.flatMap(({job, candidates}) => candidates.filter(result => result.profile.id === profile.id).map(result => ({job, ...result})))
      .filter(result => result.score !== null).sort(compareScores)
  }));
  return {pairs, recommendations};
}

function compareScores(a, b) {
  return (b.score ?? -1) - (a.score ?? -1)
    || (b.fraction.required ?? 0) - (a.fraction.required ?? 0)
    || b.matched.required.length - a.matched.required.length;
}
