import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiAddLine, RiExternalLinkLine, RiEyeLine, RiEyeOffLine, RiNotification2Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiTimeLine, } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { Checkbox } from "../../components/ui/checkbox.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { Select } from "../../components/ui/select.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { fetchReleaseDetail, fetchReleaseFeed, fetchWatchedRepositories } from "../../lib/api.js";
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
export function ReleasesPage({ state, onStateChange, goToSettings }) {
    const [loading, setLoading] = useState(false);
    const [watchLoading, setWatchLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [subscribeValue, setSubscribeValue] = useState("");
    const [directValue, setDirectValue] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [didInitialLoad, setDidInitialLoad] = useState(false);
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const settings = state.releaseSettings;
    const candidates = useMemo(() => state.repositories.filter((repo) => !state.releaseSubscriptions.includes(repo.full_name)).sort((a, b) => a.full_name.localeCompare(b.full_name)), [state.repositories, state.releaseSubscriptions]);
    const unreadCount = useMemo(() => state.releases.filter((release) => !state.releaseStates[stateKey(release)]?.read).length, [state.releases, state.releaseStates]);
    const sync = useCallback(async () => {
        if (!hasGithubCredential) {
            setError("请先在设置中连接 GitHub 凭据");
            return;
        }
        if (!state.releaseSubscriptions.length) {
            setSuccess("还没有 Release 订阅");
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
            const merged = new Map(state.releases.map((release) => [`${release.repoFullName}#${release.id}`, release]));
            result.releases.forEach((release) => merged.set(`${release.repoFullName}#${release.id}`, release));
            const releases = Array.from(merged.values()).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
            onStateChange({ ...state, releases, lastReleaseSyncAt: new Date().toISOString() });
            if (result.failures.length)
                setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`);
            else
                setSuccess(`增量同步完成：新增/更新 ${result.releases.length} 条 Release`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Release 同步失败");
        }
        finally {
            setLoading(false);
        }
    }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);
    useEffect(() => { if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length)
        return; setDidInitialLoad(true); void sync(); }, [didInitialLoad, hasGithubCredential, token, state.releaseSubscriptions.length, sync]);
    async function subscribe(fullName) { const value = fullName.trim(); if (!/^[^/\s]+\/[^/\s]+$/.test(value))
        return setError("订阅仓库需要 owner/repo 格式"); try {
        await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(new Set([...state.releaseSubscriptions, value])) }, onStateChange, { operation: "release.subscribe", payload: { repoFullName: value } });
        setSubscribeValue("");
        setDirectValue("");
        setSuccess(`已订阅 ${value}`);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Release 订阅失败");
    } }
    async function unsubscribe(fullName) { try {
        await runOptimisticMutation(state, { ...state, releaseSubscriptions: state.releaseSubscriptions.filter((item) => item !== fullName), releases: state.releases.filter((release) => release.repoFullName !== fullName) }, onStateChange, { operation: "release.unsubscribe", payload: { repoFullName: fullName } });
        setSuccess(`已取消订阅 ${fullName}`);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "取消 Release 订阅失败");
    } }
    async function importWatching() {
        if (!hasGithubCredential)
            return goToSettings();
        setWatchLoading(true);
        setError("");
        try {
            const watched = await fetchWatchedRepositories(token);
            const names = watched.map((repo) => repo.full_name);
            const next = Array.from(new Set([...state.releaseSubscriptions, ...names]));
            await runOptimisticMutation(state, { ...state, releaseSubscriptions: next }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } });
            setSuccess(`已从 Watching 导入 ${names.length} 个仓库`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Watching 导入失败");
        }
        finally {
            setWatchLoading(false);
        }
    }
    async function markRead(release, read = true) { try {
        await runOptimisticMutation(state, { ...state, releaseStates: { ...state.releaseStates, [stateKey(release)]: { read, updatedAt: new Date().toISOString() } } }, onStateChange, { operation: read ? "release.read" : "release.unread", payload: { releaseId: release.id, repoFullName: release.repoFullName, read } });
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Release 已读状态更新失败");
    } }
    async function openDetail(release) { void markRead(release, true); if (!hasGithubCredential)
        return setDetail(release); setDetail(release); setDetailLoading(true); try {
        setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id));
    }
    catch { /* cached detail remains visible */ }
    finally {
        setDetailLoading(false);
    } }
    function updateSettings(patch) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        let items = state.releases.filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
        if (settings.latestOnly) {
            const first = new Map();
            for (const release of items)
                if (!first.has(release.repoFullName))
                    first.set(release.repoFullName, release);
            items = Array.from(first.values());
        }
        return items;
    }, [state.releases, query, settings.includePrereleases, settings.latestOnly]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
    const visible = filtered.slice((page - 1) * settings.pageSize, page * settings.pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    const filteredAssets = (release) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)));
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6 flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Release" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: state.lastReleaseSyncAt ? `上次增量同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")} · ${unreadCount} 未读` : `${state.releaseSubscriptions.length} 个订阅 · ${unreadCount} 未读` })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => void importWatching(), loading: watchLoading, children: "\u5BFC\u5165 Watching" }), _jsxs(Button, { onClick: () => void sync(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u589E\u91CF\u540C\u6B65"] })] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Card, { className: "mb-5 grid gap-3 rounded-xl p-3 shadow-card lg:grid-cols-[1fr_auto]", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Select, { value: subscribeValue, onChange: (event) => { setSubscribeValue(event.target.value); if (event.target.value)
                                    subscribe(event.target.value); }, children: [_jsx("option", { value: "", children: "\u4ECE Stars \u6DFB\u52A0\u8BA2\u9605\u2026" }), candidates.map((repo) => _jsx("option", { value: repo.full_name, children: repo.full_name }, repo.full_name))] }), _jsx(Input, { className: "max-w-xs", value: directValue, onChange: (event) => setDirectValue(event.target.value), placeholder: "\u76F4\u63A5\u8BA2\u9605 owner/repo", onKeyDown: (event) => { if (event.key === "Enter")
                                    subscribe(directValue); } }), _jsxs(Button, { variant: "outline", onClick: () => subscribe(directValue), children: [_jsx(RiAddLine, { className: "size-4" }), "\u8BA2\u9605"] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("label", { className: "flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs", children: [_jsx(Checkbox, { checked: settings.latestOnly, onCheckedChange: (checked) => updateSettings({ latestOnly: checked }), "aria-label": "\u4EC5\u6700\u65B0\u7248" }), "\u4EC5\u6700\u65B0\u7248"] }), _jsxs("label", { className: "flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs", children: [_jsx(Checkbox, { checked: settings.includePrereleases, onCheckedChange: (checked) => updateSettings({ includePrereleases: checked }), "aria-label": "\u5305\u542B\u9884\u53D1\u5E03" }), "\u5305\u542B\u9884\u53D1\u5E03"] })] }), _jsxs("div", { className: "relative lg:col-span-2", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "pl-9", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22\u4ED3\u5E93\u3001\u7248\u672C\u3001\u6807\u9898\u548C Release Notes" })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2 lg:col-span-4", children: [_jsx(Field, { label: "\u8D44\u4EA7 include \u89C4\u5219", children: _jsx(Input, { value: settings.assetIncludePattern, onChange: (event) => updateSettings({ assetIncludePattern: event.target.value }), placeholder: "\u4F8B\u5982 \\\\.zip$ \u6216 linux" }) }), _jsx(Field, { label: "\u8D44\u4EA7 exclude \u89C4\u5219", children: _jsx(Input, { value: settings.assetExcludePattern, onChange: (event) => updateSettings({ assetExcludePattern: event.target.value }), placeholder: "\u4F8B\u5982 checksum|source" }) }), _jsx(Field, { label: "\u6BCF\u9875", children: _jsxs(Select, { value: String(settings.pageSize), onChange: (event) => updateSettings({ pageSize: Number(event.target.value) }), children: [_jsx("option", { value: "10", children: "10" }), _jsx("option", { value: "20", children: "20" }), _jsx("option", { value: "50", children: "50" })] }) }), _jsx(Field, { label: "\u540C\u6B65\u6DF1\u5EA6", children: _jsxs(Select, { value: String(settings.syncPages), onChange: (event) => updateSettings({ syncPages: Number(event.target.value) }), children: [_jsx("option", { value: "1", children: "1 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "3", children: "3 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "5", children: "5 \u9875 / \u4ED3\u5E93" })] }) })] })] }), state.releaseSubscriptions.length ? _jsx("div", { className: "mb-5 flex flex-wrap gap-1.5", children: state.releaseSubscriptions.map((name) => _jsx(Tooltip, { content: "\u70B9\u51FB\u53D6\u6D88\u8BA2\u9605", children: _jsx(Button, { variant: "ghost", size: "none", onClick: () => unsubscribe(name), "aria-label": `取消订阅 ${name}`, children: _jsxs(Badge, { children: [name, " \u00D7"] }) }) }, name)) }) : null, !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "\u9700\u8981 GitHub \u51ED\u636E\u624D\u80FD\u540C\u6B65 Release\u3002" }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] }) : null, _jsx("div", { className: "grid gap-3", children: visible.map((release) => { const read = Boolean(state.releaseStates[stateKey(release)]?.read); const assets = filteredAssets(release); return _jsx(Card, { render: _jsx("article", {}), className: `rounded-xl p-4 shadow-card ${read ? "border-border" : "border-foreground/25"}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary", children: _jsx(RiTimeLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "link", size: "none", className: "text-left text-sm font-semibold", onClick: () => void openDetail(release), children: release.name || release.tagName }), release.prerelease ? _jsx(Badge, { children: "prerelease" }) : null, !read ? _jsx(Badge, { children: "unread" }) : null] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [release.repoFullName, " \u00B7 ", release.tagName, " \u00B7 ", new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")] }), _jsx("p", { className: "mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground", children: release.body || "暂无 Release Notes" }), assets.length ? _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: assets.slice(0, 6).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent", children: [asset.name, " \u00B7 ", formatSize(asset.size)] }, asset.id)) }) : release.assets.length ? _jsx("div", { className: "mt-3 text-xs text-muted-foreground", children: "\u8D44\u4EA7\u5DF2\u88AB\u5F53\u524D\u8FC7\u6EE4\u89C4\u5219\u9690\u85CF" }) : null] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Tooltip, { content: read ? "标为未读" : "标为已读", children: _jsx(Button, { variant: "ghost", size: "icon-sm", onClick: () => markRead(release, !read), "aria-label": read ? "标为未读" : "标为已读", children: read ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) }), _jsx("a", { href: release.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "ghost", size: "icon-sm", children: _jsx(RiExternalLinkLine, { className: "size-4" }) }) })] })] }) }, stateKey(release)); }) }), !visible.length ? _jsx("div", { className: "grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground", children: _jsxs("div", { className: "text-center", children: [_jsx(RiNotification2Line, { className: "mx-auto mb-3 size-5" }), state.releaseSubscriptions.length ? "暂无符合当前筛选的 Release" : "先添加 Release 订阅"] }) }) : null, filtered.length > settings.pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => setPage((value) => value - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page >= totalPages, onClick: () => setPage((value) => value + 1) }) }) })] }) }) : null, _jsx(Modal, { open: Boolean(detail), title: detail?.name || detail?.tagName || "Release", description: detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined, onClose: () => setDetail(null), children: _jsxs("div", { className: "grid gap-4", children: [detailLoading ? _jsx("div", { className: "text-sm text-muted-foreground", children: "\u6B63\u5728\u5237\u65B0\u8BE6\u60C5\u2026" }) : null, _jsx("p", { className: "max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground", children: detail?.body || "暂无 Release Notes" }), detail ? _jsx("div", { className: "grid gap-2", children: filteredAssets(detail).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent", children: [_jsx("span", { className: "truncate", children: asset.name }), _jsxs("span", { className: "ml-3 shrink-0 text-xs text-muted-foreground", children: [formatSize(asset.size), " \u00B7 ", asset.downloadCount, " downloads"] })] }, asset.id)) }) : null, detail ? _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => markRead(detail, false), children: [_jsx(RiEyeOffLine, { className: "size-4" }), "\u6807\u4E3A\u672A\u8BFB"] }), _jsx("a", { href: detail.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub Release"] }) })] }) : null] }) })] }));
}
