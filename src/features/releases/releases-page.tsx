import type { StateChange } from "../../types";
import { Bell as BellIcon, Star as StarIcon } from "@phosphor-icons/react";
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon, SearchIcon, SettingsIcon, SparklesIcon } from "../../lib/animated-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { BeamCard } from "../../components/spectrumui/beam-card";
import { BeamSearch } from "../../components/spectrumui/beam-search";
import { MorphButton } from "../../components/spectrumui/morph-button";
import { SkeletonReveal } from "../../components/spectrumui/skeleton-reveal";
import { FilterBar, FilterBarControls, FilterBarDesktop, FilterBarMobile, FilterBarSearch, FilterBarSeparator } from "../../components/patterns/filter-bar";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderTitle } from "../../components/patterns/page-header";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { Field } from "../../components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "../../components/ui/pagination";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Tooltip } from "../../components/ui/tooltip";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
import { notify } from "../../components/ui/toast";
import { fetchReleaseDetail, fetchReleaseFeed, summarizeRelease } from "../../lib/api";
import {
  detectDeviceProfile,
  detectDeviceProfileFallback,
  deviceProfileLabel,
  effectiveAssetRules,
  inferDeliveryLabel,
  rankReleaseAssets,
  releaseAssetAvailability,
  selectRecommendedAsset,
  type DeviceArchitecture,
  type DevicePlatform,
  type DeviceProfile,
  type ReleaseAssetAvailability,
  type ReleaseAssetRecommendation,
} from "../../lib/release-assets";
import { mergeReleaseSnapshot, mergeSuccessfulReleaseFeed } from "../../lib/storage";
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


function releaseExcerpt(body: string) {
  return body
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\`([^\`]+)\`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
function SummaryPanel({ summary }: { summary: AiReleaseSummary }) {
  const { t } = useI18n();
  const sections = [
    [t("重点", "Highlights"), summary.highlights],
    [t("修复", "Fixes"), summary.fixes],
    ["Breaking Changes", summary.breakingChanges],
  ] as const;
  const highlightCount = summary.highlights.length + summary.fixes.length + summary.breakingChanges.length;
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="xs" className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground" />}>
        <SparklesIcon className="size-3.5" aria-hidden="true" />
        <span>{t("AI 总结", "AI summary")} · {t(`${highlightCount} 个重点`, `${highlightCount} highlights`)}</span>
        <ChevronDownIcon className="size-3.5" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="mt-2 rounded-lg bg-secondary/30 px-3 py-2.5">
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
function DownloadAction({ recommendation, release, deliveryLabel, candidateCount, availability, targetDeviceCustomized, onOpen, onUseCurrentDevice, onUseAnyArchitecture, onEditRules }: {
  recommendation: ReleaseAssetRecommendation | null;
  release: ReleaseItem;
  deliveryLabel: string;
  candidateCount: number;
  availability: ReleaseAssetAvailability;
  targetDeviceCustomized: boolean;
  onOpen: () => void;
  onUseCurrentDevice: () => void;
  onUseAnyArchitecture: () => void;
  onEditRules: () => void;
}) {
  const { t } = useI18n();
  if (!recommendation) {
    const emptyTitle = availability === "no-assets"
      ? t("此版本没有附件", "This release has no assets")
      : availability === "rule-filtered"
        ? t("附件被当前规则过滤", "Assets are filtered by current rules")
        : availability === "architecture-mismatch"
          ? t("没有匹配当前架构的附件", "No assets match the selected architecture")
          : t("没有高置信度推荐", "No high-confidence recommendation");
    const emptyDescription = availability === "no-assets"
      ? t("该 Release 仅提供版本说明或源码入口。", "This Release only provides notes or source links.")
      : availability === "rule-filtered"
        ? t("调整 Release 下载规则后可重新识别候选安装包。", "Adjust the Release download rules to identify installer candidates again.")
        : availability === "architecture-mismatch"
          ? t("当前附件与所选架构不匹配；可以恢复当前设备或暂不限定架构。", "Available assets do not match the selected architecture; restore the current device or allow any architecture.")
          : t("存在候选附件，但无法确认它是适合当前设备的安装包。", "Candidate assets exist, but StarBox cannot confidently confirm one for this device.");
    return (
      <div className="min-w-0 md:border-l md:border-border/60 md:pl-6">
        <div className="text-xs font-medium text-muted-foreground">{t("获取方式", "Get")}</div>
        <div className="mt-2 text-sm font-semibold">{emptyTitle}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{emptyDescription}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {availability === "rule-filtered" ? <Button variant="outline" size="sm" onClick={onEditRules}>{t("调整下载规则", "Adjust download rules")}</Button>
            : availability === "architecture-mismatch" ? <Button variant="outline" size="sm" onClick={targetDeviceCustomized ? onUseCurrentDevice : onUseAnyArchitecture}>{targetDeviceCustomized ? t("恢复当前设备", "Use current device") : t("不限定架构", "Any architecture")}</Button>
              : <Button render={<a href={release.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm"><ExternalLinkIcon className="size-4" />{t("查看 Release", "View Release")}</Button>}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">{deliveryLabel}</div>
      </div>
    );
  }
  const architectureLabel = recommendation.architectureKnown ? recommendation.architectureLabel : t("架构未知", "Architecture unknown");
  return (
    <div className="min-w-0 md:border-l md:border-border/60 md:pl-6">
      <div className="text-xs font-medium text-muted-foreground">{recommendation.architectureKnown ? t("适合当前设备", "Recommended for this device") : t("平台匹配，架构未确认", "Platform match; architecture unverified")}</div>
      <div className="mt-2 line-clamp-2 break-all text-sm font-semibold leading-5" title={recommendation.asset.name}>{recommendation.asset.name}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{recommendation.platformLabel} · {architectureLabel} · {recommendation.typeLabel} · {formatSize(recommendation.asset.size)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button render={<a href={recommendation.asset.browserDownloadUrl} target="_blank" rel="noreferrer" />} size="sm">
          <DownloadIcon className="size-4" />{t("下载", "Download")}
        </Button>
        {candidateCount > 1 ? <Button variant="ghost" size="sm" onClick={onOpen}>{t(`其他下载 · ${candidateCount - 1}`, `Other downloads · ${candidateCount - 1}`)}<ChevronRightIcon className="size-3.5" /></Button> : null}
      </div>
    </div>
  );
}

function ReleaseCard({ release, repository, recommendation, candidateCount, availability, targetDeviceCustomized, aiEnabled, aiSummary, aiLoading, aiError, onOpen, onSummarize, onUseCurrentDevice, onUseAnyArchitecture, onEditRules }: {
  release: ReleaseItem;
  repository?: Repository;
  recommendation: ReleaseAssetRecommendation | null;
  candidateCount: number;
  availability: ReleaseAssetAvailability;
  targetDeviceCustomized: boolean;
  aiEnabled: boolean;
  aiSummary?: AiReleaseSummary;
  aiLoading: boolean;
  aiError?: string;
  onOpen: () => void;
  onSummarize: () => void;
  onUseCurrentDevice: () => void;
  onUseAnyArchitecture: () => void;
  onEditRules: () => void;
}) {
  const { t, locale } = useI18n();
  const deliveryLabel = inferDeliveryLabel(repository, recommendation);
  const excerpt = releaseExcerpt(release.body);
  return (
    <BeamCard active={aiLoading} size="pulse-inner" colorVariant="colorful" strength={0.85} theme="auto" className="min-w-0">
    <Card render={<article />} data-ai-summary-loading={aiLoading ? "true" : undefined} className="h-full rounded-2xl p-4 shadow-card sm:px-5 sm:py-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] md:items-stretch md:gap-6">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/80"><ClockIcon className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="link" size="xs" className="h-auto min-h-0 max-w-full justify-start truncate px-0 py-0 text-left text-[15px] font-semibold tracking-tight" onClick={onOpen}>{repository?.name || release.repoFullName.split("/").at(-1) || release.repoFullName}</Button>
                <Badge variant="outline" size="sm" className="font-medium">{release.tagName}</Badge>
                {release.prerelease ? <Badge variant="warning" size="sm">{t("测试版", "Prerelease")}</Badge> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{release.repoFullName}</span>
                <span>·</span>
                <span>{new Date(release.publishedAt || release.createdAt).toLocaleString(locale)}</span>
                <span>·</span>
                <span>{deliveryLabel}</span>
              </div>
              <p className="mt-2.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{excerpt || t("暂无版本说明", "No release notes")}</p>
              {aiSummary ? <SummaryPanel summary={aiSummary} /> : null}
              {aiError ? <div className="mt-2.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{aiError}</div> : null}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Button variant="link" size="xs" className="h-7 min-h-0 px-1 text-xs" onClick={onOpen}>{t("查看详情", "View details")}</Button>
                <Tooltip content={aiEnabled ? (aiSummary ? t("重新生成 AI 总结", "Regenerate AI summary") : t("生成 AI 总结", "Generate AI summary")) : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first")}>
                  <span><Button variant="ghost" size="xs" loading={aiLoading} disabled={!aiEnabled} onClick={onSummarize}><SparklesIcon className="size-3.5" />{aiSummary ? t("重新总结", "Regenerate") : t("AI 总结", "AI summary")}</Button></span>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
        <DownloadAction recommendation={recommendation} release={release} deliveryLabel={deliveryLabel} candidateCount={candidateCount} availability={availability} targetDeviceCustomized={targetDeviceCustomized} onOpen={onOpen} onUseCurrentDevice={onUseCurrentDevice} onUseAnyArchitecture={onUseAnyArchitecture} onEditRules={onEditRules} />
      </div>
    </Card>
    </BeamCard>
  );
}

export function ReleasesPage({ state, onStateChange, goToSettings, goToStars, initialLoading = false, bootstrapPending = false }: {
  state: PersistedState;
  onStateChange: StateChange;
  goToSettings: (tab?: string) => void;
  goToStars: () => void;
  initialLoading?: boolean;
  bootstrapPending?: boolean;
}) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [syncButtonState, setSyncButtonState] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ReleaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [repositoryFilter, setRepositoryFilter] = useState(() => readQueryParam("repo"));
  const [page, setPage] = useState(() => readQueryNumber("page", 1));
  const dailyReleaseSyncAttempted = useRef(false);
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState("");
  const detailRequest = useRef(0);
  const detailAbort = useRef<AbortController | null>(null);
  const detailCache = useRef(new Map<string, ReleaseItem>());
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const targetDeviceOverridden = useRef(false);
  const initialDeviceProfile = useMemo<DeviceProfile>(() => detectDeviceProfileFallback(), []);
  const [detectedDeviceProfile, setDetectedDeviceProfile] = useState<DeviceProfile>(initialDeviceProfile);
  const [targetDeviceProfile, setTargetDeviceProfile] = useState<DeviceProfile>(initialDeviceProfile);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const settings = state.releaseSettings;
  const aiEnabled = Boolean(state.settings.ai.baseUrl && (state.settings.ai.apiKey || state.settings.ai.credentialConfigured) && state.settings.ai.model);
  const repositoriesByName = useMemo(() => new Map(state.repositories.map((repository) => [repository.full_name, repository] as const)), [state.repositories]);
  const rules = useMemo(() => targetDeviceProfile.platform === "unknown" ? null : effectiveAssetRules(settings, targetDeviceProfile.platform), [settings.assetRules, targetDeviceProfile.platform]);
  const targetDeviceCustomized = targetDeviceProfile.platform !== detectedDeviceProfile.platform || targetDeviceProfile.architecture !== detectedDeviceProfile.architecture;
  const platformOptions = [
    { value: "macos", label: "macOS" },
    { value: "windows", label: "Windows" },
    { value: "linux", label: "Linux" },
    { value: "unknown", label: t("不限定平台", "Any platform") },
  ];
  const architectureOptions = [
    { value: "arm64", label: "ARM64" },
    { value: "x64", label: "x64" },
    { value: "x86", label: "x86" },
    { value: "unknown", label: t("不限定架构", "Any architecture") },
  ];

  useEffect(() => {
    let active = true;
    void detectDeviceProfile().then((profile) => {
      if (!active) return;
      setDetectedDeviceProfile(profile);
      if (!targetDeviceOverridden.current) setTargetDeviceProfile(profile);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { detailAbort.current?.abort(); detailRequest.current += 1; }, []);
  useEffect(() => { replaceQueryParams({ q: query, repo: repositoryFilter, page: page === 1 ? "" : page }); }, [query, repositoryFilter, page]);
  function releaseSummaryFor(release: ReleaseItem) {
    const persisted = state.releaseAiSummaries?.[release.repoFullName];
    return persisted?.releaseId === release.id ? persisted.summary : undefined;
  }

  const sync = useCallback(async ({ notifySuccess = true }: { notifySuccess?: boolean } = {}) => {
    if (!hasGithubCredential) { setError(t("请先在设置中连接 GitHub 凭据", "Connect GitHub credentials in Settings first")); return; }
    if (!state.releaseSubscriptions.length) { setSuccess(t("还没有从 Star 订阅 Release 的仓库", "No repositories are subscribed for Releases yet")); return; }
    const checkedAt = new Date().toISOString();
    onStateChange((current) => ({ ...current, lastReleaseSyncAt: checkedAt }));
    if (notifySuccess) setSyncButtonState("idle");
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
      else { setSuccess(""); if (notifySuccess) { setSyncButtonState("success"); notify(t("Release 同步完成", "Release sync complete"), t(`新增/更新 ${result.releases.length} 条`, `${result.releases.length} added/updated`), "success"); } }
    } catch (reason) {
      if (notifySuccess) setSyncButtonState("error");
      setError(reason instanceof Error ? reason.message : t("Release 同步失败", "Release sync failed"));
    } finally { setLoading(false); }
  }, [hasGithubCredential, token, state.releaseSubscriptions, state.releases, settings.syncPages]);

  useEffect(() => {
    if (dailyReleaseSyncAttempted.current || bootstrapPending || !hasGithubCredential || !state.releaseSubscriptions.length) return;
    dailyReleaseSyncAttempted.current = true;
    const last = state.lastReleaseSyncAt ? new Date(state.lastReleaseSyncAt) : null;
    const now = new Date();
    const checkedToday = Boolean(last && !Number.isNaN(last.getTime()) && last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate());
    if (!checkedToday) void sync({ notifySuccess: false });
  }, [bootstrapPending, hasGithubCredential, state.releaseSubscriptions.length, state.lastReleaseSyncAt, sync]);

  async function openDetail(release: ReleaseItem) {
    const key = releaseCardKey(release);
    const local = state.releases.find((item) => releaseCardKey(item) === key) ?? release;
    const cachedDetail = detailCache.current.get(key);
    const initial = cachedDetail ? mergeReleaseSnapshot(local, cachedDetail) : local;
    setDetail(initial);
    setDetailError("");
    if (cachedDetail) return;
    if (!hasGithubCredential) { setDetailError(t("未连接 GitHub 凭据，当前显示缓存内容。", "GitHub credentials are not connected; showing cached content.")); return; }
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    const request = ++detailRequest.current;
    setDetailLoading(true);
    try {
      const next = await fetchReleaseDetail(token, release.repoFullName, release.id, controller.signal);
      if (request === detailRequest.current) {
        detailCache.current.set(key, next);
        const merged = mergeReleaseSnapshot(local, next);
        setDetail(merged);
      }
    } catch (reason) {
      if (request === detailRequest.current && !(reason instanceof DOMException && reason.name === "AbortError")) setDetailError(reason instanceof Error ? t(`${reason.message}。当前继续显示缓存内容。`, `${reason.message}. Continuing with cached content.`) : t("Release 详情加载失败。当前继续显示缓存内容。", "Failed to load Release details. Continuing with cached content."));
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
      if (detailAbort.current === controller) detailAbort.current = null;
    }
  }

  async function runSummary(release: ReleaseItem) {
    if (!aiEnabled) return;
    const key = releaseCardKey(release);
    setSummaryLoading(key); setSummaryErrors((current) => ({ ...current, [key]: "" }));
    try {
      const summary = await summarizeRelease(state.settings.ai, release);
      const generatedAt = new Date().toISOString();
      onStateChange((current) => ({
        ...current,
        releaseAiSummaries: {
          ...(current.releaseAiSummaries ?? {}),
          [release.repoFullName]: {
            repoFullName: release.repoFullName,
            releaseId: release.id,
            tagName: release.tagName,
            summary,
            modelId: current.settings.ai.model,
            generatedAt,
          },
        },
        releases: current.releases.map((item) => {
          const { aiSummary: _legacyAiSummary, ...next } = item;
          return next;
        }),
      }));
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
    const ranked = rankReleaseAssets(release, settings, targetDeviceProfile);
    const recommendation = selectRecommendedAsset(release, repository, settings, targetDeviceProfile);
    const availability = releaseAssetAvailability(release, settings, targetDeviceProfile);
    return { repository, ranked, recommendation, availability };
  }

  function useCurrentDevice() {
    targetDeviceOverridden.current = false;
    setTargetDeviceProfile(detectedDeviceProfile);
  }

  function useAnyArchitecture() {
    targetDeviceOverridden.current = true;
    setTargetDeviceProfile((current) => ({ ...current, architecture: "unknown" }));
  }

  const pageLoading = (initialLoading || loading) && !state.releases.length;
  const detailVersions = detail
    ? [detail, ...state.releases.filter((release) => release.repoFullName === detail.repoFullName && release.id !== detail.id)]
      .filter((release, index, items) => items.findIndex((candidate) => candidate.id === release.id) === index)
      .sort((a, b) => releaseTime(b) - releaseTime(a))
    : [];
  const detailPresentation = detail ? releasePresentation(detail) : null;
  const detailHiddenCount = detail && detailPresentation ? Math.max(0, detail.assets.length - detailPresentation.ranked.length) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader layout="responsive">
        <div>
          <PageHeaderTitle>Release</PageHeaderTitle>
          <PageHeaderDescription>{t(`跟踪 ${state.releaseSubscriptions.length} 个项目的最新发布，按所选平台和架构推荐安装包。`, `Track the latest releases from ${state.releaseSubscriptions.length} projects and recommend installers for the selected platform and architecture.`)}{state.lastReleaseSyncAt ? ` · ${t("上次同步", "last synced")} ${new Date(state.lastReleaseSyncAt).toLocaleString(locale)}` : ""}</PageHeaderDescription>
        </div>
        <PageHeaderActions className="w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Button variant="outline" size="sm" onClick={() => setDeviceDialogOpen(true)}>{t("设备", "Device")} · {deviceProfileLabel(targetDeviceProfile)}</Button>
          <MorphButton state={loading ? "loading" : syncButtonState} variant="outline" disabled={!state.releaseSubscriptions.length} onClick={() => void sync()} loadingLabel={t("正在检查", "Checking")} successLabel={t("已更新", "Updated")} errorLabel={t("更新失败", "Update failed")}><RefreshCwIcon className="size-4" />{t("检查更新", "Check for updates")}</MorphButton>
        </PageHeaderActions>
      </PageHeader>

      <StatusBanner error={error} success={!error ? success : ""} />

      <ResponsiveDialog
        open={deviceDialogOpen}
        title={t("目标设备", "Target device")}
        description={t("默认使用当前设备；只有在为其他设备查找安装包时才需要覆盖。", "The current device is used by default. Override it only when looking for installers for another device.")}
        onClose={() => setDeviceDialogOpen(false)}
        footer={<><Button variant="ghost" disabled={!targetDeviceCustomized} onClick={useCurrentDevice}>{t("恢复当前设备", "Use current device")}</Button><Button onClick={() => setDeviceDialogOpen(false)}>{t("完成", "Done")}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("平台", "Platform")}><Select value={targetDeviceProfile.platform} onValueChange={(value) => { targetDeviceOverridden.current = true; setTargetDeviceProfile((current) => ({ ...current, platform: value as DevicePlatform })); }} items={platformOptions} /></Field>
          <Field label={t("架构", "Architecture")}><Select value={targetDeviceProfile.architecture} onValueChange={(value) => { targetDeviceOverridden.current = true; setTargetDeviceProfile((current) => ({ ...current, architecture: value as DeviceArchitecture })); }} items={architectureOptions} /></Field>
        </div>
      </ResponsiveDialog>

      <FilterBar>
        <FilterBarMobile>
          <BeamSearch><InputGroup>
            <InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索项目或 Release", "Search projects or Releases")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索项目、版本或更新内容", "Search projects, versions, or release notes")} />
            <InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon>
          </InputGroup></BeamSearch>
          <Select aria-label={t("筛选订阅仓库", "Filter subscribed repositories")} value={repositoryFilter} onValueChange={(value) => { setRepositoryFilter(value); setPage(1); }} items={[{ value: "", label: t("全部订阅项目", "All subscribed projects") }, ...state.releaseSubscriptions.map((name) => ({ value: String(name), label: name }))]} />
        </FilterBarMobile>
        <FilterBarDesktop aria-label={t("Release 筛选栏", "Release filters")}>
          <FilterBarSearch>
            <BeamSearch className="min-w-[220px]"><InputGroup className="min-w-[220px]">
              <InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索项目或 Release", "Search projects or Releases")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("搜索项目、版本或更新内容", "Search projects, versions, or release notes")} />
              <InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon>
            </InputGroup></BeamSearch>
          </FilterBarSearch>
          <FilterBarSeparator />
          <FilterBarControls><Select aria-label={t("筛选订阅仓库", "Filter subscribed repositories")} className="min-w-64" value={repositoryFilter} onValueChange={(value) => { setRepositoryFilter(value); setPage(1); }} items={[{ value: "", label: t("全部订阅项目", "All subscribed projects") }, ...state.releaseSubscriptions.map((name) => ({ value: String(name), label: name }))]} /></FilterBarControls>
        </FilterBarDesktop>
      </FilterBar>

      {!hasGithubCredential ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">{t("需要 GitHub 凭据才能同步 Release。", "GitHub credentials are required to sync Releases.")}</p><Button className="mt-3" variant="outline" onClick={() => goToSettings("account")}><SettingsIcon className="size-4" />{t("打开设置", "Open Settings")}</Button></div>
      ) : !state.releaseSubscriptions.length ? (
        <Empty className="min-h-72"><EmptyContent><EmptyIcon><StarIcon className="size-5" /></EmptyIcon><EmptyTitle>{t("还没有关注 Release", "No Release subscriptions yet")}</EmptyTitle><EmptyDescription>{t("在 Star 中订阅项目后，最新版本和推荐下载会显示在这里。", "Subscribe to projects from Star to see latest versions and recommended downloads here.")}</EmptyDescription><Button className="mt-4" variant="outline" onClick={goToStars}>{t("前往 Star", "Go to Star")}</Button></EmptyContent></Empty>
      ) : (
        <SkeletonReveal loading={pageLoading} skeleton={<div className="grid gap-3">{Array.from({ length: 5 }, (_, index) => <Card key={index} className="rounded-2xl p-4 sm:px-5 sm:py-4"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] md:gap-6"><div className="flex gap-3"><Skeleton className="size-9 rounded-lg" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-2 h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div></div><div className="grid gap-2 md:border-l md:border-border/70 md:pl-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-24" /></div></div></Card>)}</div>}>
        <>
          <div ref={resultsTopRef} />
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t(`最新发布 (${latestReleases.length})`, `Latest releases (${latestReleases.length})`)}</h2><span className="text-xs text-muted-foreground">{t("每个项目仅显示最新版本", "Latest version per project")}</span></div>
          <div className="grid gap-3">
            {visibleReleases.map((release) => {
              const { repository, ranked, recommendation, availability } = releasePresentation(release);
              const key = releaseCardKey(release);
              return <ReleaseCard key={key} release={release} repository={repository} recommendation={recommendation} candidateCount={ranked.length} availability={availability} targetDeviceCustomized={targetDeviceCustomized} aiEnabled={aiEnabled} aiSummary={releaseSummaryFor(release)} aiLoading={summaryLoading === key} aiError={summaryErrors[key]} onOpen={() => void openDetail(release)} onSummarize={() => void runSummary(release)} onUseCurrentDevice={useCurrentDevice} onUseAnyArchitecture={useAnyArchitecture} onEditRules={() => goToSettings("release")} />;
            })}
          </div>
          {!latestReleases.length ? <Empty><EmptyContent><EmptyIcon><BellIcon className="size-5" /></EmptyIcon><EmptyTitle>{t("暂无符合条件的最新版本", "No latest releases match")}</EmptyTitle><EmptyDescription>{t("调整搜索或项目筛选后再试。", "Adjust the search or project filter and try again.")}</EmptyDescription>{query || repositoryFilter ? <Button className="mt-3" size="sm" variant="outline" onClick={() => { setQuery(""); setRepositoryFilter(""); setPage(1); }}>{t("清除筛选", "Clear filters")}</Button> : null}</EmptyContent></Empty> : null}
          {latestReleases.length > pageSize ? <Pagination className="mt-5"><PaginationContent><PaginationItem><PaginationPrevious render={<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(page - 1)} />} /></PaginationItem><PaginationItem><span className="px-2 text-xs text-muted-foreground">{page}/{totalPages}</span></PaginationItem><PaginationItem><PaginationNext render={<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(page + 1)} />} /></PaginationItem></PaginationContent></Pagination> : null}
        </>
        </SkeletonReveal>
      )}

      <ResponsiveDialog
        open={Boolean(detail)}
        title={detail ? detail.repoFullName.split("/").at(-1) || detail.repoFullName : "Release"}
        description={detail ? detail.repoFullName : undefined}
        onClose={() => { detailRequest.current += 1; setDetail(null); setDetailLoading(false); }}
        className="sm:h-[88vh] sm:max-w-7xl"
      >
        {detail ? (
          <Tabs
            orientation="vertical"
            value={String(detail.id)}
            onValueChange={(value) => {
              const release = detailVersions.find((item) => String(item.id) === value);
              if (release && release.id !== detail.id) void openDetail(release);
            }}
            className="!block min-w-0 sm:!flex sm:gap-5"
          >
            <aside className="hidden w-52 shrink-0 sm:block">
              <div className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{t("Release Tag", "Release tags")}</div>
              <TabsList className="max-h-[calc(88vh-12rem)] w-full justify-start overflow-y-auto p-1">
                {detailVersions.map((release) => (
                  <TabsTab key={release.id} value={String(release.id)} className="h-auto min-h-11 w-full min-w-0 justify-start px-2.5 py-2 text-left">
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="max-w-full truncate text-sm font-medium">{release.tagName}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{new Date(release.publishedAt || release.createdAt).toLocaleDateString(locale)}</span>
                    </span>
                  </TabsTab>
                ))}
              </TabsList>
              <Button render={<a href={`https://github.com/${detail.repoFullName}/releases`} target="_blank" rel="noreferrer" />} variant="link" size="xs" className="mt-2 h-auto min-h-0 px-1 py-1 text-xs">{t("全部历史版本", "All versions")}</Button>
            </aside>

            <div className="mb-4 sm:hidden">
              <Select
                aria-label={t("选择 Release Tag", "Select Release tag")}
                value={String(detail.id)}
                onValueChange={(value) => {
                  const release = detailVersions.find((item) => String(item.id) === value);
                  if (release && release.id !== detail.id) void openDetail(release);
                }}
                items={detailVersions.map((release) => ({
                  value: String(release.id),
                  label: `${release.tagName} · ${new Date(release.publishedAt || release.createdAt).toLocaleDateString(locale)}`,
                }))}
              />
            </div>

            <TabsPanel value={String(detail.id)} className="min-w-0">
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-all text-lg font-semibold tracking-tight">{detail.tagName}</h2>
                      {detail.prerelease ? <Badge variant="warning">Pre-release</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(detail.publishedAt || detail.createdAt).toLocaleString(locale)}</p>
                  </div>
                  <Button render={<a href={detail.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon className="size-4" />GitHub Release</Button>
                </div>

                {detailError ? <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{detailError}<Button className="ml-2" size="sm" variant="ghost" onClick={() => void openDetail(detail)}>{t("重试", "Retry")}</Button></div> : null}
                {detailLoading ? <div className="grid gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div> : null}

                {detailPresentation ? (
                  <section className="rounded-xl border border-border/70 p-4">
                    <div className="text-xs font-medium text-muted-foreground">{detailPresentation.recommendation ? t("推荐下载", "Recommended download") : t("获取方式", "Get")}</div>
                    {detailPresentation.recommendation ? (
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><div className="truncate text-sm font-semibold">{detailPresentation.recommendation.asset.name}</div><div className="mt-1 text-xs text-muted-foreground">{detailPresentation.recommendation.platformLabel} · {detailPresentation.recommendation.architectureKnown ? detailPresentation.recommendation.architectureLabel : t("架构未知", "Architecture unknown")} · {detailPresentation.recommendation.typeLabel} · {formatSize(detailPresentation.recommendation.asset.size)}</div>{!detailPresentation.recommendation.architectureKnown ? <div className="mt-1 text-[11px] text-warning-foreground">{t("平台匹配，但附件名未声明架构，兼容性未确认。", "Platform matches, but the asset name does not declare an architecture; compatibility is unverified.")}</div> : null}</div>
                        <Button render={<a href={detailPresentation.recommendation.asset.browserDownloadUrl} target="_blank" rel="noreferrer" />}><DownloadIcon className="size-4" />{t("下载", "Download")}</Button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">{detailPresentation.availability === "no-assets" ? t("此版本没有附件", "This release has no assets") : detailPresentation.availability === "rule-filtered" ? t("附件被当前规则过滤", "Assets are filtered by current rules") : detailPresentation.availability === "architecture-mismatch" ? t("没有匹配当前架构的附件", "No assets match the selected architecture") : inferDeliveryLabel(detailPresentation.repository, null)}</div><p className="mt-1 text-xs text-muted-foreground">{detailPresentation.availability === "no-assets" ? t("该 Release 仅提供版本说明或源码入口。", "This Release only provides notes or source links.") : detailPresentation.availability === "rule-filtered" ? t("调整 Release 下载规则后可重新识别候选安装包。", "Adjust the Release download rules to identify installer candidates again.") : detailPresentation.availability === "architecture-mismatch" ? t("当前附件与所选架构不匹配。", "Available assets do not match the selected architecture.") : t("存在附件，但无法确认适合当前设备的安装包。", "Assets exist, but StarBox cannot confidently recommend one for this device.")}</p></div><div className="flex flex-wrap gap-2">{detailPresentation.availability === "rule-filtered" ? <Button variant="outline" onClick={() => goToSettings("release")}>{t("调整下载规则", "Adjust download rules")}</Button> : detailPresentation.availability === "architecture-mismatch" ? <Button variant="outline" onClick={targetDeviceCustomized ? useCurrentDevice : useAnyArchitecture}>{targetDeviceCustomized ? t("恢复当前设备", "Use current device") : t("不限定架构", "Any architecture")}</Button> : <Button render={<a href={detail.htmlUrl} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon className="size-4" />{t("查看 Release", "View Release")}</Button>}</div></div>
                    )}
                  </section>
                ) : null}

                {detailPresentation && detailPresentation.ranked.length > (detailPresentation.recommendation ? 1 : 0) ? (
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t("其他下载", "Other downloads")}</h3><span className="text-xs text-muted-foreground">{t(`规则或设备筛选隐藏 ${detailHiddenCount} 个文件`, `${detailHiddenCount} files hidden by rules or device filtering`)}</span></div>
                    <div className="grid gap-2">
                      {detailPresentation.ranked.filter(({ asset }) => asset.id !== detailPresentation.recommendation?.asset.id).map(({ asset, platformLabel, architectureLabel, architectureKnown, typeLabel }) => <a key={asset.id} href={asset.browserDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/60"><span className="min-w-0 truncate">{asset.name}</span><span className="shrink-0 text-xs text-muted-foreground">{platformLabel} · {architectureKnown ? architectureLabel : t("架构未知", "Architecture unknown")} · {typeLabel} · {formatSize(asset.size)}</span></a>)}
                    </div>
                  </section>
                ) : null}

                {releaseSummaryFor(detail) ? <SummaryPanel summary={releaseSummaryFor(detail)!} /> : <Tooltip content={aiEnabled ? t("生成当前 Release 的 AI 总结", "Generate an AI summary for this Release") : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first")}><Button variant="outline" disabled={!aiEnabled} loading={summaryLoading === releaseCardKey(detail)} onClick={() => void runSummary(detail)}><SparklesIcon className="size-4" />{t("AI 总结", "AI summary")}</Button></Tooltip>}

                <section>
                  <h3 className="mb-2 text-sm font-semibold">{t("更新内容", "Release notes")}</h3>
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">{detail.body ? <MarkdownContent content={detail.body} /> : <p className="text-sm text-muted-foreground">{t("暂无版本说明", "No release notes")}</p>}</div>
                </section>

                <div className="border-t border-border/70 pt-4">
                  <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground" title={rules?.includePattern}>{t("当前平台规则已应用", "Current platform rules applied")}</span>
                </div>
              </div>
            </TabsPanel>
          </Tabs>
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}
