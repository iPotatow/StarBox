import { RiExternalLinkLine, RiRefreshLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { fetchDiscover, starRepository, unstarRepository } from "../../lib/api";
import type { PersistedState, Repository } from "../../types";

type Channel = "popular" | "active" | "fresh";
export function DiscoverPage({ state, onStateChange, goToSettings }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [channel, setChannel] = useState<Channel>("popular");
  const [language, setLanguage] = useState("");
  const [topic, setTopic] = useState("");
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() { if (!hasGithubCredential) return goToSettings(); setLoading(true); setError(""); setSuccess(""); try { const data = await fetchDiscover(token, channel, language.trim(), topic.trim(), days); setResults(data.repositories); setSuccess(`已加载 ${data.repositories.length} 个仓库`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Discover 加载失败"); } finally { setLoading(false); } }
  useEffect(() => { if (hasGithubCredential) void load(); }, [channel, days]);
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
  async function toggleStar(repo: Repository) {
    setMutating(repo.full_name); setError(""); const exists = state.repositories.some((item) => item.full_name === repo.full_name);
    try { if (exists) { await unstarRepository(token, repo.full_name); onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }); setSuccess(`已取消 Star：${repo.full_name}`); } else { const starred = await starRepository(token, repo.full_name); onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] }); setSuccess(`已 Star：${repo.full_name}`); } } catch (reason) { setError(reason instanceof Error ? reason.message : "Star 操作失败"); } finally { setMutating(""); }
  }
  if (!hasGithubCredential) return <div className="mx-auto max-w-4xl px-4 py-8"><h1 className="text-xl font-semibold">Discover</h1><p className="mt-2 text-sm text-muted-foreground">Discover 使用 GitHub Search API 与普通文本筛选，不需要额外服务。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6"><h1 className="text-xl font-semibold tracking-tight">Discover</h1><p className="mt-1 text-sm text-muted-foreground">基于 GitHub Search API 的轻量发现页：热门、活跃、新鲜仓库 + 普通文本筛选。</p></header>
      <StatusBanner error={error} success={!error ? success : ""} />
      <Card className="mb-5 flex-row flex-wrap gap-2 rounded-xl p-2 shadow-card"><Select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}><option value="popular">热门</option><option value="active">活跃</option><option value="fresh">新鲜</option></Select><Input className="w-36" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="语言，如 rust" /><Input className="w-40" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" /><Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))}><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option><option value="365">1 年</option></Select><Button onClick={() => void load()} loading={loading}><RiRefreshLine className="size-4" />刷新</Button><div className="relative min-w-[220px] flex-1"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在结果中进行文本搜索" /></div></Card>
      <div className="grid gap-3 lg:grid-cols-2">{visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return <Card key={repo.full_name} render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><img src={repo.owner.avatar_url} alt="" className="size-10 rounded-lg" /><div className="min-w-0 flex-1"><a href={repo.html_url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">{repo.full_name}</a><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{repo.description || "暂无描述"}</p></div><Button size="sm" variant={starred ? "secondary" : "outline"} loading={mutating === repo.full_name} onClick={() => void toggleStar(repo)}>{starred ? <RiStarFill className="size-4" /> : <RiStarLine className="size-4" />}{starred ? "已 Star" : "Star"}</Button></div><div className="mt-3 flex flex-wrap gap-1.5">{repo.language ? <Badge>{repo.language}</Badge> : null}{repo.topics.slice(0, 5).map((topicName) => <Badge key={topicName}>{topicName}</Badge>)}</div><div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><RiStarFill className="size-3.5" />{repo.stargazers_count.toLocaleString()}</span><span>{repo.forks_count.toLocaleString()} forks</span><a href={repo.html_url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 hover:text-foreground"><RiExternalLinkLine className="size-3.5" />GitHub</a></div></Card>; })}</div>
      {!visible.length && !loading ? <div className="mt-6 grid min-h-56 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">没有匹配的仓库</div> : null}
    </div>
  );
}
