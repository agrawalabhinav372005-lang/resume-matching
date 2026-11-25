import assert from 'node:assert/strict';
import test from 'node:test';

import {analyze, extractProfile, normalizeSkills, parseJob, scoreProfile} from '../dist/js/engine.mjs';
import {sampleJobs, sampleResumes} from '../dist/js/sample.mjs';

test('sample résumés rank first for the jobs that fit their experience', () => {
  const asOf = new Date(2025, 11, 1);
  const profiles = sampleResumes.map(([name, text], id) => ({id, ...extractProfile(name, text, asOf)}));
  const jobs = sampleJobs.map(([title, description]) => parseJob(title, description));
  const results = analyze(profiles, jobs);

  assert.deepEqual(results.pairs.map(pair => pair.candidates[0].profile.name), ['Maya Chen', 'Alex Morgan', 'Sam Rivera']);
  assert.deepEqual(results.pairs.map(pair => pair.candidates[0].score), [100, 100, 100]);
  assert.equal(results.recommendations[2].jobs[0].job.title, 'Data Engineer');
});

test('scoring uses explicit role criteria and handles overlapping jobs and missing evidence', () => {
  const profile = extractProfile('Test Candidate', [
    'Test Candidate', 'Skills: PostgreSQL, JavaScript, Observability', 'No experience with Kubernetes',
    'Experience', 'First company | Jan 2020–Dec 2022', 'Second company | Jan 2022–Jun 2024',
    'Education', 'Master of Science, in progress', 'B.Sc. Computer Science',
    'Certifications', 'PMP (in progress)', 'Security+'
  ].join('\n'), new Date(2025, 11, 1));

  assert.equal(profile.experience.months, 54);
  assert(!profile.skills.includes('Kubernetes'));
  assert(!profile.skills.includes('Java'));
  assert.deepEqual(normalizeSkills(['Postgres', 'PostgreSQL', 'JS']), ['PostgreSQL', 'JavaScript']);

  const job = parseJob('Example', [
    'Required skills: JavaScript', 'Preferred skills: AWS', 'Requirements:',
    '2–5 years of experience', 'Master’s degree', 'PMP'
  ].join('\n'));
  job.requiredSkills.push('Observability');
  const result = scoreProfile(profile, job);

  assert.equal(job.years, 2);
  assert.deepEqual(result.fraction, {required: 1, preferred: 0, experience: 1, education: 0, qualifications: 0});
  assert.equal(result.score, 75);
  assert.equal(scoreProfile(profile, parseJob('Unspecified role', 'Work together.')).score, null);
});
