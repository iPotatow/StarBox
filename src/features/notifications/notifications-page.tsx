import { RiCheckLine, RiNotification2Line, RiRefreshLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { StatusBanner } from "../../components/ui/status-banner";
import { fetchNotifications, markNotificationRead } from "../../lib/api";
import type { NotificationItem, PersistedState } from "../../types";

export function NotificationsPage({ state, onStateChange }: { state: PersistedState; onStateChange: (state: PersistedState) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const items = useMemo(() => state.notifications.slice().sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [state.notifications]);
  async function refresh() {
    setLoading(true); setError("");
    try { onStateChange({ ...state, notifications: await fetchNotifications() }); }
    catch (reason) { setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "通知中心暂时不可用"); }
    finally { setLoading(false); }
  }
  async function read(item: NotificationItem) {
    const next = state.notifications.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry);
    onStateChange({ ...state, notifications: next });
    try { await markNotificationRead(item.id); } catch (reason) { setError(reason instanceof Error ? `${reason.message}。已保留本地已读状态。` : "已读状态同步失败"); }
  }
  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">通知中心</h1><p className="mt-1 text-sm text-muted-foreground">查看云端同步、Release 与系统提醒。</p></div><Button variant="outline" loading={loading} onClick={() => void refresh()}><RiRefreshLine className="size-4" />刷新</Button></header><StatusBanner error={error} />{items.length ? <div className="mt-6 grid gap-2">{items.map((item) => <article key={item.id} className={`flex gap-3 rounded-xl bg-card p-4 shadow-card ${item.read ? "opacity-65" : ""}`}><RiNotification2Line className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</p></div>{!item.read ? <Button size="sm" variant="ghost" onClick={() => void read(item)}><RiCheckLine className="size-4" />已读</Button> : null}</article>)}</div> : <div className="mt-6 grid min-h-64 place-items-center rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground"><div><RiNotification2Line className="mx-auto size-6" /><p className="mt-3">暂无新通知</p></div></div>}</div>;
}
