const STORAGE_KEY = "starbox:ui:v5";
const LEGACY_STORAGE_KEYS = ["starbox:state:v4", "starbox:state:v3", "starbox:state:v2", "starbox:state:v1"];
const CACHE_DB_NAME = "starbox-cache-v5";
const CACHE_DB_VERSION = 2;
const ENTITY_STORES = ["meta", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "forks", "githubLists", "notifications"];
let memoryCache = null;
const DEFAULT_NAV = ["repositories", "releases", "forks", "lists", "discover", "notifications", "settings"];
export const defaultSettings = { githubToken: "", githubIdentity: null, credentialConnected: false, theme: "system", density: "comfortable", accent: "neutral", navOrder: [...DEFAULT_NAV], hiddenNav: [], ai: { providerName: "Custom HTTP", baseUrl: "", apiKey: "", model: "", headers: {} } };
export const emptyMeta = () => ({ category: "", note: "", aiSummary: "", aiTags: [], pinned: false });
export function releaseStateKey(id) {
    const key = String(id);
    const legacySeparator = key.lastIndexOf("#");
    return legacySeparator < 0 ? key : key.slice(legacySeparator + 1);
}
function categoryId(name) { return `cat-${name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID()}`; }
function deriveCategories(meta) { return Array.from(new Set(Object.values(meta).map((item) => item.category.trim()).filter(Boolean))).map((name, index) => ({ id: categoryId(name), name, color: "neutral", order: index, locked: false })); }
export function createInitialState() { return { version: 5, settings: structuredClone(defaultSettings), repositories: [], repositoryMeta: {}, categories: [], releaseSubscriptions: [], releases: [], releaseSettings: { latestOnly: false, includePrereleases: true, assetIncludePattern: "", assetExcludePattern: "", pageSize: 20, syncPages: 3 }, forkJobs: [], githubLists: [], notifications: [], lastSyncAt: null, lastReleaseSyncAt: null, lastListSyncAt: null, lastSeq: 0, lastBootstrapAt: null }; }
export function normalizeState(parsed) {
    const base = createInitialState();
    const repositoryMeta = parsed.repositoryMeta ?? {};
    const suppliedOrder = parsed.settings?.navOrder;
    const navOrder = Array.isArray(suppliedOrder) ? [...suppliedOrder.filter((item) => DEFAULT_NAV.includes(item)), ...DEFAULT_NAV.filter((item) => !suppliedOrder.includes(item))] : [...DEFAULT_NAV];
    return { ...base, ...parsed, version: 5, settings: { ...defaultSettings, ...parsed.settings, githubToken: "", githubIdentity: parsed.settings?.githubIdentity ?? null, credentialConnected: Boolean(parsed.settings?.credentialConnected || parsed.settings?.githubIdentity), navOrder, hiddenNav: Array.isArray(parsed.settings?.hiddenNav) ? parsed.settings.hiddenNav.filter((item) => item !== "repositories" && item !== "settings" && String(item) !== "activity") : [], ai: { ...defaultSettings.ai, ...parsed.settings?.ai, headers: parsed.settings?.ai?.headers ?? {} } }, repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [], repositoryMeta, categories: Array.isArray(parsed.categories) ? parsed.categories : deriveCategories(repositoryMeta), releaseSubscriptions: Array.isArray(parsed.releaseSubscriptions) ? parsed.releaseSubscriptions : [], releases: Array.isArray(parsed.releases) ? parsed.releases : [], releaseSettings: { ...base.releaseSettings, ...parsed.releaseSettings }, forkJobs: Array.isArray(parsed.forkJobs) ? parsed.forkJobs : [], githubLists: Array.isArray(parsed.githubLists) ? parsed.githubLists : [], notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [] };
}
/** Merge an authoritative cloud snapshot without replacing browser-owned preferences or read state. */
export function mergeCanonicalServerState(local, server) {
    const merged = { ...local, version: 5 };
    if (server.repositories !== undefined)
        merged.repositories = server.repositories;
    if (server.repositoryMeta !== undefined)
        merged.repositoryMeta = server.repositoryMeta;
    if (server.categories !== undefined)
        merged.categories = server.categories;
    if (server.releaseSubscriptions !== undefined)
        merged.releaseSubscriptions = server.releaseSubscriptions;
    if (server.releases !== undefined)
        merged.releases = server.releases;
    if (server.forkJobs !== undefined)
        merged.forkJobs = server.forkJobs;
    if (server.githubLists !== undefined)
        merged.githubLists = server.githubLists;
    if (server.notifications !== undefined)
        merged.notifications = server.notifications;
    if (server.lastSeq !== undefined)
        merged.lastSeq = server.lastSeq;
    if (server.lastBootstrapAt !== undefined)
        merged.lastBootstrapAt = server.lastBootstrapAt;
    if (server.settings) {
        merged.settings = {
            ...local.settings,
            ...(Object.prototype.hasOwnProperty.call(server.settings, "credentialConnected") ? { credentialConnected: server.settings.credentialConnected } : {}),
            ...(Object.prototype.hasOwnProperty.call(server.settings, "githubIdentity") ? { githubIdentity: server.settings.githubIdentity } : {}),
        };
    }
    return merged;
}
/** Merge a capped Stars response without treating omitted repositories as unstarred. */
export function mergeStarredRepositories(current, fetched) {
    const byFullName = new Map(current.map((repository) => [repository.full_name, repository]));
    for (const repository of fetched)
        byFullName.set(repository.full_name, repository);
    return Array.from(byFullName.values());
}
export function mergeSuccessfulReleaseFeed(state, incoming, allowedRepositories, failures, syncedAt) {
    const allowed = new Set(allowedRepositories);
    const failed = new Set(failures.map((item) => item.fullName));
    const releasesById = new Map(state.releases.filter((release) => allowed.has(release.repoFullName)).map((release) => [releaseStateKey(release.id), release]));
    for (const release of incoming) {
        if (allowed.has(release.repoFullName) && !failed.has(release.repoFullName))
            releasesById.set(releaseStateKey(release.id), release);
    }
    const next = {
        ...state,
        releases: Array.from(releasesById.values()).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()),
    };
    if (!failures.length)
        next.lastReleaseSyncAt = syncedAt;
    return next;
}
function hasIndexedDb() { return typeof indexedDB !== "undefined"; }
function openCache() {
    return new Promise((resolve, reject) => {
        if (!hasIndexedDb())
            return reject(new Error("IndexedDB unavailable"));
        const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
        request.onupgradeneeded = () => { const db = request.result; for (const name of ENTITY_STORES) {
            if (db.objectStoreNames.contains(name))
                continue;
            const keyPath = name === "meta" ? "key" : name === "repositories" ? "full_name" : name === "repositoryMeta" ? "repositoryFullName" : "id";
            const store = db.createObjectStore(name, { keyPath });
            if (name === "repositories") {
                store.createIndex("fullName", "full_name", { unique: true });
                store.createIndex("starredAt", "starred_at");
                store.createIndex("language", "language");
                store.createIndex("categoryId", "categoryId");
            }
            if (name === "releases") {
                store.createIndex("repoFullName+publishedAt", ["repoFullName", "publishedAt"]);
            }
            if (name === "forks") {
                store.createIndex("fullName", "targetFullName", { unique: true });
                store.createIndex("status", "status");
                store.createIndex("updatedAt", "updatedAt");
            }
            if (name === "notifications") {
                store.createIndex("read+createdAt", ["read", "createdAt"]);
                store.createIndex("createdAt", "createdAt");
            }
        } };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
    });
}
function entityRows(state) { return { meta: [{ key: "state", schemaVersion: 5, lastSeq: state.lastSeq ?? 0, lastBootstrapAt: state.lastBootstrapAt ?? new Date().toISOString() }], repositories: state.repositories.map((item) => ({ ...item, categoryId: state.categories.find((category) => category.name === state.repositoryMeta[item.full_name]?.category)?.id ?? "" })), repositoryMeta: Object.entries(state.repositoryMeta).map(([repositoryFullName, value]) => ({ repositoryFullName, ...value })), categories: state.categories, releaseSubscriptions: state.releaseSubscriptions.map((repoFullName) => ({ id: repoFullName, repoFullName })), releases: state.releases, forks: state.forkJobs, githubLists: state.githubLists, notifications: state.notifications }; }
function cacheState(state) { return normalizeState({ ...state, settings: { ...state.settings, githubToken: "", ai: { ...state.settings.ai, apiKey: "", headers: {} } } }); }
async function requestResult(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function saveCachedState(state) { try {
    const db = await openCache();
    const tx = db.transaction([...ENTITY_STORES], "readwrite");
    const rows = entityRows(cacheState(state));
    for (const name of ENTITY_STORES) {
        const store = tx.objectStore(name);
        store.clear();
        for (const row of rows[name])
            store.put(row);
    }
    await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    db.close();
}
catch { /* IndexedDB is an acceleration layer; D1 remains authoritative. */ } }
export async function loadCachedState() { try {
    const db = await openCache();
    const tx = db.transaction([...ENTITY_STORES], "readonly");
    const [meta, repositories, repositoryMeta, categories, releaseSubscriptions, releases, forks, githubLists, notifications] = await Promise.all(ENTITY_STORES.map((name) => requestResult(tx.objectStore(name).getAll())));
    await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
    if (!meta.length && !repositories.length && !categories.length)
        return null;
    const state = createInitialState();
    state.repositories = repositories;
    state.repositoryMeta = Object.fromEntries(repositoryMeta.map(({ repositoryFullName, ...value }) => [repositoryFullName, value]));
    state.categories = categories;
    state.releaseSubscriptions = releaseSubscriptions.map((item) => item.repoFullName);
    state.releases = releases;
    state.forkJobs = forks;
    state.githubLists = githubLists;
    state.notifications = notifications;
    const marker = meta[0];
    state.lastSeq = marker.lastSeq ?? 0;
    state.lastBootstrapAt = marker.lastBootstrapAt ?? null;
    state.lastSyncAt = state.lastBootstrapAt;
    const local = loadState();
    return normalizeState({ ...state, settings: local.settings, releaseSettings: local.releaseSettings, lastReleaseSyncAt: local.lastReleaseSyncAt, lastListSyncAt: local.lastListSyncAt });
}
catch {
    return null;
} }
function uiSnapshot(state) { return { version: 5, settings: { ...state.settings, githubToken: "" }, releaseSettings: state.releaseSettings, lastReleaseSyncAt: state.lastReleaseSyncAt, lastListSyncAt: state.lastListSyncAt }; }
export function loadState() { try {
    if (memoryCache)
        return normalizeState(memoryCache);
    const raw = localStorage.getItem(STORAGE_KEY) ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
}
catch {
    return createInitialState();
} }
export function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(uiSnapshot(state))); memoryCache = structuredClone(state); for (const key of LEGACY_STORAGE_KEYS)
    localStorage.removeItem(key); void saveCachedState(state); }
export function clearState() { memoryCache = null; localStorage.removeItem(STORAGE_KEY); for (const key of LEGACY_STORAGE_KEYS)
    localStorage.removeItem(key); if (hasIndexedDb())
    indexedDB.deleteDatabase(CACHE_DB_NAME); }
export function createExportPayload(state) { const headers = Object.fromEntries(Object.entries(state.settings.ai.headers).filter(([key]) => !/(authorization|token|secret|api[-_]?key)/i.test(key))); return { ...state, settings: { ...state.settings, githubToken: "", credentialConnected: false, ai: { ...state.settings.ai, apiKey: "", headers } } }; }
export function exportState(state) { const blob = new Blob([JSON.stringify(createExportPayload(state), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `starbox-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }
export async function importState(file) { const parsed = JSON.parse(await file.text()); if (!parsed.settings || !Array.isArray(parsed.repositories))
    throw new Error("备份文件格式不兼容"); return normalizeState(parsed); }
export async function reconcileCachedState(state) { await saveCachedState(state); }
