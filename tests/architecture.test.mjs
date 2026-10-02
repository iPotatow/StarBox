import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { summarizeBuild, ASSET_HEADERS } from "../scripts/build-assets.mjs";
import { fetchBounded } from "../.test-build/worker/outbound.js";
import { parsePreferencePatch, normalizeReleaseAssetRules } from "../.test-build/shared/preferences.js";

const source = (file) => readFileSync(file, "utf8");
test("Worker entry stays thin and shared contracts have no browser dependencies", () => {
  assert.ok(source("worker/index.ts").split("\n").length < 30);
  for (const file of readdirSync("shared").filter(name => name.endsWith(".ts"))) assert.doesNotMatch(source(`shared/${file}`), /(?:from\s*["'].*src\/|\bwindow\.|\bdocument\.|\blocalStorage\.)/);
  assert.doesNotMatch(source("worker/router.ts"), /(?:from\s*["'].*v5|SELECT |INSERT INTO )/);
  assert.match(source("worker/repository.ts"), /MutationPlanner/);
  assert.match(source("src/types.ts"), /shared\/contracts/);
  assert.match(source("src/lib/api-client.ts"), /AbortController/);
});

test("shared preference validation keeps omitted keys out of the patch", () => {
  assert.deepEqual(parsePreferencePatch({ theme: "dark" }), { theme: "dark" });
  assert.deepEqual(parsePreferencePatch({ assetRules: { macos: { includePattern: "dmg$" } } }), { assetRules: { macos: { includePattern: "dmg$" } } });
  assert.throws(() => parsePreferencePatch({ syncPages: 0 }));
  assert.throws(() => parsePreferencePatch({ includePrereleases: "yes" }));
  assert.throws(() => parsePreferencePatch({ assetRules: [] }));
  assert.equal(normalizeReleaseAssetRules('{"windows":{"includePattern":"exe$"}}').windows.includePattern, "exe$");
});

test("build graph measurement includes static shared chunks and excludes dynamic pages", () => {
  const graph = { outputs: {
    "dist/assets/app-HASH.js": { entryPoint: "src/main.tsx", bytes: 100, imports: [{ path: "dist/chunks/shared-A.js", kind: "import-statement" }, { path: "dist/chunks/page-B.js", kind: "dynamic-import" }] },
    "dist/chunks/shared-A.js": { bytes: 200, imports: [] },
    "dist/chunks/page-B.js": { bytes: 500, imports: [{ path: "dist/chunks/shared-A.js", kind: "import-statement" }] },
  } };
  const result = summarizeBuild(graph, `${process.cwd()}/dist`);
  assert.equal(result.entryUrl, "/assets/app-HASH.js");
  assert.equal(result.initialJsBytes, 300); assert.equal(result.totalJsBytes, 800);
  assert.match(ASSET_HEADERS, /\/assets\/\*[\s\S]*immutable/);
  assert.match(ASSET_HEADERS, /\/chunks\/\*[\s\S]*immutable/);
});

test("upstream chunked responses enforce the byte limit", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("0123456789"));
  const response = await fetchBounded("https://example.com", {}, { maxBytes: 5 });
  await assert.rejects(response.text(), { status: 502, code: "upstream_response_too_large" });
});

test("upstream declared content lengths are bounded before consumption", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("body", { headers: { "content-length": "1000" } }));
  await assert.rejects(fetchBounded("https://example.com", {}, { maxBytes: 10 }), { status: 502 });
});

test("upstream timeouts abort the fetch and report a retryable status", async (t) => {
  const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
  t.mock.method(globalThis, "fetch", async (_url, init) => new Promise((_resolve, reject) => { init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }); }));
  await assert.rejects(fetchBounded("https://example.com", {}, { timeoutMs: 5 }), { status: 504, code: "upstream_timeout" });
});

test("the public AI route preserves upstream timeout status and error code", async (t) => {
  const { AppError } = await import("../.test-build/worker/errors.js");
  const { route } = await import("../.test-build/worker/index.js");
  t.mock.method(globalThis, "fetch", async (_url, init) => { assert.equal(init.redirect, "error"); throw new AppError("upstream_timeout", "Upstream timed out", 504); });
  const response = await route(new Request("https://example.com/api/ai/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerName: "Test", baseUrl: "https://provider.example/v1", apiKey: "test-key", model: "test-model" }) }));
  assert.equal(response.status, 504); assert.equal((await response.json()).error.code, "upstream_timeout");
});
