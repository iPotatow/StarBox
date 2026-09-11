import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiAddLine, RiFolder3Line, RiRefreshLine, RiSearchLine, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Checkbox } from "../../components/ui/checkbox.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Modal } from "../../components/ui/modal.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { createGithubList, deleteGithubList, fetchGithubLists, setGithubListMembership, updateGithubList } from "../../lib/api.js";
export function ListsPage({ state, onStateChange, goToSettings }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [selectedId, setSelectedId] = useState(state.githubLists[0]?.id || "");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [createPrivate, setCreatePrivate] = useState(false);
    const [saving, setSaving] = useState(false);
    const selected = state.githubLists.find((item) => item.id === selectedId) ?? state.githubLists[0] ?? null;
    async function syncLists() {
        if (!hasGithubCredential)
            return goToSettings();
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const lists = await fetchGithubLists(token);
            onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() });
            if (!selectedId && lists[0])
                setSelectedId(lists[0].id);
            setSuccess(`已同步 ${lists.length} 个 GitHub Lists`);
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
    async function createList() {
        if (!name.trim())
            return;
        setSaving(true);
        setError("");
        try {
            const created = await createGithubList(token, name.trim(), description.trim(), createPrivate);
            const lists = [...state.githubLists, created];
            onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() });
            setSelectedId(created.id);
            setCreateOpen(false);
            setName("");
            setDescription("");
            setCreatePrivate(false);
            setSuccess(`已创建 List：${created.name}`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "List 创建失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function saveList(list) {
        setSaving(true);
        setError("");
        try {
            const next = await updateGithubList(token, list.id, list.name, list.description, list.isPrivate);
            onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === list.id ? { ...next, items: item.items } : item) });
            setSuccess("List 设置已保存");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "保存失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function removeList(list) {
        if (!window.confirm(`删除 GitHub List “${list.name}”？`))
            return;
        setSaving(true);
        setError("");
        try {
            await deleteGithubList(token, list.id);
            const lists = state.githubLists.filter((item) => item.id !== list.id);
            onStateChange({ ...state, githubLists: lists });
            setSelectedId(lists[0]?.id || "");
            setSuccess("List 已删除");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "删除失败");
        }
        finally {
            setSaving(false);
        }
    }
    async function toggleMembership(fullName, listId, active) {
        setSaving(true);
        setError("");
        try {
            const memberships = state.githubLists.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
            const desired = active ? Array.from(new Set([...memberships, listId])) : memberships.filter((id) => id !== listId);
            const repository = state.repositories.find((item) => item.full_name === fullName);
            const listItem = { id: fullName, fullName, htmlUrl: repository?.html_url ?? `https://github.com/${fullName}` };
            const optimisticLists = state.githubLists.map((list) => list.id === listId ? { ...list, items: active ? [...list.items.filter((item) => item.fullName !== fullName), listItem] : list.items.filter((item) => item.fullName !== fullName) } : list);
            await setGithubListMembership(token, fullName, desired);
            onStateChange({ ...state, githubLists: optimisticLists });
            setSuccess(active ? `已加入 ${fullName}` : `已移出 ${fullName}`);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "List membership 更新失败");
        }
        finally {
            setSaving(false);
        }
    }
    const localCandidates = useMemo(() => {
        if (!selected)
            return [];
        const needle = query.trim().toLowerCase();
        return state.repositories.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle));
    }, [selected, state.repositories, query]);
    if (!hasGithubCredential)
        return _jsxs("div", { className: "mx-auto max-w-4xl px-4 py-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "GitHub Lists" }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "\u8FDE\u63A5 GitHub \u51ED\u636E\u540E\u53EF\u540C\u6B65\u548C\u7F16\u8F91 GitHub Star Lists\u3002" }), _jsxs(Button, { className: "mt-4", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] });
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6 flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "GitHub Lists" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u4E0E GitHub Star Lists \u53CC\u5411\u540C\u6B65\u3002Membership \u5199\u5165\u4F1A\u4FDD\u7559\u4ED3\u5E93\u5728\u5176\u4ED6 Lists \u4E2D\u7684\u5F52\u5C5E\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => setCreateOpen(true), children: [_jsx(RiAddLine, { className: "size-4" }), "\u65B0\u5EFA List"] }), _jsxs(Button, { onClick: () => void syncLists(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u540C\u6B65 Lists"] })] })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]", children: [_jsxs(Card, { render: _jsx("aside", {}), className: "rounded-xl p-2 shadow-card", children: [_jsxs("div", { className: "px-2 py-2 text-xs font-semibold text-muted-foreground", children: [state.githubLists.length, " \u4E2A Lists"] }), state.githubLists.map((list) => _jsxs(Button, { variant: "ghost", size: "none", onClick: () => setSelectedId(list.id), className: `mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected?.id === list.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`, children: [_jsx(RiFolder3Line, { className: "size-4" }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: list.name }), _jsx("span", { className: "text-xs", children: list.items.length })] }, list.id)), !state.githubLists.length ? _jsx("div", { className: "px-3 py-10 text-center text-sm text-muted-foreground", children: "\u8FD8\u6CA1\u6709 Lists" }) : null] }), _jsx("section", { className: "min-w-0", children: selected ? _jsxs("div", { className: "grid gap-4", children: [_jsxs(Card, { className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(Input, { value: selected.name, onChange: (event) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, name: event.target.value } : item) }) }) }), _jsx(Field, { label: "\u53EF\u89C1\u6027", children: _jsxs("label", { className: "flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm", children: [_jsx(Checkbox, { checked: selected.isPrivate, onCheckedChange: (checked) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, isPrivate: checked } : item) }), "aria-label": "Private" }), "Private"] }) })] }), _jsx(Field, { label: "\u63CF\u8FF0", children: _jsx(Textarea, { rows: 2, value: selected.description, onChange: (event) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, description: event.target.value } : item) }) }) }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx(Button, { loading: saving, onClick: () => void saveList(selected), children: "\u4FDD\u5B58" }), _jsx(Button, { variant: "destructive", disabled: saving, onClick: () => void removeList(selected), children: "\u5220\u9664" })] })] }), _jsxs(Card, { className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx(RiSearchLine, { className: "size-4 text-muted-foreground" }), _jsx(Input, { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u672C\u5730 Stars \u5E76\u8C03\u6574\u5F53\u524D List membership" })] }), _jsxs("div", { className: "grid gap-2", children: [localCandidates.map((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border px-3 py-2", children: [_jsx("img", { src: repo.owner.avatar_url, alt: "", className: "size-8 rounded-md" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-sm font-medium", children: repo.full_name }), _jsx("div", { className: "truncate text-xs text-muted-foreground", children: repo.description || "暂无描述" })] }), _jsx(Button, { size: "sm", variant: active ? "secondary" : "outline", loading: saving, onClick: () => void toggleMembership(repo.full_name, selected.id, !active), children: active ? "移出" : "加入" })] }, repo.full_name); }), !localCandidates.length ? _jsx("div", { className: "py-10 text-center text-sm text-muted-foreground", children: "\u6CA1\u6709\u5339\u914D\u7684 Stars" }) : null] })] })] }) : _jsx("div", { className: "grid min-h-72 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground", children: "\u521B\u5EFA\u6216\u540C\u6B65\u4E00\u4E2A GitHub List \u540E\u5F00\u59CB\u7BA1\u7406" }) })] }), _jsx(Modal, { open: createOpen, title: "\u65B0\u5EFA GitHub List", onClose: () => setCreateOpen(false), children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(Input, { autoFocus: true, value: name, onChange: (event) => setName(event.target.value) }) }), _jsx(Field, { label: "\u63CF\u8FF0", children: _jsx(Textarea, { rows: 3, value: description, onChange: (event) => setDescription(event.target.value) }) }), _jsxs("label", { className: "flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm", children: [_jsx(Checkbox, { checked: createPrivate, onCheckedChange: setCreatePrivate, "aria-label": "Private List" }), "Private List"] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setCreateOpen(false), children: "\u53D6\u6D88" }), _jsx(Button, { loading: saving, onClick: () => void createList(), children: "\u521B\u5EFA" })] })] }) })] }));
}
