import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiAddLine, RiFolder3Line, RiRefreshLine, RiSearchLine, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Checkbox } from "../../components/ui/checkbox.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Modal } from "../../components/ui/modal.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { ListSkeleton, Skeleton } from "../../components/ui/skeleton.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { notify } from "../../components/ui/toast.js";
import { createGithubList, deleteGithubList, fetchGithubLists, setGithubListMembership, updateGithubList } from "../../lib/api.js";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
const draftFor = (list) => ({ name: list.name, description: list.description, isPrivate: list.isPrivate });
export function ListsPage({ state, onStateChange, goToSettings, initialLoading = false }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [selectedId, setSelectedId] = useState(() => readQueryParam("list") || state.githubLists[0]?.id || "");
    const [query, setQuery] = useState(() => readQueryParam("q"));
    const [membershipFilter, setMembershipFilter] = useState(() => { const value = readQueryParam("membership"); return value === "joined" || value === "not-joined" ? value : "all"; });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [createPrivate, setCreatePrivate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingRepository, setPendingRepository] = useState("");
    const [draft, setDraft] = useState(null);
    const [switchTarget, setSwitchTarget] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [createError, setCreateError] = useState("");
    const selected = state.githubLists.find((item) => item.id === selectedId) ?? state.githubLists[0] ?? null;
    const dirty = Boolean(selected && draft && (draft.name !== selected.name || draft.description !== selected.description || draft.isPrivate !== selected.isPrivate));
    useEffect(() => { if (selected && (!draft || selected.id !== selectedId))
        setDraft(draftFor(selected)); }, [selected?.id]);
    useEffect(() => { replaceQueryParams({ list: selected?.id || "", q: query, membership: membershipFilter === "all" ? "" : membershipFilter }); }, [selected?.id, query, membershipFilter]);
    async function syncLists() {
        if (!hasGithubCredential)
            return goToSettings();
        setLoading(true);
        setError("");
        try {
            const lists = await fetchGithubLists(token);
            onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() });
            const nextId = lists.some((item) => item.id === selectedId) ? selectedId : lists[0]?.id || "";
            setSelectedId(nextId);
            setDraft(lists.find((item) => item.id === nextId) ? draftFor(lists.find((item) => item.id === nextId)) : null);
            notify("Lists 已同步", `${lists.length} 个 GitHub Lists`, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Lists 同步失败");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (hasGithubCredential && !state.lastListSyncAt && !loading)
        void syncLists(); }, [hasGithubCredential]);
    function requestSelect(id) { if (id === selected?.id)
        return; if (dirty)
        setSwitchTarget(id);
    else {
        setSelectedId(id);
        const list = state.githubLists.find((item) => item.id === id);
        setDraft(list ? draftFor(list) : null);
    } }
    function discardAndSwitch() { const id = switchTarget; setSwitchTarget(""); setSelectedId(id); const list = state.githubLists.find((item) => item.id === id); setDraft(list ? draftFor(list) : null); }
    async function createList() {
        const trimmed = name.trim();
        setCreateError("");
        if (!trimmed)
            return setCreateError("请输入 List 名称");
        if (state.githubLists.some((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()))
            return setCreateError("已存在同名 List");
        setSaving(true);
        setError("");
        try {
            const created = await createGithubList(token, trimmed, description.trim(), createPrivate);
            const lists = [...state.githubLists, created];
            onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() });
            setSelectedId(created.id);
            setDraft(draftFor(created));
            setCreateOpen(false);
            setName("");
            setDescription("");
            setCreatePrivate(false);
            notify("List 已创建", created.name, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "List 创建失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function saveList() {
        if (!selected || !draft)
            return;
        const trimmed = draft.name.trim();
        if (!trimmed)
            return setError("List 名称不能为空");
        if (state.githubLists.some((item) => item.id !== selected.id && item.name.trim().toLowerCase() === trimmed.toLowerCase()))
            return setError("已存在同名 List");
        setSaving(true);
        setError("");
        try {
            const next = await updateGithubList(token, selected.id, trimmed, draft.description.trim(), draft.isPrivate);
            const lists = state.githubLists.map((item) => item.id === selected.id ? { ...next, items: item.items } : item);
            onStateChange({ ...state, githubLists: lists });
            setDraft(draftFor({ ...next, items: selected.items }));
            notify("List 已保存", next.name, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "保存失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function removeList() {
        const list = deleteTarget;
        if (!list)
            return;
        setSaving(true);
        setError("");
        try {
            await deleteGithubList(token, list.id);
            const lists = state.githubLists.filter((item) => item.id !== list.id);
            onStateChange({ ...state, githubLists: lists });
            const next = lists[0] ?? null;
            setSelectedId(next?.id || "");
            setDraft(next ? draftFor(next) : null);
            setDeleteTarget(null);
            notify("List 已删除", list.name, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "删除失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function toggleMembership(fullName, listId, active) {
        setPendingRepository(fullName);
        setError("");
        const previous = state.githubLists;
        try {
            const memberships = previous.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
            const desired = active ? Array.from(new Set([...memberships, listId])) : memberships.filter((id) => id !== listId);
            const repository = state.repositories.find((item) => item.full_name === fullName);
            const listItem = { id: fullName, fullName, htmlUrl: repository?.html_url ?? `https://github.com/${fullName}` };
            const optimisticLists = previous.map((list) => list.id === listId ? { ...list, items: active ? [...list.items.filter((item) => item.fullName !== fullName), listItem] : list.items.filter((item) => item.fullName !== fullName) } : list);
            onStateChange({ ...state, githubLists: optimisticLists });
            await setGithubListMembership(token, fullName, desired);
            notify(active ? "已加入 List" : "已移出 List", fullName, "success");
        }
        catch (reason) {
            onStateChange({ ...state, githubLists: previous });
            setError(reason instanceof Error ? reason.message : "List membership 更新失败");
        }
        finally {
            setPendingRepository("");
        }
    }
    const localCandidates = useMemo(() => {
        if (!selected)
            return [];
        const needle = query.trim().toLowerCase();
        return state.repositories.filter((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return (!needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)) && (membershipFilter === "all" || (membershipFilter === "joined" ? active : !active)); });
    }, [selected, state.repositories, query, membershipFilter]);
    if (!hasGithubCredential)
        return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "GitHub Lists" }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "\u8FDE\u63A5 GitHub \u51ED\u636E\u540E\u53EF\u540C\u6B65\u548C\u7F16\u8F91 GitHub Star Lists\u3002" }), _jsxs(Button, { className: "mt-4", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] });
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6 flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "GitHub Lists" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u7F16\u8F91\u4F7F\u7528\u672C\u5730\u8349\u7A3F\uFF1B\u53EA\u6709\u201C\u4FDD\u5B58\u201D\u624D\u5199\u5165 GitHub\uFF0C\u53D6\u6D88\u4F1A\u6062\u590D\u5DF2\u4FDD\u5B58\u72B6\u6001\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => setCreateOpen(true), children: [_jsx(RiAddLine, { className: "size-4" }), "\u65B0\u5EFA List"] }), _jsxs(Button, { onClick: () => void syncLists(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u540C\u6B65 Lists"] })] })] }), _jsx(StatusBanner, { error: error }), (initialLoading || loading) && !state.githubLists.length ? _jsxs("div", { className: "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]", children: [_jsxs(Card, { className: "rounded-xl p-3", children: [_jsx(Skeleton, { className: "mb-3 h-5 w-20" }), _jsx(ListSkeleton, { rows: 5 })] }), _jsxs(Card, { className: "rounded-xl p-4", children: [_jsx(Skeleton, { className: "mb-4 h-8 w-1/2" }), _jsx(ListSkeleton, { rows: 6 })] })] }) : _jsxs("div", { className: "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]", children: [_jsxs(Card, { render: _jsx("aside", {}), className: "rounded-xl p-2 shadow-card", children: [_jsxs("div", { className: "px-2 py-2 text-xs font-semibold text-muted-foreground", children: [state.githubLists.length, " \u4E2A Lists"] }), state.githubLists.map((list) => _jsxs(Button, { variant: "ghost", size: "none", onClick: () => requestSelect(list.id), className: `mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected?.id === list.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`, children: [_jsx(RiFolder3Line, { className: "size-4" }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: list.name }), _jsx("span", { className: "text-xs", children: list.items.length })] }, list.id)), !state.githubLists.length ? _jsx("div", { className: "px-3 py-10 text-center text-sm text-muted-foreground", children: "\u8FD8\u6CA1\u6709 Lists" }) : null] }), _jsx("section", { className: "min-w-0", children: selected && draft ? _jsxs("div", { className: "grid gap-4", children: [_jsxs(Card, { className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(Input, { value: draft.name, onChange: (event) => setDraft({ ...draft, name: event.target.value }) }) }), _jsx(Field, { label: "\u53EF\u89C1\u6027", children: _jsxs("label", { className: "flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm", children: [_jsx(Checkbox, { checked: draft.isPrivate, onCheckedChange: (checked) => setDraft({ ...draft, isPrivate: checked }), "aria-label": "Private List" }), "Private List"] }) })] }), _jsx(Field, { label: "\u63CF\u8FF0", children: _jsx(Textarea, { rows: 2, value: draft.description, onChange: (event) => setDraft({ ...draft, description: event.target.value }) }) }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx(Button, { loading: saving, disabled: !dirty, onClick: () => void saveList(), children: "\u4FDD\u5B58" }), _jsx(Button, { variant: "ghost", disabled: !dirty || saving, onClick: () => setDraft(draftFor(selected)), children: "\u53D6\u6D88\u4FEE\u6539" }), _jsx(Button, { variant: "destructive", disabled: saving, onClick: () => setDeleteTarget(selected), children: "\u5220\u9664" }), dirty ? _jsx("span", { className: "self-center text-xs text-warning-foreground", children: "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539" }) : null] })] }), _jsxs(Card, { className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "relative", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "pl-9", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u672C\u5730 Stars" })] }), _jsxs(ToggleGroup, { value: [membershipFilter], onValueChange: (values) => { const value = values.at(-1); if (value === "all" || value === "joined" || value === "not-joined")
                                                        setMembershipFilter(value); }, children: [_jsx(ToggleGroupItem, { value: "all", className: "w-auto px-2.5 text-xs", children: "\u5168\u90E8" }), _jsx(ToggleGroupItem, { value: "joined", className: "w-auto px-2.5 text-xs", children: "\u5DF2\u52A0\u5165" }), _jsx(ToggleGroupItem, { value: "not-joined", className: "w-auto px-2.5 text-xs", children: "\u672A\u52A0\u5165" })] })] }), _jsxs("div", { className: "grid gap-2", children: [localCandidates.map((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border px-3 py-2", children: [_jsx("img", { src: repo.owner.avatar_url, alt: "", className: "size-8 rounded-md" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-sm font-medium", children: repo.full_name }), _jsx("div", { className: "truncate text-xs text-muted-foreground", children: repo.description || "暂无描述" })] }), _jsx(Button, { size: "sm", variant: active ? "secondary" : "outline", loading: pendingRepository === repo.full_name, disabled: Boolean(pendingRepository && pendingRepository !== repo.full_name), onClick: () => void toggleMembership(repo.full_name, selected.id, !active), children: active ? "移出" : "加入" })] }, repo.full_name); }), !localCandidates.length ? _jsx("p", { className: "py-8 text-center text-sm text-muted-foreground", children: "\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u7684\u4ED3\u5E93" }) : null] })] })] }) : _jsx("div", { className: "grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground", children: "\u9009\u62E9\u6216\u521B\u5EFA\u4E00\u4E2A GitHub List" }) })] }), _jsx(Modal, { open: createOpen, title: "\u65B0\u5EFA GitHub List", onClose: () => setCreateOpen(false), children: _jsxs("form", { className: "grid gap-4", onSubmit: (event) => { event.preventDefault(); void createList(); }, children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(Input, { required: true, value: name, onChange: (event) => { setName(event.target.value); setCreateError(""); }, autoFocus: true }) }), _jsx(Field, { label: "\u63CF\u8FF0", children: _jsx(Textarea, { value: description, onChange: (event) => setDescription(event.target.value) }) }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx(Checkbox, { checked: createPrivate, onCheckedChange: setCreatePrivate }), "Private List"] }), createError ? _jsx("p", { className: "text-sm text-destructive-foreground", role: "alert", children: createError }) : null, _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => setCreateOpen(false), children: "\u53D6\u6D88" }), _jsx(Button, { type: "submit", loading: saving, children: "\u521B\u5EFA" })] })] }) }), _jsx(AlertDialog, { open: Boolean(switchTarget), onOpenChange: (open) => { if (!open)
                    setSwitchTarget(""); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u653E\u5F03\u4FEE\u6539\u5E76\u5207\u6362\uFF1F" }), _jsx(AlertDialogDescription, { children: "\u5F53\u524D List \u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u5207\u6362\u540E\u8FD9\u4E9B\u672C\u5730\u8349\u7A3F\u4F1A\u88AB\u4E22\u5F03\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u7EE7\u7EED\u7F16\u8F91" }), _jsx(Button, { variant: "destructive", onClick: discardAndSwitch, children: "\u653E\u5F03\u5E76\u5207\u6362" })] })] }) }), _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (open) => { if (!open)
                    setDeleteTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u5220\u9664 GitHub List\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5C06\u5220\u9664\u201C", deleteTarget?.name, "\u201D\u53CA\u5176 GitHub List membership\uFF1B\u4E0D\u4F1A\u53D6\u6D88\u4ED3\u5E93\u7684 Star\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", loading: saving, onClick: () => void removeList(), children: "\u5220\u9664" })] })] }) })] });
}
