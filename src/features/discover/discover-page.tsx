import { RiExternalLinkLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
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
import { useI18n } from "../../lib/i18n";
import type { PersistedState, Repository } from "../../types";

type Channel = "popular" | "active" | "fresh";
const channelFromQuery = (): Channel => { const value = readQueryParam("channel"); return value === "active" || value === "fresh" ? value : "popular"; };

export function DiscoverPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean }) {
  const { t, locale } = useI18n();
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
    try { const request = { channel, language: language.trim(), topic: topic.trim(), days }; const data = await fetchDiscover(token, request.channel, request.language, request.topic, request.days); setResults(data.repositories); setLastRequest(request); notify(t("GitHub 查询完成", "GitHub search completed"), t(`已加载 ${data.repositories.length} 个仓库`, `Loaded ${data.repositories.length} repositories`), "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("Discover 加载失败", "Failed to load Discover")); }
    finally { setLoading(false); }
  }
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
  const queryDirty = Boolean(lastRequest && (lastRequest.channel !== channel || lastRequest.language !== language.trim() || lastRequest.topic !== topic.trim() || lastRequest.days !== days));
  async function toggleStar(repo: Repository) {
    setMutating(repo.full_name); setError(""); const exists = state.repositories.some((item) => item.full_name === repo.full_name);
    try {
      if (exists) { await unstarRepository(token, repo.full_name); onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }); notify(t("已取消 Star", "Unstarred"), repo.full_name, "success"); }
      else { const starred = await starRepository(token, repo.full_name); onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] }); notify(t("已 Star", "Starred"), repo.full_name, "success"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Star 操作失败", "Star action failed")); }
    finally { setMutating(""); }
  }
  async function confirmUnstar() { const repo = unstarTarget; if (!repo) return; setUnstarTarget(null); await toggleStar(repo); }
  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">Discover</h1><p className="mt-2 text-sm text-muted-foreground">{t("搜索 GitHub 上值得关注的仓库。", "Find GitHub repositories worth following.")}</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" aria-hidden="true" />{t("打开设置", "Open Settings")}</Button></div>;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-6"><h1 className="text-xl font-semibold tracking-tight">Discover</h1><p className="mt-1 text-sm text-muted-foreground">{t("设置 GitHub 查询条件，结果加载后可在当前结果中筛选仓库。", "Set GitHub search criteria, then filter repositories in the current results.")}</p></header>
    <StatusBanner error={error} />
    <form className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div className="flex flex-wrap items-end gap-3"><div className="grid gap-1"><span className="text-xs text-muted-foreground">{t("排序", "Sort")}</span><ToggleGroup value={[channel]} onValueChange={(values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh") setChannel(value); }}><ToggleGroupItem value="popular" className="w-auto px-3 text-xs">{t("热门", "Popular")}</ToggleGroupItem><ToggleGroupItem value="active" className="w-auto px-3 text-xs">{t("活跃", "Active")}</ToggleGroupItem><ToggleGroupItem value="fresh" className="w-auto px-3 text-xs">{t("新鲜", "Fresh")}</ToggleGroupItem></ToggleGroup></div><label className="grid gap-1 text-xs text-muted-foreground">Language<Input aria-label="Language" className="w-36 text-foreground" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Any / rust" /></label><label className="grid gap-1 text-xs text-muted-foreground">Topic<Input aria-label="Topic" className="w-40 text-foreground" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Any / react" /></label><label className="grid gap-1 text-xs text-muted-foreground">Period<Select aria-label="Period" className="text-foreground" value={String(days)} onValueChange={(value) => setDays(Number(value))} items={[{ value: "7", label: t("7 天", "7 days") }, { value: "30", label: t("30 天", "30 days") }, { value: "90", label: t("90 天", "90 days") }, { value: "365", label: t("1 年", "1 year") }]} /></label><Button type="submit" loading={loading}><RiSearchLine className="size-4" aria-hidden="true" />{queryDirty ? t("重新搜索", "Search again") : t("搜索 GitHub", "Search GitHub")}</Button></div>{lastRequest ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t("当前结果：", "Results: ")}{lastRequest.channel === "popular" ? t("热门", "Popular") : lastRequest.channel === "active" ? t("活跃", "Active") : t("新鲜", "Fresh")} · {lastRequest.language || t("全部语言", "All languages")} · {lastRequest.topic || t("全部 Topic", "All topics")} · {t(`${lastRequest.days} 天`, `${lastRequest.days} days`)}</span>{queryDirty ? <span className="rounded-md bg-warning/10 px-2 py-1 text-warning-foreground">{t("查询条件已修改", "Search criteria changed")}</span> : null}</div> : null}
    </form>
    <div className="mb-5 rounded-xl bg-secondary/30 p-2"><InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("筛选当前 GitHub 查询结果", "Filter current GitHub results")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("筛选已加载结果", "Filter loaded results")} /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></div>
    {(initialLoading || loading) && !results.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <RepositoryCardSkeleton key={index} />)}</div> : <div className="grid gap-3 lg:grid-cols-2">{visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return <Card key={repo.full_name} render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><Avatar className="size-10 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground" aria-hidden="true"><AvatarFallback className="rounded-lg bg-secondary">{repo.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repo.owner.avatar_url} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" className="rounded-lg" /></Avatar><div className="min-w-0 flex-1"><Button variant="link" size="none" className="max-w-full truncate text-left text-sm font-semibold" onClick={() => setPreview(repo)}>{repo.full_name}</Button><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{repo.description || t("暂无描述", "No description")}</p></div><Button size="sm" variant={starred ? "secondary" : "outline"} loading={mutating === repo.full_name} onClick={() => { if (starred) setUnstarTarget(repo); else void toggleStar(repo); }}>{starred ? <RiStarFill className="size-4" aria-hidden="true" /> : <RiStarLine className="size-4" aria-hidden="true" />}{starred ? t("取消 Star", "Unstar") : "Star"}</Button></div><div className="mt-3 flex flex-wrap gap-1.5">{repo.language ? <Badge>{repo.language}</Badge> : null}{repo.topics.slice(0, 5).map((topicName) => <Badge key={topicName}>{topicName}</Badge>)}{repo.topics.length > 5 ? <Badge variant="secondary">+{repo.topics.length - 5}</Badge> : null}</div><div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><RiStarFill className="size-3.5" aria-hidden="true" />{repo.stargazers_count.toLocaleString(locale)}</span><Button render={<a href={repo.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="sm" className="ml-auto"><RiExternalLinkLine className="size-3.5" aria-hidden="true" />GitHub</Button></div></Card>; })}</div>}
    {!visible.length && !loading && !initialLoading ? <Empty className="mt-6 min-h-56"><EmptyContent><EmptyIcon><RiSearchLine className="size-5" aria-hidden="true" /></EmptyIcon><EmptyTitle>{results.length ? t("当前结果中没有匹配项", "No matches in current results") : t("尚未执行 GitHub 查询", "No GitHub search yet")}</EmptyTitle><EmptyDescription>{results.length ? t("调整本地筛选关键词，或重新查询 GitHub。", "Adjust the local filter or search GitHub again.") : t("设置查询条件后搜索 GitHub 仓库。", "Set search criteria, then search GitHub repositories.")}</EmptyDescription></EmptyContent></Empty> : null}
    <RepositoryDetail open={Boolean(preview)} repository={preview} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setPreview(null)} />
    <AlertDialog open={Boolean(unstarTarget)} onOpenChange={(open) => { if (!open) setUnstarTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("取消 Star？", "Unstar repository?")}</AlertDialogTitle><AlertDialogDescription>{t(`将从 GitHub 取消 Star：${unstarTarget?.full_name ?? "该仓库"}。此操作需要再次确认。`, `This will unstar ${unstarTarget?.full_name ?? "this repository"} on GitHub. Please confirm.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => void confirmUnstar()}>{t("取消 Star", "Unstar")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
