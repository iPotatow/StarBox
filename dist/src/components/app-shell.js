import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiFolder3Line, RiGitForkLine, RiGithubFill, RiNotification2Line, RiPriceTag3Line, RiSearchLine, RiSettings4Line, RiStarLine, } from "@remixicon/react";
import { Button } from "./ui/button.js";
import { cn } from "../lib/cn.js";
const navMeta = {
    repositories: { label: "Stars", icon: RiStarLine },
    releases: { label: "Release", icon: RiPriceTag3Line },
    forks: { label: "Fork", icon: RiGitForkLine },
    lists: { label: "Lists", icon: RiFolder3Line },
    discover: { label: "Discover", icon: RiSearchLine },
    notifications: { label: "通知", icon: RiNotification2Line },
    settings: { label: "设置", icon: RiSettings4Line },
};
export function AppShell({ page, settings, session, unreadNotifications, onPageChange, children, }) {
    const ordered = settings.navOrder.filter((item) => !settings.hiddenNav.includes(item));
    const nav = Array.from(new Set(["repositories", ...ordered, "settings"]));
    return (_jsxs("div", { className: "app-shell min-h-screen bg-sidebar text-foreground", children: [_jsxs("aside", { className: "fixed inset-y-0 left-0 z-20 hidden w-56 bg-sidebar px-3 py-4 md:flex md:flex-col", children: [_jsxs(Button, { variant: "ghost", size: "none", onClick: () => onPageChange("repositories"), className: "mb-5 flex items-center justify-start gap-2 px-2 text-left", children: [_jsx("span", { className: "grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm", children: _jsx(RiStarLine, { className: "size-4" }) }), _jsx("span", { className: "text-sm font-semibold tracking-tight", children: "StarBox" })] }), _jsx("nav", { className: "grid gap-1", "aria-label": "\u4E3B\u5BFC\u822A", children: nav.map((id) => {
                            const item = navMeta[id];
                            const Icon = item.icon;
                            const active = page === id;
                            return (_jsxs(Button, { variant: "ghost", size: "none", onClick: () => onPageChange(id), className: cn("flex h-[38px] items-center justify-start gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors", active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"), children: [_jsx(Icon, { className: "size-4" }), item.label] }, id));
                        }) }), _jsxs("div", { className: "mt-auto grid gap-2 px-2 py-2 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(RiGithubFill, { className: "size-4" }), session?.username || "StarBox"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "size-1.5 rounded-full bg-emerald-500" }), unreadNotifications ? `${unreadNotifications} 条未读通知` : "会话已连接"] })] })] }), _jsxs("header", { className: "sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/92 px-4 backdrop-blur md:hidden", children: [_jsxs(Button, { variant: "ghost", size: "none", onClick: () => onPageChange("repositories"), className: "flex shrink-0 items-center gap-2 font-semibold", children: [_jsx("span", { className: "grid size-7 place-items-center rounded-md bg-foreground text-background", children: _jsx(RiStarLine, { className: "size-4" }) }), "StarBox"] }), _jsx("nav", { className: "ml-auto flex min-w-0 items-center gap-1 overflow-x-auto", "aria-label": "\u4E3B\u5BFC\u822A", children: nav.map((id) => {
                            const item = navMeta[id];
                            const Icon = item.icon;
                            return (_jsx(Button, { variant: "ghost", size: "none", onClick: () => onPageChange(id), "aria-label": item.label, className: cn("grid size-9 shrink-0 place-items-center rounded-lg", page === id ? "bg-accent" : "text-muted-foreground"), children: _jsx(Icon, { className: "size-4" }) }, id));
                        }) })] }), _jsx("main", { className: "app-main min-h-screen md:pl-56", children: _jsx("div", { className: "content-surface", "data-testid": "content-surface", "aria-label": "\u4E3B\u5185\u5BB9\u533A", children: children }) })] }));
}
