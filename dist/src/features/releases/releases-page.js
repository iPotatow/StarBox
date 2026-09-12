import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiExternalLinkLine, RiEyeLine, RiEyeOffLine, RiNotification2Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiStarLine, RiTimeLine, } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Select } from "../../components/ui/select.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { fetchReleaseDetail, fetchReleaseFeed } from "../../lib/api.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
function stateKey(release) { return `${release.repoFullName}#${release.id}`; }
function formatSize(bytes) { if (bytes < 1024)
    return `${bytes} B`; if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function matchesPattern(value, pattern) { if (!pattern.trim())
    return true; try {
    return new RegExp(pattern, "i").test(value);
}
catch {
    return value.toLowerCase().includes(pattern.trim().toLowerCase());
} }
export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [repositoryFilter, setRepositoryFilter] = useState("");
    const [readFilter, setReadFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [didInitialLoad, setDidInitialLoad] = useState(false);
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const settings = state.releaseSettings;
    const unreadCount = useMemo(() => state.releases.filter((release) => state.releaseSubscriptions.includes(release.repoFullName) && !state.releaseStates[stateKey(release)]?.read).length, [state.releases, state.releaseStates, state.releaseSubscriptions]);
    const sync = useCallback(async () => {
        if (!hasGithubCredential) {
            setError("请先在设置中连接 GitHub 凭据");
            return;
        }
        if (!state.releaseSubscriptions.length) {
            setSuccess("还没有从 Stars 订阅 Release 的仓库");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const sinceByRepo = {};
            for (const fullName of state.releaseSubscriptions) {
                const latest = state.releases.filter((release) => release.repoFullName === fullName).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0];
                if (latest)
                    sinceByRepo[fullName] = latest.publishedAt || latest.createdAt;
            }
            const result = await fetchReleaseFeed(token, state.releaseSubscriptions, sinceByRepo, settings.syncPages);
            const allowed = new Set(state.releaseSubscriptions);
            const merged = new Map(state.releases.filter((release) => allowed.has(release.repoFullName)).map((release) => [`${release.repoFullName}#${release.id}`, release]));
            result.releases.forEach((release) => { if (allowed.has(release.repoFullName))
                merged.set(`${release.repoFullName}#${release.id}`, release); });
            const releases = Array.from(merged.values()).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
            onStateChange({ ...state, releases, lastReleaseSyncAt: new Date().toISOString() });
            if (result.failures.length)
                setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`);
            else
                setSuccess(`同步完成：新增/更新 ${result.releases.length} 条 Release`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Release 同步失败");
        }
        finally {
            setLoading(false);
        }
    }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);
    useEffect(() => { if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length)
        return; setDidInitialLoad(true); void sync(); }, [didInitialLoad, hasGithubCredential, state.releaseSubscriptions.length, sync]);
    async function markRead(release, read = true) { try {
        await runOptimisticMutation(state, { ...state, releaseStates: { ...state.releaseStates, [stateKey(release)]: { read, updatedAt: new Date().toISOString() } } }, onStateChange, { operation: read ? "release.read" : "release.unread", payload: { releaseId: release.id, repoFullName: release.repoFullName, read } });
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Release 已读状态更新失败");
    } }
    async function openDetail(release) { void markRead(release, true); setDetail(release); if (!hasGithubCredential)
        return; setDetailLoading(true); try {
        setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id));
    }
    catch { /* cached detail remains visible */ }
    finally {
        setDetailLoading(false);
    } }
    function updateSettings(patch) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const allowed = new Set(state.releaseSubscriptions);
        let items = state.releases.filter((release) => allowed.has(release.repoFullName)).filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !repositoryFilter || release.repoFullName === repositoryFilter).filter((release) => readFilter === "all" || (readFilter === "read" ? Boolean(state.releaseStates[stateKey(release)]?.read) : !state.releaseStates[stateKey(release)]?.read)).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
        if (settings.latestOnly) {
            const first = new Map();
            for (const release of items)
                if (!first.has(release.repoFullName))
                    first.set(release.repoFullName, release);
            items = Array.from(first.values());
        }
        return items;
    }, [state.releases, state.releaseSubscriptions, state.releaseStates, query, repositoryFilter, readFilter, settings.includePrereleases, settings.latestOnly]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
    const visible = filtered.slice((page - 1) * settings.pageSize, page * settings.pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    const filteredAssets = (release) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)));
    const pageLoading = (initialLoading || loading) && !state.releases.length;
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Release" }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: ["\u6765\u81EA Stars \u7684 ", state.releaseSubscriptions.length, " \u4E2A\u8BA2\u9605 \u00B7 ", unreadCount, " \u672A\u8BFB", state.lastReleaseSyncAt ? ` · 上次同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")}` : ""] })] }), _jsxs(Button, { onClick: () => void sync(), loading: loading, disabled: !state.releaseSubscriptions.length, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u540C\u6B65 Release"] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": "Release \u5DE5\u5177\u680F", children: [_jsx(ToolbarGroup, { className: "min-w-[240px] flex-1", children: _jsxs("div", { className: "relative w-full", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "w-full min-w-[220px] pl-9", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22\u7248\u672C\u3001\u6807\u9898\u548C Release Notes" })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { children: [_jsxs(Select, { value: repositoryFilter, onChange: (event) => { setRepositoryFilter(event.target.value); setPage(1); }, className: "min-w-44", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u8BA2\u9605\u4ED3\u5E93" }), state.releaseSubscriptions.map((name) => _jsx("option", { value: name, children: name }, name))] }), _jsxs(Select, { value: readFilter, onChange: (event) => { setReadFilter(event.target.value); setPage(1); }, className: "min-w-28", children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u72B6\u6001" }), _jsx("option", { value: "unread", children: "\u672A\u8BFB" }), _jsx("option", { value: "read", children: "\u5DF2\u8BFB" })] })] }), _jsx(ToolbarSeparator, {}), _jsx(ToolbarGroup, { children: _jsxs(ToggleGroup, { multiple: true, value: [...(settings.latestOnly ? ["latest"] : []), ...(settings.includePrereleases ? ["prerelease"] : [])], onValueChange: (values) => updateSettings({ latestOnly: values.includes("latest"), includePrereleases: values.includes("prerelease") }), children: [_jsx(ToggleGroupItem, { value: "latest", className: "w-auto px-2.5 text-xs", children: "\u4EC5\u6700\u65B0" }), _jsx(ToggleGroupItem, { value: "prerelease", className: "w-auto px-2.5 text-xs", children: "\u9884\u53D1\u5E03" })] }) })] }), !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "\u9700\u8981 GitHub \u51ED\u636E\u624D\u80FD\u540C\u6B65 Release\u3002" }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] })
                : !state.releaseSubscriptions.length ? _jsx("div", { className: "grid min-h-72 place-items-center rounded-xl border border-dashed border-border p-8 text-center", children: _jsxs("div", { children: [_jsx(RiStarLine, { className: "mx-auto size-6 text-muted-foreground" }), _jsx("h2", { className: "mt-3 text-sm font-semibold", children: "\u6682\u65E0 Release \u8BA2\u9605" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u8BF7\u5728 Stars \u9875\u9762\u9009\u62E9\u9700\u8981\u5173\u6CE8 Release \u7684\u4ED3\u5E93\u3002" }), _jsx(Button, { className: "mt-4", variant: "outline", onClick: goToStars, children: "\u524D\u5F80 Stars" })] }) })
                    : pageLoading ? _jsx("div", { className: "grid gap-3", children: Array.from({ length: 6 }, (_, index) => _jsx(Card, { className: "rounded-xl p-4", children: _jsxs("div", { className: "flex gap-3", children: [_jsx(Skeleton, { className: "size-8 rounded-lg" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-2/3" }), _jsx(Skeleton, { className: "mt-4 h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" })] })] }) }, index)) })
                        : _jsxs(_Fragment, { children: [_jsx("div", { className: "grid gap-3", children: visible.map((release) => { const read = Boolean(state.releaseStates[stateKey(release)]?.read); const assets = filteredAssets(release); return _jsx(Card, { render: _jsx("article", {}), className: `rounded-xl p-4 shadow-card ${read ? "border-border" : "border-foreground/25"}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary", children: _jsx(RiTimeLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "link", size: "none", className: "text-left text-sm font-semibold", onClick: () => void openDetail(release), children: release.name || release.tagName }), release.prerelease ? _jsx(Badge, { children: "prerelease" }) : null, !read ? _jsx(Badge, { children: "unread" }) : null] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [release.repoFullName, " \u00B7 ", release.tagName, " \u00B7 ", new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")] }), _jsx("p", { className: "mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground", children: release.body || "暂无 Release Notes" }), assets.length ? _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: assets.slice(0, 6).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent", children: [asset.name, " \u00B7 ", formatSize(asset.size)] }, asset.id)) }) : release.assets.length ? _jsx("div", { className: "mt-3 text-xs text-muted-foreground", children: "\u8D44\u4EA7\u5DF2\u88AB\u8BBE\u7F6E\u4E2D\u7684\u8FC7\u6EE4\u89C4\u5219\u9690\u85CF" }) : null] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Tooltip, { content: read ? "标为未读" : "标为已读", children: _jsx(Button, { variant: "ghost", size: "icon-sm", onClick: () => markRead(release, !read), "aria-label": read ? "标为未读" : "标为已读", children: read ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) }), _jsx("a", { href: release.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "ghost", size: "icon-sm", children: _jsx(RiExternalLinkLine, { className: "size-4" }) }) })] })] }) }, stateKey(release)); }) }), !visible.length ? _jsx("div", { className: "grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground", children: _jsxs("div", { className: "text-center", children: [_jsx(RiNotification2Line, { className: "mx-auto mb-3 size-5" }), "\u6682\u65E0\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u7684 Release"] }) }) : null, filtered.length > settings.pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => setPage((value) => value - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page >= totalPages, onClick: () => setPage((value) => value + 1) }) }) })] }) }) : null] }), _jsx(Modal, { open: Boolean(detail), title: detail?.name || detail?.tagName || "Release", description: detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined, onClose: () => setDetail(null), children: _jsxs("div", { className: "grid gap-4", children: [detailLoading ? _jsxs("div", { className: "grid gap-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" })] }) : null, _jsx("p", { className: "max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground", children: detail?.body || "暂无 Release Notes" }), detail ? _jsx("div", { className: "grid gap-2", children: filteredAssets(detail).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent", children: [_jsx("span", { className: "truncate", children: asset.name }), _jsxs("span", { className: "ml-3 shrink-0 text-xs text-muted-foreground", children: [formatSize(asset.size), " \u00B7 ", asset.downloadCount, " downloads"] })] }, asset.id)) }) : null, detail ? _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => markRead(detail, false), children: [_jsx(RiEyeOffLine, { className: "size-4" }), "\u6807\u4E3A\u672A\u8BFB"] }), _jsx("a", { href: detail.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub Release"] }) })] }) : null] }) })] }));
}
