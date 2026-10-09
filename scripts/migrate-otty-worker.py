from pathlib import Path

path = Path("worker/preferences.ts")
text = path.read_text()

old_import = 'import { UI_NAV, UI_THEMES, UI_ACCENTS, UI_LANGUAGES, RELEASE_ASSET_PLATFORMS, normalizeReleaseAssetRules, parsePreferencePatch, preferenceChoice } from "../shared/preferences.js";'
new_import = 'import { UI_NAV, UI_THEMES, UI_LANGUAGES, RELEASE_ASSET_PLATFORMS, normalizeReleaseAssetRules, normalizeUiAccent, parsePreferencePatch, preferenceChoice } from "../shared/preferences.js";'
if old_import not in text:
    raise SystemExit("missing Worker preferences import")
text = text.replace(old_import, new_import, 1)

old_default = '    ui_accent: values["ui.accent"] || "neutral",'
new_default = '    ui_accent: normalizeUiAccent(values["ui.accent"], "otty-blue"),'
if old_default not in text:
    raise SystemExit("missing Worker accent default")
text = text.replace(old_default, new_default, 1)

old_response = 'accent: preferenceChoice(UI_ACCENTS, saved.ui_accent, "neutral")'
new_response = 'accent: normalizeUiAccent(saved.ui_accent, "otty-blue")'
if old_response not in text:
    raise SystemExit("missing Worker response accent")
text = text.replace(old_response, new_response, 1)

path.write_text(text)
