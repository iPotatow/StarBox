import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) { return readFileSync(path, "utf8"); }

test("UI exposes the complete StarBox 0.5 workflow set", () => {
  const repos = read("src/features/repositories/repositories-page.tsx");
  const detail = read("src/features/repositories/repository-detail.tsx");
  const releases = read("src/features/releases/releases-page.tsx");
  const forks = read("src/features/forks/forks-page.tsx");
  const lists = read("src/features/lists/lists-page.tsx");
  const discover = read("src/features/discover/discover-page.tsx");
  const settings = read("src/features/settings/settings-page.tsx");
  const activity = read("src/features/activity/activity-page.tsx");
  const notifications = read("src/features/notifications/notifications-page.tsx");
  const login = read("src/features/auth/login-page.tsx");
  assert.match(repos, /批量 Star/);
  assert.match(repos, /批量 AI/);
  assert.match(repos, /分类管理/);
  assert.match(detail, /README/);
  assert.match(detail, /DeepWiki/);
  assert.match(detail, /Zread/);
  assert.match(releases, /增量同步/);
  assert.match(releases, /仅最新版/);
  assert.match(releases, /资产 include 规则/);
  assert.match(releases, /导入 Watching/);
  assert.match(releases, /同步深度/);
  assert.match(forks, /同步上游/);
  assert.match(forks, /最新 Actions/);
  assert.match(forks, /pollAttempts/);
  assert.match(lists, /GitHub Lists/);
  assert.match(lists, /membership/);
  assert.match(lists, /Private List/);
  assert.match(discover, /GitHub Search API/);
  assert.match(settings, /API 配额/);
  assert.match(settings, /导航顺序与显示/);
  assert.match(settings, /Provider 名称/);
  assert.match(settings, /Replace Token/);
  assert.match(settings, /Remove Token/);
  assert.match(settings, /Critical deployment warning/);
  assert.match(activity, /Activity Log/);
  assert.match(notifications, /通知中心/);
  assert.match(login, /登录 StarBox/);
});

test("worker config keeps public workers subdomain disabled", () => {
  assert.match(read("wrangler.jsonc"), /"workers_dev"\s*:\s*false/);
});

test("sensitive credentials are removed from exported backup payload", () => {
  const storage = read("src/lib/storage.ts");
  assert.match(storage, /apiKey:\s*""/);
  assert.match(storage, /githubToken:\s*""/);
});

test("v5 state separates cloud cache, browser secrets and UI state", () => {
  const storage = read("src/lib/storage.ts");
  assert.match(storage, /version:\s*5/);
  assert.match(storage, /starbox:ui:v5/);
  assert.match(storage, /indexedDB/);
  assert.match(storage, /starbox-cache-v5/);
  assert.match(storage, /categories:\s*\[\]/);
  assert.match(storage, /releaseSettings:/);
  assert.match(storage, /forkReadAt:\s*\{\}/);
  assert.match(storage, /githubLists:\s*\[\]/);
  assert.match(storage, /activity:\s*\[\]/);
  assert.match(storage, /notifications:\s*\[\]/);
  assert.match(storage, /navOrder/);
  for (const store of ["meta", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "releaseStates", "forks", "githubLists", "notifications"]) assert.match(storage, new RegExp(`\\"${store}\\"`));
  assert.doesNotMatch(storage, /createV4Backup|chunkMigrationPayload|checksumText|CACHE_STORE/);
});

test("0.5 authentication, credential, sync and notification API contracts are wired", () => {
  const api = read("src/lib/api.ts");
  const app = read("src/app.tsx");
  assert.match(api, /GET|fetchAuthSession/);
  assert.match(api, /\/api\/auth\/session/);
  assert.match(api, /\/api\/auth\/login/);
  assert.match(api, /\/api\/auth\/logout/);
  assert.match(api, /\/api\/github\/credential/);
  assert.match(api, /\/api\/bootstrap/);
  assert.match(api, /\/api\/sync\/delta/);
  assert.match(api, /\/api\/sync\/mutate/);
  assert.match(api, /\/api\/activity/);
  assert.match(api, /\/api\/notifications/);
  assert.match(app, /fetchAuthSession/);
  assert.match(app, /loadCachedState/);
  assert.match(app, /fetchBootstrap/);
  assert.match(app, /LoginPage/);
});

test("cloud credential requests support hydrated credentials and JSON mutation contracts", () => {
  const api = read("src/lib/api.ts");
  const settings = read("src/features/settings/settings-page.tsx");
  const pages = ["repositories", "releases", "forks", "lists", "discover", "repository-detail", "fork-dialog"].map((name) => read(name === "repository-detail" ? "src/features/repositories/repository-detail.tsx" : name === "fork-dialog" ? "src/features/forks/fork-dialog.tsx" : `src/features/${name}/${name}-page.tsx`)).join("\n");
  assert.match(api, /method !== "GET"/);
  assert.match(api, /headers\.set\("content-type", "application\/json"\)/);
  assert.match(api, /body: "\{\}"/);
  assert.match(api, /fetchDataChanges/);
  assert.match(api, /\/api\/data\/changes/);
  assert.match(api, /commitCanonicalMutation/);
  assert.doesNotMatch(api, /\/api\/migration\//);
  assert.doesNotMatch(settings, /v4|迁移到云端|checksum|beginMigration|uploadMigrationChunk|verifyMigration|completeMigration/);
  assert.match(pages, /credentialConnected/);
});

test("bootstrap starts cache-first, restores credential state and follows with changes", () => {
  const app = read("src/app.tsx");
  assert.match(app, /loadCachedState\(\)/);
  assert.match(app, /fetchBootstrap\(\)/);
  assert.doesNotMatch(app, /fetchGithubCredential\(\)/);
  assert.match(app, /fetchDataChanges\(/);
  assert.match(app, /result\.authoritative/);
  assert.match(app, /result\.githubCredential/);
  assert.match(app, /changes\.changes\.length/);
  assert.match(app, /const refreshed = await fetchBootstrap\(\)/);
  assert.match(app, /credentialConnected/);
});

test("empty changes only advances the sync cursor, never fabricates a Stars sync time", () => {
  const app = read("src/app.tsx");
  assert.match(app, /else if \(changes\.lastSeq !== undefined\) setState\(\(current\) => \(\{ \.\.\.current, lastSeq: changes\.lastSeq \}\)\)/);
  assert.doesNotMatch(app, /lastSeq: changes\.lastSeq, lastSyncAt:/);
});

test("bootstrap contract normalizes top-level D1 entities and snake_case keys", () => {
  const api = read("src/lib/api.ts");
  assert.match(api, /export interface BootstrapPayload/);
  for (const key of ["account", "githubCredential", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "releaseStates", "forks", "githubLists", "notifications", "revision", "lastSeq"]) assert.match(api, new RegExp(`${key}`));
  for (const key of ["full_name", "category_id", "repo_full_name", "published_at", "payload_json", "read_at", "created_at"]) assert.match(api, new RegExp(key));
  assert.match(api, /normalizeBootstrapPayload/);
  assert.match(api, /repositoryFullName/);
});

test("authoritative business mutations cover every requested domain and preserve local-only secrets", () => {
  const sources = {
    repositories: read("src/features/repositories/repositories-page.tsx"),
    categories: read("src/features/repositories/category-manager.tsx"),
    releases: read("src/features/releases/releases-page.tsx"),
    forks: read("src/features/forks/forks-page.tsx"),
    lists: read("src/features/lists/lists-page.tsx"),
  };
  for (const source of [sources.repositories, sources.categories, sources.releases, sources.forks]) assert.match(source, /runOptimisticMutation/);
  assert.doesNotMatch(sources.lists, /runOptimisticMutation/);
  for (const operation of ["category.create", "category.update", "category.delete", "category.reorder", "repository_meta.update", "repository_meta.batch_category", "repository_meta.ai", "repository_meta.ai_batch", "release.subscribe", "release.unsubscribe", "release.subscribe.batch", "release.read", "release.unread", "fork.create", "fork.read", "fork.remove", "fork.retry"]) assert.match(Object.values(sources).join("\n"), new RegExp(operation.replace(".", "\\.")));
  for (const apiCall of ["createGithubList", "updateGithubList", "deleteGithubList", "setGithubListMembership"]) assert.match(sources.lists, new RegExp(apiCall));
  assert.doesNotMatch(sources.repositories, /operation: "ai\./);
  assert.doesNotMatch(read("src/features/releases/releases-page.tsx"), /operation: "releaseSettings/);
});

test("browser-local AI secrets stay in UI snapshot while GitHub token is stripped", () => {
  const storage = read("src/lib/storage.ts");
  assert.match(storage, /settings: \{ \.\.\.state\.settings, githubToken: "" \}/);
  assert.match(storage, /cacheState\(state\)/);
  assert.match(storage, /ai: \{ \.\.\.state\.settings\.ai, apiKey: "", headers: \{\} \}/);
  const typecheck = read("scripts/typecheck.mjs");
  assert.match(typecheck, /"@base-ui\/react"/);
  assert.match(typecheck, /@remixicon\/react/);
  assert.equal(JSON.parse(read("package.json")).version, "0.5.1");
  assert.equal(JSON.parse(read("package.json")).dependencies["@base-ui/react"], "1.8.0");
});

test("Stars categories are horizontal and precede the search control", () => {
  const repos = read("src/features/repositories/repositories-page.tsx");
  assert.match(repos, /stars-category-strip/);
  assert.match(repos, /overflow-x-auto/);
  assert.match(repos, /全部/);
  assert.match(repos, /未分类/);
  assert.match(repos, /管理/);
  assert.ok(repos.indexOf("stars-category-strip") < repos.indexOf("文本搜索仓库"));
});

test("Desktop Content Surface keeps the exact visual contract", () => {
  const styles = read("src/styles.css");
  const shell = read("src/components/app-shell.tsx");
  assert.match(shell, /content-surface/);
  assert.match(shell, /data-testid="content-surface"/);
  assert.match(styles, /margin:\s*8px 8px 8px 0/);
  assert.match(styles, /border:\s*0/);
  assert.match(styles, /border-radius:\s*14px/);
  assert.match(styles, /padding:\s*16px/);
  assert.match(styles, /0 1px 3px 0 rgba\(0, 0, 0, 0\.10\),\s*0 1px 2px -1px rgba\(0, 0, 0, 0\.10\)/);
});

test("Content Surface owns scrolling and the shell keeps the sidebar background", () => {
  const styles = read("src/styles.css");
  const shell = read("src/components/app-shell.tsx");
  assert.match(shell, /className="app-shell min-h-screen bg-sidebar text-foreground"/);
  assert.match(shell, /className="fixed inset-y-0 left-0 z-20 hidden w-56 bg-sidebar/);
  assert.match(shell, /className="app-main min-h-screen md:pl-56"/);
  assert.doesNotMatch(shell, /border-r border-border bg-sidebar/);
  assert.match(styles, /html, #root \{ height: 100%; \}/);
  assert.match(styles, /body \{[\s\S]*overflow: hidden;/);
  assert.match(styles, /\.app-shell \{[\s\S]*height: 100%;[\s\S]*overflow: hidden;[\s\S]*background: var\(--sidebar\);/);
  assert.match(styles, /\.app-main \{[\s\S]*height: 100%;[\s\S]*min-height: 0;[\s\S]*overflow: hidden;[\s\S]*background: var\(--sidebar\);/);
  assert.match(styles, /\.content-surface \{[\s\S]*height: 100%;[\s\S]*overflow: auto;/);
  assert.match(styles, /height: calc\(100% - 16px\);/);
  assert.match(styles, /\.app-main \{[\s\S]*height: calc\(100% - 56px\);/);
});

test("type compatibility uses real React types on normal installs and project-based test compilers", () => {
  const vendor = read("src/env.d.ts");
  const settings = read("src/features/settings/settings-page.tsx");
  const testScript = read("scripts/test.mjs");
  const pkg = JSON.parse(read("package.json"));
  assert.doesNotMatch(vendor, /declare\s+(?:namespace\s+React|module\s+["']react["'])/);
  assert.match(vendor, /declare module "\*\.css"/);
  assert.match(settings, /import type \{ ReactNode \} from "react";/);
  assert.match(testScript, /tsconfig\.test\.json/);
  assert.match(testScript, /tsconfig\.storage-test\.json/);
  assert.equal(pkg.devDependencies.typescript, "5.9.3");
  assert.equal(pkg.devDependencies.esbuild, "0.28.2");
});

test("normal installed builds bundle frontend dependencies while offline builds stay explicit fallback", () => {
  const build = read("scripts/build.mjs");
  assert.match(build, /await import\("esbuild"\)/);
  assert.match(build, /bundle:\s*true/);
  assert.match(build, /fallback import-map mode/);
});

test("Gist is deliberately absent from runtime routes and navigation", () => {
  assert.doesNotMatch(read("worker/index.ts"), /\/api\/gists?/i);
  assert.doesNotMatch(read("src/components/app-shell.tsx"), /\bgists?\b/i);
});

test("COSS migration uses Base UI behavior primitives instead of visual-only replicas", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@base-ui/react"], "1.8.0");
  const ui = ["button", "input", "field", "modal", "select", "checkbox", "switch", "tooltip"].map((name) => read(`src/components/ui/${name}.tsx`)).join("\n");
  for (const primitive of ["button", "input", "field", "dialog", "select", "checkbox", "switch", "tooltip"]) assert.match(ui, new RegExp(`@base-ui/react/${primitive}`));
  assert.match(read("src/components/ui/modal.tsx"), /DialogPrimitive\.Portal/);
  assert.match(read("src/components/ui/select.tsx"), /SelectPrimitive\.Popup/);
  const productUi = [read("src/features/repositories/repository-card.tsx"), read("src/features/repositories/repository-editor.tsx"), read("src/features/releases/releases-page.tsx"), read("src/features/forks/fork-dialog.tsx"), read("src/features/lists/lists-page.tsx"), read("src/features/settings/settings-page.tsx")].join("\n");
  assert.doesNotMatch(productUi, /type="checkbox"/);
});


test("COSS migration covers the full StarBox primitive contract and existing compositions", () => {
  const primitives = {
    textarea: "@base-ui/react/field",
    badge: "@base-ui/react/use-render",
    card: "@base-ui/react/use-render",
    menu: "@base-ui/react/menu",
    tabs: "@base-ui/react/tabs",
    toast: "@base-ui/react/toast",
    command: "@base-ui/react/autocomplete",
    pagination: "@base-ui/react/use-render",
  };
  for (const [name, dependency] of Object.entries(primitives)) assert.match(read(`src/components/ui/${name}.tsx`), new RegExp(dependency.replaceAll("/", "\\/")));
  assert.match(read("src/components/ui/status-banner.tsx"), /from "\.\/alert"/);
  assert.doesNotMatch(read("src/components/ui/input.tsx"), /function Textarea/);
  assert.match(read("src/main.tsx"), /<ToastProvider>/);
  const repositoryCard = read("src/features/repositories/repository-card.tsx");
  const discover = read("src/features/discover/discover-page.tsx");
  const releases = read("src/features/releases/releases-page.tsx");
  const forks = read("src/features/forks/forks-page.tsx");
  assert.match(repositoryCard, /<Card/);
  assert.match(discover, /<Card/);
  assert.match(releases, /<Pagination/);
  assert.match(forks, /<Pagination/);
});
