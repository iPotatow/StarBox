import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { sourceBuildId } from "../scripts/build-info.mjs";
import { parseBuildInfo, sameBuild } from "../.test-build/shared/system-info.js";
import { route } from "../.test-build/worker/router.js";
import { handleSystemInfo } from "../.test-build/worker/routes/system-info.js";
import { sqliteDatabase } from "./sqlite-fixture.mjs";
const metadata = { version: "0.1.1", buildId: "a".repeat(24), builtAt: "2026-10-02T01:00:00Z", source: "local" };
const url = "https://starbox.example/api/system/info";

test("build identity is content-based, order-independent and distinguishes source paths", () => {
  const entries = [["src/a.ts", Buffer.from("a")], ["worker/b.ts", Buffer.from("b")]];
  assert.equal(sourceBuildId(entries), sourceBuildId([...entries].reverse()));
  assert.notEqual(sourceBuildId(entries), sourceBuildId([["src/a.ts", Buffer.from("changed")], entries[1]]));
  assert.notEqual(sourceBuildId(entries), sourceBuildId([["src/renamed.ts", Buffer.from("a")], entries[1]]));
  assert.equal(parseBuildInfo(metadata).buildId, metadata.buildId);
  assert.equal(parseBuildInfo({ ...metadata, builtAt: "invalid" }), null);
  assert.equal(parseBuildInfo({ ...metadata, buildId: "unknown" }), null);
  assert.equal(sameBuild(metadata, { ...metadata, buildId: "b".repeat(24) }), false);
});

test("system info requires login and exposes real build, Worker metadata and schema fingerprint without secrets", async (t) => {
  const data = sqliteDatabase(); t.after(data.close);
  const env = { DB: data.DB, LOGIN_PASSWORD: "private-password", STARBOX_ENCRYPTION_KEY: "private-encryption", CF_VERSION_METADATA: { id: "real-version-id", tag: "production", timestamp: "2026-10-02T02:00:00Z" }, ASSETS: { async fetch(request) { assert.equal(new URL(request.url).pathname, "/build-info.json"); assert.equal(request.headers.get("cookie"), null); return Response.json(metadata); } } };
  const denied = await route(new Request(url), env); assert.equal(denied.status, 401);
  const login = await route(new Request("https://starbox.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: env.LOGIN_PASSWORD }) }), env);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await route(new Request(url, { headers: { cookie } }), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const info = await response.json();
  assert.deepEqual(info.build, metadata); assert.equal(info.worker.versionId, "real-version-id");
  assert.equal(info.database.tableCount, 8); assert.equal(info.database.backend, "D1"); assert.equal(info.database.status, "ready"); assert.match(info.database.schemaFingerprint, /^[a-f0-9]{16}$/);
  const text = JSON.stringify(info); assert.equal(text.includes(env.LOGIN_PASSWORD), false); assert.equal(text.includes(env.STARBOX_ENCRYPTION_KEY), false); assert.equal(text.includes(cookie), false); assert.equal(text.includes("CREATE TABLE"), false);
  data.sqlite.exec("CREATE TABLE diagnostic_fixture (id TEXT)");
  const next = await (await handleSystemInfo(new Request(url), env)).json(); assert.notEqual(info.database.schemaFingerprint, next.database.schemaFingerprint); assert.equal(next.database.tableCount, 9);
});

test("missing metadata and failing database degrade to truthful unknown states", async () => {
  const noBinding = await (await handleSystemInfo(new Request(url), {})).json();
  assert.equal(noBinding.build, null); assert.equal(noBinding.worker.versionId, null); assert.equal(noBinding.database.status, "unconfigured");
  const failing = await (await handleSystemInfo(new Request(url), { DB: { prepare() { throw new Error("secret-db-error"); } }, ASSETS: { fetch: async () => new Response("<html>SPA fallback</html>") } })).json();
  assert.equal(failing.database.status, "unavailable"); assert.equal(failing.build, null); assert.equal(JSON.stringify(failing).includes("secret-db-error"), false);
});

const bundled = await build({ stdin: { contents: 'export * from "./src/lib/system-info";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", platform: "node" });
const { captureSystemClient, reportedArchitecture } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
test("device diagnostics use browser-reported hardware hints and do not guess modern macOS versions or architecture", async () => {
  const view = { screen: { width: 1680, height: 1050 }, devicePixelRatio: 2, innerWidth: 390, innerHeight: 844 };
  const nav = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36", platform: "MacIntel", maxTouchPoints: 0, language: "zh-CN" };
  const hidden = await captureSystemClient(nav, view);
  assert.equal(hidden.architecture, null); assert.equal(hidden.model, null); assert.equal(hidden.client.osName, "macOS"); assert.equal(hidden.client.osVersion, null); assert.equal(hidden.screen.scale, 2); assert.equal(hidden.viewport.width, 390);
  const exposed = await captureSystemClient({ ...nav, userAgentData: { getHighEntropyValues: async (hints) => hints.includes("architecture") ? { architecture: "arm", bitness: "64", model: "" } : {} } }, view);
  assert.equal(exposed.architecture, "arm64"); assert.equal(reportedArchitecture("x86", "64"), "x64");
  const denied = await captureSystemClient({ ...nav, userAgentData: { getHighEntropyValues: async () => { throw new Error("denied"); } } }, view);
  assert.equal(denied.architecture, null);
});
