# Verification

Date: 2026-09-13
Version: 0.5.1
Variant: UI/UX Round 2 on `StarBox-0.5.1-uiux-polished.zip`

## Delivery scope

本轮直接基于用户重新上传的 `StarBox-0.5.1-uiux-polished.zip`，仅在 `/mnt/data` 工作副本实施；未写 Git 仓库、未 commit、未 push、未创建 PR。

固定边界继续保持：

- Repository / Release / Fork 详情继续使用 Modal/Dialog，不改右侧详情面板。
- `content-surface` 的结构、尺寸、padding、滚动容器设计、背景、边框与响应式 CSS 不改。
- `src/styles.css` 与本轮输入 ZIP **字节级一致**，SHA-256：`643330a08a3b52101d9900e5d82427403fa8d48daabeab65e452edda419a16db`。
- Star 继续使用 Card Grid；未引入 List view。

## Round 2 implemented scope

### Star / Repository Card

- 完整移除 Pin / 置顶产品能力：
  - Repository Card Pin action / Pin Badge 删除。
  - Repository Editor 的“置顶此仓库”删除。
  - Star 页面“已置顶”筛选与 pin-first 排序删除。
  - Client `RepositoryMeta.pinned` 删除。
  - D1 legacy `pinned` column 为兼容旧 schema 暂留；新的 metadata write 固定写 `0`，不再暴露为产品状态。
- 恢复 Star 排序正序/倒序 icon；三个维度为：星标时间 / 活跃时间 / Star 数量。默认倒序，`direction=asc` 可进入 URL state。
- Repository Card 多选框移除额外视觉 wrapper，并统一为圆形 Checkbox。
- Card action row 改为左对齐。
- Star count 图标由实心改为空心 Star。
- Language 前增加 GitHub Linguist 风格颜色 dot；未知语言回退 muted gray。
- Sidebar / mobile navigation / Settings Navigation 中的仓库入口由 `Stars` 改为 `Star`。

### Repository Detail / README

- Repository Detail 保持 Modal，但从 `max-w-3xl` 扩大为 `max-w-6xl`；README scroll area 同步扩容。
- README 仍在首次切换 README Tab 时 lazy load。
- Markdown renderer 增强支持：
  - H1–H6
  - fenced code
  - tables
  - unordered / ordered / task lists
  - blockquote / horizontal rule
  - image / linked image
  - absolute + repository-relative links/images
  - bold / italic / strikethrough / inline code
- Repository-relative README resources按当前 `full_name + default_branch` 解析。
- 不执行 raw HTML injection；HTML 仅安全降级，避免 XSS。

### Release Toolbar

- 删除旧的“Toolbar + 独立 Asset 快速过滤条”两层布局，收敛为一个 COSS Toolbar。
- Toolbar 当前顺序：Search → Repository → View → Version Scope → Asset Platform → Asset Type → Asset Rules。
- 原“仅最新 / 包含预发布”并列 Toggle 改为单一版本范围 Select：
  - 全部版本
  - 仅稳定版
  - 每仓库最新
  - 每仓库最新稳定版
- 底层继续复用既有 `latestOnly + includePrereleases`，不改 persisted state schema。
- Asset 平台 / 类型直接集成进 Toolbar；激活后显示“清除 Asset”；Regex 规则通过设置 icon 进入 Data 设置。
- Release Detail 继续使用 Modal。

### Settings layout

- Settings 页面外层内容宽度从 `max-w-5xl` 调整为与其他主要页面一致的 `max-w-7xl`。
- 横向 sticky underline Tabs 保留。
- Settings Section 删除旧 `200px + content` 左右双列，统一使用：**标题/说明在上，控件在下**。
- Field 继续 label/control 上下结构。
- Controls 区域限制 `max-w-5xl`，避免 API Key / Base URL 等输入框在超宽屏无意义拉伸，同时保持页面 shell 对齐。

## Regression contracts

- Star contract 要求正/倒序入口存在，并禁止 Pin action / Pin badge / filled Star 回归。
- Card contract 检查圆形多选定位、左对齐 action 与 GitHub language color helper。
- Detail contract 检查 `max-w-6xl` 与 repository-relative README image base。
- Release contract 检查版本范围 Select、Asset 快速过滤与单 Toolbar 新信息架构。
- Settings contract 检查 `max-w-7xl` 且禁止旧左右双列 Section。
- Worker metadata test 明确 legacy `pinned` column 新写入为 `0`。

## Automated verification

Executed in the extracted working copy:

```bash
npm run check
npm run ui:verify:raster
```

Results:

- `npm run check`: **PASS**
- Typecheck: **PASS in fallback-shim mode**
- Automated tests: **98/98 PASS**
- Build: **PASS in fallback import-map mode**
- Deterministic structural UI verification: **PASS, 7 authenticated routes**
- Deterministic raster command: **PASS, 7 routes**
- `workers_dev: false`: unchanged

## Visual evidence boundary

- 本轮没有可用的 Browser/IAB 插件，因此不宣称 real-browser E2E。
- Deterministic raster harness 会 stub Base UI / Remix Icon；其 PNG 能证明结构路径被渲染，但不能作为真实 Base UI popup/select/tab 布局或视觉 fidelity 的最终证据。
- 因此不把 deterministic raster 的控件几何偏差当成真实浏览器截图，也不宣称 agency-level browser fidelity 已验证。
- `check:installed` 未宣称：当前执行环境不提供项目真实 installed React/RemixIcon/Base UI package type gate。
- Cloudflare production smoke 未运行。

## Frozen contract verification

- Repository Detail: Modal ✅
- Release Detail: Modal ✅
- Fork Detail: Modal ✅
- `content-surface`: unchanged ✅
- `src/styles.css`: byte-identical to uploaded Round 2 baseline ✅
- `src/styles.css` SHA-256: `643330a08a3b52101d9900e5d82427403fa8d48daabeab65e452edda419a16db` ✅
- Git repository write: none ✅

## Remaining production gates

1. In a normal installed-dependency environment: `npm install && npm run check:installed`.
2. Real-browser E2E for Base UI Select/Tooltip/Dialog positioning, Star checkbox/toolbar/card actions, Repository README rendering, Release Toolbar overflow, Settings narrow-window behavior.
3. Cloudflare D1 + Secrets + custom-domain production smoke.
