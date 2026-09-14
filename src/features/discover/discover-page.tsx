import { RiExternalLinkLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { RepositoryDetail } from "../repositories/repository-detail";
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
  const [preview, setPreview] = useState<Repository | null>(null);
  const [lastRequest, setLastRequest] = useState<{ channel: Channel; language: string; topic: string; days: number } | null>(null);

  useEffect(() => { replaceQueryParams({ channel: channel === "popular" ? "" : channel, language, topic, days: days === 30 ? "" : days, q: query }); }, [channel, language, topic, days, query]);

  async function load() {
    if (!hasGithubCredential) return goToSettings();
    setLoading(true); setError("");
    try { const request = { channel, language: language.trim(), topic: topic.trim(), days }; const data = await fetchDiscover(token, request.channel, request.language, request.topic, request.days); setResults(data.repositories); setLastRequest(request); notify("GitHub 查询完成", `已加载 ${data.repositories.length} 个仓库`, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Discover 加载失败"); }
    finally { setLoading(false); }
  }
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
  const queryDirty = Boolean(lastRequest && (lastRequest.channel !== channel || lastRequest.language !== language.trim() || lastRequest.topic !== topic.trim() || lastRequest.days !== days));
  async function toggleStar(repo: Repository) {
    setMutating(repo.full_name); setError(""); const exists = state.repositories.some((item) => item.full_name === repo.full_name);
    try {
      if (exists) { await unstarRepository(token, repo.full_name); onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }); notify("已取消 Star", repo.full_name, "success"); }
      else { const starred = await starRepository(token, repo.full_name); onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] }); notify("已 Star", repo.full_name, "success"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Star 操作失败"); }
    finally { setMutating(""); }
  }
  async function confirmUnstar() { const repo = unstarTarget; if (!repo) return; setUnstarTarget(null); await toggleStar(repo); }
  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">Discover</h1><p className="mt-2 text-sm text-muted-foreground">搜索 GitHub 上值得关注的仓库。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-6"><h1 className="text-xl font-semibold tracking-tight">Discover</h1><p className="mt-1 text-sm text-muted-foreground">远程 GitHub 查询与当前结果筛选彼此独立，修改查询条件后由你显式提交。</p></header>
    <StatusBanner error={error} />
    <form className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div className="text-xs font-semibold text-muted-foreground">GitHub 查询条件</div>
      <div className="flex flex-wrap items-end gap-3"><div className="grid gap-1"><span className="text-xs text-muted-foreground">排序</span><ToggleGroup value={[channel]} onValueChange={(values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh") setChannel(value); }}><ToggleGroupItem value="popular" className="w-auto px-3 text-xs">热门</ToggleGroupItem><ToggleGroupItem value="active" className="w-auto px-3 text-xs">活跃</ToggleGroupItem><ToggleGroupItem value="fresh" className="w-auto px-3 text-xs">新鲜</ToggleGroupItem></ToggleGroup></div><label className="grid gap-1 text-xs text-muted-foreground">Language<Input aria-label="Language" className="w-36 text-foreground" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Any / rust" /></label><label className="grid gap-1 text-xs text-muted-foreground">Topic<Input aria-label="Topic" className="w-40 text-foreground" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Any / react" /></label><label className="grid gap-1 text-xs text-muted-foreground">Period<Select aria-label="Period" className="text-foreground" value={String(days)} onChange={(event) => setDays(Number(event.target.value))}><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option><option value="365">1 年</option></Select></label><Button type="submit" loading={loading}><RiSearchLine className="size-4" />{queryDirty ? "重新搜索" : "搜索 GitHub"}</Button></div>{lastRequest ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>当前结果：{lastRequest.channel === "popular" ? "热门" : lastRequest.channel === "active" ? "活跃" : "新鲜"} · {lastRequest.language || "全部语言"} · {lastRequest.topic || "全部 Topic"} · {lastRequest.days} 天</span>{queryDirty ? <span className="rounded-md bg-warning/10 px-2 py-1 text-warning-foreground">查询条件已修改</span> : null}</div> : null}
    </form>
    <div className="mb-5 rounded-xl border border-border bg-secondary/30 p-3"><div className="mb-2 text-xs font-semibold text-muted-foreground">在当前结果中筛选仓库</div><InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label="筛选当前 GitHub 查询结果" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="仅筛选已经加载的结果，不重新请求 GitHub" /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></div>
    {(initialLoading || loading) && !results.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <RepositoryCardSkeleton key={index} />)}</div> : <div className="grid gap-3 lg:grid-cols-2">{visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return <Card key={repo.full_name} render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><img src={repo.owner.avatar_url} alt="" className="size-10 rounded-lg" /><div className="min-w-0 flex-1"><Button variant="link" size="none" className="max-w-full truncate text-left text-sm font-semibold" onClick={() => setPreview(repo)}>{repo.full_name}</Button><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{repo.description || "暂无描述"}</p></div><Button size="sm" variant={starred ? "secondary" : "outline"} loading={mutating === repo.full_name} onClick={() => { if (starred) setUnstarTarget(repo); else void toggleStar(repo); }}>{starred ? <RiStarFill className="size-4" /> : <RiStarLine className="size-4" />}{starred ? "取消 Star" : "Star"}</Button></div><div className="mt-3 flex flex-wrap gap-1.5">{repo.language ? <Badge>{repo.language}</Badge> : null}{repo.topics.slice(0, 5).map((topicName) => <Badge key={topicName}>{topicName}</Badge>)}{repo.topics.length > 5 ? <Badge variant="secondary">+{repo.topics.length - 5}</Badge> : null}</div><div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><RiStarFill className="size-3.5" />{repo.stargazers_count.toLocaleString()}</span><Button render={<a href={repo.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="sm" className="ml-auto"><RiExternalLinkLine className="size-3.5" />GitHub</Button></div></Card>; })}</div>}
    {!visible.length && !loading && !initialLoading ? <Empty className="mt-6 min-h-56"><EmptyContent><EmptyIcon><RiSearchLine className="size-5" /></EmptyIcon><EmptyTitle>{results.length ? "当前结果中没有匹配项" : "尚未执行 GitHub 查询"}</EmptyTitle><EmptyDescription>{results.length ? "调整本地筛选关键词，或重新查询 GitHub。" : "设置查询条件后搜索 GitHub 仓库。"}</EmptyDescription></EmptyContent></Empty> : null}
    <RepositoryDetail open={Boolean(preview)} repository={preview} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setPreview(null)} />
    <AlertDialog open={Boolean(unstarTarget)} onOpenChange={(open) => { if (!open) setUnstarTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>取消 Star？</AlertDialogTitle><AlertDialogDescription>将从 GitHub 取消 Star：{unstarTarget?.full_name ?? "该仓库"}。此操作需要再次确认。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" onClick={() => void confirmUnstar()}>取消 Star</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
