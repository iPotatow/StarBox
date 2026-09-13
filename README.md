# StarBox

StarBox 0.5.1 是一个基于 **React + Cloudflare Workers + D1** 的单账户、多设备 GitHub 收藏工作台。Stars、Release、Fork、GitHub Lists、Discover、Notifications 与 Settings 都通过同源 Worker 和服务端登录会话访问。

> **固定产品边界：Gist 管理不实现。** StarBox 保持浏览器 + Cloudflare Worker 的产品形态，AI 只支持自定义 HTTP Provider，仓库检索保持普通文本与字段筛选。

> **本次导入快照：** 用户归档 `StarBox-0.5.1-interaction-polished.zip`（SHA-256：`07ddfcc319907708ee0fc9b9eb79fc246e823ac375d9bbda9a9607df7ee7dd54`）已原样保存在 `source-archives/StarBox-0.5.1-interaction-polished.zip`。本次把归档内容叠加到导入前的 `main` 基线 `7b671536814f3ebdfe9007206cc0971623db506e`；因此此版本记录的是该基线上的合入快照。归档内原有的验证声明未在本次重新执行或确认，本次没有运行测试、构建、浏览器验证或 Worker/D1 冒烟验证；仅检查了 ZIP 完整性、路径安全和归档 MANIFEST 哈希。

## 0.5.1 重点

- D1 作为 StarBox 业务状态的权威数据源；IndexedDB 只做实体缓存。
- 新增 StarBox 服务端登录：`LOGIN_USERNAME` / `LOGIN_PASSWORD`，默认分别为 `admin` / `000000`。
- 登录成功后使用 D1-backed opaque session 与 `HttpOnly; Secure; SameSite=Strict` Cookie。
- GitHub Token 经 Worker 验证后使用 AES-256-GCM 加密保存到 D1，可在多设备间复用；API 永不返回明文 Token。
- UI 基础交互层迁移到 **coss UI 设计体系 + Base UI 行为 primitives + Tailwind CSS v4**；StarBox 保留现有主题/accent 与 Remix Icon。
- Stars / Release / Category / AI organize / GitHub Lists 的 D1 写入语义收口，补齐跨设备一致性。
- Session `last_seen_at` 写入已节流，避免每次普通 API 请求都产生 D1 write。
- 保留 `stars-simplified` 父基线的交互收口：URL 可恢复筛选/排序、Lists 本地 draft + 未保存保护、Discover 显式远程查询与本地结果筛选、Notifications optimistic rollback、Settings deep-link/returnTo/import preview/Regex test、Repository Editor dirty guard 与 Repository Detail Tabs/retry。

## 功能面

### Stars

- GitHub Stars 同步与取消 Star；单仓库与批量取消 Star 都需要二次确认；StarBox 不提供新增 Star / 批量新增 Star 入口。
- GitHub 侧外部取消 Star 会在全量同步时生成 D1 tombstone，bootstrap 只返回 `is_starred=1` 的当前 Stars。
- 单行 COSS Toolbar：普通文本搜索、分类/语言筛选、按 **最近星标 / 最近活跃 / 最多星标** 三种固定降序排序；最近活跃按仓库 `pushed_at`（缺失时回退 `updated_at`）判断。
- Stars **只保留卡片视图**（桌面 3 列 / 平板 2 列 / 移动端 1 列），不提供列表视图切换。
- Repository Card：多选框位于右上角；Release、AI、详情、编辑、置顶、GitHub、取消 Star 全部使用底部图标操作；多选后使用底部居中的圆角浮动操作栏；元信息仅展示 **Star 数量 → 语言 → 更新时间**，不展示 Fork 数量或 License。
- 分类新增、更新、颜色、顺序、锁定、删除；批量分类写入 D1。
- Note、Pin、AI summary/tags/category 均进入 D1 authoritative metadata。
- Repository Detail、README、DeepWiki / Zread；Repository Card 不提供 Fork 创建入口。
- 单仓库 AI 整理与批量 AI 整理；锁定分类不会被 AI 覆盖。

### Release

- **只读取 Stars 页面已经订阅的仓库**；Stars 是唯一 Release subscription 管理入口。Release 页面不提供直接订阅、取消订阅、Watching Import 或 Custom Source。
- 增量、多页 Release 同步与 per-repository sync state。
- **已读/未读功能已移除**：当前前端状态不再包含 `releaseStates`，业务 mutation 不再提供 `release.read` / `release.unread`。
- 提供 **时间线 / 按仓库聚合** 两种阅读模式；仓库模式按 `repoFullName` 分组浏览 Release。
- Toolbar 保留普通文本搜索、订阅仓库筛选、Latest Only 与 Prerelease。
- Asset 快速过滤：平台支持 macOS / Windows / Linux / ARM；文件类型支持 DMG / ZIP / AppImage / EXE-MSI / DEB-RPM / APK / TAR-7Z。
- Settings → 数据与同步中的 Assets include/exclude Regex 继续与快速筛选叠加生效。
- **AI Release Summary** 复用 Settings 中现有 Custom HTTP Provider，输出 overview / highlights / fixes / breaking changes；不引入第二套 AI 凭据。
- Release Detail 保留完整 Notes、Assets、GitHub Release 跳转与 AI Summary。

### Fork

- **只读取 GitHub 账号中已经存在的 Fork**；StarBox 不提供 Fork 创建能力。
- `POST /api/forks` 服务端明确返回 405，不会调用 GitHub Fork 创建 API。
- **已读/未读功能已移除**：当前前端状态不再包含 `forkReadAt`，业务 mutation 不再提供 `fork.read`。
- Fork inventory 会读取 Upstream divergence（Ahead / Behind）与最近一次 GitHub Actions 运行状态。
- Toolbar 支持文本搜索、Upstream 状态筛选、Actions 状态筛选（成功 / 失败 / 运行中 / 无记录）、更新时间 / Behind / Ahead / 名称排序与正逆序切换。
- 可继续一键执行 upstream sync。
- Fork Detail 会读取可见 GitHub Workflows；用户可以选择 Workflow、填写 Ref / Branch 与可选 Inputs JSON，通过 Worker 代理触发 `workflow_dispatch`。
- Workflow 触发要求 GitHub Token 具备对应 Actions 权限，且目标 Workflow 自身支持 `workflow_dispatch`。
- 现有 Fork snapshot / event / upstream sync 状态继续写入 D1；Workflow 手动触发本身以 GitHub Actions 为权威状态。

### GitHub Lists

- GitHub Lists 同步、CRUD、Private、membership。
- GitHub 完整 Lists snapshot 会镜像到 D1；bootstrap 会从 `github_list_memberships` 重建 items。
- 删除 List 时同步清理对应 membership；单仓库 membership 更新保留其他 Lists 归属。

### Discover

- 基于 GitHub Search API 的 popular / active / fresh 频道。
- Language、Topic、时间窗口和本地普通文本筛选。
- 发现结果可直接 Star；取消 Star 需要二次确认。

### Notifications

- D1 持久化 Notification Center。
- GitHub sync、Release、Fork、Lists、credential 等服务端流程可产生通知。
- Activity 产品页面、导航与 public `/api/activity` 已移除；`activity_log` 只保留为 Worker/D1 内部审计记录，不再作为产品功能或同步协议。
- `sync_changes` 独立承担客户端增量同步。

### Settings

Settings 使用 COSS Tabs 分成五个区域：**账户与 GitHub / AI / 分类 / 外观 / 数据与同步**。

- 账户与 GitHub：StarBox Session、默认凭据警告、GitHub Credential、Rate Limit diagnostics。
- AI：Custom HTTP Provider、Base URL、Model、API Key、Headers、Connection Test；Release AI Summary 复用这一配置。
- 分类：Category create/update/color/order/lock/delete；分类管理位于 Settings。
- 外观：System / Light / Dark、comfortable / compact、neutral / blue / violet / emerald accent、导航顺序与显示。
- 数据与同步：Release sync depth / page size / Assets include/exclude，以及安全 import/export / clear local data。

## 登录与 Session

Worker 登录配置：

```text
LOGIN_USERNAME     default: admin
LOGIN_PASSWORD     default: 000000
SESSION_TTL_SECONDS default: 604800
```

登录验证只发生在 Worker。生产环境建议将 `LOGIN_PASSWORD` 作为 Cloudflare Secret：

```bash
wrangler secret put LOGIN_PASSWORD
```

登录接口有服务端 rate limiting；所有 cookie-authenticated mutation 都执行同源 `Origin` 与 JSON content-type 检查。

## 跨设备 GitHub Credential

首次连接 GitHub Token 时：

```text
Browser → Worker → GitHub /user validation
                 → AES-256-GCM encrypt
                 → D1 ciphertext + IV + key version + fingerprint
```

生产环境必须提供独立 32-byte AES-256 key：

```bash
wrangler secret put GITHUB_TOKEN_ENCRYPTION_KEY
```

可选轮换配置：

```text
GITHUB_TOKEN_ENCRYPTION_KEY_VERSION
GITHUB_TOKEN_ENCRYPTION_KEY_PREVIOUS
```

兼容读取旧变量名 `GITHUB_TOKEN_ENCRYPTION_KEY_OLD`。当记录使用 previous key 时，首次成功读取会 lazy-rotate 到 current key。

明文 GitHub Token 不写入 D1、IndexedDB、localStorage、内部审计日志、一般日志、错误对象或 Export；第二台设备只需登录 StarBox，Worker 会在请求内存中短暂解密凭据并代理 GitHub 请求。

首次成功连接后，StarBox 会将 Single Owner 绑定到该 GitHub numeric user ID。后续 Replace Token 只允许同一 GitHub 身份；删除 Credential 仅移除加密 Token，不解除身份绑定。切换到另一个 GitHub 账号必须通过未来独立的“重置 GitHub 账号与云端数据”流程，避免不同账号数据混入同一 D1 authoritative state。

AI Provider API Key 与 secret headers 仍是 browser-local，不进入 D1。

## 数据模型

StarBox 0.5.1 是 **fresh D1 deployment**。当前没有既有生产用户，因此不实现旧版用户数据升级流程。

- **D1**：repositories、repository metadata、categories、Release subscriptions/releases/sync state、Fork state/snapshots/events、GitHub Lists/memberships、Notifications、sessions、encrypted GitHub credential、sync changes；`activity_log` 仅作为服务端内部审计表。旧 schema 中的 `release_states` 表不再进入当前产品状态。
- **IndexedDB**：脱敏实体缓存，只用于启动加速与缓存恢复。
- **localStorage**：少量 UI snapshot / preferences 与 browser-local AI secrets；不保存 GitHub Token。

D1 migrations：

```text
migrations/0001_v5_schema.sql
migrations/0002_v5_indexes.sql
migrations/0003_repository_meta_ai_and_lists.sql
```

## COSS UI

StarBox 的 UI primitive 采用 coss UI 的 copy/paste-and-own 思路，行为层使用 `@base-ui/react`，样式使用 Tailwind CSS v4 与 coss semantic tokens。

当前源码包含以下计划内 COSS primitive contract：

- Button / Input / Textarea / Field
- Badge / Alert / Card
- Dialog（项目内兼容 API 名为 `Modal`）
- Select / Checkbox / Switch
- Menu / Tooltip / Toast / Tabs
- Pagination
- Toolbar / ToggleGroup / Table / AlertDialog
- Skeleton（页面/集合结构化 loading primitive）

现有产品界面已在有对应交互面的地方完成 composition 迁移：Status Banner 使用 Alert，主要仓库/发现/Release 卡片使用 Card，业务筛选使用 Toolbar，Release 视图/布尔筛选使用 ToggleGroup，Settings 使用 Tabs，Release/Fork 翻页使用 Pagination，分类管理使用 Table + AlertDialog，应用根节点已接入 Toast Provider。

全局加载规范使用结构匹配的 Skeleton：Stars / Discover 使用 Repository Card Skeleton，Release 使用 Release Card Skeleton，Fork / Notifications 使用 Row Skeleton，Lists 与 Settings 使用对应 panel/form skeleton。页面级加载不再用单个中心 Spinner；Spinner 仅用于按钮短时动作。

业务页面不再使用自制 dialog、原生 select 或原生 checkbox 作为主要交互 primitive。Remix Icon 继续作为业务图标层。StarBox 自己的 theme/density/accent 变量在 coss semantic token contract 上继续生效。

来源与许可证边界见 `THIRD_PARTY_NOTICES.md`。

## 技术栈

- React 19.3.0
- TypeScript 5.9.3
- `@base-ui/react` 1.8.0
- Tailwind CSS 4.3.3
- Remix Icon React 4.9.0
- Cloudflare Workers + Static Assets + D1
- Wrangler 4.130.0
- esbuild 0.28.2

## Cloudflare 配置

`wrangler.jsonc` 保持：

```jsonc
"workers_dev": false
```

正式部署前必须：

1. 创建生产 D1，并把 `wrangler.jsonc` 中占位 `database_id` 替换为真实 ID。
2. 执行 `migrations/`。
3. 设置 `LOGIN_PASSWORD` Secret。
4. 设置 `GITHUB_TOKEN_ENCRYPTION_KEY` Secret。
5. 建议配置自定义 `LOGIN_USERNAME`。
6. 配置 custom domain / route；不要启用公共 Workers subdomain。

## 开发与验证

正常联网环境：

```bash
npm install
npm run check:installed
npm run dev
```

普通门禁：

```bash
npm run check
```

等价于：

```bash
npm run typecheck
npm test
npm run build
npm run ui:verify
```

其中 `ui:verify` 是快速、确定性的 7-route 结构门禁，不依赖 PDF/PNG 栅格化。需要生成可视 evidence 时可单独执行：

```bash
npm run ui:verify:raster
```

Raster evidence 属于补充证据，不替代真实浏览器 E2E，也不会阻塞默认 `npm run check`。

本仓库的构建脚本在真实安装依赖环境优先使用本地 esbuild bundle；只有执行容器缺少已安装前端包时才明确进入 fallback import-map mode。

当前交付的实际验证边界见 `VERIFICATION.md`。确定性 UI harness 用于结构与布局回归，不替代真实浏览器 E2E。

## 目录

```text
src/
  components/ui/       coss/Base UI-backed primitives
  features/
    repositories/
    releases/
    forks/
    lists/
    discover/
    notifications/
    settings/
  lib/
worker/
  auth.ts              登录 / Session / rate limit
  crypto.ts            Credential encryption
  repository.ts        D1 data/repository layer
  v5.ts                Credential + sync/bootstrap API
  index.ts             Worker routes / GitHub adapters
migrations/             D1 migrations
tests/                  contract/storage/Worker tests
scripts/                build/typecheck/test/UI verification
```
