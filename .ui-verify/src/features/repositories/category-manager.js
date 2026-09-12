import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { useState } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/react.js";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { Select } from "../../components/ui/select.js";
import { runOptimisticMutation } from "../../lib/mutations.js";
const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];
export function CategoryManager({ open, state, onStateChange, onClose }) {
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    async function commit(optimistic, operation, payload) {
        setError("");
        try {
            await runOptimisticMutation(state, optimistic, onStateChange, { operation, payload });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "分类保存失败");
        }
    }
    function add() {
        const value = name.trim();
        if (!value || state.categories.some((item) => item.name === value))
            return;
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
    function move(index, delta) {
        const list = [...state.categories].sort((a, b) => a.order - b.order);
        const target = index + delta;
        if (target < 0 || target >= list.length)
            return;
        [list[index], list[target]] = [list[target], list[index]];
        const categories = list.map((item, order) => ({ ...item, order }));
        void commit({ ...state, categories }, "category.reorder", { categories: categories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })) });
    }
    function remove(category) {
        if (!window.confirm(`删除分类“${category.name}”？仓库会变为未分类。`))
            return;
        const repositoryMeta = Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: "" } : meta]));
        const categories = state.categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order }));
        void commit({ ...state, categories, repositoryMeta }, "category.delete", { id: category.id });
    }
    const sorted = [...state.categories].sort((a, b) => a.order - b.order);
    return (_jsx(Modal, { open: open, title: "\u5206\u7C7B\u7BA1\u7406", description: "\u8C03\u6574\u5206\u7C7B\u540D\u79F0\u3001\u989C\u8272\u3001\u987A\u5E8F\u548C\u9501\u5B9A\u72B6\u6001\u3002\u9501\u5B9A\u5206\u7C7B\u4E0D\u4F1A\u88AB AI \u81EA\u52A8\u6539\u5199\u3002", onClose: onClose, children: _jsxs("div", { className: "grid gap-4", children: [error ? _jsx("p", { className: "text-sm text-destructive-foreground", role: "alert", children: error }) : null, _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: name, onChange: (event) => setName(event.target.value), placeholder: "\u65B0\u5206\u7C7B\u540D\u79F0", onKeyDown: (event) => { if (event.key === "Enter")
                                add(); } }), _jsx(Button, { onClick: add, children: "\u6DFB\u52A0" })] }), _jsxs("div", { className: "grid gap-2", children: [sorted.map((category, index) => (_jsxs("div", { className: "rounded-xl border border-border p-3", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_120px_auto]", children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(Input, { value: category.name, onChange: (event) => update(category, { name: event.target.value }) }) }), _jsx(Field, { label: "\u989C\u8272", children: _jsx(Select, { value: category.color, onChange: (event) => update(category, { color: event.target.value }), children: colors.map((color) => _jsx("option", { value: color, children: color }, color)) }) }), _jsx("div", { className: "flex items-end gap-1", children: _jsx(Button, { size: "sm", variant: category.locked ? "default" : "outline", onClick: () => update(category, { locked: !category.locked }), children: category.locked ? "已锁定" : "锁定" }) })] }), _jsxs("div", { className: "mt-2 flex gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", disabled: index === 0, onClick: () => move(index, -1), children: "\u4E0A\u79FB" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: index === sorted.length - 1, onClick: () => move(index, 1), children: "\u4E0B\u79FB" }), _jsx(Button, { size: "sm", variant: "ghost", className: "ml-auto", onClick: () => remove(category), children: "\u5220\u9664" })] })] }, category.id))), !sorted.length ? _jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "\u8FD8\u6CA1\u6709\u81EA\u5B9A\u4E49\u5206\u7C7B" }) : null] })] }) }));
}
