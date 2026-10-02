import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as store from '../web-stand-in/scripts/job-store.mjs';
import { routeTask, extractBrief, reviewResult } from '../web-stand-in/scripts/workflow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.test-output/workflow-tests', crypto.randomUUID());
fs.mkdirSync(root, { recursive: true });
const facts = { preference: 'auto', kind: 'comparison', independent: true, substantial: true,
  requiresLocalExecution: false, shareAllowed: true, browserAvailable: true, reason: 'Public independent dossier comparison' };

function completed(body = '结论 B；依据 B-02；局限：模拟材料；下一步本地核验。') {
  const dir = path.join(root, crypto.randomUUID()); fs.mkdirSync(dir);
  const task = path.join(dir, 'task.md'); fs.writeFileSync(task, 'Compare the supplied dossier.');
  const { jobFile } = store.createJob({ projectRoot: dir, taskFile: task, outputDir: path.join(dir, 'job'), brief: true });
  const { job } = store.loadJob(jobFile);
  store.attachTab(jobFile, { browserId: 'b', tabId: 't' }); store.claimSend(jobFile);
  const url = 'https://chatgpt.com/c/11111111-2222-3333-4444-555555555555';
  store.bindChat(jobFile, { url, userText: job.requestTag });
  const text = `${job.beginTag}\n${job.brief.beginTag}\n${body}\n${job.brief.endTag}\n\n详细依据和原文保持不变。\n${job.endTag}\n`;
  store.saveAnswer(jobFile, { url, text, generating: false, source: 'browser-copy-markdown' });
  return { file: jobFile, job, dir, text };
}

test('auto routes substantial independent work, local preference and boundaries win', () => {
  assert.equal(routeTask(facts).route, 'web');
  for (const change of [{ preference: 'local' }, { independent: false }, { substantial: false },
    { requiresLocalExecution: true }, { shareAllowed: false }, { browserAvailable: false }, { kind: 'implementation' }]) {
    assert.equal(routeTask({ ...facts, ...change }).route, 'local');
  }
  assert.equal(routeTask({ ...facts, preference: 'web', substantial: false }).route, 'web');
  assert.equal(routeTask({ ...facts, preference: 'web', shareAllowed: false }).route, 'local');
  assert.throws(() => routeTask({ ...facts, shareAllowed: 'yes' }), /Boolean/);
});

test('brief remains bound to exact raw answer, repeated extraction is idempotent', () => {
  const f = completed(); const a = extractBrief(f.file), b = extractBrief(f.file);
  assert.deepEqual(a, b); assert.equal(a.independentlyReviewed, false);
  assert.equal(fs.readFileSync(path.join(f.dir, 'job/answer.md'), 'utf8'), f.text);
  fs.appendFileSync(path.join(f.dir, 'job/answer.md'), 'tamper');
  assert.throws(() => extractBrief(f.file), /integrity/);
});

test('Unicode limits are enforced without silently truncating and conflicts are preserved', () => {
  assert.equal(extractBrief(completed('😀'.repeat(2000)).file).chars, 2000);
  const tooLong = completed('中'.repeat(2001));
  assert.throws(() => extractBrief(tooLong.file), /over limit/);
  assert.equal(store.status(tooLong.file).status, 'completed');
  const f = completed(); extractBrief(f.file);
  fs.writeFileSync(path.join(f.dir, 'job/brief.md'), 'existing human edit');
  assert.throws(() => extractBrief(f.file), /Conflicting/);
  assert.equal(fs.readFileSync(path.join(f.dir, 'job/brief.md'), 'utf8'), 'existing human edit');
});

test('duplicate brief boundaries do not select an arbitrary result', () => {
  const f = completed();
  // Construct a second separately collected answer with task-specific duplicate boundaries.
  const dir = path.join(root, crypto.randomUUID()); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'task.md'), 'task');
  const { jobFile } = store.createJob({ projectRoot: dir, taskFile: path.join(dir, 'task.md'), outputDir: path.join(dir, 'job'), brief: true });
  const { job } = store.loadJob(jobFile);
  store.attachTab(jobFile, { browserId: 'b', tabId: 't' }); store.claimSend(jobFile);
  const url = 'https://chatgpt.com/c/11111111-2222-3333-4444-555555555555';
  store.bindChat(jobFile, { url, userText: job.requestTag });
  store.saveAnswer(jobFile, { url, generating: false, source: 'browser-copy-markdown',
    text: `${job.beginTag}\n${job.brief.beginTag}\nfirst\n${job.brief.beginTag}\nsecond\n${job.brief.endTag}\n${job.endTag}` });
  assert.throws(() => extractBrief(jobFile), /ambiguous/);
  assert.equal(store.status(f.file).status, 'completed');
});

test('adoption requires exact hashes, resolved checks and a real local deliverable', () => {
  const f = completed(), brief = extractBrief(f.file);
  const artifact = path.join(f.dir, 'decision.json'); fs.writeFileSync(artifact, '{"selected":"B"}');
  const review = { jobId: f.job.id, answerSha256: brief.answerSha256, briefSha256: brief.briefSha256,
    decision: 'adopted', rationale: 'Checked original dossier and computed score.',
    checks: [{ requirement: 'offline', result: 'pass', evidence: 'Dossier B-02' }],
    artifacts: [{ path: artifact, sha256: store.sha256(fs.readFileSync(artifact)), purpose: 'Parent decision' }] };
  assert.throws(() => reviewResult(f.file, { ...review, answerSha256: 'other' }), /exact/);
  assert.throws(() => reviewResult(f.file, { ...review, checks: [{ ...review.checks[0], result: 'unknown' }] }), /Unresolved/);
  assert.throws(() => reviewResult(f.file, { ...review, artifacts: [] }), /concrete/);
  assert.equal(reviewResult(f.file, review).decision, 'adopted');
  assert.equal(reviewResult(f.file, review).decision, 'adopted');
  fs.writeFileSync(artifact, '{"selected":"C"}');
  assert.throws(() => reviewResult(f.file, review), /changed/);
});

test('brief symlinks cannot overwrite another project file', () => {
  const f = completed(); const foreign = path.join(root, 'foreign.txt'); fs.writeFileSync(foreign, 'preserve');
  try { fs.symlinkSync(foreign, path.join(f.dir, 'job/brief.md')); }
  catch (error) { if (error.code === 'EPERM') return; throw error; }
  assert.throws(() => extractBrief(f.file), /Symlink/);
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'preserve');
});

test('rejected results retain failed and unknown checks and cannot become an adoption silently', () => {
  const f = completed(), brief = extractBrief(f.file);
  const review = { jobId: f.job.id, answerSha256: brief.answerSha256, briefSha256: brief.briefSha256,
    decision: 'rejected', rationale: 'Offline evidence failed; recovery behavior remains unknown.',
    checks: [
      { requirement: 'offline', result: 'fail', evidence: 'Supplied fixture explicitly requires network' },
      { requirement: 'recovery', result: 'unknown', evidence: 'No recovery behavior documented' },
    ], artifacts: [] };
  assert.equal(reviewResult(f.file, review).decision, 'rejected');
  const file = path.join(f.dir, 'job/review.json'), saved = fs.readFileSync(file, 'utf8');
  assert.equal(reviewResult(f.file, review).decision, 'rejected');
  const artifact = path.join(f.dir, 'decision.json'); fs.writeFileSync(artifact, '{"selected":"B"}');
  assert.throws(() => reviewResult(f.file, { ...review, decision: 'adopted',
    checks: review.checks.map(c => ({ ...c, result: 'pass' })),
    artifacts: [{ path: artifact, sha256: store.sha256(fs.readFileSync(artifact)), purpose: 'Changed decision' }],
  }), /Conflicting artifact preserved/);
  assert.equal(fs.readFileSync(file, 'utf8'), saved);
});

test('CLI executes through the installed skill junction rather than silently doing nothing', () => {
  const dir = path.join(root, crypto.randomUUID()); fs.mkdirSync(dir);
  const alias = path.join(dir, 'installed-skill');
  fs.symlinkSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web-stand-in'), alias,
    process.platform === 'win32' ? 'junction' : 'dir');
  const input = path.join(dir, 'facts.json'); fs.writeFileSync(input, JSON.stringify(facts));
  const routed = spawnSync(process.execPath, [path.join(alias, 'scripts/workflow.mjs'), 'route', input], { encoding: 'utf8' });
  assert.equal(routed.status, 0, routed.stderr); assert.equal(JSON.parse(routed.stdout).route, 'web');
  const task = path.join(dir, 'task.md'); fs.writeFileSync(task, 'Task through installed junction.');
  const prepared = spawnSync(process.execPath, [path.join(alias, 'scripts/job.mjs'), 'prepare',
    '--project', dir, '--task', task, '--output', path.join(dir, 'job'), '--brief', 'true'], { encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stderr); assert.equal(JSON.parse(prepared.stdout).status, 'prepared');
});
