import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sqliteDatabase } from "./sqlite-fixture.mjs";

const baseline = readFileSync(new URL("../migrations/0001_schema.sql", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("../migrations/0002_legacy_upgrade.sql", import.meta.url), "utf8");
const [multi, consolidated, releaseAi] = upgrade.split(/-- STARBOX_UPGRADE_STAGE: (?:MULTI_TENANT|CONSOLIDATED|RELEASE_AI)/).slice(1);
// Stage-one output is the exact supported retired consolidated table shape.
const legacyDdl = [...multi.matchAll(/CREATE TABLE ([a-z_]+) \([\s\S]*?\n\);/g)].map(([ddl]) => ddl.replace(/_next/g, "")).join("\n");
const productTables = ["ai_models", "ai_services", "app_sessions", "categories", "credentials", "forks", "repositories", "settings"];
function finalShape(db) {
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name), productTables);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.ok(db.prepare("PRAGMA table_info(repositories)").all().some(row => row.name === "release_ai_summary_json"));
}

test("empty database initializes the canonical eight-table schema with real SQL", (t) => {
  const fixture = sqliteDatabase(baseline); t.after(fixture.close); finalShape(fixture.sqlite);
});

test("consolidated legacy upgrade preserves notes, subscriptions and encrypted credentials", (t) => {
  const { sqlite, close } = sqliteDatabase(legacyDdl); t.after(close);
  sqlite.exec("INSERT INTO categories VALUES ('cat', 'Tools', NULL, 0, 1, 'now', 'now')");
  sqlite.exec("INSERT INTO repositories (full_name, github_repo_id, name, html_url, category_id, note, release_subscribed, updated_at, raw_json) VALUES ('owner/tool', '42', 'tool', 'https://github.com/owner/tool', 'cat', 'keep note', 1, 'now', '{\"id\":42}')");
  sqlite.exec("INSERT INTO credentials VALUES ('github','github','42','owner','ciphertext','iv','v1','fingerprint','now','now','now','active')");
  sqlite.exec(`BEGIN; ${consolidated}\n${releaseAi}\nCOMMIT;`);
  finalShape(sqlite);
  const row = sqlite.prepare("SELECT * FROM repositories").get();
  assert.equal(row.note, "keep note"); assert.equal(row.release_subscribed, 1); assert.equal(row.github_repo_id, 42);
  assert.equal(sqlite.prepare("SELECT ciphertext FROM credentials").get().ciphertext, "ciphertext");
});

test("previous final schema adds Release AI columns without rebuilding user data", (t) => {
  const previous = baseline.split("\n").filter(line => !/^\s*release_ai_/.test(line)).join("\n");
  const { sqlite, close } = sqliteDatabase(previous); t.after(close);
  sqlite.exec("INSERT INTO repositories (repository_id,full_name,name,html_url,note,user_revision) VALUES ('id','a/b','b','https://github.com/a/b','preserved',7)");
  sqlite.exec(releaseAi); finalShape(sqlite);
  assert.equal(sqlite.prepare("SELECT user_revision FROM repositories").get().user_revision, 7);
});

test("legacy upgrade refuses ambiguous names and rolls back without losing source data", (t) => {
  const { sqlite, close } = sqliteDatabase(legacyDdl); t.after(close);
  for (const name of ["Owner/tool", "owner/tool"]) sqlite.prepare("INSERT INTO repositories (full_name,github_repo_id,name,html_url,note,updated_at) VALUES (?,?,'tool','https://github.com','keep','now')").run(name,name);
  sqlite.exec("BEGIN"); assert.throws(() => sqlite.exec(consolidated), /CHECK constraint/); sqlite.exec("ROLLBACK");
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM repositories").get().count, 2);
  assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='starbox_upgrade_guard'").get(), undefined);
});

test("multi-tenant compatibility stages preserve primary account metadata through real SQL", (t) => {
  const sourceTables = [...multi.matchAll(/CREATE TABLE ([a-z_]+) \([\s\S]*?\n\);/g)]
    .filter(([, name]) => !["credentials", "settings"].includes(name))
    .map(([ddl]) => ddl.replace(/_next/g, "").replace(/\(\n/, "(\n  account_id TEXT NOT NULL DEFAULT 'primary',\n")).join("\n");
  const extras = {
    repository_meta: "account_id,github_repo_id,category_id,note,ai_summary,ai_tags_json,ai_platforms_json,updated_at",
    release_subscriptions: "account_id,repo_full_name,created_at",
    release_sync_state: "account_id,repo_full_name,cursor,last_synced_at,updated_at",
    app_account: "account_id,github_user_id,github_login,updated_at",
    github_credentials: "account_id,github_numeric_id,github_login,ciphertext,iv,key_version,fingerprint,validated_at,created_at,updated_at,status",
    ai_credentials: "account_id,ciphertext,iv,key_version,fingerprint,created_at,updated_at,status",
    ai_service_credentials: "account_id,service_id,ciphertext,iv,key_version,fingerprint,created_at,updated_at,status",
    ai_task_bindings: "account_id,task,model_id,updated_at",
    app_preferences: "account_id,ai_provider_name,ai_base_url,ai_model,release_sync_pages,release_asset_include_pattern,release_asset_exclude_pattern,release_asset_rules_json,release_include_prereleases,ui_theme,ui_accent,ui_language,hidden_nav_json,github_avatar_url,updated_at",
  };
  const { sqlite, close } = sqliteDatabase(sourceTables + Object.entries(extras).map(([name, columns]) => `CREATE TABLE ${name} (${columns.split(",").map(column => `${column} TEXT`).join(",")});`).join("\n")); t.after(close);
  sqlite.exec("INSERT INTO categories (category_id,name,created_at,updated_at) VALUES ('cat','Tools','now','now')");
  sqlite.exec("INSERT INTO repositories (full_name,github_repo_id,name,html_url,updated_at,raw_json) VALUES ('owner/tool','42','tool','https://github.com/owner/tool','now','{\"id\":42}')");
  sqlite.exec("INSERT INTO repository_meta VALUES ('primary','42','cat','preserved note','summary','[]','[]','now')");
  sqlite.exec("INSERT INTO release_subscriptions VALUES ('primary','owner/tool','now')");
  sqlite.exec(`BEGIN; ${multi}\n${consolidated}\n${releaseAi}\nCOMMIT;`); finalShape(sqlite);
  const row = sqlite.prepare("SELECT note,release_subscribed FROM repositories").get();
  assert.equal(row.note, "preserved note"); assert.equal(row.release_subscribed, 1);
});
