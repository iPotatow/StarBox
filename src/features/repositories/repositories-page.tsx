import {
  RiArrowDownLine,
  RiMagicLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiStarLine,
} from "@remixicon/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { RepositoryCardSkeleton, RepositoryRowSkeleton } from "../../components/ui/skeleton";
import { StatusBanner } from "../../components/ui/status-banner";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { batchStarAction, organizeRepository, refreshCanonicalState, unstarRepository } from "../../lib/api";
import { cn } from "../../lib/cn";
import { runOptimisticMutation } from "../../lib/mutations";
import { emptyMeta } from "../../lib/storage";
import type { CategoryDefinition, PersistedState, Repository, RepositoryMeta } from "../../types";
import { RepositoryCard } from "./repository-card";
import { RepositoryDetail } from "./repository-detail";
import { RepositoryEditor } from "./repository-editor";

type SortMode = "starred" | "stars" | "updated";
type SortDirection = "asc" | "desc";
type StarsView = "grid" | "list";
const VIEW_KEY = "starbox:ui:stars-view";
function initialView(): StarsView { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } }

export function RepositoriesPage({
  state, onStateChange, onSync, syncing, syncError, syncWarning, syncSuccess, goToSettings, loading = false,
}: {
  state: PersistedState; onStateChange: (next: PersistedState) => void; onSync: () => void; syncing: boolean; syncError: string; syncWarning: string; syncSuccess: string;
  goToSettings: () => void; loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortMode>("starred");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<StarsView>(initialView);
  const [editing, setEditing] = useState<Repository | null>(null);
  const [details, setDetails] = useState<Repository | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiBatchRunning, setAiBatchRunning] = useState(false);
  const [aiBatchPaused, setAiBatchPaused] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState({ done: 0, total: 0 });
  const aiPauseRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchCategory, setBatchCategory] = useState("");
  const [mutating, setMutating] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

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
      const pinDelta = Number(metaFor(b).pinned) - Number(metaFor(a).pinned); if (pinDelta) return pinDelta;
      const delta = sort === "stars"
        ? a.stargazers_count - b.stargazers_count
        : sort === "updated"
          ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          : new Date(a.starred_at || 0).getTime() - new Date(b.starred_at || 0).getTime();
      return direction === "asc" ? delta : -delta;
    });
  }, [state.repositories, state.repositoryMeta, query, language, category, sort, direction]);

  const aiEnabled = Boolean(state.settings.ai.baseUrl && state.settings.ai.apiKey && state.settings.ai.model);
  const hasGithubCredential = Boolean(state.settings.githubToken.trim() || state.settings.credentialConnected);
  function feedback(error = "", success = "") { setActionError(error); setActionSuccess(success); }
  function setViewMode(next: StarsView) { setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* browser UI preference only */ } }
  function ensureCategory(categories: CategoryDefinition[], name: string) { if (!name.trim() || categories.some((item) => item.name === name.trim())) return categories; return [...categories, { id: `cat-${Date.now()}-${categories.length}`, name: name.trim(), color: "neutral", order: categories.length, locked: false }]; }
  async function updateMeta(repo: Repository, meta: RepositoryMeta) { try { const categoryId = state.categories.find((item) => item.name === meta.category)?.id ?? ""; await runOptimisticMutation(state, { ...state, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: meta } }, onStateChange, { operation: "repository_meta.update", payload: { fullName: repo.full_name, categoryId, note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } }); feedback("", "仓库信息已保存"); } catch (error) { feedback(error instanceof Error ? error.message : "仓库信息保存失败"); } }
  async function runAi(repo: Repository) { setAiLoading(repo.full_name); feedback(); try { const result = await organizeRepository(state.settings.ai, repo); const current = metaFor(repo); const locked = state.categories.some((item) => item.name === current.category && item.locked); const nextCategory = locked ? current.category : result.category; const nextCategories = ensureCategory(state.categories, nextCategory); const categoryDefinition = nextCategories.find((item) => item.name === nextCategory); const nextMeta = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags }; await runOptimisticMutation(state, { ...state, categories: nextCategories, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: nextMeta } }, onStateChange, { operation: "repository_meta.ai", payload: { fullName: repo.full_name, categoryId: categoryDefinition?.id ?? "", category: categoryDefinition ? { id: categoryDefinition.id, name: categoryDefinition.name, color: categoryDefinition.color, sortOrder: categoryDefinition.order, locked: categoryDefinition.locked } : undefined, note: nextMeta.note, pinned: nextMeta.pinned, aiSummary: nextMeta.aiSummary, aiTags: nextMeta.aiTags } }); feedback("", `${repo.full_name} 已完成 AI 整理`); } catch (error) { feedback(error instanceof Error ? error.message : "AI 整理失败"); } finally { setAiLoading(null); } }
  async function runAiBatch() { const names = Array.from(selected); if (!names.length || !aiEnabled || aiBatchRunning) return; setAiBatchRunning(true); setAiBatchPaused(false); aiPauseRef.current = false; setAiBatchProgress({ done: 0, total: names.length }); feedback(); let nextMeta = { ...state.repositoryMeta }; let nextCategories = [...state.categories]; let failures = 0; for (let index = 0; index < names.length; index += 1) { while (aiPauseRef.current) await new Promise((resolve) => setTimeout(resolve, 200)); const repo = state.repositories.find((item) => item.full_name === names[index]); if (!repo) continue; try { const result = await organizeRepository(state.settings.ai, repo); const current = nextMeta[repo.full_name] ?? emptyMeta(); const locked = nextCategories.some((item) => item.name === current.category && item.locked); const nextCategory = locked ? current.category : result.category; nextCategories = ensureCategory(nextCategories, nextCategory); nextMeta[repo.full_name] = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags }; } catch { failures += 1; } setAiBatchProgress({ done: index + 1, total: names.length }); } const optimistic = { ...state, repositoryMeta: nextMeta, categories: nextCategories }; try { const items = names.map((fullName) => { const meta = nextMeta[fullName]; const categoryDefinition = nextCategories.find((item) => item.name === meta?.category); return meta ? { fullName, categoryId: categoryDefinition?.id ?? "", note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } : null; }).filter(Boolean); await runOptimisticMutation(state, optimistic, onStateChange, { operation: "repository_meta.ai_batch", payload: { categories: nextCategories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })), items } }); } catch { failures += Math.max(1, names.length - failures); } setAiBatchRunning(false); setAiBatchPaused(false); aiPauseRef.current = false; feedback(failures ? `${Math.max(0, names.length - failures)} 个完成，${failures} 个失败` : "", failures ? "" : `已完成 ${names.length} 个仓库的 AI 整理`); }
  function togglePause() { const next = !aiBatchPaused; setAiBatchPaused(next); aiPauseRef.current = next; }
  async function toggleRelease(fullName: string) { const exists = state.releaseSubscriptions.includes(fullName); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: exists ? state.releaseSubscriptions.filter((item) => item !== fullName) : [...state.releaseSubscriptions, fullName] }, onStateChange, { operation: exists ? "release.unsubscribe" : "release.subscribe", payload: { repoFullName: fullName } }); feedback("", exists ? `已取消 ${fullName} 的 Release 订阅` : `已订阅 ${fullName} 的 Release`); } catch (error) { feedback(error instanceof Error ? error.message : "Release 订阅更新失败"); } }
  async function unstar(repo: Repository) { if (!hasGithubCredential) return goToSettings(); setMutating((current) => new Set(current).add(repo.full_name)); feedback(); const previous = state; const optimistic = { ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }; onStateChange(optimistic); try { await unstarRepository(state.settings.githubToken.trim(), repo.full_name); onStateChange(await refreshCanonicalState(optimistic)); setSelected((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); feedback("", `已取消 Star：${repo.full_name}`); } catch (error) { onStateChange(previous); feedback(error instanceof Error ? error.message : "取消 Star 失败"); } finally { setMutating((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); } }
  async function batchUnstar() { const names = Array.from(selected); if (!names.length) return; if (!hasGithubCredential) return goToSettings(); if (!window.confirm(`确定取消 ${names.length} 个仓库的 Star 吗？`)) return; feedback(); try { const results = await batchStarAction(state.settings.githubToken.trim(), names, "unstar"); const succeeded = new Set(results.filter((item) => item.ok).map((item) => item.fullName)); const failed = results.filter((item) => !item.ok); onStateChange({ ...state, repositories: state.repositories.filter((item) => !succeeded.has(item.full_name)) }); setSelected(new Set(failed.map((item) => item.fullName))); if (failed.length) feedback(`${succeeded.size} 个成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`); else feedback("", `已取消 ${succeeded.size} 个仓库的 Star`); } catch (error) { feedback(error instanceof Error ? error.message : "批量操作失败"); } }
  async function batchSubscribe() { const names = Array.from(selected); const next = new Set(state.releaseSubscriptions); names.forEach((name) => next.add(name)); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(next) }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } }); feedback("", `已批量订阅 ${selected.size} 个仓库的 Release`); } catch (error) { feedback(error instanceof Error ? error.message : "批量订阅失败"); } }
  async function applyBatchCategory() { if (!selected.size) return; const nextMeta = { ...state.repositoryMeta }; const names = Array.from(selected); names.forEach((name) => { nextMeta[name] = { ...(nextMeta[name] ?? emptyMeta()), category: batchCategory }; }); const categoryId = state.categories.find((item) => item.name === batchCategory)?.id ?? ""; try { await runOptimisticMutation(state, { ...state, repositoryMeta: nextMeta }, onStateChange, { operation: "repository_meta.batch_category", payload: { fullName: names[0], repoFullNames: names, categoryId, note: "", pinned: false } }); feedback("", batchCategory ? `已批量设置分类：${batchCategory}` : "已批量清除分类"); } catch (error) { feedback(error instanceof Error ? error.message : "批量分类失败"); } }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Stars</h1><p className="mt-1 text-sm text-muted-foreground">{state.lastSyncAt ? `上次同步 ${new Date(state.lastSyncAt).toLocaleString("zh-CN")} · ${state.repositories.length} 个仓库` : `${state.repositories.length} 个仓库`}</p></div><Button onClick={onSync} loading={syncing}><RiRefreshLine className={cn("size-4", syncing && "animate-spin")} />同步 Stars</Button></header>
      <StatusBanner error={syncError || actionError} warning={!syncError && !actionError ? syncWarning : ""} success={!syncError && !actionError && !syncWarning ? actionSuccess || syncSuccess : ""} />

      <Toolbar className="mb-5" aria-label="Stars 工具栏">
        <ToolbarGroup className="min-w-[240px] flex-1"><div className="relative w-full"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-full min-w-[220px] pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索仓库、描述、标签、备注…" /></div></ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-32"><option value="">全部分类</option><option value="__uncategorized">未分类</option>{sortedCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select>
          <Select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-w-32"><option value="">全部语言</option>{languages.map((item) => <option key={item}>{item}</option>)}</Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-32"><option value="starred">Star 时间</option><option value="stars">Star 数量</option><option value="updated">更新时间</option></Select>
          <Tooltip content={direction === "desc" ? "当前逆序，点击切换正序" : "当前正序，点击切换逆序"}><Button variant="outline" size="icon" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")} aria-label={direction === "desc" ? "切换为正序" : "切换为逆序"}><RiArrowDownLine className={cn("size-4 transition-transform", direction === "asc" && "rotate-180")} /></Button></Tooltip>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup><ToggleGroup value={[view]} onValueChange={(value) => { const next = value[0]; if (next === "grid" || next === "list") setViewMode(next); }}><ToggleGroupItem value="grid" className="w-auto px-2.5 text-xs">卡片</ToggleGroupItem><ToggleGroupItem value="list" className="w-auto px-2.5 text-xs">列表</ToggleGroupItem></ToggleGroup></ToolbarGroup>
      </Toolbar>

      {selected.size ? <div className="mb-4 grid gap-2 rounded-xl border border-border bg-secondary/45 px-3 py-2"><div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm font-medium">已选择 {selected.size} 个仓库</span><Select value={batchCategory} onChange={(event) => setBatchCategory(event.target.value)}><option value="">未分类</option>{sortedCategories.map((item) => <option key={item.id}>{item.name}</option>)}</Select><Button size="sm" variant="outline" onClick={applyBatchCategory}>应用分类</Button><Button size="sm" variant="outline" onClick={batchSubscribe}><RiNotification2Line className="size-4" />订阅 Release</Button>{aiEnabled ? <Button size="sm" variant="outline" onClick={() => void runAiBatch()} disabled={aiBatchRunning}><RiMagicLine className="size-4" />批量 AI</Button> : null}{aiBatchRunning ? <Button size="sm" variant="outline" onClick={togglePause}>{aiBatchPaused ? "继续" : "暂停"}</Button> : null}<Button size="sm" variant="destructive" onClick={() => void batchUnstar()}><RiStarLine className="size-4" />取消 Star</Button><Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>清除</Button></div>{aiBatchRunning ? <div className="text-xs text-muted-foreground">AI 进度：{aiBatchProgress.done}/{aiBatchProgress.total}{aiBatchPaused ? " · 已暂停" : ""}</div> : null}</div> : null}

      {loading ? <div className={cn("grid gap-3", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>{Array.from({ length: view === "grid" ? 9 : 7 }, (_, index) => view === "grid" ? <RepositoryCardSkeleton key={index} /> : <RepositoryRowSkeleton key={index} />)}</div>
        : state.repositories.length === 0 ? <div className="grid min-h-[48vh] place-items-center rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center"><div className="max-w-sm"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-card"><RiStarLine className="size-5" /></div><h2 className="mt-4 text-base font-semibold">还没有仓库</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">先在设置里连接 GitHub，然后同步现有 Stars。</p><Button className="mt-4" variant="outline" onClick={goToSettings}>打开设置</Button></div></div>
          : filtered.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">没有符合当前筛选条件的仓库</div>
            : <><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{filtered.length} 个仓库</span><span>{sort === "starred" ? "按 Star 时间" : sort === "stars" ? "按 Star 数量" : "按更新时间"} · {direction === "desc" ? "逆序" : "正序"}</span></div><div className={cn("grid gap-3", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>{filtered.map((repo) => { const meta = metaFor(repo); return <RepositoryCard key={repo.full_name} repository={repo} meta={meta} view={view} density={state.settings.density} aiEnabled={aiEnabled} aiLoading={aiLoading === repo.full_name} selected={selected.has(repo.full_name)} releaseSubscribed={state.releaseSubscriptions.includes(repo.full_name)} mutating={mutating.has(repo.full_name)} onSelectedChange={(value) => setSelected((current) => { const next = new Set(current); if (value) next.add(repo.full_name); else next.delete(repo.full_name); return next; })} onEdit={() => setEditing(repo)} onDetails={() => setDetails(repo)} onOrganize={() => void runAi(repo)} onTogglePin={() => updateMeta(repo, { ...meta, pinned: !meta.pinned })} onToggleRelease={() => toggleRelease(repo.full_name)} onUnstar={() => void unstar(repo)} />; })}</div></>}

      <RepositoryEditor repository={editing} meta={editing ? metaFor(editing) : emptyMeta()} open={Boolean(editing)} onClose={() => setEditing(null)} onSave={(meta) => { if (editing) updateMeta(editing, meta); feedback("", "仓库信息已保存"); }} />
      <RepositoryDetail open={Boolean(details)} repository={details} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setDetails(null)} />
    </div>
  );
}
