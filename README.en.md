# StarBox

English · [简体中文](README.md)

> A self-hosted GitHub workspace to organize starred repositories, follow releases and forks, and discover projects worth watching.

StarBox is built for one GitHub account with React, Cloudflare Workers, and D1. Deploy it to your Cloudflare account to sign in from multiple devices and sync account data between them.

## What it does

| Page | Purpose |
| --- | --- |
| **Star** | Search and organize starred repositories with categories, language, and sorting filters. Subscribe to releases, read repository details and READMEs, and use AI summaries, tags, categorization, and batch analysis. |
| **Release** | Sync releases from subscribed repositories and browse them as a timeline or by repository. Filter by version range, platform, and asset type. |
| **Fork** | Track existing forks, their ahead/behind status against upstream, and the latest GitHub Actions run. Sync from upstream or manually run a workflow. |
| **Discover** | Search GitHub for popular, active, or recent repositories; filter by language, topic, and time range; and star repositories directly. |
| **Settings** | Connect GitHub and an optional AI service, manage categories, appearance, navigation, release rules, and data import/export. |

StarBox does not provide Gist management or fork creation.

## Running app

<p align="center">
  <img src="./assets/readme/starbox-ui.jpg" width="100%" alt="Screenshot of the running Star page with local demo repositories; the current UI labels are in Chinese." />
</p>

Captured from a locally running StarBox Worker + D1 instance with demo repositories.

## Data and credentials

- The Worker encrypts GitHub tokens with AES-256-GCM before storing them in D1. AI API keys and custom headers are encrypted in D1 as well. Safe API responses and Bootstrap never return these credentials in plaintext.
- Account data in D1 includes business settings, repository categories and notes, release subscriptions and sync state, and fork state.
- Theme, density, accent color, navigation order, and page size are device preferences. IndexedDB is a local cache, not the source of truth for account data. Cache persistence rewrites only entity stores that changed instead of rewriting the whole cache for ordinary UI state changes.
- Login uses a secure cookie and rate-limits attempts. Mutating requests validate the same-origin `Origin` and JSON content type.
- D1 retention cleanup removes expired sessions, old mutation-idempotency records, stale login-rate-limit rows, activity history, and sync-change history.

## Sync and performance

- Star sync reads up to 3,000 GitHub Stars. D1 persistence is batched in groups of up to 50 rows and records one sync revision/change instead of one transaction and change-log record per repository.
- Normal optimistic mutations no longer trigger an immediate full Bootstrap after server acknowledgement. Bootstrap remains the authoritative reconciliation path.
- Star cards use browser `content-visibility` so offscreen cards can defer layout and paint work in large collections.
- D1 includes indexes for the Star Bootstrap path, global Release ordering, and mutation retention.

## Deploy to Cloudflare

From the repository root, install dependencies and authenticate Wrangler with the Cloudflare account you intend to deploy to. For a first-time login, run `npx wrangler login`; in CI, provide Wrangler's `CLOUDFLARE_API_TOKEN`. Then run:

```bash
npm install
npm run deploy
```

`npm run deploy` runs `npm run check` first. After checks pass, the deployment script verifies Cloudflare authentication and account access, looks for a D1 database whose name exactly matches `starbox`, creates it if absent, and lists databases again to obtain Cloudflare's actual UUID. It writes a temporary Wrangler config in the repository root, applies all unapplied remote migrations to that database through the `DB` binding, then deploys the Worker and static assets with the same temporary config. The temporary file is removed at the end. You do not need to enter a database UUID in `wrangler.jsonc`, and the deployment script does not rewrite that tracked file. If Wrangler exposes multiple Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID` to the intended account ID.

`workers_dev` remains `false`. Workers Logs are enabled in `wrangler.jsonc` with a 10% head sampling rate. After deployment, configure a custom domain or route in the Cloudflare Worker settings to make StarBox reachable at a public address. Set the production login password and encryption keys before adding that route. You can use the Cloudflare Dashboard or `npx wrangler secret put <NAME>`; changing a Secret immediately deploys a Worker version.

| Variable | Purpose and default |
| --- | --- |
| `LOGIN_USERNAME` | Login username; defaults to `admin`. A custom value is recommended in production. |
| `LOGIN_PASSWORD` | Login password; defaults to `000000`. Set a strong production password. |
| `SESSION_TTL_SECONDS` | Session lifetime; defaults to `604800` seconds (7 days). |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | AES-256 key for GitHub tokens; required before connecting GitHub and storing credentials, and must be 32 bytes. |
| `STARBOX_CREDENTIAL_ENCRYPTION_KEY` | Recommended separate AES-256 key for AI credentials. If omitted, the GitHub key is used for compatibility. |

Key rotation supports the corresponding `*_VERSION` and `*_PREVIOUS` variables. Never put secrets in the repository or `wrangler.jsonc`.

Once the Worker is deployed, production secrets are configured, and a custom domain or route is attached, sign in to StarBox and connect GitHub in Settings. Configure an AI service if you want to use AI features.

References: [D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## Local development and verification

```bash
npm install
npm run check
npm run dev
```

Production builds use only dependencies installed from `package-lock.json`. Missing local build dependencies fail the build instead of falling back to globally installed packages or CDN import maps.

`npm run check` runs type checking, tests, a build, and deterministic structural checks for the five main routes. GitHub Actions additionally runs `npm ci` + `npm run check:installed` and renders the verification pages in real Chromium at desktop and mobile viewports; screenshots are stored as workflow artifacts. `npm run dev` starts a static UI preview; `/api/*` returns 501, so Worker APIs are not available there. Full API integration requires Wrangler, local D1 migrations, and local credential configuration.

Generated directories `dist/`, `.test-build/`, `.ui-verify/`, `.browser-verify/`, `.wrangler/`, and source archive bundles are not tracked.

## Stack and third-party components

React 19, TypeScript, `@base-ui/react`, Tailwind CSS 4, Cloudflare Workers, Static Assets, D1, and Wrangler. UI primitives adapt the [COSS](https://github.com/cosscom/coss) `apps/ui` scope (MIT); behavior primitives use [Base UI](https://github.com/mui/base-ui) (MIT), and icons use [Remix Icon](https://github.com/Remix-Design/RemixIcon) (Apache-2.0).
