# 视频功能覆盖与本地验收

对照视频：[AI Agent 越用越乱？先把工作边界划清](https://www.douyin.com/video/7685681479640272180)。本记录日期为 2026-10-01，运行环境为 Windows Codex 桌面端和已连接的 Chrome。原视频的项目、Remotion 等为示例，不代表此仓库需要复制相同业务应用。

## 功能与证据

| 视频内容 | 本项目实现 | 本次验证 |
|---|---|---|
| 固定项目目录、规则与工具 | 仓库、AGENTS.md、两个可发现的 Skill；任务状态和证据单独保存 | 已落地；没有修改全局 Memory 或安装到 C 盘 |
| 适时提醒交接 | 真实 PostCompact 计数、阶段评估、最终正文核验、冷却与去重 | 源聊天自然自动压缩 1 次并收到状态注入；另一个真实聊天的阶段提醒经原生 Stop 核验，最终文本 SHA-256 与 transcript 一致 |
| 确认后新建并继续 | 保存 → 新建聊天 → 只读核验 → 转移目录修改权 → 派发继续 → 核验实际成果 | 完整通过；首次发现 LF/CRLF 文件哈希差异后停在核验，修正后复用同一聊天接续；实际生成 decision.json 和 decision.md |
| 独立任务自动选择网页 | Skill 隐式触发及项目默认选择规则，route 记录任务依据 | 普通方案比较指令未点名网页 Skill，接手聊天主动选择 web-stand-in |
| 网页自动收发 | 浏览器填写、仅一次发送、绑定原对话、自动等待、Copy 收取 | Chrome Pro 实测完成；sendAttempts=1，完整原文 10,788 字节 |
| 精简回传并接回主任务 | 最多 2000 Unicode 字符的摘要、原文哈希绑定、必要条件核验、采纳文件回执 | 摘要 488 字符；核验 8 个候选和修正记录，推荐 A、评分 22；采纳绑定两份实际交付物 |
| 并行修改用 Worktree 隔离后合并 | AGENTS.md 的修改者/隔离/集成约定，使用宿主与 Git 原生能力 | 独立 Git 夹具的两个 worktree 修改互不影响，两个分支合并后结果均在；没有使用额外 subagent |
| 减少 Codex 上下文与 token 消耗 | 主上下文默认只取摘要；从指定 transcript 记录真实用量 | 用量采集已验证；总 token 或费用节省尚未建立可比对照，不能宣称已证实 |

核心流程已经实现并有真实运行证据。**默认累计 3 次自然压缩后触发评估的完整长期周期尚未在同一会话实测**：本次自然压缩证据和阶段提醒 Stop 证据是两项不同验证，没有手工补造压缩事件。计数、到期评估、最终展示、重试上限和去重另有本地回归覆盖。

## 从真实使用修复的问题

- Skill 通过 Junction 安装后，CLI 入口判断改用真实文件路径，避免命令无输出却以 0 退出。
- ChatGPT 将一次性长文本粘贴转为附件：compose 改为按 Unicode 字符分段填写，最终验证完整文本。真实复验 13,840 字符一致、没有附件；草稿清空且发送次数为 0。
- Copy 点击返回早于剪贴板更新：直接、有界地观察剪贴板变化，保留旧剪贴板；超时保持 pending，不保存 sentinel。新版真实 Copy 的原文哈希与既有结果完全一致。
- Hook 保留有界事件元数据和最终文本哈希，便于核对真实交付；不记录完整 prompt 或最终聊天正文。

## 验收位置与范围

本机证据保存在 `D:/table-skills/.test-output/video-completion-20261001/`，不加入 Git：

- `acceptance.json`：综合结果、功能边界和证据索引。
- `real-compaction-evidence.json`、`real-stop-evidence.json`：真实宿主事件核对。
- `create-thread.receipt.json`、`readonly-check-2.receipt.json`、`continue-dispatch.receipt.json`、`receiver-completed.receipt.json`：跨聊天接续。
- `source-verification.json`、`handoff-demo/web-comparison/`：网页收取、488 字符摘要和实际采纳。
- `handoff-demo/compose-retest.json`、`copy-retest.json`：最终浏览器代码复验。
- `worktree-smoke/result.json`：原生 Git 隔离及合并。
- `usage-receiver-delta.json`：接续研究阶段真实 Codex 用量。此次包含流程调试，不能作为稳定运行成本或省 token 对照。网页 token 与费用仍为未知。

本地回归：Python **77 项**、Node **27 项**，全部通过；两个 Skill 的格式检查通过。CI 配置覆盖其他系统，但本次未运行远端 CI。

```powershell
python -B -X utf8 -m unittest discover -s tests -v
node --test tests/test_web_stand_in.mjs tests/test_web_workflow.mjs
```
