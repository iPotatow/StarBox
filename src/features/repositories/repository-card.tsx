import { AppleLogo, Bell as BellIcon, BellSlash as BellOffIcon, Info as InfoIcon, LinuxLogo, PencilSimple as PencilIcon, ShippingContainer, Star as StarIcon, WindowsLogo } from "@phosphor-icons/react";
import { BeamCard } from "../../components/spectrumui/beam-card";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { ArchiveIcon, ExternalLinkIcon, SparklesIcon } from "../../lib/animated-icons";
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
const platformIcons = { macOS: AppleLogo, Windows: WindowsLogo, Linux: LinuxLogo, Docker: ShippingContainer } as const;
function repositoryPlatforms(values: string[], topics: string[]) {
  return mergeRepositoryPlatforms(values, topics).map((value) => platformLabels[value]).filter((value): value is keyof typeof platformIcons => Boolean(value));
}

export function RepositoryCard({ repository, meta, aiEnabled, aiLoading, selected, selectionMode = false, releaseSubscribed, mutating, activeCategory, activeLanguage, activeTopics, activePlatforms, onSelectedChange, onEdit, onDetails, onOrganize, onToggleRelease, onUnstar, onFilterCategory, onFilterLanguage, onFilterTopic, onFilterPlatform }: {
  repository: Repository; meta: RepositoryMeta; aiEnabled: boolean; aiLoading: boolean; selected: boolean; selectionMode?: boolean; releaseSubscribed: boolean; mutating: boolean;
  activeCategory: string; activeLanguage: string; activeTopics: string[]; activePlatforms: string[];
  onSelectedChange: (selected: boolean) => void; onEdit: () => void; onDetails: () => void; onOrganize: () => void; onToggleRelease: () => void; onUnstar: () => void;
  onFilterCategory: (category: string) => void; onFilterLanguage: (language: string) => void; onFilterTopic: (topic: string) => void; onFilterPlatform: (platform: string) => void;
}) {
  const { t, locale, language } = useI18n();
  const uniqueTopics = Array.from(new Set(repository.topics));
  const topicOverflow = uniqueTopics.length > 4;
  const topics = uniqueTopics.slice(0, topicOverflow ? 3 : 4);
  const hiddenTopicCount = Math.max(0, uniqueTopics.length - topics.length);
  const platforms = repositoryPlatforms(meta.aiPlatforms, repository.topics);
  const visiblePlatforms = platforms.slice(0, 3);
  const hiddenPlatformCount = Math.max(0, platforms.length - visiblePlatforms.length);
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
    <div className="absolute right-4 top-4 z-10"><Checkbox className="size-5 after:absolute after:-inset-3 after:content-['']" checked={selected} onCheckedChange={onSelectedChange} aria-label={t(`选择 ${repository.full_name}`, `Select ${repository.full_name}`)} /></div>
    <header className="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 px-4 py-3.5 pr-14">
      <Avatar className={avatarClass} aria-hidden="true"><AvatarFallback className="bg-secondary text-xs font-semibold text-muted-foreground">{repository.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repository.owner.avatar_url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" /></Avatar>
      <div className="min-w-0 flex-1"><Button variant="link" size="xs" onClick={onDetails} disabled={selectionMode} title={repository.full_name} className="flex h-5 w-full min-w-0 justify-start truncate rounded-sm px-0 py-0 text-left text-sm font-semibold tracking-tight hover:text-foreground">{repository.full_name}</Button><div className="mt-1 flex min-h-5 min-w-0 flex-wrap items-center gap-1.5">{meta.category ? <Button variant="link" size="xs" disabled={selectionMode} aria-pressed={activeCategory === meta.category} title={t(`按分类筛选：${meta.category}`, `Filter by category: ${meta.category}`)} onClick={() => onFilterCategory(meta.category)} className="h-auto min-h-0 max-w-[min(12rem,55%)] justify-start truncate rounded-sm px-0 py-0 text-xs font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline aria-pressed:text-foreground">{meta.category}</Button> : null}{repository.archived ? <Badge variant="outline" size="sm" className="shrink-0 gap-1 rounded-md px-1.5 text-xs"><ArchiveIcon className="size-3" aria-hidden="true" />{t("已归档", "Archived")}</Badge> : null}</div></div>
    </header>
    <div className="min-w-0 flex-1 px-4 pb-4 pt-3.5">
      <p title={meta.aiSummary || repository.description || undefined} className={cn("line-clamp-2 break-words text-sm leading-5 [overflow-wrap:anywhere] sm:line-clamp-3", meta.aiSummary || repository.description ? "text-muted-foreground" : "italic text-muted-foreground/70")}>{aiAnalyzed ? <Tooltip content={t("AI 已分析", "AI analyzed")}><span className="mr-1 inline-flex align-[-0.15em] text-success-foreground" aria-label={t("AI 已分析", "AI analyzed")}><SparklesIcon className="size-3.5" aria-hidden="true" /></span></Tooltip> : null}{meta.aiSummary || repository.description || t("暂无摘要或描述", "No summary or description")}</p>
      {meta.note ? <p className="mt-2 line-clamp-2 max-w-full break-words rounded-md border-l-2 border-foreground/15 bg-secondary/25 px-2.5 py-1.5 text-xs leading-5 text-foreground/80 [overflow-wrap:anywhere]"><span className="mr-1.5 font-medium text-muted-foreground">{t("备注", "Note")}</span>{meta.note}</p> : null}
      {visiblePlatforms.length ? <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5" aria-label={t("根据 Release 附件与 GitHub Topics 识别的平台", "Platforms detected from Release assets and GitHub Topics")}>{visiblePlatforms.map((platform) => { const PlatformIcon = platformIcons[platform]; return <Tooltip key={platform} content={t(`根据 Release 附件与 GitHub Topics 识别，点击按平台筛选：${platform}`, `Detected from Release assets and GitHub Topics; click to filter by platform: ${platform}`)}><Button variant="ghost" size="xs" disabled={selectionMode} aria-pressed={activePlatforms.includes(platform)} onClick={() => onFilterPlatform(platform)} className="h-auto min-h-0 p-0 hover:bg-transparent active:bg-transparent"><Badge variant="outline" size="sm" className="cursor-pointer rounded-md text-xs font-medium hover:bg-accent aria-pressed:border-foreground/30 aria-pressed:bg-accent [&_svg]:size-3"><PlatformIcon aria-hidden="true" />{platform}</Badge></Button></Tooltip>; })}{hiddenPlatformCount ? <Tooltip content={t(`还有 ${hiddenPlatformCount} 个平台，可在详情中查看`, `${hiddenPlatformCount} more platforms; view them in details`)}><Badge variant="outline" size="sm" className="rounded-md text-xs font-medium">+{hiddenPlatformCount}</Badge></Tooltip> : null}</div> : null}
      {topics.length ? <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5" aria-label={t("GitHub Topics；点击可筛选", "GitHub Topics; click to filter")}>{topics.map((tag) => <Button key={tag} variant="ghost" size="xs" disabled={selectionMode} aria-pressed={activeTopics.includes(tag)} title={t(`按标签筛选：${tag}`, `Filter by tag: ${tag}`)} onClick={() => onFilterTopic(tag)} className="h-auto min-h-0 min-w-0 p-0 hover:bg-transparent active:bg-transparent"><Badge className="min-w-0 cursor-pointer truncate rounded-md px-1.5 text-xs font-medium hover:bg-secondary/80 aria-pressed:ring-1 aria-pressed:ring-foreground/20">{tag}</Badge></Button>)}{hiddenTopicCount ? <Tooltip content={t(`还有 ${hiddenTopicCount} 个 Topics，可在详情中查看`, `${hiddenTopicCount} more Topics; view them in details`)}><Badge variant="outline" className="min-w-0 truncate rounded-md px-1.5 text-xs font-medium">+{hiddenTopicCount}</Badge></Tooltip> : null}</div> : null}
    </div>
    <footer className="mt-auto border-t border-border/70 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]"><span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${repository.stargazers_count.toLocaleString()} stars`}><StarIcon className="size-3.5" aria-hidden="true" />{compactNumber(repository.stargazers_count, locale)}</span>{repository.language ? <Button variant="ghost" size="xs" disabled={selectionMode} aria-pressed={activeLanguage === repository.language} title={t(`按语言筛选：${repository.language}`, `Filter by language: ${repository.language}`)} onClick={() => onFilterLanguage(repository.language!)} className="h-auto min-h-0 min-w-0 max-w-32 gap-1.5 truncate rounded-sm p-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: githubLanguageColor(repository.language) }} aria-hidden="true" /><span className="truncate">{repository.language}</span></Button> : null}<span className="whitespace-nowrap">{relativeDate(repository.updated_at, language)}</span></div>
      <div className={cn("mt-2 flex items-center justify-start gap-0.5", selectionMode && "opacity-60")} aria-label={t("仓库操作", "Repository actions")}>
        <Tooltip content={releaseSubscribed ? t("取消订阅 Release", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")}><Button variant="ghost" size="icon-sm" onClick={onToggleRelease} disabled={selectionMode} aria-label={releaseSubscribed ? t("取消订阅 Release", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")} aria-pressed={releaseSubscribed} className={actionClass}>{releaseSubscribed ? <BellOffIcon className="size-4" aria-hidden="true" /> : <BellIcon className="size-4" aria-hidden="true" />}</Button></Tooltip>
        <Tooltip content={aiActionLabel}><span><Button variant="ghost" size="icon-sm" onClick={onOrganize} disabled={selectionMode || !aiEnabled || aiLoading} aria-label={aiAnalyzed ? t("重新进行 AI 分析", "Reanalyze with AI") : t("AI 分析", "AI analysis")} aria-busy={aiLoading || undefined} className={cn(actionClass, aiAnalyzed && !aiLoading && "text-success-foreground")}><SparklesIcon className="size-4" aria-hidden="true" /></Button></span></Tooltip>
        <Tooltip content={t("查看详情", "View details")}><Button variant="ghost" size="icon-sm" onClick={onDetails} disabled={selectionMode} aria-label={t("查看详情", "View details")} className={actionClass}><InfoIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("在 GitHub 打开", "Open on GitHub")}><Button render={selectionMode ? undefined : <a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" disabled={selectionMode} aria-label={t("在 GitHub 打开", "Open on GitHub")} className={actionClass}><ExternalLinkIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("编辑", "Edit")}><Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={selectionMode} aria-label={t("编辑", "Edit")} className={actionClass}><PencilIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("按住取消 Star", "Hold to unstar")}><HoldToConfirmButton size="sm" iconOnly duration={1200} onConfirm={onUnstar} disabled={selectionMode || mutating} ariaLabel={t(`按住 1.2 秒取消 ${repository.full_name} 的 Star`, `Hold for 1.2 seconds to unstar ${repository.full_name}`)} confirmedLabel={t("已取消 Star", "Unstarred")} icon={<StarIcon className="size-4" aria-hidden="true" />} className="text-muted-foreground hover:text-destructive-foreground" /></Tooltip>
      </div>
    </footer>
    </Card>
  </BeamCard>;
}
