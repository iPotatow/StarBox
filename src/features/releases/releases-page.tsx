import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiTimeLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Tooltip } from "../../components/ui/tooltip";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { fetchReleaseDetail, fetchReleaseFeed, fetchWatchedRepositories } from "../../lib/api";
import { runOptimisticMutation } from "../../lib/mutations";
import type { PersistedState, ReleaseItem } from "../../types";

function stateKey(release: ReleaseItem) { return `${release.repoFullName}#${release.id}`; }
function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function matchesPattern(value: string, pattern: string) { if (!pattern.trim()) return true; try { return new RegExp(pattern, "i").test(value); } catch { return value.toLowerCase().includes(pattern.trim().toLowerCase()); } }

export function ReleasesPage({ state, onStateChange, goToSettings }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: () => void }) {
  const [loading, setLoading] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ReleaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [subscribeValue, setSubscribeValue] = useState("");
  const [directValue, setDirectValue] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const settings = state.releaseSettings;

  const candidates = useMemo(() => state.repositories.filter((repo) => !state.releaseSubscriptions.includes(repo.full_name)).sort((a, b) => a.full_name.localeCompare(b.full_name)), [state.repositories, state.releaseSubscriptions]);
  const unreadCount = useMemo(() => state.releases.filter((release) => !state.releaseStates[stateKey(release)]?.read).length, [state.releases, state.releaseStates]);

  const sync = useCallback(async () => {
    if (!hasGithubCredential) { setError("请先在设置中连接 GitHub 凭据"); return; }
    if (!state.releaseSubscriptions.length) { setSuccess("还没有 Release 订阅"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const sinceByRepo: Record<string, string> = {};
      for (const fullName of state.releaseSubscriptions) {
        const latest = state.releases.filter((release) => release.repoFullName === fullName).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0];
        if (latest) sinceByRepo[fullName] = latest.publishedAt || latest.createdAt;
      }
      const result = await fetchReleaseFeed(token, state.releaseSubscriptions, sinceByRepo, settings.syncPages);
      const merged = new Map(state.releases.map((release) => [`${release.repoFullName}#${release.id}`, release]));
      result.releases.forEach((release) => merged.set(`${release.repoFullName}#${release.id}`, release));
      const releases = Array.from(merged.values()).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
      onStateChange({ ...state, releases, lastReleaseSyncAt: new Date().toISOString() });
      if (result.failures.length) setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`); else setSuccess(`增量同步完成：新增/更新 ${result.releases.length} 条 Release`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 同步失败"); } finally { setLoading(false); }
  }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);

  useEffect(() => { if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length) return; setDidInitialLoad(true); void sync(); }, [didInitialLoad, hasGithubCredential, token, state.releaseSubscriptions.length, sync]);

  async function subscribe(fullName: string) { const value = fullName.trim(); if (!/^[^/\s]+\/[^/\s]+$/.test(value)) return setError("订阅仓库需要 owner/repo 格式"); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(new Set([...state.releaseSubscriptions, value])) }, onStateChange, { operation: "release.subscribe", payload: { repoFullName: value } }); setSubscribeValue(""); setDirectValue(""); setSuccess(`已订阅 ${value}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 订阅失败"); } }
  async function unsubscribe(fullName: string) { try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: state.releaseSubscriptions.filter((item) => item !== fullName), releases: state.releases.filter((release) => release.repoFullName !== fullName) }, onStateChange, { operation: "release.unsubscribe", payload: { repoFullName: fullName } }); setSuccess(`已取消订阅 ${fullName}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "取消 Release 订阅失败"); } }
  async function importWatching() {
    if (!hasGithubCredential) return goToSettings(); setWatchLoading(true); setError("");
    try { const watched = await fetchWatchedRepositories(token); const names = watched.map((repo) => repo.full_name); const next = Array.from(new Set([...state.releaseSubscriptions, ...names])); await runOptimisticMutation(state, { ...state, releaseSubscriptions: next }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } }); setSuccess(`已从 Watching 导入 ${names.length} 个仓库`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Watching 导入失败"); } finally { setWatchLoading(false); }
  }
  async function markRead(release: ReleaseItem, read = true) { try { await runOptimisticMutation(state, { ...state, releaseStates: { ...state.releaseStates, [stateKey(release)]: { read, updatedAt: new Date().toISOString() } } }, onStateChange, { operation: read ? "release.read" : "release.unread", payload: { releaseId: release.id, repoFullName: release.repoFullName, read } }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 已读状态更新失败"); } }
  async function openDetail(release: ReleaseItem) { void markRead(release, true); if (!hasGithubCredential) return setDetail(release); setDetail(release); setDetailLoading(true); try { setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id)); } catch { /* cached detail remains visible */ } finally { setDetailLoading(false); } }
  function updateSettings(patch: Partial<typeof settings>) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let items = state.releases.filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
    if (settings.latestOnly) {
      const first = new Map<string, ReleaseItem>(); for (const release of items) if (!first.has(release.repoFullName)) first.set(release.repoFullName, release); items = Array.from(first.values());
    }
    return items;
  }, [state.releases, query, settings.includePrereleases, settings.latestOnly]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
  const visible = filtered.slice((page - 1) * settings.pageSize, page * settings.pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const filteredAssets = (release: ReleaseItem) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Release</h1><p className="mt-1 text-sm text-muted-foreground">{state.lastReleaseSyncAt ? `上次增量同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")} · ${unreadCount} 未读` : `${state.releaseSubscriptions.length} 个订阅 · ${unreadCount} 未读`}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void importWatching()} loading={watchLoading}>导入 Watching</Button><Button onClick={() => void sync()} loading={loading}><RiRefreshLine className="size-4" />增量同步</Button></div></header>
      <StatusBanner error={error} success={!error ? success : ""} />

      <Card className="mb-5 grid gap-3 rounded-xl p-3 shadow-card lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-2"><Select value={subscribeValue} onChange={(event) => { setSubscribeValue(event.target.value); if (event.target.value) subscribe(event.target.value); }}><option value="">从 Stars 添加订阅…</option>{candidates.map((repo) => <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>)}</Select><Input className="max-w-xs" value={directValue} onChange={(event) => setDirectValue(event.target.value)} placeholder="直接订阅 owner/repo" onKeyDown={(event) => { if (event.key === "Enter") subscribe(directValue); }} /><Button variant="outline" onClick={() => subscribe(directValue)}><RiAddLine className="size-4" />订阅</Button></div>
        <div className="flex flex-wrap gap-2"><label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs"><Checkbox checked={settings.latestOnly} onCheckedChange={(checked) => updateSettings({ latestOnly: checked })} aria-label="仅最新版" />仅最新版</label><label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs"><Checkbox checked={settings.includePrereleases} onCheckedChange={(checked) => updateSettings({ includePrereleases: checked })} aria-label="包含预发布" />包含预发布</label></div>
        <div className="relative lg:col-span-2"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索仓库、版本、标题和 Release Notes" /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-4"><Field label="资产 include 规则"><Input value={settings.assetIncludePattern} onChange={(event) => updateSettings({ assetIncludePattern: event.target.value })} placeholder="例如 \\.zip$ 或 linux" /></Field><Field label="资产 exclude 规则"><Input value={settings.assetExcludePattern} onChange={(event) => updateSettings({ assetExcludePattern: event.target.value })} placeholder="例如 checksum|source" /></Field><Field label="每页"><Select value={String(settings.pageSize)} onChange={(event) => updateSettings({ pageSize: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></Select></Field><Field label="同步深度"><Select value={String(settings.syncPages)} onChange={(event) => updateSettings({ syncPages: Number(event.target.value) })}><option value="1">1 页 / 仓库</option><option value="3">3 页 / 仓库</option><option value="5">5 页 / 仓库</option></Select></Field></div>
      </Card>

      {state.releaseSubscriptions.length ? <div className="mb-5 flex flex-wrap gap-1.5">{state.releaseSubscriptions.map((name) => <Tooltip key={name} content="点击取消订阅"><Button variant="ghost" size="none" onClick={() => unsubscribe(name)} aria-label={`取消订阅 ${name}`}><Badge>{name} ×</Badge></Button></Tooltip>)}</div> : null}
      {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">需要 GitHub 凭据才能同步 Release。</p><Button className="mt-3" variant="outline" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div> : null}

      <div className="grid gap-3">{visible.map((release) => { const read = Boolean(state.releaseStates[stateKey(release)]?.read); const assets = filteredAssets(release); return <Card key={stateKey(release)} render={<article />} className={`rounded-xl p-4 shadow-card ${read ? "border-border" : "border-foreground/25"}`}><div className="flex items-start gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><RiTimeLine className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Button variant="link" size="none" className="text-left text-sm font-semibold" onClick={() => void openDetail(release)}>{release.name || release.tagName}</Button>{release.prerelease ? <Badge>prerelease</Badge> : null}{!read ? <Badge>unread</Badge> : null}</div><div className="mt-1 text-xs text-muted-foreground">{release.repoFullName} · {release.tagName} · {new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")}</div><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{release.body || "暂无 Release Notes"}</p>{assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.slice(0, 6).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent">{asset.name} · {formatSize(asset.size)}</a>)}</div> : release.assets.length ? <div className="mt-3 text-xs text-muted-foreground">资产已被当前过滤规则隐藏</div> : null}</div><div className="flex gap-1"><Tooltip content={read ? "标为未读" : "标为已读"}><Button variant="ghost" size="icon-sm" onClick={() => markRead(release, !read)} aria-label={read ? "标为未读" : "标为已读"}>{read ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></Tooltip><a href={release.htmlUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon-sm"><RiExternalLinkLine className="size-4" /></Button></a></div></div></Card>; })}</div>
      {!visible.length ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"><div className="text-center"><RiNotification2Line className="mx-auto mb-3 size-5" />{state.releaseSubscriptions.length ? "暂无符合当前筛选的 Release" : "先添加 Release 订阅"}</div></div> : null}
      {filtered.length > settings.pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}

      <Modal open={Boolean(detail)} title={detail?.name || detail?.tagName || "Release"} description={detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined} onClose={() => setDetail(null)}><div className="grid gap-4">{detailLoading ? <div className="text-sm text-muted-foreground">正在刷新详情…</div> : null}<p className="max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detail?.body || "暂无 Release Notes"}</p>{detail ? <div className="grid gap-2">{filteredAssets(detail).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"><span className="truncate">{asset.name}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatSize(asset.size)} · {asset.downloadCount} downloads</span></a>)}</div> : null}{detail ? <div className="flex gap-2"><Button variant="outline" onClick={() => markRead(detail, false)}><RiEyeOffLine className="size-4" />标为未读</Button><a href={detail.htmlUrl} target="_blank" rel="noreferrer"><Button><RiExternalLinkLine className="size-4" />GitHub Release</Button></a></div> : null}</div></Modal>
    </div>
  );
}
