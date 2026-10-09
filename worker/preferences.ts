import { caughtError } from "./http.js";
import { UI_NAV, UI_THEMES, UI_LANGUAGES, RELEASE_ASSET_PLATFORMS, normalizeReleaseAssetRules, normalizeUiAccent, parsePreferencePatch, preferenceChoice } from "../shared/preferences.js";
import type { PreferencesResponse, NavigationPageId } from "../shared/contracts.js";
import { body, rejectClientTenant } from "./request.js";
import { error, json } from "./http.js";
import type { StarBoxEnv, Identity } from "./types.js";
import { DataRepository } from "./repository.js";
import { currentTimeIso } from "./auth.js";

export type FullPreferenceRecord = {
  account_id: string;
  ai_provider_name: string;
  ai_base_url: string;
  ai_model: string;
  release_sync_pages: number;
  release_asset_include_pattern: string;
  release_asset_exclude_pattern: string;
  release_asset_rules_json: string;
  ui_theme: string;
  ui_accent: string;
  ui_language: string;
  hidden_nav_json: string;
  batch_unstar_enabled: number;
  release_include_prereleases: number;
  github_avatar_url: string | null;
  updated_at: string;
};

export function normalizedHiddenNav(value: unknown, fallback: NavigationPageId[]) { if (!Array.isArray(value)) return fallback; return [...new Set(value.filter((item): item is NavigationPageId => typeof item === "string" && (UI_NAV as readonly string[]).includes(item) && item !== "repositories" && item !== "settings"))]; }

export function parseStoredList(value: string | undefined, fallback: string[]) { if (!value) return fallback; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback; } catch { return fallback; } }

export async function fullPreferences(env: StarBoxEnv) {
  if (!env.DB) return null;
  const repository = new DataRepository(env.DB);
  const values = await repository.settings();
  return {
    account_id: "primary",
    ai_provider_name: values["ai.provider_name"] || "Custom HTTP",
    ai_base_url: values["ai.base_url"] || "",
    ai_model: values["ai.model"] || "",
    release_sync_pages: Math.max(1, Number(values["release.sync_pages"] || 3)),
    release_asset_include_pattern: values["release.asset_include_pattern"] || "",
    release_asset_exclude_pattern: values["release.asset_exclude_pattern"] || "",
    release_asset_rules_json: values["release.asset_rules_json"] || "{}",
    ui_theme: values["ui.theme"] || "system",
    ui_accent: normalizeUiAccent(values["ui.accent"], "otty-blue"),
    ui_language: values["ui.language"] || "zh-CN",
    hidden_nav_json: values["ui.hidden_nav_json"] || "[]",
    batch_unstar_enabled: values["ui.batch_unstar_enabled"] === "1" ? 1 : 0,
    release_include_prereleases: values["release.include_prereleases"] === "0" ? 0 : 1,
    github_avatar_url: values["github.avatar_url"] || null,
    updated_at: values["meta.preferences_updated_at"] || currentTimeIso(),
  } satisfies FullPreferenceRecord;
}

export async function saveFullPreferences(env: StarBoxEnv, patch: Partial<FullPreferenceRecord>, rulesPatch?: unknown) {
  if (!env.DB) throw new Error("Worker 未配置 D1 DB");
  const keys: Partial<Record<keyof FullPreferenceRecord, string>> = {
    ai_provider_name: "ai.provider_name", ai_base_url: "ai.base_url", ai_model: "ai.model",
    release_sync_pages: "release.sync_pages", release_asset_include_pattern: "release.asset_include_pattern",
    release_asset_exclude_pattern: "release.asset_exclude_pattern", release_asset_rules_json: "release.asset_rules_json",
    ui_theme: "ui.theme", ui_accent: "ui.accent", ui_language: "ui.language", hidden_nav_json: "ui.hidden_nav_json",
    batch_unstar_enabled: "ui.batch_unstar_enabled", release_include_prereleases: "release.include_prereleases",
    github_avatar_url: "github.avatar_url",
  };
  const values: Record<string, string | number> = { "meta.preferences_updated_at": currentTimeIso() };
  for (const [field, value] of Object.entries(patch)) {
    const key = keys[field as keyof FullPreferenceRecord];
    if (key && value !== undefined) values[key] = value ?? "";
  }
  await new DataRepository(env.DB).saveSettings(values, rulesPatch === undefined ? {} : { "release.asset_rules_json": rulesPatch });
  return (await fullPreferences(env))!;
}

export async function handlePreferences(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("云端配置暂不可用", 503);
  if (request.method === "GET") return json(await fullPreferences(env));
  if (request.method !== "PUT") return error("设置不支持该方法", 405);
  try {
    const record = await body(request); rejectClientTenant(record);
    const supplied = parsePreferencePatch(record);
    const patch: Partial<FullPreferenceRecord> = {};
    if (supplied.theme !== undefined) patch.ui_theme = supplied.theme;
    if (supplied.accent !== undefined) patch.ui_accent = supplied.accent;
    if (supplied.language !== undefined) patch.ui_language = supplied.language;
    if (supplied.hiddenNav !== undefined) patch.hidden_nav_json = JSON.stringify(supplied.hiddenNav);
    if (supplied.batchUnstarEnabled !== undefined) patch.batch_unstar_enabled = supplied.batchUnstarEnabled ? 1 : 0;
    if (supplied.includePrereleases !== undefined) patch.release_include_prereleases = supplied.includePrereleases ? 1 : 0;
    if (supplied.syncPages !== undefined) patch.release_sync_pages = supplied.syncPages;
    const legacyRules = supplied.assetIncludePattern === undefined && supplied.assetExcludePattern === undefined ? undefined : Object.fromEntries(RELEASE_ASSET_PLATFORMS.map((platform) => [platform, {
      ...(supplied.assetIncludePattern === undefined ? {} : { includePattern: supplied.assetIncludePattern }),
      ...(supplied.assetExcludePattern === undefined ? {} : { excludePattern: supplied.assetExcludePattern }),
    }]));
    const saved = await saveFullPreferences(env, patch, supplied.assetRules ?? legacyRules);
    return json<PreferencesResponse>({ syncPages: saved.release_sync_pages, assetRules: normalizeReleaseAssetRules(saved.release_asset_rules_json), theme: preferenceChoice(UI_THEMES, saved.ui_theme, "system"), accent: normalizeUiAccent(saved.ui_accent, "otty-blue"), language: preferenceChoice(UI_LANGUAGES, saved.ui_language, "zh-CN"), hiddenNav: normalizedHiddenNav(parseStoredList(saved.hidden_nav_json, []), []), batchUnstarEnabled: Boolean(saved.batch_unstar_enabled), includePrereleases: Boolean(saved.release_include_prereleases) });
  } catch (reason) { return caughtError(reason, "设置保存失败", 400); }
}
