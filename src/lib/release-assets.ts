import type { ReleaseAssetPlatform, ReleaseAssetRule, ReleaseAssetRules, ReleaseItem, ReleaseSettings, Repository } from "../types";
import { inferReleasePlatformsFromAssets, releaseAssetPlatforms } from "./release-platform-core";

const DEFAULT_EXCLUDE_PATTERN = String.raw`(?:^|[-_.\s])(?:checksums?|sha(?:1|256|512)?|signature|signatures?|sbom|symbols?|debug|source(?:[-_.\s]?code)?)(?:[-_.\s]|$)|\.(?:sha1|sha256|sha512|sig|asc|blockmap|yml|yaml|json|txt)$`;

export const DEFAULT_ASSET_RULES: ReleaseAssetRules = {
  macos: {
    includePattern: String.raw`(?:\.(?:dmg|pkg)$|(?=.*(?:macos|mac[-_. ]?os|darwin|osx|universal2?|apple[-_. ]?silicon))(?=.*\.(?:zip|tar\.gz|tgz)$))`,
    excludePattern: DEFAULT_EXCLUDE_PATTERN,
  },
  windows: {
    includePattern: String.raw`(?:\.(?:exe|msi)$|(?=.*(?:^|[-_.\s])(?:windows?|win(?:32|64)?)(?=$|[-_.\s]))(?=.*\.(?:zip|7z)$))`,
    excludePattern: DEFAULT_EXCLUDE_PATTERN,
  },
  linux: {
    includePattern: String.raw`(?:\.(?:appimage|deb|rpm)$|(?=.*(?:^|[-_.\s])linux(?=$|[-_.\s]))(?=.*\.(?:zip|tar\.gz|tar\.xz|tar\.bz2|tgz|txz|tbz2)$))`,
    excludePattern: DEFAULT_EXCLUDE_PATTERN,
  },
};

export type DevicePlatform = "macos" | "windows" | "linux" | "unknown";
export type DeviceArchitecture = "arm64" | "x64" | "x86" | "unknown";
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

export function effectiveAssetRules(settings: Pick<ReleaseSettings, "assetRules">, platform: ReleaseAssetPlatform): ReleaseAssetRule {
  const configured = settings.assetRules?.[platform];
  const fallback = DEFAULT_ASSET_RULES[platform];
  return {
    includePattern: configured?.includePattern?.trim() || fallback.includePattern,
    excludePattern: configured?.excludePattern?.trim() || fallback.excludePattern,
  };
}

function ruleMatches(name: string, rule: ReleaseAssetRule) {
  return regexMatches(name, rule.includePattern) && !regexMatches(name, rule.excludePattern);
}

export function releaseAssetPassesRules(name: string, settings: Pick<ReleaseSettings, "assetRules">, platform: DevicePlatform) {
  if (platform === "unknown") return (["macos", "windows", "linux"] as const).some((candidate) => ruleMatches(name, effectiveAssetRules(settings, candidate)));
  return ruleMatches(name, effectiveAssetRules(settings, platform));
}

function assetPlatforms(name: string) {
  return new Set<DevicePlatform>(releaseAssetPlatforms(name));
}

export function inferReleasePlatforms(releases: Array<Pick<ReleaseItem, "assets" | "draft">>) {
  return inferReleasePlatformsFromAssets(releases);
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
  if (/(?:darwin|macos|windows|linux|arm64|aarch64|x86_64|amd64|x86|ia32|i686)/.test(value)) return "binary";
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

type NavigatorUserAgentData = {
  architecture?: string;
  bitness?: string;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    architecture?: string;
    bitness?: string;
  }>;
};

type NavigatorWithUserAgentData = Navigator & { userAgentData?: NavigatorUserAgentData };

function detectPlatform(source: string): DevicePlatform {
  const value = source.toLowerCase();
  if (/(?:iphone|ipad|ipod|android|mobile)/.test(value)) return "unknown";
  if (/(?:mac|darwin)/.test(value)) return "macos";
  if (/\bwindows\b|\bwin(?:32|64)\b/.test(value)) return "windows";
  if (/(?:linux|x11)/.test(value)) return "linux";
  return "unknown";
}

export function normalizeDeviceArchitecture(architecture = "", bitness = "", fallback = "", platform: DevicePlatform = "unknown"): DeviceArchitecture {
  const value = architecture.trim().toLowerCase();
  const bits = bitness.trim().toLowerCase();
  if (/(?:arm64|aarch64)/.test(value)) return "arm64";
  if (/^(?:arm|armv8|armv9)$/.test(value)) return "arm64";
  if (/(?:x86_64|x86-64|x64|amd64)/.test(value)) return "x64";
  if (/^(?:x86|ia32|i[3-6]86)$/.test(value)) {
    if (bits === "64" || platform === "macos") return "x64";
    return "x86";
  }

  const raw = fallback.toLowerCase();
  if (/(?:arm64|aarch64)/.test(raw)) return "arm64";
  if (/(?:x86_64|x86-64|x64|amd64|win64)/.test(raw)) return "x64";
  if (/\b(?:ia32|i[3-6]86|x86|win32)\b/.test(raw)) return "x86";
  return "unknown";
}

export function detectDeviceProfileFallback(): DeviceProfile {
  if (typeof navigator === "undefined") return { platform: "unknown", architecture: "unknown" };
  const nav = navigator as NavigatorWithUserAgentData;
  const raw = `${nav.userAgentData?.platform ?? ""} ${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  const platform = detectPlatform(raw);
  return {
    platform,
    architecture: normalizeDeviceArchitecture(nav.userAgentData?.architecture, "", raw, platform),
  };
}

export async function detectDeviceProfile(): Promise<DeviceProfile> {
  const fallback = detectDeviceProfileFallback();
  if (typeof navigator === "undefined") return fallback;
  const userAgentData = (navigator as NavigatorWithUserAgentData).userAgentData;
  if (!userAgentData?.getHighEntropyValues) return fallback;

  try {
    const highEntropy = await userAgentData.getHighEntropyValues(["architecture", "bitness"]);
    return {
      platform: fallback.platform,
      architecture: normalizeDeviceArchitecture(
        highEntropy.architecture || userAgentData.architecture,
        highEntropy.bitness,
        navigator.userAgent,
        fallback.platform,
      ),
    };
  } catch {
    return fallback;
  }
}

export function deviceProfileLabel(profile: DeviceProfile) {
  const platform = profile.platform === "macos" ? "macOS" : profile.platform === "windows" ? "Windows" : profile.platform === "linux" ? "Linux" : "当前设备";
  if (profile.architecture === "arm64") return `${platform} · ARM64`;
  if (profile.architecture === "x64") return `${platform} · x64`;
  if (profile.architecture === "x86") return `${platform} · x86`;
  return platform;
}

function hasArchitecture(name: string, architecture: Exclude<DeviceArchitecture, "unknown">) {
  const value = name.toLowerCase();
  if (architecture === "arm64") return /(?:arm64|aarch64|apple[-_. ]?silicon)/.test(value);
  if (architecture === "x64") return /(?:x86_64|x86-64|x64|amd64|intel64)/.test(value);
  return /\b(?:ia32|i[3-6]86|x86(?:_32)?|win32)\b/.test(value);
}

function installerWeight(kind: AssetKind, platform: DevicePlatform) {
  if (platform === "macos") return kind === "dmg" ? 145 : kind === "pkg" ? 135 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  if (platform === "windows") return kind === "msi" ? 145 : kind === "exe" ? 135 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  if (platform === "linux") return kind === "appimage" ? 145 : kind === "deb" ? 138 : kind === "rpm" ? 132 : kind === "archive" ? 42 : kind === "binary" ? 35 : -90;
  return ["dmg", "pkg", "exe", "msi", "appimage", "deb", "rpm", "apk"].includes(kind) ? 85 : kind === "archive" || kind === "binary" ? 28 : -90;
}

export function scoreReleaseAsset(asset: ReleaseAsset, settings: Pick<ReleaseSettings, "assetRules">, profile: DeviceProfile) {
  if (!releaseAssetPassesRules(asset.name, settings, profile.platform)) return Number.NEGATIVE_INFINITY;
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
    const hasTargetArchitecture = hasArchitecture(asset.name, profile.architecture);
    const hasOtherArchitecture = (["arm64", "x64", "x86"] as const).some((other) => other !== profile.architecture && hasArchitecture(asset.name, other));
    if (!hasTargetArchitecture && hasOtherArchitecture && !/(?:universal|universal2|fat[-_. ]?binary)/.test(value)) return Number.NEGATIVE_INFINITY;
    if (hasTargetArchitecture) score += 62;
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

export function rankReleaseAssets(release: ReleaseItem, settings: Pick<ReleaseSettings, "assetRules">, profile: DeviceProfile) {
  return release.assets
    .filter((asset) => releaseAssetPassesRules(asset.name, settings, profile.platform))
    .map((asset) => ({ asset, score: scoreReleaseAsset(asset, settings, profile), kind: assetKind(asset.name), platformLabel: assetPlatformLabel(asset.name), typeLabel: assetTypeLabel(assetKind(asset.name)) }))
    .sort((a, b) => b.score - a.score || b.asset.downloadCount - a.asset.downloadCount || a.asset.name.localeCompare(b.asset.name));
}

export function selectRecommendedAsset(release: ReleaseItem, repository: Repository | undefined, settings: Pick<ReleaseSettings, "assetRules">, profile: DeviceProfile): ReleaseAssetRecommendation | null {
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
