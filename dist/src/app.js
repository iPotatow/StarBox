import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/app-shell.js";
import { Skeleton } from "./components/ui/skeleton.js";
import { ActivityPage } from "./features/activity/activity-page.js";
import { LoginPage } from "./features/auth/login-page.js";
import { DiscoverPage } from "./features/discover/discover-page.js";
import { ForksPage } from "./features/forks/forks-page.js";
import { ListsPage } from "./features/lists/lists-page.js";
import { NotificationsPage } from "./features/notifications/notifications-page.js";
import { ReleasesPage } from "./features/releases/releases-page.js";
import { RepositoriesPage } from "./features/repositories/repositories-page.js";
import { SettingsPage } from "./features/settings/settings-page.js";
import { ApiError, fetchAuthSession, fetchBootstrap, fetchDataChanges, fetchStarredRepositories, logout } from "./lib/api.js";
import { loadCachedState, loadState, saveState } from "./lib/storage.js";
function pageFromLocation() {
    if (window.location.pathname.startsWith("/releases"))
        return "releases";
    if (window.location.pathname.startsWith("/forks"))
        return "forks";
    if (window.location.pathname.startsWith("/lists"))
        return "lists";
    if (window.location.pathname.startsWith("/discover"))
        return "discover";
    if (window.location.pathname.startsWith("/activity"))
        return "activity";
    if (window.location.pathname.startsWith("/notifications"))
        return "notifications";
    if (window.location.pathname.startsWith("/settings"))
        return "settings";
    return "repositories";
}
const pagePath = {
    repositories: "/", releases: "/releases", forks: "/forks", lists: "/lists", discover: "/discover", activity: "/activity", notifications: "/notifications", settings: "/settings",
};
function testSession() {
    return window.__STARBOX_TEST_SESSION__ ?? null;
}
function mergeServerState(current, result) {
    const credential = result.githubCredential;
    const settings = { ...current.settings, ...(result.state?.settings ?? {}), ...result.delta?.settings, ...(credential ? { credentialConnected: credential.connected, githubIdentity: credential.login ? { login: credential.login, id: credential.githubUserId, avatarUrl: credential.avatarUrl } : null } : {}) };
    if (result.authoritative && result.state)
        return { ...result.state, version: 5, settings };
    if (result.state)
        return { ...current, ...result.state, version: 5, settings };
    if (result.delta)
        return { ...current, ...result.delta, settings };
    return current;
}
export default function App() {
    const [page, setPage] = useState(pageFromLocation);
    const [state, setState] = useState(loadState);
    const [auth, setAuth] = useState(() => { const session = testSession(); return session ? { status: "authenticated", session } : { status: "checking", session: null }; });
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState("");
    const [syncSuccess, setSyncSuccess] = useState("");
    const [bootstrapping, setBootstrapping] = useState(false);
    useEffect(() => {
        let active = true;
        void Promise.resolve().then(() => fetchAuthSession()).then((session) => { if (active)
            setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session }); }).catch((reason) => {
            if (!active)
                return;
            const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
            setAuth({ status, session: null, error: status === "unavailable" ? "登录服务暂不可用，请检查 Worker 部署后重试。" : undefined });
        });
        return () => { active = false; };
    }, []);
    useEffect(() => { if (auth.status === "authenticated")
        saveState(state); }, [auth.status, state]);
    useEffect(() => {
        let active = true;
        void loadCachedState().then((cached) => { if (active && cached)
            setState((current) => ({ ...cached, settings: { ...current.settings, ...cached.settings } })); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (auth.status !== "authenticated")
            return;
        let active = true;
        setBootstrapping(true);
        void fetchBootstrap().then((result) => { const nextSeq = Number(result.lastSeq ?? result.revision ?? 0); if (active)
            setState((current) => ({ ...mergeServerState(current, result), lastSeq: nextSeq || current.lastSeq || 0, lastBootstrapAt: new Date().toISOString() })); return nextSeq; }).then((nextSeq) => fetchDataChanges(nextSeq)).then(async (changes) => { if (!active)
            return; if (changes.changes.length) {
            const refreshed = await fetchBootstrap();
            if (active)
                setState((current) => ({ ...mergeServerState(current, refreshed), lastSeq: Number(refreshed.lastSeq ?? changes.lastSeq ?? current.lastSeq ?? 0), lastBootstrapAt: new Date().toISOString() }));
        }
        else if (changes.lastSeq !== undefined)
            setState((current) => ({ ...current, lastSeq: changes.lastSeq })); }).catch((reason) => { if (active)
            setSyncError(reason instanceof Error ? `云端数据暂不可用：${reason.message}。当前继续使用本地缓存。` : "云端数据暂不可用，当前继续使用本地缓存。"); }).finally(() => { if (active)
            setBootstrapping(false); });
        return () => { active = false; };
    }, [auth.status]);
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const apply = () => { const dark = state.settings.theme === "dark" || (state.settings.theme === "system" && media.matches); document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.density = state.settings.density; document.documentElement.dataset.accent = state.settings.accent; };
        apply();
        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, [state.settings.theme, state.settings.density, state.settings.accent]);
    useEffect(() => { const onPopState = () => setPage(pageFromLocation()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
    const unreadNotifications = useMemo(() => state.notifications.filter((item) => !item.read).length, [state.notifications]);
    function navigate(next) { setPage(next); const path = pagePath[next]; if (window.location.pathname !== path)
        window.history.pushState(null, "", path); }
    function onAuthenticated(session) { setAuth({ status: "authenticated", session }); }
    async function onLogout() { try {
        await logout();
    }
    catch { /* local logout still clears the UI session when the backend is unavailable. */ } setAuth({ status: "logged-out", session: null }); }
    async function syncStars() {
        if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) {
            setSyncError("请先在设置中连接 GitHub 凭据");
            navigate("settings");
            return;
        }
        setSyncing(true);
        setSyncError("");
        setSyncSuccess("");
        try {
            const repositories = await fetchStarredRepositories(state.settings.githubToken.trim());
            setState((current) => ({ ...current, repositories, lastSyncAt: new Date().toISOString() }));
            setSyncSuccess(`同步完成：${repositories.length} 个 Stars`);
        }
        catch (error) {
            setSyncError(error instanceof Error ? `${error.message}。可检查 GitHub 凭据或稍后重试。` : "同步失败，请稍后重试");
        }
        finally {
            setSyncing(false);
        }
    }
    if (auth.status === "checking")
        return _jsxs("div", { className: "mx-auto grid min-h-screen w-full max-w-7xl content-center gap-4 px-6", children: [_jsx(Skeleton, { className: "h-8 w-40" }), _jsx(Skeleton, { className: "h-11 w-full" }), _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }, (_, index) => _jsx(Skeleton, { className: "h-56 w-full rounded-xl" }, index)) })] });
    if (auth.status !== "authenticated")
        return _jsxs(_Fragment, { children: [_jsx(LoginPage, { onAuthenticated: onAuthenticated }), auth.error ? _jsx("div", { className: "fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl bg-destructive/10 p-3 text-sm text-destructive-foreground", role: "alert", children: auth.error }) : null] });
    const initialLoading = bootstrapping && !state.lastBootstrapAt;
    return _jsxs(AppShell, { page: page, settings: state.settings, session: auth.session, unreadNotifications: unreadNotifications, onPageChange: navigate, children: [syncError ? _jsx("div", { className: "mx-4 mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground", role: "status", children: syncError }) : null, page === "repositories" ? _jsx(RepositoriesPage, { state: state, onStateChange: setState, onSync: () => void syncStars(), syncing: syncing, syncError: syncError, syncSuccess: syncSuccess, goToSettings: () => navigate("settings"), loading: initialLoading })
                : page === "releases" ? _jsx(ReleasesPage, { state: state, onStateChange: setState, goToSettings: () => navigate("settings"), goToStars: () => navigate("repositories"), initialLoading: initialLoading })
                    : page === "forks" ? _jsx(ForksPage, { state: state, onStateChange: setState, goToSettings: () => navigate("settings"), initialLoading: initialLoading })
                        : page === "lists" ? _jsx(ListsPage, { state: state, onStateChange: setState, goToSettings: () => navigate("settings"), initialLoading: initialLoading })
                            : page === "discover" ? _jsx(DiscoverPage, { state: state, onStateChange: setState, goToSettings: () => navigate("settings"), initialLoading: initialLoading })
                                : page === "activity" ? _jsx(ActivityPage, { state: state, onStateChange: setState, initialLoading: initialLoading })
                                    : page === "notifications" ? _jsx(NotificationsPage, { state: state, onStateChange: setState, initialLoading: initialLoading })
                                        : _jsx(SettingsPage, { state: state, onStateChange: setState, session: auth.session, onLogout: () => void onLogout(), initialLoading: initialLoading })] });
}
