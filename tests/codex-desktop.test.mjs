import assert from "node:assert/strict";
import test from "node:test";
import { latestCodexDesktop } from "../.test-build/worker/services/codex-desktop.js";
import { callProvider } from "../.test-build/worker/provider.js";
import { loadDefaultAiProviderConfig } from "../.test-build/worker/ai-services.js";
import { route } from "../.test-build/worker/router.js";
import { sqliteDatabase } from "./sqlite-fixture.mjs";

test("Codex presets set only their originator and never retain UA or version", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    requests.push({ input: String(input), headers: new Headers(init?.headers) });
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  });

  const preset = await latestCodexDesktop("Codex Desktop/26.930.1000 (Mac OS; arm64)");
  assert.deepEqual(preset.headers, { originator: "Codex Desktop" });
  assert.equal(preset.stale, false);
  assert.equal(requests.length, 0);

  const base = {
    providerName: "QA",
    baseUrl: "https://agentrouter.org/v1",
    apiKey: "test",
    model: "test",
    headers: { "User-Agent": "legacy-agent", version: "legacy-version", originator: "legacy-originator", "X-Tenant": "team" },
  };

  for (const [headerPreset, originator] of [["codex-desktop-latest", "Codex Desktop"], ["codex-cli", "codex_cli_rs"]]) {
    await callProvider({ ...base, headerPreset }, [{ role: "user", content: "test" }]);
    const headers = requests.at(-1).headers;
    assert.equal(headers.get("originator"), originator);
    assert.equal(headers.get("user-agent"), null);
    assert.equal(headers.get("version"), null);
    assert.equal(headers.get("x-tenant"), "team");
  }

  await callProvider({ ...base, headerPreset: null, baseUrl: "https://api.example.com/v1", headers: { "User-Agent": "manual" } }, [{ role: "user", content: "test" }]);
  assert.equal(requests.at(-1).headers.get("user-agent"), "manual");
});

test("presets require login and persist across service reads, edits and provider loading", async () => {
  const data = sqliteDatabase();
  try {
    const env = { DB: data.DB, LOGIN_PASSWORD: "test-password", STARBOX_ENCRYPTION_KEY: "test-encryption" };
    const base = "https://starbox.example";
    assert.equal((await route(new Request(base + "/api/ai/header-presets/codex-desktop"), env)).status, 401);
    const login = await route(new Request(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: env.LOGIN_PASSWORD }) }), env);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const send = (path, method = "GET", body) => route(new Request(base + path, { method, headers: { cookie, origin: base, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);

    const presetResponse = await send("/api/ai/header-presets/codex-desktop");
    assert.equal(presetResponse.status, 200);
    assert.deepEqual(await presetResponse.json(), { stale: false, headers: { originator: "Codex Desktop" } });

    const create = await send("/api/ai/services", "POST", { name: "Codex", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", apiKey: "private-key", modelId: "test", headers: { originator: "Codex Desktop" }, headerPreset: "codex-desktop-latest" });
    assert.equal(create.status, 201);
    const registry = await create.json();
    const id = registry.services[0].id;
    assert.equal(registry.services[0].headerPreset, "codex-desktop-latest");
    assert.equal((await loadDefaultAiProviderConfig(env)).headerPreset, "codex-desktop-latest");

    const edited = await (await send(`/api/ai/services/${id}`, "PATCH", { name: "Renamed", headerPreset: "codex-cli", headers: { originator: "codex_cli_rs" } })).json();
    assert.equal(edited.services[0].headerPreset, "codex-cli");
    assert.equal((await loadDefaultAiProviderConfig(env)).headerPreset, "codex-cli");

    const safe = await (await send("/api/ai/services")).text();
    assert.equal(safe.includes("private-key"), false);
    assert.equal(safe.includes('"headers"'), false);

    const invalid = await send(`/api/ai/services/${id}`, "PATCH", { headerPreset: "unknown" });
    assert.equal(invalid.status, 400);
    await send(`/api/ai/services/${id}`, "PATCH", { headerPreset: null, headers: {} });
    assert.equal((await loadDefaultAiProviderConfig(env)).headerPreset, null);
  } finally {
    data.close();
  }
});
