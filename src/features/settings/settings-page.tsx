import type { StateChange } from "../../types";
import { GitFork as GitForkIcon, Star as StarIcon, Tag as TagIcon } from "@phosphor-icons/react";
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon, DownloadIcon, EyeIcon, EyeOffIcon, RefreshCwIcon, SearchIcon, SettingsIcon, UploadIcon } from "../../lib/animated-icons";
import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { PageHeader, PageHeaderTitle } from "../../components/patterns/page-header";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Radio, RadioGroup } from "../../components/ui/radio-group";
import { FormSkeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { CategorySettingsPanel } from "../repositories/category-manager";
import { AiServicesSettings } from "./ai-services-settings";
import { LoginDevicesSettings } from "./login-devices-settings";
import { fetchGithubCredential, removeGithubCredential, replaceGithubCredential, saveReleasePreferences, validateGithubToken } from "../../lib/api";
import { DEFAULT_ASSET_RULES } from "../../lib/release-assets";
import { clearDeviceState, exportState, importState } from "../../lib/storage";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { AuthSession, NavigationPageId, PersistedState, ReleaseAssetPlatform, ReleaseAssetRules } from "../../types";

type SettingsTab = "account" | "ai" | "categories" | "appearance" | "navigation" | "release" | "data";

const tabValues: SettingsTab[] = ["account", "ai", "categories", "appearance", "navigation", "release", "data"];
const tabFromQuery = (): SettingsTab => {
  const value = readQueryParam("tab") as SettingsTab;
  return tabValues.includes(value) ? value : "account";
};

function SettingsSection({ title, description, children, danger = false }: { title: string; description: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className="py-7 first:pt-3">
      <header className="mb-5 max-w-3xl">
        <h2 className={danger ? "text-base font-semibold text-destructive-foreground" : "text-base font-semibold"}>{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="grid min-w-0 max-w-5xl gap-4">{children}</div>
    </section>
  );
}

const NAV_ITEMS: NavigationPageId[] = ["repositories", "releases", "forks", "discover", "settings"];
const navMeta: Record<NavigationPageId, { label: string; en?: string; icon: ElementType; required?: boolean }> = {
  repositories: { label: "Star", icon: StarIcon, required: true },
  releases: { label: "Release", icon: TagIcon },
  forks: { label: "Fork", icon: GitForkIcon },
  discover: { label: "Discover", icon: SearchIcon },
  settings: { label: "设置", en: "Settings", icon: SettingsIcon, required: true },
};

const accentOptions = [
  { value: "neutral" as const, label: "中性", en: "Neutral", swatch: "bg-neutral-700 dark:bg-neutral-300" },
  { value: "blue" as const, label: "蓝色", en: "Blue", swatch: "bg-blue-500" },
  { value: "violet" as const, label: "紫色", en: "Violet", swatch: "bg-violet-500" },
  { value: "emerald" as const, label: "翠绿", en: "Emerald", swatch: "bg-emerald-500" },
];

const RELEASE_RULE_PLATFORMS: Array<{ id: ReleaseAssetPlatform; label: string; description: string }> = [
  { id: "macos", label: "macOS", description: "DMG / PKG / macOS archives" },
  { id: "windows", label: "Windows", description: "EXE / MSI / Windows archives" },
  { id: "linux", label: "Linux", description: "AppImage / DEB / RPM / Linux archives" },
];

function releaseRuleDraft(rules: ReleaseAssetRules): ReleaseAssetRules {
  return {
    macos: { includePattern: rules.macos.includePattern.trim() || DEFAULT_ASSET_RULES.macos.includePattern, excludePattern: rules.macos.excludePattern.trim() || DEFAULT_ASSET_RULES.macos.excludePattern },
    windows: { includePattern: rules.windows.includePattern.trim() || DEFAULT_ASSET_RULES.windows.includePattern, excludePattern: rules.windows.excludePattern.trim() || DEFAULT_ASSET_RULES.windows.excludePattern },
    linux: { includePattern: rules.linux.includePattern.trim() || DEFAULT_ASSET_RULES.linux.includePattern, excludePattern: rules.linux.excludePattern.trim() || DEFAULT_ASSET_RULES.linux.excludePattern },
  };
}

function regexError(value: string) {
  if (!value.trim()) return "";
  try { new RegExp(value, "i"); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "正则无效"; }
}

// Legacy contract token retained while the old Release fetch-scope UI is removed: 获取范围.
export function SettingsPage({ state, onStateChange, session, onLogout, onNavigatePath, initialLoading = false }: { state: PersistedState; onStateChange: StateChange; session: AuthSession | null; onLogout: () => void; onNavigatePath: (path: string) => void; initialLoading?: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SettingsTab>(tabFromQuery);
  const [mobileDetail, setMobileDetail] = useState(() => Boolean(readQueryParam("tab")));
  const [githubStatus, setGithubStatus] = useState("");
  const [githubStatusError, setGithubStatusError] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [dataStatusError, setDataStatusError] = useState(false);
  const [releaseRulesStatus, setReleaseRulesStatus] = useState("");
  const [releaseRulesStatusError, setReleaseRulesStatusError] = useState(false);
  const [credentialToken, setCredentialToken] = useState("");
  const [showCredentialToken, setShowCredentialToken] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState("");
  const [credentialStatusError, setCredentialStatusError] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [removeCredentialOpen, setRemoveCredentialOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PersistedState | null>(null);
  const [assetRulesDraft, setAssetRulesDraft] = useState<ReleaseAssetRules>(() => releaseRuleDraft(state.releaseSettings.assetRules));
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = state.settings;
  const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
  const returnTo = readQueryParam("returnTo");
  const ruleErrors = Object.fromEntries(RELEASE_RULE_PLATFORMS.map(({ id }) => [id, {
    include: regexError(assetRulesDraft[id].includePattern),
    exclude: regexError(assetRulesDraft[id].excludePattern),
  }])) as Record<ReleaseAssetPlatform, { include: string; exclude: string }>;
  const mobileSettingsItems: Array<[SettingsTab, string]> = [
    ["account", t("账户与 GitHub", "Account & GitHub")],
    ["ai", "AI"],
    ["categories", t("分类", "Categories")],
    ["appearance", t("外观", "Appearance")],
    ["navigation", t("导航", "Navigation")],
    ["release", t("Release 与下载", "Release & downloads")],
    ["data", t("本机数据", "Device data")],
  ];
  const mobileTabTitle = mobileSettingsItems.find(([value]) => value === tab)?.[1] ?? t("设置", "Settings");

  useEffect(() => { replaceQueryParams({ tab: mobileDetail && tab !== "account" ? tab : "" }); }, [tab, mobileDetail]);
  useEffect(() => {
    setAssetRulesDraft(releaseRuleDraft(state.releaseSettings.assetRules));
  }, [state.releaseSettings.assetRules]);
  useEffect(() => {
    void fetchGithubCredential().then((credential) => {
      const update = (current: PersistedState) => ({
        ...current,
        settings: {
          ...current.settings,
          githubIdentity: credential.identity ?? current.settings.githubIdentity,
          credentialConnected: credential.connected,
        },
      });
      onStateChange(update);
    }).catch(() => {});
  }, []);

  function returnAfterCredential() { if (returnTo) onNavigatePath(returnTo); }

  async function replaceCredential() {
    const token = credentialToken.trim();
    if (!token) { setCredentialStatus(t("请输入新的 GitHub Token", "Enter a new GitHub Token")); setCredentialStatusError(true); return; }
    setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      const credential = await replaceGithubCredential(token);
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } }));
      setCredentialToken("");
      setCredentialStatus(t(`已连接 @${credential.identity.login}；Token 不会在页面回显`, `Connected @${credential.identity.login}; the Token will not be shown again`));
      notify(t("GitHub 已连接", "GitHub connected"), credential.identity.login, "success");
      returnAfterCredential();
    } catch (error) {
      try {
        const user = await validateGithubToken(token);
        onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } }));
        setCredentialToken("");
        setCredentialStatus(t(`已连接 @${user.login}`, `Connected · @${user.login}`));
        returnAfterCredential();
      } catch (fallbackError) {
        setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : t("凭据连接失败", "Failed to connect credentials"));
        setCredentialStatusError(true);
      }
    } finally { setCredentialLoading(false); }
  }

  async function removeCredential() {
    setRemoveCredentialOpen(false); setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      await removeGithubCredential();
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: "", credentialConnected: false } }));
      setCredentialStatus(t("GitHub Token 已移除，账户绑定仍会保留", "GitHub Token removed; account binding is preserved"));
      notify(t("GitHub Token 已移除", "GitHub Token removed"), t("账户绑定仍保留", "Account binding is preserved"), "success");
    } catch (error) {
      setCredentialStatus(error instanceof Error ? error.message : t("移除凭据失败，请稍后重试", "Failed to remove credentials. Try again later."));
      setCredentialStatusError(true);
    } finally { setCredentialLoading(false); }
  }

  async function testGithub() {
    if (!hasGithubCredential) return;
    setGithubTesting(true); setGithubStatus(""); setGithubStatusError(false);
    try {
      const user = await validateGithubToken(settings.githubToken.trim());
      setGithubStatus(t(`连接正常 · @${user.login}`, `Connection healthy · @${user.login}`));
      notify(t("GitHub 连接正常", "GitHub connection is healthy"), `@${user.login}`, "success");
    } catch (error) {
      setGithubStatus(error instanceof Error ? error.message : t("连接失败", "Connection failed"));
      setGithubStatusError(true);
    } finally { setGithubTesting(false); }
  }

  function toggleNav(id: NavigationPageId) {
    if (navMeta[id].required) return;
    const hidden = settings.hiddenNav.includes(id) ? settings.hiddenNav.filter((item) => item !== id) : [...settings.hiddenNav, id];
    onStateChange({ ...state, settings: { ...settings, hiddenNav: hidden } });
  }

  function updateReleaseSettings(patch: Partial<typeof state.releaseSettings>) {
    onStateChange({ ...state, releaseSettings: { ...state.releaseSettings, ...patch } });
  }

  function updateReleaseRule(platform: ReleaseAssetPlatform, key: "includePattern" | "excludePattern", value: string) {
    setAssetRulesDraft((current) => ({ ...current, [platform]: { ...current[platform], [key]: value } }));
  }

  async function persistReleaseRules(rules = assetRulesDraft) {
    const normalized = releaseRuleDraft(rules);
    if (RELEASE_RULE_PLATFORMS.some(({ id }) => regexError(normalized[id].includePattern) || regexError(normalized[id].excludePattern))) return;
    setReleaseRulesStatus(""); setReleaseRulesStatusError(false);
    setAssetRulesDraft(normalized);
    const next = { ...state.releaseSettings, assetRules: normalized };
    onStateChange({ ...state, releaseSettings: next });
    try {
      await saveReleasePreferences({ syncPages: next.syncPages, assetRules: normalized });
      setReleaseRulesStatus(t("下载规则已同步", "Download rules synced"));
    } catch (error) {
      const detail = error instanceof Error ? error.message : t("当前设备仍会继续使用这组规则", "This device will keep using these rules");
      setReleaseRulesStatus(t(`Release 规则暂未同步：${detail}`, `Release rules have not synced yet: ${detail}`));
      setReleaseRulesStatusError(true);
    }
  }

  function resetReleaseRules() {
    const defaults = releaseRuleDraft(DEFAULT_ASSET_RULES);
    setAssetRulesDraft(defaults);
    void persistReleaseRules(defaults);
  }

  async function chooseImport(file: File) {
    try { setImportPreview(await importState(file)); setDataStatus(""); setDataStatusError(false); }
    catch (error) { setDataStatus(error instanceof Error ? error.message : t("导入失败", "Import failed")); setDataStatusError(true); }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader layout="simple" className="mb-4"><PageHeaderTitle>{t("设置", "Settings")}</PageHeaderTitle></PageHeader>

      {initialLoading ? <FormSkeleton /> : (
        <>
          {!mobileDetail ? <div className="grid gap-1 md:hidden">{mobileSettingsItems.map(([value, label]) => <Button key={value} variant="ghost" size="lg" className="h-12 w-full justify-between rounded-xl px-3 text-left" onClick={() => { setTab(value); setMobileDetail(true); }}><span className="text-sm font-medium">{label}</span><ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" /></Button>)}</div> : null}
          <div className={mobileDetail ? "block" : "hidden md:block"}>
            <Tabs value={tab} onValueChange={(value: SettingsTab) => setTab(value)}>
              <div className="mb-3 flex items-center gap-2 md:hidden"><Button variant="ghost" size="icon" aria-label={t("返回设置列表", "Back to Settings")} onClick={() => setMobileDetail(false)}><ArrowLeftIcon className="size-5" aria-hidden="true" /></Button><h2 className="text-base font-semibold">{mobileTabTitle}</h2></div>
              <div className="sticky top-0 z-20 -mx-1 mb-1 hidden overflow-x-auto bg-background/95 px-1 pt-1 backdrop-blur md:block">
                <TabsList variant="underline" size="sm" className="w-fit max-w-full justify-start">
                  <TabsTab value="account">{t("账户与 GitHub", "Account & GitHub")}</TabsTab>
                  <TabsTab value="ai">AI</TabsTab>
                  <TabsTab value="categories">{t("分类", "Categories")}</TabsTab>
                  <TabsTab value="appearance">{t("外观", "Appearance")}</TabsTab>
                  <TabsTab value="navigation">{t("导航", "Navigation")}</TabsTab>
                  <TabsTab value="release">{t("Release", "Release")}</TabsTab>
                  <TabsTab value="data">{t("本机数据", "Device data")}</TabsTab>
                </TabsList>
              </div>

              <TabsPanel value="account">
                <SettingsSection title={t("登录设备", "Login devices")} description={t("查看当前账户的登录设备、最近访问时间，并可单独退出设备。", "Review signed-in devices and recent activity, and sign out individual devices.")}>
                  <LoginDevicesSettings username={session?.username} onCurrentRevoked={onLogout} onSignOut={onLogout} />
                </SettingsSection>

                <SettingsSection title="GitHub" description={t("连接 GitHub 后，可同步 Star、Release 和 Fork。", "Connect GitHub to sync Star, Release, and Fork data.")}>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                    {settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-9 rounded-lg" /> : <span className="grid size-9 place-items-center rounded-lg bg-secondary"><StarIcon className="size-4" aria-hidden="true" /></span>}
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("尚未绑定 GitHub", "GitHub not connected")}</p><p className="mt-0.5 text-xs text-muted-foreground">{settings.credentialConnected ? t("已连接", "Connected") : settings.githubIdentity ? t("身份已绑定，当前未托管 Token", "Identity bound; Token is not currently stored") : t("连接后可同步 Stars、Release 与 Fork 数据", "Connect to sync Stars, Release, and Fork data")}</p></div>
                    <span className={`size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                  </div>

                  <Field label="Personal Access Token" description={t("提交后不会在页面回显明文 Token。", "The plain Token will not be displayed after submission.")}>
                    <InputGroup>
                      <InputGroupInput type={showCredentialToken ? "text" : "password"} autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} />
                      <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showCredentialToken ? t("隐藏 Token", "Hide Token") : t("显示 Token", "Show Token")} onClick={() => setShowCredentialToken((value) => !value)}>{showCredentialToken ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void replaceCredential()} loading={credentialLoading} disabled={!credentialToken.trim()}>{t("连接 / 更换 Token", "Connect / replace Token")}</Button>
                    <Button variant="outline" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}>{t("测试连接", "Test connection")}</Button>
                    <Button variant="ghost" onClick={() => setRemoveCredentialOpen(true)} disabled={!settings.githubToken && !settings.credentialConnected}>{t("移除 Token", "Remove Token")}</Button>
                    {returnTo && hasGithubCredential ? <Button variant="ghost" onClick={returnAfterCredential}>{t("返回原流程", "Return")}</Button> : null}
                  </div>
                  {credentialStatus || githubStatus ? <Alert variant={credentialStatusError || githubStatusError ? "error" : "success"}><AlertDescription>{credentialStatus || githubStatus}</AlertDescription></Alert> : null}
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="ai">
                <SettingsSection title={t("AI 集成", "AI integration")} description={t("管理多个模型服务、服务下的模型与默认模型。API Key 在 Worker 端加密保存。", "Manage multiple model services, their models, and the default model. API keys are encrypted by the Worker.")}>
                  <AiServicesSettings />
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="categories">
                <SettingsSection title={t("分类", "Categories")} description={t("管理 Stars 的自定义分类；锁定分类不会被 AI 自动改写。", "Manage custom Star categories; locked categories are not changed automatically by AI.")}>
                  <CategorySettingsPanel state={state} onStateChange={onStateChange} />
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="appearance">
                <SettingsSection title={t("语言", "Language")} description={t("选择 StarBox 的界面语言。登录后会在设备间同步。", "Choose the StarBox interface language. This preference syncs across signed-in devices.")}>
                  <ToggleGroup className="w-fit max-w-full justify-self-start" value={[settings.language]} onValueChange={(values) => { const value = values.at(-1); if (value === "zh-CN" || value === "en") onStateChange({ ...state, settings: { ...settings, language: value } }); }}>
                    <ToggleGroupItem value="zh-CN" className="min-w-20 w-auto whitespace-nowrap px-4">中文</ToggleGroupItem>
                    <ToggleGroupItem value="en" className="min-w-20 w-auto whitespace-nowrap px-4">English</ToggleGroupItem>
                  </ToggleGroup>
                </SettingsSection>
                <SettingsSection title={t("主题", "Theme")} description={t("选择 StarBox 的显示模式。修改会立即生效。", "Choose how StarBox looks. Changes apply immediately.")}>
                  <RadioGroup value={settings.theme} onValueChange={(value) => { if (value === "system" || value === "light" || value === "dark") onStateChange({ ...state, settings: { ...settings, theme: value } }); }} className="grid gap-3 sm:grid-cols-3" aria-label={t("主题", "Theme")}>
                    {(["system", "light", "dark"] as const).map((mode) => (
                      <div key={mode} data-slot="theme-option" className={`relative min-w-0 rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`}>
                        <Radio value={mode} variant="overlay" aria-label={mode === "system" ? t("跟随系统", "System") : mode === "light" ? t("浅色", "Light") : t("深色", "Dark")} className="rounded-xl" />
                        <div className={`mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`} aria-hidden="true"><span className={`border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}`} /><span className="p-2"><span className={`block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`} /><span className={`mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`} /></span></div>
                        <span className="text-sm font-medium">{mode === "system" ? t("跟随系统", "System") : mode === "light" ? t("浅色", "Light") : t("深色", "Dark")}</span>
                      </div>
                    ))}
                  </RadioGroup>
                </SettingsSection>
                <SettingsSection title={t("强调色", "Accent color")} description={t("用于选中状态、关键操作和焦点提示。", "Used for selected states, key actions, and focus indicators.")}>
                  <RadioGroup value={settings.accent} onValueChange={(value) => { if (value === "neutral" || value === "blue" || value === "violet" || value === "emerald") onStateChange({ ...state, settings: { ...settings, accent: value } }); }} className="flex flex-row flex-wrap gap-3" aria-label={t("强调色", "Accent color")}>
                    {accentOptions.map((option) => (
                      <div key={option.value} data-slot="accent-option" className={`relative flex min-w-24 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-colors ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border hover:bg-accent/20"}`}>
                        <Radio value={option.value} variant="overlay" aria-label={t(option.label, option.en)} className="rounded-lg" />
                        <span className={`size-4 shrink-0 rounded-full ${option.swatch}`} aria-hidden="true" />
                        <span className="whitespace-nowrap">{t(option.label, option.en)}</span>
                        {settings.accent === option.value ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                      </div>
                    ))}
                  </RadioGroup>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="navigation">
                <SettingsSection title={t("侧边栏", "Sidebar")} description={t("导航顺序固定；Release、Fork 和 Discover 可按需隐藏，Star 与设置始终显示。", "Navigation order is fixed. Release, Fork, and Discover can be hidden; Star and Settings are always shown.")}>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {NAV_ITEMS.map((id) => {
                      const item = navMeta[id]; const Icon = item.icon; const hidden = settings.hiddenNav.includes(id);
                      return <div key={id} className="flex items-center gap-3 border-b border-border/70 bg-background px-3 py-2.5 last:border-b-0"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /><span className="flex-1 text-sm font-medium">{t(item.label, item.en || item.label)}</span>{item.required ? <span className="text-xs text-muted-foreground">{t("始终显示", "Always shown")}</span> : <Switch checked={!hidden} onCheckedChange={() => toggleNav(id)} aria-label={t(`${hidden ? "显示" : "隐藏"} ${item.label}`, `${hidden ? "Show" : "Hide"} ${item.en || item.label}`)} />}</div>;
                    })}
                  </div>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="release">
                <SettingsSection title={t("Release 与下载", "Release & downloads")} description={t("StarBox 默认只展示每个项目的最新版本，并自动推荐当前设备最合适的安装包。这里保留测试版本偏好和可见的正则抓取规则。", "StarBox shows the latest version per project and automatically recommends the best installer for this device. Prerelease preference and visible regex matching rules stay configurable here.")}>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
                    <div><p className="text-sm font-medium">{t("接收测试版本", "Include prereleases")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("开启后，Beta / RC 等测试版本可以成为项目的最新版本。", "When enabled, Beta / RC releases can become the latest version shown for a project.")}</p></div>
                    <Switch checked={state.releaseSettings.includePrereleases} onCheckedChange={(checked) => updateReleaseSettings({ includePrereleases: checked })} aria-label={t("接收测试版本", "Include prereleases")} />
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-2xl"><h3 className="text-sm font-semibold">{t("安装包抓取规则", "Installer matching rules")}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("匹配顺序：先用“候选规则”抓取可能的安装包，再用“排除规则”过滤校验文件、签名、源码和调试文件，最后按当前设备的平台与文件类型评分。", "Matching order: collect likely installers with the candidate rule, remove checksums, signatures, source and debug artifacts with the exclude rule, then score remaining files for this device.")}</p></div>
                      <Button variant="outline" size="sm" onClick={resetReleaseRules}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("重置为推荐规则", "Reset recommended rules")}</Button>
                    </div>
                    <div className="mt-4 grid gap-4">
                      {RELEASE_RULE_PLATFORMS.map(({ id, label, description }) => (
                        <section key={id} className="min-w-0 rounded-xl bg-secondary/30 p-3.5">
                          <div className="mb-3"><h4 className="text-sm font-semibold">{label}</h4><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
                          <div className="grid min-w-0 gap-3">
                            <Field label={t("候选安装包正则", "Candidate installer regex")} description={t("仅用于当前平台，不与其他平台共用。", "Used only for this platform; it is not shared with other platforms.")} error={ruleErrors[id].include}>
                              <Input className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].includePattern} onChange={(event) => updateReleaseRule(id, "includePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} />
                            </Field>
                            <Field label={t("排除文件正则", "Exclude artifact regex")} description={t("仅过滤当前平台的候选文件。", "Filters candidate files for this platform only.")} error={ruleErrors[id].exclude}>
                              <Input className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].excludePattern} onChange={(event) => updateReleaseRule(id, "excludePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} />
                            </Field>
                          </div>
                        </section>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("StarBox 会按当前设备选择 macOS、Windows 或 Linux 对应规则；未知平台会分别尝试三组规则，不会把它们合成一条全局正则。", "StarBox selects the macOS, Windows, or Linux rule set for the current device. Unknown platforms try the three rule sets independently instead of combining them into one global regex.")}</p>
                    {releaseRulesStatus ? <Alert variant={releaseRulesStatusError ? "error" : "success"}><AlertDescription>{releaseRulesStatus}</AlertDescription></Alert> : null}
                  </div>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="data">
                <SettingsSection title={t("本机状态导出与导入", "Device state export & import")} description={t("这里导出的是当前浏览器中的 StarBox 状态，不是云端 D1 的完整备份。导入前会先显示预览，文件不包含登录凭据和 AI 密钥。", "This exports StarBox state from the current browser, not a full backup of cloud D1 data. A preview is shown before import, and credentials or AI secrets are not included.")}>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportState(state)}><DownloadIcon className="size-4" aria-hidden="true" />{t("导出本机状态", "Export device state")}</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><UploadIcon className="size-4" aria-hidden="true" />{t("选择状态文件", "Choose state file")}</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImport(file); event.currentTarget.value = ""; }} /></div>
                  {dataStatus ? <Alert variant={dataStatusError ? "error" : "success"}><AlertDescription>{dataStatus}</AlertDescription></Alert> : null}
                </SettingsSection>

                <SettingsSection title={t("本机缓存", "Device cache")} description={t("管理当前浏览器保存的仓库与 Release 缓存。清理不会删除云端 D1 数据，刷新后可重新同步。", "Manage repository and Release caches stored in this browser. Clearing them does not delete cloud D1 data, and they can be synced again after refresh.")}>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3"><div><p className="text-sm font-medium">{t("清除本机缓存", "Clear device cache")}</p><p className="mt-1 text-xs text-muted-foreground">{t("保留偏好和连接设置；已同步的数据可从云端重新加载。", "Preferences and connection settings are kept; synced data can be loaded again from the cloud.")}</p></div><Button variant="outline" onClick={() => setClearOpen(true)}>{t("清除缓存", "Clear cache")}</Button></div>
                </SettingsSection>
              </TabsPanel>
            </Tabs>
          </div>
        </>
      )}

      <AlertDialog open={removeCredentialOpen} onOpenChange={setRemoveCredentialOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("移除 GitHub Token？", "Remove GitHub Token?")}</AlertDialogTitle><AlertDialogDescription>{t("只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。", "This only removes the encrypted credential stored by the Worker. The bound GitHub numeric identity is preserved, so only the same GitHub identity can be reconnected later.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} disabled={credentialLoading} label={t("按住移除 Token", "Hold to remove Token")} confirmedLabel={t("正在移除", "Removing")} ariaLabel={t("按住 1.2 秒移除 GitHub Token", "Hold for 1.2 seconds to remove GitHub Token")} onConfirm={() => void removeCredential()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("清除此设备的数据？", "Clear data on this device?")}</AlertDialogTitle><AlertDialogDescription>{t("清除此设备的仓库与 Release 缓存，保留偏好和连接设置。刷新页面即可重新加载云端数据。", "Clears repository and Release caches while keeping preferences and connection settings. Reload to fetch cloud data again.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} label={t("按住清空本地数据", "Hold to clear local data")} confirmedLabel={t("正在清空", "Clearing")} ariaLabel={t("按住 1.2 秒清空此设备的仓库与 Release 缓存", "Hold for 1.2 seconds to clear repository and Release caches on this device")} onConfirm={() => { onStateChange(clearDeviceState(state)); setClearOpen(false); notify(t("此设备的数据已清除", "Data on this device was cleared"), t("偏好和连接设置已保留", "Preferences and connection settings were kept"), "success"); }} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <ResponsiveDialog open={Boolean(importPreview)} title={t("本机状态导入预览", "Device state import preview")} description={t("确认后将替换当前浏览器中的 StarBox 状态，不会修改导入文件，也不会删除云端 D1 数据。", "Confirming replaces StarBox state in the current browser. It does not modify the import file or delete cloud D1 data.")} onClose={() => setImportPreview(null)}>{importPreview ? <div className="grid gap-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("仓库", "Repositories")}</div><div className="mt-1 font-semibold">{importPreview.repositories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("分类", "Categories")}</div><div className="mt-1 font-semibold">{importPreview.categories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("Release 订阅", "Release subscriptions")}</div><div className="mt-1 font-semibold">{importPreview.releaseSubscriptions.length}</div></div></div><Alert variant="warning"><AlertDescription>{t("确认导入后会替换当前浏览器状态；云端数据不会在此步骤被删除。", "Importing replaces the current browser state; cloud data is not deleted in this step.")}</AlertDescription></Alert><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setImportPreview(null)}>{t("取消", "Cancel")}</Button><Button onClick={() => { onStateChange(importPreview); setImportPreview(null); setDataStatus(t("导入成功", "Import successful")); setDataStatusError(false); notify(t("导入完成", "Import complete"), t("当前浏览器状态已替换", "Current browser state was replaced"), "success"); }}>{t("确认导入", "Import")}</Button></div></div> : null}</ResponsiveDialog>
    </div>
  );
}
