import type { PreferencePatch, ReleaseAssetRules } from "./contracts.js";

export const UI_NAV = ["repositories", "releases", "forks", "discover", "settings"] as const;
export const UI_THEMES = ["system", "light", "dark"] as const;
export const UI_ACCENTS = ["neutral", "blue", "violet", "emerald"] as const;
export const UI_LANGUAGES = ["zh-CN", "zh-TW", "en"] as const;
export const RELEASE_ASSET_PLATFORMS = ["macos", "windows", "linux"] as const;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeReleaseAssetRules(value: unknown, legacyInclude = "", legacyExclude = ""): ReleaseAssetRules {
  let parsed = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { parsed = {}; } }
  const source = record(parsed);
  const rule = (platform: keyof ReleaseAssetRules) => {
    const candidate = record(source[platform]);
    return {
      includePattern: typeof candidate.includePattern === "string" ? candidate.includePattern : legacyInclude,
      excludePattern: typeof candidate.excludePattern === "string" ? candidate.excludePattern : legacyExclude,
    };
  };
  return { macos: rule("macos"), windows: rule("windows"), linux: rule("linux") };
}

function pattern(value: unknown) {
  if (typeof value !== "string") throw new Error("安装包规则必须是字符串");
  if (value.length > 1024) throw new Error("安装包规则过长");
  if (value) new RegExp(value, "i");
  return value;
}

/** Validate provided fields only; omitted preference keys never become writes. */
export function parsePreferencePatch(value: unknown): PreferencePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("设置必须是对象");
  const input = record(value);
  const patch: PreferencePatch = {};
  for (const [key, choices] of [["theme", UI_THEMES], ["accent", UI_ACCENTS], ["language", UI_LANGUAGES]] as const) {
    if (!(key in input)) continue;
    if (typeof input[key] !== "string" || !(choices as readonly string[]).includes(input[key] as string)) throw new Error(`${key} 无效`);
    Object.assign(patch, { [key]: input[key] });
  }
  if ("hiddenNav" in input) {
    if (!Array.isArray(input.hiddenNav)) throw new Error("hiddenNav 必须是数组");
    patch.hiddenNav = [...new Set(input.hiddenNav.filter((item): item is typeof UI_NAV[number] => typeof item === "string" && (UI_NAV as readonly string[]).includes(item) && item !== "repositories" && item !== "settings"))];
  }
  for (const key of ["batchUnstarEnabled", "includePrereleases"] as const) {
    if (!(key in input)) continue;
    if (typeof input[key] !== "boolean") throw new Error(`${key} 必须是布尔值`);
    patch[key] = input[key];
  }
  if ("syncPages" in input) {
    if (!Number.isInteger(input.syncPages) || Number(input.syncPages) < 1 || Number(input.syncPages) > 5) throw new Error("syncPages 必须为 1 至 5");
    patch.syncPages = Number(input.syncPages);
  }
  if ("assetRules" in input) {
    if (!input.assetRules || typeof input.assetRules !== "object" || Array.isArray(input.assetRules)) throw new Error("assetRules 必须是对象");
    const supplied = record(input.assetRules); patch.assetRules = {};
    for (const platform of RELEASE_ASSET_PLATFORMS) {
      if (!(platform in supplied)) continue;
      const item = supplied[platform];
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${platform} 规则必须是对象`);
      const fields = record(item); const rule: { includePattern?: string; excludePattern?: string } = {};
      if ("includePattern" in fields) rule.includePattern = pattern(fields.includePattern);
      if ("excludePattern" in fields) rule.excludePattern = pattern(fields.excludePattern);
      patch.assetRules[platform] = rule;
    }
  }
  for (const key of ["assetIncludePattern", "assetExcludePattern"] as const) if (key in input) patch[key] = pattern(input[key]);
  return patch;
}


export function preferenceChoice<T extends readonly string[]>(choices: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === "string" && (choices as readonly string[]).includes(value) ? value as T[number] : fallback;
}
