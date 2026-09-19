import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LEGACY_DEVICE_MIGRATION = "0007_devices_and_ai_services.sql";
const CONSOLIDATED_SCHEMA_MIGRATION = "0014_single_user_schema.sql";
const RELEASE_CACHE_ONLY_MIGRATION = "0015_release_cache_only.sql";
const SESSION_DEVICE_COLUMNS = ["device_id", "device_name", "device_type", "os", "browser", "ip_address", "country_code", "region", "city", "user_agent"];
const FINAL_TABLES = ["repositories", "categories", "forks", "app_sessions", "credentials", "ai_services", "ai_models", "settings"];
const RETIRED_TABLES = ["releases", "app_account", "repository_meta", "release_subscriptions", "release_sync_state", "github_credentials", "ai_credentials", "ai_service_credentials", "ai_task_bindings", "app_preferences", "fork_snapshots", "fork_events", "activity_log", "notifications", "sync_state", "sync_changes", "processed_mutations", "login_rate_limits"];
const CONSOLIDATED_REPOSITORY_COLUMNS = ["full_name", "github_repo_id", "category_id", "note", "ai_summary", "ai_tags_json", "ai_platforms_json", "release_subscribed", "release_cursor", "release_last_synced_at", "raw_json"];

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

function sessionColumns(run, rootDir, configArgs) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", "PRAGMA table_info(app_sessions)", "--json", ...configArgs], rootDir);
  return new Set(d1Rows(result, "D1 app_sessions schema").map((row) => typeof row?.name === "string" ? row.name : "").filter(Boolean));
}

function prepareLegacyMigrationOverlay({ rootDir, binding, existingColumns, logger }) {
  const sourceDirName = binding.migrations_dir || "migrations";
  const sourceDir = path.resolve(rootDir, sourceDirName);
  const sourceMigration = path.join(sourceDir, LEGACY_DEVICE_MIGRATION);
  if (!existsSync(sourceMigration)) return null;
  const alreadyPresent = SESSION_DEVICE_COLUMNS.filter((name) => existingColumns.has(name));
  if (alreadyPresent.length === 0) return null;
  let deviceMigration = readFileSync(sourceMigration, "utf8");
  let removed = 0;
  for (const name of alreadyPresent) {
    const statement = `ALTER TABLE app_sessions ADD COLUMN ${name} TEXT;`;
    if (!deviceMigration.includes(statement)) continue;
    deviceMigration = deviceMigration.replace(statement, `-- ${name} already exists from the retired runtime schema repair.`);
    removed += 1;
  }
  if (removed === 0) return null;
  const tempDirName = `.wrangler.migrations.${process.pid}.${randomUUID()}`;
  const tempDirPath = path.join(rootDir, tempDirName);
  mkdirSync(tempDirPath, { recursive: false });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const content = entry.name === LEGACY_DEVICE_MIGRATION ? deviceMigration : readFileSync(path.join(sourceDir, entry.name), "utf8");
    writeFileSync(path.join(tempDirPath, entry.name), content);
  }
  logger.log(`Detected ${removed} pre-existing 0007 Session columns from the retired runtime repair; using a temporary migration overlay to reconcile D1 history.`);
  return { name: tempDirName, path: tempDirPath };
}

function verifyDeviceSchema(run, rootDir, configArgs) {
  const columns = sessionColumns(run, rootDir, configArgs);
  const missing = SESSION_DEVICE_COLUMNS.filter((name) => !columns.has(name));
  if (missing.length > 0) throw new Error(`D1 migration verification failed: app_sessions is missing ${missing.join(", ")}. Worker deployment was stopped.`);
}

function schemaTableNames(run, rootDir, configArgs) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name", "--json", ...configArgs], rootDir);
  return new Set(d1Rows(result, "D1 consolidated table schema").map((row) => typeof row?.name === "string" ? row.name : "").filter(Boolean));
}

function tableColumns(run, rootDir, configArgs, table) {
  const result = run(["d1", "execute", "DB", "--remote", "--command", `PRAGMA table_info(${table})`, "--json", ...configArgs], rootDir);
  return new Set(d1Rows(result, `D1 ${table} schema`).map((row) => typeof row?.name === "string" ? row.name : "").filter(Boolean));
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
  const missingRepositoryColumns = CONSOLIDATED_REPOSITORY_COLUMNS.filter((name) => !repositoryColumns.has(name));
  if (missingRepositoryColumns.length) throw new Error(`D1 final schema verification failed: repositories is missing ${missingRepositoryColumns.join(", ")}. Worker deployment was stopped.`);


  const settingsColumns = tableColumns(run, rootDir, configArgs, "settings");
  for (const name of ["key", "value", "updated_at"]) if (!settingsColumns.has(name)) throw new Error(`D1 final schema verification failed: settings is missing ${name}. Worker deployment was stopped.`);
}

/** Bootstrap the production D1 database and deploy using a temporary config. */
export function deploy({ rootDir = projectRoot, run = runWrangler, env = run === runWrangler ? process.env : {}, logger = console } = {}) {
  const sourceConfigPath = path.join(rootDir, "wrangler.jsonc");
  const sourceConfigContents = readFileSync(sourceConfigPath, "utf8");
  let config;
  try { config = JSON.parse(sourceConfigContents); } catch { throw new Error("wrangler.jsonc must use JSON syntax so the deployment bootstrap can create a temporary config."); }

  if (config.workers_dev !== false) throw new Error("wrangler.jsonc must keep workers_dev set to false.");
  if (!config.route && !Array.isArray(config.routes) && !env.STARBOX_DEPLOYMENT_URL) logger.log("workers.dev is disabled and no Wrangler route is declared. Ensure a Dashboard Custom Domain/Route is attached; set STARBOX_DEPLOYMENT_URL to enable live login/health verification.");
  const d1Binding = readStarboxBinding(config);
  const sourceMigrationDir = path.resolve(rootDir, d1Binding.migrations_dir || "migrations");
  const hasDeviceMigration = existsSync(path.join(sourceMigrationDir, LEGACY_DEVICE_MIGRATION));
  const hasConsolidatedMigration = existsSync(path.join(sourceMigrationDir, CONSOLIDATED_SCHEMA_MIGRATION));
  const hasReleaseCacheOnlyMigration = existsSync(path.join(sourceMigrationDir, RELEASE_CACHE_ONLY_MIGRATION));
  if (hasConsolidatedMigration && !hasReleaseCacheOnlyMigration) throw new Error(`Missing required migration ${RELEASE_CACHE_ONLY_MIGRATION}; refusing to deploy a schema that still persists GitHub Release payloads.`);
  const tempConfigPath = path.join(rootDir, `.wrangler.deploy.${process.pid}.${randomUUID()}.jsonc`);
  let tempMigrationsPath = null;

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

    if (hasDeviceMigration) {
      const overlay = prepareLegacyMigrationOverlay({ rootDir, binding: d1Binding, existingColumns: sessionColumns(run, rootDir, configArgs), logger });
      if (overlay) {
        tempMigrationsPath = overlay.path;
        d1Binding.migrations_dir = overlay.name;
        writeFileSync(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`);
      }
    }

    logger.log(`Applying pending migrations to D1 database "starbox" (${database.uuid}).`);
    run(["d1", "migrations", "apply", "DB", "--remote", ...configArgs], rootDir);
    if (hasDeviceMigration) verifyDeviceSchema(run, rootDir, configArgs);
    if (hasReleaseCacheOnlyMigration) verifyFinalSchema(run, rootDir, configArgs);

    logger.log("Deploying StarBox Worker and assets.");
    run(["deploy", ...configArgs], rootDir);

    // LOGIN_PASSWORD and STARBOX_ENCRYPTION_KEY may be configured as ordinary
    // Dashboard variables or Worker Secrets. Deployment does not enforce the
    // Cloudflare binding type; the Worker validates required values at runtime.
    logger.log("StarBox deployment completed.");
  } finally {
    if (existsSync(tempConfigPath)) rmSync(tempConfigPath, { force: true });
    if (tempMigrationsPath && existsSync(tempMigrationsPath)) rmSync(tempMigrationsPath, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { deploy(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
