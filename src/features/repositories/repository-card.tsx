import { Bell as BellIcon, BellSlash as BellOffIcon, PencilSimple as PencilIcon, Star as StarIcon } from "@phosphor-icons/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BeamCard } from "../../components/spectrumui/beam-card";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { Archive as ArchiveIcon, ArrowSquareOut as ExternalLinkIcon, Sparkle as SparklesIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/cn";
import { githubLanguageColor } from "../../lib/github-language-colors";
import { mergeRepositoryPlatforms } from "../../lib/release-platform-core";
import { useI18n } from "../../lib/i18n";
import type { Repository, RepositoryMeta } from "../../types";

function compactNumber(value: number, locale: string) { return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function relativeDate(value: string, language: "zh-CN" | "en") { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)); if (language === "en") { if (days < 1) return "Updated today"; if (days < 30) return `Updated ${days}d ago`; if (days < 365) return `Updated ${Math.floor(days / 30)}mo ago`; return `Updated ${Math.floor(days / 365)}y ago`; } if (days < 1) return "今天更新"; if (days < 30) return `${days} 天前更新`; if (days < 365) return `${Math.floor(days / 30)} 个月前更新`; return `${Math.floor(days / 365)} 年前更新`; }
const platformLabels: Record<string, string> = { mac: "macOS", macos: "macOS", windows: "Windows", linux: "Linux", docker: "Docker" };
function repositoryPlatforms(values: string[], topics: string[]) {
  return mergeRepositoryPlatforms(values, topics).map((value) => platformLabels[value]).filter((value): value is string => Boolean(value));
}

function TopicRow({ topics, activeTopics, selectionMode, onFilterTopic, label }: {
  topics: string[];
  activeTopics: string[];
  selectionMode: boolean;
  onFilterTopic: (topic: string) => void;
  label: string;
}) {
  const orderedTopics = useMemo(() => [...topics.filter((tag) => activeTopics.includes(tag)), ...topics.filter((tag) => !activeTopics.includes(tag))], [topics, activeTopics]);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(orderedTopics.length);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const measurement = measurementRef.current;
    if (!container || !measurement) return;
    const widths = Array.from(measurement.querySelectorAll<HTMLElement>("[data-topic-measure]")).map((item) => item.getBoundingClientRect().width);
    const more = measurement.querySelector<HTMLElement>("[data-topic-more-measure]");
    const available = container.clientWidth;
    const gap = 4;
    let nextCount = orderedTopics.length;
    for (let count = orderedTopics.length; count >= 0; count -= 1) {
      const hidden = orderedTopics.length - count;
      let total = widths.slice(0, count).reduce((sum, width) => sum + width, 0) + Math.max(0, count - 1) * gap;
      if (hidden && more) {
        more.textContent = `+${hidden}`;
        total += (count ? gap : 0) + more.getBoundingClientRect().width;
      }
      if (total <= available + 0.5) { nextCount = count; break; }
    }
    setVisibleCount((current) => current === nextCount ? current : nextCount);
  }, [orderedTopics]);

  useLayoutEffect(() => {
    recalculate();
    const target = containerRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(recalculate);
    observer.observe(target);
    return () => observer.disconnect();
  }, [recalculate]);

  const visibleTopics = orderedTopics.slice(0, visibleCount);
  const hiddenTopics = orderedTopics.slice(visibleCount);
  return <div className="relative mt-2 h-5 min-w-0">
    <div ref={containerRef} className="flex h-5 min-w-0 items-center gap-1 overflow-hidden" aria-label={label}>
      {visibleTopics.map((tag) => <Button key={tag} variant="ghost" size="bare" disabled={selectionMode} aria-pressed={activeTopics.includes(tag)} title={tag} onClick={() => onFilterTopic(tag)} className="h-5 min-h-0 max-w-[10rem] shrink-0 p-0 hover:bg-transparent active:bg-transparent"><Badge size="sm" className="max-w-full cursor-pointer truncate rounded-md px-1.5 font-medium hover:bg-secondary/80 aria-pressed:ring-1 aria-pressed:ring-foreground/20">{tag}</Badge></Button>)}
      {hiddenTopics.length ? <Badge variant="secondary" size="sm" className="shrink-0 rounded-md px-1.5 font-medium" title={hiddenTopics.join(", ")}>+{hiddenTopics.length}</Badge> : null}
    </div>
    <div ref={measurementRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex h-5 items-center gap-1 whitespace-nowrap">
      {orderedTopics.map((tag) => <Badge key={tag} data-topic-measure size="sm" className="max-w-[10rem] truncate rounded-md px-1.5 font-medium">{tag}</Badge>)}
      <Badge data-topic-more-measure variant="secondary" size="sm" className="shrink-0 rounded-md px-1.5 font-medium">+{orderedTopics.length}</Badge>
    </div>
  </div>;
}

export function RepositoryCard({ repository, meta, aiEnabled, aiLoading, selected, selectionMode = false, releaseSubscribed, mutating, activeCategory, activeLanguage, activeTopics, activePlatforms, onSelectedChange, onEdit, onDetails, onOrganize, onToggleRelease, onUnstar, onFilterCategory, onFilterLanguage, onFilterTopic, onFilterPlatform }: {
  repository: Repository; meta: RepositoryMeta; aiEnabled: boolean; aiLoading: boolean; selected: boolean; selectionMode?: boolean; releaseSubscribed: boolean; mutating: boolean;
  activeCategory: string; activeLanguage: string; activeTopics: string[]; activePlatforms: string[];
  onSelectedChange: (selected: boolean) => void; onEdit: () => void; onDetails: () => void; onOrganize: () => void; onToggleRelease: () => void; onUnstar: () => void;
  onFilterCategory: (category: string) => void; onFilterLanguage: (language: string) => void; onFilterTopic: (topic: string) => void; onFilterPlatform: (platform: string) => void;
}) {
  const { t, locale, language } = useI18n();
  const topics = Array.from(new Set(repository.topics));
  const platforms = repositoryPlatforms(meta.aiPlatforms, repository.topics);
  const aiAnalyzed = Boolean(meta.aiSummary.trim());
  const actionClass = "text-muted-foreground hover:text-foreground/85";
  const avatarClass = "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-muted-foreground ring-1 ring-border/60";
  const aiActionLabel = aiLoading
    ? t("AI 正在分析", "AI is analyzing")
    : aiAnalyzed
      ? t("AI 已分析，点击重新分析", "AI analyzed; click to reanalyze")
      : aiEnabled
        ? t("AI 分析", "AI analysis")
        : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first");
  return <BeamCard active={aiLoading} size="pulse-inner" colorVariant="colorful" strength={0.85} theme="auto" data-repository-full-name={repository.full_name} className="h-full min-w-0">
    <Card render={<article />} data-ai-loading={aiLoading ? "true" : undefined} data-selected={selected ? "true" : undefined} className={cn("group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card hover:border-foreground/20 hover:shadow-card-hover focus-within:border-foreground/25 [content-visibility:auto] [contain-intrinsic-size:auto_260px]", selectionMode && "cursor-pointer", selected && "border-foreground/35 ring-1 ring-foreground/10")}>
    {selectionMode ? <div className="absolute inset-0 z-[5] rounded-2xl"><Button variant="ghost" type="button" className="rounded-2xl border-0 p-0 shadow-none before:hidden hover:bg-transparent active:scale-100 active:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" style={{ width: "100%", height: "100%" }} aria-label={t(`${selected ? "取消选择" : "选择"} ${repository.full_name}`, `${selected ? "Deselect" : "Select"} ${repository.full_name}`)} aria-pressed={selected} onClick={() => onSelectedChange(!selected)} /></div> : null}
    <div className="absolute right-4 top-4 z-10"><Checkbox className="size-5 opacity-40 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[checked]:opacity-100 after:absolute after:-inset-3 after:content-['']" checked={selected} onCheckedChange={onSelectedChange} aria-label={t(`选择 ${repository.full_name}`, `Select ${repository.full_name}`)} /></div>
    <header className="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 px-4 py-3.5 pr-14">
      <Avatar className={avatarClass} aria-hidden="true"><AvatarFallback className="bg-secondary text-xs font-semibold text-muted-foreground">{repository.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repository.owner.avatar_url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" /></Avatar>
      <div className="min-w-0 flex-1"><Button variant="link" size="xs" onClick={onDetails} disabled={selectionMode} title={repository.full_name} className="flex h-5 w-full min-w-0 justify-start truncate rounded-sm px-0 py-0 text-left text-sm font-semibold tracking-tight hover:text-foreground">{repository.full_name}</Button><div className="mt-0.5 flex h-4 min-w-0 items-center gap-1.5 overflow-hidden">{meta.category ? <Button variant="link" size="xs" disabled={selectionMode} aria-pressed={activeCategory === meta.category} title={t(`按分类筛选：${meta.category}`, `Filter by category: ${meta.category}`)} onClick={() => onFilterCategory(meta.category)} className="h-auto min-h-0 min-w-0 max-w-[min(12rem,55%)] justify-start truncate rounded-sm px-0 py-0 font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline aria-pressed:text-foreground"><span className="block truncate text-[10px] leading-[14px]">{meta.category}</span></Button> : null}{repository.archived ? <Badge variant="outline" size="sm" className="shrink-0 gap-1 rounded-md px-1.5"><ArchiveIcon className="size-3" aria-hidden="true" />{t("已归档", "Archived")}</Badge> : null}</div></div>
    </header>
    <div className="min-w-0 flex-1 px-4 pb-4 pt-3.5">
      <p title={meta.aiSummary || repository.description || undefined} className={cn("h-10 line-clamp-2 break-words text-sm leading-5 [overflow-wrap:anywhere]", meta.aiSummary || repository.description ? "text-muted-foreground" : "italic text-muted-foreground/70")}>{aiAnalyzed ? <Tooltip content={t("AI 已分析", "AI analyzed")}><span className="mr-1 inline-flex align-[-0.15em] text-success-foreground" aria-label={t("AI 已分析", "AI analyzed")}><SparklesIcon className="size-3.5" aria-hidden="true" /></span></Tooltip> : null}{meta.aiSummary || repository.description || t("暂无摘要或描述", "No summary or description")}</p>
      {meta.note ? <p className="mt-2 line-clamp-2 max-w-full break-words rounded-md border-l-2 border-foreground/15 bg-secondary/25 px-2.5 py-1.5 text-xs leading-5 text-foreground/80 [overflow-wrap:anywhere]"><span className="mr-1.5 font-medium text-muted-foreground">{t("备注", "Note")}</span>{meta.note}</p> : null}
      {topics.length ? <TopicRow topics={topics} activeTopics={activeTopics} selectionMode={selectionMode} onFilterTopic={onFilterTopic} label={t("GitHub Topics；点击可筛选", "GitHub Topics; click to filter")} /> : null}
      {platforms.length ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1" aria-label={t("根据 Release 附件与 GitHub Topics 识别的平台", "Platforms detected from Release assets and GitHub Topics")}>{platforms.map((platform) => <Tooltip key={platform} content={t(`根据 Release 附件与 GitHub Topics 识别，点击按平台筛选：${platform}`, `Detected from Release assets and GitHub Topics; click to filter by platform: ${platform}`)}><Button variant="ghost" size="xs" disabled={selectionMode} aria-pressed={activePlatforms.includes(platform)} onClick={() => onFilterPlatform(platform)} className="h-auto min-h-0 p-0 hover:bg-transparent active:bg-transparent"><Badge variant="outline" size="sm" className="cursor-pointer rounded-full bg-secondary/25 px-1.5 font-normal text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:border-foreground/30 aria-pressed:bg-accent aria-pressed:text-foreground">{platform}</Badge></Button></Tooltip>)}</div> : null}
    </div>
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pb-3 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
      <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap justify-self-start" title={`${repository.stargazers_count.toLocaleString()} stars`}><StarIcon className="size-3.5" aria-hidden="true" />{compactNumber(repository.stargazers_count, locale)}</span>
      {repository.language ? <Button variant="ghost" size="xs" disabled={selectionMode} aria-pressed={activeLanguage === repository.language} title={t(`按语言筛选：${repository.language}`, `Filter by language: ${repository.language}`)} onClick={() => onFilterLanguage(repository.language!)} className="h-auto min-h-0 min-w-0 max-w-32 justify-self-center gap-1.5 truncate rounded-sm p-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: githubLanguageColor(repository.language) }} aria-hidden="true" /><span className="truncate">{repository.language}</span></Button> : <span aria-hidden="true" />}
      <span className="whitespace-nowrap justify-self-end">{relativeDate(repository.updated_at, language)}</span>
    </div>
    <footer className="mt-auto border-t border-border/70 px-4 py-3">
      <div className={cn("flex w-full items-center justify-between gap-2", selectionMode && "opacity-60")} aria-label={t("仓库操作", "Repository actions")}>
        <Tooltip content={aiActionLabel}><span><Button variant="ghost" size="icon-sm" onClick={onOrganize} disabled={selectionMode || !aiEnabled || aiLoading} aria-label={aiAnalyzed ? t("重新进行 AI 分析", "Reanalyze with AI") : t("AI 分析", "AI analysis")} aria-busy={aiLoading || undefined} className={cn(actionClass, aiAnalyzed && !aiLoading && "text-success-foreground")}><SparklesIcon className="size-4" aria-hidden="true" /></Button></span></Tooltip>
        <Tooltip content={releaseSubscribed ? t("取消订阅 Release", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")}><Button variant="ghost" size="icon-sm" onClick={onToggleRelease} disabled={selectionMode} aria-label={releaseSubscribed ? t("取消订阅 Release", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")} aria-pressed={releaseSubscribed} className={actionClass}>{releaseSubscribed ? <BellOffIcon className="size-4" aria-hidden="true" /> : <BellIcon className="size-4" aria-hidden="true" />}</Button></Tooltip>
        <Tooltip content={t("在 GitHub 打开", "Open on GitHub")}><Button render={selectionMode ? undefined : <a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" disabled={selectionMode} aria-label={t("在 GitHub 打开", "Open on GitHub")} className={actionClass}><ExternalLinkIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("编辑", "Edit")}><Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={selectionMode} aria-label={t("编辑", "Edit")} className={actionClass}><PencilIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <HoldToConfirmButton size="sm" iconOnly duration={1200} onConfirm={onUnstar} disabled={selectionMode || mutating} ariaLabel={t(`按住 1.2 秒取消 ${repository.full_name} 的 Star`, `Hold for 1.2 seconds to unstar ${repository.full_name}`)} holdingLabel={t("继续按住以取消 Star", "Keep holding to unstar")} confirmedLabel={t("已取消 Star", "Unstarred")} icon={<StarIcon className="size-4" aria-hidden="true" />} className="rounded-lg border-transparent bg-transparent text-destructive-foreground hover:border-transparent hover:bg-destructive/10" />
      </div>
    </footer>
    </Card>
  </BeamCard>;
}
