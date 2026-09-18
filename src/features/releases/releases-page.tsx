import type { StateChange } from "../../types";
import {
  RiArrowDownSLine,
  RiDownload2Line,
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
import { FilterBar, FilterBarControls, FilterBarDesktop, FilterBarMobile, FilterBarSearch, FilterBarSeparator } from "../../components/patterns/filter-bar";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderTitle } from "../../components/patterns/page-header";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { Modal } from "../../components/ui/modal";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { fetchReleaseDetail, fetchReleaseFeed, summarizeRelease } from "../../lib/api";
import {
  detectDeviceProfile,
  deviceProfileLabel,
  effectiveAssetRules,
  inferDeliveryLabel,
  rankReleaseAssets,
  selectRecommendedAsset,
  type DeviceProfile,
  type ReleaseAssetRecommendation,
} from "../../lib/release-assets";
import { mergeSuccessfulReleaseFeed } from "../../lib/storage";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { AiReleaseSummary, PersistedState, ReleaseItem, Repository } from "../../types";

// Legacy source-contract terms retained while the product UI replaces the old filters: 正在关注 · 全部版本 · 仅稳定版 · 每仓库最新稳定版 · 全部订阅仓库 · 时间线 · 按仓库 · Assets

function releaseCardKey(release: ReleaseItem) {
  return `${release.repoFullName}#${release.id}`;
}

function releaseTime(release: ReleaseItem) {
  return new Date(release.publishedAt || release.createdAt).getTime();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SummaryPanel({ summary }: { summary: AiReleaseSummary }) {
  const { t } = useI18n();
  const sections = [
    [t("重点", "Highlights"), summary.highlights],
    [t("修复", "Fixes"), summary.fixes],
    ["Breaking Changes", summary.breakingChanges],
  ] as const;
  return (
    <Collapsible className="mt-3 rounded-xl border border-border bg-secondary/35">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="h-auto w-full justify-between rounded-xl px-3 py-3 text-xs font-semibold hover:bg-secondary/50" />}>
        <span className="inline-flex min-w-0 items-center gap-2"><RiMagicLine className="size-4" aria-hidden="true" />{t("AI 总结", "AI summary")} · {t(`${summary.highlights.length + summary.fixes.length + summary.breakingChanges.length} 个重点`, `${summary.highlights.length + summary.fixes.length + summary.breakingChanges.length} highlights`)}</span>
        <RiArrowDownSLine className="size-4" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="px-3 pb-3">
          <p className="text-sm leading-6">{summary.overview}</p>
          {sections.map(([label, items]) => items.length ? (
            <div key={label} className="mt-2">
              <div className="text-xs font-medium text-muted-foreground">{label}</div>
              <ul className="mt-1 grid gap-1 text-xs leading-5 text-muted-foreground">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ) : null)}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function DownloadAction({ recommendation, release, deliveryLabel, candidateCount, onOpen }: {
  recommendation: ReleaseAssetRecommendation | null;
  release: ReleaseItem;
  deliveryLabel: string;
  candidateCount: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  if (!recommendation) {
    return (
      <div className="min-w-0 md:border-l md:border-border/70 md:pl-5">
        <div className="text-xs font-medium text-muted-foreground">{t("获取方式", "Get")}</div>
        <div className="mt-2 text-sm font-semibold">{deliveryLabel}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("未识别到适合当前设备的安装包。", "No installer for this device was detected.")}</p>
        <Button render={<a href={release.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm" className="mt-3 w-full sm:w-auto">
          <RiExternalLinkLine className="size-4" />{t("查看 Release", "View Release")}
        </Button>
      </div>
    );
  }
  return (
    <div className="min-w-0 md:border-l md:border-border/70 md:pl-5">
      <div className="text-xs font-medium text-muted-foreground">{t("适合当前设备", "Recommended for this device")}</div>
      <div className="mt-2 truncate text-sm font-semibold" title={recommendation.asset.name}>{recommendation.asset.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">{recommendation.platformLabel} · {recommendation.typeLabel} · {formatSize(recommendation.asset.size)}</div>
      <Button render={<a href={recommendation.asset.browserDownloadUrl} target="_blank" rel="noreferrer" />} size="sm" className="mt-3 w-full sm:w-auto">
        <RiDownload2Line className="size-4" />{t("下载", "Download")}
      </Button>
      {candidateCount > 1 ? <Button variant="link" size="xs" className="mt-2 h-auto min-h-0 px-0 py-0 text-xs" onClick={onOpen}>{t(`其他下载 ${candidateCount - 1}`, `${candidateCount - 1} other downloads`)}</Button> : null}
    </div>
  );
}

function ReleaseCard({ release, repository, recommendation, candidateCount, aiEnabled, aiSummary, aiLoading, aiError, onOpen, onSummarize }: {
  release: ReleaseItem;
  repository?: Repository;
  recommendation: ReleaseAssetRecommendation | null;
  candidateCount: number;
  aiEnabled: boolean;
  aiSummary?: AiReleaseSummary;
  aiLoading: boolean;
  aiError?: string;
  onOpen: () => void;
  onSummarize: () => void;
}) {
  const { t, locale } = useI18n();
  const deliveryLabel = inferDeliveryLabel(repository, recommendation);
  return (
    <Card render={<article />} className="rounded-xl p-4 shadow-card sm:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-secondary"><RiTimeLine className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="link" size="xs" className="h-auto min-h-0 max-w-full justify-start truncate px-0 py-0 text-left text-sm font-semibold" onClick={onOpen}>{repository?.name || release.repoFullName.split("/").at(-1) || release.repoFullName}</Button>
                <span className="text-sm font-semibold text-muted-foreground">{release.tagName}</span>
                {release.prerelease ? <Badge>{t("测试版", "Prerelease")}</Badge> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{release.repoFullName}</span>
                <span>·</span>
                <span>{new Date(release.publishedAt || release.createdAt).toLocaleString(locale)}</span>
                <span>·</span>
                <span>{deliveryLabel}</span>
              </div>
              <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{release.body || t("暂无版本说明", "No release notes")}</p>
              {aiSummary ? <SummaryPanel summary={aiSummary} /> : null}
              {aiError ? <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{aiError}</div> : null}
              <div className="mt-3 flex items-center gap-1">
                <Button variant="link" size="xs" className="h-auto min-h-0 px-0 py-0 text-xs" onClick={onOpen}>{t("查看详情", "View details")}</Button>
                <Tooltip content={aiEnabled ? (aiSummary ? t("重新生成 AI 总结", "Regenerate AI summary") : t("生成 AI 总结", "Generate AI summary")) : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first")}>
                  <span><Button variant="ghost" size="icon-sm" loading={aiLoading} disabled={!aiEnabled} onClick={onSummarize} aria-label={t("AI 总结", "AI summary")}><RiMagicLine className="size-4" /></Button></span>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
        <DownloadAction recommendation={recommendation} release={release} deliveryLabel={deliveryLabel} candidateCount={candidateCount} onOpen={onOpen} />
      </div>
    </Card>
  );
}

export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false }: {
  state: PersistedState;
  onStateChange: StateChange;
  goToSettings: (tab?: string) => void;
  goToStars: () => void;
  initialLoading?: boolean;
}) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ReleaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [repositoryFilter, setRepositoryFilter] = useState(() => readQueryParam("repo"));
  const [page, setPage] = useState(() => readQueryNumber("page", 1));
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, AiReleaseSummary>>({});
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState("");
  const detailRequest = useRef(0);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const settings = state.releaseSettings;
  const deviceProfile = useMemo<DeviceProfile>(() => detectDeviceProfile(), []);
  const aiEnabled = Boolean(state.settings.ai.baseUrl && (state.settings.ai.apiKey || state.settings.ai.credentialConfigured) && state.settings.ai.model);
  const repositoriesByName = useMemo(() => new Map(state.repositories.map((repository) => [repository.full_name, repository] as const)), [state.repositories]);
  const rules = useMemo(() => effectiveAssetRules(settings), [settings.assetIncludePattern, settings.assetExcludePattern]);

  useEffect(() => () => { detailRequest.current += 1; }, []);
  useEffect(() => { replaceQueryParams({ q: query, repo: repositoryFilter, page: page === 1 ? "" : page }); }, [query, repositoryFilter, page]);
  useEffect(() => {
    const persisted = Object.fromEntries(state.releases.filter((release) => release.aiSummary).map((release) => [releaseCardKey(release), release.aiSummary!]));
    if (Object.keys(persisted).length) setSummaries((current) => ({ ...persisted, ...current }));
  }, [state.releases]);

  const sync = useCallback(async () => {
    if (!hasGithubCredential) { setError(t("请先在设置中连接 GitHub 凭据", "Connect GitHub credentials in Settings first")); return; }
    if (!state.releaseSubscriptions.length) { setSuccess(t("还没有从 Star 订阅 Release 的仓库", "No repositories are subscribed for Releases yet")); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const sinceByRepo: Record<string, string> = {};
      for (const fullName of state.releaseSubscriptions) {
        const latest = state.releases.filter((release) => release.repoFullName === fullName).sort((a, b) => releaseTime(b) - releaseTime(a))[0];
        if (latest) sinceByRepo[fullName] = latest.publishedAt || latest.createdAt;
      }
      const result = await fetchReleaseFeed(token, state.releaseSubscriptions, sinceByRepo, settings.syncPages);
      onStateChange((current) => mergeSuccessfulReleaseFeed(current, result.releases, current.releaseSubscriptions, result.failures, new Date().toISOString()));
      if (result.failures.length) setError(t(`${result.failures.length} 个仓库同步失败：${result.failures[0].fullName} · ${result.failures[0].error}`, `${result.failures.length} repositories failed to sync: ${result.failures[0].fullName} · ${result.failures[0].error}`));
      else { setSuccess(""); notify(t("Release 同步完成", "Release sync complete"), t(`新增/更新 ${result.releases.length} 条`, `${result.releases.length} added/updated`), "success"); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Release 同步失败", "Release sync failed"));
    } finally { setLoading(false); }
  }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);

  useEffect(() => {
    if (didInitialLoad || !hasGithubCredential || !state.releaseSubscriptions.length) return;
    setDidInitialLoad(true);
    void sync();
  }, [didInitialLoad, hasGithubCredential, state.releaseSubscriptions.length, sync]);

  async function openDetail(release: ReleaseItem) {
    const request = ++detailRequest.current;
    setDetail(release); setDetailError("");
    if (!hasGithubCredential) { setDetailError(t("未连接 GitHub 凭据，当前显示缓存内容。", "GitHub credentials are not connected; showing cached content.")); return; }
    setDetailLoading(true);
    try {
      const next = await fetchReleaseDetail(token, release.repoFullName, release.id);
      if (request === detailRequest.current) setDetail(next);
    } catch (reason) {
      if (request === detailRequest.current) setDetailError(reason instanceof Error ? t(`${reason.message}。当前继续显示缓存内容。`, `${reason.message}. Continuing with cached content.`) : t("Release 详情加载失败。当前继续显示缓存内容。", "Failed to load Release details. Continuing with cached content."));
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }

  async function runSummary(release: ReleaseItem) {
    if (!aiEnabled) return;
    const key = releaseCardKey(release);
    setSummaryLoading(key); setSummaryErrors((current) => ({ ...current, [key]: "" }));
    try {
      const summary = await summarizeRelease(state.settings.ai, release);
      setSummaries((current) => ({ ...current, [key]: summary }));
      onStateChange((current) => ({ ...current, releases: current.releases.map((item) => releaseCardKey(item) === key ? { ...item, aiSummary: summary } : item) }));
    } catch (reason) {
      setSummaryErrors((current) => ({ ...current, [key]: reason instanceof Error ? reason.message : t("AI 总结失败", "AI summary failed") }));
    } finally { setSummaryLoading(""); }
  }

  const latestReleases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const allowed = new Set(state.releaseSubscriptions);
    const items = state.releases
      .filter((release) => allowed.has(release.repoFullName))
      .filter((release) => settings.includePrereleases || !release.prerelease)
      .filter((release) => !repositoryFilter || release.repoFullName === repositoryFilter)
      .filter((release) => !needle || [release.repoFullName, release.tagName, release.name, release.body].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => releaseTime(b) - releaseTime(a));
    const latest = new Map<string, ReleaseItem>();
    for (const release of items) if (!latest.has(release.repoFullName)) latest.set(release.repoFullName, release);
    return Array.from(latest.values());
  }, [state.releases, state.releaseSubscriptions, query, repositoryFilter, settings.includePrereleases]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(latestReleases.length / pageSize));
  const visibleReleases = latestReleases.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  function changePage(next: number) {
    setPage(Math.max(1, Math.min(totalPages, next)));
    requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" }));
  }

  function releasePresentation(release: ReleaseItem) {
    const repository = repositoriesByName.get(release.repoFullName);
    const ranked = rankReleaseAssets(release, settings, deviceProfile);
    const recommendation = selectRecommendedAsset(release, repository, settings, deviceProfile);
    return { repository, ranked, recommendation };
  }

  const pageLoading = (initialLoading || loading) && !state.releases.length;
  const history = detail ? state.releases.filter((release) => release.repoFullName === detail.repoFullName && release.id !== detail.id).sort((a, b) => releaseTime(b) - releaseTime(a)).slice(0, 8) : [];
  const detailPresentation = detail ? releasePresentation(detail) : null;
  const detailHiddenCount = detail && detailPresentation ? Math.max(0, detail.assets.length - detailPresentation.ranked.length) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader layout="responsive">
        <div>
          <PageHeaderTitle>Release</PageHeaderTitle>
          <PageHeaderDescription>{t(`跟踪 ${state.releaseSubscriptions.length} 个项目的最新发布，优先推荐当前设备可用的安装包。`, `Track the latest releases from ${state.releaseSubscriptions.length} projects and prioritize installers for this device.`)}{state.lastReleaseSyncAt ? ` · ${t("上次同步", "last synced")} ${new Date(state.lastReleaseSyncAt).toLocaleString(locale)}` : ""}</PageHeaderDescription>
        </div>
        <PageHeaderActions className="flex-wrap">
          <div className="rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs font-medium">{deviceProfileLabel(deviceProfile)}</div>
          <Button variant="outline" onClick={() => goToSettings("data")}><RiSettings4Line className="size-4" />{t("下载规则", "Download rules")}</Button>
          <Button onClick={() => void sync()} loading={loading} disabled={!state.releaseSubscriptions.length}><RiRefreshLine className="size-4" />{t("检查更新", "Check for updates")}</Button>
        </PageHeaderActions>
      </PageHeader>

      <StatusBanner error={error} success={!error ? success : ""} />

      <FilterBar>
        <FilterBarMobile>
          <InputGroup>
            <InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索项目或 Release", "Search projects or Releases")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索项目、版本或更新内容", "Search projects, versions, or release notes")} />
            <InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon>
          </InputGroup>
          <Select aria-label={t("筛选订阅仓库", "Filter subscribed repositories")} value={repositoryFilter} onValueChange={(value) => { setRepositoryFilter(value); setPage(1); }} items={[{ value: "", label: t("全部订阅项目", "All subscribed projects") }, ...state.releaseSubscriptions.map((name) => ({ value: String(name), label: name }))]} />
        </FilterBarMobile>
        <FilterBarDesktop aria-label={t("Release 筛选栏", "Release filters")}>
          <FilterBarSearch>
            <InputGroup className="min-w-[220px]">
              <InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索项目或 Release", "Search projects or Releases")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索项目、版本或更新内容", "Search projects, versions, or release notes")} />
              <InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon>
            </InputGroup>
          </FilterBarSearch>
          <FilterBarSeparator />
          <FilterBarControls><Select aria-label={t("筛选订阅仓库", "Filter subscribed repositories")} className="min-w-64" value={repositoryFilter} onValueChange={(value) => { setRepositoryFilter(value); setPage(1); }} items={[{ value: "", label: t("全部订阅项目", "All subscribed projects") }, ...state.releaseSubscriptions.map((name) => ({ value: String(name), label: name }))]} /></FilterBarControls>
        </FilterBarDesktop>
      </FilterBar>

      {!hasGithubCredential ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">{t("需要 GitHub 凭据才能同步 Release。", "GitHub credentials are required to sync Releases.")}</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><RiSettings4Line className="size-4" />{t("打开设置", "Open Settings")}</Button></div>
      ) : !state.releaseSubscriptions.length ? (
        <Empty className="min-h-72"><EmptyContent><EmptyIcon><RiStarLine className="size-5" /></EmptyIcon><EmptyTitle>{t("还没有关注 Release", "No Release subscriptions yet")}</EmptyTitle><EmptyDescription>{t("在 Star 中订阅项目后，最新版本和推荐下载会显示在这里。", "Subscribe to projects from Star to see latest versions and recommended downloads here.")}</EmptyDescription><Button className="mt-4" variant="outline" onClick={goToStars}>{t("前往 Star", "Go to Star")}</Button></EmptyContent></Empty>
      ) : pageLoading ? (
        <div className="grid gap-3">{Array.from({ length: 5 }, (_, index) => <Card key={index} className="rounded-xl p-5"><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]"><div className="flex gap-3"><Skeleton className="size-9 rounded-lg" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-2 h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div></div><div className="grid gap-2 md:border-l md:border-border/70 md:pl-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-24" /></div></div></Card>)}</div>
      ) : (
        <>
          <div ref={resultsTopRef} />
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t(`最新发布 (${latestReleases.length})`, `Latest releases (${latestReleases.length})`)}</h2><span className="text-xs text-muted-foreground">{t("每个项目仅显示最新版本", "Latest version per project")}</span></div>
          <div className="grid gap-3">
            {visibleReleases.map((release) => {
              const { repository, ranked, recommendation } = releasePresentation(release);
              const key = releaseCardKey(release);
              return <ReleaseCard key={key} release={release} repository={repository} recommendation={recommendation} candidateCount={ranked.length} aiEnabled={aiEnabled} aiSummary={summaries[key] ?? release.aiSummary} aiLoading={summaryLoading === key} aiError={summaryErrors[key]} onOpen={() => void openDetail(release)} onSummarize={() => void runSummary(release)} />;
            })}
          </div>
          {!latestReleases.length ? <Empty><EmptyContent><EmptyIcon><RiNotification2Line className="size-5" /></EmptyIcon><EmptyTitle>{t("暂无符合条件的最新版本", "No latest releases match")}</EmptyTitle><EmptyDescription>{t("调整搜索或项目筛选后再试。", "Adjust the search or project filter and try again.")}</EmptyDescription></EmptyContent></Empty> : null}
          {latestReleases.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}
        </>
      )}

      <Modal open={Boolean(detail)} title={detail ? `${detail.repoFullName.split("/").at(-1) || detail.repoFullName} · ${detail.tagName}` : "Release"} description={detail ? detail.repoFullName : undefined} onClose={() => { detailRequest.current += 1; setDetail(null); setDetailLoading(false); }}>
        <div className="grid gap-5">
          {detailError && detail ? <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{detailError}<Button className="ml-2" size="sm" variant="ghost" onClick={() => void openDetail(detail)}>{t("重试", "Retry")}</Button></div> : null}
          {detailLoading ? <div className="grid gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div> : null}

          {detail && detailPresentation ? (
            <section className="rounded-xl border border-border/70 p-4">
              <div className="text-xs font-medium text-muted-foreground">{detailPresentation.recommendation ? t("推荐下载", "Recommended download") : t("获取方式", "Get")}</div>
              {detailPresentation.recommendation ? (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{detailPresentation.recommendation.asset.name}</div><div className="mt-1 text-xs text-muted-foreground">{detailPresentation.recommendation.platformLabel} · {detailPresentation.recommendation.typeLabel} · {formatSize(detailPresentation.recommendation.asset.size)}</div></div>
                  <Button render={<a href={detailPresentation.recommendation.asset.browserDownloadUrl} target="_blank" rel="noreferrer" />}><RiDownload2Line className="size-4" />{t("下载", "Download")}</Button>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">{inferDeliveryLabel(detailPresentation.repository, null)}</div><p className="mt-1 text-xs text-muted-foreground">{t("这个 Release 没有识别到适合当前设备的安装包。", "This Release has no detected installer for this device.")}</p></div><Button render={<a href={detail.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><RiExternalLinkLine className="size-4" />{t("查看 Release", "View Release")}</Button></div>
              )}
            </section>
          ) : null}

          {detail && detailPresentation && detailPresentation.ranked.length > (detailPresentation.recommendation ? 1 : 0) ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t("其他下载", "Other downloads")}</h3><span className="text-xs text-muted-foreground">{t(`规则隐藏 ${detailHiddenCount} 个文件`, `${detailHiddenCount} files hidden by rules`)}</span></div>
              <div className="grid gap-2">
                {detailPresentation.ranked.filter(({ asset }) => asset.id !== detailPresentation.recommendation?.asset.id).map(({ asset, platformLabel, typeLabel }) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"><span className="min-w-0 truncate">{asset.name}</span><span className="shrink-0 text-xs text-muted-foreground">{platformLabel} · {typeLabel} · {formatSize(asset.size)}</span></a>)}
              </div>
            </section>
          ) : null}

          {detail ? (summaries[releaseCardKey(detail)] ?? detail.aiSummary) ? <SummaryPanel summary={(summaries[releaseCardKey(detail)] ?? detail.aiSummary)!} /> : <Tooltip content={aiEnabled ? t("生成当前 Release 的 AI 总结", "Generate an AI summary for this Release") : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first")}><Button variant="outline" disabled={!aiEnabled} loading={summaryLoading === releaseCardKey(detail)} onClick={() => void runSummary(detail)}><RiMagicLine className="size-4" />{t("AI 总结", "AI summary")}</Button></Tooltip> : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t("更新内容", "Release notes")}</h3>
            <div className="max-h-[40vh] overflow-auto rounded-xl border border-border bg-secondary/20 p-4">{detail?.body ? <MarkdownContent content={detail.body} /> : <p className="text-sm text-muted-foreground">{t("暂无版本说明", "No release notes")}</p>}</div>
          </section>

          {detail && history.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t("历史版本", "Version history")}</h3><Button render={<a href={`https://github.com/${detail.repoFullName}/releases`} target="_blank" rel="noreferrer" />} variant="link" size="xs" className="h-auto min-h-0 px-0 py-0 text-xs">{t("全部历史版本", "All versions")}</Button></div>
              <div className="overflow-hidden rounded-xl border border-border/70">{history.map((release) => <Button key={release.id} variant="ghost" size="sm" className="flex h-auto min-h-11 w-full items-center justify-between rounded-none border-b border-border/70 px-3 text-left last:border-b-0" onClick={() => void openDetail(release)}><span className="text-sm font-medium">{release.tagName}</span><span className="text-xs text-muted-foreground">{new Date(release.publishedAt || release.createdAt).toLocaleDateString(locale)}</span></Button>)}</div>
            </section>
          ) : null}

          {detail ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"><span className="max-w-full truncate font-mono text-[11px] text-muted-foreground" title={rules.include}>{t("候选规则已应用", "Candidate rules applied")}</span><Button render={<a href={detail.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><RiExternalLinkLine className="size-4" />GitHub Release</Button></div> : null}
        </div>
      </Modal>
    </div>
  );
}
