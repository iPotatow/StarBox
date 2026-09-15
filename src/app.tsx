import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type AppPage } from "./components/app-shell";
import { Skeleton } from "./components/ui/skeleton";
import { notify } from "./components/ui/toast";
import { LoginPage } from "./features/auth/login-page";
import { DiscoverPage } from "./features/discover/discover-page";
import { ForksPage } from "./features/forks/forks-page";
import { ReleasesPage } from "./features/releases/releases-page";
import { RepositoriesPage } from "./features/repositories/repositories-page";
import { SettingsPage } from "./features/settings/settings-page";
import { ApiError, fetchAiServices, fetchAuthSession, fetchBootstrap, fetchDataChanges, fetchStarredRepositories, logout, saveAiConfig } from "./lib/api";
import { loadCachedState, loadState, mergeCanonicalServerState, mergeStarredRepositories, saveState } from "./lib/storage";
import { currentRelativeUrl } from "./lib/url-state";
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

function mergeServerState(current: PersistedState, result: Awaited<ReturnType<typeof fetchBootstrap>>) {
  let merged = current;
  if (result.authoritative && result.state) merged = mergeCanonicalServerState(current, result.state);
  else if (result.state) merged = mergeCanonicalServerState(current, result.state);
  if (result.delta) merged = mergeCanonicalServerState(merged, result.delta as Partial<PersistedState>);
  const credential = result.githubCredential;
  return { ...merged, settings: { ...merged.settings, credentialConnected: credential.connected, githubIdentity: credential.login ? { login: credential.login, id: credential.githubUserId, avatarUrl: credential.avatarUrl } : null } };
}

function mergeAiServiceState(current: PersistedState, services: Awaited<ReturnType<typeof fetchAiServices>>) {
  if (!services.services.length) return current;
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
  const t = (zh: string, en: string) => state.settings.language === "en" ? en : zh;
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

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => fetchAuthSession()).then((session) => { if (active) setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session }); }).catch((reason: unknown) => {
      if (!active) return;
      const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
      setAuth({ status, session: null, error: status === "unavailable" ? t("登录服务暂不可用，请稍后重试。", "Login service is temporarily unavailable. Try again later.") : undefined });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    void fetchAiServices().then((services) => {
      if (active) setState((current) => mergeAiServiceState(current, services));
    }).catch(() => { /* Keep cached/legacy AI state when the service registry is temporarily unavailable. */ });
    return () => { active = false; };
  }, [auth.status, page, state.lastBootstrapAt]);

  useEffect(() => { if (auth.status === "authenticated") saveState(state); }, [auth.status, state]);
  useEffect(() => { document.documentElement.lang = state.settings.language; }, [state.settings.language]);
  useEffect(() => {
    if (auth.status !== "authenticated" || !state.settings.ai.apiKey || state.settings.ai.credentialConfigured) return;
    let active = true;
    void saveAiConfig(state.settings.ai).then((saved) => { if (!active) return; setState((current) => ({ ...current, settings: { ...current.settings, ai: { providerName: saved.providerName, baseUrl: saved.baseUrl, model: saved.model, credentialConfigured: saved.credentialConfigured, apiKey: "", headers: {} } } })); notify(t("AI 服务已安全迁移", "AI service migrated securely"), t("旧凭据已从此设备清除", "Legacy credentials were removed from this device"), "success"); }).catch(() => { /* Preserve the legacy secret until a later migration succeeds. */ });
    return () => { active = false; };
  }, [auth.status, state.settings.ai.apiKey, state.settings.ai.credentialConfigured]);
  useEffect(() => {
    let active = true;
    const generation = ++cacheLoadGeneration.current;
    void loadCachedState().then((cached) => {
      if (!active || !cached || canonicalGeneration.current > 0 || generation !== cacheLoadGeneration.current) return;
      setState((current) => ({ ...cached, settings: { ...current.settings, ...cached.settings } }));
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true; setBootstrapping(true);
    void fetchBootstrap()
      .then((result) => {
        const nextSeq = Number(result.lastSeq ?? result.revision ?? 0);
        if (active) {
          canonicalGeneration.current += 1;
          setState((current) => ({ ...mergeServerState(current, result), lastSeq: nextSeq || current.lastSeq || 0, lastBootstrapAt: new Date().toISOString() }));
        }
        return nextSeq;
      })
      .then((nextSeq) => fetchDataChanges(nextSeq))
      .then(async (changes) => {
        if (!active) return;
        if (changes.changes.length) {
          const refreshed = await fetchBootstrap();
          if (active) {
            canonicalGeneration.current += 1;
            setState((current) => ({ ...mergeServerState(current, refreshed), lastSeq: Number(refreshed.lastSeq ?? changes.lastSeq ?? current.lastSeq ?? 0), lastBootstrapAt: new Date().toISOString() }));
          }
        } else if (changes.lastSeq !== undefined) setState((current) => ({ ...current, lastSeq: changes.lastSeq }));
      })
      .catch((reason: unknown) => { if (active) setSyncError(reason instanceof Error ? t(`云端数据暂不可用：${reason.message}。当前继续使用本地缓存。`, `Cloud data is temporarily unavailable: ${reason.message}. Using local cache.`) : t("云端数据暂不可用，当前继续使用本地缓存。", "Cloud data is temporarily unavailable. Using local cache.")); })
      .finally(() => { if (active) setBootstrapping(false); });
    return () => { active = false; };
  }, [auth.status]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const dark = state.settings.theme === "dark" || (state.settings.theme === "system" && media.matches); document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.density = state.settings.density; document.documentElement.dataset.accent = state.settings.accent; };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [state.settings.theme, state.settings.density, state.settings.accent]);
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
      const search = document.querySelector<HTMLInputElement>("[data-search-shortcut='true']");
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
      setAuth({ status, session: null, error: status === "unavailable" ? t("登录服务暂不可用，请稍后重试。", "Login service is temporarily unavailable. Try again later.") : undefined });
    } finally {
      setAuthRetrying(false);
    }
  }
  async function onLogout() {
    try {
      await logout();
      setAuth({ status: "logged-out", session: null });
    } catch (reason) {
      notify(t("退出登录失败", "Sign out failed"), reason instanceof Error ? reason.message : t("服务端会话仍可能有效，请重试。", "The server session may still be active. Try again."), "error");
    }
  }
  async function syncStars() {
    if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) { setSyncError(t("请先在设置中连接 GitHub 凭据", "Connect GitHub credentials in Settings first")); navigateSettings("account", currentRelativeUrl()); return; }
    setSyncing(true); setSyncError(""); setSyncSuccess(""); setSyncWarning("");
    try {
      const { repositories, partial } = await fetchStarredRepositories(state.settings.githubToken.trim());
      setState((current) => ({ ...current, repositories: partial ? mergeStarredRepositories(current.repositories, repositories) : repositories, lastSyncAt: new Date().toISOString() }));
      if (partial) setSyncWarning(t(`部分同步：GitHub 此次仅读取前 3000 个 Stars（分页上限）。本次读取到 ${repositories.length} 个；未返回的仓库保留在本地，未执行删除。`, `Partial sync: GitHub returned only the first 3000 Stars (pagination limit). Loaded ${repositories.length}; repositories not returned were kept locally and not deleted.`));
      else { setSyncSuccess(""); notify(t("Stars 同步完成", "Stars sync complete"), t(`${repositories.length} 个仓库`, `${repositories.length} repositories`), "success"); }
    }
    catch (error) { setSyncError(error instanceof Error ? t(`${error.message}。可检查 GitHub 凭据或稍后重试。`, `${error.message}. Check your GitHub credentials or try again later.`) : t("同步失败，请稍后重试", "Sync failed. Try again later.")); }
    finally { setSyncing(false); }
  }

  if (auth.status === "checking") return <I18nProvider language={state.settings.language}><div className="mx-auto grid min-h-screen w-full max-w-7xl content-center gap-4 px-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-11 w-full" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-56 w-full rounded-xl" />)}</div></div></I18nProvider>;
  if (auth.status !== "authenticated") return <I18nProvider language={state.settings.language}><LoginPage onAuthenticated={onAuthenticated} serviceError={auth.status === "unavailable" ? auth.error : ""} onRetryService={() => void retryAuthService()} retryingService={authRetrying} /></I18nProvider>;

  const initialLoading = bootstrapping && !state.lastBootstrapAt;

  return <I18nProvider language={state.settings.language}><AppShell page={page} settings={state.settings} session={auth.session} onPageChange={navigate}>
    {page === "repositories" ? <RepositoriesPage state={state} onStateChange={setState} onSync={() => void syncStars()} syncing={syncing} syncError={syncError} syncWarning={syncWarning} syncSuccess={syncSuccess} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} loading={initialLoading} />
      : page === "releases" ? <ReleasesPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} goToStars={() => navigate("repositories")} initialLoading={initialLoading} />
      : page === "forks" ? <ForksPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} initialLoading={initialLoading} />
      : page === "discover" ? <DiscoverPage state={state} onStateChange={setState} goToSettings={() => navigateSettings("account", currentRelativeUrl())} initialLoading={initialLoading} />
      : <SettingsPage state={state} onStateChange={setState} session={auth.session} onLogout={() => void onLogout()} onNavigatePath={navigatePath} initialLoading={initialLoading} />}
  </AppShell></I18nProvider>;
}
