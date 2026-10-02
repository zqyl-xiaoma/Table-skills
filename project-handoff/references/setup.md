# 安装与验证

本 Skill 可独立执行保存和恢复；Python Hook 是可选的提醒增强。命令模板需要 Python 3.11 或更新版本；Windows 使用 PowerShell 7。安装时保留整个 `project-handoff` 目录。

## 直接使用

未安装到自动发现目录时，直接给 Codex 完整文件路径，例如：

```text
使用 D:\table-skills\project-handoff\SKILL.md 保存当前项目进度，只保存，不新建聊天。
```

自动发现使用项目 `.agents/skills/` 或宿主已支持的个人 Skill 目录，可使用指向 D 盘技能目录的目录链接。不要把全局启用覆盖到不相关项目，也不要把 clone 当成安装。新安装后通常下一回合可发现；未出现时刷新会话或重启客户端。

完整接续只在当前宿主实际有聊天工具时使用；CLI/IDE 可以先交付文件和开场白。需要 Goal 接续时读 `handoff.md` 中的 Goal 段落。

## 只读诊断

在本机实际目录运行以下命令；已有 Python 可继续使用，不因路径位于 C 盘而迁移它。状态目录独立于 CODEX_HOME，可明确指定 D 盘。

```powershell
python -B -X utf8 D:\table-skills\project-handoff\scripts\setup.py doctor --state-dir D:\CodexData\project-handoff --hooks-file D:\table-skills\.codex\hooks.json
```

`doctor` 检查文件、Python 语法、CLI 版本、PowerShell、用户 Hook 策略及状态目录的现有父目录，不创建目录、不运行 Hook、不读取聊天正文。`--capabilities` 可以指定当前宿主工具名 JSON 数组；未知能力不能按可用报告。`manual_files_ready`、`hook_prerequisites_ready` 不代表宿主信任或真实事件验收通过。项目层和管理员策略仍可能额外限制 Hook。

## 生成配置预览

```powershell
python -B -X utf8 D:\table-skills\project-handoff\scripts\setup.py prepare --state-dir D:\CodexData\project-handoff --hooks-file D:\table-skills\.codex\hooks.json --output D:\CodexData\project-handoff-setup-v1
```

预览包含 `hooks.proposed.json`、`plan.json`，已有用户 Hook 时还有原字节备份 `hooks.original.json`。指定目录须不存在。脚本只写预览目录，不合并活动配置、不代用户信任 Hook；路径按 PowerShell 和 POSIX shell 分别转义。`--interval 3` 配置新 session 的评估间隔，已有 session 的计数及间隔保持原值。

以上命令选择 D 盘项目配置；省略 `--hooks-file` 时目标为 `CODEX_HOME/hooks.json`，影响范围更广。项目 Hook 还要求项目配置层受信任。多个配置层的 Hook 会累加运行，启用前检查用户配置、项目配置及插件是否已安装同一计数器，避免重复计数。`doctor` 只报告用户层开关，不代替宿主的最终策略判断。

审阅四个命令 Hook 的目标路径和状态目录；已知旧版 `compaction_reminder.py` 条目不相同时，脚本拒绝重复安装，先确认迁移内容。只在用户已批准配置修改时进行合并：校验目标仍符合 plan 中的存在状态及 SHA-256、候选文件符合 proposed_sha256，保留原配置后写入。发生并发修改须重新准备，不能覆盖。

使用 Codex 的 `/hooks` 或桌面 Hooks 设置审阅并信任当前定义。不得使用绕过信任参数、伪造信任记录或修改其他 Hook。官方说明：[Hook 信任](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)。

## 验证层次

1. 运行 `python -B -X utf8 -m unittest discover -s tests -v`，保存退出码及失败信息。Windows 命令测试需实际 PowerShell 7；其他系统的 skip 必须明确记录。
2. 宿主中验证 SessionStart、UserPromptSubmit 的状态注入，确认 session_id、turn_id、state_dir 与实际事件一致。
3. 自然发生自动压缩后核对计数；手动 `/compact` 只验证 compact 生命周期，不计入自动压缩。不要为验收降低用户的压缩阈值或把模拟事件记为真实压缩。
4. 在已有授权的演示任务中验证 prepare、最终正文、Stop 回执、静默、恢复和打断。若需要新建聊天做接续验收，先获得该新建行为的授权；不能把子 Agent 测试冒充桌面跨聊天验收。

未启用 Hook 时仍可使用保存、恢复和人工核验；明确说明自动提醒尚未启用。工作内容“已保存”、Hook“已配置”、宿主“已信任”、接续“已执行”分别报告。

开始有计数状态后，`hook_observations` 保留每类最近一次回调的时间、turn_id、计数和触发类型；Stop 另存最终文本 SHA-256、是否补漏及是否核验了建议。它不保存完整聊天内容，也不是宿主签名证明。验收时将其与实际宿主消息和本任务 transcript 的事件对应；不要把测试夹具或手工调用脚本的记录当成真实回调。旧计数保持不变，不补造安装前的事件。

## 回退

先在宿主禁用本 Skill 对应的四项 Hook。恢复旧配置前比较当前文件与本次候选的 SHA-256：完全相同时可恢复原字节备份；原配置不存在时仅移除本次新增条目。当前配置被其他工具改动时只移除本项目条目，不覆盖其他 Hook。

保留状态目录及失败证据，回退代码前核对状态字段兼容性，不覆盖真实计数。撤销自动发现时仅移除指向本 Skill 的目录链接，不删除目标目录或其他技能。
