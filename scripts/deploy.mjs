import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASELINE_SCHEMA = "0001_schema.sql";
const LEGACY_UPGRADE = "0002_legacy_upgrade.sql";
const ALLOWED_SQL_FILES = [BASELINE_SCHEMA, LEGACY_UPGRADE];
const FINAL_TABLES = ["repositories", "categories", "forks", "app_sessions", "credentials", "ai_services", "ai_models", "settings"];
const RETIRED_TABLES = ["releases", "app_account", "repository_meta", "release_subscriptions", "release_sync_state", "github_credentials", "ai_credentials", "ai_service_credentials", "ai_task_bindings", "app_preferences", "fork_snapshots", "fork_events", "activity_log", "notifications", "sync_state", "sync_changes", "processed_mutations", "login_rate_limits"];
const CONSOLIDATED_REPOSITORY_COLUMNS = ["repository_id", "full_name", "github_repo_id", "category_id", "category_locked", "note", "ai_summary", "ai_tags_json", "platforms_json", "release_subscribed", "github_updated_at", "github_pushed_at", "synced_at", "user_updated_at", "user_revision", "ai_analyzed_at", "ai_input_hash", "ai_prompt_version", "ai_model_id", "platform_checked_at", "platform_rule_version", "platform_check_state", "github_snapshot_json"];
const LEGACY_REPOSITORY_COLUMNS = ["full_name", "github_repo_id", "category_id", "note", "ai_summary", "ai_tags_json", "ai_platforms_json", "release_subscribed", "release_cursor", "release_last_synced_at", "updated_at", "raw_json"];
const CATEGORY_COLUMNS = ["category_id", "name", "name_key", "color", "sort_order", "locked", "created_at", "updated_at"];
const FORK_COLUMNS = ["fork_id", "github_repo_id", "full_name", "parent_full_name", "status", "github_pushed_at", "snapshot_at", "checked_at", "payload_json"];
const CREDENTIAL_COLUMNS = ["credential_id", "kind", "owner_id", "service_id", "label", "ciphertext", "iv", "key_version", "fingerprint", "validated_at", "created_at", "updated_at", "status"];
const AI_MODEL_COLUMNS = ["model_id", "service_id", "remote_model_id", "display_name", "enabled", "sort_order", "created_at", "updated_at"];
const RETIRED_REPOSITORY_COLUMNS = ["ai_platforms_json", "release_cursor", "release_last_synced_at", "updated_at", "raw_json"];
const LEGACY_MULTI_TABLES = ["repositories", "categories", "releases", "forks", "app_sessions", "app_account", "repository_meta", "release_subscriptions", "release_sync_state", "github_credentials", "ai_credentials", "ai_service_credentials", "ai_services", "ai_models", "ai_task_bindings", "app_preferences"];
const UPGRADE_MULTI_MARKER = "-- STARBOX_UPGRADE_STAGE: MULTI_TENANT";
const UPGRADE_CONSOLIDATED_MARKER = "-- STARBOX_UPGRADE_STAGE: CONSOLIDATED";

function runWrangler(args, cwd) {
  const command = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
  const captureStdout = args.includes("--json") || (args.includes("--format") && args.includes("json"));
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", captureStdout ? "pipe" : "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (result.error) throw new Error(`Could not run Wrangler: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || "").trim();
    throw new Error(`wrangler ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`);
  }
  return { stdout: result.stdout ?? "" };
}

function stdoutOf(result) { return typeof result === "string" ? result : result?.stdout ?? ""; }
function parseJsonOutput(result, label) { try { return JSON.parse(stdoutOf(result)); } catch { throw new Error(`Could not read JSON from Wrangler ${label} output.`); } }
function d1Rows(result, label) { const parsed = parseJsonOutput(result, label); const batches = Array.isArray(parsed) ? parsed : [parsed]; return batches.flatMap((batch) => Array.isArray(batch?.results) ? batch.results : []); }

function resolveAccountId(whoami, config, env) {
  if (!whoami || whoami.loggedIn !== true) throw new Error("Wrangler is not authenticated. Run `npx wrangler login` and retry.");
  const accounts = Array.isArray(whoami.accounts) ? whoami.accounts : [];
  if (accounts.length === 0) throw new Error("The authenticated Cloudflare user has no available accounts.");
  const configuredId = config.account_id || env.CLOUDFLARE_ACCOUNT_ID;
  if (configuredId) {
    const account = accounts.find((entry) => entry.id === configuredId);
    if (!account) throw new Error(`Cloudflare account ${configuredId} is not available to the authenticated user.`);
    return { id: account.id, name: account.name };
  }
  if (accounts.length !== 1) throw new Error("Multiple Cloudflare accounts are available. Set CLOUDFLARE_ACCOUNT_ID to select the deployment account.");
  return { id: accounts[0].id, name: accounts[0].name };
}

function readStarboxBinding(config) {
  const bindings = Array.isArray(config.d1_databases) ? config.d1_databases : [];
  const matches = bindings.filter((entry) => entry.binding === "DB" && entry.database_name === "starbox");
  if (matches.length !== 1) throw new Error('wrangler.jsonc must contain exactly one D1 binding named DB for database "starbox".');
  return matches[0];
}

function findStarbox(databases) {
  if (!Array.isArray(databases)) throw new Error("Wrangler D1 list output was not a JSON array.");
  const matches = databases.filter((database) => database?.name === "starbox");
  if (matches.length > 1) throw new Error('More than one D1 database is named "starbox" in the selected Cloudflare account. Refusing to guess.');
  if (matches.length === 0) return null;
  const uuid = matches[0].uuid;
  if (typeof uuid !== "string" || uuid.trim() === "") throw new Error('The D1 database "starbox" did not include a UUID in Wrangler output.');
  return { uuid, name: matches[0].name };
}

function schemaTableNames(run, rootDir, configArgs) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name", "--json", ...configArgs], rootDir);
  return new Set(d1Rows(result, "D1 table schema").map((row) => typeof row?.name === "string" ? row.name : "").filter(Boolean));
}

function tableColumns(run, rootDir, configArgs, table) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", `PRAGMA table_info(${table})`, "--json", ...configArgs], rootDir);
  return new Set(d1Rows(result, `D1 ${table} schema`).map((row) => typeof row?.name === "string" ? row.name : "").filter(Boolean));
}

function foreignKeys(run, rootDir, configArgs, table) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", `PRAGMA foreign_key_list(${table})`, "--json", ...configArgs], rootDir);
  return d1Rows(result, `D1 ${table} foreign keys`);
}

function requireColumns(actual, required, table) {
  const missing = required.filter((name) => !actual.has(name));
  if (missing.length) throw new Error(`D1 final schema verification failed: ${table} is missing ${missing.join(", ")}. Worker deployment was stopped.`);
}

function verifyForeignKey(rows, from, table, onDelete) {
  const match = rows.find((row) => row?.from === from && row?.table === table);
  if (!match || String(match.on_delete || "").toUpperCase() !== onDelete) {
    throw new Error(`D1 final schema verification failed: expected ${from} -> ${table} ON DELETE ${onDelete}. Worker deployment was stopped.`);
  }
}

function ensureTwoSqlFiles(rootDir, binding) {
  const dir = path.resolve(rootDir, binding.migrations_dir || "migrations");
  if (!existsSync(dir)) throw new Error("D1 schema directory is missing.");
  const sqlFiles = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  if (sqlFiles.length !== 2 || sqlFiles.some((name, index) => name !== ALLOWED_SQL_FILES[index])) {
    throw new Error(`StarBox allows exactly two SQL files: ${ALLOWED_SQL_FILES.join(" and ")}. Found: ${sqlFiles.join(", ") || "none"}.`);
  }
  return {
    baseline: path.join(dir, BASELINE_SCHEMA),
    upgrade: path.join(dir, LEGACY_UPGRADE),
  };
}

function isPlatformInternalTable(name) {
  return name === "d1_migrations" || name.startsWith("_cf_");
}

function productTableCount(tables) {
  const known = new Set([...FINAL_TABLES, ...RETIRED_TABLES]);
  return [...tables].filter((name) => known.has(name)).length;
}

function detectSchemaState(run, rootDir, configArgs) {
  const tables = schemaTableNames(run, rootDir, configArgs);
  if (productTableCount(tables) === 0) return "empty";
  if (!tables.has("repositories")) return "unsupported";

  const repositories = tableColumns(run, rootDir, configArgs, "repositories");
  const finalShape = FINAL_TABLES.every((name) => tables.has(name))
    && CONSOLIDATED_REPOSITORY_COLUMNS.every((name) => repositories.has(name))
    && RETIRED_REPOSITORY_COLUMNS.every((name) => !repositories.has(name))
    && RETIRED_TABLES.every((name) => !tables.has(name));
  if (finalShape) return "final";

  const legacyShape = FINAL_TABLES.every((name) => tables.has(name))
    && LEGACY_REPOSITORY_COLUMNS.every((name) => repositories.has(name))
    && !repositories.has("repository_id")
    && !repositories.has("account_id")
    && [...tables].every((name) => FINAL_TABLES.includes(name) || name === "releases" || isPlatformInternalTable(name));
  if (legacyShape) return "legacy-consolidated";

  const legacyMultiShape = LEGACY_MULTI_TABLES.every((name) => tables.has(name))
    && repositories.has("account_id")
    && !repositories.has("repository_id")
    && !tables.has("credentials")
    && !tables.has("settings");
  if (legacyMultiShape) return "legacy-multitenant";

  return "unsupported";
}

function compatibilitySnapshot(run, rootDir, configArgs) {
  const command = "SELECT (SELECT COUNT(*) FROM repositories) AS repositories, (SELECT COUNT(*) FROM repositories WHERE NULLIF(trim(note), '') IS NOT NULL) AS notes, (SELECT COUNT(*) FROM repositories WHERE category_id IS NOT NULL) AS category_assignments, (SELECT COUNT(*) FROM repositories WHERE release_subscribed = 1) AS release_subscriptions, (SELECT COUNT(*) FROM repositories WHERE NULLIF(trim(ai_summary), '') IS NOT NULL OR ai_tags_json <> '[]') AS ai_results, (SELECT COUNT(*) FROM credentials) AS credentials";
  return d1Rows(run(["d1", "execute", "DB", "--remote", "--command", command, "--json", ...configArgs], rootDir), "D1 compatibility snapshot")[0] ?? {};
}

function verifyLegacyUpgradePreflight(run, rootDir, configArgs) {
  const command = "SELECT (SELECT COUNT(*) FROM (SELECT lower(full_name) FROM repositories GROUP BY lower(full_name) HAVING COUNT(*) > 1)) AS duplicate_repository_names, (SELECT COUNT(*) FROM (SELECT CAST(github_repo_id AS INTEGER) AS github_id FROM repositories WHERE github_repo_id IS NOT NULL AND trim(github_repo_id) <> '' AND github_repo_id NOT GLOB '*[^0-9]*' GROUP BY github_id HAVING COUNT(DISTINCT NULLIF(trim(note), '')) > 1 OR COUNT(DISTINCT category_id) > 1)) AS conflicting_repository_ids, (SELECT COUNT(*) FROM (SELECT lower(trim(name)) AS name_key FROM categories GROUP BY lower(trim(name)) HAVING COUNT(*) > 1)) AS category_key_duplicates, (SELECT COUNT(*) FROM repositories r WHERE r.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.category_id = r.category_id)) AS orphan_categories, (SELECT COUNT(*) FROM ai_models m WHERE NOT EXISTS (SELECT 1 FROM ai_services s WHERE s.service_id = m.service_id)) AS orphan_models, (SELECT COUNT(*) FROM credentials c WHERE c.credential_id LIKE 'ai:%' AND c.credential_id <> 'ai:legacy' AND NOT EXISTS (SELECT 1 FROM ai_services s WHERE s.service_id = substr(c.credential_id, 4))) AS orphan_ai_credentials, (SELECT COUNT(*) FROM settings x WHERE x.key = 'ai.default_model_id' AND trim(x.value) <> '' AND NOT EXISTS (SELECT 1 FROM ai_models m WHERE m.model_id = x.value)) AS orphan_default_model, (SELECT COUNT(*) FROM repositories WHERE NOT json_valid(ai_tags_json) OR json_type(ai_tags_json) <> 'array' OR NOT json_valid(ai_platforms_json) OR json_type(ai_platforms_json) <> 'array' OR NOT json_valid(raw_json) OR json_type(raw_json) <> 'object') AS invalid_repository_json, (SELECT COUNT(*) FROM ai_services WHERE NOT json_valid(config_json) OR json_type(config_json) <> 'object') AS invalid_service_json, (SELECT COUNT(*) FROM forks WHERE NOT json_valid(payload_json) OR json_type(payload_json) <> 'object') AS invalid_fork_json";
  const row = d1Rows(run(["d1", "execute", "DB", "--remote", "--command", command, "--json", ...configArgs], rootDir), "D1 legacy upgrade preflight")[0] ?? {};
  const failures = Object.entries(row).filter(([, value]) => Number(value) > 0);
  if (failures.length) throw new Error(`D1 legacy upgrade preflight failed: ${failures.map(([key, value]) => `${key}=${value}`).join(", ")}. Worker deployment was stopped.`);
}

function verifyCompatibilitySnapshot(run, rootDir, configArgs, before) {
  if (!before) return;
  const after = compatibilitySnapshot(run, rootDir, configArgs);
  const changed = Object.keys(before).filter((key) => Number(before[key]) !== Number(after[key]));
  if (changed.length) throw new Error(`D1 post-upgrade data comparison failed: ${changed.map((key) => `${key} ${before[key]} -> ${after[key]}`).join(", ")}. Worker deployment was stopped.`);
}

function verifyQueryPlans(run, rootDir, configArgs) {
  const checks = [
    ["idx_repositories_starred_at", "EXPLAIN QUERY PLAN SELECT full_name FROM repositories WHERE is_starred = 1 ORDER BY starred_at DESC LIMIT 50"],
    ["idx_repositories_category_user", "EXPLAIN QUERY PLAN SELECT full_name FROM repositories WHERE category_id = 'example' ORDER BY user_updated_at DESC LIMIT 50"],
    ["idx_repositories_release_subscription", "EXPLAIN QUERY PLAN SELECT full_name FROM repositories WHERE release_subscribed = 1 ORDER BY platform_checked_at DESC LIMIT 50"],
    ["idx_ai_models_service_order", "EXPLAIN QUERY PLAN SELECT model_id FROM ai_models WHERE service_id = 'example' ORDER BY sort_order, created_at"],
  ];
  for (const [indexName, command] of checks) {
    const rows = d1Rows(run(["d1", "execute", "DB", "--remote", "--command", command, "--json", ...configArgs], rootDir), `D1 query plan ${indexName}`);
    const detail = rows.map((row) => String(row?.detail || "")).join(" ");
    if (!detail.includes(indexName)) throw new Error(`D1 query-plan verification failed: ${indexName} was not selected. Worker deployment was stopped.`);
  }
}

function verifyFinalSchema(run, rootDir, configArgs) {
  const tables = schemaTableNames(run, rootDir, configArgs);
  const missingTables = FINAL_TABLES.filter((name) => !tables.has(name));
  const lingeringTables = RETIRED_TABLES.filter((name) => tables.has(name));
  if (missingTables.length || lingeringTables.length) {
    const details = [
      missingTables.length ? `missing: ${missingTables.join(", ")}` : "",
      lingeringTables.length ? `retired tables still present: ${lingeringTables.join(", ")}` : "",
    ].filter(Boolean).join("; ");
    throw new Error(`D1 final schema verification failed (${details}). Worker deployment was stopped.`);
  }

  const repositoryColumns = tableColumns(run, rootDir, configArgs, "repositories");
  requireColumns(repositoryColumns, CONSOLIDATED_REPOSITORY_COLUMNS, "repositories");
  const lingeringRepositoryColumns = RETIRED_REPOSITORY_COLUMNS.filter((name) => repositoryColumns.has(name));
  if (lingeringRepositoryColumns.length) throw new Error(`D1 final schema verification failed: repositories still has retired columns ${lingeringRepositoryColumns.join(", ")}. Worker deployment was stopped.`);

  requireColumns(tableColumns(run, rootDir, configArgs, "categories"), CATEGORY_COLUMNS, "categories");
  requireColumns(tableColumns(run, rootDir, configArgs, "forks"), FORK_COLUMNS, "forks");
  requireColumns(tableColumns(run, rootDir, configArgs, "credentials"), CREDENTIAL_COLUMNS, "credentials");
  requireColumns(tableColumns(run, rootDir, configArgs, "ai_models"), AI_MODEL_COLUMNS, "ai_models");
  requireColumns(tableColumns(run, rootDir, configArgs, "settings"), ["key", "value", "updated_at"], "settings");

  verifyForeignKey(foreignKeys(run, rootDir, configArgs, "repositories"), "category_id", "categories", "SET NULL");
  verifyForeignKey(foreignKeys(run, rootDir, configArgs, "ai_models"), "service_id", "ai_services", "CASCADE");
  verifyForeignKey(foreignKeys(run, rootDir, configArgs, "credentials"), "service_id", "ai_services", "CASCADE");
  verifyQueryPlans(run, rootDir, configArgs);
}

function executeSqlFile(run, rootDir, configArgs, filePath) {
  run(["d1", "execute", "DB", "--remote", "--file", filePath, ...configArgs], rootDir);
}

function upgradeStages(filePath) {
  const source = readFileSync(filePath, "utf8");
  const multiIndex = source.indexOf(UPGRADE_MULTI_MARKER);
  const consolidatedIndex = source.indexOf(UPGRADE_CONSOLIDATED_MARKER);
  if (multiIndex < 0 || consolidatedIndex <= multiIndex) throw new Error("Legacy upgrade SQL is missing required stage markers.");
  return {
    multiTenant: source.slice(multiIndex + UPGRADE_MULTI_MARKER.length, consolidatedIndex).trim(),
    consolidated: source.slice(consolidatedIndex + UPGRADE_CONSOLIDATED_MARKER.length).trim(),
  };
}

function materializeLegacyUpgrade(rootDir, filePath, schemaState) {
  const stages = upgradeStages(filePath);
  const body = schemaState === "legacy-multitenant"
    ? `${stages.multiTenant}\n\n${stages.consolidated}`
    : stages.consolidated;
  const tempPath = path.join(rootDir, `.starbox.legacy-upgrade.${process.pid}.${randomUUID()}.sql`);
  writeFileSync(tempPath, `${body}\n`, { flag: "wx" });
  return tempPath;
}

/** Bootstrap or upgrade the production D1 database and deploy using a temporary config. */
export function deploy({ rootDir = projectRoot, run = runWrangler, env = run === runWrangler ? process.env : {}, logger = console } = {}) {
  const sourceConfigPath = path.join(rootDir, "wrangler.jsonc");
  const sourceConfigContents = readFileSync(sourceConfigPath, "utf8");
  let config;
  try { config = JSON.parse(sourceConfigContents); } catch { throw new Error("wrangler.jsonc must use JSON syntax so the deployment bootstrap can create a temporary config."); }

  if (config.workers_dev !== false) throw new Error("wrangler.jsonc must keep workers_dev set to false.");
  if (!config.route && !Array.isArray(config.routes) && !env.STARBOX_DEPLOYMENT_URL) logger.log("workers.dev is disabled and no Wrangler route is declared. Ensure a Dashboard Custom Domain/Route is attached; set STARBOX_DEPLOYMENT_URL to enable live login/health verification.");

  const d1Binding = readStarboxBinding(config);
  const sql = ensureTwoSqlFiles(rootDir, d1Binding);
  const tempConfigPath = path.join(rootDir, `.wrangler.deploy.${process.pid}.${randomUUID()}.jsonc`);
  let tempUpgradePath = null;

  try {
    const whoami = parseJsonOutput(run(["whoami", "--json"], rootDir), "whoami");
    const account = resolveAccountId(whoami, config, env);
    config.account_id = account.id;
    writeFileSync(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
    logger.log(`Using Cloudflare account ${account.name || account.id}.`);

    const configArgs = ["--config", tempConfigPath];
    let database = findStarbox(parseJsonOutput(run(["d1", "list", "--json", ...configArgs], rootDir), "D1 list"));
    if (!database) {
      logger.log('D1 database "starbox" was not found; creating it.');
      run(["d1", "create", "starbox", "--binding", "DB", ...configArgs], rootDir);
      database = findStarbox(parseJsonOutput(run(["d1", "list", "--json", ...configArgs], rootDir), "D1 list after create"));
      if (!database) throw new Error('Wrangler created no visible D1 database named "starbox".');
    }

    d1Binding.database_id = database.uuid;
    writeFileSync(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`);

    const schemaState = detectSchemaState(run, rootDir, configArgs);
    if (schemaState === "empty") {
      logger.log(`Initializing empty D1 database "starbox" from ${BASELINE_SCHEMA}.`);
      executeSqlFile(run, rootDir, configArgs, sql.baseline);
    } else if (schemaState === "legacy-consolidated" || schemaState === "legacy-multitenant") {
      const before = schemaState === "legacy-consolidated" ? compatibilitySnapshot(run, rootDir, configArgs) : null;
      if (schemaState === "legacy-consolidated") verifyLegacyUpgradePreflight(run, rootDir, configArgs);
      tempUpgradePath = materializeLegacyUpgrade(rootDir, sql.upgrade, schemaState);
      logger.log(`Upgrading supported ${schemaState === "legacy-multitenant" ? "pre-consolidation" : "consolidated"} legacy D1 schema with ${LEGACY_UPGRADE}.`);
      executeSqlFile(run, rootDir, configArgs, tempUpgradePath);
      verifyCompatibilitySnapshot(run, rootDir, configArgs, before);
    } else if (schemaState !== "final") {
      const tables = [...schemaTableNames(run, rootDir, configArgs)].sort();
      const repositoryColumns = tables.includes("repositories") ? [...tableColumns(run, rootDir, configArgs, "repositories")].sort() : [];
      throw new Error(`D1 schema is neither empty, current, nor a supported legacy shape. Refusing an unsafe automatic upgrade. Tables: ${tables.join(", ") || "none"}; repositories columns: ${repositoryColumns.join(", ") || "none"}.`);
    }

    verifyFinalSchema(run, rootDir, configArgs);

    logger.log("Deploying StarBox Worker and assets.");
    run(["deploy", ...configArgs], rootDir);

    // LOGIN_PASSWORD and STARBOX_ENCRYPTION_KEY may be configured as ordinary
    // Dashboard variables or Worker Secrets. Deployment does not enforce the
    // Cloudflare binding type; the Worker validates required values at runtime.
    logger.log("StarBox deployment completed.");
  } finally {
    if (existsSync(tempConfigPath)) rmSync(tempConfigPath, { force: true });
    if (tempUpgradePath && existsSync(tempUpgradePath)) rmSync(tempUpgradePath, { force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { deploy(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
