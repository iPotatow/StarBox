<div align="center">

# StarBox

**Turn GitHub bookmarks into your own developer workspace.**

Organize Stars, follow Releases, and maintain Forks. Self-hosted on Cloudflare Workers, with your data in D1.

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · English

</div>

Starring a repository is easy. The work comes later: finding that tool again, remembering why you saved it, and keeping up with new versions. StarBox brings those tasks together for developers who want to maintain their GitHub collection over time.

- **Find and organize what you saved**: search repositories, descriptions, topics, and notes; keep your own categories and read READMEs in place.
- **Follow project changes**: subscribe to Releases, browse version history, find installers for your platform, and inspect existing Forks against upstream and recent Actions runs.
- **Use AI when it helps**: generate summaries, categorize repositories, or organize in batches. Connect external assistants through MCP with separate read and edit permissions. AI is optional.

## Quick start

You need **Node.js 22**, npm, and a Cloudflare account with access to **Workers + D1**.

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

The deployment script detects or creates the D1 database and handles supported initialization and upgrade paths. No database UUID needs to be entered manually.

After the first deployment:

1. Configure a **Custom Domain or Route** for the `starbox` Worker. `workers.dev` is disabled by default.
2. Set the login password and credential-encryption key:

   ```bash
   npx wrangler secret put LOGIN_PASSWORD
   npx wrangler secret put STARBOX_ENCRYPTION_KEY
   # Optional: the default username is admin
   npx wrangler secret put LOGIN_USERNAME
   ```

3. Sign in, choose **Connect GitHub** on the Stars page, verify your Token, and sync your Stars. Connections are also available under **Settings → Account & GitHub**.

For multiple Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID` before deployment. Back up D1 and keep the existing `STARBOX_ENCRYPTION_KEY` when upgrading an instance.

## From bookmarks to a workspace

<img src="assets/features.webp" alt="StarBox interface example: repository collection, categories, topics, and Release subscriptions" width="100%">

StarBox syncs your collection after you connect GitHub. Categories, notes, and subscriptions live in D1; IndexedDB provides a browser cache. Existing collections remain available for browsing and local search while disconnected.

The connection dialog links to **Create a Token on GitHub** and **Configure permissions**. Fine-grained and Classic tokens are supported; set an expiration date. Fine-grained tokens use **Starring → Read-only** to sync Stars, or **Read and write** to also unstar repositories. Include private repositories in the token scope; reading their Actions status also requires **Actions → Read-only**. See the [GitHub permission reference](https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user).

## Optional AI and MCP

| Capability | Get started |
| --- | --- |
| Cloudflare Workers AI | Add a service under **Settings → AI**, without storing an extra AI API key |
| Custom model services | Use HTTP providers including OpenAI Compatible, Anthropic Messages, and Google Gemini |
| External assistants | Connect to `/mcp` with an independent Bearer Token; read-only by default, with separate edit permission |

MCP supports collection search, repository and README reading, category and Release queries, and authorized note, category, and tag edits. The official daily Workers AI usage panel needs separate read-only analytics credentials. See [Workers AI](WORKERS_AI.md) and [MCP](MCP.md) for setup.

## Data and boundaries

- The Worker encrypts GitHub Tokens, HTTP AI keys, and sensitive headers before storing them in D1. Read APIs do not return plaintext credentials.
- Repository metadata uses revision checks to avoid overwriting newer edits. MCP writes use the same concurrency guards.
- README and Release Markdown support GFM. Raw HTML is not executed.
- StarBox maintains existing Forks; it does not create new Forks.
- MCP clients need custom Bearer header support. OAuth-only connections are not currently provided.

## Local development and verification

```bash
npm ci
npm run dev
```

`npm run dev` serves a static UI preview at `http://127.0.0.1:4173`. Requests to `/api/*` and `/mcp` return 501. Use Wrangler and local D1 to test authentication, GitHub, or other business APIs.

```bash
npm run check
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

The full check runs types, automated tests, and a production build; `npm run coss:verify` is an optional manual UI audit. Live verification checks database, login, and encryption configuration; it is skipped without `STARBOX_DEPLOYMENT_URL`. Passing local checks does not mean a deployment has occurred.

## Docs and technology

**React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 · Base UI**

UI primitives follow [COSS](https://github.com/cosscom/coss)'s copy/paste-and-own model. Icons use [Phosphor Icons](https://phosphoricons.com/).

[Workers AI](WORKERS_AI.md) · [MCP](MCP.md) · [Verification scope](VERIFICATION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## License and maintainer

[MIT](LICENSE) · Maintained by [iPotatow](https://github.com/iPotatow).
