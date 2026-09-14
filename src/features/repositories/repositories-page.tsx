import {
  RiArrowDownLine,
  RiCloseLine,
  RiMagicLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiStarLine,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../components/ui/menu";
import { Select } from "../../components/ui/select";
import { RepositoryCardSkeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { batchStarAction, organizeRepository, refreshCanonicalState, unstarRepository } from "../../lib/api";
import { cn } from "../../lib/cn";
import { runOptimisticMutation } from "../../lib/mutations";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import { emptyMeta } from "../../lib/storage";
import type { CategoryDefinition, PersistedState, Repository, RepositoryMeta } from "../../types";
import { RepositoryCard } from "./repository-card";
import { RepositoryDetail } from "./repository-detail";
import { RepositoryEditor } from "./repository-editor";

type SortMode = "starred" | "active" | "stars";
type SortDirection = "asc" | "desc";
export function RepositoriesPage({
  state, onStateChange, onSync, syncing, syncError, syncWarning, syncSuccess, goToSettings, loading = false,
}: {
  state: PersistedState; onStateChange: (next: PersistedState) => void; onSync: () => void; syncing: boolean; syncError: string; syncWarning: string; syncSuccess: string;
  goToSettings: (tab?: string) => void; loading?: boolean;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [language, setLanguage] = useState(() => readQueryParam("language"));
  const [category, setCategory] = useState(() => readQueryParam("category"));
  const [sort, setSort] = useState<SortMode>(() => { const value = readQueryParam("sort"); return value === "stars" ? "stars" : value === "active" || value === "updated" ? "active" : "starred"; });
  const [direction, setDirection] = useState<SortDirection>(() => readQueryParam("direction") === "asc" ? "asc" : "desc");
  const [editing, setEditing] = useState<Repository | null>(null);
  const [details, setDetails] = useState<Repository | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiBatchRunning, setAiBatchRunning] = useState(false);
  const [aiBatchPaused, setAiBatchPaused] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState({ done: 0, total: 0 });
  const aiPauseRef = useRef(false);
  const aiStopRef = useRef(false);
  const [aiBatchFailures, setAiBatchFailures] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mutating, setMutating] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState("");
  const [batchUnstarOpen, setBatchUnstarOpen] = useState(false);
  const [unstarTarget, setUnstarTarget] = useState<Repository | null>(null);

  useEffect(() => { replaceQueryParams({ q: query, language, category, list: "", status: "", sort: sort === "starred" ? "" : sort, direction: direction === "desc" ? "" : direction, view: "" }); }, [query, language, category, sort, direction]);

  const metaFor = (repo: Repository) => state.repositoryMeta[repo.full_name] ?? emptyMeta();
  const sortedCategories = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
  const languages = useMemo(() => Array.from(new Set(state.repositories.map((repo) => repo.language).filter(Boolean) as string[])).sort(), [state.repositories]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = state.repositories.filter((repo) => {
      const meta = state.repositoryMeta[repo.full_name] ?? emptyMeta();
      const haystack = [repo.full_name, repo.description, repo.language, ...repo.topics, meta.category, meta.note, meta.aiSummary, ...meta.aiTags].filter(Boolean).join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!language || repo.language === language) && (!category || (category === "__uncategorized" ? !meta.category : meta.category === category));
    });
    return next.sort((a, b) => {
      const delta = sort === "stars"
        ? a.stargazers_count - b.stargazers_count
        : sort === "active"
          ? new Date(a.pushed_at || a.updated_at).getTime() - new Date(b.pushed_at || b.updated_at).getTime()
          : new Date(a.starred_at || 0).getTime() - new Date(b.starred_at || 0).getTime();
      return direction === "desc" ? -delta : delta;
    });
  }, [state.repositories, state.repositoryMeta, query, language, category, sort, direction]);

  const visibleSelected = useMemo(() => filtered.reduce((count, repo) => count + Number(selected.has(repo.full_name)), 0), [filtered, selected]);
  const detailIndex = details ? filtered.findIndex((repo) => repo.full_name === details.full_name) : -1;
  const aiEnabled = Boolean(state.settings.ai.baseUrl && (state.settings.ai.apiKey || state.settings.ai.credentialConfigured) && state.settings.ai.model);
  const hasGithubCredential = Boolean(state.settings.githubToken.trim() || state.settings.credentialConnected);
  function feedback(error = "", success = "") { setActionError(error); if (success) notify(success, "", "success"); }
  function ensureCategory(categories: CategoryDefinition[], name: string) { if (!name.trim() || categories.some((item) => item.name === name.trim())) return categories; return [...categories, { id: `cat-${Date.now()}-${categories.length}`, name: name.trim(), color: "neutral", order: categories.length, locked: false }]; }
  async function updateMeta(repo: Repository, meta: RepositoryMeta) { try { const categoryId = state.categories.find((item) => item.name === meta.category)?.id ?? ""; await runOptimisticMutation(state, { ...state, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: meta } }, onStateChange, { operation: "repository_meta.update", payload: { fullName: repo.full_name, categoryId, note: meta.note, aiSummary: meta.aiSummary, aiTags: meta.aiTags } }); feedback("", t("仓库信息已保存", "Repository details saved")); return true; } catch (error) { feedback(error instanceof Error ? error.message : t("仓库信息保存失败", "Failed to save repository details")); return false; } }
  async function runAi(repo: Repository) { setAiLoading(repo.full_name); feedback(); try { const result = await organizeRepository(state.settings.ai, repo); const current = metaFor(repo); const locked = state.categories.some((item) => item.name === current.category && item.locked); const nextCategory = locked ? current.category : result.category; const nextCategories = ensureCategory(state.categories, nextCategory); const categoryDefinition = nextCategories.find((item) => item.name === nextCategory); const nextMeta = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags }; await runOptimisticMutation(state, { ...state, categories: nextCategories, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: nextMeta } }, onStateChange, { operation: "repository_meta.ai", payload: { fullName: repo.full_name, categoryId: categoryDefinition?.id ?? "", category: categoryDefinition ? { id: categoryDefinition.id, name: categoryDefinition.name, color: categoryDefinition.color, sortOrder: categoryDefinition.order, locked: categoryDefinition.locked } : undefined, note: nextMeta.note, aiSummary: nextMeta.aiSummary, aiTags: nextMeta.aiTags } }); feedback("", t(`${repo.full_name} 已完成 AI 分析`, `${repo.full_name} AI analysis completed`)); } catch (error) { feedback(error instanceof Error ? error.message : t("AI 分析失败", "AI analysis failed")); } finally { setAiLoading(null); } }
  async function runAiBatch(requestedNames?: string[]) {
    const names = requestedNames ?? Array.from(selected);
    if (!names.length || !aiEnabled || aiBatchRunning) return;
    setAiBatchRunning(true); setAiBatchPaused(false); setAiBatchFailures([]); aiPauseRef.current = false; aiStopRef.current = false;
    setAiBatchProgress({ done: 0, total: names.length }); feedback();
    let nextMeta = { ...state.repositoryMeta }; let nextCategories = [...state.categories]; const failedNames: string[] = []; const completedNames: string[] = [];
    for (let index = 0; index < names.length; index += 1) {
      while (aiPauseRef.current && !aiStopRef.current) await new Promise((resolve) => setTimeout(resolve, 200));
      if (aiStopRef.current) break;
      const repo = state.repositories.find((item) => item.full_name === names[index]);
      if (!repo) { failedNames.push(names[index]); continue; }
      try {
        const result = await organizeRepository(state.settings.ai, repo);
        const current = nextMeta[repo.full_name] ?? emptyMeta();
        const locked = nextCategories.some((item) => item.name === current.category && item.locked);
        const nextCategory = locked ? current.category : result.category;
        nextCategories = ensureCategory(nextCategories, nextCategory);
        nextMeta[repo.full_name] = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags };
        completedNames.push(repo.full_name);
      } catch { failedNames.push(repo.full_name); }
      setAiBatchProgress({ done: index + 1, total: names.length });
    }
    if (completedNames.length) {
      const optimistic = { ...state, repositoryMeta: nextMeta, categories: nextCategories };
      try {
        const items = completedNames.map((fullName) => { const meta = nextMeta[fullName]; const categoryDefinition = nextCategories.find((item) => item.name === meta?.category); return meta ? { fullName, categoryId: categoryDefinition?.id ?? "", note: meta.note, aiSummary: meta.aiSummary, aiTags: meta.aiTags } : null; }).filter(Boolean);
        await runOptimisticMutation(state, optimistic, onStateChange, { operation: "repository_meta.ai_batch", payload: { categories: nextCategories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })), items } });
      } catch { failedNames.push(...completedNames.filter((name) => !failedNames.includes(name))); }
    }
    setAiBatchRunning(false); setAiBatchPaused(false); aiPauseRef.current = false; aiStopRef.current = false; setAiBatchFailures(failedNames);
    if (failedNames.length) feedback(t(`${Math.max(0, names.length - failedNames.length)} 个完成，${failedNames.length} 个失败`, `${Math.max(0, names.length - failedNames.length)} completed, ${failedNames.length} failed`));
    else if (completedNames.length) feedback("", t(`已完成 ${completedNames.length} 个仓库的 AI 整理`, `AI analysis completed for ${completedNames.length} repositories`));
    else if (names.length) feedback(t("AI 分析已停止", "AI analysis stopped"));
  }
  function togglePause() { const next = !aiBatchPaused; setAiBatchPaused(next); aiPauseRef.current = next; }
  function stopAiBatch() { aiStopRef.current = true; aiPauseRef.current = false; setAiBatchPaused(false); }
  async function toggleRelease(fullName: string) { const exists = state.releaseSubscriptions.includes(fullName); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: exists ? state.releaseSubscriptions.filter((item) => item !== fullName) : [...state.releaseSubscriptions, fullName] }, onStateChange, { operation: exists ? "release.unsubscribe" : "release.subscribe", payload: { repoFullName: fullName } }); feedback("", exists ? t(`已取消 ${fullName} 的 Release 订阅`, `Unsubscribed from Releases for ${fullName}`) : t(`已订阅 ${fullName} 的 Release`, `Subscribed to Releases for ${fullName}`)); } catch (error) { feedback(error instanceof Error ? error.message : t("Release 订阅更新失败", "Failed to update Release subscription")); } }
  async function unstar(repo: Repository) { setUnstarTarget(null); if (!hasGithubCredential) return goToSettings(); setMutating((current) => new Set(current).add(repo.full_name)); feedback(); const previous = state; const optimistic = { ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }; onStateChange(optimistic); try { await unstarRepository(state.settings.githubToken.trim(), repo.full_name); onStateChange(await refreshCanonicalState(optimistic)); setSelected((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); feedback("", t(`已取消 Star：${repo.full_name}`, `Unstarred: ${repo.full_name}`)); } catch (error) { onStateChange(previous); feedback(error instanceof Error ? error.message : t("取消 Star 失败", "Failed to unstar")); } finally { setMutating((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); } }
  async function batchUnstar() { const names = Array.from(selected); if (!names.length) return; if (!hasGithubCredential) return goToSettings("account"); setBatchUnstarOpen(false); feedback(); try { const results = await batchStarAction(state.settings.githubToken.trim(), names, "unstar"); const succeeded = new Set(results.filter((item) => item.ok).map((item) => item.fullName)); const failed = results.filter((item) => !item.ok); onStateChange({ ...state, repositories: state.repositories.filter((item) => !succeeded.has(item.full_name)) }); setSelected(new Set(failed.map((item) => item.fullName))); if (failed.length) feedback(t(`${succeeded.size} 个成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`, `${succeeded.size} succeeded, ${failed.length} failed: ${failed[0].error || failed[0].fullName}`)); else feedback("", t(`已取消 ${succeeded.size} 个仓库的 Star`, `Unstarred ${succeeded.size} repositories`)); } catch (error) { feedback(error instanceof Error ? error.message : t("批量操作失败", "Batch action failed")); } }
  async function batchSubscribe() { const names = Array.from(selected); const next = new Set(state.releaseSubscriptions); names.forEach((name) => next.add(name)); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(next) }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } }); feedback("", t(`已批量订阅 ${selected.size} 个仓库的 Release`, `Subscribed to Releases for ${selected.size} repositories`)); } catch (error) { feedback(error instanceof Error ? error.message : t("批量订阅失败", "Batch subscription failed")); } }
  async function batchUnsubscribe() { const names = Array.from(selected).filter((name) => state.releaseSubscriptions.includes(name)); if (!names.length) return feedback("", t("选中的仓库没有 Release 订阅", "None of the selected repositories has a Release subscription")); let working = state; try { for (const repoFullName of names) { const next = { ...working, releaseSubscriptions: working.releaseSubscriptions.filter((item) => item !== repoFullName) }; await runOptimisticMutation(working, next, onStateChange, { operation: "release.unsubscribe", payload: { repoFullName } }); working = next; } feedback("", t(`已取消 ${names.length} 个仓库的 Release 订阅`, `Unsubscribed from Releases for ${names.length} repositories`)); } catch (error) { feedback(error instanceof Error ? error.message : t("批量取消订阅失败", "Batch unsubscribe failed")); } }
  async function applyBatchCategory(categoryValue: string) { if (!selected.size) return; const categoryName = categoryValue === "__uncategorized" ? "" : categoryValue; const nextMeta = { ...state.repositoryMeta }; const names = Array.from(selected); names.forEach((name) => { nextMeta[name] = { ...(nextMeta[name] ?? emptyMeta()), category: categoryName }; }); const categoryId = state.categories.find((item) => item.name === categoryName)?.id ?? ""; try { await runOptimisticMutation(state, { ...state, repositoryMeta: nextMeta }, onStateChange, { operation: "repository_meta.batch_category", payload: { fullName: names[0], repoFullNames: names, categoryId, note: "" } }); feedback("", categoryName ? t(`已设置分类：${categoryName}`, `Category set: ${categoryName}`) : t("已设为未分类", "Set as uncategorized")); } catch (error) { feedback(error instanceof Error ? error.message : t("分类更新失败", "Category update failed")); } }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Star</h1><p className="mt-1 text-sm text-muted-foreground">{state.lastSyncAt ? t(`上次同步 ${new Date(state.lastSyncAt).toLocaleString(locale)} · ${state.repositories.length} 个仓库`, `Last synced ${new Date(state.lastSyncAt).toLocaleString(locale)} · ${state.repositories.length} repositories`) : t(`${state.repositories.length} 个仓库`, `${state.repositories.length} repositories`)}</p></div><Button onClick={onSync} loading={syncing}><RiRefreshLine className="size-4" />{t("同步 Star", "Sync Stars")}</Button></header>
      <StatusBanner error={syncError || actionError} warning={!syncError && !actionError ? syncWarning : ""} success={!syncError && !actionError && !syncWarning ? syncSuccess : ""} />

      <Toolbar className="mb-5" aria-label={t("Stars 工具栏", "Stars toolbar")}>
        <ToolbarGroup className="min-w-[240px] flex-1"><InputGroup className="min-w-[220px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索仓库", "Search repositories")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索仓库、描述、标签、备注…", "Search repositories, descriptions, topics, notes…")} /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <Select aria-label={t("按分类筛选", "Filter by category")} value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-32"><option value="">{t("全部分类", "All categories")}</option><option value="__uncategorized">{t("未分类", "Uncategorized")}</option>{sortedCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select>
          <Select aria-label={t("按语言筛选", "Filter by language")} value={language} onChange={(event) => setLanguage(event.target.value)} className="min-w-32"><option value="">{t("全部语言", "All languages")}</option>{languages.map((item) => <option key={item}>{item}</option>)}</Select>
          <Select aria-label={t("排序方式", "Sort")} value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-32"><option value="starred">{t("星标时间", "Starred time")}</option><option value="active">{t("活跃时间", "Recent activity")}</option><option value="stars">{t("Star 数量", "Star count")}</option></Select><Tooltip content={direction === "desc" ? t("当前倒序，点击切换正序", "Descending; click for ascending") : t("当前正序，点击切换倒序", "Ascending; click for descending")}><Button variant="outline" size="icon" aria-label={direction === "desc" ? t("切换为正序", "Switch to ascending") : t("切换为倒序", "Switch to descending")} onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")}><RiArrowDownLine className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} /></Button></Tooltip>
        </ToolbarGroup>
      </Toolbar>
      {(query || language || category) ? <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t("当前筛选：", "Filters:")}</span>{query ? <Button size="sm" variant="outline" onClick={() => setQuery("")}>{t("搜索：", "Search: ")}{query} ×</Button> : null}{category ? <Button size="sm" variant="outline" onClick={() => setCategory("")}>{t("分类：", "Category: ")}{category === "__uncategorized" ? t("未分类", "Uncategorized") : category} ×</Button> : null}{language ? <Button size="sm" variant="outline" onClick={() => setLanguage("")}>{t("语言：", "Language: ")}{language} ×</Button> : null}<Button size="sm" variant="ghost" onClick={() => { setQuery(""); setCategory(""); setLanguage(""); }}>{t("清除筛选", "Clear filters")}</Button></div> : null}

      {selected.size ? <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"><div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-[100px] bg-primary px-3 py-2 text-primary-foreground shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><span className="shrink-0 px-3 text-sm font-medium">{t(`已选 ${selected.size} 个`, `${selected.size} selected`)}</span><Button size="sm" variant="ghost" className="shrink-0 rounded-[100px] text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground" onClick={() => setSelected(new Set(filtered.map((item) => item.full_name)))}>{t("全选", "Select all")}</Button><Button size="sm" variant="ghost" className="shrink-0 rounded-[100px] text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground" onClick={batchSubscribe}><RiNotification2Line className="size-4" />{t("订阅", "Subscribe")}</Button><Button size="sm" variant="ghost" className="shrink-0 rounded-[100px] text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground" disabled={!aiEnabled} onClick={() => { if (aiBatchRunning) togglePause(); else void runAiBatch(aiBatchFailures.length ? aiBatchFailures : undefined); }}><RiMagicLine className="size-4" />{aiBatchRunning ? (aiBatchPaused ? t("继续分析", "Resume analysis") : t(`AI 分析 ${aiBatchProgress.done}/${aiBatchProgress.total}`, `AI analysis ${aiBatchProgress.done}/${aiBatchProgress.total}`)) : aiBatchFailures.length ? t(`重试 ${aiBatchFailures.length}`, `Retry ${aiBatchFailures.length}`) : t("AI 分析", "AI analysis")}</Button><Menu><MenuTrigger render={<Button size="sm" variant="ghost" className="shrink-0 rounded-[100px] text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground" />}>{t("分类", "Category")}</MenuTrigger><MenuPopup><MenuItem onClick={() => void applyBatchCategory("__uncategorized")}>{t("未分类", "Uncategorized")}</MenuItem>{sortedCategories.map((item) => <MenuItem key={item.id} onClick={() => void applyBatchCategory(item.name)}>{item.name}</MenuItem>)}</MenuPopup></Menu><Button size="sm" className="shrink-0 rounded-[100px] border border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-destructive hover:text-white" onClick={() => setBatchUnstarOpen(true)}><RiStarLine className="size-4" />{t("取消 Star", "Unstar")}</Button><Button size="icon-sm" variant="ghost" className="shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground" aria-label={t("退出多选", "Exit multi-select")} onClick={() => { setSelected(new Set()); setAiBatchFailures([]); }}><RiCloseLine className="size-4" /></Button></div></div> : null}

      {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <RepositoryCardSkeleton key={index} />)}</div>
        : state.repositories.length === 0 ? <Empty className="min-h-[48vh] bg-card/30"><EmptyContent><EmptyIcon><RiStarLine className="size-5" /></EmptyIcon><EmptyTitle>{t("还没有仓库", "No repositories yet")}</EmptyTitle><EmptyDescription>{t("先在设置里连接 GitHub，然后同步现有 Star。", "Connect GitHub in Settings, then sync your existing Stars.")}</EmptyDescription><Button className="mt-4" variant="outline" onClick={() => goToSettings()}>{t("打开设置", "Open Settings")}</Button></EmptyContent></Empty>
          : filtered.length === 0 ? <Empty><EmptyContent><EmptyTitle>{t("没有符合当前筛选条件的仓库", "No repositories match the current filters")}</EmptyTitle><EmptyDescription>{t("调整搜索或筛选条件后再试。", "Adjust your search or filters and try again.")}</EmptyDescription><Button className="mt-3" size="sm" variant="outline" onClick={() => { setQuery(""); setCategory(""); setLanguage(""); }}>{t("清除筛选", "Clear filters")}</Button></EmptyContent></Empty>
            : <><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{t(`${filtered.length} 个仓库`, `${filtered.length} repositories`)}</span><span>{sort === "starred" ? (direction === "desc" ? t("最近星标", "Newest starred") : t("最早星标", "Oldest starred")) : sort === "active" ? (direction === "desc" ? t("最近活跃", "Recently active") : t("最早活跃", "Least recently active")) : (direction === "desc" ? t("最多 Star", "Most Stars") : t("最少 Star", "Fewest Stars"))}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((repo) => { const meta = metaFor(repo); return <RepositoryCard key={repo.full_name} repository={repo} meta={meta} density={state.settings.density} aiEnabled={aiEnabled} aiLoading={aiLoading === repo.full_name} selected={selected.has(repo.full_name)} selectionMode={selected.size > 0} releaseSubscribed={state.releaseSubscriptions.includes(repo.full_name)} mutating={mutating.has(repo.full_name)} onSelectedChange={(value) => setSelected((current) => { const next = new Set(current); if (value) next.add(repo.full_name); else next.delete(repo.full_name); return next; })} onEdit={() => setEditing(repo)} onDetails={() => setDetails(repo)} onOrganize={() => void runAi(repo)} onToggleRelease={() => toggleRelease(repo.full_name)} onUnstar={() => setUnstarTarget(repo)} />; })}</div></>}
      <RepositoryEditor repository={editing} meta={editing ? metaFor(editing) : emptyMeta()} categories={state.categories} open={Boolean(editing)} onClose={() => setEditing(null)} onManageCategories={() => goToSettings("categories")} onSave={(meta) => editing ? updateMeta(editing, meta) : false} />
      <RepositoryDetail open={Boolean(details)} repository={details} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setDetails(null)} previousDisabled={detailIndex <= 0} nextDisabled={detailIndex < 0 || detailIndex >= filtered.length - 1} onPrevious={() => { if (detailIndex > 0) setDetails(filtered[detailIndex - 1]); }} onNext={() => { if (detailIndex >= 0 && detailIndex < filtered.length - 1) setDetails(filtered[detailIndex + 1]); }} />
      <AlertDialog open={Boolean(unstarTarget)} onOpenChange={(open) => { if (!open) setUnstarTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("取消 Star？", "Unstar repository?")}</AlertDialogTitle><AlertDialogDescription>{t(`将从 GitHub 取消 Star，并从当前 Star 集合移除 ${unstarTarget?.full_name ?? "该仓库"}。此操作需要再次确认。`, `This will unstar ${unstarTarget?.full_name ?? "this repository"} on GitHub and remove it from your Star collection. Please confirm.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => { if (unstarTarget) void unstar(unstarTarget); }}>{t("取消 Star", "Unstar")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={batchUnstarOpen} onOpenChange={setBatchUnstarOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("取消这些仓库的 Star？", "Unstar selected repositories?")}</AlertDialogTitle><AlertDialogDescription>{t(`将对 GitHub 执行取消 Star，并从当前 Star 集合移除 ${selected.size} 个仓库。失败项会保留选中，方便重试。`, `This will unstar ${selected.size} repositories on GitHub and remove them from your Star collection. Failed items will stay selected for retry.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => void batchUnstar()}>{t("取消 Star", "Unstar")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
