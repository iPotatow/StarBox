import { githubToken, parseFullName, githubFetch, GithubRelease } from "../github.js";
import type { StarBoxEnv } from "../types.js";
import { DataRepository } from "../repository.js";
import type { ReleasePlatform } from "../../shared/release-platforms.js";
import { RELEASE_PLATFORM_ORDER, inferReleasePlatformsFromAssets } from "../../shared/release-platforms.js";

export const PLATFORM_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const PLATFORM_RULE_VERSION = "release-platform-v3";

export async function resolveReleasePlatforms(request: Request, env: StarBoxEnv | undefined, fullName: string) {
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
