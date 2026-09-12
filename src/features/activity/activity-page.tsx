import { RiRefreshLine, RiTimeLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { StatusBanner } from "../../components/ui/status-banner";
import { ListSkeleton } from "../../components/ui/skeleton";
import { fetchActivity } from "../../lib/api";
import type { ActivityItem, PersistedState } from "../../types";

export function ActivityPage({ state, onStateChange, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; initialLoading?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const items = useMemo(() => state.activity.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [state.activity]);
  async function refresh() {
    setLoading(true); setError("");
    try { onStateChange({ ...state, activity: await fetchActivity() }); }
    catch (reason) { setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "Activity Log 暂时不可用"); }
    finally { setLoading(false); }
  }
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Activity Log</h1><p className="mt-1 text-sm text-muted-foreground">记录 StarBox 的云端业务变更与同步结果。</p></div><Button variant="outline" loading={loading} onClick={() => void refresh()}><RiRefreshLine className="size-4" />刷新</Button></header><StatusBanner error={error} />{(initialLoading || loading) && !items.length ? <div className="mt-6"><ListSkeleton rows={6} /></div> : items.length ? <div className="mt-6 grid gap-2">{items.map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <div className="mt-6 grid min-h-64 place-items-center rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground"><div><RiTimeLine className="mx-auto size-6" /><p className="mt-3">暂无 Activity Log</p><p className="mt-1 text-xs">首次同步或操作完成后，记录会从 D1 返回。</p></div></div>}</div>;
}

function ActivityRow({ item }: { item: ActivityItem }) { return <article className="flex gap-3 rounded-xl bg-card p-4 shadow-card"><RiTimeLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-sm font-medium">{item.summary}</p><p className="mt-1 text-xs text-muted-foreground">{item.action} · {new Date(item.createdAt).toLocaleString("zh-CN")}</p></div></article>; }
