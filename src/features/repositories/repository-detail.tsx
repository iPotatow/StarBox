import { GitFork as GitForkIcon, Star as StarIcon } from "@phosphor-icons/react";
import { ArrowSquareOut as ExternalLinkIcon, ArrowsClockwise as RefreshCwIcon, List as MenuIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../components/ui/menu";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { fetchRepositoryReadme } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { Repository, RepositoryReadme, RepositoryReadmeLanguage } from "../../types";

function number(value: number | undefined, locale: string) { return new Intl.NumberFormat(locale).format(value ?? 0); }
function encodePath(value: string) { return value.split("/").map(encodeURIComponent).join("/"); }

export function RepositoryDetail({ open, repository, token, credentialConnected, onClose }: {
  open: boolean;
  repository: Repository | null;
  token: string;
  credentialConnected?: boolean;
  onClose: () => void;
}) {
  const { t, locale, language } = useI18n();
  const [readme, setReadme] = useState<RepositoryReadme | null>(null);
  const [readmeLanguageChoice, setReadmeLanguageChoice] = useState<{ repository: string; language: RepositoryReadmeLanguage } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const readmeCache = useRef(new Map<string, RepositoryReadme>());
  const canLoad = Boolean(token.trim() || credentialConnected);
  const requestedReadmeLanguage: RepositoryReadmeLanguage = readmeLanguageChoice && readmeLanguageChoice.repository === repository?.full_name ? readmeLanguageChoice.language : language;

  const loadReadme = useCallback(async (force = false) => {
    if (!repository || !canLoad) return;
    const fullName = repository.full_name;
    const cacheKey = `${fullName}:${requestedReadmeLanguage}`;
    const cached = readmeCache.current.get(cacheKey);
    if (cached && !force) { setReadme(cached); setError(""); return; }
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = await fetchRepositoryReadme(token.trim(), fullName, requestedReadmeLanguage, controller.signal);
      if (id === requestId.current) {
        readmeCache.current.set(cacheKey, result);
        readmeCache.current.set(`${fullName}:${result.language}`, result);
        setReadme(result);
      }
    } catch (reason) {
      if (id === requestId.current && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : t("README 加载失败", "Failed to load README"));
    } finally {
      if (id === requestId.current) setLoading(false);
      if (requestAbort.current === controller) requestAbort.current = null;
    }
  }, [repository?.full_name, token, requestedReadmeLanguage, canLoad, t]);

  useEffect(() => {
    requestAbort.current?.abort();
    requestAbort.current = null;
    requestId.current += 1;
    const cacheKey = repository ? `${repository.full_name}:${requestedReadmeLanguage}` : "";
    setReadme(cacheKey ? readmeCache.current.get(cacheKey) ?? null : null);
    setError("");
    setLoading(false);
    return () => { requestAbort.current?.abort(); requestId.current += 1; };
  }, [open, repository?.full_name, requestedReadmeLanguage]);

  useEffect(() => {
    if (open && repository && canLoad && !readme && !loading) void loadReadme();
  }, [open, repository?.full_name, canLoad, readme, loading, loadReadme]);

  if (!repository) return null;
  const languageItems = readme?.availableLanguages.map((item) => ({
    value: item.language,
    label: item.language === "zh-CN" ? "中文" : item.language === "en" ? "English" : t("默认 README", "Default README"),
  })) ?? [];
  const branchPath = encodePath(repository.default_branch || "main");
  const readmePath = readme?.path ? encodePath(readme.path) : "README.md";
  return <ResponsiveDialog open={open} title={repository.full_name} description={repository.description || t("仓库详情", "Repository details")} onClose={onClose} className="sm:h-[88vh] sm:max-w-7xl">
    <div className="grid gap-6">
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="repository-readme-heading" className="text-sm font-semibold">README</h2>
          <div className="flex items-center gap-2">
            {readme && languageItems.length > 1 ? <Select aria-label={t("README 语言", "README language")} value={readme.language} onValueChange={(value) => setReadmeLanguageChoice({ repository: repository.full_name, language: value as RepositoryReadmeLanguage })} className="min-w-32" items={languageItems} /> : null}
            {readme ? <Button render={<a href={readme.htmlUrl} target="_blank" rel="noreferrer" />} size="sm" variant="ghost">{t("GitHub 原文", "View on GitHub")}</Button> : null}
          </div>
        </div>
        {!canLoad ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("连接 GitHub 凭据后可加载 README。", "Connect GitHub credentials to load the README.")}</div> : loading ? <div className="grid gap-2 rounded-xl border border-border p-5"><Skeleton className="h-4 w-1/3" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div> : error ? <div className="rounded-xl border border-border p-5 text-sm"><p className="text-destructive-foreground">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void loadReadme(true)}><RefreshCwIcon className="size-4" />{t("重试", "Retry")}</Button></div> : readme?.content ? <div className="rounded-xl border border-border bg-secondary/20 p-5 sm:p-7"><MarkdownContent content={readme.content} linkBaseUrl={`https://github.com/${repository.full_name}/blob/${branchPath}/${readmePath}`} imageBaseUrl={`https://raw.githubusercontent.com/${repository.full_name}/${branchPath}/${readmePath}`} /></div> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("暂无 README", "No README")}</div>}
      </section>
    </div>
  </ResponsiveDialog>;
}
