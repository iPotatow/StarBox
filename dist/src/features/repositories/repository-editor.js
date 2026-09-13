import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Select } from "../../components/ui/select.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Modal } from "../../components/ui/modal.js";
export function RepositoryEditor({ repository, meta, categories, open, onClose, onSave, onManageCategories }) {
    const [draft, setDraft] = useState(meta);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    useEffect(() => {
        setDraft(meta);
        setDiscardOpen(false);
        setManageOpen(false);
        setSaving(false);
        setSaveError("");
    }, [meta, repository?.full_name]);
    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(meta), [draft, meta]);
    if (!repository)
        return null;
    function requestClose() {
        if (saving)
            return;
        if (dirty)
            setDiscardOpen(true);
        else
            onClose();
    }
    async function saveDraft(closeAfter) {
        if (!dirty || saving)
            return true;
        setSaving(true);
        setSaveError("");
        try {
            const result = await onSave(draft);
            if (result === false) {
                setSaveError("保存失败，请检查错误后重试。");
                return false;
            }
            if (closeAfter)
                onClose();
            return true;
        }
        catch (reason) {
            setSaveError(reason instanceof Error ? reason.message : "保存失败，请稍后重试。");
            return false;
        }
        finally {
            setSaving(false);
        }
    }
    function requestManageCategories() {
        if (!dirty) {
            onManageCategories();
            return;
        }
        setManageOpen(true);
    }
    return _jsxs(_Fragment, { children: [_jsx(Modal, { open: open, title: `管理 ${repository.full_name}`, description: "\u6574\u7406\u4FE1\u606F\u4F1A\u540C\u6B65\u5230 StarBox D1\uFF0C\u5E76\u53EF\u5728\u5DF2\u767B\u5F55\u8BBE\u5907\u95F4\u6062\u590D\u3002", onClose: requestClose, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u5206\u7C7B", description: "\u5206\u7C7B\u7531 Settings \u7EDF\u4E00\u7BA1\u7406\uFF0C\u907F\u514D\u5728\u4ED3\u5E93\u7F16\u8F91\u5668\u91CC\u4EA7\u751F\u91CD\u590D\u5206\u7C7B\u3002", children: _jsxs("div", { className: "flex w-full gap-2", children: [_jsxs(Select, { className: "flex-1", value: draft.category, onChange: (event) => setDraft({ ...draft, category: event.target.value }), children: [_jsx("option", { value: "", children: "\u672A\u5206\u7C7B" }), [...categories].sort((a, b) => a.order - b.order).map((item) => _jsx("option", { value: item.name, children: item.name }, item.id))] }), _jsxs(Button, { type: "button", variant: "outline", onClick: requestManageCategories, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u7BA1\u7406\u5206\u7C7B"] })] }) }), _jsx(Field, { label: "\u5907\u6CE8", children: _jsx(Textarea, { value: draft.note, placeholder: "\u8BB0\u5F55\u4E3A\u4EC0\u4E48\u6536\u85CF\u3001\u4F7F\u7528\u573A\u666F\u6216\u5F85\u529E\u3002", onChange: (e) => setDraft({ ...draft, note: e.target.value }) }) }), draft.aiSummary ? _jsx(Field, { label: "AI \u6458\u8981", children: _jsx(Textarea, { value: draft.aiSummary, onChange: (e) => setDraft({ ...draft, aiSummary: e.target.value }) }) }) : null, saveError ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: saveError }) }) : null, _jsxs("div", { className: "mt-2 flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", disabled: saving, onClick: requestClose, children: "\u53D6\u6D88" }), _jsx(Button, { disabled: !dirty || saving, loading: saving, onClick: () => void saveDraft(true), children: "\u4FDD\u5B58" })] })] }) }), _jsx(AlertDialog, { open: discardOpen, onOpenChange: setDiscardOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u653E\u5F03\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1F" }), _jsx(AlertDialogDescription, { children: "\u5173\u95ED\u7F16\u8F91\u5668\u540E\uFF0C\u672C\u6B21\u5BF9\u5206\u7C7B\u3001\u5907\u6CE8\u548C AI \u6458\u8981\u7684\u4FEE\u6539\u4E0D\u4F1A\u4FDD\u5B58\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u7EE7\u7EED\u7F16\u8F91" }), _jsx(Button, { variant: "destructive", onClick: () => { setDiscardOpen(false); setDraft(meta); onClose(); }, children: "\u653E\u5F03\u4FEE\u6539" })] })] }) }), _jsx(AlertDialog, { open: manageOpen, onOpenChange: setManageOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u5148\u5904\u7406\u672A\u4FDD\u5B58\u4FEE\u6539" }), _jsx(AlertDialogDescription, { children: "\u524D\u5F80\u5206\u7C7B\u7BA1\u7406\u4F1A\u79BB\u5F00\u5F53\u524D\u4ED3\u5E93\u7F16\u8F91\u5668\u3002\u53EF\u4EE5\u5148\u4FDD\u5B58\u5F53\u524D\u4FEE\u6539\uFF0C\u6216\u653E\u5F03\u540E\u7EE7\u7EED\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u7EE7\u7EED\u7F16\u8F91" }), _jsx(Button, { variant: "outline", disabled: saving, onClick: () => { setManageOpen(false); setDraft(meta); onClose(); onManageCategories(); }, children: "\u653E\u5F03\u5E76\u524D\u5F80" }), _jsx(Button, { loading: saving, onClick: () => void (async () => { const saved = await saveDraft(false); if (saved) {
                                        setManageOpen(false);
                                        onClose();
                                        onManageCategories();
                                    } })(), children: "\u4FDD\u5B58\u5E76\u524D\u5F80" })] })] }) })] });
}
