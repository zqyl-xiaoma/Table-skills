# 浏览器执行与恢复

此实现适配 Codex 当前 `cua_repl` 浏览器工具。Node.js 22+ 只处理任务和输出文件；网页操作只通过宿主提供的 `cua`、`tab.playwright` 和 `tab.clipboard`。运行前读取当前工具实际返回的文档；不能因为此页有示例就假定接口存在。

## 1. 准备任务

把用户授权的独立问题写入项目文件，然后运行（替换示例绝对路径）：

```powershell
node D:\table-skills\web-stand-in\scripts\job.mjs prepare --project D:\Dev\my-project --task D:\Dev\my-project\task.md --output D:\Dev\my-project\.web-stand-in\research-01 --wait-minutes 20 --brief true
```

`--model` 可选，值为用户指定且页面已核对的模型标签；未指定时沿用当前选择。不擅自重置模型、推理强度或账号设置。默认不限制答案字符数；完整性依靠精确复制、首尾标记和保存校验。大文件和附件另走下载流程。

输出包含 `task.md`、`prompt.md`、`job.json`、`events.jsonl`。创建目标必须不存在，所有文件保留在指定项目内，不跟随任务目录内的 symlink/junction。

## 2. 浏览器与发送

遵守 `cua_repl` 的首调用约束。按用户指定浏览器绑定；需要清单时使用 `cua.getState()`。新建 Chrome 标签时传入简短的 `sessionName`，例如“🌐 网页替身”。已有登录由浏览器管理，不读取凭据。

```javascript
// 首调用独立执行；这里的 chrome 可换成当前清单确认的浏览器 ID。
var tab = await cua.createBrowserTab('chrome', 'https://chatgpt.com/', {sessionName:'🌐 网页替身'});
```

读取当前 DOM；先确认 Chat、登录状态、空白输入框和模型，再构造配置。下面中文标签曾被观察到，但不能直接当作其他语言或版本的事实：

```javascript
var flow = await import('file:///D:/table-skills/web-stand-in/scripts/browser-flow.mjs');
var jobFile = 'D:/Dev/my-project/.web-stand-in/research-01/job.json';
var ui = {
  browserId: '填写本次观察到的 ID',
  chatMode: {role:'button', name:'聊天'},
  composer: {role:'textbox', name:'询问 ChatGPT'},
  modelObserved: '填写界面实际选中值'
};
nodeRepl.write(await flow.compose(jobFile, tab, ui));
// 填写后只观察可见按钮，避免把长输入全文回显到主上下文。
nodeRepl.write(await tab.playwright.evaluate(() => Array.from(document.querySelectorAll('main button'))
  .filter(b => b.getClientRects().length)
  .map(b => ({name:b.getAttribute('aria-label') || b.innerText, disabled:b.disabled}))));
```

从填写后的 DOM 取得实际 Send 控件，再发送：

```javascript
ui.send = {role:'button', name:'发送'};
nodeRepl.write(await flow.submit(jobFile, tab, ui));
nodeRepl.write({url:await tab.url()});
```

`compose` 用小段文本填写，避免 ChatGPT 把长文本一次性粘贴转为附件；按 Unicode 字符分段，最后比较完整文本。它允许输入框因 `contenteditable` 多出末尾换行，内部文字和空白必须保持一致。若网站仍转换成附件，停止发送，观察当前草稿并只处理本任务产生的内容，再修复填写。`submit` 在浏览器点击前持久化 `sending`，即使点击超时也不能再次提交。若异常发生在 `prepared` 阶段，先重看页面和任务状态，确认没有发送意图后才可修复填写。

## 3. 观察与自动收取

先检查自己的用户消息和 assistant 消息 DOM，只读取实际呈现的元素属性。消息内容只返回身份标记和必要的短片段，不打印整个 main.innerText 或填写后的完整 DOM。使用观察到的属性配置 `messageSelector`、`roleAttribute`、`turnSelector`、`stopNames` 与 `copy`；不读取页面框架状态、隐藏存储、私有接口或无关历史。控件不存在或 DOM 变化时，重新观察并适配，不猜测选择器。Copy 必须定位回答操作栏；代码块和表格各自的复制按钮不能当作完整回答复制。

对于具有消息作者属性的页面，配置形如：

```javascript
// 属性和值必须先由当前 DOM 核实，以下仅为结构示例。
Object.assign(ui, {
  messageSelector: '[实际作者属性]', roleAttribute: '实际作者属性',
  turnSelector: '实际消息外层选择器',
  stopNames: ['实际停止生成按钮名称'],
  copy: {role:'button', name:'实际复制回答按钮名称'}
});
nodeRepl.write(await flow.collect(jobFile, tab, ui, {sliceMs:25000}));
```

2026-09-30 Chrome 实测界面使用下面的属性。`roleSuffix` 取属性最后一个冒号后的 `user/assistant`；`assistantBodySelector` 排除“ChatGPT 说”标题；该版 `turnSelector` 同时包住用户与回答，故 `turnIncludesRequest` 为 true，并用 `copyScope` 排除代码块 Copy。先核实当前 DOM，不能跨版本盲用：

```javascript
Object.assign(ui, {
  messageSelector: 'main [data-chatgpt-search-unit-key]',
  roleAttribute: 'data-chatgpt-search-unit-key', roleSuffix: true,
  assistantBodySelector: '[data-chatgpt-selection-message-id]',
  turnSelector: 'main div.group.flex.flex-col', turnIncludesRequest: true,
  copyScope: '.turn-action-controls', stopNames: ['停止'],
  copy: {role:'button', name:'复制'}
});
```

自动模式遇到 `pending` 时继续同一任务的收取。每次工具调用留出状态读取和文件写入余量，推荐 `timeout_ms: 60000`，等待 slice 为 25000；不让一次工具调用无限等待。等待依赖真实结束标记，只输出短状态，不把每次完整 DOM 和回答反复塞进主任务上下文。

Copy 提供的原文在浏览器工具进程内直接写入项目，不经过 shell 参数，不执行答案中的 `$()`、反引号或命令。脚本先暂存剪贴板，写入唯一 sentinel，再点击本任务回答的 Copy，读取并恢复原剪贴板；复制失败不会采用旧剪贴板。

完成返回 `answer.md` 与 `answer.receipt.json`。保留回答首尾标记和格式；随后执行 `workflow.mjs brief JOB` 获取精简结论，按 [分流与结果采纳](task-routing.md) 核验并接回主任务。用户要完整正文时读取 answer.md，不重新查网页。不把收取状态当成内容质量结论。

## 4. 状态、恢复与退出

```powershell
node D:\table-skills\web-stand-in\scripts\job.mjs status D:\Dev\my-project\.web-stand-in\research-01\job.json
node D:\table-skills\web-stand-in\scripts\job.mjs recover-save D:\Dev\my-project\.web-stand-in\research-01\job.json
```

| 状态 | 动作 |
|---|---|
| prepared | 还没有发送意图；核对原标签和草稿后可继续填写 |
| sending | 可能已发送；只观察原请求，不重复点击或新建同一任务 |
| submitted / pending | 复用绑定的正式对话地址，继续收取 |
| blocked | 站点验证或页面错误；保留原任务，请用户处理必要的登录/验证 |
| wait_expired | 只结束本地等待，远端状态不作假定；用户要求继续时延长同一任务窗口 |
| completed | 校验本地哈希后直接复用，浏览器不再读取 |

`blocked` 和 `wait_expired` 是收取结果；`job.json` 保留 sending/submitted 及 blocker，不丢失发送身份。需要继续已获用户授权的等待时使用 `extend-wait JOB MINUTES`，不创建新 job。未知发送不能通过延长窗口变成“尚未发送”。

浏览器重启后先按保存的地址或当次标签清单重新观察，不能把旧标签 ID 当作当前身份。确认原请求确实在新绑定标签中后，调用 `flow.resume(jobFile, tab, ui)`；它验证页面上的唯一请求标记与正式对话地址，再更新标签绑定。随后继续 `collect`，不重新发送。不直接改 JSON 绕过检查。发送未知且原请求无法找到时保留阻塞状态。

保存中断会保留 `answer.packet.json`、部分文件和事件；`recover-save` 只补齐相同内容，遇到冲突保留原文件并报错。`.job.lock` 残留时先确认原进程不再执行，并检查最后事件，再处理该任务锁，不自动删除未知 writer 的锁。

用户取消或预算结束时停止新的发送与等待，报告原对话地址、任务文件、当前状态和恢复方式；不要擅自创建 automation。需要跨回合保留正在生成或等用户处理的标签时用 `markHandoff`；最终输出标签可用 `markDeliverable`。
