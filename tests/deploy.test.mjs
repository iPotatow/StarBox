import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deploy } from "../scripts/deploy.mjs";

const account = { id: "account-123", name: "StarBox account" };
const whoami = { loggedIn: true, accounts: [account] };
const silence = { log() {} };

function makeProject() {
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
  return { rootDir, configText };
}

function cleanup(rootDir) {
  rmSync(rootDir, { recursive: true, force: true });
}

function tempConfigs(rootDir) {
  return readdirSync(rootDir).filter((name) => name.startsWith(".wrangler.deploy.") && name.endsWith(".jsonc"));
}

function tempMigrationDirs(rootDir) {
  return readdirSync(rootDir).filter((name) => name.startsWith(".wrangler.migrations."));
}

test("tracked Wrangler config has no account-specific D1 UUID and keeps public workers disabled", () => {
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.d1_databases, [{ binding: "DB", database_name: "starbox", migrations_dir: "migrations" }]);
});

test("uses the existing exact-name database, applies before deploying with the same temporary config", () => {
  const { rootDir, configText } = makeProject();
  const calls = [];
  const events = [];
  let migratedConfig;
  let deployedConfig;
  try {
    deploy({
      rootDir,
      logger: silence,
      run(args) {
        calls.push(args);
        if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
        if (args[0] === "d1" && args[1] === "list") {
          return { stdout: JSON.stringify([{ name: "other", uuid: "other-id" }, { name: "starbox", uuid: "real-starbox-uuid" }]) };
        }
        if (args[0] === "d1" && args[1] === "migrations") {
          events.push("migrations");
          migratedConfig = JSON.parse(readFileSync(args.at(-1), "utf8"));
        }
        if (args[0] === "deploy") {
          events.push("deploy");
          deployedConfig = JSON.parse(readFileSync(args.at(-1), "utf8"));
        }
        return { stdout: "" };
      },
    });

    assert.deepEqual(events, ["migrations", "deploy"]);
    assert.equal(calls.some((args) => args[0] === "d1" && args[1] === "create"), false);
    const migrationConfig = calls.find((args) => args[0] === "d1" && args[1] === "migrations").at(-1);
    const deployConfig = calls.find((args) => args[0] === "deploy").at(-1);
    assert.equal(migrationConfig, deployConfig);
    assert.equal(calls.findIndex((args) => args[1] === "migrations") < calls.findIndex((args) => args[0] === "deploy"), true);
    assert.equal(calls.some((args) => args.includes("--remote") && args.includes("DB")), true);
    assert.equal(migratedConfig.d1_databases[0].database_id, "real-starbox-uuid");
    assert.equal(deployedConfig.d1_databases[0].database_id, "real-starbox-uuid");
    assert.equal(deployedConfig.workers_dev, false);
    assert.equal(existsSync(migrationConfig), false);
    assert.equal(readFileSync(path.join(rootDir, "wrangler.jsonc"), "utf8"), configText);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally {
    cleanup(rootDir);
  }
});

test("creates a missing database, re-lists it for its UUID, then migrates and deploys", () => {
  const { rootDir } = makeProject();
  const calls = [];
  let listCount = 0;
  try {
    deploy({
      rootDir,
      logger: silence,
      run(args) {
        calls.push(args);
        if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
        if (args[0] === "d1" && args[1] === "list") {
          listCount += 1;
          return { stdout: JSON.stringify(listCount === 1 ? [] : [{ name: "starbox", uuid: "created-uuid" }]) };
        }
        return { stdout: "" };
      },
    });
    const names = calls.map((args) => args.slice(0, args[0] === "deploy" ? 2 : 3).join(" "));
    assert.deepEqual(names, ["whoami --json", "d1 list --json", "d1 create starbox", "d1 list --json", "d1 migrations apply", "deploy --config"]);
    const configPath = calls.find((args) => args[1] === "migrations").at(-1);
    const createCall = calls.find((args) => args[0] === "d1" && args[1] === "create");
    assert.equal(createCall.includes("DB"), true);
    assert.equal(calls.find((args) => args[1] === "migrations").includes("DB"), true);
    assert.equal(calls.find((args) => args[1] === "migrations").includes("--remote"), true);
    assert.equal(existsSync(configPath), false);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally {
    cleanup(rootDir);
  }
});

test("reconciles legacy runtime-added 0007 columns before applying the official migration", () => {
  const { rootDir, configText } = makeProject();
  const migrationsDir = path.join(rootDir, "migrations");
  mkdirSync(migrationsDir);
  const originalMigration = [
    "ALTER TABLE app_sessions ADD COLUMN device_id TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN device_name TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN device_type TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN os TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN browser TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN ip_address TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN country_code TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN region TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN city TEXT;",
    "ALTER TABLE app_sessions ADD COLUMN user_agent TEXT;",
    "CREATE TABLE IF NOT EXISTS ai_services (service_id TEXT PRIMARY KEY);",
    "",
  ].join("\n");
  writeFileSync(path.join(migrationsDir, "0007_devices_and_ai_services.sql"), originalMigration);

  const allColumns = ["device_id", "device_name", "device_type", "os", "browser", "ip_address", "country_code", "region", "city", "user_agent"];
  let schemaReadCount = 0;
  let overlayMigration = "";
  const calls = [];
  try {
    deploy({
      rootDir,
      logger: silence,
      run(args) {
        calls.push(args);
        if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
        if (args[0] === "d1" && args[1] === "list") return { stdout: JSON.stringify([{ name: "starbox", uuid: "real-starbox-uuid" }]) };
        if (args[0] === "d1" && args[1] === "execute") {
          schemaReadCount += 1;
          const columns = schemaReadCount === 1 ? ["device_id", "device_name"] : allColumns;
          return { stdout: JSON.stringify([{ success: true, results: columns.map((name, cid) => ({ cid, name })) }]) };
        }
        if (args[0] === "d1" && args[1] === "migrations") {
          const config = JSON.parse(readFileSync(args.at(-1), "utf8"));
          assert.notEqual(config.d1_databases[0].migrations_dir, "migrations");
          overlayMigration = readFileSync(path.join(rootDir, config.d1_databases[0].migrations_dir, "0007_devices_and_ai_services.sql"), "utf8");
        }
        return { stdout: "" };
      },
    });

    assert.doesNotMatch(overlayMigration, /ADD COLUMN device_id TEXT/);
    assert.doesNotMatch(overlayMigration, /ADD COLUMN device_name TEXT/);
    assert.match(overlayMigration, /ADD COLUMN browser TEXT/);
    assert.match(overlayMigration, /CREATE TABLE IF NOT EXISTS ai_services/);
    assert.equal(schemaReadCount, 2);
    assert.equal(calls.findIndex((args) => args[1] === "execute") < calls.findIndex((args) => args[1] === "migrations"), true);
    assert.equal(calls.findLastIndex((args) => args[1] === "execute") > calls.findIndex((args) => args[1] === "migrations"), true);
    assert.equal(calls.findIndex((args) => args[0] === "deploy") > calls.findLastIndex((args) => args[1] === "execute"), true);
    assert.equal(readFileSync(path.join(migrationsDir, "0007_devices_and_ai_services.sql"), "utf8"), originalMigration);
    assert.equal(readFileSync(path.join(rootDir, "wrangler.jsonc"), "utf8"), configText);
    assert.deepEqual(tempMigrationDirs(rootDir), []);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally {
    cleanup(rootDir);
  }
});

test("fails closed for ambiguous names and never assumes an id field is a UUID", async (t) => {
  await t.test("duplicate exact names", () => {
    const { rootDir } = makeProject();
    try {
      assert.throws(() => deploy({
        rootDir,
        logger: silence,
        run(args) {
          if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
          return { stdout: JSON.stringify([{ name: "starbox", uuid: "one" }, { name: "starbox", uuid: "two" }]) };
        },
      }), /More than one D1 database is named/);
      assert.deepEqual(tempConfigs(rootDir), []);
    } finally {
      cleanup(rootDir);
    }
  });
  await t.test("id without uuid", () => {
    const { rootDir } = makeProject();
    try {
      assert.throws(() => deploy({
        rootDir,
        logger: silence,
        run(args) {
          if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
          return { stdout: JSON.stringify([{ name: "starbox", id: "not-the-documented-field" }]) };
        },
      }), /did not include a UUID/);
      assert.deepEqual(tempConfigs(rootDir), []);
    } finally {
      cleanup(rootDir);
    }
  });
});

test("fails without Cloudflare authentication and removes the temporary config", () => {
  const { rootDir } = makeProject();
  try {
    assert.throws(() => deploy({
      rootDir,
      logger: silence,
      run() { return { stdout: JSON.stringify({ loggedIn: false, accounts: [] }) }; },
    }), /not authenticated/);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally {
    cleanup(rootDir);
  }
});

test("does not deploy if remote migrations fail and always removes the temporary config", () => {
  const { rootDir, configText } = makeProject();
  const calls = [];
  try {
    assert.throws(() => deploy({
      rootDir,
      logger: silence,
      run(args) {
        calls.push(args);
        if (args[0] === "whoami") return { stdout: JSON.stringify(whoami) };
        if (args[0] === "d1" && args[1] === "list") return { stdout: JSON.stringify([{ name: "starbox", uuid: "real-id" }]) };
        if (args[0] === "d1" && args[1] === "migrations") throw new Error("remote migration failed");
        return { stdout: "" };
      },
    }), /remote migration failed/);
    assert.equal(calls.some((args) => args[0] === "deploy"), false);
    assert.equal(readFileSync(path.join(rootDir, "wrangler.jsonc"), "utf8"), configText);
    assert.deepEqual(tempConfigs(rootDir), []);
  } finally {
    cleanup(rootDir);
  }
});
