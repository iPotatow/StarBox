import { callProvider } from "./provider.js";
import { authenticate, handleLogin, handleLogout, handleSession, validateMutationRequest } from "./auth.js";
import { handleActivity, handleBootstrap, handleGithubCredential, handleNotifications, handleSync, handleSyncMutation, hydrateGithubToken } from "./v5.js";
import { DataRepository } from "./repository.js";
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, init = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function error(message, status = 400, diagnostics = "") { return json({ error: message, ...(diagnostics ? { diagnostics } : {}) }, { status }); }
function githubToken(request) { return request.headers.get("x-starbox-github-token")?.trim() || ""; }
function requireToken(request) { const token = githubToken(request); if (!token)
    throw new Response(JSON.stringify({ error: "缺少 GitHub Token" }), { status: 401, headers: jsonHeaders }); return token; }
export function parseFullName(value) {
    const normalized = value.trim();
    const parts = normalized.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1]))
        throw new Error("仓库名称必须为 owner/repo");
    return { owner: parts[0], repo: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function isoDateDaysAgo(days) { return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10); }
async function githubFetch(path, token, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Accept", headers.get("Accept") || "application/vnd.github+json");
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("User-Agent", "StarBox-Workers");
    headers.set("X-GitHub-Api-Version", "2026-03-10");
    return fetch(`https://api.github.com${path}`, { ...init, headers });
}
function rateDiagnostic(response) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const limit = response.headers.get("x-ratelimit-limit");
    const reset = response.headers.get("x-ratelimit-reset");
    const retry = response.headers.get("retry-after");
    const parts = [];
    if (remaining !== null && limit !== null)
        parts.push(`GitHub API 剩余 ${remaining}/${limit}`);
    if (reset)
        parts.push(`重置 ${new Date(Number(reset) * 1000).toLocaleString("zh-CN")}`);
    if (retry)
        parts.push(`Retry-After ${retry}s`);
    return parts.join(" · ");
}
async function githubError(response) {
    let detail = "";
    try {
        const payload = (await response.json());
        detail = payload.message || "";
    }
    catch { /* non-json */ }
    const diagnostic = rateDiagnostic(response);
    if (response.status === 401)
        return { message: "GitHub Token 无效或已过期", status: 401, diagnostic };
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
        return { message: "GitHub API 速率额度已用尽", status: 429, diagnostic };
    if (response.status === 403)
        return { message: detail ? `GitHub 权限不足：${detail}` : "GitHub API 权限不足", status: 403, diagnostic };
    if (response.status === 404)
        return { message: "GitHub 资源不存在或当前 Token 无权访问", status: 404, diagnostic };
    if (response.status === 409)
        return { message: detail ? `GitHub 冲突：${detail}` : "GitHub 操作发生冲突", status: 409, diagnostic };
    if (response.status === 422)
        return { message: detail ? `GitHub 校验失败：${detail}` : "GitHub 请求无法处理", status: 422, diagnostic };
    return { message: detail ? `GitHub API：${detail}` : `GitHub API 错误 (${response.status})`, status: response.status >= 500 ? 502 : response.status, diagnostic };
}
async function githubGraphql(token, query, variables = {}) {
    const response = await githubFetch("/graphql", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
    if (!response.ok) {
        const failure = await githubError(response);
        throw Object.assign(new Error(failure.message), { status: failure.status, diagnostics: failure.diagnostic });
    }
    const payload = (await response.json());
    if (payload.errors?.length) {
        const message = payload.errors.map((item) => item.message).join("; ");
        throw Object.assign(new Error(`GitHub GraphQL：${message}`), { status: message.toLowerCase().includes("scope") ? 403 : 400 });
    }
    if (!payload.data)
        throw new Error("GitHub GraphQL 返回空数据");
    return payload.data;
}
export function normalizeRepository(repo, starredAt = null) {
    return { id: repo.id, node_id: repo.node_id, name: repo.name, full_name: repo.full_name, description: repo.description, html_url: repo.html_url, homepage: repo.homepage ?? null, stargazers_count: repo.stargazers_count, forks_count: repo.forks_count, watchers_count: repo.watchers_count ?? repo.stargazers_count, open_issues_count: repo.open_issues_count ?? 0, size: repo.size ?? 0, default_branch: repo.default_branch ?? "main", visibility: repo.visibility ?? "public", language: repo.language, license: repo.license?.spdx_id || repo.license?.key || null, updated_at: repo.updated_at, pushed_at: repo.pushed_at, starred_at: starredAt, archived: repo.archived, fork: Boolean(repo.fork), topics: repo.topics || [], owner: repo.owner };
}
function normalizeRelease(repoFullName, release) { return { id: release.id, repoFullName, tagName: release.tag_name, name: release.name || release.tag_name, body: release.body || "", htmlUrl: release.html_url, publishedAt: release.published_at, createdAt: release.created_at, draft: release.draft, prerelease: release.prerelease, author: release.author ? { login: release.author.login, avatarUrl: release.author.avatar_url } : null, assets: (release.assets || []).map((asset) => ({ id: asset.id, name: asset.name, size: asset.size, downloadCount: asset.download_count, browserDownloadUrl: asset.browser_download_url })) }; }
async function parseBody(request) { try {
    return (await request.json());
}
catch {
    throw new Error("请求 JSON 无效");
} }
async function fetchRepositoryRaw(token, fullName) { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token); if (!response.ok) {
    const f = await githubError(response);
    throw Object.assign(new Error(f.message), { status: f.status, diagnostics: f.diagnostic });
} return (await response.json()); }
async function fetchRepository(token, fullName) { return normalizeRepository(await fetchRepositoryRaw(token, fullName), null); }
async function handleGithubUser(request) { const token = requireToken(request); const response = await githubFetch("/user", token); if (!response.ok) {
    const f = await githubError(response);
    return error(f.message, f.status, f.diagnostic);
} const user = (await response.json()); return json({ login: user.login, avatarUrl: user.avatar_url }); }
async function handleRateLimit(request) { const response = await githubFetch("/rate_limit", requireToken(request)); if (!response.ok) {
    const f = await githubError(response);
    return error(f.message, f.status, f.diagnostic);
} const payload = (await response.json()); const resources = Object.entries(payload.resources ?? {}).map(([resource, item]) => ({ resource, limit: item.limit, remaining: item.remaining, used: item.used, resetAt: new Date(item.reset * 1000).toISOString() })); return json({ resources }); }
async function handleStarred(request, env) { const token = requireToken(request); const repositories = []; for (let page = 1; page <= 30; page += 1) {
    const response = await githubFetch(`/user/starred?per_page=100&page=${page}`, token, { headers: { Accept: "application/vnd.github.star+json" } });
    if (!response.ok) {
        const f = await githubError(response);
        return error(f.message, f.status, f.diagnostic);
    }
    const items = (await response.json());
    for (const item of items)
        repositories.push(normalizeRepository(item.repo, item.starred_at));
    if (items.length < 100)
        break;
} if (env?.DB) {
    const repository = new DataRepository(env.DB);
    const previous = new Set(await repository.listStarredFullNames());
    const current = new Set(repositories.map((item) => item.full_name));
    for (const item of repositories)
        await repository.upsertRepository(item, true);
    let removed = 0;
    for (const fullName of previous)
        if (!current.has(fullName)) {
            await repository.markRepositoryUnstarred(fullName);
            removed += 1;
        }
    await repository.recordActivity("stars_synced", { count: repositories.length, removed });
} return json({ repositories }); }
async function handleWatched(request) { const token = requireToken(request); const repositories = []; for (let page = 1; page <= 10; page += 1) {
    const response = await githubFetch(`/user/subscriptions?per_page=100&page=${page}`, token);
    if (!response.ok) {
        const f = await githubError(response);
        return error(f.message, f.status, f.diagnostic);
    }
    const items = (await response.json());
    repositories.push(...items.map((repo) => normalizeRepository(repo, null)));
    if (items.length < 100)
        break;
} return json({ repositories }); }
async function handleRepository(request, owner, repo) { try {
    return json({ repository: await fetchRepository(requireToken(request), `${owner}/${repo}`) });
}
catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 400;
    return error(reason instanceof Error ? reason.message : "读取仓库失败", status, typeof reason === "object" && reason && "diagnostics" in reason ? String(reason.diagnostics) : "");
} }
async function handleReadme(request, owner, repo) { const token = requireToken(request); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, token, { headers: { Accept: "application/vnd.github.raw+json" } }); if (response.status === 404)
    return json({ content: "", htmlUrl: `https://github.com/${owner}/${repo}#readme` }); if (!response.ok) {
    const f = await githubError(response);
    return error(f.message, f.status, f.diagnostic);
} return json({ content: await response.text(), htmlUrl: `https://github.com/${owner}/${repo}#readme` }); }
async function mutateStar(token, fullName, action) { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token, { method: action === "star" ? "PUT" : "DELETE" }); if (!response.ok) {
    const f = await githubError(response);
    throw Object.assign(new Error(f.message), { status: f.status });
} }
async function handleStarMutation(request, owner, repo, env) { const token = requireToken(request); const fullName = `${owner}/${repo}`; try {
    const action = request.method === "PUT" ? "star" : "unstar";
    await mutateStar(token, fullName, action);
    const repository = action === "star" ? { ...(await fetchRepository(token, fullName)), starred_at: new Date().toISOString() } : { id: fullName, full_name: fullName, name: repo, html_url: `https://github.com/${fullName}` };
    if (env?.DB) {
        const persisted = new DataRepository(env.DB);
        await persisted.upsertRepository(repository, action === "star");
        await persisted.recordActivity(action === "star" ? "starred" : "unstarred", { fullName });
    }
    if (action === "unstar")
        return json({ ok: true, fullName });
    return json({ ok: true, fullName, repository });
}
catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 400;
    return error(reason instanceof Error ? reason.message : "Star 操作失败", status);
} }
async function handleBatchStars(request, env) { const token = requireToken(request); try {
    const body = await parseBody(request);
    if (!Array.isArray(body.repositories) || body.repositories.length === 0 || body.repositories.length > 50)
        throw new Error("批量操作需要 1-50 个仓库");
    if (body.action !== "star" && body.action !== "unstar")
        throw new Error("批量操作类型无效");
    const results = [];
    for (let index = 0; index < body.repositories.length; index += 5) {
        const part = await Promise.all(body.repositories.slice(index, index + 5).map(async (fullName) => { try {
            await mutateStar(token, fullName, body.action);
            if (env?.DB) {
                const persisted = new DataRepository(env.DB);
                const name = fullName.split("/").pop() || fullName;
                await persisted.upsertRepository({ id: fullName, full_name: fullName, name, html_url: `https://github.com/${fullName}` }, body.action === "star");
                await persisted.recordActivity(body.action === "star" ? "starred" : "unstarred", { fullName, batch: true });
            }
            return { fullName, ok: true };
        }
        catch (reason) {
            return { fullName, ok: false, error: reason instanceof Error ? reason.message : "操作失败" };
        } }));
        results.push(...part);
    }
    return json({ results });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "批量操作失败", 400);
} }
async function handleReleaseFeed(request, env) {
    const token = requireToken(request);
    try {
        const body = await parseBody(request);
        if (!Array.isArray(body.repositories) || body.repositories.length > 10)
            throw new Error("每次最多同步 10 个 Release 订阅");
        const maxPages = clamp(Number(body.pages) || 2, 1, 5);
        const releases = [];
        const synced = [];
        const failures = [];
        await Promise.all(body.repositories.map(async (fullName) => {
            try {
                const { owner, repo } = parseFullName(fullName);
                const since = body.sinceByRepo?.[fullName] ? new Date(body.sinceByRepo[fullName]).getTime() : 0;
                for (let page = 1; page <= maxPages; page += 1) {
                    const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=50&page=${page}`, token);
                    if (!response.ok) {
                        const f = await githubError(response);
                        failures.push({ fullName, error: f.message });
                        return;
                    }
                    const items = (await response.json());
                    if (!items.length)
                        break;
                    const normalized = items.map((item) => normalizeRelease(fullName, item));
                    synced.push(...normalized);
                    releases.push(...normalized.filter((item) => !since || new Date(item.publishedAt || item.createdAt).getTime() > since));
                    const oldest = Math.min(...normalized.map((item) => new Date(item.publishedAt || item.createdAt).getTime()));
                    if (items.length < 50 || (since && oldest <= since))
                        break;
                }
            }
            catch (reason) {
                failures.push({ fullName, error: reason instanceof Error ? reason.message : "读取失败" });
            }
        }));
        if (env?.DB) {
            const repository = new DataRepository(env.DB);
            for (const release of synced)
                await repository.upsertRelease(release);
            for (const fullName of body.repositories) {
                const latest = synced.filter((item) => item.repoFullName === fullName).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0];
                await repository.saveReleaseSyncState(fullName, latest?.publishedAt || latest?.createdAt || body.sinceByRepo?.[fullName] || null);
            }
        }
        releases.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
        return json({ releases, failures });
    }
    catch (reason) {
        return error(reason instanceof Error ? reason.message : "Release 同步失败", 400);
    }
}
async function handleReleaseDetail(request, owner, repo, releaseId) { const token = requireToken(request); if (!/^\d+$/.test(releaseId))
    return error("Release ID 无效", 400); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}`, token); if (!response.ok) {
    const f = await githubError(response);
    return error(f.message, f.status, f.diagnostic);
} return json({ release: normalizeRelease(`${owner}/${repo}`, (await response.json())) }); }
async function handleFork(request, env) { const token = requireToken(request); try {
    const body = await parseBody(request);
    const source = parseFullName(body.sourceFullName);
    const viewerResponse = await githubFetch("/user", token);
    if (!viewerResponse.ok) {
        const f = await githubError(viewerResponse);
        if (env?.DB)
            await new DataRepository(env.DB).saveFork(body.sourceFullName, null, "failed", { error: f.message });
        return error(f.message, f.status, f.diagnostic);
    }
    const viewer = (await viewerResponse.json());
    const payload = {};
    if (body.organization?.trim())
        payload.organization = body.organization.trim();
    if (body.name?.trim())
        payload.name = body.name.trim();
    if (body.defaultBranchOnly)
        payload.default_branch_only = true;
    const response = await githubFetch(`/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/forks`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
        const f = await githubError(response);
        if (env?.DB)
            await new DataRepository(env.DB).saveFork(body.sourceFullName, null, "failed", { error: f.message });
        return error(f.message, f.status, f.diagnostic);
    }
    const fork = (await response.json());
    const targetOwner = fork.owner?.login || body.organization?.trim() || viewer.login;
    const targetName = fork.name || body.name?.trim() || source.repo;
    const targetFullName = fork.full_name || `${targetOwner}/${targetName}`;
    const status = response.status === 202 ? "pending" : "ready";
    if (env?.DB)
        await new DataRepository(env.DB).saveFork(targetFullName, source.fullName, status, fork);
    return json({ sourceFullName: source.fullName, targetOwner, targetName, targetFullName, htmlUrl: fork.html_url || null, status });
}
catch (reason) {
    if (env?.DB)
        await new DataRepository(env.DB).saveFork("unknown", null, "failed", { error: reason instanceof Error ? reason.message : "Fork 创建失败" });
    return error(reason instanceof Error ? reason.message : "Fork 创建失败", 400);
} }
async function handleForkStatus(request, url, env) { const token = requireToken(request); const raw = url.searchParams.get("full_name") || ""; try {
    const parsed = parseFullName(raw);
    const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, token);
    if (response.status === 404) {
        if (env?.DB)
            await new DataRepository(env.DB).saveFork(parsed.fullName, null, "pending", {});
        return json({ sourceFullName: "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: null, status: "pending" });
    }
    if (!response.ok) {
        const f = await githubError(response);
        if (env?.DB)
            await new DataRepository(env.DB).saveFork(parsed.fullName, null, "failed", { error: f.message });
        return error(f.message, f.status, f.diagnostic);
    }
    const repo = (await response.json());
    const result = { sourceFullName: repo.parent?.full_name || "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: repo.html_url, status: "ready" };
    if (env?.DB)
        await new DataRepository(env.DB).saveFork(parsed.fullName, result.sourceFullName || null, "ready", repo);
    return json(result);
}
catch (reason) {
    if (env?.DB)
        await new DataRepository(env.DB).saveFork(raw || "unknown", null, "failed", { error: reason instanceof Error ? reason.message : "Fork 状态读取失败" });
    return error(reason instanceof Error ? reason.message : "Fork 状态读取失败", 400);
} }
function normalizeFork(repo) { return { id: repo.id, fullName: repo.full_name, htmlUrl: repo.html_url, description: repo.description, defaultBranch: repo.default_branch || "main", pushedAt: repo.pushed_at, owner: { login: repo.owner.login, avatarUrl: repo.owner.avatar_url }, parentFullName: repo.parent?.full_name || null, parentHtmlUrl: repo.parent?.html_url || null, aheadBy: null, behindBy: null, compareStatus: "unknown", latestWorkflow: null }; }
async function handleForkList(request) { const token = requireToken(request); const candidates = []; for (let page = 1; page <= 30; page += 1) {
    const response = await githubFetch(`/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`, token);
    if (!response.ok) {
        const f = await githubError(response);
        return error(f.message, f.status, f.diagnostic);
    }
    const items = (await response.json());
    candidates.push(...items.filter((item) => item.fork));
    if (items.length < 100)
        break;
} const forks = []; for (let index = 0; index < candidates.length; index += 8) {
    const part = await Promise.all(candidates.slice(index, index + 8).map(async (repo) => { try {
        return normalizeFork(await fetchRepositoryRaw(token, repo.full_name));
    }
    catch {
        return normalizeFork(repo);
    } }));
    forks.push(...part);
} return json({ forks }); }
async function forkDetails(token, fullName) { const repo = await fetchRepositoryRaw(token, fullName); const result = normalizeFork(repo); if (repo.parent) {
    const parent = parseFullName(repo.parent.full_name);
    const fork = parseFullName(repo.full_name);
    const base = repo.parent.default_branch || repo.default_branch || "main";
    const head = repo.default_branch || base;
    const response = await githubFetch(`/repos/${encodeURIComponent(parent.owner)}/${encodeURIComponent(parent.repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(fork.owner)}:${encodeURIComponent(head)}`, token);
    if (response.ok) {
        const compare = (await response.json());
        result.aheadBy = compare.ahead_by ?? 0;
        result.behindBy = compare.behind_by ?? 0;
        result.compareStatus = compare.status || "unknown";
    }
} const parsed = parseFullName(repo.full_name); const actions = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/runs?per_page=1`, token); if (actions.ok) {
    const payload = (await actions.json());
    const run = payload.workflow_runs?.[0];
    if (run)
        result.latestWorkflow = { id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url, createdAt: run.created_at };
} return result; }
async function handleForkDetails(request, url) { try {
    return json(await forkDetails(requireToken(request), url.searchParams.get("full_name") || ""));
}
catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 400;
    return error(reason instanceof Error ? reason.message : "Fork 详情读取失败", status);
} }
async function handleForkSync(request, env) { const token = requireToken(request); let fullName = "unknown"; try {
    const body = await parseBody(request);
    fullName = body.fullName;
    const repo = await fetchRepositoryRaw(token, body.fullName);
    if (!repo.parent)
        throw new Error("目标仓库不是 Fork");
    const parsed = parseFullName(repo.full_name);
    const branch = body.branch?.trim() || repo.default_branch || "main";
    const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/merge-upstream`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branch }) });
    if (!response.ok) {
        const f = await githubError(response);
        if (env?.DB)
            await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "failed", { error: f.message });
        return error(f.message, f.status, f.diagnostic);
    }
    const payload = (await response.json());
    if (env?.DB)
        await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "ready", payload);
    return json({ message: payload.message || "Fork 已同步", mergeType: payload.merge_type || "unknown" });
}
catch (reason) {
    if (env?.DB)
        await new DataRepository(env.DB).saveFork(fullName, null, "failed", { error: reason instanceof Error ? reason.message : "Fork 同步失败" });
    return error(reason instanceof Error ? reason.message : "Fork 同步失败", 400);
} }
async function loadGithubLists(token) {
    const lists = [];
    let cursor = null;
    do {
        const data = await githubGraphql(token, `query($cursor:String){ viewer { lists(first:100, after:$cursor) { nodes { id name description isPrivate } pageInfo { hasNextPage endCursor } } } }`, { cursor });
        for (const node of data.viewer.lists.nodes)
            lists.push({ ...node, items: [] });
        cursor = data.viewer.lists.pageInfo.hasNextPage ? data.viewer.lists.pageInfo.endCursor : null;
    } while (cursor);
    for (const list of lists) {
        let itemCursor = null;
        do {
            const data = await githubGraphql(token, `query($id:ID!,$cursor:String){ node(id:$id) { ... on UserList { items(first:100, after:$cursor) { nodes { ... on Repository { id nameWithOwner url } } pageInfo { hasNextPage endCursor } } } } }`, { id: list.id, cursor: itemCursor });
            const items = data.node?.items;
            if (!items)
                break;
            for (const item of items.nodes)
                if (item?.id && item.nameWithOwner)
                    list.items.push({ id: item.id, fullName: item.nameWithOwner, htmlUrl: item.url || `https://github.com/${item.nameWithOwner}` });
            itemCursor = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null;
        } while (itemCursor);
    }
    return lists.map((item) => ({ ...item, description: item.description || "" }));
}
async function handleLists(request, env) { const token = requireToken(request); if (request.method === "GET") {
    try {
        const lists = await loadGithubLists(token);
        if (env?.DB)
            await new DataRepository(env.DB).replaceListsSnapshot(lists);
        return json({ lists });
    }
    catch (reason) {
        const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 400;
        return error(reason instanceof Error ? reason.message : "GitHub Lists 读取失败", status);
    }
} try {
    const body = await parseBody(request);
    if (!body.name?.trim())
        throw new Error("List 名称不能为空");
    const data = await githubGraphql(token, `mutation($name:String!,$description:String,$isPrivate:Boolean){ createUserList(input:{name:$name,description:$description,isPrivate:$isPrivate}) { list { id name description isPrivate } } }`, { name: body.name.trim(), description: body.description?.trim() || "", isPrivate: Boolean(body.isPrivate) });
    const list = data.createUserList.list;
    if (env?.DB)
        await new DataRepository(env.DB).saveList(list, "upsert");
    return json({ ...list, description: list.description || "", items: [] });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "GitHub List 创建失败", 400);
} }
async function handleListMutation(request, id, env) { const token = requireToken(request); try {
    if (request.method === "DELETE") {
        await githubGraphql(token, `mutation($id:ID!){ deleteUserList(input:{listId:$id}) { clientMutationId } }`, { id });
        if (env?.DB)
            await new DataRepository(env.DB).deleteList(id);
        return json({ ok: true });
    }
    const body = await parseBody(request);
    const data = await githubGraphql(token, `mutation($id:ID!,$name:String,$description:String,$isPrivate:Boolean){ updateUserList(input:{listId:$id,name:$name,description:$description,isPrivate:$isPrivate}) { list { id name description isPrivate } } }`, { id, name: body.name?.trim(), description: body.description?.trim() || "", isPrivate: Boolean(body.isPrivate) });
    const list = data.updateUserList.list;
    if (env?.DB)
        await new DataRepository(env.DB).saveList(list, "update");
    return json({ ...list, description: list.description || "", items: [] });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "GitHub List 更新失败", 400);
} }
async function handleListMembership(request, env) { const token = requireToken(request); try {
    const body = await parseBody(request);
    const parsed = parseFullName(body.repoFullName);
    if (!Array.isArray(body.listIds))
        throw new Error("listIds 无效");
    const repoData = await githubGraphql(token, `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id } }`, { owner: parsed.owner, name: parsed.repo });
    if (!repoData.repository?.id)
        throw new Error("仓库 GraphQL ID 不存在");
    const result = await githubGraphql(token, `mutation($itemId:ID!,$listIds:[ID!]!){ updateUserListsForItem(input:{itemId:$itemId,listIds:$listIds}) { lists { id } } }`, { itemId: repoData.repository.id, listIds: body.listIds });
    if (env?.DB)
        await new DataRepository(env.DB).saveMembership(repoData.repository.id, body.listIds, body.repoFullName, `https://github.com/${body.repoFullName}`);
    return json({ listIds: result.updateUserListsForItem.lists.map((item) => item.id) });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "GitHub List membership 更新失败", 400);
} }
async function handleDiscover(request, url) { const token = requireToken(request); const channel = url.searchParams.get("channel") || "popular"; const language = url.searchParams.get("language")?.trim() || ""; const topic = url.searchParams.get("topic")?.trim() || ""; const days = clamp(Number(url.searchParams.get("days")) || 30, 1, 365); const terms = []; if (channel === "fresh")
    terms.push(`created:>=${isoDateDaysAgo(days)}`);
else if (channel === "active")
    terms.push(`pushed:>=${isoDateDaysAgo(days)}`, "stars:>50");
else
    terms.push("stars:>500"); if (language)
    terms.push(`language:${language}`); if (topic)
    terms.push(`topic:${topic}`); const query = terms.join(" "); const sort = channel === "active" ? "updated" : "stars"; const response = await githubFetch(`/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=30`, token); if (!response.ok) {
    const f = await githubError(response);
    return error(f.message, f.status, f.diagnostic);
} const payload = (await response.json()); return json({ query, repositories: (payload.items || []).map((repo) => normalizeRepository(repo, null)) }); }
async function handleAiTest(request) { try {
    const ai = await parseBody(request);
    await callProvider(ai, [{ role: "system", content: "Reply with exactly: STARBOX_OK" }, { role: "user", content: "Connectivity test." }]);
    return json({ message: `${ai.providerName?.trim() || "Custom HTTP"} 连接成功` });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "Provider 连接失败", 400);
} }
function extractJsonObject(content) { const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]; const candidate = fenced || content; const start = candidate.indexOf("{"); const end = candidate.lastIndexOf("}"); if (start < 0 || end <= start)
    throw new Error("AI 返回内容不是有效 JSON"); return JSON.parse(candidate.slice(start, end + 1)); }
async function handleAiOrganize(request) { try {
    const body = await parseBody(request);
    const repo = body.repository;
    if (!repo?.full_name)
        throw new Error("缺少仓库信息");
    const content = await callProvider(body.ai, [{ role: "system", content: "You organize GitHub repositories into concise, practical personal-library metadata." }, { role: "user", content: [`Repository: ${repo.full_name}`, `Description: ${repo.description || ""}`, `Language: ${repo.language || ""}`, `Topics: ${(repo.topics || []).join(", ")}`, `Stars: ${repo.stargazers_count}`, "Return JSON only with: summary (Chinese, <= 80 chars), category (Chinese, concise), tags (2-5 short strings).", "Do not include markdown."].join("\n") }], true);
    const parsed = extractJsonObject(content);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 160) : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim().slice(0, 40) : "";
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((item) => typeof item === "string").map((item) => item.trim().slice(0, 32)).filter(Boolean).slice(0, 5) : [];
    if (!summary || !category)
        throw new Error("AI 返回缺少 summary/category");
    return json({ summary, category, tags });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "AI 整理失败", 400);
} }
async function routeCore(request, env, identity) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/"))
        return new Response("Not found", { status: 404 });
    try {
        if (url.pathname === "/api/health" && request.method === "GET")
            return json({ ok: true });
        if (url.pathname === "/api/github/user" && request.method === "GET")
            return handleGithubUser(request);
        if (url.pathname === "/api/github/rate-limit" && request.method === "GET")
            return handleRateLimit(request);
        if (url.pathname === "/api/github/starred" && request.method === "GET")
            return handleStarred(request, env);
        if (url.pathname === "/api/github/watched" && request.method === "GET")
            return handleWatched(request);
        if (url.pathname === "/api/github/stars/batch" && request.method === "POST")
            return handleBatchStars(request, env);
        if (url.pathname === "/api/github/lists" && (request.method === "GET" || request.method === "POST"))
            return handleLists(request, env);
        if (url.pathname === "/api/github/lists/membership" && request.method === "POST")
            return handleListMembership(request, env);
        if (url.pathname === "/api/releases/feed" && request.method === "POST")
            return handleReleaseFeed(request, env);
        if (url.pathname === "/api/forks" && request.method === "POST")
            return handleFork(request, env);
        if (url.pathname === "/api/forks/status" && request.method === "GET")
            return handleForkStatus(request, url, env);
        if (url.pathname === "/api/forks/list" && request.method === "GET")
            return handleForkList(request);
        if (url.pathname === "/api/forks/details" && request.method === "GET")
            return handleForkDetails(request, url);
        if (url.pathname === "/api/forks/sync" && request.method === "POST")
            return handleForkSync(request, env);
        if (url.pathname === "/api/discover" && request.method === "GET")
            return handleDiscover(request, url);
        if (url.pathname === "/api/ai/test" && request.method === "POST")
            return handleAiTest(request);
        if (url.pathname === "/api/ai/organize" && request.method === "POST")
            return handleAiOrganize(request);
        const listMatch = url.pathname.match(/^\/api\/github\/lists\/([^/]+)$/);
        if (listMatch && (request.method === "PUT" || request.method === "DELETE"))
            return handleListMutation(request, decodeURIComponent(listMatch[1]), env);
        const readmeMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/readme$/);
        if (readmeMatch && request.method === "GET")
            return handleReadme(request, decodeURIComponent(readmeMatch[1]), decodeURIComponent(readmeMatch[2]));
        const repoMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)$/);
        if (repoMatch && request.method === "GET")
            return handleRepository(request, decodeURIComponent(repoMatch[1]), decodeURIComponent(repoMatch[2]));
        const starMatch = url.pathname.match(/^\/api\/github\/stars\/([^/]+)\/([^/]+)$/);
        if (starMatch && (request.method === "PUT" || request.method === "DELETE"))
            return handleStarMutation(request, decodeURIComponent(starMatch[1]), decodeURIComponent(starMatch[2]), env);
        const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/([^/]+)\/(\d+)$/);
        if (releaseMatch && request.method === "GET")
            return handleReleaseDetail(request, decodeURIComponent(releaseMatch[1]), decodeURIComponent(releaseMatch[2]), releaseMatch[3]);
        return error("API 路由不存在", 404);
    }
    catch (reason) {
        if (reason instanceof Response)
            return reason;
        return error(reason instanceof Error ? reason.message : "请求失败", 400);
    }
}
function unauthenticated() { return json({ error: "需要 StarBox 登录会话" }, { status: 401 }); }
async function route(request, env) {
    // Direct route(request) calls are retained for the pre-D1 contract tests. The
    // deployed Worker always receives env and therefore always takes this gate.
    if (!env)
        return routeCore(request);
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/"))
        return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    if (url.pathname === "/api/auth/session" && request.method === "GET")
        return handleSession(request, env);
    if (url.pathname === "/api/auth/login" && request.method === "POST")
        return handleLogin(request, env);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const invalid = validateMutationRequest(request, true);
        if (invalid)
            return invalid;
        return handleLogout(request, env);
    }
    if (url.pathname === "/api/health" && request.method === "GET")
        return routeCore(request, env);
    if (request.method !== "GET") {
        const invalid = validateMutationRequest(request, true);
        if (invalid)
            return invalid;
    }
    const authResult = await authenticate(request, env);
    if (!("identity" in authResult))
        return authResult.response.status === 200 ? unauthenticated() : authResult.response;
    const identity = authResult.identity;
    if (url.pathname === "/api/github/credential" && ["GET", "PUT", "DELETE"].includes(request.method))
        return handleGithubCredential(request, env, identity);
    if (url.pathname === "/api/data/changes" && request.method === "GET")
        return handleSync(request, env, identity, "delta");
    if (url.pathname === "/api/sync/delta" && request.method === "GET")
        return handleSync(request, env, identity, "delta");
    if (url.pathname === "/api/sync/cursor" && request.method === "POST")
        return handleSync(request, env, identity, "cursor");
    if (url.pathname === "/api/bootstrap" && request.method === "GET")
        return handleBootstrap(request, env, identity);
    if (url.pathname === "/api/sync/mutate" && request.method === "POST")
        return handleSyncMutation(request, env, identity);
    if (url.pathname === "/api/sync/release-state" && request.method === "POST")
        return handleSync(request, env, identity, "release");
    if (url.pathname === "/api/sync/fork-state" && request.method === "POST")
        return handleSync(request, env, identity, "fork");
    if (url.pathname === "/api/activity" && ["GET", "POST"].includes(request.method))
        return handleActivity(request, env, identity);
    if (url.pathname === "/api/notifications" && request.method === "GET")
        return handleNotifications(request, env, identity);
    const notificationMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (notificationMatch && request.method === "POST")
        return handleNotifications(request, env, identity, decodeURIComponent(notificationMatch[1]));
    return routeCore(await hydrateGithubToken(request, env, identity), env, identity);
}
export default {
    async fetch(request, env) {
        return route(request, env);
    },
};
export { route };
