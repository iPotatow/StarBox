import { RiPushpin2Line, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { Switch } from "../../components/ui/switch";
import type { CategoryDefinition, Repository, RepositoryMeta } from "../../types";

export function RepositoryEditor({ repository, meta, categories, open, onClose, onSave, onManageCategories }: { repository: Repository | null; meta: RepositoryMeta; categories: CategoryDefinition[]; open: boolean; onClose: () => void; onSave: (meta: RepositoryMeta) => void; onManageCategories: () => void; }) {
  const [draft, setDraft] = useState(meta);
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => { setDraft(meta); setDiscardOpen(false); }, [meta, repository?.full_name]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(meta), [draft, meta]);
  if (!repository) return null;
  function requestClose() { if (dirty) setDiscardOpen(true); else onClose(); }
  return <>
    <Modal open={open} title={`管理 ${repository.full_name}`} description="整理信息会同步到 StarBox D1，并可在已登录设备间恢复。" onClose={requestClose}>
      <div className="grid gap-4">
        <Field label="分类" description="分类由 Settings 统一管理，避免在仓库编辑器里产生重复分类。"><div className="flex gap-2"><Select className="flex-1" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">未分类</option>{[...categories].sort((a, b) => a.order - b.order).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select><Button type="button" variant="outline" onClick={onManageCategories}><RiSettings4Line className="size-4" />管理分类</Button></div></Field>
        <Field label="备注"><Textarea value={draft.note} placeholder="记录为什么收藏、使用场景或待办。" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        {draft.aiSummary ? <Field label="AI 摘要"><Textarea value={draft.aiSummary} onChange={(e) => setDraft({ ...draft, aiSummary: e.target.value })} /></Field> : null}
        <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"><RiPushpin2Line className="size-4" /><span className="flex-1">置顶此仓库</span><Switch checked={draft.pinned} onCheckedChange={(checked) => setDraft({ ...draft, pinned: checked })} aria-label="置顶此仓库" /></label>
        <div className="mt-2 flex justify-end gap-2"><Button variant="ghost" onClick={requestClose}>取消</Button><Button disabled={!dirty} onClick={() => { onSave(draft); onClose(); }}>保存</Button></div>
      </div>
    </Modal>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>放弃未保存修改？</AlertDialogTitle><AlertDialogDescription>关闭编辑器后，本次对分类、备注、AI 摘要和置顶状态的修改不会保存。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>继续编辑</AlertDialogClose><Button variant="destructive" onClick={() => { setDiscardOpen(false); setDraft(meta); onClose(); }}>放弃修改</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </>;
}
