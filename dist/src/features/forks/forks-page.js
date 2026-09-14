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
import { useI18n } from "../../lib/i18n.js";
function upstreamState(fork) { if (fork.behindBy == null || fork.aheadBy == null)
    return "unknown"; if (fork.behindBy > 0)
    return "behind"; if (fork.aheadBy > 0)
    return "ahead"; return "synced"; }
function workflowState(fork) { const run = fork.latestWorkflow; if (!run)
    return "none"; if (run.status && run.status !== "completed")
    return "running"; const conclusion = (run.conclusion || "").toLowerCase(); if (["success", "neutral", "skipped"].includes(conclusion))
    return "success"; if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion))
    return "failure"; return "running"; }
function workflowResultLabel(fork, language) { const state = workflowState(fork); if (language === "en")
    return state === "success" ? "Success" : state === "failure" ? "Failed" : state === "running" ? "Running" : "No runs"; return state === "success" ? "成功" : state === "failure" ? "失败" : state === "running" ? "运行中" : "无运行记录"; }
export function ForksPage({ state, onStateChange: _onStateChange, goToSettings, initialLoading = false }) {
    const { t, locale, language: uiLanguage } = useI18n();
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
            notify(t("Fork 已刷新", "Forks refreshed"), t(`${next.length} 个仓库 · 上游与 Actions 状态已更新`, `${next.length} repositories · upstream and Actions status updated`), "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("Fork 清单读取失败", "Failed to load forks"));
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
            setError(reason instanceof Error ? reason.message : t("Fork 详情读取失败", "Failed to load fork details"));
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
            notify(t("上游已同步", "Upstream synced"), result.message || fork.fullName, "success");
            const detail = await fetchForkDetails(token, fork.fullName);
            setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item));
            setSelected(detail);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("上游同步失败", "Failed to sync upstream"));
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
                throw new Error(t("Inputs 必须是 JSON 对象", "Inputs must be a JSON object"));
            inputs = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
            setWorkflowInputError("");
        }
        catch (reason) {
            setWorkflowInputError(reason instanceof Error ? reason.message : t("输入参数格式无效", "Invalid input format"));
            return;
        }
        setDispatching(true);
        setError("");
        setSuccess("");
        try {
            const result = await dispatchForkWorkflow(token, selected.fullName, Number(workflowId), workflowRef.trim() || selected.defaultBranch, inputs);
            setSuccess("");
            notify(t("Workflow 已触发", "Workflow dispatched"), result.message, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("Workflow 触发失败", "Failed to dispatch workflow"));
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
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Fork" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: t(`${forks.length} 个 Fork · 查看与上游的差异和 Actions 状态。`, `${forks.length} forks · compare upstream differences and Actions status.`) })] }), _jsxs(Button, { onClick: () => void loadForks(), loading: loading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), t("刷新 GitHub", "Refresh GitHub")] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": t("Fork 工具栏", "Fork toolbar"), children: [_jsx(ToolbarGroup, { className: "min-w-[240px] flex-1", children: _jsxs(InputGroup, { className: "min-w-[220px]", children: [_jsx(InputGroupInput, { type: "search", "data-search-shortcut": "true", "aria-label": t("搜索 Fork", "Search forks"), value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: t("搜索 Fork / 上游 / Workflow", "Search fork / upstream / workflow") }), _jsx(InputGroupAddon, { children: _jsx(RiSearchLine, { className: "size-4", "aria-hidden": "true" }) })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { children: [_jsxs(Select, { "aria-label": t("筛选上游状态", "Filter upstream status"), value: upstreamFilter, onChange: (event) => { setUpstreamFilter(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: t("全部上游", "All upstream") }), _jsx("option", { value: "behind", children: t("落后", "Behind") }), _jsx("option", { value: "ahead", children: t("领先", "Ahead") }), _jsx("option", { value: "synced", children: t("已同步", "Synced") }), _jsx("option", { value: "unknown", children: t("未知", "Unknown") })] }), _jsxs(Select, { "aria-label": t("筛选 Actions 状态", "Filter Actions status"), value: workflowFilter, onChange: (event) => { setWorkflowFilter(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "all", children: t("全部 Actions", "All Actions") }), _jsx("option", { value: "success", children: t("成功", "Success") }), _jsx("option", { value: "failure", children: t("失败", "Failed") }), _jsx("option", { value: "running", children: t("运行中", "Running") }), _jsx("option", { value: "none", children: t("无运行记录", "No runs") })] }), _jsxs(Select, { "aria-label": t("Fork 排序方式", "Fork sort order"), value: sort, onChange: (event) => { setSort(event.target.value); setPage(1); }, className: "min-w-32", children: [_jsx("option", { value: "updated", children: t("更新时间", "Updated") }), _jsx("option", { value: "behind", children: t("落后数量", "Behind count") }), _jsx("option", { value: "ahead", children: t("领先数量", "Ahead count") }), _jsx("option", { value: "name", children: t("名称", "Name") })] }), _jsx(Tooltip, { content: direction === "desc" ? t("当前逆序，点击切换正序", "Descending; switch to ascending") : t("当前正序，点击切换逆序", "Ascending; switch to descending"), children: _jsx(Button, { variant: "outline", size: "icon", "aria-label": direction === "desc" ? t("切换为正序", "Switch to ascending") : t("切换为逆序", "Switch to descending"), onClick: () => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }, children: _jsx(RiArrowDownLine, { className: cn("size-4 transition-transform", direction === "asc" && "rotate-180") }) }) })] })] }), _jsx("div", { ref: resultsTopRef }), !hasGithubCredential ? _jsxs("div", { className: "rounded-xl border border-dashed border-border p-8 text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: t("连接 GitHub 凭据后才能读取已 Fork 仓库。", "Connect GitHub credentials to load forked repositories.") }), _jsxs(Button, { className: "mt-3", variant: "outline", onClick: () => goToSettings("account"), children: [_jsx(RiSettings4Line, { className: "size-4" }), t("打开设置", "Open Settings")] })] })
                : pageLoading ? _jsx(ListSkeleton, { rows: 8 })
                    : _jsxs(Card, { render: _jsx("section", {}), className: "overflow-hidden rounded-xl shadow-card", children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsx("span", { children: t("Fork / 上游", "Fork / Upstream") }), _jsx("span", { className: "max-md:hidden", children: t("与上游", "Upstream") }), _jsx("span", { className: "max-md:hidden", children: "Actions" }), _jsx("span", { className: "text-right", children: t("操作", "Actions") })] }), visible.map((fork) => { const status = upstreamState(fork); const actionStatus = workflowState(fork); return _jsxs("article", { className: "grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]", children: [_jsxs("div", { className: "min-w-0", children: [_jsx(Button, { variant: "link", size: "none", onClick: () => void inspectFork(fork), className: "max-w-full truncate text-left text-sm font-semibold", children: fork.fullName }), _jsx("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: _jsxs("span", { className: "truncate", children: [t("上游：", "Upstream: "), fork.parentFullName || t("未知", "Unknown")] }) }), _jsxs("div", { className: "mt-1 hidden flex-wrap gap-x-2 text-xs text-muted-foreground max-md:flex", children: [_jsxs("span", { children: [t("领先", "Ahead"), " ", fork.aheadBy ?? "?"] }), _jsxs("span", { children: [t("落后", "Behind"), " ", fork.behindBy ?? "?"] }), _jsxs("span", { children: ["Actions ", fork.latestWorkflow ? workflowResultLabel(fork, uiLanguage) : "—"] })] })] }), _jsx("div", { className: "text-xs max-md:hidden", children: fork.aheadBy == null || fork.behindBy == null ? _jsx(Badge, { variant: "secondary", children: t("未知", "Unknown") }) : fork.aheadBy === 0 && fork.behindBy === 0 ? _jsx(Badge, { variant: "success", children: t("已同步", "Synced") }) : _jsxs("div", { className: "flex gap-1", children: [_jsxs(Badge, { variant: "secondary", children: ["\u2191 ", fork.aheadBy] }), _jsxs(Badge, { variant: fork.behindBy > 0 ? "warning" : "secondary", children: ["\u2193 ", fork.behindBy] })] }) }), _jsx("div", { className: "min-w-0 text-xs max-md:hidden", children: fork.latestWorkflow ? _jsxs("a", { href: fork.latestWorkflow.htmlUrl, target: "_blank", rel: "noreferrer", className: "flex min-w-0 items-center gap-1 hover:underline", children: [_jsx("span", { className: cn("size-2 shrink-0 rounded-full", actionStatus === "success" ? "bg-emerald-500" : actionStatus === "failure" ? "bg-destructive" : "bg-warning") }), _jsxs("span", { className: "truncate", children: [fork.latestWorkflow.name, " \u00B7 ", workflowResultLabel(fork, uiLanguage)] })] }) : "—" }), _jsxs("div", { className: "flex justify-end gap-1", children: [status === "behind" ? _jsx(Tooltip, { content: t("同步上游", "Sync upstream"), children: _jsx(Button, { size: "sm", variant: "outline", loading: syncing === fork.fullName, onClick: () => void syncUpstream(fork), children: t("同步", "Sync") }) }) : null, _jsx(Tooltip, { content: t("详情 / Workflow", "Details / Workflow"), children: _jsx(Button, { size: "icon-sm", variant: "ghost", loading: detailLoading === fork.fullName, onClick: () => void inspectFork(fork), "aria-label": t("查看 Fork 详情", "View fork details"), children: _jsx(RiInformationLine, { className: "size-4" }) }) }), _jsx(Button, { render: _jsx("a", { href: fork.htmlUrl, target: "_blank", rel: "noreferrer" }), size: "icon-sm", variant: "ghost", "aria-label": t("打开 Fork", "Open fork"), children: _jsx(RiExternalLinkLine, { className: "size-4" }) })] })] }, fork.id); }), !visible.length ? _jsx(Empty, { className: "m-4 min-h-56 border-0", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiGitForkLine, { className: "size-5" }) }), _jsx(EmptyTitle, { children: t("暂无符合条件的 Fork", "No forks match") }), _jsx(EmptyDescription, { children: t("调整搜索、上游或 Actions 筛选条件后再试。", "Adjust search, upstream, or Actions filters and try again.") })] }) }) : null] }), filtered.length > pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page <= 1, onClick: () => changePage(page - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page >= totalPages, onClick: () => changePage(page + 1) }) }) })] }) }) : null, _jsx(Modal, { open: Boolean(selected), title: selected?.fullName || "Fork", description: selected?.parentFullName ? t(`上游 ${selected.parentFullName}`, `Upstream ${selected.parentFullName}`) : t("Fork 详情", "Fork details"), onClose: () => setSelected(null), children: selected ? _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t("领先", "Ahead") }), _jsx("div", { className: "mt-1 font-medium", children: selected.aheadBy ?? t("未知", "Unknown") })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t("落后", "Behind") }), _jsx("div", { className: "mt-1 font-medium", children: selected.behindBy ?? t("未知", "Unknown") })] })] }), selected.latestWorkflow ? _jsxs("div", { className: "rounded-xl bg-secondary/50 p-3 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [workflowState(selected) === "success" ? _jsx(RiCheckboxCircleLine, { className: "size-4 text-success-foreground" }) : workflowState(selected) === "failure" ? _jsx(RiErrorWarningLine, { className: "size-4 text-destructive-foreground" }) : _jsx(RiLoader4Line, { className: "size-4 animate-spin text-warning-foreground" }), t("最近一次 Action", "Latest Action"), " \u00B7 ", selected.latestWorkflow.name] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [workflowResultLabel(selected, uiLanguage), " \u00B7 ", new Date(selected.latestWorkflow.createdAt).toLocaleString(locale)] })] }) : null, _jsxs("div", { className: "rounded-xl border border-border p-4", children: [_jsxs("div", { className: "mb-3", children: [_jsx("h3", { className: "text-sm font-semibold", children: t("运行 GitHub Workflow", "Run GitHub Workflow") }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t("在当前 Fork 上手动运行 Workflow。需要 GitHub Token 具备 Actions 权限，且目标 Workflow 支持手动运行。", "Run a Workflow manually on this fork. The GitHub Token needs Actions access and the target Workflow must support manual dispatch.") })] }), selected.workflows.length ? _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Workflow", children: _jsx(Select, { value: workflowId, onChange: (event) => setWorkflowId(event.target.value), children: selected.workflows.map((workflow) => _jsxs("option", { value: workflow.id, children: [workflow.name, " \u00B7 ", workflow.state] }, workflow.id)) }) }), _jsx(Field, { label: t("分支 / Ref", "Branch / Ref"), children: _jsx(Input, { value: workflowRef, onChange: (event) => setWorkflowRef(event.target.value), placeholder: selected.defaultBranch }) }), _jsxs("details", { className: "rounded-xl border border-border px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium", children: t("高级设置 · 输入参数", "Advanced · Inputs") }), _jsx("div", { className: "mt-3", children: _jsxs(Field, { label: t("输入参数", "Inputs"), error: workflowInputError, children: [_jsx(Textarea, { rows: 3, className: "font-mono text-xs", value: workflowInputs, onChange: (event) => { setWorkflowInputs(event.target.value); setWorkflowInputError(""); }, "aria-invalid": Boolean(workflowInputError) }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [t("仅在 Workflow 需要额外参数时填写 JSON；无参数时保持", "Provide JSON only when the Workflow needs extra inputs; otherwise keep"), " ", `{}`, " ", `}`, t("，需要参数时填写 JSON。", "; provide JSON when inputs are required.")] })] }) })] }), _jsx(Button, { loading: dispatching, disabled: !workflowId || !workflowRef.trim(), onClick: () => void runWorkflow(), children: t("运行 Workflow", "Run Workflow") })] }) : _jsx("p", { className: "text-sm text-muted-foreground", children: t("此 Fork 没有可见的 GitHub Actions Workflow，或当前 Token 无权读取 Workflow。", "This fork has no visible GitHub Actions Workflow, or the current token cannot read Workflows.") })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [selected.behindBy && selected.behindBy > 0 ? _jsx(Button, { onClick: () => void syncUpstream(selected), loading: syncing === selected.fullName, children: t("同步上游", "Sync upstream") }) : null, _jsxs(Button, { render: _jsx("a", { href: selected.htmlUrl, target: "_blank", rel: "noreferrer" }), variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), t("打开 Fork", "Open fork")] }), selected.parentHtmlUrl ? _jsx(Button, { render: _jsx("a", { href: selected.parentHtmlUrl, target: "_blank", rel: "noreferrer" }), variant: "outline", children: t("打开上游", "Open upstream") }) : null] })] }) : null })] });
}
