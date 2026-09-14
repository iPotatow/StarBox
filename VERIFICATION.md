# Verification

Date: 2026-09-14
Version: 0.5.1
Variant: combined product polish + data/security hardening on user-provided `starbox.zip`

## Delivery scope

本轮基于用户最新 `starbox.zip`，仅在 `/mnt/data` 工作副本实施；未写 Git 仓库、未 commit、未 push、未创建 PR。产品整改与数据/安全整改合并为一个最终交付包。

固定边界：

- Repository / Release / Fork 详情继续使用 Modal/Dialog，不改右侧详情面板。
- `content-surface` 的结构、尺寸、padding、滚动容器、背景、边框与响应式 CSS 不改。
- `src/styles.css` 与用户最新 `starbox.zip` **字节级一致**。
- Star 继续使用 Card Grid，不增加 List view。

## Implemented scope

### IA / Product structure

- 一级导航收敛为 **Star / Release / Fork / Discover / Settings**。
- GitHub Lists 从一级页面回归 Star：Toolbar 列表筛选 + 内嵌“管理列表” Modal。
- Notifications 退出一级导航、App route 与 Bootstrap 数据面；底层表/API 暂保留兼容/内部事件能力。

### Star

- Repository title 强制左对齐；卡片操作左对齐。
- 保留纯定位 Checkbox wrapper，圆形 Checkbox 本体不再承担 absolute 定位，避免 Indicator/focus 错位。
- Language GitHub Linguist 风格颜色点；Star count 使用空心 Star。
- Pin / 置顶已从产品 UI/client model/filter/sort/editor 中移除。
- 星标时间 / 活跃时间 / Star 数量支持独立正序/倒序。
- 选择模式使用强调色 `rounded-[100px]` 浮动栏，固定顺序：已选 / 全选 / 订阅 / AI 分析 / 分类 / 取消 Star / ×。
- 分类在菜单中即时应用；AI batch 支持暂停/继续、停止与失败重试。

### Repository Detail / README

- Detail 保持 Modal，宽度 `max-w-6xl`。
- README lazy load；Markdown 支持常见 GitHub README 结构、表格、任务列表、图片、相对链接/图片等；不执行 raw HTML。

### Release

- 单一 Toolbar：搜索 / 仓库 / 视图 / 版本范围 / `Assets`。
- 移除 Toolbar 的 Asset settings 齿轮和独立 Asset quick-filter row。
- 版本范围统一为全部 / 稳定 / 每仓库最新 / 每仓库最新稳定。
- `Assets` 单一 Menu 处理平台与文件类型。
- Release Detail 保持 Modal。

### Fork / Copy

- 上游/领先/落后/最近一次 Action 等产品语言替代普通 UI 中的工程术语。
- Workflow raw result 映射为成功 / 失败 / 运行中 / 无运行记录。
- `workflow_dispatch` 协议词下沉；高级参数使用“高级设置 · 输入参数”。
- Fork Detail 保持 Modal。

### Settings / data ownership

- Settings `max-w-7xl`，横向 sticky underline Tabs；Section 使用标题/说明在上、控件在下。
- AI API Key + custom headers：Worker AES-GCM → D1 `ai_credentials`；GET/Bootstrap 不返回明文。
- AI 服务名称 / 地址 / 模型：D1 `app_preferences`。
- Release 获取范围、包含/排除文件名规则：D1 `app_preferences`。
- Theme / Density / Accent / nav order / page size 等设备显示偏好继续本地。
- Legacy browser AI secret 支持一次性迁移；云端确认凭据后本机运行时及后续 snapshot 清除明文。
- Star / Lists / Release 最近同步时间由 D1 sync state / bootstrap summary 提供。
- 新 migration：`0005_ai_credentials_and_preferences.sql`。

### Product Copy

普通 UI 已重点清理 Worker、D1、membership、divergence、Provider、Regex、localStorage、IndexedDB、workflow_dispatch 等实现语言；保留 GitHub Actions / Workflow / Token / JSON 等用户任务直接相关或正式能力名称。

## Automated verification

Final commands executed:

```bash
npm run check
npm run ui:verify:raster
```

Results:

- `npm run check`: **PASS**
- Typecheck: **PASS in fallback-shim mode**
- Automated tests: **99/99 PASS**
- AI credential dynamic security test: **PASS**
  - D1 ciphertext does not contain plaintext API Key
  - safe GET does not return `apiKey` / `headers`
  - normal Repository AI request does not send browser secrets
  - Worker decrypts D1 credential and applies Authorization/custom headers to provider request
- Build: **PASS in fallback import-map mode**
- Deterministic structural UI verification: **PASS, 5 authenticated routes**
- Deterministic raster command: **PASS, 5 routes**
- `workers_dev: false`: unchanged

## Frozen contract verification

- Repository Detail: Modal ✅
- Release Detail: Modal ✅
- Fork Detail: Modal ✅
- `content-surface`: unchanged ✅
- `src/styles.css`: byte-identical to latest uploaded `starbox.zip` ✅
- `src/styles.css` SHA-256: `643330a08a3b52101d9900e5d82427403fa8d48daabeab65e452edda419a16db` ✅
- Git repository write: none ✅

## Rendered QA boundary

- Browser plugin is not available in this session.
- Project Playwright is not installed in the current workspace, so regular Playwright E2E could not be run without adding dependencies; no new browser dependency was installed.
- `ui:verify:raster` uses a deterministic SSR harness and stubs Base UI / Remix Icon. Its output is useful for structural/static visual regression, but **is not claimed as real-browser interaction or pixel-fidelity proof**.
- `check:installed` is not claimed because this execution path used the repository's explicit fallback-shim/fallback-import-map mode.
- Cloudflare production D1 / Secrets / custom-domain smoke was not run.

## Remaining production gates

Before production deployment:

1. In a normal installed-dependency environment run `npm install && npm run check:installed`.
2. Apply all D1 migrations, including `0005_ai_credentials_and_preferences.sql`.
3. Configure `LOGIN_PASSWORD`, `GITHUB_TOKEN_ENCRYPTION_KEY`, and preferably a distinct `STARBOX_CREDENTIAL_ENCRYPTION_KEY`.
4. Run real-browser E2E for Base UI Menu/Select/Dialog/Tooltip positioning, Star selection/batch flows, Lists-in-Star Modal, README Markdown, Release Assets Menu and Settings narrow-window behavior.
5. Run Cloudflare production smoke on D1 + Secrets + custom domain.
