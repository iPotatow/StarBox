# StarBox

简体中文 · [English](README.en.md)

> 一个可自托管的 GitHub 工作台：整理 Star 仓库，跟踪 Release 与 Fork，并发现值得关注的新项目。

StarBox 面向单个 GitHub 账号，由 React、Cloudflare Workers 和 D1 构成。把应用部署到自己的 Cloudflare 账号后，可以在多台设备上登录并同步账号业务数据。

## 主要功能

| 页面 | 用途 |
| --- | --- |
| **Star** | 搜索和整理已 Star 的仓库，使用分类、GitHub Lists、语言与排序筛选；订阅 Release，并查看仓库详情和 README。支持 AI 摘要、标签、分类及批量分析。 |
| **Release** | 同步已订阅仓库的 Release，以时间线或按仓库浏览；按版本范围、平台和文件类型筛选附件。 |
| **Fork** | 跟踪已有 Fork 与上游的领先/落后状态、最近一次 GitHub Actions 运行；同步上游或手动运行 Workflow。 |
| **Discover** | 通过 GitHub 搜索热门、活跃或新近的仓库，按语言、Topic 和时间范围筛选，并可直接 Star 仓库。 |
| **Settings** | 连接 GitHub 和可选的 AI 服务，管理分类、外观、导航、Release 规则，以及数据导入/导出。 |

StarBox 不提供 Gist 管理或创建 Fork 的功能。

## 实际运行界面

<p align="center">
  <img src="./assets/readme/starbox-ui.jpg" width="100%" alt="StarBox 实际运行中的 Star 页面，展示本地演示仓库数据。" />
</p>

截图来自本地运行的 StarBox Worker + D1 实例，使用演示仓库数据。

## 数据与凭据

- GitHub Token 由 Worker 使用 AES-256-GCM 加密后保存在 D1。AI API Key 和自定义请求头也由 Worker 加密保存在 D1。安全 API 和 Bootstrap 不返回这些凭据的明文。
- 业务设置、仓库分类与备注、Release 订阅和同步状态、Fork 状态等账号数据存放在 D1。
- 主题、界面密度、强调色、导航顺序和每页条数属于设备偏好；IndexedDB 是本地缓存，不是账号数据的权威来源。
- 登录使用安全 Cookie，并对登录尝试限流。写入请求会检查同源 Origin 与 JSON Content-Type。

## 部署到 Cloudflare

在仓库根目录安装依赖，并先登录将用于部署的 Cloudflare 账号。首次使用可运行 `npx wrangler login`；CI 环境可设置 Wrangler 支持的 `CLOUDFLARE_API_TOKEN`。然后执行：

   ```bash
   npm install
   npm run deploy
   ```

   `npm run deploy` 会先运行 `npm run check`。检查通过后，部署脚本会验证 Cloudflare 登录和账号，查找当前账号中名称**完全等于** `starbox` 的 D1 数据库；如果不存在就创建，再次查询以取得 Cloudflare 返回的真实 UUID。脚本会在仓库根目录生成临时 Wrangler 配置，使用 `DB` binding 将所有尚未应用的远程迁移先应用到该数据库，再使用同一份临时配置部署 Worker 和静态资源，最后删除临时文件。仓库中的 `wrangler.jsonc` 不需要填写数据库 UUID，也不会被部署脚本改写。如果 Wrangler 账号下有多个 Cloudflare 账号，请将 `CLOUDFLARE_ACCOUNT_ID` 设为目标账号 ID。

`workers_dev` 保持为 `false`。部署后需在 Cloudflare Worker 设置中配置自定义域名或 route 才能通过公开地址访问；配置 route 前，请先设置生产登录密码和加密密钥。可在 Cloudflare Dashboard 中配置，也可使用 `npx wrangler secret put <NAME>`；更新 Secret 会立即部署一个 Worker 版本。

| 变量 | 用途与默认值 |
| --- | --- |
| `LOGIN_USERNAME` | 登录用户名，默认 `admin`；生产环境建议改为自定义值。 |
| `LOGIN_PASSWORD` | 登录密码，默认 `000000`；生产环境必须设置为强密码。 |
| `SESSION_TTL_SECONDS` | Session 有效期，默认 `604800` 秒（7 天）。 |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | GitHub Token 的 AES-256 密钥，连接 GitHub 并保存凭据前必须配置，长度为 32 字节。 |
| `STARBOX_CREDENTIAL_ENCRYPTION_KEY` | AI 凭据的独立 AES-256 密钥，推荐单独配置；未配置时兼容使用 GitHub 密钥。 |

密钥轮换可配置相应的 `*_VERSION` 和 `*_PREVIOUS` 变量。不要把密钥写入仓库或 `wrangler.jsonc`。

完成部署、设置生产 Secret 并配置自定义域名或路由后，即可登录 StarBox，在 Settings 中连接 GitHub；如需 AI 分析，再配置 AI 服务。

参考：[D1 迁移命令](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Wrangler 部署](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## 本地开发与验证

```bash
npm install
npm run check
npm run dev
```

`npm run check` 包含类型检查、测试、构建和 5 个主要路由的确定性结构验证。`npm run dev` 启动的是静态 UI 预览；其中 `/api/*` 返回 501，不提供 Worker API。完整 API 联调需要 Wrangler、本地 D1 迁移和本地凭据配置。

## 技术栈与第三方组件

React 19、TypeScript、`@base-ui/react`、Tailwind CSS 4、Cloudflare Workers、Static Assets、D1 和 Wrangler。UI primitives 基于 [COSS](https://github.com/cosscom/coss) `apps/ui`（MIT）模式适配；行为层使用 [Base UI](https://github.com/mui/base-ui)（MIT），图标使用 [Remix Icon](https://github.com/Remix-Design/RemixIcon)（Apache-2.0）。
