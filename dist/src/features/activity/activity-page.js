import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiRefreshLine, RiTimeLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { ListSkeleton } from "../../components/ui/skeleton.js";
import { fetchActivity } from "../../lib/api.js";
export function ActivityPage({ state, onStateChange, initialLoading = false }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const items = useMemo(() => state.activity.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [state.activity]);
    async function refresh() {
        setLoading(true);
        setError("");
        try {
            onStateChange({ ...state, activity: await fetchActivity() });
        }
        catch (reason) {
            setError(reason instanceof Error ? `${reason.message}。当前显示本地缓存，可在 Worker 可用后重试。` : "Activity Log 暂时不可用");
        }
        finally {
            setLoading(false);
        }
    }
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Activity Log" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u8BB0\u5F55 StarBox \u7684\u4E91\u7AEF\u4E1A\u52A1\u53D8\u66F4\u4E0E\u540C\u6B65\u7ED3\u679C\u3002" })] }), _jsxs(Button, { variant: "outline", loading: loading, onClick: () => void refresh(), children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0"] })] }), _jsx(StatusBanner, { error: error }), (initialLoading || loading) && !items.length ? _jsx("div", { className: "mt-6", children: _jsx(ListSkeleton, { rows: 6 }) }) : items.length ? _jsx("div", { className: "mt-6 grid gap-2", children: items.map((item) => _jsx(ActivityRow, { item: item }, item.id)) }) : _jsx("div", { className: "mt-6 grid min-h-64 place-items-center rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground", children: _jsxs("div", { children: [_jsx(RiTimeLine, { className: "mx-auto size-6" }), _jsx("p", { className: "mt-3", children: "\u6682\u65E0 Activity Log" }), _jsx("p", { className: "mt-1 text-xs", children: "\u9996\u6B21\u540C\u6B65\u6216\u64CD\u4F5C\u5B8C\u6210\u540E\uFF0C\u8BB0\u5F55\u4F1A\u4ECE D1 \u8FD4\u56DE\u3002" })] }) })] });
}
function ActivityRow({ item }) { return _jsxs("article", { className: "flex gap-3 rounded-xl bg-card p-4 shadow-card", children: [_jsx(RiTimeLine, { className: "mt-0.5 size-4 shrink-0 text-muted-foreground" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium", children: item.summary }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [item.action, " \u00B7 ", new Date(item.createdAt).toLocaleString("zh-CN")] })] })] }); }
