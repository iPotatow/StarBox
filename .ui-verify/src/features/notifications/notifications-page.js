import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { RiCheckLine, RiNotification2Line, RiRefreshLine } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { useMemo, useState } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/react.js";
import { Button } from "../../components/ui/button.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { fetchNotifications, markNotificationRead } from "../../lib/api.js";
export function NotificationsPage({ state, onStateChange }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const items = useMemo(() => state.notifications.slice().sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [state.notifications]);
    async function refresh() {
        setLoading(true);
        setError("");
        try {
            onStateChange({ ...state, notifications: await fetchNotifications() });
        }
        catch (reason) {
            setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "通知中心暂时不可用");
        }
        finally {
            setLoading(false);
        }
    }
    async function read(item) {
        const next = state.notifications.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry);
        onStateChange({ ...state, notifications: next });
        try {
            await markNotificationRead(item.id);
        }
        catch (reason) {
            setError(reason instanceof Error ? `${reason.message}。已保留本地已读状态。` : "已读状态同步失败");
        }
    }
    return _jsxs("div", { className: "mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "\u901A\u77E5\u4E2D\u5FC3" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u67E5\u770B\u4E91\u7AEF\u540C\u6B65\u3001Release \u4E0E\u7CFB\u7EDF\u63D0\u9192\u3002" })] }), _jsxs(Button, { variant: "outline", loading: loading, onClick: () => void refresh(), children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0"] })] }), _jsx(StatusBanner, { error: error }), items.length ? _jsx("div", { className: "mt-6 grid gap-2", children: items.map((item) => _jsxs("article", { className: `flex gap-3 rounded-xl bg-card p-4 shadow-card ${item.read ? "opacity-65" : ""}`, children: [_jsx(RiNotification2Line, { className: "mt-0.5 size-4 shrink-0 text-muted-foreground" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium", children: item.title }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: item.body }), _jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: new Date(item.createdAt).toLocaleString("zh-CN") })] }), !item.read ? _jsxs(Button, { size: "sm", variant: "ghost", onClick: () => void read(item), children: [_jsx(RiCheckLine, { className: "size-4" }), "\u5DF2\u8BFB"] }) : null] }, item.id)) }) : _jsx("div", { className: "mt-6 grid min-h-64 place-items-center rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground", children: _jsxs("div", { children: [_jsx(RiNotification2Line, { className: "mx-auto size-6" }), _jsx("p", { className: "mt-3", children: "\u6682\u65E0\u65B0\u901A\u77E5" })] }) })] });
}
