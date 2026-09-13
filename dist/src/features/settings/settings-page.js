import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiDownload2Line, RiEyeLine, RiEyeOffLine, RiFolder3Line, RiGitForkLine, RiKey2Line, RiNotification2Line, RiPriceTag3Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiShieldCheckLine, RiStarLine, RiUpload2Line, } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.js";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { Modal } from "../../components/ui/modal.js";
import { Select } from "../../components/ui/select.js";
import { FormSkeleton } from "../../components/ui/skeleton.js";
import { Switch } from "../../components/ui/switch.js";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs.js";
import { Textarea } from "../../components/ui/textarea.js";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { notify } from "../../components/ui/toast.js";
import { CategorySettingsPanel } from "../repositories/category-manager.js";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, testAiProvider, validateGithubToken } from "../../lib/api.js";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage.js";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
const tabValues = ["account", "ai", "categories", "appearance", "navigation", "data"];
const tabFromQuery = () => {
    const value = readQueryParam("tab");
    return tabValues.includes(value) ? value : "account";
};
function SettingsSection({ title, description, children, danger = false }) {
    return (_jsxs("section", { className: "border-b border-border/70 py-7 first:pt-3 last:border-b-0", children: [_jsxs("header", { className: "mb-5 max-w-3xl", children: [_jsx("h2", { className: danger ? "text-base font-semibold text-destructive-foreground" : "text-base font-semibold", children: title }), _jsx("p", { className: "mt-1.5 text-sm leading-6 text-muted-foreground", children: description })] }), _jsx("div", { className: "grid min-w-0 max-w-5xl gap-4", children: children })] }));
}
const navMeta = {
    repositories: { label: "Star", icon: RiStarLine, required: true },
    releases: { label: "Release", icon: RiPriceTag3Line },
    forks: { label: "Fork", icon: RiGitForkLine },
    lists: { label: "Lists", icon: RiFolder3Line },
    discover: { label: "Discover", icon: RiSearchLine },
    notifications: { label: "通知", icon: RiNotification2Line },
    settings: { label: "设置", icon: RiSettings4Line, required: true },
};
const accentOptions = [
    { value: "neutral", label: "中性", swatch: "bg-neutral-700 dark:bg-neutral-300" },
    { value: "blue", label: "蓝色", swatch: "bg-blue-500" },
    { value: "violet", label: "紫色", swatch: "bg-violet-500" },
    { value: "emerald", label: "翠绿", swatch: "bg-emerald-500" },
];
function regexError(value) {
    if (!value.trim())
        return "";
    try {
        new RegExp(value, "i");
        return "";
    }
    catch (reason) {
        return reason instanceof Error ? reason.message : "正则无效";
    }
}
function parseHeaders(raw) {
    try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
            throw new Error("Headers 必须是 JSON 对象");
        return { headers: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])), error: "" };
    }
    catch (reason) {
        return { headers: {}, error: reason instanceof Error ? reason.message : "Headers JSON 无效" };
    }
}
export function SettingsPage({ state, onStateChange, session, onLogout, onNavigatePath, initialLoading = false }) {
    const [tab, setTab] = useState(tabFromQuery);
    const [githubStatus, setGithubStatus] = useState("");
    const [githubStatusError, setGithubStatusError] = useState(false);
    const [githubTesting, setGithubTesting] = useState(false);
    const [rateLimits, setRateLimits] = useState([]);
    const [rateLoading, setRateLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState("");
    const [aiStatusError, setAiStatusError] = useState(false);
    const [aiTesting, setAiTesting] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiDraft, setAiDraft] = useState(() => ({ ...state.settings.ai, headers: { ...state.settings.ai.headers } }));
    const [headersText, setHeadersText] = useState(() => JSON.stringify(state.settings.ai.headers, null, 2));
    const [headersError, setHeadersError] = useState("");
    const [showAiKey, setShowAiKey] = useState(false);
    const [dataStatus, setDataStatus] = useState("");
    const [credentialToken, setCredentialToken] = useState("");
    const [showCredentialToken, setShowCredentialToken] = useState(false);
    const [credentialStatus, setCredentialStatus] = useState("");
    const [credentialStatusError, setCredentialStatusError] = useState(false);
    const [credentialLoading, setCredentialLoading] = useState(false);
    const [removeCredentialOpen, setRemoveCredentialOpen] = useState(false);
    const [clearOpen, setClearOpen] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const [assetTestName, setAssetTestName] = useState("StarBox-1.0.0-macos-arm64.dmg");
    const [draggedNav, setDraggedNav] = useState(null);
    const fileRef = useRef(null);
    const settings = state.settings;
    const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
    const returnTo = readQueryParam("returnTo");
    const includeError = regexError(state.releaseSettings.assetIncludePattern);
    const excludeError = regexError(state.releaseSettings.assetExcludePattern);
    const parsedHeaders = useMemo(() => parseHeaders(headersText), [headersText]);
    const normalizedAiDraft = useMemo(() => ({ ...aiDraft, headers: parsedHeaders.headers }), [aiDraft, parsedHeaders.headers]);
    const aiDirty = useMemo(() => JSON.stringify(normalizedAiDraft) !== JSON.stringify(settings.ai), [normalizedAiDraft, settings.ai]);
    const assetTest = useMemo(() => {
        if (includeError || excludeError)
            return "规则无效";
        const included = !state.releaseSettings.assetIncludePattern || new RegExp(state.releaseSettings.assetIncludePattern, "i").test(assetTestName);
        const excluded = Boolean(state.releaseSettings.assetExcludePattern && new RegExp(state.releaseSettings.assetExcludePattern, "i").test(assetTestName));
        return included && !excluded ? "会显示" : "会隐藏";
    }, [assetTestName, state.releaseSettings.assetIncludePattern, state.releaseSettings.assetExcludePattern, includeError, excludeError]);
    useEffect(() => {
        setAiDraft({ ...settings.ai, headers: { ...settings.ai.headers } });
        setHeadersText(JSON.stringify(settings.ai.headers, null, 2));
        setHeadersError("");
    }, [settings.ai]);
    useEffect(() => { replaceQueryParams({ tab: tab === "account" ? "" : tab }); }, [tab]);
    useEffect(() => {
        void fetchGithubCredential().then((credential) => {
            onStateChange({ ...state, settings: { ...settings, githubIdentity: credential.identity ?? settings.githubIdentity, credentialConnected: credential.connected } });
        }).catch(() => { });
    }, []);
    function returnAfterCredential() { if (returnTo)
        onNavigatePath(returnTo); }
    async function replaceCredential() {
        const token = credentialToken.trim();
        if (!token) {
            setCredentialStatus("请输入新的 GitHub Token");
            setCredentialStatusError(true);
            return;
        }
        setCredentialLoading(true);
        setCredentialStatus("");
        setCredentialStatusError(false);
        try {
            const credential = await replaceGithubCredential(token);
            onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } });
            setCredentialToken("");
            setCredentialStatus(`已连接 @${credential.identity.login}；Token 不会在页面回显`);
            notify("GitHub 已连接", credential.identity.login, "success");
            returnAfterCredential();
        }
        catch (error) {
            try {
                const user = await validateGithubToken(token);
                onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } });
                setCredentialToken("");
                setCredentialStatus(`当前 Worker 使用兼容模式连接 @${user.login}`);
                returnAfterCredential();
            }
            catch (fallbackError) {
                setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "凭据连接失败");
                setCredentialStatusError(true);
            }
        }
        finally {
            setCredentialLoading(false);
        }
    }
    async function removeCredential() {
        setRemoveCredentialOpen(false);
        setCredentialLoading(true);
        setCredentialStatus("");
        setCredentialStatusError(false);
        try {
            await removeGithubCredential();
            onStateChange({ ...state, settings: { ...settings, githubToken: "", githubIdentity: settings.githubIdentity, credentialConnected: false } });
            setCredentialStatus("已移除加密 GitHub Token；GitHub identity binding 保留");
            notify("GitHub Token 已移除", "身份绑定仍保留", "success");
        }
        catch (error) {
            setCredentialStatus(error instanceof Error ? `${error.message}。请确认 Worker 已升级后重试。` : "移除凭据失败");
            setCredentialStatusError(true);
        }
        finally {
            setCredentialLoading(false);
        }
    }
    async function testGithub() {
        if (!hasGithubCredential)
            return;
        setGithubTesting(true);
        setGithubStatus("");
        setGithubStatusError(false);
        try {
            const user = await validateGithubToken(settings.githubToken.trim());
            setGithubStatus(`连接正常 · @${user.login}`);
        }
        catch (error) {
            setGithubStatus(error instanceof Error ? error.message : "连接失败");
            setGithubStatusError(true);
        }
        finally {
            setGithubTesting(false);
        }
    }
    async function loadRateLimits() {
        if (!hasGithubCredential)
            return;
        setRateLoading(true);
        try {
            setRateLimits((await fetchGithubRateLimit(settings.githubToken.trim())).resources);
        }
        catch (error) {
            setGithubStatus(error instanceof Error ? error.message : "API 配额读取失败");
            setGithubStatusError(true);
        }
        finally {
            setRateLoading(false);
        }
    }
    function updateHeaders(raw) {
        setHeadersText(raw);
        setHeadersError(parseHeaders(raw).error);
    }
    function resetAiDraft() {
        setAiDraft({ ...settings.ai, headers: { ...settings.ai.headers } });
        setHeadersText(JSON.stringify(settings.ai.headers, null, 2));
        setHeadersError("");
        setAiStatus("");
        setAiStatusError(false);
    }
    function saveAi() {
        const result = parseHeaders(headersText);
        if (result.error) {
            setHeadersError(result.error);
            return;
        }
        setAiSaving(true);
        const nextAi = { ...aiDraft, headers: result.headers };
        onStateChange({ ...state, settings: { ...settings, ai: nextAi } });
        setAiDraft(nextAi);
        setAiSaving(false);
        notify("AI 配置已保存", nextAi.model || nextAi.providerName, "success");
    }
    async function testAi() {
        const result = parseHeaders(headersText);
        if (result.error) {
            setHeadersError(result.error);
            setAiStatus(result.error);
            setAiStatusError(true);
            return;
        }
        const candidate = { ...aiDraft, headers: result.headers };
        setAiTesting(true);
        setAiStatus("");
        setAiStatusError(false);
        try {
            setAiStatus(await testAiProvider(candidate));
        }
        catch (error) {
            setAiStatus(error instanceof Error ? error.message : "连接失败");
            setAiStatusError(true);
        }
        finally {
            setAiTesting(false);
        }
    }
    function moveNav(index, delta) {
        const list = [...settings.navOrder];
        const target = index + delta;
        if (target < 0 || target >= list.length)
            return;
        [list[index], list[target]] = [list[target], list[index]];
        onStateChange({ ...state, settings: { ...settings, navOrder: list } });
    }
    function moveNavTo(source, target) {
        if (source === target)
            return;
        const list = [...settings.navOrder];
        const from = list.indexOf(source);
        const to = list.indexOf(target);
        if (from < 0 || to < 0)
            return;
        list.splice(to, 0, list.splice(from, 1)[0]);
        onStateChange({ ...state, settings: { ...settings, navOrder: list } });
    }
    function toggleNav(id) {
        if (navMeta[id].required)
            return;
        const hidden = settings.hiddenNav.includes(id) ? settings.hiddenNav.filter((item) => item !== id) : [...settings.hiddenNav, id];
        onStateChange({ ...state, settings: { ...settings, hiddenNav: hidden } });
    }
    function updateReleaseSettings(patch) { onStateChange({ ...state, releaseSettings: { ...state.releaseSettings, ...patch } }); }
    async function chooseImport(file) { try {
        setImportPreview(await importState(file));
        setDataStatus("");
    }
    catch (error) {
        setDataStatus(error instanceof Error ? error.message : "导入失败");
    } }
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsx("header", { className: "mb-4", children: _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: "\u8BBE\u7F6E" }) }), session?.defaultCredentialsActive ? _jsxs(Alert, { variant: "error", className: "mb-5", children: [_jsx(AlertTitle, { children: "\u751F\u4EA7\u51ED\u636E\u8B66\u544A" }), _jsx(AlertDescription, { children: "\u5F53\u524D Worker \u6B63\u5728\u4F7F\u7528\u9ED8\u8BA4\u767B\u5F55\u51ED\u636E admin / 000000\uFF0C\u8BF7\u7ACB\u5373\u914D\u7F6E\u751F\u4EA7\u8D26\u53F7\u4E0E\u5BC6\u7801\u3002" })] }) : null, initialLoading ? _jsx(FormSkeleton, {}) : (_jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(value), children: [_jsx("div", { className: "sticky top-0 z-20 -mx-1 mb-1 overflow-x-auto bg-background/95 px-1 pt-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: _jsxs(TabsList, { variant: "underline", className: "w-max min-w-full justify-start border-b border-border/80", children: [_jsx(TabsTab, { value: "account", children: "\u8D26\u6237\u4E0E GitHub" }), _jsx(TabsTab, { value: "ai", children: "AI" }), _jsx(TabsTab, { value: "categories", children: "\u5206\u7C7B" }), _jsx(TabsTab, { value: "appearance", children: "\u5916\u89C2" }), _jsx(TabsTab, { value: "navigation", children: "\u5BFC\u822A" }), _jsx(TabsTab, { value: "data", children: "\u6570\u636E" })] }) }), _jsxs(TabsPanel, { value: "account", children: [_jsx(SettingsSection, { title: "\u767B\u5F55\u4F1A\u8BDD", description: "StarBox \u767B\u5F55\u7531 Worker \u4F1A\u8BDD\u4FDD\u62A4\uFF0CCookie \u4E0D\u66B4\u9732\u7ED9\u524D\u7AEF\u811A\u672C\u3002", children: _jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-4 py-3", children: [_jsx("span", { className: "grid size-9 place-items-center rounded-lg bg-secondary", children: _jsx(RiShieldCheckLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium", children: session?.username || "已登录" }), _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: "\u5F53\u524D\u8BBE\u5907\u4F1A\u8BDD\u6709\u6548" })] }), _jsx(Button, { variant: "outline", onClick: onLogout, children: "\u9000\u51FA\u767B\u5F55" })] }) }), _jsxs(SettingsSection, { title: "GitHub", description: "\u51ED\u636E\u7531 Worker \u7BA1\u7406\u5E76\u53EF\u8DE8\u8BBE\u5907\u590D\u7528\uFF1B\u79FB\u9664 Token \u4E0D\u89E3\u9664 GitHub numeric identity binding\u3002", children: [_jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3", children: [settings.githubIdentity?.avatarUrl ? _jsx("img", { src: settings.githubIdentity.avatarUrl, alt: "", className: "size-9 rounded-lg" }) : _jsx("span", { className: "grid size-9 place-items-center rounded-lg bg-secondary", children: _jsx(RiStarLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-medium", children: settings.githubIdentity ? `@${settings.githubIdentity.login}` : "尚未绑定 GitHub" }), _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: settings.credentialConnected ? "Connected · Token 由 Worker 加密托管" : settings.githubIdentity ? "身份已绑定，当前未托管 Token" : "连接后可同步 Stars、Release 与 Fork 数据" })] }), _jsx("span", { className: `size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`, "aria-hidden": "true" })] }), _jsx(Field, { label: "Personal Access Token", description: "\u63D0\u4EA4\u540E\u4E0D\u4F1A\u5728\u9875\u9762\u56DE\u663E\u660E\u6587 Token\u3002", children: _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: showCredentialToken ? "text" : "password", autoComplete: "off", value: credentialToken, placeholder: "github_pat_\u2026", onChange: (event) => setCredentialToken(event.target.value) }), _jsx(InputGroupAddon, { align: "inline-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": showCredentialToken ? "隐藏 Token" : "显示 Token", onClick: () => setShowCredentialToken((value) => !value), children: showCredentialToken ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { onClick: () => void replaceCredential(), loading: credentialLoading, disabled: !credentialToken.trim(), children: "\u8FDE\u63A5 / \u66F4\u6362 Token" }), _jsx(Button, { variant: "outline", onClick: () => void testGithub(), loading: githubTesting, disabled: !hasGithubCredential, children: "\u6D4B\u8BD5\u8FDE\u63A5" }), _jsxs(Button, { variant: "outline", onClick: () => void loadRateLimits(), loading: rateLoading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), "API \u914D\u989D"] }), _jsx(Button, { variant: "ghost", onClick: () => setRemoveCredentialOpen(true), disabled: !settings.githubToken && !settings.credentialConnected, children: "\u79FB\u9664 Token" }), returnTo && hasGithubCredential ? _jsx(Button, { variant: "ghost", onClick: returnAfterCredential, children: "\u8FD4\u56DE\u539F\u6D41\u7A0B" }) : null] }), credentialStatus || githubStatus ? _jsx(Alert, { variant: credentialStatusError || githubStatusError ? "error" : "success", children: _jsx(AlertDescription, { children: credentialStatus || githubStatus }) }) : null, rateLimits.length ? _jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: rateLimits.map((item) => _jsxs("div", { className: "rounded-lg border border-border/70 p-3 text-xs", children: [_jsx("div", { className: "font-medium", children: item.resource }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: ["\u5269\u4F59 ", item.remaining.toLocaleString(), " / ", item.limit.toLocaleString()] }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: ["\u91CD\u7F6E\u65F6\u95F4 ", new Date(item.resetAt).toLocaleString("zh-CN")] })] }, item.resource)) }) : null] })] }), _jsx(TabsPanel, { value: "ai", children: _jsxs(SettingsSection, { title: "AI Provider", description: "\u4F7F\u7528\u81EA\u5B9A\u4E49 HTTP Provider\u3002API Key \u548C\u81EA\u5B9A\u4E49 Headers \u4EC5\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\uFF0C\u4E0D\u540C\u6B65\u5230 D1\u3002", children: [_jsx(Field, { label: "Provider \u540D\u79F0", children: _jsx(Input, { value: aiDraft.providerName, onChange: (event) => setAiDraft((current) => ({ ...current, providerName: event.target.value })) }) }), _jsx(Field, { label: "Base URL", children: _jsx(Input, { inputMode: "url", value: aiDraft.baseUrl, onChange: (event) => setAiDraft((current) => ({ ...current, baseUrl: event.target.value })) }) }), _jsx(Field, { label: "Model", children: _jsx(Input, { value: aiDraft.model, onChange: (event) => setAiDraft((current) => ({ ...current, model: event.target.value })) }) }), _jsx(Field, { label: "API Key", children: _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: showAiKey ? "text" : "password", autoComplete: "off", value: aiDraft.apiKey, onChange: (event) => setAiDraft((current) => ({ ...current, apiKey: event.target.value })) }), _jsx(InputGroupAddon, { align: "inline-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": showAiKey ? "隐藏 API Key" : "显示 API Key", onClick: () => setShowAiKey((value) => !value), children: showAiKey ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), _jsxs("details", { className: "rounded-xl border border-border/70 px-4 py-3", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium", children: "Advanced \u00B7 Headers JSON" }), _jsx("div", { className: "mt-4", children: _jsx(Field, { label: "Headers JSON", error: headersError, children: _jsx(Textarea, { value: headersText, onChange: (event) => updateHeaders(event.target.value), spellCheck: false, className: "min-h-32 font-mono text-xs" }) }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => void testAi(), loading: aiTesting, disabled: !aiDraft.baseUrl || !aiDraft.apiKey || !aiDraft.model || Boolean(headersError), children: [_jsx(RiKey2Line, { className: "size-4" }), "\u6D4B\u8BD5\u8FDE\u63A5"] }), aiStatus ? _jsx(Alert, { className: "flex-1", variant: aiStatusError ? "error" : "success", children: _jsx(AlertDescription, { children: aiStatus }) }) : null] }), aiDirty ? _jsxs("div", { className: "sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-popover/95 px-4 py-3 shadow-lg/10 backdrop-blur", children: [_jsx("span", { className: "text-sm", children: "\u6709\u672A\u4FDD\u5B58\u7684 AI \u914D\u7F6E\u4FEE\u6539" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", onClick: resetAiDraft, children: "\u91CD\u7F6E" }), _jsx(Button, { loading: aiSaving, onClick: saveAi, children: "\u4FDD\u5B58\u914D\u7F6E" })] })] }) : null] }) }), _jsx(TabsPanel, { value: "categories", children: _jsx(SettingsSection, { title: "\u5206\u7C7B", description: "\u7BA1\u7406 Stars \u7684\u81EA\u5B9A\u4E49\u5206\u7C7B\uFF1B\u9501\u5B9A\u5206\u7C7B\u4E0D\u4F1A\u88AB AI \u81EA\u52A8\u6539\u5199\u3002", children: _jsx(CategorySettingsPanel, { state: state, onStateChange: onStateChange }) }) }), _jsxs(TabsPanel, { value: "appearance", children: [_jsx(SettingsSection, { title: "\u4E3B\u9898", description: "\u9009\u62E9 StarBox \u7684\u663E\u793A\u6A21\u5F0F\u3002\u4FEE\u6539\u4F1A\u7ACB\u5373\u751F\u6548\u3002", children: _jsx("div", { className: "grid gap-3 sm:grid-cols-3", role: "radiogroup", "aria-label": "\u4E3B\u9898", children: ["system", "light", "dark"].map((mode) => _jsxs(Button, { variant: "ghost", size: "none", role: "radio", "aria-checked": settings.theme === mode, onClick: () => onStateChange({ ...state, settings: { ...settings, theme: mode } }), className: `block rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`, children: [_jsxs("div", { className: `mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`, children: [_jsx("span", { className: `border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}` }), _jsxs("span", { className: "p-2", children: [_jsx("span", { className: `block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}` }), _jsx("span", { className: `mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}` })] })] }), _jsx("span", { className: "text-sm font-medium", children: mode === "system" ? "跟随系统" : mode === "light" ? "浅色" : "深色" })] }, mode)) }) }), _jsx(SettingsSection, { title: "\u5F3A\u8C03\u8272", description: "\u7528\u4E8E\u9009\u4E2D\u72B6\u6001\u3001\u5173\u952E\u64CD\u4F5C\u548C\u7126\u70B9\u63D0\u793A\u3002", children: _jsx("div", { className: "flex flex-wrap gap-3", role: "radiogroup", "aria-label": "\u5F3A\u8C03\u8272", children: accentOptions.map((option) => _jsxs(Button, { variant: "ghost", size: "none", role: "radio", "aria-checked": settings.accent === option.value, onClick: () => onStateChange({ ...state, settings: { ...settings, accent: option.value } }), className: `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border"}`, children: [_jsx("span", { className: `size-4 rounded-full ${option.swatch}` }), _jsx("span", { children: option.label }), settings.accent === option.value ? _jsx(RiCheckLine, { className: "size-4" }) : null] }, option.value)) }) }), _jsx(SettingsSection, { title: "\u754C\u9762\u5BC6\u5EA6", description: "\u8212\u9002\u6A21\u5F0F\u589E\u52A0\u7559\u767D\uFF1B\u7D27\u51D1\u6A21\u5F0F\u5728\u540C\u4E00\u5C4F\u5E55\u5C55\u793A\u66F4\u591A\u5185\u5BB9\u3002", children: _jsxs(ToggleGroup, { value: [settings.density], onValueChange: (values) => { const value = values.at(-1); if (value === "comfortable" || value === "compact")
                                        onStateChange({ ...state, settings: { ...settings, density: value } }); }, children: [_jsx(ToggleGroupItem, { value: "comfortable", className: "w-auto px-4", children: "\u8212\u9002" }), _jsx(ToggleGroupItem, { value: "compact", className: "w-auto px-4", children: "\u7D27\u51D1" })] }) })] }), _jsx(TabsPanel, { value: "navigation", children: _jsx(SettingsSection, { title: "\u4FA7\u8FB9\u680F", description: "\u62D6\u52A8\u9879\u76EE\u8C03\u6574\u987A\u5E8F\uFF1BStar \u4E0E\u8BBE\u7F6E\u4E3A\u56FA\u5B9A\u5165\u53E3\u3002\u805A\u7126\u62D6\u52A8\u624B\u67C4\u540E\u53EF\u7528 Alt + \u2191 / \u2193 \u8C03\u6574\u3002", children: _jsx("div", { className: "overflow-hidden rounded-xl border border-border/70", children: settings.navOrder.map((id, index) => {
                                    const item = navMeta[id];
                                    const Icon = item.icon;
                                    const hidden = settings.hiddenNav.includes(id);
                                    return _jsxs("div", { draggable: true, onDragStart: () => setDraggedNav(id), onDragEnd: () => setDraggedNav(null), onDragOver: (event) => event.preventDefault(), onDrop: () => { if (draggedNav)
                                            moveNavTo(draggedNav, id); setDraggedNav(null); }, className: `flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0 ${draggedNav === id ? "bg-accent/50" : "bg-background"}`, children: [_jsx(Button, { variant: "ghost", size: "none", className: "cursor-grab rounded px-1 text-muted-foreground active:cursor-grabbing", "aria-label": `拖动 ${item.label} 调整顺序`, onKeyDown: (event) => { if (!event.altKey)
                                                    return; if (event.key === "ArrowUp") {
                                                    event.preventDefault();
                                                    moveNav(index, -1);
                                                }
                                                else if (event.key === "ArrowDown") {
                                                    event.preventDefault();
                                                    moveNav(index, 1);
                                                } }, children: "\u283F" }), _jsx(Icon, { className: "size-4 text-muted-foreground" }), _jsx("span", { className: "flex-1 text-sm font-medium", children: item.label }), item.required ? _jsx("span", { className: "text-xs text-muted-foreground", children: "\u59CB\u7EC8\u663E\u793A" }) : _jsx(Switch, { checked: !hidden, onCheckedChange: () => toggleNav(id), "aria-label": `${hidden ? "显示" : "隐藏"} ${item.label}` })] }, id);
                                }) }) }) }), _jsxs(TabsPanel, { value: "data", children: [_jsxs(SettingsSection, { title: "Release \u540C\u6B65", description: "Release \u9875\u9762\u53EA\u6D88\u8D39 Stars \u4E2D\u7684\u8BA2\u9605\uFF1B\u540C\u6B65\u6DF1\u5EA6\u4E0E Asset Regex \u5728\u8FD9\u91CC\u914D\u7F6E\u3002", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "\u540C\u6B65\u6DF1\u5EA6", children: _jsxs(Select, { value: String(state.releaseSettings.syncPages), onChange: (event) => updateReleaseSettings({ syncPages: Number(event.target.value) }), children: [_jsx("option", { value: "1", children: "1 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "3", children: "3 \u9875 / \u4ED3\u5E93" }), _jsx("option", { value: "5", children: "5 \u9875 / \u4ED3\u5E93" })] }) }), _jsx(Field, { label: "\u6BCF\u9875\u6570\u91CF", children: _jsxs(Select, { value: String(state.releaseSettings.pageSize), onChange: (event) => updateReleaseSettings({ pageSize: Number(event.target.value) }), children: [_jsx("option", { value: "10", children: "10" }), _jsx("option", { value: "20", children: "20" }), _jsx("option", { value: "50", children: "50" })] }) }), _jsx(Field, { label: "Asset include Regex", error: includeError, children: _jsx(Input, { value: state.releaseSettings.assetIncludePattern, onChange: (event) => updateReleaseSettings({ assetIncludePattern: event.target.value }) }) }), _jsx(Field, { label: "Asset exclude Regex", error: excludeError, children: _jsx(Input, { value: state.releaseSettings.assetExcludePattern, onChange: (event) => updateReleaseSettings({ assetExcludePattern: event.target.value }) }) })] }), _jsxs(Field, { label: "\u6D4B\u8BD5\u6587\u4EF6\u540D", children: [_jsx(Input, { value: assetTestName, onChange: (event) => setAssetTestName(event.target.value) }), _jsx("span", { className: `text-xs ${assetTest === "会显示" ? "text-success-foreground" : "text-muted-foreground"}`, children: assetTest })] })] }), _jsxs(SettingsSection, { title: "\u5907\u4EFD\u4E0E\u5BFC\u5165", description: "\u5BFC\u5165\u4F1A\u5148\u9884\u89C8\uFF0C\u786E\u8BA4\u540E\u624D\u66FF\u6362\u5F53\u524D\u6D4F\u89C8\u5668\u72B6\u6001\u3002\u5BFC\u51FA\u4F1A\u79FB\u9664 GitHub Token\u3001AI API Key \u4E0E\u654F\u611F Headers\u3002", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => exportState(state), children: [_jsx(RiDownload2Line, { className: "size-4" }), "\u5BFC\u51FA\u6570\u636E"] }), _jsxs(Button, { variant: "outline", onClick: () => fileRef.current?.click(), children: [_jsx(RiUpload2Line, { className: "size-4" }), "\u9009\u62E9\u5BFC\u5165\u6587\u4EF6"] }), _jsx("input", { ref: fileRef, type: "file", accept: "application/json", className: "hidden", onChange: (event) => { const file = event.target.files?.[0]; if (file)
                                                    void chooseImport(file); event.currentTarget.value = ""; } })] }), dataStatus ? _jsxs("p", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(RiCheckLine, { className: "size-4" }), dataStatus] }) : null] }), _jsx(SettingsSection, { title: "\u5371\u9669\u533A\u57DF", description: "\u53EA\u6E05\u7A7A\u5F53\u524D\u6D4F\u89C8\u5668\u7684 localStorage \u4E0E IndexedDB \u7F13\u5B58\uFF0C\u4E0D\u4F1A\u5220\u9664 D1 \u4E91\u7AEF\u6570\u636E\u3002", danger: true, children: _jsxs("div", { className: "flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-4 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "\u91CD\u7F6E\u672C\u5730 StarBox" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "\u91CD\u65B0\u767B\u5F55\u6216\u540C\u6B65\u540E\u4ECD\u53EF\u4ECE\u4E91\u7AEF\u6062\u590D\u6743\u5A01\u72B6\u6001\u3002" })] }), _jsx(Button, { variant: "destructive", onClick: () => setClearOpen(true), children: "\u6E05\u7A7A\u672C\u5730\u6570\u636E" })] }) })] })] })), _jsx(AlertDialog, { open: removeCredentialOpen, onOpenChange: setRemoveCredentialOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u79FB\u9664 GitHub Token\uFF1F" }), _jsx(AlertDialogDescription, { children: "\u53EA\u4F1A\u5220\u9664 Worker \u4E2D\u4FDD\u5B58\u7684\u52A0\u5BC6\u51ED\u636E\u3002\u5DF2\u7ED1\u5B9A\u7684 GitHub numeric identity \u4F1A\u7EE7\u7EED\u4FDD\u7559\uFF0C\u540E\u7EED\u53EA\u80FD\u91CD\u65B0\u8FDE\u63A5\u540C\u4E00 GitHub \u8EAB\u4EFD\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => void removeCredential(), children: "\u79FB\u9664 Token" })] })] }) }), _jsx(AlertDialog, { open: clearOpen, onOpenChange: setClearOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "\u6E05\u7A7A\u5F53\u524D\u6D4F\u89C8\u5668\u6570\u636E\uFF1F" }), _jsx(AlertDialogDescription, { children: "\u4F1A\u6E05\u9664 localStorage \u4E0E IndexedDB \u7F13\u5B58\uFF0C\u4F46\u4E0D\u4F1A\u5220\u9664 D1 \u4E91\u7AEF\u6570\u636E\u3002\u91CD\u65B0\u767B\u5F55/\u540C\u6B65\u540E\u4E91\u7AEF\u72B6\u6001\u4ECD\u53EF\u6062\u590D\u3002" })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: "\u53D6\u6D88" }), _jsx(Button, { variant: "destructive", onClick: () => { clearState(); onStateChange(createInitialState()); setClearOpen(false); setDataStatus("本地数据已清空；D1 未删除"); }, children: "\u6E05\u7A7A\u672C\u5730\u6570\u636E" })] })] }) }), _jsx(Modal, { open: Boolean(importPreview), title: "\u5BFC\u5165\u9884\u89C8", description: "\u786E\u8BA4\u540E\u5C06\u66FF\u6362\u5F53\u524D\u6D4F\u89C8\u5668\u72B6\u6001\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u5BFC\u51FA\u6587\u4EF6\u672C\u8EAB\u3002", onClose: () => setImportPreview(null), children: importPreview ? _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "\u4ED3\u5E93" }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.repositories.length })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "\u5206\u7C7B" }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.categories.length })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Release \u8BA2\u9605" }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.releaseSubscriptions.length })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "GitHub Lists" }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.githubLists.length })] })] }), _jsx(Alert, { variant: "warning", children: _jsx(AlertDescription, { children: "\u786E\u8BA4\u5BFC\u5165\u540E\u4F1A\u66FF\u6362\u5F53\u524D\u6D4F\u89C8\u5668\u72B6\u6001\uFF1BD1 \u6743\u5A01\u6570\u636E\u4E0D\u4F1A\u5728\u6B64\u6B65\u9AA4\u88AB\u5220\u9664\u3002" }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setImportPreview(null), children: "\u53D6\u6D88" }), _jsx(Button, { onClick: () => { onStateChange(importPreview); setImportPreview(null); setDataStatus("导入成功"); notify("导入完成", "当前浏览器状态已替换", "success"); }, children: "\u786E\u8BA4\u5BFC\u5165" })] })] }) : null })] }));
}
