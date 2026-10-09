<div align="center">

# StarBox

**Turn GitHub Stars, Releases, Forks, and AI into a developer workspace you own.**

Self-hosted on Cloudflare Workers, with your data stored in your own D1 database.

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · English

</div>

<p align="center">
  <img src="assets/readme/starbox-ui.jpg" width="100%" alt="StarBox — a self-hosted GitHub developer workspace" />
</p>

## What is StarBox?

GitHub Stars are great for saving repositories. The harder part comes later: finding a tool again, noticing a new release, keeping notes and categories organized, checking whether a fork is behind, and giving an AI assistant enough context to help.

StarBox brings those workflows into one personal workspace. It is built for developers who want to maintain their GitHub collection over time: the UI and API run on Cloudflare Workers, account data lives in D1, IndexedDB provides local caching, and AI stays optional so the core Stars, Releases, and Forks workflows work without it.

## Why StarBox?

StarBox is not another GitHub home page. It is the personal workflow layer that comes after GitHub: **organize after you star, read after you subscribe, and maintain after you fork.**

## What you get

- **Turn Stars into a maintained collection** — search, filter, categorize, take notes, read READMEs, and optionally use AI summaries, tags, and batch organization.
- **Keep up with project changes** — aggregate subscribed Releases, browse history, identify useful install assets, and track how existing Forks compare with upstream together with recent Actions runs.
- **Give your collection to AI** — use native Cloudflare Workers AI or HTTP providers such as OpenAI Compatible, Anthropic Messages, and Google Gemini; connect external assistants through MCP to read your collection and, when permitted, edit notes, categories, and tags.

## Quick start

You need Node.js, npm, and a Cloudflare account with access to **Workers + D1**.

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

After the first deployment:

1. Configure a **Custom Domain or Route** for the `starbox` Worker in Cloudflare. `workers.dev` is disabled by default.
2. Set the login password and credential-encryption key:

   ```bash
   npx wrangler secret put LOGIN_PASSWORD
   npx wrangler secret put STARBOX_ENCRYPTION_KEY
   # Optional: the default username is admin
   npx wrangler secret put LOGIN_USERNAME
   ```

3. Open StarBox, go to **Settings**, connect a GitHub Token, and add an AI model service only if you want AI features.

`npm run deploy` detects or creates the `starbox` D1 database and handles supported initialization / upgrade paths automatically, so you do not need to enter a database UUID manually. Back up D1 and keep the existing `STARBOX_ENCRYPTION_KEY` before upgrading an existing instance.

If your Cloudflare login has access to multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` before deployment to choose the target account.

## AI: optional, but ready to use

StarBox already declares the Cloudflare `AI` binding. After deployment, add **Cloudflare Workers AI** under **Settings → AI** to use repository organization, batch organization, and Release summaries without storing another AI API key. Custom HTTP providers remain supported.

The official daily Workers AI usage panel is optional and requires separate read-only Cloudflare Account Analytics credentials. See [WORKERS_AI.md](WORKERS_AI.md) for the full setup.

## MCP: connect your collection to an AI assistant

StarBox exposes a Streamable HTTP MCP endpoint at `/mcp`. Every connection has its own Bearer token, is read-only by default, and can be granted collection-edit permissions independently.

Available tools can search saved repositories, read repository details and READMEs, list categories and Releases, and—when allowed—update notes, categories, and tags. See [MCP.md](MCP.md) for configuration, tools, permissions, and security details.

## Data and security

- **Your data stays in your Cloudflare account** — business data lives in D1; IndexedDB is used for browser caching and local acceleration.
- **Sensitive credentials are encrypted** — GitHub Tokens, HTTP AI keys, and sensitive custom headers are encrypted by the Worker before being stored in D1, and safe read APIs never return plaintext credentials.
- **Writes use concurrency guards** — repository metadata uses revision checks to avoid overwriting newer changes; MCP edits reuse the same revision guard.

README and Release Markdown support GFM. Raw HTML is not executed.

## Current boundaries

- StarBox can maintain existing Forks, but it does not currently create new Forks.
- `npm run dev` is a static UI preview; `/api/*` and `/mcp` return 501. Use Wrangler with local D1 for full Worker development.
- MCP currently requires clients that support custom Bearer headers; OAuth-only clients are not supported.

## Development and verification

```bash
npm ci
npm run dev
```

Run the full project check before committing:

```bash
npm run check
```

It runs type checking, automated tests, a production build, and UI source gates. After production deployment, verify database, login, and encryption configuration with:

```bash
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

See [VERIFICATION.md](VERIFICATION.md) for the exact validation contract and boundaries.

## Technology and docs

**React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 · Base UI**

UI primitives follow [COSS](https://github.com/cosscom/coss)'s copy/paste-and-own model and are maintained inside this repository. Icons use [Phosphor Icons](https://phosphoricons.com/).

- [Workers AI](WORKERS_AI.md) — native AI binding, model services, and official usage analytics.
- [MCP](MCP.md) — assistant connections, permissions, tools, and security boundaries.
- [Verification contract](VERIFICATION.md) — automated checks, CI, and production validation.
- [Third-party notices](THIRD_PARTY_NOTICES.md) — dependency sources and license notices.

## About

Maintained by [iPotatow](https://github.com/iPotatow).

## License

This repository does not currently include a `LICENSE` file. Do not assume permission to copy, modify, or redistribute the project until a license is explicitly provided.
