# Verification

Date: 2026-09-20  
Version source: `package.json` (`0.1.1`)  
Development branch: `dev`

## Scope

This document describes the current repository verification contract. Repository CI verifies source, tests, build output, and browser interaction fixtures; it does not prove that a production Cloudflare deployment or production D1 migration has been completed.

## Current architecture contract

- StarBox uses React/TypeScript on the client, a Cloudflare Worker API, D1 for account/business state, and IndexedDB for browser-owned caches.
- The production D1 model contains exactly eight product tables: `repositories`, `categories`, `forks`, `app_sessions`, `credentials`, `ai_services`, `ai_models`, and `settings`.
- D1 SQL is intentionally capped at exactly two files: `migrations/0001_schema.sql` (canonical final schema for an empty database) and `migrations/0002_legacy_upgrade.sql` (the single compatibility upgrade file for supported pre-0014 multi-table and retired consolidated single-user schemas).
- Repository identity uses stable `repository_id`, nullable unique numeric `github_repo_id`, and case-insensitive unique `full_name`.
- User-owned repository updates use `user_revision` optimistic concurrency. A 409 conflict keeps the local draft; successful writes return the next revision.
- Repository category protection uses `category_locked`; AI analysis cannot replace a protected manual category.
- AI analysis metadata records input hash, prompt version, model ID, and analysis time so unchanged analyses can skip provider work.
- Release bodies, assets, and AI summaries remain browser-owned cache data. Server Release snapshots must preserve a browser-owned AI summary when merging.
- `processed_mutations`, `activity_log`, `sync_changes`, persisted `releases`, and the other retired compatibility tables are not restored.
- `workers_dev` must remain `false`.

## Security contract

- `LOGIN_USERNAME` defaults to `admin`.
- `LOGIN_PASSWORD` must be configured with a non-empty value. Missing configuration refuses login; there is no default-password fallback.
- `SESSION_TTL_SECONDS` controls session lifetime.
- `STARBOX_ENCRYPTION_KEY` is the only runtime credential-encryption setting. StarBox trims the value, derives the AES-256-GCM key through SHA-256, and uses it for GitHub tokens, AI keys, and sensitive custom headers.
- Bootstrap and credential APIs do not return plaintext secrets.
- Production login throttling uses `LOGIN_RATE_LIMITER`; write requests validate same-origin and JSON content type.

## Required automated gate

The CI quality job runs:

```bash
npm ci
npm run check:installed
```

`check:installed` includes installed-package type checking, automated tests, a deterministic production build, and structural UI verification.

The browser job builds the app, installs Chromium, and runs the Playwright interaction suite at desktop and mobile viewports. Browser smoke is required evidence for changed interaction behavior; it is not a substitute for a live production Worker/D1 smoke test.

## Schema/deploy gate

The deployment script does not use an ever-growing Wrangler migration chain. It requires exactly the two canonical SQL files, detects the remote D1 shape, and either initializes an empty database, upgrades a supported retired schema once, or performs no SQL when the database is already current. Unknown/intermediate shapes fail closed. The final eight-table schema is verified before Worker deployment. Current checks include:

- duplicate normalized category names;
- orphan repository/category, AI model/service, AI credential/service, and default-model references;
- repository/service/Fork JSON validity;
- expected foreign keys and delete behavior;
- preservation of repository/note/category/subscription/AI-result/credential counts across migration;
- key `EXPLAIN QUERY PLAN` index selection;
- absence of retired tables and retired repository columns.

The deployment process does not depend on disabling foreign keys with `PRAGMA foreign_keys=OFF`.

## Production boundary

Repository CI does **not** verify:

- execution of the canonical schema/legacy upgrade against the production D1 database;
- production secrets and custom-domain routing;
- a live login/health smoke against production;
- external GitHub or configured AI-provider behavior under production credentials.

Do not describe a `main` commit or green CI as a production deployment. Production status must be verified separately after the real deployment and any required D1 schema initialization/legacy upgrade.
