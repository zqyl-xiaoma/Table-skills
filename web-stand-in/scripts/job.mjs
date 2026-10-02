import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { createJob, status, recoverSave, extendWait } from './job-store.mjs';

export function main(args) {
  const [action, ...rest] = args;
  if (action === 'status' && rest.length === 1) return status(rest[0]);
  if (action === 'recover-save' && rest.length === 1) return recoverSave(rest[0]);
  if (action === 'extend-wait' && rest.length === 2) return extendWait(rest[0], Number(rest[1]));
  if (action === 'prepare') {
    const allowed = new Set(['--project', '--task', '--output', '--wait-minutes', '--model', '--brief']);
    const opts = {};
    for (let i = 0; i < rest.length; i += 2) {
      if (!allowed.has(rest[i]) || rest[i + 1] === undefined || opts[rest[i]] !== undefined) throw Error('Invalid/duplicate option');
      opts[rest[i]] = rest[i + 1];
    }
    if (opts['--brief'] !== undefined && !['true', 'false'].includes(opts['--brief'])) throw Error('--brief requires true or false');
    return createJob({ projectRoot: opts['--project'], taskFile: opts['--task'], outputDir: opts['--output'], brief: opts['--brief'] === 'true',
      waitMinutes: opts['--wait-minutes'] === undefined ? 20 : Number(opts['--wait-minutes']), model: opts['--model'] ?? null });
  }
  throw Error('Usage: job.mjs prepare --project ABS --task ABS --output ABS [--brief true] [--wait-minutes 20] [--model LABEL] | status JOB | recover-save JOB | extend-wait JOB MINUTES');
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
