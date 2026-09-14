import {
  RiArrowDownLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiLoader4Line,
  RiExternalLinkLine,
  RiGitForkLine,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Modal } from "../../components/ui/modal";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { ListSkeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Textarea } from "../../components/ui/textarea";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { dispatchForkWorkflow, fetchForkDetails, fetchForkRepositories, syncForkUpstream } from "../../lib/api";
import { cn } from "../../lib/cn";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { ForkRepository, PersistedState } from "../../types";

type UpstreamFilter = "all" | "behind" | "ahead" | "synced" | "unknown";
type WorkflowFilter = "all" | "success" | "failure" | "running" | "none";
type ForkSort = "updated" | "behind" | "ahead" | "name";
type SortDirection = "asc" | "desc";

function upstreamState(fork: ForkRepository): Exclude<UpstreamFilter, "all"> { if (fork.behindBy == null || fork.aheadBy == null) return "unknown"; if (fork.behindBy > 0) return "behind"; if (fork.aheadBy > 0) return "ahead"; return "synced"; }
function workflowState(fork: ForkRepository): Exclude<WorkflowFilter, "all"> { const run = fork.latestWorkflow; if (!run) return "none"; if (run.status && run.status !== "completed") return "running"; const conclusion = (run.conclusion || "").toLowerCase(); if (["success", "neutral", "skipped"].includes(conclusion)) return "success"; if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion)) return "failure"; return "running"; }
function workflowResultLabel(fork: ForkRepository, language: "zh-CN" | "en") { const state = workflowState(fork); if (language === "en") return state === "success" ? "Success" : state === "failure" ? "Failed" : state === "running" ? "Running" : "No runs"; return state === "success" ? "成功" : state === "failure" ? "失败" : state === "running" ? "运行中" : "无运行记录"; }

export function ForksPage({ state, onStateChange: _onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: (tab?: string) => void; initialLoading?: boolean }) {
  const { t, locale, language: uiLanguage } = useI18n();
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [forks, setForks] = useState<ForkRepository[]>([]);
  const [selected, setSelected] = useState<ForkRepository | null>(null);
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [upstreamFilter, setUpstreamFilter] = useState<UpstreamFilter>(() => { const v = readQueryParam("upstream"); return ["behind","ahead","synced","unknown"].includes(v) ? v as UpstreamFilter : "all"; });
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>(() => { const v = readQueryParam("actions"); return ["success","failure","running","none"].includes(v) ? v as WorkflowFilter : "all"; });
  const [sort, setSort] = useState<ForkSort>(() => { const v = readQueryParam("sort"); return ["behind","ahead","name"].includes(v) ? v as ForkSort : "updated"; });
  const [direction, setDirection] = useState<SortDirection>(() => readQueryParam("direction") === "asc" ? "asc" : "desc");
  const [page, setPage] = useState(() => readQueryNumber("page", 1));
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
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
    if (!hasGithubCredential) return;
    setLoading(true); setError(""); setSuccess("");
    try { const next = await fetchForkRepositories(token); setForks(next); setSuccess(""); notify(t("Fork 已刷新", "Forks refreshed"), t(`${next.length} 个仓库 · 上游与 Actions 状态已更新`, `${next.length} repositories · upstream and Actions status updated`), "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("Fork 清单读取失败", "Failed to load forks")); }
    finally { setLoading(false); }
  }, [hasGithubCredential, token]);
  useEffect(() => { if (hasGithubCredential) void loadForks(); }, [hasGithubCredential, loadForks]);
  useEffect(() => { if (!selected) return; const first = selected.workflows.find((item) => item.state === "active") || selected.workflows[0]; setWorkflowId(first ? String(first.id) : ""); setWorkflowRef(selected.defaultBranch || "main"); setWorkflowInputs("{}"); setWorkflowInputError(""); }, [selected?.fullName, selected?.workflows]);

  async function inspectFork(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setDetailLoading(fork.fullName); setError("");
    try { const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? { ...detail, workflows: item.workflows.length ? item.workflows : detail.workflows } : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("Fork 详情读取失败", "Failed to load fork details")); }
    finally { setDetailLoading(""); }
  }
  async function syncUpstream(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setSyncing(fork.fullName); setError("");
    try { const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch); setSuccess(""); notify(t("上游已同步", "Upstream synced"), result.message || fork.fullName, "success"); const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("上游同步失败", "Failed to sync upstream")); }
    finally { setSyncing(""); }
  }
  async function runWorkflow() {
    if (!selected || !workflowId) return;
    let inputs: Record<string, string> = {};
    try { const parsed = workflowInputs.trim() ? JSON.parse(workflowInputs) as unknown : {}; if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(t("Inputs 必须是 JSON 对象", "Inputs must be a JSON object")); inputs = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])); setWorkflowInputError(""); }
    catch (reason) { setWorkflowInputError(reason instanceof Error ? reason.message : t("输入参数格式无效", "Invalid input format")); return; }
    setDispatching(true); setError(""); setSuccess("");
    try { const result = await dispatchForkWorkflow(token, selected.fullName, Number(workflowId), workflowRef.trim() || selected.defaultBranch, inputs); setSuccess(""); notify(t("Workflow 已触发", "Workflow dispatched"), result.message, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("Workflow 触发失败", "Failed to dispatch workflow")); }
    finally { setDispatching(false); }
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
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  function changePage(next: number) { setPage(Math.max(1, Math.min(totalPages, next))); requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" })); }
  const pageLoading = (initialLoading || loading) && !forks.length;

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Fork</h1><p className="mt-1 text-sm text-muted-foreground">{t(`${forks.length} 个 Fork · 查看与上游的差异和 Actions 状态。`, `${forks.length} forks · compare upstream differences and Actions status.`)}</p></div><Button onClick={() => void loadForks()} loading={loading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />{t("刷新 GitHub", "Refresh GitHub")}</Button></header>
    <StatusBanner error={error} success={!error ? success : ""} />
    <Toolbar className="mb-5" aria-label={t("Fork 工具栏", "Fork toolbar")}><ToolbarGroup className="min-w-[240px] flex-1"><InputGroup className="min-w-[220px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索 Fork", "Search forks")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索 Fork / 上游 / Workflow", "Search fork / upstream / workflow")} /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></ToolbarGroup><ToolbarSeparator /><ToolbarGroup><Select aria-label={t("筛选上游状态", "Filter upstream status")} value={upstreamFilter} onChange={(event) => { setUpstreamFilter(event.target.value as UpstreamFilter); setPage(1); }} className="min-w-32"><option value="all">{t("全部上游", "All upstream")}</option><option value="behind">{t("落后", "Behind")}</option><option value="ahead">{t("领先", "Ahead")}</option><option value="synced">{t("已同步", "Synced")}</option><option value="unknown">{t("未知", "Unknown")}</option></Select><Select aria-label={t("筛选 Actions 状态", "Filter Actions status")} value={workflowFilter} onChange={(event) => { setWorkflowFilter(event.target.value as WorkflowFilter); setPage(1); }} className="min-w-32"><option value="all">{t("全部 Actions", "All Actions")}</option><option value="success">{t("成功", "Success")}</option><option value="failure">{t("失败", "Failed")}</option><option value="running">{t("运行中", "Running")}</option><option value="none">{t("无运行记录", "No runs")}</option></Select><Select aria-label={t("Fork 排序方式", "Fork sort order")} value={sort} onChange={(event) => { setSort(event.target.value as ForkSort); setPage(1); }} className="min-w-32"><option value="updated">{t("更新时间", "Updated")}</option><option value="behind">{t("落后数量", "Behind count")}</option><option value="ahead">{t("领先数量", "Ahead count")}</option><option value="name">{t("名称", "Name")}</option></Select><Tooltip content={direction === "desc" ? t("当前逆序，点击切换正序", "Descending; switch to ascending") : t("当前正序，点击切换逆序", "Ascending; switch to descending")}><Button variant="outline" size="icon" aria-label={direction === "desc" ? t("切换为正序", "Switch to ascending") : t("切换为逆序", "Switch to descending")} onClick={() => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }}><RiArrowDownLine className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} /></Button></Tooltip></ToolbarGroup></Toolbar>

    <div ref={resultsTopRef} />
    {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">{t("连接 GitHub 凭据后才能读取已 Fork 仓库。", "Connect GitHub credentials to load forked repositories.")}</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><RiSettings4Line className="size-4" />{t("打开设置", "Open Settings")}</Button></div>
      : pageLoading ? <ListSkeleton rows={8} />
        : <Card render={<section />} className="overflow-hidden rounded-xl shadow-card"><div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]"><span>{t("Fork / 上游", "Fork / Upstream")}</span><span className="max-md:hidden">{t("与上游", "Upstream")}</span><span className="max-md:hidden">Actions</span><span className="text-right">{t("操作", "Actions")}</span></div>{visible.map((fork) => { const status = upstreamState(fork); const actionStatus = workflowState(fork); return <article key={fork.id} className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]"><div className="min-w-0"><Button variant="link" size="none" onClick={() => void inspectFork(fork)} className="max-w-full truncate text-left text-sm font-semibold">{fork.fullName}</Button><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="truncate">{t("上游：", "Upstream: ")}{fork.parentFullName || t("未知", "Unknown")}</span></div><div className="mt-1 hidden flex-wrap gap-x-2 text-xs text-muted-foreground max-md:flex"><span>{t("领先", "Ahead")} {fork.aheadBy ?? "?"}</span><span>{t("落后", "Behind")} {fork.behindBy ?? "?"}</span><span>Actions {fork.latestWorkflow ? workflowResultLabel(fork, uiLanguage) : "—"}</span></div></div><div className="text-xs max-md:hidden">{fork.aheadBy == null || fork.behindBy == null ? <Badge variant="secondary">{t("未知", "Unknown")}</Badge> : fork.aheadBy === 0 && fork.behindBy === 0 ? <Badge variant="success">{t("已同步", "Synced")}</Badge> : <div className="flex gap-1"><Badge variant="secondary">↑ {fork.aheadBy}</Badge><Badge variant={fork.behindBy > 0 ? "warning" : "secondary"}>↓ {fork.behindBy}</Badge></div>}</div><div className="min-w-0 text-xs max-md:hidden">{fork.latestWorkflow ? <a href={fork.latestWorkflow.htmlUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 hover:underline"><span className={cn("size-2 shrink-0 rounded-full", actionStatus === "success" ? "bg-emerald-500" : actionStatus === "failure" ? "bg-destructive" : "bg-warning")} /><span className="truncate">{fork.latestWorkflow.name} · {workflowResultLabel(fork, uiLanguage)}</span></a> : "—"}</div><div className="flex justify-end gap-1">{status === "behind" ? <Tooltip content={t("同步上游", "Sync upstream")}><Button size="sm" variant="outline" loading={syncing === fork.fullName} onClick={() => void syncUpstream(fork)}>{t("同步", "Sync")}</Button></Tooltip> : null}<Tooltip content={t("详情 / Workflow", "Details / Workflow")}><Button size="icon-sm" variant="ghost" loading={detailLoading === fork.fullName} onClick={() => void inspectFork(fork)} aria-label={t("查看 Fork 详情", "View fork details")}><RiInformationLine className="size-4" /></Button></Tooltip><Button render={<a href={fork.htmlUrl} target="_blank" rel="noreferrer" />} size="icon-sm" variant="ghost" aria-label={t("打开 Fork", "Open fork")}><RiExternalLinkLine className="size-4" /></Button></div></article>; })}{!visible.length ? <Empty className="m-4 min-h-56 border-0"><EmptyContent><EmptyIcon><RiGitForkLine className="size-5" /></EmptyIcon><EmptyTitle>{t("暂无符合条件的 Fork", "No forks match")}</EmptyTitle><EmptyDescription>{t("调整搜索、上游或 Actions 筛选条件后再试。", "Adjust search, upstream, or Actions filters and try again.")}</EmptyDescription></EmptyContent></Empty> : null}</Card>}
    {filtered.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}

    <Modal open={Boolean(selected)} title={selected?.fullName || "Fork"} description={selected?.parentFullName ? t(`上游 ${selected.parentFullName}`, `Upstream ${selected.parentFullName}`) : t("Fork 详情", "Fork details")} onClose={() => setSelected(null)}>{selected ? <div className="grid gap-4"><div className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">{t("领先", "Ahead")}</div><div className="mt-1 font-medium">{selected.aheadBy ?? t("未知", "Unknown")}</div></div><div><div className="text-xs text-muted-foreground">{t("落后", "Behind")}</div><div className="mt-1 font-medium">{selected.behindBy ?? t("未知", "Unknown")}</div></div></div>{selected.latestWorkflow ? <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center gap-2">{workflowState(selected) === "success" ? <RiCheckboxCircleLine className="size-4 text-success-foreground" /> : workflowState(selected) === "failure" ? <RiErrorWarningLine className="size-4 text-destructive-foreground" /> : <RiLoader4Line className="size-4 animate-spin text-warning-foreground" />}{t("最近一次 Action", "Latest Action")} · {selected.latestWorkflow.name}</div><div className="mt-1 text-xs text-muted-foreground">{workflowResultLabel(selected, uiLanguage)} · {new Date(selected.latestWorkflow.createdAt).toLocaleString(locale)}</div></div> : null}<div className="rounded-xl border border-border p-4"><div className="mb-3"><h3 className="text-sm font-semibold">{t("运行 GitHub Workflow", "Run GitHub Workflow")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("在当前 Fork 上手动运行 Workflow。需要 GitHub Token 具备 Actions 权限，且目标 Workflow 支持手动运行。", "Run a Workflow manually on this fork. The GitHub Token needs Actions access and the target Workflow must support manual dispatch.")}</p></div>{selected.workflows.length ? <div className="grid gap-3"><Field label="Workflow"><Select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)}>{selected.workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.state}</option>)}</Select></Field><Field label={t("分支 / Ref", "Branch / Ref")}><Input value={workflowRef} onChange={(event) => setWorkflowRef(event.target.value)} placeholder={selected.defaultBranch} /></Field><details className="rounded-xl border border-border px-3 py-2"><summary className="cursor-pointer text-sm font-medium">{t("高级设置 · 输入参数", "Advanced · Inputs")}</summary><div className="mt-3"><Field label={t("输入参数", "Inputs")} error={workflowInputError}><Textarea rows={3} className="font-mono text-xs" value={workflowInputs} onChange={(event) => { setWorkflowInputs(event.target.value); setWorkflowInputError(""); }} aria-invalid={Boolean(workflowInputError)} /><span className="text-xs text-muted-foreground">{t("仅在 Workflow 需要额外参数时填写 JSON；无参数时保持", "Provide JSON only when the Workflow needs extra inputs; otherwise keep")} {`{}`} {`}`}{t("，需要参数时填写 JSON。", "; provide JSON when inputs are required.")}</span></Field></div></details><Button loading={dispatching} disabled={!workflowId || !workflowRef.trim()} onClick={() => void runWorkflow()}>{t("运行 Workflow", "Run Workflow")}</Button></div> : <p className="text-sm text-muted-foreground">{t("此 Fork 没有可见的 GitHub Actions Workflow，或当前 Token 无权读取 Workflow。", "This fork has no visible GitHub Actions Workflow, or the current token cannot read Workflows.")}</p>}</div><div className="flex flex-wrap gap-2">{selected.behindBy && selected.behindBy > 0 ? <Button onClick={() => void syncUpstream(selected)} loading={syncing === selected.fullName}>{t("同步上游", "Sync upstream")}</Button> : null}<Button render={<a href={selected.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><RiExternalLinkLine className="size-4" />{t("打开 Fork", "Open fork")}</Button>{selected.parentHtmlUrl ? <Button render={<a href={selected.parentHtmlUrl} target="_blank" rel="noreferrer" />} variant="outline">{t("打开上游", "Open upstream")}</Button> : null}</div></div> : null}</Modal>
  </div>;
}
