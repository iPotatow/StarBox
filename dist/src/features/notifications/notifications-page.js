import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiExternalLinkLine, RiNotification2Line, RiRefreshLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { ListSkeleton } from "../../components/ui/skeleton.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { notify } from "../../components/ui/toast.js";
import { fetchNotifications, markNotificationRead } from "../../lib/api.js";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
export function NotificationsPage({ state, onStateChange, initialLoading = false }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState(() => readQueryParam("filter") === "unread" ? "unread" : "all");
    const [failedIds, setFailedIds] = useState(() => new Set());
    useEffect(() => replaceQueryParams({ filter: filter === "all" ? "" : filter }), [filter]);
    const items = useMemo(() => state.notifications.slice().sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter((item) => filter === "all" || !item.read), [state.notifications, filter]);
    const unreadCount = state.notifications.filter((item) => !item.read).length;
    async function refresh() {
        setLoading(true);
        setError("");
        try {
            const notifications = await fetchNotifications();
            onStateChange({ ...state, notifications });
            notify("通知已刷新", `共 ${notifications.length} 条`, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "通知中心暂时不可用");
        }
        finally {
            setLoading(false);
        }
    }
    async function read(item) {
        if (item.read)
            return;
        const previous = state.notifications;
        onStateChange({ ...state, notifications: previous.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry) });
        try {
            await markNotificationRead(item.id);
        }
        catch (reason) {
            onStateChange({ ...state, notifications: previous });
            const message = reason instanceof Error ? reason.message : "已读状态同步失败";
            setError(`${message}。状态已恢复为未读。`);
        }
    }
    async function markAll() {
        const targets = state.notifications.filter((item) => !item.read);
        if (!targets.length)
            return;
        const previous = state.notifications;
        onStateChange({ ...state, notifications: previous.map((item) => ({ ...item, read: true })) });
        const settled = await Promise.allSettled(targets.map((item) => markNotificationRead(item.id)));
        const failed = new Set(targets.filter((_, index) => settled[index].status === "rejected").map((item) => item.id));
        if (failed.size) {
            onStateChange({ ...state, notifications: previous.map((item) => failed.has(item.id) ? { ...item, read: false } : { ...item, read: true }) });
            setFailedIds(failed);
            setError(`${failed.size} 条通知同步失败，失败项已恢复为未读。`);
        }
        else {
            setFailedIds(new Set());
            notify("通知已处理", `已将 ${targets.length} 条通知标为已读`, "success");
        }
    }
    async function retryFailed() {
        const targets = state.notifications.filter((item) => failedIds.has(item.id));
        if (!targets.length)
            return;
        const settled = await Promise.allSettled(targets.map((item) => markNotificationRead(item.id)));
        const stillFailed = new Set(targets.filter((_, index) => settled[index].status === "rejected").map((item) => item.id));
        onStateChange({ ...state, notifications: state.notifications.map((item) => failedIds.has(item.id) && !stillFailed.has(item.id) ? { ...item, read: true } : item) });
        setFailedIds(stillFailed);
        if (stillFailed.size)
            setError(`${stillFailed.size} 条通知仍同步失败。`);
        else {
            setError("");
            notify("重试完成", "失败项已标为已读", "success");
        }
    }
    function openItem(item) {
        if (!item.href)
            return;
        if (!item.read)
            void read(item);
        window.open(item.href, "_blank", "noopener,noreferrer");
    }
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "\u901A\u77E5\u4E2D\u5FC3" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u67E5\u770B\u4E91\u7AEF\u540C\u6B65\u3001Release \u4E0E\u7CFB\u7EDF\u63D0\u9192\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [failedIds.size ? _jsxs(Button, { variant: "outline", onClick: () => void retryFailed(), children: ["\u91CD\u8BD5\u5931\u8D25\u9879 (", failedIds.size, ")"] }) : null, _jsxs(Button, { variant: "outline", disabled: !unreadCount, onClick: () => void markAll(), children: [_jsx(RiCheckLine, { className: "size-4" }), "\u5168\u90E8\u6807\u4E3A\u5DF2\u8BFB"] }), _jsxs(Button, { variant: "outline", loading: loading, onClick: () => void refresh(), children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0"] })] })] }), _jsx("div", { className: "mt-4", children: _jsxs(ToggleGroup, { value: [filter], onValueChange: (values) => { const value = values.at(-1); if (value === "all" || value === "unread")
                        setFilter(value); }, children: [_jsx(ToggleGroupItem, { value: "all", className: "w-auto px-3 text-xs", children: "\u5168\u90E8" }), _jsxs(ToggleGroupItem, { value: "unread", className: "w-auto px-3 text-xs", children: ["\u672A\u8BFB ", unreadCount ? `(${unreadCount})` : ""] })] }) }), _jsx(StatusBanner, { error: error }), (initialLoading || loading) && !items.length ? _jsx("div", { className: "mt-6", children: _jsx(ListSkeleton, { rows: 6 }) }) : items.length ? _jsx("div", { className: "mt-6 grid gap-2", children: items.map((item) => _jsxs("article", { role: item.href ? "link" : undefined, tabIndex: item.href ? 0 : undefined, onClick: () => openItem(item), onKeyDown: (event) => { if (item.href && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openItem(item);
                    } }, className: `flex gap-3 rounded-xl p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.href ? "cursor-pointer hover:bg-accent/25" : ""} ${item.read ? "bg-card/75" : "bg-card ring-1 ring-primary/10"}`, children: [_jsx("span", { className: `mt-1 size-2 shrink-0 rounded-full ${item.read ? "bg-border" : "bg-primary"}` }), _jsx(RiNotification2Line, { className: "mt-0.5 size-4 shrink-0 text-muted-foreground" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: `text-sm ${item.read ? "font-medium" : "font-semibold"}`, children: item.title }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: item.body }), _jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: new Date(item.createdAt).toLocaleString("zh-CN") })] }), item.href ? _jsx(Button, { size: "icon-sm", variant: "ghost", "aria-label": "\u6253\u5F00\u76F8\u5173\u5185\u5BB9", onClick: (event) => { event.stopPropagation(); openItem(item); }, children: _jsx(RiExternalLinkLine, { className: "size-4" }) }) : null, !item.read ? _jsxs(Button, { size: "sm", variant: "ghost", onClick: (event) => { event.stopPropagation(); void read(item); }, children: [_jsx(RiCheckLine, { className: "size-4" }), "\u6807\u4E3A\u5DF2\u8BFB"] }) : null] }, item.id)) }) : _jsx(Empty, { className: "mt-6 min-h-64 bg-secondary/20", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiNotification2Line, { className: "size-5" }) }), _jsx(EmptyTitle, { children: filter === "unread" ? "没有未读通知" : "暂无通知" }), _jsx(EmptyDescription, { children: filter === "unread" ? "所有通知都已处理。" : "新的同步与系统通知会显示在这里。" })] }) })] });
}
