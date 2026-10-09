# Cloudflare Workers AI

StarBox 支持把 Cloudflare Workers AI 作为原生 AI 服务。仓库分析与 Release 总结直接调用 Worker 的 `AI` binding，不需要 OpenAI 兼容地址，也不需要额外保存 AI API Key。

## 启用 Workers AI

仓库已经在 `wrangler.jsonc` 声明：

```json
{
  "ai": { "binding": "AI" }
}
```

部署后进入 **Settings → AI → 添加模型服务**。新增服务默认选择 **Cloudflare Workers AI**、AI Gateway `default` 和一个 Cloudflare 模型。Workers AI 模型 ID 必须以 `@cf/` 开头。

Workers AI 继续复用 StarBox 现有模型注册表：一个服务可包含多个模型、可选择默认模型，仓库 AI 整理、批量 AI 整理和 Release 总结都使用同一套任务逻辑，不增加平行的 Workers AI 功能栈。

## 显示 Cloudflare 官方每日免费额度

StarBox 可以显示当前 Cloudflare 账号在本 UTC 日的官方 Workers AI 使用量。Worker 查询 Cloudflare GraphQL Analytics API 的 `aiInferenceAdaptiveGroups` 数据集，读取：

- `totalNeurons`
- `totalInputTokens`
- `totalOutputTokens`
- inference 次数

页面以每日 **10,000 Neurons** 免费分配为基准，同时保留账号级真实 `totalNeurons`：

- `freeUsedNeurons`：计入每日免费分配的部分，最多 10,000 Neurons。
- `remainingNeurons`：当日免费分配剩余量，最低为 0。
- `overageNeurons`：真实总用量超过 10,000 Neurons 的部分，不会被截断或隐藏。
- `usedNeurons`：Cloudflare Analytics 返回的账号级真实总用量。

统计范围是 **Cloudflare Account 级别**，因此同一账号下其他 Worker 产生的 Workers AI 用量也会计入。StarBox 仅使用 Analytics 数据，无法据此判断账号当前是 Workers Free 还是 Workers Paid：超过免费分配后，Paid 账号可继续产生按量费用，而 Free 账号达到限制后会停止推理。页面会明确显示这一边界，并显示下一次 `00:00 UTC` 重置时间。

额度统计是增强能力，不是 Workers AI 推理的前置条件。未配置 Analytics 凭据时，Workers AI 仍可正常使用。

如需启用官方额度面板，为部署后的 Worker 配置：

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

建议单独创建最小权限 Cloudflare API Token，只授予 StarBox 所在账号的 **Account → Account Analytics → Read**。不要为了额度展示复用权限过大的部署 Token。

如果变量缺失、账号不匹配或 Token 没有 Analytics 读取权限，Settings 会把额度统计显示为不可用，但不会因此阻止 Workers AI 推理。GraphQL 在 HTTP 200 中返回权限错误时也会被识别为权限不足，而不是普通网络故障。

## 存储与兼容性

Workers AI 不新增 D1 表，也不新增迁移。运行方式继续写入现有 `ai_services.config_json`：

```json
{
  "transport": "workers-ai",
  "gatewayId": "default"
}
```

模型仍保存在 `ai_models`，默认模型继续使用现有 binding。OpenAI Compatible、Anthropic Messages 与 Google Gemini 等 HTTP 服务继续沿用现有加密凭据流程。

## COSS UI 约束

Workers AI 服务卡片、额度面板、空状态和编辑交互全部复用 StarBox 已有的 COSS copy/paste-and-own primitives，包括 `CardFrame`、`Badge`、`Alert`、`Empty`、`Button`、`ResponsiveDialog`、`Select`、`Switch` 与 `Field`。本功能不引入第二套组件系统。
