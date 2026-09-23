import type { StateChange } from "../../types";
import { Bell as BellIcon, BellSlash as BellOffIcon, DotsThreeVertical as EllipsisVerticalIcon, FunnelSimple as ListFilterIcon, Star as StarIcon } from "@phosphor-icons/react";
import { RefreshCwIcon, SearchIcon, SparklesIcon, XIcon } from "../../lib/animated-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { BeamSearch } from "../../components/spectrumui/beam-search";
import { MorphButton } from "../../components/spectrumui/morph-button";
import { NumberTicker } from "../../components/spectrumui/number-ticker";
import { SkeletonReveal } from "../../components/spectrumui/skeleton-reveal";
import { Checkbox } from "../../components/ui/checkbox";
import { CheckboxGroup } from "../../components/ui/checkbox-group";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
import { Field } from "../../components/ui/field";
import { FilterBar, FilterBarChips, FilterBarMobile, FilterBarMobileControls } from "../../components/patterns/filter-bar";
import { PageHeader, PageHeaderContent, PageHeaderDescription, PageHeaderTitle } from "../../components/patterns/page-header";
import { SelectionToolbar, SelectionToolbarLabel } from "../../components/patterns/selection-toolbar";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Menu, MenuCheckboxItem, MenuItem, MenuPopup, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger, MenuTrigger } from "../../components/ui/menu";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { RepositoryCardSkeleton } from "../../components/ui/skeleton";
import { Spinner } from "../../components/ui/spinner";
import { StatusBanner } from "../../components/ui/status-banner";
import { Toolbar, ToolbarButton, ToolbarGroup } from "../../components/ui/toolbar";
import { Tooltip } from "../../components/ui/tooltip";
import { notify } from "../../components/ui/toast";
import { batchStarAction, organizeRepository, unstarRepository } from "../../lib/api";
import { inferReleasePlatforms } from "../../lib/release-assets";
import { mergeRepositoryPlatforms } from "../../lib/release-platform-core";
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
const platformLabels: Record<string, string> = { mac: "macOS", macos: "macOS", windows: "Windows", linux: "Linux", docker: "Docker" };
function normalizePlatform(value: string) { return platformLabels[value.trim().toLowerCase()] ?? value.trim(); }
function readMultiQueryParam(name: string) { return readQueryParam(name).split(",").map((value) => value.trim()).filter(Boolean); }
export function RepositoriesPage({
  state, onStateChange, onSync, syncing, syncError, syncWarning, syncSuccess, goToSettings, loading = false,
}: {
  state: PersistedState; onStateChange: StateChange; onSync: () => void; syncing: boolean; syncError: string; syncWarning: string; syncSuccess: string;
  goToSettings: (tab?: string) => void; loading?: boolean;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [language, setLanguage] = useState(() => readQueryParam("language"));
  const [category, setCategory] = useState(() => readQueryParam("category"));
  const [topicFilters, setTopicFilters] = useState<string[]>(() => readMultiQueryParam("tags"));
  const [platformFilters, setPlatformFilters] = useState<string[]>(() => readMultiQueryParam("platforms"));
  const [tagFilterQuery, setTagFilterQuery] = useState("");
  const [sort, setSort] = useState<SortMode>(() => { const value = readQueryParam("sort"); return value === "stars" ? "stars" : value === "active" || value === "updated" ? "active" : "starred"; });
  const [direction, setDirection] = useState<SortDirection>(() => readQueryParam("direction") === "asc" ? "asc" : "desc");
  const [editing, setEditing] = useState<Repository | null>(null);
  const [details, setDetails] = useState<Repository | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiBatchRunning, setAiBatchRunning] = useState(false);
  const [aiBatchPaused, setAiBatchPaused] = useState(false);
  const [aiFollowPaused, setAiFollowPaused] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState({ attempted: 0, succeeded: 0, failed: 0, total: 0, current: "" });
  const stateRef = useRef(state);
  stateRef.current = state;
  const batchBusy = useRef(false);
  const [batchProgress, setBatchProgress] = useState("");
  const aiPauseRef = useRef(false);
  const aiStopRef = useRef(false);
  useEffect(() => () => { aiStopRef.current = true; aiPauseRef.current = false; }, []);
  const [aiBatchFailures, setAiBatchFailures] = useState<string[]>([]);
  const [aiSkipAnalyzed, setAiSkipAnalyzed] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mutating, setMutating] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState("");
  const [batchUnstarOpen, setBatchUnstarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { replaceQueryParams({ q: query, language, category, tags: topicFilters.join(","), platforms: platformFilters.join(","), list: "", status: "", sort: sort === "starred" ? "" : sort, direction: direction === "desc" ? "" : direction, view: "" }); }, [query, language, category, topicFilters, platformFilters, sort, direction]);

  function locateAiTarget(resumeFollow = false) {
    const fullName = aiLoading || aiBatchProgress.current;
    if (resumeFollow) setAiFollowPaused(false);
    if (!fullName) return false;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-repository-full-name]"))
      .find((item) => item.dataset.repositoryFullName === fullName);
    if (!target) return false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    return true;
  }

  function resumeAiFollow() {
    const located = locateAiTarget(true);
    if (!located) setActionError(t("当前分析仓库不在筛选结果中；筛选条件保持不变。", "The current analysis target is outside the filtered results; filters were kept unchanged."));
  }

  useEffect(() => {
    if (!aiLoading || aiFollowPaused || editing || details) return;
    locateAiTarget();
  }, [aiLoading, aiFollowPaused, editing, details]);

  useEffect(() => {
    if (!aiBatchRunning) return;
    const surface = document.querySelector<HTMLElement>('[data-testid="content-surface"]');
    if (!surface) return;
    const pauseFollow = () => setAiFollowPaused(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) pauseFollow();
    };
    surface.addEventListener("wheel", pauseFollow, { passive: true });
    surface.addEventListener("touchmove", pauseFollow, { passive: true });
    surface.addEventListener("keydown", onKeyDown);
    return () => {
      surface.removeEventListener("wheel", pauseFollow);
      surface.removeEventListener("touchmove", pauseFollow);
      surface.removeEventListener("keydown", onKeyDown);
    };
  }, [aiBatchRunning]);

  useEffect(() => {
    if (aiBatchRunning && (editing || details)) setAiFollowPaused(true);
  }, [aiBatchRunning, editing, details]);

  const metaFor = (repo: Repository) => state.repositoryMeta[repo.full_name] ?? emptyMeta();
  const sortedCategories = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
  const languages = useMemo(() => Array.from(new Set(state.repositories.map((repo) => repo.language).filter(Boolean) as string[])).sort(), [state.repositories]);
  const releasePlatformsByRepo = useMemo(() => {
    const releasesByRepo = new Map<string, PersistedState["releases"]>();
    for (const release of state.releases) {
      const releases = releasesByRepo.get(release.repoFullName) ?? [];
      releases.push(release);
      releasesByRepo.set(release.repoFullName, releases);
    }
    return new Map(Array.from(releasesByRepo, ([fullName, releases]) => [fullName, inferReleasePlatforms(releases)] as const));
  }, [state.releases]);
  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repo of state.repositories) for (const topic of new Set(repo.topics)) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [state.repositories]);
  const visibleTopicOptions = useMemo(() => {
    const needle = tagFilterQuery.trim().toLowerCase();
    return topicOptions
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(topicFilters.includes(b.name)) - Number(topicFilters.includes(a.name)) || b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [topicOptions, topicFilters, tagFilterQuery]);
  const platformOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repo of state.repositories) {
      const platforms = mergeRepositoryPlatforms(releasePlatformsByRepo.get(repo.full_name) ?? (state.repositoryMeta[repo.full_name] ?? emptyMeta()).aiPlatforms, repo.topics).map(normalizePlatform);
      for (const platform of new Set(platforms)) counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
    const preferred = ["macOS", "Windows", "Linux", "Docker"];
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => {
      const ai = preferred.indexOf(a.name); const bi = preferred.indexOf(b.name);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }, [releasePlatformsByRepo, state.repositories, state.repositoryMeta]);
  const filtered = useMemo(() => {
    const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const next = state.repositories.filter((repo) => {
      const meta = state.repositoryMeta[repo.full_name] ?? emptyMeta();
      const repoPlatforms = mergeRepositoryPlatforms(releasePlatformsByRepo.get(repo.full_name) ?? meta.aiPlatforms, repo.topics).map(normalizePlatform);
      const haystack = [repo.full_name, repo.description, repo.language, ...repo.topics, ...meta.aiTags, meta.category, meta.note, meta.aiSummary].filter(Boolean).join(" ").toLowerCase();
      const matchesTopic = !topicFilters.length || topicFilters.some((topic) => repo.topics.includes(topic));
      const matchesPlatform = !platformFilters.length || platformFilters.some((platform) => repoPlatforms.includes(platform));
      return (!needles.length || needles.every((needle) => haystack.includes(needle)))
        && (!language || repo.language === language)
        && (!category || (category === "__uncategorized" ? !meta.category : meta.category === category))
        && matchesTopic
        && matchesPlatform;
    });
    return next.sort((a, b) => {
      const delta = sort === "stars"
        ? a.stargazers_count - b.stargazers_count
        : sort === "active"
          ? new Date(a.pushed_at || a.updated_at).getTime() - new Date(b.pushed_at || b.updated_at).getTime()
          : new Date(a.starred_at || 0).getTime() - new Date(b.starred_at || 0).getTime();
      return direction === "desc" ? -delta : delta;
    });
  }, [state.repositories, state.repositoryMeta, releasePlatformsByRepo, query, language, category, topicFilters, platformFilters, sort, direction]);

  const visibleSelected = useMemo(() => filtered.reduce((count, repo) => count + Number(selected.has(repo.full_name)), 0), [filtered, selected]);
  const activeFilterCount = Number(Boolean(category)) + Number(Boolean(language)) + topicFilters.length + platformFilters.length;
  const detailIndex = details ? filtered.findIndex((repo) => repo.full_name === details.full_name) : -1;
  const aiEnabled = Boolean(state.settings.ai.baseUrl && (state.settings.ai.apiKey || state.settings.ai.credentialConfigured) && state.settings.ai.model);
  const hasGithubCredential = Boolean(state.settings.githubToken.trim() || state.settings.credentialConnected);
  const batchUnstarEnabled = state.settings.batchUnstarEnabled;
  const sortChoice = `${sort}-${direction}`;
  const sortItems = [
    { value: "starred-desc", label: t("最近星标", "Newest starred") },
    { value: "starred-asc", label: t("最早星标", "Oldest starred") },
    { value: "active-desc", label: t("最近活跃", "Recently active") },
    { value: "active-asc", label: t("最早活跃", "Least recently active") },
    { value: "stars-desc", label: t("最多 Star", "Most Stars") },
    { value: "stars-asc", label: t("最少 Star", "Fewest Stars") },
  ];
  function applySortChoice(value: string) { const [nextSort, nextDirection] = value.split("-") as [SortMode, SortDirection]; setSort(nextSort); setDirection(nextDirection); }
  function toggleTopic(topic: string) { setTopicFilters((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]); }
  function togglePlatform(platform: string) { setPlatformFilters((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]); }
  function clearStructuredFilters() { setCategory(""); setLanguage(""); setTopicFilters([]); setPlatformFilters([]); }
  function clearAllFilters() { setQuery(""); clearStructuredFilters(); }
  function feedback(error = "", success = "") { setActionError(error); if (success) notify(success, "", "success"); }
  function actionFailure(title: string, reason: unknown, fallback = "") {
    const detail = reason instanceof Error ? reason.message : fallback;
    setActionError(detail ? `${title}：${detail}` : title);
  }
  function ensureCategory(categories: CategoryDefinition[], name: string) { if (!name.trim() || categories.some((item) => item.name === name.trim())) return categories; return [...categories, { id: `cat-${Date.now()}-${categories.length}`, name: name.trim(), color: "neutral", order: categories.length, locked: false }]; }
  async function updateMeta(repo: Repository, meta: RepositoryMeta) { try { const categoryId = state.categories.find((item) => item.name === meta.category)?.id ?? ""; const categoryLocked = Boolean(meta.category && meta.categoryLocked); await runOptimisticMutation(state, { ...state, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: { ...meta, categoryLocked } } }, onStateChange, { operation: "repository_meta.update", payload: { fullName: repo.full_name, categoryId, categoryLocked, note: meta.note, aiSummary: meta.aiSummary, aiTags: meta.aiTags, aiPlatforms: meta.aiPlatforms, expectedUserRevision: state.repositoryMeta[repo.full_name]?.userRevision ?? 0 } }); feedback("", t("仓库信息已保存", "Repository details saved")); return true; } catch (error) { feedback(error instanceof Error ? error.message : t("仓库信息保存失败", "Failed to save repository details")); return false; } }
  async function analyzeAndSave(repo: Repository, skipIfCurrent = false) {
    const before = stateRef.current.repositoryMeta[repo.full_name] ?? emptyMeta();
    const result = await organizeRepository(stateRef.current.settings.ai, repo, {
      skipIfCurrent,
      previousAnalysis: {
        inputHash: before.aiInputHash ?? "",
        promptVersion: before.aiPromptVersion ?? "",
        modelId: before.aiModelId ?? "",
      },
    });
    if (result.unchanged) return false;
    const latest = stateRef.current;
    const current = latest.repositoryMeta[repo.full_name] ?? emptyMeta();
    const categoryProtected = Boolean(current.categoryLocked) || latest.categories.some((item) => item.name === current.category && item.locked);
    const nextCategory = categoryProtected ? current.category : result.category;
    const nextCategories = ensureCategory(latest.categories, nextCategory);
    const categoryDefinition = nextCategories.find((item) => item.name === nextCategory);
    const nextMeta: RepositoryMeta = {
      ...current,
      category: nextCategory,
      aiSummary: result.summary,
      aiTags: result.tags,
      aiPlatforms: result.platforms,
      aiAnalyzedAt: new Date().toISOString(),
      aiInputHash: result.analysisMeta.inputHash,
      aiPromptVersion: result.analysisMeta.promptVersion,
      aiModelId: result.analysisMeta.modelId,
    };
    await runOptimisticMutation(latest, { ...latest, categories: nextCategories, repositoryMeta: { ...latest.repositoryMeta, [repo.full_name]: nextMeta } }, onStateChange, {
      operation: "repository_meta.ai",
      payload: { fullName: repo.full_name, categoryId: categoryDefinition?.id ?? "", category: categoryDefinition ? { id: categoryDefinition.id, name: categoryDefinition.name, color: categoryDefinition.color, sortOrder: categoryDefinition.order, locked: categoryDefinition.locked } : undefined, aiSummary: nextMeta.aiSummary, aiTags: nextMeta.aiTags, analysisMeta: result.analysisMeta },
    });
    return true;
  }
  async function runAi(repo: Repository) {
    if (aiLoading || aiBatchRunning) return;
    setAiLoading(repo.full_name); feedback();
    try { await analyzeAndSave(repo); feedback("", t(`${repo.full_name} 已完成 AI 分析`, `${repo.full_name} AI analysis completed`)); }
    catch (error) { actionFailure(t("AI 分析失败", "AI analysis failed"), error, repo.full_name); }
    finally { setAiLoading(null); }
  }
  async function runAiBatch(requestedNames?: string[]) {
    const requested = requestedNames ?? Array.from(selected);
    if (!requested.length || !aiEnabled || aiBatchRunning || aiLoading) return;
    const skipAnalyzed = !requestedNames && aiSkipAnalyzed;
    const names = requested;
    let skipped = 0;
    setAiBatchRunning(true); setAiBatchPaused(false); setAiFollowPaused(false); setAiBatchFailures([]); aiPauseRef.current = false; aiStopRef.current = false;
    setAiBatchProgress({ attempted: 0, succeeded: 0, failed: 0, total: names.length, current: names[0] ?? "" }); feedback();
    const failedNames: string[] = []; let completed = 0; let failed = 0; let attempted = 0;
    for (const name of names) {
      while (aiPauseRef.current && !aiStopRef.current) await new Promise((resolve) => setTimeout(resolve, 200));
      if (aiStopRef.current) break;
      const repo = stateRef.current.repositories.find((item) => item.full_name === name);
      setAiBatchProgress({ attempted, succeeded: completed, failed, total: names.length, current: name });
      try {
        if (!repo) throw new Error("Repository is no longer available");
        setAiLoading(repo.full_name);
        const changed = await analyzeAndSave(repo, skipAnalyzed);
        if (changed) completed += 1; else skipped += 1;
      } catch { failedNames.push(name); failed += 1; }
      finally {
        setAiLoading(null);
        attempted += 1;
        setAiBatchProgress({ attempted, succeeded: completed, failed, total: names.length, current: name });
      }
    }
    setAiBatchRunning(false); setAiBatchPaused(false); aiPauseRef.current = false; aiStopRef.current = false; setAiBatchFailures(failedNames);
    setAiBatchProgress((current) => ({ ...current, current: "" }));
    const skippedSuffix = skipped ? t(`，跳过 ${skipped} 个未变化仓库`, `; skipped ${skipped} unchanged repositories`) : "";
    if (failedNames.length) feedback(t(`${completed} 个完成，${failedNames.length} 个失败${skippedSuffix}`, `${completed} completed, ${failedNames.length} failed${skippedSuffix}`));
    else if (completed) feedback("", t(`已完成 ${completed} 个仓库的 AI 整理${skippedSuffix}`, `AI analysis completed for ${completed} repositories${skippedSuffix}`));
    else if (skipped) feedback("", t(`已跳过 ${skipped} 个未变化仓库`, `Skipped ${skipped} unchanged repositories`));
    else feedback(t("AI 分析已停止", "AI analysis stopped"));
  }
  function togglePause() { const next = !aiBatchPaused; setAiBatchPaused(next); aiPauseRef.current = next; }
  function stopAiBatch() { aiStopRef.current = true; aiPauseRef.current = false; setAiBatchPaused(false); }
  async function toggleRelease(fullName: string) { const exists = state.releaseSubscriptions.includes(fullName); try { await runOptimisticMutation(state, { ...state, releaseSubscriptions: exists ? state.releaseSubscriptions.filter((item) => item !== fullName) : [...state.releaseSubscriptions, fullName] }, onStateChange, { operation: exists ? "release.unsubscribe" : "release.subscribe", payload: { repoFullName: fullName, expectedUserRevision: state.repositoryMeta[fullName]?.userRevision ?? 0 } }); feedback("", exists ? t(`已取消订阅 ${fullName} 的 Release`, `Unsubscribed from Releases for ${fullName}`) : t(`已订阅 ${fullName} 的 Release`, `Subscribed to Releases for ${fullName}`)); } catch (error) { actionFailure(t("Release 订阅更新失败", "Failed to update Release subscription"), error, fullName); } }
  async function unstar(repo: Repository) { if (!hasGithubCredential) return goToSettings(); setMutating((current) => new Set(current).add(repo.full_name)); feedback(); try { await unstarRepository(state.settings.githubToken.trim(), repo.full_name); onStateChange((current) => ({ ...current, repositories: current.repositories.filter((item) => item.full_name !== repo.full_name) })); setSelected((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); feedback("", t(`已取消 Star：${repo.full_name}`, `Unstarred: ${repo.full_name}`)); } catch (error) { actionFailure(t("取消 Star 失败", "Failed to unstar"), error, repo.full_name); } finally { setMutating((current) => { const next = new Set(current); next.delete(repo.full_name); return next; }); } }
  async function batchUnstar() {
    const names = Array.from(selected); if (!names.length || batchBusy.current) return;
    if (!hasGithubCredential) return goToSettings("account");
    batchBusy.current = true; setBatchUnstarOpen(false); feedback(); setBatchProgress(`0 / ${names.length}`);
    try {
      const results = await batchStarAction(stateRef.current.settings.githubToken.trim(), names, "unstar", (done, total) => setBatchProgress(`${done} / ${total}`));
      const succeeded = new Set(results.filter((item) => item.ok).map((item) => item.fullName));
      const failed = results.filter((item) => !item.ok);
      onStateChange((current) => ({ ...current, repositories: current.repositories.filter((item) => !succeeded.has(item.full_name)) }));
      setSelected(new Set(failed.map((item) => item.fullName)));
      if (failed.length) feedback(t(`${succeeded.size} 个成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`, `${succeeded.size} succeeded, ${failed.length} failed: ${failed[0].error || failed[0].fullName}`));
      else feedback("", t(`已取消 ${succeeded.size} 个仓库的 Star`, `Unstarred ${succeeded.size} repositories`));
    } finally { batchBusy.current = false; setBatchProgress(""); }
  }
  async function batchSubscribe() {
    const names = Array.from(selected); if (!names.length || batchBusy.current) return;
    batchBusy.current = true; let done = 0; const failed: string[] = []; setBatchProgress(`0 / ${names.length}`);
    try {
      for (let index = 0; index < names.length; index += 50) {
        const chunk = names.slice(index, index + 50); const latest = stateRef.current;
        const expectedUserRevisions = Object.fromEntries(chunk.map((fullName) => [fullName, latest.repositoryMeta[fullName]?.userRevision ?? 0]));
        try {
          await runOptimisticMutation(latest, { ...latest, releaseSubscriptions: [...new Set([...latest.releaseSubscriptions, ...chunk])] }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: chunk, expectedUserRevisions } });
        } catch { failed.push(...chunk); }
        done += chunk.length; setBatchProgress(`${done} / ${names.length}`);
      }
      setSelected(new Set(failed));
      if (failed.length) feedback(t(`${names.length - failed.length} 个成功，${failed.length} 个失败，失败项已保留选中。`, `${names.length - failed.length} succeeded, ${failed.length} failed. Failed items remain selected.`));
      else feedback("", t(`已批量订阅 ${names.length} 个仓库的 Release`, `Subscribed to Releases for ${names.length} repositories`));
    } finally { batchBusy.current = false; setBatchProgress(""); }
  }
  async function batchUnsubscribe() { const names = Array.from(selected).filter((name) => state.releaseSubscriptions.includes(name)); if (!names.length) return feedback("", t("选中的仓库没有 Release 订阅", "None of the selected repositories has a Release subscription")); let working = state; try { for (const repoFullName of names) { const next = { ...working, releaseSubscriptions: working.releaseSubscriptions.filter((item) => item !== repoFullName) }; await runOptimisticMutation(working, next, onStateChange, { operation: "release.unsubscribe", payload: { repoFullName, expectedUserRevision: working.repositoryMeta[repoFullName]?.userRevision ?? 0 } }); working = next; } feedback("", t(`已取消 ${names.length} 个仓库的 Release 订阅`, `Unsubscribed from Releases for ${names.length} repositories`)); } catch (error) { actionFailure(t("批量取消订阅失败", "Batch unsubscribe failed"), error); } }
  async function applyBatchCategory(categoryValue: string) { if (!selected.size) return; const categoryName = categoryValue === "__uncategorized" ? "" : categoryValue; const nextMeta = { ...state.repositoryMeta }; const names = Array.from(selected); names.forEach((name) => { nextMeta[name] = { ...(nextMeta[name] ?? emptyMeta()), category: categoryName, categoryLocked: Boolean(categoryName) }; }); const categoryId = state.categories.find((item) => item.name === categoryName)?.id ?? ""; try { await runOptimisticMutation(state, { ...state, repositoryMeta: nextMeta }, onStateChange, { operation: "repository_meta.batch_category", payload: { fullName: names[0], repoFullNames: names, categoryId, categoryLocked: Boolean(categoryId), expectedUserRevisions: Object.fromEntries(names.map((name) => [name, state.repositoryMeta[name]?.userRevision ?? 0])) } }); feedback("", categoryName ? t(`已设置分类：${categoryName}`, `Category set: ${categoryName}`) : t("已设为未分类", "Set as uncategorized")); } catch (error) { actionFailure(t("分类更新失败", "Category update failed"), error, categoryName || t("未分类", "Uncategorized")); } }

  const aiBatchRemaining = Math.max(0, aiBatchProgress.total - aiBatchProgress.attempted);
  const aiBatchTaskVisible = aiBatchRunning || aiBatchPaused || aiBatchFailures.length > 0;

  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", selected.size > 0 && aiBatchTaskVisible ? "max-md:pb-40" : (selected.size > 0 || aiBatchTaskVisible) && "max-md:pb-24")}>
      <PageHeader><PageHeaderContent><PageHeaderTitle>Star</PageHeaderTitle><PageHeaderDescription>{state.lastSyncAt ? t(`上次同步 ${new Date(state.lastSyncAt).toLocaleString(locale)} · ${state.repositories.length} 个仓库`, `Last synced ${new Date(state.lastSyncAt).toLocaleString(locale)} · ${state.repositories.length} repositories`) : t(`${state.repositories.length} 个仓库`, `${state.repositories.length} repositories`)}</PageHeaderDescription></PageHeaderContent><MorphButton state={syncing ? "loading" : syncError ? "error" : syncSuccess ? "success" : "idle"} onClick={onSync} loadingLabel={t("正在同步", "Syncing")} successLabel={t("已同步", "Synced")} errorLabel={t("同步失败", "Sync failed")}><RefreshCwIcon className="size-4" />{t("同步 Star", "Sync Stars")}</MorphButton></PageHeader>
      <StatusBanner error={syncError || actionError} warning={!syncError && !actionError ? syncWarning : ""} success={!syncError && !actionError && !syncWarning ? syncSuccess : ""} />

      {batchProgress ? <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">{t("批量处理", "Batch processing")} {batchProgress}</p> : null}
      <FilterBar>
        <FilterBarMobile>
          <BeamSearch><InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索仓库", "Search repositories")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索仓库、描述、标签、备注…", "Search repositories, descriptions, topics, notes…")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></BeamSearch>
          <FilterBarMobileControls className="grid-cols-2">
            <Button variant="outline" onClick={() => setFiltersOpen(true)}><ListFilterIcon className="size-4" aria-hidden="true" />{activeFilterCount ? t(`筛选 ${activeFilterCount}`, `Filters ${activeFilterCount}`) : t("筛选", "Filter")}</Button>
            <Select aria-label={t("排序方式", "Sort")} value={sortChoice} onValueChange={applySortChoice} items={sortItems} />
          </FilterBarMobileControls>
        </FilterBarMobile>
        <Toolbar data-slot="filter-bar-desktop" className="hidden md:flex" aria-label={t("Stars 工具栏", "Stars toolbar")}>
          <ToolbarGroup data-slot="filter-bar-search" className="min-w-[240px] flex-1"><BeamSearch className="min-w-[220px]"><InputGroup className="min-w-[220px]"><InputGroupInput type="search" data-search-shortcut="true" aria-label={t("搜索仓库", "Search repositories")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索仓库、描述、标签、备注…", "Search repositories, descriptions, topics, notes…")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup></BeamSearch></ToolbarGroup>
          <ToolbarGroup data-slot="filter-bar-controls" className="ml-auto min-w-0">
            <ToolbarButton
              render={<Button variant="outline" className="min-w-24" aria-label={t("筛选仓库", "Filter repositories")} aria-haspopup="dialog" aria-expanded={filtersOpen} />}
              onClick={() => setFiltersOpen(true)}
            >
              <ListFilterIcon aria-hidden="true" />
              {activeFilterCount ? t(`筛选 ${activeFilterCount}`, `Filters ${activeFilterCount}`) : t("筛选", "Filter")}
            </ToolbarButton>
            <Select aria-label={t("排序方式", "Sort")} value={sortChoice} onValueChange={applySortChoice} className="min-w-32" items={sortItems} />
          </ToolbarGroup>
        </Toolbar>
        {activeFilterCount ? <FilterBarChips>{category ? <Button size="sm" variant="outline" onClick={() => setCategory("")}>{category === "__uncategorized" ? t("未分类", "Uncategorized") : category} ×</Button> : null}{language ? <Button size="sm" variant="outline" onClick={() => setLanguage("")}>{language} ×</Button> : null}{platformFilters.map((platform) => <Button key={platform} size="sm" variant="outline" onClick={() => togglePlatform(platform)}>{t("平台：", "Platform: ")}{platform} ×</Button>)}{topicFilters.map((topic) => <Button key={topic} size="sm" variant="outline" onClick={() => toggleTopic(topic)}>{t("标签：", "Tag: ")}{topic} ×</Button>)}<Button size="sm" variant="ghost" onClick={clearStructuredFilters}>{t("清除全部", "Clear all")}</Button></FilterBarChips> : null}
      </FilterBar>
      <ResponsiveDialog
        open={filtersOpen}
        title={t("筛选 Star", "Filter Stars")}
        description={t("分类和语言单选；平台与标签支持多选。", "Category and language are single-select; platforms and tags support multi-select.")}
        onClose={() => setFiltersOpen(false)}
        footer={<><Button variant="ghost" onClick={clearStructuredFilters}>{t("清除", "Clear")}</Button><Button onClick={() => setFiltersOpen(false)}>{t("完成", "Done")}</Button></>}
      >
        <div className="grid gap-5">
          <Field label={t("分类", "Category")}><Select value={category} onValueChange={(value) => setCategory(value)} items={[{ value: "", label: t("全部分类", "All categories") }, { value: "__uncategorized", label: t("未分类", "Uncategorized") }, ...(sortedCategories.map((item) => ({ value: String(item.name), label: item.name })))]} /></Field>
          <Field label={t("语言", "Language")}><Select value={language} onValueChange={(value) => setLanguage(value)} items={[{ value: "", label: t("全部语言", "All languages") }, ...(languages.map((item) => ({ value: String(item), label: item })))]} /></Field>
          <Field label={t("平台", "Platform")}>
            {platformOptions.length ? <CheckboxGroup value={platformFilters} onValueChange={(value) => setPlatformFilters(value.map(String))} aria-label={t("平台筛选", "Platform filters")} className="gap-1">
              {platformOptions.map((item) => <label key={item.name} className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"><Checkbox value={item.name} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="text-xs tabular-nums text-muted-foreground">{item.count}</span></label>)}
            </CheckboxGroup> : <span className="text-sm text-muted-foreground">{t("暂无平台数据", "No platform data")}</span>}
          </Field>
          <Field label="Tags">
            <div className="grid gap-2">
              <InputGroup><InputGroupInput type="search" value={tagFilterQuery} onChange={(event) => setTagFilterQuery(event.target.value)} placeholder={t("搜索标签…", "Search tags…")} aria-label={t("搜索标签", "Search tags")} /><InputGroupAddon><SearchIcon className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup>
              {visibleTopicOptions.length ? <CheckboxGroup value={topicFilters} onValueChange={(value) => setTopicFilters(value.map(String))} aria-label={t("标签筛选", "Tag filters")} className="max-h-52 gap-1 overflow-y-auto rounded-lg border border-border/70 p-1">
                {visibleTopicOptions.map((item) => <label key={item.name} className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"><Checkbox value={item.name} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="text-xs tabular-nums text-muted-foreground">{item.count}</span></label>)}
              </CheckboxGroup> : <span className="text-sm text-muted-foreground">{t("没有匹配的标签", "No matching tags")}</span>}
            </div>
          </Field>
        </div>
      </ResponsiveDialog>

      {aiBatchTaskVisible && !selected.size ? <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-2 sm:px-4 md:bottom-5"><SelectionToolbar aria-label={t("AI 批量任务", "AI batch task")} className="max-w-[min(44rem,calc(100vw-1rem))]">
        {aiBatchRunning ? <Spinner className="size-4 shrink-0" aria-hidden="true" /> : <SparklesIcon className="size-4 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-xs font-medium">{aiBatchRunning && aiBatchProgress.current ? aiBatchProgress.current : t(`失败项 ${aiBatchFailures.length} 个，可重试`, `${aiBatchFailures.length} failed items ready to retry`)}</div>
          <div className="flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground"><span>{t("成功", "Succeeded")}</span><NumberTicker value={aiBatchProgress.succeeded} /><span>·</span><span>{t("失败", "Failed")}</span><NumberTicker value={aiBatchProgress.failed} /><span>·</span><span>{t("剩余", "Remaining")}</span><NumberTicker value={aiBatchRemaining} /></div>
          {aiBatchRunning ? <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{aiFollowPaused ? t("自动跟随已暂停；阅读位置不会被打断", "Auto-follow paused; your reading position will stay put") : aiBatchPaused ? t("已暂停；继续后从下一项开始", "Paused; resume continues with the next item") : t("暂停会在当前仓库处理完成后生效", "Pause takes effect after the current repository finishes")}</div> : null}
        </div>
        {aiBatchRunning && aiBatchProgress.current ? <Button size="xs" variant="ghost" className="shrink-0 rounded-full" onClick={resumeAiFollow}>{aiFollowPaused ? t("继续跟随", "Resume follow") : t("定位", "Locate")}</Button> : null}
        {aiBatchRunning ? <Button size="xs" variant="ghost" className="shrink-0 rounded-full" onClick={togglePause}>{aiBatchPaused ? t("继续", "Resume") : t("暂停", "Pause")}</Button> : aiBatchFailures.length ? <Button size="xs" variant="ghost" className="shrink-0 rounded-full" disabled={!aiEnabled} onClick={() => void runAiBatch(aiBatchFailures)}>{t("重试", "Retry")}</Button> : null}
        {aiBatchRunning ? <Button size="xs" variant="ghost" className="shrink-0 rounded-full" onClick={stopAiBatch}>{t("停止", "Stop")}</Button> : null}
        {!aiBatchRunning && aiBatchFailures.length ? <Button size="icon-xs" variant="ghost" className="shrink-0 rounded-full" aria-label={t("关闭任务状态", "Dismiss task status")} onClick={() => setAiBatchFailures([])}><XIcon className="size-3.5" aria-hidden="true" /></Button> : null}
      </SelectionToolbar></div> : null}

      {selected.size ? <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-2 sm:px-4 md:bottom-5"><SelectionToolbar>
        <SelectionToolbarLabel className="max-w-24 truncate px-2 sm:max-w-none sm:px-3"><span>{t("已选", "Selected")} </span><NumberTicker value={selected.size} /></SelectionToolbarLabel>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 rounded-[100px] px-2 text-foreground hover:bg-accent/70 hover:text-foreground sm:px-3"
          disabled={filtered.length > 0 && visibleSelected === filtered.length}
          aria-label={t("全选当前结果", "Select all results")}
          onClick={() => setSelected(new Set(filtered.map((item) => item.full_name)))}
        >
          <span className="whitespace-nowrap">{t("全选", "Select all")}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 shrink rounded-[100px] px-2 text-foreground hover:bg-accent/70 hover:text-foreground sm:px-3"
          disabled={!aiEnabled}
          aria-label={aiBatchRunning ? (aiBatchPaused ? t("继续 AI 分析", "Resume AI analysis") : t("暂停 AI 分析", "Pause AI analysis")) : aiBatchFailures.length ? t(`重试 ${aiBatchFailures.length} 个失败项`, `Retry ${aiBatchFailures.length} failed items`) : t("批量 AI 分析", "Batch AI analysis")}
          onClick={() => { if (aiBatchRunning) togglePause(); else void runAiBatch(aiBatchFailures.length ? aiBatchFailures : undefined); }}
        >
          {aiBatchRunning ? <Spinner className="size-4 shrink-0" aria-hidden="true" /> : <SparklesIcon className="size-4 shrink-0" aria-hidden="true" />}
          <span className="hidden whitespace-nowrap sm:inline">{aiBatchRunning ? (aiBatchPaused ? t("继续分析", "Resume analysis") : t(`AI 分析 ${aiBatchProgress.attempted}/${aiBatchProgress.total}`, `AI analysis ${aiBatchProgress.attempted}/${aiBatchProgress.total}`)) : aiBatchFailures.length ? t(`重试 ${aiBatchFailures.length}`, `Retry ${aiBatchFailures.length}`) : t("AI 分析", "AI analysis")}</span>
          <span className="whitespace-nowrap sm:hidden">{aiBatchRunning ? `${aiBatchProgress.attempted}/${aiBatchProgress.total}` : aiBatchFailures.length ? t(`重试 ${aiBatchFailures.length}`, `Retry ${aiBatchFailures.length}`) : "AI"}</span>
        </Button>
        
        <Menu>
          <MenuTrigger render={<Button size="icon-sm" variant="ghost" className="shrink-0 rounded-full text-foreground hover:bg-accent/70 hover:text-foreground" aria-label={t("更多批量操作", "More batch actions")} />}>
            <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup side="top" align="end" className="w-56 max-w-[calc(100vw-1rem)]">
            <MenuCheckboxItem variant="switch" checked={aiSkipAnalyzed} disabled={aiBatchRunning} onCheckedChange={(checked) => setAiSkipAnalyzed(Boolean(checked))}>{t("跳过未变化的已分析仓库", "Skip unchanged analysis")}</MenuCheckboxItem>
            {aiBatchRunning ? <MenuItem onClick={stopAiBatch}>{t("停止 AI 分析", "Stop AI analysis")}</MenuItem> : null}
            <MenuSeparator />
            <MenuItem onClick={() => void batchSubscribe()}><BellIcon className="size-4" aria-hidden="true" />{t("订阅 Release", "Subscribe to Releases")}</MenuItem>
            <MenuItem onClick={() => void batchUnsubscribe()}><BellOffIcon className="size-4" aria-hidden="true" />{t("取消订阅 Release", "Unsubscribe from Releases")}</MenuItem>
            <MenuSub>
              <MenuSubTrigger>{t("设置分类", "Set category")}</MenuSubTrigger>
              <MenuSubPopup>
                <MenuItem onClick={() => void applyBatchCategory("__uncategorized")}>{t("未分类", "Uncategorized")}</MenuItem>
                {sortedCategories.map((item) => <MenuItem key={item.id} onClick={() => void applyBatchCategory(item.name)}>{item.name}</MenuItem>)}
              </MenuSubPopup>
            </MenuSub>
            <MenuSeparator />
            <MenuCheckboxItem variant="switch" checked={batchUnstarEnabled} onCheckedChange={(checked) => { const enabled = Boolean(checked); onStateChange((current) => ({ ...current, settings: { ...current.settings, batchUnstarEnabled: enabled } })); if (!enabled) setBatchUnstarOpen(false); }}>{t("启用批量取消 Star", "Enable batch unstar")}</MenuCheckboxItem>
            {batchUnstarEnabled ? <MenuItem variant="destructive" onClick={() => setBatchUnstarOpen(true)}><StarIcon className="size-4" aria-hidden="true" />{t("取消 Star", "Unstar")}</MenuItem> : null}
          </MenuPopup>
        </Menu>
        <Button size="icon-sm" variant="ghost" className="shrink-0 rounded-full text-foreground hover:bg-accent/70 hover:text-foreground" aria-label={t("退出多选", "Exit multi-select")} onClick={() => setSelected(new Set())}><XIcon className="size-4" aria-hidden="true" /></Button>
      </SelectionToolbar></div> : null}

      <SkeletonReveal loading={loading} skeleton={<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <RepositoryCardSkeleton key={index} />)}</div>}>
        {state.repositories.length === 0 ? <Empty className="min-h-[48vh] bg-card/30"><EmptyContent><EmptyIcon><StarIcon className="size-5" /></EmptyIcon><EmptyTitle>{t("还没有仓库", "No repositories yet")}</EmptyTitle><EmptyDescription>{t("先在设置里连接 GitHub，然后同步现有 Star。", "Connect GitHub in Settings, then sync your existing Stars.")}</EmptyDescription><Button className="mt-4" variant="outline" onClick={() => goToSettings()}>{t("打开设置", "Open Settings")}</Button></EmptyContent></Empty>
          : filtered.length === 0 ? <Empty><EmptyContent><EmptyTitle>{t("没有符合当前筛选条件的仓库", "No repositories match the current filters")}</EmptyTitle><EmptyDescription>{t("调整搜索或筛选条件后再试。", "Adjust your search or filters and try again.")}</EmptyDescription><Button className="mt-3" size="sm" variant="outline" onClick={clearAllFilters}>{t("清除筛选", "Clear filters")}</Button></EmptyContent></Empty>
            : <><div className="mb-3 text-xs text-muted-foreground"><span>{query.trim() || activeFilterCount ? t(`${filtered.length} / ${state.repositories.length} 个仓库`, `${filtered.length} / ${state.repositories.length} repositories`) : t(`${filtered.length} 个仓库`, `${filtered.length} repositories`)}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((repo) => { const meta = metaFor(repo); const cachedPlatforms = releasePlatformsByRepo.get(repo.full_name); const cardMeta = cachedPlatforms ? { ...meta, aiPlatforms: cachedPlatforms } : meta; return <RepositoryCard key={repo.full_name} repository={repo} meta={cardMeta} aiEnabled={aiEnabled} aiLoading={aiLoading === repo.full_name} selected={selected.has(repo.full_name)} selectionMode={selected.size > 0} releaseSubscribed={state.releaseSubscriptions.includes(repo.full_name)} mutating={mutating.has(repo.full_name)} activeCategory={category} activeLanguage={language} activeTopics={topicFilters} activePlatforms={platformFilters} onSelectedChange={(value) => setSelected((current) => { const next = new Set(current); if (value) next.add(repo.full_name); else next.delete(repo.full_name); return next; })} onEdit={() => { if (aiBatchRunning) setAiFollowPaused(true); setEditing(repo); }} onDetails={() => { if (aiBatchRunning) setAiFollowPaused(true); setDetails(repo); }} onOrganize={() => void runAi(repo)} onToggleRelease={() => toggleRelease(repo.full_name)} onUnstar={() => void unstar(repo)} onFilterCategory={(value) => setCategory((current) => current === value ? "" : value)} onFilterLanguage={(value) => setLanguage((current) => current === value ? "" : value)} onFilterTopic={toggleTopic} onFilterPlatform={togglePlatform} />; })}</div></>}
      </SkeletonReveal>
      <RepositoryEditor repository={editing} meta={editing ? metaFor(editing) : emptyMeta()} categories={state.categories} open={Boolean(editing)} onClose={() => setEditing(null)} onManageCategories={() => goToSettings("categories")} onSave={(meta) => editing ? updateMeta(editing, meta) : false} />
      <RepositoryDetail open={Boolean(details)} repository={details} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} onClose={() => setDetails(null)} previousDisabled={detailIndex <= 0} nextDisabled={detailIndex < 0 || detailIndex >= filtered.length - 1} onPrevious={() => { if (detailIndex > 0) setDetails(filtered[detailIndex - 1]); }} onNext={() => { if (detailIndex >= 0 && detailIndex < filtered.length - 1) setDetails(filtered[detailIndex + 1]); }} />
      <AlertDialog open={batchUnstarOpen} onOpenChange={setBatchUnstarOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("取消这些仓库的 Star？", "Unstar selected repositories?")}</AlertDialogTitle><AlertDialogDescription>{t(`将对 GitHub 执行取消 Star，并从当前 Star 集合移除 ${selected.size} 个仓库。失败项会保留选中，方便重试。`, `This will unstar ${selected.size} repositories on GitHub and remove them from your Star collection. Failed items will stay selected for retry.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} label={t("按住取消 Star", "Hold to unstar")} confirmedLabel={t("正在取消", "Unstarring")} ariaLabel={t(`按住 1.2 秒取消所选 ${selected.size} 个仓库的 Star`, `Hold for 1.2 seconds to unstar ${selected.size} selected repositories`)} icon={<StarIcon className="size-4" aria-hidden="true" />} onConfirm={() => void batchUnstar()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
