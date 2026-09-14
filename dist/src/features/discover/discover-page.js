import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiExternalLinkLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../../components/ui/empty.js";
import { Input } from "../../components/ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { Select } from "../../components/ui/select.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { RepositoryDetail } from "../repositories/repository-detail.js";
import { RepositoryCardSkeleton } from "../../components/ui/skeleton.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { notify } from "../../components/ui/toast.js";
import { fetchDiscover, starRepository, unstarRepository } from "../../lib/api.js";
import { readQueryNumber, readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
import { useI18n } from "../../lib/i18n.js";
const channelFromQuery = () => { const value = readQueryParam("channel"); return value === "active" || value === "fresh" ? value : "popular"; };
export function DiscoverPage({ state, onStateChange, goToSettings, initialLoading = false }) {
    const { t, locale } = useI18n();
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [channel, setChannel] = useState(channelFromQuery);
    const [language, setLanguage] = useState(() => readQueryParam("language"));
    const [topic, setTopic] = useState(() => readQueryParam("topic"));
    const [days, setDays] = useState(() => readQueryNumber("days", 30));
    const [query, setQuery] = useState(() => readQueryParam("q"));
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState("");
    const [error, setError] = useState("");
    const [unstarTarget, setUnstarTarget] = useState(null);
    const [preview, setPreview] = useState(null);
    const [lastRequest, setLastRequest] = useState(null);
    useEffect(() => { replaceQueryParams({ channel: channel === "popular" ? "" : channel, language, topic, days: days === 30 ? "" : days, q: query }); }, [channel, language, topic, days, query]);
    async function load() {
        if (!hasGithubCredential)
            return goToSettings();
        setLoading(true);
        setError("");
        try {
            const request = { channel, language: language.trim(), topic: topic.trim(), days };
            const data = await fetchDiscover(token, request.channel, request.language, request.topic, request.days);
            setResults(data.repositories);
            setLastRequest(request);
            notify(t("GitHub 查询完成", "GitHub search completed"), t(`已加载 ${data.repositories.length} 个仓库`, `Loaded ${data.repositories.length} repositories`), "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("Discover 加载失败", "Failed to load Discover"));
        }
        finally {
            setLoading(false);
        }
    }
    const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
    const queryDirty = Boolean(lastRequest && (lastRequest.channel !== channel || lastRequest.language !== language.trim() || lastRequest.topic !== topic.trim() || lastRequest.days !== days));
    async function toggleStar(repo) {
        setMutating(repo.full_name);
        setError("");
        const exists = state.repositories.some((item) => item.full_name === repo.full_name);
        try {
            if (exists) {
                await unstarRepository(token, repo.full_name);
                onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) });
                notify(t("已取消 Star", "Unstarred"), repo.full_name, "success");
            }
            else {
                const starred = await starRepository(token, repo.full_name);
                onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] });
                notify(t("已 Star", "Starred"), repo.full_name, "success");
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("Star 操作失败", "Star action failed"));
        }
        finally {
            setMutating("");
        }
    }
    async function confirmUnstar() { const repo = unstarTarget; if (!repo)
        return; setUnstarTarget(null); await toggleStar(repo); }
    if (!hasGithubCredential)
        return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Discover" }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: t("搜索 GitHub 上值得关注的仓库。", "Find GitHub repositories worth following.") }), _jsxs(Button, { className: "mt-4", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), t("打开设置", "Open Settings")] })] });
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6", children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Discover" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: t("远程 GitHub 查询与当前结果筛选彼此独立，修改查询条件后由你显式提交。", "GitHub search and local result filtering are independent; submit changed search criteria explicitly.") })] }), _jsx(StatusBanner, { error: error }), _jsxs("form", { className: "mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card", onSubmit: (event) => { event.preventDefault(); void load(); }, children: [_jsx("div", { className: "text-xs font-semibold text-muted-foreground", children: t("GitHub 查询条件", "GitHub search criteria") }), _jsxs("div", { className: "flex flex-wrap items-end gap-3", children: [_jsxs("div", { className: "grid gap-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t("排序", "Sort") }), _jsxs(ToggleGroup, { value: [channel], onValueChange: (values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh")
                                            setChannel(value); }, children: [_jsx(ToggleGroupItem, { value: "popular", className: "w-auto px-3 text-xs", children: t("热门", "Popular") }), _jsx(ToggleGroupItem, { value: "active", className: "w-auto px-3 text-xs", children: t("活跃", "Active") }), _jsx(ToggleGroupItem, { value: "fresh", className: "w-auto px-3 text-xs", children: t("新鲜", "Fresh") })] })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Language", _jsx(Input, { "aria-label": "Language", className: "w-36 text-foreground", value: language, onChange: (event) => setLanguage(event.target.value), placeholder: "Any / rust" })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Topic", _jsx(Input, { "aria-label": "Topic", className: "w-40 text-foreground", value: topic, onChange: (event) => setTopic(event.target.value), placeholder: "Any / react" })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Period", _jsxs(Select, { "aria-label": "Period", className: "text-foreground", value: String(days), onChange: (event) => setDays(Number(event.target.value)), children: [_jsx("option", { value: "7", children: t("7 天", "7 days") }), _jsx("option", { value: "30", children: t("30 天", "30 days") }), _jsx("option", { value: "90", children: t("90 天", "90 days") }), _jsx("option", { value: "365", children: t("1 年", "1 year") })] })] }), _jsxs(Button, { type: "submit", loading: loading, children: [_jsx(RiSearchLine, { className: "size-4" }), queryDirty ? t("重新搜索", "Search again") : t("搜索 GitHub", "Search GitHub")] })] }), lastRequest ? _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { children: [t("当前结果：", "Results: "), lastRequest.channel === "popular" ? t("热门", "Popular") : lastRequest.channel === "active" ? t("活跃", "Active") : t("新鲜", "Fresh"), " \u00B7 ", lastRequest.language || t("全部语言", "All languages"), " \u00B7 ", lastRequest.topic || t("全部 Topic", "All topics"), " \u00B7 ", t(`${lastRequest.days} 天`, `${lastRequest.days} days`)] }), queryDirty ? _jsx("span", { className: "rounded-md bg-warning/10 px-2 py-1 text-warning-foreground", children: t("查询条件已修改", "Search criteria changed") }) : null] }) : null] }), _jsxs("div", { className: "mb-5 rounded-xl border border-border bg-secondary/30 p-3", children: [_jsx("div", { className: "mb-2 text-xs font-semibold text-muted-foreground", children: t("在当前结果中筛选仓库", "Filter repositories in current results") }), _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: "search", "data-search-shortcut": "true", "aria-label": t("筛选当前 GitHub 查询结果", "Filter current GitHub results"), value: query, onChange: (event) => setQuery(event.target.value), placeholder: t("仅筛选已经加载的结果，不重新请求 GitHub", "Filter loaded results only; do not query GitHub again") }), _jsx(InputGroupAddon, { children: _jsx(RiSearchLine, { className: "size-4", "aria-hidden": "true" }) })] })] }), (initialLoading || loading) && !results.length ? _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }, (_, index) => _jsx(RepositoryCardSkeleton, {}, index)) }) : _jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return _jsxs(Card, { render: _jsx("article", {}), className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("img", { src: repo.owner.avatar_url, alt: "", className: "size-10 rounded-lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Button, { variant: "link", size: "none", className: "max-w-full truncate text-left text-sm font-semibold", onClick: () => setPreview(repo), children: repo.full_name }), _jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground", children: repo.description || t("暂无描述", "No description") })] }), _jsxs(Button, { size: "sm", variant: starred ? "secondary" : "outline", loading: mutating === repo.full_name, onClick: () => { if (starred)
                                        setUnstarTarget(repo);
                                    else
                                        void toggleStar(repo); }, children: [starred ? _jsx(RiStarFill, { className: "size-4" }) : _jsx(RiStarLine, { className: "size-4" }), starred ? t("取消 Star", "Unstar") : "Star"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [repo.language ? _jsx(Badge, { children: repo.language }) : null, repo.topics.slice(0, 5).map((topicName) => _jsx(Badge, { children: topicName }, topicName)), repo.topics.length > 5 ? _jsxs(Badge, { variant: "secondary", children: ["+", repo.topics.length - 5] }) : null] }), _jsxs("div", { className: "mt-4 flex items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(RiStarFill, { className: "size-3.5" }), repo.stargazers_count.toLocaleString(locale)] }), _jsxs(Button, { render: _jsx("a", { href: repo.html_url, target: "_blank", rel: "noreferrer" }), variant: "ghost", size: "sm", className: "ml-auto", children: [_jsx(RiExternalLinkLine, { className: "size-3.5" }), "GitHub"] })] })] }, repo.full_name); }) }), !visible.length && !loading && !initialLoading ? _jsx(Empty, { className: "mt-6 min-h-56", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiSearchLine, { className: "size-5" }) }), _jsx(EmptyTitle, { children: results.length ? t("当前结果中没有匹配项", "No matches in current results") : t("尚未执行 GitHub 查询", "No GitHub search yet") }), _jsx(EmptyDescription, { children: results.length ? t("调整本地筛选关键词，或重新查询 GitHub。", "Adjust the local filter or search GitHub again.") : t("设置查询条件后搜索 GitHub 仓库。", "Set search criteria, then search GitHub repositories.") })] }) }) : null, _jsx(RepositoryDetail, { open: Boolean(preview), repository: preview, token: state.settings.githubToken, credentialConnected: state.settings.credentialConnected, onClose: () => setPreview(null) }), _jsx(AlertDialog, { open: Boolean(unstarTarget), onOpenChange: (open) => { if (!open)
                    setUnstarTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("取消 Star？", "Unstar repository?") }), _jsx(AlertDialogDescription, { children: t(`将从 GitHub 取消 Star：${unstarTarget?.full_name ?? "该仓库"}。此操作需要再次确认。`, `This will unstar ${unstarTarget?.full_name ?? "this repository"} on GitHub. Please confirm.`) })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("取消", "Cancel") }), _jsx(Button, { variant: "destructive", onClick: () => void confirmUnstar(), children: t("取消 Star", "Unstar") })] })] }) })] });
}
