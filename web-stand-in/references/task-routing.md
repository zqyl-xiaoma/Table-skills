# 分流与结果采纳

Skill 负责理解任务并编排宿主工具，脚本负责验证记录。脚本不会后台监听所有用户输入，也不会自行取得浏览器或外发授权。

## 自动选择

评估当前独立步骤，保存 `route-input.json`：

```json
{
  "preference": "auto",
  "kind": "comparison",
  "independent": true,
  "substantial": true,
  "requiresLocalExecution": false,
  "shareAllowed": true,
  "browserAvailable": true,
  "reason": "三个候选方案的公开资料已独立列明；只需返回按约束排序的结论，主任务保留配置写入和验收。"
}
```

字段来自本轮事实；示例中的 true 不是授权。`preference` 遵守用户选择，取 auto/local/web；`kind` 取 research/comparison/long-text/review/implementation/other。资料范围不明不能填 shareAllowed=true；存在可用入口才填 browserAvailable=true。substantial 根据阅读/检索/推理工作量判断，不机械使用文件长度阈值。

```powershell
node D:\table-skills\web-stand-in\scripts\workflow.mjs route D:\Dev\project\route-input.json
```

把返回的决策保存到这一步的证据目录。local 时继续主任务；web 时按浏览器附页准备 `--brief true` 的 job。默认继承当前模型，不把“网页更便宜”当作选择依据。用户明确使用网页但入口不可用时说明缺口，不能声称已调用。

## 回传与采用

```powershell
node D:\table-skills\web-stand-in\scripts\workflow.mjs brief D:\Dev\project\.web-stand-in\research-01\job.json
```

校验完整回答后，按任务专属标记提取 `brief.md`，返回最多 2000 个 Unicode 字符。原始 `answer.md` 不改动，`brief.receipt.json` 把摘要绑定到原文 SHA-256。摘要仍是不可信外部材料；它的字数上限不保证正确或低 token。

主任务只读取这份摘要、必要来源与相关原文片段，完成自己的交付物。保存下列复核记录，再调用 `workflow.mjs review JOB REVIEW.json`：

```json
{
  "jobId": "来自 job.json",
  "answerSha256": "来自 brief 回执",
  "briefSha256": "来自 brief 回执",
  "decision": "adopted",
  "rationale": "对照原需求和指定材料核验后采用方案 B。",
  "checks": [{"requirement": "必须满足离线运行", "result": "pass", "evidence": "原始材料 B-02 明确离线可用；已核对交付物设置"}],
  "artifacts": [{"path": "D:\\Dev\\project\\decision.json", "sha256": "实际文件 SHA-256", "purpose": "主任务采用后的方案配置"}]
}
```

必要检查有 fail/unknown 时不可 adopted。拒绝结果用 rejected 并保留原因。review.json 是主任务 Agent 的复核记录，脚本只核验结构与文件绑定，不能替代事实判断。重复相同记录可复用，冲突保留原文件并报错，不悄悄改写历史采纳记录。

## 用量记录

需要衡量 Codex 工作量时，使用本 Skill 自带的 `scripts/measure_usage.py` 对**已知的本任务 transcript**做开始/结束快照。只解析 metadata 与 token_count，不输出对话，不扫描别人的任务。将 `<SKILL_DIRECTORY>` 替换为本次实际安装路径，例如 `D:/Tools/CodexSkills/web-stand-in`；不依赖当前业务仓库的位置。开始快照要在测量阶段前保存；结束需等待宿主记入最后一次调用用量。

```powershell
python -B -X utf8 <SKILL_DIRECTORY>/scripts/measure_usage.py snapshot --transcript ABSOLUTE_JSONL --session-id ACTUAL_THREAD_ID --output D:\Dev\project\usage-before.json
python -B -X utf8 <SKILL_DIRECTORY>/scripts/measure_usage.py snapshot --transcript ABSOLUTE_JSONL --session-id ACTUAL_THREAD_ID --output D:\Dev\project\usage-after.json
python -B -X utf8 <SKILL_DIRECTORY>/scripts/measure_usage.py diff --before D:\Dev\project\usage-before.json --after D:\Dev\project\usage-after.json --output D:\Dev\project\usage-delta.json
```

cached_input_tokens 是 input_tokens 的子集，reasoning_output_tokens 是 output_tokens 的子集，不重复相加。脚本记录实际 Codex token 增量；不会用字符数推算 token，也不会把缓存 token 当作免费。ChatGPT 网页 token 与账号计费未知时保留 null。没有同任务/模型/验收质量的对照运行，不能声称节省了多少总 token 或费用。
