import { callProvider, type ProviderConfig } from "./provider.js";
import { authenticate, handleDevices, handleLogin, handleLogout, handleRevokeOtherDevices, handleSession, validateMutationRequest } from "./auth.js";
import { handleAiConfig, handleBootstrap, handleGithubCredential, handleNotifications, handlePreferences, handleSync, handleSyncMutation, hydrateGithubToken, loadAiProviderConfig } from "./v5.js";
import { DataRepository } from "./repository.js";
import { validateEncryptionKey } from "./crypto.js";
import { handleAiDefaultModel, handleAiServices } from "./ai-services.js";
import type { Identity, StarBoxEnv } from "./types.js";
import { inferReleasePlatformsFromAssets, RELEASE_PLATFORM_ORDER, type ReleasePlatform } from "../src/lib/release-platform-core.js";

type GithubStarredItem = { starred_at: string; repo: GithubRepo };
type GithubRepo = {
  id: number; node_id?: string; name: string; full_name: string; description: string | null; html_url: string; homepage?: string | null;
  stargazers_count: number; forks_count: number; watchers_count?: number; open_issues_count?: number; size?: number;
  default_branch?: string; visibility?: string; language: string | null; license: { spdx_id?: string | null; key?: string | null } | null;
  updated_at: string; pushed_at: string; archived: boolean; fork?: boolean; topics?: string[];
  owner: { login: string; avatar_url: string };
  parent?: { full_name: string; html_url: string; default_branch?: string };
};
type GithubRelease = { id: number; tag_name: string; name: string | null; body: string | null; html_url: string; published_at: string | null; created_at: string; draft: boolean; prerelease: boolean; author: { login: string; avatar_url: string } | null; assets: Array<{ id: number; name: string; size: number; download_count: number; browser_download_url: string }> };
type RepositoryInput = { name: string; description: string | null; language: string | null; topics: string[] };
type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string; type?: string }> };

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function error(message: string, status = 400, diagnostics = "") { return json({ error: message, ...(diagnostics ? { diagnostics } : {}) }, { status }); }
function githubToken(request: Request) { return request.headers.get("x-starbox-github-token")?.trim() || ""; }
function requireToken(request: Request) { const token = githubToken(request); if (!token) throw new Response(JSON.stringify({ error: "缺少 GitHub Token" }), { status: 401, headers: jsonHeaders }); return token; }

export function parseFullName(value: string) {
  const normalized = value.trim(); const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) throw new Error("仓库名称必须为 owner/repo");
  return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function isoDateDaysAgo(days: number) { return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10); }

async function githubFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("Accept", headers.get("Accept") || "application/vnd.github+json"); headers.set("Authorization", `Bearer ${token}`); headers.set("User-Agent", "StarBox-Workers"); headers.set("X-GitHub-Api-Version", "2026-03-10");
  return fetch(`https://api.github.com${path}`, { ...init, headers });
}
function rateDiagnostic(response: Response) {
  const remaining = response.headers.get("x-ratelimit-remaining"); const limit = response.headers.get("x-ratelimit-limit"); const reset = response.headers.get("x-ratelimit-reset"); const retry = response.headers.get("retry-after");
  const parts = [] as string[]; if (remaining !== null && limit !== null) parts.push(`GitHub API 剩余 ${remaining}/${limit}`); if (reset) parts.push(`重置 ${new Date(Number(reset) * 1000).toLocaleString("zh-CN")}`); if (retry) parts.push(`Retry-After ${retry}s`); return parts.join(" · ");
}
async function githubError(response: Response) {
  let detail = ""; try { const payload = (await response.json()) as { message?: string }; detail = payload.message || ""; } catch { /* non-json */ }
  const diagnostic = rateDiagnostic(response);
  if (response.status === 401) return { message: "GitHub Token 无效或已过期", status: 401, diagnostic };
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") return { message: "GitHub API 速率额度已用尽", status: 429, diagnostic };
  if (response.status === 403) return { message: detail ? `GitHub 权限不足：${detail}` : "GitHub API 权限不足", status: 403, diagnostic };
  if (response.status === 404) return { message: "GitHub 资源不存在或当前 Token 无权访问", status: 404, diagnostic };
  if (response.status === 409) return { message: detail ? `GitHub 冲突：${detail}` : "GitHub 操作发生冲突", status: 409, diagnostic };
  if (response.status === 422) return { message: detail ? `GitHub 校验失败：${detail}` : "GitHub 请求无法处理", status: 422, diagnostic };
  return { message: detail ? `GitHub API：${detail}` : `GitHub API 错误 (${response.status})`, status: response.status >= 500 ? 502 : response.status, diagnostic };
}
async function githubGraphql<T>(token: string, query: string, variables: Record<string, unknown> = {}) {
  const response = await githubFetch("/graphql", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (!response.ok) { const failure = await githubError(response); throw Object.assign(new Error(failure.message), { status: failure.status, diagnostics: failure.diagnostic }); }
  const payload = (await response.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) { const message = payload.errors.map((item) => item.message).join("; "); throw Object.assign(new Error(`GitHub GraphQL：${message}`), { status: message.toLowerCase().includes("scope") ? 403 : 400 }); }
  if (!payload.data) throw new Error("GitHub GraphQL 返回空数据"); return payload.data;
}

export function normalizeRepository(repo: GithubRepo, starredAt: string | null = null) {
  return { id: repo.id, node_id: repo.node_id, name: repo.name, full_name: repo.full_name, description: repo.description, html_url: repo.html_url, homepage: repo.homepage ?? null, stargazers_count: repo.stargazers_count, forks_count: repo.forks_count, watchers_count: repo.watchers_count ?? repo.stargazers_count, open_issues_count: repo.open_issues_count ?? 0, size: repo.size ?? 0, default_branch: repo.default_branch ?? "main", visibility: repo.visibility ?? "public", language: repo.language, license: repo.license?.spdx_id || repo.license?.key || null, updated_at: repo.updated_at, pushed_at: repo.pushed_at, starred_at: starredAt, archived: repo.archived, fork: Boolean(repo.fork), topics: repo.topics || [], owner: repo.owner };
}
function normalizeRelease(repoFullName: string, release: GithubRelease) { return { id: release.id, repoFullName, tagName: release.tag_name, name: release.name || release.tag_name, body: release.body || "", htmlUrl: release.html_url, publishedAt: release.published_at, createdAt: release.created_at, draft: release.draft, prerelease: release.prerelease, author: release.author ? { login: release.author.login, avatarUrl: release.author.avatar_url } : null, assets: (release.assets || []).map((asset) => ({ id: asset.id, name: asset.name, size: asset.size, downloadCount: asset.download_count, browserDownloadUrl: asset.browser_download_url })) }; }
const PLATFORM_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PLATFORM_RULE_VERSION = "release-platform-v2";
async function resolveReleasePlatforms(request: Request, env: StarBoxEnv | undefined, fullName: string) {
  const persisted = env?.DB ? new DataRepository(env.DB) : null;
  const cached = persisted ? await persisted.releasePlatformState(fullName) : { platforms: [] as string[], checkedAt: null as string | null, ruleVersion: null as string | null, checkState: "never" };
  const checkedAt = cached.checkedAt ? new Date(cached.checkedAt).getTime() : 0;
  if (cached.checkState === "success" && cached.ruleVersion === PLATFORM_RULE_VERSION && checkedAt && Date.now() - checkedAt < PLATFORM_CACHE_TTL_MS) {
    return cached.platforms.filter((item): item is ReleasePlatform => (RELEASE_PLATFORM_ORDER as readonly string[]).includes(item));
  }

  const token = githubToken(request);
  if (!token) return cached.platforms.filter((item): item is ReleasePlatform => (RELEASE_PLATFORM_ORDER as readonly string[]).includes(item));

  try {
    const { owner, repo } = parseFullName(fullName);
    const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=5&page=1`, token);
    if (!response.ok) {
      await persisted?.markReleasePlatformFailure(fullName, PLATFORM_RULE_VERSION);
      return cached.platforms.filter((item): item is ReleasePlatform => (RELEASE_PLATFORM_ORDER as readonly string[]).includes(item));
    }
    const releases = (await response.json()) as GithubRelease[];
    const platforms = inferReleasePlatformsFromAssets(releases);
    await persisted?.saveReleasePlatformState(fullName, platforms, PLATFORM_RULE_VERSION);
    return platforms;
  } catch {
    await persisted?.markReleasePlatformFailure(fullName, PLATFORM_RULE_VERSION).catch(() => undefined);
    return cached.platforms.filter((item): item is ReleasePlatform => (RELEASE_PLATFORM_ORDER as readonly string[]).includes(item));
  }
}
async function parseBody<T>(request: Request): Promise<T> { try { return (await request.json()) as T; } catch { throw new Error("请求 JSON 无效"); } }
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function fetchRepositoryRaw(token: string, fullName: string) { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token); if (!response.ok) { const f = await githubError(response); throw Object.assign(new Error(f.message), { status: f.status, diagnostics: f.diagnostic }); } return (await response.json()) as GithubRepo; }
async function fetchRepository(token: string, fullName: string) { return normalizeRepository(await fetchRepositoryRaw(token, fullName), null); }

async function handleGithubUser(request: Request) { const token = requireToken(request); const response = await githubFetch("/user", token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const user = (await response.json()) as { login: string; avatar_url: string }; return json({ login: user.login, avatarUrl: user.avatar_url }); }
async function handleRateLimit(request: Request) { const response = await githubFetch("/rate_limit", requireToken(request)); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const payload = (await response.json()) as { resources?: Record<string, { limit: number; remaining: number; used: number; reset: number }> }; const resources = Object.entries(payload.resources ?? {}).map(([resource, item]) => ({ resource, limit: item.limit, remaining: item.remaining, used: item.used, resetAt: new Date(item.reset * 1000).toISOString() })); return json({ resources }); }

async function persistStarSnapshot(env: StarBoxEnv, repositories: ReturnType<typeof normalizeRepository>[], reachedEnd: boolean) {
  const db = env.DB;
  if (!db) return;
  const repository = new DataRepository(db);
  await repository.ensureAccount();
  const previous = new Set(await repository.listStarredFullNames());
  const current = new Set(repositories.map((item) => item.full_name));
  await repository.upsertRepositories(repositories, true);
  const removedNames = reachedEnd ? [...previous].filter((fullName) => !current.has(fullName)) : [];
  await repository.markRepositoriesUnstarred(removedNames, "sync");
  await repository.change("repository", "stars", "sync");
  await repository.recordActivity("stars_synced", { count: repositories.length, removed: removedNames.length, complete: reachedEnd });
  await repository.saveSyncState("stars", null, await repository.revision());
}

async function handleStarred(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request);
  const repositories: ReturnType<typeof normalizeRepository>[] = [];
  let reachedEnd = false;
  for (let page = 1; page <= 30; page += 1) {
    const response = await githubFetch(`/user/starred?per_page=100&page=${page}`, token, { headers: { Accept: "application/vnd.github.star+json" } });
    if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); }
    const items = (await response.json()) as GithubStarredItem[];
    for (const item of items) repositories.push(normalizeRepository(item.repo, item.starred_at));
    const link = response.headers.get("link");
    if (!(link && /rel="next"/i.test(link))) { reachedEnd = true; break; }
  }
  if (env?.DB) await persistStarSnapshot(env, repositories, reachedEnd);
  return json({ repositories, partial: !reachedEnd });
}
async function handleWatched(request: Request) { const token = requireToken(request); const repositories: ReturnType<typeof normalizeRepository>[] = []; for (let page = 1; page <= 10; page += 1) { const response = await githubFetch(`/user/subscriptions?per_page=100&page=${page}`, token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const items = (await response.json()) as GithubRepo[]; repositories.push(...items.map((repo) => normalizeRepository(repo, null))); if (items.length < 100) break; } return json({ repositories }); }
async function handleRepository(request: Request, owner: string, repo: string) { try { return json({ repository: await fetchRepository(requireToken(request), `${owner}/${repo}`) }); } catch (reason) { const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status: number }).status) : 400; return error(reason instanceof Error ? reason.message : "读取仓库失败", status, typeof reason === "object" && reason && "diagnostics" in reason ? String((reason as { diagnostics: string }).diagnostics) : ""); } }
async function handleReadme(request: Request, owner: string, repo: string) { const token = requireToken(request); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, token, { headers: { Accept: "application/vnd.github.raw+json" } }); if (response.status === 404) return json({ content: "", htmlUrl: `https://github.com/${owner}/${repo}#readme` }); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } return json({ content: await response.text(), htmlUrl: `https://github.com/${owner}/${repo}#readme` }); }
async function mutateStar(token: string, fullName: string, action: "star" | "unstar") { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token, { method: action === "star" ? "PUT" : "DELETE" }); if (!response.ok) { const f = await githubError(response); throw Object.assign(new Error(f.message), { status: f.status }); } }
async function handleStarMutation(request: Request, owner: string, repo: string, env?: StarBoxEnv) {
  const token = requireToken(request);
  const fullName = `${owner}/${repo}`;
  try {
    const action = request.method === "PUT" ? "star" : "unstar";
    await mutateStar(token, fullName, action);
    const repository = action === "star" ? { ...(await fetchRepository(token, fullName)), starred_at: new Date().toISOString() } : null;
    if (env?.DB) {
      const persisted = new DataRepository(env.DB);
      if (action === "star" && repository) {
        await persisted.upsertRepository(repository, true);
        await persisted.recordActivity("starred", { fullName });
      } else {
        await persisted.markRepositoryUnstarred(fullName, true);
      }
    }
    if (action === "unstar") return json({ ok: true, fullName });
    return json({ ok: true, fullName, repository });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status: number }).status) : 500;
    return error(reason instanceof Error ? reason.message : "Star 操作失败", status);
  }
}
async function handleBatchStars(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request);
  try {
    const body = await parseBody<{ repositories: string[]; action: string }>(request);
    if (!Array.isArray(body.repositories) || body.repositories.length === 0 || body.repositories.length > 50) throw new Error("批量操作需要 1-50 个仓库");
    if (body.action !== "unstar") throw new Error("批量 Star 不受支持，仅允许批量取消 Star");
    const results: Array<{ fullName: string; ok: boolean; error?: string }> = [];
    for (let index = 0; index < body.repositories.length; index += 5) {
      const part = await Promise.all(body.repositories.slice(index, index + 5).map(async (fullName) => {
        try {
          await mutateStar(token, fullName, "unstar");
          if (env?.DB) {
            const persisted = new DataRepository(env.DB);
            await persisted.markRepositoryUnstarred(fullName, true);
          }
          return { fullName, ok: true };
        } catch (reason) {
          return { fullName, ok: false, error: reason instanceof Error ? reason.message : "操作失败" };
        }
      }));
      results.push(...part);
    }
    return json({ results });
  } catch (reason) {
    return error(reason instanceof Error ? reason.message : "批量操作失败", 400);
  }
}

async function handleReleaseFeed(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request);
  try {
    const body = await parseBody<{ repositories: string[]; sinceByRepo?: Record<string, string>; pages?: number }>(request);
    if (!Array.isArray(body.repositories) || body.repositories.length > 10) throw new Error("每次最多同步 10 个 Release 订阅");
    const maxPages = clamp(Number(body.pages) || 2, 1, 5);
    const releases: ReturnType<typeof normalizeRelease>[] = [];
    const failures: Array<{ fullName: string; error: string }> = [];
    const repositoryResults = await Promise.all(body.repositories.map(async (fullName) => {
      const repoReleases: ReturnType<typeof normalizeRelease>[] = [];
      try {
        const { owner, repo } = parseFullName(fullName); const since = body.sinceByRepo?.[fullName] ? new Date(body.sinceByRepo[fullName]).getTime() : 0;
        let reachedBoundary = false;
        for (let page = 1; page <= maxPages; page += 1) {
          const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=50&page=${page}`, token);
          if (!response.ok) { const f = await githubError(response); throw Object.assign(new Error(f.message), { status: f.status }); }
          const items = (await response.json()) as GithubRelease[];
          if (!items.length) { reachedBoundary = true; break; }
          const normalized = items.map((item) => normalizeRelease(fullName, item)); repoReleases.push(...normalized);
          const oldest = Math.min(...normalized.map((item) => new Date(item.publishedAt || item.createdAt).getTime()));
          if (items.length < 50 || (since && oldest <= since)) { reachedBoundary = true; break; }
        }
        if (!reachedBoundary && since) throw new Error("Release 同步未完成：已达到分页上限，游标保持不变");
        return { fullName, releases: repoReleases, since };
      } catch (reason) {
        failures.push({ fullName, error: reason instanceof Error ? reason.message : "读取失败" });
        return null;
      }
    }));
    for (const result of repositoryResults) {
      if (!result) continue;
      releases.push(...result.releases.filter((item) => !result.since || new Date(item.publishedAt || item.createdAt).getTime() > result.since));
    }
    if (env?.DB) {
      const repository = new DataRepository(env.DB);
      for (const result of repositoryResults) {
        if (!result) continue;
        const platforms = inferReleasePlatformsFromAssets(result.releases);
        await repository.saveReleasePlatformState(result.fullName, platforms, PLATFORM_RULE_VERSION).catch(() => undefined);
      }
    }
    const failedRepositories = new Set(failures.map((failure) => failure.fullName));
    const successfulReleases = releases.filter((release) => !failedRepositories.has(release.repoFullName));
    successfulReleases.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    return json({ releases: successfulReleases, failures });
  } catch (reason) { return error(reason instanceof Error ? reason.message : "Release 同步失败", 400); }
}
async function handleReleaseDetail(request: Request, owner: string, repo: string, releaseId: string) { const token = requireToken(request); if (!/^\d+$/.test(releaseId)) return error("Release ID 无效", 400); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}`, token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } return json({ release: normalizeRelease(`${owner}/${repo}`, (await response.json()) as GithubRelease) }); }

async function handleForkStatus(request: Request, url: URL, env?: StarBoxEnv) { const token = requireToken(request); const raw = url.searchParams.get("full_name") || ""; try { const parsed = parseFullName(raw); const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, token); if (response.status === 404) { if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, null, "pending", {}); return json({ sourceFullName: "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: null, status: "pending" }); } if (!response.ok) { const f = await githubError(response); if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, null, "failed", { error: f.message }); return error(f.message, f.status, f.diagnostic); } const repo = (await response.json()) as GithubRepo; const result = { sourceFullName: repo.parent?.full_name || "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: repo.html_url, status: "ready" }; if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, result.sourceFullName || null, "ready", repo); return json(result); } catch (reason) { if (env?.DB) await new DataRepository(env.DB).saveFork(raw || "unknown", null, "failed", { error: reason instanceof Error ? reason.message : "Fork 状态读取失败" }); return error(reason instanceof Error ? reason.message : "Fork 状态读取失败", 400); } }
type ForkPayload = { id: number; fullName: string; htmlUrl: string; description: string | null; defaultBranch: string; pushedAt: string; owner: { login: string; avatarUrl: string }; parentFullName: string | null; parentHtmlUrl: string | null; aheadBy: number | null; behindBy: number | null; compareStatus: string; latestWorkflow: { id: number; workflowId: number; name: string; status: string; conclusion: string | null; htmlUrl: string; createdAt: string } | null; workflows: Array<{ id: number; name: string; path: string; state: string }> };
function normalizeFork(repo: GithubRepo): ForkPayload { return { id: repo.id, fullName: repo.full_name, htmlUrl: repo.html_url, description: repo.description, defaultBranch: repo.default_branch || "main", pushedAt: repo.pushed_at, owner: { login: repo.owner.login, avatarUrl: repo.owner.avatar_url }, parentFullName: repo.parent?.full_name || null, parentHtmlUrl: repo.parent?.html_url || null, aheadBy: null, behindBy: null, compareStatus: "unknown", latestWorkflow: null, workflows: [] }; }
async function forkDetails(token: string, fullName: string, includeWorkflowDefinitions = true) {
  const repo = await fetchRepositoryRaw(token, fullName);
  const result = normalizeFork(repo);
  if (repo.parent) {
    const parent = parseFullName(repo.parent.full_name); const fork = parseFullName(repo.full_name); const base = repo.parent.default_branch || repo.default_branch || "main"; const head = repo.default_branch || base;
    const response = await githubFetch(`/repos/${encodeURIComponent(parent.owner)}/${encodeURIComponent(parent.repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(fork.owner)}:${encodeURIComponent(head)}`, token);
    if (response.ok) { const compare = (await response.json()) as { ahead_by?: number; behind_by?: number; status?: string }; result.aheadBy = compare.ahead_by ?? 0; result.behindBy = compare.behind_by ?? 0; result.compareStatus = compare.status || "unknown"; }
  }
  const parsed = parseFullName(repo.full_name);
  const actions = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/runs?per_page=1`, token);
  if (actions.ok) {
    const payload = (await actions.json()) as { workflow_runs?: Array<{ id: number; workflow_id: number; name: string; status: string; conclusion: string | null; html_url: string; created_at: string }> };
    const run = payload.workflow_runs?.[0]; if (run) result.latestWorkflow = { id: run.id, workflowId: run.workflow_id, name: run.name, status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url, createdAt: run.created_at };
  }
  if (includeWorkflowDefinitions) {
    const workflows = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows?per_page=100`, token);
    if (workflows.ok) { const payload = (await workflows.json()) as { workflows?: Array<{ id: number; name: string; path: string; state: string }> }; result.workflows = (payload.workflows || []).map((item) => ({ id: item.id, name: item.name, path: item.path, state: item.state })); }
  }
  return result;
}
async function handleForkList(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request); const candidates: GithubRepo[] = []; let complete = false;
  for (let page = 1; page <= 30; page += 1) {
    const response = await githubFetch(`/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`, token);
    if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); }
    const items = (await response.json()) as GithubRepo[];
    candidates.push(...items.filter((item) => item.fork));
    if (items.length < 100) { complete = true; break; }
  }
  const forks: ForkPayload[] = [];
  for (let index = 0; index < candidates.length; index += 4) {
    const part = await Promise.all(candidates.slice(index, index + 4).map(async (repo) => { try { return await forkDetails(token, repo.full_name, false); } catch { return normalizeFork(repo); } }));
    forks.push(...part);
  }
  if (env?.DB) await new DataRepository(env.DB).reconcileForks(forks, complete);
  return json({ forks, complete });
}
async function handleForkDetails(request: Request, url: URL) { try { return json(await forkDetails(requireToken(request), url.searchParams.get("full_name") || "", true)); } catch (reason) { const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status: number }).status) : 400; return error(reason instanceof Error ? reason.message : "Fork 详情读取失败", status); } }
async function handleForkSync(request: Request, env?: StarBoxEnv) { const token = requireToken(request); let fullName = "unknown"; try { const body = await parseBody<{ fullName: string; branch?: string }>(request); fullName = body.fullName; const repo = await fetchRepositoryRaw(token, body.fullName); if (!repo.parent) throw new Error("目标仓库不是 Fork"); const parsed = parseFullName(repo.full_name); const branch = body.branch?.trim() || repo.default_branch || "main"; const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/merge-upstream`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branch }) }); if (!response.ok) { const f = await githubError(response); if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "failed", { error: f.message }); return error(f.message, f.status, f.diagnostic); } const payload = (await response.json()) as { message?: string; merge_type?: string }; if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "ready", repo); return json({ message: payload.message || "Fork 已同步", mergeType: payload.merge_type || "unknown" }); } catch (reason) { if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, null, "failed", { error: reason instanceof Error ? reason.message : "Fork 同步失败" }); return error(reason instanceof Error ? reason.message : "Fork 同步失败", 400); } }
async function handleForkWorkflowDispatch(request: Request) {
  const token = requireToken(request);
  try {
    const body = await parseBody<{ fullName: string; workflowId: number; ref?: string; inputs?: Record<string, string> }>(request);
    const parsed = parseFullName(body.fullName); const workflowId = Number(body.workflowId); if (!Number.isFinite(workflowId) || workflowId <= 0) throw new Error("Workflow ID 无效");
    const ref = body.ref?.trim() || "main"; const inputs = body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs) ? Object.fromEntries(Object.entries(body.inputs).map(([key, value]) => [key, String(value)])) : {};
    const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${workflowId}/dispatches`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref, ...(Object.keys(inputs).length ? { inputs } : {}) }) });
    if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); }
    return json({ message: `Workflow 已触发 · ${body.fullName} @ ${ref}` });
  } catch (reason) { return error(reason instanceof Error ? reason.message : "Workflow 触发失败", 400); }
}

async function handleDiscover(request: Request, url: URL) { const token = requireToken(request); const channel = url.searchParams.get("channel") || "popular"; const language = url.searchParams.get("language")?.trim() || ""; const topic = url.searchParams.get("topic")?.trim() || ""; const days = clamp(Number(url.searchParams.get("days")) || 30, 1, 365); const terms: string[] = []; if (channel === "fresh") terms.push(`created:>=${isoDateDaysAgo(days)}`); else if (channel === "active") terms.push(`pushed:>=${isoDateDaysAgo(days)}`, "stars:>50"); else terms.push("stars:>500"); if (language) terms.push(`language:${language}`); if (topic) terms.push(`topic:${topic}`); const query = terms.join(" "); const sort = channel === "active" ? "updated" : "stars"; const response = await githubFetch(`/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=30`, token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const payload = (await response.json()) as { items?: GithubRepo[] }; return json({ query, repositories: (payload.items || []).map((repo) => normalizeRepository(repo, null)) }); }

async function handleAiTest(request: Request, env?: StarBoxEnv) { try { const draft = await parseBody<ProviderConfig>(request); const ai = env ? await loadAiProviderConfig(env, draft) : draft; await callProvider(ai, [{ role: "system", content: "Reply with exactly: STARBOX_OK" }, { role: "user", content: "Connectivity test." }]); return json({ message: `${ai.providerName?.trim() || "Custom HTTP"} 连接成功` }); } catch (reason) { return error(reason instanceof Error ? reason.message : "AI 服务连接失败", 400); } }
function extractJsonObject(content: string) { const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]; const candidate = fenced || content; const start = candidate.indexOf("{"); const end = candidate.lastIndexOf("}"); if (start < 0 || end <= start) throw new Error("AI 返回内容不是有效 JSON"); return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>; }

export function truncateReadmeByParagraph(readme: string, targetChars = 2_000) {
  const paragraphs = readme.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const selected: string[] = [];
  let length = 0;

  for (const paragraph of paragraphs) {
    const separatorLength = selected.length ? 2 : 0;
    selected.push(paragraph);
    length += separatorLength + paragraph.length;
    if (length >= targetChars) break;
  }

  return selected.join("\n\n");
}

async function fetchAiReadme(request: Request, fullName: string) {
  const token = githubToken(request);
  if (!token) return "";

  try {
    const { owner, repo } = parseFullName(fullName);
    const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, token, {
      headers: { Accept: "application/vnd.github.raw+json" },
    });
    if (!response.ok) return "";
    return truncateReadmeByParagraph(await response.text());
  } catch {
    return "";
  }
}

async function handleAiOrganize(request: Request, env?: StarBoxEnv) {
  try {
    const body = await parseBody<{ ai?: ProviderConfig; fullName: string; repository: RepositoryInput; skipIfCurrent?: boolean; previousAnalysis?: { inputHash?: string; promptVersion?: string; modelId?: string } }>(request);
    const repo = body.repository;
    const fullName = body.fullName?.trim() || "";
    const ai = env ? await loadAiProviderConfig(env) : body.ai!;
    if (!fullName || !repo?.name) throw new Error("缺少仓库信息");

    const [readme, platforms] = await Promise.all([
      fetchAiReadme(request, fullName),
      resolveReleasePlatforms(request, env, fullName),
    ]);
    const promptVersion = "repository-organize-v1";
    const inputHash = await sha256Hex(JSON.stringify({
      name: repo.name,
      description: repo.description || "",
      language: repo.language || "",
      topics: repo.topics || [],
      readme,
    }));
    const analysisMeta = { inputHash, promptVersion, modelId: ai.model };
    if (
      body.skipIfCurrent
      && body.previousAnalysis?.inputHash === inputHash
      && body.previousAnalysis?.promptVersion === promptVersion
      && body.previousAnalysis?.modelId === ai.model
    ) {
      return json({ unchanged: true, platforms, analysisMeta });
    }

    const repositoryContext = [
      `Name: ${repo.name}`,
      `Description: ${repo.description || ""}`,
      `Language: ${repo.language || ""}`,
      `Topics: ${(repo.topics || []).join(", ")}`,
      ...(readme ? ["README:", readme] : []),
      "Return JSON only with: summary (Chinese, <= 80 chars), category (Chinese, concise), tags (2-5 short Chinese strings).",
      "Do not include markdown.",
    ];

    const content = await callProvider(ai, [
      { role: "system", content: "You organize GitHub repositories into concise, practical personal-library metadata." },
      { role: "user", content: repositoryContext.join("\n") },
    ], true);

    const parsed = extractJsonObject(content);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 160) : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim().slice(0, 40) : "";
    const tags = Array.isArray(parsed.tags)
      ? Array.from(new Set(parsed.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 32)).filter(Boolean))).slice(0, 5)
      : [];
    if (!summary || !category) throw new Error("AI 返回缺少 summary/category");
    return json({ summary, category, tags, platforms, analysisMeta });
  } catch (reason) {
    return error(reason instanceof Error ? reason.message : "AI 分析失败", 400);
  }
}

async function handleAiReleaseSummary(request: Request, env?: StarBoxEnv) {
  try {
    const body = await parseBody<{ ai?: ProviderConfig; release: { repoFullName?: string; tagName?: string; name?: string; body?: string; prerelease?: boolean; assets?: Array<{ name?: string }> } }>(request);
    const release = body.release; if (!release?.repoFullName || !release.tagName) throw new Error("缺少 Release 信息"); const ai = env ? await loadAiProviderConfig(env) : body.ai!;
    const notes = (release.body || "").slice(0, 16_000); const assets = (release.assets || []).map((item) => item.name).filter(Boolean).slice(0, 30).join(", ");
    const content = await callProvider(ai, [
      { role: "system", content: "You summarize GitHub releases for a technical personal library. Return useful, concise Chinese JSON only." },
      { role: "user", content: [`Repository: ${release.repoFullName}`, `Version: ${release.tagName}`, `Title: ${release.name || release.tagName}`, `Prerelease: ${release.prerelease ? "yes" : "no"}`, `Assets: ${assets}`, "Release notes:", notes || "(empty)", "Return JSON only with: overview (Chinese, <=120 chars), highlights (0-5 concise Chinese strings), fixes (0-5 concise Chinese strings), breakingChanges (0-4 concise Chinese strings). Do not include markdown."].join("\n") },
    ], true);
    const parsed = extractJsonObject(content); const strings = (value: unknown, limit: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 160)).filter(Boolean).slice(0, limit) : [];
    const overview = typeof parsed.overview === "string" ? parsed.overview.trim().slice(0, 240) : ""; if (!overview) throw new Error("AI 返回缺少 overview");
    return json({ overview, highlights: strings(parsed.highlights, 5), fixes: strings(parsed.fixes, 5), breakingChanges: strings(parsed.breakingChanges, 4) });
  } catch (reason) { return error(reason instanceof Error ? reason.message : "AI 总结失败", 400); }
}

async function handleHealth(env?: StarBoxEnv) {
  if (!env) return json({ ok: true });
  let database = false;
  if (env.DB) {
    try { const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'repositories' LIMIT 1").first<{ name: string }>(); database = row?.name === "repositories"; } catch { database = false; }
  }
  const auth = Boolean(env.LOGIN_PASSWORD?.trim());
  const encryption = Boolean(env.STARBOX_ENCRYPTION_KEY?.trim()) && validateEncryptionKey(env.STARBOX_ENCRYPTION_KEY!);
  const ok = database && auth && encryption;
  return json({ ok, checks: { database, auth, encryption } }, { status: ok ? 200 : 503 });
}

async function routeCore(request: Request, env?: StarBoxEnv, identity?: Identity): Promise<Response> {
  const url = new URL(request.url); if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
  try {
    if (url.pathname === "/api/health" && request.method === "GET") return handleHealth(env);
    if (url.pathname === "/api/github/user" && request.method === "GET") return handleGithubUser(request);
    if (url.pathname === "/api/github/rate-limit" && request.method === "GET") return handleRateLimit(request);
    if (url.pathname === "/api/github/starred" && request.method === "GET") return handleStarred(request, env);
    if (url.pathname === "/api/github/watched" && request.method === "GET") return handleWatched(request);
    if (url.pathname === "/api/github/stars/batch" && request.method === "POST") return handleBatchStars(request, env);
    if (url.pathname === "/api/releases/feed" && request.method === "POST") return handleReleaseFeed(request, env);
    if (url.pathname === "/api/forks" && request.method === "POST") return error("StarBox 不提供 Fork 创建；请先在 GitHub 创建 Fork，再回到 Fork 页面刷新。", 405);
    if (url.pathname === "/api/forks/status" && request.method === "GET") return handleForkStatus(request, url, env);
    if (url.pathname === "/api/forks/list" && request.method === "GET") return handleForkList(request, env);
    if (url.pathname === "/api/forks/details" && request.method === "GET") return handleForkDetails(request, url);
    if (url.pathname === "/api/forks/sync" && request.method === "POST") return handleForkSync(request, env);
    if (url.pathname === "/api/forks/workflows/dispatch" && request.method === "POST") return handleForkWorkflowDispatch(request);
    if (url.pathname === "/api/discover" && request.method === "GET") return handleDiscover(request, url);
    if (url.pathname === "/api/ai/test" && request.method === "POST") return handleAiTest(request, env);
    if (url.pathname === "/api/ai/organize" && request.method === "POST") return handleAiOrganize(request, env);
    if (url.pathname === "/api/ai/release-summary" && request.method === "POST") return handleAiReleaseSummary(request, env);
    const readmeMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/readme$/); if (readmeMatch && request.method === "GET") return handleReadme(request, decodeURIComponent(readmeMatch[1]), decodeURIComponent(readmeMatch[2]));
    const repoMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)$/); if (repoMatch && request.method === "GET") return handleRepository(request, decodeURIComponent(repoMatch[1]), decodeURIComponent(repoMatch[2]));
    const starMatch = url.pathname.match(/^\/api\/github\/stars\/([^/]+)\/([^/]+)$/); if (starMatch && (request.method === "PUT" || request.method === "DELETE")) return handleStarMutation(request, decodeURIComponent(starMatch[1]), decodeURIComponent(starMatch[2]), env);
    const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/([^/]+)\/(\d+)$/); if (releaseMatch && request.method === "GET") return handleReleaseDetail(request, decodeURIComponent(releaseMatch[1]), decodeURIComponent(releaseMatch[2]), releaseMatch[3]);
    return error("API 路由不存在", 404);
  } catch (reason) { if (reason instanceof Response) return reason; return error(reason instanceof Error ? reason.message : "请求失败", 400); }
}

function unauthenticated() { return json({ error: "需要 StarBox 登录会话" }, { status: 401 }); }

async function route(request: Request, env?: StarBoxEnv): Promise<Response> {
  // Direct route(request) calls are retained for the pre-D1 contract tests. The
  // deployed Worker always receives env and therefore always takes this gate.
  if (!env) return routeCore(request);
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  if (url.pathname === "/api/auth/session" && request.method === "GET") return handleSession(request, env);
  if (url.pathname === "/api/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const invalid = validateMutationRequest(request, true); if (invalid) return invalid;
    return handleLogout(request, env);
  }
  if (url.pathname === "/api/health" && request.method === "GET") return routeCore(request, env);
  if (request.method !== "GET") { const invalid = validateMutationRequest(request, true); if (invalid) return invalid; }
  const authResult = await authenticate(request, env);
  if (!("identity" in authResult)) return authResult.response.status === 200 ? unauthenticated() : authResult.response;
  const identity = authResult.identity!;
  if (url.pathname === "/api/auth/devices" && request.method === "GET") return handleDevices(request, env, identity);
  if (url.pathname === "/api/auth/devices/revoke-others" && request.method === "POST") return handleRevokeOtherDevices(request, env, identity);
  const deviceMatch = url.pathname.match(/^\/api\/auth\/devices\/([^/]+)$/);
  if (deviceMatch && ["PATCH", "DELETE"].includes(request.method)) return handleDevices(request, env, identity, decodeURIComponent(deviceMatch[1]));
  if (url.pathname === "/api/ai/services" && ["GET", "POST"].includes(request.method)) return handleAiServices(request, env, identity, []);
  const aiServiceMatch = url.pathname.match(/^\/api\/ai\/services\/([^/]+)(?:\/(.*))?$/);
  if (aiServiceMatch) return handleAiServices(request, env, identity, [decodeURIComponent(aiServiceMatch[1]), ...(aiServiceMatch[2] ? aiServiceMatch[2].split("/").map(decodeURIComponent) : [])]);
  if (url.pathname === "/api/ai/default-model" && request.method === "PUT") return handleAiDefaultModel(request, env, identity);
  if (url.pathname === "/api/github/credential" && ["GET", "PUT", "DELETE"].includes(request.method)) return handleGithubCredential(request, env, identity);
  if (url.pathname === "/api/ai/config" && ["GET", "PUT"].includes(request.method)) return handleAiConfig(request, env, identity);
  if (url.pathname === "/api/preferences" && ["GET", "PUT"].includes(request.method)) return handlePreferences(request, env, identity);
  if (url.pathname === "/api/data/changes" && request.method === "GET") return handleSync(request, env, identity, "delta");
  if (url.pathname === "/api/sync/delta" && request.method === "GET") return handleSync(request, env, identity, "delta");
  if (url.pathname === "/api/sync/cursor" && request.method === "POST") return handleSync(request, env, identity, "cursor");
  if (url.pathname === "/api/bootstrap" && request.method === "GET") return handleBootstrap(request, env, identity);
  if (url.pathname === "/api/sync/mutate" && request.method === "POST") return handleSyncMutation(request, env, identity);
  if (url.pathname === "/api/sync/release-state" && request.method === "POST") return handleSync(request, env, identity, "release");
  if (url.pathname === "/api/sync/fork-state" && request.method === "POST") return handleSync(request, env, identity, "fork");
  if (url.pathname === "/api/notifications" && request.method === "GET") return handleNotifications(request, env, identity);
  const notificationMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && request.method === "POST") return handleNotifications(request, env, identity, decodeURIComponent(notificationMatch[1]));
  return routeCore(await hydrateGithubToken(request, env, identity), env, identity);
}

export default {
  async fetch(request: Request, env: StarBoxEnv) {
    return route(request, env);
  },
};
export { route };
