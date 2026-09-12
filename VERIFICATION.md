# Verification

Date: 2026-09-12
Version: 0.5.1

## 当前 main 合并验证（97aa93d）

StarBox 0.5.1 prelaunch-fixed 已合入 main，基线提交为 `97aa93d`。在该实现上执行 `npm run check:installed`：**PASS**。

- Installed-package typecheck：PASS，使用已安装的真实依赖类型。
- Automated tests：**97/97 PASS**。
- Build：PASS，输出 `bundled local dependencies`。
- UI structural verification：PASS，覆盖 **8 routes**。
- MANIFEST：**122 项**文件大小与 SHA-256 全部匹配，**0 mismatches**。

Real-browser E2E、raster screenshot verification 与 Cloudflare production smoke 尚未执行。

## ZIP 合并前验证快照

本工作副本直接基于用户提供的归档修改，未写入 Git 仓库、未创建 PR。

归档环境执行 `npm test`：**97/97 automated tests PASS**。新增回归覆盖 batch-star hard reject、GitHub numeric identity binding、删除 Credential 后保持 identity binding、分类名称 draft + blur/Enter commit，以及恰好 30 页 Stars 在最后一页无 `rel="next"` 时正确判定完整同步。

归档环境执行 `npm run typecheck`、`npm run build`、`npm run ui:verify` 均 PASS；由于当时没有真实安装的 React / React DOM / Remix Icon / Base UI package types，typecheck 使用 fallback shims，build 使用 fallback import-map mode。`npm run typecheck:installed` 当时 **exit 2**，因此该归档快照未宣称 installed-package gate 通过。

Real-browser E2E、raster screenshot verification 与真实 Cloudflare production smoke 当时未执行。

## Original archive verification record

本交付环境没有可用的本地 npm 前端依赖安装，因此必须区分三层验证：

1. **Packaging-container gate**：允许脚本明确进入 fallback type shim / fallback import-map build，用于验证 StarBox 源码、Worker/D1 逻辑、合同测试与确定性 UI 结构输出。
2. **Installed-package gate**：正常联网环境执行 `npm install && npm run check:installed`，必须加载真实 React / Remix Icon / Base UI 类型与本地 bundle；fallback 结果不能替代该门禁。
3. **Browser E2E**：当前环境没有完成真实 Playwright/Browser 会话，确定性 UI verifier 不被描述成真实浏览器行为测试。

## Final packaging-container result

最终源码执行：

```bash
npm run check
```

结果：**PASS**。

该命令包含：

- Typecheck: **PASS** — 明确报告 fallback-shim mode。
- Automated tests: **PASS, 97/97**。
- Build: **PASS** — 明确报告 `fallback import-map mode`。
- Fast UI structural verification: **PASS, 8 routes**。
- `workers_dev: false`: verified。
- Gist runtime route/navigation: deliberately absent。

额外执行：

```bash
npm run ui:verify:raster
```

当前容器在 WeasyPrint/pdftoppm 栅格化阶段超时，因此 **raster evidence 不宣称通过**。快速结构门禁与 raster evidence 已拆分，环境型 PDF/PNG 转换波动不会再让默认 `npm run check` 假失败。

`npm run check:installed` 已在本环境重跑并 **exit 2**；原因是缺少真实安装的 React / React DOM / Remix Icon / Base UI 类型。该结果是预期的拒绝 fallback 行为，不记为通过。

## Automated coverage — 97 tests

覆盖包括：

- StarBox 服务端登录、fallback credential warning、login rate limit。
- D1 opaque session、secure cookie、expiry/logout/revoke、same-origin mutation guard。
- Session `last_seen_at` write throttling。
- GitHub credential validate / AES-256-GCM encryption / replace / delete / second-device reuse。
- AES-GCM AAD、key version 与 previous-key lazy rotation。
- D1 authoritative bootstrap / changes / IndexedDB entity-cache contract。
- Stars single star/unstar + batch unstar、batch-star hard reject、GitHub full-sync external unstar reconciliation、bootstrap tombstone filtering。
- Repository metadata、Category create/update/delete/reorder/batch assignment。
- AI organize summary/tags/category authoritative persistence。
- Release normalization/detail/incremental sync、explicit read/unread、Stars-owned subscription mutations、Release-page no-subscribe contract、release sync state。
- Fork creation endpoint hard-disabled (405 + zero GitHub create calls)、existing Fork status/inventory/divergence/Actions/upstream sync、D1 snapshots/events。
- GitHub Lists snapshot/CRUD/membership mirror 与 delete cleanup。
- Discover query construction。
- Activity / notification producer contracts。
- COSS/Base UI core behavior-primitives contract。
- **完整 COSS primitive contract + 现有 composition contract**，包括 Toolbar / ToggleGroup / Table / AlertDialog / Skeleton 与全站 max-w-7xl/loading contract。
- build fallback vs installed-bundle contract。
- credential-redacted export / browser-local AI secret contract。

## COSS UI verification

计划内 COSS primitive set 已完整进入源码：

```text
Button / Input / Textarea / Field
Badge / Alert / Card
Dialog / Select / Checkbox / Switch
Menu / Tooltip / Toast / Tabs
Pagination / Command
Toolbar / ToggleGroup / Table / AlertDialog
Skeleton
```

交互 primitive 使用 `@base-ui/react` 行为层；结构、语义 token 与组件组合参考 coss `apps/ui/registry/default/ui` 的 MIT 源码并在项目内 copy/paste-and-own。Tailwind CSS v4、StarBox theme/accent/density 与 RemixIcon 继续保留。

已迁移的现有 composition 包括：

- StatusBanner → Alert
- Repository / Discover / Release card surfaces → Card
- Release / Fork pagination → Pagination
- application root → ToastProvider

Menu / Tabs / Command primitive 已可用，但项目没有为了证明迁移而新增无需求的菜单、Tab 或 Command Palette 产品功能。

严格浏览器行为（focus trap、portal、keyboard navigation、real Select/Menu/Tooltip positioning、Toast animations）仍需在 installed-package + Playwright 环境验证。

## UI redesign v1 contracts

本批基于用户上传的 `starbox.zip` 实现并验证：

- Stars fresh UI preference defaults to card/grid；user list/grid choice is browser-local。
- Stars Toolbar contains search/category/language/sort/direction/view switch；排序字段仅 Star 时间 / Star 数量 / 更新时间。
- Repository Card 不存在 Fork 创建 action。
- Release 页面只消费 `state.releaseSubscriptions`，不包含 Watching Import、直接 subscribe/unsubscribe mutation。
- Fork 页面不包含 ForkDialog/create job；Worker `POST /api/forks` 返回 405。
- Settings 使用 5 Tabs，CategorySettingsPanel 在分类 Tab，Release sync/assets 配置在数据与同步。
- Stars / Release / Fork / Lists / Discover / Activity / Notifications / Settings 均使用 `max-w-7xl` 主内容约束并具有结构化 Skeleton loading。

## UI structural verification

`npm run ui:verify` 使用确定性 React-compatible SSR harness + production Tailwind CSS，并跳过 PDF/PNG rasterization。验证 8 routes：

- `/` — Stars
- `/releases` — Release
- `/forks` — Fork
- `/lists` — GitHub Lists
- `/discover` — Discover
- `/activity` — Activity
- `/notifications` — Notifications
- `/settings` — Settings

Harness 会 stub RemixIcon 与 Base UI runtime，因此只证明 route structure、Content Surface、主要内容和 composition 可渲染，不证明真实浏览器 focus/portal/keyboard 行为。

## Excluded capability scan

The previously excluded capability families remain absent from source, configuration, documentation and tests. Gist remains a permanent non-goal.

## Build mode

当前容器输出：

```text
Built StarBox -> dist (fallback import-map mode)
```

正常安装环境中 `scripts/build.mjs` 会优先用本地 esbuild bundling。只有报告 `bundled local dependencies` 的构建才应被视为最终 self-contained frontend runtime build。

## Installed-package handoff

联网机器执行：

```bash
npm install
npm run check:installed
```

生产就绪前要求：

- 使用真实 React / React DOM / Remix Icon / Base UI package types；
- 97+ tests PASS；
- build 报告 `bundled local dependencies`；
- 8-route structural verifier PASS；
- Playwright 验证 Login、Dialog、Select、Checkbox、Switch、Menu、Tooltip、Toast 与主要业务 mutation。

## Cloudflare production handoff

部署前：

```bash
wrangler secret put LOGIN_PASSWORD
wrangler secret put GITHUB_TOKEN_ENCRYPTION_KEY
```

随后配置真实 D1 database ID、应用 migrations、绑定 custom domain/route，并在 `npm run check:installed` 通过后执行：

```bash
npm run deploy
```

Production smoke 覆盖 Login → GitHub credential connect → Stars sync → Release → Fork → Lists → Activity → Notifications → Settings，并验证第二设备登录可复用加密 GitHub credential。
