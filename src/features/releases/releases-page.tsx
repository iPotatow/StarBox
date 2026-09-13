import {
  RiExternalLinkLine,
  RiMagicLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiStarLine,
  RiTimeLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { Modal } from "../../components/ui/modal";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { fetchReleaseDetail, fetchReleaseFeed, summarizeRelease } from "../../lib/api";
import { mergeSuccessfulReleaseFeed } from "../../lib/storage";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { AiReleaseSummary, PersistedState, ReleaseItem } from "../../types";

type ReleaseView = "timeline" | "repository";
type ReleaseScope = "all" | "stable" | "latest" | "latest-stable";
type AssetPlatform = "all" | "macos" | "windows" | "linux" | "arm";
type AssetType = "all" | "dmg" | "zip" | "appimage" | "installer" | "package" | "apk" | "archive";

function releaseCardKey(release: ReleaseItem) { return `${release.repoFullName}#${release.id}`; }
function releaseScope(latestOnly: boolean, includePrereleases: boolean): ReleaseScope {
  if (latestOnly) return includePrereleases ? "latest" : "latest-stable";
  return includePrereleases ? "all" : "stable";
}
function scopeSettings(scope: ReleaseScope) {
  return { latestOnly: scope === "latest" || scope === "latest-stable", includePrereleases: scope === "all" || scope === "latest" };
}
function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function matchesPattern(value: string, pattern: string) { if (!pattern.trim()) return true; try { return new RegExp(pattern, "i").test(value); } catch { return value.toLowerCase().includes(pattern.trim().toLowerCase()); } }
function matchesPlatform(name: string, platform: AssetPlatform) {
  if (platform === "all") return true;
  const value = name.toLowerCase();
  if (platform === "macos") return /(macos|mac[-_.]?os|darwin|osx|\.dmg\b)/i.test(value);
  if (platform === "windows") return /(windows|win32|win64|\.exe\b|\.msi\b)/i.test(value);
  if (platform === "linux") return /(linux|appimage|\.deb\b|\.rpm\b)/i.test(value);
  return /(arm64|aarch64|armv7|armv8|[-_.]arm[-_.])/i.test(value);
}
function matchesType(name: string, type: AssetType) {
  if (type === "all") return true;
  const value = name.toLowerCase();
  if (type === "dmg") return value.endsWith(".dmg");
  if (type === "zip") return value.endsWith(".zip");
  if (type === "appimage") return value.endsWith(".appimage");
  if (type === "installer") return /\.(exe|msi)$/.test(value);
  if (type === "package") return /\.(deb|rpm)$/.test(value);
  if (type === "apk") return value.endsWith(".apk");
  return /\.(tar\.gz|tar\.xz|tgz|txz|7z|rar)$/.test(value);
}

function SummaryPanel({ summary }: { summary: AiReleaseSummary }) {
  const sections = [
    ["重点", summary.highlights],
    ["修复", summary.fixes],
    ["Breaking Changes", summary.breakingChanges],
  ] as const;
  return <details className="mt-3 rounded-xl border border-border bg-secondary/35 p-3"><summary className="cursor-pointer text-xs font-semibold"><span className="inline-flex items-center gap-2"><RiMagicLine className="size-4" />AI Release Summary · {summary.highlights.length + summary.fixes.length + summary.breakingChanges.length} 个重点</span></summary><p className="mt-2 text-sm leading-6">{summary.overview}</p>{sections.map(([label, items]) => items.length ? <div key={label} className="mt-2"><div className="text-xs font-medium text-muted-foreground">{label}</div><ul className="mt-1 grid gap-1 text-xs leading-5 text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div> : null)}</details>;
}

function ReleaseCard({ release, assets, hiddenCount, aiEnabled, aiSummary, aiLoading, aiError, onOpen, onSummarize }: { release: ReleaseItem; assets: ReleaseItem["assets"]; hiddenCount: number; aiEnabled: boolean; aiSummary?: AiReleaseSummary; aiLoading: boolean; aiError?: string; onOpen: () => void; onSummarize: () => void }) {
  return <Card render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><RiTimeLine className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Button variant="link" size="none" className="text-left text-sm font-semibold" onClick={onOpen}>{release.name || release.tagName}</Button>{release.prerelease ? <Badge>prerelease</Badge> : null}</div><div className="mt-1 text-xs text-muted-foreground">{release.repoFullName} · {release.tagName} · {new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")}</div><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{release.body || "暂无 Release Notes"}</p>{aiSummary ? <SummaryPanel summary={aiSummary} /> : null}{aiError ? <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{aiError}</div> : null}{assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.slice(0, 3).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent">{asset.name} · {formatSize(asset.size)}</a>)}</div> : null}{hiddenCount ? <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span>还有 {hiddenCount} 个 Assets 未在卡片展示（含筛选规则）</span></div> : null}</div><div className="flex shrink-0 gap-1"><Tooltip content={aiEnabled ? (aiSummary ? "重新生成 AI Summary" : "生成 AI Summary") : "请先在设置中配置 AI Provider"}><span><Button variant="ghost" size="icon-sm" loading={aiLoading} disabled={!aiEnabled} onClick={onSummarize} aria-label="AI Release Summary"><RiMagicLine className="size-4" /></Button></span></Tooltip><Button render={<a href={release.htmlUrl} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" aria-label="打开 GitHub Release"><RiExternalLinkLine className="size-4" /></Button></div></div></Card>;
}

export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: (tab?: string) => void; goToStars: () => void; initialLoading?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ReleaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [repositoryFilter, setRepositoryFilter] = useState(() => readQueryParam("repo"));
  const [viewMode, setViewMode] = useState<ReleaseView>(() => readQueryParam("view") === "repository" ? "repository" : "timeline");
  const [assetPlatform, setAssetPlatform] = useState<AssetPlatform>(() => { const v = readQueryParam("platform"); return ["macos","windows","linux","arm"].includes(v) ? v as AssetPlatform : "all"; });
  const [assetType, setAssetType] = useState<AssetType>(() => { const v = readQueryParam("asset"); return ["dmg","zip","appimage","installer","package","apk","archive"].includes(v) ? v as AssetType : "all"; });
  const [page, setPage] = useState(() => readQueryNumber("page", 1));
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, AiReleaseSummary>>({});
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState("");
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const settings = state.releaseSettings;
  const aiEnabled = Boolean(state.settings.ai.baseUrl && state.settings.ai.apiKey && state.settings.ai.model);
  useEffect(() => { replaceQueryParams({ q: query, repo: repositoryFilter, view: viewMode === "timeline" ? "" : viewMode, platform: assetPlatform === "all" ? "" : assetPlatform, asset: assetType === "all" ? "" : assetType, page: page === 1 ? "" : page, latest: settings.latestOnly ? "1" : "", prerelease: settings.includePrereleases ? "1" : "" }); }, [query, repositoryFilter, viewMode, assetPlatform, assetType, page, settings.latestOnly, settings.includePrereleases]);

  const sync = useCallback(async () => {
    if (!hasGithubCredential) { setError("请先在设置中连接 GitHub 凭据"); return; }
    if (!state.releaseSubscriptions.length) { setSuccess("还没有从 Stars 订阅 Release 的仓库"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const sinceByRepo: Record<string, string> = {};
      for (const fullName of state.releaseSubscriptions) { const latest = state.releases.filter((release) => release.repoFullName === fullName).sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0]; if (latest) sinceByRepo[fullName] = latest.publishedAt || latest.createdAt; }
      const result = await fetchReleaseFeed(token, state.releaseSubscriptions, sinceByRepo, settings.syncPages);
      onStateChange(mergeSuccessfulReleaseFeed(state, result.releases, state.releaseSubscriptions, result.failures, new Date().toISOString()));
      if (result.failures.length) setError(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`); else { setSuccess(""); notify("Release 同步完成", `新增/更新 ${result.releases.length} 条`, "success"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Release 同步失败"); } finally { setLoading(false); }
  }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);

  useEffect(() => { if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length) return; setDidInitialLoad(true); void sync(); }, [didInitialLoad, hasGithubCredential, state.releaseSubscriptions.length, sync]);
  async function openDetail(release: ReleaseItem) { setDetail(release); setDetailError(""); if (!hasGithubCredential) { setDetailError("未连接 GitHub 凭据，当前显示缓存内容。"); return; } setDetailLoading(true); try { setDetail(await fetchReleaseDetail(token, release.repoFullName, release.id)); } catch (reason) { setDetailError(`${reason instanceof Error ? reason.message : "Release 详情加载失败"}。当前继续显示缓存内容。`); } finally { setDetailLoading(false); } }
  async function runSummary(release: ReleaseItem) { if (!aiEnabled) return; const key = releaseCardKey(release); setSummaryLoading(key); setSummaryErrors((current) => ({ ...current, [key]: "" })); try { const summary = await summarizeRelease(state.settings.ai, release); setSummaries((current) => ({ ...current, [key]: summary })); } catch (reason) { setSummaryErrors((current) => ({ ...current, [key]: reason instanceof Error ? reason.message : "AI Release Summary 失败" })); } finally { setSummaryLoading(""); } }
  function updateSettings(patch: Partial<typeof settings>) { onStateChange({ ...state, releaseSettings: { ...settings, ...patch } }); setPage(1); }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase(); const allowed = new Set(state.releaseSubscriptions);
    let items = state.releases.filter((release) => allowed.has(release.repoFullName)).filter((release) => settings.includePrereleases || !release.prerelease).filter((release) => !repositoryFilter || release.repoFullName === repositoryFilter).filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle));
    if (settings.latestOnly) { const first = new Map<string, ReleaseItem>(); for (const release of items) if (!first.has(release.repoFullName)) first.set(release.repoFullName, release); items = Array.from(first.values()); }
    return items;
  }, [state.releases, state.releaseSubscriptions, query, repositoryFilter, settings.includePrereleases, settings.latestOnly]);
  const groups = useMemo(() => { const map = new Map<string, ReleaseItem[]>(); for (const release of filtered) map.set(release.repoFullName, [...(map.get(release.repoFullName) || []), release]); return Array.from(map.entries()).map(([repoFullName, releases]) => ({ repoFullName, releases })); }, [filtered]);
  const pageSize = viewMode === "timeline" ? settings.pageSize : Math.min(10, settings.pageSize);
  const collectionLength = viewMode === "timeline" ? filtered.length : groups.length;
  const totalPages = Math.max(1, Math.ceil(collectionLength / pageSize));
  const visibleReleases = filtered.slice((page - 1) * pageSize, page * pageSize);
  const visibleGroups = groups.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  function changePage(next: number) { setPage(Math.max(1, Math.min(totalPages, next))); requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" })); }
  const filteredAssets = (release: ReleaseItem) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)) && matchesPlatform(asset.name, assetPlatform) && matchesType(asset.name, assetType));
  const pageLoading = (initialLoading || loading) && !state.releases.length;
  const renderRelease = (release: ReleaseItem) => { const assets = filteredAssets(release); const key = releaseCardKey(release); return <ReleaseCard key={key} release={release} assets={assets} hiddenCount={Math.max(0, release.assets.length - Math.min(3, assets.length))} aiEnabled={aiEnabled} aiSummary={summaries[key]} aiLoading={summaryLoading === key} aiError={summaryErrors[key]} onOpen={() => void openDetail(release)} onSummarize={() => void runSummary(release)} />; };

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Release</h1><p className="mt-1 text-sm text-muted-foreground">来自 Stars 的 {state.releaseSubscriptions.length} 个订阅{state.lastReleaseSyncAt ? ` · 上次同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")}` : ""}</p></div><Button onClick={() => void sync()} loading={loading} disabled={!state.releaseSubscriptions.length}><RiRefreshLine className="size-4" />同步 Release</Button></header>
    <StatusBanner error={error} success={!error ? success : ""} />
    <Toolbar className="mb-5" aria-label="Release 工具栏">
      <ToolbarGroup className="min-w-[260px] flex-1"><InputGroup className="min-w-[240px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label="搜索 Release" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索版本、标题和 Release Notes" /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup><Select aria-label="筛选订阅仓库" value={repositoryFilter} onChange={(event) => { setRepositoryFilter(event.target.value); setPage(1); }} className="min-w-44"><option value="">全部订阅仓库</option>{state.releaseSubscriptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select></ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup><ToggleGroup value={[viewMode]} onValueChange={(values) => { const next = values.at(-1); if (next === "timeline" || next === "repository") { setViewMode(next); setPage(1); } }}><ToggleGroupItem value="timeline" className="w-auto px-2.5 text-xs">时间线</ToggleGroupItem><ToggleGroupItem value="repository" className="w-auto px-2.5 text-xs">按仓库</ToggleGroupItem></ToggleGroup></ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <Select aria-label="版本范围" value={releaseScope(settings.latestOnly, settings.includePrereleases)} onChange={(event) => updateSettings(scopeSettings(event.target.value as ReleaseScope))} className="min-w-40"><option value="all">全部版本</option><option value="stable">仅稳定版</option><option value="latest">每仓库最新</option><option value="latest-stable">每仓库最新稳定版</option></Select>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup aria-label="Asset 快速过滤">
        <Select aria-label="筛选 Asset 平台" value={assetPlatform} onChange={(event) => { setAssetPlatform(event.target.value as AssetPlatform); setPage(1); }} className="min-w-28"><option value="all">全部平台</option><option value="macos">macOS</option><option value="windows">Windows</option><option value="linux">Linux</option><option value="arm">ARM</option></Select>
        <Select aria-label="筛选 Asset 类型" value={assetType} onChange={(event) => { setAssetType(event.target.value as AssetType); setPage(1); }} className="min-w-32"><option value="all">全部类型</option><option value="dmg">DMG</option><option value="zip">ZIP</option><option value="appimage">AppImage</option><option value="installer">EXE / MSI</option><option value="package">DEB / RPM</option><option value="apk">APK</option><option value="archive">TAR / 7Z</option></Select>
        {assetPlatform !== "all" || assetType !== "all" ? <Button size="sm" variant="ghost" onClick={() => { setAssetPlatform("all"); setAssetType("all"); setPage(1); }}>清除 Asset</Button> : null}
        <Tooltip content="管理 Asset include / exclude Regex"><Button size="icon-sm" variant="ghost" aria-label="管理 Asset 规则" onClick={() => goToSettings("data")}><RiSettings4Line className="size-4" /></Button></Tooltip>
      </ToolbarGroup>
    </Toolbar>

    {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">需要 GitHub 凭据才能同步 Release。</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><RiSettings4Line className="size-4" />打开设置</Button></div>
      : !state.releaseSubscriptions.length ? <Empty className="min-h-72"><EmptyContent><EmptyIcon><RiStarLine className="size-5" /></EmptyIcon><EmptyTitle>暂无 Release 订阅</EmptyTitle><EmptyDescription>请在 Stars 页面选择需要关注 Release 的仓库。</EmptyDescription><Button className="mt-4" variant="outline" onClick={goToStars}>前往 Stars</Button></EmptyContent></Empty>
        : pageLoading ? <div className="grid gap-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="rounded-xl p-4"><div className="flex gap-3"><Skeleton className="size-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div></div></Card>)}</div>
          : <><div ref={resultsTopRef} />{viewMode === "timeline" ? <div className="grid gap-3">{visibleReleases.map(renderRelease)}</div> : <div className="grid gap-5">{visibleGroups.map((group) => <section key={group.repoFullName} className="rounded-2xl border border-border bg-secondary/20 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{group.repoFullName}</h2><p className="mt-1 text-xs text-muted-foreground">{group.releases.length} 个 Release</p></div><Button render={<a href={`https://github.com/${group.repoFullName}/releases`} target="_blank" rel="noreferrer" />} size="sm" variant="ghost"><RiExternalLinkLine className="size-4" />Releases</Button></div><div className="grid gap-3">{group.releases.map(renderRelease)}</div></section>)}</div>}{!collectionLength ? <Empty><EmptyContent><EmptyIcon><RiNotification2Line className="size-5" /></EmptyIcon><EmptyTitle>暂无符合当前筛选的 Release</EmptyTitle><EmptyDescription>调整仓库、版本范围或 Asset 筛选条件后再试。</EmptyDescription></EmptyContent></Empty> : null}{collectionLength > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}</>}

    <Modal open={Boolean(detail)} title={detail?.name || detail?.tagName || "Release"} description={detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined} onClose={() => setDetail(null)}><div className="grid gap-4">{detailError && detail ? <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{detailError}<Button className="ml-2" size="sm" variant="ghost" onClick={() => void openDetail(detail)}>重试</Button></div> : null}{detailLoading ? <div className="grid gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div> : null}{detail ? summaries[releaseCardKey(detail)] ? <SummaryPanel summary={summaries[releaseCardKey(detail)]} /> : <Tooltip content={aiEnabled ? "生成当前 Release 的 AI Summary" : "请先配置 AI Provider"}><Button variant="outline" disabled={!aiEnabled} loading={summaryLoading === releaseCardKey(detail)} onClick={() => void runSummary(detail)}><RiMagicLine className="size-4" />AI 总结</Button></Tooltip> : null}<div className="max-h-[45vh] overflow-auto rounded-xl border border-border bg-secondary/20 p-4">{detail?.body ? <MarkdownContent content={detail.body} /> : <p className="text-sm text-muted-foreground">暂无 Release Notes</p>}</div>{detail ? <div className="grid gap-2"><div className="text-xs text-muted-foreground">Assets 当前筛选：{assetPlatform === "all" ? "全部平台" : assetPlatform} · {assetType === "all" ? "全部类型" : assetType}</div>{filteredAssets(detail).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"><span className="truncate">{asset.name}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatSize(asset.size)} · {asset.downloadCount} downloads</span></a>)}</div> : null}{detail ? <Button render={<a href={detail.htmlUrl} target="_blank" rel="noreferrer" />}><RiExternalLinkLine className="size-4" />GitHub Release</Button> : null}</div></Modal>
  </div>;
}
