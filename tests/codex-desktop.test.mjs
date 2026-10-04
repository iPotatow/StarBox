import assert from "node:assert/strict";
import test from "node:test";
import { latestDesktopVersion, CODEX_DESKTOP_FEED } from "../.test-build/shared/codex-desktop.js";
import { latestCodexDesktop } from "../.test-build/worker/services/codex-desktop.js";
import { callProvider } from "../.test-build/worker/provider.js";
import { loadDefaultAiProviderConfig } from "../.test-build/worker/ai-services.js";
import { route } from "../.test-build/worker/router.js";
import { sqliteDatabase } from "./sqlite-fixture.mjs";

const item = (version, extra = "") => `<item><sparkle:shortVersionString>${version}</sparkle:shortVersionString><sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>${extra}</item>`;

test("stable ARM64 feed selection ignores beta, malformed versions and feed ordering", () => {
  assert.equal(latestDesktopVersion(item("26.930.900") + item("26.930.1000") + item("99.1.1", "<sparkle:channel>beta</sparkle:channel>") + item("26.931.1-beta")), "26.930.1000");
  assert.throws(() => latestDesktopVersion("<html>Error page</html>"));
  assert.throws(() => latestDesktopVersion(item("26.930.1").replace("arm64", "x64")));
});

test("latest mode refreshes real outbound headers after cache expiry and survives upstream failure", async (t) => {
  let version = "26.930.1000", fail = true, feedCalls = 0;
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    if (String(input) === CODEX_DESKTOP_FEED) {
      feedCalls++;
      if (fail) throw new Error("offline");
      return new Response(item(version));
    }
    requests.push(new Headers(init.headers));
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  });
  await assert.rejects(latestCodexDesktop(), /官方版本/);
  assert.equal((await latestCodexDesktop("Codex Desktop/26.928.1 (Mac OS; arm64)")).stale, true);
  fail = false;
  const [first, duplicate] = await Promise.all([latestCodexDesktop(), latestCodexDesktop()]);
  assert.equal(first.version, duplicate.version);
  assert.equal(first.stale, false);
  const afterRefresh = feedCalls;
  const config = { providerName: "QA", baseUrl: "https://agentrouter.org/v1", apiKey: "test", model: "test", headerPreset: "codex-desktop-latest", headers: { "User-Agent": "old", "X-Tenant": "team" } };
  await callProvider(config, [{ role: "user", content: "test" }]);
  assert.equal(feedCalls, afterRefresh);
  assert.equal(requests.at(-1).get("user-agent"), "Codex Desktop/26.930.1000 (Mac OS; arm64)");
  assert.equal(requests.at(-1).get("originator"), "Codex Desktop");
  assert.equal(requests.at(-1).get("version"), null);
  assert.equal(requests.at(-1).get("x-tenant"), "team");
  let now = Date.now() + 6 * 60 * 1000;
  t.mock.method(Date, "now", () => now);
  version = "26.931.2000";
  await callProvider(config, [{ role: "user", content: "test" }]);
  assert.equal(requests.at(-1).get("user-agent"), "Codex Desktop/26.931.2000 (Mac OS; arm64)");
  fail = true;
  now += 6 * 60 * 1000;
  assert.equal((await latestCodexDesktop()).stale, true);
  await callProvider(config, [{ role: "user", content: "test" }]);
  assert.equal(requests.at(-1).get("user-agent"), "Codex Desktop/26.931.2000 (Mac OS; arm64)");
  await callProvider({ ...config, headerPreset: null, baseUrl: "https://api.example.com/v1", headers: { "User-Agent": "manual" } }, [{ role: "user", content: "test" }]);
  assert.equal(requests.at(-1).get("user-agent"), "manual");
});

test("preset requires login and persists across service reads, edits and provider loading", async (t) => {
  const data = sqliteDatabase(); t.after(data.close);
  const env = { DB: data.DB, LOGIN_PASSWORD: "test-password", STARBOX_ENCRYPTION_KEY: "test-encryption" };
  const base = "https://starbox.example";
  assert.equal((await route(new Request(base + "/api/ai/header-presets/codex-desktop"), env)).status, 401);
  const login = await route(new Request(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: env.LOGIN_PASSWORD }) }), env);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const send = (path, method = "GET", body) => route(new Request(base + path, { method, headers: { cookie, origin: base, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  const create = await send("/api/ai/services", "POST", { name: "Latest", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", apiKey: "private-key", modelId: "test", headers: { "User-Agent": "saved" }, headerPreset: "codex-desktop-latest" });
  assert.equal(create.status, 201);
  const registry = await create.json(), id = registry.services[0].id;
  assert.equal(registry.services[0].headerPreset, "codex-desktop-latest");
  assert.equal((await loadDefaultAiProviderConfig(env)).headerPreset, "codex-desktop-latest");
  const edited = await (await send(`/api/ai/services/${id}`, "PATCH", { name: "Renamed" })).json();
  assert.equal(edited.services[0].headerPreset, "codex-desktop-latest");
  const safe = await (await send("/api/ai/services")).text();
  assert.equal(safe.includes("private-key"), false);
  assert.equal(safe.includes('"headers"'), false);
  const invalid = await send(`/api/ai/services/${id}`, "PATCH", { headerPreset: "unknown" });
  assert.equal(invalid.status, 400);
  await send(`/api/ai/services/${id}`, "PATCH", { headerPreset: null, headers: {} });
  assert.equal((await loadDefaultAiProviderConfig(env)).headerPreset, null);
});
