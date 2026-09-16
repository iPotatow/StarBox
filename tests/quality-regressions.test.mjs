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
});

test("protected repository card and multi-select action surfaces remain present", () => {
  const page = source("src/features/repositories/repositories-page.tsx");
  assert.match(page, /<RepositoryCard/);
  assert.match(page, /selected\.size \? <div className="pointer-events-none fixed/);
  assert.match(page, /AI analysis/);
  assert.match(page, /Unstar/);
});

test("AI analysis surfaces purposeful motion feedback", () => {
  const page = source("src/features/repositories/repositories-page.tsx");
  const card = source("src/features/repositories/repository-card.tsx");
  const progress = source("src/components/ui/animated-progress.tsx");
  assert.match(page, /<AnimatedProgress/);
  assert.match(page, /setAiLoading\(repo\.full_name\)/);
  assert.match(card, /AI is analyzing/);
  assert.match(card, /aria-busy/);
  assert.match(card, /motion-reduce:transition-none/);
  assert.match(progress, /from "motion"/);
  assert.match(progress, /type: "spring"/);
  assert.match(progress, /role="progressbar"/);
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
  assert.match(alertDialog, /max-sm:grid-rows-\[1fr_auto\]/);
  assert.match(switchComponent, /group-active\/switch:scale-x-110/);
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
  const app = source("src/app.tsx");
  const main = source("src/main.tsx");
  const styles = source("src/styles.css");
  const provider = source("worker/provider.ts");

  assert.match(menu, /MenuPrimitive\.GroupLabel/);
  assert.match(menu, /normalizeGroupedChildren/);
  assert.match(select, /explicitItems/);
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

test("cross-device preferences and release AI summaries are D1-backed while density is removed", () => {
  const types = source("src/types.ts");
  const app = source("src/app.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  const preferences = source("src/lib/preferences.ts");
  const migration = source("migrations/0009_ui_preferences.sql");
  const v5 = source("worker/v5.ts");
  const api = source("src/lib/api.ts");
  const releases = source("src/features/releases/releases-page.tsx");

  assert.doesNotMatch(types, /DensityMode|density:/);
  assert.doesNotMatch(app, /dataset\.density/);
  assert.doesNotMatch(settings, /Interface density|界面密度/);
  assert.match(preferences, /saveCloudPreferences/);
  assert.match(preferences, /ui_theme/);
  assert.match(preferences, /nav_order_json/);
  assert.match(migration, /github_avatar_url/);
  assert.match(migration, /ai_summary_json/);
  assert.match(v5, /release\.ai_summary/);
  assert.match(v5, /github_avatar_url/);
  assert.match(api, /ai_summary_json/);
  assert.match(api, /operation: "release\.ai_summary"/);
  assert.match(releases, /release\.aiSummary/);
});
