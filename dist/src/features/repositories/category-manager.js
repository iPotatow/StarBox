import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiMoreLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../../components/ui/menu.js";
import { Switch } from "../../components/ui/switch.js";
import { notify } from "../../components/ui/toast.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];
const colorClass = { neutral: "bg-muted-foreground", blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
export function CategorySettingsPanel({ state, onStateChange }) {
    const [name, setName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [nameDrafts, setNameDrafts] = useState({});
    const [error, setError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const sorted = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
    const counts = useMemo(() => Object.values(state.repositoryMeta).reduce((acc, meta) => { if (meta.category)
        acc[meta.category] = (acc[meta.category] ?? 0) + 1; return acc; }, {}), [state.repositoryMeta]);
    async function commit(optimistic, operation, payload) {
        setError("");
        try {
            await runOptimisticMutation(state, optimistic, onStateChange, { operation, payload });
            notify("分类已更新", "", "success");
            return true;
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "分类保存失败");
            return false;
        }
    }
    function add() {
        const value = name.trim();
        if (!value)
            return;
        if (state.categories.some((item) => item.name.trim().toLowerCase() === value.toLowerCase())) {
            setError("已存在同名分类");
            return;
        }
        const category = { id: `cat-${Date.now()}`, name: value, color: "neutral", order: state.categories.length, locked: false };
        const categories = [...state.categories, category].map((item, index) => ({ ...item, order: index }));
        void commit({ ...state, categories }, "category.create", { id: category.id, name: category.name, color: category.color, sortOrder: category.order, locked: category.locked });
        setName("");
    }
    function update(category, patch) {
        const nextName = patch.name?.trim() || category.name;
        const nextCategory = { ...category, ...patch, name: nextName };
        const categories = state.categories.map((item) => item.id === category.id ? nextCategory : item).sort((a, b) => a.order - b.order);
        const repositoryMeta = nextName === category.name ? state.repositoryMeta : Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: nextName } : meta]));
        void commit({ ...state, categories, repositoryMeta }, "category.update", { id: nextCategory.id, name: nextCategory.name, color: nextCategory.color, sortOrder: nextCategory.order, locked: nextCategory.locked });
    }
    function startEdit(category) { setEditingId(category.id); setNameDrafts((current) => ({ ...current, [category.id]: category.name })); setError(""); }
    function commitName(category) {
        const nextName = (nameDrafts[category.id] ?? category.name).trim();
        if (!nextName) {
            setError("分类名称不能为空");
            return;
        }
        if (state.categories.some((item) => item.id !== category.id && item.name.trim().toLowerCase() === nextName.toLowerCase())) {
            setError("已存在同名分类");
            return;
        }
        if (nextName !== category.name)
            update(category, { name: nextName });
        setEditingId(null);
        setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; });
    }
    function cancelName(category) { setEditingId(null); setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; }); setError(""); }
    function move(index, delta) {
        const list = [...sorted];
        const target = index + delta;
        if (target < 0 || target >= list.length)
            return;
        [list[index], list[target]] = [list[target], list[index]];
        const categories = list.map((item, order) => ({ ...item, order }));
        void commit({ ...state, categories }, "category.reorder", { categories: categories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })) });
    }
    function remove(category) {
        const repositoryMeta = Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: "" } : meta]));
        const categories = state.categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order }));
        void commit({ ...state, categories, repositoryMeta }, "category.delete", { id: category.id });
        setDeleteTarget(null);
        if (editingId === category.id)
            setEditingId(null);
    }
    return (_jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Input, { className: "max-w-sm", value: name, onChange: (event) => setName(event.target.value), placeholder: "\u65B0\u5206\u7C7B\u540D\u79F0", onKeyDown: (event) => { if (event.key === "Enter")
                            add(); } }), _jsx(Button, { onClick: add, children: "\u65B0\u5EFA\u5206\u7C7B" })] }), error ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: error }) }) : null, _jsxs("div", { className: "overflow-hidden rounded-xl border border-border/70", children: [sorted.map((category, index) => {
                        const editing = editingId === category.id;
                        return _jsxs("div", { className: "border-b border-border/70 last:border-b-0", children: [_jsxs("div", { className: "flex min-h-12 items-center gap-3 px-3 py-2", children: [_jsx("span", { className: `size-2.5 shrink-0 rounded-full ${colorClass[category.color] || colorClass.neutral}`, "aria-hidden": "true" }), _jsx(Button, { variant: "link", size: "none", className: "min-w-0 flex-1 justify-start truncate text-left text-sm font-medium", onClick: () => startEdit(category), children: category.name }), category.locked ? _jsx("span", { className: "rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground", children: "AI \u9501\u5B9A" }) : null, _jsx("span", { className: "w-10 text-right text-xs tabular-nums text-muted-foreground", title: `${counts[category.name] ?? 0} 个仓库`, children: counts[category.name] ?? 0 }), _jsxs(Menu, { children: [_jsx(MenuTrigger, { render: _jsx(Button, { variant: "ghost", size: "icon-sm", "aria-label": `${category.name} 更多操作` }), children: _jsx(RiMoreLine, { className: "size-4" }) }), _jsxs(MenuPopup, { children: [_jsx(MenuItem, { onClick: () => startEdit(category), children: "\u7F16\u8F91\u5206\u7C7B" }), index > 0 ? _jsx(MenuItem, { onClick: () => move(index, -1), children: "\u4E0A\u79FB" }) : null, index < sorted.length - 1 ? _jsx(MenuItem, { onClick: () => move(index, 1), children: "\u4E0B\u79FB" }) : null, _jsx(MenuSeparator, {}), _jsx(MenuItem, { className: "text-destructive-foreground", onClick: () => setDeleteTarget(category), children: "\u5220\u9664\u5206\u7C7B" })] })] })] }), editing ? _jsxs("div", { className: "grid gap-4 border-t border-border/60 bg-secondary/20 px-3 py-4", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]", children: [_jsx(Input, { value: nameDrafts[category.id] ?? category.name, autoFocus: true, onChange: (event) => setNameDrafts((current) => ({ ...current, [category.id]: event.target.value })), onBlur: () => commitName(category), onKeyDown: (event) => { if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        commitName(category);
                                                    }
                                                    else if (event.key === "Escape") {
                                                        event.preventDefault();
                                                        cancelName(category);
                                                    } } }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "ghost", onMouseDown: (event) => event.preventDefault(), onClick: () => cancelName(category), children: "\u53D6\u6D88" }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "mr-1 text-xs text-muted-foreground", children: "\u989C\u8272" }), colors.map((color) => _jsxs(Button, { variant: "ghost", size: "none", "aria-label": `颜色 ${color}`, "aria-pressed": category.color === color, onClick: () => update(category, { color }), className: `grid size-8 place-items-center rounded-full ${category.color === color ? "ring-2 ring-foreground/30" : ""}`, children: [_jsx("span", { className: `size-4 rounded-full ${colorClass[color]}` }), category.color === color ? _jsx(RiCheckLine, { className: "absolute size-3 text-white" }) : null] }, color)), _jsxs("span", { className: "ml-auto flex items-center gap-2 text-xs text-muted-foreground", children: ["AI \u9501\u5B9A ", _jsx(Switch, { checked: category.locked, onCheckedChange: (locked) => update(category, { locked }), "aria-label": `AI 锁定 ${category.name}` })] })] })] }) : null] }, category.id);
                    }), !sorted.length ? _jsx("div", { className: "px-4 py-8 text-center text-sm text-muted-foreground", children: "\u8FD8\u6CA1\u6709\u81EA\u5B9A\u4E49\u5206\u7C7B" }) : null] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "size-2.5 rounded-full bg-muted-foreground/40" }), _jsx("span", { children: "\u672A\u5206\u7C7B" }), _jsx("span", { className: "ml-auto tabular-nums", children: Object.values(state.repositoryMeta).filter((meta) => !meta.category).length })] }), _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (open) => { if (!open)
                    setDeleteTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u5220\u9664\u5206\u7C7B\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5220\u9664\u201C", deleteTarget?.name, "\u201D\u540E\uFF0C\u4F7F\u7528\u8BE5\u5206\u7C7B\u7684\u4ED3\u5E93\u4F1A\u53D8\u4E3A\u672A\u5206\u7C7B\u3002\u66F4\u6539\u4F1A\u540C\u6B65\u5230\u4F60\u7684 StarBox \u8D26\u6237\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => { if (deleteTarget)
                                        remove(deleteTarget); }, children: "\u5220\u9664" })] })] }) })] }));
}
