# Table Skills 全视频场景验收结果

日期：2026-10-01（Asia/Shanghai）。项目：D:/table-skills；交接编号：full-video-acceptance-20261001-01。

发布说明：本文是该日期的历史验收记录。`.test-output/` 证据与 `PROJECT_STATE.md` 为本机资料，不随 GitHub fork 上传；相关链接需在原本机查看。后续安装与 Hook 审批不改变本轮判定。

**已完成16场景逐项核查与本轮交付，未达到全视频所有真实宿主与效果均通过。** 按各自标注范围：PASS 12、FAIL 0、BLOCKED 1、NOT-RUN 2、N/A 1。PASS必须连同“判定范围”和分项列阅读，不能把隔离测试视为真实宿主通过。

[32段验收/业务prompt及16个完整业务替换示例](acceptance-prompts.md)；[机器可读结果](../.test-output/full-video-acceptance-20261001/results.json)。

## 本轮覆盖矩阵

| 场景 | 视频需求 | 结果及范围 | 实现 | 本地回归 | 本轮宿主/实际执行 | 效果 | 证据 |
|---|---|---|---|---|---|---|---|
| V01 固定目录、规则与资料 | 00:32–01:38 | PASS：真实文件与当前版本 | PASS | PASS | PASS | N/A | [receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json) |
| V02 自然自动压缩触发评估 | 01:39–02:37 | NOT-RUN：同一 session 自然周期 | PASS | PASS | NOT-RUN | N/A | [native-hook-observation.json](../.test-output/full-video-acceptance-20261001/native-hook-observation.json) |
| V03 阶段交接提醒与最终展示 | 01:39–02:37 | BLOCKED：本轮原生阶段提醒/Stop | PASS | PASS | BLOCKED | N/A | [hook-doctor.json](../.test-output/full-video-acceptance-20261001/hook-doctor.json) |
| V04 只保存交接材料 | 02:38–02:51 | PASS：真实仅保存 | PASS | PASS | PASS | N/A | [save-only-result.json](../.test-output/full-video-acceptance-20261001/save-only-result.json) |
| V05 确认后新建聊天并实际接续 | 02:38–02:51 | PASS：本次正式源→接手 | PASS | PASS | PASS | N/A | [create-thread.receipt.json](../.test-output/full-video-acceptance-20261001/create-thread.receipt.json) |
| V06 恢复已有状态并检查差异 | 02:38–02:51 | PASS：真实恢复与隔离差异夹具 | PASS | PASS | PASS | N/A | [receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json) |
| V07 普通研究任务隐式分流 | 03:34–03:44 | PASS：本轮普通模拟比较的实际Agent选择 | PASS | PASS | PASS | N/A | [comparison-task.md](../.test-output/full-video-acceptance-20261001/comparison-task.md) |
| V08 显式网页任务、一次发送与原文收取 | 03:26–03:49 | PASS：真实Chrome文本/Markdown收发 | PASS | PASS | PASS | N/A | [compose.receipt.json](../.test-output/full-video-acceptance-20261001/compose.receipt.json) |
| V09 精简回传、核验与实际采纳 | 03:12–03:20、03:48–03:49 | PASS：真实摘要/核验/采纳；拒绝为隔离负例 | PASS | PASS | PASS | N/A | [brief.receipt.json](../.test-output/full-video-acceptance-20261001/web-comparison/brief.receipt.json) |
| V10 中断、未知发送、登录或站点验证恢复 | 03:26–03:49 | PASS：本轮已完成结果复用；故障是隔离测试 | PASS | PASS | PASS | N/A | [completed-reuse.receipt.json](../.test-output/full-video-acceptance-20261001/completed-reuse.receipt.json) |
| V11 暂缓、静默与提醒去重 | 01:39–02:37 | PASS：仅隔离状态逻辑 | PASS | PASS | NOT-RUN | N/A | [regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json) |
| V12 简单任务与本地执行保留本地 | 03:34–03:44 | PASS：真实本地执行与route负例 | PASS | PASS | PASS | N/A | [result.json](../.test-output/full-video-acceptance-20261001/local-routing/result.json) |
| V13 Worktree 隔离、集成与验证 | 03:57–04:23 | PASS：真实独立Git夹具、顺序单writer | PASS | PASS | PASS | N/A | [worktree-result.json](../.test-output/full-video-acceptance-20261001/worktree-result.json) |
| V14 token、耗时与质量对照 | 00:08–00:09、03:05–03:49 | NOT-RUN：实际测量通过；可比效果未验证 | PASS | PASS | PASS | NOT-RUN | [measurement-plan.json](../.test-output/full-video-acceptance-20261001/measurement-plan.json) |
| V15 已有 Goal 的接续边界 | 项目使用扩展，非视频独立承诺 | N/A：无已有Goal的边界 | PASS | PASS | N/A | N/A | [receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json) |
| V16 自己的业务一体化工作 prompt | 04:24–结尾的整体工作方式 | PASS：综合主线与交付完成；全效果未完成 | PASS | PASS | PASS | NOT-RUN | [receiver-first-artifact.receipt.json](../.test-output/full-video-acceptance-20261001/receiver-first-artifact.receipt.json) |

## 实际执行、结果与边界

本轮是一条综合验收任务下的逐场景执行。模板不是预先通过证据，也没有把16个模板分别发送成16个新聊天。下列实际目标对应原模板；唯一网页发送原文为 [comparison-task.md](../.test-output/full-video-acceptance-20261001/comparison-task.md)，带协议的输入另见 job 目录 prompt.md。每项前置条件、步骤、文件SHA-256和限制保存在 results.json。

### V01 固定目录、规则与资料

执行目标：只读核对 D:/table-skills 规则、资料、Git 改动、Skill 入口及交接 manifest。

结果：Git 基线/13哈希/原视频哈希匹配；已安装入口与仓库核心字节一致；现有改动保留。

边界：规则归置是项目约定，不是后台自动写 Memory 的功能。

实现/流程位置：`AGENTS.md`、`PROJECT_STATE.md`、`project-handoff/SKILL.md`、`web-stand-in/SKILL.md`。

证据：[receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json)、[installed-skill-check.json](../.test-output/full-video-acceptance-20261001/installed-skill-check.json)。

### V02 自然自动压缩触发评估

执行目标：在本轮实际工作中观察同一 session 累计3次自然压缩、评估和Stop链路。

结果：未观察到本聊天原生状态；自然累计3次的完整链路未执行；隔离逻辑测试通过。

边界：不降低阈值、不手改计数、不注入live事件、不灌无关内容；计数unknown而不是0。

实现/流程位置：`project-handoff/scripts/compaction_reminder.py`、`project-handoff/references/compaction-reminder.md`。

证据：[native-hook-observation.json](../.test-output/full-video-acceptance-20261001/native-hook-observation.json)、[regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json)、[python-tests.log](../.test-output/full-video-acceptance-20261001/python-tests.log)。

### V03 阶段交接提醒与最终展示

执行目标：核对当前宿主状态；分开验证阶段提醒逻辑和历史真实最终Stop字节。

结果：配置前置检查通过，当前session状态缺失，不能登记本轮真实prepare/Stop；历史原生Stop经原transcript哈希重新核验匹配。

边界：历史final_delivered=true不算本轮PASS；当前native trust未核实，未改信任/配置。

实现/流程位置：`project-handoff/scripts/compaction_reminder.py`、`project-handoff/references/compaction-reminder.md`。

证据：[hook-doctor.json](../.test-output/full-video-acceptance-20261001/hook-doctor.json)、[native-hook-observation.json](../.test-output/full-video-acceptance-20261001/native-hook-observation.json)、[historical-stop-reverification.json](../.test-output/full-video-acceptance-20261001/historical-stop-reverification.json)、[regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json)。

### V04 只保存交接材料

执行目标：使用 project-handoff 保存本轮进行中验收快照，只保存，不新建聊天。

结果：保存并回读目标、版本、成果、运行job、下一步及恢复入口；保存动作没有创建或派发聊天。

边界：该快照属于当前日期的验收证据，不替换现行PROJECT_STATE；进行中未写成完成。

实现/流程位置：`project-handoff/references/handoff.md`。

证据：[save-only-result.json](../.test-output/full-video-acceptance-20261001/save-only-result.json)、[save-only/PROJECT_STATE.md](../.test-output/full-video-acceptance-20261001/save-only/PROJECT_STATE.md)。

### V05 确认后新建聊天并实际接续

执行目标：按明确授权先只读核验，再接收源登记后的继续指令并产出实际矩阵。

结果：真实threadId已创建；只读核验通过后源停止业务写入；当前收到官方派发；接手状态和首个实际文件及哈希存在。

边界：本轮无第二个Codex聊天、Agent或automation；没有Goal/预算移交。

实现/流程位置：`project-handoff/references/handoff.md`。

证据：[create-thread.receipt.json](../.test-output/full-video-acceptance-20261001/create-thread.receipt.json)、[readonly-verification.receipt.json](../.test-output/full-video-acceptance-20261001/readonly-verification.receipt.json)、[continue-received.receipt.json](../.test-output/full-video-acceptance-20261001/continue-received.receipt.json)、[receiver-first-artifact.receipt.json](../.test-output/full-video-acceptance-20261001/receiver-first-artifact.receipt.json)、[receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json)、[scenario-matrix.json](../.test-output/full-video-acceptance-20261001/scenario-matrix.json)。

### V06 恢复已有状态并检查差异

执行目标：核对现行状态和manifest；在独立夹具验证明确标记的字节差异，修复后沿用同一夹具编号。

结果：真实版本无差异；隔离夹具LF/CRLF内容差异被识别，恢复字节后重新匹配；未改真实业务文件制造错误。

边界：差异负例为本地夹具；没有为它新建聊天或伪称宿主自动拒绝。

实现/流程位置：`project-handoff/references/handoff.md`。

证据：[receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json)、[version-difference-result.json](../.test-output/full-video-acceptance-20261001/version-difference-result.json)。

### V07 普通研究任务隐式分流

执行目标：基于公开模拟10候选和R01-R12、S01-S08，选择方案并交付本地决策；任务原文不点名网页Skill。

结果：当前Agent按独立性、工作量和外发授权选择web；实际route=web并完成真实Chrome任务。

边界：route事实由Agent评估，脚本不自动监听所有用户prompt；未另发一条用户消息测试全局自动触发。

实现/流程位置：`AGENTS.md`、`web-stand-in/SKILL.md`、`web-stand-in/scripts/workflow.mjs`。

证据：[comparison-task.md](../.test-output/full-video-acceptance-20261001/comparison-task.md)、[route-input.json](../.test-output/full-video-acceptance-20261001/route-input.json)、[route.json](../.test-output/full-video-acceptance-20261001/route.json)、[prepare-web.receipt.json](../.test-output/full-video-acceptance-20261001/prepare-web.receipt.json)、[web-comparison/job.json](../.test-output/full-video-acceptance-20261001/web-comparison/job.json)。

### V08 显式网页任务、一次发送与原文收取

执行目标：使用 web-stand-in 当前能力，在Chrome普通Chat沿用Pro，完整填写模拟任务、一次发送并Copy完整回答。

结果：1859字符协议输入完整；sendAttempts=1；正式/c/UUID绑定；7970字节原文SHA-256匹配；非空剪贴板恢复通过。

边界：原空剪贴板恢复为空text/plain，内容仍为空但MIME结构不完全相同；原观测false回执保留；无附件/下载路径验收。

实现/流程位置：`web-stand-in/scripts/browser-flow.mjs`、`web-stand-in/scripts/job-store.mjs`。

证据：[compose.receipt.json](../.test-output/full-video-acceptance-20261001/compose.receipt.json)、[submit.receipt.json](../.test-output/full-video-acceptance-20261001/submit.receipt.json)、[bind.receipt.json](../.test-output/full-video-acceptance-20261001/bind.receipt.json)、[collect.receipt.json](../.test-output/full-video-acceptance-20261001/collect.receipt.json)、[clipboard-regression.json](../.test-output/full-video-acceptance-20261001/clipboard-regression.json)、[web-comparison/answer.receipt.json](../.test-output/full-video-acceptance-20261001/web-comparison/answer.receipt.json)、[web-completed.png](../.test-output/full-video-acceptance-20261001/web-completed.png)。

### V09 精简回传、核验与实际采纳

执行目标：精简当前job回答，独立复算评分，按7项质量门槛核验并落实到真实本地文件；未知条件不得采纳。

结果：486 Unicode字符摘要绑定原文；质量7/7；两份交付物真实hash绑定adopted；unknown实际采纳尝试被拒绝；新增拒绝结果保留与防覆盖测试通过。

边界：独立算术oracle和本聊天语义复核，不宣称额外独立Agent审查；模拟报告产品故障仅为计划，未执行。

实现/流程位置：`web-stand-in/scripts/workflow.mjs`。

证据：[web-comparison/brief.receipt.json](../.test-output/full-video-acceptance-20261001/web-comparison/brief.receipt.json)、[comparison-oracle.json](../.test-output/full-video-acceptance-20261001/comparison-oracle.json)、[comparison-quality.json](../.test-output/full-video-acceptance-20261001/comparison-quality.json)、[review-unknown-result.json](../.test-output/full-video-acceptance-20261001/review-unknown-result.json)、[adoption.receipt.json](../.test-output/full-video-acceptance-20261001/adoption.receipt.json)、[decision.json](../.test-output/full-video-acceptance-20261001/decision.json)、[decision.md](../.test-output/full-video-acceptance-20261001/decision.md)、[node-tests-final.log](../.test-output/full-video-acceptance-20261001/node-tests-final.log)。

### V10 中断、未知发送、登录或站点验证恢复

执行目标：再次收取同一completed job，检查答案哈希及发送次数；隔离测试覆盖发送未知、重绑、验证、超时、保存冲突。

结果：当前completed直接复用本地完整结果，不访问网页生成，不重复发送；所有本地可靠性负例通过。

边界：真实浏览器重启、登录失效、CAPTCHA、保存中断没有在本轮故意制造；这些宿主分支NOT-RUN。

实现/流程位置：`web-stand-in/scripts/browser-flow.mjs`、`web-stand-in/scripts/job-store.mjs`。

证据：[completed-reuse.receipt.json](../.test-output/full-video-acceptance-20261001/completed-reuse.receipt.json)、[web-comparison/events.jsonl](../.test-output/full-video-acceptance-20261001/web-comparison/events.jsonl)、[regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json)、[node-tests-final.log](../.test-output/full-video-acceptance-20261001/node-tests-final.log)。

### V11 暂缓、静默与提醒去重

执行目标：在独立fixture验收continue、同回合重复、节点defer、mute/resume和阶段去重，保持live状态不变。

结果：本轮执行的77项Python中相关断言全部通过；重复回应不延长冷却、指定节点和静默边界被验证。

边界：没有伪造本聊天用户暂缓/静默指令；真实用户回应+宿主链路NOT-RUN。

实现/流程位置：`project-handoff/scripts/compaction_reminder.py`。

证据：[regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json)、[python-tests.log](../.test-output/full-video-acceptance-20261001/python-tests.log)、[native-hook-observation.json](../.test-output/full-video-acceptance-20261001/native-hook-observation.json)。

### V12 简单任务与本地执行保留本地

执行目标：本地计算3+5，核对16场景/32prompt，再验证较重任务preference=local优先。

结果：三个route均local；实际结果8、16场景完整、本地样本成果存在；负例目录未生成web job。

边界：是本综合任务内的本地验收步骤，未另建用户聊天；其他正例web任务不属于这些负例。

实现/流程位置：`web-stand-in/scripts/workflow.mjs`。

证据：[local-routing/result.json](../.test-output/full-video-acceptance-20261001/local-routing/result.json)、[local-routing/simple-route.json](../.test-output/full-video-acceptance-20261001/local-routing/simple-route.json)、[local-routing/local-files-route.json](../.test-output/full-video-acceptance-20261001/local-routing/local-files-route.json)、[local-routing/user-local-route.json](../.test-output/full-video-acceptance-20261001/local-routing/user-local-route.json)、[local-direct-answer.md](../.test-output/full-video-acceptance-20261001/local-direct-answer.md)。

### V13 Worktree 隔离、集成与验证

执行目标：D盘独立Git仓库建立两个Worktree，分别实现CSV转义规则和审计规则，核对后集成。

结果：两个checkout改动互不污染；基线、各自diff/commit与审查记录存在；两次真实merge后两产物均通过读取断言。

边界：无额外Agent，不测并行Agent性能或自动Worktree管理；未合并/修改其他业务仓库。

实现/流程位置：`AGENTS.md`、`Git native worktree/merge`。

证据：[worktree-result.json](../.test-output/full-video-acceptance-20261001/worktree-result.json)。

### V14 token、耗时与质量对照

执行目标：同一模拟输入先本地分析，再网页分流；按固定质量标准、真实Codex快照和不重叠阶段记录用量与耗时。

结果：本地与网页质量均7/7；有可重算真实用量；本样本网页侧Codex操作用量更高；没有证据支持必然节省。

边界：模型/上下文/协议包装/观察次数不相等；单次顺序样本，不是可比因果效果对照；网页token/费用null，savingsClaim=null。

实现/流程位置：`scripts/measure_usage.py`、`tests/test_usage.py`。

证据：[measurement-plan.json](../.test-output/full-video-acceptance-20261001/measurement-plan.json)、[measurement-result.json](../.test-output/full-video-acceptance-20261001/measurement-result.json)、[usage-local-before.json](../.test-output/full-video-acceptance-20261001/usage-local-before.json)、[usage-local-after.json](../.test-output/full-video-acceptance-20261001/usage-local-after.json)、[usage-local-delta.json](../.test-output/full-video-acceptance-20261001/usage-local-delta.json)、[usage-web-before.json](../.test-output/full-video-acceptance-20261001/usage-web-before.json)、[usage-web-part1-after.json](../.test-output/full-video-acceptance-20261001/usage-web-part1-after.json)、[usage-web-part1-delta.json](../.test-output/full-video-acceptance-20261001/usage-web-part1-delta.json)、[usage-web-part2-before.json](../.test-output/full-video-acceptance-20261001/usage-web-part2-before.json)、[usage-web-part2-after.json](../.test-output/full-video-acceptance-20261001/usage-web-part2-after.json)、[usage-web-part2-delta.json](../.test-output/full-video-acceptance-20261001/usage-web-part2-delta.json)、[comparison-quality.json](../.test-output/full-video-acceptance-20261001/comparison-quality.json)。

### V15 已有 Goal 的接续边界

执行目标：用get_goal核对已有Goal、目标及预算；没有Goal时保持普通任务。

结果：接手及继续阶段get_goal均为null；未创建Goal或传入预算。

边界：不能据此证明有活动Goal的跨聊天精确预算恢复；该分支N/A。

实现/流程位置：`project-handoff/references/handoff.md`、`web-stand-in/SKILL.md`。

证据：[receiver-baseline.json](../.test-output/full-video-acceptance-20261001/receiver-baseline.json)。

### V16 自己的业务一体化工作 prompt

执行目标：从原视频需求建立16场景矩阵，执行正式接续、普通任务选路、真实Chrome收发、摘要核验、本地采纳与回归，交付prompt和结果。

结果：本轮主线产物与真实回执齐全；32prompt、16完整替换示例、结果JSON和报告交付。

边界：V02/V03/V14仍未满足本轮真实条件；本项PASS仅指综合主线与交付，不能推导全视频所有宿主/效果PASS。

实现/流程位置：`AGENTS.md`、`project-handoff/SKILL.md`、`web-stand-in/SKILL.md`。

证据：[receiver-first-artifact.receipt.json](../.test-output/full-video-acceptance-20261001/receiver-first-artifact.receipt.json)、[route.json](../.test-output/full-video-acceptance-20261001/route.json)、[adoption.receipt.json](../.test-output/full-video-acceptance-20261001/adoption.receipt.json)、[decision.json](../.test-output/full-video-acceptance-20261001/decision.json)、[regression-map.json](../.test-output/full-video-acceptance-20261001/regression-map.json)。

## 用量、耗时与质量

同一公开模拟输入先由本地 Codex 独立分析，然后只把原任务发往网页。两者7项质量标准均通过；全部合格方案两组评分由独立算术脚本复算，推荐均为 J，备选 B。

| 观察值 | 本地直接样本 | 网页分流样本 |
|---|---:|---:|
| input_tokens | 242,467 | 3,437,288 |
| cached_input_tokens | 228,608 | 3,413,376 |
| output_tokens | 3,700 | 8,752 |
| reasoning_output_tokens | 470 | 2,041 |
| total_tokens | 246,167 | 3,446,040 |

本地模型来自本聊天指定 transcript：`gpt-6.1-sol / high`；网页只确认当前选中 UI 标签 `Pro`。本地快照窗口 125.029 秒；网页两个不重叠快照窗口合计 572.062 秒；发送至本地收取 572.005 秒，这是生成时间的上界，包含其他本地验收期间的后台生成与后续发现延迟。

**这些观察值不是可比效果对照，不能计算分流节省率。** 网页样本的Codex操作用量更高；不同模型/上下文、协议包装、观察次数及调试/等待方式均是混杂因素。输入含反复发送的当前较长上下文；缓存输入是输入子集，推理输出是输出子集，不再相加。网页token和费用保持null，没有价格或总费用结论。V14效果仍为NOT-RUN；测量文件可重算。

## 回归与本轮修改

Python **77项通过**，新增拒绝采纳边界后 Node **28项通过**，共 **105项**，失败0。新增测试证明：rejected可保留fail/unknown，重复相同记录可复用，不能静默改成adopted覆盖历史。其余功能未发现需要改核心实现的缺口。

保留了原有全部dirty worktree及失败/限制观测。新增输出均在D盘；未安装依赖、改全局配置/信任、创建额外Codex聊天/Agent/automation、提交或推送。Worktree验收只修改独立Git夹具。远端CI未运行。

## 尚需真实条件的项目

- V02：在同一session自然累计3次自动压缩，并观察完整评估与Stop链路。当前本聊天状态未出现，计数unknown；不灌内容、不改阈值。
- V03：当前session可核实的原生Hook身份/prepare/Stop及信任状态。旧聊天真实Stop重新核验匹配，单列历史证据。未通过修改配置或合成事件制造本轮通过。
- V14：具备可比模型、上下文、输出要求及独立样本的效果对照。本轮测量已完成，节省结论未建立。
- V10真实登录/验证/重启故障和V11真实用户回应：本轮仅做对应隔离回归，不宣称这些宿主分支已发生或通过。

这些条件缺失不阻止本轮已授权资料、prompt与实际可执行功能的验收交付；也不把未验证项目改为PASS。
