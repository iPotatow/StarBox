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
import type { ForkRepository, PersistedState } from "../../types";

type UpstreamFilter = "all" | "behind" | "ahead" | "synced" | "unknown";
type WorkflowFilter = "all" | "success" | "failure" | "running" | "none";
type ForkSort = "updated" | "behind" | "ahead" | "name";
type SortDirection = "asc" | "desc";

function upstreamState(fork: ForkRepository): Exclude<UpstreamFilter, "all"> { if (fork.behindBy == null || fork.aheadBy == null) return "unknown"; if (fork.behindBy > 0) return "behind"; if (fork.aheadBy > 0) return "ahead"; return "synced"; }
function workflowState(fork: ForkRepository): Exclude<WorkflowFilter, "all"> { const run = fork.latestWorkflow; if (!run) return "none"; if (run.status && run.status !== "completed") return "running"; const conclusion = (run.conclusion || "").toLowerCase(); if (["success", "neutral", "skipped"].includes(conclusion)) return "success"; if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion)) return "failure"; return "running"; }
function workflowResultLabel(fork: ForkRepository) { const state = workflowState(fork); return state === "success" ? "成功" : state === "failure" ? "失败" : state === "running" ? "运行中" : "无运行记录"; }

export function ForksPage({ state, onStateChange: _onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: (tab?: string) => void; initialLoading?: boolean }) {
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
    try { const next = await fetchForkRepositories(token); setForks(next); setSuccess(""); notify("Fork 已刷新", `${next.length} 个仓库 · 上游与 Actions 状态已更新`, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 清单读取失败"); }
    finally { setLoading(false); }
  }, [hasGithubCredential, token]);
  useEffect(() => { if (hasGithubCredential) void loadForks(); }, [hasGithubCredential, loadForks]);
  useEffect(() => { if (!selected) return; const first = selected.workflows.find((item) => item.state === "active") || selected.workflows[0]; setWorkflowId(first ? String(first.id) : ""); setWorkflowRef(selected.defaultBranch || "main"); setWorkflowInputs("{}"); setWorkflowInputError(""); }, [selected?.fullName, selected?.workflows]);

  async function inspectFork(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setDetailLoading(fork.fullName); setError("");
    try { const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? { ...detail, workflows: item.workflows.length ? item.workflows : detail.workflows } : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 详情读取失败"); }
    finally { setDetailLoading(""); }
  }
  async function syncUpstream(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setSyncing(fork.fullName); setError("");
    try { const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch); setSuccess(""); notify("上游已同步", result.message || fork.fullName, "success"); const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "上游同步失败"); }
    finally { setSyncing(""); }
  }
  async function runWorkflow() {
    if (!selected || !workflowId) return;
    let inputs: Record<string, string> = {};
    try { const parsed = workflowInputs.trim() ? JSON.parse(workflowInputs) as unknown : {}; if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Inputs 必须是 JSON 对象"); inputs = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])); setWorkflowInputError(""); }
    catch (reason) { setWorkflowInputError(reason instanceof Error ? reason.message : "输入参数格式无效"); return; }
    setDispatching(true); setError(""); setSuccess("");
    try { const result = await dispatchForkWorkflow(token, selected.fullName, Number(workflowId), workflowRef.trim() || selected.defaultBranch, inputs); setSuccess(""); notify("Workflow 已触发", result.message, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Workflow 触发失败"); }
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
    <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Fork</h1><p className="mt-1 text-sm text-muted-foreground">{forks.length} 个 Fork · 查看与上游的差异和 Actions 状态。</p></div><Button onClick={() => void loadForks()} loading={loading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />刷新 GitHub</Button></header>
    <StatusBanner error={error} success={!error ? success : ""} />
    <Toolbar className="mb-5" aria-label="Fork 工具栏"><ToolbarGroup className="min-w-[240px] flex-1"><InputGroup className="min-w-[220px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label="搜索 Fork" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索 Fork / 上游 / Workflow" /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></ToolbarGroup><ToolbarSeparator /><ToolbarGroup><Select aria-label="筛选上游状态" value={upstreamFilter} onChange={(event) => { setUpstreamFilter(event.target.value as UpstreamFilter); setPage(1); }} className="min-w-32"><option value="all">全部上游</option><option value="behind">落后</option><option value="ahead">领先</option><option value="synced">已同步</option><option value="unknown">未知</option></Select><Select aria-label="筛选 Actions 状态" value={workflowFilter} onChange={(event) => { setWorkflowFilter(event.target.value as WorkflowFilter); setPage(1); }} className="min-w-32"><option value="all">全部 Actions</option><option value="success">成功</option><option value="failure">失败</option><option value="running">运行中</option><option value="none">无运行记录</option></Select><Select aria-label="Fork 排序方式" value={sort} onChange={(event) => { setSort(event.target.value as ForkSort); setPage(1); }} className="min-w-32"><option value="updated">更新时间</option><option value="behind">落后数量</option><option value="ahead">领先数量</option><option value="name">名称</option></Select><Tooltip content={direction === "desc" ? "当前逆序，点击切换正序" : "当前正序，点击切换逆序"}><Button variant="outline" size="icon" aria-label={direction === "desc" ? "切换为正序" : "切换为逆序"} onClick={() => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }}><RiArrowDownLine className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} /></Button></Tooltip></ToolbarGroup></Toolbar>

    <div ref={resultsTopRef} />
    {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">连接 GitHub 凭据后才能读取已 Fork 仓库。</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><RiSettings4Line className="size-4" />打开设置</Button></div>
      : pageLoading ? <ListSkeleton rows={8} />
        : <Card render={<section />} className="overflow-hidden rounded-xl shadow-card"><div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]"><span>Fork / 上游</span><span className="max-md:hidden">与上游</span><span className="max-md:hidden">Actions</span><span className="text-right">操作</span></div>{visible.map((fork) => { const status = upstreamState(fork); const actionStatus = workflowState(fork); return <article key={fork.id} className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]"><div className="min-w-0"><Button variant="link" size="none" onClick={() => void inspectFork(fork)} className="max-w-full truncate text-left text-sm font-semibold">{fork.fullName}</Button><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="truncate">上游：{fork.parentFullName || "未知"}</span></div><div className="mt-1 hidden flex-wrap gap-x-2 text-xs text-muted-foreground max-md:flex"><span>领先 {fork.aheadBy ?? "?"}</span><span>落后 {fork.behindBy ?? "?"}</span><span>Actions {fork.latestWorkflow ? workflowResultLabel(fork) : "—"}</span></div></div><div className="text-xs max-md:hidden">{fork.aheadBy == null || fork.behindBy == null ? <Badge variant="secondary">未知</Badge> : fork.aheadBy === 0 && fork.behindBy === 0 ? <Badge variant="success">已同步</Badge> : <div className="flex gap-1"><Badge variant="secondary">↑ {fork.aheadBy}</Badge><Badge variant={fork.behindBy > 0 ? "warning" : "secondary"}>↓ {fork.behindBy}</Badge></div>}</div><div className="min-w-0 text-xs max-md:hidden">{fork.latestWorkflow ? <a href={fork.latestWorkflow.htmlUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 hover:underline"><span className={cn("size-2 shrink-0 rounded-full", actionStatus === "success" ? "bg-emerald-500" : actionStatus === "failure" ? "bg-destructive" : "bg-warning")} /><span className="truncate">{fork.latestWorkflow.name} · {workflowResultLabel(fork)}</span></a> : "—"}</div><div className="flex justify-end gap-1">{status === "behind" ? <Tooltip content="同步上游"><Button size="sm" variant="outline" loading={syncing === fork.fullName} onClick={() => void syncUpstream(fork)}>同步</Button></Tooltip> : null}<Tooltip content="详情 / Workflow"><Button size="icon-sm" variant="ghost" loading={detailLoading === fork.fullName} onClick={() => void inspectFork(fork)} aria-label="查看 Fork 详情"><RiInformationLine className="size-4" /></Button></Tooltip><Button render={<a href={fork.htmlUrl} target="_blank" rel="noreferrer" />} size="icon-sm" variant="ghost" aria-label="打开 Fork"><RiExternalLinkLine className="size-4" /></Button></div></article>; })}{!visible.length ? <Empty className="m-4 min-h-56 border-0"><EmptyContent><EmptyIcon><RiGitForkLine className="size-5" /></EmptyIcon><EmptyTitle>暂无符合条件的 Fork</EmptyTitle><EmptyDescription>调整搜索、上游或 Actions 筛选条件后再试。</EmptyDescription></EmptyContent></Empty> : null}</Card>}
    {filtered.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}

    <Modal open={Boolean(selected)} title={selected?.fullName || "Fork"} description={selected?.parentFullName ? `上游 ${selected.parentFullName}` : "Fork 详情"} onClose={() => setSelected(null)}>{selected ? <div className="grid gap-4"><div className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">领先</div><div className="mt-1 font-medium">{selected.aheadBy ?? "未知"}</div></div><div><div className="text-xs text-muted-foreground">落后</div><div className="mt-1 font-medium">{selected.behindBy ?? "未知"}</div></div></div>{selected.latestWorkflow ? <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center gap-2">{workflowState(selected) === "success" ? <RiCheckboxCircleLine className="size-4 text-success-foreground" /> : workflowState(selected) === "failure" ? <RiErrorWarningLine className="size-4 text-destructive-foreground" /> : <RiLoader4Line className="size-4 animate-spin text-warning-foreground" />}最近一次 Action · {selected.latestWorkflow.name}</div><div className="mt-1 text-xs text-muted-foreground">{workflowResultLabel(selected)} · {new Date(selected.latestWorkflow.createdAt).toLocaleString("zh-CN")}</div></div> : null}<div className="rounded-xl border border-border p-4"><div className="mb-3"><h3 className="text-sm font-semibold">运行 GitHub Workflow</h3><p className="mt-1 text-xs text-muted-foreground">在当前 Fork 上手动运行 Workflow。需要 GitHub Token 具备 Actions 权限，且目标 Workflow 支持手动运行。</p></div>{selected.workflows.length ? <div className="grid gap-3"><Field label="Workflow"><Select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)}>{selected.workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.state}</option>)}</Select></Field><Field label="分支 / Ref"><Input value={workflowRef} onChange={(event) => setWorkflowRef(event.target.value)} placeholder={selected.defaultBranch} /></Field><details className="rounded-xl border border-border px-3 py-2"><summary className="cursor-pointer text-sm font-medium">高级设置 · 输入参数</summary><div className="mt-3"><Field label="输入参数" error={workflowInputError}><Textarea rows={3} className="font-mono text-xs" value={workflowInputs} onChange={(event) => { setWorkflowInputs(event.target.value); setWorkflowInputError(""); }} aria-invalid={Boolean(workflowInputError)} /><span className="text-xs text-muted-foreground">仅在 Workflow 需要额外参数时填写 JSON；无参数时保持 {`{}`} {`}`}，需要参数时填写 JSON。</span></Field></div></details><Button loading={dispatching} disabled={!workflowId || !workflowRef.trim()} onClick={() => void runWorkflow()}>运行 Workflow</Button></div> : <p className="text-sm text-muted-foreground">此 Fork 没有可见的 GitHub Actions Workflow，或当前 Token 无权读取 Workflow。</p>}</div><div className="flex flex-wrap gap-2">{selected.behindBy && selected.behindBy > 0 ? <Button onClick={() => void syncUpstream(selected)} loading={syncing === selected.fullName}>同步上游</Button> : null}<Button render={<a href={selected.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><RiExternalLinkLine className="size-4" />打开 Fork</Button>{selected.parentHtmlUrl ? <Button render={<a href={selected.parentHtmlUrl} target="_blank" rel="noreferrer" />} variant="outline">打开上游</Button> : null}</div></div> : null}</Modal>
  </div>;
}
