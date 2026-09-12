import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { RiAddLine, RiCheckboxCircleLine, RiCloseCircleLine, RiExternalLinkLine, RiGitForkLine, RiLoader4Line, RiRefreshLine, RiSearchLine, RiSettings4Line, } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { useCallback, useEffect, useMemo, useState } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/react.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { Select } from "../../components/ui/select.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { fetchForkDetails, fetchForkRepositories, fetchForkStatus, syncForkUpstream } from "../../lib/api.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
import { ForkDialog } from "./fork-dialog.js";
export function ForksPage({ state, onStateChange, goToSettings }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [source, setSource] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [forks, setForks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState("");
    const [syncing, setSyncing] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const repositories = useMemo(() => [...state.repositories].sort((a, b) => a.full_name.localeCompare(b.full_name)), [state.repositories]);
    const loadForks = useCallback(async () => {
        if (!hasGithubCredential)
            return;
        setLoading(true);
        setError("");
        try {
            const next = await fetchForkRepositories(token);
            setForks(next);
            setSuccess(`已读取 ${next.length} 个 Fork`);
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
    async function addJob(job) { try {
        await runOptimisticMutation(state, { ...state, forkJobs: [job, ...state.forkJobs.filter((item) => item.targetFullName !== job.targetFullName)] }, onStateChange, { operation: "fork.create", payload: { fullName: job.targetFullName, parentFullName: job.sourceFullName, status: job.status } });
        setSuccess(`Fork 已提交：${job.targetFullName}`);
        setSource("");
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Fork 任务保存失败");
    } }
    async function refreshJob(job) {
        if (!hasGithubCredential)
            return job;
        try {
            const result = await fetchForkStatus(token, job.targetFullName);
            if (result.status === "ready")
                return { ...job, status: "ready", htmlUrl: result.htmlUrl || job.htmlUrl, updatedAt: new Date().toISOString(), error: "", pollAttempts: 0, nextPollAt: null };
            const attempts = (job.pollAttempts ?? 0) + 1;
            if (attempts >= 8)
                return { ...job, status: "failed", updatedAt: new Date().toISOString(), error: "Fork 创建等待超时，可手动重试", pollAttempts: attempts, nextPollAt: null };
            const delayMs = Math.min(60000, 2000 * (2 ** Math.max(0, attempts - 1)));
            return { ...job, status: "pending", htmlUrl: result.htmlUrl || job.htmlUrl, updatedAt: new Date().toISOString(), error: "", pollAttempts: attempts, nextPollAt: new Date(Date.now() + delayMs).toISOString() };
        }
        catch (reason) {
            return { ...job, status: "failed", updatedAt: new Date().toISOString(), error: reason instanceof Error ? reason.message : "状态读取失败", nextPollAt: null };
        }
    }
    const pollPending = useCallback(async () => {
        const now = Date.now();
        const pending = state.forkJobs.filter((job) => job.status === "pending" && (!job.nextPollAt || new Date(job.nextPollAt).getTime() <= now));
        if (!hasGithubCredential || !pending.length)
            return;
        const updates = await Promise.all(pending.map(refreshJob));
        const byId = new Map(updates.map((job) => [job.id, job]));
        const next = state.forkJobs.map((job) => byId.get(job.id) ?? job);
        if (updates.some((job) => job.status === "ready"))
            void loadForks();
        onStateChange({ ...state, forkJobs: next });
    }, [hasGithubCredential, token, state.forkJobs, loadForks]);
    useEffect(() => { if (!state.forkJobs.some((job) => job.status === "pending"))
        return; const timer = window.setInterval(() => { void pollPending(); }, 1000); return () => window.clearInterval(timer); }, [state.forkJobs, pollPending]);
    async function refreshAllJobs() { if (!hasGithubCredential)
        return goToSettings(); setLoading(true); setError(""); try {
        const next = [];
        for (let index = 0; index < state.forkJobs.length; index += 5)
            next.push(...await Promise.all(state.forkJobs.slice(index, index + 5).map(refreshJob)));
        onStateChange({ ...state, forkJobs: next });
        setSuccess("Fork 创建任务状态已刷新");
        await loadForks();
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "刷新失败");
    }
    finally {
        setLoading(false);
    } }
    async function retryJob(job) { const nextJob = { ...job, status: "pending", error: "", pollAttempts: 0, nextPollAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; try {
        await runOptimisticMutation(state, { ...state, forkJobs: state.forkJobs.map((item) => item.id === job.id ? nextJob : item) }, onStateChange, { operation: "fork.retry", payload: { fullName: job.targetFullName } });
        setSuccess(`已重试 ${job.targetFullName}`);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Fork 重试失败");
    } }
    async function removeJob(job) { try {
        await runOptimisticMutation(state, { ...state, forkJobs: state.forkJobs.filter((item) => item.id !== job.id) }, onStateChange, { operation: "fork.remove", payload: { fullName: job.targetFullName, status: "deleted" } });
        setSuccess(`已移除 ${job.targetFullName}`);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Fork 任务移除失败");
    } }
    async function inspectFork(fork) {
        if (!hasGithubCredential)
            return goToSettings();
        setDetailLoading(fork.fullName);
        setError("");
        try {
            const detail = await fetchForkDetails(token, fork.fullName);
            setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item));
            setSelected(detail);
            await runOptimisticMutation(state, { ...state, forkReadAt: { ...state.forkReadAt, [detail.fullName]: new Date().toISOString() } }, onStateChange, { operation: "fork.read", payload: { fullName: detail.fullName } });
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
    const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return forks.filter((fork) => !needle || [fork.fullName, fork.parentFullName, fork.description].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [forks, query]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [page, totalPages]);
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6 flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Fork" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u5B8C\u6574 Fork \u6E05\u5355\u3001\u521B\u5EFA\u4EFB\u52A1\u81EA\u52A8\u8F6E\u8BE2\u3001\u4E0A\u6E38\u5DEE\u5F02\u3001\u4E00\u952E\u540C\u6B65\u4E0E\u6700\u65B0 Actions \u72B6\u6001\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "GitHub \u8BBE\u7F6E"] }), _jsxs(Button, { onClick: () => void refreshAllJobs(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0\u5168\u90E8"] })] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Card, { className: "mb-5 flex-row flex-wrap gap-2 rounded-xl p-3 shadow-card", children: [_jsxs(Select, { value: source, onChange: (event) => setSource(event.target.value), className: "min-w-[260px] flex-1", children: [_jsx("option", { value: "", children: "\u9009\u62E9\u8981 Fork \u7684 Stars \u4ED3\u5E93\u2026" }), repositories.map((repo) => _jsx("option", { value: repo.full_name, children: repo.full_name }, repo.full_name))] }), _jsxs(Button, { disabled: !source, onClick: () => setDialogOpen(true), children: [_jsx(RiAddLine, { className: "size-4" }), "\u521B\u5EFA Fork"] }), _jsxs("div", { className: "relative min-w-[240px] flex-1", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "pl-9", value: query, onChange: (event) => { setQuery(event.target.value); setPage(1); }, placeholder: "\u641C\u7D22 Fork / \u4E0A\u6E38\u4ED3\u5E93" })] }), _jsxs(Select, { value: String(pageSize), onChange: (event) => { setPageSize(Number(event.target.value)); setPage(1); }, children: [_jsx("option", { value: "10", children: "10 / \u9875" }), _jsx("option", { value: "20", children: "20 / \u9875" }), _jsx("option", { value: "50", children: "50 / \u9875" })] })] }), state.forkJobs.length ? _jsxs(Card, { render: _jsx("section", {}), className: "mb-5 rounded-xl shadow-card", children: [_jsx("div", { className: "border-b border-border px-4 py-3 text-sm font-semibold", children: "\u521B\u5EFA\u4EFB\u52A1" }), state.forkJobs.map((job, index) => { const Icon = job.status === "ready" ? RiCheckboxCircleLine : job.status === "failed" ? RiCloseCircleLine : RiLoader4Line; return _jsxs("article", { className: `grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] ${index ? "border-t border-border" : ""}`, children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Icon, { className: `size-4 ${job.status === "pending" ? "animate-spin text-muted-foreground" : job.status === "ready" ? "text-emerald-600" : "text-destructive"}` }), _jsx("span", { className: "truncate text-sm font-medium", children: job.targetFullName }), _jsx(Badge, { children: job.status })] }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: ["\u6765\u6E90 ", job.sourceFullName, " \u00B7 \u66F4\u65B0 ", new Date(job.updatedAt).toLocaleString("zh-CN"), job.status === "pending" ? ` · 第 ${job.pollAttempts ?? 0} 次检查` : ""] }), job.error ? _jsx("p", { className: "mt-1 text-xs text-destructive-foreground", children: job.error }) : null] }), _jsxs("div", { className: "flex items-center gap-1", children: [job.htmlUrl ? _jsx("a", { href: job.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { size: "sm", variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "\u76EE\u6807"] }) }) : null, job.status === "failed" ? _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void retryJob(job); }, children: "\u91CD\u8BD5" }) : null, _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { void removeJob(job); }, children: "\u79FB\u9664" })] })] }, job.id); })] }) : null, _jsxs(Card, { render: _jsx("section", {}), className: "overflow-hidden rounded-xl shadow-card", children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground", children: [_jsxs("span", { children: ["\u6211\u7684 Forks \u00B7 ", filtered.length] }), _jsx("span", { children: "\u4E0A\u6E38 / Actions" })] }), visible.map((fork, index) => { const readAt = state.forkReadAt[fork.fullName]; const unread = !readAt || new Date(fork.pushedAt).getTime() > new Date(readAt).getTime(); return _jsxs("article", { className: `grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] ${index ? "border-t border-border" : ""}`, children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(RiGitForkLine, { className: "size-4 text-muted-foreground" }), _jsx(Button, { variant: "link", size: "none", onClick: () => void inspectFork(fork), className: "truncate text-left text-sm font-semibold", children: fork.fullName }), unread ? _jsx(Badge, { children: "unread" }) : null, fork.behindBy != null && fork.behindBy > 0 ? _jsxs(Badge, { children: [fork.behindBy, " behind"] }) : null] }), _jsxs("p", { className: "mt-1 truncate text-xs text-muted-foreground", children: [fork.parentFullName ? `上游 ${fork.parentFullName}` : "上游信息待加载", " \u00B7 pushed ", new Date(fork.pushedAt).toLocaleString("zh-CN")] }), fork.latestWorkflow ? _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: ["Actions: ", fork.latestWorkflow.name, " \u00B7 ", fork.latestWorkflow.conclusion || fork.latestWorkflow.status] }) : null] }), _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-1", children: [_jsx(Button, { size: "sm", variant: "outline", loading: detailLoading === fork.fullName, onClick: () => void inspectFork(fork), children: "\u68C0\u67E5" }), fork.behindBy != null && fork.behindBy > 0 ? _jsx(Button, { size: "sm", loading: syncing === fork.fullName, onClick: () => void syncUpstream(fork), children: "\u540C\u6B65\u4E0A\u6E38" }) : null, _jsx("a", { href: fork.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "ghost", size: "icon-sm", children: _jsx(RiExternalLinkLine, { className: "size-4" }) }) })] })] }, fork.fullName); }), !visible.length ? _jsx("div", { className: "grid min-h-56 place-items-center text-sm text-muted-foreground", children: loading ? "正在读取 Fork 清单…" : "没有匹配的 Fork" }) : null] }), filtered.length > pageSize ? _jsx(Pagination, { className: "mt-5", children: _jsxs(PaginationContent, { children: [_jsx(PaginationItem, { children: _jsx(PaginationPrevious, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page <= 1, onClick: () => setPage((value) => value - 1) }) }) }), _jsx(PaginationItem, { children: _jsxs("span", { className: "px-2 text-xs text-muted-foreground", children: [page, "/", totalPages] }) }), _jsx(PaginationItem, { children: _jsx(PaginationNext, { render: _jsx(Button, { size: "sm", variant: "outline", disabled: page >= totalPages, onClick: () => setPage((value) => value + 1) }) }) })] }) }) : null, _jsx(ForkDialog, { open: dialogOpen, token: state.settings.githubToken, credentialConnected: state.settings.credentialConnected, sourceFullName: source, onClose: () => setDialogOpen(false), onCreated: (job) => { void addJob(job); } }), _jsx(Modal, { open: Boolean(selected), title: selected?.fullName || "Fork 详情", description: selected?.parentFullName ? `上游 ${selected.parentFullName}` : "Fork 详情", onClose: () => setSelected(null), children: _jsx("div", { className: "grid gap-4", children: selected ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs("div", { className: "rounded-lg bg-secondary/50 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Ahead" }), _jsx("div", { className: "mt-1 text-lg font-semibold", children: selected.aheadBy ?? "—" })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Behind" }), _jsx("div", { className: "mt-1 text-lg font-semibold", children: selected.behindBy ?? "—" })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Compare" }), _jsx("div", { className: "mt-1 truncate text-sm font-semibold", children: selected.compareStatus })] })] }), selected.latestWorkflow ? _jsxs("div", { className: "rounded-xl border border-border p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "\u6700\u65B0 Actions" }), _jsxs("div", { className: "mt-1 flex items-center justify-between gap-3 text-sm", children: [_jsxs("span", { children: [selected.latestWorkflow.name, " \u00B7 ", selected.latestWorkflow.conclusion || selected.latestWorkflow.status] }), _jsx("a", { href: selected.latestWorkflow.htmlUrl, target: "_blank", rel: "noreferrer", className: "text-xs hover:underline", children: "\u67E5\u770B" })] })] }) : _jsx("div", { className: "rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground", children: "\u6682\u65E0 Actions \u8FD0\u884C\u8BB0\u5F55\u6216 Token \u65E0 Actions \u8BFB\u53D6\u6743\u9650\u3002" }), _jsxs("div", { className: "flex gap-2", children: [(selected.behindBy ?? 0) > 0 ? _jsx(Button, { loading: syncing === selected.fullName, onClick: () => void syncUpstream(selected), children: "\u540C\u6B65\u4E0A\u6E38" }) : _jsx(Button, { variant: "secondary", disabled: true, children: "\u65E0\u9700\u540C\u6B65" }), _jsx("a", { href: selected.htmlUrl, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub"] }) })] })] }) : null }) })] }));
}
