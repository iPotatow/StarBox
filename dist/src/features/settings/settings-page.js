import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiDatabase2Line, RiDownload2Line, RiFolder3Line, RiGitForkLine, RiKey2Line, RiMoonLine, RiPriceTag3Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiShieldCheckLine, RiStarLine, RiUpload2Line, } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.js";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { Checkbox } from "../../components/ui/checkbox.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { FormSkeleton } from "../../components/ui/skeleton.js";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs.js";
import { Textarea } from "../../components/ui/textarea.js";
import { CategorySettingsPanel } from "../repositories/category-manager.js";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, testAiProvider, validateGithubToken } from "../../lib/api.js";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage.js";
function SettingsBlock({ title, description, children }) {
    return _jsxs(Card, { className: "grid gap-5 p-5 lg:grid-cols-[220px_minmax(0,1fr)]", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold", children: title }), _jsx("p", { className: "mt-2 max-w-xs text-xs leading-5 text-muted-foreground", children: description })] }), _jsx("div", { className: "grid min-w-0 gap-4", children: children })] });
}
const navMeta = {
    repositories: { label: "Stars", icon: RiStarLine, required: true }, releases: { label: "Release", icon: RiPriceTag3Line }, forks: { label: "Fork", icon: RiGitForkLine }, lists: { label: "Lists", icon: RiFolder3Line }, discover: { label: "Discover", icon: RiSearchLine }, activity: { label: "Activity", icon: RiDatabase2Line }, notifications: { label: "通知", icon: RiDatabase2Line }, settings: { label: "设置", icon: RiSettings4Line, required: true },
};
export function SettingsPage({ state, onStateChange, session, onLogout, initialLoading = false }) {
    const [githubStatus, setGithubStatus] = useState("");
    const [githubTesting, setGithubTesting] = useState(false);
    const [rateLimits, setRateLimits] = useState([]);
    const [rateLoading, setRateLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState("");
    const [aiTesting, setAiTesting] = useState(false);
    const [dataStatus, setDataStatus] = useState("");
    const [headersText, setHeadersText] = useState(() => JSON.stringify(state.settings.ai.headers, null, 2));
    const [headersError, setHeadersError] = useState("");
    const [credentialToken, setCredentialToken] = useState("");
    const [credentialStatus, setCredentialStatus] = useState("");
    const [credentialLoading, setCredentialLoading] = useState(false);
    const fileRef = useRef(null);
    const settings = state.settings;
    const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
    useEffect(() => setHeadersText(JSON.stringify(settings.ai.headers, null, 2)), [settings.ai.headers]);
    useEffect(() => { void Promise.resolve().then(() => fetchGithubCredential()).then((credential) => onStateChange({ ...state, settings: { ...settings, githubIdentity: credential.identity, credentialConnected: credential.connected } })).catch(() => { }); }, []);
    async function replaceCredential() { const token = credentialToken.trim(); if (!token)
        return setCredentialStatus("请输入新的 GitHub Token"); setCredentialLoading(true); setCredentialStatus(""); try {
        const credential = await replaceGithubCredential(token);
        onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } });
        setCredentialToken("");
        setCredentialStatus(`已连接 @${credential.identity.login}；Token 不会在页面回显`);
    }
    catch (error) {
        try {
            const user = await validateGithubToken(token);
            onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } });
            setCredentialToken("");
            setCredentialStatus(`当前 Worker 使用兼容模式连接 @${user.login}`);
        }
        catch (fallbackError) {
            setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "凭据连接失败");
        }
    }
    finally {
        setCredentialLoading(false);
    } }
    async function removeCredential() { setCredentialLoading(true); setCredentialStatus(""); try {
        await removeGithubCredential();
        onStateChange({ ...state, settings: { ...settings, githubToken: "", githubIdentity: null, credentialConnected: false } });
        setCredentialStatus("已移除云端 GitHub 凭据");
    }
    catch (error) {
        setCredentialStatus(error instanceof Error ? `${error.message}。请确认 Worker 已升级后重试。` : "移除凭据失败");
    }
    finally {
        setCredentialLoading(false);
    } }
    async function testGithub() { if (!hasGithubCredential)
        return; setGithubTesting(true); setGithubStatus(""); try {
        const user = await validateGithubToken(settings.githubToken.trim());
        setGithubStatus(`已连接 @${user.login}`);
    }
    catch (error) {
        setGithubStatus(error instanceof Error ? error.message : "连接失败");
    }
    finally {
        setGithubTesting(false);
    } }
    async function loadRateLimits() { if (!hasGithubCredential)
        return; setRateLoading(true); try {
        const data = await fetchGithubRateLimit(settings.githubToken.trim());
        setRateLimits(data.resources);
    }
    catch (error) {
        setGithubStatus(error instanceof Error ? error.message : "Rate Limit 读取失败");
    }
    finally {
        setRateLoading(false);
    } }
    function updateHeaders(raw) { setHeadersText(raw); try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
            throw new Error("Headers 必须是 JSON 对象");
        const headers = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
        setHeadersError("");
        onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, headers } } });
    }
    catch (reason) {
        setHeadersError(reason instanceof Error ? reason.message : "Headers JSON 无效");
    } }
    async function testAi() { if (headersError)
        return setAiStatus(headersError); setAiTesting(true); setAiStatus(""); try {
        setAiStatus(await testAiProvider(settings.ai));
    }
    catch (error) {
        setAiStatus(error instanceof Error ? error.message : "连接失败");
    }
    finally {
        setAiTesting(false);
    } }
    function moveNav(index, delta) { const list = [...settings.navOrder]; const target = index + delta; if (target < 0 || target >= list.length)
        return; [list[index], list[target]] = [list[target], list[index]]; onStateChange({ ...state, settings: { ...settings, navOrder: list } }); }
    function toggleNav(id) { if (navMeta[id].required)
        return; const hidden = settings.hiddenNav.includes(id) ? settings.hiddenNav.filter((item) => item !== id) : [...settings.hiddenNav, id]; onStateChange({ ...state, settings: { ...settings, hiddenNav: hidden } }); }
    function updateReleaseSettings(patch) { onStateChange({ ...state, releaseSettings: { ...state.releaseSettings, ...patch } }); }
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsxs("header", { className: "mb-5", children: [_jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "\u8BBE\u7F6E" }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "\u8D26\u6237\u4E0E GitHub\u3001AI\u3001\u5206\u7C7B\u3001\u5916\u89C2\u4EE5\u53CA\u6570\u636E\u540C\u6B65\u7EDF\u4E00\u5728\u8FD9\u91CC\u7BA1\u7406\u3002" })] }), session?.defaultCredentialsActive ? _jsxs(Alert, { variant: "error", className: "mb-5", children: [_jsx(AlertTitle, { children: "Critical deployment warning" }), _jsx(AlertDescription, { children: "\u5F53\u524D Worker \u6B63\u5728\u4F7F\u7528\u9ED8\u8BA4\u767B\u5F55\u51ED\u636E admin / 000000\uFF0C\u8BF7\u7ACB\u5373\u914D\u7F6E\u751F\u4EA7\u8D26\u53F7\u4E0E\u5BC6\u7801\u3002" })] }) : null, initialLoading ? _jsx(FormSkeleton, {}) : _jsxs(Tabs, { defaultValue: "account", children: [_jsxs(TabsList, { className: "mb-5 w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0", children: [_jsx(TabsTab, { value: "account", className: "rounded-none border-b-2 border-transparent px-3 pb-3 pt-2 data-[selected]:border-foreground data-[selected]:bg-transparent data-[selected]:shadow-none", children: "\u8D26\u6237\u4E0E GitHub" }), _jsx(TabsTab, { value: "ai", className: "rounded-none border-b-2 border-transparent px-3 pb-3 pt-2 data-[selected]:border-foreground data-[selected]:bg-transparent data-[selected]:shadow-none", children: "AI" }), _jsx(TabsTab, { value: "categories", className: "rounded-none border-b-2 border-transparent px-3 pb-3 pt-2 data-[selected]:border-foreground data-[selected]:bg-transparent data-[selected]:shadow-none", children: "\u5206\u7C7B" }), _jsx(TabsTab, { value: "appearance", className: "rounded-none border-b-2 border-transparent px-3 pb-3 pt-2 data-[selected]:border-foreground data-[selected]:bg-transparent data-[selected]:shadow-none", children: "\u5916\u89C2" }), _jsx(TabsTab, { value: "data", className: "rounded-none border-b-2 border-transparent px-3 pb-3 pt-2 data-[selected]:border-foreground data-[selected]:bg-transparent data-[selected]:shadow-none", children: "\u6570\u636E\u4E0E\u540C\u6B65" })] }), _jsxs(TabsPanel, { value: "account", className: "grid gap-4", children: [_jsx(SettingsBlock, { title: "\u767B\u5F55\u4F1A\u8BDD", description: "StarBox \u767B\u5F55\u7531 Worker \u4F1A\u8BDD\u4FDD\u62A4\uFF1BCookie \u4E0D\u66B4\u9732\u7ED9\u524D\u7AEF\u811A\u672C\u3002", children: _jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-xl bg-secondary/45 p-4", children: [_jsx(RiShieldCheckLine, { className: "size-5" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium", children: session?.username || "已登录" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "\u5F53\u524D\u90E8\u7F72\u652F\u6301\u540C\u4E00\u8D26\u53F7\u591A\u8BBE\u5907\u4F1A\u8BDD\u3002" })] }), _jsx(Button, { variant: "outline", onClick: onLogout, children: "\u9000\u51FA\u767B\u5F55" })] }) }), _jsxs(SettingsBlock, { title: "GitHub \u51ED\u636E", description: "Token \u7531 Worker \u7BA1\u7406\u5E76\u8DE8\u8BBE\u5907\u590D\u7528\uFF1B\u9875\u9762\u4E0D\u63D0\u4F9B reveal\u3002", children: [_jsxs("div", { className: "rounded-xl bg-secondary/45 p-4", children: [_jsx("p", { className: "text-sm font-medium", children: settings.githubIdentity ? `已连接 @${settings.githubIdentity.login}` : settings.githubToken ? "已连接当前运行时 Token" : "尚未连接 GitHub" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: settings.credentialConnected ? "凭据由 Worker 管理，Token 不会返回浏览器。" : "连接身份会显示，但现有 Token 不会回显。" })] }), _jsx(Field, { label: "Replace Token", children: _jsx(Input, { type: "password", autoComplete: "off", value: credentialToken, placeholder: "github_pat_\u2026", onChange: (event) => setCredentialToken(event.target.value) }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { onClick: () => void replaceCredential(), loading: credentialLoading, disabled: !credentialToken.trim(), children: "\u8FDE\u63A5 / \u66FF\u6362 Token" }), _jsx(Button, { variant: "outline", onClick: () => void removeCredential(), loading: credentialLoading, disabled: !settings.githubIdentity && !settings.githubToken && !settings.credentialConnected, children: "Remove Token" }), _jsx(Button, { variant: "outline", onClick: () => void testGithub(), loading: githubTesting, disabled: !hasGithubCredential, children: "\u6D4B\u8BD5\u8FDE\u63A5" }), _jsxs(Button, { variant: "outline", onClick: () => void loadRateLimits(), loading: rateLoading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), "API \u914D\u989D"] })] }), credentialStatus || githubStatus ? _jsx("p", { className: "text-xs text-muted-foreground", children: credentialStatus || githubStatus }) : null, rateLimits.length ? _jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: rateLimits.map((item) => _jsxs("div", { className: "rounded-lg border border-border p-3 text-xs", children: [_jsx("div", { className: "font-medium", children: item.resource }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: [item.remaining.toLocaleString(), " / ", item.limit.toLocaleString(), " remaining"] }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: ["Reset ", new Date(item.resetAt).toLocaleString("zh-CN")] })] }, item.resource)) }) : null] })] }), _jsx(TabsPanel, { value: "ai", children: _jsxs(SettingsBlock, { title: "AI Provider", description: "\u4EC5\u4F7F\u7528\u81EA\u5B9A\u4E49 HTTP Provider\uFF1BAPI Key \u548C secret headers \u7EE7\u7EED browser-local\u3002", children: [_jsx(Field, { label: "Provider \u540D\u79F0", children: _jsx(Input, { value: settings.ai.providerName, placeholder: "My Provider", onChange: (event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, providerName: event.target.value } } }) }) }), _jsx(Field, { label: "Base URL", children: _jsx(Input, { inputMode: "url", value: settings.ai.baseUrl, placeholder: "https://api.example.com/v1", onChange: (event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, baseUrl: event.target.value } } }) }) }), _jsx(Field, { label: "Model", children: _jsx(Input, { value: settings.ai.model, placeholder: "your-model-name", onChange: (event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, model: event.target.value } } }) }) }), _jsx(Field, { label: "API Key", children: _jsx(Input, { type: "password", autoComplete: "off", value: settings.ai.apiKey, placeholder: "sk-\u2026", onChange: (event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, apiKey: event.target.value } } }) }) }), _jsxs(Field, { label: "\u9644\u52A0 Headers", children: [_jsx(Textarea, { value: headersText, onChange: (event) => updateHeaders(event.target.value), spellCheck: false, className: "font-mono text-xs" }), headersError ? _jsx("span", { className: "text-xs text-destructive-foreground", children: headersError }) : null] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Button, { variant: "outline", onClick: () => void testAi(), loading: aiTesting, disabled: !settings.ai.baseUrl || !settings.ai.apiKey || !settings.ai.model || Boolean(headersError), children: [_jsx(RiKey2Line, { className: "size-4" }), "\u6D4B\u8BD5 Provider"] }), aiStatus ? _jsx("span", { className: "text-xs text-muted-foreground", children: aiStatus }) : null] })] }) }), _jsx(TabsPanel, { value: "categories", children: _jsxs(Card, { className: "p-5", children: [_jsxs("div", { className: "mb-5", children: [_jsx("h2", { className: "text-sm font-semibold", children: "\u5206\u7C7B\u7BA1\u7406" }), _jsx("p", { className: "mt-1 text-xs leading-5 text-muted-foreground", children: "\u7BA1\u7406 Stars \u7684\u81EA\u5B9A\u4E49\u5206\u7C7B\uFF1B\u9501\u5B9A\u5206\u7C7B\u4E0D\u4F1A\u88AB AI \u81EA\u52A8\u6539\u5199\u3002" })] }), _jsx(CategorySettingsPanel, { state: state, onStateChange: onStateChange })] }) }), _jsx(TabsPanel, { value: "appearance", children: _jsxs(SettingsBlock, { title: "\u5916\u89C2\u4E0E\u5BFC\u822A", description: "\u4E3B\u9898\u3001\u5BC6\u5EA6\u3001\u5F3A\u8C03\u8272\u4E0E\u4E3B\u5BFC\u822A\u7531\u524D\u7AEF\u5373\u65F6\u5E94\u7528\u3002", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [_jsx(Field, { label: "\u4E3B\u9898", children: _jsxs(Select, { value: settings.theme, onChange: (event) => onStateChange({ ...state, settings: { ...settings, theme: event.target.value } }), children: [_jsx("option", { value: "system", children: "\u8DDF\u968F\u7CFB\u7EDF" }), _jsx("option", { value: "light", children: "\u6D45\u8272" }), _jsx("option", { value: "dark", children: "\u6DF1\u8272" })] }) }), _jsx(Field, { label: "\u5361\u7247\u5BC6\u5EA6", children: _jsxs(Select, { value: settings.density, onChange: (event) => onStateChange({ ...state, settings: { ...settings, density: event.target.value } }), children: [_jsx("option", { value: "comfortable", children: "\u8212\u9002" }), _jsx("option", { value: "compact", children: "\u7D27\u51D1" })] }) }), _jsx(Field, { label: "\u5F3A\u8C03\u8272", children: _jsxs(Select, { value: settings.accent, onChange: (event) => onStateChange({ ...state, settings: { ...settings, accent: event.target.value } }), children: [_jsx("option", { value: "neutral", children: "\u4E2D\u6027" }), _jsx("option", { value: "blue", children: "\u84DD\u8272" }), _jsx("option", { value: "violet", children: "\u7D2B\u8272" }), _jsx("option", { value: "emerald", children: "\u7FE0\u7EFF" })] }) })] }), _jsxs("div", { className: "flex gap-2 text-xs text-muted-foreground", children: [_jsx(RiMoonLine, { className: "size-4" }), _jsx("span", { children: "\u4E3B\u9898\u4E0E\u5F3A\u8C03\u8272\u5207\u6362\u5373\u65F6\u751F\u6548\u3002" })] }), _jsxs("div", { className: "rounded-xl border border-border", children: [_jsx("div", { className: "border-b border-border px-3 py-2 text-xs font-semibold", children: "\u5BFC\u822A\u987A\u5E8F\u4E0E\u663E\u793A" }), settings.navOrder.map((id, index) => { const item = navMeta[id]; const Icon = item.icon; return _jsxs("div", { className: "flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0", children: [_jsx(Icon, { className: "size-4 text-muted-foreground" }), _jsx("span", { className: "flex-1 text-sm", children: item.label }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(Checkbox, { checked: !settings.hiddenNav.includes(id), disabled: item.required, onCheckedChange: () => toggleNav(id), "aria-label": `显示 ${item.label}` }), "\u663E\u793A"] }), _jsx(Button, { size: "sm", variant: "ghost", disabled: index === 0, onClick: () => moveNav(index, -1), children: "\u4E0A\u79FB" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: index === settings.navOrder.length - 1, onClick: () => moveNav(index, 1), children: "\u4E0B\u79FB" })] }, id); })] })] }) }), _jsxs(TabsPanel, { value: "data", className: "grid gap-4", children: [_jsx(SettingsBlock, { title: "Release \u540C\u6B65", description: "Release \u9875\u9762\u53EA\u6D88\u8D39 Stars \u4E2D\u7684\u8BA2\u9605\uFF1B\u540C\u6B65\u7B56\u7565\u96C6\u4E2D\u5728\u8FD9\u91CC\u914D\u7F6E\u3002", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "\u540C\u6B65\u6DF1\u5EA6", children: _jsxs(Select, { value: String(state.releaseSettings.syncPages), onChange: (event) => updateReleaseSettings({ syncPages: Number(event.target.value) }), children: [_jsx("option", { value: "1", children: "1 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "3", children: "3 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "5", children: "5 \u9875 / \u4ED3\u5E93" })] }) }), _jsx(Field, { label: "\u6BCF\u9875\u6570\u91CF", children: _jsxs(Select, { value: String(state.releaseSettings.pageSize), onChange: (event) => updateReleaseSettings({ pageSize: Number(event.target.value) }), children: [_jsx("option", { value: "10", children: "10" }), _jsx("option", { value: "20", children: "20" }), _jsx("option", { value: "50", children: "50" })] }) }), _jsx(Field, { label: "Asset include", children: _jsx(Input, { value: state.releaseSettings.assetIncludePattern, onChange: (event) => updateReleaseSettings({ assetIncludePattern: event.target.value }), placeholder: "\u4F8B\u5982 \\\\.zip$ \u6216 linux" }) }), _jsx(Field, { label: "Asset exclude", children: _jsx(Input, { value: state.releaseSettings.assetExcludePattern, onChange: (event) => updateReleaseSettings({ assetExcludePattern: event.target.value }), placeholder: "\u4F8B\u5982 checksum|source" }) })] }) }), _jsxs(SettingsBlock, { title: "\u6570\u636E\u4E0E\u7F13\u5B58", description: "D1 \u662F\u6743\u5A01\u6570\u636E\u6E90\uFF0CIndexedDB \u4F5C\u4E3A\u5B9E\u4F53\u7F13\u5B58\uFF1B\u5BFC\u51FA\u4E0D\u4F1A\u5305\u542B Secret\u3002", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => exportState(state), children: [_jsx(RiDownload2Line, { className: "size-4" }), "\u5BFC\u51FA JSON"] }), _jsxs(Button, { variant: "outline", onClick: () => fileRef.current?.click(), children: [_jsx(RiUpload2Line, { className: "size-4" }), "\u5BFC\u5165 JSON"] }), _jsx("input", { ref: fileRef, type: "file", accept: "application/json", className: "hidden", onChange: (event) => { const file = event.target.files?.[0]; if (!file)
                                                    return; void importState(file).then((next) => { onStateChange(next); setDataStatus("导入成功"); }).catch((error) => setDataStatus(error instanceof Error ? error.message : "导入失败")); event.currentTarget.value = ""; } }), _jsx(Button, { variant: "destructive", onClick: () => { if (!window.confirm("确定清空 StarBox 当前浏览器中的所有数据吗？"))
                                                    return; clearState(); onStateChange(createInitialState()); setDataStatus("本地数据已清空"); }, children: "\u6E05\u7A7A\u672C\u5730\u6570\u636E" })] }), _jsx("p", { className: "text-xs leading-5 text-muted-foreground", children: "\u5BFC\u51FA\u6587\u4EF6\u4F1A\u79FB\u9664 GitHub Token\u3001AI API Key \u4E0E\u654F\u611F\u81EA\u5B9A\u4E49 Headers\u3002" }), dataStatus ? _jsxs("p", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(RiCheckLine, { className: "size-4" }), dataStatus] }) : null] })] })] })] }));
}
