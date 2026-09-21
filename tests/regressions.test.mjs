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

test("D1 SQL is capped at one canonical schema and one legacy upgrade", () => {
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(files, ["0001_schema.sql", "0002_legacy_upgrade.sql"]);

  const schema = readFileSync(new URL("../migrations/0001_schema.sql", import.meta.url), "utf8");
  for (const column of ["device_id", "device_name", "device_type", "os", "browser", "ip_address", "country_code", "region", "city", "user_agent"]) {
    assert.match(schema, new RegExp(`${column} TEXT`));
  }
  assert.match(schema, /CREATE TABLE ai_services/);
  assert.match(schema, /CREATE TABLE ai_models/);
  assert.doesNotMatch(schema, /ai_task_bindings/);

  const upgrade = readFileSync(new URL("../migrations/0002_legacy_upgrade.sql", import.meta.url), "utf8");
  assert.match(upgrade, /DROP TABLE IF EXISTS releases/);
  assert.doesNotMatch(upgrade, /^\s*(?:PRAGMA\s+foreign_keys\b|CREATE\s+TEMP(?:ORARY)?\s+TABLE\b)/im);
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
