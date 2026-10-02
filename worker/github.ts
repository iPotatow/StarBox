import { fetchBounded } from "./outbound.js";
import type { Repository, ReleaseItem } from "../shared/contracts.js";
import { jsonHeaders, error, json } from "./http.js";

export type GithubStarredItem = { starred_at: string; repo: GithubRepo };

export type GithubRepo = {
  id: number; node_id?: string; name: string; full_name: string; description: string | null; html_url: string; homepage?: string | null;
  stargazers_count: number; forks_count: number; watchers_count?: number; open_issues_count?: number; size?: number;
  default_branch?: string; visibility?: string; language: string | null; license: { spdx_id?: string | null; key?: string | null } | null;
  updated_at: string; pushed_at: string; archived: boolean; fork?: boolean; topics?: string[];
  owner: { login: string; avatar_url: string };
  parent?: { full_name: string; html_url: string; default_branch?: string };
};

export type GithubRelease = { id: number; tag_name: string; name: string | null; body: string | null; html_url: string; published_at: string | null; created_at: string; draft: boolean; prerelease: boolean; author: { login: string; avatar_url: string } | null; assets: Array<{ id: number; name: string; size: number; download_count: number; browser_download_url: string }> };

export function githubToken(request: Request) { return request.headers.get("x-starbox-github-token")?.trim() || ""; }

export function requireToken(request: Request) { const token = githubToken(request); if (!token) throw new Response(JSON.stringify({ error: "缺少 GitHub Token" }), { status: 401, headers: jsonHeaders }); return token; }

export function parseFullName(value: string) {
  const normalized = value.trim(); const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) throw new Error("仓库名称必须为 owner/repo");
  return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}

export async function githubFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("Accept", headers.get("Accept") || "application/vnd.github+json"); headers.set("Authorization", `Bearer ${token}`); headers.set("User-Agent", "StarBox-Workers"); headers.set("X-GitHub-Api-Version", "2026-03-10");
  return fetchBounded(`https://api.github.com${path}`, { ...init, headers });
}

export function rateDiagnostic(response: Response) {
  const remaining = response.headers.get("x-ratelimit-remaining"); const limit = response.headers.get("x-ratelimit-limit"); const reset = response.headers.get("x-ratelimit-reset"); const retry = response.headers.get("retry-after");
  const parts = [] as string[]; if (remaining !== null && limit !== null) parts.push(`GitHub API 剩余 ${remaining}/${limit}`); if (reset) parts.push(`重置 ${new Date(Number(reset) * 1000).toLocaleString("zh-CN")}`); if (retry) parts.push(`Retry-After ${retry}s`); return parts.join(" · ");
}

export async function githubError(response: Response) {
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

export function normalizeRepository(repo: GithubRepo, starredAt: string | null = null): Repository {
  return { id: repo.id, node_id: repo.node_id, name: repo.name, full_name: repo.full_name, description: repo.description, html_url: repo.html_url, homepage: repo.homepage ?? null, stargazers_count: repo.stargazers_count, forks_count: repo.forks_count, watchers_count: repo.watchers_count ?? repo.stargazers_count, open_issues_count: repo.open_issues_count ?? 0, size: repo.size ?? 0, default_branch: repo.default_branch ?? "main", visibility: repo.visibility ?? "public", language: repo.language, license: repo.license?.spdx_id || repo.license?.key || null, updated_at: repo.updated_at, pushed_at: repo.pushed_at, starred_at: starredAt, archived: repo.archived, fork: Boolean(repo.fork), topics: repo.topics || [], owner: repo.owner };
}

export function normalizeRelease(repoFullName: string, release: GithubRelease): ReleaseItem { return { id: release.id, repoFullName, tagName: release.tag_name, name: release.name || release.tag_name, body: release.body || "", htmlUrl: release.html_url, publishedAt: release.published_at, createdAt: release.created_at, draft: release.draft, prerelease: release.prerelease, author: release.author ? { login: release.author.login, avatarUrl: release.author.avatar_url } : null, assets: (release.assets || []).map((asset) => ({ id: asset.id, name: asset.name, size: asset.size, downloadCount: asset.download_count, browserDownloadUrl: asset.browser_download_url })) }; }

export async function fetchRepositoryRaw(token: string, fullName: string) { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token); if (!response.ok) { const f = await githubError(response); throw Object.assign(new Error(f.message), { status: f.status, diagnostics: f.diagnostic }); } return (await response.json()) as GithubRepo; }

export async function fetchRepository(token: string, fullName: string) { return normalizeRepository(await fetchRepositoryRaw(token, fullName), null); }

export async function handleGithubUser(request: Request) { const token = requireToken(request); const response = await githubFetch("/user", token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const user = (await response.json()) as { login: string; avatar_url: string }; return json({ login: user.login, avatarUrl: user.avatar_url }); }

export async function handleRateLimit(request: Request) { const response = await githubFetch("/rate_limit", requireToken(request)); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const payload = (await response.json()) as { resources?: Record<string, { limit: number; remaining: number; used: number; reset: number }> }; const resources = Object.entries(payload.resources ?? {}).map(([resource, item]) => ({ resource, limit: item.limit, remaining: item.remaining, used: item.used, resetAt: new Date(item.reset * 1000).toISOString() })); return json({ resources }); }
