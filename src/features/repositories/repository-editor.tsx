import { RiPushpin2Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { Switch } from "../../components/ui/switch";
import type { Repository, RepositoryMeta } from "../../types";

export function RepositoryEditor({ repository, meta, open, onClose, onSave }: { repository: Repository | null; meta: RepositoryMeta; open: boolean; onClose: () => void; onSave: (meta: RepositoryMeta) => void; }) {
  const [draft, setDraft] = useState(meta);
  useEffect(() => setDraft(meta), [meta, repository?.full_name]);
  if (!repository) return null;

  return (
    <Modal open={open} title={`管理 ${repository.full_name}`} description="整理信息会同步到 StarBox D1，并可在已登录设备间恢复。" onClose={onClose}>
      <div className="grid gap-4">
        <Field label="分类" description="自定义分类，可用于 Stars 筛选。">
          <Input value={draft.category} placeholder="例如：开发工具" onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        </Field>
        <Field label="备注"><Textarea value={draft.note} placeholder="记录为什么收藏、使用场景或待办。" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        {draft.aiSummary ? <Field label="AI 摘要"><Textarea value={draft.aiSummary} onChange={(e) => setDraft({ ...draft, aiSummary: e.target.value })} /></Field> : null}
        <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
          <RiPushpin2Line className="size-4" aria-hidden="true" />
          <span className="flex-1">置顶此仓库</span>
          <Switch checked={draft.pinned} onCheckedChange={(checked) => setDraft({ ...draft, pinned: checked })} aria-label="置顶此仓库" />
        </label>
        <div className="mt-2 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>取消</Button><Button onClick={() => { onSave(draft); onClose(); }}>保存</Button></div>
      </div>
    </Modal>
  );
}
