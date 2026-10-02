import { PageBoundary } from "./components/page-boundary";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type AppPage } from "./components/app-shell";
import { Spinner } from "./components/ui/spinner";
import { notify } from "./components/ui/toast";
import { LoginPage } from "./features/auth/login-page";
const DiscoverPage = lazy(() => import("./features/discover/discover-page").then((module) => ({ default: module.DiscoverPage })));
const ForksPage = lazy(() => import("./features/forks/forks-page").then((module) => ({ default: module.ForksPage })));
const ReleasesPage = lazy(() => import("./features/releases/releases-page").then((module) => ({ default: module.ReleasesPage })));
const RepositoriesPage = lazy(() => import("./features/repositories/repositories-page").then((module) => ({ default: module.RepositoriesPage })));
const SettingsPage = lazy(() => import("./features/settings/settings-page").then((module) => ({ default: module.SettingsPage })));
import { ApiError, fetchAiServices, fetchAuthSession, fetchBootstrap, fetchStarredRepositories, logout, saveAiConfig } from "./lib/api";
import { applyCloudPreferences, saveCloudPreferences } from "./lib/preferences";
import { loadCachedState, loadState, mergeCanonicalServerState, mergeStarredRepositories, saveState } from "./lib/storage";
import { currentRelativeUrl } from "./lib/url-state";
import { translate, type Translate } from "./lib/translate";
import { I18nProvider } from "./lib/i18n";
import type { AuthSession, PersistedState } from "./types";

type AuthView = { status: "checking" | "authenticated" | "logged-out" | "unavailable"; session: AuthSession | null; error?: string };

function pageFromLocation(): AppPage {
  if (window.location.pathname.startsWith("/releases")) return "releases";
  if (window.location.pathname.startsWith("/forks")) return "forks";
  if (window.location.pathname.startsWith("/discover")) return "discover";
  if (window.location.pathname.startsWith("/settings")) return "settings";
  return "repositories";
}

const pagePath: Record<AppPage, string> = {
  repositories: "/", releases: "/releases", forks: "/forks", discover: "/discover", settings: "/settings",
};

function testSession(): AuthSession | null {
  return (window as unknown as { __STARBOX_TEST_SESSION__?: AuthSession }).__STARBOX_TEST_SESSION__ ?? null;
}

function isSameLocalDay(value: string | null, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function mergeServerState(current: PersistedState, result: Awaited<ReturnType<typeof fetchBootstrap>>) {
  let merged = current;
  if (result.authoritative && result.state) merged = mergeCanonicalServerState(current, result.state);
  else if (result.state) merged = mergeCanonicalServerState(current, result.state);
  if (result.delta) merged = mergeCanonicalServerState(merged, result.delta as Partial<PersistedState>);
  merged = applyCloudPreferences(merged, result.appPreferences);
  const credential = result.githubCredential;
  return { ...merged, settings: { ...merged.settings, credentialConnected: credential.connected, githubIdentity: credential.login ? { login: credential.login, id: credential.githubUserId, avatarUrl: credential.avatarUrl } : null } };
}

function mergeAiServiceState(current: PersistedState, services: Awaited<ReturnType<typeof fetchAiServices>>, clearWhenEmpty = false) {
  if (!services.services.length && !clearWhenEmpty) return current;
  const selected = services.services
    .filter((service) => service.enabled)
    .flatMap((service) => service.models.filter((model) => model.enabled).map((model) => ({ service, model })))
    .find(({ model }) => model.id === services.defaultModelId);
  const ai = selected
    ? { providerName: selected.service.name, baseUrl: selected.service.baseUrl, model: selected.model.remoteModelId, credentialConfigured: selected.service.credentialConfigured, apiKey: "", headers: {} }
    : { ...current.settings.ai, model: "", credentialConfigured: false, apiKey: "", headers: {} };
  return { ...current, settings: { ...current.settings, ai } };
}

export default function App() {
  const [page, setPage] = useState<AppPage>(pageFromLocation);
  const [state, setState] = useState<PersistedState>(loadState);
  const t: Translate = (zh, en, traditional) => translate(state.settings.language, zh, en, traditional);
  const [auth, setAuth] = useState<AuthView>(() => { const session = testSession(); return session ? { status: "authenticated", session } : { status: "checking", session: null }; });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [authRetrying, setAuthRetrying] = useState(false);
  const scrollPositions = useRef<Record<string, number>>({});
  const canonicalGeneration = useRef(0);
  const cacheLoadGeneration = useRef(0);
  const dailyGithubSyncAttempted = useRef(false);
  const aiRegistry = useRef<Awaited<ReturnType<typeof fetchAiServices>> | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => fetchAuthSession()).then((session) => { if (active) setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session }); }).catch((reason: unknown) => {
      if (!active) return;
      const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
      setAuth({ status, session: null, error: status === "unavailable" ? t("登录服务暂不可用，请稍后重试。", "Login service is temporarily unavailable. Try again later.", "登入服務暫不可用，請稍後重試。") : undefined });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    aiRegistry.current = null;
    void fetchAiServices().then((services) => {
      if (active) { aiRegistry.current = services; setState((current) => mergeAiServiceState(current, services)); }
    }).catch(() => { /* Keep cached/legacy AI state when the service registry is temporarily unavailable. */ });
    return () => { active = false; };
  }, [auth.status]);

  useEffect(() => { if (auth.status === "authenticated") saveState(state); }, [auth.status, state]);
  useEffect(() => { document.documentElement.lang = state.settings.language; }, [state.settings.language]);
  useEffect(() => {
    if (auth.status !== "authenticated" || !state.settings.ai.apiKey || state.settings.ai.credentialConfigured) return;
    let active = true;
    void saveAiConfig(state.settings.ai).then((saved) => { if (!active) return; setState((current) => ({ ...current, settings: { ...current.settings, ai: { providerName: saved.providerName, baseUrl: saved.baseUrl, model: saved.model, credentialConfigured: saved.credentialConfigured, apiKey: "", headers: {} } } })); notify(t("AI 服务已安全迁移", "AI service migrated securely", "AI 服務已安全遷移"), t("旧凭据已从此设备清除", "Legacy credentials were removed from this device", "舊憑據已從此裝置清除"), "success"); }).catch(() => { /* Preserve the legacy secret until a later migration succeeds. */ });
    return () => { active = false; };
  }, [auth.status, state.settings.ai.apiKey, state.settings.ai.credentialConfigured]);
  useEffect(() => {
    let active = true;
    const generation = ++cacheLoadGeneration.current;
    void loadCachedState().then((cached) => {
      if (!active || !cached || canonicalGeneration.current > 0 || generation !== cacheLoadGeneration.current) return;
      setState((current) => { const merged = { ...cached, settings: { ...current.settings, ...cached.settings } }; return aiRegistry.current ? mergeAiServiceState(merged, aiRegistry.current) : merged; });
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true; setBootstrapping(true);
    void fetchBootstrap()
      .then((result) => {
        if (!active) return;
        canonicalGeneration.current += 1;
        setState((current) => {
          const merged = mergeServerState(current, result);
          return { ...(aiRegistry.current ? mergeAiServiceState(merged, aiRegistry.current) : merged), lastSeq: 0, lastBootstrapAt: new Date().toISOString() };
        });
      })
      .catch((reason: unknown) => { if (active) setSyncError(reason instanceof Error ? t(`云端数据暂不可用：${reason.message}。当前继续使用本地缓存。`, `Cloud data is temporarily unavailable: ${reason.message}. Using local cache.`, `雲端資料暫不可用：${reason.message}。當前繼續使用本地快取。`) : t("云端数据暂不可用，当前继续使用本地缓存。", "Cloud data is temporarily unavailable. Using local cache.", "雲端資料暫不可用，當前繼續使用本地快取。")); })
      .finally(() => { if (active) setBootstrapping(false); });
    return () => { active = false; };
  }, [auth.status]);
  useEffect(() => {
    if (auth.status !== "authenticated" || bootstrapping || canonicalGeneration.current === 0 || dailyGithubSyncAttempted.current) return;
    if (isSameLocalDay(state.lastSyncAt)) { dailyGithubSyncAttempted.current = true; return; }
    if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) return;
    dailyGithubSyncAttempted.current = true;
    void syncStars({ notifySuccess: false, redirectOnMissingCredential: false });
  }, [auth.status, bootstrapping, state.lastBootstrapAt, state.lastSyncAt, state.settings.githubToken, state.settings.credentialConnected]);
  useEffect(() => {
    if (auth.status !== "authenticated" || bootstrapping || canonicalGeneration.current === 0) return;
    const timer = window.setTimeout(() => { void saveCloudPreferences(state).catch(() => notify(t("偏好尚未同步到云端", "Preferences have not synced", "偏好尚未同步到雲端"), t("当前设备已保留设置，请检查网络后重新调整设置以重试。", "Settings are kept on this device. Check your connection and change the setting again to retry.", "當前裝置已保留設定，請檢查網路後重新調整設定以重試。"), "error")); }, 150);
    return () => window.clearTimeout(timer);
  }, [auth.status, bootstrapping, state.settings.theme, state.settings.accent, state.settings.language, state.settings.hiddenNav, state.settings.batchUnstarEnabled, state.releaseSettings.includePrereleases]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const dark = state.settings.theme === "dark" || (state.settings.theme === "system" && media.matches); document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.accent = state.settings.accent; };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [state.settings.theme, state.settings.accent]);
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      setPage(pageFromLocation());
      const key = currentRelativeUrl();
      const top = Number((event.state as { starboxScrollTop?: number } | null)?.starboxScrollTop ?? scrollPositions.current?.[key] ?? 0);
      requestAnimationFrame(() => {
        const surface = document.querySelector<HTMLElement>(".content-surface");
        if (surface) surface.scrollTop = top;
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      const search = Array.from(document.querySelectorAll<HTMLInputElement>("[data-search-shortcut='true']")).find((input) => input.getClientRects().length > 0 && !input.disabled);
      if (!search) return;
      event.preventDefault();
      search.focus();
      search.select();
    };
    window.addEventListener("keydown", onSearchShortcut);
    return () => window.removeEventListener("keydown", onSearchShortcut);
  }, [page]);

  function saveCurrentScroll() {
    const surface = document.querySelector<HTMLElement>(".content-surface");
    if (!surface) return;
    const key = currentRelativeUrl();
    const top = surface.scrollTop;
    if (scrollPositions.current) scrollPositions.current[key] = top;
    window.history.replaceState({ ...(window.history.state || {}), starboxScrollTop: top }, "", window.location.href);
  }
  function scrollMainToTop() {
    requestAnimationFrame(() => {
      const surface = document.querySelector<HTMLElement>(".content-surface");
      if (surface) surface.scrollTop = 0;
    });
  }
  function navigate(next: AppPage) {
    saveCurrentScroll();
    setPage(next);
    const path = pagePath[next];
    if (window.location.pathname !== path || window.location.search) window.history.pushState({ starboxScrollTop: 0 }, "", path);
    scrollMainToTop();
  }
  function navigatePath(path: string) {
    saveCurrentScroll();
    window.history.pushState({ starboxScrollTop: 0 }, "", path || "/");
    setPage(pageFromLocation());
    scrollMainToTop();
  }
  function navigateSettings(tab = "account", returnTo = "") {
    saveCurrentScroll();
    const params = new URLSearchParams();
    if (tab && tab !== "account") params.set("tab", tab);
    if (returnTo) params.set("returnTo", returnTo);
    const url = `/settings${params.toString() ? `?${params}` : ""}`;
    window.history.pushState({ starboxScrollTop: 0 }, "", url);
    setPage("settings");
    scrollMainToTop();
  }
  function onAuthenticated(session: AuthSession) { setAuth({ status: "authenticated", session }); }
  async function retryAuthService() {
    setAuthRetrying(true);
    try {
      const session = await fetchAuthSession();
      setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session });
    } catch (reason) {
      const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
      setAuth({ status, session: null, error: status === "unavailable" ? t("登录服务暂不可用，请稍后重试。", "Login service is temporarily unavailable. Try again later.", "登入服務暫不可用，請稍後重試。") : undefined });
    } finally {
      setAuthRetrying(false);
    }
  }
  async function onLogout() {
    try {
      await logout();
      setAuth({ status: "logged-out", session: null });
    } catch (reason) {
      notify(t("退出登录失败", "Sign out failed", "退出登入失敗"), reason instanceof Error ? reason.message : t("服务端会话仍可能有效，请重试。", "The server session may still be active. Try again.", "服務端會話仍可能有效，請重試。"), "error");
    }
  }
  async function syncStars({ notifySuccess = true, redirectOnMissingCredential = true }: { notifySuccess?: boolean; redirectOnMissingCredential?: boolean } = {}) {
    if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) {
      setSyncError(t("请先在设置中连接 GitHub 凭据", "Connect GitHub credentials in Settings first", "請先在設定中連線 GitHub 憑據"));
      if (redirectOnMissingCredential) navigateSettings("account", currentRelativeUrl());
      return;
    }
    setSyncing(true); setSyncError(""); setSyncSuccess(""); setSyncWarning("");
    try {
      const { repositories, partial } = await fetchStarredRepositories(state.settings.githubToken.trim());
      setState((current) => ({ ...current, repositories: partial ? mergeStarredRepositories(current.repositories, repositories) : repositories, lastSyncAt: new Date().toISOString() }));
      if (partial) setSyncWarning(t(`部分同步：GitHub 此次仅读取前 3000 个 Stars（分页上限）。本次读取到 ${repositories.length} 个；未返回的仓库保留在本地，未执行删除。`, `Partial sync: GitHub returned only the first 3000 Stars (pagination limit). Loaded ${repositories.length}; repositories not returned were kept locally and not deleted.`, `部分同步：GitHub 此次僅讀取前 3000 個 Stars（分頁上限）。本次讀取到 ${repositories.length} 個；未返回的儲存庫保留在本地，未執行刪除。`));
      else { setSyncSuccess(""); if (notifySuccess) notify(t("Stars 同步完成", "Stars sync complete", "Stars 同步完成"), t(`${repositories.length} 个仓库`, `${repositories.length} repositories`, `${repositories.length} 個儲存庫`), "success"); }
    }
    catch (error) { setSyncError(error instanceof Error ? t(`${error.message}。可检查 GitHub 凭据或稍后重试。`, `${error.message}. Check your GitHub credentials or try again later.`, `${error.message}。可檢查 GitHub 憑據或稍後重試。`) : t("同步失败，请稍后重试", "Sync failed. Try again later.", "同步失敗，請稍後重試")); }
    finally { setSyncing(false); }
  }

  if (auth.status === "checking") return <I18nProvider language={state.settings.language}><div className="grid min-h-screen place-items-center px-6"><div className="flex items-center gap-3 text-sm font-medium text-muted-foreground" role="status" aria-live="polite"><Spinner className="size-4" aria-hidden="true" /><span>StarBox</span></div></div></I18nProvider>;
  if (auth.status !== "authenticated") return <I18nProvider language={state.settings.language}><LoginPage onAuthenticated={onAuthenticated} serviceError={auth.status === "unavailable" ? auth.error : ""} onRetryService={() => void retryAuthService()} retryingService={authRetrying} /></I18nProvider>;

  const initialLoading = bootstrapping && !state.lastBootstrapAt;

  return <I18nProvider language={state.settings.language}><AppShell page={page} settings={state.settings} session={auth.session} onPageChange={navigate} onLanguageChange={(language) => setState((current) => ({ ...current, settings: { ...current.settings, language } }))} onThemeChange={(theme) => setState((current) => ({ ...current, settings: { ...current.settings, theme } }))}>
    <PageBoundary key={page}><Suspense fallback={<div className="grid min-h-48 place-items-center" role="status" aria-label={t("正在加载页面", "Loading page", "正在載入頁面")}><Spinner className="size-5" /></div>}>{page === "repositories" ? <RepositoriesPage state={state} onStateChange={setState} onSync={() => void syncStars()} syncing={syncing} syncError={syncError} syncWarning={syncWarning} syncSuccess={syncSuccess} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} loading={initialLoading} />
      : page === "releases" ? <ReleasesPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} goToStars={() => navigate("repositories")} initialLoading={initialLoading} bootstrapPending={bootstrapping} />
      : page === "forks" ? <ForksPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} initialLoading={initialLoading} bootstrapPending={bootstrapping} />
      : page === "discover" ? <DiscoverPage state={state} onStateChange={setState} goToSettings={() => navigateSettings("account", currentRelativeUrl())} initialLoading={initialLoading} />
      : <SettingsPage state={state} onStateChange={setState} onAiServicesChange={(services) => { aiRegistry.current = services; setState((current) => mergeAiServiceState(current, services, true)); }} session={auth.session} onLogout={() => void onLogout()} onNavigatePath={navigatePath} initialLoading={initialLoading} />}</Suspense></PageBoundary>
  </AppShell></I18nProvider>;
}
