import assert from "node:assert/strict";
import test from "node:test";
import { createExportPayload, createInitialState, loadState, normalizeState, saveState } from "../.test-build/client/lib/storage.js";

function storageStub() { const values = new Map(); return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); }, clear() { values.clear(); } }; }

test("normalization keeps v5 UI defaults while never restoring GitHub secrets", () => {
  const normalized = normalizeState({ version: 5, settings: { githubToken: "token", theme: "dark", density: "compact", ai: { providerName: "x", baseUrl: "https://api.example.com/v1", apiKey: "secret", model: "m", headers: {} } }, repositoryMeta: { "a/b": { category: "前端", note: "", aiSummary: "", aiTags: [], pinned: false } } });
  assert.equal(normalized.version, 5);
  assert.equal(normalized.categories[0].name, "前端");
  assert.equal(normalized.settings.githubToken, "");
  assert.equal(normalized.settings.credentialConnected, false);
  assert.deepEqual(normalized.githubLists, []);
  assert.deepEqual(normalized.notifications, []);
});

test("UI snapshot keeps browser-local AI settings but strips GitHub token", () => {
  globalThis.localStorage = storageStub();
  const state = createInitialState(); state.settings.githubToken = "github-secret"; state.settings.ai.apiKey = "ai-local-secret"; state.settings.ai.headers = { "X-Tenant": "team-a" };
  saveState(state);
  const loaded = loadState(); const uiSnapshot = JSON.parse(globalThis.localStorage.getItem("starbox:ui:v5"));
  assert.equal(loaded.version, 5); assert.equal(uiSnapshot.settings.githubToken, ""); assert.equal(uiSnapshot.settings.ai.apiKey, "ai-local-secret"); assert.equal(uiSnapshot.settings.ai.headers["X-Tenant"], "team-a");
});

test("export payload strips GitHub and AI credentials while keeping safe headers", () => {
  const state = createInitialState(); state.settings.githubToken = "github-secret"; state.settings.ai.apiKey = "ai-secret"; state.settings.ai.headers = { Authorization: "secret", "X-Tenant": "safe" };
  const payload = createExportPayload(state);
  assert.equal(payload.settings.githubToken, ""); assert.equal(payload.settings.credentialConnected, false); assert.equal(payload.settings.ai.apiKey, ""); assert.equal(payload.settings.ai.headers.Authorization, undefined); assert.equal(payload.settings.ai.headers["X-Tenant"], "safe");
});

test("entity cache schema is explicit and does not expose a snapshot store", async () => {
  const source = await import("node:fs").then(({ readFileSync }) => readFileSync("src/lib/storage.ts", "utf8"));
  for (const store of ["meta", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "releaseStates", "forks", "githubLists", "notifications"]) assert.match(source, new RegExp(`\\"${store}\\"`));
  assert.doesNotMatch(source, /CACHE_STORE|authoritative-state|createV4Backup|chunkMigrationPayload|checksumText/);
  assert.match(source, /fullName/); assert.match(source, /starredAt/); assert.match(source, /repoFullName\+publishedAt/); assert.match(source, /read\+createdAt/);
});

test("entity key paths match normalized bootstrap records", async () => {
  const source = await import("node:fs").then(({ readFileSync }) => readFileSync("src/lib/storage.ts", "utf8"));
  assert.match(source, /name === "repositories" \? "full_name"/);
  assert.match(source, /name === "repositoryMeta" \? "repositoryFullName"/);
  assert.match(source, /: "id"/);
  assert.match(source, /repositoryFullName, \.\.\.value/);
  assert.match(source, /releaseSubscriptions\.map\(\(repoFullName\) => \(\{ id: repoFullName, repoFullName \}\)\)/);
  assert.match(source, /forkJobs/);
});
