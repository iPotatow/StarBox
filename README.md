# StarBox

StarBox 0.5.0 是一个以 **React + Cloudflare Workers + D1** 为核心的 GitHub 收藏工作台。Stars、Release、Fork、GitHub Lists、Discover、Activity、Notifications 与设置均通过登录会话访问同源 Worker。

> **产品边界：Gist 管理明确不做。** StarBox 也不为了追求上游功能数量而引入与当前浏览器 + Worker 架构冲突的运行时。

## 功能总览

### Stars

- 同步 GitHub Stars，并保留收藏时间
- 单仓库 Star / 取消 Star
- 最多 50 个仓库的批量 Star / 批量取消
- 普通文本搜索、语言/分类筛选、按收藏时间/更新时间/Stars/名称排序
- 分类管理：新增、重命名、颜色、顺序、锁定、删除
- 批量分类、备注、置顶
- Release 批量订阅与 Fork 快捷入口
- 仓库详情抽屉：基础统计、Homepage、README 预览
- DeepWiki / Zread 快捷跳转
- 自定义 AI Provider 单仓库整理
- AI 批量整理进度、暂停与恢复；锁定分类不会被 AI 覆盖

### Release

- 从 Stars、`owner/repo` 或 GitHub Watching 导入订阅
- 增量同步：按每仓库最新本地 Release 时间只拉取新内容
- 可设置每仓库同步深度 1 / 3 / 5 页
- 本地分页
- 仅最新版模式
- 包含 / 排除预发布版本
- Release Notes、作者、发布时间、Assets 与详情
- Asset include / exclude 规则，支持正则；无效正则自动降级为普通文本匹配
- 已读 / 未读状态
- 单仓库取消订阅会同时清理该仓库的缓存 Release

### Fork

- 从 Stars 发起 Fork，可指定组织、目标名称与仅默认分支
- Fork 创建任务持久化，自动轮询 pending 状态并支持失败重试
- 同步当前账号拥有的完整 Fork 清单
- Fork 搜索与分页
- 新更新 / 未读状态
- 上游仓库与默认分支信息
- ahead / behind 差异检查
- 一键调用 GitHub `merge-upstream` 同步上游
- 显示最新 GitHub Actions run 状态与结果

### GitHub Lists

- 同步 GitHub Star Lists
- 创建、重命名、编辑描述、切换 Private、删除 List
- 查看 List 内仓库数量与当前成员
- 从本地 Stars 加入 / 移出 List
- 修改单个 List membership 时保留仓库在其他 Lists 中的归属
- Lists 缓存与最后同步时间保存到浏览器

### Discover

- 基于 GitHub Search API 的轻量发现页
- 热门、活跃、新鲜仓库频道
- Language、Topic、时间窗口筛选
- 对当前结果做普通文本筛选
- 从发现结果直接 Star / 取消 Star
- 不依赖额外检索服务

### 设置与诊断

- Worker 管理的跨设备 GitHub 凭据：连接身份、Replace Token、Remove Token；页面不提供 Token reveal
- 已登录账户、退出登录，以及默认 `admin / 000000` 的 critical deployment warning
- GitHub Token 验证
- GitHub API Rate Limit 资源、剩余额度与重置时间诊断
- 401 / 403 / 404 / 409 / 422 / 5xx 等 GitHub API 错误映射与可见反馈
- 自定义 HTTP AI Provider：名称、Base URL、Model、API Key、可选 Headers、连接测试
- Light / Dark / System
- comfortable / compact 密度
- neutral / blue / violet / emerald accent
- 六个产品面的导航顺序与显示管理；Stars 和设置固定保留
- 本地 JSON 导出、导入、清空

## 自定义 AI Provider

AI 仅通过用户配置的自定义 HTTP Provider 工作。默认适配层采用 Chat Completions 风格接口：

```text
POST {BASE_URL}/chat/completions
Authorization: Bearer {API_KEY}
```

Provider 适配逻辑集中在 `worker/provider.ts`，可替换 `HttpProviderAdapter` 适配其他 HTTP 协议。

安全规则：

- AI API Key 与自定义 Headers 只持久化在当前浏览器 localStorage
- GitHub Token 不进入 localStorage、IndexedDB、D1 或导出备份；Worker 可用空 token header 从云端凭据 hydrate
- 导出备份自动移除 GitHub Token、AI API Key 与敏感自定义 Headers
- Worker 只在当前请求期间使用凭据，不持久化密钥
- Provider Base URL 必须为 HTTPS，并拒绝本地或私网目标
- 用户附加 Header 不能覆盖 Authorization、Host、Content-Length 等受限 Header

## 数据与持久化

StarBox 0.5 使用 D1 作为 authoritative source；IndexedDB 仅保存脱敏状态作为离线加速与缓存，浏览器 `localStorage` 只保存 UI snapshot、主题/导航偏好和浏览器本地 AI API Key/自定义 Headers。GitHub 凭据仅由 Worker 加密保存并按会话租户隔离。

- D1：Stars、分类、Release、Fork、Lists、Activity、Notifications 与同步 revision 的权威数据
- IndexedDB：不含 GitHub Token、AI API Key 或自定义 Headers 的脱敏离线缓存
- localStorage：UI snapshot、主题/导航偏好，以及仅限当前浏览器的 AI API Key/自定义 Headers

状态格式当前为 **v5**。v4 → v5 会先创建本地 v4 backup，再分块上传到 D1 迁移 API，并在 verify 阶段提交 backup `counts` 与 `checksum`；验证通过后才 complete。失败时保留 v4 backup，直到用户显式删除。

## Cloudflare 部署前置条件

部署必须配置 `wrangler.jsonc` 中的 `DB` D1 binding，并先执行 `migrations/` 下的 migration（至少包含 v5 schema/indexes）。必须设置 `LOGIN_USERNAME`、`LOGIN_PASSWORD`、`GITHUB_TOKEN_ENCRYPTION_KEY`，并按轮换策略设置可选的 `GITHUB_TOKEN_ENCRYPTION_KEY_OLD` 与 `GITHUB_TOKEN_ENCRYPTION_KEY_VERSION`。未配置 D1、加密密钥或部署凭据时，相关 API 会返回 recovery error。

默认登录凭据仅用于首次启动；session 返回 `defaultCredentialsActive` 时前端显示 critical warning。本仓库未执行生产部署，不对线上域名、D1 数据或 secrets 配置作已完成声明。

## 技术栈

- React 19 + TypeScript 5.9.3
- Cloudflare Workers + Static Assets
- Tailwind CSS v4
- Remix Icon React
- coss.com/ui 视觉语言的项目内通用组件
- esbuild：在正常安装依赖的环境中，将前端依赖打进本地 `dist/app.js`

## 本地开发

正常联网环境：

```bash
npm install
npm run dev
```

`npm run dev` 会构建 `dist/` 并在 `http://127.0.0.1:4173` 启动静态预览。静态预览不执行 Worker API；完整 API 联调使用 Wrangler。

## 验证

标准门禁：

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

在已完成真实 `npm install` 的环境中，使用严格门禁：

```bash
npm run check:installed
```

`check:installed` 会拒绝使用类型 fallback，确保加载的确实是安装包提供的 React / React DOM / Remix Icon 类型。正常安装时 `npm run build` 还会使用本地 esbuild 将前端依赖打入 `dist/app.js`，生产页面不依赖运行时 CDN 模块。

验证记录只描述本次实际执行的命令；没有执行的生产部署、真实线上 API 联调或干净安装不会被声称为已完成。详见 `VERIFICATION.md`。

## Cloudflare Workers 部署

`wrangler.jsonc` 显式保持：

```jsonc
"workers_dev": false
```

部署前请在 Cloudflare 配置自定义域名或 Route，然后：

```bash
npm install
npm run check:installed
npm run deploy
```

`/api/*` 由 Worker 优先处理，其余路径使用静态 Assets 与 SPA fallback。

## 目录

```text
src/
  components/          App Shell 与通用 UI
  features/
    repositories/      Stars、分类、仓库详情、README、AI 整理
    releases/          Release 订阅、增量同步、规则与详情
    forks/             Fork 创建、清单、差异、同步与 Actions
    lists/             GitHub Lists
    discover/          GitHub Search 发现页
    settings/          GitHub / AI / 外观 / 导航 / 数据设置
  lib/                 Worker API 客户端、持久化
worker/
  index.ts             Worker/API 路由
  provider.ts          自定义 HTTP AI Provider 适配层
tests/
  worker.test.mjs      Worker/API 回归测试
  storage.test.mjs     状态迁移与备份测试
  contracts.test.mjs   UI / 配置 / 构建合同测试
scripts/
  build.mjs            前端构建；安装态本地 bundle + 离线 fallback
  preview.mjs          静态预览
  typecheck.mjs        类型检查与严格安装态门禁
  test.mjs             测试入口
  ui-verify.mjs        六路由确定性 UI 渲染验证
```

## 第三方来源

许可与来源见 `THIRD_PARTY_NOTICES.md`。
