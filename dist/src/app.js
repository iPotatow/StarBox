import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/app-shell.js";
import { Skeleton } from "./components/ui/skeleton.js";
import { notify } from "./components/ui/toast.js";
import { LoginPage } from "./features/auth/login-page.js";
import { DiscoverPage } from "./features/discover/discover-page.js";
import { ForksPage } from "./features/forks/forks-page.js";
import { ListsPage } from "./features/lists/lists-page.js";
import { NotificationsPage } from "./features/notifications/notifications-page.js";
import { ReleasesPage } from "./features/releases/releases-page.js";
import { RepositoriesPage } from "./features/repositories/repositories-page.js";
import { SettingsPage } from "./features/settings/settings-page.js";
import { ApiError, fetchAuthSession, fetchBootstrap, fetchDataChanges, fetchStarredRepositories, logout } from "./lib/api.js";
import { loadCachedState, loadState, mergeCanonicalServerState, mergeStarredRepositories, saveState } from "./lib/storage.js";
import { currentRelativeUrl } from "./lib/url-state.js";
function pageFromLocation() {
    if (window.location.pathname.startsWith("/releases"))
        return "releases";
    if (window.location.pathname.startsWith("/forks"))
        return "forks";
    if (window.location.pathname.startsWith("/lists"))
        return "lists";
    if (window.location.pathname.startsWith("/discover"))
        return "discover";
    if (window.location.pathname.startsWith("/notifications"))
        return "notifications";
    if (window.location.pathname.startsWith("/settings"))
        return "settings";
    return "repositories";
}
const pagePath = {
    repositories: "/", releases: "/releases", forks: "/forks", lists: "/lists", discover: "/discover", notifications: "/notifications", settings: "/settings",
};
function testSession() {
    return window.__STARBOX_TEST_SESSION__ ?? null;
}
function mergeServerState(current, result) {
    let merged = current;
    if (result.authoritative && result.state)
        merged = mergeCanonicalServerState(current, result.state);
    else if (result.state)
        merged = mergeCanonicalServerState(current, result.state);
    if (result.delta)
        merged = mergeCanonicalServerState(merged, result.delta);
    const credential = result.githubCredential;
    return { ...merged, settings: { ...merged.settings, credentialConnected: credential.connected, githubIdentity: credential.login ? { login: credential.login, id: credential.githubUserId, avatarUrl: credential.avatarUrl } : null } };
}
export default function App() {
    const [page, setPage] = useState(pageFromLocation);
    const [state, setState] = useState(loadState);
    const [auth, setAuth] = useState(() => { const session = testSession(); return session ? { status: "authenticated", session } : { status: "checking", session: null }; });
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState("");
    const [syncSuccess, setSyncSuccess] = useState("");
    const [syncWarning, setSyncWarning] = useState("");
    const [bootstrapping, setBootstrapping] = useState(false);
    const [authRetrying, setAuthRetrying] = useState(false);
    const scrollPositions = useRef({});
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
    useEffect(() => {
        const onPopState = (event) => {
            setPage(pageFromLocation());
            const key = currentRelativeUrl();
            const top = Number(event.state?.starboxScrollTop ?? scrollPositions.current?.[key] ?? 0);
            requestAnimationFrame(() => {
                const surface = document.querySelector(".content-surface");
                if (surface)
                    surface.scrollTop = top;
            });
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);
    useEffect(() => {
        const onSearchShortcut = (event) => {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target;
            if (target?.closest("input, textarea, select, [contenteditable='true']"))
                return;
            const search = document.querySelector("[data-search-shortcut='true']");
            if (!search)
                return;
            event.preventDefault();
            search.focus();
            search.select();
        };
        window.addEventListener("keydown", onSearchShortcut);
        return () => window.removeEventListener("keydown", onSearchShortcut);
    }, [page]);
    const unreadNotifications = useMemo(() => state.notifications.filter((item) => !item.read).length, [state.notifications]);
    function saveCurrentScroll() {
        const surface = document.querySelector(".content-surface");
        if (!surface)
            return;
        const key = currentRelativeUrl();
        const top = surface.scrollTop;
        if (scrollPositions.current)
            scrollPositions.current[key] = top;
        window.history.replaceState({ ...(window.history.state || {}), starboxScrollTop: top }, "", window.location.href);
    }
    function scrollMainToTop() {
        requestAnimationFrame(() => {
            const surface = document.querySelector(".content-surface");
            if (surface)
                surface.scrollTop = 0;
        });
    }
    function navigate(next) {
        saveCurrentScroll();
        setPage(next);
        const path = pagePath[next];
        if (window.location.pathname !== path || window.location.search)
            window.history.pushState({ starboxScrollTop: 0 }, "", path);
        scrollMainToTop();
    }
    function navigatePath(path) {
        saveCurrentScroll();
        window.history.pushState({ starboxScrollTop: 0 }, "", path || "/");
        setPage(pageFromLocation());
        scrollMainToTop();
    }
    function navigateSettings(tab = "account", returnTo = "") {
        saveCurrentScroll();
        const params = new URLSearchParams();
        if (tab && tab !== "account")
            params.set("tab", tab);
        if (returnTo)
            params.set("returnTo", returnTo);
        const url = `/settings${params.toString() ? `?${params}` : ""}`;
        window.history.pushState({ starboxScrollTop: 0 }, "", url);
        setPage("settings");
        scrollMainToTop();
    }
    function onAuthenticated(session) { setAuth({ status: "authenticated", session }); }
    async function retryAuthService() {
        setAuthRetrying(true);
        try {
            const session = await fetchAuthSession();
            setAuth({ status: session.authenticated ? "authenticated" : "logged-out", session });
        }
        catch (reason) {
            const status = reason instanceof ApiError && reason.status === 401 ? "logged-out" : "unavailable";
            setAuth({ status, session: null, error: status === "unavailable" ? "登录服务暂不可用，请检查 Worker 部署后重试。" : undefined });
        }
        finally {
            setAuthRetrying(false);
        }
    }
    async function onLogout() { try {
        await logout();
    }
    catch { /* local logout still clears the UI session when the backend is unavailable. */ } setAuth({ status: "logged-out", session: null }); }
    async function syncStars() {
        if (!state.settings.githubToken.trim() && !state.settings.credentialConnected) {
            setSyncError("请先在设置中连接 GitHub 凭据");
            navigateSettings("account", currentRelativeUrl());
            return;
        }
        setSyncing(true);
        setSyncError("");
        setSyncSuccess("");
        setSyncWarning("");
        try {
            const { repositories, partial } = await fetchStarredRepositories(state.settings.githubToken.trim());
            setState((current) => ({ ...current, repositories: partial ? mergeStarredRepositories(current.repositories, repositories) : repositories, lastSyncAt: new Date().toISOString() }));
            if (partial)
                setSyncWarning(`部分同步：GitHub 此次仅读取前 3000 个 Stars（分页上限）。本次读取到 ${repositories.length} 个；未返回的仓库保留在本地，未执行删除。`);
            else {
                setSyncSuccess("");
                notify("Stars 同步完成", `${repositories.length} 个仓库`, "success");
            }
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
        return _jsx(LoginPage, { onAuthenticated: onAuthenticated, serviceError: auth.status === "unavailable" ? auth.error : "", onRetryService: () => void retryAuthService(), retryingService: authRetrying });
    const initialLoading = bootstrapping && !state.lastBootstrapAt;
    return _jsx(AppShell, { page: page, settings: state.settings, session: auth.session, unreadNotifications: unreadNotifications, onPageChange: navigate, children: page === "repositories" ? _jsx(RepositoriesPage, { state: state, onStateChange: setState, onSync: () => void syncStars(), syncing: syncing, syncError: syncError, syncWarning: syncWarning, syncSuccess: syncSuccess, goToSettings: (tab) => navigateSettings(tab || "account", currentRelativeUrl()), loading: initialLoading })
            : page === "releases" ? _jsx(ReleasesPage, { state: state, onStateChange: setState, goToSettings: (tab) => navigateSettings(tab || "account", currentRelativeUrl()), goToStars: () => navigate("repositories"), initialLoading: initialLoading })
                : page === "forks" ? _jsx(ForksPage, { state: state, onStateChange: setState, goToSettings: (tab) => navigateSettings(tab || "account", currentRelativeUrl()), initialLoading: initialLoading })
                    : page === "lists" ? _jsx(ListsPage, { state: state, onStateChange: setState, goToSettings: () => navigateSettings("account", currentRelativeUrl()), initialLoading: initialLoading })
                        : page === "discover" ? _jsx(DiscoverPage, { state: state, onStateChange: setState, goToSettings: () => navigateSettings("account", currentRelativeUrl()), initialLoading: initialLoading })
                            : page === "notifications" ? _jsx(NotificationsPage, { state: state, onStateChange: setState, initialLoading: initialLoading })
                                : _jsx(SettingsPage, { state: state, onStateChange: setState, session: auth.session, onLogout: () => void onLogout(), onNavigatePath: navigatePath, initialLoading: initialLoading }) });
}
