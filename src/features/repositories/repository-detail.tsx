import { GitForkIcon, StarIcon } from "lucide-react";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, MenuIcon, RefreshCwIcon } from "../../lib/animated-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../components/ui/menu";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { fetchRepositoryReadme } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { Repository, RepositoryReadme } from "../../types";

function number(value: number | undefined, locale: string) { return new Intl.NumberFormat(locale).format(value ?? 0); }

export function RepositoryDetail({ open, repository, token, credentialConnected, onClose, onPrevious, onNext, previousDisabled = false, nextDisabled = false }: {
  open: boolean;
  repository: Repository | null;
  token: string;
  credentialConnected?: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const [readme, setReadme] = useState<RepositoryReadme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const readmeCache = useRef(new Map<string, RepositoryReadme>());
  const canLoad = Boolean(token.trim() || credentialConnected);

  const loadReadme = useCallback(async (force = false) => {
    if (!repository || !canLoad || loading) return;
    const fullName = repository.full_name;
    const cached = readmeCache.current.get(fullName);
    if (cached && !force) { setReadme(cached); setError(""); return; }
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = await fetchRepositoryReadme(token.trim(), fullName, controller.signal);
      if (id === requestId.current) {
        readmeCache.current.set(fullName, result);
        setReadme(result);
      }
    } catch (reason) {
      if (id === requestId.current && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : t("README 加载失败", "Failed to load README"));
    } finally {
      if (id === requestId.current) setLoading(false);
      if (requestAbort.current === controller) requestAbort.current = null;
    }
  }, [repository?.full_name, token, credentialConnected, loading]);

  useEffect(() => {
    requestAbort.current?.abort();
    requestAbort.current = null;
    requestId.current += 1;
    const cached = repository ? readmeCache.current.get(repository.full_name) ?? null : null;
    setReadme(cached);
    setError("");
    setLoading(false);
    return () => { requestAbort.current?.abort(); requestId.current += 1; };
  }, [open, repository?.full_name]);

  useEffect(() => {
    if (open && repository && canLoad && !readme && !loading) void loadReadme();
  }, [open, repository?.full_name, canLoad, readme, loading, loadReadme]);

  if (!repository) return null;
  return <ResponsiveDialog open={open} title={repository.full_name} description={repository.description || t("仓库详情", "Repository details")} onClose={onClose} className="sm:h-[88vh] sm:max-w-7xl">
    <div className="grid gap-6">
      {onPrevious || onNext ? <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon-sm" onClick={onPrevious} disabled={previousDisabled} aria-label={t("上一个仓库", "Previous repository")}><ChevronLeftIcon className="size-4" /></Button><Button variant="ghost" size="icon-sm" onClick={onNext} disabled={nextDisabled} aria-label={t("下一个仓库", "Next repository")}><ChevronRightIcon className="size-4" /></Button></div> : null}
      <section aria-label={t("仓库概览", "Repository overview")} className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Stars</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><StarIcon className="size-3.5" />{number(repository.stargazers_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Forks</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><GitForkIcon className="size-3.5" />{number(repository.forks_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Watchers</div><div className="mt-1 text-sm font-semibold">{number(repository.watchers_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Issues</div><div className="mt-1 text-sm font-semibold">{number(repository.open_issues_count, locale)}</div></div></div>
        <div className="flex flex-wrap gap-1.5">{repository.language ? <Badge>{repository.language}</Badge> : null}{repository.license ? <Badge>{repository.license}</Badge> : null}{repository.visibility ? <Badge>{repository.visibility}</Badge> : null}{repository.default_branch ? <Badge>{repository.default_branch}</Badge> : null}{repository.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div>
        <div className="flex flex-wrap gap-2">
          <Button render={<a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon className="size-4" />GitHub</Button>
          {repository.homepage ? <Button render={<a href={repository.homepage} target="_blank" rel="noreferrer" />} variant="outline">Homepage</Button> : null}
          <Menu><MenuTrigger render={<Button variant="outline" />}><MenuIcon className="size-4" />{t("更多", "More")}</MenuTrigger><MenuPopup><MenuItem render={<a href={`https://deepwiki.com/${repository.full_name}`} target="_blank" rel="noreferrer" />}>DeepWiki</MenuItem><MenuItem render={<a href={`https://zread.ai/${repository.full_name}`} target="_blank" rel="noreferrer" />}>Zread</MenuItem></MenuPopup></Menu>
        </div>
      </section>

      <section aria-labelledby="repository-readme-heading" className="border-t border-border/70 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="repository-readme-heading" className="text-sm font-semibold">README</h2>
          {readme ? <Button render={<a href={readme.htmlUrl} target="_blank" rel="noreferrer" />} size="sm" variant="ghost">{t("GitHub 原文", "View on GitHub")}</Button> : null}
        </div>
        {!canLoad ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("连接 GitHub 凭据后可加载 README。", "Connect GitHub credentials to load the README.")}</div> : loading ? <div className="grid gap-2 rounded-xl border border-border p-5"><Skeleton className="h-4 w-1/3" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div> : error ? <div className="rounded-xl border border-border p-5 text-sm"><p className="text-destructive-foreground">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void loadReadme(true)}><RefreshCwIcon className="size-4" />{t("重试", "Retry")}</Button></div> : readme ? <div className="rounded-xl border border-border bg-secondary/20 p-5 sm:p-7"><MarkdownContent content={readme.content} linkBaseUrl={`https://github.com/${repository.full_name}/blob/${repository.default_branch || "main"}/README.md`} imageBaseUrl={`https://raw.githubusercontent.com/${repository.full_name}/${repository.default_branch || "main"}/README.md`} /></div> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("暂无 README", "No README")}</div>}
      </section>
    </div>
  </ResponsiveDialog>;
}
