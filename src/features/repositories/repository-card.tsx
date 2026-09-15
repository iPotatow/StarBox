import {
  RiArchiveLine,
  RiExternalLinkLine,
  RiInformationLine,
  RiMagicLine,
  RiNotification2Line,
  RiNotificationOffLine,
  RiSettings4Line,
  RiStarLine,
} from "@remixicon/react";
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

export function RepositoryCard({ repository, meta, density, aiEnabled, aiLoading, selected, selectionMode = false, releaseSubscribed, mutating, onSelectedChange, onEdit, onDetails, onOrganize, onToggleRelease, onUnstar }: {
  repository: Repository; meta: RepositoryMeta; density: "comfortable" | "compact"; aiEnabled: boolean; aiLoading: boolean; selected: boolean; selectionMode?: boolean; releaseSubscribed: boolean; mutating: boolean;
  onSelectedChange: (selected: boolean) => void; onEdit: () => void; onDetails: () => void; onOrganize: () => void; onToggleRelease: () => void; onUnstar: () => void;
}) {
  const { t, locale, language } = useI18n();
  const compact = density === "compact";
  const allTags = Array.from(new Set([...(meta.aiTags || []), ...repository.topics]));
  const tagLimit = compact ? 3 : 5;
  const tags = allTags.slice(0, tagLimit);
  const hiddenTagCount = Math.max(0, allTags.length - tagLimit);
  const actionClass = "text-muted-foreground transition-colors hover:text-foreground";
  const avatarClass = cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-xs font-semibold text-muted-foreground ring-1 ring-border/60", compact ? "size-9" : "size-10");
  return <Card render={<article />} data-selected={selected ? "true" : undefined} className={cn("group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition-[background-color,border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-card-hover focus-within:border-foreground/25 [content-visibility:auto] [contain-intrinsic-size:auto_260px]", selected && "border-foreground/35 ring-1 ring-foreground/10")}>
    <div className="absolute right-4 top-4 z-10"><Checkbox className="size-5" checked={selected} onCheckedChange={onSelectedChange} aria-label={t(`选择 ${repository.full_name}`, `Select ${repository.full_name}`)} /></div>
    <header className={cn("flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 pr-14", compact ? "px-3 py-2.5" : "px-4 py-3.5")}>
      <Avatar className={avatarClass} aria-hidden="true"><AvatarFallback className="rounded-xl bg-secondary text-xs font-semibold text-muted-foreground">{repository.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repository.owner.avatar_url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="rounded-xl" /></Avatar>
      <div className="min-w-0 flex-1"><Button variant="link" size="none" onClick={onDetails} title={repository.full_name} className="flex w-full min-w-0 justify-start truncate rounded-sm text-left text-sm font-semibold tracking-tight hover:text-primary">{repository.full_name}</Button><div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">{meta.category ? <span title={meta.category} className="max-w-full truncate text-xs font-medium text-muted-foreground">{meta.category}</span> : null}{repository.archived ? <Badge variant="outline" size="sm" className="gap-1 rounded-md px-1.5 text-xs"><RiArchiveLine className="size-3" aria-hidden="true" />{t("已归档", "Archived")}</Badge> : null}{releaseSubscribed ? <Badge variant="info" size="sm" className="gap-1 rounded-md px-1.5 text-xs"><RiNotification2Line className="size-3" aria-hidden="true" />Release</Badge> : null}</div></div>
    </header>
    <div className={cn("min-w-0 flex-1", compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3.5")}>
      <div className={cn("grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none", aiLoading ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">{aiLoading ? <div role="status" aria-live="polite" className="mb-2 flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary"><RiMagicLine className="size-3.5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />{t("AI 正在分析", "AI is analyzing")}</div> : null}</div>
      </div>
      <p title={meta.aiSummary || repository.description || undefined} className={cn("line-clamp-2 break-words text-sm leading-5 text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none [overflow-wrap:anywhere]", !compact && "sm:line-clamp-3", aiLoading && "opacity-65")}>{meta.aiSummary || repository.description || ""}</p>
      {meta.note ? <p className="mt-2 line-clamp-2 max-w-full break-words rounded-md border-l-2 border-foreground/20 bg-secondary/35 px-2.5 py-1.5 text-xs leading-5 text-foreground/80 [overflow-wrap:anywhere]">{meta.note}</p> : null}
      {tags.length ? <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} title={tag} className="max-w-full min-w-0 truncate rounded-md px-1.5 text-xs font-medium">{tag}</Badge>)}{hiddenTagCount ? <Badge variant="outline" className="rounded-md px-1.5 text-xs font-medium">+{hiddenTagCount}</Badge> : null}</div> : null}
    </div>
    <footer className={cn("mt-auto border-t border-border/70", compact ? "px-3 py-2.5" : "px-4 py-3")}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]"><span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${repository.stargazers_count.toLocaleString()} stars`}><RiStarLine className="size-3.5" aria-hidden="true" />{compactNumber(repository.stargazers_count, locale)}</span>{repository.language ? <span title={repository.language} className="inline-flex min-w-0 max-w-32 items-center gap-1.5 truncate whitespace-nowrap"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: githubLanguageColor(repository.language) }} aria-hidden="true" /><span className="truncate">{repository.language}</span></span> : null}<span className="whitespace-nowrap">{relativeDate(repository.updated_at, language)}</span></div>
      <div className={cn("mt-2 flex items-center justify-start gap-0.5 transition-opacity", selectionMode && "pointer-events-none opacity-30")} aria-label={t("仓库操作", "Repository actions")}>
        <Tooltip content={releaseSubscribed ? t("取消 Release 订阅", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")}><Button variant="ghost" size="icon-sm" onClick={onToggleRelease} aria-label={releaseSubscribed ? t("取消 Release 订阅", "Unsubscribe from Releases") : t("订阅 Release", "Subscribe to Releases")} aria-pressed={releaseSubscribed} className={actionClass}>{releaseSubscribed ? <RiNotification2Line className="size-4" aria-hidden="true" /> : <RiNotificationOffLine className="size-4" aria-hidden="true" />}</Button></Tooltip>
        <Tooltip content={aiLoading ? t("AI 正在分析", "AI is analyzing") : aiEnabled ? t("AI 分析", "AI analysis") : t("请先在设置中连接 AI 服务", "Connect an AI service in Settings first")}><span><Button variant="ghost" size="icon-sm" onClick={onOrganize} disabled={!aiEnabled || aiLoading} aria-label={t("AI 分析", "AI analysis")} aria-busy={aiLoading || undefined} className={actionClass}><RiMagicLine className={cn("size-4", aiLoading && "animate-pulse motion-reduce:animate-none")} aria-hidden="true" /></Button></span></Tooltip>
        <Tooltip content={t("查看详情", "View details")}><Button variant="ghost" size="icon-sm" onClick={onDetails} aria-label={t("查看详情", "View details")} className={actionClass}><RiInformationLine className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("编辑", "Edit")}><Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("编辑", "Edit")} className={actionClass}><RiSettings4Line className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("在 GitHub 打开", "Open on GitHub")}><Button render={<a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" aria-label={t("在 GitHub 打开", "Open on GitHub")} className={actionClass}><RiExternalLinkLine className="size-4" aria-hidden="true" /></Button></Tooltip>
        <Tooltip content={t("取消 Star", "Unstar")}><Button variant="ghost" size="icon-sm" onClick={onUnstar} loading={mutating} aria-label={t("取消 Star", "Unstar")} className="text-muted-foreground transition-colors hover:text-destructive-foreground"><RiStarLine className="size-4" aria-hidden="true" /></Button></Tooltip>
      </div>
    </footer>
  </Card>;
}
