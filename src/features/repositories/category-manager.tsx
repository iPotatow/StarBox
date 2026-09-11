import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { runOptimisticMutation } from "../../lib/mutations";
import type { CategoryDefinition, PersistedState } from "../../types";

const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];

export function CategoryManager({ open, state, onStateChange, onClose }: { open: boolean; state: PersistedState; onStateChange: (state: PersistedState) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function commit(optimistic: PersistedState, operation: string, payload: Record<string, unknown>) {
    setError("");
    try { await runOptimisticMutation(state, optimistic, onStateChange, { operation, payload }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "分类保存失败"); }
  }

  function add() {
    const value = name.trim();
    if (!value || state.categories.some((item) => item.name === value)) return;
    const category: CategoryDefinition = { id: `cat-${Date.now()}`, name: value, color: "neutral", order: state.categories.length, locked: false };
    const categories = [...state.categories, category].map((item, index) => ({ ...item, order: index }));
    void commit({ ...state, categories }, "category.create", { id: category.id, name: category.name, color: category.color, sortOrder: category.order, locked: category.locked });
    setName("");
  }

  function update(category: CategoryDefinition, patch: Partial<CategoryDefinition>) {
    const nextName = patch.name?.trim() || category.name;
    const nextCategory = { ...category, ...patch, name: nextName };
    const categories = state.categories.map((item) => item.id === category.id ? nextCategory : item).sort((a, b) => a.order - b.order);
    const repositoryMeta = nextName === category.name ? state.repositoryMeta : Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: nextName } : meta]));
    void commit({ ...state, categories, repositoryMeta }, "category.update", { id: nextCategory.id, name: nextCategory.name, color: nextCategory.color, sortOrder: nextCategory.order, locked: nextCategory.locked });
  }

  function move(index: number, delta: number) {
    const list = [...state.categories].sort((a, b) => a.order - b.order);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const categories = list.map((item, order) => ({ ...item, order }));
    void commit({ ...state, categories }, "category.reorder", { categories: categories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })) });
  }

  function remove(category: CategoryDefinition) {
    if (!window.confirm(`删除分类“${category.name}”？仓库会变为未分类。`)) return;
    const repositoryMeta = Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: "" } : meta]));
    const categories = state.categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order }));
    void commit({ ...state, categories, repositoryMeta }, "category.delete", { id: category.id });
  }

  const sorted = [...state.categories].sort((a, b) => a.order - b.order);
  return (
    <Modal open={open} title="分类管理" description="调整分类名称、颜色、顺序和锁定状态。锁定分类不会被 AI 自动改写。" onClose={onClose}>
      <div className="grid gap-4">
        {error ? <p className="text-sm text-destructive-foreground" role="alert">{error}</p> : null}
        <div className="flex gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="新分类名称" onKeyDown={(event) => { if (event.key === "Enter") add(); }} /><Button onClick={add}>添加</Button></div>
        <div className="grid gap-2">
          {sorted.map((category, index) => (
            <div key={category.id} className="rounded-xl border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <Field label="名称"><Input value={category.name} onChange={(event) => update(category, { name: event.target.value })} /></Field>
                <Field label="颜色"><Select value={category.color} onChange={(event) => update(category, { color: event.target.value })}>{colors.map((color) => <option key={color} value={color}>{color}</option>)}</Select></Field>
                <div className="flex items-end gap-1"><Button size="sm" variant={category.locked ? "default" : "outline"} onClick={() => update(category, { locked: !category.locked })}>{category.locked ? "已锁定" : "锁定"}</Button></div>
              </div>
              <div className="mt-2 flex gap-1"><Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>上移</Button><Button size="sm" variant="ghost" disabled={index === sorted.length - 1} onClick={() => move(index, 1)}>下移</Button><Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(category)}>删除</Button></div>
            </div>
          ))}
          {!sorted.length ? <p className="py-6 text-center text-sm text-muted-foreground">还没有自定义分类</p> : null}
        </div>
      </div>
    </Modal>
  );
}
