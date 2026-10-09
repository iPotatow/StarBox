<div align="center">

# StarBox

**把 GitHub Stars、Release、Fork 和 AI 整理成一个属于自己的开发者工作台。**

自托管在 Cloudflare Workers，数据保存在自己的 D1 中。

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

简体中文 · [繁體中文](README.zh-TW.md) · [English](README.en.md)

</div>

<p align="center">
  <img src="assets/readme/starbox-ui.jpg" width="100%" alt="StarBox — 自托管的 GitHub 开发者工作台" />
</p>

## StarBox 是什么

GitHub 的 Star 很适合收藏，但当仓库越来越多，真正麻烦的是后续：重新找到某个工具、知道它有没有发新版本、整理自己的备注和分类、检查 Fork 是否落后，以及把这些上下文交给 AI 使用。

StarBox 把这些事情放进同一个个人工作台。它面向希望长期维护自己 GitHub 收藏的开发者：界面和 API 运行在 Cloudflare Workers，账号数据存进 D1，浏览器使用 IndexedDB 做本地缓存；AI 是可选能力，不影响基础的收藏、Release 和 Fork 工作流。

## 为什么需要它

StarBox 不是另一个 GitHub 首页，而是 GitHub 之后的那一层个人工作流：**收藏之后继续整理，订阅之后继续阅读，Fork 之后继续维护。**

## 你会得到什么

- **把 Stars 变成可维护的收藏库** — 搜索、筛选、分类、备注、README 阅读，以及按需的 AI 摘要、标签和批量整理。
- **持续跟进项目变化** — 聚合订阅仓库的 Release、切换历史版本、推荐安装资源，并查看已有 Fork 与上游的领先 / 落后状态和 Actions 运行情况。
- **把自己的收藏接给 AI** — 原生支持 Cloudflare Workers AI，也支持 OpenAI Compatible、Anthropic Messages 和 Google Gemini 等 HTTP 服务；通过 MCP 可以让外部 AI 助手读取你的收藏上下文，并按连接权限修改备注、分类和标签。

## 快速开始

需要 Node.js、npm，以及可使用 **Workers + D1** 的 Cloudflare 账号。

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

首次部署后完成三件事：

1. 在 Cloudflare 为 `starbox` Worker 配置 **Custom Domain 或 Route**。仓库默认关闭 `workers.dev`。
2. 设置登录密码和凭据加密密钥：

   ```bash
   npx wrangler secret put LOGIN_PASSWORD
   npx wrangler secret put STARBOX_ENCRYPTION_KEY
   # 可选：默认用户名为 admin
   npx wrangler secret put LOGIN_USERNAME
   ```

3. 打开 StarBox，进入 **Settings** 连接 GitHub Token；需要 AI 时再添加模型服务。

`npm run deploy` 会检查或创建名为 `starbox` 的 D1 数据库，并自动处理受支持的初始化 / 升级路径，不需要手填数据库 UUID。升级已有实例前，请先备份 D1，并保留原来的 `STARBOX_ENCRYPTION_KEY`。

如果 Cloudflare 登录账号下有多个账号，可在部署前设置 `CLOUDFLARE_ACCOUNT_ID` 选择目标账号。

## AI：可选，但开箱即用

StarBox 已声明 Cloudflare `AI` binding。部署后在 **Settings → AI** 添加 **Cloudflare Workers AI** 即可使用仓库整理、批量整理和 Release 总结，不需要额外保存 AI API Key；也可以继续使用自定义 HTTP Provider。

Workers AI 的每日官方用量面板是可选增强，需要额外配置 Cloudflare Account Analytics 只读凭据。完整说明见 [WORKERS_AI.md](WORKERS_AI.md)。

## MCP：把收藏交给你的 AI 助手

StarBox 在 `/mcp` 提供 Streamable HTTP MCP 接口。每个连接使用独立 Bearer Token，默认只读，可单独开启收藏编辑权限。

支持的能力包括搜索收藏、读取仓库与 README、查询分类和 Release，以及在启用权限后修改备注、分类和标签。完整配置与工具列表见 [MCP.md](MCP.md)。

## 数据和安全

- **数据留在自己的 Cloudflare 账号**：业务数据存于 D1，IndexedDB 只承担浏览器缓存与本地加速。
- **敏感凭据加密保存**：GitHub Token、HTTP AI Key 和敏感自定义请求头由 Worker 加密后写入 D1，安全读取接口不返回明文。
- **写入有并发保护**：仓库用户字段使用版本校验避免覆盖较新的修改；MCP 编辑复用同一套 revision guard。

README 与 Release Markdown 支持 GFM，原始 HTML 不执行。

## 当前边界

- StarBox 可以维护已有 Fork，但当前不负责创建新的 Fork。
- `npm run dev` 是静态 UI 预览，`/api/*` 与 `/mcp` 会返回 501；完整 Worker 联调请使用 Wrangler 和本地 D1。
- MCP 当前要求客户端支持自定义 Bearer 请求头，不提供仅 OAuth 的连接方式。

## 开发与验证

```bash
npm ci
npm run dev
```

提交前运行完整检查：

```bash
npm run check
```

它会执行类型检查、自动化测试、生产构建和 UI source gates。生产部署后的数据库、登录和加密配置可以通过：

```bash
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

验证范围与边界见 [VERIFICATION.md](VERIFICATION.md)。

## 技术与文档

**React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 · Base UI**

UI primitives 采用 [COSS](https://github.com/cosscom/coss) 的 copy/paste-and-own 模式在仓库内维护，图标使用 [Phosphor Icons](https://phosphoricons.com/)。

- [Workers AI](WORKERS_AI.md) — 原生 AI binding、模型服务和官方额度统计。
- [MCP](MCP.md) — AI 助手连接、权限、工具和安全边界。
- [验证契约](VERIFICATION.md) — 自动化检查、CI 与生产验证范围。
- [第三方声明](THIRD_PARTY_NOTICES.md) — 依赖来源与许可证说明。

## 关于作者

由 [iPotatow](https://github.com/iPotatow) 维护。

## 许可证

当前仓库尚未包含 `LICENSE` 文件。请不要在许可证明确前假设拥有复制、修改或再分发授权。
