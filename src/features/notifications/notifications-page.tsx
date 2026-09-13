import { RiCheckLine, RiExternalLinkLine, RiNotification2Line, RiRefreshLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty";
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
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
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
      setFailedIds(failed);
      setError(`${failed.size} 条通知同步失败，失败项已恢复为未读。`);
    } else { setFailedIds(new Set()); notify("通知已处理", `已将 ${targets.length} 条通知标为已读`, "success"); }
  }

  async function retryFailed() {
    const targets = state.notifications.filter((item) => failedIds.has(item.id));
    if (!targets.length) return;
    const settled = await Promise.allSettled(targets.map((item) => markNotificationRead(item.id)));
    const stillFailed = new Set(targets.filter((_, index) => settled[index].status === "rejected").map((item) => item.id));
    onStateChange({ ...state, notifications: state.notifications.map((item) => failedIds.has(item.id) && !stillFailed.has(item.id) ? { ...item, read: true } : item) });
    setFailedIds(stillFailed);
    if (stillFailed.size) setError(`${stillFailed.size} 条通知仍同步失败。`);
    else { setError(""); notify("重试完成", "失败项已标为已读", "success"); }
  }

  function openItem(item: NotificationItem) {
    if (!item.href) return;
    if (!item.read) void read(item);
    window.open(item.href, "_blank", "noopener,noreferrer");
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">通知中心</h1><p className="mt-1 text-sm text-muted-foreground">查看云端同步、Release 与系统提醒。</p></div><div className="flex gap-2">{failedIds.size ? <Button variant="outline" onClick={() => void retryFailed()}>重试失败项 ({failedIds.size})</Button> : null}<Button variant="outline" disabled={!unreadCount} onClick={() => void markAll()}><RiCheckLine className="size-4" />全部标为已读</Button><Button variant="outline" loading={loading} onClick={() => void refresh()}><RiRefreshLine className="size-4" />刷新</Button></div></header>
    <div className="mt-4"><ToggleGroup value={[filter]} onValueChange={(values) => { const value = values.at(-1); if (value === "all" || value === "unread") setFilter(value); }}><ToggleGroupItem value="all" className="w-auto px-3 text-xs">全部</ToggleGroupItem><ToggleGroupItem value="unread" className="w-auto px-3 text-xs">未读 {unreadCount ? `(${unreadCount})` : ""}</ToggleGroupItem></ToggleGroup></div>
    <StatusBanner error={error} />
    {(initialLoading || loading) && !items.length ? <div className="mt-6"><ListSkeleton rows={6} /></div> : items.length ? <div className="mt-6 grid gap-2">{items.map((item) => <article key={item.id} role={item.href ? "link" : undefined} tabIndex={item.href ? 0 : undefined} onClick={() => openItem(item)} onKeyDown={(event) => { if (item.href && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openItem(item); } }} className={`flex gap-3 rounded-xl p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.href ? "cursor-pointer hover:bg-accent/25" : ""} ${item.read ? "bg-card/75" : "bg-card ring-1 ring-primary/10"}`}><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read ? "bg-border" : "bg-primary"}`} /><RiNotification2Line className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className={`text-sm ${item.read ? "font-medium" : "font-semibold"}`}>{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-CN")}</p></div>{item.href ? <Button size="icon-sm" variant="ghost" aria-label="打开相关内容" onClick={(event) => { event.stopPropagation(); openItem(item); }}><RiExternalLinkLine className="size-4" /></Button> : null}{!item.read ? <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); void read(item); }}><RiCheckLine className="size-4" />标为已读</Button> : null}</article>)}</div> : <Empty className="mt-6 min-h-64 bg-secondary/20"><EmptyContent><EmptyIcon><RiNotification2Line className="size-5" /></EmptyIcon><EmptyTitle>{filter === "unread" ? "没有未读通知" : "暂无通知"}</EmptyTitle><EmptyDescription>{filter === "unread" ? "所有通知都已处理。" : "新的同步与系统通知会显示在这里。"}</EmptyDescription></EmptyContent></Empty>}
  </div>;
}
