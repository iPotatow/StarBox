import { RiExternalLinkLine, RiGitForkLine, RiStarFill } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { fetchRepositoryReadme } from "../../lib/api";
import type { Repository, RepositoryReadme } from "../../types";

function number(value?: number) { return new Intl.NumberFormat("zh-CN").format(value ?? 0); }

export function RepositoryDetail({ open, repository, token, credentialConnected, onClose }: { open: boolean; repository: Repository | null; token: string; credentialConnected?: boolean; onClose: () => void }) {
  const [readme, setReadme] = useState<RepositoryReadme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !repository || (!token.trim() && !credentialConnected)) { setReadme(null); setError(""); return; }
    let alive = true; setLoading(true); setError("");
    void fetchRepositoryReadme(token.trim(), repository.full_name)
      .then((value) => { if (alive) setReadme(value); })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "README 加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, repository?.full_name, token, credentialConnected]);
  if (!repository) return null;
  return (
    <Modal open={open} title={repository.full_name} description={repository.description || "仓库详情"} onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Stars</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiStarFill className="size-3.5" />{number(repository.stargazers_count)}</div></div>
          <div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Forks</div><div className="mt-1 flex items-center gap-1 text-sm font-semibold"><RiGitForkLine className="size-3.5" />{number(repository.forks_count)}</div></div>
          <div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Watchers</div><div className="mt-1 text-sm font-semibold">{number(repository.watchers_count)}</div></div>
          <div className="rounded-lg bg-secondary/55 p-3 text-xs"><div className="text-muted-foreground">Issues</div><div className="mt-1 text-sm font-semibold">{number(repository.open_issues_count)}</div></div>
        </div>
        <div className="flex flex-wrap gap-1.5">{repository.language ? <Badge>{repository.language}</Badge> : null}{repository.license ? <Badge>{repository.license}</Badge> : null}{repository.visibility ? <Badge>{repository.visibility}</Badge> : null}{repository.default_branch ? <Badge>{repository.default_branch}</Badge> : null}{repository.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div>
        <div className="flex flex-wrap gap-2">
          <a href={repository.html_url} target="_blank" rel="noreferrer"><Button variant="outline"><RiExternalLinkLine className="size-4" />GitHub</Button></a>
          {repository.homepage ? <a href={repository.homepage} target="_blank" rel="noreferrer"><Button variant="outline">Homepage</Button></a> : null}
          <a href={`https://deepwiki.com/${repository.full_name}`} target="_blank" rel="noreferrer"><Button variant="outline">DeepWiki</Button></a>
          <a href={`https://zread.ai/${repository.full_name}`} target="_blank" rel="noreferrer"><Button variant="outline">Zread</Button></a>
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">README</h3>{readme ? <a href={readme.htmlUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">GitHub 原文</a> : null}</div>
          {loading ? <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">正在加载 README…</div> : error ? <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">{error}</div> : readme ? <pre className="max-h-[48vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-6">{readme.content}</pre> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">暂无 README</div>}
        </section>
      </div>
    </Modal>
  );
}
