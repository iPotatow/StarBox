import { RiExternalLinkLine, RiGitForkLine, RiRefreshLine, RiStarFill } from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
import { fetchRepositoryReadme } from "../../lib/api";
import type { Repository, RepositoryReadme } from "../../types";

function number(value?: number) { return new Intl.NumberFormat("zh-CN").format(value ?? 0); }

export function RepositoryDetail({ open, repository, token, credentialConnected, onClose }: { open: boolean; repository: Repository | null; token: string; credentialConnected?: boolean; onClose: () => void }) {
  const [readme, setReadme] = useState<RepositoryReadme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canLoad = Boolean(token.trim() || credentialConnected);
  const loadReadme = useCallback(async () => {
    if (!repository || !canLoad) return;
    setLoading(true); setError("");
    try { setReadme(await fetchRepositoryReadme(token.trim(), repository.full_name)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "README 加载失败"); }
    finally { setLoading(false); }
  }, [repository?.full_name, token, credentialConnected]);
  useEffect(() => { if (!open || !repository) { setReadme(null); setError(""); return; } if (canLoad) void loadReadme(); }, [open, repository?.full_name]);
  if (!repository) return null;
  return <Modal open={open} title={repository.full_name} description={repository.description || "仓库详情"} onClose={onClose} className="max-w-3xl">
    <Tabs defaultValue="overview">
      <TabsList className="mb-4"><TabsTab value="overview">Overview</TabsTab><TabsTab value="readme">README</TabsTab></TabsList>
      <TabsPanel value="overview"><div className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Stars</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiStarFill className="size-3.5" />{number(repository.stargazers_count)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Forks</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiGitForkLine className="size-3.5" />{number(repository.forks_count)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Watchers</div><div className="mt-1 text-sm font-semibold">{number(repository.watchers_count)}</div></div><div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Issues</div><div className="mt-1 text-sm font-semibold">{number(repository.open_issues_count)}</div></div></div>
        <div className="flex flex-wrap gap-1.5">{repository.language ? <Badge>{repository.language}</Badge> : null}{repository.license ? <Badge>{repository.license}</Badge> : null}{repository.visibility ? <Badge>{repository.visibility}</Badge> : null}{repository.default_branch ? <Badge>{repository.default_branch}</Badge> : null}{repository.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div>
        <div className="flex flex-wrap gap-2"><a href={repository.html_url} target="_blank" rel="noreferrer"><Button variant="outline"><RiExternalLinkLine className="size-4" />GitHub</Button></a>{repository.homepage ? <a href={repository.homepage} target="_blank" rel="noreferrer"><Button variant="outline">Homepage</Button></a> : null}<a href={`https://deepwiki.com/${repository.full_name}`} target="_blank" rel="noreferrer"><Button variant="outline">DeepWiki</Button></a><a href={`https://zread.ai/${repository.full_name}`} target="_blank" rel="noreferrer"><Button variant="outline">Zread</Button></a></div>
      </div></TabsPanel>
      <TabsPanel value="readme"><section>{!canLoad ? <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">连接 GitHub 凭据后可加载 README。</div> : loading ? <div className="grid gap-2 rounded-xl border border-border p-5"><Skeleton className="h-4 w-1/3" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div> : error ? <div className="rounded-xl border border-border p-5 text-sm"><p className="text-destructive-foreground">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void loadReadme()}><RiRefreshLine className="size-4" />重试</Button></div> : readme ? <><div className="mb-2 flex justify-end"><a href={readme.htmlUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">GitHub 原文</a></div><pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-6">{readme.content}</pre></> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">暂无 README</div>}</section></TabsPanel>
    </Tabs>
  </Modal>;
}
