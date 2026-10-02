<div align="center">

# StarBox

**A personal GitHub workspace for starred repositories, releases, and forks.**

Self-host your workspace on Cloudflare Workers and D1.

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · English

[Features](#features) · [Quick start](#quick-start) · [Deployment configuration](#deployment-configuration)

</div>

<p align="center">
  <img src="assets/readme/starbox-ui.jpg" width="100%" alt="The StarBox Star page running with local demo repository data." />
</p>

As your starred repositories grow, finding a tool again, following releases, and checking whether a fork is behind upstream become recurring tasks. StarBox brings these workflows together: organize your collection, subscribe to releases, maintain existing forks, and discover your next project.

The frontend and API run on Cloudflare Workers, with account data stored in D1. Sign in on another device to continue using your categories, notes, and subscriptions. Configure AI analysis when you need it.

## Features

| Your workflow | What StarBox provides |
| --- | --- |
| **Find and organize stars** | Search starred repositories; filter by category, language, and time; read READMEs, add notes, and use AI summaries, tags, categorization, and batch analysis. |
| **Follow releases** | Browse the latest releases from subscribed repositories, search repositories, switch between historical versions, and get installation asset recommendations for your target device. AI summaries are available for the latest release. |
| **Maintain existing forks** | Check ahead / behind status and the latest Actions run, sync upstream, or manually trigger a workflow. |
| **Discover projects** | Search GitHub for popular, active, or recent repositories, filter by language, topic, and time range, and star them directly. |

Settings includes GitHub connections, AI services and models, categories, appearance, navigation, release rules, and data import / export. Gist management and fork creation are outside the current scope.

Choose Simplified Chinese, Traditional Chinese, or English in Settings or the desktop sidebar. Your language preference syncs across signed-in devices.

## Quick start

### Deploy your workspace

You need Node.js, npm, and a Cloudflare account with access to Workers and D1.

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

The deployment script runs project checks, finds or creates the D1 database named `starbox`, initializes or upgrades a supported schema, and deploys the Worker and static assets. You do not need to fill in a database UUID manually.

**Complete these steps for your first deployment:**

1. Attach a custom domain or route to the Worker; `workers.dev` is disabled by default.
2. Set non-empty `LOGIN_PASSWORD` and `STARBOX_ENCRYPTION_KEY` values. Optionally change the default username, `admin`.
3. Open your deployment, sign in, and connect a GitHub token in Settings. Add AI services and models if you want AI analysis.

### Deployment configuration

Set Worker secrets using the interactive commands:

```bash
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put STARBOX_ENCRYPTION_KEY
npx wrangler secret put LOGIN_USERNAME
```

| Variable | Purpose and default |
| --- | --- |
| `LOGIN_USERNAME` | Login username; defaults to `admin`. |
| `LOGIN_PASSWORD` | Required, non-empty. Missing configuration refuses login; there is no default password. |
| `STARBOX_ENCRYPTION_KEY` | Required, non-empty. Its trimmed value is derived through SHA-256 for AES-256-GCM credential encryption. |
| `SESSION_TTL_SECONDS` | Session lifetime; defaults to `604800` seconds (7 days). |

Keep secrets out of the repository and `wrangler.jsonc`. Set `CLOUDFLARE_ACCOUNT_ID` if your Cloudflare login has access to multiple accounts.

After configuring a public domain or route, verify the deployed service:

```bash
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

This checks the database, authentication configuration, and encryption configuration through `/api/health`. Remote verification is skipped when `STARBOX_DEPLOYMENT_URL` is unset. Local checks do not replace production verification.

### Database initialization and upgrades

The deployment script first runs `npm run check:installed`, then selects an operation based on the remote schema:

- Empty database: apply `migrations/0001_schema.sql` to create the final schema.
- Supported legacy schema: upgrade with `migrations/0002_legacy_upgrade.sql`, including legacy multi-table and consolidated single-user schemas.
- Current schema: no SQL is applied. Unknown or intermediate schemas stop deployment.

These are the only two SQL files maintained; they are not a sequential migration chain. The script verifies the final eight-table schema, relationships, JSON, data counts, and key query plans, then deploys using a temporary Wrangler configuration without rewriting the repository's `wrangler.jsonc`. Back up D1 and retain the existing encryption key before upgrading.

### Local preview and development

```bash
npm ci
npm run dev
```

The default preview URL is `http://127.0.0.1:4173`. This command builds and serves the static UI; `/api/*` returns 501. Full API development requires Wrangler, a local D1 schema, and local credential configuration.

Before submitting code, run:

```bash
npm run check
```

This uses real installed dependency types and runs automated tests, a production build, and structural UI checks without a browser runtime. CI runs the same checks on pushes to main, pull requests targeting main, and manual dispatch. UI interactions and live service integration require separate validation. See the [verification contract](VERIFICATION.md) for the full requirements.

## Own your workspace data

- **Continue across devices:** D1 stores account business data; IndexedDB provides browser caching and local acceleration.
- **Store credentials encrypted:** the Worker encrypts GitHub tokens, AI keys, and sensitive custom headers before writing them to D1. Credential APIs do not return plaintext secrets.
- **Connect AI as needed:** configure your own services and models in Settings for repository analysis and release summaries.

README and release content support Markdown and GFM; raw HTML is not executed.

## Synchronization and architecture

D1 contains eight product tables. Repository metadata uses `user_revision` for optimistic concurrency. Release bodies and assets are browser-owned cache data; the latest release AI summary is stored in D1. Star synchronization reads up to 3,000 repositories, with D1 business writes batched into at most 50 statements.

Successful writes do not immediately trigger a full Bootstrap. Bootstrap remains the authoritative account snapshot, waits for active writes, and refetches after overlapping writes. IndexedDB persists changed entity stores and coalesces rapid writes. Session changes cancel old requests, while editors retain the draft and revision captured when opened.

The five business pages load on demand. Star cards use `content-visibility` to defer offscreen layout and painting. Hashed entry, CSS, and page assets use immutable caching; failed page loads offer reload recovery.

Worker entry, routes, and business handlers are separate. `worker/routes` organizes domains, `worker/repositories` plans mutation SQL, and `worker/repository.ts` executes D1 transactions. `shared` defines client/server contracts, preference validation, and asset platform rules.

Login uses secure cookies and rate limits; writes validate same-origin requests and JSON content types. GitHub requests are limited to 30 seconds / 8 MiB; AI requests to 60 seconds / 2 MiB, with AI redirects rejected. Workers Logs sampling is enabled at 10%.

## Technology and documentation

React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1

UI components use [COSS](https://github.com/cosscom/coss)'s copy/paste-and-own model, with [Base UI](https://github.com/mui/base-ui) for interactions and [Phosphor Icons](https://phosphoricons.com/) for icons.

- [Verification contract](VERIFICATION.md): automated checks, CI, and production verification boundaries.
- [Third-party notices](THIRD_PARTY_NOTICES.md): dependency sources and licenses.

For bugs or feature suggestions, open an [issue](https://github.com/iPotatow/StarBox/issues) with reproduction steps and relevant environment details.

## MCP connections

Open **Settings → MCP** to create an independent, expiring token. Connect a client supporting Streamable HTTP and custom Bearer headers to `/mcp` to search your saved collection, read notes and READMEs, and query categories, subscriptions and releases. Connections start read-only; enable collection edits per connection to update notes, categories and tags with revision-conflict protection. View last-use times and revoke tokens in Settings. OAuth-only clients are not supported. See [MCP documentation](MCP.md).

## About and diagnostics

The About area at the bottom of Settings shows the app version, offers a reload when a new deployment is available, and copies build, service and browser diagnostics for issue reports. Diagnostics exclude passwords and connection credentials.
