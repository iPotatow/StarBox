import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { Switch } from "../../components/ui/switch.js";
import { Tooltip } from "../../components/ui/tooltip.js";
import { notify } from "../../components/ui/toast.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];
const colorClass = { neutral: "bg-muted-foreground", blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
export function CategorySettingsPanel({ state, onStateChange }) {
    const [name, setName] = useState("");
    const [nameDrafts, setNameDrafts] = useState({});
    const [error, setError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    async function commit(optimistic, operation, payload) {
        setError("");
        try {
            await runOptimisticMutation(state, optimistic, onStateChange, { operation, payload });
            notify("分类已更新", "", "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "分类保存失败");
        }
    }
    function add() { const value = name.trim(); if (!value)
        return; if (state.categories.some((item) => item.name.trim().toLowerCase() === value.toLowerCase())) {
        setError("已存在同名分类");
        return;
    } const category = { id: `cat-${Date.now()}`, name: value, color: "neutral", order: state.categories.length, locked: false }; const categories = [...state.categories, category].map((item, index) => ({ ...item, order: index })); void commit({ ...state, categories }, "category.create", { id: category.id, name: category.name, color: category.color, sortOrder: category.order, locked: category.locked }); setName(""); }
    function update(category, patch) { const nextName = patch.name?.trim() || category.name; const nextCategory = { ...category, ...patch, name: nextName }; const categories = state.categories.map((item) => item.id === category.id ? nextCategory : item).sort((a, b) => a.order - b.order); const repositoryMeta = nextName === category.name ? state.repositoryMeta : Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: nextName } : meta])); void commit({ ...state, categories, repositoryMeta }, "category.update", { id: nextCategory.id, name: nextCategory.name, color: nextCategory.color, sortOrder: nextCategory.order, locked: nextCategory.locked }); }
    function commitName(category) { const draft = nameDrafts[category.id]; if (draft === undefined)
        return; const nextName = draft.trim(); if (!nextName || nextName === category.name) {
        setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; });
        return;
    } if (state.categories.some((item) => item.id !== category.id && item.name.trim().toLowerCase() === nextName.toLowerCase())) {
        setError("已存在同名分类");
        return;
    } setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; }); update(category, { name: nextName }); }
    function move(index, delta) { const list = [...state.categories].sort((a, b) => a.order - b.order); const target = index + delta; if (target < 0 || target >= list.length)
        return; [list[index], list[target]] = [list[target], list[index]]; const categories = list.map((item, order) => ({ ...item, order })); void commit({ ...state, categories }, "category.reorder", { categories: categories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })) }); }
    function remove(category) { const repositoryMeta = Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: "" } : meta])); const categories = state.categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order })); void commit({ ...state, categories, repositoryMeta }, "category.delete", { id: category.id }); setDeleteTarget(null); }
    const sorted = [...state.categories].sort((a, b) => a.order - b.order);
    return _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Input, { className: "max-w-sm", value: name, onChange: (event) => setName(event.target.value), placeholder: "\u65B0\u5206\u7C7B\u540D\u79F0", onKeyDown: (event) => { if (event.key === "Enter")
                            add(); } }), _jsx(Button, { onClick: add, children: "\u65B0\u5EFA\u5206\u7C7B" })] }), error ? _jsx("p", { className: "text-sm text-destructive-foreground", role: "alert", children: error }) : null, _jsxs(Table, { variant: "card", children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "\u540D\u79F0" }), _jsx(TableHead, { className: "w-36", children: "\u989C\u8272" }), _jsx(TableHead, { className: "w-24", children: "AI \u9501\u5B9A" }), _jsx(TableHead, { className: "w-36", children: "\u987A\u5E8F" }), _jsx(TableHead, { className: "w-24 text-right", children: "\u64CD\u4F5C" })] }) }), _jsx(TableBody, { children: sorted.map((category, index) => _jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx(Input, { value: nameDrafts[category.id] ?? category.name, onChange: (event) => setNameDrafts((current) => ({ ...current, [category.id]: event.target.value })), onBlur: () => commitName(category), onKeyDown: (event) => { if (event.key === "Enter") {
                                            commitName(category);
                                            event.currentTarget.blur();
                                        }
                                        else if (event.key === "Escape") {
                                            setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; });
                                            event.currentTarget.blur();
                                        } } }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `size-2.5 rounded-full ${colorClass[category.color] || colorClass.neutral}`, "aria-hidden": "true" }), _jsx(Select, { value: category.color, onChange: (event) => update(category, { color: event.target.value }), children: colors.map((color) => _jsx("option", { value: color, children: color }, color)) })] }) }), _jsx(TableCell, { children: _jsx(Tooltip, { content: "\u9501\u5B9A\u540E AI \u6574\u7406\u4E0D\u4F1A\u81EA\u52A8\u6539\u5199\u8BE5\u5206\u7C7B", children: _jsx("span", { children: _jsx(Switch, { checked: category.locked, onCheckedChange: (locked) => update(category, { locked }), "aria-label": `锁定 ${category.name}` }) }) }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", disabled: index === 0, onClick: () => move(index, -1), children: "\u4E0A\u79FB" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: index === sorted.length - 1, onClick: () => move(index, 1), children: "\u4E0B\u79FB" })] }) }), _jsx(TableCell, { className: "text-right", children: _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setDeleteTarget(category), children: "\u5220\u9664" }) })] }, category.id)) })] }), !sorted.length ? _jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "\u8FD8\u6CA1\u6709\u81EA\u5B9A\u4E49\u5206\u7C7B" }) : null, _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (open) => { if (!open)
                    setDeleteTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u5220\u9664\u5206\u7C7B\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5220\u9664\u201C", deleteTarget?.name, "\u201D\u540E\uFF0C\u4F7F\u7528\u8BE5\u5206\u7C7B\u7684\u4ED3\u5E93\u4F1A\u53D8\u4E3A\u672A\u5206\u7C7B\u3002\u6B64\u64CD\u4F5C\u4F1A\u540C\u6B65\u5230 D1\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => { if (deleteTarget)
                                        remove(deleteTarget); }, children: "\u5220\u9664" })] })] }) })] });
}
