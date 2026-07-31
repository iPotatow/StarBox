import {
  RiArchiveLine,
  RiExternalLinkLine,
  RiGitForkLine,
  RiMagicLine,
  RiMore2Line,
  RiNotification2Line,
  RiNotificationOffLine,
  RiPushpin2Fill,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/cn";
import type { Repository, RepositoryMeta } from "../../types";

function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days < 1) return "今天更新";
  if (days < 30) return `${days} 天前更新`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前更新`;
  return `${Math.floor(days / 365)} 年前更新`;
}

export function RepositoryCard({
  repository,
  meta,
  density,
  aiEnabled,
  aiLoading,
  selected,
  releaseSubscribed,
  mutating,
  onSelectedChange,
  onEdit,
  onDetails,
  onOrganize,
  onTogglePin,
  onToggleRelease,
  onFork,
  onUnstar,
}: {
  repository: Repository;
  meta: RepositoryMeta;
  density: "comfortable" | "compact";
  aiEnabled: boolean;
  aiLoading: boolean;
  selected: boolean;
  releaseSubscribed: boolean;
  mutating: boolean;
  onSelectedChange: (selected: boolean) => void;
  onEdit: () => void;
  onDetails: () => void;
  onOrganize: () => void;
  onTogglePin: () => void;
  onToggleRelease: () => void;
  onFork: () => void;
  onUnstar: () => void;
}) {
  const tags = Array.from(new Set([...(meta.aiTags || []), ...repository.topics])).slice(0, density === "compact" ? 3 : 5);
  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-card-hover",
        selected ? "border-foreground/35" : "border-border hover:border-foreground/15",
        density === "compact" ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          aria-label={`选择 ${repository.full_name}`}
          className="mt-2 size-4 shrink-0 rounded border-input"
        />
        <img
          src={repository.owner.avatar_url}
          alt=""
          className={cn("shrink-0 rounded-lg bg-secondary object-cover", density === "compact" ? "size-9" : "size-10")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <a href={repository.html_url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold tracking-tight hover:underline">
              {repository.full_name}
            </a>
            {meta.pinned ? <RiPushpin2Fill className="size-3.5 shrink-0 text-amber-500" /> : null}
            {repository.archived ? <RiArchiveLine className="size-3.5 shrink-0 text-muted-foreground" /> : null}
          </div>
          {meta.category ? <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{meta.category}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onToggleRelease} title={releaseSubscribed ? "取消 Release 订阅" : "订阅 Release"}>
            {releaseSubscribed ? <RiNotification2Line className="size-4" /> : <RiNotificationOffLine className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onFork} title="Fork"><RiGitForkLine className="size-4" /></Button>
          {aiEnabled ? (
            <Button variant="ghost" size="icon-sm" onClick={onOrganize} loading={aiLoading} title="AI 整理">
              {!aiLoading ? <RiMagicLine className="size-4" /> : null}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onDetails} title="查看详情"><RiMore2Line className="size-4" /></Button>
        </div>
      </div>

      <p className={cn("text-sm leading-6 text-muted-foreground", density === "compact" ? "mt-2 line-clamp-2" : "mt-3 line-clamp-3")}>
        {meta.aiSummary || repository.description || "暂无仓库描述"}
      </p>

      {meta.note ? <p className="mt-2 rounded-lg bg-secondary/60 px-2.5 py-2 text-xs leading-5 text-foreground/80">{meta.note}</p> : null}

      {tags.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {repository.language ? <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-language" />{repository.language}</span> : null}
        <span className="flex items-center gap-1"><RiStarFill className="size-3.5" />{compactNumber(repository.stargazers_count)}</span>
        <span className="flex items-center gap-1"><RiGitForkLine className="size-3.5" />{compactNumber(repository.forks_count)}</span>
        {repository.license ? <span>{repository.license}</span> : null}
        <span>{relativeDate(repository.pushed_at)}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground disabled:opacity-50"
            onClick={onUnstar}
            disabled={mutating}
            title="取消 Star"
          >
            <RiStarLine className="size-3.5" />取消 Star
          </button>
          <button type="button" onClick={onEdit} className="rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground">编辑</button>
          <button type="button" onClick={onTogglePin} className="rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground">
            {meta.pinned ? "取消置顶" : "置顶"}
          </button>
          <a href={repository.html_url} target="_blank" rel="noreferrer" aria-label="打开 GitHub" className="rounded-md p-1 opacity-70 hover:bg-accent hover:opacity-100">
            <RiExternalLinkLine className="size-3.5" />
          </a>
        </span>
      </div>
    </article>
  );
}
