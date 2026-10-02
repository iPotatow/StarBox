import { caughtError } from "../http.js";
import type { RepositoryReadmeLanguage, RepositoryReadme } from "../../shared/contracts.js";
import { normalizeRepository, requireToken, githubFetch, githubError, GithubStarredItem, GithubRepo, fetchRepository, parseFullName } from "../github.js";
import { error, json, parseBody } from "../http.js";
import type { StarBoxEnv } from "../types.js";
import { DataRepository } from "../repository.js";

export async function persistStarSnapshot(env: StarBoxEnv, repositories: ReturnType<typeof normalizeRepository>[], reachedEnd: boolean) {
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

export async function handleStarred(request: Request, env?: StarBoxEnv) {
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

export async function handleWatched(request: Request) { const token = requireToken(request); const repositories: ReturnType<typeof normalizeRepository>[] = []; for (let page = 1; page <= 10; page += 1) { const response = await githubFetch(`/user/subscriptions?per_page=100&page=${page}`, token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } const items = (await response.json()) as GithubRepo[]; repositories.push(...items.map((repo) => normalizeRepository(repo, null))); if (items.length < 100) break; } return json({ repositories }); }

export async function handleRepository(request: Request, owner: string, repo: string) { try { return json({ repository: await fetchRepository(requireToken(request), `${owner}/${repo}`) }); } catch (reason) { const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status: number }).status) : 400; return caughtError(reason, "读取仓库失败", status, typeof reason === "object" && reason && "diagnostics" in reason ? String((reason as { diagnostics: string }).diagnostics) : ""); } }

export type ReadmeLanguage = RepositoryReadmeLanguage;

export type GithubReadmeMeta = { name: string; path: string; html_url: string; type?: string };

export function localizedReadmeLanguage(name: string): Exclude<ReadmeLanguage, "default"> | null {
  const stem = name.replace(/\.(?:md|markdown|mdown|mkdn|rst|txt)$/i, "");
  if (!/^readme[._-]/i.test(stem)) return null;
  const suffix = stem.slice("readme".length).replace(/^[._-]+/, "").toLowerCase().replace(/_/g, "-");
  if (["zh", "zh-cn", "zh-hans", "cn", "chinese", "simplified-chinese"].includes(suffix)) return "zh-CN";
  if (["en", "en-us", "en-gb", "english"].includes(suffix)) return "en";
  return null;
}

export function localizedReadmeScore(name: string, language: Exclude<ReadmeLanguage, "default">) {
  const stem = name.replace(/\.(?:md|markdown|mdown|mkdn|rst|txt)$/i, "");
  const suffix = stem.slice("readme".length).replace(/^[._-]+/, "").toLowerCase().replace(/_/g, "-");
  if (language === "zh-CN") return suffix === "zh-cn" || suffix === "zh-hans" ? 3 : suffix === "zh" ? 2 : 1;
  return suffix === "en" || suffix === "english" ? 3 : 2;
}

export async function handleReadme(request: Request, owner: string, repo: string, requestedLanguageRaw: string | null) {
  const token = requireToken(request);
  const defaultResponse = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, token);
  if (defaultResponse.status === 404) return json({ content: "", htmlUrl: `https://github.com/${owner}/${repo}#readme`, path: "", language: "default", availableLanguages: [] });
  if (!defaultResponse.ok) { const f = await githubError(defaultResponse); return error(f.message, f.status, f.diagnostic); }
  const defaultMeta = (await defaultResponse.json()) as GithubReadmeMeta;
  const options: Array<{ language: ReadmeLanguage; path: string; htmlUrl: string; score: number }> = [{ language: "default", path: defaultMeta.path, htmlUrl: defaultMeta.html_url || `https://github.com/${owner}/${repo}#readme`, score: 99 }];

  const rootResponse = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`, token);
  if (rootResponse.ok) {
    const entries = (await rootResponse.json()) as GithubReadmeMeta[];
    const localized = new Map<Exclude<ReadmeLanguage, "default">, { language: Exclude<ReadmeLanguage, "default">; path: string; htmlUrl: string; score: number }>();
    for (const entry of entries) {
      if (entry.type !== "file" || entry.path === defaultMeta.path) continue;
      const language = localizedReadmeLanguage(entry.name);
      if (!language) continue;
      const score = localizedReadmeScore(entry.name, language);
      const current = localized.get(language);
      if (!current || score > current.score) localized.set(language, { language, path: entry.path, htmlUrl: entry.html_url, score });
    }
    for (const language of ["zh-CN", "en"] as const) {
      const option = localized.get(language);
      if (option) options.push(option);
    }
  }

  const requestedLanguage: ReadmeLanguage = requestedLanguageRaw === "zh-CN" || requestedLanguageRaw === "en" || requestedLanguageRaw === "default" ? requestedLanguageRaw : "default";
  let selected = requestedLanguage === "default" ? options[0] : options.find((item) => item.language === requestedLanguage) ?? options[0];
  const encodedPath = selected.path.split("/").map(encodeURIComponent).join("/");
  let rawResponse = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`, token, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (!rawResponse.ok && selected.language !== "default") {
    selected = options[0];
    const fallbackPath = selected.path.split("/").map(encodeURIComponent).join("/");
    rawResponse = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${fallbackPath}`, token, { headers: { Accept: "application/vnd.github.raw+json" } });
  }
  if (!rawResponse.ok) { const f = await githubError(rawResponse); return error(f.message, f.status, f.diagnostic); }
  return json<RepositoryReadme>({
    content: await rawResponse.text(),
    htmlUrl: selected.htmlUrl,
    path: selected.path,
    language: selected.language,
    availableLanguages: options.map(({ language, path }) => ({ language, path })),
  });
}

export async function mutateStar(token: string, fullName: string, action: "star" | "unstar") { const { owner, repo } = parseFullName(fullName); const response = await githubFetch(`/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token, { method: action === "star" ? "PUT" : "DELETE" }); if (!response.ok) { const f = await githubError(response); throw Object.assign(new Error(f.message), { status: f.status }); } }

export async function handleStarMutation(request: Request, owner: string, repo: string, env?: StarBoxEnv) {
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
    return caughtError(reason, "Star 操作失败", status);
  }
}

export async function handleBatchStars(request: Request, env?: StarBoxEnv) {
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
    return caughtError(reason, "批量操作失败", 400);
  }
}
