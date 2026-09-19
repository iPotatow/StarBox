import type { StateChange } from "../../types";
import { CheckIcon, MenuIcon } from "../../lib/animated-icons";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../../components/ui/menu";
import { Switch } from "../../components/ui/switch";
import { notify } from "../../components/ui/toast";
import { runOptimisticMutation } from "../../lib/mutations";
import { useI18n } from "../../lib/i18n";
import type { CategoryDefinition, PersistedState } from "../../types";

const colors = ["neutral", "blue", "violet", "emerald", "amber", "red"];
const colorClass: Record<string, string> = { neutral: "bg-muted-foreground", blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };

export function CategorySettingsPanel({ state, onStateChange }: { state: PersistedState; onStateChange: StateChange }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategoryDefinition | null>(null);
  const sorted = useMemo(() => [...state.categories].sort((a, b) => a.order - b.order), [state.categories]);
  const counts = useMemo(() => Object.values(state.repositoryMeta).reduce<Record<string, number>>((acc, meta) => { if (meta.category) acc[meta.category] = (acc[meta.category] ?? 0) + 1; return acc; }, {}), [state.repositoryMeta]);

  async function commit(optimistic: PersistedState, operation: string, payload: Record<string, unknown>) {
    setError("");
    try { await runOptimisticMutation(state, optimistic, onStateChange, { operation, payload }); notify(t("分类已更新", "Categories updated"), "", "success"); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("分类保存失败，请稍后重试", "Failed to save category. Try again later.")); return false; }
  }

  function add() {
    const value = name.trim();
    if (!value) return;
    if (state.categories.some((item) => item.name.trim().toLowerCase() === value.toLowerCase())) { setError(t("已存在同名分类", "A category with this name already exists")); return; }
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

  function startEdit(category: CategoryDefinition) { setEditingId(category.id); setNameDrafts((current) => ({ ...current, [category.id]: category.name })); setError(""); }
  function commitName(category: CategoryDefinition) {
    const nextName = (nameDrafts[category.id] ?? category.name).trim();
    if (!nextName) { setError(t("分类名称不能为空", "Category name cannot be empty")); return; }
    if (state.categories.some((item) => item.id !== category.id && item.name.trim().toLowerCase() === nextName.toLowerCase())) { setError(t("已存在同名分类", "A category with this name already exists")); return; }
    if (nextName !== category.name) update(category, { name: nextName });
    setEditingId(null);
    setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; });
  }
  function cancelName(category: CategoryDefinition) { setEditingId(null); setNameDrafts((current) => { const next = { ...current }; delete next[category.id]; return next; }); setError(""); }

  function move(index: number, delta: number) {
    const list = [...sorted]; const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const categories = list.map((item, order) => ({ ...item, order }));
    void commit({ ...state, categories }, "category.reorder", { categories: categories.map((item) => ({ id: item.id, name: item.name, color: item.color, sortOrder: item.order, locked: item.locked })) });
  }

  function remove(category: CategoryDefinition) {
    const repositoryMeta = Object.fromEntries(Object.entries(state.repositoryMeta).map(([key, meta]) => [key, meta.category === category.name ? { ...meta, category: "" } : meta]));
    const categories = state.categories.filter((item) => item.id !== category.id).map((item, order) => ({ ...item, order }));
    void commit({ ...state, categories, repositoryMeta }, "category.delete", { id: category.id });
    setDeleteTarget(null);
    if (editingId === category.id) setEditingId(null);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("新分类名称", "New category name")} onKeyDown={(event) => { if (event.key === "Enter") add(); }} /><Button onClick={add}>{t("新建分类", "Create category")}</Button></div>
      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="overflow-hidden rounded-xl border border-border/70">
        {sorted.map((category, index) => {
          const editing = editingId === category.id;
          return <div key={category.id} className="border-b border-border/70 last:border-b-0">
            <div className="flex min-h-12 items-center gap-3 px-3 py-2">
              <span className={`size-2.5 shrink-0 rounded-full ${colorClass[category.color] || colorClass.neutral}`} aria-hidden="true" />
              <Button variant="link" size="sm" className="min-w-0 flex-1 justify-start truncate text-left text-sm font-medium" onClick={() => startEdit(category)}>{category.name}</Button>
              {category.locked ? <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{t("AI 锁定", "AI locked")}</span> : null}
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground" title={t(`${counts[category.name] ?? 0} 个仓库`, `${counts[category.name] ?? 0} repositories`)}>{counts[category.name] ?? 0}</span>
              <Menu>
                <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t(`${category.name} 更多操作`, `More actions for ${category.name}`)} />}><MenuIcon className="size-4" aria-hidden="true" /></MenuTrigger>
                <MenuPopup>
                  <MenuItem onClick={() => startEdit(category)}>{t("编辑分类", "Edit category")}</MenuItem>
                  {index > 0 ? <MenuItem onClick={() => move(index, -1)}>{t("上移", "Move up")}</MenuItem> : null}
                  {index < sorted.length - 1 ? <MenuItem onClick={() => move(index, 1)}>{t("下移", "Move down")}</MenuItem> : null}
                  <MenuSeparator />
                  <MenuItem variant="destructive" onClick={() => setDeleteTarget(category)}>{t("删除分类", "Delete category")}</MenuItem>
                </MenuPopup>
              </Menu>
            </div>

            {editing ? <div className="grid gap-4 border-t border-border/60 bg-secondary/20 px-3 py-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><Input value={nameDrafts[category.id] ?? category.name} autoFocus onChange={(event) => setNameDrafts((current) => ({ ...current, [category.id]: event.target.value }))} onBlur={() => commitName(category)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitName(category); } else if (event.key === "Escape") { event.preventDefault(); cancelName(category); } }} /><div className="flex gap-2"><Button variant="ghost" onMouseDown={(event) => event.preventDefault()} onClick={() => cancelName(category)}>{t("取消", "Cancel")}</Button></div></div>
              <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-muted-foreground">{t("颜色", "Color")}</span>{colors.map((color) => <Button key={color} variant="ghost" size="icon-sm" aria-label={t(`颜色 ${color}`, `Color ${color}`)} aria-pressed={category.color === color} onClick={() => update(category, { color })} className={`rounded-full ${category.color === color ? "ring-2 ring-foreground/30" : ""}`}><span className={`size-4 rounded-full ${colorClass[color]}`} aria-hidden="true" />{category.color === color ? <CheckIcon className="absolute size-3 text-white" aria-hidden="true" /> : null}</Button>)}<span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{t("AI 锁定", "AI locked")} <Switch checked={category.locked} onCheckedChange={(locked) => update(category, { locked })} aria-label={t(`AI 锁定 ${category.name}`, `AI lock ${category.name}`)} /></span></div>
            </div> : null}
          </div>;
        })}
        {!sorted.length ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("还没有自定义分类", "No custom categories yet")}</div> : null}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2.5 rounded-full bg-muted-foreground/40" aria-hidden="true" /><span>{t("未分类", "Uncategorized")}</span><span className="ml-auto tabular-nums">{Object.values(state.repositoryMeta).filter((meta) => !meta.category).length}</span></div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("删除分类？", "Delete category?")}</AlertDialogTitle><AlertDialogDescription>{t(`删除“${deleteTarget?.name}”后，使用该分类的仓库会变为未分类。更改会同步到你的 StarBox 账户。`, `Deleting “${deleteTarget?.name}” will move repositories in this category to Uncategorized. The change syncs to your StarBox account.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => { if (deleteTarget) remove(deleteTarget); }}>{t("删除", "Delete")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
