// Decisions and result adoption are local. No browser, network, or answer execution.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadJob, status, sha256, inside } from './job-store.mjs';

const stamp = () => new Date().toISOString();
const requiredText = value => typeof value === 'string' && value.trim().length > 0;

export function routeTask(facts) {
  // Agent supplies assessed task properties, not a keyword match on user text.
  if (!facts || typeof facts !== 'object') throw Error('Task facts required');
  for (const field of ['independent', 'substantial', 'requiresLocalExecution', 'shareAllowed', 'browserAvailable']) {
    if (typeof facts[field] !== 'boolean') throw Error(`Boolean ${field} required`);
  }
  if (!['auto', 'local', 'web'].includes(facts.preference)) throw Error('preference must be auto/local/web');
  if (!['research', 'comparison', 'long-text', 'review', 'implementation', 'other'].includes(facts.kind)) throw Error('Unknown task kind');
  if (!requiredText(facts.reason)) throw Error('Concrete routing reason required');
  let reason;
  if (facts.preference === 'local') reason = 'user_selected_local';
  else if (facts.requiresLocalExecution || !facts.independent) reason = 'local_execution_or_coupling';
  else if (!facts.shareAllowed) reason = 'material_not_authorized';
  else if (!facts.browserAvailable) reason = 'browser_unavailable';
  else if (facts.preference !== 'web' && (!facts.substantial || !['research', 'comparison', 'long-text', 'review'].includes(facts.kind))) reason = 'local_is_sufficient';
  return { schema: 'web-stand-in-route-v1', at: stamp(), route: reason ? 'local' : 'web',
    reason: reason ?? (facts.preference === 'web' ? 'user_selected_web' : 'independent_substantial_work'), facts };
}

function writeOnce(file, value) {
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== value) throw Error(`Conflicting artifact preserved: ${file}`);
  } else fs.writeFileSync(file, value, { encoding: 'utf8', flag: 'wx' });
}

export function extractBrief(file) {
  const saved = status(file);
  if (saved.status !== 'completed') throw Error('Completed, integrity-checked answer required');
  const { job, dir } = loadJob(file);
  const contract = job.brief;
  if (!contract || contract.beginTag !== `[WSI_BRIEF:${job.id}]` || contract.endTag !== `[/WSI_BRIEF:${job.id}]` || contract.maxChars !== 2000) throw Error('Valid brief contract required');
  const lines = fs.readFileSync(saved.answer, 'utf8').split(/\r?\n/);
  const begins = lines.flatMap((v, i) => v === contract.beginTag ? [i] : []);
  const ends = lines.flatMap((v, i) => v === contract.endTag ? [i] : []);
  if (begins.length !== 1 || ends.length !== 1 || begins[0] >= ends[0]) throw Error('Missing/ambiguous brief boundaries; full answer preserved');
  const text = lines.slice(begins[0] + 1, ends[0]).join('\n').trim();
  if (!text || [...text].length > contract.maxChars) throw Error('Brief empty/over limit; never silently truncate');
  const brief = path.join(dir, 'brief.md'), receipt = path.join(dir, 'brief.receipt.json');
  for (const p of [brief, receipt]) inside(job.projectRoot, p);
  writeOnce(brief, text + '\n');
  const record = { schema: 'web-stand-in-brief-v1', jobId: job.id, chatUrl: job.chatUrl,
    answerSha256: saved.sha256, briefSha256: sha256(text + '\n'), chars: [...text].length,
    source: 'extracted-from-browser-copy', independentlyReviewed: false };
  writeOnce(receipt, JSON.stringify(record, null, 2) + '\n');
  return { ...record, brief, receipt, text };
}

export function reviewResult(file, review) {
  const brief = extractBrief(file);
  const { job, dir } = loadJob(file);
  if (!review || review.jobId !== job.id || review.answerSha256 !== brief.answerSha256 ||
      review.briefSha256 !== brief.briefSha256) throw Error('Review must bind the exact job/answer/brief hashes');
  if (!['adopted', 'rejected'].includes(review.decision) || !requiredText(review.rationale)) throw Error('Review decision and rationale required');
  if (!Array.isArray(review.checks) || !review.checks.length || !review.checks.every(c =>
    requiredText(c.requirement) && requiredText(c.evidence) && ['pass', 'fail', 'unknown'].includes(c.result))) throw Error('Explicit requirement checks required');
  if (review.decision === 'adopted' && review.checks.some(c => c.result !== 'pass')) throw Error('Unresolved requirements cannot be adopted');
  if (!Array.isArray(review.artifacts) || (review.decision === 'adopted' && !review.artifacts.length)) throw Error('Adoption needs a concrete parent-task artifact');
  for (const artifact of review.artifacts) {
    inside(job.projectRoot, artifact.path);
    if (!requiredText(artifact.purpose) || artifact.sha256 !== sha256(fs.readFileSync(artifact.path))) throw Error('Adopted artifact missing or changed');
  }
  const target = path.join(dir, 'review.json'); inside(job.projectRoot, target);
  // This is the reviewing agent's assertion, not a claim of automatic fact-checking.
  const record = { ...review, schema: 'web-stand-in-review-v1', reviewer: 'parent-task-agent' };
  writeOnce(target, JSON.stringify(record, null, 2) + '\n');
  return { decision: review.decision, reviewFile: target, artifacts: review.artifacts };
}

export function main(args) {
  const [action, file, input] = args;
  if (action === 'route' && args.length === 2) return routeTask(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (action === 'brief' && args.length === 2) return extractBrief(file);
  if (action === 'review' && args.length === 3) return reviewResult(file, JSON.parse(fs.readFileSync(input, 'utf8')));
  throw Error('Usage: workflow.mjs route FACTS.json | brief JOB.json | review JOB.json REVIEW.json');
}
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
