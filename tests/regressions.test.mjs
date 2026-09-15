import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

test("authentication never mutates D1 schema at request time", () => {
  const source = readFileSync(new URL("../worker/auth.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bPRAGMA\b/i);
  assert.doesNotMatch(source, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(source, /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i);
  assert.doesNotMatch(source, /repairSessionSchema|ensureSessionSchema|SchemaRepair/);
});

test("D1 migrations are contiguous and device schema is owned by migration 0007", () => {
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const numbers = files.map((name) => Number(name.slice(0, 4)));
  assert.ok(numbers.length > 0);
  assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, index) => index + 1));

  const migration = readFileSync(new URL("../migrations/0007_devices_and_ai_services.sql", import.meta.url), "utf8");
  for (const column of ["device_id", "device_name", "device_type", "os", "browser", "ip_address", "country_code", "region", "city", "user_agent"]) {
    assert.match(migration, new RegExp(`ALTER TABLE app_sessions ADD COLUMN ${column}\\b`));
  }
});

test("package deploy uses the migration-aware StarBox deploy script", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts.deploy, "npm run check && node scripts/deploy.mjs && node scripts/verify-deployment.mjs");
});

test("wrangler preserves dashboard text variables across deploys", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.keep_vars, true);
  assert.equal(config.workers_dev, false);
});
