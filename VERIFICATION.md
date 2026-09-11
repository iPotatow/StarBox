# Verification

Date: 2026-09-11  
Version: 0.5.0

## Verification policy

StarBox 区分两种验证环境：

1. **Packaging-container gate — `npm run check`**  
   当前打包容器无法连接 npm registry，因此前端类型检查明确使用隔离生成的 fallback 声明，构建明确使用 import-map fallback。这个结果用于验证源码、Worker、状态迁移、合同与六路 UI 输出，但**不等同于干净安装验证**。
2. **Installed-package gate — `npm run check:installed`**  
   正常联网环境在 `npm install` 后执行。该命令要求真实 React / React DOM / Remix Icon 类型存在，否则直接失败；构建会使用本地 esbuild bundle。

## Final packaging-container result

Executed after the 0.5.0 integration patch:

```bash
npm run check
```

Result:

- Typecheck command: **PASS**, explicitly reported as fallback-shim mode
- Automated tests: **PASS, 50/50**
- Build: **PASS**, explicitly reported as `fallback import-map mode`
- UI verification: **PASS**, six routes
- Removed-feature-family source/document scan: **PASS, zero matches**
- `workers_dev: false`: verified by contract test
- Gist runtime routes/navigation: absent by deliberate product decision

A real `npm install --no-audit --no-fund` was attempted again during this delivery and timed out because the execution container still cannot reach the npm registry. Therefore this document does **not** claim that `npm run check:installed` passed inside the packaging container.

## Automated coverage — 50 tests

The suite covers:

- repository full-name validation
- custom HTTP Provider endpoint and optional-header validation
- Worker health
- single Star / remove Star
- batch Star / batch remove Star
- Release normalization and detail lookup
- partial Release failure handling
- incremental Release filtering
- Fork creation, pending / ready status and error feedback
- full Fork inventory enrichment
- upstream ahead / behind comparison
- latest GitHub Actions run normalization
- one-click upstream `merge-upstream` sync
- GitHub API Rate Limit normalization
- exhausted-rate mapping with diagnostics
- plain permission-denied mapping
- Watching import source API
- README raw-content API
- GitHub Lists retrieval and membership replacement semantics
- Discover GitHub Search query construction
- custom Provider connection and repository organization parsing
- v4 → v5 state migration and backup retention
- v5 localStorage AI-secret retention with GitHub-token stripping
- migration verify checksum/counts request contract
- non-GET JSON request contract, including empty DELETE/PUT bodies
- cloud credential hydration with empty GitHub token
- Worker deployment configuration contract
- UI capability contracts for all 0.5.0 product surfaces, including login, Activity, Notifications, horizontal Stars categories and exact Content Surface CSS
- React/CSS/test-config compatibility contracts
- installed-build local bundle / offline fallback contract
- deliberate absence of Gist routes and navigation

## UI verification

`npm run ui:verify` compiles the production React source and production Tailwind CSS, renders deterministic v5 state, and checks these routes:

- `/` — Stars
- `/releases` — Release
- `/forks` — Fork
- `/lists` — GitHub Lists
- `/discover` — Discover
- `/settings` — Settings

The harness also rasterizes the rendered output to PNG with WeasyPrint + pdftoppm when available. The six final PNGs are preserved in the separate UI-verification archive.

The execution container still cannot run a reliable native Chromium/Playwright session for this app, so this is a deterministic render + rasterization fallback rather than a browser E2E claim. API/interaction behavior is covered by the automated Worker/storage/contract tests; production browser verification should be repeated after a real install/deploy.

## Clean-install handoff

In a normal networked environment, run exactly:

```bash
npm install
npm run check:installed
```

Expected strict behavior:

- `typecheck:installed` loads installed package types and refuses fallback
- 50 automated tests pass
- `npm run build` uses local esbuild and reports `bundled local dependencies`
- `dist/app.js` contains the frontend dependency bundle
- six-route UI verification passes

Only after this strict command passes should a specific machine/environment be described as clean-install verified. This repository does not claim that a production deployment was executed.

## Deployment handoff

After the strict installed-package gate, configure the `DB` D1 binding, apply the `migrations/` directory, and set `LOGIN_USERNAME`, `LOGIN_PASSWORD`, `GITHUB_TOKEN_ENCRYPTION_KEY` plus any rotation variables before deployment:

```bash
npm run deploy
```

Cloudflare setup must provide a custom domain or route. The repository intentionally keeps `workers_dev: false`.
