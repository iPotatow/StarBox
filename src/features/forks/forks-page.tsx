import {
  RiArrowDownLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiGitForkLine,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { ListSkeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { fetchForkDetails, fetchForkRepositories, syncForkUpstream } from "../../lib/api";
import { cn } from "../../lib/cn";
import { markForkReadState } from "../../lib/storage";
import type { ForkRepository, PersistedState } from "../../types";

type UpstreamFilter = "all" | "behind" | "ahead" | "synced" | "unknown";
type ForkSort = "updated" | "behind" | "ahead" | "name";
type SortDirection = "asc" | "desc";

function upstreamState(fork: ForkRepository): Exclude<UpstreamFilter, "all"> {
  if (fork.behindBy == null || fork.aheadBy == null) return "unknown";
  if (fork.behindBy > 0) return "behind";
  if (fork.aheadBy > 0) return "ahead";
  return "synced";
}

export function ForksPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [forks, setForks] = useState<ForkRepository[]>([]);
  const [selected, setSelected] = useState<ForkRepository | null>(null);
  const [query, setQuery] = useState("");
  const [upstreamFilter, setUpstreamFilter] = useState<UpstreamFilter>("all");
  const [sort, setSort] = useState<ForkSort>("updated");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState("");
  const [syncing, setSyncing] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadForks = useCallback(async () => {
    if (!hasGithubCredential) return;
    setLoading(true); setError("");
    try { const next = await fetchForkRepositories(token); setForks(next); setSuccess(`已从 GitHub 读取 ${next.length} 个 Fork`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 清单读取失败"); }
    finally { setLoading(false); }
  }, [hasGithubCredential, token]);
  useEffect(() => { if (hasGithubCredential) void loadForks(); }, [hasGithubCredential, loadForks]);

  async function inspectFork(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings(); setDetailLoading(fork.fullName); setError("");
    try { const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); onStateChange(markForkReadState(state, detail.fullName, new Date().toISOString())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 详情读取失败"); }
    finally { setDetailLoading(""); }
  }
  async function syncUpstream(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings(); setSyncing(fork.fullName); setError("");
    try { const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch); setSuccess(result.message || `已同步 ${fork.fullName}`); const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "上游同步失败"); }
    finally { setSyncing(""); }
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
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageLoading = (initialLoading || loading) && !forks.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Fork</h1><p className="mt-1 text-sm text-muted-foreground">GitHub 中检测到 {forks.length} 个 Fork 仓库，只管理已有 Fork，不在 StarBox 创建。</p></div><Button onClick={() => void loadForks()} loading={loading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />刷新 GitHub</Button></header>
      <StatusBanner error={error} success={!error ? success : ""} />

      <Toolbar className="mb-5" aria-label="Fork 工具栏">
        <ToolbarGroup className="min-w-[240px] flex-1"><div className="relative w-full"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-full min-w-[220px] pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索 Fork / Upstream" /></div></ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup><Select value={upstreamFilter} onChange={(event) => { setUpstreamFilter(event.target.value as UpstreamFilter); setPage(1); }} className="min-w-32"><option value="all">全部状态</option><option value="behind">Behind</option><option value="ahead">Ahead</option><option value="synced">已同步</option><option value="unknown">未知</option></Select><Select value={sort} onChange={(event) => setSort(event.target.value as ForkSort)} className="min-w-32"><option value="updated">更新时间</option><option value="behind">Behind 数量</option><option value="ahead">Ahead 数量</option><option value="name">名称</option></Select><Tooltip content={direction === "desc" ? "当前逆序，点击切换正序" : "当前正序，点击切换逆序"}><Button variant="outline" size="icon" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")}><RiArrowDownLine className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} /></Button></Tooltip></ToolbarGroup>
      </Toolbar>

      {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">连接 GitHub 凭据后才能读取已 Fork 仓库。</p><Button className="mt-3" variant="outline" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>
        : pageLoading ? <ListSkeleton rows={8} />
          : <Card render={<section />} className="overflow-hidden rounded-xl shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_90px]"><span>Repository / Upstream</span><span className="max-md:hidden">Divergence</span><span className="max-md:hidden">Actions</span><span className="text-right">操作</span></div>
            {visible.map((fork) => { const unread = !state.forkReadAt[fork.fullName] || new Date(state.forkReadAt[fork.fullName]).getTime() < new Date(fork.pushedAt).getTime(); const status = upstreamState(fork); return <article key={fork.id} className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]"><div className="min-w-0"><Button variant="link" size="none" onClick={() => void inspectFork(fork)} className="max-w-full truncate text-left text-sm font-semibold">{fork.fullName}</Button><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{unread ? <Badge>new</Badge> : null}<span className="truncate">Upstream: {fork.parentFullName || "未知"}</span></div></div><div className="text-xs max-md:hidden">{fork.aheadBy == null || fork.behindBy == null ? <Badge>unknown</Badge> : <div className="flex gap-1"><Badge>{fork.aheadBy} ahead</Badge><Badge>{fork.behindBy} behind</Badge></div>}</div><div className="text-xs max-md:hidden">{fork.latestWorkflow ? <a href={fork.latestWorkflow.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">{fork.latestWorkflow.conclusion || fork.latestWorkflow.status}</a> : "—"}</div><div className="flex justify-end gap-1">{status === "behind" ? <Tooltip content="同步 upstream"><Button size="sm" variant="outline" loading={syncing === fork.fullName} onClick={() => void syncUpstream(fork)}>同步</Button></Tooltip> : null}<Tooltip content="刷新详情"><Button size="icon-sm" variant="ghost" loading={detailLoading === fork.fullName} onClick={() => void inspectFork(fork)}><RiRefreshLine className="size-4" /></Button></Tooltip><a href={fork.htmlUrl} target="_blank" rel="noreferrer"><Button size="icon-sm" variant="ghost"><RiExternalLinkLine className="size-4" /></Button></a></div></article>; })}
            {!visible.length ? <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-muted-foreground"><div><RiGitForkLine className="mx-auto size-6" /><p className="mt-3">GitHub 中暂无符合条件的 Fork 仓库</p></div></div> : null}
          </Card>}
      {filtered.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}

      <Modal open={Boolean(selected)} title={selected?.fullName || "Fork"} description={selected?.parentFullName ? `Upstream ${selected.parentFullName}` : "Fork 详情"} onClose={() => setSelected(null)}>{selected ? <div className="grid gap-4"><div className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">Ahead</div><div className="mt-1 font-medium">{selected.aheadBy ?? "未知"}</div></div><div><div className="text-xs text-muted-foreground">Behind</div><div className="mt-1 font-medium">{selected.behindBy ?? "未知"}</div></div></div>{selected.latestWorkflow ? <div className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center gap-2"><RiCheckboxCircleLine className="size-4" />Latest Action · {selected.latestWorkflow.name}</div><div className="mt-1 text-xs text-muted-foreground">{selected.latestWorkflow.conclusion || selected.latestWorkflow.status}</div></div> : null}<div className="flex flex-wrap gap-2">{selected.behindBy && selected.behindBy > 0 ? <Button onClick={() => void syncUpstream(selected)} loading={syncing === selected.fullName}>同步 upstream</Button> : null}<a href={selected.htmlUrl} target="_blank" rel="noreferrer"><Button variant="outline"><RiExternalLinkLine className="size-4" />打开 Fork</Button></a>{selected.parentHtmlUrl ? <a href={selected.parentHtmlUrl} target="_blank" rel="noreferrer"><Button variant="outline">打开 Upstream</Button></a> : null}</div></div> : null}</Modal>
    </div>
  );
}
