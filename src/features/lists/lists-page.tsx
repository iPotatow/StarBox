import { RiAddLine, RiFolder3Line, RiRefreshLine, RiSearchLine, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Select } from "../../components/ui/select";
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

export function ListsPage({ state, onStateChange, goToSettings, initialLoading = false, embedded = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean; embedded?: boolean }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [selectedId, setSelectedId] = useState(() => embedded ? state.githubLists[0]?.id || "" : readQueryParam("list") || state.githubLists[0]?.id || "");
  const [query, setQuery] = useState(() => readQueryParam("q"));
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>(() => { const value = readQueryParam("membership"); return value === "joined" || value === "not-joined" ? value : "all"; });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRepositories, setPendingRepositories] = useState<Set<string>>(() => new Set());
  const [selectedRepositories, setSelectedRepositories] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [switchTarget, setSwitchTarget] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GithubStarList | null>(null);
  const [createError, setCreateError] = useState("");
  const selected = state.githubLists.find((item) => item.id === selectedId) ?? state.githubLists[0] ?? null;
  const dirty = Boolean(selected && draft && (draft.name !== selected.name || draft.description !== selected.description || draft.isPrivate !== selected.isPrivate));

  useEffect(() => { if (selected && (!draft || selected.id !== selectedId)) setDraft(draftFor(selected)); }, [selected?.id]);
  useEffect(() => { if (!embedded) replaceQueryParams({ list: selected?.id || "", q: query, membership: membershipFilter === "all" ? "" : membershipFilter }); }, [embedded, selected?.id, query, membershipFilter]);
  useEffect(() => { setSelectedRepositories(new Set()); }, [selected?.id]);

  async function syncLists() {
    if (!hasGithubCredential) return goToSettings(); setLoading(true); setError("");
    try { const lists = await fetchGithubLists(token); onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); const nextId = lists.some((item) => item.id === selectedId) ? selectedId : lists[0]?.id || ""; setSelectedId(nextId); setDraft(lists.find((item) => item.id === nextId) ? draftFor(lists.find((item) => item.id === nextId)!) : null); notify("列表已同步", `${lists.length} 个 GitHub 列表`, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "列表同步失败"); } finally { setLoading(false); }
  }
  useEffect(() => { if (hasGithubCredential && !state.lastListSyncAt && !loading) void syncLists(); }, [hasGithubCredential]);

  function requestSelect(id: string) { if (id === selected?.id) return; if (dirty) setSwitchTarget(id); else { setSelectedId(id); const list = state.githubLists.find((item) => item.id === id); setDraft(list ? draftFor(list) : null); } }
  function discardAndSwitch() { const id = switchTarget; setSwitchTarget(""); setSelectedId(id); const list = state.githubLists.find((item) => item.id === id); setDraft(list ? draftFor(list) : null); }

  async function createList() {
    const trimmed = name.trim(); setCreateError("");
    if (!trimmed) return setCreateError("请输入 列表名称");
    if (state.githubLists.some((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase())) return setCreateError("已存在同名列表");
    setSaving(true); setError("");
    try { const created = await createGithubList(token, trimmed, description.trim(), createPrivate); const lists = [...state.githubLists, created]; onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); setSelectedId(created.id); setDraft(draftFor(created)); setCreateOpen(false); setName(""); setDescription(""); setCreatePrivate(false); notify("列表已创建", created.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "列表创建失败"); } finally { setSaving(false); }
  }
  async function saveList() {
    if (!selected || !draft) return;
    const trimmed = draft.name.trim();
    if (!trimmed) return setError("列表名称不能为空");
    if (state.githubLists.some((item) => item.id !== selected.id && item.name.trim().toLowerCase() === trimmed.toLowerCase())) return setError("已存在同名列表");
    setSaving(true); setError("");
    try { const next = await updateGithubList(token, selected.id, trimmed, draft.description.trim(), draft.isPrivate); const lists = state.githubLists.map((item) => item.id === selected.id ? { ...next, items: item.items } : item); onStateChange({ ...state, githubLists: lists }); setDraft(draftFor({ ...next, items: selected.items })); notify("列表已保存", next.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setSaving(false); }
  }
  async function removeList() {
    const list = deleteTarget; if (!list) return; setSaving(true); setError("");
    try { await deleteGithubList(token, list.id); const lists = state.githubLists.filter((item) => item.id !== list.id); onStateChange({ ...state, githubLists: lists }); const next = lists[0] ?? null; setSelectedId(next?.id || ""); setDraft(next ? draftFor(next) : null); setDeleteTarget(null); notify("列表已删除", list.name, "success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); } finally { setSaving(false); }
  }
  async function toggleMembership(fullName: string, listId: string, active: boolean) {
    setPendingRepositories((current) => new Set(current).add(fullName)); setError("");
    const previous = state.githubLists;
    try {
      const memberships = previous.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
      const desired = active ? Array.from(new Set([...memberships, listId])) : memberships.filter((id) => id !== listId);
      const repository = state.repositories.find((item) => item.full_name === fullName);
      const listItem = { id: fullName, fullName, htmlUrl: repository?.html_url ?? `https://github.com/${fullName}` };
      const optimisticLists = previous.map((list) => list.id === listId ? { ...list, items: active ? [...list.items.filter((item) => item.fullName !== fullName), listItem] : list.items.filter((item) => item.fullName !== fullName) } : list);
      onStateChange({ ...state, githubLists: optimisticLists });
      await setGithubListMembership(token, fullName, desired);
      notify(active ? "已加入列表" : "已移出列表", fullName, "success");
    } catch (reason) { onStateChange({ ...state, githubLists: previous }); setError(reason instanceof Error ? reason.message : "无法更新 GitHub 列表"); }
    finally { setPendingRepositories((current) => { const next = new Set(current); next.delete(fullName); return next; }); }
  }

  async function batchMembership(active: boolean) {
    if (!selected || !selectedRepositories.size) return;
    const names = Array.from(selectedRepositories);
    const previous = state.githubLists;
    const selectedList = selected;
    const listItems = new Map(state.repositories.map((repo) => [repo.full_name, { id: repo.full_name, fullName: repo.full_name, htmlUrl: repo.html_url }]));
    const optimisticLists = previous.map((list) => list.id === selectedList.id ? { ...list, items: active ? [...list.items.filter((item) => !selectedRepositories.has(item.fullName)), ...names.map((name) => listItems.get(name) ?? { id: name, fullName: name, htmlUrl: `https://github.com/${name}` })] : list.items.filter((item) => !selectedRepositories.has(item.fullName)) } : list);
    onStateChange({ ...state, githubLists: optimisticLists });
    setPendingRepositories((current) => new Set([...current, ...names]));
    const settled = await Promise.allSettled(names.map((fullName) => {
      const memberships = previous.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
      const desired = active ? Array.from(new Set([...memberships, selectedList.id])) : memberships.filter((id) => id !== selectedList.id);
      return setGithubListMembership(token, fullName, desired);
    }));
    const failed = new Set(names.filter((_, index) => settled[index].status === "rejected"));
    if (failed.size) {
      const repaired = optimisticLists.map((list) => list.id !== selectedList.id ? list : { ...list, items: list.items.filter((item) => !failed.has(item.fullName)).concat(previous.find((item) => item.id === selectedList.id)?.items.filter((item) => failed.has(item.fullName)) ?? []) });
      onStateChange({ ...state, githubLists: repaired });
      setError(`${failed.size} 个仓库无法更新列表，失败项已恢复。`);
      setSelectedRepositories(failed);
    } else {
      notify(active ? "已批量加入列表" : "已批量移出列表", `${names.length} 个仓库`, "success");
      setSelectedRepositories(new Set());
    }
    setPendingRepositories((current) => { const next = new Set(current); names.forEach((name) => next.delete(name)); return next; });
  }

  const localCandidates = useMemo(() => {
    if (!selected) return []; const needle = query.trim().toLowerCase();
    return state.repositories.filter((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return (!needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)) && (membershipFilter === "all" || (membershipFilter === "joined" ? active : !active)); });
  }, [selected, state.repositories, query, membershipFilter]);

  if (!hasGithubCredential) return <div className={embedded ? "py-4" : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}><h1 className="text-xl font-semibold">GitHub 列表</h1><p className="mt-2 text-sm text-muted-foreground">连接 GitHub 后即可同步和编辑 Star 列表。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;

  return <div className={embedded ? "w-full" : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"}>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">{!embedded ? <div><h1 className="text-xl font-semibold tracking-tight">GitHub 列表</h1><p className="mt-1 text-sm text-muted-foreground">组织你已 Star 的仓库。</p></div> : <div><p className="text-sm text-muted-foreground">管理列表和仓库归属。</p></div>}<div className="flex gap-2"><Button variant="outline" onClick={() => setCreateOpen(true)}><RiAddLine className="size-4" />新建列表</Button><Button onClick={() => void syncLists()} loading={loading}><RiRefreshLine className="size-4" />同步列表</Button></div></header>
    <StatusBanner error={error} />
    {(initialLoading || loading) && !state.githubLists.length ? <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><Card className="rounded-xl p-3"><Skeleton className="mb-3 h-5 w-20" /><ListSkeleton rows={5} /></Card><Card className="rounded-xl p-4"><Skeleton className="mb-4 h-8 w-1/2" /><ListSkeleton rows={6} /></Card></div> : <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card render={<aside />} className="rounded-xl p-2 shadow-card"><div className="px-2 py-2 text-xs font-semibold text-muted-foreground">{state.githubLists.length} 个列表</div>{state.githubLists.map((list) => <Button key={list.id} variant="ghost" size="none" onClick={() => requestSelect(list.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected?.id === list.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`}><RiFolder3Line className="size-4" /><span className="min-w-0 flex-1 truncate">{list.name}</span><span className="text-xs">{list.items.length}</span></Button>)}{!state.githubLists.length ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">还没有列表</div> : null}</Card>
      <section className="min-w-0">{selected && draft ? <div className="grid gap-4">
        <Card className="rounded-xl p-4 shadow-card"><div className="mb-4 flex items-center gap-2"><h2 className="text-sm font-semibold">{selected.name}</h2>{dirty ? <span className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-foreground">未保存</span> : null}</div><div className="grid gap-3 sm:grid-cols-2"><Field label="名称"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="可见性"><Select value={draft.isPrivate ? "private" : "public"} onChange={(event) => setDraft({ ...draft, isPrivate: event.target.value === "private" })}><option value="public">Public</option><option value="private">Private</option></Select></Field></div><Field label="描述"><Textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field><div className="mt-3 flex flex-wrap items-center gap-2"><Button loading={saving} disabled={!dirty} onClick={() => void saveList()}>保存</Button><Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(draftFor(selected))}>取消修改</Button><Button className="ml-auto text-destructive-foreground" variant="ghost" disabled={saving} onClick={() => setDeleteTarget(selected)}>删除列表</Button></div></Card>
        <Card className="rounded-xl p-4 shadow-card"><div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><InputGroup><InputGroupInput type="search" data-search-shortcut="true" aria-label="搜索本地 Stars" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索本地 Stars" /><InputGroupAddon><RiSearchLine className="size-4" aria-hidden="true" /></InputGroupAddon></InputGroup><ToggleGroup value={[membershipFilter]} onValueChange={(values) => { const value = values.at(-1); if (value === "all" || value === "joined" || value === "not-joined") setMembershipFilter(value); }}><ToggleGroupItem value="all" className="w-auto px-2.5 text-xs">全部</ToggleGroupItem><ToggleGroupItem value="joined" className="w-auto px-2.5 text-xs">已加入</ToggleGroupItem><ToggleGroupItem value="not-joined" className="w-auto px-2.5 text-xs">未加入</ToggleGroupItem></ToggleGroup></div><div className="grid gap-2">{selectedRepositories.size ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/45 px-3 py-2 text-sm"><span className="mr-auto">已选 {selectedRepositories.size} 个</span><Button size="sm" variant="outline" onClick={() => void batchMembership(true)}>加入当前列表</Button><Button size="sm" variant="outline" onClick={() => void batchMembership(false)}>移出当前列表</Button><Button size="sm" variant="ghost" onClick={() => setSelectedRepositories(new Set())}>清除</Button></div> : null}{localCandidates.map((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); const pending = pendingRepositories.has(repo.full_name); return <div key={repo.full_name} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${active ? "border-primary/20 bg-accent/20" : "border-border"}`}><Checkbox checked={selectedRepositories.has(repo.full_name)} onCheckedChange={(checked) => setSelectedRepositories((current) => { const next = new Set(current); if (checked) next.add(repo.full_name); else next.delete(repo.full_name); return next; })} aria-label={`选择 ${repo.full_name}`} /><img src={repo.owner.avatar_url} alt="" className="size-8 rounded-md" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{repo.full_name}</div><div className="truncate text-xs text-muted-foreground">{active ? `✓ ${selected.name}` : repo.description || "暂无描述"}</div></div><Button size="sm" variant={active ? "secondary" : "outline"} loading={pending} onClick={() => void toggleMembership(repo.full_name, selected.id, !active)}>{active ? "移出" : "加入"}</Button></div>; })}{!localCandidates.length ? <p className="py-8 text-center text-sm text-muted-foreground">没有符合当前筛选的仓库</p> : null}</div></Card>
      </div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">选择或创建一个 GitHub 列表</div>}</section>
    </div>}

    <Modal open={createOpen} title="新建 GitHub 列表" onClose={() => setCreateOpen(false)}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void createList(); }}><Field label="名称"><Input required value={name} onChange={(event) => { setName(event.target.value); setCreateError(""); }} autoFocus /></Field><Field label="描述"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field><Field label="可见性"><Select value={createPrivate ? "private" : "public"} onChange={(event) => setCreatePrivate(event.target.value === "private")}><option value="public">Public</option><option value="private">Private</option></Select></Field>{createError ? <p className="text-sm text-destructive-foreground" role="alert">{createError}</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button type="submit" loading={saving}>创建</Button></div></form></Modal>

    <AlertDialog open={Boolean(switchTarget)} onOpenChange={(open: boolean) => { if (!open) setSwitchTarget(""); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>放弃修改并切换？</AlertDialogTitle><AlertDialogDescription>当前 List 有未保存修改。切换后这些本地草稿会被丢弃。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>继续编辑</AlertDialogClose><Button variant="destructive" onClick={discardAndSwitch}>放弃并切换</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>删除 GitHub 列表？</AlertDialogTitle><AlertDialogDescription>将删除“{deleteTarget?.name}”及其 GitHub 列表中的仓库归属；不会取消仓库的 Star。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" loading={saving} onClick={() => void removeList()}>删除</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
