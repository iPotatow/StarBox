import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiPushpin2Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Modal } from "../../components/ui/modal.js";
import { Switch } from "../../components/ui/switch.js";
export function RepositoryEditor({ repository, meta, open, onClose, onSave }) {
    const [draft, setDraft] = useState(meta);
    useEffect(() => setDraft(meta), [meta, repository?.full_name]);
    if (!repository)
        return null;
    return (_jsx(Modal, { open: open, title: `管理 ${repository.full_name}`, description: "\u6574\u7406\u4FE1\u606F\u4F1A\u540C\u6B65\u5230 StarBox D1\uFF0C\u5E76\u53EF\u5728\u5DF2\u767B\u5F55\u8BBE\u5907\u95F4\u6062\u590D\u3002", onClose: onClose, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u5206\u7C7B", description: "\u81EA\u5B9A\u4E49\u5206\u7C7B\uFF0C\u53EF\u7528\u4E8E Stars \u7B5B\u9009\u3002", children: _jsx(Input, { value: draft.category, placeholder: "\u4F8B\u5982\uFF1A\u5F00\u53D1\u5DE5\u5177", onChange: (e) => setDraft({ ...draft, category: e.target.value }) }) }), _jsx(Field, { label: "\u5907\u6CE8", children: _jsx(Textarea, { value: draft.note, placeholder: "\u8BB0\u5F55\u4E3A\u4EC0\u4E48\u6536\u85CF\u3001\u4F7F\u7528\u573A\u666F\u6216\u5F85\u529E\u3002", onChange: (e) => setDraft({ ...draft, note: e.target.value }) }) }), draft.aiSummary ? _jsx(Field, { label: "AI \u6458\u8981", children: _jsx(Textarea, { value: draft.aiSummary, onChange: (e) => setDraft({ ...draft, aiSummary: e.target.value }) }) }) : null, _jsxs("label", { className: "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm", children: [_jsx(RiPushpin2Line, { className: "size-4", "aria-hidden": "true" }), _jsx("span", { className: "flex-1", children: "\u7F6E\u9876\u6B64\u4ED3\u5E93" }), _jsx(Switch, { checked: draft.pinned, onCheckedChange: (checked) => setDraft({ ...draft, pinned: checked }), "aria-label": "\u7F6E\u9876\u6B64\u4ED3\u5E93" })] }), _jsxs("div", { className: "mt-2 flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "\u53D6\u6D88" }), _jsx(Button, { onClick: () => { onSave(draft); onClose(); }, children: "\u4FDD\u5B58" })] })] }) }));
}
