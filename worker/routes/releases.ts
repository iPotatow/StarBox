import { caughtError } from "../http.js";
import type { ReleaseFeedResponse } from "../../shared/contracts.js";
import { requireToken, normalizeRelease, parseFullName, githubFetch, githubError, GithubRelease } from "../github.js";
import { parseBody, clamp, json, error } from "../http.js";
import { PLATFORM_RULE_VERSION } from "../services/release-platforms.js";
import type { StarBoxEnv } from "../types.js";
import { DataRepository } from "../repository.js";
import { inferReleasePlatformsFromAssets } from "../../shared/release-platforms.js";

export async function handleReleaseFeed(request: Request, env?: StarBoxEnv) {
  const token = requireToken(request);
  try {
    const body = await parseBody<{ repositories: string[]; sinceByRepo?: Record<string, string>; pages?: number; isFinalChunk?: boolean; previousFailures?: number }>(request);
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
    if (env?.DB && body.isFinalChunk) await new DataRepository(env.DB).recordActivity("releases_synced", { failures: failures.length + (body.previousFailures ?? 0) });
    return json<ReleaseFeedResponse>({ releases: successfulReleases, failures });
  } catch (reason) { return caughtError(reason, "Release 同步失败", 400); }
}

export async function handleReleaseDetail(request: Request, owner: string, repo: string, releaseId: string) { const token = requireToken(request); if (!/^\d+$/.test(releaseId)) return error("Release ID 无效", 400); const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}`, token); if (!response.ok) { const f = await githubError(response); return error(f.message, f.status, f.diagnostic); } return json({ release: normalizeRelease(`${owner}/${repo}`, (await response.json()) as GithubRelease) }); }
