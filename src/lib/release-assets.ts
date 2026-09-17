import type { ReleaseItem, ReleaseSettings, Repository } from "../types";

export const DEFAULT_ASSET_INCLUDE_PATTERN = String.raw`(?:\.(?:dmg|pkg|zip|exe|msi|appimage|deb|rpm|apk|tar\.gz|tar\.xz|tar\.bz2|tgz|txz|tbz2|7z|rar)$|(?:macos|mac[-_. ]?os|darwin|osx|windows|win(?:32|64)?|linux|arm64|aarch64|x86_64|amd64))`;
export const DEFAULT_ASSET_EXCLUDE_PATTERN = String.raw`(?:^|[-_.\s])(?:checksums?|sha(?:1|256|512)?|signature|signatures?|sbom|symbols?|debug|source(?:[-_.\s]?code)?)(?:[-_.\s]|$)|\.(?:sha1|sha256|sha512|sig|asc|blockmap|yml|yaml|json|txt)$`;

export type DevicePlatform = "macos" | "windows" | "linux" | "unknown";
export type DeviceArchitecture = "arm64" | "x64" | "unknown";
export type AssetKind = "dmg" | "pkg" | "exe" | "msi" | "appimage" | "deb" | "rpm" | "apk" | "archive" | "binary" | "other";
export type ReleaseAsset = ReleaseItem["assets"][number];

export interface DeviceProfile {
  platform: DevicePlatform;
  architecture: DeviceArchitecture;
}

export interface ReleaseAssetRecommendation {
  asset: ReleaseAsset;
  score: number;
  kind: AssetKind;
  platformLabel: string;
  typeLabel: string;
}

function regexMatches(value: string, pattern: string) {
  if (!pattern.trim()) return true;
  try { return new RegExp(pattern, "i").test(value); }
  catch { return value.toLowerCase().includes(pattern.trim().toLowerCase()); }
}

export function effectiveAssetRules(settings: Pick<ReleaseSettings, "assetIncludePattern" | "assetExcludePattern">) {
  return {
    include: settings.assetIncludePattern.trim() || DEFAULT_ASSET_INCLUDE_PATTERN,
    exclude: settings.assetExcludePattern.trim() || DEFAULT_ASSET_EXCLUDE_PATTERN,
  };
}

export function releaseAssetPassesRules(name: string, settings: Pick<ReleaseSettings, "assetIncludePattern" | "assetExcludePattern">) {
  const rules = effectiveAssetRules(settings);
  return regexMatches(name, rules.include) && !regexMatches(name, rules.exclude);
}

function assetPlatforms(name: string) {
  const value = name.toLowerCase();
  const result = new Set<DevicePlatform>();
  if (/(?:macos|mac[-_. ]?os|darwin|osx|\.dmg\b|\.pkg\b)/i.test(value)) result.add("macos");
  if (/(?:windows|win(?:32|64)?|\.exe\b|\.msi\b)/i.test(value)) result.add("windows");
  if (/(?:linux|appimage|\.deb\b|\.rpm\b)/i.test(value)) result.add("linux");
  return result;
}

export function assetKind(name: string): AssetKind {
  const value = name.toLowerCase();
  if (value.endsWith(".dmg")) return "dmg";
  if (value.endsWith(".pkg")) return "pkg";
  if (value.endsWith(".exe")) return "exe";
  if (value.endsWith(".msi")) return "msi";
  if (value.endsWith(".appimage")) return "appimage";
  if (value.endsWith(".deb")) return "deb";
  if (value.endsWith(".rpm")) return "rpm";
  if (value.endsWith(".apk")) return "apk";
  if (/\.(?:zip|tar\.gz|tar\.xz|tar\.bz2|tgz|txz|tbz2|7z|rar)$/.test(value)) return "archive";
  if (/(?:darwin|macos|windows|linux|arm64|aarch64|x86_64|amd64)/.test(value)) return "binary";
  return "other";
}

export function assetTypeLabel(kind: AssetKind) {
  if (kind === "appimage") return "AppImage";
  if (kind === "archive") return "Archive";
  if (kind === "binary") return "Binary";
  if (kind === "other") return "File";
  return kind.toUpperCase();
}

export function assetPlatformLabel(name: string) {
  const platforms = assetPlatforms(name);
  if (platforms.size === 1) {
    if (platforms.has("macos")) return "macOS";
    if (platforms.has("windows")) return "Windows";
    if (platforms.has("linux")) return "Linux";
  }
  if (platforms.size > 1) return "Multi-platform";
  return "Universal";
}

export function detectDeviceProfile(): DeviceProfile {
  if (typeof navigator === "undefined") return { platform: "unknown", architecture: "unknown" };
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const raw = `${nav.userAgentData?.platform ?? ""} ${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  const platform: DevicePlatform = /mac|darwin|iphone|ipad/.test(raw) ? "macos" : /win/.test(raw) ? "windows" : /linux|x11/.test(raw) ? "linux" : "unknown";
  // Browser user agents intentionally obscure Apple Silicon vs Intel on many Macs.
  // Keep architecture unknown unless the runtime exposes an explicit architecture token.
  const architecture: DeviceArchitecture = /(?:arm64|aarch64)/.test(raw) ? "arm64" : platform !== "macos" && /(?:x86_64|x64|amd64|win64)/.test(raw) ? "x64" : "unknown";
  return { platform, architecture };
}

export function deviceProfileLabel(profile: DeviceProfile) {
  const platform = profile.platform === "macos" ? "macOS" : profile.platform === "windows" ? "Windows" : profile.platform === "linux" ? "Linux" : "当前设备";
  if (profile.architecture === "arm64") return `${platform} · ARM64`;
  if (profile.architecture === "x64") return `${platform} · x64`;
  return platform;
}

function hasArchitecture(name: string, architecture: Exclude<DeviceArchitecture, "unknown">) {
  const value = name.toLowerCase();
  return architecture === "arm64" ? /(?:arm64|aarch64|apple[-_. ]?silicon)/.test(value) : /(?:x86_64|x64|amd64|intel)/.test(value);
}

function installerWeight(kind: AssetKind, platform: DevicePlatform) {
  if (platform === "macos") return kind === "dmg" ? 145 : kind === "pkg" ? 135 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  if (platform === "windows") return kind === "msi" ? 145 : kind === "exe" ? 135 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  if (platform === "linux") return kind === "appimage" ? 145 : kind === "deb" ? 138 : kind === "rpm" ? 132 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  return ["dmg", "pkg", "exe", "msi", "appimage", "deb", "rpm", "apk"].includes(kind) ? 85 : kind === "archive" || kind === "binary" ? 28 : -90;
}

export function scoreReleaseAsset(asset: ReleaseAsset, settings: Pick<ReleaseSettings, "assetIncludePattern" | "assetExcludePattern">, profile: DeviceProfile) {
  if (!releaseAssetPassesRules(asset.name, settings)) return Number.NEGATIVE_INFINITY;
  const kind = assetKind(asset.name);
  let score = installerWeight(kind, profile.platform);
  const platforms = assetPlatforms(asset.name);
  if (profile.platform !== "unknown") {
    if (platforms.has(profile.platform)) score += 180;
    else if (platforms.size) score -= 280;
  }
  const value = asset.name.toLowerCase();
  if (/(?:universal|universal2|fat[-_. ]?binary)/.test(value)) score += 44;
  if (profile.architecture !== "unknown") {
    if (hasArchitecture(asset.name, profile.architecture)) score += 62;
    const opposite = profile.architecture === "arm64" ? "x64" : "arm64";
    if (hasArchitecture(asset.name, opposite)) score -= 72;
  } else if (profile.platform === "macos") {
    if (hasArchitecture(asset.name, "arm64")) score += 10;
    if (hasArchitecture(asset.name, "x64")) score += 6;
  }
  score += Math.min(8, Math.log10(Math.max(1, asset.downloadCount + 1)) * 2);
  return score;
}

function repositoryLooksDistributable(repository?: Repository) {
  if (!repository) return false;
  const topics = new Set(repository.topics.map((topic) => topic.toLowerCase()));
  return ["app", "application", "desktop", "desktop-app", "macos", "windows", "linux", "cli", "command-line", "terminal", "electron", "tauri", "utility", "tool"].some((topic) => topics.has(topic));
}

export function rankReleaseAssets(release: ReleaseItem, settings: Pick<ReleaseSettings, "assetIncludePattern" | "assetExcludePattern">, profile: DeviceProfile) {
  return release.assets
    .filter((asset) => releaseAssetPassesRules(asset.name, settings))
    .map((asset) => ({ asset, score: scoreReleaseAsset(asset, settings, profile), kind: assetKind(asset.name), platformLabel: assetPlatformLabel(asset.name), typeLabel: assetTypeLabel(assetKind(asset.name)) }))
    .sort((a, b) => b.score - a.score || b.asset.downloadCount - a.asset.downloadCount || a.asset.name.localeCompare(b.asset.name));
}

export function selectRecommendedAsset(release: ReleaseItem, repository: Repository | undefined, settings: Pick<ReleaseSettings, "assetIncludePattern" | "assetExcludePattern">, profile: DeviceProfile): ReleaseAssetRecommendation | null {
  const best = rankReleaseAssets(release, settings, profile)[0];
  if (!best || best.score < 30) return null;
  const explicitPlatform = assetPlatforms(best.asset.name).size > 0;
  const directInstaller = ["dmg", "pkg", "exe", "msi", "appimage", "deb", "rpm", "apk"].includes(best.kind);
  if (!directInstaller && !explicitPlatform && !repositoryLooksDistributable(repository)) return null;
  return best;
}

export function inferDeliveryLabel(repository: Repository | undefined, recommendation: ReleaseAssetRecommendation | null) {
  if (recommendation?.kind === "dmg" || recommendation?.kind === "pkg") return "macOS App";
  if (recommendation?.kind === "exe" || recommendation?.kind === "msi") return "Windows App";
  if (recommendation?.kind === "appimage" || recommendation?.kind === "deb" || recommendation?.kind === "rpm") return "Linux App";
  const topics = new Set((repository?.topics ?? []).map((topic) => topic.toLowerCase()));
  if (["cli", "command-line", "terminal"].some((topic) => topics.has(topic))) return "CLI";
  if (["docker", "container", "self-hosted"].some((topic) => topics.has(topic))) return "Docker / Server";
  if (["library", "sdk", "framework", "package", "npm", "pypi"].some((topic) => topics.has(topic))) return "Library / SDK";
  if (["desktop", "desktop-app", "electron", "tauri", "application"].some((topic) => topics.has(topic))) return "Desktop App";
  return recommendation ? "Download" : "Source Project";
}
