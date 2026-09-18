<div align="center">

# StarBox

**A self-hosted GitHub workspace for organizing Stars, Releases, Forks, and the projects worth discovering next.**

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

English · [简体中文](README.md)

</div>

<p align="center">
  <img src="./assets/readme/starbox-ui.jpg" width="100%" alt="StarBox running locally with demo repositories on the Star page." />
</p>

StarBox is for developers who want a durable way to maintain their GitHub information stream. It brings starred repositories, releases, existing forks, and project discovery into one workspace, while account data lives in a self-hosted Cloudflare Worker + D1 deployment that can be used from multiple devices.

## What you get

| Page | What it helps with |
| --- | --- |
| **Star** | Search and organize starred repositories with category, language, and time filters; read READMEs, subscribe to releases, and use AI summaries, tags, categorization, and batch analysis. |
| **Release** | Aggregate releases from subscribed repositories into a timeline or repository view, with filters for version range, platform, and asset type. |
| **Fork** | Track existing forks against upstream, including ahead/behind status and the latest GitHub Actions run; sync upstream or run a workflow manually. |
| **Discover** | Search GitHub for popular, active, or recent repositories, filter by language, topic, and time range, then star them directly. |
| **Settings** | Connect GitHub and an optional AI service, and manage categories, appearance, navigation, release rules, and data import/export. |

StarBox intentionally does not provide Gist management or fork creation, keeping the workspace focused on maintaining and discovering repositories.

## Why self-host it

- D1 is the source of truth for account data; IndexedDB is a local acceleration cache, not a replacement for server state.
- The Worker encrypts GitHub tokens, AI API keys, and custom headers with AES-256-GCM before storing them in D1. Safe API responses and Bootstrap never return plaintext credentials.
- Login uses a secure cookie and rate-limits attempts. Mutating requests validate the same-origin `Origin` and JSON `Content-Type`.
- Star sync reads up to 3,000 repositories, persists D1 rows in batches of up to 50, and uses indexes for Bootstrap, release ordering, and retention cleanup.

## Quick start

### Local development

```bash
npm install
npm run check
npm run dev
```

`npm run check` runs type checking, tests, a production build, and deterministic UI verification for the five main routes. `npm run dev` starts a static UI preview; `/api/*` returns 501, so full API integration requires Wrangler, local D1 migrations, and local credentials.

### Deploy to Cloudflare

Install dependencies and authenticate with the Cloudflare account you intend to use:

```bash
npm install
npx wrangler login
npm run deploy
```

The deployment script runs `npm run check`, finds or creates a D1 database whose name exactly matches `starbox`, applies unapplied remote migrations, and deploys the Worker and static assets with a temporary Wrangler config. The tracked `wrangler.jsonc` does not need a database UUID and is not rewritten by the script.

If Wrangler exposes multiple Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID`. Production deployments also need login settings and encryption keys configured in the Cloudflare Dashboard or with `npx wrangler secret put <NAME>`:

| Variable | Purpose and default |
| --- | --- |
| `LOGIN_USERNAME` | Login username; defaults to `admin`. A custom value is recommended in production. |
| `LOGIN_PASSWORD` | Login password; defaults to `000000`. Set a strong password before public access. |
| `SESSION_TTL_SECONDS` | Session lifetime; defaults to `604800` seconds (7 days). |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | AES-256 key for GitHub tokens; required before connecting GitHub and must be 32 bytes. |
| `STARBOX_CREDENTIAL_ENCRYPTION_KEY` | Separate AES-256 key for AI credentials; if omitted, the GitHub key is used for compatibility. |

Key rotation supports the corresponding `*_VERSION` and `*_PREVIOUS` variables. Never put secrets in the repository or `wrangler.jsonc`. After deployment, attach a custom domain or Worker route before exposing the app publicly.

## Sync and performance

Normal mutations do not trigger an immediate full Bootstrap after server acknowledgement; Bootstrap remains the authoritative reconciliation path. The browser persists only changed IndexedDB entity stores and coalesces rapid writes. Star cards use `content-visibility` to defer offscreen layout and paint work in large collections.

D1 retention cleanup removes expired sessions, mutation-idempotency records, login-rate-limit rows, activity history, and sync-change history. Workers Logs are enabled with 10% head sampling, and `workers_dev` remains `false`.

## Stack

React 19, TypeScript, `@base-ui/react`, Tailwind CSS 4, Cloudflare Workers, Static Assets, D1, and Wrangler. UI primitives adapt the [COSS](https://github.com/cosscom/coss) `apps/ui` scope (MIT); behavior primitives use [Base UI](https://github.com/mui/base-ui) (MIT), and icons use [Remix Icon](https://github.com/Remix-Design/RemixIcon) (Apache-2.0).

## Related documentation

- [Verification contract](VERIFICATION.md): automated gates, CI, and production boundaries.
- [Third-party notices](THIRD_PARTY_NOTICES.md): dependency and license notes.
- [D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
