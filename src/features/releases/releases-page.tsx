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
import { notify } from "../../components/ui/toast";
import { fetchReleaseDetail, fetchReleaseFeed, summarizeRelease } from "../../lib/api";
import { mergeSuccessfulReleaseFeed } from "../../lib/storage";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { AiReleaseSummary, PersistedState, ReleaseItem } from "../../types";

type ReleaseView = "timeline" | "repository";
type AssetPlatform = "all" | "macos" | "windows" | "linux" | "arm";
type AssetType = "all" | "dmg" | "zip" | "appimage" | "installer" | "package" | "apk" | "archive";

function releaseCardKey(release: ReleaseItem) { return `${release.repoFullName}#${release.id}`; }
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
  return <div className="mt-3 rounded-xl border border-border bg-secondary/35 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><RiMagicLine className="size-4" />AI Release Summary</div><p className="mt-2 text-sm leading-6">{summary.overview}</p>{sections.map(([label, items]) => items.length ? <div key={label} className="mt-2"><div className="text-[11px] font-medium text-muted-foreground">{label}</div><ul className="mt-1 grid gap-1 text-xs leading-5 text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div> : null)}</div>;
}

function ReleaseCard({ release, assets, hiddenCount, aiEnabled, aiSummary, aiLoading, aiError, onOpen, onSummarize }: { release: ReleaseItem; assets: ReleaseItem["assets"]; hiddenCount: number; aiEnabled: boolean; aiSummary?: AiReleaseSummary; aiLoading: boolean; aiError?: string; onOpen: () => void; onSummarize: () => void }) {
  return <Card render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><RiTimeLine className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Button variant="link" size="none" className="text-left text-sm font-semibold" onClick={onOpen}>{release.name || release.tagName}</Button>{release.prerelease ? <Badge>prerelease</Badge> : null}</div><div className="mt-1 text-xs text-muted-foreground">{release.repoFullName} · {release.tagName} · {new Date(release.publishedAt || release.createdAt).toLocaleString("zh-CN")}</div><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{release.body || "暂无 Release Notes"}</p>{aiSummary ? <SummaryPanel summary={aiSummary} /> : null}{aiError ? <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{aiError}</div> : null}{assets.length ? <div className="mt-3 flex flex-wrap gap-2">{assets.slice(0, 6).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent">{asset.name} · {formatSize(asset.size)}</a>)}</div> : null}{hiddenCount ? <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span>{hiddenCount} 个 Assets 被当前快速筛选或设置规则隐藏</span></div> : null}</div><div className="flex shrink-0 gap-1"><Tooltip content={aiEnabled ? (aiSummary ? "重新生成 AI Summary" : "生成 AI Summary") : "请先在设置中配置 AI Provider"}><Button variant="ghost" size="icon-sm" loading={aiLoading} disabled={!aiEnabled} onClick={onSummarize} aria-label="AI Release Summary">{!aiLoading ? <RiMagicLine className="size-4" /> : null}</Button></Tooltip><a href={release.htmlUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon-sm" aria-label="打开 GitHub Release"><RiExternalLinkLine className="size-4" /></Button></a></div></div></Card>;
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
  const filteredAssets = (release: ReleaseItem) => release.assets.filter((asset) => matchesPattern(asset.name, settings.assetIncludePattern) && (!settings.assetExcludePattern || !matchesPattern(asset.name, settings.assetExcludePattern)) && matchesPlatform(asset.name, assetPlatform) && matchesType(asset.name, assetType));
  const pageLoading = (initialLoading || loading) && !state.releases.length;
  const renderRelease = (release: ReleaseItem) => { const assets = filteredAssets(release); const key = releaseCardKey(release); return <ReleaseCard key={key} release={release} assets={assets} hiddenCount={Math.max(0, release.assets.length - assets.length)} aiEnabled={aiEnabled} aiSummary={summaries[key]} aiLoading={summaryLoading === key} aiError={summaryErrors[key]} onOpen={() => void openDetail(release)} onSummarize={() => void runSummary(release)} />; };

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Release</h1><p className="mt-1 text-sm text-muted-foreground">来自 Stars 的 {state.releaseSubscriptions.length} 个订阅{state.lastReleaseSyncAt ? ` · 上次同步 ${new Date(state.lastReleaseSyncAt).toLocaleString("zh-CN")}` : ""}</p></div><Button onClick={() => void sync()} loading={loading} disabled={!state.releaseSubscriptions.length}><RiRefreshLine className="size-4" />同步 Release</Button></header>
    <StatusBanner error={error} success={!error ? success : ""} />
    <Toolbar className="mb-3" aria-label="Release 工具栏"><ToolbarGroup className="min-w-[240px] flex-1"><div className="relative w-full"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-full min-w-[220px] pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索版本、标题和 Release Notes" /></div></ToolbarGroup><ToolbarSeparator /><ToolbarGroup><Select value={repositoryFilter} onChange={(event) => { setRepositoryFilter(event.target.value); setPage(1); }} className="min-w-44"><option value="">全部订阅仓库</option>{state.releaseSubscriptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select></ToolbarGroup><ToolbarSeparator /><ToolbarGroup><ToggleGroup value={[viewMode]} onValueChange={(values) => { const next = values.at(-1); if (next === "timeline" || next === "repository") { setViewMode(next); setPage(1); } }}><ToggleGroupItem value="timeline" className="w-auto px-2.5 text-xs">时间线</ToggleGroupItem><ToggleGroupItem value="repository" className="w-auto px-2.5 text-xs">按仓库</ToggleGroupItem></ToggleGroup><ToggleGroup multiple value={[...(settings.latestOnly ? ["latest"] : []), ...(settings.includePrereleases ? ["prerelease"] : [])]} onValueChange={(values) => updateSettings({ latestOnly: values.includes("latest"), includePrereleases: values.includes("prerelease") })}><ToggleGroupItem value="latest" className="w-auto px-2.5 text-xs">仅最新</ToggleGroupItem><ToggleGroupItem value="prerelease" className="w-auto px-2.5 text-xs">预发布</ToggleGroupItem></ToggleGroup></ToolbarGroup></Toolbar>
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2"><span className="text-xs font-medium text-muted-foreground">Asset 快速过滤</span><Select value={assetPlatform} onChange={(event) => { setAssetPlatform(event.target.value as AssetPlatform); setPage(1); }} className="min-w-28"><option value="all">全部平台</option><option value="macos">macOS</option><option value="windows">Windows</option><option value="linux">Linux</option><option value="arm">ARM</option></Select><Select value={assetType} onChange={(event) => { setAssetType(event.target.value as AssetType); setPage(1); }} className="min-w-32"><option value="all">全部类型</option><option value="dmg">DMG</option><option value="zip">ZIP</option><option value="appimage">AppImage</option><option value="installer">EXE / MSI</option><option value="package">DEB / RPM</option><option value="apk">APK</option><option value="archive">TAR / 7Z</option></Select>{assetPlatform !== "all" || assetType !== "all" ? <Button size="sm" variant="ghost" onClick={() => { setAssetPlatform("all"); setAssetType("all"); }}>清除 Asset 筛选</Button> : null}<Button className="ml-auto" size="sm" variant="ghost" onClick={() => goToSettings("data")}>管理 Asset 规则</Button><span className="text-xs text-muted-foreground">include/exclude Regex 会叠加生效</span></div>

    {!hasGithubCredential ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">需要 GitHub 凭据才能同步 Release。</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><RiSettings4Line className="size-4" />打开设置</Button></div>
      : !state.releaseSubscriptions.length ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border p-8 text-center"><div><RiStarLine className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">暂无 Release 订阅</h2><p className="mt-1 text-sm text-muted-foreground">请在 Stars 页面选择需要关注 Release 的仓库。</p><Button className="mt-4" variant="outline" onClick={goToStars}>前往 Stars</Button></div></div>
        : pageLoading ? <div className="grid gap-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="rounded-xl p-4"><div className="flex gap-3"><Skeleton className="size-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-4 h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div></div></Card>)}</div>
          : <>{viewMode === "timeline" ? <div className="grid gap-3">{visibleReleases.map(renderRelease)}</div> : <div className="grid gap-5">{visibleGroups.map((group) => <section key={group.repoFullName} className="rounded-2xl border border-border bg-secondary/20 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{group.repoFullName}</h2><p className="mt-1 text-xs text-muted-foreground">{group.releases.length} 个 Release</p></div><a href={`https://github.com/${group.repoFullName}/releases`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><RiExternalLinkLine className="size-4" />Releases</Button></a></div><div className="grid gap-3">{group.releases.map(renderRelease)}</div></section>)}</div>}{!collectionLength ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"><div className="text-center"><RiNotification2Line className="mx-auto mb-3 size-5" />暂无符合当前筛选的 Release</div></div> : null}{collectionLength > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}</>}

    <Modal open={Boolean(detail)} title={detail?.name || detail?.tagName || "Release"} description={detail ? `${detail.repoFullName} · ${detail.tagName}` : undefined} onClose={() => setDetail(null)}><div className="grid gap-4">{detailError && detail ? <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{detailError}<Button className="ml-2" size="sm" variant="ghost" onClick={() => void openDetail(detail)}>重试</Button></div> : null}{detailLoading ? <div className="grid gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div> : null}{detail ? summaries[releaseCardKey(detail)] ? <SummaryPanel summary={summaries[releaseCardKey(detail)]} /> : <Tooltip content={aiEnabled ? "生成当前 Release 的 AI Summary" : "请先配置 AI Provider"}><Button variant="outline" disabled={!aiEnabled} loading={summaryLoading === releaseCardKey(detail)} onClick={() => void runSummary(detail)}><RiMagicLine className="size-4" />AI 总结</Button></Tooltip> : null}<p className="max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detail?.body || "暂无 Release Notes"}</p>{detail ? <div className="grid gap-2">{filteredAssets(detail).map((asset) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"><span className="truncate">{asset.name}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatSize(asset.size)} · {asset.downloadCount} downloads</span></a>)}</div> : null}{detail ? <a href={detail.htmlUrl} target="_blank" rel="noreferrer"><Button><RiExternalLinkLine className="size-4" />GitHub Release</Button></a> : null}</div></Modal>
  </div>;
}
