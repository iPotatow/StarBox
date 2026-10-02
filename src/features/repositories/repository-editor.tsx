import { Gear as SettingsIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import type { CategoryDefinition, Repository, RepositoryMeta } from "../../types";
import { useI18n } from "../../lib/i18n";

interface RepositoryEditorProps {
  repository: Repository | null;
  meta: RepositoryMeta;
  categories: CategoryDefinition[];
  open: boolean;
  onClose: () => void;
  onSave: (meta: RepositoryMeta) => Promise<boolean | void> | boolean | void;
  onManageCategories: () => void;
}

export function RepositoryEditor({ repository, meta, categories, open, onClose, onSave, onManageCategories }: RepositoryEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(meta);
  const initialMeta = useRef(meta);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    initialMeta.current = meta;
    setDraft(meta);
    setDiscardOpen(false);
    setManageOpen(false);
    setSaving(false);
    setSaveError("");
    // Remote metadata updates must not overwrite an open editing draft.
    // Capture the latest value when the editor is opened or changes repository.
  }, [open, repository?.full_name]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialMeta.current), [draft]);
  if (!repository) return null;

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  async function saveDraft(closeAfter: boolean) {
    if (!dirty || saving) return true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await onSave(draft);
      if (result === false) {
        setSaveError(t("保存失败，请检查错误后重试。", "Save failed. Check the error and try again.", "儲存失敗，請檢查錯誤後重試。"));
        return false;
      }
      if (closeAfter) onClose();
      return true;
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : t("保存失败，请稍后重试。", "Save failed. Try again later.", "儲存失敗，請稍後重試。"));
      return false;
    } finally {
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

  return <>
    <ResponsiveDialog
      open={open}
      title={t(`管理 ${repository.full_name}`, `Manage ${repository.full_name}`, `管理 ${repository.full_name}`)}
      description={t("备注、分类和 AI 分析会同步到你的 StarBox 账户。", "Notes, categories, and AI analysis sync to your StarBox account.", "備註、分類和 AI 分析會同步到你的 StarBox 帳戶。")}
      onClose={requestClose}
      footer={<><Button variant="ghost" disabled={saving} onClick={requestClose}>{t("取消", "Cancel", "取消")}</Button><Button disabled={!dirty || saving} loading={saving} onClick={() => void saveDraft(true)}>{t("保存", "Save", "儲存")}</Button></>}
    >
      <div className="grid min-w-0 gap-4">
        <Field className="min-w-0" label={t("分类", "Category", "分類")} description={t("分类由 Settings 统一管理，避免在仓库编辑器里产生重复分类。", "Categories are managed in Settings to avoid duplicates.", "分類由 Settings 統一管理，避免在儲存庫編輯器裡產生重複分類。")}>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Select className="min-w-0" value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value, categoryLocked: Boolean(value) })} items={[{ value: "", label: t("未分类", "Uncategorized", "未分類") }, ...([...categories].sort((a, b) => a.order - b.order).map((item) => ({ value: String(item.name), label: item.name })))]} />
            <Button type="button" variant="outline" onClick={requestManageCategories}><SettingsIcon className="size-4" aria-hidden="true" />{t("管理分类", "Manage categories", "管理分類")}</Button>
          </div>
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
          <div className="min-w-0"><p className="text-sm font-medium">{t("保护手动分类", "Protect manual category", "保護手動分類")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("开启后，AI 重新分析不会替换此仓库的分类；清空分类会自动关闭保护。", "When enabled, AI re-analysis will not replace this repository category. Clearing the category turns protection off.", "開啟後，AI 重新分析不會替換此儲存庫的分類；清空分類會自動關閉保護。")}</p></div>
          <Switch checked={Boolean(draft.category && draft.categoryLocked)} disabled={!draft.category} onCheckedChange={(checked) => setDraft({ ...draft, categoryLocked: Boolean(draft.category) && checked })} aria-label={t("保护手动分类", "Protect manual category", "保護手動分類")} />
        </div>
        <Field label={t("备注", "Notes", "備註")}><Textarea value={draft.note} placeholder={t("记录为什么收藏、使用场景或待办。", "Why you saved it, use cases, or todos.", "記錄為什麼收藏、使用場景或待辦。")} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        {draft.aiSummary ? <Field label={t("AI 摘要", "AI summary", "AI 摘要")}><Textarea value={draft.aiSummary} onChange={(e) => setDraft({ ...draft, aiSummary: e.target.value })} /></Field> : null}
        {saveError ? <Alert variant="error"><AlertDescription>{saveError}</AlertDescription></Alert> : null}
      </div>
    </ResponsiveDialog>

    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader><AlertDialogTitle>{t("放弃未保存修改？", "Discard unsaved changes?", "放棄未儲存修改？")}</AlertDialogTitle><AlertDialogDescription>{t("关闭编辑器后，本次对分类、备注和 AI 摘要的修改不会保存。", "Closing the editor will discard changes to category, notes, and AI summary.", "關閉編輯器後，本次對分類、備註和 AI 摘要的修改不會儲存。")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("继续编辑", "Keep editing", "繼續編輯")}</AlertDialogClose><Button variant="destructive" onClick={() => { setDiscardOpen(false); setDraft(meta); onClose(); }}>{t("放弃修改", "Discard changes", "放棄修改")}</Button></AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>

    <AlertDialog open={manageOpen} onOpenChange={setManageOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader><AlertDialogTitle>{t("先处理未保存修改", "Handle unsaved changes first", "先處理未儲存修改")}</AlertDialogTitle><AlertDialogDescription>{t("前往分类管理会离开当前仓库编辑器。可以先保存当前修改，或放弃后继续。", "Opening category management leaves this editor. Save your changes first or discard them to continue.", "前往分類管理會離開當前儲存庫編輯器。可以先儲存當前修改，或放棄後繼續。")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>{t("继续编辑", "Keep editing", "繼續編輯")}</AlertDialogClose>
          <Button variant="outline" disabled={saving} onClick={() => { setManageOpen(false); setDraft(meta); onClose(); onManageCategories(); }}>{t("放弃并前往", "Discard and continue", "放棄並前往")}</Button>
          <Button loading={saving} onClick={() => void (async () => { const saved = await saveDraft(false); if (saved) { setManageOpen(false); onClose(); onManageCategories(); } })()}>{t("保存并前往", "Save and continue", "儲存並前往")}</Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  </>;
}
