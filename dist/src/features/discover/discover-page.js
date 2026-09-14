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
const channelFromQuery = () => { const value = readQueryParam("channel"); return value === "active" || value === "fresh" ? value : "popular"; };
export function DiscoverPage({ state, onStateChange, goToSettings, initialLoading = false }) {
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
            notify("GitHub 查询完成", `已加载 ${data.repositories.length} 个仓库`, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Discover 加载失败");
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
                notify("已取消 Star", repo.full_name, "success");
            }
            else {
                const starred = await starRepository(token, repo.full_name);
                onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] });
                notify("已 Star", repo.full_name, "success");
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Star 操作失败");
        }
        finally {
            setMutating("");
        }
    }
    async function confirmUnstar() { const repo = unstarTarget; if (!repo)
        return; setUnstarTarget(null); await toggleStar(repo); }
    if (!hasGithubCredential)
        return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Discover" }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "\u641C\u7D22 GitHub \u4E0A\u503C\u5F97\u5173\u6CE8\u7684\u4ED3\u5E93\u3002" }), _jsxs(Button, { className: "mt-4", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] });
    return _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6", children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Discover" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u8FDC\u7A0B GitHub \u67E5\u8BE2\u4E0E\u5F53\u524D\u7ED3\u679C\u7B5B\u9009\u5F7C\u6B64\u72EC\u7ACB\uFF0C\u4FEE\u6539\u67E5\u8BE2\u6761\u4EF6\u540E\u7531\u4F60\u663E\u5F0F\u63D0\u4EA4\u3002" })] }), _jsx(StatusBanner, { error: error }), _jsxs("form", { className: "mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card", onSubmit: (event) => { event.preventDefault(); void load(); }, children: [_jsx("div", { className: "text-xs font-semibold text-muted-foreground", children: "GitHub \u67E5\u8BE2\u6761\u4EF6" }), _jsxs("div", { className: "flex flex-wrap items-end gap-3", children: [_jsxs("div", { className: "grid gap-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: "\u6392\u5E8F" }), _jsxs(ToggleGroup, { value: [channel], onValueChange: (values) => { const value = values.at(-1); if (value === "popular" || value === "active" || value === "fresh")
                                            setChannel(value); }, children: [_jsx(ToggleGroupItem, { value: "popular", className: "w-auto px-3 text-xs", children: "\u70ED\u95E8" }), _jsx(ToggleGroupItem, { value: "active", className: "w-auto px-3 text-xs", children: "\u6D3B\u8DC3" }), _jsx(ToggleGroupItem, { value: "fresh", className: "w-auto px-3 text-xs", children: "\u65B0\u9C9C" })] })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Language", _jsx(Input, { "aria-label": "Language", className: "w-36 text-foreground", value: language, onChange: (event) => setLanguage(event.target.value), placeholder: "Any / rust" })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Topic", _jsx(Input, { "aria-label": "Topic", className: "w-40 text-foreground", value: topic, onChange: (event) => setTopic(event.target.value), placeholder: "Any / react" })] }), _jsxs("label", { className: "grid gap-1 text-xs text-muted-foreground", children: ["Period", _jsxs(Select, { "aria-label": "Period", className: "text-foreground", value: String(days), onChange: (event) => setDays(Number(event.target.value)), children: [_jsx("option", { value: "7", children: "7 \u5929" }), _jsx("option", { value: "30", children: "30 \u5929" }), _jsx("option", { value: "90", children: "90 \u5929" }), _jsx("option", { value: "365", children: "1 \u5E74" })] })] }), _jsxs(Button, { type: "submit", loading: loading, children: [_jsx(RiSearchLine, { className: "size-4" }), queryDirty ? "重新搜索" : "搜索 GitHub"] })] }), lastRequest ? _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["\u5F53\u524D\u7ED3\u679C\uFF1A", lastRequest.channel === "popular" ? "热门" : lastRequest.channel === "active" ? "活跃" : "新鲜", " \u00B7 ", lastRequest.language || "全部语言", " \u00B7 ", lastRequest.topic || "全部 Topic", " \u00B7 ", lastRequest.days, " \u5929"] }), queryDirty ? _jsx("span", { className: "rounded-md bg-warning/10 px-2 py-1 text-warning-foreground", children: "\u67E5\u8BE2\u6761\u4EF6\u5DF2\u4FEE\u6539" }) : null] }) : null] }), _jsxs("div", { className: "mb-5 rounded-xl border border-border bg-secondary/30 p-3", children: [_jsx("div", { className: "mb-2 text-xs font-semibold text-muted-foreground", children: "\u5728\u5F53\u524D\u7ED3\u679C\u4E2D\u7B5B\u9009\u4ED3\u5E93" }), _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: "search", "data-search-shortcut": "true", "aria-label": "\u7B5B\u9009\u5F53\u524D GitHub \u67E5\u8BE2\u7ED3\u679C", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u4EC5\u7B5B\u9009\u5DF2\u7ECF\u52A0\u8F7D\u7684\u7ED3\u679C\uFF0C\u4E0D\u91CD\u65B0\u8BF7\u6C42 GitHub" }), _jsx(InputGroupAddon, { children: _jsx(RiSearchLine, { className: "size-4", "aria-hidden": "true" }) })] })] }), (initialLoading || loading) && !results.length ? _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }, (_, index) => _jsx(RepositoryCardSkeleton, {}, index)) }) : _jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return _jsxs(Card, { render: _jsx("article", {}), className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("img", { src: repo.owner.avatar_url, alt: "", className: "size-10 rounded-lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Button, { variant: "link", size: "none", className: "max-w-full truncate text-left text-sm font-semibold", onClick: () => setPreview(repo), children: repo.full_name }), _jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground", children: repo.description || "暂无描述" })] }), _jsxs(Button, { size: "sm", variant: starred ? "secondary" : "outline", loading: mutating === repo.full_name, onClick: () => { if (starred)
                                        setUnstarTarget(repo);
                                    else
                                        void toggleStar(repo); }, children: [starred ? _jsx(RiStarFill, { className: "size-4" }) : _jsx(RiStarLine, { className: "size-4" }), starred ? "取消 Star" : "Star"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [repo.language ? _jsx(Badge, { children: repo.language }) : null, repo.topics.slice(0, 5).map((topicName) => _jsx(Badge, { children: topicName }, topicName)), repo.topics.length > 5 ? _jsxs(Badge, { variant: "secondary", children: ["+", repo.topics.length - 5] }) : null] }), _jsxs("div", { className: "mt-4 flex items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(RiStarFill, { className: "size-3.5" }), repo.stargazers_count.toLocaleString()] }), _jsxs(Button, { render: _jsx("a", { href: repo.html_url, target: "_blank", rel: "noreferrer" }), variant: "ghost", size: "sm", className: "ml-auto", children: [_jsx(RiExternalLinkLine, { className: "size-3.5" }), "GitHub"] })] })] }, repo.full_name); }) }), !visible.length && !loading && !initialLoading ? _jsx(Empty, { className: "mt-6 min-h-56", children: _jsxs(EmptyContent, { children: [_jsx(EmptyIcon, { children: _jsx(RiSearchLine, { className: "size-5" }) }), _jsx(EmptyTitle, { children: results.length ? "当前结果中没有匹配项" : "尚未执行 GitHub 查询" }), _jsx(EmptyDescription, { children: results.length ? "调整本地筛选关键词，或重新查询 GitHub。" : "设置查询条件后搜索 GitHub 仓库。" })] }) }) : null, _jsx(RepositoryDetail, { open: Boolean(preview), repository: preview, token: state.settings.githubToken, credentialConnected: state.settings.credentialConnected, onClose: () => setPreview(null) }), _jsx(AlertDialog, { open: Boolean(unstarTarget), onOpenChange: (open) => { if (!open)
                    setUnstarTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u53D6\u6D88 Star\uFF1F" }), _jsxs(AlertDialogDescription, { children: ["\u5C06\u4ECE GitHub \u53D6\u6D88 Star\uFF1A", unstarTarget?.full_name ?? "该仓库", "\u3002\u6B64\u64CD\u4F5C\u9700\u8981\u518D\u6B21\u786E\u8BA4\u3002"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => void confirmUnstar(), children: "\u53D6\u6D88 Star" })] })] }) })] });
}
