import { RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import type { CategoryDefinition, Repository, RepositoryMeta } from "../../types";

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
        setSaveError("保存失败，请检查错误后重试。");
        return false;
      }
      if (closeAfter) onClose();
      return true;
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "保存失败，请稍后重试。");
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
    <Modal open={open} title={`管理 ${repository.full_name}`} description="备注、分类和 AI 分析会同步到你的 StarBox 账户。" onClose={requestClose}>
      <div className="grid gap-4">
        <Field label="分类" description="分类由 Settings 统一管理，避免在仓库编辑器里产生重复分类。">
          <div className="flex w-full gap-2">
            <Select className="flex-1" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              <option value="">未分类</option>
              {[...categories].sort((a, b) => a.order - b.order).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </Select>
            <Button type="button" variant="outline" onClick={requestManageCategories}><RiSettings4Line className="size-4" />管理分类</Button>
          </div>
        </Field>
        <Field label="备注"><Textarea value={draft.note} placeholder="记录为什么收藏、使用场景或待办。" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        {draft.aiSummary ? <Field label="AI 摘要"><Textarea value={draft.aiSummary} onChange={(e) => setDraft({ ...draft, aiSummary: e.target.value })} /></Field> : null}
        {saveError ? <Alert variant="error"><AlertDescription>{saveError}</AlertDescription></Alert> : null}
        <div className="mt-2 flex justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={requestClose}>取消</Button><Button disabled={!dirty || saving} loading={saving} onClick={() => void saveDraft(true)}>保存</Button></div>
      </div>
    </Modal>

    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader><AlertDialogTitle>放弃未保存修改？</AlertDialogTitle><AlertDialogDescription>关闭编辑器后，本次对分类、备注和 AI 摘要的修改不会保存。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>继续编辑</AlertDialogClose><Button variant="destructive" onClick={() => { setDiscardOpen(false); setDraft(meta); onClose(); }}>放弃修改</Button></AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>

    <AlertDialog open={manageOpen} onOpenChange={setManageOpen}>
      <AlertDialogPopup>
        <AlertDialogHeader><AlertDialogTitle>先处理未保存修改</AlertDialogTitle><AlertDialogDescription>前往分类管理会离开当前仓库编辑器。可以先保存当前修改，或放弃后继续。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>继续编辑</AlertDialogClose>
          <Button variant="outline" disabled={saving} onClick={() => { setManageOpen(false); setDraft(meta); onClose(); onManageCategories(); }}>放弃并前往</Button>
          <Button loading={saving} onClick={() => void (async () => { const saved = await saveDraft(false); if (saved) { setManageOpen(false); onClose(); onManageCategories(); } })()}>保存并前往</Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  </>;
}
