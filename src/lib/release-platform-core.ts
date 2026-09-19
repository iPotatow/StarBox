export const RELEASE_PLATFORM_ORDER = ["macos", "windows", "linux"] as const;
export type ReleasePlatform = (typeof RELEASE_PLATFORM_ORDER)[number];

type ReleasePlatformSource = { draft?: boolean; assets?: Array<{ name?: string }> };

const IGNORED_RELEASE_ASSET = /(?:^|[-_.\s])(?:checksums?|sha(?:1|256|512)?|signature|signatures?|sbom|symbols?|debug|source(?:[-_.\s]?code)?)(?:[-_.\s]|$)|\.(?:sha1|sha256|sha512|sig|asc|blockmap|yml|yaml|json|txt)$/i;

const PLATFORM_PATTERNS: Record<ReleasePlatform, RegExp> = {
  macos: /(?:macos|mac[-_. ]?os|darwin|osx|\.dmg\b|\.pkg\b)/i,
  windows: /(?:(?:^|[-_.\s])(?:windows?|win(?:32|64)?)(?=$|[-_.\s])|\.exe\b|\.msi\b)/i,
  linux: /(?:linux|appimage|\.deb\b|\.rpm\b)/i,
};

export function releaseAssetPlatforms(name: string): ReleasePlatform[] {
  const value = name.trim();
  if (!value || IGNORED_RELEASE_ASSET.test(value)) return [];
  return RELEASE_PLATFORM_ORDER.filter((platform) => PLATFORM_PATTERNS[platform].test(value));
}

export function inferReleasePlatformsFromAssets(releases: ReleasePlatformSource[]): ReleasePlatform[] {
  const found = new Set<ReleasePlatform>();
  for (const release of releases.slice(0, 5)) {
    if (release.draft) continue;
    for (const asset of release.assets ?? []) {
      for (const platform of releaseAssetPlatforms(asset.name ?? "")) found.add(platform);
    }
  }
  return RELEASE_PLATFORM_ORDER.filter((platform) => found.has(platform));
}
