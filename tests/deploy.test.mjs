import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deploy } from "../scripts/deploy.mjs";

const account = { id: "account-123", name: "StarBox account" };
const whoami = { loggedIn: true, accounts: [account] };
const silence = { log() {} };
const finalTables = ["repositories", "categories", "forks", "app_sessions", "credentials", "ai_services", "ai_models", "settings"];
const finalRepositoryColumns = ["repository_id", "full_name", "github_repo_id", "category_id", "category_locked", "note", "ai_summary", "ai_tags_json", "platforms_json", "release_subscribed", "github_updated_at", "github_pushed_at", "synced_at", "user_updated_at", "user_revision", "ai_analyzed_at", "ai_input_hash", "ai_prompt_version", "ai_model_id", "platform_checked_at", "platform_rule_version", "platform_check_state", "github_snapshot_json"];
const legacyRepositoryColumns = ["full_name", "github_repo_id", "category_id", "note", "ai_summary", "ai_tags_json", "ai_platforms_json", "release_subscribed", "release_cursor", "release_last_synced_at", "updated_at", "raw_json"];
const legacyMultiTables = ["repositories", "categories", "releases", "forks", "app_sessions", "app_account", "repository_meta", "release_subscriptions", "release_sync_state", "github_credentials", "ai_credentials", "ai_service_credentials", "ai_services", "ai_models", "ai_task_bindings", "app_preferences"];
const legacyMultiRepositoryColumns = ["account_id", "full_name", "github_repo_id", "name", "html_url", "description", "language", "default_branch", "is_starred", "starred_at", "updated_at", "raw_json"];
const categoryColumns = ["category_id", "name", "name_key", "color", "sort_order", "locked", "created_at", "updated_at"];
const forkColumns = ["fork_id", "github_repo_id", "full_name", "parent_full_name", "status", "github_pushed_at", "snapshot_at", "checked_at", "payload_json"];
const credentialColumns = ["credential_id", "kind", "owner_id", "service_id", "label", "ciphertext", "iv", "key_version", "fingerprint", "validated_at", "created_at", "updated_at", "status"];
const modelColumns = ["model_id", "service_id", "remote_model_id", "display_name", "enabled", "sort_order", "created_at", "updated_at"];

function makeProject(sqlFiles = ["0001_schema.sql", "0002_legacy_upgrade.sql"]) {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "starbox-deploy-test-"));
  const configText = `${JSON.stringify({
    name: "starbox",
    main: "./worker/index.ts",
    compatibility_date: "2026-09-11",
    workers_dev: false,
    d1_databases: [{ binding: "DB", database_name: "starbox", migrations_dir: "migrations" }],
    assets: { directory: "./dist", binding: "ASSETS" },
  }, null, 2)}\n`;
  writeFileSync(path.join(rootDir, "wrangler.jsonc"), configText);
  const migrationsDir = path.join(rootDir, "migrations");
  mkdirSync(migrationsDir);
  for (const name of sqlFiles) writeFileSync(path.join(migrationsDir, name), `-- ${name}\n`);
  return { rootDir, configText, migrationsDir };
}

function cleanup(rootDir) { rmSync(rootDir, { recursive: true, force: true }); }
function tempConfigs(rootDir) { return readdirSync(rootDir).filter((name) => name.startsWith(".wrangler.deploy.") && name.endsWith(".jsonc")); }
function rows(values) { return { stdout: JSON.stringify([{ success: true, results: values }]) }; }

function createRun(initialState = "final", { missingDatabase = false } = {}) {
  let state = initialState;
  let listCount = 0;
  const calls = [];
  const sqlFiles = [];
  const snapshot = { repositories: 3, notes: 1, category_assignments: 1, release_subscriptions: 1, ai_results: 1, credentials: 2 };

  const run = (args) => {
    calls.push(args);
    if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
    if (args[0] === "d1" && args[1] === "list") {
      listCount += 1;
      if (missingDatabase && listCount === 1) return { stdout: "[]" };
      return { stdout: JSON.stringify([{ name: "starbox", uuid: "real-starbox-uuid" }]) };
    }
    if (args[0] === "d1" && args[1] === "create") return { stdout: "" };
    if (args[0] === "deploy") return { stdout: "" };
    if (args[0] !== "d1" || args[1] !== "execute") return { stdout: "" };

    const fileIndex = args.indexOf("--file");
    if (fileIndex >= 0) {
      sqlFiles.push(path.basename(args[fileIndex + 1]));
      state = "final";
      return { stdout: "" };
    }

    const command = args[args.indexOf("--command") + 1] || "";
    if (command.includes("sqlite_master")) {
      if (state === "empty") return rows([]);
      if (state === "legacy") return rows([...finalTables, "releases", "_cf_KV", "d1_migrations"].map((name, cid) => ({ cid, name })));
      if (state === "legacy-multi") return rows([...legacyMultiTables, "d1_migrations"].map((name, cid) => ({ cid, name })));
      if (state === "intermediate") return rows(finalTables.map((name, cid) => ({ cid, name })));
      return rows(finalTables.map((name, cid) => ({ cid, name })));
    }
    if (command.includes("table_info(repositories)")) {
      const columns = state === "legacy" ? legacyRepositoryColumns : state === "legacy-multi" ? legacyMultiRepositoryColumns : state === "intermediate" ? ["repository_id", "full_name", "github_repo_id", "platforms_json"] : finalRepositoryColumns;
      return rows(columns.map((name, cid) => ({ cid, name })));
    }
    if (command.includes("table_info(categories)")) return rows(categoryColumns.map((name, cid) => ({ cid, name })));
    if (command.includes("table_info(forks)")) return rows(forkColumns.map((name, cid) => ({ cid, name })));
    if (command.includes("table_info(credentials)")) return rows(credentialColumns.map((name, cid) => ({ cid, name })));
    if (command.includes("table_info(ai_models)")) return rows(modelColumns.map((name, cid) => ({ cid, name })));
    if (command.includes("table_info(settings)")) return rows(["key", "value", "updated_at"].map((name, cid) => ({ cid, name })));
    if (command.includes("foreign_key_list(repositories)")) return rows([{ from: "category_id", table: "categories", on_delete: "SET NULL" }]);
    if (command.includes("foreign_key_list(ai_models)")) return rows([{ from: "service_id", table: "ai_services", on_delete: "CASCADE" }]);
    if (command.includes("foreign_key_list(credentials)")) return rows([{ from: "service_id", table: "ai_services", on_delete: "CASCADE" }]);
    if (command.includes("EXPLAIN QUERY PLAN")) {
      const indexName = command.includes("is_starred") ? "idx_repositories_starred_at"
        : command.includes("category_id") ? "idx_repositories_category_user"
          : command.includes("release_subscribed") ? "idx_repositories_release_subscription"
            : "idx_ai_models_service_order";
      return rows([{ detail: `SEARCH USING INDEX ${indexName}` }]);
    }
    if (command.includes("duplicate_repository_names")) {
      return rows([{ duplicate_repository_names: 0, conflicting_repository_ids: 0, category_key_duplicates: 0, orphan_categories: 0, orphan_models: 0, orphan_ai_credentials: 0, orphan_default_model: 0, invalid_repository_json: 0, invalid_service_json: 0, invalid_fork_json: 0 }]);
    }
    if (command.includes("category_assignments") && command.includes("ai_results")) return rows([snapshot]);
    return rows([]);
  };

  return { run, calls, sqlFiles, state: () => state };
}

test("tracked Wrangler config keeps workers.dev disabled and the repository has exactly two SQL files", () => {
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.d1_databases, [{ binding: "DB", database_name: "starbox", migrations_dir: "migrations" }]);
  assert.deepEqual(readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort(), ["0001_schema.sql", "0002_legacy_upgrade.sql"]);
});

test("current D1 schema skips SQL execution and deploys only after verification", () => {
  const { rootDir, configText } = makeProject();
  const mock = createRun("final");
  try {
    deploy({ rootDir, logger: silence, run: mock.run });
    assert.deepEqual(mock.sqlFiles, []);
    assert.equal(mock.calls.some((args) => args[0] === "deploy"), true);
    assert.equal(mock.calls.some((args) => args[0] === "d1" && args[1] === "migrations"), false);
    assert.equal(readFileSync(path.join(rootDir, "wrangler.jsonc"), "utf8"), configText);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally { cleanup(rootDir); }
});

test("empty D1 executes only the canonical baseline schema", () => {
  const { rootDir } = makeProject();
  const mock = createRun("empty");
  try {
    deploy({ rootDir, logger: silence, run: mock.run });
    assert.deepEqual(mock.sqlFiles, ["0001_schema.sql"]);
    assert.equal(mock.state(), "final");
    assert.equal(mock.calls.some((args) => args[0] === "deploy"), true);
  } finally { cleanup(rootDir); }
});

test("supported consolidated legacy D1 executes only the one-time upgrade and preserves counted data", () => {
  const { rootDir } = makeProject();
  const sourceUpgrade = readFileSync("migrations/0002_legacy_upgrade.sql", "utf8");
  writeFileSync(path.join(rootDir, "migrations", "0002_legacy_upgrade.sql"), sourceUpgrade);
  const mock = createRun("legacy");
  try {
    deploy({ rootDir, logger: silence, run: mock.run });
    assert.equal(mock.sqlFiles.length, 1);
    assert.match(mock.sqlFiles[0], /^\.starbox\.legacy-upgrade\./);
    assert.equal(mock.state(), "final");
    assert.equal(mock.calls.some((args) => args.includes("--command") && String(args[args.indexOf("--command") + 1]).includes("duplicate_repository_names")), true);
    assert.equal(mock.calls.filter((args) => args.includes("--command") && String(args[args.indexOf("--command") + 1]).includes("category_assignments")).length, 2);
  } finally { cleanup(rootDir); }
});

test("supported pre-consolidation legacy D1 executes the two-stage compatibility upgrade", () => {
  const { rootDir } = makeProject();
  const sourceUpgrade = readFileSync("migrations/0002_legacy_upgrade.sql", "utf8");
  writeFileSync(path.join(rootDir, "migrations", "0002_legacy_upgrade.sql"), sourceUpgrade);
  const mock = createRun("legacy-multi");
  try {
    deploy({ rootDir, logger: silence, run: mock.run });
    assert.equal(mock.sqlFiles.length, 1);
    assert.match(mock.sqlFiles[0], /^\.starbox\.legacy-upgrade\./);
    assert.equal(mock.state(), "final");
    assert.equal(mock.calls.some((args) => args[0] === "deploy"), true);
  } finally { cleanup(rootDir); }
});

test("a missing D1 database is created and initialized from the baseline", () => {
  const { rootDir } = makeProject();
  const mock = createRun("empty", { missingDatabase: true });
  try {
    deploy({ rootDir, logger: silence, run: mock.run });
    assert.equal(mock.calls.some((args) => args[0] === "d1" && args[1] === "create"), true);
    assert.deepEqual(mock.sqlFiles, ["0001_schema.sql"]);
  } finally { cleanup(rootDir); }
});

test("deployment refuses any third SQL file", () => {
  const { rootDir } = makeProject(["0001_schema.sql", "0002_legacy_upgrade.sql", "0003_not_allowed.sql"]);
  try {
    assert.throws(() => deploy({ rootDir, logger: silence, run: createRun("final").run }), /allows exactly two SQL files/);
  } finally { cleanup(rootDir); }
});

test("deployment refuses renamed or missing canonical SQL files", () => {
  const { rootDir } = makeProject(["0001_schema.sql", "0002_other.sql"]);
  try {
    assert.throws(() => deploy({ rootDir, logger: silence, run: createRun("final").run }), /allows exactly two SQL files/);
  } finally { cleanup(rootDir); }
});

test("deployment fails closed for an unknown intermediate schema instead of guessing", () => {
  const { rootDir } = makeProject();
  const mock = createRun("intermediate");
  try {
    assert.throws(() => deploy({ rootDir, logger: silence, run: mock.run }), /neither empty, current, nor a supported legacy shape/);
    assert.equal(mock.calls.some((args) => args[0] === "deploy"), false);
    assert.deepEqual(mock.sqlFiles, []);
  } finally { cleanup(rootDir); }
});

test("temporary deploy config receives the resolved D1 UUID and is always removed", () => {
  const { rootDir } = makeProject();
  const mock = createRun("final");
  let deployedConfig;
  const run = (args) => {
    const result = mock.run(args);
    if (args[0] === "deploy") deployedConfig = JSON.parse(readFileSync(args.at(-1), "utf8"));
    return result;
  };
  try {
    deploy({ rootDir, logger: silence, run });
    assert.equal(deployedConfig.d1_databases[0].database_id, "real-starbox-uuid");
    assert.equal(deployedConfig.workers_dev, false);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally { cleanup(rootDir); }
});

test("multiple Cloudflare accounts require an explicit account selection", () => {
  const { rootDir } = makeProject();
  try {
    assert.throws(() => deploy({
      rootDir,
      logger: silence,
      run(args) {
        if (args[0] === "whoami") return { stdout: JSON.stringify({ loggedIn: true, accounts: [account, { id: "other", name: "Other" }] }) };
        return { stdout: "[]" };
      },
    }), /Multiple Cloudflare accounts/);
  } finally { cleanup(rootDir); }
});

test("workers_dev must remain false", () => {
  const { rootDir } = makeProject();
  const configPath = path.join(rootDir, "wrangler.jsonc");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.workers_dev = true;
  writeFileSync(configPath, `${JSON.stringify(config)}\n`);
  try {
    assert.throws(() => deploy({ rootDir, logger: silence, run: createRun("final").run }), /workers_dev set to false/);
  } finally { cleanup(rootDir); }
});

test("SQL files encode the canonical eight-table schema and one direct legacy upgrade", () => {
  const baseline = readFileSync("migrations/0001_schema.sql", "utf8");
  const upgrade = readFileSync("migrations/0002_legacy_upgrade.sql", "utf8");
  for (const table of finalTables) assert.match(baseline, new RegExp(`CREATE TABLE ${table}\\b`));
  assert.match(baseline, /category_locked INTEGER NOT NULL DEFAULT 0/);
  assert.match(baseline, /user_revision INTEGER NOT NULL DEFAULT 0/);
  assert.match(baseline, /FOREIGN KEY \(category_id\) REFERENCES categories\(category_id\) ON DELETE SET NULL/);
  assert.doesNotMatch(baseline, /CREATE TABLE releases\b|processed_mutations|sync_changes|activity_log/);

  assert.match(upgrade, /STARBOX_UPGRADE_STAGE: MULTI_TENANT/);
  assert.match(upgrade, /STARBOX_UPGRADE_STAGE: CONSOLIDATED/);
  assert.match(upgrade, /FROM repository_meta m/);
  assert.match(upgrade, /WHERE r\.account_id = 'primary'/);
  assert.match(upgrade, /CREATE TABLE repositories_next/);
  assert.match(upgrade, /CREATE TABLE categories_next/);
  assert.match(upgrade, /DROP TABLE IF EXISTS releases/);
  assert.match(upgrade, /ai_platforms_json/);
  assert.match(upgrade, /raw_json/);
  assert.match(upgrade, /ALTER TABLE repositories_next RENAME TO repositories/);
  assert.doesNotMatch(baseline, /^\s*PRAGMA\s+foreign_keys\b/im);
  assert.doesNotMatch(upgrade, /^\s*(?:PRAGMA\s+foreign_keys\b|CREATE\s+TEMP(?:ORARY)?\s+TABLE\b)/im);
  const deployScript = readFileSync("scripts/deploy.mjs", "utf8");
  assert.doesNotMatch(deployScript, /BEGIN TRANSACTION|COMMIT;|`PRAGMA\s+foreign_keys\b/);
});
