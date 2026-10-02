// Import ONLY inside the host's cua_repl. Does not launch a driver or use HTTP/CDP.
import { loadJob, attachTab, claimSend, bindChat, rebindTab, saveAnswer, status, recordBlock } from './job-store.mjs';

// contenteditable adds/removes terminal line breaks; preserve all internal text.
const promptText = text => text.replace(/\r\n/g, '\n').replace(/\n+$/, '');

function locator(tab, spec) {
  if (!spec || !spec.role || typeof spec.name !== 'string') throw Error('Use role/name from a current DOM observation');
  return tab.playwright.getByRole(spec.role, { name: spec.name, exact: true });
}

function checkTab(job, tab, browserId) {
  if (!job.tab || job.tab.tabId !== String(tab.id) || job.tab.browserId !== String(browserId)) throw Error('Wrong browser/tab binding');
}

export async function compose(file, tab, ui) {
  const { job, prompt } = loadJob(file);
  if (job.status !== 'prepared' || job.sendAttempts !== 0) throw Error('Already attempted; recover original submission');
  const url = new URL(await tab.url());
  if (url.origin !== 'https://chatgpt.com' || url.pathname !== '/') throw Error('Use a fresh regular ChatGPT home tab');
  const mode = locator(tab, ui.chatMode);
  if (await mode.getAttribute('aria-pressed') !== 'true') throw Error('Regular Chat mode not selected');
  const box = locator(tab, ui.composer);
  const current = await box.innerText({ timeoutMs: 5000 });
  if (current.trim() && promptText(current) !== promptText(prompt)) throw Error('Existing draft; not overwriting it');
  attachTab(file, { browserId: ui.browserId, tabId: tab.id, modelObserved: ui.modelObserved ?? null });
  if (promptText(current) !== promptText(prompt)) {
    // ChatGPT may turn a large single fill/paste into a text attachment.
    // Small input chunks retain editable text; split Unicode code points safely.
    const chars = Array.from(prompt), size = 1250;
    await box.fill(chars.slice(0, size).join(''), { timeoutMs: 10000 });
    for (let i = size; i < chars.length; i += size) {
      await box.type(chars.slice(i, i + size).join(''), { timeoutMs: 10000 });
    }
  }
  const filled = await box.innerText({ timeoutMs: 5000 });
  if (promptText(filled) !== promptText(prompt)) throw Error('Composer content mismatch; nothing sent');
  return { status: 'composed_not_sent', jobFile: file, tabId: tab.id, promptChars: prompt.length };
}

export async function submit(file, tab, ui) {
  const { job, prompt } = loadJob(file);
  if (job.status !== 'prepared' || job.sendAttempts !== 0) throw Error('Send already attempted; recover original submission');
  checkTab(job, tab, ui.browserId);
  const url = new URL(await tab.url());
  if (url.origin !== 'https://chatgpt.com' || url.pathname !== '/') throw Error('Draft tab navigated away before send');
  const box = locator(tab, ui.composer);
  if (promptText(await box.innerText({ timeoutMs: 5000 })) !== promptText(prompt)) throw Error('Draft changed before send');
  const send = locator(tab, ui.send);
  if (!await send.isEnabled()) throw Error('Send control unavailable; nothing sent');
  claimSend(file);
  // A thrown/timed-out click deliberately leaves the durable state at "sending".
  await send.click({ timeoutMs: 10000 });
  return { ...status(file), requiresObservation: true };
}

// Selectors must be grounded in a current DOM inspection. Never read framework
// stores, cookies, network payloads, conversation APIs, or unrelated history.
export async function observe(file, tab, ui, { recoverBinding = false } = {}) {
  const { job } = loadJob(file);
  if (!recoverBinding) checkTab(job, tab, ui.browserId);
  const pageBlock = await tab.playwright.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.innerText).join('\n');
    if (/cloudflare_challenge|verify you are human|验证您是人类/i.test(alerts)) return 'site_challenge';
    if (/something went wrong|出了点问题|出错了/i.test(alerts)) return 'page_error';
    return null;
  });
  if (pageBlock) return recordBlock(file, pageBlock);
  if (!ui.messageSelector || !ui.roleAttribute || !Array.isArray(ui.stopNames)) throw Error('Observed message structure required');
  const data = await tab.playwright.evaluate(({ selector, attribute, roleSuffix, assistantBodySelector, requestTag, stopNames }) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    const role = el => roleSuffix ? el.getAttribute(attribute)?.split(':').at(-1) : el.getAttribute(attribute);
    const users = nodes.filter(el => role(el) === 'user' && el.innerText.startsWith(requestTag + '\n'));
    if (users.length > 1) throw Error('Ambiguous submitted requests');
    const i = users.length === 1 ? nodes.indexOf(users[0]) : -1;
    const user = i >= 0 ? nodes[i].innerText : null;
    const replies = [];
    if (i >= 0) {
      for (let n = i + 1; n < nodes.length; n++) {
        if (role(nodes[n]) === 'user') break;
        if (role(nodes[n]) === 'assistant') {
          const body = assistantBodySelector ? nodes[n].querySelector(assistantBodySelector) : nodes[n];
          if (!body) throw Error('Assistant body selector no longer matches');
          replies.push(body.innerText);
        }
      }
    }
    const generating = Array.from(document.querySelectorAll('button')).some(button =>
      stopNames.includes(button.getAttribute('aria-label') || button.innerText) && button.getClientRects().length > 0);
    return { userText: user, replies, generating };
  }, { selector: ui.messageSelector, attribute: ui.roleAttribute, roleSuffix: ui.roleSuffix === true,
    assistantBodySelector: ui.assistantBodySelector ?? null, requestTag: job.requestTag, stopNames: ui.stopNames });
  const url = await tab.url();
  if (recoverBinding) {
    rebindTab(file, { browserId: ui.browserId, tabId: tab.id, url, userText: data.userText });
  }
  if (data.userText !== null && !job.chatUrl && !recoverBinding) {
    try { bindChat(file, { url, userText: data.userText }); }
    catch (error) {
      if (!String(error.message).includes('Observed permanent')) throw error;
      return { status: 'pending_chat_url', generating: data.generating };
    }
  }
  if (job.chatUrl && url !== job.chatUrl) throw Error('Current tab navigated away from the bound chat');
  const matching = data.replies.filter(text => text.trim().startsWith(job.beginTag + '\n'));
  if (matching.length > 1) throw Error('Ambiguous assistant replies');
  return { status: 'observed', url, requestObserved: data.userText !== null,
    generating: data.generating, answerText: matching[0] ?? null };
}

// Call only after freshly locating the original request in a reconnected tab.
export async function resume(file, tab, ui) {
  const result = await observe(file, tab, ui, { recoverBinding: true });
  if (result.status === 'blocked') return result;
  return status(file);
}

export async function collect(file, tab, ui, { sliceMs = 25000 } = {}) {
  const saved = status(file);
  if (saved.status === 'completed') return saved; // No browser access for a saved answer.
  if (!Number.isInteger(sliceMs) || sliceMs < 0 || sliceMs > 45000) throw Error('sliceMs must be 0..45000');
  let { job } = loadJob(file);
  if (!['sending', 'submitted'].includes(job.status)) throw Error('Submit the prepared task before collecting');
  checkTab(job, tab, ui.browserId);
  let observed = await observe(file, tab, ui);
  if (observed.status === 'blocked') return observed;
  ({ job } = loadJob(file));
  if (job.status !== 'submitted') {
    const remaining = job.deadlineMs - Date.now();
    if (remaining > 0 && sliceMs > 0) {
      try {
        await tab.playwright.locator(ui.messageSelector).filter({ hasText: job.requestTag })
          .waitFor({ state: 'visible', timeoutMs: Math.min(sliceMs, remaining) });
      } catch (error) {
        if (!/timeout|timed out/i.test(String(error.message))) throw error;
      }
      observed = await observe(file, tab, ui);
      if (observed.status === 'blocked') return observed;
      ({ job } = loadJob(file));
    }
    if (job.status !== 'submitted') return { ...status(file),
      status: Date.now() >= job.deadlineMs ? 'wait_expired' : 'pending',
      reason: 'submission_not_yet_verified', remoteCancelled: false };
    return { ...status(file), status: 'pending' }; // One bounded wait per call.
  }
  if (observed.answerText === null || !observed.answerText.trimEnd().endsWith(job.endTag) || observed.generating) {
    const remaining = job.deadlineMs - Date.now();
    if (remaining <= 0) return { ...status(file), status: 'wait_expired', remoteCancelled: false };
    if (sliceMs > 0) {
      // Wait on the answer, not on a timer and not on the marker in our own prompt.
      try {
        if (observed.answerText?.trimEnd().endsWith(job.endTag) && observed.generating) {
          for (const name of ui.stopNames) {
            const stop = tab.playwright.getByRole('button', { name, exact: true });
            if (await stop.count() === 1 && await stop.isVisible()) {
              await stop.waitFor({ state: 'hidden', timeoutMs: Math.min(sliceMs, remaining) });
              break;
            }
          }
        } else {
          await tab.playwright.locator(ui.messageSelector).filter({ hasText: job.beginTag })
            .filter({ hasNotText: job.requestTag }).getByText(job.endTag, { exact: true })
            .waitFor({ state: 'visible', timeoutMs: Math.min(sliceMs, remaining) });
        }
      } catch (error) {
        if (!/timeout|timed out/i.test(String(error.message))) throw error;
      }
      observed = await observe(file, tab, ui);
      if (observed.status === 'blocked') return observed;
    }
  }
  if (!observed.answerText || observed.generating || !observed.answerText.trimEnd().endsWith(job.endTag)) {
    return { ...status(file), status: Date.now() >= job.deadlineMs ? 'wait_expired' : 'pending', remoteCancelled: false };
  }
  if (!ui.turnSelector || !ui.copy) throw Error('Observe the assistant turn and Copy button before collecting');
  const turn = tab.playwright.locator(ui.turnSelector).filter({ hasText: job.beginTag })
    .filter(ui.turnIncludesRequest ? { hasText: job.requestTag } : { hasNotText: job.requestTag });
  if (await turn.count() !== 1) throw Error('Assistant turn is not unique');
  const controls = ui.copyScope ? turn.locator(ui.copyScope) : turn;
  const copy = controls.getByRole(ui.copy.role, { name: ui.copy.name, exact: true });
  if (await copy.count() !== 1 || !await copy.isEnabled()) return { ...status(file),
    status: Date.now() >= job.deadlineMs ? 'wait_expired' : 'pending',
    reason: 'copy_control_not_ready', remoteCancelled: false };
  const answer = await copyMarkdown(tab, copy, job.id);
  if (!answer) return { ...status(file),
    status: Date.now() >= job.deadlineMs ? 'wait_expired' : 'pending',
    reason: 'clipboard_copy_not_ready', remoteCancelled: false };
  return saveAnswer(file, { url: observed.url, text: answer, generating: observed.generating,
    source: 'browser-copy-markdown' });
}

// Caller must supply the uniquely observed full-answer Copy control, not a code-block Copy.
export async function copyMarkdown(tab, copy, requestId) {
  const previous = await tab.clipboard.read();
  let answer;
  const sentinel = `WSI_CLIPBOARD_SENTINEL:${requestId}`;
  try {
    await tab.clipboard.writeText(sentinel);
    await copy.click({ timeoutMs: 10000 });
    // Copy handlers may finish asynchronously after the click has returned.
    // Observe the clipboard itself; do not add an arbitrary sleep or repaste.
    const copyDeadline = Date.now() + 2500;
    for (let attempt = 0; attempt < 256; attempt++) {
      answer = await tab.clipboard.readText();
      if (answer && answer !== sentinel) break;
      if (Date.now() >= copyDeadline) break;
    }
  } finally {
    if (previous.length) await tab.clipboard.write(previous);
    else await tab.clipboard.writeText(''); // The host rejects write([]).
  }
  return answer && answer !== sentinel ? answer : null;
}
