import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

// Exercise production functions, including their request and updater boundaries.
const bundled = await build({ stdin: { contents: 'export * from "./src/lib/mutations"; export * from "./src/lib/api"; export * from "./src/lib/storage"; export * from "./src/lib/preferences"; export * from "./src/lib/release-assets"; export * from "./src/lib/client-detection";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", platform: "node" });
const { normalizeBootstrapPayload, fetchBootstrap, saveReleasePreferences, resetApiSession, detectClient, applyMutationPatch, runOptimisticMutation, batchStarAction, createInitialState, clearDeviceState, saveCloudPreferences, detectDeviceProfile, detectDeviceProfileFallback, normalizeDeviceArchitecture, rankReleaseAssets, releaseAssetAvailability, selectRecommendedAsset, inferReleasePlatforms, mergeReleaseSnapshot, mergeSuccessfulReleaseFeed } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
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

test("Release snapshots strip legacy per-Release AI summaries while preserving the D1-backed latest summary", () => {
  const local = {
    id: 10, repoFullName: "owner/repo", tagName: "v1", name: "v1", body: "old", htmlUrl: "https://example.com/release",
    publishedAt: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z", draft: false, prerelease: false, author: null, assets: [],
    aiSummary: { overview: "legacy local summary", highlights: ["drop"], fixes: [], breakingChanges: [] },
  };
  const remote = { ...local, body: "fresh server body", aiSummary: undefined };
  const merged = mergeReleaseSnapshot(local, remote);
  assert.equal(merged.body, "fresh server body");
  assert.equal("aiSummary" in merged, false);

  const state = createInitialState();
  state.releaseSubscriptions = ["owner/repo"];
  state.releases = [local];
  state.releaseAiSummaries = {
    "owner/repo": {
      repoFullName: "owner/repo",
      releaseId: 10,
      tagName: "v1",
      summary: { overview: "canonical summary", highlights: ["keep"], fixes: [], breakingChanges: [] },
      modelId: "model-a",
      generatedAt: "2026-09-20T00:00:00Z",
    },
  };
  const next = mergeSuccessfulReleaseFeed(state, [remote], ["owner/repo"], [], "2026-09-20T00:00:00Z");
  assert.equal(next.releases[0].body, "fresh server body");
  assert.equal("aiSummary" in next.releases[0], false);
  assert.equal(next.releaseAiSummaries["owner/repo"].summary.overview, "canonical summary");
});

test("release asset ranking follows the selected architecture", () => {
  const settings = createInitialState().releaseSettings;
  const release = {
    assets: [
      { id: 1, name: "Demo-macos-arm64.dmg", size: 10, downloadCount: 10, browserDownloadUrl: "https://example.com/arm" },
      { id: 2, name: "Demo-macos-x64.dmg", size: 10, downloadCount: 10, browserDownloadUrl: "https://example.com/x64" },
    ],
  };
  const arm = rankReleaseAssets(release, settings, { platform: "macos", architecture: "arm64" })[0];
  const intel = rankReleaseAssets(release, settings, { platform: "macos", architecture: "x64" })[0];
  assert.equal(arm.asset.id, 1);
  assert.equal(arm.architectureLabel, "ARM64");
  assert.equal(arm.architectureKnown, true);
  assert.equal(intel.asset.id, 2);
  assert.equal(intel.architectureLabel, "x64");
  assert.equal(intel.architectureKnown, true);
});

test("release platform inference rejects darwin/windows collisions and mobile desktop classification", () => {
  const platforms = inferReleasePlatforms([{ draft: false, assets: [
    { id: 1, name: "Demo-darwin-x64.zip", size: 10, downloadCount: 0, browserDownloadUrl: "https://example.com/mac" },
  ] }]);
  assert.deepEqual(platforms, ["macos"]);
  assert.deepEqual(inferReleasePlatforms([{ draft: false, assets: [{ id: 2, name: "demo-docker-image-amd64.tar.gz", size: 10, downloadCount: 0, browserDownloadUrl: "https://example.com/docker" }] }]), ["docker"]);

  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 16; Mobile)" },
  });
  try { assert.equal(detectDeviceProfileFallback().platform, "unknown"); }
  finally { if (previous) Object.defineProperty(globalThis, "navigator", previous); else delete globalThis.navigator; }
});

test("release recommendations reject explicitly incompatible architectures", () => {
  const settings = createInitialState().releaseSettings;
  const release = {
    assets: [
      { id: 1, name: "Demo-windows-arm64.exe", size: 10, downloadCount: 10, browserDownloadUrl: "https://example.com/arm" },
    ],
  };
  assert.equal(selectRecommendedAsset(release, undefined, settings, { platform: "windows", architecture: "x64" }), null);
});

test("release recommendation diagnostics distinguish empty, filtered, mismatched, and unknown architecture cases", () => {
  const settings = createInitialState().releaseSettings;
  const profile = { platform: "windows", architecture: "x64" };
  assert.equal(releaseAssetAvailability({ assets: [] }, settings, profile), "no-assets");
  assert.equal(releaseAssetAvailability({ assets: [
    { id: 1, name: "checksums.txt", size: 10, downloadCount: 0, browserDownloadUrl: "https://example.com/checksums" },
  ] }, settings, profile), "rule-filtered");
  assert.equal(releaseAssetAvailability({ assets: [
    { id: 2, name: "Demo-windows-arm64.exe", size: 10, downloadCount: 0, browserDownloadUrl: "https://example.com/arm" },
  ] }, settings, profile), "architecture-mismatch");

  const unknownArchitectureRelease = { assets: [
    { id: 3, name: "Demo-windows.exe", size: 10, downloadCount: 5, browserDownloadUrl: "https://example.com/windows" },
  ] };
  const recommendation = selectRecommendedAsset(unknownArchitectureRelease, undefined, settings, profile);
  assert.ok(recommendation);
  assert.equal(recommendation.architectureKnown, false);
  assert.equal(recommendation.architectureLabel, "Unknown");
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

test("successful optimistic writes adopt server user revisions", async (t) => {
  let state = createInitialState();
  state.repositoryMeta["a/b"] = { note: "server", category: "", aiSummary: "", aiTags: [], aiPlatforms: [], userRevision: 3 };
  const before = structuredClone(state);
  const optimistic = structuredClone(state);
  optimistic.repositoryMeta["a/b"].note = "saved";

  t.mock.method(globalThis, "fetch", async () => Response.json({ revision: "0", userRevisions: { "a/b": 4 } }));
  const update = (updater) => { state = updater(state); };
  await runOptimisticMutation(before, optimistic, update, { operation: "repository_meta.update", payload: { expectedUserRevision: 3 } });

  assert.equal(state.repositoryMeta["a/b"].note, "saved");
  assert.equal(state.repositoryMeta["a/b"].userRevision, 4);
});

test("409 optimistic conflicts keep the local draft instead of rolling it back", async (t) => {
  let state = createInitialState();
  state.repositoryMeta["a/b"] = { note: "server", category: "", aiSummary: "", aiTags: [], aiPlatforms: [], userRevision: 3 };
  const before = structuredClone(state);
  const optimistic = structuredClone(state);
  optimistic.repositoryMeta["a/b"].note = "local draft";

  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Revision conflict" }, { status: 409 }));
  const update = (updater) => { state = updater(state); };

  await assert.rejects(
    runOptimisticMutation(before, optimistic, update, { operation: "repository_meta.update", payload: { expectedUserRevision: 3 } }),
    /Revision conflict/,
  );
  assert.equal(state.repositoryMeta["a/b"].note, "local draft");
  assert.equal(state.repositoryMeta["a/b"].userRevision, 3);
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


test("failed batch unsubscribe restores subscriptions on a revision conflict", async (t) => {
  let state = createInitialState(); state.releaseSubscriptions = ["a/b", "c/d"];
  const before = structuredClone(state); const optimistic = { ...state, releaseSubscriptions: ["c/d"] };
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Revision conflict" }, { status: 409 }));
  await assert.rejects(runOptimisticMutation(before, optimistic, (update) => { state = update(state); }, { operation: "release.unsubscribe", payload: { repoFullName: "a/b", expectedUserRevision: 1 } }, { rollbackOnConflict: true }), /Revision conflict/);
  assert.deepEqual(state.releaseSubscriptions, ["c/d", "a/b"]);
});


test("Bootstrap rereads when a write overlaps its snapshot", async (t) => {
  const started = deferred(); const snapshot = deferred(); const write = deferred(); let reads = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url === "/api/bootstrap") { reads += 1; if (reads === 1) { started.resolve(); await snapshot.promise; } return Response.json({ repositories: [], repositoryMeta: [], categories: [], revision: reads }); }
    await write.promise; return Response.json({ syncPages: 2, assetRules: {} });
  });
  const loading = fetchBootstrap(); await started.promise;
  const saving = saveReleasePreferences({ syncPages: 2, assetRules: {} });
  snapshot.resolve(); write.resolve(); await saving; await loading;
  assert.equal(reads, 2);
});

test("session changes discard old mutation acknowledgements and rollback callbacks", async (t) => {
  const started = deferred(); const response = deferred(); let state = createInitialState();
  const before = structuredClone(state); const after = { ...state, releaseSubscriptions: ["a/b"] };
  t.mock.method(globalThis, "fetch", async () => { started.resolve(); await response.promise; return Response.json({ userRevisions: { "a/b": 9 } }); });
  const saving = runOptimisticMutation(before, after, (update) => { state = update(state); }, { operation: "release.subscribe", payload: {} });
  await started.promise; resetApiSession(); state = createInitialState(); response.resolve();
  await assert.rejects(saving, /登录会话已改变/);
  assert.deepEqual(state.releaseSubscriptions, []); assert.deepEqual(state.repositoryMeta, {});
});

test("runtime Brave detection and touch iPad detection degrade safely", async () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const brave = await detectClient({ userAgent: ua, maxTouchPoints: 0, brave: { isBrave: async () => true } });
  assert.equal(brave.browserName, "Brave"); assert.equal(brave.browserVersion, null);
  const ipad = await detectClient({ userAgent: ua, maxTouchPoints: 5, userAgentData: { getHighEntropyValues: async () => { throw Error("Unavailable"); } } });
  assert.equal(ipad.osName, "iOS"); assert.equal(ipad.deviceType, "tablet");
});


test("a retained bound identity does not imply an active GitHub credential", () => {
  const payload = normalizeBootstrapPayload({ account: { github_login: "bound" }, githubCredential: { connected: false, login: "bound" } });
  assert.equal(payload.githubCredential.connected, false); assert.equal(payload.githubCredential.login, "bound");
});


test("queued subscription uses the revision acknowledged by a preceding metadata write", async (t) => {
  resetApiSession();
  let state = createInitialState();
  state.repositoryMeta["queue/repo"] = { category: "", note: "old", aiSummary: "", aiTags: [], aiPlatforms: [], userRevision: 3 };
  const before = structuredClone(state);
  const edited = structuredClone(state); edited.repositoryMeta["queue/repo"].note = "saved";
  const gate = deferred(); const calls = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    if (calls.length === 1) await gate.promise;
    assert.equal(body.payload.expectedUserRevision, calls.length === 1 ? 3 : 4);
    return Response.json({ userRevisions: { "queue/repo": calls.length === 1 ? 4 : 5 } });
  });
  const update = (f) => { state = f(state); };
  const first = runOptimisticMutation(before, edited, update, { operation: "repository_meta.update", payload: { fullName: "queue/repo", expectedUserRevision: 3 } });
  const second = runOptimisticMutation(before, { ...before, releaseSubscriptions: ["queue/repo"] }, update, { operation: "release.subscribe", payload: { repoFullName: "queue/repo", expectedUserRevision: 3 } });
  await new Promise(setImmediate); assert.equal(calls.length, 1);
  gate.resolve(); await Promise.all([first, second]);
  assert.equal(state.repositoryMeta["queue/repo"].note, "saved");
  assert.equal(state.repositoryMeta["queue/repo"].userRevision, 5);
});

test("single subscription refreshes a stale cloud revision and retries only once", async (t) => {
  resetApiSession();
  let state = createInitialState(); let writes = 0;
  state.repositoryMeta["stale/repo"] = { category: "", note: "local draft", aiSummary: "", aiTags: [], aiPlatforms: [], userRevision: 0 };
  const before = structuredClone(state);
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url === "/api/bootstrap") return Response.json({ repositoryMeta: [{ full_name: "stale/repo", user_revision: 7, note: "cloud" }], releaseSubscriptions: [] });
    writes++;
    if (writes === 1) return Response.json({ error: "Revision conflict" }, { status: 409 });
    assert.equal(JSON.parse(init.body).payload.expectedUserRevision, 7);
    return Response.json({ userRevisions: { "stale/repo": 8 } });
  });
  await runOptimisticMutation(before, { ...before, releaseSubscriptions: ["stale/repo"] }, (f) => { state = f(state); }, { operation: "release.subscribe", payload: { repoFullName: "stale/repo", expectedUserRevision: 0 } });
  assert.equal(writes, 2); assert.deepEqual(state.releaseSubscriptions, ["stale/repo"]);
  assert.equal(state.repositoryMeta["stale/repo"].note, "local draft");
  assert.equal(state.repositoryMeta["stale/repo"].userRevision, 8);
});

test("a second subscription conflict rolls back and preserves the editor draft", async (t) => {
  resetApiSession();
  let state = createInitialState(); let writes = 0;
  state.repositoryMeta["conflict/repo"] = { category: "", note: "draft", aiSummary: "", aiTags: [], aiPlatforms: [], userRevision: 1 };
  const before = structuredClone(state);
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "/api/bootstrap") return Response.json({ repositoryMeta: [{ full_name: "conflict/repo", user_revision: 2 }], releaseSubscriptions: [] });
    writes++; return Response.json({ error: "Revision conflict" }, { status: 409 });
  });
  await assert.rejects(runOptimisticMutation(before, { ...before, releaseSubscriptions: ["conflict/repo"] }, (f) => { state = f(state); }, { operation: "release.subscribe", payload: { repoFullName: "conflict/repo", expectedUserRevision: 1 } }), /Revision conflict/);
  assert.equal(writes, 2); assert.deepEqual(state.releaseSubscriptions, []);
  assert.equal(state.repositoryMeta["conflict/repo"].note, "draft");
});
