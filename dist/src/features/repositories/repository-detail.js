import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiExternalLinkLine, RiGitForkLine, RiRefreshLine, RiStarFill } from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Modal } from "../../components/ui/modal.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs.js";
import { fetchRepositoryReadme } from "../../lib/api.js";
function number(value) { return new Intl.NumberFormat("zh-CN").format(value ?? 0); }
export function RepositoryDetail({ open, repository, token, credentialConnected, onClose }) {
    const [readme, setReadme] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const canLoad = Boolean(token.trim() || credentialConnected);
    const loadReadme = useCallback(async () => {
        if (!repository || !canLoad)
            return;
        setLoading(true);
        setError("");
        try {
            setReadme(await fetchRepositoryReadme(token.trim(), repository.full_name));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "README 加载失败");
        }
        finally {
            setLoading(false);
        }
    }, [repository?.full_name, token, credentialConnected]);
    useEffect(() => { if (!open || !repository) {
        setReadme(null);
        setError("");
        return;
    } if (canLoad)
        void loadReadme(); }, [open, repository?.full_name]);
    if (!repository)
        return null;
    return _jsx(Modal, { open: open, title: repository.full_name, description: repository.description || "仓库详情", onClose: onClose, className: "max-w-3xl", children: _jsxs(Tabs, { defaultValue: "overview", children: [_jsxs(TabsList, { className: "mb-4", children: [_jsx(TabsTab, { value: "overview", children: "Overview" }), _jsx(TabsTab, { value: "readme", children: "README" })] }), _jsx(TabsPanel, { value: "overview", children: _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: [_jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Stars" }), _jsxs("div", { className: "mt-1 flex items-center gap-1 text-sm font-semibold", children: [_jsx(RiStarFill, { className: "size-3.5" }), number(repository.stargazers_count)] })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Forks" }), _jsxs("div", { className: "mt-1 flex items-center gap-1 text-sm font-semibold", children: [_jsx(RiGitForkLine, { className: "size-3.5" }), number(repository.forks_count)] })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Watchers" }), _jsx("div", { className: "mt-1 text-sm font-semibold", children: number(repository.watchers_count) })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Issues" }), _jsx("div", { className: "mt-1 text-sm font-semibold", children: number(repository.open_issues_count) })] })] }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [repository.language ? _jsx(Badge, { children: repository.language }) : null, repository.license ? _jsx(Badge, { children: repository.license }) : null, repository.visibility ? _jsx(Badge, { children: repository.visibility }) : null, repository.default_branch ? _jsx(Badge, { children: repository.default_branch }) : null, repository.topics.map((topic) => _jsx(Badge, { children: topic }, topic))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("a", { href: repository.html_url, target: "_blank", rel: "noreferrer", children: _jsxs(Button, { variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub"] }) }), repository.homepage ? _jsx("a", { href: repository.homepage, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "outline", children: "Homepage" }) }) : null, _jsx("a", { href: `https://deepwiki.com/${repository.full_name}`, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "outline", children: "DeepWiki" }) }), _jsx("a", { href: `https://zread.ai/${repository.full_name}`, target: "_blank", rel: "noreferrer", children: _jsx(Button, { variant: "outline", children: "Zread" }) })] })] }) }), _jsx(TabsPanel, { value: "readme", children: _jsx("section", { children: !canLoad ? _jsx("div", { className: "rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground", children: "\u8FDE\u63A5 GitHub \u51ED\u636E\u540E\u53EF\u52A0\u8F7D README\u3002" }) : loading ? _jsxs("div", { className: "grid gap-2 rounded-xl border border-border p-5", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), Array.from({ length: 8 }, (_, i) => _jsx(Skeleton, { className: "h-3 w-full" }, i))] }) : error ? _jsxs("div", { className: "rounded-xl border border-border p-5 text-sm", children: [_jsx("p", { className: "text-destructive-foreground", children: error }), _jsxs(Button, { className: "mt-3", size: "sm", variant: "outline", onClick: () => void loadReadme(), children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u91CD\u8BD5"] })] }) : readme ? _jsxs(_Fragment, { children: [_jsx("div", { className: "mb-2 flex justify-end", children: _jsx("a", { href: readme.htmlUrl, target: "_blank", rel: "noreferrer", className: "text-xs text-muted-foreground hover:underline", children: "GitHub \u539F\u6587" }) }), _jsx("pre", { className: "max-h-[56vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-6", children: readme.content })] }) : _jsx("div", { className: "rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground", children: "\u6682\u65E0 README" }) }) })] }) });
}
