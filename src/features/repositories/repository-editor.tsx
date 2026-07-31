import { RiCloseLine, RiPushpin2Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input, Textarea } from "../../components/ui/input";
import type { Repository, RepositoryMeta } from "../../types";

export function RepositoryEditor({
  repository,
  meta,
  open,
  onClose,
  onSave,
}: {
  repository: Repository | null;
  meta: RepositoryMeta;
  open: boolean;
  onClose: () => void;
  onSave: (meta: RepositoryMeta) => void;
}) {
  const [draft, setDraft] = useState(meta);
  useEffect(() => setDraft(meta), [meta, repository?.full_name]);
  if (!open || !repository) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`管理 ${repository.full_name}`}
        className="w-full max-w-lg rounded-2xl border border-border bg-popover p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{repository.full_name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">本地整理信息只保存在当前浏览器。</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><RiCloseLine className="size-4" /></Button>
        </div>
        <div className="grid gap-4">
          <Field label="分类" description="自定义分类，可用于仓库页侧栏筛选。">
            <Input value={draft.category} placeholder="例如：开发工具" onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          </Field>
          <Field label="备注">
            <Textarea value={draft.note} placeholder="记录为什么收藏、使用场景或待办。" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
          {draft.aiSummary ? (
            <Field label="AI 摘要">
              <Textarea value={draft.aiSummary} onChange={(e) => setDraft({ ...draft, aiSummary: e.target.value })} />
            </Field>
          ) : null}
          <button
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-accent"
            onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
          >
            <RiPushpin2Line className="size-4" />
            <span className="flex-1">置顶此仓库</span>
            <span className={`h-5 w-9 rounded-full p-0.5 transition ${draft.pinned ? "bg-foreground" : "bg-secondary"}`}>
              <span className={`block size-4 rounded-full bg-background shadow transition ${draft.pinned ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => { onSave(draft); onClose(); }}>保存</Button>
        </div>
      </section>
    </div>
  );
}
