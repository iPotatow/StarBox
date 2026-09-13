import { useEffect, useMemo, useState } from "react";
import { AppShell, type AppPage } from "./components/app-shell";
import { Skeleton } from "./components/ui/skeleton";
import { notify } from "./components/ui/toast";
import { LoginPage } from "./features/auth/login-page";
import { DiscoverPage } from "./features/discover/discover-page";
import { ForksPage } from "./features/forks/forks-page";
import { ListsPage } from "./features/lists/lists-page";
import { NotificationsPage } from "./features/notifications/notifications-page";
import { ReleasesPage } from "./features/releases/releases-page";
import { RepositoriesPage } from "./features/repositories/repositories-page";
import { SettingsPage } from "./features/settings/settings-page";
import { ApiError, fetchAuthSession, fetchBootstrap, fetchDataChanges, fetchStarredRepositories, logout } from "./lib/api";
import { loadCachedState, loadState, mergeCanonicalServerState, mergeStarredRepositories, saveState } from "./lib/storage";
import { currentRelativeUrl } from "./lib/url-state";
import type { AuthSession, PersistedState } from "./types";

type AuthView = { status: "checking" | "authenticated" | "logged-out" | "unavailable"; session: AuthSession | null; error?: string };

function pageFromLocation(): AppPage {
  if (window.location.pathname.startsWith("/releases")) return "releases";
  if (window.location.pathname.startsWith("/forks")) return "forks";
  if (window.location.pathname.startsWith("/lists")) return "lists";
  if (window.location.pathname.startsWith("/discover")) return "discover";
  if (window.location.pathname.startsWith("/notifications")) return "notifications";
  if (window.location.pathname.startsWith("/settings")) return "settings";
  return "repositories";
}

const pagePath: Record<AppPage, string> = {
  repositories: "/", releases: "/releases", forks: "/forks", lists: "/lists", discover: "/discover", notifications: "/notifications", settings: "/settings",
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

export default function App() {
  const [page, setPage] = useState<AppPage>(pageFromLocation);
  const [state, setState] = useState<PersistedState>(loadState);
  const [auth, setAuth] = useState<AuthView>(() => { const session = testSession(); return session ? { status: "authenticated", session } : { status: "checking", session: null }; });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => fetchAuthSession()).then((session) => { if (active) setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session }); }).catch((reason: unknown) => {
      if (!active) return;
      const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
      setAuth({ status, session: null, error: status === "unavailable" ? "登录服务暂不可用，请检查 Worker 部署后重试。" : undefined });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (auth.status === "authenticated") saveState(state); }, [auth.status, state]);
  useEffect(() => {
    let active = true;
    void loadCachedState().then((cached) => { if (active && cached) setState((current) => ({ ...cached, settings: { ...current.settings, ...cached.settings } })); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true; setBootstrapping(true);
    void fetchBootstrap().then((result) => { const nextSeq = Number(result.lastSeq ?? result.revision ?? 0); if (active) setState((current) => ({ ...mergeServerState(current, result), lastSeq: nextSeq || current.lastSeq || 0, lastBootstrapAt: new Date().toISOString() })); return nextSeq; }).then((nextSeq) => fetchDataChanges(nextSeq)).then(async (changes) => { if (!active) return; if (changes.changes.length) { const refreshed = await fetchBootstrap(); if (active) setState((current) => ({ ...mergeServerState(current, refreshed), lastSeq: Number(refreshed.lastSeq ?? changes.lastSeq ?? current.lastSeq ?? 0), lastBootstrapAt: new Date().toISOString() })); } else if (changes.lastSeq !== undefined) setState((current) => ({ ...current, lastSeq: changes.lastSeq })); }).catch((reason: unknown) => { if (active) setSyncError(reason instanceof Error ? `云端数据暂不可用：${reason.message}。当前继续使用本地缓存。` : "云端数据暂不可用，当前继续使用本地缓存。"); }).finally(() => { if (active) setBootstrapping(false); });
    return () => { active = false; };
  }, [auth.status]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const dark = state.settings.theme === "dark" || (state.settings.theme === "system" && media.matches); document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.density = state.settings.density; document.documentElement.dataset.accent = state.settings.accent; };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [state.settings.theme, state.settings.density, state.settings.accent]);
  useEffect(() => { const onPopState = () => setPage(pageFromLocation()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);

  const unreadNotifications = useMemo(() => state.notifications.filter((item) => !item.read).length, [state.notifications]);
  function navigate(next: AppPage) { setPage(next); const path = pagePath[next]; if (window.location.pathname !== path) window.history.pushState(null, "", path); }
  function navigatePath(path: string) { window.history.pushState(null, "", path || "/"); setPage(pageFromLocation()); }
  function navigateSettings(tab = "account", returnTo = "") { const params = new URLSearchParams(); if (tab && tab !== "account") params.set("tab", tab); if (returnTo) params.set("returnTo", returnTo); const url = `/settings${params.toString() ? `?${params}` : ""}`; window.history.pushState(null, "", url); setPage("settings"); }
  function onAuthenticated(session: AuthSession) { setAuth({ status: "authenticated", session }); }
  async function onLogout() { try { await logout(); } catch { /* local logout still clears the UI session when the backend is unavailable. */ } setAuth({ status: "logged-out", session: null }); }
  async function syncStars() {
    if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) { setSyncError("请先在设置中连接 GitHub 凭据"); navigateSettings("account", currentRelativeUrl()); return; }
    setSyncing(true); setSyncError(""); setSyncSuccess(""); setSyncWarning("");
    try {
      const { repositories, partial } = await fetchStarredRepositories(state.settings.githubToken.trim());
      setState((current) => ({ ...current, repositories: partial ? mergeStarredRepositories(current.repositories, repositories) : repositories, lastSyncAt: new Date().toISOString() }));
      if (partial) setSyncWarning(`部分同步：GitHub 此次仅读取前 3000 个 Stars（分页上限）。本次读取到 ${repositories.length} 个；未返回的仓库保留在本地，未执行删除。`);
      else { setSyncSuccess(""); notify("Stars 同步完成", `${repositories.length} 个仓库`, "success"); }
    }
    catch (error) { setSyncError(error instanceof Error ? `${error.message}。可检查 GitHub 凭据或稍后重试。` : "同步失败，请稍后重试"); }
    finally { setSyncing(false); }
  }

  if (auth.status === "checking") return <div className="mx-auto grid min-h-screen w-full max-w-7xl content-center gap-4 px-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-11 w-full" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-56 w-full rounded-xl" />)}</div></div>;
  if (auth.status !== "authenticated") return <><LoginPage onAuthenticated={onAuthenticated} />{auth.error ? <div className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl bg-destructive/10 p-3 text-sm text-destructive-foreground" role="alert">{auth.error}</div> : null}</>;

  const initialLoading = bootstrapping && !state.lastBootstrapAt;

  return <AppShell page={page} settings={state.settings} session={auth.session} unreadNotifications={unreadNotifications} onPageChange={navigate}>
    {page === "repositories" ? <RepositoriesPage state={state} onStateChange={setState} onSync={() => void syncStars()} syncing={syncing} syncError={syncError} syncWarning={syncWarning} syncSuccess={syncSuccess} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} loading={initialLoading} />
      : page === "releases" ? <ReleasesPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} goToStars={() => navigate("repositories")} initialLoading={initialLoading} />
      : page === "forks" ? <ForksPage state={state} onStateChange={setState} goToSettings={(tab) => navigateSettings(tab || "account", currentRelativeUrl())} initialLoading={initialLoading} />
      : page === "lists" ? <ListsPage state={state} onStateChange={setState} goToSettings={() => navigateSettings("account", currentRelativeUrl())} initialLoading={initialLoading} />
      : page === "discover" ? <DiscoverPage state={state} onStateChange={setState} goToSettings={() => navigateSettings("account", currentRelativeUrl())} initialLoading={initialLoading} />
      : page === "notifications" ? <NotificationsPage state={state} onStateChange={setState} initialLoading={initialLoading} />
      : <SettingsPage state={state} onStateChange={setState} session={auth.session} onLogout={() => void onLogout()} onNavigatePath={navigatePath} initialLoading={initialLoading} />}
  </AppShell>;
}
