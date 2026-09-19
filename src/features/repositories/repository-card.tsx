import { RiNotification2Line, RiNotificationOffLine, RiStarLine } from "@remixicon/react";
import { BorderBeam } from "border-beam";
import { ArchiveIcon, CircleHelpIcon, ExternalLinkIcon, SettingsIcon, SparklesIcon } from "../../lib/animated-icons";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/cn";
import { githubLanguageColor } from "../../lib/github-language-colors";
import { useI18n } from "../../lib/i18n";
import type { Repository, RepositoryMeta } from "../../types";

function compactNumber(value: number, locale: string) { return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function relativeDate(value: string, language: "zh-CN" | "en") { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)); if (language === "en") { if (days < 1) return "Updated today"; if (days < 30) return `Updated ${days}d ago`; if (days < 365) return `Updated ${Math.floor(days / 30)}mo ago`; return `Updated ${Math.floor(days / 365)}y ago`; } if (days < 1) return "今天更新"; if (days < 30) return `${days} 天前更新`; if (days < 365) return `${Math.floor(days / 30)} 个月前更新`; return `${Math.floor(days / 365)} 年前更新`; }
const platformLabels: Record<string, string> = { mac: "macOS", macos: "macOS", windows: "Windows", linux: "Linux" };
function repositoryPlatforms(values: string[]) {
  return Array.from(new Set(values.map((value) => platformLabels[value.trim().toLowerCase()]).filter((value): value is string => Boolean(value))));
}

export function RepositoryCard({ repository, meta, aiEnabled, aiLoading, selected, selectionMode = false, releaseSubscribed, mutating, onSelectedChange, onEdit, onDetails, onOrganize, onToggleRelease, onUnstar }: {
  repository: Repository; meta: RepositoryMeta; aiEnabled: boolean; aiLoading: boolean; selected: boolean; selectionMode?: boolean; releaseSubscribed: boolean; mutating: boolean;
  onSelectedChange: (selected: boolean) => void; onEdit: () => void; onDetails: () => void; onOrganize: () => void; onToggleRelease: () => void; onUnstar: () => void;
}) {
  const { t, locale, language } = useI18n();
  const topics = Array.from(new Set(repository.topics)).slice(0, 5);
  const hiddenTopicCount = Math.max(0, repository.topics.length - topics.length);
  const platforms = repositoryPlatforms(meta.aiPlatforms);
  const visiblePlatforms = platforms.slice(0, 3);
  const hiddenPlatformCount = Math.max(0, platforms.length - visiblePlatforms.length);
  const aiAnalyzed = Boolean(meta.aiSummary.trim());
  const actionClass = "text-muted-foreground hover:text-foreground";
  const avatarClass = "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-xs font-semibold text-muted-foreground ring-1 ring-border/60";
  const aiActionLabel = aiLoading
    ? t("AI 正在分析", "AI is analyzing")
    : aiAnalyzed
      ? t("AI 已分析，点击重新分析", "AI analyzed; click to reanalyze")
      : aiEnabled
        ? t("AI 分析", "AI analysis")
        : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first");
  return <BorderBeam active={aiLoading} size="md" colorVariant="colorful" strength={0.58} theme="auto" data-repository-full-name={repository.full_name} className="h-full min-w-0">
    <Card render={<article />} data-ai-loading={aiLoading ? "true" : undefined} data-selected={selected ? "true" : undefined} className={cn("group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card hover:border-foreground/20 hover:shadow-card-hover focus-within:border-foreground/25 [content-visibility:auto] [contain-intrinsic-size:auto_260px]", selected && "border-foreground/35 ring-1 ring-foreground/10")}>
    <div className="absolute right-4 top-4 z-10"><Checkbox className="size-5 after:absolute after:-inset-3 after:content-['']" checked={selected} onCheckedChange={onSelectedChange} aria-label={t(`选择 ${repository.full_name}`, `Select ${repository.full_name}`)} /></div>
    <header className="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 px-4 py-3.5 pr-14">
      <Avatar className={avatarClass} aria-hidden="true"><AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold text-muted-foreground">{repository.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repository.owner.avatar_url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="rounded-xl" /></Avatar>
      <div className="min-w-0 flex-1"><Button variant="link" size="xs" onClick={onDetails} disabled={selectionMode} title={repository.full_name} className="flex h-5 w-full min-w-0 justify-start truncate rounded-sm px-0 py-0 text-left text-sm font-semibold tracking-tight hover:text-primary">{repository.full_name}</Button><div className="mt-1 flex h-5 min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">{meta.category ? <span title={meta.category} className="min-w-0 truncate text-xs font-medium text-muted-foreground">{meta.category}</span> : null}{repository.archived ? <Badge variant="outline" size="sm" className="gap-1 rounded-md px-1.5 text-xs"><ArchiveIcon className="size-3" aria-hidden="true" />{t("已归档", "Archived")}</Badge> : null}{releaseSubscribed ? <Badge variant="info" size="sm" className="gap-1 rounded-md px-1.5 text-xs"><RiNotification2Line className="size-3" aria-hidden="true" />Release</Badge> : null}{aiAnalyzed ? <Badge variant="success" size="sm" className="gap-1 rounded-md px-1.5 text-xs"><SparklesIcon className="size-3" aria-hidden="true" />{t("AI 已分析", "AI analyzed")}</Badge> : null}</div></div>
    </header>
    <div className="min-w-0 flex-1 px-4 pb-4 pt-3.5">
      <p title={meta.aiSummary || repository.description || undefined} className="line-clamp-2 break-words text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:line-clamp-3">{meta.aiSummary || repository.description || ""}</p>
      {meta.note ? <p className="mt-2 line-clamp-2 max-w-full break-words rounded-md border-l-2 border-foreground/20 bg-secondary/35 px-2.5 py-1.5 text-xs leading-5 text-foreground/80 [overflow-wrap:anywhere]">{meta.note}</p> : null}
      {visiblePlatforms.length ? <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5" aria-label={t("支持平台", "Platforms")}>{visiblePlatforms.map((platform) => <Badge key={platform} variant="outline" size="sm" title={platform} className="rounded-md text-xs font-medium">{platform}</Badge>)}{hiddenPlatformCount ? <Badge variant="outline" size="sm" className="rounded-md text-xs font-medium">+{hiddenPlatformCount}</Badge> : null}</div> : null}
      {topics.length ? <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">{topics.map((tag) => <Badge key={tag} title={tag} className="max-w-full min-w-0 truncate rounded-md px-1.5 text-xs font-medium">{tag}</Badge>)}{hiddenTopicCount ? <Badge variant="outline" className="rounded-md px-1.5 text-xs font-medium">+{hiddenTopicCount}</Badge> : null}</div> : null}
    </div>
    <footer className="mt-auto border-t border-border/70 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]"><span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${repository.stargazers_count.toLocaleString()} stars`}><RiStarLine className="size-3.5" aria-hidden="true" />{compactNumber(repository.stargazers_count, locale)}</span>{repository.language ? <span title={repository.language} className="inline-flex min-w-0 max-w-32 items-center gap-1.5 truncate whitespace-nowrap"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: githubLanguageColor(repository.language) }} aria-hidden="true" /><span className="truncate">{repository.language}</span></span> : null}<span className="whitespace-nowrap">{relativeDate(repository.updated_at, language)}</span></div>
      <div className={cn("mt-2 flex items-center justify-start gap-0.5", selectionMode && "opacity-60")} aria-label={t("仓库操作", "Repository actions")}>
        <Tooltip content={releaseSubscribed ? t("取消 Release 订阅", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")}><Button variant="ghost" size="icon-sm" onClick={onToggleRelease} disabled={selectionMode} aria-label={releaseSubscribed ? t("取消 Release 订阅", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")} aria-pressed={releaseSubscribed} className={actionClass}>{releaseSubscribed ? <RiNotification2Line className="size-4" aria-hidden="true" /> : <RiNotificationOffLine className="size-4" aria-hidden="true" />}</Button></Tooltip>
        <Tooltip content={aiActionLabel}><span><Button variant="ghost" size="icon-sm" onClick={onOrganize} disabled={selectionMode || !aiEnabled || aiLoading} aria-label={aiAnalyzed ? t("重新进行 AI 分析", "Reanalyze with AI") : t("AI 分析", "AI analysis")} aria-busy={aiLoading || undefined} className={cn(actionClass, aiAnalyzed && !aiLoading && "text-success-foreground")}><SparklesIcon className="size-4" aria-hidden="true" /></Button></span></Tooltip>
        <Tooltip content={t("查看详情", "View details")}><Button variant="ghost" size="icon-sm" onClick={onDetails} disabled={selectionMode} aria-label={t("查看详情", "View details")} className={actionClass}><CircleHelpIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("编辑", "Edit")}><Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={selectionMode} aria-label={t("编辑", "Edit")} className={actionClass}><SettingsIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("在 GitHub 打开", "Open on GitHub")}><Button render={selectionMode ? undefined : <a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" disabled={selectionMode} aria-label={t("在 GitHub 打开", "Open on GitHub")} className={actionClass}><ExternalLinkIcon className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("取消 Star", "Unstar")}><Button variant="ghost" size="icon-sm" onClick={onUnstar} loading={mutating} disabled={selectionMode} aria-label={t("取消 Star", "Unstar")} className="text-muted-foreground hover:text-destructive-foreground"><RiStarLine className="size-4" aria-hidden="true" /></Button></Tooltip>
      </div>
    </footer>
    </Card>
  </BorderBeam>;
}
