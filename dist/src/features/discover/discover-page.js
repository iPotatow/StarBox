import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiExternalLinkLine, RiRefreshLine, RiSearchLine, RiSettings4Line, RiStarFill, RiStarLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { StatusBanner } from "../../components/ui/status-banner.js";
import { fetchDiscover, starRepository, unstarRepository } from "../../lib/api.js";
export function DiscoverPage({ state, onStateChange, goToSettings }) {
    const token = state.settings.githubToken.trim();
    const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
    const [channel, setChannel] = useState("popular");
    const [language, setLanguage] = useState("");
    const [topic, setTopic] = useState("");
    const [days, setDays] = useState(30);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    async function load() { if (!hasGithubCredential)
        return goToSettings(); setLoading(true); setError(""); setSuccess(""); try {
        const data = await fetchDiscover(token, channel, language.trim(), topic.trim(), days);
        setResults(data.repositories);
        setSuccess(`已加载 ${data.repositories.length} 个仓库`);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Discover 加载失败");
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { if (hasGithubCredential)
        void load(); }, [channel, days]);
    const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return results.filter((repo) => !needle || [repo.full_name, repo.description, repo.language, ...repo.topics].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [results, query]);
    async function toggleStar(repo) {
        setMutating(repo.full_name);
        setError("");
        const exists = state.repositories.some((item) => item.full_name === repo.full_name);
        try {
            if (exists) {
                await unstarRepository(token, repo.full_name);
                onStateChange({ ...state, repositories: state.repositories.filter((item) => item.full_name !== repo.full_name) });
                setSuccess(`已取消 Star：${repo.full_name}`);
            }
            else {
                const starred = await starRepository(token, repo.full_name);
                onStateChange({ ...state, repositories: [starred, ...state.repositories.filter((item) => item.full_name !== starred.full_name)] });
                setSuccess(`已 Star：${repo.full_name}`);
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Star 操作失败");
        }
        finally {
            setMutating("");
        }
    }
    if (!hasGithubCredential)
        return _jsxs("div", { className: "mx-auto max-w-4xl px-4 py-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Discover" }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Discover \u4F7F\u7528 GitHub Search API \u4E0E\u666E\u901A\u6587\u672C\u7B5B\u9009\uFF0C\u4E0D\u9700\u8981\u989D\u5916\u670D\u52A1\u3002" }), _jsxs(Button, { className: "mt-4", onClick: goToSettings, children: [_jsx(RiSettings4Line, { className: "size-4" }), "\u6253\u5F00\u8BBE\u7F6E"] })] });
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-6", children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "Discover" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u57FA\u4E8E GitHub Search API \u7684\u8F7B\u91CF\u53D1\u73B0\u9875\uFF1A\u70ED\u95E8\u3001\u6D3B\u8DC3\u3001\u65B0\u9C9C\u4ED3\u5E93 + \u666E\u901A\u6587\u672C\u7B5B\u9009\u3002" })] }), _jsx(StatusBanner, { error: error, success: !error ? success : "" }), _jsxs(Card, { className: "mb-5 flex-row flex-wrap gap-2 rounded-xl p-2 shadow-card", children: [_jsxs(Select, { value: channel, onChange: (event) => setChannel(event.target.value), children: [_jsx("option", { value: "popular", children: "\u70ED\u95E8" }), _jsx("option", { value: "active", children: "\u6D3B\u8DC3" }), _jsx("option", { value: "fresh", children: "\u65B0\u9C9C" })] }), _jsx(Input, { className: "w-36", value: language, onChange: (event) => setLanguage(event.target.value), placeholder: "\u8BED\u8A00\uFF0C\u5982 rust" }), _jsx(Input, { className: "w-40", value: topic, onChange: (event) => setTopic(event.target.value), placeholder: "Topic" }), _jsxs(Select, { value: String(days), onChange: (event) => setDays(Number(event.target.value)), children: [_jsx("option", { value: "7", children: "7 \u5929" }), _jsx("option", { value: "30", children: "30 \u5929" }), _jsx("option", { value: "90", children: "90 \u5929" }), _jsx("option", { value: "365", children: "1 \u5E74" })] }), _jsxs(Button, { onClick: () => void load(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), "\u5237\u65B0"] }), _jsxs("div", { className: "relative min-w-[220px] flex-1", children: [_jsx(RiSearchLine, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { className: "pl-9", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u5728\u7ED3\u679C\u4E2D\u8FDB\u884C\u6587\u672C\u641C\u7D22" })] })] }), _jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: visible.map((repo) => { const starred = state.repositories.some((item) => item.full_name === repo.full_name); return _jsxs(Card, { render: _jsx("article", {}), className: "rounded-xl p-4 shadow-card", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("img", { src: repo.owner.avatar_url, alt: "", className: "size-10 rounded-lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("a", { href: repo.html_url, target: "_blank", rel: "noreferrer", className: "text-sm font-semibold hover:underline", children: repo.full_name }), _jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground", children: repo.description || "暂无描述" })] }), _jsxs(Button, { size: "sm", variant: starred ? "secondary" : "outline", loading: mutating === repo.full_name, onClick: () => void toggleStar(repo), children: [starred ? _jsx(RiStarFill, { className: "size-4" }) : _jsx(RiStarLine, { className: "size-4" }), starred ? "已 Star" : "Star"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [repo.language ? _jsx(Badge, { children: repo.language }) : null, repo.topics.slice(0, 5).map((topicName) => _jsx(Badge, { children: topicName }, topicName))] }), _jsxs("div", { className: "mt-4 flex items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(RiStarFill, { className: "size-3.5" }), repo.stargazers_count.toLocaleString()] }), _jsxs("span", { children: [repo.forks_count.toLocaleString(), " forks"] }), _jsxs("a", { href: repo.html_url, target: "_blank", rel: "noreferrer", className: "ml-auto flex items-center gap-1 hover:text-foreground", children: [_jsx(RiExternalLinkLine, { className: "size-3.5" }), "GitHub"] })] })] }, repo.full_name); }) }), !visible.length && !loading ? _jsx("div", { className: "mt-6 grid min-h-56 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground", children: "\u6CA1\u6709\u5339\u914D\u7684\u4ED3\u5E93" }) : null] }));
}
