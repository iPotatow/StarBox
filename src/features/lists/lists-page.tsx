import { RiAddLine, RiFolder3Line, RiRefreshLine, RiSearchLine, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { StatusBanner } from "../../components/ui/status-banner";
import { ListSkeleton, Skeleton } from "../../components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { createGithubList, deleteGithubList, fetchGithubLists, setGithubListMembership, updateGithubList } from "../../lib/api";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { GithubStarList, PersistedState } from "../../types";

type MembershipFilter = "all" | "joined" | "not-joined";
type Draft = Pick<GithubStarList, "name" | "description" | "isPrivate">;
const draftFor = (list: GithubStarList): Draft => ({ name: list.name, description: list.description, isPrivate: list.isPrivate });

export function ListsPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [selectedId, setSelectedId] = useState(() => readQueryParam("list") || state.githubLists[0]?.id || "");
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>(() => { const value = readQueryParam("membership"); return value === "joined" || value === "not-joined" ? value : "all"; });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRepository, setPendingRepository] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [switchTarget, setSwitchTarget] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GithubStarList | null>(null);
  const [createError, setCreateError] = useState("");
  const selected = state.githubLists.find((item) => item.id === selectedId) ?? state.githubLists[0] ?? null;
  const dirty = Boolean(selected && draft && (draft.name !== selected.name || draft.description !== selected.description || draft.isPrivate !== selected.isPrivate));

  useEffect(() => { if (selected && (!draft || selected.id !== selectedId)) setDraft(draftFor(selected)); }, [selected?.id]);
  useEffect(() => { replaceQueryParams({ list: selected?.id || "", q: query, membership: membershipFilter === "all" ? "" : membershipFilter }); }, [selected?.id, query, membershipFilter]);

  async function syncLists() {
    if (!hasGithubCredential) return goToSettings(); setLoading(true); setError("");
    try { const lists = await fetchGithubLists(token); onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); const nextId = lists.some((item) => item.id === selectedId) ? selectedId : lists[0]?.id || ""; setSelectedId(nextId); setDraft(lists.find((item) => item.id === nextId) ? draftFor(lists.find((item) => item.id === nextId)!) : null); notify("Lists 已同步", `${lists.length} 个 GitHub Lists`, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Lists 同步失败"); } finally { setLoading(false); }
  }
  useEffect(() => { if (hasGithubCredential && !state.lastListSyncAt && !loading) void syncLists(); }, [hasGithubCredential]);

  function requestSelect(id: string) { if (id === selected?.id) return; if (dirty) setSwitchTarget(id); else { setSelectedId(id); const list = state.githubLists.find((item) => item.id === id); setDraft(list ? draftFor(list) : null); } }
  function discardAndSwitch() { const id = switchTarget; setSwitchTarget(""); setSelectedId(id); const list = state.githubLists.find((item) => item.id === id); setDraft(list ? draftFor(list) : null); }

  async function createList() {
    const trimmed = name.trim(); setCreateError("");
    if (!trimmed) return setCreateError("请输入 List 名称");
    if (state.githubLists.some((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase())) return setCreateError("已存在同名 List");
    setSaving(true); setError("");
    try { const created = await createGithubList(token, trimmed, description.trim(), createPrivate); const lists = [...state.githubLists, created]; onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); setSelectedId(created.id); setDraft(draftFor(created)); setCreateOpen(false); setName(""); setDescription(""); setCreatePrivate(false); notify("List 已创建", created.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "List 创建失败"); } finally { setSaving(false); }
  }
  async function saveList() {
    if (!selected || !draft) return;
    const trimmed = draft.name.trim();
    if (!trimmed) return setError("List 名称不能为空");
    if (state.githubLists.some((item) => item.id !== selected.id && item.name.trim().toLowerCase() === trimmed.toLowerCase())) return setError("已存在同名 List");
    setSaving(true); setError("");
    try { const next = await updateGithubList(token, selected.id, trimmed, draft.description.trim(), draft.isPrivate); const lists = state.githubLists.map((item) => item.id === selected.id ? { ...next, items: item.items } : item); onStateChange({ ...state, githubLists: lists }); setDraft(draftFor({ ...next, items: selected.items })); notify("List 已保存", next.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setSaving(false); }
  }
  async function removeList() {
    const list = deleteTarget; if (!list) return; setSaving(true); setError("");
    try { await deleteGithubList(token, list.id); const lists = state.githubLists.filter((item) => item.id !== list.id); onStateChange({ ...state, githubLists: lists }); const next = lists[0] ?? null; setSelectedId(next?.id || ""); setDraft(next ? draftFor(next) : null); setDeleteTarget(null); notify("List 已删除", list.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); } finally { setSaving(false); }
  }
  async function toggleMembership(fullName: string, listId: string, active: boolean) {
    setPendingRepository(fullName); setError("");
    const previous = state.githubLists;
    try {
      const memberships = previous.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
      const desired = active ? Array.from(new Set([...memberships, listId])) : memberships.filter((id) => id !== listId);
      const repository = state.repositories.find((item) => item.full_name === fullName);
      const listItem = { id: fullName, fullName, htmlUrl: repository?.html_url ?? `https://github.com/${fullName}` };
      const optimisticLists = previous.map((list) => list.id === listId ? { ...list, items: active ? [...list.items.filter((item) => item.fullName !== fullName), listItem] : list.items.filter((item) => item.fullName !== fullName) } : list);
      onStateChange({ ...state, githubLists: optimisticLists });
      await setGithubListMembership(token, fullName, desired);
      notify(active ? "已加入 List" : "已移出 List", fullName, "success");
    } catch (reason) { onStateChange({ ...state, githubLists: previous }); setError(reason instanceof Error ? reason.message : "List membership 更新失败"); }
    finally { setPendingRepository(""); }
  }

  const localCandidates = useMemo(() => {
    if (!selected) return []; const needle = query.trim().toLowerCase();
    return state.repositories.filter((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return (!needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)) && (membershipFilter === "all" || (membershipFilter === "joined" ? active : !active)); });
  }, [selected, state.repositories, query, membershipFilter]);

  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">GitHub Lists</h1><p className="mt-2 text-sm text-muted-foreground">连接 GitHub 凭据后可同步和编辑 GitHub Star Lists。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">GitHub Lists</h1><p className="mt-1 text-sm text-muted-foreground">编辑使用本地草稿；只有“保存”才写入 GitHub，取消会恢复已保存状态。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setCreateOpen(true)}><RiAddLine className="size-4" />新建 List</Button><Button onClick={() => void syncLists()} loading={loading}><RiRefreshLine className="size-4" />同步 Lists</Button></div></header>
    <StatusBanner error={error} />
    {(initialLoading || loading) && !state.githubLists.length ? <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><Card className="rounded-xl p-3"><Skeleton className="mb-3 h-5 w-20" /><ListSkeleton rows={5} /></Card><Card className="rounded-xl p-4"><Skeleton className="mb-4 h-8 w-1/2" /><ListSkeleton rows={6} /></Card></div> : <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card render={<aside />} className="rounded-xl p-2 shadow-card"><div className="px-2 py-2 text-xs font-semibold text-muted-foreground">{state.githubLists.length} 个 Lists</div>{state.githubLists.map((list) => <Button key={list.id} variant="ghost" size="none" onClick={() => requestSelect(list.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected?.id === list.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`}><RiFolder3Line className="size-4" /><span className="min-w-0 flex-1 truncate">{list.name}</span><span className="text-xs">{list.items.length}</span></Button>)}{!state.githubLists.length ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">还没有 Lists</div> : null}</Card>
      <section className="min-w-0">{selected && draft ? <div className="grid gap-4">
        <Card className="rounded-xl p-4 shadow-card"><div className="grid gap-3 sm:grid-cols-2"><Field label="名称"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="可见性"><label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm"><Checkbox checked={draft.isPrivate} onCheckedChange={(checked) => setDraft({ ...draft, isPrivate: checked })} aria-label="Private List" />Private List</label></Field></div><Field label="描述"><Textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field><div className="mt-3 flex flex-wrap gap-2"><Button loading={saving} disabled={!dirty} onClick={() => void saveList()}>保存</Button><Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(draftFor(selected))}>取消修改</Button><Button variant="destructive" disabled={saving} onClick={() => setDeleteTarget(selected)}>删除</Button>{dirty ? <span className="self-center text-xs text-warning-foreground">有未保存修改</span> : null}</div></Card>
        <Card className="rounded-xl p-4 shadow-card"><div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="relative"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索本地 Stars" /></div><ToggleGroup value={[membershipFilter]} onValueChange={(values) => { const value = values.at(-1); if (value === "all" || value === "joined" || value === "not-joined") setMembershipFilter(value); }}><ToggleGroupItem value="all" className="w-auto px-2.5 text-xs">全部</ToggleGroupItem><ToggleGroupItem value="joined" className="w-auto px-2.5 text-xs">已加入</ToggleGroupItem><ToggleGroupItem value="not-joined" className="w-auto px-2.5 text-xs">未加入</ToggleGroupItem></ToggleGroup></div><div className="grid gap-2">{localCandidates.map((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return <div key={repo.full_name} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"><img src={repo.owner.avatar_url} alt="" className="size-8 rounded-md" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{repo.full_name}</div><div className="truncate text-xs text-muted-foreground">{repo.description || "暂无描述"}</div></div><Button size="sm" variant={active ? "secondary" : "outline"} loading={pendingRepository === repo.full_name} disabled={Boolean(pendingRepository && pendingRepository !== repo.full_name)} onClick={() => void toggleMembership(repo.full_name, selected.id, !active)}>{active ? "移出" : "加入"}</Button></div>; })}{!localCandidates.length ? <p className="py-8 text-center text-sm text-muted-foreground">没有符合当前筛选的仓库</p> : null}</div></Card>
      </div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">选择或创建一个 GitHub List</div>}</section>
    </div>}

    <Modal open={createOpen} title="新建 GitHub List" onClose={() => setCreateOpen(false)}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void createList(); }}><Field label="名称"><Input required value={name} onChange={(event) => { setName(event.target.value); setCreateError(""); }} autoFocus /></Field><Field label="描述"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field><label className="flex items-center gap-2 text-sm"><Checkbox checked={createPrivate} onCheckedChange={setCreatePrivate} />Private List</label>{createError ? <p className="text-sm text-destructive-foreground" role="alert">{createError}</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button type="submit" loading={saving}>创建</Button></div></form></Modal>

    <AlertDialog open={Boolean(switchTarget)} onOpenChange={(open: boolean) => { if (!open) setSwitchTarget(""); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>放弃修改并切换？</AlertDialogTitle><AlertDialogDescription>当前 List 有未保存修改。切换后这些本地草稿会被丢弃。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>继续编辑</AlertDialogClose><Button variant="destructive" onClick={discardAndSwitch}>放弃并切换</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>删除 GitHub List？</AlertDialogTitle><AlertDialogDescription>将删除“{deleteTarget?.name}”及其 GitHub List membership；不会取消仓库的 Star。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" loading={saving} onClick={() => void removeList()}>删除</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
