import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiExternalLinkLine, RiMagicLine, RiNotification2Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiStarLine, RiTimeLine, } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { MarkdownContent } from "../../components/ui/markdown-content.js";
import { Modal } from "../../components/ui/modal.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Select } from "../../components/ui/select.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { notify } from "../../components/ui/toast.js";
import { fetchReleaseDetail, fetchReleaseFeed, summarizeRelease } from "../../lib/api.js";
import { mergeSuccessfulReleaseFeed } from "../../lib/storage.js";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
function releaseCardKey(release) { return `${release.repoFullName}#${release.id}`; }
function releaseScope(latestOnly, includePrereleases) {
    if (latestOnly)
        return includePrereleases ? "latest" : "latest-stable";
    return includePrereleases ? "all" : "stable";
}
function scopeSettings(scope) {
    return { latestOnly: scope === "latest" || scope === "latest-stable", includePrereleases: scope === "all" || scope === "latest" };
}
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
function matchesPlatform(name, platform) {
    if (platform === "all")
        return true;
    const value = name.toLowerCase();
    if (platform === "macos")
        return /(macos|mac[-_.]?os|darwin|osx|\.dmg\b)/i.test(value);
    if (platform === "windows")
        return /(windows|win32|win64|\.exe\b|\.msi\b)/i.test(value);
    if (platform === "linux")
        return /(linux|appimage|\.deb\b|\.rpm\b)/i.test(value);
    return /(arm64|aarch64|armv7|armv8|[-_.]arm[-_.])/i.test(value);
}
function matchesType(name, type) {
    if (type === "all")
        return true;
    const value = name.toLowerCase();
    if (type === "dmg")
        return value.endsWith(".dmg");
    if (type === "zip")
        return value.endsWith(".zip");
    if (type === "appimage")
        return value.endsWith(".appimage");
    if (type === "installer")
        return /\.(exe|msi)$/.test(value);
    if (type === "package")
        return /\.(deb|rpm)$/.test(value);
    if (type === "apk")
        return value.endsWith(".apk");
    return /\.(tar\.gz|tar\.xz|tgz|txz|7z|rar)$/.test(value);
}
function SummaryPanel({ summary }) {
    const sections = [
        ["重点", summary.highlights],
        ["修复", summary.fixes],
        ["Breaking Changes", summary.breakingChanges],
    ];
    return _jsxs("details", { className: "mt-3 rounded-xl border border-border bg-secondary/35 p-3", children: [_jsx("summary", { className: "cursor-pointer text-xs font-semibold", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(RiMagicLine, { className: "size-4" }), "AI Release Summary \u00B7 ", summary.highlights.length + summary.fixes.length + summary.breakingChanges.length, " \u4E2A\u91CD\u70B9"] }) }), _jsx("p", { className: "mt-2 text-sm leading-6", children: summary.overview }), sections.map(([label, items]) => items.length ? _jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "text-xs font-medium text-muted-foreground", children: label }), _jsx("ul", { className: "mt-1 grid gap-1 text-xs leading-5 text-muted-foreground", children: items.map((item) => _jsxs("li", { children: ["\u2022 ", item] }, item)) })] }, label) : null)] });
}
function ReleaseCard({ release, assets, hiddenCount, aiEnabled, aiSummary, aiLoading, aiError, onOpen, onSummarize }) {
    return _jsx(Card, { render: _jsx("article", {}), className: "rounded-xl p-4 shadow-card", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary", children: _jsx(RiTimeLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "link", size: "none", className: "text-left text-sm font-semibold", onClick: onOpen, children: release.name || release.tagName }), release.prerelease ? _jsx(Badge, { children: "prerelease" }) : null] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [release.repoFullName, " \u00B7 ", release.tagName, " \u00B7 ", new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")] }), _jsx("p", { className: "mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground", children: release.body || "暂无 Release Notes" }), aiSummary ? _jsx(SummaryPanel, { summary: aiSummary }) : null, aiError ? _jsx("div", { className: "mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground", children: aiError }) : null, assets.length ? _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: assets.slice(0, 3).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent", children: [asset.name, " \u00B7 ", formatSize(asset.size)] }, asset.id)) }) : null, hiddenCount ? _jsx("div", { className: "mt-3 flex items-center gap-2 text-xs text-muted-foreground", children: _jsxs("span", { children: ["\u8FD8\u6709 ", hiddenCount, " \u4E2A Assets \u672A\u5728\u5361\u7247\u5C55\u793A\uFF08\u542B\u7B5B\u9009\u89C4\u5219\uFF09"] }) }) : null] }), _jsxs("div", { className: "flex shrink-0 gap-1", children: [_jsx(Tooltip, { content: aiEnabled ? (aiSummary ? "重新生成 AI Summary" : "生成 AI Summary") : "请先在设置中配置 AI Provider", children: _jsx("span", { children: _jsx(Button, { variant: "ghost", size: "icon-sm", loading: aiLoading, disabled: !aiEnabled, onClick: onSummarize, "aria-label": "AI Release Summary", children: _jsx(RiMagicLine, { className: "size-4" }) }) }) }), _jsx(Button, { render: _jsx("a", { href: release.htmlUrl, target: "_blank", rel: "noreferrer" }), variant: "ghost", size: "icon-sm", "aria-label": "\u6253\u5F00 GitHub Release", children: _jsx(RiExternalLinkLine, { className: "size-4" }) })] })] }) });
}
export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [query, setQuery] = useState(() => readQueryParam("q"));
    const [repositoryFilter, setRepositoryFilter] = useState(() => readQueryParam("repo"));
    const [viewMode, setViewMode] = useState(() => readQueryParam("view") === "repository" ? "repository" : "timeline");
    const [assetPlatform, setAssetPlatform] = useState(() => { const v = readQueryParam("platform"); return ["macos", "windows", "linux", "arm"].includes(v) ? v : "all"; });
    const [assetType, setAssetType] = useState(() => { const v = readQueryParam("asset"); return ["dmg", "zip", "appimage", "installer", "package", "apk", "archive"].includes(v) ? v : "all"; });
    const [page, setPage] = useState(() => readQueryNumber("page", 1));
    const resultsTopRef = useRef(null);
    const [didInitialLoad, setDidInitialLoad] = useState(false);
    const [summaries, setSummaries] = useState({});
    const [summaryErrors, setSummaryErrors] = useState({});
    const [summaryLoading, setSummaryLoading] = useState("");
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const settings = state.releaseSettings;
    const aiEnabled = Boolean(state.settings.ai.baseUrl && state.settings.ai.apiKey && state.settings.ai.model);
    useEffect(() => { replaceQueryParams({ q: query, repo: repositoryFilter, view: viewMode === "timeline" ? "" : viewMode, platform: assetPlatform === "all" ? "" : assetPlatform, asset: assetType === "all" ? "" : assetType, page: page === 1 ? "" : page, latest: settings.latestOnly ? "1" : "", prerelease: settings.includePrereleases ? "1" : "" }); }, [query, repositoryFilter, viewMode, assetPlatform, assetType, page, settings.latestOnly, settings.includePrereleases]);
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
            onStateChange(mergeSuccessfulReleaseFeed(state, result.releases, state.releaseSubscriptions, result.failures, new Date().toISOString()));
            if (result.failures.length)
                setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`);
            else {
                setSuccess("");
                notify("Release 同步完成", `新增/更新 ${result.releases.length} 条`, "success");
            }
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
    async function openDetail(release) { setDetail(release); setDetailError(""); if (!hasGithubCredential) {
        setDetailError("未连接 GitHub 凭据，当前显示缓存内容。");
        return;
    } setDetailLoading(true); try {
        setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id));
    }
    catch (reason) {
        setDetailError(`${reason instanceof Error ? reason.message : "Release 详情加载失败"}。当前继续显示缓存内容。`);
    }
    finally {
        setDetailLoading(false);
    } }
    async function runSummary(release) { if (!aiEnabled)
        return; const key = releaseCardKey(release); setSummaryLoading(key); setSummaryErrors((current) => ({ ...current, [key]: "" })); try {
        const summary = await summarizeRelease(state.settings.ai, release);
        setSummaries((current) => ({ ...current, [key]: summary }));
    }
    catch (reason) {
        setSummaryErrors((current) => ({ ...current, [key]: reason instanceof Error ? reason.message : "AI Release Summary 失败" }));
    }
    finally {
        setSummaryLoading("");
    } }
    function updateSettings(patch) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const allowed = new Set(state.releaseSubscriptions);
        let items = state.releases.filter((release) => allowed.has(release.repoFullName)).filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !repositoryFilter || release.repoFullName === repositoryFilter).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
        if (settings.latestOnly) {
            const first = new Map();
            for (const release of items)
                if (!first.has(release.repoFullName))
                    first.set(release.repoFullName, release);
            items = Array.from(first.values());
        }
        return items;
    }, [state.releases, state.releaseSubscriptions, query, repositoryFilter, settings.includePrereleases, settings.latestOnly]);
    const groups = useMemo(() => { const map = new Map(); for (const release of filtered)
        map.set(release.repoFullName, [...(map.get(release.repoFullName) || []), release]); return Array.from(map.entries()).map(([repoFullName, releases]) => ({ repoFullName, releases })); }, [filtered]);
    const pageSize = viewMode === "timeline" ? settings.pageSize : Math.min(10, settings.pageSize);
    const collectionLength = viewMode === "timeline" ? filtered.length : groups.length;
    const totalPages = Math.max(1, Math.ceil(collectionLength / pageSize));
    const visibleReleases = filtered.slice((page - 1) * pageSize, page * pageSize);
    const visibleGroups = groups.slice((page - 1) * pageSize, page * pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    function changePage(next) { setPage(Math.max(1, Math.min(totalPages, next))); requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" })); }
    const filteredAssets = (release) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)) && matchesPlatform(asset.name, assetPlatform) && matchesType(asset.name, assetType));
    const pageLoading = (initialLoading || loading) && !state.releases.length;
    const renderRelease = (release) => { const assets = filteredAssets(release); const key = releaseCardKey(release); return _jsx(ReleaseCard, { release: release, assets: assets, hiddenCount: Math.max(0, release.assets.length - Math.min(3, assets.length)), aiEnabled: aiEnabled, aiSummary: summaries[key], aiLoading: summaryLoading === key, aiError: summaryErrors[key], onOpen: () => void openDetail(release), onSummarize: () => void runSummary(release) }, key); };
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Release" }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: ["\u6765\u81EA Stars \u7684 ", state.releaseSubscriptions.length, " \u4E2A\u8BA2\u9605", state.lastReleaseSyncAt ? ` · 上次同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")}` : ""] })] }), _jsxs(Button, { onClick: () => void sync(), loading: loading, disabled: !state.releaseSubscriptions.length, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u540C\u6B65 Release"] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": "Release \u5DE5\u5177\u680F", children: [_jsx(ToolbarGroup, { className: "min-w-[260px] flex-1", children: _jsxs(InputGroup, { className: "min-w-[240px]", children: [_jsx(InputGroupInput, { type: "search", "data-search-shortcut": "true", "aria-label": "\u641C\u7D22 Release", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22\u7248\u672C\u3001\u6807\u9898\u548C Release Notes" }), _jsx(InputGroupAddon, { children: _jsx(RiSearchLine, { className: "size-4", "aria-hidden": "true" }) })] }) }), _jsx(ToolbarSeparator, {}), _jsx(ToolbarGroup, { children: _jsxs(Select, { "aria-label": "\u7B5B\u9009\u8BA2\u9605\u4ED3\u5E93", value: repositoryFilter, onChange: (event) => { setRepositoryFilter(event.target.value); setPage(1); }, className: "min-w-44", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u8BA2\u9605\u4ED3\u5E93" }), state.releaseSubscriptions.map((name) => _jsx("option", { value: name, children: name }, name))] }) }), _jsx(ToolbarSeparator, {}), _jsx(ToolbarGroup, { children: _jsxs(ToggleGroup, { value: [viewMode], onValueChange: (values) => { const next = values.at(-1); if (next === "timeline" || next === "repository") {
                                setViewMode(next);
                                setPage(1);
                            } }, children: [_jsx(ToggleGroupItem, { value: "timeline", className: "w-auto px-2.5 text-xs", children: "\u65F6\u95F4\u7EBF" }), _jsx(ToggleGroupItem, { value: "repository", className: "w-auto px-2.5 text-xs", children: "\u6309\u4ED3\u5E93" })] }) }), _jsx(ToolbarSeparator, {}), _jsx(ToolbarGroup, { children: _jsxs(Select, { "aria-label": "\u7248\u672C\u8303\u56F4", value: releaseScope(settings.latestOnly, settings.includePrereleases), onChange: (event) => updateSettings(scopeSettings(event.target.value)), className: "min-w-40", children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u7248\u672C" }), _jsx("option", { value: "stable", children: "\u4EC5\u7A33\u5B9A\u7248" }), _jsx("option", { value: "latest", children: "\u6BCF\u4ED3\u5E93\u6700\u65B0" }), _jsx("option", { value: "latest-stable", children: "\u6BCF\u4ED3\u5E93\u6700\u65B0\u7A33\u5B9A\u7248" })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { "aria-label": "Asset \u5FEB\u901F\u8FC7\u6EE4", children: [_jsxs(Select, { "aria-label": "\u7B5B\u9009 Asset \u5E73\u53F0", value: assetPlatform, onChange: (event) => { setAssetPlatform(event.target.value); setPage(1); }, className: "min-w-28", children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5E73\u53F0" }), _jsx("option", { value: "macos", children: "macOS" }), _jsx("option", { value: "windows", children: "Windows" }), _jsx("option", { value: "linux", children: "Linux" }), _jsx("option", { value: "arm", children: "ARM" })] }), _jsxs(Select, { "aria-label": "\u7B5B\u9009 Asset \u7C7B\u578B", value: assetType, onChange: (event) => { setAssetType(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u7C7B\u578B" }), _jsx("option", { value: "dmg", children: "DMG" }), _jsx("option", { value: "zip", children: "ZIP" }), _jsx("option", { value: "appimage", children: "AppImage" }), _jsx("option", { value: "installer", children: "EXE / MSI" }), _jsx("option", { value: "package", children: "DEB / RPM" }), _jsx("option", { value: "apk", children: "APK" }), _jsx("option", { value: "archive", children: "TAR / 7Z" })] }), assetPlatform !== "all" || assetType !== "all" ? _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { setAssetPlatform("all"); setAssetType("all"); setPage(1); }, children: "\u6E05\u9664 Asset" }) : null, _jsx(Tooltip, { content: "\u7BA1\u7406 Asset include / exclude Regex", children: _jsx(Button, { size: "icon-sm", variant: "ghost", "aria-label": "\u7BA1\u7406 Asset \u89C4\u5219", onClick: () => goToSettings("data"), children: _jsx(RiSettings4Line, { className: "size-4" }) }) })] })] }), !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "\u9700\u8981 GitHub \u51ED\u636E\u624D\u80FD\u540C\u6B65 Release\u3002" }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: () => goToSettings("account"), children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] })
                : !state.releaseSubscriptions.length ? _jsx(Empty, { className: "min-h-72", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiStarLine, { className: "size-5" }) }), _jsx(EmptyTitle, { children: "\u6682\u65E0 Release \u8BA2\u9605" }), _jsx(EmptyDescription, { children: "\u8BF7\u5728 Stars \u9875\u9762\u9009\u62E9\u9700\u8981\u5173\u6CE8 Release \u7684\u4ED3\u5E93\u3002" }), _jsx(Button, { className: "mt-4", variant: "outline", onClick: goToStars, children: "\u524D\u5F80 Stars" })] }) })
                    : pageLoading ? _jsx("div", { className: "grid gap-3", children: Array.from({ length: 6 }, (_, index) => _jsx(Card, { className: "rounded-xl p-4", children: _jsxs("div", { className: "flex gap-3", children: [_jsx(Skeleton, { className: "size-8 rounded-lg" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-2/3" }), _jsx(Skeleton, { className: "mt-4 h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" })] })] }) }, index)) })
                        : _jsxs(_Fragment, { children: [_jsx("div", { ref: resultsTopRef }), viewMode === "timeline" ? _jsx("div", { className: "grid gap-3", children: visibleReleases.map(renderRelease) }) : _jsx("div", { className: "grid gap-5", children: visibleGroups.map((group) => _jsxs("section", { className: "rounded-2xl border border-border bg-secondary/20 p-3 sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate text-sm font-semibold", children: group.repoFullName }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [group.releases.length, " \u4E2A Release"] })] }), _jsxs(Button, { render: _jsx("a", { href: `https://github.com/${group.repoFullName}/releases`, target: "_blank", rel: "noreferrer" }), size: "sm", variant: "ghost", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "Releases"] })] }), _jsx("div", { className: "grid gap-3", children: group.releases.map(renderRelease) })] }, group.repoFullName)) }), !collectionLength ? _jsx(Empty, { children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiNotification2Line, { className: "size-5" }) }), _jsx(EmptyTitle, { children: "\u6682\u65E0\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u7684 Release" }), _jsx(EmptyDescription, { children: "\u8C03\u6574\u4ED3\u5E93\u3001\u7248\u672C\u8303\u56F4\u6216 Asset \u7B5B\u9009\u6761\u4EF6\u540E\u518D\u8BD5\u3002" })] }) }) : null, collectionLength > pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => changePage(page - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { variant: "outline", size: "sm", disabled: page >= totalPages, onClick: () => changePage(page + 1) }) }) })] }) }) : null] }), _jsx(Modal, { open: Boolean(detail), title: detail?.name || detail?.tagName || "Release", description: detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined, onClose: () => setDetail(null), children: _jsxs("div", { className: "grid gap-4", children: [detailError && detail ? _jsxs("div", { className: "rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground", children: [detailError, _jsx(Button, { className: "ml-2", size: "sm", variant: "ghost", onClick: () => void openDetail(detail), children: "\u91CD\u8BD5" })] }) : null, detailLoading ? _jsxs("div", { className: "grid gap-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" })] }) : null, detail ? summaries[releaseCardKey(detail)] ? _jsx(SummaryPanel, { summary: summaries[releaseCardKey(detail)] }) : _jsx(Tooltip, { content: aiEnabled ? "生成当前 Release 的 AI Summary" : "请先配置 AI Provider", children: _jsxs(Button, { variant: "outline", disabled: !aiEnabled, loading: summaryLoading === releaseCardKey(detail), onClick: () => void runSummary(detail), children: [_jsx(RiMagicLine, { className: "size-4" }), "AI \u603B\u7ED3"] }) }) : null, _jsx("div", { className: "max-h-[45vh] overflow-auto rounded-xl border border-border bg-secondary/20 p-4", children: detail?.body ? _jsx(MarkdownContent, { content: detail.body }) : _jsx("p", { className: "text-sm text-muted-foreground", children: "\u6682\u65E0 Release Notes" }) }), detail ? _jsxs("div", { className: "grid gap-2", children: [_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Assets \u5F53\u524D\u7B5B\u9009\uFF1A", assetPlatform === "all" ? "全部平台" : assetPlatform, " \u00B7 ", assetType === "all" ? "全部类型" : assetType] }), filteredAssets(detail).map((asset) => _jsxs("a", { href: asset.browserDownloadUrl, target: "_blank", rel: "noreferrer", className: "flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent", children: [_jsx("span", { className: "truncate", children: asset.name }), _jsxs("span", { className: "ml-3 shrink-0 text-xs text-muted-foreground", children: [formatSize(asset.size), " \u00B7 ", asset.downloadCount, " downloads"] })] }, asset.id))] }) : null, detail ? _jsxs(Button, { render: _jsx("a", { href: detail.htmlUrl, target: "_blank", rel: "noreferrer" }), children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub Release"] }) : null] }) })] });
}
