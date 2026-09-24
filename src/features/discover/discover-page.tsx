import type { StateChange } from "../../types";
import { ArrowSquareOut as ExternalLinkIcon, Gear as SettingsIcon, MagnifyingGlass as SearchIcon, Star as StarIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { SkeletonReveal } from "../../components/spectrumui/skeleton-reveal";
import { Card } from "../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { FieldLabel, FieldRoot } from "../../components/ui/field";
import { FilterBar } from "../../components/patterns/filter-bar";
import { PageHeader, PageHeaderDescription, PageHeaderTitle } from "../../components/patterns/page-header";
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

export function DiscoverPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: StateChange; goToSettings: () => void; initialLoading?: boolean }) {
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
  const [preview, setPreview] = useState<Repository | null>(null);
  const [lastRequest, setLastRequest] = useState<{ channel: Channel; language: string; topic: string; days: number } | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(true);

  useEffect(() => { replaceQueryParams({ channel: channel === "popular" ? "" : channel, language, topic, days: days === 30 ? "" : days, q: query }); }, [channel, language, topic, days, query]);

  async function load() {
    if (!hasGithubCredential) return goToSettings();
    setLoading(true); setError("");
    try { const request = { channel, language: language.trim(), topic: topic.trim(), days }; const data = await fetchDiscover(token, request.channel, request.language, request.topic, request.days); setResults(data.repositories); setLastRequest(request); setSearchExpanded(false); notify(t("GitHub 查询完成", "GitHub search completed"), t(`已加载 ${data.repositories.length} 个仓库`, `Loaded ${data.repositories.length} repositories`), "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("Discover 加载失败", "Failed to load Discover")); }
    finally { setLoading(false); }
  }
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
  const queryDirty = Boolean(lastRequest && (lastRequest.channel !== channel || lastRequest.language !== language.trim() || lastRequest.topic !== topic.trim() || lastRequest.days !== days));
  async function toggleStar(repo: Repository) {
    setMutating(repo.full_name); setError(""); const exists = state.repositories.some((item) => item.full_name === repo.full_name);
    try {
      if (exists) { await unstarRepository(token, repo.full_name); onStateChange((current) => ({ ...current, repositories: current.repositories.filter((item) => item.full_name !== repo.full_name) })); notify(t("已取消 Star", "Unstarred"), repo.full_name, "success"); }
      else { const starred = await starRepository(token, repo.full_name); onStateChange((current) => ({ ...current, repositories: [starred, ...current.repositories.filter((item) => item.full_name !== starred.full_name)] })); notify(t("已 Star", "Starred"), repo.full_name, "success"); }
    } catch (reason) { notify(t("Star 操作失败", "Star action failed"), reason instanceof Error ? reason.message : repo.full_name, "error"); }
    finally { setMutating(""); }
  }
  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">Discover</h1><p className="mt-2 text-sm text-muted-foreground">{t("搜索 GitHub 上值得关注的仓库。", "Find GitHub repositories worth following.")}</p><Button className="mt-4" onClick={goToSettings}><SettingsIcon className="size-4" aria-hidden="true" />{t("打开设置", "Open Settings")}</Button></div>;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader layout="simple" className="mb-6"><PageHeaderTitle>Discover</PageHeaderTitle><PageHeaderDescription>{t("设置 GitHub 查询条件，结果加载后可在当前结果中筛选仓库。", "Set GitHub search criteria, then filter repositories in the current results.")}</PageHeaderDescription></PageHeader>
    <StatusBanner error={error} />
    {!lastRequest || searchExpanded ? <form className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div><p className="text-sm font-medium">{t("GitHub 查询", "GitHub search")}</p><p className="mt-1 text-xs text-muted-foreground">{t("这里的条件会重新请求 GitHub。", "These criteria run a new GitHub search.")}</p></div>
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <FieldRoot className="w-full gap-1 sm:w-auto">
          <FieldLabel className="text-xs text-muted-foreground">{t("排序", "Sort")}</FieldLabel>
          <ToggleGroup aria-label={t("GitHub 查询排序", "GitHub search sort")} value={[channel]} onValueChange={(values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh") setChannel(value); }}><ToggleGroupItem value="popular" className="w-auto px-3 text-xs">{t("热门", "Popular")}</ToggleGroupItem><ToggleGroupItem value="active" className="w-auto px-3 text-xs">{t("活跃", "Active")}</ToggleGroupItem><ToggleGroupItem value="fresh" className="w-auto px-3 text-xs">{t("新鲜", "Fresh")}</ToggleGroupItem></ToggleGroup>
        </FieldRoot>
        <FieldRoot className="w-full gap-1 sm:w-auto"><FieldLabel className="text-xs text-muted-foreground">{t("语言", "Language")}</FieldLabel><Input className="w-full text-foreground sm:w-36" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Any / rust" /></FieldRoot>
        <FieldRoot className="w-full gap-1 sm:w-auto"><FieldLabel className="text-xs text-muted-foreground">Topic</FieldLabel><Input className="w-full text-foreground sm:w-40" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Any / react" /></FieldRoot>
        <FieldRoot className="w-full gap-1 sm:w-auto"><FieldLabel className="text-xs text-muted-foreground">{t("时间范围", "Period")}</FieldLabel><Select aria-label={t("时间范围", "Period")} className="w-full text-foreground sm:w-auto" value={String(days)} onValueChange={(value) => setDays(Number(value))} items={[{ value: "7", label: t("7 天", "7 days") }, { value: "30", label: t("30 天", "30 days") }, { value: "90", label: t("90 天", "90 days") }, { value: "365", label: t("1 年", "1 year") }]} /></FieldRoot>
        <Button type="submit" loading={loading} className="w-full sm:w-auto"><SearchIcon className="size-4" aria-hidden="true" />{queryDirty ? t("重新搜索", "Search again") : t("搜索 GitHub", "Search GitHub")}</Button>
      </div>
      {lastRequest ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t("当前结果：", "Results: ")}{lastRequest.channel === "popular" ? t("热门", "Popular") : lastRequest.channel === "active" ? t("活跃", "Active") : t("新鲜", "Fresh")} · {lastRequest.language || t("全部语言", "All languages")} · {lastRequest.topic || t("全部 Topic", "All topics")} · {t(`${lastRequest.days} 天`, `${lastRequest.days} days`)}</span>{queryDirty ? <span className="rounded-md bg-warning/10 px-2 py-1 text-warning-foreground">{t("查询条件已修改", "Search criteria changed")}</span> : null}</div> : null}
    </form> : <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-card">
      <div className="min-w-0"><p className="text-sm font-medium">{t("当前 GitHub 查询", "Current GitHub search")}</p><p className="mt-1 truncate text-xs text-muted-foreground">{lastRequest.channel === "popular" ? t("热门", "Popular") : lastRequest.channel === "active" ? t("活跃", "Active") : t("新鲜", "Fresh")} · {lastRequest.language || t("全部语言", "All languages")} · {lastRequest.topic || t("全部 Topic", "All topics")} · {t(`${lastRequest.days} 天`, `${lastRequest.days} days`)}</p></div>
      <Button type="button" variant="outline" size="sm" onClick={() => setSearchExpanded(true)}>{t("修改条件", "Edit criteria")}</Button>
    </div>}
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{t("结果内筛选", "Filter loaded results")}</p><p className="mt-0.5 text-xs text-muted-foreground">{t("只筛选当前已经加载的结果，不会重新请求 GitHub。", "This only filters the loaded results and does not run another GitHub search.")}</p></div>{query ? <Button size="sm" variant="ghost" onClick={() => setQuery("")}>{t("清除", "Clear")}</Button> : null}</div>
    <FilterBar className="rounded-xl bg-secondary/30 p-2"><InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("筛选当前 GitHub 查询结果", "Filter current GitHub results")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("筛选已加载结果", "Filter loaded results")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></FilterBar>
    <SkeletonReveal loading={(initialLoading || loading) && !results.length} skeleton={<div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <RepositoryCardSkeleton key={index} variant="discover" />)}</div>}><div className="grid gap-3 lg:grid-cols-2">{visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return <Card key={repo.full_name} render={<article />} className="rounded-xl p-4 shadow-card"><div className="flex items-start gap-3"><Avatar className="size-10 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground" aria-hidden="true"><AvatarFallback className="rounded-lg bg-secondary">{repo.owner.login.slice(0, 1).toUpperCase()}</AvatarFallback><AvatarImage src={repo.owner.avatar_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="rounded-lg" /></Avatar><div className="min-w-0 flex-1"><Button variant="link" size="xs" className="h-auto min-h-0 max-w-full justify-start truncate px-0 py-0 text-left text-sm font-semibold" onClick={() => setPreview(repo)}>{repo.full_name}</Button><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{repo.description || t("暂无描述", "No description")}</p></div>{starred ? <HoldToConfirmButton size="sm" duration={1200} disabled={mutating === repo.full_name} label={t("按住取消 Star", "Hold to unstar")} confirmedLabel={t("已取消 Star", "Unstarred")} ariaLabel={t(`按住 1.2 秒取消 ${repo.full_name} 的 Star`, `Hold for 1.2 seconds to unstar ${repo.full_name}`)} icon={<StarIcon className="size-4 fill-current" aria-hidden="true" />} onConfirm={() => void toggleStar(repo)} /> : <Button size="sm" variant="outline" loading={mutating === repo.full_name} onClick={() => void toggleStar(repo)}><StarIcon className="size-4" aria-hidden="true" />Star</Button>}</div><div className="mt-3 flex flex-wrap gap-1.5">{repo.language ? <Badge>{repo.language}</Badge> : null}{repo.topics.slice(0, 5).map((topicName) => <Badge key={topicName}>{topicName}</Badge>)}{repo.topics.length > 5 ? <Badge variant="secondary">+{repo.topics.length - 5}</Badge> : null}</div><div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><StarIcon className="size-3.5 fill-current" aria-hidden="true" />{repo.stargazers_count.toLocaleString(locale)}</span><Button render={<a href={repo.html_url} target="_blank" rel="noreferrer" />} variant="ghost" size="sm" className="ml-auto"><ExternalLinkIcon className="size-3.5" aria-hidden="true" />GitHub</Button></div></Card>; })}</div></SkeletonReveal>
    {!visible.length && !loading && !initialLoading ? <Empty className="mt-6 min-h-56"><EmptyContent><EmptyIcon><SearchIcon className="size-5" aria-hidden="true" /></EmptyIcon><EmptyTitle>{results.length ? t("当前结果中没有匹配项", "No matches in current results") : lastRequest ? t("GitHub 查询没有结果", "No GitHub results") : t("尚未执行 GitHub 查询", "No GitHub search yet")}</EmptyTitle><EmptyDescription>{results.length ? t("调整本地筛选关键词，或重新查询 GitHub。", "Adjust the local filter or search GitHub again.") : lastRequest ? t("尝试其他语言、Topic 或更长的时间范围。", "Try another language, topic, or a longer period.") : t("设置查询条件后搜索 GitHub 仓库。", "Set search criteria, then search GitHub repositories.")}</EmptyDescription></EmptyContent></Empty> : null}
    <RepositoryDetail open={Boolean(preview)} repository={preview} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setPreview(null)} />
  </div>;
}
