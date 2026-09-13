import {
  RiArchiveLine,
  RiExternalLinkLine,
  RiInformationLine,
  RiMagicLine,
  RiNotification2Line,
  RiNotificationOffLine,
  RiPushpin2Fill,
  RiPushpin2Line,
  RiSettings4Line,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/cn";
import type { Repository, RepositoryMeta } from "../../types";

function compactNumber(value: number) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function relativeDate(value: string) { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)); if (days < 1) return "今天更新"; if (days < 30) return `${days} 天前更新`; if (days < 365) return `${Math.floor(days / 30)} 个月前更新`; return `${Math.floor(days / 365)} 年前更新`; }

export function RepositoryCard({ repository, meta, density, aiEnabled, aiLoading, selected, releaseSubscribed, mutating, onSelectedChange, onEdit, onDetails, onOrganize, onTogglePin, onToggleRelease, onUnstar }: {
  repository: Repository; meta: RepositoryMeta; density: "comfortable" | "compact"; aiEnabled: boolean; aiLoading: boolean; selected: boolean; releaseSubscribed: boolean; mutating: boolean;
  onSelectedChange: (selected: boolean) => void; onEdit: () => void; onDetails: () => void; onOrganize: () => void; onTogglePin: () => void; onToggleRelease: () => void; onUnstar: () => void;
}) {
  const compact = density === "compact";
  const tags = Array.from(new Set([...(meta.aiTags || []), ...repository.topics])).slice(0, compact ? 3 : 5);
  const actionClass = "text-muted-foreground transition-colors hover:text-foreground";
  return <Card render={<article />} data-selected={selected ? "true" : undefined} data-pinned={meta.pinned ? "true" : undefined} className={cn("group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition-[background-color,border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-card-hover focus-within:border-foreground/25", selected && "border-foreground/35 ring-1 ring-foreground/10")}>
    <div className="absolute right-3 top-3 z-10 rounded-md bg-card/90 p-1 shadow-sm backdrop-blur"><Checkbox checked={selected} onCheckedChange={onSelectedChange} aria-label={`选择 ${repository.full_name}`} /></div>
    <header className={cn("flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 pr-14", compact ? "px-3 py-2.5" : "px-4 py-3.5")}>
      <img src={repository.owner.avatar_url} alt="" loading="lazy" className={cn("shrink-0 rounded-xl bg-secondary object-cover ring-1 ring-border/60", compact ? "size-9" : "size-10")} />
      <div className="min-w-0 flex-1"><a href={repository.html_url} target="_blank" rel="noreferrer" title={repository.full_name} className="block min-w-0 truncate rounded-sm text-sm font-semibold tracking-tight outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background">{repository.full_name}</a><div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">{meta.category ? <span title={meta.category} className="max-w-full truncate text-[11px] font-medium text-muted-foreground">{meta.category}</span> : null}{meta.pinned ? <Badge variant="warning" size="sm" className="gap-1 rounded-md px-1.5 text-[10px]"><RiPushpin2Fill className="size-3" />置顶</Badge> : null}{repository.archived ? <Badge variant="outline" size="sm" className="gap-1 rounded-md px-1.5 text-[10px]"><RiArchiveLine className="size-3" />已归档</Badge> : null}{releaseSubscribed ? <Badge variant="info" size="sm" className="gap-1 rounded-md px-1.5 text-[10px]"><RiNotification2Line className="size-3" />Release</Badge> : null}</div></div>
    </header>
    <div className={cn("min-w-0 flex-1", compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3.5")}><p title={meta.aiSummary || repository.description || undefined} className={cn("line-clamp-2 break-words text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]", !compact && "sm:line-clamp-3")}>{meta.aiSummary || repository.description || "暂无仓库描述"}</p>{meta.note ? <p className="mt-2 line-clamp-2 max-w-full break-words rounded-md border-l-2 border-foreground/20 bg-secondary/35 px-2.5 py-1.5 text-xs leading-5 text-foreground/80 [overflow-wrap:anywhere]">{meta.note}</p> : null}{tags.length ? <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} title={tag} className="max-w-full min-w-0 truncate rounded-md px-1.5 text-[10px] font-medium">{tag}</Badge>)}</div> : null}</div>
    <footer className={cn("mt-auto border-t border-border/70", compact ? "px-3 py-2.5" : "px-4 py-3")}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]"><span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${repository.stargazers_count.toLocaleString()} stars`}><RiStarFill className="size-3.5" />{compactNumber(repository.stargazers_count)}</span>{repository.language ? <span title={repository.language} className="inline-flex min-w-0 max-w-32 items-center gap-1.5 truncate whitespace-nowrap"><span className="size-2 shrink-0 rounded-full bg-language" /><span className="truncate">{repository.language}</span></span> : null}<span className="whitespace-nowrap">{relativeDate(repository.updated_at)}</span></div>
      <div className="mt-2.5 flex items-center justify-end gap-0.5 border-t border-border/50 pt-2.5" aria-label="仓库操作">
        <Tooltip content={releaseSubscribed ? "取消 Release 订阅" : "订阅 Release"}><Button variant="ghost" size="icon-sm" onClick={onToggleRelease} aria-label={releaseSubscribed ? "取消 Release 订阅" : "订阅 Release"} aria-pressed={releaseSubscribed} className={actionClass}>{releaseSubscribed ? <RiNotification2Line className="size-4" /> : <RiNotificationOffLine className="size-4" />}</Button></Tooltip>
        {aiEnabled ? <Tooltip content="AI 整理"><Button variant="ghost" size="icon-sm" onClick={onOrganize} loading={aiLoading} aria-label="AI 整理" className={actionClass}>{!aiLoading ? <RiMagicLine className="size-4" /> : null}</Button></Tooltip> : null}
        <Tooltip content="查看详情"><Button variant="ghost" size="icon-sm" onClick={onDetails} aria-label="查看详情" className={actionClass}><RiInformationLine className="size-4" /></Button></Tooltip>
        <Tooltip content="编辑元数据"><Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="编辑元数据" className={actionClass}><RiSettings4Line className="size-4" /></Button></Tooltip>
        <Tooltip content={meta.pinned ? "取消置顶" : "置顶仓库"}><Button variant="ghost" size="icon-sm" onClick={onTogglePin} aria-label={meta.pinned ? "取消置顶" : "置顶仓库"} aria-pressed={meta.pinned} className={actionClass}>{meta.pinned ? <RiPushpin2Fill className="size-4" /> : <RiPushpin2Line className="size-4" />}</Button></Tooltip>
        <Tooltip content="在 GitHub 打开"><Button render={<a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" aria-label="在 GitHub 打开" className={actionClass}><RiExternalLinkLine className="size-4" /></Button></Tooltip>
        <Tooltip content="取消 Star"><Button variant="ghost" size="icon-sm" onClick={onUnstar} loading={mutating} aria-label="取消 Star" className="text-muted-foreground transition-colors hover:text-destructive-foreground">{!mutating ? <RiStarLine className="size-4" /> : null}</Button></Tooltip>
      </div>
    </footer>
  </Card>;
}
