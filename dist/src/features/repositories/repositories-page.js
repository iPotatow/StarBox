import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiMagicLine, RiNotification2Line, RiRefreshLine, RiSearchLine, RiStarLine, } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { RepositoryCardSkeleton } from "../../components/ui/skeleton.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../../components/ui/toolbar.js";
import { notify } from "../../components/ui/toast.js";
import { batchStarAction, organizeRepository, refreshCanonicalState, unstarRepository } from "../../lib/api.js";
import { cn } from "../../lib/cn.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
import { emptyMeta } from "../../lib/storage.js";
import { RepositoryCard } from "./repository-card.js";
import { RepositoryDetail } from "./repository-detail.js";
import { RepositoryEditor } from "./repository-editor.js";
export function RepositoriesPage({ state, onStateChange, onSync, syncing, syncError, syncWarning, syncSuccess, goToSettings, loading = false, }) {
    const [query, setQuery] = useState(() => readQueryParam("q"));
    const [language, setLanguage] = useState(() => readQueryParam("language"));
    const [category, setCategory] = useState(() => readQueryParam("category"));
    const [sort, setSort] = useState(() => { const value = readQueryParam("sort"); return value === "stars" ? "stars" : value === "active" || value === "updated" ? "active" : "starred"; });
    const [editing, setEditing] = useState(null);
    const [details, setDetails] = useState(null);
    const [aiLoading, setAiLoading] = useState(null);
    const [aiBatchRunning, setAiBatchRunning] = useState(false);
    const [aiBatchPaused, setAiBatchPaused] = useState(false);
    const [aiBatchProgress, setAiBatchProgress] = useState({ done: 0, total: 0 });
    const aiPauseRef = useRef(false);
    const [selected, setSelected] = useState(() => new Set());
    const [batchCategory, setBatchCategory] = useState("");
    const [mutating, setMutating] = useState(() => new Set());
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    const [batchUnstarOpen, setBatchUnstarOpen] = useState(false);
    const [unstarTarget, setUnstarTarget] = useState(null);
    useEffect(() => { replaceQueryParams({ q: query, language, category, sort: sort === "starred" ? "" : sort, direction: "", view: "" }); }, [query, language, category, sort]);
    const metaFor = (repo) => state.repositoryMeta[repo.full_name] ?? emptyMeta();
    const sortedCategories = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
    const languages = useMemo(() => Array.from(new Set(state.repositories.map((repo) => repo.language).filter(Boolean))).sort(), [state.repositories]);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const next = state.repositories.filter((repo) => {
            const meta = state.repositoryMeta[repo.full_name] ?? emptyMeta();
            const haystack = [repo.full_name, repo.description, repo.language, ...repo.topics, meta.category, meta.note, meta.aiSummary, ...meta.aiTags].filter(Boolean).join(" ").toLowerCase();
            return (!needle || haystack.includes(needle)) && (!language || repo.language === language) && (!category || (category === "__uncategorized" ? !meta.category : meta.category === category));
        });
        return next.sort((a, b) => {
            const pinDelta = Number(metaFor(b).pinned) - Number(metaFor(a).pinned);
            if (pinDelta)
                return pinDelta;
            const delta = sort === "stars"
                ? a.stargazers_count - b.stargazers_count
                : sort === "active"
                    ? new Date(a.pushed_at || a.updated_at).getTime() - new Date(b.pushed_at || b.updated_at).getTime()
                    : new Date(a.starred_at || 0).getTime() - new Date(b.starred_at || 0).getTime();
            return -delta;
        });
    }, [state.repositories, state.repositoryMeta, query, language, category, sort]);
    const aiEnabled = Boolean(state.settings.ai.baseUrl && state.settings.ai.apiKey && state.settings.ai.model);
    const hasGithubCredential = Boolean(state.settings.githubToken.trim() || state.settings.credentialConnected);
    function feedback(error = "", success = "") { setActionError(error); setActionSuccess(success); if (success)
        notify(success, "", "success"); }
    function ensureCategory(categories, name) { if (!name.trim() || categories.some((item) => item.name === name.trim()))
        return categories; return [...categories, { id: `cat-${Date.now()}-${categories.length}`, name: name.trim(), color: "neutral", order: categories.length, locked: false }]; }
    async function updateMeta(repo, meta) { try {
        const categoryId = state.categories.find((item) => item.name === meta.category)?.id ?? "";
        await runOptimisticMutation(state, { ...state, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: meta } }, onStateChange, { operation: "repository_meta.update", payload: { fullName: repo.full_name, categoryId, note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } });
        feedback("", "仓库信息已保存");
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "仓库信息保存失败");
    } }
    async function runAi(repo) { setAiLoading(repo.full_name); feedback(); try {
        const result = await organizeRepository(state.settings.ai, repo);
        const current = metaFor(repo);
        const locked = state.categories.some((item) => item.name === current.category && item.locked);
        const nextCategory = locked ? current.category : result.category;
        const nextCategories = ensureCategory(state.categories, nextCategory);
        const categoryDefinition = nextCategories.find((item) => item.name === nextCategory);
        const nextMeta = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags };
        await runOptimisticMutation(state, { ...state, categories: nextCategories, repositoryMeta: { ...state.repositoryMeta, [repo.full_name]: nextMeta } }, onStateChange, { operation: "repository_meta.ai", payload: { fullName: repo.full_name, categoryId: categoryDefinition?.id ?? "", category: categoryDefinition ? { id: categoryDefinition.id, name: categoryDefinition.name, color: categoryDefinition.color, sortOrder: categoryDefinition.order, locked: categoryDefinition.locked } : undefined, note: nextMeta.note, pinned: nextMeta.pinned, aiSummary: nextMeta.aiSummary, aiTags: nextMeta.aiTags } });
        feedback("", `${repo.full_name} 已完成 AI 整理`);
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "AI 整理失败");
    }
    finally {
        setAiLoading(null);
    } }
    async function runAiBatch() { const names = Array.from(selected); if (!names.length || !aiEnabled || aiBatchRunning)
        return; setAiBatchRunning(true); setAiBatchPaused(false); aiPauseRef.current = false; setAiBatchProgress({ done: 0, total: names.length }); feedback(); let nextMeta = { ...state.repositoryMeta }; let nextCategories = [...state.categories]; let failures = 0; for (let index = 0; index < names.length; index += 1) {
        while (aiPauseRef.current)
            await new Promise((resolve) => setTimeout(resolve, 200));
        const repo = state.repositories.find((item) => item.full_name === names[index]);
        if (!repo)
            continue;
        try {
            const result = await organizeRepository(state.settings.ai, repo);
            const current = nextMeta[repo.full_name] ?? emptyMeta();
            const locked = nextCategories.some((item) => item.name === current.category && item.locked);
            const nextCategory = locked ? current.category : result.category;
            nextCategories = ensureCategory(nextCategories, nextCategory);
            nextMeta[repo.full_name] = { ...current, category: nextCategory, aiSummary: result.summary, aiTags: result.tags };
        }
        catch {
            failures += 1;
        }
        setAiBatchProgress({ done: index + 1, total: names.length });
    } const optimistic = { ...state, repositoryMeta: nextMeta, categories: nextCategories }; try {
        const items = names.map((fullName) => { const meta = nextMeta[fullName]; const categoryDefinition = nextCategories.find((item) => item.name === meta?.category); return meta ? { fullName, categoryId: categoryDefinition?.id ?? "", note: meta.note, pinned: meta.pinned, aiSummary: meta.aiSummary, aiTags: meta.aiTags } : null; }).filter(Boolean);
        await runOptimisticMutation(state, optimistic, onStateChange, { operation: "repository_meta.ai_batch", payload: { categories: nextCategories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })), items } });
    }
    catch {
        failures += Math.max(1, names.length - failures);
    } setAiBatchRunning(false); setAiBatchPaused(false); aiPauseRef.current = false; feedback(failures ? `${Math.max(0, names.length - failures)} 个完成，${failures} 个失败` : "", failures ? "" : `已完成 ${names.length} 个仓库的 AI 整理`); }
    function togglePause() { const next = !aiBatchPaused; setAiBatchPaused(next); aiPauseRef.current = next; }
    async function toggleRelease(fullName) { const exists = state.releaseSubscriptions.includes(fullName); try {
        await runOptimisticMutation(state, { ...state, releaseSubscriptions: exists ? state.releaseSubscriptions.filter((item) => item !== fullName) : [...state.releaseSubscriptions, fullName] }, onStateChange, { operation: exists ? "release.unsubscribe" : "release.subscribe", payload: { repoFullName: fullName } });
        feedback("", exists ? `已取消 ${fullName} 的 Release 订阅` : `已订阅 ${fullName} 的 Release`);
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "Release 订阅更新失败");
    } }
    async function unstar(repo) { setUnstarTarget(null); if (!hasGithubCredential)
        return goToSettings(); setMutating((current) => new Set(current).add(repo.full_name)); feedback(); const previous = state; const optimistic = { ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) }; onStateChange(optimistic); try {
        await unstarRepository(state.settings.githubToken.trim(), repo.full_name);
        onStateChange(await refreshCanonicalState(optimistic));
        setSelected((current) => { const next = new Set(current); next.delete(repo.full_name); return next; });
        feedback("", `已取消 Star：${repo.full_name}`);
    }
    catch (error) {
        onStateChange(previous);
        feedback(error instanceof Error ? error.message : "取消 Star 失败");
    }
    finally {
        setMutating((current) => { const next = new Set(current); next.delete(repo.full_name); return next; });
    } }
    async function batchUnstar() { const names = Array.from(selected); if (!names.length)
        return; if (!hasGithubCredential)
        return goToSettings("account"); setBatchUnstarOpen(false); feedback(); try {
        const results = await batchStarAction(state.settings.githubToken.trim(), names, "unstar");
        const succeeded = new Set(results.filter((item) => item.ok).map((item) => item.fullName));
        const failed = results.filter((item) => !item.ok);
        onStateChange({ ...state, repositories: state.repositories.filter((item) => !succeeded.has(item.full_name)) });
        setSelected(new Set(failed.map((item) => item.fullName)));
        if (failed.length)
            feedback(`${succeeded.size} 个成功，${failed.length} 个失败：${failed[0].error || failed[0].fullName}`);
        else
            feedback("", `已取消 ${succeeded.size} 个仓库的 Star`);
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "批量操作失败");
    } }
    async function batchSubscribe() { const names = Array.from(selected); const next = new Set(state.releaseSubscriptions); names.forEach((name) => next.add(name)); try {
        await runOptimisticMutation(state, { ...state, releaseSubscriptions: Array.from(next) }, onStateChange, { operation: "release.subscribe.batch", payload: { repoFullNames: names } });
        feedback("", `已批量订阅 ${selected.size} 个仓库的 Release`);
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "批量订阅失败");
    } }
    async function applyBatchCategory() { if (!selected.size)
        return; const nextMeta = { ...state.repositoryMeta }; const names = Array.from(selected); names.forEach((name) => { nextMeta[name] = { ...(nextMeta[name] ?? emptyMeta()), category: batchCategory }; }); const categoryId = state.categories.find((item) => item.name === batchCategory)?.id ?? ""; try {
        await runOptimisticMutation(state, { ...state, repositoryMeta: nextMeta }, onStateChange, { operation: "repository_meta.batch_category", payload: { fullName: names[0], repoFullNames: names, categoryId, note: "", pinned: false } });
        feedback("", batchCategory ? `已批量设置分类：${batchCategory}` : "已批量清除分类");
    }
    catch (error) {
        feedback(error instanceof Error ? error.message : "批量分类失败");
    } }
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Stars" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: state.lastSyncAt ? `上次同步 ${new Date(state.lastSyncAt).toLocaleString("zh-CN")} · ${state.repositories.length} 个仓库` : `${state.repositories.length} 个仓库` })] }), _jsxs(Button, { onClick: onSync, loading: syncing, children: [_jsx(RiRefreshLine, { className: cn("size-4", syncing && "animate-spin") }), "\u540C\u6B65 Stars"] })] }), _jsx(StatusBanner, { error: syncError || actionError, warning: !syncError && !actionError ? syncWarning : "", success: !syncError && !actionError && !syncWarning ? actionSuccess || syncSuccess : "" }), _jsxs(Toolbar, { className: "mb-5", "aria-label": "Stars \u5DE5\u5177\u680F", children: [_jsx(ToolbarGroup, { className: "min-w-[240px] flex-1", children: _jsxs("div", { className: "relative w-full", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "w-full min-w-[220px] pl-9", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u4ED3\u5E93\u3001\u63CF\u8FF0\u3001\u6807\u7B7E\u3001\u5907\u6CE8\u2026" })] }) }), _jsx(ToolbarSeparator, {}), _jsxs(ToolbarGroup, { children: [_jsxs(Select, { value: category, onChange: (event) => setCategory(event.target.value), className: "min-w-32", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u5206\u7C7B" }), _jsx("option", { value: "__uncategorized", children: "\u672A\u5206\u7C7B" }), sortedCategories.map((item) => _jsx("option", { value: item.name, children: item.name }, item.id))] }), _jsxs(Select, { value: language, onChange: (event) => setLanguage(event.target.value), className: "min-w-32", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u8BED\u8A00" }), languages.map((item) => _jsx("option", { children: item }, item))] }), _jsxs(Select, { value: sort, onChange: (event) => setSort(event.target.value), className: "min-w-32", children: [_jsx("option", { value: "starred", children: "\u6700\u8FD1\u661F\u6807" }), _jsx("option", { value: "active", children: "\u6700\u8FD1\u6D3B\u8DC3" }), _jsx("option", { value: "stars", children: "\u6700\u591A\u661F\u6807" })] })] })] }), (query || language || category) ? _jsxs("div", { className: "-mt-2 mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { children: "\u5F53\u524D\u7B5B\u9009\uFF1A" }), query ? _jsxs(Button, { size: "sm", variant: "outline", onClick: () => setQuery(""), children: ["\u641C\u7D22\uFF1A", query, " \u00D7"] }) : null, category ? _jsxs(Button, { size: "sm", variant: "outline", onClick: () => setCategory(""), children: ["\u5206\u7C7B\uFF1A", category === "__uncategorized" ? "未分类" : category, " \u00D7"] }) : null, language ? _jsxs(Button, { size: "sm", variant: "outline", onClick: () => setLanguage(""), children: ["\u8BED\u8A00\uFF1A", language, " \u00D7"] }) : null, _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { setQuery(""); setCategory(""); setLanguage(""); }, children: "\u6E05\u9664\u7B5B\u9009" })] }) : null, selected.size ? _jsx("div", { className: "pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4", children: _jsxs("div", { className: "pointer-events-auto grid max-w-[calc(100vw-2rem)] gap-1.5 rounded-2xl border border-foreground/10 bg-foreground px-3 py-2 text-background shadow-2xl", children: [_jsxs("div", { className: "flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: [_jsxs("span", { className: "shrink-0 px-2 text-sm font-medium", children: ["\u5DF2\u9009 ", selected.size, " \u4E2A"] }), _jsx("span", { className: "h-5 w-px shrink-0 bg-background/20", "aria-hidden": "true" }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setSelected(new Set(filtered.map((item) => item.full_name))), children: "\u9009\u62E9\u5F53\u524D\u7B5B\u9009\u7ED3\u679C" }), _jsxs(Select, { value: batchCategory, onChange: (event) => setBatchCategory(event.target.value), sizeVariant: "sm", className: "w-32 shrink-0", children: [_jsx("option", { value: "", children: "\u672A\u5206\u7C7B" }), sortedCategories.map((item) => _jsx("option", { children: item.name }, item.id))] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: applyBatchCategory, children: "\u5E94\u7528\u5206\u7C7B" }), _jsxs(Button, { size: "sm", variant: "secondary", onClick: batchSubscribe, children: [_jsx(RiNotification2Line, { className: "size-4" }), "\u8BA2\u9605 Release"] }), aiEnabled ? _jsxs(Button, { size: "sm", variant: "secondary", onClick: () => void runAiBatch(), disabled: aiBatchRunning, children: [_jsx(RiMagicLine, { className: "size-4" }), "\u6279\u91CF AI"] }) : null, aiBatchRunning ? _jsx(Button, { size: "sm", variant: "secondary", onClick: togglePause, children: aiBatchPaused ? "继续" : "暂停" }) : null, _jsxs(Button, { size: "sm", variant: "destructive", onClick: () => setBatchUnstarOpen(true), children: [_jsx(RiStarLine, { className: "size-4" }), "\u53D6\u6D88 Star"] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setSelected(new Set()), children: "\u6E05\u9664" })] }), aiBatchRunning ? _jsxs("div", { className: "px-2 text-xs text-background/70", children: ["AI \u8FDB\u5EA6\uFF1A", aiBatchProgress.done, "/", aiBatchProgress.total, aiBatchPaused ? " · 已暂停" : ""] }) : null] }) }) : null, loading ? _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 9 }, (_, index) => _jsx(RepositoryCardSkeleton, {}, index)) })
                : state.repositories.length === 0 ? _jsx("div", { className: "grid min-h-[48vh] place-items-center rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center", children: _jsxs("div", { className: "max-w-sm", children: [_jsx("div", { className: "mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-card", children: _jsx(RiStarLine, { className: "size-5" }) }), _jsx("h2", { className: "mt-4 text-base font-semibold", children: "\u8FD8\u6CA1\u6709\u4ED3\u5E93" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-muted-foreground", children: "\u5148\u5728\u8BBE\u7F6E\u91CC\u8FDE\u63A5 GitHub\uFF0C\u7136\u540E\u540C\u6B65\u73B0\u6709 Stars\u3002" }), _jsx(Button, { className: "mt-4", variant: "outline", onClick: goToSettings, children: "\u6253\u5F00\u8BBE\u7F6E" })] }) })
                    : filtered.length === 0 ? _jsx("div", { className: "grid min-h-64 place-items-center rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground", children: _jsxs("div", { children: [_jsx("p", { children: "\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u7684\u4ED3\u5E93" }), _jsx(Button, { className: "mt-3", size: "sm", variant: "outline", onClick: () => { setQuery(""); setCategory(""); setLanguage(""); }, children: "\u6E05\u9664\u7B5B\u9009" })] }) })
                        : _jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between text-xs text-muted-foreground", children: [_jsxs("span", { children: [filtered.length, " \u4E2A\u4ED3\u5E93"] }), _jsx("span", { children: sort === "starred" ? "最近星标" : sort === "active" ? "最近活跃" : "最多星标" })] }), _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: filtered.map((repo) => { const meta = metaFor(repo); return _jsx(RepositoryCard, { repository: repo, meta: meta, density: state.settings.density, aiEnabled: aiEnabled, aiLoading: aiLoading === repo.full_name, selected: selected.has(repo.full_name), releaseSubscribed: state.releaseSubscriptions.includes(repo.full_name), mutating: mutating.has(repo.full_name), onSelectedChange: (value) => setSelected((current) => { const next = new Set(current); if (value)
                                            next.add(repo.full_name);
                                        else
                                            next.delete(repo.full_name); return next; }), onEdit: () => setEditing(repo), onDetails: () => setDetails(repo), onOrganize: () => void runAi(repo), onTogglePin: () => updateMeta(repo, { ...meta, pinned: !meta.pinned }), onToggleRelease: () => toggleRelease(repo.full_name), onUnstar: () => setUnstarTarget(repo) }, repo.full_name); }) })] }), _jsx(RepositoryEditor, { repository: editing, meta: editing ? metaFor(editing) : emptyMeta(), categories: state.categories, open: Boolean(editing), onClose: () => setEditing(null), onManageCategories: () => goToSettings("categories"), onSave: (meta) => { if (editing)
                    updateMeta(editing, meta); } }), _jsx(RepositoryDetail, { open: Boolean(details), repository: details, token: state.settings.githubToken, credentialConnected: state.settings.credentialConnected, onClose: () => setDetails(null) }), _jsx(AlertDialog, { open: Boolean(unstarTarget), onOpenChange: (open) => { if (!open)
                    setUnstarTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u53D6\u6D88 Star\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5C06\u4ECE GitHub \u53D6\u6D88 Star\uFF0C\u5E76\u4ECE\u5F53\u524D Stars \u96C6\u5408\u79FB\u9664 ", unstarTarget?.full_name ?? "该仓库", "\u3002\u6B64\u64CD\u4F5C\u9700\u8981\u518D\u6B21\u786E\u8BA4\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => { if (unstarTarget)
                                        void unstar(unstarTarget); }, children: "\u53D6\u6D88 Star" })] })] }) }), _jsx(AlertDialog, { open: batchUnstarOpen, onOpenChange: setBatchUnstarOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u53D6\u6D88\u8FD9\u4E9B\u4ED3\u5E93\u7684 Star\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5C06\u5BF9 GitHub \u6267\u884C\u53D6\u6D88 Star\uFF0C\u5E76\u4ECE\u5F53\u524D Stars \u96C6\u5408\u79FB\u9664 ", selected.size, " \u4E2A\u4ED3\u5E93\u3002\u5931\u8D25\u9879\u4F1A\u4FDD\u7559\u9009\u4E2D\uFF0C\u65B9\u4FBF\u91CD\u8BD5\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => void batchUnstar(), children: "\u53D6\u6D88 Star" })] })] }) })] }));
}
