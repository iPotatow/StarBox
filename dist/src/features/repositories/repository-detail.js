import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RiArrowLeftSLine, RiArrowRightSLine, RiExternalLinkLine, RiGitForkLine, RiMoreLine, RiRefreshLine, RiStarLine } from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { MarkdownContent } from "../../components/ui/markdown-content.js";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../components/ui/menu.js";
import { Modal } from "../../components/ui/modal.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs.js";
import { fetchRepositoryReadme } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.js";
function number(value, locale) { return new Intl.NumberFormat(locale).format(value ?? 0); }
export function RepositoryDetail({ open, repository, token, credentialConnected, onClose, onPrevious, onNext, previousDisabled = false, nextDisabled = false }) {
    const { t, locale } = useI18n();
    const [tab, setTab] = useState("overview");
    const [readme, setReadme] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const canLoad = Boolean(token.trim() || credentialConnected);
    const loadReadme = useCallback(async () => {
        if (!repository || !canLoad || loading)
            return;
        setLoading(true);
        setError("");
        try {
            setReadme(await fetchRepositoryReadme(token.trim(), repository.full_name));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("README 加载失败", "Failed to load README"));
        }
        finally {
            setLoading(false);
        }
    }, [repository?.full_name, token, credentialConnected, loading]);
    useEffect(() => {
        setTab("overview");
        setReadme(null);
        setError("");
        setLoading(false);
    }, [open, repository?.full_name]);
    if (!repository)
        return null;
    return _jsx(Modal, { open: open, title: repository.full_name, description: repository.description || t("仓库详情", "Repository details"), onClose: onClose, className: "max-w-6xl", children: _jsxs(Tabs, { value: tab, onValueChange: (value) => { setTab(value); if (value === "readme" && canLoad && !readme && !loading)
                void loadReadme(); }, children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [_jsxs(TabsList, { children: [_jsx(TabsTab, { value: "overview", children: "Overview" }), _jsx(TabsTab, { value: "readme", children: "README" })] }), onPrevious || onNext ? _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon-sm", onClick: onPrevious, disabled: previousDisabled, "aria-label": t("上一个仓库", "Previous repository"), children: _jsx(RiArrowLeftSLine, { className: "size-4" }) }), _jsx(Button, { variant: "ghost", size: "icon-sm", onClick: onNext, disabled: nextDisabled, "aria-label": t("下一个仓库", "Next repository"), children: _jsx(RiArrowRightSLine, { className: "size-4" }) })] }) : null] }), _jsx(TabsPanel, { value: "overview", children: _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: [_jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Stars" }), _jsxs("div", { className: "mt-1 flex items-center gap-1 text-sm font-semibold", children: [_jsx(RiStarLine, { className: "size-3.5" }), number(repository.stargazers_count, locale)] })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Forks" }), _jsxs("div", { className: "mt-1 flex items-center gap-1 text-sm font-semibold", children: [_jsx(RiGitForkLine, { className: "size-3.5" }), number(repository.forks_count, locale)] })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Watchers" }), _jsx("div", { className: "mt-1 text-sm font-semibold", children: number(repository.watchers_count, locale) })] }), _jsxs("div", { className: "rounded-lg bg-secondary/55 p-3 text-xs", children: [_jsx("div", { className: "text-muted-foreground", children: "Issues" }), _jsx("div", { className: "mt-1 text-sm font-semibold", children: number(repository.open_issues_count, locale) })] })] }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [repository.language ? _jsx(Badge, { children: repository.language }) : null, repository.license ? _jsx(Badge, { children: repository.license }) : null, repository.visibility ? _jsx(Badge, { children: repository.visibility }) : null, repository.default_branch ? _jsx(Badge, { children: repository.default_branch }) : null, repository.topics.map((topic) => _jsx(Badge, { children: topic }, topic))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { render: _jsx("a", { href: repository.html_url, target: "_blank", rel: "noreferrer" }), variant: "outline", children: [_jsx(RiExternalLinkLine, { className: "size-4" }), "GitHub"] }), repository.homepage ? _jsx(Button, { render: _jsx("a", { href: repository.homepage, target: "_blank", rel: "noreferrer" }), variant: "outline", children: "Homepage" }) : null, _jsxs(Menu, { children: [_jsxs(MenuTrigger, { render: _jsx(Button, { variant: "outline" }), children: [_jsx(RiMoreLine, { className: "size-4" }), t("更多", "More")] }), _jsxs(MenuPopup, { children: [_jsx(MenuItem, { render: _jsx("a", { href: `https://deepwiki.com/${repository.full_name}`, target: "_blank", rel: "noreferrer" }), children: "DeepWiki" }), _jsx(MenuItem, { render: _jsx("a", { href: `https://zread.ai/${repository.full_name}`, target: "_blank", rel: "noreferrer" }), children: "Zread" })] })] })] })] }) }), _jsx(TabsPanel, { value: "readme", children: _jsx("section", { children: !canLoad ? _jsx("div", { className: "rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground", children: t("连接 GitHub 凭据后可加载 README。", "Connect GitHub credentials to load the README.") }) : loading ? _jsxs("div", { className: "grid gap-2 rounded-xl border border-border p-5", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), Array.from({ length: 8 }, (_, i) => _jsx(Skeleton, { className: "h-3 w-full" }, i))] }) : error ? _jsxs("div", { className: "rounded-xl border border-border p-5 text-sm", children: [_jsx("p", { className: "text-destructive-foreground", children: error }), _jsxs(Button, { className: "mt-3", size: "sm", variant: "outline", onClick: () => void loadReadme(), children: [_jsx(RiRefreshLine, { className: "size-4" }), t("重试", "Retry")] })] }) : readme ? _jsxs(_Fragment, { children: [_jsx("div", { className: "mb-3 flex justify-end", children: _jsx(Button, { render: _jsx("a", { href: readme.htmlUrl, target: "_blank", rel: "noreferrer" }), size: "sm", variant: "ghost", children: t("GitHub 原文", "View on GitHub") }) }), _jsx("div", { className: "max-h-[68vh] overflow-auto rounded-xl border border-border bg-secondary/20 p-5 sm:p-6", children: _jsx(MarkdownContent, { content: readme.content, linkBaseUrl: `https://github.com/${repository.full_name}/blob/${repository.default_branch || "main"}/README.md`, imageBaseUrl: `https://raw.githubusercontent.com/${repository.full_name}/${repository.default_branch || "main"}/README.md` }) })] }) : _jsx("div", { className: "rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground", children: t("暂无 README", "No README") }) }) })] }) });
}
