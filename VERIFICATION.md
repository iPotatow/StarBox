# Verification

Date: 2026-09-15  
Version source: `package.json` (`0.1.0`)  
Branch: `main`

## Scope

This verification contract covers the engineering-optimization pass applied directly to `main`.

Intentionally excluded from this pass: changing the current default-login fallback behavior. Production deployments must still configure `LOGIN_USERNAME` / `LOGIN_PASSWORD` before exposing a public route.

## Implemented

### Sync and persistence

- Optimistic business mutations no longer force an immediate full `/api/bootstrap` after acknowledgement.
- IndexedDB persistence coalesces rapid changes and rewrites only entity stores whose references changed; device-preference-only updates do not rewrite the entity cache.
- GitHub Star snapshots persist to D1 in batches of up to 50 statements and emit one aggregate `repository / stars / sync` change per snapshot instead of one change-log write per repository. A complete snapshot still marks omitted repositories unstarred before the next Bootstrap.
- Repository cards use browser `content-visibility` with intrinsic sizing to defer offscreen layout/paint work for large Star collections.

### D1

Migration `0008_performance_and_retention.sql` adds:

- Star Bootstrap index: `(account_id, is_starred, updated_at DESC)`.
- Global Release ordering index.
- Processed-mutation retention index.
- Retention triggers for processed mutations, expired/revoked sessions, stale login rate-limit rows, activity history, and sync-change history.

### Build and repository hygiene

- Production build uses only locally installed dependencies resolved from the lockfile.
- Global npm package fallback and CDN/import-map runtime fallback were removed from the production build.
- Generated/runtime directories are ignored: `dist/`, `.test-build/`, `.ui-verify/`, `.browser-verify/`, `.wrangler/`, temporary Wrangler deploy configs, and source archive bundles.
- Previously tracked generated directories, the source archive ZIP, and the disconnected Notifications page source were removed from `main`.
- README / README.en / MANIFEST are aligned to the current five-destination IA: Star / Release / Fork / Discover / Settings. GitHub Lists are removed; Notifications remain an internal/backing capability only.
- Automated contracts were updated to assert the current deterministic-build, aggregate Stars sync, and removed-Notifications architecture instead of retired behavior.
- UI structural verification transpiles its own verification copy directly from `src`, normalizes relative ESM imports, and keeps production `dist` bundle-only; no legacy `dist/src` tree is required.

### CI and observability

- `.github/workflows/ci.yml` runs `npm ci` followed by `npm run check:installed` on `main` and pull requests.
- A second CI job renders deterministic verification pages in real Chromium at desktop viewports for all five routes and mobile viewports for Star and Settings; screenshots are uploaded as workflow artifacts.
- Cloudflare Workers observability is enabled with a 10% head sampling rate.
- `workers_dev` remains `false`.

## Required automated gate

The current CI contract is:

```bash
npm ci
npm run check:installed
```

`check:installed` includes installed-package type checking, automated tests, deterministic production build, and five-route structural UI verification.

The browser job additionally installs Chromium through Playwright and renders the generated verification pages. This proves the verification HTML can be rendered by a real browser at the configured desktop/mobile viewports; it is not a claim of full live-Worker interaction E2E.

## Production boundary

Not covered by repository CI:

- Cloudflare production D1 migration execution against a real deployment.
- Production Secrets / custom-domain smoke.
- External GitHub API behavior under a real production token beyond the existing automated contracts.

Before exposing a public custom domain, configure a non-default login password and the credential encryption keys documented in the README.
