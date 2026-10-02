import assert from "node:assert/strict";
import test from "node:test";
import { sqliteDatabase } from "./sqlite-fixture.mjs";
import { DataRepository } from "../.test-build/worker/repository.js";
import { handlePreferences } from "../.test-build/worker/preferences.js";
import { hydrateGithubToken } from "../.test-build/worker/routes/credentials.js";
import { encryptGithubToken } from "../.test-build/worker/crypto.js";
import { checkSource } from "../scripts/deploy.mjs";

function fixture(t) { const data = sqliteDatabase(); t.after(data.close); return { ...data, repository: new DataRepository(data.DB) }; }
const get = (db, name) => db.prepare("SELECT * FROM repositories WHERE full_name = ?").get(name);

test("real SQL supports repeated metadata edits and subscription toggles", async (t) => {
  const { sqlite, repository } = fixture(t);
  await repository.mutate("repository_meta.update", { fullName: "owner/tool", note: "first", expectedUserRevision: 0 });
  await repository.mutate("repository_meta.update", { fullName: "OWNER/tool", note: "second", expectedUserRevision: 1 });
  assert.equal(get(sqlite, "owner/tool").note, "second");
  await repository.subscribeRelease("owner/tool", true, 2);
  await repository.subscribeRelease("owner/tool", false, 3);
  assert.equal(get(sqlite, "owner/tool").user_revision, 4);
  assert.equal(get(sqlite, "owner/tool").release_subscribed, 0);
  await assert.rejects(repository.subscribeRelease("missing/repo", true, 2), { status: 409 });
  assert.equal(get(sqlite, "missing/repo"), undefined);
});

test("real SQL rolls back an entire batch if any base revision is stale", async (t) => {
  const { sqlite, repository } = fixture(t);
  for (const fullName of ["a/tool", "b/tool"]) await repository.subscribeRelease(fullName, true, 0);
  await repository.subscribeRelease("b/tool", true, 1);
  await assert.rejects(repository.subscribeReleaseBatch(["a/tool", "b/tool"], { "a/tool": 1, "b/tool": 1 }), { status: 409 });
  assert.equal(get(sqlite, "a/tool").user_revision, 1);
  assert.equal(get(sqlite, "b/tool").user_revision, 2);
  await assert.rejects(repository.mutate("repository_meta.update", { fullName: "a/tool", expectedUserRevision: 0, category: { id: "new", name: "new" } }), { status: 409 });
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM categories").get().count, 0);
  await assert.rejects(repository.mutate("star.unstarBatch", { repoFullNames: ["a/tool", "missing/tool"], expectedUserRevisions: { "a/tool": 1, "missing/tool": 0 } }), { status: 409 });
  assert.equal(get(sqlite, "a/tool").user_revision, 1);
});

test("preference patches preserve release rules and independent concurrent settings", async (t) => {
  const { DB, repository } = fixture(t); const env = { DB };
  const rules = { macos: { includePattern: "dmg$", excludePattern: "intel" }, windows: { includePattern: "exe$", excludePattern: "" }, linux: { includePattern: "AppImage", excludePattern: "" } };
  await repository.saveSettings({ "release.asset_rules_json": JSON.stringify(rules) });
  const put = (body) => handlePreferences(new Request("https://example.com/api/preferences", { method: "PUT", body: JSON.stringify(body) }), env, {});
  assert.equal((await put({ theme: "dark" })).status, 200);
  assert.deepEqual(JSON.parse((await repository.settings())["release.asset_rules_json"]), rules);
  await Promise.all([put({ language: "en" }), put({ accent: "blue" })]);
  const saved = await repository.settings(); assert.equal(saved["ui.language"], "en"); assert.equal(saved["ui.accent"], "blue");
  assert.equal((await put({ syncPages: 99 })).status, 400);
  assert.equal((await put(null)).status, 400);
  assert.equal((await put([])).status, 400);
  await put({ assetRules: { macos: { includePattern: "zip$", excludePattern: "" } } });
  assert.deepEqual(JSON.parse((await repository.settings())["release.asset_rules_json"]).linux, rules.linux);
});

test("bound GitHub requests ignore a foreign browser token and fail closed without cloud credentials", async (t) => {
  const { DB, repository } = fixture(t); const key = "12345678901234567890123456789012";
  const encrypted = await encryptGithubToken("bound-token", key, "primary", "42", "v1");
  await repository.saveCredential({ account_id: "primary", github_numeric_id: "42", github_login: "bound", ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: "v1", fingerprint: encrypted.fingerprint, validated_at: "now", status: "active" });
  const request = new Request("https://example.com/api/stars", { headers: { "x-starbox-github-token": "foreign-token" } });
  assert.equal((await hydrateGithubToken(request, { DB, STARBOX_ENCRYPTION_KEY: key }, {})).headers.get("x-starbox-github-token"), "bound-token");
  await repository.deleteCredential();
  await assert.rejects(hydrateGithubToken(request, { DB, STARBOX_ENCRYPTION_KEY: key }, {}), { status: 409 });
});

test("deployment stops at the local quality gate before remote commands", () => {
  let invoked = false;
  assert.throws(() => checkSource(process.cwd(), (_command, args) => { invoked = true; assert.deepEqual(args, ["run", "check:installed"]); return { status: 1 }; }), /no remote migration/);
  assert.equal(invoked, true);
});

test("relogin reuses a device, preserves its name and invalidates its former token", async (t) => {
  const { DB, sqlite, repository } = fixture(t);
  const { handleLogin, handleLogout, authenticate, DEVICE_COOKIE } = await import("../.test-build/worker/auth.js");
  const env = { DB, LOGIN_PASSWORD: "secret" };
  const login = (cookie = "") => handleLogin(new Request("https://example.com/api/auth/login", { method: "POST", headers: { "content-type": "application/json", cookie, "user-agent": "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36" }, body: JSON.stringify({ username: "admin", password: "secret", clientMetadata: { browserName: "Brave", browserVersion: "1.70", osName: "Windows", osVersion: "11" } }) }), env);
  const first = await login(); const id = (await first.json()).deviceId;
  assert.match(first.headers.get("set-cookie"), /starbox_device_id=.*HttpOnly/);
  const oldCookie = first.headers.get("set-cookie").split(";")[0];
  await repository.renameSession(id, "Work laptop");
  await handleLogout(new Request("https://example.com/api/auth/logout", { headers: { cookie: oldCookie } }), env);
  const second = await login(`${DEVICE_COOKIE}=${id}`);
  assert.equal((await second.json()).deviceId, id);
  const rows = sqlite.prepare("SELECT * FROM app_sessions").all(); assert.equal(rows.length, 1);
  assert.equal(rows[0].device_name, "Work laptop"); assert.equal(rows[0].browser, "Brave [1.70]");
  assert.equal((await (await authenticate(new Request("https://example.com/api/auth/session", { headers: { cookie: oldCookie } }), env)).response.json()).authenticated, false);
  const freshCookie = second.headers.get("set-cookie").split(";")[0];
  assert.ok((await authenticate(new Request("https://example.com/api/auth/session", { headers: { cookie: freshCookie } }), env)).identity);
});

test("browser metadata supports Chromium forks, Safari and Firefox without inventing frozen OS versions", async () => {
  const { parseClientMetadata, normalizeClientMetadata } = await import("../.test-build/shared/client-metadata.js");
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  assert.equal(parseClientMetadata(ua).osVersion, null);
  assert.equal(parseClientMetadata("").browserName, "Browser");
  assert.equal(parseClientMetadata(`${ua} Edg/130.0.1.0`).browserName, "Microsoft Edge");
  assert.equal(parseClientMetadata("Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0").browserName, "Firefox");
  assert.equal(parseClientMetadata("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1").deviceType, "mobile");
  const fallback = parseClientMetadata(ua);
  assert.equal(normalizeClientMetadata({ browserName: "X".repeat(1000), deviceType: "invalid" }, fallback).browserName.length, 80);
  assert.equal(normalizeClientMetadata(null, fallback).browserName, "Chrome");
});

test("concurrent partial asset-rule patches preserve other platforms and fields", async (t) => {
  const { DB, repository } = fixture(t);
  await repository.saveSettings({ "release.asset_rules_json": JSON.stringify({ macos: { includePattern: "old", excludePattern: "intel" }, linux: { includePattern: "AppImage", excludePattern: "debug" } }) });
  const put = (body) => handlePreferences(new Request("https://example.com/api/preferences", { method: "PUT", body: JSON.stringify(body) }), { DB }, {});
  const results = await Promise.all([
    put({ assetRules: { macos: { includePattern: "dmg$" } } }),
    put({ assetRules: { windows: { includePattern: "exe$" } } }),
    put({ assetRules: { macos: { excludePattern: "symbols" } } }),
  ]);
  assert.ok(results.every(result => result.status === 200));
  const saved = JSON.parse((await repository.settings())["release.asset_rules_json"]);
  assert.deepEqual(saved.macos, { includePattern: "dmg$", excludePattern: "symbols" });
  assert.equal(saved.windows.includePattern, "exe$");
  assert.deepEqual(saved.linux, { includePattern: "AppImage", excludePattern: "debug" });
  assert.equal((await put({ assetRules: { macos: { includePattern: 1 } } })).status, 400);
  assert.equal((await put({ assetRules: { linux: { includePattern: "[" } } })).status, 400);
});


test("Traditional Chinese preferences round-trip through the Worker and D1", async (t) => {
  const { DB, repository } = fixture(t);
  const response = await handlePreferences(new Request("https://example.com/api/preferences", {
    method: "PUT", body: JSON.stringify({ language: "zh-TW" }),
  }), { DB }, {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).language, "zh-TW");
  assert.equal((await repository.settings())["ui.language"], "zh-TW");
  const loaded = await handlePreferences(new Request("https://example.com/api/preferences"), { DB }, {});
  assert.equal((await loaded.json()).ui_language, "zh-TW");
});
