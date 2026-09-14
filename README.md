# StarBox

StarBox 0.5.1 是一个基于 **React + Cloudflare Workers + D1** 的单账户、多设备 GitHub 工作台。当前一级产品入口固定为：**Star / Release / Fork / Discover / Settings**。

> **固定产品边界：** Gist 管理不实现。Repository / Release / Fork 详情继续使用 Modal/Dialog，不改右侧详情面板；`content-surface` 的结构、尺寸、padding、滚动容器、背景、边框与响应式规则保持冻结。

> **本轮交付：** 基于用户提供的最新 `starbox.zip`，将产品体验整改与数据/安全整改合并为一个版本。所有修改仅发生在 `/mnt/data` 工作副本，未写入 Git 仓库、未 commit、未 push、未创建 PR。

## 产品结构

### Star

- GitHub Star 同步与取消 Star；StarBox 不提供新增 Star / 批量新增 Star 入口。
- 单一 COSS Toolbar：搜索、分类、GitHub 列表、语言、排序、正序/倒序。
- GitHub Lists 不再占据一级导航，作为 Star 的组织能力：Toolbar 可直接筛选列表，“管理列表…”在内嵌 Modal 中完成 CRUD 与仓库归属管理。
- Repository Card 保持 Grid：桌面 3 列 / 平板 2 列 / 移动端 1 列。
- 仓库名称左对齐并打开内部 Repository Detail；GitHub 通过独立外链打开。
- 卡片右上角圆形 Checkbox 保留纯定位 wrapper，确保 Base UI Checkbox 的 Indicator/focus 状态不发生位移；wrapper 不承担视觉容器样式。
- Language 使用 GitHub Linguist 风格颜色圆点；Star 数量使用空心 Star；Tag 超量显示 `+N`；操作栏左对齐。
- Pin / 置顶产品能力已移除。旧 D1 `pinned` 字段仅为 schema 兼容保留，新 metadata 写入固定为 `0`。
- 排序支持 **星标时间 / 活跃时间 / Star 数量** 与独立正序/倒序，默认倒序；方向进入 URL state。
- 多选进入明确的选择模式：底部强调色、`100px` 圆角浮动栏，操作顺序固定为 **已选 N 个 → 全选 → 订阅 → AI 分析 → 分类 → 取消 Star → ×**。分类通过菜单即时应用。
- AI 分析支持单仓库与批量；批量过程支持暂停/继续、停止与失败重试。

### Repository Detail / README

- 继续使用 Modal，宽度扩大到 `max-w-6xl`。
- README 首次切换 Tab 时 lazy load。
- Markdown 阅读器支持常见 GitHub README 语法：标题、代码块、表格、无序/有序/任务列表、引用、分割线、图片、仓库相对链接/图片、粗体、斜体、删除线、inline code。
- 相对资源按当前 repository + default branch 解析；不执行 raw HTML 注入。
- 支持上一/下一仓库；DeepWiki / Zread 收入 More 外链菜单。

### Release

- 只读取在 Star 中已订阅 Release 的仓库；Star 是订阅管理入口。
- 增量、多页 Release 同步与 per-repository sync state。
- 已读/未读功能不属于当前 Release 产品模型。
- 页面提供 **时间线 / 按仓库** 两种视图。
- 单一 Toolbar：**搜索 → 仓库 → 视图 → 版本范围 → Assets**。
- “仅最新 / 包含预发布”不再作为两个并列 Toggle；版本范围统一为：**全部版本 / 仅稳定版 / 每仓库最新 / 每仓库最新稳定版**。
- `Assets` 菜单统一管理平台与文件类型快速筛选；Toolbar 不提供 Settings 齿轮。
- 高级文件名包含/排除规则放在 Settings → 数据，不干扰日常 Release 浏览。
- Release Card 最多展示 3 个匹配文件并明确剩余数量；AI 总结默认折叠。
- Release Detail 继续使用 Modal，版本说明使用 Markdown 阅读器，并显示当前文件筛选条件。

### Fork

- 只读取 GitHub 账号中已经存在的 Fork；StarBox 不提供 Fork 创建能力。
- 读取与上游的领先/落后状态和最近一次 GitHub Actions 运行情况。
- Toolbar 支持搜索、上游状态、Actions 状态、排序与正序/倒序。
- 普通界面使用“上游 / 领先 / 落后 / 最近一次 Action”等产品语言，不暴露 divergence 等实现术语。
- 可执行同步上游。
- Fork Detail 继续使用 Modal；可选择 Workflow、分支 / Ref，并在“高级设置 · 输入参数”中按需填写 JSON 参数后手动运行 Workflow。
- GitHub Actions / Workflow 保留为 GitHub 正式能力名；`workflow_dispatch` 等协议词不作为普通产品文案。

### Discover

- 基于 GitHub Search 的 popular / active / fresh 查询。
- 远程 GitHub 查询与本地结果筛选保持分离；查询参数改变后显示“查询条件已修改 / 重新搜索”。
- 查询条件使用显式 Language / Topic / Period 标签；结果 Topic 超量显示 `+N`。
- Repository 标题打开内部详情；GitHub 保留显式外链。

### Notifications

Notifications **不再是一级产品页面或导航入口**，也不再进入 Bootstrap 数据面。底层 `notifications` 表与专用 API 暂时保留为兼容/内部事件能力；用户当前可见的即时反馈回归对应功能页面的 Toast、状态与错误提示。

### Settings

Settings 保留全局 Sidebar，页内使用横向 sticky COSS underline Tabs：**账户与 GitHub / AI / 分类 / 外观 / 导航 / 数据**。

- 页面外宽与其他主页面统一为 `max-w-7xl`。
- Section 统一采用 **标题/说明在上、控件在下**，不再使用左侧说明 + 右侧表单的双列结构。
- 账户与 GitHub：登录状态、GitHub 连接、Token、连接测试和 API 配额。
- AI：统一称为“AI 服务”；服务名称 / 服务地址 / 模型为云端业务配置；API Key / 自定义请求头保存后不回显明文。
- 分类：摘要列表、inline rename、颜色、AI 锁定和 More 删除。
- 外观：主题预览、强调色、界面密度；属于设备显示偏好。
- 导航：只管理 Star / Release / Fork / Discover / Settings；拖拽排序 + Switch，并保留键盘排序辅助。
- 数据：Release 获取范围与文件名规则、导入/导出、此设备数据清理与 Danger Zone。

## 登录与 Session

Worker 登录配置：

```text
LOGIN_USERNAME       default: admin
LOGIN_PASSWORD       default: 000000
SESSION_TTL_SECONDS  default: 604800
```

生产环境必须替换默认密码：

```bash
wrangler secret put LOGIN_PASSWORD
```

登录接口包含 rate limiting；cookie-authenticated mutation 检查同源 `Origin` 与 JSON Content-Type。

## 凭据与数据安全

### GitHub Token

GitHub Token 经 Worker 验证后使用 AES-256-GCM 加密保存到 D1；API 不返回明文 Token。

```bash
wrangler secret put GITHUB_TOKEN_ENCRYPTION_KEY
```

可选轮换配置：

```text
GITHUB_TOKEN_ENCRYPTION_KEY_VERSION
GITHUB_TOKEN_ENCRYPTION_KEY_PREVIOUS
```

兼容旧变量名 `GITHUB_TOKEN_ENCRYPTION_KEY_OLD`。旧 key 记录在成功读取后 lazy-rotate 到 current key。

### AI API Key 与自定义请求头

AI API Key 与自定义请求头不再作为正常状态长期保存在浏览器。它们由 Worker 使用 AES-GCM 加密写入 D1 `ai_credentials`，安全 GET / Bootstrap 只返回“是否已配置”等摘要，不回传明文。

推荐为 AI/通用 StarBox 凭据配置独立 32-byte AES-256 key：

```bash
wrangler secret put STARBOX_CREDENTIAL_ENCRYPTION_KEY
```

可选轮换配置：

```text
STARBOX_CREDENTIAL_ENCRYPTION_KEY_VERSION
STARBOX_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS
```

若未配置 `STARBOX_CREDENTIAL_ENCRYPTION_KEY`，Worker 会兼容回退到 `GITHUB_TOKEN_ENCRYPTION_KEY`；生产环境仍建议使用独立密钥。

旧版本浏览器 localStorage 中若存在 AI Key / Headers，在云端尚未配置时会用于一次性迁移；迁移成功并由 Bootstrap 确认云端凭据可用后，运行时及后续本地 snapshot 均清除明文。迁移失败不会主动删除旧值，避免凭据丢失。

普通 Repository AI 分析和 Release AI 总结请求不再从浏览器提交 API Key / Headers；Worker 从 D1 读取非敏感配置、解密凭据后调用 AI 服务。

## 数据归属

| 数据 | 归属 |
| --- | --- |
| Repositories / metadata / categories | D1 |
| Release subscriptions / releases / sync state | D1 |
| Fork state / snapshots / events | D1 |
| GitHub Lists / memberships snapshot | GitHub + D1 |
| GitHub Token | Worker AES-GCM → D1 |
| AI API Key / custom headers | Worker AES-GCM → D1 |
| AI 服务名称 / 地址 / 模型 | D1 `app_preferences` |
| Release 获取范围 / 包含与排除文件名规则 | D1 `app_preferences` |
| Star / Release / Lists 最近同步时间 | D1 sync state / bootstrap summary |
| Theme / Density / Accent / nav order / page size | 当前设备本地偏好 |
| IndexedDB | 脱敏实体缓存 |
| Notifications | 底层兼容/事件能力，不进入当前一级产品 IA |

原则：**业务配置跟账号，显示偏好跟设备，秘密只由 Worker 解密，IndexedDB 只做缓存。**

D1 migrations：

```text
migrations/0001_v5_schema.sql
migrations/0002_v5_indexes.sql
migrations/0003_repository_meta_ai_and_lists.sql
migrations/0004_processed_mutations.sql
migrations/0005_ai_credentials_and_preferences.sql
```

## COSS UI

StarBox 的 UI primitive 采用 COSS copy/paste-and-own 模式，行为层基于 `@base-ui/react`，样式使用 Tailwind CSS v4 与 StarBox semantic tokens。

主要 primitive/composition 包括：Button、Input、InputGroup、Textarea、Field、Badge、Alert、Card、Empty、Dialog/Modal、Spinner、Select、Checkbox、Switch、Menu、Tooltip、Toast、Tabs、Pagination、Toolbar、ToggleGroup、AlertDialog、Skeleton。

业务页面不使用自制 overlay behavior；用户可见原生 form control 仅保留数据导入所需的隐藏 file input。`src/styles.css` 与用户最新输入基线保持字节级一致，本轮布局与交互变化由 primitives 和页面级 Tailwind composition 完成。

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

## Cloudflare 部署

`wrangler.jsonc` 保持：

```jsonc
"workers_dev": false
```

正式部署前：

1. 创建生产 D1，并把 `wrangler.jsonc` 中占位 `database_id` 替换为真实 ID。
2. 执行全部 `migrations/`，包括 `0005_ai_credentials_and_preferences.sql`。
3. 设置 `LOGIN_PASSWORD` Secret。
4. 设置 `GITHUB_TOKEN_ENCRYPTION_KEY` Secret。
5. 建议额外设置独立 `STARBOX_CREDENTIAL_ENCRYPTION_KEY` Secret。
6. 建议配置自定义 `LOGIN_USERNAME`。
7. 配置 custom domain / route；不要启用公共 Workers subdomain。

## 开发与验证

正常安装依赖环境：

```bash
npm install
npm run check:installed
npm run dev
```

当前通用门禁：

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

`ui:verify` 是确定性的 **5-route** 结构门禁：Star / Release / Fork / Discover / Settings。需要生成 deterministic PNG evidence 时：

```bash
npm run ui:verify:raster
```

Deterministic raster 会 stub Base UI / Remix Icon，仅作为结构和静态视觉补充证据，不替代真实浏览器 E2E。当前交付实际验证边界见 `VERIFICATION.md`。

## 目录

```text
src/
  components/ui/       COSS/Base UI-backed primitives
  features/
    repositories/
    releases/
    forks/
    lists/              Star 内嵌 GitHub Lists 管理能力
    discover/
    notifications/      底层兼容 UI 源文件，不进入当前一级路由
    settings/
  lib/
worker/
  auth.ts
  crypto.ts
  repository.ts
  v5.ts
migrations/
```
