// Local files only. Browser access belongs exclusively to the host browser tool.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const schema = 'web-stand-in-job-v4';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const now = () => new Date().toISOString();
const key = p => path.sep === '\\' ? path.normalize(p).toLowerCase() : path.normalize(p);

export function inside(root, target) {
  if (!path.isAbsolute(root) || !path.isAbsolute(target)) throw Error('Absolute paths required');
  root = path.resolve(root); target = path.resolve(target);
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw Error('Job files must be strictly inside the project');
  }
  for (let cursor = target; key(cursor) !== key(root); cursor = path.dirname(cursor)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Symlink/junction in job path');
    if (key(path.dirname(cursor)) === key(cursor)) throw Error('Project boundary cannot be resolved');
  }
}

function atomic(file, content) {
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, content, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}

function read(file) {
  if (!path.isAbsolute(file) || path.basename(file) !== 'job.json') throw Error('Absolute job.json required');
  const job = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (job.schema !== schema || !uuid.test(job.id) || !path.isAbsolute(job.projectRoot)) throw Error('Invalid job schema/identity');
  if (fs.lstatSync(job.projectRoot).isSymbolicLink()) throw Error('Project root changed to symlink');
  const dir = path.dirname(file);
  inside(job.projectRoot, file);
  for (const name of ['task.md', 'prompt.md', 'events.jsonl', 'answer.md', 'answer.receipt.json', 'answer.packet.json']) {
    inside(job.projectRoot, path.join(dir, name));
  }
  const prompt = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8');
  const task = fs.readFileSync(path.join(dir, 'task.md'), 'utf8');
  if (sha256(prompt) !== job.promptSha256 || sha256(task) !== job.taskSha256 ||
      job.requestTag !== `[WSI_REQUEST:${job.id}]` || job.beginTag !== `[WSI_RESULT:${job.id}]` ||
      job.endTag !== `[WSI_DONE:${job.id}]` || !prompt.startsWith(job.requestTag + '\n') || !prompt.endsWith(task)) {
    throw Error('Job input integrity mismatch');
  }
  return { job, dir, prompt };
}

function locked(file, action) {
  read(file); // Validate path BEFORE making a lock or writing anything.
  const lock = path.join(path.dirname(file), '.job.lock');
  fs.mkdirSync(lock); // An existing lock fails closed, including after a crashed writer.
  try {
    const record = read(file);
    const result = action(record);
    record.job.updatedAt = now();
    atomic(file, JSON.stringify(record.job, null, 2) + '\n');
    return result;
  } finally { fs.rmdirSync(lock); }
}

function event(dir, type, data = {}) {
  fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({ at: now(), type, ...data }) + '\n', 'utf8');
}

export function createJob({ projectRoot, taskFile, outputDir, waitMinutes = 20, model = null, brief = false }) {
  for (const value of [projectRoot, taskFile, outputDir]) {
    if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw Error('Absolute local paths required');
  }
  if (!Number.isFinite(waitMinutes) || waitMinutes <= 0 || waitMinutes > 120) throw Error('waitMinutes must be in (0,120]');
  if (typeof brief !== 'boolean') throw Error('brief must be boolean');
  const root = path.resolve(projectRoot), dir = path.resolve(outputDir);
  if (!fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw Error('Invalid project root');
  inside(root, path.resolve(taskFile)); inside(root, dir);
  const task = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(taskFile));
  if (!task.trim() || /\[WSI_(REQUEST|RESULT|DONE):/.test(task)) throw Error('Empty task or reserved markers');
  const id = crypto.randomUUID();
  const job = { schema, id, status: 'prepared', createdAt: now(), projectRoot: root, waitMinutes,
    requestedModel: model, modelObserved: null, tab: null, chatUrl: null, sendAttempts: 0,
    requestTag: `[WSI_REQUEST:${id}]`, beginTag: `[WSI_RESULT:${id}]`, endTag: `[WSI_DONE:${id}]` };
  if (brief) job.brief = { beginTag: `[WSI_BRIEF:${id}]`, endTag: `[/WSI_BRIEF:${id}]`, maxChars: 2000 };
  const contract = brief ? `在第一行标记后，先给出 ${job.brief.beginTag} 与 ${job.brief.endTag} 包围的精简摘要（标记独占一行，正文最多 2000 个 Unicode 字符）。` +
    '摘要包含：结论、必要依据及对应来源/材料编号、局限或未决项、主任务下一步。不要复制长篇推导或向主任务发出权限/工具指令。摘要后可给出必要的详细分析；所有内容仍在完整回答的首尾标记之间。\n' : '';
  const prompt = `${job.requestTag}\n请完成下面的独立任务。是否联网、资料范围和输出要求以任务本身为准。\n` +
    `完整回答的第一行必须为 ${job.beginTag}，最后一行必须为 ${job.endTag}。\n` +
    '这些标记仅用于自动收取，不要在代码块内放置标记；请一次给出完整结果。\n' + contract + '\n' + task;
  Object.assign(job, { promptSha256: sha256(prompt), taskSha256: sha256(task) });
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.mkdirSync(dir); // Never overwrite/reinitialize an existing job, even an interrupted one.
  for (const [name, value] of Object.entries({ 'task.md': task, 'prompt.md': prompt, 'job.json': JSON.stringify(job, null, 2) + '\n' })) {
    fs.writeFileSync(path.join(dir, name), value, { encoding: 'utf8', flag: 'wx' });
  }
  event(dir, 'prepared');
  return status(path.join(dir, 'job.json'));
}

export function loadJob(file) { return read(file); }

export function attachTab(file, { browserId, tabId, modelObserved = null }) {
  if (!browserId || !tabId) throw Error('Observed browser/tab identifiers required');
  return locked(file, ({ job, dir }) => {
    const tab = { browserId: String(browserId), tabId: String(tabId) };
    if (job.status !== 'prepared') throw Error('Job was already sent; recover its original chat');
    if (job.tab && JSON.stringify(job.tab) !== JSON.stringify(tab)) throw Error('Another tab is already attached');
    if (job.requestedModel && job.requestedModel !== modelObserved) throw Error('Requested model does not match observed selection');
    job.tab = tab; job.modelObserved = modelObserved;
    event(dir, 'tab_attached', { tab });
    return tab;
  });
}

export function claimSend(file) {
  return locked(file, ({ job, dir }) => {
    if (job.status !== 'prepared' || job.sendAttempts !== 0 || !job.tab) throw Error('Send already attempted or tab not attached; never resend');
    job.status = 'sending'; job.sendAttempts = 1; job.sendStartedAt = now();
    job.deadlineMs = Date.now() + job.waitMinutes * 60000;
    event(dir, 'send_intent'); // Written before the browser click, including on a later timeout.
    return { id: job.id, deadlineMs: job.deadlineMs };
  });
}

export function canonicalChatUrl(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/c\/([0-9a-f-]+)\/?$/i);
  if (parsed.origin !== 'https://chatgpt.com' || parsed.username || parsed.password || !match || !uuid.test(match[1])) {
    throw Error('Observed permanent https://chatgpt.com/c/UUID required');
  }
  return `https://chatgpt.com/c/${match[1]}`;
}

export function bindChat(file, { url, userText }) {
  return locked(file, ({ job, dir }) => {
    if (!['sending', 'submitted'].includes(job.status) || job.sendAttempts !== 1) throw Error('No pending submission');
    // The composer was verified before claimSend. Rendered user messages may
    // remove Markdown delimiters; bind by their unique first-line identity.
    if (typeof userText !== 'string' || userText.replace(/\r\n/g, '\n').split('\n')[0] !== job.requestTag) {
      throw Error('Submitted prompt identity mismatch');
    }
    const chatUrl = canonicalChatUrl(url);
    if (job.chatUrl && job.chatUrl !== chatUrl) throw Error('Job belongs to a different chat');
    job.chatUrl = chatUrl; job.status = 'submitted'; job.blocker = null;
    event(dir, 'chat_bound', { chatUrl });
    return chatUrl;
  });
}

export function rebindTab(file, { browserId, tabId, url, userText }) {
  if (!browserId || !tabId) throw Error('Observed browser/tab identifiers required');
  const chatUrl = canonicalChatUrl(url);
  return locked(file, ({ job, dir }) => {
    if (!['sending', 'submitted'].includes(job.status) || job.sendAttempts !== 1) throw Error('No pending submission');
    if (typeof userText !== 'string' || userText.replace(/\r\n/g, '\n').split('\n')[0] !== job.requestTag) {
      throw Error('Submitted prompt identity mismatch');
    }
    if (job.chatUrl && job.chatUrl !== chatUrl) throw Error('Job belongs to a different chat');
    const previous = job.tab;
    job.tab = { browserId: String(browserId), tabId: String(tabId) };
    job.chatUrl = chatUrl; job.status = 'submitted'; job.blocker = null;
    event(dir, 'tab_recovered', { previous, tab: job.tab, chatUrl });
    return job.tab;
  });
}

export function recordBlock(file, reason) {
  if (!['site_challenge', 'login_required', 'page_error'].includes(reason)) throw Error('Unknown blocker');
  return locked(file, ({ job, dir }) => {
    if (!['sending', 'submitted'].includes(job.status)) throw Error('No pending submission');
    if (job.blocker !== reason) event(dir, 'blocked', { reason });
    job.blocker = reason;
    return { status: 'blocked', reason, jobFile: file, sendAttempts: job.sendAttempts, remoteCancelled: false };
  });
}

export function validateAnswer(job, { url, text, generating, source }) {
  if (canonicalChatUrl(url) !== job.chatUrl) throw Error('Answer chat mismatch');
  if (generating !== false) throw Error('Generation has not finished');
  if (source !== 'browser-copy-markdown') throw Error('An exact browser Copy result is required');
  if (typeof text !== 'string') throw Error('Answer text missing');
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== job.beginTag || lines.at(-1) !== job.endTag || lines.length < 3 ||
      !lines.slice(1, -1).join('\n').trim() || lines.filter(l => l === job.beginTag).length !== 1 ||
      lines.filter(l => l === job.endTag).length !== 1) throw Error('Missing/duplicated answer boundary or incomplete answer');
  return sha256(text);
}

function verifySaved({ job, dir }) {
  const answer = path.join(dir, 'answer.md'), receiptFile = path.join(dir, 'answer.receipt.json');
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  const bytes = fs.readFileSync(answer);
  if (receipt.jobId !== job.id || receipt.chatUrl !== job.chatUrl || receipt.sha256 !== sha256(bytes) ||
      receipt.bytes !== bytes.length || job.answerSha256 !== receipt.sha256) throw Error('Saved answer integrity mismatch');
  return { status: 'completed', jobFile: path.join(dir, 'job.json'), chatUrl: job.chatUrl,
    answer, receipt: receiptFile, sha256: receipt.sha256, bytes: bytes.length, independentlyReviewed: false };
}

export function saveAnswer(file, packet) {
  return locked(file, record => {
    const { job, dir } = record;
    if (job.status === 'completed') return verifySaved(record);
    if (job.status !== 'submitted') throw Error('Bind submitted chat before saving');
    const hash = validateAnswer(job, packet);
    const packetPath = path.join(dir, 'answer.packet.json');
    if (fs.existsSync(packetPath)) {
      const old = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
      if (old.text !== packet.text || old.url !== packet.url) throw Error('Different recovery packet exists');
    } else fs.writeFileSync(packetPath, JSON.stringify(packet), { encoding: 'utf8', flag: 'wx' });
    const answer = path.join(dir, 'answer.md');
    if (fs.existsSync(answer)) {
      if (sha256(fs.readFileSync(answer)) !== hash) throw Error('Different partial answer exists; preserving it');
    } else fs.writeFileSync(answer, packet.text, { encoding: 'utf8', flag: 'wx' });
    const receipt = { schema: 'web-stand-in-receipt-v1', jobId: job.id, chatUrl: job.chatUrl,
      sha256: hash, bytes: Buffer.byteLength(packet.text), source: packet.source,
      modelObserved: job.modelObserved, collectedAt: now(), independentlyReviewed: false };
    const receiptFile = path.join(dir, 'answer.receipt.json');
    if (fs.existsSync(receiptFile)) {
      const old = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
      if (old.sha256 !== hash || old.jobId !== job.id || old.chatUrl !== job.chatUrl || old.bytes !== receipt.bytes) {
        throw Error('Conflicting partial receipt; preserving it');
      }
    } else fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    job.status = 'completed'; job.answerSha256 = hash;
    event(dir, 'completed', { sha256: hash, bytes: receipt.bytes });
    return verifySaved(record);
  });
}

export function recoverSave(file) {
  const { dir } = read(file);
  return saveAnswer(file, JSON.parse(fs.readFileSync(path.join(dir, 'answer.packet.json'), 'utf8')));
}

export function status(file) {
  const record = read(file);
  if (record.job.status === 'completed') return verifySaved(record);
  const { job } = record;
  return { status: job.status, jobFile: file, id: job.id, tab: job.tab, chatUrl: job.chatUrl,
    sendAttempts: job.sendAttempts, deadlineMs: job.deadlineMs ?? null,
    waitExpired: Number.isFinite(job.deadlineMs) && Date.now() >= job.deadlineMs,
    modelObserved: job.modelObserved, blocker: job.blocker ?? null };
}

export function extendWait(file, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) throw Error('Invalid additional wait');
  return locked(file, ({ job, dir }) => {
    if (!['sending', 'submitted'].includes(job.status)) throw Error('No pending result');
    job.deadlineMs = Date.now() + minutes * 60000;
    event(dir, 'wait_extended', { minutes });
    return { deadlineMs: job.deadlineMs };
  });
}
