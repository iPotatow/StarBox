<div align="center">

# StarBox

**一个可自托管的 GitHub 工作台，把 Star、Release、Fork 和发现流整理到一个可同步的界面。**

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

简体中文 · [English](README.en.md)

</div>

<p align="center">
  <img src="./assets/readme/starbox-ui.jpg" width="100%" alt="StarBox 实际运行中的 Star 页面，展示本地演示仓库数据。" />
</p>

StarBox 面向需要长期维护 GitHub 信息流的个人开发者。它把已 Star 的仓库、Release、已有 Fork 和新项目发现集中起来，并将账号数据放在自托管的 Cloudflare Worker + D1 中；换设备登录后，工作台仍能继续使用。

## 你会得到什么

| 页面 | 解决的问题 |
| --- | --- |
| **Star** | 搜索和整理已 Star 的仓库，按分类、语言和时间筛选；查看 README，订阅 Release，并使用 AI 摘要、标签、分类和批量分析。 |
| **Release** | 将订阅仓库的 Release 聚合成时间线或按仓库浏览，并按版本范围、平台和附件类型筛选。 |
| **Fork** | 跟踪已有 Fork 与上游的领先/落后状态、最近一次 GitHub Actions 运行，并同步上游或手动运行 Workflow。 |
| **Discover** | 通过 GitHub 搜索热门、活跃或新近仓库，按语言、Topic 和时间范围筛选后直接 Star。 |
| **Settings** | 连接 GitHub 和可选的 AI 服务，管理分类、外观、导航、Release 规则，以及数据导入/导出。 |

StarBox 不提供 Gist 管理或创建 Fork；这两个边界可以让工作台保持聚焦。

## 为什么适合自托管

- D1 是账号业务数据的权威来源；IndexedDB 只负责本地加速和离线缓存，不取代服务端数据。
- GitHub Token、AI API Key 和自定义请求头由 Worker 使用 AES-256-GCM 加密后存入 D1，安全 API 与 Bootstrap 不返回明文凭据。
- 登录使用安全 Cookie 并限制尝试频率；写请求校验同源 `Origin` 与 JSON `Content-Type`。
- Star 同步最多读取 3,000 个仓库，D1 按最多 50 条一批写入，并为 Bootstrap、Release 排序与保留清理准备索引。

## 快速开始

### 本地开发

```bash
npm install
npm run check
npm run dev
```

`npm run check` 会依次执行类型检查、测试、生产构建和五个主路由的确定性 UI 验证。`npm run dev` 启动静态 UI 预览；其中 `/api/*` 返回 501，完整 API 联调需要 Wrangler、本地 D1 schema/upgrade SQL 和本地凭据配置。

### 部署到 Cloudflare

先安装依赖并登录目标 Cloudflare 账号：

```bash
npm install
npx wrangler login
npm run deploy
```

部署脚本会先运行 `npm run check`，查找或创建名称**完全等于** `starbox` 的 D1 数据库，然后按远端 schema 状态执行：空库只执行 `migrations/0001_schema.sql`；受支持的旧结构（包括 0014 之前的多表结构和已合并的旧单用户结构）统一通过 `migrations/0002_legacy_upgrade.sql` 升级；已经是当前结构则不执行 SQL。仓库强制只允许这两个 SQL 文件，不再维护递增 migration 历史链。随后脚本校验最终 8 表结构并使用临时 Wrangler 配置部署 Worker 和静态资源。仓库中的 `wrangler.jsonc` 不需要填写数据库 UUID，也不会被脚本改写。

如果 Wrangler 账号下有多个 Cloudflare 账号，请设置 `CLOUDFLARE_ACCOUNT_ID`。生产环境还需要在 Cloudflare Dashboard 或 `npx wrangler secret put <NAME>` 中配置登录信息和加密密钥：

| 变量 | 用途与默认值 |
| --- | --- |
| `LOGIN_USERNAME` | 登录用户名，默认 `admin`；生产环境建议改为自定义值。 |
| `LOGIN_PASSWORD` | 登录密码；**必须配置非空值**。缺失时 StarBox 会拒绝登录，不存在默认密码 fallback。 |
| `SESSION_TTL_SECONDS` | Session 有效期，默认 `604800` 秒（7 天）。 |
| `STARBOX_ENCRYPTION_KEY` | GitHub Token、AI Key 与敏感自定义 Header 的唯一运行时加密配置；必须为非空值。StarBox 对 trim 后的值做 SHA-256 派生，再用于 AES-256-GCM。 |

不要把密钥写入仓库或 `wrangler.jsonc`。部署后还需要配置自定义域名或 Worker route，才能通过公开地址访问。

## 数据同步与性能

常规 mutation 在服务端确认后不会立即触发全量 Bootstrap；Bootstrap 仍是账号数据的权威校准入口。浏览器端只持久化发生变化的 IndexedDB entity store，并合并快速连续写入。Star 卡片使用 `content-visibility` 延迟离屏布局与绘制，减少大列表的初始渲染成本。

当前 D1 保持 8 张产品表；不使用 `processed_mutations`、`activity_log` 或 `sync_changes` 作为现行架构。Repository 用户字段通过 `user_revision` 做乐观并发；Release 原文/附件/AI 总结仍由浏览器缓存持有。SQL 已收敛为两条：`0001_schema.sql` 是空库最终结构，`0002_legacy_upgrade.sql` 内含受支持旧多表结构与旧单用户结构的兼容阶段，由部署脚本按远端 schema 选择；未知/中间结构仍 fail closed，不猜测迁移。部署校验关系、JSON、数据计数和关键查询计划。Workers Logs 已启用，采样率为 10%；`workers_dev` 保持为 `false`。

## 技术栈

React 19、TypeScript、`@base-ui/react`、Tailwind CSS 4、Cloudflare Workers、Static Assets、D1 和 Wrangler。UI primitives 参考 [COSS](https://github.com/cosscom/coss) `apps/ui`（MIT）模式适配，行为层使用 [Base UI](https://github.com/mui/base-ui)（MIT），图标使用 [Remix Icon](https://github.com/Remix-Design/RemixIcon)（Apache-2.0）。

## 相关文档

- [验证契约](VERIFICATION.md)：自动化门禁、CI 和生产边界。
- [第三方声明](THIRD_PARTY_NOTICES.md)：依赖与许可证说明。
- [D1 execute](https://developers.cloudflare.com/d1/wrangler-commands/#d1-execute) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Wrangler 部署](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
