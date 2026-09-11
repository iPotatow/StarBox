import {
  RiAddLine,
  RiArrowDownLine,
  RiFolder3Line,
  RiGitForkLine,
  RiMagicLine,
  RiNotification2Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiStarLine,
} from "@remixicon/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { ForkDialog } from "../forks/fork-dialog";
import { batchStarAction, commitCanonicalMutation, fetchStarredRepositories, organizeRepository, starRepository, unstarRepository } from "../../lib/api";
import { cn } from "../../lib/cn";
import { runOptimisticMutation } from "../../lib/mutations";
import { emptyMeta } from "../../lib/storage";
import type { CategoryDefinition, ForkJob, PersistedState, Repository, RepositoryMeta } from "../../types";
import { CategoryManager } from "./category-manager";
import { RepositoryCard } from "./repository-card";
import { RepositoryDetail } from "./repository-detail";
import { RepositoryEditor } from "./repository-editor";

type SortMode = "starred" | "stars" | "updated" | "name";
const categoryColors: Record<string, string> = { neutral: "#8b8b8b", blue: "#3b82f6", violet: "#8b5cf6", emerald: "#10b981", amber: "#f59e0b", red: "#ef4444" };

export function RepositoriesPage({
  state, onStateChange, onSync, syncing, syncError, syncSuccess, goToSettings, goToReleases, goToForks,
}: {
  state: PersistedState; onStateChange: (next: PersistedState) => void; onSync: () => void; syncing: boolean; syncError: string; syncSuccess: string;
  goToSettings: () => void; goToReleases: () => void; goToForks: () => void;
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortMode>("starred");
  const [editing, setEditing] = useState<Repository | null>(null);
  const [details, setDetails] = useState<Repository | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
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
  const [addOpen, setAddOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchAddText, setBatchAddText] = useState("");
  const [batchAddLoading, setBatchAddLoading] = useState(false);
  const [forkSource, setForkSource] = useState("");

  const metaFor = (repo: Repository) => state.repositoryMeta[repo.full_name] ?? emptyMeta();
  const sortedCategories = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
  const languages = useMemo(() => Array.from(new Set(state.repositories.map((repo) => repo.language).filter(Boolean) as string[])).sort(), [state.repositories]);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const repo of state.repositories) { const value = metaFor(repo).category || "__uncategorized"; result.set(value, (result.get(value) || 0) + 1); }
    return result;
  }, [state.repositories, state.repositoryMeta]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = state.repositories.filter((repo) => {
      const meta = state.repositoryMeta[repo.full_name] ?? emptyMeta();
      const haystack = [repo.full_name, repo.description, repo.language, ...repo.topics, meta.category, meta.note, meta.aiSummary, ...meta.aiTags].filter(Boolean).join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!language || repo.language === language) && (!category || (category === "__uncategorized" ? !meta.category : meta.category === category));
    });
    return next.sort((a, b) => {
      const pinDelta = Number(metaFor(b).pinned) - Number(metaFor(a).pinned); if (pinDelta) return pinDelta;
      if (sort === "stars") return b.stargazers_count - a.stargazers_count;
      if (sort === "updated") return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      return new Date(b.starred_at || 0).getTime() - new Date(a.starred_at || 0).getTime();
    });
  }, [state.repositories, state.repositoryMeta, query, language, category, sort]);

  const aiEnabled = Boolean(state.settings.ai.baseUrl && state.settings.ai.apiKey && state.settings.ai.model);
  function feedback(error = "", success = "") { setActionError(error); setActionSuccess(success); }
  function ensureCategory(categories: CategoryDefinition[], name: string) {
    if (!name.trim() || categories.some((item) => item.name === name.trim())) return categories;
    return [...categories, { id: `cat-${Date.now()}-${categories.length}`, name: name.trim(), color: "neutral", order: categories.length, locked: false }];
  }
  async function updateMeta(repo: Repository, meta: RepositoryMeta) {
    try { const categoryId = state.categories.find((item) => item.name === meta.category)?.id ?? ""; await runOptimisticMutation(state, { ...state, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: meta } }, onStateChange, { operation: "repository_meta.update", payload: { fullName: repo.full_name, categoryId, note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } }); feedback("", "仓库信息已保存"); }
    catch (error) { feedback(error instanceof Error ? error.message : "仓库信息保存失败"); }
  }

  async function runAi(repo: Repository) {
    setAiLoading(repo.full_name); feedback();
    try {
      const result = await organizeRepository(state.settings.ai, repo);
      const current = metaFor(repo); const locked = state.categories.some((item) => item.name === current.category && item.locked);
      const nextCategory = locked ? current.category : result.category;
      const nextCategories = ensureCategory(state.categories, nextCategory);
      const categoryDefinition = nextCategories.find((item) => item.name === nextCategory);
      const nextMeta = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags };
      await runOptimisticMutation(state, { ...state, categories: nextCategories, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: nextMeta } }, onStateChange, { operation: "repository_meta.ai", payload: { fullName: repo.full_name, categoryId: categoryDefinition?.id ?? "", category: categoryDefinition ? { id: categoryDefinition.id, name: categoryDefinition.name, color: categoryDefinition.color, sortOrder: categoryDefinition.order, locked: categoryDefinition.locked } : undefined, note: nextMeta.note, pinned: nextMeta.pinned, aiSummary: nextMeta.aiSummary, aiTags: nextMeta.aiTags } });
      feedback("", `${repo.full_name} 已完成 AI 整理`);
    } catch (error) { feedback(error instanceof Error ? error.message : "AI 整理失败"); }
    finally { setAiLoading(null); }
  }

  async function runAiBatch() {
    const names = Array.from(selected); if (!names.length || !aiEnabled || aiBatchRunning) return;
    setAiBatchRunning(true); setAiBatchPaused(false); aiPauseRef.current = false; setAiBatchProgress({ done: 0, total: names.length }); feedback();
    let nextMeta = { ...state.repositoryMeta }; let nextCategories = [...state.categories]; let failures = 0;
    for (let index = 0; index < names.length; index += 1) {
      while (aiPauseRef.current) await new Promise((resolve) => setTimeout(resolve, 200));
      const repo = state.repositories.find((item) => item.full_name === names[index]); if (!repo) continue;
      try {
        const result = await organizeRepository(state.settings.ai, repo); const current = nextMeta[repo.full_name] ?? emptyMeta(); const locked = nextCategories.some((item) => item.name === current.category && item.locked);
        const nextCategory = locked ? current.category : result.category; nextCategories = ensureCategory(nextCategories, nextCategory); nextMeta[repo.full_name] = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags };
      } catch { failures += 1; }
      setAiBatchProgress({ done: index + 1, total: names.length });
    }
    const optimistic = { ...state, repositoryMeta: nextMeta, categories: nextCategories };
    try {
      const items = names.map((fullName) => { const meta = nextMeta[fullName]; const categoryDefinition = nextCategories.find((item) => item.name === meta?.category); return meta ? { fullName, categoryId: categoryDefinition?.id ?? "", note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } : null; }).filter(Boolean);
      await runOptimisticMutation(state, optimistic, onStateChange, { operation: "repository_meta.ai_batch", payload: { categories: nextCategories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })), items } });
    } catch { failures += Math.max(1, names.length - failures); }
    setAiBatchRunning(false); setAiBatchPaused(false); aiPauseRef.current = false;
    feedback(failures ? `${Math.max(0, names.length - failures)} 个完成，${failures} 个失败` : "", failures ? "" : `已完成 ${names.length} 个仓库的 AI 整理`);
  }

  function togglePause() { const next = !aiBatchPaused; setAiBatchPaused(next); aiPauseRef.current = next; }
  async function toggleRelease(fullName: string) { const exists = state.releaseSubscriptions.includes(fullName); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: exists ? state.releaseSubscriptions.filter((item) => item !== fullName) : [...state.releaseSubscriptions, fullName] }, onStateChange, { operation: exists ? "release.unsubscribe" : "release.subscribe", payload: { repoFullName: fullName } }); feedback("", exists ? `已取消 ${fullName} 的 Release 订阅` : `已订阅 ${fullName} 的 Release`); } catch (error) { feedback(error instanceof Error ? error.message : "Release 订阅更新失败"); } }
  async function addForkJob(job: ForkJob) { try { await runOptimisticMutation(state, { ...state, forkJobs: [job, ...state.forkJobs.filter((item) => item.targetFullName !== job.targetFullName)] }, onStateChange, { operation: "fork.create", payload: { fullName: job.targetFullName, parentFullName: job.sourceFullName, status: job.status } }); feedback("", `Fork 已提交：${job.targetFullName}`); } catch (error) { feedback(error instanceof Error ? error.message : "Fork 任务保存失败"); } }

  const hasGithubCredential = Boolean(state.settings.githubToken.trim() || state.settings.credentialConnected);

  async function unstar(repo: Repository) {
    if (!hasGithubCredential) return goToSettings(); setMutating((current) => new Set(current).add(repo.full_name)); feedback();
    const previous = state; const optimistic = { ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }; onStateChange(optimistic);
    try { await unstarRepository(state.settings.githubToken.trim(), repo.full_name); onStateChange(await commitCanonicalMutation(optimistic, { id: crypto.randomUUID(), operation: "unstar", payload: { fullName: repo.full_name } })); setSelected((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); feedback("", `已取消 Star：${repo.full_name}`); }
    catch (error) { onStateChange(previous); feedback(error instanceof Error ? error.message : "取消 Star 失败"); }
    finally { setMutating((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); }
  }

  async function addStar() {
    if (!hasGithubCredential) return goToSettings(); const fullName = addFullName.trim(); if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) return feedback("请输入 owner/repo 格式的仓库名称");
    setAddLoading(true); feedback();
    const previous = state;
    try { const repository = await starRepository(state.settings.githubToken.trim(), fullName); const optimistic = { ...state, repositories: [repository, ...state.repositories.filter((item) => item.full_name !== repository.full_name)] }; onStateChange(optimistic); onStateChange(await commitCanonicalMutation(optimistic, { id: crypto.randomUUID(), operation: "star", payload: { fullName: repository.full_name } })); setAddFullName(""); setAddOpen(false); feedback("", `已 Star：${repository.full_name}`); }
    catch (error) { onStateChange(previous); feedback(error instanceof Error ? error.message : "Star 失败"); } finally { setAddLoading(false); }
  }

  async function batchStar() {
    if (!hasGithubCredential) return goToSettings(); const names = Array.from(new Set(batchAddText.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)));
    if (!names.length || names.length > 50 || names.some((name) => !/^[^/\s]+\/[^/\s]+$/.test(name))) return feedback("批量 Star 需要 1-50 个 owner/repo，可用换行或逗号分隔");
    setBatchAddLoading(true); feedback();
    try { const results = await batchStarAction(state.settings.githubToken.trim(), names, "star"); const succeeded = results.filter((item) => item.ok); const failed = results.filter((item) => !item.ok); const repositories = succeeded.length ? await fetchStarredRepositories(state.settings.githubToken.trim()) : state.repositories; onStateChange({ ...state, repositories, lastSyncAt: succeeded.length ? new Date().toISOString() : state.lastSyncAt }); if (failed.length) feedback(`${succeeded.length} 个 Star 成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`); else { setBatchAddOpen(false); setBatchAddText(""); feedback("", `已批量 Star ${succeeded.length} 个仓库`); } }
    catch (error) { feedback(error instanceof Error ? error.message : "批量 Star 失败"); } finally { setBatchAddLoading(false); }
  }

  async function batchUnstar() {
    const names = Array.from(selected); if (!names.length) return; if (!hasGithubCredential) return goToSettings(); if (!window.confirm(`确定取消 ${names.length} 个仓库的 Star 吗？`)) return; feedback();
    try { const results = await batchStarAction(state.settings.githubToken.trim(), names, "unstar"); const succeeded = new Set(results.filter((item) => item.ok).map((item) => item.fullName)); const failed = results.filter((item) => !item.ok); onStateChange({ ...state, repositories: state.repositories.filter((item) => !succeeded.has(item.full_name)) }); setSelected(new Set(failed.map((item) => item.fullName))); if (failed.length) feedback(`${succeeded.size} 个成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`); else feedback("", `已取消 ${succeeded.size} 个仓库的 Star`); }
    catch (error) { feedback(error instanceof Error ? error.message : "批量操作失败"); }
  }

  async function batchSubscribe() { const names = Array.from(selected); const next = new Set(state.releaseSubscriptions); names.forEach((name) => next.add(name)); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(next) }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } }); feedback("", `已批量订阅 ${selected.size} 个仓库的 Release`); } catch (error) { feedback(error instanceof Error ? error.message : "批量订阅失败"); } }
  async function applyBatchCategory() { if (!selected.size) return; const nextMeta = { ...state.repositoryMeta }; const names = Array.from(selected); names.forEach((name) => { nextMeta[name] = { ...(nextMeta[name] ?? emptyMeta()), category: batchCategory }; }); const categoryId = state.categories.find((item) => item.name === batchCategory)?.id ?? ""; try { await runOptimisticMutation(state, { ...state, repositoryMeta: nextMeta }, onStateChange, { operation: "repository_meta.batch_category", payload: { fullName: names[0], repoFullNames: names, categoryId, note: "", pinned: false } }); feedback("", batchCategory ? `已批量设置分类：${batchCategory}` : "已批量清除分类"); } catch (error) { feedback(error instanceof Error ? error.message : "批量分类失败"); } }

  return (
    <div className="min-w-0">
      <section className="min-w-0 px-0 py-6 sm:px-2 lg:px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Stars</h1><p className="mt-1 text-sm text-muted-foreground">{state.lastSyncAt ? `上次同步 ${new Date(state.lastSyncAt).toLocaleString("zh-CN")}` : "同步 GitHub Stars 后开始整理"}</p></div><div className="flex flex-wrap items-center gap-2">{!aiEnabled ? <Button variant="outline" onClick={goToSettings}><RiSettings4Line className="size-4" />配置 AI</Button> : null}<Button variant="outline" onClick={() => setCategoryManagerOpen(true)}><RiFolder3Line className="size-4" />分类管理</Button><Button variant="outline" onClick={() => setAddOpen(true)}><RiAddLine className="size-4" />Star 仓库</Button><Button variant="outline" onClick={() => setBatchAddOpen(true)}><RiAddLine className="size-4" />批量 Star</Button><Button onClick={onSync} loading={syncing}><RiRefreshLine className={cn("size-4", syncing && "animate-spin")} />同步 Stars</Button></div></div>
        <StatusBanner error={syncError || actionError} success={!syncError && !actionError ? actionSuccess || syncSuccess : ""} />
        <div className="stars-category-strip mb-3 flex items-center gap-2 overflow-x-auto pb-1" data-testid="stars-category-strip" aria-label="Stars 分类">
          <span className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">分类</span>
          <Button variant="ghost" size="none" onClick={() => setCategory("")} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm", !category ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/70")}><RiStarLine className="size-4" />全部 <span className="text-xs">{state.repositories.length}</span></Button>
          <Button variant="ghost" size="none" onClick={() => setCategory("__uncategorized")} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm", category === "__uncategorized" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/70")}><RiFolder3Line className="size-4" />未分类 <span className="text-xs">{counts.get("__uncategorized") || 0}</span></Button>
          {sortedCategories.map((item) => <Button variant="ghost" size="none" key={item.id} onClick={() => setCategory(item.name)} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm", category === item.name ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/70")}><span className="size-2.5 rounded-sm border border-foreground/20" style={{ backgroundColor: categoryColors[item.color] || categoryColors.neutral }} /><span>{item.name}{item.locked ? " · 锁" : ""}</span><span className="text-xs">{counts.get(item.name) || 0}</span></Button>)}
          <Button variant="ghost" size="none" onClick={() => setCategoryManagerOpen(true)} className="ml-auto flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">管理</Button>
        </div>
        <Card className="mb-5 flex-row flex-wrap items-center gap-2 rounded-xl p-2 shadow-card"><div className="relative min-w-[220px] flex-1"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="border-transparent bg-transparent pl-9 shadow-none focus:border-transparent" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="文本搜索仓库、描述、标签、备注…" /></div><Select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-w-32"><option value="">全部语言</option>{languages.map((item) => <option key={item}>{item}</option>)}</Select><Select value={category.startsWith("__") ? "" : category} onChange={(event) => setCategory(event.target.value)} className="min-w-32 xl:hidden"><option value="">全部分类</option>{sortedCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select><Select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-36"><option value="starred">最近收藏</option><option value="updated">最近更新</option><option value="stars">Stars 最多</option><option value="name">名称 A–Z</option></Select></Card>

        {selected.size ? <div className="mb-4 grid gap-2 rounded-xl border border-border bg-secondary/45 px-3 py-2"><div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm font-medium">已选择 {selected.size} 个仓库</span><Select value={batchCategory} onChange={(event) => setBatchCategory(event.target.value)}><option value="">未分类</option>{sortedCategories.map((item) => <option key={item.id}>{item.name}</option>)}</Select><Button size="sm" variant="outline" onClick={applyBatchCategory}>应用分类</Button><Button size="sm" variant="outline" onClick={batchSubscribe}><RiNotification2Line className="size-4" />订阅 Release</Button>{aiEnabled ? <Button size="sm" variant="outline" onClick={() => void runAiBatch()} disabled={aiBatchRunning}><RiMagicLine className="size-4" />批量 AI</Button> : null}{aiBatchRunning ? <Button size="sm" variant="outline" onClick={togglePause}>{aiBatchPaused ? "继续" : "暂停"}</Button> : null}<Button size="sm" variant="destructive" onClick={() => void batchUnstar()}><RiStarLine className="size-4" />取消 Star</Button><Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>清除</Button></div>{aiBatchRunning ? <div className="text-xs text-muted-foreground">AI 进度：{aiBatchProgress.done}/{aiBatchProgress.total}{aiBatchPaused ? " · 已暂停" : ""}</div> : null}</div> : null}

        {state.repositories.length === 0 ? <div className="grid min-h-[52vh] place-items-center rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center"><div className="max-w-sm"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-card"><RiStarLine className="size-5" /></div><h2 className="mt-4 text-base font-semibold">还没有仓库</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">先配置 GitHub Token，然后同步现有 Stars，或直接添加一个 owner/repo。</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={goToSettings}>打开设置</Button><Button onClick={() => setAddOpen(true)}>Star 仓库</Button></div></div></div> : filtered.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">没有符合当前筛选条件的仓库</div> : <><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{filtered.length} 个仓库</span><span className="flex items-center gap-1"><RiArrowDownLine className="size-3.5" />{sort === "starred" ? "按收藏时间" : sort === "updated" ? "按更新时间" : sort === "stars" ? "按 Stars" : "按名称"}</span></div><div className="grid gap-3 2xl:grid-cols-2">{filtered.map((repo) => { const meta = metaFor(repo); return <RepositoryCard key={repo.full_name} repository={repo} meta={meta} density={state.settings.density} aiEnabled={aiEnabled} aiLoading={aiLoading === repo.full_name} selected={selected.has(repo.full_name)} releaseSubscribed={state.releaseSubscriptions.includes(repo.full_name)} mutating={mutating.has(repo.full_name)} onSelectedChange={(value) => setSelected((current) => { const next = new Set(current); if (value) next.add(repo.full_name); else next.delete(repo.full_name); return next; })} onEdit={() => setEditing(repo)} onDetails={() => setDetails(repo)} onOrganize={() => void runAi(repo)} onTogglePin={() => updateMeta(repo, { ...meta, pinned: !meta.pinned })} onToggleRelease={() => toggleRelease(repo.full_name)} onFork={() => setForkSource(repo.full_name)} onUnstar={() => void unstar(repo)} />; })}</div></>}
      </section>

      <RepositoryEditor repository={editing} meta={editing ? metaFor(editing) : emptyMeta()} open={Boolean(editing)} onClose={() => setEditing(null)} onSave={(meta) => { if (editing) updateMeta(editing, meta); feedback("", "仓库信息已保存"); }} />
      <RepositoryDetail open={Boolean(details)} repository={details} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setDetails(null)} />
      <CategoryManager open={categoryManagerOpen} state={state} onStateChange={onStateChange} onClose={() => setCategoryManagerOpen(false)} />
      <Modal open={addOpen} title="Star 仓库" description="输入 GitHub 仓库的 owner/repo；成功后会立即加入本地 Stars 列表。" onClose={() => setAddOpen(false)}><div className="grid gap-4"><Field label="仓库"><Input autoFocus value={addFullName} onChange={(event) => setAddFullName(event.target.value)} placeholder="facebook/react" onKeyDown={(event) => { if (event.key === "Enter") void addStar(); }} /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button><Button loading={addLoading} onClick={() => void addStar()}><RiStarLine className="size-4" />Star</Button></div></div></Modal>
      <Modal open={batchAddOpen} title="批量 Star" description="一次可提交 1-50 个仓库；用换行或逗号分隔 owner/repo。" onClose={() => setBatchAddOpen(false)}><div className="grid gap-4"><Field label="仓库列表"><Textarea autoFocus rows={8} value={batchAddText} onChange={(event) => setBatchAddText(event.target.value)} placeholder={"facebook/react\nvuejs/core"} /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBatchAddOpen(false)}>取消</Button><Button loading={batchAddLoading} onClick={() => void batchStar()}><RiStarLine className="size-4" />批量 Star</Button></div></div></Modal>
      <ForkDialog open={Boolean(forkSource)} sourceFullName={forkSource} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setForkSource("")} onCreated={addForkJob} />
    </div>
  );
}
