# Verification

Date: 2026-10-01
Version source: `package.json` (`0.1.1`)  
Development branch: `main`

## Scope

This document describes the current repository verification contract. Repository CI verifies source, automated tests, build output, and structural UI checks; it does not prove that a production Cloudflare deployment or production D1 migration has been completed.

## Current architecture contract

- StarBox uses React/TypeScript on the client, a Cloudflare Worker API, D1 for account/business state, and IndexedDB for browser-owned caches.
- Worker entry/routing, domain handlers and mutation planning are separate modules; client and Worker share contracts and preference/platform normalization without browser dependencies.
- Client request lifecycle cancels previous-session requests; Bootstrap waits for writes and repeats overlapping reads. Preference rule fields merge atomically with D1 JSON patches.
- Pages load on demand with recovery for failed chunks; hashed JS/CSS assets use immutable caching and build size reporting follows static imports.
- The production D1 model contains exactly eight product tables: `repositories`, `categories`, `forks`, `app_sessions`, `credentials`, `ai_services`, `ai_models`, and `settings`.
- D1 SQL is intentionally capped at exactly two files: `migrations/0001_schema.sql` (canonical final schema for an empty database) and `migrations/0002_legacy_upgrade.sql` (the single compatibility upgrade file for supported pre-0014 multi-table and retired consolidated single-user schemas).
- Repository identity uses stable `repository_id`, nullable unique numeric `github_repo_id`, and case-insensitive unique `full_name`.
- User-owned repository updates use `user_revision` optimistic concurrency. A 409 conflict keeps editable metadata drafts and rolls back failed batch subscription changes. Revision guards and all business writes share one D1 transaction; successful writes return the committed revision.
- Repository category protection uses `category_locked`; AI analysis cannot replace a protected manual category.
- AI analysis metadata records input hash, prompt version, model ID, and analysis time so unchanged analyses can skip provider work.
- Release bodies and assets remain browser-owned cache data. The latest Release AI summary is stored in D1 repositories and returned by Bootstrap.
- `processed_mutations`, `activity_log`, `sync_changes`, persisted `releases`, and the other retired compatibility tables are not restored.
- `workers_dev` must remain `false`.

Real SQL regression tests execute the canonical schema and production repository statements against SQLite, including repeated edits, mixed-revision batch rollback, preferences, credentials and device sessions. Migration fixtures execute empty initialization, retired multi-tenant and consolidated upgrades, the previous final schema upgrade, and ambiguous-name rejection with rollback. The mutation cap is 50 business statements plus one transaction revision guard.

## Security contract

- `LOGIN_USERNAME` defaults to `admin`.
- `LOGIN_PASSWORD` must be configured with a non-empty value. Missing configuration refuses login; there is no default-password fallback.
- `SESSION_TTL_SECONDS` controls session lifetime.
- `STARBOX_ENCRYPTION_KEY` is the only runtime credential-encryption setting. StarBox trims the value, derives the AES-256-GCM key through SHA-256, and uses it for GitHub tokens, AI keys, and sensitive custom headers.
- Bootstrap and credential APIs do not return plaintext secrets.
- Device identity uses a long-lived HttpOnly cookie; relogin atomically replaces the former session while preserving its custom name. Bowser, Client Hints and optional runtime checks provide display metadata only.
- Outbound GitHub requests are bounded to 30 seconds/8 MiB; AI requests to 60 seconds/2 MiB. AI redirects are rejected and known upstream error codes/statuses survive route handling.
- Production login throttling uses `LOGIN_RATE_LIMITER`; write requests validate same-origin and JSON content type.

## Required automated gate

The CI quality job runs:

```bash
npm ci
npm run check:installed
```

`check:installed` includes installed-package type checking, automated tests, a deterministic production build, and structural UI verification.

The Playwright interaction suite is available separately through `npm run test:browser` at desktop and mobile viewports; it is not currently a CI job. Browser smoke for changed interactions is not a substitute for a live production Worker/D1 smoke test.

## Local verification on 2026-10-01

- `npm run check:installed`: installed-package type checking, 198 automated tests, production build and COSS structural gate passed.
- `npm run test:browser`: 20 desktop/mobile interactions passed, including lazy-page load failure and reload recovery.
- Wrangler deployment dry run packaged Worker/static assets successfully. The portable binding interface was checked against Wrangler-generated bindings and current native Workers types.
- A real local Wrangler Worker and temporary D1 passed 13 runtime checks: health, login, consecutive revision acknowledgements, stale-write rejection and preservation, concurrent preference merges, device identity/name retention, session replacement and logout. Only temporary local state and test credentials were used.

These results cover the local implementation; external-provider credentials and production D1 were not exercised.

## Schema/deploy gate

The deployment script first runs `npm run check:installed`; a failed local gate stops before any remote D1 or Worker command. It does not use an ever-growing Wrangler migration chain. It requires exactly the two canonical SQL files, detects the remote D1 shape, and either initializes an empty database, upgrades a supported retired schema once, or performs no SQL when the database is already current. Unknown/intermediate shapes fail closed. The final eight-table schema is verified before Worker deployment. Current checks include:

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
