# 🧰 Table Skills

[抖音 · 一只桌子](https://v.douyin.com/7jbgafVeA4U/) · [YouTube · 一只桌子](https://www.youtube.com/@%E4%B8%80%E5%8F%AA%E6%A1%8C%E5%AD%90) · [小红书 · 一只桌桌桌子](https://xhslink.cn/o/2iZQ3Yc2j4E) · [bilibili · 一只桌子_table](https://b23.tv/7Y34qaP) · [X · 一只桌子](https://x.com/D_uoduo)

整理日常使用中的 AI 技能与实验思路，按实际效果持续调整。本地 fork 维护「项目交接」，并恢复「网页替身」的自动发送、等待和原文收取。

本优化版由 [@zqyl-xiaoma](https://github.com/zqyl-xiaoma) 维护，仓库为 [zqyl-xiaoma/Table-skills](https://github.com/zqyl-xiaoma/Table-skills)，fork 自 [duoduoler-ops/Table-skills](https://github.com/duoduoler-ops/Table-skills)。原作者及许可证声明保留。

当前主要面向 **Windows 上的 Codex 桌面端**。安装 Skill 不会自动提供宿主缺失的工具、接口或 Hook 权限。

https://github.com/user-attachments/assets/94c0a4d6-0bee-405e-9fe9-dc398cb7faa0

## 📋 目录

| 技能 | 一句话 | 使用入口 |
|---|---|---|
| 🔄 [project-handoff（项目交接）](project-handoff/) | 保存有效进度和决定，让下一次对话能接着做 | [SKILL.md](project-handoff/SKILL.md) |
| 🌐 [web-stand-in（网页替身）](web-stand-in/) | 通过已登录的 ChatGPT 自动完成独立任务并保存完整回答 | [SKILL.md](web-stand-in/SKILL.md) |

## 📦 安装方式

本地优化版的使用与诊断见 [安装与验证](project-handoff/references/setup.md)。保留整个 `project-handoff` 文件夹；只复制 `SKILL.md` 会缺少脚本和附页。

在本机任意项目聊天中，可以直接使用完整路径：

```text
使用 D:\table-skills\project-handoff\SKILL.md 保存当前项目进度，只保存，不新建聊天。
```

要从 GitHub 安装此优化版，可以把技能链接发给支持安装 Skills 的 Agent，例如：

```text
帮我安装项目交接技能：https://github.com/zqyl-xiaoma/Table-skills/tree/main/project-handoff
```

让 Agent 先检查当前宿主是否具备所需工具，再安装到对应的 Skills 目录。网页替身入口为 [web-stand-in/SKILL.md](https://github.com/zqyl-xiaoma/Table-skills/blob/main/web-stand-in/SKILL.md)。上游原版仍在 [duoduoler-ops/Table-skills](https://github.com/duoduoler-ops/Table-skills)，优化版修改由本 fork 独立维护。

网页替身保留整个 `web-stand-in` 文件夹即可使用。当前仓库的 `.agents/skills/web-stand-in` 本地入口指向该目录；也可以直接引用下面的绝对路径，无需把文件安装到 C 盘。

```text
使用 D:\table-skills\web-stand-in\SKILL.md，通过已连接的 Chrome 完成下面的独立任务，自动等待并把完整回答保存到当前项目：……
```

`origin` 指向你的 GitHub fork，`upstream` 指向原仓库；`main` 为优化版默认分支。后续修改可以建立 `codex/` 分支，验证后合并到 `main` 并推送。同步上游时先 `git fetch upstream`，审查差异后再合并，不覆盖本地优化。

本机 `PROJECT_STATE.md`、`.test-output/`、`.web-stand-in/` 和活动 Hook 配置保留在本地并由 `.gitignore` 排除；公开验收报告引用的运行证据仅在原本机目录可用。

## 🔄 project-handoff（项目交接）

长任务换对话时，最容易丢失的是定稿位置、已经否决的方案、真实进度和下一步。项目交接只整理影响接续的信息，让接手对话先核对，再继续。

**主要功能**

- 保存目标、有效决定、关键文件、真实进度和下一步，避免整段复制聊天记录。
- 有 Goal 时记录真实状态和可查询的预算；接续前核实旧 Goal、后台进程和其他修改者的运行状态。
- 只要求保存时，交付材料和可复制的开场白。
- 明确批准新建并继续后，在宿主能力允许时完成保存、新建、核对和接续。
- 在压缩检查点、实质阶段切换或已核实的上下文混淆时评估是否交接；暂不提醒时记录原因和下次检查时机。
- 需要提醒时，把建议放在最终答复正文最前；可选 Hook 核验最终文本后才计为正式提醒，并检查漏评估或漏展示。

**怎么用**

```text
用项目交接保存当前进度，先不要新建任务。

整理交接材料，在同一项目目录新建任务并继续下一步。

读取这个项目的 PROJECT_STATE.md，核对后继续未完成工作。

本任务不再主动提醒交接。
```

**提醒与授权**：默认每 3 次自动压缩进入评估，可配置间隔。首次提醒也需要安全位置、明确后续和具体切换收益；之后还需满足新阶段与冷却条件。普通“继续”不等于同意新建任务；提醒不会自动执行交接。

**可选 Hook**：仅在 Windows Codex 上验证。模板中 `commandWindows` 供 Windows 使用（Codex 通过 PowerShell 执行，需以 `&` 调用），`command` 供其他系统使用。安装 Skill 不等于启用 Hook；配置前需替换示例路径、合并已有配置，并完成宿主原生信任。见 [计数器说明](project-handoff/references/compaction-reminder.md) 和 [Hook 模板](project-handoff/hooks/codex-hooks.example.json)。

使用 `scripts/setup.py doctor` 只读检查环境，使用 `prepare` 生成带 SHA-256 的配置预览及已有 Hook 的备份。可通过 `--hooks-file D:\table-skills\.codex\hooks.json` 选择当前项目，避免全局启用；脚本不会自动修改活动配置或信任 Hook。运行环境为 Python 3.11+，Windows 命令需要 PowerShell 7。

**验证**：在仓库根目录运行 `python -B -X utf8 -m unittest discover -s tests -v`。测试覆盖状态并发写入、过期回应、损坏状态、最终正文、冷却与去重、路径转义和配置预览；CI 配置包含 Windows、Linux、macOS 及 Python 3.11/3.14。CI 配置存在不代表各平台已经通过，真实宿主事件和跨聊天接续需分别验证。

Hook 能检查压缩节点和记录是否缺失，不能独立判断所有业务阶段，也不能证明用户已经看到提醒。没有真实压缩事件时不猜次数；没有接续工具时提供手动入口。

## 🌐 web-stand-in（网页替身）

![Codex 快速聊天入口](docs/images/web-stand-in-quick-chat.png)

![快速聊天添加到 Codex](docs/images/web-stand-in-add-to-codex.png)

**自动流程**：准备独立任务 → 在已登录的普通 Chat 中发送一次 → 绑定实际对话 → 自动等待完整回答 → 用回答的 Copy 保存原始 Markdown 和 SHA-256 回执。回答表格、代码块和特殊字符保留原样；中断后从同一 `job.json` 恢复，避免重复提交。

**如何调用**：项目默认主动判断较重、可独立完成且资料允许发送的研究/比较/长文分析，不必每次点名 Skill；也可以明确要求“使用网页替身自动完成并收取”。原文留在项目，最多 2000 字符的精简结论带回主任务，核验后记录实际采纳的交付物。在 Goal 中也可作为一步使用；收到并核验回答后继续原 Goal。登录或站点验证需要用户处理时，保留任务并报告阻塞。详见 [分流与结果采纳](web-stand-in/references/task-routing.md)。

**运行要求**：Node.js 22+，以及宿主提供的 `cua_repl` 浏览器工具和 clipboard 接口；用户指定 Chrome 时使用已连接的 Chrome。脚本只管理本地文件，不安装浏览器 driver，不读取 Cookie 或调用私有 ChatGPT API。支持文本与 Markdown；附件和图片不属于这条复制流程。详见 [执行与恢复](web-stand-in/references/browser-runtime.md)。

**验证**：`node --test tests/test_web_stand_in.mjs tests/test_web_workflow.mjs` 覆盖防重复发送、并发竞争、断点保存、完整性校验、剪贴板恢复、分流与采纳。2026-10-01 已通过普通任务自动分流、Chrome 真实收发、摘要回传与交付物采纳验收，也完成了新聊天接续和原生 Stop 提醒核验。详见 [视频功能覆盖与本地验收](docs/video-coverage.md)。内置浏览器早期遇到 `cloudflare_challenge`，失败证据保留；CI 配置存在不代表远端 CI 已运行。

2026-10-01 接续会话的[16 场景验收结果](docs/acceptance-results.md)及[逐场景 prompt 与业务替换示例](docs/acceptance-prompts.md)已交付。本轮回归为 Python 77 项、Node 28 项；新 Chrome 案例收取 7,970 字节原文、486 字符摘要并完成本地采纳。当前会话的原生 Hook 状态尚未观察到，3 次自然压缩完整周期与可比成本效果仍未验证；旧会话的真实 Stop 证据单独记录。

用量脚本 `scripts/measure_usage.py` 可从明确指定的本任务 transcript 记录实际 Codex token 增量，区分缓存输入与推理输出；没有网页 token 和可比基线时不声称节省总 token 或费用。其他方案见 [思路与设计框架](web-stand-in/思路.md)。

## 项目目录与并行工作

[AGENTS.md](AGENTS.md) 固定本项目的分流、交接与修改者约定。普通顺序工作留在原目录；用户授权并行开发、不同任务要修改同一仓库时，先检查现有 worktree，按实际基线创建隔离工作区。每个工作区记录负责人、任务范围和验收方法；集成前审查 diff 和冲突，集成后运行相关测试。worktree 由宿主/Git 提供，Skill 不会因研究分流自动克隆仓库或开启并行写入者。

## 🛠️ 反馈

报告问题时，请说明宿主、系统、出问题的步骤和脱敏后的报错。不要公开账号信息、密钥或私人聊天全文。

功能跑通、自动触发、上下文隔离和实际省 token 是不同的验证项；未覆盖的环境与组合需要单独测试。

## 📄 许可证

本仓库采用 [MIT License](LICENSE)，允许复制、修改、商用和再发布，须保留版权和许可证声明。

## 📬 联系我

欢迎交流实际使用中的问题与改进建议。

| 渠道 | 联系方式 |
|---|---|
| 邮箱 | [duoduoler@gmail.com](mailto:duoduoler@gmail.com) |
| X | [一只桌子 · @D_uoduo](https://x.com/D_uoduo) |

Made by [@duoduoler-ops](https://github.com/duoduoler-ops)
