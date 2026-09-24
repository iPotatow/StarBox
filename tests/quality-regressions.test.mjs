import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("production auth is fail-closed and no default password remains", () => {
  const auth = source("worker/auth.ts");
  assert.doesNotMatch(auth, /000000/);
  assert.match(auth, /auth_not_configured/);
  assert.match(auth, /LOGIN_PASSWORD/);
});

test("all D1 credentials use one encryption secret", () => {
  const types = source("worker/types.ts");
  const v5 = source("worker/v5.ts");
  const ai = source("worker/ai-services.ts");
  assert.match(types, /STARBOX_ENCRYPTION_KEY\?: string/);
  for (const code of [types, v5, ai]) {
    assert.doesNotMatch(code, /GITHUB_TOKEN_ENCRYPTION_KEY/);
    assert.doesNotMatch(code, /STARBOX_CREDENTIAL_ENCRYPTION_KEY/);
    assert.doesNotMatch(code, /_PREVIOUS/);
  }
});

test("AI preferences and credentials use one atomic repository commit", () => {
  const v5 = source("worker/v5.ts");
  const ai = source("worker/ai-services.ts");
  const repository = source("worker/repository.ts");
  assert.match(v5, /saveAiConfigAtomic/);
  assert.match(repository, /async saveAiConfigAtomic/);
  assert.match(repository, /async saveAiServiceAtomic/);
  assert.match(ai, /saveAiServiceAtomic/);
  assert.doesNotMatch(repository, /for \(let i = 0; i < statements\.length; i \+= 50\)/);
});

test("deployment does not enforce Cloudflare Secret binding type", () => {
  const deploy = source("scripts/deploy.mjs");
  const verify = source("scripts/verify-deployment.mjs");
  const config = JSON.parse(source("wrangler.jsonc"));
  assert.doesNotMatch(deploy, /verifyWorkerSecrets|REQUIRED_WORKER_SECRETS|\["secret", "list"/);
  assert.equal(Object.hasOwn(config, "secrets"), false);
  assert.equal(config.workers_dev, false);
  assert.match(verify, /checks\?\.database/);
  assert.match(verify, /checks\?\.auth/);
  assert.match(verify, /checks\?\.encryption/);
});

test("cache writes are generation-fenced and logout is not faked locally", () => {
  const storage = source("src/lib/storage.ts");
  const app = source("src/app.tsx");
  assert.match(storage, /cacheGeneration/);
  assert.match(storage, /cacheQueue = cacheQueue/);
  assert.doesNotMatch(app, /local logout still clears the UI session/);
  assert.match(app, /Sign out failed/);
});

test("mobile navigation uses labeled bottom tabs and desktop uses coss sidebar composition", () => {
  const shell = source("src/components/app-shell.tsx");
  const sidebar = source("src/components/ui/sidebar.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  assert.match(shell, /mobile-tabbar/);
  assert.match(shell, /aria-current/);
  assert.match(shell, /SidebarProvider/);
  assert.match(shell, /SidebarMenuButton/);
  assert.match(sidebar, /data-slot="sidebar-menu-button"/);
  assert.match(settings, /Back to Settings/);
  assert.match(settings, /mobileSettingsItems/);
  assert.match(settings, /<TabsList variant="underline" size="sm" className="w-fit max-w-full justify-start">/);
});

test("COSS tabs keep indicator geometry and active-state alignment", () => {
  const tabs = source("src/components/ui/tabs.tsx");
  assert.match(tabs, /h-\(--active-tab-height\)/);
  assert.match(tabs, /w-\(--active-tab-width\)/);
  assert.match(tabs, /translate-x-\(--active-tab-left\)/);
  assert.match(tabs, /-translate-y-\(--active-tab-bottom\)/);
  assert.match(tabs, /data-active:text-foreground/);
  assert.match(tabs, /TabsListContext/);
  assert.doesNotMatch(tabs, /data-\[selected\]:text-foreground/);
});

test("protected repository card and multi-select action surfaces remain present", () => {
  const page = source("src/features/repositories/repositories-page.tsx");
  assert.match(page, /<RepositoryCard/);
  assert.match(page, /bottom-\[calc\(76px\+env\(safe-area-inset-bottom\)\)\][^"]*md:bottom-5/);
  assert.match(page, /AI analysis/);
  assert.match(page, /Unstar/);
  assert.doesNotMatch(source("src/features/repositories/repository-card.tsx"), /selectionMode && "pointer-events-none/);
  assert.match(source("src/features/repositories/repository-card.tsx"), /disabled=\{selectionMode\}/);
});

test("AI analysis surfaces keep one special card effect and shared batch feedback", () => {
  const page = source("src/features/repositories/repositories-page.tsx");
  const card = source("src/features/repositories/repository-card.tsx");
  const beamCard = source("src/components/spectrumui/beam-card.tsx");
  assert.match(page, /import \{ Spinner \} from "\.\.\/\.\.\/components\/ui\/spinner";/);
  assert.match(page, /<Spinner className="size-4 shrink-0"/);
  assert.doesNotMatch(page, /thinking-orbs|ThinkingOrb|AnimatedProgress/);
  assert.match(page, /setAiLoading\(repo\.full_name\)/);
  assert.match(card, /import \{ BeamCard \} from "\.\.\/\.\.\/components\/spectrumui\/beam-card";/);
  assert.match(card, /<BeamCard active=\{aiLoading\} size="pulse-inner" colorVariant="colorful"[\s\S]*?<Card/);
  assert.match(beamCard, /from "border-beam";/);
  assert.doesNotMatch(card, /ThinkingOrb/);
  assert.doesNotMatch(card, /role="status"/);
  assert.doesNotMatch(card, /opacity-65/);
  assert.match(card, /aria-busy/);
});

test("coss feedback primitives keep original purposeful motion", () => {
  const toast = source("src/components/ui/toast.tsx");
  const skeleton = source("src/components/ui/skeleton.tsx");
  const tooltip = source("src/components/ui/tooltip.tsx");
  const dialog = source("src/components/ui/dialog.tsx");
  const alertDialog = source("src/components/ui/alert-dialog.tsx");
  const switchComponent = source("src/components/ui/switch.tsx");
  const styles = source("src/styles.css");
  const motionStyles = source("src/coss-motion.css");

  assert.match(toast, /--toast-index/);
  assert.match(toast, /data-\[expanded\]/);
  assert.match(toast, /data-\[behind\]/);
  assert.match(toast, /--toast-peek/);
  assert.match(skeleton, /animate-skeleton/);
  assert.doesNotMatch(skeleton, /animate-pulse/);
  assert.match(styles, /@import "\.\/coss-motion\.css"/);
  assert.match(motionStyles, /@keyframes skeleton/);
  assert.match(tooltip, /--transform-origin/);
  assert.match(tooltip, /data-\[starting-style\]:scale-98/);
  assert.match(dialog, /--nested-dialogs/);
  assert.match(alertDialog, /max-md:grid-rows-\[1fr_auto\]/);
  assert.match(switchComponent, /group-active\/switch:scale-x-110/);
});

test("second-batch interaction primitives keep component boundaries and layering", () => {
  const button = source("src/components/ui/button.tsx");
  const appShell = source("src/components/app-shell.tsx");
  const radio = source("src/components/ui/radio-group.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  const responsive = source("src/components/ui/responsive-dialog.tsx");
  const dialog = source("src/components/ui/dialog.tsx");
  const drawer = source("src/components/ui/drawer.tsx");
  const menu = source("src/components/ui/menu.tsx");
  const select = source("src/components/ui/select.tsx");
  const tooltip = source("src/components/ui/tooltip.tsx");
  const alertDialog = source("src/components/ui/alert-dialog.tsx");

  assert.doesNotMatch(button, /group\/button/);
  assert.doesNotMatch(appShell, /animated-icons/);
  assert.match(appShell, /@phosphor-icons\/react/);
  assert.match(radio, /variant\?: "default" \| "overlay"/);
  assert.match(settings, /variant="overlay"/);
  assert.doesNotMatch(settings, /!absolute|!size-full|!border-0|!bg-transparent/);
  assert.match(responsive, /max-width: 767px/);
  assert.match(dialog, /z-\[70\]/);
  assert.match(drawer, /z-\[70\]/);
  assert.match(menu, /z-\[100\]/);
  assert.match(select, /z-\[100\]/);
  assert.match(tooltip, /z-\[100\]/);
  assert.match(alertDialog, /z-\[90\]/);
});

test("encryption secret accepts any non-empty value via SHA-256 derivation", () => {
  const crypto = source("worker/crypto.ts");
  assert.match(crypto, /subtle\.digest\("SHA-256"/);
  assert.match(crypto, /Boolean\(secret\.trim\(\)\)/);
  assert.doesNotMatch(crypto, /必须是 32 字节/);
});

test("coss compatibility keeps the StarBox surface contract intact", () => {
  const styles = source("src/styles.css");
  const avatar = source("src/components/ui/avatar.tsx");
  const repositoryCard = source("src/features/repositories/repository-card.tsx");
  assert.match(styles, /\.content-surface \{/);
  assert.match(styles, /border-radius: 14px/);
  assert.match(styles, /padding: 16px/);
  assert.match(styles, /#root \{ isolation: isolate; \}/);
  assert.match(styles, /body \{\s*position: relative;/);
  assert.match(styles, /--font-heading: var\(--font-sans\)/);
  assert.match(avatar, /AvatarPrimitive\.Root/);
  assert.match(repositoryCard, /AvatarFallback/);
  assert.match(repositoryCard, /AvatarImage/);
});

test("production regression fixes stay wired", () => {
  const menu = source("src/components/ui/menu.tsx");
  const select = source("src/components/ui/select.tsx");
  const markdown = source("src/components/ui/markdown-content.tsx");
  const repositoryCard = source("src/features/repositories/repository-card.tsx");
  const releases = source("src/features/releases/releases-page.tsx");
  const releaseAssets = source("src/lib/release-assets.ts");
  const app = source("src/app.tsx");
  const main = source("src/main.tsx");
  const styles = source("src/styles.css");
  const provider = source("worker/provider.ts");

  assert.match(menu, /MenuPrimitive\.GroupLabel/);
  assert.doesNotMatch(menu, /normalizeGroupedChildren/);
  assert.match(releases, /selectRecommendedAsset/);
  assert.match(releases, /适合当前设备/);
  assert.match(releases, /架构未确认/);
  assert.match(releases, /releaseAssetAvailability/);
  assert.match(releaseAssets, /DEFAULT_ASSET_RULES/);
  for (const platform of ["macos", "windows", "linux"]) assert.match(releaseAssets, new RegExp(`${platform}: \\{`));
  assert.match(releaseAssets, /platform === "unknown"/);
  assert.match(releaseAssets, /some\(\(candidate\) => ruleMatches/);
  assert.match(releaseAssets, /getHighEntropyValues\(\["architecture", "bitness"\]\)/);
  assert.match(releaseAssets, /normalizeDeviceArchitecture/);
  assert.match(releaseAssets, /DeviceArchitecture = "arm64" \| "x64" \| "x86" \| "unknown"/);
  assert.match(releaseAssets, /hasOtherArchitecture/);
  assert.match(releaseAssets, /architectureLabel/);
  assert.match(releaseAssets, /Number\.isFinite\(candidate\.score\)/);
  assert.match(releaseAssets, /ReleaseAssetAvailability/);
  assert.match(source("src/lib/release-platform-core.ts"), /win\(\?:32\|64\)/);
  assert.match(source("worker/index.ts"), /inferReleasePlatformsFromAssets/);
  assert.match(select, /items: readonly SelectItemRecord/);
  assert.match(select, /items=\{rootItems\}/);
  assert.match(select, /options\.find\(\(option\) => option\.value === selectedValue\)/);
  assert.match(markdown, /GitHub README HTML/);
  assert.match(markdown, /parts\.push\(<br key=/);
  assert.match(repositoryCard, /loading="eager"/);
  assert.match(repositoryCard, /AvatarFallback/);
  assert.match(app, /fetchAiServices/);
  assert.match(app, /auth\.status, page, state\.lastBootstrapAt/);
  assert.doesNotMatch(main, /responsive-fixes\.css/);
  assert.match(styles, /@media \(min-width: 768px\)[\s\S]*\.mobile-tabbar[\s\S]*display: none !important/);
  assert.match(provider, /ps\.air-outer\.com/);
  assert.match(provider, /originator", "codex_cli_rs/);
  assert.match(provider, /user-agent/);
  assert.match(provider, /AGENT_ROUTER_CODEX_VERSION/);
});

test("third-batch task and settings failures remain locally visible", () => {
  const repositories = source("src/features/repositories/repositories-page.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  const aiSettings = source("src/features/settings/ai-services-settings.tsx");
  const devices = source("src/features/settings/login-devices-settings.tsx");
  const categories = source("src/features/repositories/category-manager.tsx");

  assert.match(repositories, /succeeded: 0, failed: 0/);
  assert.match(repositories, /AI 批量任务/);
  assert.match(repositories, /<NumberTicker value=\{aiBatchProgress\.succeeded\} \/>/); assert.match(repositories, /<NumberTicker value=\{aiBatchProgress\.failed\} \/>/); assert.match(repositories, /<NumberTicker value=\{aiBatchRemaining\} \/>/);
  assert.match(repositories, /暂停会在当前仓库处理完成后生效/);
  assert.match(repositories, /onClick=\{\(\) => setSelected\(new Set\(\)\)\}/);
  assert.match(settings, /releaseRulesStatusError/);
  assert.match(settings, /dataStatusError/);
  assert.match(settings, /overflow-x-auto/);
  assert.match(aiSettings, /function taskError/);
  assert.match(devices, /setError\(reason instanceof Error/);
  assert.match(categories, /setError\(reason instanceof Error/);
});

test("UX-07 follow controls and Release payload ownership stay explicit", () => {
  const repositories = source("src/features/repositories/repositories-page.tsx");
  const releases = source("src/features/releases/releases-page.tsx");
  const storage = source("src/lib/storage.ts");
  assert.match(repositories, /setAiFollowPaused\(true\)/);
  assert.match(repositories, /Resume follow/);
  assert.match(repositories, /prefers-reduced-motion: reduce/);
  assert.match(repositories, /filters were kept unchanged/);
  assert.doesNotMatch(repositories.slice(repositories.indexOf("async function unstar("), repositories.indexOf("async function batchUnstar")), /refreshCanonicalState/);
  assert.match(storage, /export function mergeReleaseSnapshot/);
  assert.doesNotMatch(storage, /local\?\.aiSummary/);
  assert.match(storage, /server\.releaseAiSummaries !== undefined/);
  assert.match(releases, /mergeReleaseSnapshot\(local, next\)/);
});

test("AI freshness, manual category protection, tokenized search, and request cancellation are explicit", () => {
  const repositories = source("src/features/repositories/repositories-page.tsx");
  const editor = source("src/features/repositories/repository-editor.tsx");
  const api = source("src/lib/api.ts");
  const worker = source("worker/index.ts");
  const repository = source("worker/repository.ts");
  const detail = source("src/features/repositories/repository-detail.tsx");
  const releases = source("src/features/releases/releases-page.tsx");
  const readme = source("README.md");
  const readmeEn = source("README.en.md");
  assert.match(worker, /previousAnalysis\?\.inputHash === inputHash/);
  assert.match(worker, /unchanged: true/);
  assert.match(repositories, /aiInputHash/);
  assert.match(repositories, /aiPromptVersion/);
  assert.match(repositories, /aiModelId/);
  assert.match(repository, /repositories\.category_locked = 1/);
  assert.match(editor, /保护手动分类/);
  assert.match(repositories, /needles\.every/);
  assert.match(api, /signal\?: AbortSignal/);
  assert.match(detail, /readmeCache/);
  assert.match(detail, /requestAbort\.current\?\.abort/);
  assert.match(releases, /detailCache/);
  assert.match(releases, /detailAbort\.current\?\.abort/);
  for (const docs of [readme, readmeEn]) {
    assert.doesNotMatch(docs, /GITHUB_TOKEN_ENCRYPTION_KEY|STARBOX_CREDENTIAL_ENCRYPTION_KEY|\*_PREVIOUS|000000/);
    assert.match(docs, /STARBOX_ENCRYPTION_KEY/);
  }
});

test("cross-device preferences and latest Release AI summary stay D1-backed while Release payloads stay browser-local", () => {
  const types = source("src/types.ts");
  const app = source("src/app.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  const preferences = source("src/lib/preferences.ts");
  const baseline = source("migrations/0001_schema.sql");
  const upgrade = source("migrations/0002_legacy_upgrade.sql");
  const deployScript = source("scripts/deploy.mjs");
  const mutations = source("src/lib/mutations.ts");
  const cryptoSource = source("worker/crypto.ts");
  const v5 = source("worker/v5.ts");
  const repository = source("worker/repository.ts");
  const api = source("src/lib/api.ts");
  const storage = source("src/lib/storage.ts");
  const releases = source("src/features/releases/releases-page.tsx");

  assert.doesNotMatch(types, /DensityMode|density:|navOrder:/);
  assert.doesNotMatch(app, /dataset\.density|settings\.navOrder/);
  assert.doesNotMatch(settings, /Interface density|界面密度/);
  assert.match(preferences, /saveCloudPreferences/);
  assert.match(preferences, /ui_theme/);
  assert.doesNotMatch(preferences, /nav_order_json/);

  for (const table of ["repositories", "categories", "forks", "app_sessions", "credentials", "ai_services", "ai_models", "settings"]) assert.match(baseline, new RegExp(`CREATE TABLE ${table}\\b`));
  assert.match(baseline, /repository_id TEXT PRIMARY KEY/);
  assert.match(baseline, /github_repo_id INTEGER UNIQUE/);
  assert.match(baseline, /category_locked INTEGER NOT NULL DEFAULT 0/);
  assert.match(baseline, /user_revision INTEGER NOT NULL DEFAULT 0/);
  assert.match(baseline, /release_ai_release_id INTEGER/);
  assert.match(baseline, /release_ai_summary_json TEXT/);
  assert.match(baseline, /FOREIGN KEY \(category_id\) REFERENCES categories\(category_id\) ON DELETE SET NULL/);
  assert.match(baseline, /FOREIGN KEY \(service_id\) REFERENCES ai_services\(service_id\) ON DELETE CASCADE/);
  assert.doesNotMatch(baseline, /CREATE TABLE releases\b|processed_mutations|sync_changes|activity_log|release_cursor TEXT|raw_json TEXT/);

  assert.match(upgrade, /DROP TABLE IF EXISTS releases/);
  assert.match(upgrade, /ai_platforms_json/);
  assert.match(upgrade, /raw_json/);
  assert.match(upgrade, /ciphertext,[\s\S]*iv,[\s\S]*key_version,[\s\S]*fingerprint/);
  assert.match(upgrade, /ALTER TABLE repositories_next RENAME TO repositories/);
  assert.match(upgrade, /STARBOX_UPGRADE_STAGE: RELEASE_AI/);
  assert.match(upgrade, /ADD COLUMN release_ai_release_id INTEGER/);
  assert.doesNotMatch(upgrade, /PRAGMA foreign_keys = OFF/);

  assert.match(deployScript, /ALLOWED_SQL_FILES = \[BASELINE_SCHEMA, LEGACY_UPGRADE\]/);
  assert.match(deployScript, /allows exactly two SQL files/);
  assert.match(deployScript, /detectSchemaState/);
  assert.match(deployScript, /legacy-consolidated/);
  assert.match(deployScript, /final-pre-release-ai/);
  assert.match(deployScript, /verifyLegacyUpgradePreflight/);
  assert.match(deployScript, /verifyCompatibilitySnapshot/);
  assert.match(deployScript, /EXPLAIN QUERY PLAN/);
  assert.doesNotMatch(deployScript, /d1", "migrations"/);

  assert.match(mutations, /error instanceof ApiError && error\.status === 409/);
  assert.match(mutations, /result\.userRevisions/);
  assert.match(cryptoSource, /purpose=ai_service_credentials/);
  assert.match(cryptoSource, /service_id=\$\{serviceId\}/);
  assert.doesNotMatch(v5, /release\.ai_summary/);
  assert.doesNotMatch(repository, /\["releases", "SELECT release_id/);
  assert.doesNotMatch(repository, /INSERT INTO releases/);
  assert.match(repository, /saveReleasePlatformState/);
  assert.match(repository, /upsertRepositories/);
  assert.match(api, /export async function summarizeRelease[\s\S]*return jsonRequest<AiReleaseSummary>/);
  assert.doesNotMatch(api, /operation: "release\.ai_summary"/);
  assert.match(storage, /Release cache/);
  assert.doesNotMatch(storage, /server\.releases !== undefined/);
  assert.doesNotMatch(releases, /release\.aiSummary/);
  assert.match(releases, /releaseSummaryFor/);
  assert.match(repository, /saveReleaseAiSummary/);
  assert.match(api, /releaseAiSummaries/);
  assert.match(storage, /releaseAiSummaries/);
});
