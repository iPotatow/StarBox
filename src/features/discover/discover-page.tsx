import { RiExternalLinkLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { RepositoryCardSkeleton } from "../../components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { fetchDiscover, starRepository, unstarRepository } from "../../lib/api";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { PersistedState, Repository } from "../../types";

type Channel = "popular" | "active" | "fresh";
const channelFromQuery = (): Channel => { const value = readQueryParam("channel"); return value === "active" || value === "fresh" ? value : "popular"; };

export function DiscoverPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [channel, setChannel] = useState<Channel>(channelFromQuery);
  const [language, setLanguage] = useState(() => readQueryParam("language"));
  const [topic, setTopic] = useState(() => readQueryParam("topic"));
  const [days, setDays] = useState(() => readQueryNumber("days", 30));
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [results, setResults] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState("");
  const [error, setError] = useState("");
  const [unstarTarget, setUnstarTarget] = useState<Repository | null>(null);

  useEffect(() => { replaceQueryParams({ channel: channel === "popular" ? "" : channel, language, topic, days: days === 30 ? "" : days, q: query }); }, [channel, language, topic, days, query]);

  async function load() {
    if (!hasGithubCredential) return goToSettings();
    setLoading(true); setError("");
    try { const data = await fetchDiscover(token, channel, language.trim(), topic.trim(), days); setResults(data.repositories); notify("GitHub 查询完成", `已加载 ${data.repositories.length} 个仓库`, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Discover 加载失败"); }
    finally { setLoading(false); }
  }
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
  async function toggleStar(repo: Repository) {
    setMutating(repo.full_name); setError(""); const exists = state.repositories.some((item) => item.full_name === repo.full_name);
    try {
      if (exists) { await unstarRepository(token, repo.full_name); onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }); notify("已取消 Star", repo.full_name, "success"); }
      else { const starred = await starRepository(token, repo.full_name); onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] }); notify("已 Star", repo.full_name, "success"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Star 操作失败"); }
    finally { setMutating(""); }
  }
  async function confirmUnstar() { const repo = unstarTarget; if (!repo) return; setUnstarTarget(null); await toggleStar(repo); }
  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">Discover</h1><p className="mt-2 text-sm text-muted-foreground">Discover 使用 GitHub Search API 与普通文本筛选，不需要额外服务。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-6"><h1 className="text-xl font-semibold tracking-tight">Discover</h1><p className="mt-1 text-sm text-muted-foreground">远程 GitHub 查询与当前结果筛选彼此独立，修改查询条件后由你显式提交。</p></header>
    <StatusBanner error={error} />
    <form className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div className="text-xs font-semibold text-muted-foreground">GitHub 查询条件</div>
      <div className="flex flex-wrap items-center gap-2"><ToggleGroup value={[channel]} onValueChange={(values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh") setChannel(value); }}><ToggleGroupItem value="popular" className="w-auto px-3 text-xs">热门</ToggleGroupItem><ToggleGroupItem value="active" className="w-auto px-3 text-xs">活跃</ToggleGroupItem><ToggleGroupItem value="fresh" className="w-auto px-3 text-xs">新鲜</ToggleGroupItem></ToggleGroup><Input className="w-36" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="语言，如 rust" /><Input className="w-40" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" /><Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))}><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option><option value="365">1 年</option></Select><Button type="submit" loading={loading}><RiSearchLine className="size-4" />搜索 GitHub</Button></div>
    </form>
    <div className="mb-5 rounded-xl border border-border bg-secondary/30 p-3"><div className="mb-2 text-xs font-semibold text-muted-foreground">在当前结果中筛选仓库</div><div className="relative"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="仅筛选已经加载的结果，不重新请求 GitHub" /></div></div>
    {(initialLoading || loading) && !results.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <RepositoryCardSkeleton key={index} />)}</div> : <div className="grid gap-3 lg:grid-cols-2">{visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return <Card key={repo.full_name} render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><img src={repo.owner.avatar_url} alt="" className="size-10 rounded-lg" /><div className="min-w-0 flex-1"><a href={repo.html_url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">{repo.full_name}</a><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{repo.description || "暂无描述"}</p></div><Button size="sm" variant={starred ? "secondary" : "outline"} loading={mutating === repo.full_name} onClick={() => { if (starred) setUnstarTarget(repo); else void toggleStar(repo); }}>{starred ? <RiStarFill className="size-4" /> : <RiStarLine className="size-4" />}{starred ? "已 Star" : "Star"}</Button></div><div className="mt-3 flex flex-wrap gap-1.5">{repo.language ? <Badge>{repo.language}</Badge> : null}{repo.topics.slice(0, 5).map((topicName) => <Badge key={topicName}>{topicName}</Badge>)}</div><div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><RiStarFill className="size-3.5" />{repo.stargazers_count.toLocaleString()}</span><a href={repo.html_url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 hover:text-foreground"><RiExternalLinkLine className="size-3.5" />GitHub</a></div></Card>; })}</div>}
    {!visible.length && !loading && !initialLoading ? <div className="mt-6 grid min-h-56 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{results.length ? "当前结果中没有匹配项" : "尚未执行 GitHub 查询"}</div> : null}
    <AlertDialog open={Boolean(unstarTarget)} onOpenChange={(open) => { if (!open) setUnstarTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>取消 Star？</AlertDialogTitle><AlertDialogDescription>将从 GitHub 取消 Star：{unstarTarget?.full_name ?? "该仓库"}。此操作需要再次确认。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" onClick={() => void confirmUnstar()}>取消 Star</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
