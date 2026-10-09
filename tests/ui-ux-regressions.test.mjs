import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("app bootstrap uses one initial loading phase and keeps bootstrap failures separate from Star sync", () => {
  const app = read("src/app.tsx");
  assert.ok(app.includes('const [bootstrapError, setBootstrapError] = useState("")'));
  assert.ok(app.includes('const awaitingInitialBootstrap = auth.status === "authenticated" && !state.lastBootstrapAt && !bootstrapSettled'));
  assert.ok(app.includes('credentialStatusPending'));
  assert.ok(app.includes('initialLoading={false}'));
  assert.ok(app.includes('<Suspense fallback={<PassivePageLoading'));
  assert.ok(!app.includes('<Suspense fallback={<div className="grid min-h-48 place-items-center"'));
});

test("persistent status feedback stays inline while errors and warnings remain immediately visible", () => {
  const banner = read("src/components/ui/status-banner.tsx");
  assert.ok(banner.includes('<Alert'));
  assert.ok(banner.includes('<AlertDescription>{message}</AlertDescription>'));
  assert.ok(banner.includes('if (!message || (!error && !warning)) return'));
  assert.ok(banner.includes('const type = error ? "error" : "warning"'));
  assert.ok(banner.includes('notify(message, "", type)'));
});

test("application shell exposes a main landmark and skip link", () => {
  const shell = read("src/components/app-shell.tsx");
  assert.ok(shell.includes('href="#main-content"'));
  assert.ok(shell.includes('<main id="main-content" tabIndex={-1}'));
});

test("responsive layout and loading feedback avoid duplicated mobile chrome", () => {
  const styles = read("src/styles.css");
  const header = read("src/components/patterns/page-header.tsx");
  assert.ok(styles.includes('padding: 16px;'));
  assert.ok(styles.includes('.content-surface > .mx-auto'));
  assert.ok(styles.includes('[data-ai-summary-loading="true"] [data-slot="button-loading-indicator"]'));
  assert.ok(styles.includes('.content-surface > div:has([data-slot="selection-toolbar"])'));
  assert.ok(header.includes('flex flex-col gap-4 sm:flex-row'));
});

test("titled compact badges can be focused on touch and keyboard surfaces", () => {
  const badge = read("src/components/ui/badge.tsx");
  assert.ok(badge.includes('tabIndex: title && tabIndex == null ? 0 : tabIndex'));
});

test("settings use one COSS row and section system with top tabs on every breakpoint", () => {
  const settings = read("src/features/settings/settings-page.tsx");
  const list = read("src/components/patterns/settings-list.tsx");
  const section = read("src/components/patterns/settings-section.tsx");
  assert.ok(settings.includes('from "../../components/patterns/settings-list"'));
  assert.ok(settings.includes('from "../../components/patterns/settings-section"'));
  assert.ok(settings.includes('sticky top-0'));
  assert.ok(settings.includes('overflow-x-auto'));
  assert.ok(settings.includes('<TabsList variant="underline" size="sm" className="w-fit max-w-full justify-start">'));
  assert.ok(!settings.includes('mobileDetail'));
  assert.ok(!settings.includes('mobileSettingsItems'));
  assert.ok(!settings.includes('Back to Settings'));
  for (const slot of ["settings-list", "settings-row", "settings-row-content", "settings-row-actions", "settings-row-value"]) assert.ok(list.includes(`data-slot="${slot}"`));
  for (const slot of ["settings-section", "settings-section-header", "settings-section-title", "settings-section-description", "settings-section-body"]) assert.ok(section.includes(`data-slot="${slot}"`));
});

test("sensitive and advanced settings are progressive rather than permanently expanded", () => {
  const settings = read("src/features/settings/settings-page.tsx");
  assert.ok(settings.includes('open={credentialDialogOpen}'));
  assert.ok(settings.includes('open={releaseRulesOpen}'));
  assert.ok(settings.includes('Manage GitHub connection'));
  assert.ok(settings.includes('Installer matching rules'));
  assert.ok(settings.indexOf('<AboutSettings />') > settings.indexOf('<TabsPanel value="data">'));
});
