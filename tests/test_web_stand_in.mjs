import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import * as store from '../web-stand-in/scripts/job-store.mjs';
import * as flow from '../web-stand-in/scripts/browser-flow.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suite = path.join(repo, '.test-output', 'web-stand-in-tests', crypto.randomUUID());
fs.mkdirSync(suite, { recursive: true });
const chat = 'https://chatgpt.com/c/11111111-2222-3333-4444-555555555555';
const ui = { browserId: 'test-browser', composer: { role: 'textbox', name: 'Ask' },
  chatMode: { role: 'button', name: 'Chat' }, send: { role: 'button', name: 'Send' },
  messageSelector: '[data-role]', roleAttribute: 'data-role', stopNames: ['Stop'],
  turnSelector: 'article', copy: { role: 'button', name: 'Copy' } };

function fixture(task = 'Keep these bytes: $(not-code) `tick` 中文\n') {
  const root = path.join(suite, crypto.randomUUID()); fs.mkdirSync(root);
  const taskFile = path.join(root, 'task.md');
  fs.writeFileSync(taskFile, task, 'utf8');
  const state = store.createJob({ projectRoot: root, taskFile, outputDir: path.join(root, 'job') });
  return { root, file: state.jobFile, ...store.loadJob(state.jobFile) };
}
function attached(f) { store.attachTab(f.file, { browserId: ui.browserId, tabId: 'test-tab' }); }
function submitted(f) { attached(f); store.claimSend(f.file); store.bindChat(f.file, { url: chat, userText: f.prompt }); }
function packet(f, text) {
  return { url: chat, generating: false, source: 'browser-copy-markdown',
    text: text ?? `${f.job.beginTag}\n# 中文\n\n| a | b |\n|---|---|\n| 17 | 25 |\n\n\`\`\`\n$(not-code) \`tick\`\n\`\`\`\n${f.job.endTag}\n` };
}
function browser(f, options = {}) {
  let draft = options.draft ?? '', clipboard = options.emptyClipboard ? [] : [{ entries: [{ mimeType: 'text/plain', text: 'user clipboard' }] }];
  let delayedCopyReads = 0;
  const counters = { sends: 0, copies: 0, observations: 0 };
  const answer = packet(f).text;
  const response = { userText: f.prompt, replies: [answer], generating: options.generating ?? false };
  const loc = {
    innerText: async () => draft,
    fill: async value => {
      if (options.pasteLimit && value.length > options.pasteLimit) throw Error('Large paste converted to attachment');
      draft = value + '\n';
    }, // contenteditable terminal newline
    type: async value => { draft = draft.slice(0, -1) + value + '\n'; },
    getAttribute: async () => 'true',
    isEnabled: async () => true, isVisible: async () => true, count: async () => 1,
    filter() { return this; }, getByText() { return this; }, locator() { return this; },
    waitFor: async () => {},
    getByRole() { return { ...loc, click: async () => {
      counters.copies++;
      if (options.copyDelayReads) delayedCopyReads = options.copyDelayReads;
      else clipboard = [{ entries: [{ mimeType: 'text/plain', text: answer }] }];
    } }; },
  };
  const tab = { id: 'test-tab', url: async () => options.url ?? (counters.sends ? chat : 'https://chatgpt.com/'),
    playwright: {
      getByRole(role, { name }) { return name === 'Send' ? { ...loc, click: async () => {
        counters.sends++; if (options.clickThrows) throw Error('click timed out');
      } } : loc; },
      locator: () => loc,
      evaluate: async (fn, arg) => { counters.observations++; return arg ? response : options.blocker ?? null; },
    },
    clipboard: { read: async () => structuredClone(clipboard), write: async items => { if (!items.length) throw Error('Empty clipboard items'); clipboard = items; },
      readText: async () => {
        if (delayedCopyReads && --delayedCopyReads === 0) clipboard = [{ entries: [{ mimeType: 'text/plain', text: answer }] }];
        return clipboard[0].entries[0].text;
      },
      writeText: async text => { clipboard = [{ entries: [{ mimeType: 'text/plain', text }] }]; } },
  };
  return { tab, counters, response, clipboard: () => clipboard };
}

test('input remains immutable and status is read-only, including Windows slash paths', () => {
  const f = fixture(); const before = fs.readFileSync(f.file);
  const portable = f.file.replaceAll('\\', '/');
  assert.equal(store.status(portable).status, 'prepared');
  assert.deepEqual(fs.readFileSync(f.file), before);
  fs.appendFileSync(path.join(f.dir, 'task.md'), 'changed');
  assert.throws(() => store.status(f.file), /integrity/);
});

test('large Unicode task stays editable and exact without creating a pasted attachment', async () => {
  const f = fixture('😀中文资料 '.repeat(1800));
  const b = browser(f, { pasteLimit: 2500 });
  const result = await flow.compose(f.file, b.tab, ui);
  assert.equal(result.status, 'composed_not_sent');
  await flow.submit(f.file, b.tab, ui); // submit rechecks the entire original prompt
  assert.equal(b.counters.sends, 1);
});

test('asynchronous Copy waits for changed clipboard and restores the prior contents', async () => {
  const f = fixture(); const b = browser(f, { copyDelayReads: 4 });
  await flow.compose(f.file, b.tab, ui); await flow.submit(f.file, b.tab, ui);
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'completed'); assert.equal(b.counters.copies, 1);
  assert.equal(b.clipboard()[0].entries[0].text, 'user clipboard');
});

test('unchanged clipboard never saves sentinel as an answer or repeats a submission', async () => {
  const f = fixture(); const b = browser(f, { copyDelayReads: 1000 });
  await flow.compose(f.file, b.tab, ui); await flow.submit(f.file, b.tab, ui);
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'pending'); assert.equal(result.reason, 'clipboard_copy_not_ready');
  assert.equal(store.status(f.file).status, 'submitted'); assert.equal(b.counters.sends, 1);
  assert.equal(b.clipboard()[0].entries[0].text, 'user clipboard');
});

test('outside paths and symlinks cannot redirect output', () => {
  const f = fixture();
  assert.throws(() => store.createJob({ projectRoot: f.root, taskFile: path.join(f.root, 'task.md'), outputDir: path.join(suite, 'outside') }), /inside/);
  const link = path.join(f.root, 'link');
  fs.symlinkSync(suite, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.createJob({ projectRoot: f.root, taskFile: path.join(f.root, 'task.md'), outputDir: path.join(link, 'outside') }), /Symlink/);
});

test('one send intent survives a timeout and blocks another sender', async () => {
  const f = fixture(), b = browser(f, { clickThrows: true });
  await flow.compose(f.file, b.tab, ui);
  await assert.rejects(flow.submit(f.file, b.tab, ui), /timed out/);
  assert.equal(store.status(f.file).status, 'sending');
  await assert.rejects(flow.submit(f.file, b.tab, ui), /already attempted/);
  assert.equal(b.counters.sends, 1);
  store.bindChat(f.file, { url: chat, userText: f.prompt });
  assert.equal(store.status(f.file).status, 'submitted');
});

test('concurrent processes can claim at most one send', async () => {
  const f = fixture(); attached(f);
  const module = new URL('../web-stand-in/scripts/job-store.mjs', import.meta.url).href;
  const child = () => new Promise(resolve => {
    const code = `import {claimSend} from ${JSON.stringify(module)}; try { claimSend(${JSON.stringify(f.file)}); } catch { process.exitCode=7; }`;
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: 'ignore' });
    p.on('exit', resolve);
  });
  const results = await Promise.all([child(), child(), child(), child()]);
  assert.equal(results.filter(code => code === 0).length, 1);
  assert.equal(store.status(f.file).sendAttempts, 1);
});

test('wrong prompt, wrong chat, and temporary chat IDs are rejected', () => {
  const f = fixture(); attached(f); store.claimSend(f.file);
  assert.throws(() => store.bindChat(f.file, { url: chat, userText: 'another-request\n' + f.prompt }), /mismatch/);
  assert.throws(() => store.bindChat(f.file, { url: 'https://chatgpt.com/c/WEB:temporary', userText: f.prompt }), /permanent/);
  store.bindChat(f.file, { url: chat, userText: f.prompt });
  assert.throws(() => store.bindChat(f.file, { url: chat.replace('11111111', '99999999'), userText: f.prompt }), /different chat/);
});

test('site challenge is persisted without binding a temporary chat or sending again', async () => {
  const f = fixture(); attached(f); store.claimSend(f.file);
  const b = browser(f, { blocker: 'site_challenge', url: 'https://chatgpt.com/c/local-chatgpt%3Atemporary' });
  const result = await flow.collect(f.file, b.tab, { browserId: ui.browserId }, { sliceMs: 0 });
  assert.equal(result.status, 'blocked'); assert.equal(result.reason, 'site_challenge');
  assert.equal(store.status(f.file).blocker, 'site_challenge');
  assert.equal(store.status(f.file).chatUrl, null); assert.equal(b.counters.sends, 0);
});

test('complete pipeline saves exact Markdown and restores clipboard', async () => {
  const f = fixture(), b = browser(f);
  const original = structuredClone(b.clipboard());
  await flow.compose(f.file, b.tab, ui);
  await flow.submit(f.file, b.tab, ui);
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'completed');
  assert.equal(fs.readFileSync(result.answer, 'utf8'), packet(f).text);
  assert.deepEqual(b.clipboard(), original);
  assert.equal(b.counters.sends, 1); assert.equal(b.counters.copies, 1);
  const reads = b.counters.observations;
  assert.deepEqual(await flow.collect(f.file, {}, {}, { sliceMs: 0 }), result);
  assert.equal(b.counters.observations, reads);
});

test('streaming with an end marker is still pending', async () => {
  const f = fixture(), b = browser(f, { generating: true, url: chat }); submitted(f);
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'pending'); assert.equal(b.counters.copies, 0);
  assert.equal(fs.existsSync(path.join(f.dir, 'answer.md')), false);
});

test('empty clipboard is restored without losing the copied answer', async () => {
  const f = fixture(), b = browser(f, { emptyClipboard: true, url: chat }); submitted(f);
  const result = await flow.collect(f.file, b.tab, { ...ui, copyScope: '.controls', turnIncludesRequest: true }, { sliceMs: 0 });
  assert.equal(result.status, 'completed');
  assert.equal(fs.readFileSync(result.answer, 'utf8'), packet(f).text);
  assert.equal(b.clipboard()[0].entries[0].text, '');
});

test('current DOM adapter excludes heading text and stops at the next user message', async () => {
  const f = fixture(); attached(f); store.claimSend(f.file);
  const b = browser(f, { url: chat });
  const node = (role, text, body) => ({ innerText: text,
    getAttribute: () => `fallback-turn-0:2:${role}`,
    querySelector: () => body ? { innerText: body } : null });
  let nodes = [node('user', f.prompt), node('assistant', 'ChatGPT says\n' + packet(f).text, packet(f).text),
    node('user', 'unrelated request'), node('assistant', 'unrelated answer', 'unrelated answer')];
  b.tab.playwright.evaluate = async (fn, arg) => {
    if (!arg) return null;
    return vm.runInNewContext(`(${fn.toString()})(arg)`, { arg,
      document: { querySelectorAll: selector => selector === 'button' ? [] : nodes } });
  };
  const adapted = { ...ui, roleSuffix: true, assistantBodySelector: '.body' };
  const result = await flow.observe(f.file, b.tab, adapted);
  assert.equal(result.answerText, packet(f).text); assert.equal(result.requestObserved, true);
  assert.equal(store.status(f.file).status, 'submitted');
  nodes.push(node('user', f.prompt));
  await assert.rejects(flow.observe(f.file, b.tab, adapted), /Ambiguous/);
});

test('unknown send can expire without a formal URL, cancellation or resubmission', async () => {
  const f = fixture(); attached(f); store.claimSend(f.file);
  const j = JSON.parse(fs.readFileSync(f.file)); j.deadlineMs = 1; fs.writeFileSync(f.file, JSON.stringify(j));
  const b = browser(f, { url: 'https://chatgpt.com/c/local-chatgpt%3Apending' });
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'wait_expired'); assert.equal(result.remoteCancelled, false);
  assert.equal(store.status(f.file).sendAttempts, 1); assert.equal(b.counters.sends, 0);
});

test('collection rejects an unsent job and expires when answer Copy never becomes ready', async () => {
  const f = fixture(); attached(f); const b = browser(f, { url: chat });
  await assert.rejects(flow.collect(f.file, b.tab, ui, { sliceMs: 0 }), /Submit/);
  store.claimSend(f.file); store.bindChat(f.file, { url: chat, userText: f.prompt });
  const j = JSON.parse(fs.readFileSync(f.file)); j.deadlineMs = 1; fs.writeFileSync(f.file, JSON.stringify(j));
  const turn = b.tab.playwright.locator('article');
  turn.getByRole = () => ({ count: async () => 0 });
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'wait_expired'); assert.equal(result.reason, 'copy_control_not_ready');
  assert.equal(b.counters.copies, 0); assert.equal(b.counters.sends, 0);
});

test('reconnected tab requires the original visible request and bound chat', async () => {
  const f = fixture(); submitted(f);
  const b = browser(f, { url: chat }); b.tab.id = 'reconnected';
  b.response.userText = 'another request';
  await assert.rejects(flow.resume(f.file, b.tab, ui), /identity mismatch/);
  assert.equal(store.status(f.file).tab.tabId, 'test-tab');
  b.response.userText = f.prompt;
  assert.equal((await flow.resume(f.file, b.tab, ui)).tab.tabId, 'reconnected');
  assert.equal((await flow.collect(f.file, b.tab, ui, { sliceMs: 0 })).status, 'completed');
  assert.equal(b.counters.sends, 0);
  const g = fixture(); submitted(g);
  assert.throws(() => store.rebindTab(g.file, { browserId: ui.browserId, tabId: 'new', userText: g.prompt,
    url: chat.replace('11111111', '99999999') }), /different chat/);
});

test('wait expiration preserves remote state and does not resend/cancel', async () => {
  const f = fixture(); submitted(f);
  const j = JSON.parse(fs.readFileSync(f.file)); j.deadlineMs = 1;
  fs.writeFileSync(f.file, JSON.stringify(j));
  const b = browser(f, { generating: true, url: chat });
  const result = await flow.collect(f.file, b.tab, ui, { sliceMs: 0 });
  assert.equal(result.status, 'wait_expired'); assert.equal(result.remoteCancelled, false);
  assert.equal(store.status(f.file).status, 'submitted'); assert.equal(b.counters.sends, 0);
});

test('partial, empty, duplicated, wrong-source and still-generating answers cannot complete', () => {
  const f = fixture(); submitted(f);
  for (const p of [packet(f, f.job.beginTag + '\npartial'), packet(f, `${f.job.beginTag}\n${f.job.endTag}`),
    packet(f, `${f.job.beginTag}\nbody\n${f.job.endTag}\n${f.job.endTag}`),
    { ...packet(f), generating: true }, { ...packet(f), source: 'snapshot' }]) {
    assert.throws(() => store.saveAnswer(f.file, p));
  }
  assert.equal(store.status(f.file).status, 'submitted');
  assert.equal(fs.existsSync(path.join(f.dir, 'answer.md')), false);
});

test('partial save can recover, conflicting data is preserved, saved bytes are verified', () => {
  const f = fixture(); submitted(f); const p = packet(f);
  fs.writeFileSync(path.join(f.dir, 'answer.packet.json'), JSON.stringify(p));
  fs.writeFileSync(path.join(f.dir, 'answer.md'), p.text);
  assert.equal(store.recoverSave(f.file).status, 'completed');
  fs.appendFileSync(path.join(f.dir, 'answer.md'), 'tamper');
  assert.throws(() => store.status(f.file), /integrity/);
  const g = fixture(); submitted(g); fs.writeFileSync(path.join(g.dir, 'answer.md'), 'preserve');
  assert.throws(() => store.saveAnswer(g.file, packet(g)), /partial answer/);
  assert.equal(fs.readFileSync(path.join(g.dir, 'answer.md'), 'utf8'), 'preserve');
});

test('an existing draft, another tab and requested model mismatch stop before sending', async () => {
  const f = fixture(), b = browser(f, { draft: 'user draft' });
  await assert.rejects(flow.compose(f.file, b.tab, ui), /Existing draft/);
  assert.equal(b.counters.sends, 0); assert.equal(store.status(f.file).tab, null);
  attached(f);
  await assert.rejects(flow.submit(f.file, { ...b.tab, id: 'another' }, ui), /Wrong browser/);
  const j = JSON.parse(fs.readFileSync(f.file)); j.requestedModel = 'specified'; fs.writeFileSync(f.file, JSON.stringify(j));
  assert.throws(() => store.attachTab(f.file, { browserId: ui.browserId, tabId: 'test-tab', modelObserved: 'other' }), /model/);
});
