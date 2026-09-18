import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) { return readFileSync(path, "utf8"); }

test("UI exposes the redesigned StarBox workflow set", () => {
  const repos = read("src/features/repositories/repositories-page.tsx");
  const card = read("src/features/repositories/repository-card.tsx");
  const detail = read("src/features/repositories/repository-detail.tsx");
  const releases = read("src/features/releases/releases-page.tsx");
  const forks = read("src/features/forks/forks-page.tsx");
  const discover = read("src/features/discover/discover-page.tsx");
  const settings = read("src/features/settings/settings-page.tsx");
  const aiSettings = read("src/features/settings/ai-services-settings.tsx");
  const deviceSettings = read("src/features/settings/login-devices-settings.tsx");
  const login = read("src/features/auth/login-page.tsx");
  assert.match(repos, /星标时间/); assert.match(repos, /活跃时间/); assert.match(repos, /Star 数量/); assert.match(repos, /切换为正序/); assert.match(repos, /切换为倒序/);
  assert.match(repos, /<Toolbar/); assert.doesNotMatch(repos, /starbox:ui:stars-view|ToggleGroupItem value="list"|>列表</);
  assert.match(repos, /AI 分析/); assert.match(repos, /订阅/); assert.match(repos, /rounded-\[100px\]/); assert.match(repos, /bg-primary/); assert.doesNotMatch(repos, /配置 AI|分类管理|Star 仓库|批量 Star/);
  assert.doesNotMatch(card, /onFork|createFork|ForkDialog|forks_count|repository\.license/); assert.match(card, /absolute right-4 top-4/); assert.match(card, /aria-label=\{t\("仓库操作", "Repository actions"\)\}/); assert.match(card, /justify-start/); assert.match(card, /githubLanguageColor/); assert.doesNotMatch(card, /Pushpin|置顶|RiStarFill/);
  assert.match(detail, /README/); assert.match(detail, /DeepWiki/); assert.match(detail, /Zread/); assert.match(detail, /max-w-6xl/); assert.match(detail, /imageBaseUrl/);
  assert.match(releases, /正在关注/); assert.match(releases, /全部版本/); assert.match(releases, /仅稳定版/); assert.match(releases, /每仓库最新稳定版/); assert.match(releases, /全部订阅仓库/); assert.match(releases, /时间线/); assert.match(releases, /按仓库/); assert.match(releases, /Assets/); assert.doesNotMatch(releases, /Asset 快速过滤|Asset Filter 设置/); assert.match(releases, /AI 总结/); assert.doesNotMatch(releases, /已读|未读|readFilter|markRead/);
  assert.doesNotMatch(releases, /fetchWatchedRepositories|release\.subscribe|release\.unsubscribe|导入 Watching/);
  assert.match(forks, /fetchForkRepositories/); assert.match(forks, /同步上游/); assert.match(forks, /最近一次 Action/); assert.match(forks, /运行 GitHub Workflow/); assert.match(forks, /全部 Actions/); assert.doesNotMatch(forks, /已读|未读|forkReadAt|markForkReadState/);
  assert.doesNotMatch(forks, /ForkDialog|createFork|fork\.create/);
  assert.equal(existsSync("src/features/lists/lists-page.tsx"), false); assert.equal(existsSync("src/features/notifications/notifications-page.tsx"), false); assert.doesNotMatch(repos, /GitHub 列表|管理列表|listFilter/);
  assert.match(discover, /搜索 GitHub/);
  for (const label of ["账户与 GitHub", "AI", "分类", "外观", "导航", "数据"]) assert.match(settings, new RegExp(label));
  assert.match(settings, /CategorySettingsPanel/); assert.match(settings, /获取范围/); assert.match(settings, /AiServicesSettings/); assert.match(settings, /LoginDevicesSettings/); assert.match(aiSettings, /服务名称/); assert.match(aiSettings, /OpenAI Compatible/); assert.match(deviceSettings, /退出其他设备/);
  assert.doesNotMatch(read("src/app.tsx"), /NotificationsPage|page === "notifications"|page === "lists"/); assert.match(login, /登录 StarBox/); assert.match(login, /<InputGroup>/); assert.match(login, /InputGroupAddon align="inline-end"/); assert.match(discover, /<AlertDialog open=\{Boolean\(unstarTarget\)\}/); assert.doesNotMatch(read("src/app.tsx"), /ActivityPage|\/activity/);
});

test("GitHub Lists are removed and UI language is device-owned", () => {
  const app = read("src/app.tsx");
  const api = read("src/lib/api.ts");
  const worker = read("worker/index.ts");
  const repository = read("worker/repository.ts");
  const settings = read("src/features/settings/settings-page.tsx");
  const storage = read("src/lib/storage.ts");
  assert.equal(existsSync("src/features/lists/lists-page.tsx"), false);
  assert.doesNotMatch(api, /\/api\/github\/lists|GithubStarList|githubLists/);
  assert.doesNotMatch(worker, /\/api\/github\/lists|handleLists|handleListMembership/);
  assert.doesNotMatch(repository, /replaceListsSnapshot|saveList|saveMembership|github_lists|github_list_memberships/);
  assert.match(read("migrations/0006_remove_github_lists.sql"), /DROP TABLE IF EXISTS github_list_memberships[\s\S]*DROP TABLE IF EXISTS github_lists/);
  assert.match(storage, /language:\s*"zh-CN"/);
  assert.match(settings, /ToggleGroupItem value="zh-CN"/);
  assert.match(settings, /ToggleGroupItem value="en"/);
  assert.match(app, /I18nProvider/);
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
  assert.match(storage, /language:\s*"zh-CN"/);
  assert.match(storage, /notifications:\s*\[\]/);
  assert.match(storage, /navOrder/);
  for (const store of ["meta", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "forks", "notifications"]) assert.match(storage, new RegExp(`\\"${store}\\"`));
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
  assert.doesNotMatch(api, /\/api\/activity/);
  assert.match(api, /\/api\/forks\/workflows\/dispatch/); assert.match(api, /\/api\/ai\/release-summary/);
  assert.match(api, /\/api\/notifications/);
  assert.match(app, /fetchAuthSession/);
  assert.match(app, /loadCachedState/);
  assert.match(app, /fetchBootstrap/);
  assert.match(app, /LoginPage/);
});

test("cloud credential requests support hydrated credentials and JSON mutation contracts", () => {
  const api = read("src/lib/api.ts");
  const settings = read("src/features/settings/settings-page.tsx");
  const pages = ["repositories", "releases", "forks", "discover", "repository-detail"].map((name) => read(name === "repository-detail" ? "src/features/repositories/repository-detail.tsx" : `src/features/${name}/${name}-page.tsx`)).join("\n");
  assert.match(api, /method !== "GET"/);
  assert.match(api, /headers\.set\("content-type", "application\/json"\)/);
  assert.match(api, /body: "\{\}"/);
  assert.match(api, /fetchDataChanges/);
  assert.match(api, /\/api\/data\/changes/);
  assert.match(api, /commitCanonicalMutation/);
  assert.doesNotMatch(api, /\/api\/migration\//);
  assert.doesNotMatch(settings, /v4|迁移到云端|beginMigration|uploadMigrationChunk|verifyMigration|completeMigration/);
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
  for (const key of ["account", "githubCredential", "repositories", "repositoryMeta", "categories", "releaseSubscriptions", "releases", "forks", "notifications", "revision", "lastSeq"]) assert.match(api, new RegExp(`${key}`));
  for (const key of ["full_name", "category_id", "repo_full_name", "published_at", "payload_json", "read_at", "created_at"]) assert.match(api, new RegExp(key));
  assert.match(api, /normalizeBootstrapPayload/);
  assert.match(api, /repositoryFullName/);
});

test("Release and Fork product surfaces contain no read-state feature", () => {
  const releases = read("src/features/releases/releases-page.tsx");
  const forks = read("src/features/forks/forks-page.tsx");
  const storage = read("src/lib/storage.ts");
  const repository = read("worker/repository.ts");
  assert.doesNotMatch(releases, /已读|未读|releaseStates|release\.read|release\.unread/);
  assert.doesNotMatch(forks, /已读|未读|forkReadAt|fork\.read/);
  assert.doesNotMatch(storage, /releaseStates|forkReadAt|markForkReadState/);
  assert.doesNotMatch(repository, /release\.read|release\.unread|fork\.read/);
});

test("bootstrap and canonical mutation share the explicit server-owned merge boundary", () => {
  const api = read("src/lib/api.ts");
  const app = read("src/app.tsx");
  assert.match(api, /mergeCanonicalServerState\(optimistic, result\.state\)/);
  assert.match(api, /mergeCanonicalServerState\(local, canonical\.state\)/);
  assert.match(app, /mergeCanonicalServerState\(current, result\.state\)/);
  assert.match(app, /mergeCanonicalServerState\(merged, result\.delta as Partial<PersistedState>\)/);
  assert.doesNotMatch(api, /return canonical\.state/);
});

test("single unstar refreshes canonical state after one authoritative delete", () => {
  const repositories = read("src/features/repositories/repositories-page.tsx");
  const api = read("src/lib/api.ts");
  const start = repositories.indexOf("async function unstar(");
  const end = repositories.indexOf("\n  async function batchUnstar", start);
  const unstar = repositories.slice(start, end);
  assert.match(repositories, /refreshCanonicalState/);
  assert.match(api, /export async function refreshCanonicalState\(local: PersistedState\)/);
  assert.match(unstar, /await unstarRepository\(state\.settings\.githubToken\.trim\(\), repo\.full_name\)/);
  assert.match(unstar, /await refreshCanonicalState\(state\)/);
  assert.ok(unstar.indexOf("await unstarRepository") < unstar.indexOf("await refreshCanonicalState"));
  assert.doesNotMatch(unstar, /commitCanonicalMutation|commitOptimisticMutation|operation:/);
});

test("authoritative business mutations cover every requested domain and preserve local-only secrets", () => {
  const sources = {
    repositories: read("src/features/repositories/repositories-page.tsx"),
    categories: read("src/features/repositories/category-manager.tsx"),
    releases: read("src/features/releases/releases-page.tsx"),
    forks: read("src/features/forks/forks-page.tsx"),
  };
  for (const source of [sources.repositories, sources.categories]) assert.match(source, /runOptimisticMutation/);
  const all = Object.values(sources).join("\n");
  for (const operation of ["category.create", "category.update", "category.delete", "category.reorder", "repository_meta.update", "repository_meta.batch_category", "repository_meta.ai", "release.subscribe", "release.unsubscribe", "release.subscribe.batch"]) assert.match(all, new RegExp(operation.replace(".", "\\.")));
  for (const forbidden of ["fork.create", "fork.remove", "fork.retry"]) assert.doesNotMatch(all, new RegExp(forbidden.replace(".", "\\.")));
  assert.doesNotMatch(sources.forks, /runOptimisticMutation|fork\.read/);
  assert.doesNotMatch(all, /release\.read|release\.unread|fork\.read|markForkReadState/);
  assert.doesNotMatch(sources.releases, /release\.subscribe|release\.unsubscribe|fetchWatchedRepositories/);
  assert.doesNotMatch(sources.repositories, /operation: "ai\./);
  assert.doesNotMatch(read("src/features/releases/releases-page.tsx"), /operation: "releaseSettings/);
});

test("category rename uses a local draft and commits on blur or Enter instead of per keystroke", () => {
  const categories = read("src/features/repositories/category-manager.tsx");
  assert.match(categories, /nameDrafts/);
  assert.match(categories, /onChange=\{\(event\) => setNameDrafts/);
  assert.match(categories, /onBlur=\{\(\) => commitName\(category\)\}/);
  assert.match(categories, /event\.key === "Enter"/);
  assert.doesNotMatch(categories, /onChange=\{\(event\) => update\(category, \{ name: event\.target\.value \}\)\}/);
});

test("AI secrets migrate to encrypted cloud storage while browser snapshots clear them after cloud configuration", () => {
  const storage = read("src/lib/storage.ts");
  assert.match(storage, /credentialConfigured \? "" : ai\.apiKey/);
  assert.match(storage, /credentialConfigured \? \{\} : ai\.headers/);
  assert.match(storage, /cacheState\(state\)/);
  assert.match(read("worker/v5.ts"), /handleAiConfig/);
  assert.match(read("worker/crypto.ts"), /encryptAiCredentials/);
  const typecheck = read("scripts/typecheck.mjs");
  assert.match(typecheck, /"@base-ui\/react"/);
  assert.match(typecheck, /@remixicon\/react/);
  assert.equal(JSON.parse(read("package.json")).version, "0.1.1");
  assert.equal(JSON.parse(read("package.json")).dependencies["@base-ui/react"], "1.8.0");
});

test("Stars uses one COSS toolbar and a single card-view contract", () => {
  const repos = read("src/features/repositories/repositories-page.tsx");
  const card = read("src/features/repositories/repository-card.tsx");
  assert.match(repos, /<Toolbar/);
  assert.match(repos, /搜索仓库、描述、标签、备注…/);
  for (const option of ['starred', '星标时间', 'active', '活跃时间', 'stars', 'Star 数量']) assert.match(repos, new RegExp(option));
  assert.doesNotMatch(repos, /StarsView|VIEW_KEY|ToggleGroupItem value="list"|>列表</);
  assert.match(repos, /md:grid-cols-2 xl:grid-cols-3/);
  assert.match(card, /absolute right-4 top-4/); assert.match(card, /aria-label=\{t\("仓库操作", "Repository actions"\)\}/); assert.match(card, /justify-start/); assert.match(card, /githubLanguageColor/); assert.doesNotMatch(card, /Pushpin|置顶|RiStarFill/);
  assert.match(repos, /fixed inset-x-0 bottom-5/); assert.match(repos, /<AlertDialog open=\{Boolean\(unstarTarget\)\}/); assert.match(repos, /a\.pushed_at \|\| a\.updated_at/);
  assert.match(repos, /setDirection/); assert.match(repos, /切换为正序/); assert.match(repos, /切换为倒序/); assert.match(repos, /direction === "desc" \? -delta : delta/);
  assert.doesNotMatch(card, /forks_count|repository\.license/);
});

test("capped Stars sync preserves omitted browser state and warns instead of implying destructive cleanup", () => {
  const api = read("src/lib/api.ts");
  const app = read("src/app.tsx");
  const storage = read("src/lib/storage.ts");
  const repositories = read("src/features/repositories/repositories-page.tsx");
  const statusBanner = read("src/components/ui/status-banner.tsx");
  const start = app.indexOf("async function syncStars()");
  const end = app.indexOf("\n  if (auth.status", start);
  const syncStars = app.slice(start, end);
  assert.match(api, /fetchStarredRepositories\(token: string\).*jsonRequest<\{ repositories: Repository\[\]; partial: boolean \}>/);
  assert.match(storage, /export function mergeStarredRepositories\(current: Repository\[\], fetched: Repository\[\]\)/);
  assert.match(syncStars, /const \{ repositories, partial \} = await fetchStarredRepositories/);
  assert.match(syncStars, /partial \? mergeStarredRepositories\(current\.repositories, repositories\) : repositories/);
  assert.match(syncStars, /lastSyncAt: new Date\(\)\.toISOString\(\)/);
  assert.match(syncStars, /setSyncWarning\(t\(`部分同步：GitHub 此次仅读取前 3000 个 Stars（分页上限）/);
  assert.match(syncStars, /未返回的仓库保留在本地，未执行删除/);
  assert.match(app, /syncWarning=\{syncWarning\}/);
  assert.match(repositories, /warning=\{!syncError && !actionError \? syncWarning : ""\}/);
  assert.match(statusBanner, /isWarning \? "warning"/);
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

test("package lock keeps cross-platform optional dependencies required by npm ci", () => {
  const lock = JSON.parse(read("package-lock.json"));
  const packages = lock.packages ?? {};
  const checkOptionalTree = (ownerPath, childPrefix) => {
    const owner = packages[ownerPath];
    assert.ok(owner, `missing lock entry: ${ownerPath}`);
    for (const [name, version] of Object.entries(owner.optionalDependencies ?? {})) {
      const childPath = `${childPrefix}${name}`;
      assert.ok(packages[childPath], `missing optional lock entry: ${childPath}`);
      assert.equal(packages[childPath].version, version, `optional lock version mismatch: ${childPath}`);
    }
  };

  checkOptionalTree("node_modules/esbuild", "node_modules/");
  checkOptionalTree("node_modules/sharp", "node_modules/");
  checkOptionalTree("node_modules/workerd", "node_modules/workerd/node_modules/");
  checkOptionalTree("node_modules/wrangler/node_modules/esbuild", "node_modules/wrangler/node_modules/");
  assert.equal(packages["node_modules/@emnapi/runtime"]?.version, "1.11.3");
  assert.equal(packages["node_modules/tslib"]?.version, "2.8.1");
  assert.equal(packages["node_modules/fsevents"]?.version, "2.3.3");
});

test("production builds are deterministic and require installed local dependencies", () => {
  const build = read("scripts/build.mjs");
  assert.match(build, /from "esbuild"/);
  assert.match(build, /from "tailwindcss"/);
  assert.match(build, /bundle:\s*true/);
  assert.match(build, /src=\"\$\{entry\}\"|src=\"\/app\.js\"/);
  assert.doesNotMatch(build, /npm root -g|esm\.sh|importmap|fallback import-map mode/);
});

test("Gist is deliberately absent from runtime routes and navigation", () => {
  assert.doesNotMatch(read("worker/index.ts"), /\/api\/gists?/i);
  assert.doesNotMatch(read("src/components/app-shell.tsx"), /\bgists?\b/i);
});

test("COSS migration uses Base UI behavior primitives instead of visual-only replicas", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@base-ui/react"], "1.8.0");
  const ui = ["button", "input", "field", "dialog", "modal", "select", "checkbox", "switch", "tooltip"].map((name) => read(`src/components/ui/${name}.tsx`)).join("\n");
  for (const primitive of ["input", "field", "dialog", "select", "checkbox", "switch", "tooltip"]) assert.match(ui, new RegExp(`@base-ui/react/${primitive}`));
  assert.match(read("src/components/ui/button.tsx"), /@base-ui\/react\/use-render/);
  assert.match(read("src/components/ui/button.tsx"), /@base-ui\/react\/merge-props/);
  assert.match(read("src/components/ui/dialog.tsx"), /DialogPrimitive\.Portal/);
  assert.match(read("src/components/ui/select.tsx"), /SelectPrimitive\.Popup/);
  const productUi = [read("src/features/repositories/repository-card.tsx"), read("src/features/repositories/repository-editor.tsx"), read("src/features/releases/releases-page.tsx"), read("src/features/forks/forks-page.tsx"), read("src/features/settings/settings-page.tsx")].join("\n");
  assert.doesNotMatch(productUi, /type="checkbox"/);
});


test("redesign COSS primitives, skeletons and unified content width are wired", () => {
  assert.match(read("src/components/ui/toolbar.tsx"), /@base-ui\/react\/toolbar/);
  assert.match(read("src/components/ui/toggle-group.tsx"), /@base-ui\/react\/toggle-group/);
  assert.match(read("src/components/ui/alert-dialog.tsx"), /@base-ui\/react\/alert-dialog/);
  const skeleton = read("src/components/ui/skeleton.tsx");
  assert.match(skeleton, /animate-skeleton/);
  assert.doesNotMatch(skeleton, /animate-pulse/);
  assert.match(read("src/components/ui/table.tsx"), /data-slot="table"/);
  const pages = ["repositories/repositories-page", "releases/releases-page", "forks/forks-page", "discover/discover-page"];
  for (const page of pages) assert.match(read(`src/features/${page}.tsx`), /max-w-7xl/);
  assert.match(read("src/features/settings/settings-page.tsx"), /max-w-7xl/); assert.equal(read("src/features/settings/settings-page.tsx").includes("lg:grid-cols-[200px_minmax"), false);
  const app = read("src/app.tsx");
  for (const page of ["RepositoriesPage", "ReleasesPage", "ForksPage", "DiscoverPage", "SettingsPage"]) assert.match(app, new RegExp(page));
  assert.doesNotMatch(app, /ListsPage|NotificationsPage/);
  assert.match(app, /initialLoading/);
});

test("COSS migration covers the full StarBox primitive contract and existing compositions", () => {
  const primitives = {
    textarea: "@base-ui/react/field",
    badge: "@base-ui/react/use-render",
    card: "@base-ui/react/use-render",
    menu: "@base-ui/react/menu",
    tabs: "@base-ui/react/tabs",
    toast: "@base-ui/react/toast",
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


test("release/fork upgrade preserves the approved stars-simplified interaction baseline", () => {
  const urlState = read("src/lib/url-state.ts");
  const repos = read("src/features/repositories/repositories-page.tsx");
  const editor = read("src/features/repositories/repository-editor.tsx");
  const detail = read("src/features/repositories/repository-detail.tsx");
  const discover = read("src/features/discover/discover-page.tsx");
  const settings = read("src/features/settings/settings-page.tsx");
  const storage = read("src/lib/storage.ts");
  const worker = read("worker/index.ts");
  const v5 = read("worker/v5.ts");
  const repository = read("worker/repository.ts");
  const allProduct = [repos, editor, detail, discover, settings, read("src/app.tsx")].join("\n");
  assert.equal(existsSync("src/features/notifications/notifications-page.tsx"), false);

  assert.match(urlState, /replaceQueryParams/);
  assert.match(repos, /全选/); assert.doesNotMatch(repos, /管理列表|GitHub 列表/);
  assert.match(repos, /setBatchUnstarOpen\(true\)/);
  assert.match(editor, /放弃修改/);
  assert.match(detail, /Overview/);
  assert.match(detail, /重试/);
  assert.match(discover, /GitHub 查询条件/);
  assert.match(discover, /在当前结果中筛选仓库/);
  assert.match(discover, /搜索 GitHub/);
  assert.match(settings, /returnTo/);
  assert.match(settings, /导入预览/);
  assert.doesNotMatch(settings, /测试规则|Test rule|API 配额|API quota|loadRateLimits|fetchGithubRateLimit/);
  assert.match(storage, /deleteDatabase\(CACHE_DB_NAME\)/);
  assert.doesNotMatch(allProduct, /window\.confirm/);
  assert.doesNotMatch(worker, /\/api\/activity/);
  assert.doesNotMatch(v5, /handleActivity/);
  assert.doesNotMatch(repository, /listActivity/);
});

test("login devices and multi AI services are wired with current built-in prompts", () => {
  const worker = read("worker/index.ts");
  const provider = read("worker/provider.ts");
  const migration = read("migrations/0007_devices_and_ai_services.sql");
  const settings = read("src/features/settings/settings-page.tsx");
  const aiSettings = read("src/features/settings/ai-services-settings.tsx");
  const deviceSettings = read("src/features/settings/login-devices-settings.tsx");
  assert.match(worker, /\/api\/auth\/devices/); assert.match(worker, /\/api\/ai\/services/); assert.match(worker, /\/api\/ai\/default-model/);
  assert.match(migration, /ALTER TABLE app_sessions ADD COLUMN device_id/); assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_services/); assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_models/); assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_task_bindings/);
  assert.match(provider, /openai-compatible/); assert.match(provider, /anthropic-messages/); assert.match(provider, /google-gemini/);
  assert.match(settings, /LoginDevicesSettings/); assert.match(settings, /AiServicesSettings/); assert.match(deviceSettings, /退出其他设备/); assert.match(aiSettings, /添加模型服务/);
  assert.match(worker, /You organize GitHub repositories into concise, practical personal-library metadata\./);
  assert.match(worker, /Return JSON only with: summary \(Chinese, <= 80 chars\), category \(Chinese, concise\)\./);
  assert.match(worker, /You summarize GitHub releases for a technical personal library\. Return useful, concise Chinese JSON only\./);
  assert.match(worker, /Return JSON only with: overview \(Chinese, <=120 chars\), highlights \(0-5 concise Chinese strings\), fixes \(0-5 concise Chinese strings\), breakingChanges \(0-4 concise Chinese strings\)\. Do not include markdown\./);
});