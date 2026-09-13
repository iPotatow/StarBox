import { RiCheckLine, RiExternalLinkLine, RiNotification2Line, RiRefreshLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { StatusBanner } from "../../components/ui/status-banner";
import { ListSkeleton } from "../../components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { fetchNotifications, markNotificationRead } from "../../lib/api";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { NotificationItem, PersistedState } from "../../types";

type Filter = "all" | "unread";

export function NotificationsPage({ state, onStateChange, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; initialLoading?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>(() => readQueryParam("filter") === "unread" ? "unread" : "all");
  useEffect(() => replaceQueryParams({ filter: filter === "all" ? "" : filter }), [filter]);
  const items = useMemo(() => state.notifications.slice().sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter((item) => filter === "all" || !item.read), [state.notifications, filter]);
  const unreadCount = state.notifications.filter((item) => !item.read).length;

  async function refresh() {
    setLoading(true); setError("");
    try { const notifications = await fetchNotifications(); onStateChange({ ...state, notifications }); notify("通知已刷新", `共 ${notifications.length} 条`, "success"); }
    catch (reason) { setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "通知中心暂时不可用"); }
    finally { setLoading(false); }
  }
  async function read(item: NotificationItem) {
    if (item.read) return;
    const previous = state.notifications;
    onStateChange({ ...state, notifications: previous.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry) });
    try { await markNotificationRead(item.id); }
    catch (reason) {
      onStateChange({ ...state, notifications: previous });
      const message = reason instanceof Error ? reason.message : "已读状态同步失败";
      setError(`${message}。状态已恢复为未读。`);
    }
  }
  async function markAll() {
    const targets = state.notifications.filter((item) => !item.read); if (!targets.length) return;
    const previous = state.notifications;
    onStateChange({ ...state, notifications: previous.map((item) => ({ ...item, read: true })) });
    const settled = await Promise.allSettled(targets.map((item) => markNotificationRead(item.id)));
    const failed = new Set(targets.filter((_, index) => settled[index].status === "rejected").map((item) => item.id));
    if (failed.size) {
      onStateChange({ ...state, notifications: previous.map((item) => failed.has(item.id) ? { ...item, read: false } : { ...item, read: true }) });
      setError(`${failed.size} 条通知同步失败，失败项已恢复为未读。`);
    } else notify("通知已处理", `已将 ${targets.length} 条通知标为已读`, "success");
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">通知中心</h1><p className="mt-1 text-sm text-muted-foreground">查看云端同步、Release 与系统提醒。</p></div><div className="flex gap-2"><Button variant="outline" disabled={!unreadCount} onClick={() => void markAll()}><RiCheckLine className="size-4" />全部标为已读</Button><Button variant="outline" loading={loading} onClick={() => void refresh()}><RiRefreshLine className="size-4" />刷新</Button></div></header>
    <div className="mt-4"><ToggleGroup value={[filter]} onValueChange={(values) => { const value = values.at(-1); if (value === "all" || value === "unread") setFilter(value); }}><ToggleGroupItem value="all" className="w-auto px-3 text-xs">全部</ToggleGroupItem><ToggleGroupItem value="unread" className="w-auto px-3 text-xs">未读 {unreadCount ? `(${unreadCount})` : ""}</ToggleGroupItem></ToggleGroup></div>
    <StatusBanner error={error} />
    {(initialLoading || loading) && !items.length ? <div className="mt-6"><ListSkeleton rows={6} /></div> : items.length ? <div className="mt-6 grid gap-2">{items.map((item) => <article key={item.id} className={`flex gap-3 rounded-xl bg-card p-4 shadow-card ${item.read ? "opacity-65" : ""}`}><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read ? "bg-border" : "bg-primary"}`} /><RiNotification2Line className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</p></div>{item.href ? <a href={item.href} target="_blank" rel="noreferrer"><Button size="icon-sm" variant="ghost" aria-label="打开相关内容"><RiExternalLinkLine className="size-4" /></Button></a> : null}{!item.read ? <Button size="sm" variant="ghost" onClick={() => void read(item)}><RiCheckLine className="size-4" />已读</Button> : null}</article>)}</div> : <div className="mt-6 grid min-h-64 place-items-center rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground"><div><RiNotification2Line className="mx-auto size-6" /><p className="mt-3">{filter === "unread" ? "没有未读通知" : "暂无通知"}</p></div></div>}
  </div>;
}
