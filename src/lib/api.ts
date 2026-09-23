import type {
  AiAnalysisMeta, AiOrganizeResult, AiReleaseSummary, AiService, AiServicesState, AiSettings, CategoryDefinition, DiscoverResult, ForkJob, ForkRepository, LatestReleaseAiSummary,
  AuthSession, GithubIdentity, GithubRateLimit, LoginDevice, NotificationItem, PersistedState, ReleaseAssetRules, ReleaseItem, Repository, RepositoryMeta, RepositoryReadme,
} from "../types";
import { createInitialState, mergeCanonicalServerState, normalizeState } from "./storage";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  diagnostics?: string;
  retryable: boolean;
  constructor(message: string, status: number, code?: string, details?: unknown, diagnostics?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.diagnostics = diagnostics;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}
async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string | { code?: string; message?: string; details?: unknown }; diagnostics?: string };
    const structured = data.error && typeof data.error === "object" ? data.error : undefined;
    const base = structured?.message || (typeof data.error === "string" ? data.error : "") || `请求失败 (${response.status})`;
    const diagnostics = data.diagnostics;
    return new ApiError(diagnostics ? `${base} · ${diagnostics}` : base, response.status, structured?.code, structured?.details, diagnostics);
  } catch { return new ApiError(`请求失败 (${response.status})`, response.status); }
}
function githubHeaders(token: string, json = false) { return { "x-starbox-github-token": token, ...(json ? { "content-type": "application/json" } : {}) }; }
async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (method !== "GET") headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, credentials: init?.credentials ?? "same-origin", ...(method !== "GET" && init?.body === undefined ? { body: "{}" } : {}) });
  if (!response.ok) throw await readError(response);
  return await response.json() as T;
}

export async function fetchAuthSession() { return jsonRequest<AuthSession>("/api/auth/session"); }
export async function login(username: string, password: string) { return jsonRequest<AuthSession>("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); }
export async function logout() { await jsonRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }
export async function fetchLoginDevices() { return (await jsonRequest<{ devices: LoginDevice[] }>("/api/auth/devices")).devices; }
export async function renameLoginDevice(id: string, name: string) { return (await jsonRequest<{ devices: LoginDevice[] }>(`/api/auth/devices/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name }) })).devices; }
export async function revokeLoginDevice(id: string) { return jsonRequest<{ devices: LoginDevice[]; currentRevoked?: boolean }>(`/api/auth/devices/${encodeURIComponent(id)}`, { method: "DELETE", body: "{}" }); }
export async function revokeOtherLoginDevices() { return (await jsonRequest<{ devices: LoginDevice[] }>("/api/auth/devices/revoke-others", { method: "POST", body: "{}" })).devices; }

export async function fetchGithubCredential() { const data = await jsonRequest<{ connected: boolean; login?: string; githubUserId?: number; avatarUrl?: string }>("/api/github/credential"); return { connected: data.connected, identity: data.login ? { login: data.login, id: data.githubUserId, avatarUrl: data.avatarUrl } : null }; }
export async function replaceGithubCredential(token: string) { const data = await jsonRequest<{ connected: boolean; login: string; githubUserId?: number; avatarUrl?: string }>("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }); return { connected: data.connected, identity: { login: data.login, id: data.githubUserId, avatarUrl: data.avatarUrl } as GithubIdentity }; }
export async function removeGithubCredential() { return jsonRequest<{ connected: boolean }>("/api/github/credential", { method: "DELETE" }); }

type D1Record = Record<string, unknown>;
export interface BootstrapPayload {
  account?: D1Record | null;
  githubCredential?: D1Record | null;
  repositories?: D1Record[];
  repositoryMeta?: D1Record[];
  categories?: D1Record[];
  releaseSubscriptions?: Array<string | D1Record>;
  releaseAiSummaries?: D1Record[];
  forks?: D1Record[];
  notifications?: D1Record[];
  aiCredential?: D1Record | null;
  appPreferences?: D1Record | null;
  syncSummary?: D1Record | null;
  revision?: number | string;
  lastSeq?: number | string;
  cursor?: string | null;
  state?: PersistedState;
  delta?: Partial<PersistedState>;
}
export interface BootstrapResult extends BootstrapPayload { state?: PersistedState; authoritative: boolean; revision: string; lastSeq: number; githubCredential: { connected: boolean; login?: string; githubUserId?: number; avatarUrl?: string }; aiCredential: { configured: boolean }; }

function record(value: unknown): D1Record { return value && typeof value === "object" && !Array.isArray(value) ? value as D1Record : {}; }
function jsonRecord(value: unknown): D1Record { if (typeof value !== "string") return record(value); try { return record(JSON.parse(value)); } catch { return {}; } }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function boolValue(value: unknown) { return value === true || value === 1 || value === "1"; }
function normalizeRepository(input: D1Record): Repository {
  const snapshot = jsonRecord(input.github_snapshot_json ?? input.raw_json);
  const raw = { ...snapshot, ...input };
  const license = record(raw.license);
  return {
    id: numberValue(raw.id ?? raw.github_repo_id), node_id: text(raw.node_id) || undefined, name: text(raw.name, text(raw.full_name).split("/").pop() || ""),
    full_name: text(raw.full_name), description: typeof raw.description === "string" ? raw.description : null, html_url: text(raw.html_url), homepage: typeof raw.homepage === "string" ? raw.homepage : null,
    stargazers_count: numberValue(raw.stargazers_count), forks_count: numberValue(raw.forks_count), watchers_count: numberValue(raw.watchers_count), open_issues_count: numberValue(raw.open_issues_count), size: numberValue(raw.size),
    default_branch: text(raw.default_branch, "main"), visibility: text(raw.visibility) || undefined, language: typeof raw.language === "string" ? raw.language : null,
    license: text(license.spdx_id ?? license.key) || (typeof raw.license === "string" ? raw.license : null), updated_at: text(raw.github_updated_at, text(snapshot.updated_at)), pushed_at: text(raw.github_pushed_at, text(snapshot.pushed_at, text(raw.github_updated_at, text(snapshot.updated_at)))), starred_at: typeof raw.starred_at === "string" ? raw.starred_at : null,
    archived: boolValue(raw.archived), fork: boolValue(raw.fork), topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [], owner: { login: text(record(raw.owner).login), avatar_url: text(record(raw.owner).avatar_url) },
  };
}
function normalizeCategories(rows: D1Record[]): CategoryDefinition[] { return rows.map((item, index) => ({ id: text(item.id ?? item.category_id), name: text(item.name), color: text(item.color, "neutral"), order: numberValue(item.order ?? item.sort_order, index), locked: boolValue(item.locked) || boolValue(item.is_locked) })); }
function normalizeReleaseAssetRules(value: unknown, legacyInclude = "", legacyExclude = ""): ReleaseAssetRules {
  const raw = typeof value === "string" ? jsonRecord(value) : record(value);
  const rule = (platform: keyof ReleaseAssetRules) => {
    const candidate = record(raw[platform]);
    return {
      includePattern: text(candidate.includePattern, legacyInclude),
      excludePattern: text(candidate.excludePattern, legacyExclude),
    };
  };
  return { macos: rule("macos"), windows: rule("windows"), linux: rule("linux") };
}
function normalizeRepositoryMeta(rows: D1Record[], categories: CategoryDefinition[]): Record<string, RepositoryMeta> { const stringArray = (value: unknown) => { if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string"); if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []; } catch { return []; } } return []; }; return Object.fromEntries(rows.map((item) => { const categoryId = text(item.category_id ?? item.categoryId); const category = text(item.category, categories.find((candidate) => candidate.id === categoryId)?.name); const aiTags = stringArray(item.ai_tags_json ?? item.aiTags); const aiPlatforms = stringArray(item.platforms_json ?? item.ai_platforms_json ?? item.aiPlatforms); return [text(item.repositoryFullName ?? item.full_name ?? item.repo_full_name ?? item.github_repo_id), { category, categoryLocked: boolValue(item.category_locked ?? item.categoryLocked), note: text(item.note), aiSummary: text(item.ai_summary ?? item.aiSummary), aiTags, aiPlatforms, userRevision: Math.max(0, numberValue(item.user_revision ?? item.userRevision)), aiAnalyzedAt: text(item.ai_analyzed_at ?? item.aiAnalyzedAt) || null, aiInputHash: text(item.ai_input_hash ?? item.aiInputHash), aiPromptVersion: text(item.ai_prompt_version ?? item.aiPromptVersion), aiModelId: text(item.ai_model_id ?? item.aiModelId) } satisfies RepositoryMeta]; })); }
function normalizeReleaseAiSummaries(rows: D1Record[]): Record<string, LatestReleaseAiSummary> {
  const entries: Array<[string, LatestReleaseAiSummary]> = [];
  for (const item of rows) {
    const repoFullName = text(item.repo_full_name ?? item.repoFullName);
    const releaseId = numberValue(item.release_id ?? item.releaseId);
    const tagName = text(item.tag_name ?? item.tagName);
    const rawSummary = typeof item.summary_json === "string" ? jsonRecord(item.summary_json) : record(item.summary);
    const overview = text(rawSummary.overview);
    if (!repoFullName || !Number.isSafeInteger(releaseId) || releaseId <= 0 || !overview) continue;
    const list = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    entries.push([repoFullName, {
      repoFullName,
      releaseId,
      tagName,
      summary: {
        overview,
        highlights: list(rawSummary.highlights),
        fixes: list(rawSummary.fixes),
        breakingChanges: list(rawSummary.breakingChanges),
      },
      modelId: text(item.model_id ?? item.modelId),
      generatedAt: text(item.generated_at ?? item.generatedAt),
    }]);
  }
  return Object.fromEntries(entries);
}
function normalizeFork(input: D1Record): ForkJob {
  const payload = jsonRecord(input.payload_json);
  const raw = { ...payload, ...input };
  const targetFullName = text(raw.targetFullName ?? raw.fullName ?? raw.full_name);
  const [targetOwner = "", targetName = ""] = targetFullName.split("/");
  const owner = record(payload.owner);
  const latestWorkflowRaw = record(payload.latestWorkflow);
  const workflows = Array.isArray(payload.workflows) ? payload.workflows.map(record).map((item) => ({ id: numberValue(item.id), name: text(item.name), path: text(item.path), state: text(item.state) })).filter((item) => item.id > 0) : [];
  const latestWorkflow = latestWorkflowRaw.id ? { id: numberValue(latestWorkflowRaw.id), workflowId: numberValue(latestWorkflowRaw.workflowId), name: text(latestWorkflowRaw.name), status: text(latestWorkflowRaw.status), conclusion: typeof latestWorkflowRaw.conclusion === "string" ? latestWorkflowRaw.conclusion : null, htmlUrl: text(latestWorkflowRaw.htmlUrl), createdAt: text(latestWorkflowRaw.createdAt) } : null;
  const snapshotId = numberValue(payload.id ?? input.github_repo_id);
  const snapshot: ForkRepository | undefined = text(input.status) !== "deleted" && targetFullName && snapshotId > 0 ? {
    id: snapshotId,
    fullName: targetFullName,
    htmlUrl: text(payload.htmlUrl ?? payload.html_url, `https://github.com/${targetFullName}`),
    description: typeof payload.description === "string" ? payload.description : null,
    defaultBranch: text(payload.defaultBranch ?? payload.default_branch, "main"),
    pushedAt: text(payload.pushedAt ?? payload.pushed_at),
    owner: { login: text(owner.login, targetOwner), avatarUrl: text(owner.avatarUrl ?? owner.avatar_url) },
    parentFullName: text(payload.parentFullName) || null,
    parentHtmlUrl: text(payload.parentHtmlUrl) || null,
    aheadBy: payload.aheadBy == null ? null : numberValue(payload.aheadBy),
    behindBy: payload.behindBy == null ? null : numberValue(payload.behindBy),
    compareStatus: text(payload.compareStatus, "unknown"),
    latestWorkflow,
    workflows,
  } : undefined;
  return { id: text(raw.id ?? raw.fork_id, targetFullName), sourceFullName: text(raw.sourceFullName ?? raw.source_full_name ?? raw.parent_full_name), targetOwner: text(raw.targetOwner, targetOwner), targetName: text(raw.targetName, targetName), targetFullName, htmlUrl: typeof raw.htmlUrl === "string" ? raw.htmlUrl : typeof raw.html_url === "string" ? raw.html_url : null, status: (text(raw.status, "pending") as ForkJob["status"]), createdAt: text(raw.createdAt ?? raw.created_at), updatedAt: text(raw.updatedAt ?? raw.updated_at), error: text(raw.error), pollAttempts: numberValue(raw.pollAttempts, 0), nextPollAt: typeof raw.nextPollAt === "string" ? raw.nextPollAt : null, snapshot };
}
function normalizeNotification(input: D1Record): NotificationItem { return { id: text(input.id), title: text(input.title ?? input.kind), body: text(input.body), read: Boolean(input.read_at ?? input.readAt), createdAt: text(input.created_at ?? input.createdAt) }; }

export function normalizeBootstrapPayload(payload: BootstrapPayload): BootstrapResult {
  const authoritative = ["repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releaseAiSummaries", "forks"].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
  const base = createInitialState(); const categories = normalizeCategories(payload.categories ?? []); const repositoryMeta = normalizeRepositoryMeta(payload.repositoryMeta ?? [], categories); const repositories = (payload.repositories ?? []).map(normalizeRepository);
  const preferences = record(payload.appPreferences); const aiCredentialRecord = record(payload.aiCredential); const syncSummary = record(payload.syncSummary);
  const state = normalizeState({ ...base, repositories, repositoryMeta, categories, releaseSubscriptions: (payload.releaseSubscriptions ?? []).map((item) => typeof item === "string" ? item : text(item.repo_full_name ?? item.repoFullName)), releaseAiSummaries: normalizeReleaseAiSummaries(payload.releaseAiSummaries ?? []), forkJobs: (payload.forks ?? []).map(normalizeFork), lastSeq: numberValue(payload.lastSeq ?? payload.revision), lastBootstrapAt: new Date().toISOString(), settings: { ...base.settings, ai: { ...base.settings.ai, providerName: text(preferences.ai_provider_name, base.settings.ai.providerName), baseUrl: text(preferences.ai_base_url), model: text(preferences.ai_model), credentialConfigured: boolValue(aiCredentialRecord.configured), apiKey: "", headers: {} } }, releaseSettings: { ...base.releaseSettings, syncPages: numberValue(preferences.release_sync_pages, base.releaseSettings.syncPages), assetRules: normalizeReleaseAssetRules(preferences.release_asset_rules_json, text(preferences.release_asset_include_pattern), text(preferences.release_asset_exclude_pattern)) }, lastSyncAt: text(syncSummary.stars) || null, lastReleaseSyncAt: text(syncSummary.releases) || null, lastForkSyncAt: text(syncSummary.forks) || null });
  const account = record(payload.account); const credential = record(payload.githubCredential); const login = text(credential.login ?? credential.github_login ?? account.github_login) || undefined; const githubUserId = credential.githubUserId === undefined && credential.github_user_id === undefined ? undefined : numberValue(credential.githubUserId ?? credential.github_user_id);
  const githubCredential = { connected: boolValue(credential.connected) || Boolean(credential.status === "active" || login), login, githubUserId, avatarUrl: text(credential.avatarUrl ?? credential.avatar_url ?? account.github_avatar_url) || undefined };
  const aiCredential = { configured: boolValue(aiCredentialRecord.configured) };
  return { ...payload, state: authoritative ? state : payload.state, authoritative, revision: String(payload.revision ?? payload.lastSeq ?? 0), lastSeq: numberValue(payload.lastSeq ?? payload.revision), githubCredential, aiCredential };
}
export async function fetchBootstrap(cursor?: string) { const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""; try { return normalizeBootstrapPayload(await jsonRequest<BootstrapPayload>(`/api/bootstrap${query}`)); } catch (reason) { if (!(reason instanceof ApiError) || (reason.status !== 404 && reason.status !== 405)) throw reason; const fallback = await jsonRequest<{ changes: unknown[]; cursor?: string; revision?: number }>(`/api/sync/delta?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`); return normalizeBootstrapPayload({ cursor: fallback.cursor, revision: fallback.revision ?? 0, delta: undefined }); } }
export async function fetchDataChanges(after: number | string = 0, limit = 500) { const query = `?after=${encodeURIComponent(String(after))}&limit=${Math.min(500, Math.max(1, limit))}`; try { return await jsonRequest<{ changes: unknown[]; lastSeq?: number; hasMore?: boolean }>(`/api/data/changes${query}`); } catch (reason) { if (!(reason instanceof ApiError) || (reason.status !== 404 && reason.status !== 405)) throw reason; const fallback = await jsonRequest<{ changes: unknown[]; revision?: number; hasMore?: boolean }>(`/api/sync/delta?cursor=${encodeURIComponent(String(after))}&limit=${Math.min(100, Math.max(1, limit))}`); return { changes: fallback.changes, lastSeq: fallback.revision, hasMore: fallback.hasMore }; } }
export async function fetchDelta(cursor: string) { return fetchDataChanges(cursor); }
export async function commitOptimisticMutation(mutation: { id: string; operation: string; payload: unknown; baseRevision?: string }) { return jsonRequest<{ revision: string; cursor?: string; state?: Partial<PersistedState>; userRevisions?: Record<string, number> }>("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mutation) }); }
export async function refreshCanonicalState(local: PersistedState) { const canonical = await fetchBootstrap(); if (!canonical.authoritative || !canonical.state) return local; const state = mergeCanonicalServerState(local, canonical.state); return { ...state, settings: { ...state.settings, credentialConnected: canonical.githubCredential.connected, githubIdentity: canonical.githubCredential.login ? { login: canonical.githubCredential.login, id: canonical.githubCredential.githubUserId, avatarUrl: canonical.githubCredential.avatarUrl } : null } }; }
export async function commitCanonicalMutation(optimistic: PersistedState, mutation: { id: string; operation: string; payload: unknown; baseRevision?: string }) { const result = await commitOptimisticMutation(mutation); if (result.state && typeof result.state === "object" && Object.keys(result.state).length) return mergeCanonicalServerState(optimistic, result.state); return refreshCanonicalState(optimistic); }

export async function fetchNotifications() { const data = await jsonRequest<{ items: Array<{ id: string; title: string; body: string; read_at?: string | null; created_at: string }> }>("/api/notifications"); return data.items.map((item) => ({ id: item.id, title: item.title, body: item.body, read: Boolean(item.read_at), createdAt: item.created_at }) satisfies NotificationItem); }
export async function markNotificationRead(id: string) { return jsonRequest<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }
export async function fetchStarredRepositories(token: string) { return jsonRequest<{ repositories: Repository[]; partial: boolean }>("/api/github/starred", { headers: githubHeaders(token) }); }
export async function validateGithubToken(token: string) { return jsonRequest<{ login: string; avatarUrl: string }>("/api/github/user", { headers: githubHeaders(token) }); }
export async function fetchGithubRateLimit(token: string) { return jsonRequest<{ resources: GithubRateLimit[] }>("/api/github/rate-limit", { headers: githubHeaders(token) }); }
export async function fetchWatchedRepositories(token: string) { return (await jsonRequest<{ repositories: Repository[] }>("/api/github/watched", { headers: githubHeaders(token) })).repositories; }
export async function getRepository(token: string, fullName: string) { const [owner, repo] = fullName.split("/"); return (await jsonRequest<{ repository: Repository }>(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: githubHeaders(token) })).repository; }
export async function fetchRepositoryReadme(token: string, fullName: string, signal?: AbortSignal) { const [owner, repo] = fullName.split("/"); return jsonRequest<RepositoryReadme>(`/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, { headers: githubHeaders(token), signal }); }
export async function starRepository(token: string, fullName: string) { const [owner, repo] = fullName.split("/"); return (await jsonRequest<{ repository: Repository }>(`/api/github/stars/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: "PUT", headers: githubHeaders(token) })).repository; }
export async function unstarRepository(token: string, fullName: string) { const [owner, repo] = fullName.split("/"); await jsonRequest(`/api/github/stars/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: "DELETE", headers: githubHeaders(token) }); }
export async function batchStarAction(token: string, repositories: string[], action: "star" | "unstar", onProgress?: (done: number, total: number) => void) {
  const names = [...new Set(repositories)];
  const results: Array<{ fullName: string; ok: boolean; error?: string }> = [];
  for (let index = 0; index < names.length; index += 50) {
    const chunk = names.slice(index, index + 50);
    try {
      const data = await jsonRequest<{ results: typeof results }>("/api/github/stars/batch", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ repositories: chunk, action }) });
      results.push(...chunk.map((fullName) => data.results.find((result) => result.fullName === fullName) ?? { fullName, ok: false, error: "Missing batch result" }));
    } catch (error) {
      results.push(...chunk.map((fullName) => ({ fullName, ok: false, error: error instanceof Error ? error.message : "Batch request failed" })));
    }
    onProgress?.(results.length, names.length);
  }
  return results;
}
export async function fetchReleaseFeed(token: string, repositories: string[], sinceByRepo: Record<string, string> = {}, pages = 2) { const unique = Array.from(new Set(repositories)); const chunks: string[][] = []; for (let index = 0; index < unique.length; index += 10) chunks.push(unique.slice(index, index + 10)); const releases: ReleaseItem[] = []; const failures: Array<{ fullName: string; error: string }> = []; for (const chunk of chunks) { const data = await jsonRequest<{ releases: ReleaseItem[]; failures?: Array<{ fullName: string; error: string }> }>("/api/releases/feed", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ repositories: chunk, sinceByRepo, pages }) }); releases.push(...data.releases); failures.push(...(data.failures ?? [])); } releases.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()); return { releases, failures }; }
export async function fetchReleaseDetail(token: string, repoFullName: string, releaseId: number, signal?: AbortSignal) { const [owner, repo] = repoFullName.split("/"); return (await jsonRequest<{ release: ReleaseItem }>(`/api/releases/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${releaseId}`, { headers: githubHeaders(token), signal })).release; }
export async function fetchForkRepositories(token: string) { return (await jsonRequest<{ forks: ForkRepository[] }>("/api/forks/list", { headers: githubHeaders(token) })).forks; }
export async function fetchForkDetails(token: string, fullName: string) { return jsonRequest<ForkRepository>(`/api/forks/details?full_name=${encodeURIComponent(fullName)}`, { headers: githubHeaders(token) }); }
export async function syncForkUpstream(token: string, fullName: string, branch?: string) { return jsonRequest<{ message: string; mergeType: string }>("/api/forks/sync", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ fullName, branch }) }); }
export async function dispatchForkWorkflow(token: string, fullName: string, workflowId: number, ref: string, inputs: Record<string, string> = {}) { return jsonRequest<{ message: string }>("/api/forks/workflows/dispatch", { method: "POST", headers: githubHeaders(token, true), body: JSON.stringify({ fullName, workflowId, ref, inputs }) }); }
export async function fetchDiscover(token: string, channel: "popular" | "active" | "fresh", language = "", topic = "", days = 30): Promise<DiscoverResult> { const params = new URLSearchParams({ channel, language, topic, days: String(days) }); return jsonRequest<DiscoverResult>(`/api/discover?${params}`, { headers: githubHeaders(token) }); }
export async function fetchAiServices() { return jsonRequest<AiServicesState>("/api/ai/services"); }
export async function createAiService(input: { name: string; protocol: AiService["protocol"]; baseUrl: string; apiKey: string; headers?: Record<string, string>; modelId?: string; modelName?: string }) { return jsonRequest<AiServicesState>("/api/ai/services", { method: "POST", body: JSON.stringify(input) }); }
export async function updateAiService(id: string, patch: Partial<Pick<AiService, "name" | "protocol" | "baseUrl" | "enabled">> & { apiKey?: string; headers?: Record<string, string> }) { return jsonRequest<AiServicesState>(`/api/ai/services/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }); }
export async function deleteAiService(id: string) { return jsonRequest<AiServicesState>(`/api/ai/services/${encodeURIComponent(id)}`, { method: "DELETE", body: "{}" }); }
export async function testAiService(id: string, modelId?: string) { return (await jsonRequest<{ message: string }>(`/api/ai/services/${encodeURIComponent(id)}/test`, { method: "POST", body: JSON.stringify({ modelId }) })).message; }
export async function addAiModel(serviceId: string, remoteModelId: string, displayName = "") { return jsonRequest<AiServicesState>(`/api/ai/services/${encodeURIComponent(serviceId)}/models`, { method: "POST", body: JSON.stringify({ remoteModelId, displayName }) }); }
export async function updateAiModel(serviceId: string, modelId: string, patch: { remoteModelId?: string; displayName?: string; enabled?: boolean; sortOrder?: number }) { return jsonRequest<AiServicesState>(`/api/ai/services/${encodeURIComponent(serviceId)}/models/${encodeURIComponent(modelId)}`, { method: "PATCH", body: JSON.stringify(patch) }); }
export async function deleteAiModel(serviceId: string, modelId: string) { return jsonRequest<AiServicesState>(`/api/ai/services/${encodeURIComponent(serviceId)}/models/${encodeURIComponent(modelId)}`, { method: "DELETE", body: "{}" }); }
export async function setDefaultAiModel(modelId: string) { return jsonRequest<AiServicesState>("/api/ai/default-model", { method: "PUT", body: JSON.stringify({ modelId }) }); }
export async function saveAiConfig(ai: AiSettings) { return jsonRequest<{ providerName: string; baseUrl: string; model: string; credentialConfigured: boolean }>("/api/ai/config", { method: "PUT", body: JSON.stringify({ providerName: ai.providerName, baseUrl: ai.baseUrl, model: ai.model, ...(ai.apiKey.trim() ? { apiKey: ai.apiKey } : {}), ...(Object.keys(ai.headers || {}).length ? { headers: ai.headers } : {}) }) }); }
export async function fetchAiConfig() { return jsonRequest<{ providerName: string; baseUrl: string; model: string; credentialConfigured: boolean }>("/api/ai/config"); }
export async function saveReleasePreferences(settings: Pick<PersistedState["releaseSettings"], "syncPages" | "assetRules">) { return jsonRequest<{ syncPages: number; assetRules: ReleaseAssetRules }>("/api/preferences", { method: "PUT", body: JSON.stringify(settings) }); }
export async function testAiProvider(ai: AiSettings) { return (await jsonRequest<{ message: string }>("/api/ai/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ai) })).message; }
export async function organizeRepository(_ai: AiSettings, repository: Repository, options: { skipIfCurrent?: boolean; previousAnalysis?: Partial<AiAnalysisMeta> } = {}) {
  return jsonRequest<AiOrganizeResult>("/api/ai/organize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: repository.full_name,
      repository: {
        name: repository.name,
        description: repository.description,
        language: repository.language,
        topics: repository.topics,
      },
      skipIfCurrent: Boolean(options.skipIfCurrent),
      previousAnalysis: options.previousAnalysis,
    }),
  });
}
export async function summarizeRelease(_ai: AiSettings, release: ReleaseItem) {
  return jsonRequest<AiReleaseSummary>("/api/ai/release-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ release }),
  });
}
