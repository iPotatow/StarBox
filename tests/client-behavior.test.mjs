import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

// Exercise production functions, including their request and updater boundaries.
const bundled = await build({ stdin: { contents: 'export * from "./src/lib/mutations"; export * from "./src/lib/api"; export * from "./src/lib/storage"; export * from "./src/lib/preferences"; export * from "./src/lib/release-assets";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", platform: "node" });
const { applyMutationPatch, runOptimisticMutation, batchStarAction, createInitialState, clearDeviceState, saveCloudPreferences, detectDeviceProfile, normalizeDeviceArchitecture, rankReleaseAssets } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test("release device detection prefers UA Client Hints and normalizes browser architecture values", async (t) => {
  assert.equal(normalizeDeviceArchitecture("arm", "64", "", "macos"), "arm64");
  assert.equal(normalizeDeviceArchitecture("x86", "64", "", "windows"), "x64");
  assert.equal(normalizeDeviceArchitecture("x86", "32", "", "windows"), "x86");

  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      userAgentData: {
        platform: "macOS",
        getHighEntropyValues: async (hints) => {
          assert.deepEqual(hints, ["architecture", "bitness"]);
          return { architecture: "arm", bitness: "64" };
        },
      },
    },
  });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "navigator", previous); else delete globalThis.navigator; });

  assert.deepEqual(await detectDeviceProfile(), { platform: "macos", architecture: "arm64" });
});

test("release asset ranking follows the selected architecture", () => {
  const settings = createInitialState().releaseSettings;
  const release = {
    assets: [
      { id: 1, name: "Demo-macos-arm64.dmg", size: 10, downloadCount: 10, browserDownloadUrl: "https://example.com/arm" },
      { id: 2, name: "Demo-macos-x64.dmg", size: 10, downloadCount: 10, browserDownloadUrl: "https://example.com/x64" },
    ],
  };
  assert.equal(rankReleaseAssets(release, settings, { platform: "macos", architecture: "arm64" })[0].asset.id, 1);
  assert.equal(rankReleaseAssets(release, settings, { platform: "macos", architecture: "x64" })[0].asset.id, 2);
});

test("stale metadata patches preserve newer notes, subscriptions and preferences", () => {
  const before = createInitialState();
  before.repositoryMeta["a/b"] = { note: "old", category: "", aiSummary: "", aiTags: [] };
  const after = structuredClone(before); after.repositoryMeta["a/b"].aiSummary = "summary";
  const current = structuredClone(before); current.repositoryMeta["a/b"].note = "new";
  current.releaseSubscriptions.push("c/d"); current.settings.theme = "dark";
  const result = applyMutationPatch(current, before, after, "repository_meta.ai");
  assert.equal(result.repositoryMeta["a/b"].note, "new");
  assert.equal(result.repositoryMeta["a/b"].aiSummary, "summary");
  assert.deepEqual(result.releaseSubscriptions, ["c/d"]);
  assert.equal(result.settings.theme, "dark");
});

test("queued mutation rollback restores its actual base and preserves unrelated edits", async (t) => {
  let state = createInitialState(); state.repositoryMeta["a/b"] = { note: "base", category: "", aiSummary: "", aiTags: [] };
  const stale = structuredClone(state);
  const first = structuredClone(stale); first.repositoryMeta["a/b"].note = "saved";
  const second = structuredClone(stale); second.repositoryMeta["a/b"].note = "failed";
  const gate = deferred(); let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; if (requests === 1) { await gate.promise; return Response.json({}); } return Response.json({ error: "Rejected" }, { status: 500 }); });
  const update = (updater) => { state = updater(state); };
  const a = runOptimisticMutation(stale, first, update, { operation: "repository_meta.update", payload: {} });
  const b = runOptimisticMutation(stale, second, update, { operation: "repository_meta.update", payload: {} });
  const rejected = assert.rejects(b, /Rejected/);
  await new Promise(setImmediate); assert.equal(requests, 1);
  state = { ...state, releaseSubscriptions: ["other/repo"] };
  gate.resolve(); await a; await rejected;
  assert.equal(state.repositoryMeta["a/b"].note, "saved");
  assert.deepEqual(state.releaseSubscriptions, ["other/repo"]);
});

test("rollback leaves a later change to the same field intact", () => {
  const before = createInitialState(); before.releaseSubscriptions = ["a/b"];
  const after = { ...before, releaseSubscriptions: ["a/b", "c/d"] };
  const current = { ...after, releaseSubscriptions: ["a/b", "c/d", "e/f"] };
  assert.deepEqual(applyMutationPatch(current, after, before, "release.subscribe", true).releaseSubscriptions, ["a/b", "e/f"]);
  const old = { ...before, repositoryMeta: { "a/b": { note: "base" } } };
  const optimistic = { ...old, repositoryMeta: { "a/b": { note: "optimistic" } } };
  const newer = { ...old, repositoryMeta: { "a/b": { note: "newer" } } };
  assert.equal(applyMutationPatch(newer, optimistic, old, "repository_meta.update", true).repositoryMeta["a/b"].note, "newer");
});

test("101 batch actions are deduplicated, chunked and report partial failure", async (t) => {
  const chunks = []; const progress = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const names = JSON.parse(init.body).repositories; chunks.push(names);
    if (chunks.length === 2) throw new Error("offline");
    return Response.json({ results: names.map((fullName) => ({ fullName, ok: true })) });
  });
  const names = Array.from({ length: 101 }, (_, i) => `owner/repo${i}`);
  const result = await batchStarAction("", [...names, names[0]], "unstar", (done, total) => progress.push([done, total]));
  assert.deepEqual(chunks.map((chunk) => chunk.length), [50, 50, 1]);
  assert.equal(result.length, 101); assert.equal(result.filter((item) => !item.ok).length, 50);
  assert.deepEqual(progress, [[50, 101], [100, 101], [101, 101]]);
});

test("clearing device cache preserves preferences and connection identity", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { removeItem() {} } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage; });
  const state = createInitialState(); state.settings.theme = "dark";
  state.settings.credentialConnected = true; state.releaseSettings.includePrereleases = false;
  state.repositories = [{ full_name: "a/b" }];
  const cleared = clearDeviceState(state);
  assert.equal(cleared.settings, state.settings); assert.equal(cleared.releaseSettings, state.releaseSettings);
  assert.deepEqual(cleared.repositories, []);
});

test("preference saves serialize requests and recover after a failed write", async (t) => {
  const calls = []; const gate = deferred();
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls.push(JSON.parse(init.body).theme);
    if (calls.length === 1) { await gate.promise; return new Response(null, { status: 500 }); }
    return Response.json({});
  });
  const first = createInitialState(); first.settings.theme = "dark";
  const second = createInitialState(); second.settings.theme = "light";
  const failed = assert.rejects(saveCloudPreferences(first), /500/);
  const saved = saveCloudPreferences(second);
  await new Promise(setImmediate); assert.deepEqual(calls, ["dark"]);
  gate.resolve(); await failed; await saved; assert.deepEqual(calls, ["dark", "light"]);
});
