import { RiAddLine, RiFolder3Line, RiRefreshLine, RiSearchLine, RiSettings4Line } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Modal } from "../../components/ui/modal";
import { StatusBanner } from "../../components/ui/status-banner";
import { ListSkeleton, Skeleton } from "../../components/ui/skeleton";
import { createGithubList, deleteGithubList, fetchGithubLists, setGithubListMembership, updateGithubList } from "../../lib/api";
import type { GithubStarList, PersistedState } from "../../types";

export function ListsPage({ state, onStateChange, goToSettings, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; goToSettings: () => void; initialLoading?: boolean }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [selectedId, setSelectedId] = useState(state.githubLists[0]?.id || "");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = state.githubLists.find((item) => item.id === selectedId) ?? state.githubLists[0] ?? null;

  async function syncLists() {
    if (!hasGithubCredential) return goToSettings(); setLoading(true); setError(""); setSuccess("");
    try { const lists = await fetchGithubLists(token); onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); if (!selectedId && lists[0]) setSelectedId(lists[0].id); setSuccess(`已同步 ${lists.length} 个 GitHub Lists`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Lists 同步失败"); } finally { setLoading(false); }
  }
  useEffect(() => { if (hasGithubCredential && !state.lastListSyncAt && !loading) void syncLists(); }, [hasGithubCredential]);

  async function createList() {
    if (!name.trim()) return; setSaving(true); setError("");
    try { const created = await createGithubList(token, name.trim(), description.trim(), createPrivate); const lists = [...state.githubLists, created]; onStateChange({ ...state, githubLists: lists, lastListSyncAt: new Date().toISOString() }); setSelectedId(created.id); setCreateOpen(false); setName(""); setDescription(""); setCreatePrivate(false); setSuccess(`已创建 List：${created.name}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "List 创建失败"); } finally { setSaving(false); }
  }
  async function saveList(list: GithubStarList) {
    setSaving(true); setError(""); try { const next = await updateGithubList(token, list.id, list.name, list.description, list.isPrivate); onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === list.id ? { ...next, items: item.items } : item) }); setSuccess("List 设置已保存"); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } finally { setSaving(false); }
  }
  async function removeList(list: GithubStarList) {
    if (!window.confirm(`删除 GitHub List “${list.name}”？`)) return; setSaving(true); setError("");
    try { await deleteGithubList(token, list.id); const lists = state.githubLists.filter((item) => item.id !== list.id); onStateChange({ ...state, githubLists: lists }); setSelectedId(lists[0]?.id || ""); setSuccess("List 已删除"); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); } finally { setSaving(false); }
  }
  async function toggleMembership(fullName: string, listId: string, active: boolean) {
    setSaving(true); setError("");
    try {
      const memberships = state.githubLists.filter((list) => list.items.some((item) => item.fullName === fullName)).map((list) => list.id);
      const desired = active ? Array.from(new Set([...memberships, listId])) : memberships.filter((id) => id !== listId);
      const repository = state.repositories.find((item) => item.full_name === fullName);
      const listItem = { id: fullName, fullName, htmlUrl: repository?.html_url ?? `https://github.com/${fullName}` };
      const optimisticLists = state.githubLists.map((list) => list.id === listId ? { ...list, items: active ? [...list.items.filter((item) => item.fullName !== fullName), listItem] : list.items.filter((item) => item.fullName !== fullName) } : list);
      await setGithubListMembership(token, fullName, desired);
      onStateChange({ ...state, githubLists: optimisticLists });
      setSuccess(active ? `已加入 ${fullName}` : `已移出 ${fullName}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "List membership 更新失败"); } finally { setSaving(false); }
  }

  const localCandidates = useMemo(() => {
    if (!selected) return []; const needle = query.trim().toLowerCase();
    return state.repositories.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [selected, state.repositories, query]);

  if (!hasGithubCredential) return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-xl font-semibold">GitHub Lists</h1><p className="mt-2 text-sm text-muted-foreground">连接 GitHub 凭据后可同步和编辑 GitHub Star Lists。</p><Button className="mt-4" onClick={goToSettings}><RiSettings4Line className="size-4" />打开设置</Button></div>;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">GitHub Lists</h1><p className="mt-1 text-sm text-muted-foreground">与 GitHub Star Lists 双向同步。Membership 写入会保留仓库在其他 Lists 中的归属。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setCreateOpen(true)}><RiAddLine className="size-4" />新建 List</Button><Button onClick={() => void syncLists()} loading={loading}><RiRefreshLine className="size-4" />同步 Lists</Button></div></header>
      <StatusBanner error={error} success={!error ? success : ""} />
      {(initialLoading || loading) && !state.githubLists.length ? <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><Card className="rounded-xl p-3"><Skeleton className="mb-3 h-5 w-20" /><ListSkeleton rows={5} /></Card><Card className="rounded-xl p-4"><Skeleton className="mb-4 h-8 w-1/2" /><ListSkeleton rows={6} /></Card></div> : <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card render={<aside />} className="rounded-xl p-2 shadow-card"><div className="px-2 py-2 text-xs font-semibold text-muted-foreground">{state.githubLists.length} 个 Lists</div>{state.githubLists.map((list) => <Button key={list.id} variant="ghost" size="none" onClick={() => setSelectedId(list.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected?.id === list.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`}><RiFolder3Line className="size-4" /><span className="min-w-0 flex-1 truncate">{list.name}</span><span className="text-xs">{list.items.length}</span></Button>)}{!state.githubLists.length ? <div className="px-3 py-10 text-center text-sm text-muted-foreground">还没有 Lists</div> : null}</Card>
        <section className="min-w-0">
          {selected ? <div className="grid gap-4">
            <Card className="rounded-xl p-4 shadow-card"><div className="grid gap-3 sm:grid-cols-2"><Field label="名称"><Input value={selected.name} onChange={(event) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, name: event.target.value } : item) })} /></Field><Field label="可见性"><label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm"><Checkbox checked={selected.isPrivate} onCheckedChange={(checked) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, isPrivate: checked } : item) })} aria-label="Private" />Private</label></Field></div><Field label="描述"><Textarea rows={2} value={selected.description} onChange={(event) => onStateChange({ ...state, githubLists: state.githubLists.map((item) => item.id === selected.id ? { ...item, description: event.target.value } : item) })} /></Field><div className="mt-3 flex gap-2"><Button loading={saving} onClick={() => void saveList(selected)}>保存</Button><Button variant="destructive" disabled={saving} onClick={() => void removeList(selected)}>删除</Button></div></Card>
            <Card className="rounded-xl p-4 shadow-card"><div className="mb-3 flex items-center gap-2"><RiSearchLine className="size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索本地 Stars 并调整当前 List membership" /></div><div className="grid gap-2">{localCandidates.map((repo) => { const active = selected.items.some((item) => item.fullName === repo.full_name); return <div key={repo.full_name} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"><img src={repo.owner.avatar_url} alt="" className="size-8 rounded-md" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{repo.full_name}</div><div className="truncate text-xs text-muted-foreground">{repo.description || "暂无描述"}</div></div><Button size="sm" variant={active ? "secondary" : "outline"} loading={saving} onClick={() => void toggleMembership(repo.full_name, selected.id, !active)}>{active ? "移出" : "加入"}</Button></div>; })}{!localCandidates.length ? <div className="py-10 text-center text-sm text-muted-foreground">没有匹配的 Stars</div> : null}</div></Card>
          </div> : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">创建或同步一个 GitHub List 后开始管理</div>}
        </section>
      </div>}
      <Modal open={createOpen} title="新建 GitHub List" onClose={() => setCreateOpen(false)}><div className="grid gap-4"><Field label="名称"><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="描述"><Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field><label className="flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm"><Checkbox checked={createPrivate} onCheckedChange={setCreatePrivate} aria-label="Private List" />Private List</label><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button loading={saving} onClick={() => void createList()}>创建</Button></div></div></Modal>
    </div>
  );
}
