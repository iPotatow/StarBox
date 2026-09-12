import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiArrowDownLine, RiCheckboxCircleLine, RiExternalLinkLine, RiGitForkLine, RiRefreshLine, RiSearchLine, RiSettings4Line, } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Select } from "../../components/ui/select.js";
import { ListSkeleton } from "../../components/ui/skeleton.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { fetchForkDetails, fetchForkRepositories, syncForkUpstream } from "../../lib/api.js";
import { cn } from "../../lib/cn.js";
import { markForkReadState } from "../../lib/storage.js";
function upstreamState(fork) {
    if (fork.behindBy == null || fork.aheadBy == null)
        return "unknown";
    if (fork.behindBy > 0)
        return "behind";
    if (fork.aheadBy > 0)
        return "ahead";
    return "synced";
}
export function ForksPage({ state, onStateChange, goToSettings, initialLoading = false }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [forks, setForks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState("");
    const [upstreamFilter, setUpstreamFilter] = useState("all");
    const [sort, setSort] = useState("updated");
    const [direction, setDirection] = useState("desc");
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState("");
    const [syncing, setSyncing] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const loadForks = useCallback(async () => {
        if (!hasGithubCredential)
            return;
        setLoading(true);
        setError("");
        try {
            const next = await fetchForkRepositories(token);
            setForks(next);
            setSuccess(`已从 GitHub 读取 ${next.length} 个 Fork`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Fork 清单读取失败");
        }
        finally {
            setLoading(false);
        }
    }, [hasGithubCredential, token]);
    useEffect(() => { if (hasGithubCredential)
        void loadForks(); }, [hasGithubCredential, loadForks]);
    async function inspectFork(fork) {
        if (!hasGithubCredential)
            return goToSettings();
        setDetailLoading(fork.fullName);
        setError("");
        try {
            const detail = await fetchForkDetails(token, fork.fullName);
            setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item));
            setSelected(detail);
            onStateChange(markForkReadState(state, detail.fullName, new Date().toISOString()));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Fork 详情读取失败");
        }
        finally {
            setDetailLoading("");
        }
    }
    async function syncUpstream(fork) {
        if (!hasGithubCredential)
            return goToSettings();
        setSyncing(fork.fullName);
        setError("");
        try {
            const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch);
            setSuccess(result.message || `已同步 ${fork.fullName}`);
            const detail = await fetchForkDetails(token, fork.fullName);
            setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item));
            setSelected(detail);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "上游同步失败");
        }
        finally {
            setSyncing("");
        }
    }
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return forks.filter((fork) => (!needle || [fork.fullName, fork.parentFullName, fork.description].filter(Boolean).join(" ").toLowerCase().includes(needle)) && (upstreamFilter === "all" || upstreamState(fork) === upstreamFilter)).sort((a, b) => {
            const delta = sort === "name" ? a.fullName.localeCompare(b.fullName)
                : sort === "ahead" ? (a.aheadBy ?? -1) - (b.aheadBy ?? -1)
                    : sort === "behind" ? (a.behindBy ?? -1) - (b.behindBy ?? -1)
                        : new Date(a.pushedAt || 0).getTime() - new Date(b.pushedAt || 0).getTime();
            return direction === "asc" ? delta : -delta;
        });
    }, [forks, query, upstreamFilter, sort, direction]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    const pageLoading = (initialLoading || loading) && !forks.length;
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Fork" }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: ["GitHub \u4E2D\u68C0\u6D4B\u5230 ", forks.length, " \u4E2A Fork \u4ED3\u5E93\uFF0C\u53EA\u7BA1\u7406\u5DF2\u6709 Fork\uFF0C\u4E0D\u5728 StarBox \u521B\u5EFA\u3002"] })] }), _jsxs(Button, { onClick: () => void loadForks(), loading: loading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0 GitHub"] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": "Fork \u5DE5\u5177\u680F", children: [_jsx(ToolbarGroup, { className: "min-w-[240px] flex-1", children: _jsxs("div", { className: "relative w-full", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "w-full min-w-[220px] pl-9", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22 Fork / Upstream" })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { children: [_jsxs(Select, { value: upstreamFilter, onChange: (event) => { setUpstreamFilter(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u72B6\u6001" }), _jsx("option", { value: "behind", children: "Behind" }), _jsx("option", { value: "ahead", children: "Ahead" }), _jsx("option", { value: "synced", children: "\u5DF2\u540C\u6B65" }), _jsx("option", { value: "unknown", children: "\u672A\u77E5" })] }), _jsxs(Select, { value: sort, onChange: (event) => setSort(event.target.value), className: "min-w-32", children: [_jsx("option", { value: "updated", children: "\u66F4\u65B0\u65F6\u95F4" }), _jsx("option", { value: "behind", children: "Behind \u6570\u91CF" }), _jsx("option", { value: "ahead", children: "Ahead \u6570\u91CF" }), _jsx("option", { value: "name", children: "\u540D\u79F0" })] }), _jsx(Tooltip, { content: direction === "desc" ? "当前逆序，点击切换正序" : "当前正序，点击切换逆序", children: _jsx(Button, { variant: "outline", size: "icon", onClick: () => setDirection((value) => value === "desc" ? "asc" : "desc"), children: _jsx(RiArrowDownLine, { className: cn("size-4 transition-transform", direction === "asc" && "rotate-180") }) }) })] })] }), !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "\u8FDE\u63A5 GitHub \u51ED\u636E\u540E\u624D\u80FD\u8BFB\u53D6\u5DF2 Fork \u4ED3\u5E93\u3002" }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] })
                : pageLoading ? _jsx(ListSkeleton, { rows: 8 })
                    : _jsxs(Card, { render: _jsx("section", {}), className: "overflow-hidden rounded-xl shadow-card", children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_110px_110px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsx("span", { children: "Repository / Upstream" }), _jsx("span", { className: "max-md:hidden", children: "Divergence" }), _jsx("span", { className: "max-md:hidden", children: "Actions" }), _jsx("span", { className: "text-right", children: "\u64CD\u4F5C" })] }), visible.map((fork) => { const unread = !state.forkReadAt[fork.fullName] || new Date(state.forkReadAt[fork.fullName]).getTime() < new Date(fork.pushedAt).getTime(); const status = upstreamState(fork); return _jsxs("article", { className: "grid grid-cols-[minmax(0,1fr)_110px_110px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsxs("div", { className: "min-w-0", children: [_jsx(Button, { variant: "link", size: "none", onClick: () => void inspectFork(fork), className: "max-w-full truncate text-left text-sm font-semibold", children: fork.fullName }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [unread ? _jsx(Badge, { children: "new" }) : null, _jsxs("span", { className: "truncate", children: ["Upstream: ", fork.parentFullName || "未知"] })] })] }), _jsx("div", { className: "text-xs max-md:hidden", children: fork.aheadBy == null || fork.behindBy == null ? _jsx(Badge, { children: "unknown" }) : _jsxs("div", { className: "flex gap-1", children: [_jsxs(Badge, { children: [fork.aheadBy, " ahead"] }), _jsxs(Badge, { children: [fork.behindBy, " behind"] })] }) }), _jsx("div", { className: "text-xs max-md:hidden", children: fork.latestWorkflow ? _jsx("a", { href: fork.latestWorkflow.htmlUrl, target: "_blank", rel: "noreferrer", className: "hover:underline", children: fork.latestWorkflow.conclusion || fork.latestWorkflow.status }) : "—" }), _jsxs("div", { className: "flex justify-end gap-1", children: [status === "behind" ? _jsx(Tooltip, { content: "\u540C\u6B65 upstream", children: _jsx(Button, { size: "sm", variant: "outline", loading: syncing === fork.fullName, onClick: () => void syncUpstream(fork), children: "\u540C\u6B65" }) }) : null, _jsx(Tooltip, { content: "\u5237\u65B0\u8BE6\u60C5", children: _jsx(Button, { size: "icon-sm", variant: "ghost", loading: detailLoading === fork.fullName, onClick: () => void inspectFork(fork), children: _jsx(RiRefreshLine, { className: "size-4" }) }) }), _jsx("a", { href: fork.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsx(Button, { size: "icon-sm", variant: "ghost", children: _jsx(RiExternalLinkLine, { className: "size-4" }) }) })] })] }, fork.id); }), !visible.length ? _jsx("div", { className: "grid min-h-56 place-items-center p-8 text-center text-sm text-muted-foreground", children: _jsxs("div", { children: [_jsx(RiGitForkLine, { className: "mx-auto size-6" }), _jsx("p", { className: "mt-3", children: "GitHub \u4E2D\u6682\u65E0\u7B26\u5408\u6761\u4EF6\u7684 Fork \u4ED3\u5E93" })] }) }) : null] }), filtered.length > pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page <= 1, onClick: () => setPage((value) => value - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page >= totalPages, onClick: () => setPage((value) => value + 1) }) }) })] }) }) : null, _jsx(Modal, { open: Boolean(selected), title: selected?.fullName || "Fork", description: selected?.parentFullName ? `Upstream ${selected.parentFullName}` : "Fork 详情", onClose: () => setSelected(null), children: selected ? _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Ahead" }), _jsx("div", { className: "mt-1 font-medium", children: selected.aheadBy ?? "未知" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Behind" }), _jsx("div", { className: "mt-1 font-medium", children: selected.behindBy ?? "未知" })] })] }), selected.latestWorkflow ? _jsxs("div", { className: "rounded-xl bg-secondary/50 p-3 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(RiCheckboxCircleLine, { className: "size-4" }), "Latest Action \u00B7 ", selected.latestWorkflow.name] }), _jsx("div", { className: "mt-1 text-xs text-muted-foreground", children: selected.latestWorkflow.conclusion || selected.latestWorkflow.status })] }) : null, _jsxs("div", { className: "flex flex-wrap gap-2", children: [selected.behindBy && selected.behindBy > 0 ? _jsx(Button, { onClick: () => void syncUpstream(selected), loading: syncing === selected.fullName, children: "\u540C\u6B65 upstream" }) : null, _jsx("a", { href: selected.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "\u6253\u5F00 Fork"] }) }), selected.parentHtmlUrl ? _jsx("a", { href: selected.parentHtmlUrl, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "outline", children: "\u6253\u5F00 Upstream" }) }) : null] })] }) : null })] }));
}
