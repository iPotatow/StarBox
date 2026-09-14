import { createInitialState, mergeCanonicalServerState, normalizeState } from "./storage.js";
export class ApiError extends Error {
    status;
    diagnostics;
    constructor(message, status, diagnostics) { super(message); this.status = status; this.diagnostics = diagnostics; }
}
async function readError(response) {
    try {
        const data = (await response.json());
        const base = data.error || `请求失败 (${response.status})`;
        return new ApiError(data.diagnostics ? `${base} · ${data.diagnostics}` : base, response.status, data.diagnostics);
    }
    catch {
        return new ApiError(`请求失败 (${response.status})`, response.status);
    }
}
function githubHeaders(token, json = false) { return { "x-starbox-github-token": token, ...(json ? { "content-type": "application/json" } : {}) }; }
async function jsonRequest(url, init) {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    if (method !== "GET")
        headers.set("content-type", "application/json");
    const response = await fetch(url, { ...init, headers, credentials: init?.credentials ?? "same-origin", ...(method !== "GET" && init?.body === undefined ? { body: "{}" } : {}) });
    if (!response.ok)
        throw await readError(response);
    return await response.json();
}
export async function fetchAuthSession() { return jsonRequest("/api/auth/session"); }
export async function login(username, password) { return jsonRequest("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); }
export async function logout() { await jsonRequest("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }
export async function fetchGithubCredential() { const data = await jsonRequest("/api/github/credential"); return { connected: data.connected, identity: data.login ? { login: data.login, id: data.githubUserId, avatarUrl: data.avatarUrl } : null }; }
export async function replaceGithubCredential(token) { const data = await jsonRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }); return { connected: data.connected, identity: { login: data.login, id: data.githubUserId, avatarUrl: data.avatarUrl } }; }
export async function removeGithubCredential() { return jsonRequest("/api/github/credential", { method: "DELETE" }); }
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function jsonRecord(value) { if (typeof value !== "string")
    return record(value); try {
    return record(JSON.parse(value));
}
catch {
    return {};
} }
function text(value, fallback = "") { return typeof value === "string" ? value : fallback; }
function numberValue(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function boolValue(value) { return value === true || value === 1 || value === "1"; }
function normalizeRepository(input) {
    const raw = { ...jsonRecord(input.raw_json), ...input };
    const license = record(raw.license);
    return {
        id: numberValue(raw.id ?? raw.github_repo_id), node_id: text(raw.node_id) || undefined, name: text(raw.name, text(raw.full_name).split("/").pop() || ""),
        full_name: text(raw.full_name), description: typeof raw.description === "string" ? raw.description : null, html_url: text(raw.html_url), homepage: typeof raw.homepage === "string" ? raw.homepage : null,
        stargazers_count: numberValue(raw.stargazers_count), forks_count: numberValue(raw.forks_count), watchers_count: numberValue(raw.watchers_count), open_issues_count: numberValue(raw.open_issues_count), size: numberValue(raw.size),
        default_branch: text(raw.default_branch, "main"), visibility: text(raw.visibility) || undefined, language: typeof raw.language === "string" ? raw.language : null,
        license: text(license.spdx_id ?? license.key) || (typeof raw.license === "string" ? raw.license : null), updated_at: text(raw.updated_at), pushed_at: text(raw.pushed_at, text(raw.updated_at)), starred_at: typeof raw.starred_at === "string" ? raw.starred_at : null,
        archived: boolValue(raw.archived), fork: boolValue(raw.fork), topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [], owner: { login: text(record(raw.owner).login), avatar_url: text(record(raw.owner).avatar_url) },
    };
}
function normalizeCategories(rows) {
    return rows.map((item, index) => ({ id: text(item.id ?? item.category_id), name: text(item.name), color: text(item.color, "neutral"), order: numberValue(item.order ?? item.sort_order, index), locked: boolValue(item.locked) || boolValue(item.is_locked) }));
}
function normalizeRepositoryMeta(rows, categories) {
    return Object.fromEntries(rows.map((item) => { const categoryId = text(item.category_id ?? item.categoryId); const category = text(item.category, categories.find((candidate) => candidate.id === categoryId)?.name); const aiTagsRaw = item.ai_tags_json ?? item.ai_tags ?? item.aiTags; const aiTags = Array.isArray(aiTagsRaw) ? aiTagsRaw : typeof aiTagsRaw === "string" ? (() => { try {
        const parsed = JSON.parse(aiTagsRaw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    } })() : []; return [text(item.repositoryFullName ?? item.full_name ?? item.repo_full_name ?? item.github_repo_id), { category, note: text(item.note), aiSummary: text(item.ai_summary ?? item.aiSummary), aiTags: aiTags.map(String) }]; }));
}
function normalizeRelease(input) {
    const raw = { ...jsonRecord(input.payload_json), ...input };
    return { id: numberValue(raw.id ?? raw.release_id), repoFullName: text(raw.repoFullName ?? raw.repo_full_name), tagName: text(raw.tagName ?? raw.tag_name), name: text(raw.name), body: text(raw.body), htmlUrl: text(raw.htmlUrl ?? raw.html_url), publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : typeof raw.published_at === "string" ? raw.published_at : null, createdAt: text(raw.createdAt ?? raw.created_at), draft: boolValue(raw.draft), prerelease: boolValue(raw.prerelease), author: raw.author && typeof raw.author === "object" ? { login: text(record(raw.author).login), avatarUrl: text(record(raw.author).avatarUrl ?? record(raw.author).avatar_url) } : null, assets: Array.isArray(raw.assets) ? raw.assets : [] };
}
function normalizeFork(input) {
    const raw = { ...jsonRecord(input.payload_json), ...input };
    const targetFullName = text(raw.targetFullName ?? raw.full_name);
    const [targetOwner = "", targetName = ""] = targetFullName.split("/");
    return { id: text(raw.id ?? raw.fork_id, targetFullName), sourceFullName: text(raw.sourceFullName ?? raw.source_full_name ?? raw.parent_full_name), targetOwner: text(raw.targetOwner, targetOwner), targetName: text(raw.targetName, targetName), targetFullName, htmlUrl: typeof raw.htmlUrl === "string" ? raw.htmlUrl : typeof raw.html_url === "string" ? raw.html_url : null, status: text(raw.status, "pending"), createdAt: text(raw.createdAt ?? raw.created_at), updatedAt: text(raw.updatedAt ?? raw.updated_at), error: text(raw.error), pollAttempts: numberValue(raw.pollAttempts, 0), nextPollAt: typeof raw.nextPollAt === "string" ? raw.nextPollAt : null };
}
function normalizeList(input) { const raw = { ...jsonRecord(input.payload_json), ...input }; return { id: text(raw.id ?? raw.list_id), name: text(raw.name), description: text(raw.description), isPrivate: boolValue(raw.isPrivate ?? raw.is_private), items: Array.isArray(raw.items) ? raw.items : [] }; }
function normalizeNotification(input) { return { id: text(input.id), title: text(input.title ?? input.kind), body: text(input.body), read: Boolean(input.read_at ?? input.readAt), createdAt: text(input.created_at ?? input.createdAt) }; }
export function normalizeBootstrapPayload(payload) {
    const authoritative = ["repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "forks", "githubLists"].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
    const base = createInitialState();
    const categories = normalizeCategories(payload.categories ?? []);
    const repositoryMeta = normalizeRepositoryMeta(payload.repositoryMeta ?? [], categories);
    const repositories = (payload.repositories ?? []).map(normalizeRepository);
    const preferences = record(payload.appPreferences);
    const aiCredentialRecord = record(payload.aiCredential);
    const syncSummary = record(payload.syncSummary);
    const state = normalizeState({ ...base, repositories, repositoryMeta, categories, releaseSubscriptions: (payload.releaseSubscriptions ?? []).map((item) => typeof item === "string" ? item : text(item.repo_full_name ?? item.repoFullName)), releases: (payload.releases ?? []).map(normalizeRelease), forkJobs: (payload.forks ?? []).map(normalizeFork), githubLists: (payload.githubLists ?? []).map(normalizeList), lastSeq: numberValue(payload.lastSeq ?? payload.revision), lastBootstrapAt: new Date().toISOString(), settings: { ...base.settings, ai: { ...base.settings.ai, providerName: text(preferences.ai_provider_name, base.settings.ai.providerName), baseUrl: text(preferences.ai_base_url), model: text(preferences.ai_model), credentialConfigured: boolValue(aiCredentialRecord.configured), apiKey: "", headers: {} } }, releaseSettings: { ...base.releaseSettings, syncPages: numberValue(preferences.release_sync_pages, base.releaseSettings.syncPages), assetIncludePattern: text(preferences.release_asset_include_pattern), assetExcludePattern: text(preferences.release_asset_exclude_pattern) }, lastSyncAt: text(syncSummary.stars) || null, lastListSyncAt: text(syncSummary.lists) || null, lastReleaseSyncAt: text(syncSummary.releases) || null });
    const account = record(payload.account);
    const credential = record(payload.githubCredential);
    const login = text(credential.login ?? credential.github_login ?? account.github_login) || undefined;
    const githubUserId = credential.githubUserId === undefined && credential.github_user_id === undefined ? undefined : numberValue(credential.githubUserId ?? credential.github_user_id);
    const githubCredential = { connected: boolValue(credential.connected) || Boolean(credential.status === "active" || login), login, githubUserId, avatarUrl: text(credential.avatarUrl ?? credential.avatar_url) || undefined };
    const aiCredential = { configured: boolValue(aiCredentialRecord.configured) };
    return { ...payload, state: authoritative ? state : payload.state, authoritative, revision: String(payload.revision ?? payload.lastSeq ?? 0), lastSeq: numberValue(payload.lastSeq ?? payload.revision), githubCredential, aiCredential };
}
export async function fetchBootstrap(cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    try {
        return normalizeBootstrapPayload(await jsonRequest(`/api/bootstrap${query}`));
    }
    catch (reason) {
        if (!(reason instanceof ApiError) || (reason.status !== 404 && reason.status !== 405))
            throw reason;
        const fallback = await jsonRequest(`/api/sync/delta?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        return normalizeBootstrapPayload({ cursor: fallback.cursor, revision: fallback.revision ?? 0, delta: undefined });
    }
}
export async function fetchDataChanges(after = 0, limit = 500) {
    const query = `?after=${encodeURIComponent(String(after))}&limit=${Math.min(500, Math.max(1, limit))}`;
    try {
        return await jsonRequest(`/api/data/changes${query}`);
    }
    catch (reason) {
        if (!(reason instanceof ApiError) || (reason.status !== 404 && reason.status !== 405))
            throw reason;
        const fallback = await jsonRequest(`/api/sync/delta?cursor=${encodeURIComponent(String(after))}&limit=${Math.min(100, Math.max(1, limit))}`);
        return { changes: fallback.changes, lastSeq: fallback.revision, hasMore: fallback.hasMore };
    }
}
export async function fetchDelta(cursor) { return fetchDataChanges(cursor); }
export async function commitOptimisticMutation(mutation) {
    return jsonRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mutation) });
}
export async function refreshCanonicalState(local) {
    const canonical = await fetchBootstrap();
    if (!canonical.authoritative || !canonical.state)
        return local;
    const state = mergeCanonicalServerState(local, canonical.state);
    return { ...state, settings: { ...state.settings, credentialConnected: canonical.githubCredential.connected, githubIdentity: canonical.githubCredential.login ? { login: canonical.githubCredential.login, id: canonical.githubCredential.githubUserId, avatarUrl: canonical.githubCredential.avatarUrl } : null } };
}
export async function commitCanonicalMutation(optimistic, mutation) {
    const result = await commitOptimisticMutation(mutation);
    if (result.state && typeof result.state === "object" && Object.keys(result.state).length)
        return mergeCanonicalServerState(optimistic, result.state);
    return refreshCanonicalState(optimistic);
}
export async function fetchNotifications() { const data = await jsonRequest("/api/notifications"); return data.items.map((item) => ({ id: item.id, title: item.title, body: item.body, read: Boolean(item.read_at), createdAt: item.created_at })); }
export async function markNotificationRead(id) { return jsonRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }
export async function fetchStarredRepositories(token) { return jsonRequest("/api/github/starred", { headers: githubHeaders(token) }); }
export async function validateGithubToken(token) { return jsonRequest("/api/github/user", { headers: githubHeaders(token) }); }
export async function fetchGithubRateLimit(token) { return jsonRequest("/api/github/rate-limit", { headers: githubHeaders(token) }); }
export async function fetchWatchedRepositories(token) { return (await jsonRequest("/api/github/watched", { headers: githubHeaders(token) })).repositories; }
export async function getRepository(token, fullName) { const [owner, repo] = fullName.split("/"); return (await jsonRequest(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: githubHeaders(token) })).repository; }
export async function fetchRepositoryReadme(token, fullName) { const [owner, repo] = fullName.split("/"); return jsonRequest(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, { headers: githubHeaders(token) }); }
export async function starRepository(token, fullName) { const [owner, repo] = fullName.split("/"); return (await jsonRequest(`/api/github/stars/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: "PUT", headers: githubHeaders(token) })).repository; }
export async function unstarRepository(token, fullName) { const [owner, repo] = fullName.split("/"); await jsonRequest(`/api/github/stars/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: "DELETE", headers: githubHeaders(token) }); }
export async function batchStarAction(token, repositories, action) { return (await jsonRequest("/api/github/stars/batch", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ repositories, action }) })).results; }
export async function fetchReleaseFeed(token, repositories, sinceByRepo = {}, pages = 2) {
    const unique = Array.from(new Set(repositories));
    const chunks = [];
    for (let index = 0; index < unique.length; index += 10)
        chunks.push(unique.slice(index, index + 10));
    const releases = [];
    const failures = [];
    for (const chunk of chunks) {
        const data = await jsonRequest("/api/releases/feed", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ repositories: chunk, sinceByRepo, pages }) });
        releases.push(...data.releases);
        failures.push(...(data.failures ?? []));
    }
    releases.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    return { releases, failures };
}
export async function fetchReleaseDetail(token, repoFullName, releaseId) { const [owner, repo] = repoFullName.split("/"); return (await jsonRequest(`/api/releases/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${releaseId}`, { headers: githubHeaders(token) })).release; }
export async function fetchForkRepositories(token) { return (await jsonRequest("/api/forks/list", { headers: githubHeaders(token) })).forks; }
export async function fetchForkDetails(token, fullName) { return jsonRequest(`/api/forks/details?full_name=${encodeURIComponent(fullName)}`, { headers: githubHeaders(token) }); }
export async function syncForkUpstream(token, fullName, branch) { return jsonRequest("/api/forks/sync", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ fullName, branch }) }); }
export async function dispatchForkWorkflow(token, fullName, workflowId, ref, inputs = {}) { return jsonRequest("/api/forks/workflows/dispatch", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ fullName, workflowId, ref, inputs }) }); }
export async function fetchGithubLists(token) { return (await jsonRequest("/api/github/lists", { headers: githubHeaders(token) })).lists; }
export async function createGithubList(token, name, description = "", isPrivate = false) { return jsonRequest("/api/github/lists", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ name, description, isPrivate }) }); }
export async function updateGithubList(token, id, name, description, isPrivate) { return jsonRequest(`/api/github/lists/${encodeURIComponent(id)}`, { method: "PUT", headers: githubHeaders(token, true), body: JSON.stringify({ name, description, isPrivate }) }); }
export async function deleteGithubList(token, id) { await jsonRequest(`/api/github/lists/${encodeURIComponent(id)}`, { method: "DELETE", headers: githubHeaders(token) }); }
export async function setGithubListMembership(token, repoFullName, listIds) { return jsonRequest("/api/github/lists/membership", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ repoFullName, listIds }) }); }
export async function fetchDiscover(token, channel, language = "", topic = "", days = 30) {
    const params = new URLSearchParams({ channel, language, topic, days: String(days) });
    return jsonRequest(`/api/discover?${params}`, { headers: githubHeaders(token) });
}
export async function saveAiConfig(ai) { return jsonRequest("/api/ai/config", { method: "PUT", body: JSON.stringify({ providerName: ai.providerName, baseUrl: ai.baseUrl, model: ai.model, ...(ai.apiKey.trim() ? { apiKey: ai.apiKey } : {}), ...(Object.keys(ai.headers || {}).length ? { headers: ai.headers } : {}) }) }); }
export async function fetchAiConfig() { return jsonRequest("/api/ai/config"); }
export async function saveReleasePreferences(settings) { return jsonRequest("/api/preferences", { method: "PUT", body: JSON.stringify(settings) }); }
export async function testAiProvider(ai) { return (await jsonRequest("/api/ai/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ai) })).message; }
export async function organizeRepository(_ai, repository) { return jsonRequest("/api/ai/organize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repository }) }); }
export async function summarizeRelease(_ai, release) { return jsonRequest("/api/ai/release-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ release }) }); }
