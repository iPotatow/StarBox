import {
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiStarLine,
  RiTimeLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { fetchReleaseDetail, fetchReleaseFeed } from "../../lib/api";
import { runOptimisticMutation } from "../../lib/mutations";
import { mergeSuccessfulReleaseFeed, releaseStateKey } from "../../lib/storage";
import type { PersistedState, ReleaseItem } from "../../types";

function stateKey(release: ReleaseItem) { return releaseStateKey(release.id); }
function releaseCardKey(release: ReleaseItem) { return `${release.repoFullName}#${stateKey(release)}`; }
function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function matchesPattern(value: string, pattern: string) { if (!pattern.trim()) return true; try { return new RegExp(pattern, "i").test(value); } catch { return value.toLowerCase().includes(pattern.trim().toLowerCase()); } }

export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: () => void; goToStars: () => void; initialLoading?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ReleaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [page, setPage] = useState(1);
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const settings = state.releaseSettings;
  const unreadCount = useMemo(() => state.releases.filter((release) => state.releaseSubscriptions.includes(release.repoFullName) && !state.releaseStates[stateKey(release)]?.read).length, [state.releases, state.releaseStates, state.releaseSubscriptions]);

  const sync = useCallback(async () => {
    if (!hasGithubCredential) { setError("请先在设置中连接 GitHub 凭据"); return; }
    if (!state.releaseSubscriptions.length) { setSuccess("还没有从 Stars 订阅 Release 的仓库"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const sinceByRepo: Record<string, string> = {};
      for (const fullName of state.releaseSubscriptions) { const latest = state.releases.filter((release) => release.repoFullName === fullName).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0]; if (latest) sinceByRepo[fullName] = latest.publishedAt || latest.createdAt; }
      const result = await fetchReleaseFeed(token, state.releaseSubscriptions, sinceByRepo, settings.syncPages);
      onStateChange(mergeSuccessfulReleaseFeed(state, result.releases, state.releaseSubscriptions, result.failures, new Date().toISOString()));
      if (result.failures.length) setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`); else setSuccess(`同步完成：新增/更新 ${result.releases.length} 条 Release`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 同步失败"); } finally { setLoading(false); }
  }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);

  useEffect(() => { if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length) return; setDidInitialLoad(true); void sync(); }, [didInitialLoad, hasGithubCredential, state.releaseSubscriptions.length, sync]);
  async function markRead(release: ReleaseItem, read = true) { try { await runOptimisticMutation(state, { ...state, releaseStates: { ...state.releaseStates, [stateKey(release)]: { read, updatedAt: new Date().toISOString() } } }, onStateChange, { operation: read ? "release.read" : "release.unread", payload: { releaseId: releaseStateKey(release.id), repoFullName: release.repoFullName, read } }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 已读状态更新失败"); } }
  async function openDetail(release: ReleaseItem) { void markRead(release, true); setDetail(release); if (!hasGithubCredential) return; setDetailLoading(true); try { setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id)); } catch { /* cached detail remains visible */ } finally { setDetailLoading(false); } }
  function updateSettings(patch: Partial<typeof settings>) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase(); const allowed = new Set(state.releaseSubscriptions);
    let items = state.releases.filter((release) => allowed.has(release.repoFullName)).filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !repositoryFilter || release.repoFullName === repositoryFilter).filter((release) => readFilter === "all" || (readFilter === "read" ? Boolean(state.releaseStates[stateKey(release)]?.read) : !state.releaseStates[stateKey(release)]?.read)).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
    if (settings.latestOnly) { const first = new Map<string, ReleaseItem>(); for (const release of items) if (!first.has(release.repoFullName)) first.set(release.repoFullName, release); items = Array.from(first.values()); }
    return items;
  }, [state.releases, state.releaseSubscriptions, state.releaseStates, query, repositoryFilter, readFilter, settings.includePrereleases, settings.latestOnly]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
  const visible = filtered.slice((page - 1) * settings.pageSize, page * settings.pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const filteredAssets = (release: ReleaseItem) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)));
  const pageLoading = (initialLoading || loading) && !state.releases.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Release</h1><p className="mt-1 text-sm text-muted-foreground">来自 Stars 的 {state.releaseSubscriptions.length} 个订阅 · {unreadCount} 未读{state.lastReleaseSyncAt ? ` · 上次同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")}` : ""}</p></div><Button onClick={() => void sync()} loading={loading} disabled={!state.releaseSubscriptions.length}><RiRefreshLine className="size-4" />同步 Release</Button></header>
      <StatusBanner error={error} success={!error ? success : ""} />

      <Toolbar className="mb-5" aria-label="Release 工具栏">
        <ToolbarGroup className="min-w-[240px] flex-1"><div className="relative w-full"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-full min-w-[220px] pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索版本、标题和 Release Notes" /></div></ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup><Select value={repositoryFilter} onChange={(event) => { setRepositoryFilter(event.target.value); setPage(1); }} className="min-w-44"><option value="">全部订阅仓库</option>{state.releaseSubscriptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select><Select value={readFilter} onChange={(event) => { setReadFilter(event.target.value as typeof readFilter); setPage(1); }} className="min-w-28"><option value="all">全部状态</option><option value="unread">未读</option><option value="read">已读</option></Select></ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup><ToggleGroup multiple value={[...(settings.latestOnly ? ["latest"] : []), ...(settings.includePrereleases ? ["prerelease"] : [])]} onValueChange={(values) => updateSettings({ latestOnly: values.includes("latest"), includePrereleases: values.includes("prerelease") })}><ToggleGroupItem value="latest" className="w-auto px-2.5 text-xs">仅最新</ToggleGroupItem><ToggleGroupItem value="prerelease" className="w-auto px-2.5 text-xs">预发布</ToggleGroupItem></ToggleGroup></ToolbarGroup>
      </Toolbar>

      {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">需要 GitHub 凭据才能同步 Release。</p><Button className="mt-3" variant="outline" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>
        : !state.releaseSubscriptions.length ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border p-8 text-center"><div><RiStarLine className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">暂无 Release 订阅</h2><p className="mt-1 text-sm text-muted-foreground">请在 Stars 页面选择需要关注 Release 的仓库。</p><Button className="mt-4" variant="outline" onClick={goToStars}>前往 Stars</Button></div></div>
          : pageLoading ? <div className="grid gap-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="rounded-xl p-4"><div className="flex gap-3"><Skeleton className="size-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div></div></Card>)}</div>
            : <>
              <div className="grid gap-3">{visible.map((release) => { const read = Boolean(state.releaseStates[stateKey(release)]?.read); const assets = filteredAssets(release); return <Card key={releaseCardKey(release)} render={<article />} className={`rounded-xl p-4 shadow-card ${read ? "border-border" : "border-foreground/25"}`}><div className="flex items-start gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><RiTimeLine className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Button variant="link" size="none" className="text-left text-sm font-semibold" onClick={() => void openDetail(release)}>{release.name || release.tagName}</Button>{release.prerelease ? <Badge>prerelease</Badge> : null}{!read ? <Badge>unread</Badge> : null}</div><div className="mt-1 text-xs text-muted-foreground">{release.repoFullName} · {release.tagName} · {new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")}</div><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{release.body || "暂无 Release Notes"}</p>{assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.slice(0, 6).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent">{asset.name} · {formatSize(asset.size)}</a>)}</div> : release.assets.length ? <div className="mt-3 text-xs text-muted-foreground">资产已被设置中的过滤规则隐藏</div> : null}</div><div className="flex gap-1"><Tooltip content={read ? "标为未读" : "标为已读"}><Button variant="ghost" size="icon-sm" onClick={() => markRead(release, !read)} aria-label={read ? "标为未读" : "标为已读"}>{read ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></Tooltip><a href={release.htmlUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon-sm"><RiExternalLinkLine className="size-4" /></Button></a></div></div></Card>; })}</div>
              {!visible.length ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"><div className="text-center"><RiNotification2Line className="mx-auto mb-3 size-5" />暂无符合当前筛选的 Release</div></div> : null}
              {filtered.length > settings.pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}
            </>}

      <Modal open={Boolean(detail)} title={detail?.name || detail?.tagName || "Release"} description={detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined} onClose={() => setDetail(null)}><div className="grid gap-4">{detailLoading ? <div className="grid gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div> : null}<p className="max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detail?.body || "暂无 Release Notes"}</p>{detail ? <div className="grid gap-2">{filteredAssets(detail).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"><span className="truncate">{asset.name}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatSize(asset.size)} · {asset.downloadCount} downloads</span></a>)}</div> : null}{detail ? <div className="flex gap-2"><Button variant="outline" onClick={() => markRead(detail, false)}><RiEyeOffLine className="size-4" />标为未读</Button><a href={detail.htmlUrl} target="_blank" rel="noreferrer"><Button><RiExternalLinkLine className="size-4" />GitHub Release</Button></a></div> : null}</div></Modal>
    </div>
  );
}
