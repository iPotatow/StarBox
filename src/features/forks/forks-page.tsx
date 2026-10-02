import type { StateChange } from "../../types";
import { ArrowDown as ArrowDownIcon, ArrowSquareOut as ExternalLinkIcon, ArrowUp as ArrowUpIcon, ArrowsClockwise as RefreshCwIcon, CaretDown as ChevronDownIcon, CheckCircle as CircleCheckIcon, Gear as SettingsIcon, GitFork as GitForkIcon, MagnifyingGlass as SearchIcon, Question as CircleHelpIcon, SpinnerGap as LoaderCircleIcon, Warning as BadgeAlertIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { MorphButton } from "../../components/spectrumui/morph-button";
import { SkeletonReveal } from "../../components/spectrumui/skeleton-reveal";
import { Card } from "../../components/ui/card";
import { FilterBar, FilterBarChips, FilterBarControls, FilterBarDesktop, FilterBarMobile, FilterBarMobileControls, FilterBarSearch } from "../../components/patterns/filter-bar";
import { PageHeader, PageHeaderContent, PageHeaderDescription, PageHeaderTitle } from "../../components/patterns/page-header";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Field } from "../../components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { ToolbarButton } from "../../components/ui/toolbar";
import { ListSkeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Textarea } from "../../components/ui/textarea";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { dispatchForkWorkflow, fetchForkDetails, fetchForkRepositories, syncForkUpstream } from "../../lib/api";
import { cn } from "../../lib/utils";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { ForkRepository, PersistedState } from "../../types";

type UpstreamFilter = "all" | "behind" | "ahead" | "synced" | "unknown";
type WorkflowFilter = "all" | "success" | "failure" | "running" | "none";
type ForkSort = "updated" | "behind" | "ahead" | "name";
type SortDirection = "asc" | "desc";

function upstreamState(fork: ForkRepository): Exclude<UpstreamFilter, "all"> { if (fork.behindBy == null || fork.aheadBy == null) return "unknown"; if (fork.behindBy > 0) return "behind"; if (fork.aheadBy > 0) return "ahead"; return "synced"; }
function workflowState(fork: ForkRepository): Exclude<WorkflowFilter, "all"> { const run = fork.latestWorkflow; if (!run) return "none"; if (run.status && run.status !== "completed") return "running"; const conclusion = (run.conclusion || "").toLowerCase(); if (["success", "neutral", "skipped"].includes(conclusion)) return "success"; if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion)) return "failure"; return "running"; }
function workflowResultLabel(fork: ForkRepository, t: import("../../lib/translate").Translate) {
  const state = workflowState(fork);
  return state === "success" ? t("成功", "Success", "成功") : state === "failure" ? t("失败", "Failed", "失敗") : state === "running" ? t("运行中", "Running", "執行中") : t("无运行记录", "No runs", "無執行記錄");
}
function upstreamFilterLabel(value: Exclude<UpstreamFilter, "all">, t: import("../../lib/translate").Translate) {
  return value === "behind" ? t("落后上游", "Behind upstream", "落後上游") : value === "ahead" ? t("领先上游", "Ahead of upstream", "領先上游") : value === "synced" ? t("已同步", "Synced", "已同步") : t("未知", "Unknown", "未知");
}
function workflowFilterLabel(value: Exclude<WorkflowFilter, "all">, t: import("../../lib/translate").Translate) {
  return value === "success" ? t("运行成功", "Succeeded", "執行成功") : value === "failure" ? t("运行失败", "Failed", "執行失敗") : value === "running" ? t("运行中", "Running", "執行中") : t("无运行记录", "No runs", "無執行記錄");
}

export function ForksPage({ state, onStateChange, goToSettings, initialLoading = false, bootstrapPending = false }: { state: PersistedState; onStateChange: StateChange; goToSettings: (tab?: string) => void; initialLoading?: boolean; bootstrapPending?: boolean }) {
  const { t, locale } = useI18n();
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const cachedForks = () => state.forkJobs.flatMap((job) => job.snapshot ? [job.snapshot] : []);
  const [forks, setForks] = useState<ForkRepository[]>(cachedForks);
  const dailyForkSyncAttempted = useRef(false);
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
  const [syncConfirm, setSyncConfirm] = useState<ForkRepository | null>(null);
  const [workflowReview, setWorkflowReview] = useState<{ fullName: string; workflowId: number; workflowName: string; ref: string; inputs: Record<string, string> } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshButtonState, setRefreshButtonState] = useState<"idle" | "success" | "error">("idle");
  useEffect(() => { replaceQueryParams({ q: query, upstream: upstreamFilter === "all" ? "" : upstreamFilter, actions: workflowFilter === "all" ? "" : workflowFilter, sort: sort === "updated" ? "" : sort, direction: direction === "desc" ? "" : direction, page: page === 1 ? "" : page }); }, [query, upstreamFilter, workflowFilter, sort, direction, page]);

  const loadForks = useCallback(async ({ notifySuccess = true }: { notifySuccess?: boolean } = {}) => {
    if (!hasGithubCredential) return;
    const checkedAt = new Date().toISOString();
    if (notifySuccess) setRefreshButtonState("idle");
    setLoading(true); setError(""); setSuccess("");
    try {
      const { forks: next, complete } = await fetchForkRepositories(token);
      setForks((current) => complete ? next : Array.from(new Map([...current, ...next].map((fork) => [fork.fullName, fork])).values()));
      onStateChange((current) => ({
        ...current,
        lastForkSyncAt: complete ? checkedAt : current.lastForkSyncAt,
        forkJobs: [...(complete ? [] : current.forkJobs.filter((job) => !next.some((fork) => fork.fullName === job.targetFullName))), ...next.map((fork) => {
          const existing = current.forkJobs.find((job) => job.targetFullName === fork.fullName);
          const [targetOwner = "", targetName = ""] = fork.fullName.split("/");
          return { id: existing?.id || String(fork.id), sourceFullName: fork.parentFullName || "", targetOwner, targetName, targetFullName: fork.fullName, htmlUrl: fork.htmlUrl, status: "ready" as const, createdAt: existing?.createdAt || checkedAt, updatedAt: checkedAt, error: "", snapshot: fork };
        })],
      }));
      setSuccess("");
      if (!complete) { if (notifySuccess) setRefreshButtonState("error"); setError(t("Fork 列表超出本次读取范围，已保留未返回的项目", "Fork list exceeded the fetch limit; previously known projects were preserved", "Fork 列表超出本次讀取範圍，已保留未返回的專案")); }
      else if (notifySuccess) { setRefreshButtonState("success"); notify(t("Fork 已刷新", "Forks refreshed", "Fork 已重新整理"), t(`${next.length} 个仓库 · 上游与 Actions 状态已更新`, `${next.length} repositories · upstream and Actions status updated`, `${next.length} 個儲存庫 · 上游與 Actions 狀態已更新`), "success"); }
    }
    catch (reason) { if (notifySuccess) setRefreshButtonState("error"); setError(reason instanceof Error ? reason.message : t("Fork 清单读取失败", "Failed to load forks", "Fork 清單讀取失敗")); }
    finally { setLoading(false); }
  }, [hasGithubCredential, token, onStateChange]);
  useEffect(() => {
    const next = cachedForks();
    if (next.length || state.lastForkSyncAt) setForks(next);
  }, [state.forkJobs]);
  useEffect(() => {
    if (dailyForkSyncAttempted.current || bootstrapPending || !hasGithubCredential) return;
    dailyForkSyncAttempted.current = true;
    const last = state.lastForkSyncAt ? new Date(state.lastForkSyncAt) : null;
    const now = new Date();
    const checkedToday = Boolean(last && !Number.isNaN(last.getTime()) && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate());
    if (!checkedToday) void loadForks({ notifySuccess: false });
  }, [bootstrapPending, hasGithubCredential, state.lastForkSyncAt, loadForks]);
  useEffect(() => { setWorkflowReview(null); if (!selected) return; const first = selected.workflows.find((item) => item.state === "active") || selected.workflows[0]; setWorkflowId(first ? String(first.id) : ""); setWorkflowRef(selected.defaultBranch || "main"); setWorkflowInputs("{}"); setWorkflowInputError(""); }, [selected?.fullName, selected?.workflows]);

  async function inspectFork(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setDetailLoading(fork.fullName); setError("");
    try { const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? { ...detail, workflows: item.workflows.length ? item.workflows : detail.workflows } : item)); setSelected(detail); }
    catch (reason) { notify(t("Fork 详情读取失败", "Failed to load fork details", "Fork 詳情讀取失敗"), reason instanceof Error ? reason.message : fork.fullName, "error"); }
    finally { setDetailLoading(""); }
  }
  async function syncUpstream(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings("account"); setSyncing(fork.fullName); setError("");
    try { const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch); setSuccess(""); notify(t("上游已同步", "Upstream synced", "上游已同步"), result.message || fork.fullName, "success"); const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); }
    catch (reason) { notify(t("上游同步失败", "Failed to sync upstream", "上游同步失敗"), reason instanceof Error ? reason.message : fork.fullName, "error"); }
    finally { setSyncing(""); setSyncConfirm(null); }
  }
  function reviewWorkflow() {
    if (!selected || !workflowId) return;
    let inputs: Record<string, string> = {};
    try { const parsed = workflowInputs.trim() ? JSON.parse(workflowInputs) as unknown : {}; if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(t("Inputs 必须是 JSON 对象", "Inputs must be a JSON object", "Inputs 必須是 JSON 物件")); inputs = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])); setWorkflowInputError(""); }
    catch (reason) { setWorkflowInputError(reason instanceof Error ? reason.message : t("输入参数格式无效", "Invalid input format", "輸入引數格式無效")); return; }
    const workflow = selected.workflows.find((item) => String(item.id) === workflowId);
    setWorkflowReview({ fullName: selected.fullName, workflowId: Number(workflowId), workflowName: workflow?.name || workflowId, ref: workflowRef.trim() || selected.defaultBranch, inputs });
  }
  async function runWorkflow() {
    if (!workflowReview) return;
    const review = workflowReview;
    setDispatching(true); setError(""); setSuccess("");
    try { const result = await dispatchForkWorkflow(token, review.fullName, review.workflowId, review.ref, review.inputs); setSuccess(""); notify(t("Workflow 已触发", "Workflow dispatched", "Workflow 已觸發"), result.message, "success"); setWorkflowReview(null); }
    catch (reason) { notify(t("Workflow 触发失败", "Failed to dispatch workflow", "Workflow 觸發失敗"), reason instanceof Error ? reason.message : review.fullName, "error"); }
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
    <PageHeader><PageHeaderContent><PageHeaderTitle>{t("复刻", "Fork", "復刻")}</PageHeaderTitle><PageHeaderDescription>{t(`${forks.length} 个 Fork · 查看与上游的差异和 Actions 状态。`, `${forks.length} forks · compare upstream differences and Actions status.`, `${forks.length} 個 Fork · 檢視與上游的差異和 Actions 狀態。`)}{state.lastForkSyncAt ? ` · ${t("上次检查", "Last checked", "上次檢查")} ${new Date(state.lastForkSyncAt).toLocaleString(locale)}` : ""}</PageHeaderDescription></PageHeaderContent><MorphButton state={loading ? "loading" : refreshButtonState} disabled={!hasGithubCredential} onClick={() => void loadForks()} loadingLabel={t("正在刷新", "Refreshing", "正在重新整理")} successLabel={t("已刷新", "Refreshed", "已重新整理")} errorLabel={t("刷新失败", "Refresh failed", "重新整理失敗")}><RefreshCwIcon aria-hidden="true" className="size-4" />{t("刷新 GitHub", "Refresh GitHub", "重新整理 GitHub")}</MorphButton></PageHeader>
    <StatusBanner error={error} success={!error ? success : ""} />
    <FilterBar stickyDesktop>
      <FilterBarMobile>
        <InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索 Fork", "Search forks", "搜尋 Fork")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索 Fork / 上游 / Workflow", "Search fork / upstream / workflow", "搜尋 Fork / 上游 / Workflow")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup>
        <FilterBarMobileControls>
          <Button variant="outline" onClick={() => setMobileFiltersOpen(true)}>{t("筛选", "Filter", "篩選")}{upstreamFilter !== "all" || workflowFilter !== "all" ? ` (${Number(upstreamFilter !== "all") + Number(workflowFilter !== "all")})` : ""}</Button>
          <Select aria-label={t("Fork 排序方式", "Fork sort order", "Fork 排序方式")} value={sort} onValueChange={(value) => { setSort(value as ForkSort); setPage(1); }} items={[{ value: "updated", label: t("更新时间", "Updated", "更新時間") }, { value: "behind", label: t("落后数量", "Behind count", "落後數量") }, { value: "ahead", label: t("领先数量", "Ahead count", "領先數量") }, { value: "name", label: t("名称", "Name", "名稱") }]} />
          <Button variant="outline" size="icon" aria-label={direction === "desc" ? t("切换为正序", "Switch to ascending", "切換為正序") : t("切换为逆序", "Switch to descending", "切換為逆序")} onClick={() => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }}><ArrowDownIcon className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} aria-hidden="true" /></Button>
        </FilterBarMobileControls>
      </FilterBarMobile>
      <FilterBarDesktop aria-label={t("Fork 工具栏", "Fork toolbar", "Fork 工具欄")}>
        <FilterBarSearch><InputGroup className="min-w-[220px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索 Fork", "Search forks", "搜尋 Fork")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索 Fork / 上游 / Workflow", "Search fork / upstream / workflow", "搜尋 Fork / 上游 / Workflow")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></FilterBarSearch>
        <FilterBarControls>
          <Select render={<ToolbarButton />} aria-label={t("筛选上游状态", "Filter upstream status", "篩選上游狀態")} value={upstreamFilter} onValueChange={(value) => { setUpstreamFilter(value as UpstreamFilter); setPage(1); }} className="w-28 min-w-0 xl:w-32" items={[{ value: "all", label: t("全部上游", "All upstream", "全部上游") }, { value: "behind", label: t("落后", "Behind", "落後") }, { value: "ahead", label: t("领先", "Ahead", "領先") }, { value: "synced", label: t("已同步", "Synced", "已同步") }, { value: "unknown", label: t("未知", "Unknown", "未知") }]} />
          <Select render={<ToolbarButton />} aria-label={t("筛选 Actions 状态", "Filter Actions status", "篩選 Actions 狀態")} value={workflowFilter} onValueChange={(value) => { setWorkflowFilter(value as WorkflowFilter); setPage(1); }} className="w-28 min-w-0 xl:w-32" items={[{ value: "all", label: t("全部 Actions", "All Actions", "全部 Actions") }, { value: "success", label: t("成功", "Success", "成功") }, { value: "failure", label: t("失败", "Failed", "失敗") }, { value: "running", label: t("运行中", "Running", "執行中") }, { value: "none", label: t("无运行记录", "No runs", "無執行記錄") }]} />
          <Select render={<ToolbarButton />} aria-label={t("Fork 排序方式", "Fork sort order", "Fork 排序方式")} value={sort} onValueChange={(value) => { setSort(value as ForkSort); setPage(1); }} className="w-28 min-w-0 xl:w-32" items={[{ value: "updated", label: t("更新时间", "Updated", "更新時間") }, { value: "behind", label: t("落后数量", "Behind count", "落後數量") }, { value: "ahead", label: t("领先数量", "Ahead count", "領先數量") }, { value: "name", label: t("名称", "Name", "名稱") }]} />
          <Tooltip content={direction === "desc" ? t("当前逆序，点击切换正序", "Descending; switch to ascending", "當前逆序，點選切換正序") : t("当前正序，点击切换逆序", "Ascending; switch to descending", "當前正序，點選切換逆序")}><ToolbarButton render={<Button variant="outline" size="icon" aria-label={direction === "desc" ? t("切换为正序", "Switch to ascending", "切換為正序") : t("切换为逆序", "Switch to descending", "切換為逆序")} onClick={() => { setDirection((value) => value === "desc" ? "asc" : "desc"); setPage(1); }} />}><ArrowDownIcon className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} aria-hidden="true" /></ToolbarButton></Tooltip>
        </FilterBarControls>
      </FilterBarDesktop>
    </FilterBar>
    {(query || upstreamFilter !== "all" || workflowFilter !== "all") ? <FilterBarChips><span>{t("当前筛选：", "Filters:", "當前篩選：")}</span>{query ? <Button size="sm" variant="outline" onClick={() => { setQuery(""); setPage(1); }}>{t("搜索：", "Search: ", "搜尋：")}{query} ×</Button> : null}{upstreamFilter !== "all" ? <Button size="sm" variant="outline" onClick={() => { setUpstreamFilter("all"); setPage(1); }}>{t("上游：", "Upstream: ", "上游：")}{upstreamFilterLabel(upstreamFilter, t)} ×</Button> : null}{workflowFilter !== "all" ? <Button size="sm" variant="outline" onClick={() => { setWorkflowFilter("all"); setPage(1); }}>Actions: {workflowFilterLabel(workflowFilter, t)} ×</Button> : null}<Button size="sm" variant="ghost" onClick={() => { setQuery(""); setUpstreamFilter("all"); setWorkflowFilter("all"); setPage(1); }}>{t("清除筛选", "Clear filters", "清除篩選")}</Button></FilterBarChips> : null}
    <ResponsiveDialog
      open={mobileFiltersOpen}
      title={t("筛选 Fork", "Filter Forks", "篩選 Fork")}
      description={t("按上游差异与 Actions 状态筛选已加载的 Fork。", "Filter loaded forks by upstream and Actions status.", "按上游差異與 Actions 狀態篩選已載入的 Fork。")}
      onClose={() => setMobileFiltersOpen(false)}
      footer={<><Button variant="ghost" onClick={() => { setUpstreamFilter("all"); setWorkflowFilter("all"); setPage(1); }}>{t("清除", "Clear", "清除")}</Button><Button onClick={() => setMobileFiltersOpen(false)}>{t("完成", "Done", "完成")}</Button></>}
    >
      <div className="grid gap-4">
        <Field label={t("上游状态", "Upstream status", "上游狀態")}><Select value={upstreamFilter} onValueChange={(value) => { setUpstreamFilter(value as UpstreamFilter); setPage(1); }} items={[{ value: "all", label: t("全部上游", "All upstream", "全部上游") }, { value: "behind", label: t("落后", "Behind", "落後") }, { value: "ahead", label: t("领先", "Ahead", "領先") }, { value: "synced", label: t("已同步", "Synced", "已同步") }, { value: "unknown", label: t("未知", "Unknown", "未知") }]} /></Field>
        <Field label={t("Actions 状态", "Actions status", "Actions 狀態")}><Select value={workflowFilter} onValueChange={(value) => { setWorkflowFilter(value as WorkflowFilter); setPage(1); }} items={[{ value: "all", label: t("全部 Actions", "All Actions", "全部 Actions") }, { value: "success", label: t("成功", "Success", "成功") }, { value: "failure", label: t("失败", "Failed", "失敗") }, { value: "running", label: t("运行中", "Running", "執行中") }, { value: "none", label: t("无运行记录", "No runs", "無執行記錄") }]} /></Field>
      </div>
    </ResponsiveDialog>

    <div ref={resultsTopRef} />
    {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">{t("连接 GitHub 凭据后才能读取已 Fork 仓库。", "Connect GitHub credentials to load forked repositories.", "連線 GitHub 憑據後才能讀取已 Fork 儲存庫。")}</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><SettingsIcon aria-hidden="true" className="size-4" />{t("打开设置", "Open Settings", "開啟設定")}</Button></div>
      : <SkeletonReveal loading={pageLoading} skeleton={<ListSkeleton rows={8} />}><Card render={<section />} className="overflow-hidden rounded-xl shadow-card"><div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-lg:grid-cols-[minmax(0,1fr)_90px]"><span>{t("Fork / 上游", "Fork / Upstream", "Fork / 上游")}</span><span className="max-lg:hidden">{t("与上游", "Upstream", "與上游")}</span><span className="max-lg:hidden">Actions</span><span className="text-right">{t("操作", "Actions", "操作")}</span></div>{visible.map((fork) => { const status = upstreamState(fork); const actionStatus = workflowState(fork); return <article key={fork.id} className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-lg:grid-cols-[minmax(0,1fr)_90px]"><div className="min-w-0"><Button variant="link" size="xs" onClick={() => void inspectFork(fork)} className="h-auto min-h-0 max-w-full justify-start truncate px-0 py-0 text-left text-sm font-semibold">{fork.fullName}</Button><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="truncate">{t("上游：", "Upstream: ", "上游：")}{fork.parentFullName || t("未知", "Unknown", "未知")}</span></div><div className="mt-1 hidden flex-wrap gap-x-2 text-xs text-muted-foreground max-lg:flex"><span>{t("领先", "Ahead", "領先")} {fork.aheadBy ?? "?"}</span><span>{t("落后", "Behind", "落後")} {fork.behindBy ?? "?"}</span><span>Actions {fork.latestWorkflow ? workflowResultLabel(fork, t) : "—"}</span></div></div><div className="text-xs max-lg:hidden">{fork.aheadBy == null || fork.behindBy == null ? <Badge variant="secondary">{t("未知", "Unknown", "未知")}</Badge> : fork.aheadBy === 0 && fork.behindBy === 0 ? <Badge variant="success">{t("已同步", "Synced", "已同步")}</Badge> : <div className="flex gap-1"><Badge variant="secondary"><ArrowUpIcon aria-hidden="true" className="size-3" />{fork.aheadBy}</Badge><Badge variant={fork.behindBy > 0 ? "warning" : "secondary"}><ArrowDownIcon aria-hidden="true" className="size-3" />{fork.behindBy}</Badge></div>}</div><div className="min-w-0 text-xs max-lg:hidden">{fork.latestWorkflow ? <a href={fork.latestWorkflow.htmlUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 hover:underline"><span className={cn("size-2 shrink-0 rounded-full", actionStatus === "success" ? "bg-success" : actionStatus === "failure" ? "bg-destructive" : "bg-warning")} /><span className="truncate">{fork.latestWorkflow.name} · {workflowResultLabel(fork, t)}</span></a> : "—"}</div><div className="flex justify-end gap-1">{status === "behind" ? <Tooltip content={t("同步上游", "Sync upstream", "同步上游")}><Button size="sm" variant="outline" loading={syncing === fork.fullName} onClick={() => setSyncConfirm(fork)}>{t("同步", "Sync", "同步")}</Button></Tooltip> : null}<Tooltip content={t("详情 / Workflow", "Details / Workflow", "詳情 / Workflow")}><Button size="icon-sm" variant="ghost" loading={detailLoading === fork.fullName} onClick={() => void inspectFork(fork)} aria-label={t("查看 Fork 详情", "View fork details", "檢視 Fork 詳情")}><CircleHelpIcon aria-hidden="true" className="size-4" /></Button></Tooltip><Button render={<a href={fork.htmlUrl} target="_blank" rel="noreferrer" />} size="icon-sm" variant="ghost" aria-label={t("打开 Fork", "Open fork", "開啟 Fork")}><ExternalLinkIcon aria-hidden="true" className="size-4" /></Button></div></article>; })}{!visible.length ? <Empty className="m-4 min-h-56 border-0"><EmptyContent><EmptyIcon><GitForkIcon aria-hidden="true" className="size-5" /></EmptyIcon><EmptyTitle>{t("暂无符合条件的 Fork", "No forks match", "暫無符合條件的 Fork")}</EmptyTitle><EmptyDescription>{t("调整搜索、上游或 Actions 筛选条件后再试。", "Adjust search, upstream, or Actions filters and try again.", "調整搜尋、上游或 Actions 篩選條件後再試。")}</EmptyDescription></EmptyContent></Empty> : null}</Card></SkeletonReveal>}
    {filtered.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}

    <ResponsiveDialog open={Boolean(selected)} title={selected?.fullName || "Fork"} description={selected?.parentFullName ? t(`上游 ${selected.parentFullName}`, `Upstream ${selected.parentFullName}`, `上游 ${selected.parentFullName}`) : t("Fork 详情", "Fork details", "Fork 詳情")} onClose={() => setSelected(null)}>{selected ? <div className="grid gap-4"><div className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">{t("领先", "Ahead", "領先")}</div><div className="mt-1 font-medium">{selected.aheadBy ?? t("未知", "Unknown", "未知")}</div></div><div><div className="text-xs text-muted-foreground">{t("落后", "Behind", "落後")}</div><div className="mt-1 font-medium">{selected.behindBy ?? t("未知", "Unknown", "未知")}</div></div></div>{selected.latestWorkflow ? <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center gap-2">{workflowState(selected) === "success" ? <CircleCheckIcon aria-hidden="true" className="size-4 text-success-foreground" /> : workflowState(selected) === "failure" ? <BadgeAlertIcon aria-hidden="true" className="size-4 text-destructive-foreground" /> : <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin text-warning-foreground" />}{t("最近一次 Action", "Latest Action", "最近一次 Action")} · {selected.latestWorkflow.name}</div><div className="mt-1 text-xs text-muted-foreground">{workflowResultLabel(selected, t)} · {new Date(selected.latestWorkflow.createdAt).toLocaleString(locale)}</div></div> : null}<div className="rounded-xl border border-border p-4"><div className="mb-3"><h3 className="text-sm font-semibold">{t("运行 GitHub Workflow", "Run GitHub Workflow", "執行 GitHub Workflow")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("在当前 Fork 上手动运行 Workflow。需要 GitHub Token 具备 Actions 权限，且目标 Workflow 支持手动运行。", "Run a Workflow manually on this fork. The GitHub Token needs Actions access and the target Workflow must support manual dispatch.", "在當前 Fork 上手動執行 Workflow。需要 GitHub Token 具備 Actions 許可權，且目標 Workflow 支援手動執行。")}</p></div>{selected.workflows.length ? <div className="grid gap-3"><Field label="Workflow"><Select value={workflowId} onValueChange={(value) => setWorkflowId(value)} items={[...(selected.workflows.map((workflow) => ({ value: String(workflow.id), label: <>{workflow.name}· {workflow.state}</> })))]} /></Field><Field label={t("分支 / Ref", "Branch / Ref", "分支 / Ref")}><Input type="text" value={workflowRef} onChange={(event) => setWorkflowRef(event.target.value)} placeholder={selected.defaultBranch} /></Field><Collapsible className="rounded-xl border border-border"><CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl px-3 py-2 text-sm font-medium" />}>{t("高级设置 · 输入参数", "Advanced · Inputs", "進階設定 · 輸入引數")}<ChevronDownIcon className="size-4" aria-hidden="true" /></CollapsibleTrigger><CollapsiblePanel><div className="px-3 pb-3 pt-1"><Field label={t("输入参数", "Inputs", "輸入引數")} error={workflowInputError}><Textarea rows={3} className="font-mono text-xs" value={workflowInputs} onChange={(event) => { setWorkflowInputs(event.target.value); setWorkflowInputError(""); }} aria-invalid={Boolean(workflowInputError)} /><span className="text-xs text-muted-foreground">{t("仅在 Workflow 需要额外参数时填写 JSON；无参数时保持", "Provide JSON only when the Workflow needs extra inputs; otherwise keep", "僅在 Workflow 需要額外引數時填寫 JSON；無引數時保持")} {`{`} {`}`}{t("，需要参数时填写 JSON。", "; provide JSON when inputs are required.", "，需要引數時填寫 JSON。")}</span></Field></div></CollapsiblePanel></Collapsible><Button loading={dispatching} disabled={!workflowId || !workflowRef.trim()} onClick={reviewWorkflow}>{t("检查并运行", "Review & run", "檢查並執行")}</Button></div> : <p className="text-sm text-muted-foreground">{t("此 Fork 没有可见的 GitHub Actions Workflow，或当前 Token 无权读取 Workflow。", "This fork has no visible GitHub Actions Workflow, or the current token cannot read Workflows.", "此 Fork 沒有可見的 GitHub Actions Workflow，或當前 Token 無權讀取 Workflow。")}</p>}</div><div className="flex flex-wrap gap-2">{selected.behindBy && selected.behindBy > 0 ? <Button onClick={() => setSyncConfirm(selected)} loading={syncing === selected.fullName}>{t("同步上游", "Sync upstream", "同步上游")}</Button> : null}<Button render={<a href={selected.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" className="size-4" />{t("打开 Fork", "Open fork", "開啟 Fork")}</Button>{selected.parentHtmlUrl ? <Button render={<a href={selected.parentHtmlUrl} target="_blank" rel="noreferrer" />} variant="outline">{t("打开上游", "Open upstream", "開啟上游")}</Button> : null}</div></div> : null}</ResponsiveDialog>

    <AlertDialog open={Boolean(syncConfirm)} onOpenChange={(open) => { if (!open && !syncing) setSyncConfirm(null); }}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("同步这个 Fork 的上游？", "Sync this fork with upstream?", "同步這個 Fork 的上游？")}</AlertDialogTitle>
          <AlertDialogDescription>{syncConfirm ? t(`将 GitHub 上的 ${syncConfirm.fullName} 与上游同步，目标分支为 ${syncConfirm.defaultBranch}。请确认当前分支没有需要先保留的冲突变更。`, `GitHub will sync ${syncConfirm.fullName} with its upstream on branch ${syncConfirm.defaultBranch}. Confirm there are no conflicting changes you need to preserve first.`, `將 GitHub 上的 ${syncConfirm.fullName} 與上游同步，目標分支為 ${syncConfirm.defaultBranch}。請確認當前分支沒有需要先保留的衝突變更。`) : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" disabled={Boolean(syncing)} />}>{t("取消", "Cancel", "取消")}</AlertDialogClose>
          <Button loading={Boolean(syncConfirm && syncing === syncConfirm.fullName)} disabled={!syncConfirm} onClick={() => { if (syncConfirm) void syncUpstream(syncConfirm); }}>{t("确认同步", "Confirm sync", "確認同步")}</Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>

    <AlertDialog open={Boolean(workflowReview)} onOpenChange={(open) => { if (!open && !dispatching) setWorkflowReview(null); }}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("确认运行 Workflow？", "Confirm workflow dispatch?", "確認執行 Workflow？")}</AlertDialogTitle>
          <AlertDialogDescription>{t("运行前请检查目标仓库、Workflow、Ref 与输入参数。提交后会立即在 GitHub Actions 中触发。", "Review the target repository, workflow, ref, and inputs before dispatching. Confirming immediately triggers GitHub Actions.", "執行前請檢查目標儲存庫、Workflow、Ref 與輸入引數。提交後會立即在 GitHub Actions 中觸發。")}</AlertDialogDescription>
        </AlertDialogHeader>
        {workflowReview ? <div className="grid gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">{t("仓库", "Repository", "儲存庫")}</span><span className="min-w-0 break-all font-medium">{workflowReview.fullName}</span></div>
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">Workflow</span><span className="min-w-0 break-words font-medium">{workflowReview.workflowName}</span></div>
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">Ref</span><code className="min-w-0 break-all text-xs">{workflowReview.ref}</code></div>
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"><span className="text-muted-foreground">{t("输入参数", "Inputs", "輸入引數")}</span>{Object.keys(workflowReview.inputs).length ? <pre className="max-h-32 min-w-0 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background/70 p-2 text-xs">{JSON.stringify(workflowReview.inputs, null, 2)}</pre> : <span className="text-muted-foreground">{t("无", "None", "無")}</span>}</div>
        </div> : null}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" disabled={dispatching} />}>{t("返回修改", "Back", "返回修改")}</AlertDialogClose>
          <Button loading={dispatching} disabled={!workflowReview} onClick={() => void runWorkflow()}>{t("确认运行", "Confirm run", "確認執行")}</Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  </div>;
}
