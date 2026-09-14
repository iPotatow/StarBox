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
import { useI18n } from "../../lib/i18n.js";
export function RepositoryEditor({ repository, meta, categories, open, onClose, onSave, onManageCategories }) {
    const { t } = useI18n();
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
                setSaveError(t("保存失败，请检查错误后重试。", "Save failed. Check the error and try again."));
                return false;
            }
            if (closeAfter)
                onClose();
            return true;
        }
        catch (reason) {
            setSaveError(reason instanceof Error ? reason.message : t("保存失败，请稍后重试。", "Save failed. Try again later."));
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
    return _jsxs(_Fragment, { children: [_jsx(Modal, { open: open, title: t(`管理 ${repository.full_name}`, `Manage ${repository.full_name}`), description: t("备注、分类和 AI 分析会同步到你的 StarBox 账户。", "Notes, categories, and AI analysis sync to your StarBox account."), onClose: requestClose, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: t("分类", "Category"), description: t("分类由 Settings 统一管理，避免在仓库编辑器里产生重复分类。", "Categories are managed in Settings to avoid duplicates."), children: _jsxs("div", { className: "flex w-full gap-2", children: [_jsxs(Select, { className: "flex-1", value: draft.category, onChange: (event) => setDraft({ ...draft, category: event.target.value }), children: [_jsx("option", { value: "", children: t("未分类", "Uncategorized") }), [...categories].sort((a, b) => a.order - b.order).map((item) => _jsx("option", { value: item.name, children: item.name }, item.id))] }), _jsxs(Button, { type: "button", variant: "outline", onClick: requestManageCategories, children: [_jsx(RiSettings4Line, { className: "size-4" }), t("管理分类", "Manage categories")] })] }) }), _jsx(Field, { label: t("备注", "Notes"), children: _jsx(Textarea, { value: draft.note, placeholder: t("记录为什么收藏、使用场景或待办。", "Why you saved it, use cases, or todos."), onChange: (e) => setDraft({ ...draft, note: e.target.value }) }) }), draft.aiSummary ? _jsx(Field, { label: t("AI 摘要", "AI summary"), children: _jsx(Textarea, { value: draft.aiSummary, onChange: (e) => setDraft({ ...draft, aiSummary: e.target.value }) }) }) : null, saveError ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: saveError }) }) : null, _jsxs("div", { className: "mt-2 flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", disabled: saving, onClick: requestClose, children: t("取消", "Cancel") }), _jsx(Button, { disabled: !dirty || saving, loading: saving, onClick: () => void saveDraft(true), children: t("保存", "Save") })] })] }) }), _jsx(AlertDialog, { open: discardOpen, onOpenChange: setDiscardOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("放弃未保存修改？", "Discard unsaved changes?") }), _jsx(AlertDialogDescription, { children: t("关闭编辑器后，本次对分类、备注和 AI 摘要的修改不会保存。", "Closing the editor will discard changes to category, notes, and AI summary.") })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("继续编辑", "Keep editing") }), _jsx(Button, { variant: "destructive", onClick: () => { setDiscardOpen(false); setDraft(meta); onClose(); }, children: t("放弃修改", "Discard changes") })] })] }) }), _jsx(AlertDialog, { open: manageOpen, onOpenChange: setManageOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("先处理未保存修改", "Handle unsaved changes first") }), _jsx(AlertDialogDescription, { children: t("前往分类管理会离开当前仓库编辑器。可以先保存当前修改，或放弃后继续。", "Opening category management leaves this editor. Save your changes first or discard them to continue.") })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("继续编辑", "Keep editing") }), _jsx(Button, { variant: "outline", disabled: saving, onClick: () => { setManageOpen(false); setDraft(meta); onClose(); onManageCategories(); }, children: t("放弃并前往", "Discard and continue") }), _jsx(Button, { loading: saving, onClick: () => void (async () => { const saved = await saveDraft(false); if (saved) {
                                        setManageOpen(false);
                                        onClose();
                                        onManageCategories();
                                    } })(), children: t("保存并前往", "Save and continue") })] })] }) })] });
}
