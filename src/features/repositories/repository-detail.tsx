import { RiArrowLeftSLine, RiArrowRightSLine, RiExternalLinkLine, RiGitForkLine, RiMoreLine, RiRefreshLine, RiStarLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { MarkdownContent } from "../../components/ui/markdown-content";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../components/ui/menu";
import { Modal } from "../../components/ui/modal";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
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
  const [tab, setTab] = useState("overview");
  const [readme, setReadme] = useState<RepositoryReadme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const canLoad = Boolean(token.trim() || credentialConnected);

  const loadReadme = useCallback(async () => {
    if (!repository || !canLoad || loading) return;
    const id = ++requestId.current;
    setLoading(true); setError("");
    try { const result = await fetchRepositoryReadme(token.trim(), repository.full_name); if (id === requestId.current) setReadme(result); }
    catch (reason) { if (id === requestId.current) setError(reason instanceof Error ? reason.message : t("README 加载失败", "Failed to load README")); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [repository?.full_name, token, credentialConnected, loading]);

  useEffect(() => {
    requestId.current += 1;
    setTab("overview");
    setReadme(null);
    setError("");
    setLoading(false);
    return () => { requestId.current += 1; };
  }, [open, repository?.full_name]);

  if (!repository) return null;
  return <Modal open={open} title={repository.full_name} description={repository.description || t("仓库详情", "Repository details")} onClose={onClose} className="max-w-6xl">
    <Tabs value={tab} onValueChange={(value: string) => { setTab(value); if (value === "readme" && canLoad && !readme && !loading) void loadReadme(); }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TabsList><TabsTab value="overview">Overview</TabsTab><TabsTab value="readme">README</TabsTab></TabsList>
        {onPrevious || onNext ? <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={onPrevious} disabled={previousDisabled} aria-label={t("上一个仓库", "Previous repository")}><RiArrowLeftSLine className="size-4" /></Button><Button variant="ghost" size="icon-sm" onClick={onNext} disabled={nextDisabled} aria-label={t("下一个仓库", "Next repository")}><RiArrowRightSLine className="size-4" /></Button></div> : null}
      </div>
      <TabsPanel value="overview"><div className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Stars</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiStarLine className="size-3.5" />{number(repository.stargazers_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Forks</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiGitForkLine className="size-3.5" />{number(repository.forks_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Watchers</div><div className="mt-1 text-sm font-semibold">{number(repository.watchers_count, locale)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Issues</div><div className="mt-1 text-sm font-semibold">{number(repository.open_issues_count, locale)}</div></div></div>
        <div className="flex flex-wrap gap-1.5">{repository.language ? <Badge>{repository.language}</Badge> : null}{repository.license ? <Badge>{repository.license}</Badge> : null}{repository.visibility ? <Badge>{repository.visibility}</Badge> : null}{repository.default_branch ? <Badge>{repository.default_branch}</Badge> : null}{repository.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div>
        <div className="flex flex-wrap gap-2">
          <Button render={<a href={repository.html_url} target="_blank" rel="noreferrer" />} variant="outline"><RiExternalLinkLine className="size-4" />GitHub</Button>
          {repository.homepage ? <Button render={<a href={repository.homepage} target="_blank" rel="noreferrer" />} variant="outline">Homepage</Button> : null}
          <Menu><MenuTrigger render={<Button variant="outline" />}><RiMoreLine className="size-4" />{t("更多", "More")}</MenuTrigger><MenuPopup><MenuItem render={<a href={`https://deepwiki.com/${repository.full_name}`} target="_blank" rel="noreferrer" />}>DeepWiki</MenuItem><MenuItem render={<a href={`https://zread.ai/${repository.full_name}`} target="_blank" rel="noreferrer" />}>Zread</MenuItem></MenuPopup></Menu>
        </div>
      </div></TabsPanel>
      <TabsPanel value="readme"><section>{!canLoad ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("连接 GitHub 凭据后可加载 README。", "Connect GitHub credentials to load the README.")}</div> : loading ? <div className="grid gap-2 rounded-xl border border-border p-5"><Skeleton className="h-4 w-1/3" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div> : error ? <div className="rounded-xl border border-border p-5 text-sm"><p className="text-destructive-foreground">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void loadReadme()}><RiRefreshLine className="size-4" />{t("重试", "Retry")}</Button></div> : readme ? <><div className="mb-3 flex justify-end"><Button render={<a href={readme.htmlUrl} target="_blank" rel="noreferrer" />} size="sm" variant="ghost">{t("GitHub 原文", "View on GitHub")}</Button></div><div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-secondary/20 p-5 sm:p-6"><MarkdownContent content={readme.content} linkBaseUrl={`https://github.com/${repository.full_name}/blob/${repository.default_branch || "main"}/README.md`} imageBaseUrl={`https://raw.githubusercontent.com/${repository.full_name}/${repository.default_branch || "main"}/README.md`} /></div></> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("暂无 README", "No README")}</div>}</section></TabsPanel>
    </Tabs>
  </Modal>;
}
