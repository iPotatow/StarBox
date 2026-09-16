import type { AccentMode, NavigationPageId, PersistedState, ThemeMode, UiLanguage } from "../types";

const NAV_ITEMS: NavigationPageId[] = ["repositories", "releases", "forks", "discover", "settings"];
const REQUIRED_NAV = new Set<NavigationPageId>(["repositories", "settings"]);
const THEMES = new Set<ThemeMode>(["system", "light", "dark"]);
const ACCENTS = new Set<AccentMode>(["neutral", "blue", "violet", "emerald"]);
const LANGUAGES = new Set<UiLanguage>(["zh-CN", "en"]);

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
  catch { return []; }
}

function normalizeHiddenNav(value: unknown, fallback: NavigationPageId[]) {
  const supplied = parseStringArray(value).filter((item): item is NavigationPageId => NAV_ITEMS.includes(item as NavigationPageId) && !REQUIRED_NAV.has(item as NavigationPageId));
  return supplied.length || (typeof value === "string" || Array.isArray(value)) ? [...new Set(supplied)] : fallback;
}

function boolValue(value: unknown, fallback: boolean) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return fallback;
}

export function applyCloudPreferences(state: PersistedState, raw: unknown): PersistedState {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const theme = typeof record.ui_theme === "string" && THEMES.has(record.ui_theme as ThemeMode) ? record.ui_theme as ThemeMode : state.settings.theme;
  const accent = typeof record.ui_accent === "string" && ACCENTS.has(record.ui_accent as AccentMode) ? record.ui_accent as AccentMode : state.settings.accent;
  const language = typeof record.ui_language === "string" && LANGUAGES.has(record.ui_language as UiLanguage) ? record.ui_language as UiLanguage : state.settings.language;
  // nav_order_json is a legacy D1 field from the removed navigation reordering feature and is intentionally ignored.
  const hiddenNav = normalizeHiddenNav(record.hidden_nav_json, state.settings.hiddenNav);
  const includePrereleases = boolValue(record.release_include_prereleases, state.releaseSettings.includePrereleases);
  return {
    ...state,
    settings: { ...state.settings, theme, accent, language, hiddenNav },
    releaseSettings: { ...state.releaseSettings, includePrereleases },
  };
}

export async function saveCloudPreferences(state: PersistedState) {
  const response = await fetch("/api/preferences", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      theme: state.settings.theme,
      accent: state.settings.accent,
      language: state.settings.language,
      hiddenNav: state.settings.hiddenNav,
      includePrereleases: state.releaseSettings.includePrereleases,
    }),
  });
  if (!response.ok) throw new Error(`Preference sync failed (${response.status})`);
}
