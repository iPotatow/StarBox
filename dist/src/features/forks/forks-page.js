import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiArrowDownLine, RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine, RiLoader4Line, RiExternalLinkLine, RiGitForkLine, RiRefreshLine, RiSearchLine, RiSettings4Line, } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Field } from "../../components/ui/field.js";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty.js";
import { Input } from "../../components/ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { Modal } from "../../components/ui/modal.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Select } from "../../components/ui/select.js";
import { ListSkeleton } from "../../components/ui/skeleton.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { notify } from "../../components/ui/toast.js";
import { dispatchForkWorkflow, fetchForkDetails, fetchForkRepositories, syncForkUpstream } from "../../lib/api.js";
import { cn } from "../../lib/cn.js";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
function upstreamState(fork) { if (fork.behindBy == null || fork.aheadBy == null)
    return "unknown"; if (fork.behindBy > 0)
    return "behind"; if (fork.aheadBy > 0)
    return "ahead"; return "synced"; }
function workflowState(fork) { const run = fork.latestWorkflow; if (!run)
    return "none"; if (run.status && run.status !== "completed")
    return "running"; const conclusion = (run.conclusion || "").toLowerCase(); if (["success", "neutral", "skipped"].includes(conclusion))
    return "success"; if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion))
    return "failure"; return "running"; }
export function ForksPage({ state, onStateChange: _onStateChange, goToSettings, initialLoading = false }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [forks, setForks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState(() => readQueryParam("q"));
    const [upstreamFilter, setUpstreamFilter] = useState(() => { const v = readQueryParam("upstream"); return ["behind", "ahead", "synced", "unknown"].includes(v) ? v : "all"; });
    const [workflowFilter, setWorkflowFilter] = useState(() => { const v = readQueryParam("actions"); return ["success", "failure", "running", "none"].includes(v) ? v : "all"; });
    const [sort, setSort] = useState(() => { const v = readQueryParam("sort"); return ["behind", "ahead", "name"].includes(v) ? v : "updated"; });
    const [direction, setDirection] = useState(() => readQueryParam("direction") === "asc" ? "asc" : "desc");
    const [page, setPage] = useState(() => readQueryNumber("page", 1));
    const resultsTopRef = useRef(null);
    const pageSize = 20;
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState("");
    const [syncing, setSyncing] = useState("");
    const [dispatching, setDispatching] = useState(false);
    const [workflowId, setWorkflowId] = useState("");
    const [workflowRef, setWorkflowRef] = useState("");
    const [workflowInputs, setWorkflowInputs] = useState("{}");
    const [workflowInputError, setWorkflowInputError] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    useEffect(() => { replaceQueryParams({ q: query, upstream: upstreamFilter === "all" ? "" : upstreamFilter, actions: workflowFilter === "all" ? "" : workflowFilter, sort: sort === "updated" ? "" : sort, direction: direction === "desc" ? "" : direction, page: page === 1 ? "" : page }); }, [query, upstreamFilter, workflowFilter, sort, direction, page]);
    const loadForks = useCallback(async () => {
        if (!hasGithubCredential)
            return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const next = await fetchForkRepositories(token);
            setForks(next);
            setSuccess("");
            notify("Fork 已刷新", `${next.length} 个仓库 · Upstream / Actions 状态已更新`, "success");
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
    useEffect(() => { if (!selected)
        return; const first = selected.workflows.find((item) => item.state === "active") || selected.workflows[0]; setWorkflowId(first ? String(first.id) : ""); setWorkflowRef(selected.defaultBranch || "main"); setWorkflowInputs("{}"); setWorkflowInputError(""); }, [selected?.fullName, selected?.workflows]);
    async function inspectFork(fork) {
        if (!hasGithubCredential)
            return goToSettings("account");
        setDetailLoading(fork.fullName);
        setError("");
        try {
            const detail = await fetchForkDetails(token, fork.fullName);
            setForks((current) => current.map((item) => item.fullName === detail.fullName ? { ...detail, workflows: item.workflows.length ? item.workflows : detail.workflows } : item));
            setSelected(detail);
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
            return goToSettings("account");
        setSyncing(fork.fullName);
        setError("");
        try {
            const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch);
            setSuccess("");
            notify("Upstream 已同步", result.message || fork.fullName, "success");
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
    async function runWorkflow() {
        if (!selected || !workflowId)
            return;
        let inputs = {};
        try {
            const parsed = workflowInputs.trim() ? JSON.parse(workflowInputs) : {};
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
                throw new Error("Inputs 必须是 JSON 对象");
            inputs = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
            setWorkflowInputError("");
        }
        catch (reason) {
            setWorkflowInputError(reason instanceof Error ? reason.message : "Inputs JSON 无效");
            return;
        }
        setDispatching(true);
        setError("");
        setSuccess("");
        try {
            const result = await dispatchForkWorkflow(token, selected.fullName, Number(workflowId), workflowRef.trim() || selected.defaultBranch, inputs);
            setSuccess("");
            notify("Workflow 已触发", result.message, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Workflow 触发失败");
        }
        finally {
            setDispatching(false);
        }
    }
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return forks.filter((fork) => (!needle || [fork.fullName, fork.parentFullName, fork.description, fork.latestWorkflow?.name].filter(Boolean).join(" ").toLowerCase().includes(needle)) && (upstreamFilter === "all" || upstreamState(fork) === upstreamFilter) && (workflowFilter === "all" || workflowState(fork) === workflowFilter)).sort((a, b) => {
            const delta = sort === "name" ? a.fullName.localeCompare(b.fullName) : sort === "ahead" ? (a.aheadBy ?? -1) - (b.aheadBy ?? -1) : sort === "behind" ? (a.behindBy ?? -1) - (b.behindBy ?? -1) : new Date(a.pushedAt || 0).getTime() - new Date(b.pushedAt || 0).getTime();
            return direction === "asc" ? delta : -delta;
        });
    }, [forks, query, upstreamFilter, workflowFilter, sort, direction]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    function changePage(next) { setPage(Math.max(1, Math.min(totalPages, next))); requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" })); }
    const pageLoading = (initialLoading || loading) && !forks.length;
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Fork" }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: ["GitHub \u4E2D\u68C0\u6D4B\u5230 ", forks.length, " \u4E2A Fork \u4ED3\u5E93\uFF1B\u68C0\u67E5 Upstream divergence \u4E0E Actions\uFF0C\u4E0D\u5728 StarBox \u521B\u5EFA Fork\u3002"] })] }), _jsxs(Button, { onClick: () => void loadForks(), loading: loading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0 GitHub"] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": "Fork \u5DE5\u5177\u680F", children: [_jsx(ToolbarGroup, { className: "min-w-[240px] flex-1", children: _jsxs(InputGroup, { className: "min-w-[220px]", children: [_jsx(InputGroupInput, { type: "search", "data-search-shortcut": "true", "aria-label": "\u641C\u7D22 Fork", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22 Fork / Upstream / Workflow" }), _jsx(InputGroupAddon, { children: _jsx(RiSearchLine, { className: "size-4", "aria-hidden": "true" }) })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { children: [_jsxs(Select, { "aria-label": "\u7B5B\u9009 Upstream \u72B6\u6001", value: upstreamFilter, onChange: (event) => { setUpstreamFilter(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: "\u5168\u90E8 Upstream" }), _jsx("option", { value: "behind", children: "Behind" }), _jsx("option", { value: "ahead", children: "Ahead" }), _jsx("option", { value: "synced", children: "\u5DF2\u540C\u6B65" }), _jsx("option", { value: "unknown", children: "\u672A\u77E5" })] }), _jsxs(Select, { "aria-label": "\u7B5B\u9009 Actions \u72B6\u6001", value: workflowFilter, onChange: (event) => { setWorkflowFilter(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: "\u5168\u90E8 Actions" }), _jsx("option", { value: "success", children: "\u6210\u529F" }), _jsx("option", { value: "failure", children: "\u5931\u8D25" }), _jsx("option", { value: "running", children: "\u8FD0\u884C\u4E2D" }), _jsx("option", { value: "none", children: "\u65E0\u8FD0\u884C\u8BB0\u5F55" })] }), _jsxs(Select, { "aria-label": "Fork \u6392\u5E8F\u65B9\u5F0F", value: sort, onChange: (event) => { setSort(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "updated", children: "\u66F4\u65B0\u65F6\u95F4" }), _jsx("option", { value: "behind", children: "Behind \u6570\u91CF" }), _jsx("option", { value: "ahead", children: "Ahead \u6570\u91CF" }), _jsx("option", { value: "name", children: "\u540D\u79F0" })] }), _jsx(Tooltip, { content: direction === "desc" ? "当前逆序，点击切换正序" : "当前正序，点击切换逆序", children: _jsx(Button, { variant: "outline", size: "icon", "aria-label": direction === "desc" ? "切换为正序" : "切换为逆序", onClick: () => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }, children: _jsx(RiArrowDownLine, { className: cn("size-4 transition-transform", direction === "asc" && "rotate-180") }) }) })] })] }), _jsx("div", { ref: resultsTopRef }), !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "\u8FDE\u63A5 GitHub \u51ED\u636E\u540E\u624D\u80FD\u8BFB\u53D6\u5DF2 Fork \u4ED3\u5E93\u3002" }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: () => goToSettings("account"), children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] })
                : pageLoading ? _jsx(ListSkeleton, { rows: 8 })
                    : _jsxs(Card, { render: _jsx("section", {}), className: "overflow-hidden rounded-xl shadow-card", children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsx("span", { children: "Repository / Upstream" }), _jsx("span", { className: "max-md:hidden", children: "Divergence" }), _jsx("span", { className: "max-md:hidden", children: "Actions" }), _jsx("span", { className: "text-right", children: "\u64CD\u4F5C" })] }), visible.map((fork) => { const status = upstreamState(fork); const actionStatus = workflowState(fork); return _jsxs("article", { className: "grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsxs("div", { className: "min-w-0", children: [_jsx(Button, { variant: "link", size: "none", onClick: () => void inspectFork(fork), className: "max-w-full truncate text-left text-sm font-semibold", children: fork.fullName }), _jsx("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: _jsxs("span", { className: "truncate", children: ["Upstream: ", fork.parentFullName || "未知"] }) }), _jsxs("div", { className: "mt-1 hidden flex-wrap gap-x-2 text-xs text-muted-foreground max-md:flex", children: [_jsxs("span", { children: ["Ahead ", fork.aheadBy ?? "?"] }), _jsxs("span", { children: ["Behind ", fork.behindBy ?? "?"] }), _jsxs("span", { children: ["Actions ", fork.latestWorkflow ? (fork.latestWorkflow.conclusion || fork.latestWorkflow.status) : "—"] })] })] }), _jsx("div", { className: "text-xs max-md:hidden", children: fork.aheadBy == null || fork.behindBy == null ? _jsx(Badge, { variant: "secondary", children: "unknown" }) : fork.aheadBy === 0 && fork.behindBy === 0 ? _jsx(Badge, { variant: "success", children: "\u5DF2\u540C\u6B65" }) : _jsxs("div", { className: "flex gap-1", children: [_jsxs(Badge, { variant: "secondary", children: ["\u2191 ", fork.aheadBy] }), _jsxs(Badge, { variant: fork.behindBy > 0 ? "warning" : "secondary", children: ["\u2193 ", fork.behindBy] })] }) }), _jsx("div", { className: "min-w-0 text-xs max-md:hidden", children: fork.latestWorkflow ? _jsxs("a", { href: fork.latestWorkflow.htmlUrl, target: "_blank", rel: "noreferrer", className: "flex min-w-0 items-center gap-1 hover:underline", children: [_jsx("span", { className: cn("size-2 shrink-0 rounded-full", actionStatus === "success" ? "bg-emerald-500" : actionStatus === "failure" ? "bg-destructive" : "bg-warning") }), _jsxs("span", { className: "truncate", children: [fork.latestWorkflow.name, " \u00B7 ", fork.latestWorkflow.conclusion || fork.latestWorkflow.status] })] }) : "—" }), _jsxs("div", { className: "flex justify-end gap-1", children: [status === "behind" ? _jsx(Tooltip, { content: "\u540C\u6B65 upstream", children: _jsx(Button, { size: "sm", variant: "outline", loading: syncing === fork.fullName, onClick: () => void syncUpstream(fork), children: "\u540C\u6B65" }) }) : null, _jsx(Tooltip, { content: "\u8BE6\u60C5 / Workflow", children: _jsx(Button, { size: "icon-sm", variant: "ghost", loading: detailLoading === fork.fullName, onClick: () => void inspectFork(fork), "aria-label": "\u67E5\u770B Fork \u8BE6\u60C5", children: _jsx(RiInformationLine, { className: "size-4" }) }) }), _jsx(Button, { render: _jsx("a", { href: fork.htmlUrl, target: "_blank", rel: "noreferrer" }), size: "icon-sm", variant: "ghost", "aria-label": "\u6253\u5F00 Fork", children: _jsx(RiExternalLinkLine, { className: "size-4" }) })] })] }, fork.id); }), !visible.length ? _jsx(Empty, { className: "m-4 min-h-56 border-0", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiGitForkLine, { className: "size-5" }) }), _jsx(EmptyTitle, { children: "\u6682\u65E0\u7B26\u5408\u6761\u4EF6\u7684 Fork" }), _jsx(EmptyDescription, { children: "\u8C03\u6574\u641C\u7D22\u3001Upstream \u6216 Actions \u7B5B\u9009\u6761\u4EF6\u540E\u518D\u8BD5\u3002" })] }) }) : null] }), filtered.length > pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page <= 1, onClick: () => changePage(page - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page >= totalPages, onClick: () => changePage(page + 1) }) }) })] }) }) : null, _jsx(Modal, { open: Boolean(selected), title: selected?.fullName || "Fork", description: selected?.parentFullName ? `Upstream ${selected.parentFullName}` : "Fork 详情", onClose: () => setSelected(null), children: selected ? _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Ahead" }), _jsx("div", { className: "mt-1 font-medium", children: selected.aheadBy ?? "未知" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Behind" }), _jsx("div", { className: "mt-1 font-medium", children: selected.behindBy ?? "未知" })] })] }), selected.latestWorkflow ? _jsxs("div", { className: "rounded-xl bg-secondary/50 p-3 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [workflowState(selected) === "success" ? _jsx(RiCheckboxCircleLine, { className: "size-4 text-success-foreground" }) : workflowState(selected) === "failure" ? _jsx(RiErrorWarningLine, { className: "size-4 text-destructive-foreground" }) : _jsx(RiLoader4Line, { className: "size-4 animate-spin text-warning-foreground" }), "Latest Action \u00B7 ", selected.latestWorkflow.name] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [selected.latestWorkflow.conclusion || selected.latestWorkflow.status, " \u00B7 ", new Date(selected.latestWorkflow.createdAt).toLocaleString("zh-CN")] })] }) : null, _jsxs("div", { className: "rounded-xl border border-border p-4", children: [_jsxs("div", { className: "mb-3", children: [_jsx("h3", { className: "text-sm font-semibold", children: "\u8FD0\u884C GitHub Workflow" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "\u4F7F\u7528 workflow_dispatch \u5728\u5F53\u524D Fork \u4E0A\u624B\u52A8\u89E6\u53D1 Workflow\u3002\u9700\u8981 GitHub Token \u5177\u5907 Actions \u6743\u9650\uFF0C\u4E14\u76EE\u6807 Workflow \u652F\u6301\u624B\u52A8\u89E6\u53D1\u3002" })] }), selected.workflows.length ? _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Workflow", children: _jsx(Select, { value: workflowId, onChange: (event) => setWorkflowId(event.target.value), children: selected.workflows.map((workflow) => _jsxs("option", { value: workflow.id, children: [workflow.name, " \u00B7 ", workflow.state] }, workflow.id)) }) }), _jsx(Field, { label: "Ref / Branch", children: _jsx(Input, { value: workflowRef, onChange: (event) => setWorkflowRef(event.target.value), placeholder: selected.defaultBranch }) }), _jsxs("details", { className: "rounded-xl border border-border px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium", children: "Advanced \u00B7 Inputs JSON" }), _jsx("div", { className: "mt-3", children: _jsxs(Field, { label: "Inputs JSON", error: workflowInputError, children: [_jsx(Textarea, { rows: 3, className: "font-mono text-xs", value: workflowInputs, onChange: (event) => { setWorkflowInputs(event.target.value); setWorkflowInputError(""); }, "aria-invalid": Boolean(workflowInputError) }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["\u5F53\u524D GitHub API \u672A\u63D0\u4F9B workflow_dispatch input schema\uFF1B\u65E0\u53C2\u6570\u4FDD\u6301 ", `{}`, " ", `}`, "\uFF0C\u9700\u8981\u53C2\u6570\u65F6\u586B\u5199 JSON\u3002"] })] }) })] }), _jsx(Button, { loading: dispatching, disabled: !workflowId || !workflowRef.trim(), onClick: () => void runWorkflow(), children: "\u8FD0\u884C Workflow" })] }) : _jsx("p", { className: "text-sm text-muted-foreground", children: "\u6B64 Fork \u6CA1\u6709\u53EF\u89C1\u7684 GitHub Actions Workflow\uFF0C\u6216\u5F53\u524D Token \u65E0\u6743\u8BFB\u53D6 Workflow\u3002" })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [selected.behindBy && selected.behindBy > 0 ? _jsx(Button, { onClick: () => void syncUpstream(selected), loading: syncing === selected.fullName, children: "\u540C\u6B65 upstream" }) : null, _jsxs(Button, { render: _jsx("a", { href: selected.htmlUrl, target: "_blank", rel: "noreferrer" }), variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "\u6253\u5F00 Fork"] }), selected.parentHtmlUrl ? _jsx(Button, { render: _jsx("a", { href: selected.parentHtmlUrl, target: "_blank", rel: "noreferrer" }), variant: "outline", children: "\u6253\u5F00 Upstream" }) : null] })] }) : null })] });
}
