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
import { useI18n } from "../../lib/i18n.js";
const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];
const colorClass = { neutral: "bg-muted-foreground", blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
export function CategorySettingsPanel({ state, onStateChange }) {
    const { t } = useI18n();
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
            notify(t("分类已更新", "Categories updated"), "", "success");
            return true;
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("分类保存失败", "Failed to save category"));
            return false;
        }
    }
    function add() {
        const value = name.trim();
        if (!value)
            return;
        if (state.categories.some((item) => item.name.trim().toLowerCase() === value.toLowerCase())) {
            setError(t("已存在同名分类", "A category with this name already exists"));
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
            setError(t("分类名称不能为空", "Category name cannot be empty"));
            return;
        }
        if (state.categories.some((item) => item.id !== category.id && item.name.trim().toLowerCase() === nextName.toLowerCase())) {
            setError(t("已存在同名分类", "A category with this name already exists"));
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
    return (_jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Input, { className: "max-w-sm", value: name, onChange: (event) => setName(event.target.value), placeholder: t("新分类名称", "New category name"), onKeyDown: (event) => { if (event.key === "Enter")
                            add(); } }), _jsx(Button, { onClick: add, children: t("新建分类", "Create category") })] }), error ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: error }) }) : null, _jsxs("div", { className: "overflow-hidden rounded-xl border border-border/70", children: [sorted.map((category, index) => {
                        const editing = editingId === category.id;
                        return _jsxs("div", { className: "border-b border-border/70 last:border-b-0", children: [_jsxs("div", { className: "flex min-h-12 items-center gap-3 px-3 py-2", children: [_jsx("span", { className: `size-2.5 shrink-0 rounded-full ${colorClass[category.color] || colorClass.neutral}`, "aria-hidden": "true" }), _jsx(Button, { variant: "link", size: "none", className: "min-w-0 flex-1 justify-start truncate text-left text-sm font-medium", onClick: () => startEdit(category), children: category.name }), category.locked ? _jsx("span", { className: "rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground", children: t("AI 锁定", "AI locked") }) : null, _jsx("span", { className: "w-10 text-right text-xs tabular-nums text-muted-foreground", title: t(`${counts[category.name] ?? 0} 个仓库`, `${counts[category.name] ?? 0} repositories`), children: counts[category.name] ?? 0 }), _jsxs(Menu, { children: [_jsx(MenuTrigger, { render: _jsx(Button, { variant: "ghost", size: "icon-sm", "aria-label": t(`${category.name} 更多操作`, `More actions for ${category.name}`) }), children: _jsx(RiMoreLine, { className: "size-4" }) }), _jsxs(MenuPopup, { children: [_jsx(MenuItem, { onClick: () => startEdit(category), children: t("编辑分类", "Edit category") }), index > 0 ? _jsx(MenuItem, { onClick: () => move(index, -1), children: t("上移", "Move up") }) : null, index < sorted.length - 1 ? _jsx(MenuItem, { onClick: () => move(index, 1), children: t("下移", "Move down") }) : null, _jsx(MenuSeparator, {}), _jsx(MenuItem, { className: "text-destructive-foreground", onClick: () => setDeleteTarget(category), children: t("删除分类", "Delete category") })] })] })] }), editing ? _jsxs("div", { className: "grid gap-4 border-t border-border/60 bg-secondary/20 px-3 py-4", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]", children: [_jsx(Input, { value: nameDrafts[category.id] ?? category.name, autoFocus: true, onChange: (event) => setNameDrafts((current) => ({ ...current, [category.id]: event.target.value })), onBlur: () => commitName(category), onKeyDown: (event) => { if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        commitName(category);
                                                    }
                                                    else if (event.key === "Escape") {
                                                        event.preventDefault();
                                                        cancelName(category);
                                                    } } }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "ghost", onMouseDown: (event) => event.preventDefault(), onClick: () => cancelName(category), children: t("取消", "Cancel") }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "mr-1 text-xs text-muted-foreground", children: t("颜色", "Color") }), colors.map((color) => _jsxs(Button, { variant: "ghost", size: "none", "aria-label": t(`颜色 ${color}`, `Color ${color}`), "aria-pressed": category.color === color, onClick: () => update(category, { color }), className: `grid size-8 place-items-center rounded-full ${category.color === color ? "ring-2 ring-foreground/30" : ""}`, children: [_jsx("span", { className: `size-4 rounded-full ${colorClass[color]}` }), category.color === color ? _jsx(RiCheckLine, { className: "absolute size-3 text-white" }) : null] }, color)), _jsxs("span", { className: "ml-auto flex items-center gap-2 text-xs text-muted-foreground", children: [t("AI 锁定", "AI locked"), " ", _jsx(Switch, { checked: category.locked, onCheckedChange: (locked) => update(category, { locked }), "aria-label": t(`AI 锁定 ${category.name}`, `AI lock ${category.name}`) })] })] })] }) : null] }, category.id);
                    }), !sorted.length ? _jsx("div", { className: "px-4 py-8 text-center text-sm text-muted-foreground", children: t("还没有自定义分类", "No custom categories yet") }) : null] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "size-2.5 rounded-full bg-muted-foreground/40" }), _jsx("span", { children: t("未分类", "Uncategorized") }), _jsx("span", { className: "ml-auto tabular-nums", children: Object.values(state.repositoryMeta).filter((meta) => !meta.category).length })] }), _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (open) => { if (!open)
                    setDeleteTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("删除分类？", "Delete category?") }), _jsx(AlertDialogDescription, { children: t(`删除“${deleteTarget?.name}”后，使用该分类的仓库会变为未分类。更改会同步到你的 StarBox 账户。`, `Deleting “${deleteTarget?.name}” will move repositories in this category to Uncategorized. The change syncs to your StarBox account.`) })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("取消", "Cancel") }), _jsx(Button, { variant: "destructive", onClick: () => { if (deleteTarget)
                                        remove(deleteTarget); }, children: t("删除", "Delete") })] })] }) })] }));
}
