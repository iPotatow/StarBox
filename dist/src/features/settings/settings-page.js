import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiDownload2Line, RiEyeLine, RiEyeOffLine, RiGitForkLine, RiPriceTag3Line, RiRefreshLine, RiSearchLine, RiSettings4Line, RiStarLine, RiUpload2Line, } from "@remixicon/react";
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
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js";
import { notify } from "../../components/ui/toast.js";
import { CategorySettingsPanel } from "../repositories/category-manager.js";
import { AiServicesSettings } from "./ai-services-settings.js";
import { LoginDevicesSettings } from "./login-devices-settings.js";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, saveReleasePreferences, validateGithubToken } from "../../lib/api.js";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage.js";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state.js";
import { useI18n } from "../../lib/i18n.js";
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
    discover: { label: "Discover", icon: RiSearchLine },
    settings: { label: "设置", en: "Settings", icon: RiSettings4Line, required: true },
};
const accentOptions = [
    { value: "neutral", label: "中性", en: "Neutral", swatch: "bg-neutral-700 dark:bg-neutral-300" },
    { value: "blue", label: "蓝色", en: "Blue", swatch: "bg-blue-500" },
    { value: "violet", label: "紫色", en: "Violet", swatch: "bg-violet-500" },
    { value: "emerald", label: "翠绿", en: "Emerald", swatch: "bg-emerald-500" },
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
export function SettingsPage({ state, onStateChange, session, onLogout, onNavigatePath, initialLoading = false }) {
    const { t, locale } = useI18n();
    const [tab, setTab] = useState(tabFromQuery);
    const [githubStatus, setGithubStatus] = useState("");
    const [githubStatusError, setGithubStatusError] = useState(false);
    const [githubTesting, setGithubTesting] = useState(false);
    const [rateLimits, setRateLimits] = useState([]);
    const [rateLoading, setRateLoading] = useState(false);
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
    const assetTest = useMemo(() => {
        if (includeError || excludeError)
            return t("规则无效", "Invalid rule");
        const included = !state.releaseSettings.assetIncludePattern || new RegExp(state.releaseSettings.assetIncludePattern, "i").test(assetTestName);
        const excluded = Boolean(state.releaseSettings.assetExcludePattern && new RegExp(state.releaseSettings.assetExcludePattern, "i").test(assetTestName));
        return included && !excluded ? t("会显示", "Visible") : t("会隐藏", "Hidden");
    }, [assetTestName, state.releaseSettings.assetIncludePattern, state.releaseSettings.assetExcludePattern, includeError, excludeError, t]);
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
            setCredentialStatus(t("请输入新的 GitHub Token", "Enter a new GitHub Token"));
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
            setCredentialStatus(t(`已连接 @${credential.identity.login}；Token 不会在页面回显`, `Connected @${credential.identity.login}; the Token will not be shown again`));
            notify(t("GitHub 已连接", "GitHub connected"), credential.identity.login, "success");
            returnAfterCredential();
        }
        catch (error) {
            try {
                const user = await validateGithubToken(token);
                onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } });
                setCredentialToken("");
                setCredentialStatus(t(`已连接 @${user.login}`, `Connected @${user.login}`));
                returnAfterCredential();
            }
            catch (fallbackError) {
                setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : t("凭据连接失败", "Failed to connect credentials"));
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
            setCredentialStatus(t("GitHub Token 已移除，账户绑定仍会保留", "GitHub Token removed; account binding is preserved"));
            notify(t("GitHub Token 已移除", "GitHub Token removed"), t("账户绑定仍保留", "Account binding is preserved"), "success");
        }
        catch (error) {
            setCredentialStatus(error instanceof Error ? t(`${error.message}。请稍后重试。`, `${error.message}. Try again later.`) : t("移除凭据失败", "Failed to remove credentials"));
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
            setGithubStatus(t(`连接正常 · @${user.login}`, `Connected · @${user.login}`));
        }
        catch (error) {
            setGithubStatus(error instanceof Error ? error.message : t("连接失败", "Connection failed"));
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
            setGithubStatus(error instanceof Error ? error.message : t("API 配额读取失败", "Failed to load API quota"));
            setGithubStatusError(true);
        }
        finally {
            setRateLoading(false);
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
    function updateReleaseSettings(patch) {
        const next = { ...state.releaseSettings, ...patch };
        onStateChange({ ...state, releaseSettings: next });
        if (patch.syncPages !== undefined || patch.assetIncludePattern !== undefined || patch.assetExcludePattern !== undefined)
            void saveReleasePreferences({ syncPages: next.syncPages, assetIncludePattern: next.assetIncludePattern, assetExcludePattern: next.assetExcludePattern }).catch(() => notify(t("Release 设置暂未同步", "Release settings have not synced yet"), t("稍后会继续使用当前设备上的设置", "This device will keep using the current settings for now"), "error"));
    }
    async function chooseImport(file) { try {
        setImportPreview(await importState(file));
        setDataStatus("");
    }
    catch (error) {
        setDataStatus(error instanceof Error ? error.message : t("导入失败", "Import failed"));
    } }
    return (_jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", children: [_jsx("header", { className: "mb-4", children: _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: t("设置", "Settings") }) }), session?.defaultCredentialsActive ? _jsxs(Alert, { variant: "error", className: "mb-5", children: [_jsx(AlertTitle, { children: t("生产凭据警告", "Production credential warning") }), _jsx(AlertDescription, { children: t("当前 Worker 正在使用默认登录凭据 admin / 000000，请立即配置生产账号与密码。", "The Worker is using the default admin / 000000 login. Configure production credentials immediately.") })] }) : null, initialLoading ? _jsx(FormSkeleton, {}) : (_jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(value), children: [_jsx("div", { className: "sticky top-0 z-20 -mx-1 mb-1 overflow-x-auto bg-background/95 px-1 pt-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: _jsxs(TabsList, { variant: "underline", className: "w-max min-w-full justify-start border-b border-border/80", children: [_jsx(TabsTab, { value: "account", children: t("账户与 GitHub", "Account & GitHub") }), _jsx(TabsTab, { value: "ai", children: "AI" }), _jsx(TabsTab, { value: "categories", children: t("分类", "Categories") }), _jsx(TabsTab, { value: "appearance", children: t("外观", "Appearance") }), _jsx(TabsTab, { value: "navigation", children: t("导航", "Navigation") }), _jsx(TabsTab, { value: "data", children: t("数据", "Data") })] }) }), _jsxs(TabsPanel, { value: "account", children: [_jsx(SettingsSection, { title: t("登录设备", "Login devices"), description: t("查看当前账户的登录设备、最近访问时间，并可单独退出设备。", "Review signed-in devices and recent activity, and sign out individual devices."), children: _jsx(LoginDevicesSettings, { username: session?.username, onCurrentRevoked: onLogout, onSignOut: onLogout }) }), _jsxs(SettingsSection, { title: "GitHub", description: t("连接 GitHub 后，可同步 Star、Release 和 Fork。", "Connect GitHub to sync Star, Release, and Fork data."), children: [_jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3", children: [settings.githubIdentity?.avatarUrl ? _jsx("img", { src: settings.githubIdentity.avatarUrl, alt: "", className: "size-9 rounded-lg" }) : _jsx("span", { className: "grid size-9 place-items-center rounded-lg bg-secondary", children: _jsx(RiStarLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-medium", children: settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("尚未绑定 GitHub", "GitHub not connected") }), _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: settings.credentialConnected ? t("已连接", "Connected") : settings.githubIdentity ? t("身份已绑定，当前未托管 Token", "Identity bound; Token is not currently stored") : t("连接后可同步 Stars、Release 与 Fork 数据", "Connect to sync Stars, Release, and Fork data") })] }), _jsx("span", { className: `size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`, "aria-hidden": "true" })] }), _jsx(Field, { label: "Personal Access Token", description: t("提交后不会在页面回显明文 Token。", "The plain Token will not be displayed after submission."), children: _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: showCredentialToken ? "text" : "password", autoComplete: "off", value: credentialToken, placeholder: "github_pat_\u2026", onChange: (event) => setCredentialToken(event.target.value) }), _jsx(InputGroupAddon, { align: "inline-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": showCredentialToken ? t("隐藏 Token", "Hide Token") : t("显示 Token", "Show Token"), onClick: () => setShowCredentialToken((value) => !value), children: showCredentialToken ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { onClick: () => void replaceCredential(), loading: credentialLoading, disabled: !credentialToken.trim(), children: t("连接 / 更换 Token", "Connect / replace Token") }), _jsx(Button, { variant: "outline", onClick: () => void testGithub(), loading: githubTesting, disabled: !hasGithubCredential, children: t("测试连接", "Test connection") }), _jsxs(Button, { variant: "outline", onClick: () => void loadRateLimits(), loading: rateLoading, disabled: !hasGithubCredential, children: [_jsx(RiRefreshLine, { className: "size-4" }), t("API 配额", "API quota")] }), _jsx(Button, { variant: "ghost", onClick: () => setRemoveCredentialOpen(true), disabled: !settings.githubToken && !settings.credentialConnected, children: t("移除 Token", "Remove Token") }), returnTo && hasGithubCredential ? _jsx(Button, { variant: "ghost", onClick: returnAfterCredential, children: t("返回原流程", "Return") }) : null] }), credentialStatus || githubStatus ? _jsx(Alert, { variant: credentialStatusError || githubStatusError ? "error" : "success", children: _jsx(AlertDescription, { children: credentialStatus || githubStatus }) }) : null, rateLimits.length ? _jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: rateLimits.map((item) => _jsxs("div", { className: "rounded-lg border border-border/70 p-3 text-xs", children: [_jsx("div", { className: "font-medium", children: item.resource }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: [t("剩余", "Remaining"), " ", item.remaining.toLocaleString(locale), " / ", item.limit.toLocaleString(locale)] }), _jsxs("div", { className: "mt-1 text-muted-foreground", children: [t("重置时间", "Resets"), " ", new Date(item.resetAt).toLocaleString(locale)] })] }, item.resource)) }) : null] })] }), _jsx(TabsPanel, { value: "ai", children: _jsx(SettingsSection, { title: t("AI 集成", "AI integration"), description: t("管理多个模型服务、服务下的模型与默认模型。API Key 在 Worker 端加密保存。", "Manage multiple model services, their models, and the default model. API keys are encrypted by the Worker."), children: _jsx(AiServicesSettings, {}) }) }), _jsx(TabsPanel, { value: "categories", children: _jsx(SettingsSection, { title: t("分类", "Categories"), description: t("管理 Stars 的自定义分类；锁定分类不会被 AI 自动改写。", "Manage custom Star categories; locked categories are not changed automatically by AI."), children: _jsx(CategorySettingsPanel, { state: state, onStateChange: onStateChange }) }) }), _jsxs(TabsPanel, { value: "appearance", children: [_jsx(SettingsSection, { title: t("语言", "Language"), description: t("选择 StarBox 的界面语言。此设置仅保存在当前设备。", "Choose the StarBox interface language. This preference is stored on this device."), children: _jsxs(ToggleGroup, { value: [settings.language], onValueChange: (values) => { const value = values.at(-1); if (value === "zh-CN" || value === "en")
                                        onStateChange({ ...state, settings: { ...settings, language: value } }); }, children: [_jsx(ToggleGroupItem, { value: "zh-CN", className: "w-auto px-4", children: "\u4E2D\u6587" }), _jsx(ToggleGroupItem, { value: "en", className: "w-auto px-4", children: "English" })] }) }), _jsx(SettingsSection, { title: t("主题", "Theme"), description: t("选择 StarBox 的显示模式。修改会立即生效。", "Choose how StarBox looks. Changes apply immediately."), children: _jsx("div", { className: "grid gap-3 sm:grid-cols-3", role: "radiogroup", "aria-label": t("主题", "Theme"), children: ["system", "light", "dark"].map((mode) => _jsxs(Button, { variant: "ghost", size: "none", role: "radio", "aria-checked": settings.theme === mode, onClick: () => onStateChange({ ...state, settings: { ...settings, theme: mode } }), className: `block rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`, children: [_jsxs("div", { className: `mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`, children: [_jsx("span", { className: `border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}` }), _jsxs("span", { className: "p-2", children: [_jsx("span", { className: `block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}` }), _jsx("span", { className: `mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}` })] })] }), _jsx("span", { className: "text-sm font-medium", children: mode === "system" ? t("跟随系统", "System") : mode === "light" ? t("浅色", "Light") : t("深色", "Dark") })] }, mode)) }) }), _jsx(SettingsSection, { title: t("强调色", "Accent color"), description: t("用于选中状态、关键操作和焦点提示。", "Used for selected states, key actions, and focus indicators."), children: _jsx("div", { className: "flex flex-wrap gap-3", role: "radiogroup", "aria-label": t("强调色", "Accent color"), children: accentOptions.map((option) => _jsxs(Button, { variant: "ghost", size: "none", role: "radio", "aria-checked": settings.accent === option.value, onClick: () => onStateChange({ ...state, settings: { ...settings, accent: option.value } }), className: `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border"}`, children: [_jsx("span", { className: `size-4 rounded-full ${option.swatch}` }), _jsx("span", { children: t(option.label, option.en) }), settings.accent === option.value ? _jsx(RiCheckLine, { className: "size-4" }) : null] }, option.value)) }) }), _jsx(SettingsSection, { title: t("界面密度", "Interface density"), description: t("舒适模式增加留白；紧凑模式在同一屏幕展示更多内容。", "Comfortable adds spacing; Compact shows more content on screen."), children: _jsxs(ToggleGroup, { value: [settings.density], onValueChange: (values) => { const value = values.at(-1); if (value === "comfortable" || value === "compact")
                                        onStateChange({ ...state, settings: { ...settings, density: value } }); }, children: [_jsx(ToggleGroupItem, { value: "comfortable", className: "w-auto px-4", children: t("舒适", "Comfortable") }), _jsx(ToggleGroupItem, { value: "compact", className: "w-auto px-4", children: t("紧凑", "Compact") })] }) })] }), _jsx(TabsPanel, { value: "navigation", children: _jsx(SettingsSection, { title: t("侧边栏", "Sidebar"), description: t("拖动项目调整顺序；Star 与设置为固定入口。聚焦拖动手柄后可用 Alt + ↑ / ↓ 调整。", "Drag items to reorder them. Star and Settings are fixed. With the drag handle focused, use Alt + ↑ / ↓ to move items."), children: _jsx("div", { className: "overflow-hidden rounded-xl border border-border/70", children: settings.navOrder.map((id, index) => {
                                    const item = navMeta[id];
                                    const Icon = item.icon;
                                    const hidden = settings.hiddenNav.includes(id);
                                    return _jsxs("div", { draggable: true, onDragStart: () => setDraggedNav(id), onDragEnd: () => setDraggedNav(null), onDragOver: (event) => event.preventDefault(), onDrop: () => { if (draggedNav)
                                            moveNavTo(draggedNav, id); setDraggedNav(null); }, className: `flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0 ${draggedNav === id ? "bg-accent/50" : "bg-background"}`, children: [_jsx(Button, { variant: "ghost", size: "none", className: "cursor-grab rounded px-1 text-muted-foreground active:cursor-grabbing", "aria-label": t(`拖动 ${item.label} 调整顺序`, `Reorder ${item.en || item.label}`), onKeyDown: (event) => { if (!event.altKey)
                                                    return; if (event.key === "ArrowUp") {
                                                    event.preventDefault();
                                                    moveNav(index, -1);
                                                }
                                                else if (event.key === "ArrowDown") {
                                                    event.preventDefault();
                                                    moveNav(index, 1);
                                                } }, children: "\u283F" }), _jsx(Icon, { className: "size-4 text-muted-foreground" }), _jsx("span", { className: "flex-1 text-sm font-medium", children: t(item.label, item.en || item.label) }), item.required ? _jsx("span", { className: "text-xs text-muted-foreground", children: t("始终显示", "Always shown") }) : _jsx(Switch, { checked: !hidden, onCheckedChange: () => toggleNav(id), "aria-label": t(`${hidden ? "显示" : "隐藏"} ${item.label}`, `${hidden ? "Show" : "Hide"} ${item.en || item.label}`) })] }, id);
                                }) }) }) }), _jsxs(TabsPanel, { value: "data", children: [_jsxs(SettingsSection, { title: t("Release 更新", "Release updates"), description: t("设置 Release 的获取范围和文件筛选规则。", "Configure Release fetch scope and asset filename filters."), children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: t("获取范围", "Fetch scope"), children: _jsxs(Select, { value: String(state.releaseSettings.syncPages), onChange: (event) => updateReleaseSettings({ syncPages: Number(event.target.value) }), children: [_jsx("option", { value: "1", children: t("最近 1 页", "Latest 1 page") }), _jsx("option", { value: "3", children: t("最近 3 页", "Latest 3 pages") }), _jsx("option", { value: "5", children: t("最近 5 页", "Latest 5 pages") })] }) }), _jsx(Field, { label: t("每页数量", "Items per page"), children: _jsxs(Select, { value: String(state.releaseSettings.pageSize), onChange: (event) => updateReleaseSettings({ pageSize: Number(event.target.value) }), children: [_jsx("option", { value: "10", children: "10" }), _jsx("option", { value: "20", children: "20" }), _jsx("option", { value: "50", children: "50" })] }) }), _jsx(Field, { label: t("包含文件名规则", "Include filename pattern"), error: includeError, children: _jsx(Input, { value: state.releaseSettings.assetIncludePattern, onChange: (event) => updateReleaseSettings({ assetIncludePattern: event.target.value }) }) }), _jsx(Field, { label: t("排除文件名规则", "Exclude filename pattern"), error: excludeError, children: _jsx(Input, { value: state.releaseSettings.assetExcludePattern, onChange: (event) => updateReleaseSettings({ assetExcludePattern: event.target.value }) }) })] }), _jsxs(Field, { label: t("测试规则", "Test rule"), children: [_jsx(Input, { value: assetTestName, onChange: (event) => setAssetTestName(event.target.value) }), _jsx("span", { className: `text-xs ${(assetTest === "会显示" || assetTest === "Visible") ? "text-success-foreground" : "text-muted-foreground"}`, children: assetTest })] })] }), _jsxs(SettingsSection, { title: t("备份与导入", "Backup & import"), description: t("导入前会先显示预览。导出的文件不会包含登录凭据和 AI 密钥。", "A preview is shown before import. Exported files do not include login credentials or AI secrets."), children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => exportState(state), children: [_jsx(RiDownload2Line, { className: "size-4" }), t("导出数据", "Export data")] }), _jsxs(Button, { variant: "outline", onClick: () => fileRef.current?.click(), children: [_jsx(RiUpload2Line, { className: "size-4" }), t("选择导入文件", "Choose import file")] }), _jsx("input", { ref: fileRef, type: "file", accept: "application/json", className: "hidden", onChange: (event) => { const file = event.target.files?.[0]; if (file)
                                                    void chooseImport(file); event.currentTarget.value = ""; } })] }), dataStatus ? _jsxs("p", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(RiCheckLine, { className: "size-4" }), dataStatus] }) : null] }), _jsx(SettingsSection, { title: t("危险区域", "Danger zone"), description: t("只清除此设备上的 StarBox 数据，不会删除云端数据。", "Only clears StarBox data on this device; cloud data is not deleted."), danger: true, children: _jsxs("div", { className: "flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-4 py-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: t("清除此设备的数据", "Clear this device data") }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t("重新登录后仍可从云端恢复已同步的数据。", "Synced data can be restored from the cloud after signing in again.") })] }), _jsx(Button, { variant: "destructive", onClick: () => setClearOpen(true), children: t("清空本地数据", "Clear local data") })] }) })] })] })), _jsx(AlertDialog, { open: removeCredentialOpen, onOpenChange: setRemoveCredentialOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("移除 GitHub Token？", "Remove GitHub Token?") }), _jsx(AlertDialogDescription, { children: t("只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。", "This only removes the encrypted credential stored by the Worker. The bound GitHub numeric identity is preserved, so only the same GitHub identity can be reconnected later.") })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("取消", "Cancel") }), _jsx(Button, { variant: "destructive", onClick: () => void removeCredential(), children: t("移除 Token", "Remove Token") })] })] }) }), _jsx(AlertDialog, { open: clearOpen, onOpenChange: setClearOpen, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("清除此设备的数据？", "Clear data on this device?") }), _jsx(AlertDialogDescription, { children: t("此操作只清除当前设备的数据，不会删除云端内容。重新登录后可恢复已同步的数据。", "This only clears data on the current device and does not delete cloud content. Synced data can be restored after signing in again.") })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("取消", "Cancel") }), _jsx(Button, { variant: "destructive", onClick: () => { clearState(); onStateChange(createInitialState()); setClearOpen(false); setDataStatus(t("此设备的数据已清除", "Data on this device was cleared")); }, children: t("清空本地数据", "Clear local data") })] })] }) }), _jsx(Modal, { open: Boolean(importPreview), title: t("导入预览", "Import preview"), description: t("确认后将替换当前浏览器状态，不会修改导出文件本身。", "Confirming will replace the current browser state without modifying the import file."), onClose: () => setImportPreview(null), children: importPreview ? _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t("仓库", "Repositories") }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.repositories.length })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t("分类", "Categories") }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.categories.length })] }), _jsxs("div", { className: "rounded-lg bg-secondary/50 p-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: t("Release 订阅", "Release subscriptions") }), _jsx("div", { className: "mt-1 font-semibold", children: importPreview.releaseSubscriptions.length })] })] }), _jsx(Alert, { variant: "warning", children: _jsx(AlertDescription, { children: t("确认导入后会替换当前浏览器状态；云端数据不会在此步骤被删除。", "Importing replaces the current browser state; cloud data is not deleted in this step.") }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setImportPreview(null), children: t("取消", "Cancel") }), _jsx(Button, { onClick: () => { onStateChange(importPreview); setImportPreview(null); setDataStatus(t("导入成功", "Import successful")); notify(t("导入完成", "Import complete"), t("当前浏览器状态已替换", "Current browser state was replaced"), "success"); }, children: t("确认导入", "Import") })] })] }) : null })] }));
}
