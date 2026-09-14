# StarBox

English · [简体中文](README.md)

> A self-hosted GitHub workspace to organize starred repositories, follow releases and forks, and discover projects worth watching.

StarBox is built for one GitHub account with React, Cloudflare Workers, and D1. Deploy it to your Cloudflare account to sign in from multiple devices and sync account data between them.

## What it does

| Page | Purpose |
| --- | --- |
| **Star** | Search and organize starred repositories with categories, GitHub Lists, language, and sorting filters. Subscribe to releases, read repository details and READMEs, and use AI summaries, tags, categorization, and batch analysis. |
| **Release** | Sync releases from subscribed repositories and browse them as a timeline or by repository. Filter by version range, platform, and asset type. |
| **Fork** | Track existing forks, their ahead/behind status against upstream, and the latest GitHub Actions run. Sync from upstream or manually run a workflow. |
| **Discover** | Search GitHub for popular, active, or recent repositories; filter by language, topic, and time range; and star repositories directly. |
| **Settings** | Connect GitHub and an optional AI service, manage categories, appearance, navigation, release rules, and data import/export. |

StarBox does not provide Gist management or fork creation.

## Running app

<p align="center">
  <img src="./assets/readme/starbox-ui.jpg" width="100%" alt="Screenshot of the running Star page with local demo repositories; the current UI labels are in Chinese." />
</p>

Captured from a locally running StarBox Worker + D1 instance with demo repositories. The UI labels are currently in Chinese.

## Data and credentials

- The Worker encrypts GitHub tokens with AES-256-GCM before storing them in D1. AI API keys and custom headers are encrypted in D1 as well. Safe API responses and Bootstrap never return these credentials in plaintext.
- Account data in D1 includes business settings, repository categories and notes, release subscriptions and sync state, and fork state.
- Theme, density, accent color, navigation order, and page size are device preferences. IndexedDB is a local cache, not the source of truth for account data.
- Login uses a secure cookie and rate-limits attempts. Mutating requests validate the same-origin `Origin` and JSON content type.

## Deploy to Cloudflare

You need a Cloudflare Workers project and a production D1 database. The `database_id` in `wrangler.jsonc` is a placeholder and must be replaced before deployment.

1. Create a D1 database named `starbox`, set its real `database_id`, and apply every migration in `migrations/`:

   ```bash
   npx wrangler d1 migrations apply starbox --remote
   ```

2. Install dependencies and deploy the Worker and static assets:

   ```bash
   npm install
   npm run deploy
   ```

   `npm run deploy` runs `npm run check` before deploying with Wrangler.

3. Configure login and encryption keys in the Cloudflare Worker settings. You can also use `npx wrangler secret put <NAME>` after the Worker has been deployed; this command immediately creates and deploys a Worker version. **Set production credentials before enabling a public domain or route.**

   | Variable | Purpose and default |
   | --- | --- |
   | `LOGIN_USERNAME` | Login username; defaults to `admin`. Choose a custom value in production. |
   | `LOGIN_PASSWORD` | Login password; defaults to `000000`. Replace it in production. |
   | `SESSION_TTL_SECONDS` | Session lifetime; defaults to `604800` seconds (7 days). |
   | `GITHUB_TOKEN_ENCRYPTION_KEY` | AES-256 key for GitHub tokens; must be 32 bytes. |
   | `STARBOX_CREDENTIAL_ENCRYPTION_KEY` | Recommended separate AES-256 key for AI credentials. If omitted, the GitHub key is used for compatibility. |

   Key rotation supports the corresponding `*_VERSION` and `*_PREVIOUS` variables. Never put secrets in the repository or `wrangler.jsonc`.

4. Configure a custom domain or route for the Worker. `wrangler.jsonc` sets `workers_dev: false`, so it will not enable a public `workers.dev` subdomain.
5. Sign in to StarBox and connect GitHub in Settings. Configure an AI service if you want to use AI features.

References: [D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

## Local development and verification

```bash
npm install
npm run check
npm run dev
```

`npm run check` runs type checking, tests, a build, and deterministic structural checks for the five main routes. `npm run dev` starts a static UI preview; `/api/*` returns 501, so Worker APIs are not available there. Full API integration requires Wrangler, local D1 migrations, and local credential configuration. See [VERIFICATION.md](VERIFICATION.md) for the verification scope and known limitations.

## Stack and third-party notices

React 19, TypeScript, `@base-ui/react`, Tailwind CSS 4, Cloudflare Workers, Static Assets, D1, and Wrangler. UI primitives follow COSS's copy/paste-and-own model. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party sources and license boundaries.
