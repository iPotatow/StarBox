import { caughtError } from "../http.js";
import type { ForkRepository, ForkListResponse } from "../../shared/contracts.js";
import { requireToken, parseFullName, githubFetch, githubError, GithubRepo, fetchRepositoryRaw } from "../github.js";
import { json, error, parseBody } from "../http.js";
import type { StarBoxEnv } from "../types.js";
import { DataRepository } from "../repository.js";

export async function handleForkStatus(request: Request, url: URL, env?: StarBoxEnv) { const token = requireToken(request); const raw = url.searchParams.get("full_name") || ""; try { const parsed = parseFullName(raw); const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, token); if (response.status === 404) { if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, null, "pending", {}); return json({ sourceFullName: "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: null, status: "pending" }); } if (!response.ok) { const f = await githubError(response); if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, null, "failed", { error: f.message }); return error(f.message, f.status, f.diagnostic); } const repo = (await response.json()) as GithubRepo; const result = { sourceFullName: repo.parent?.full_name || "", targetOwner: parsed.owner, targetName: parsed.repo, targetFullName: parsed.fullName, htmlUrl: repo.html_url, status: "ready" }; if (env?.DB) await new DataRepository(env.DB).saveFork(parsed.fullName, result.sourceFullName || null, "ready", repo); return json(result); } catch (reason) { if (env?.DB) await new DataRepository(env.DB).saveFork(raw || "unknown", null, "failed", { error: reason instanceof Error ? reason.message : "Fork 状态读取失败" }); return caughtError(reason, "Fork 状态读取失败", 400); } }

export type ForkPayload = ForkRepository;

export function normalizeFork(repo: GithubRepo): ForkPayload { return { id: repo.id, fullName: repo.full_name, htmlUrl: repo.html_url, description: repo.description, defaultBranch: repo.default_branch || "main", pushedAt: repo.pushed_at, owner: { login: repo.owner.login, avatarUrl: repo.owner.avatar_url }, parentFullName: repo.parent?.full_name || null, parentHtmlUrl: repo.parent?.html_url || null, aheadBy: null, behindBy: null, compareStatus: "unknown", latestWorkflow: null, workflows: [] }; }

export async function forkDetails(token: string, fullName: string, includeWorkflowDefinitions = true) {
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

export async function handleForkList(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request); const candidates: GithubRepo[] = []; let complete = false;
  for (let page = 1; page <= 30; page += 1) {
    const response = await githubFetch(`/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`, token);
    if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); }
    const items = (await response.json()) as GithubRepo[];
    candidates.push(...items.filter((item) => item.fork));
    if (items.length < 100) { complete = true; break; }
  }
  const forks: ForkRepository[] = [];
  for (let index = 0; index < candidates.length; index += 4) {
    const part = await Promise.all(candidates.slice(index, index + 4).map(async (repo) => { try { return await forkDetails(token, repo.full_name, false); } catch { return normalizeFork(repo); } }));
    forks.push(...part);
  }
  if (env?.DB) {
    const repository = new DataRepository(env.DB);
    await repository.reconcileForks(forks, complete);
    await repository.recordActivity("forks_synced", { count: forks.length, complete });
  }
  return json<ForkListResponse>({ forks, complete });
}

export async function handleForkDetails(request: Request, url: URL) { try { return json(await forkDetails(requireToken(request), url.searchParams.get("full_name") || "", true)); } catch (reason) { const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status: number }).status) : 400; return caughtError(reason, "Fork 详情读取失败", status); } }

export async function handleForkSync(request: Request, env?: StarBoxEnv) { const token = requireToken(request); let fullName = "unknown"; try { const body = await parseBody<{ fullName: string; branch?: string }>(request); fullName = body.fullName; const repo = await fetchRepositoryRaw(token, body.fullName); if (!repo.parent) throw new Error("目标仓库不是 Fork"); const parsed = parseFullName(repo.full_name); const branch = body.branch?.trim() || repo.default_branch || "main"; const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/merge-upstream`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branch }) }); if (!response.ok) { const f = await githubError(response); if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "failed", { error: f.message }); return error(f.message, f.status, f.diagnostic); } const payload = (await response.json()) as { message?: string; merge_type?: string }; if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, repo.parent.full_name, "ready", repo); return json({ message: payload.message || "Fork 已同步", mergeType: payload.merge_type || "unknown" }); } catch (reason) { if (env?.DB) await new DataRepository(env.DB).saveFork(fullName, null, "failed", { error: reason instanceof Error ? reason.message : "Fork 同步失败" }); return caughtError(reason, "Fork 同步失败", 400); } }

export async function handleForkWorkflowDispatch(request: Request) {
  const token = requireToken(request);
  try {
    const body = await parseBody<{ fullName: string; workflowId: number; ref?: string; inputs?: Record<string, string> }>(request);
    const parsed = parseFullName(body.fullName); const workflowId = Number(body.workflowId); if (!Number.isFinite(workflowId) || workflowId <= 0) throw new Error("Workflow ID 无效");
    const ref = body.ref?.trim() || "main"; const inputs = body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs) ? Object.fromEntries(Object.entries(body.inputs).map(([key, value]) => [key, String(value)])) : {};
    const response = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${workflowId}/dispatches`, token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref, ...(Object.keys(inputs).length ? { inputs } : {}) }) });
    if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); }
    return json({ message: `Workflow 已触发 · ${body.fullName} @ ${ref}` });
  } catch (reason) { return caughtError(reason, "Workflow 触发失败", 400); }
}
