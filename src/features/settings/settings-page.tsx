import type { StateChange } from "../../types";
import { ArrowLeft as ArrowLeftIcon, ArrowsClockwise as RefreshCwIcon, CaretDown as ChevronDownIcon, CaretRight as ChevronRightIcon, Check as CheckIcon, DownloadSimple as DownloadIcon, Eye as EyeIcon, EyeSlash as EyeOffIcon, Gear as SettingsIcon, GitFork as GitForkIcon, MagnifyingGlass as SearchIcon, Star as StarIcon, Tag as TagIcon, UploadSimple as UploadIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
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
import { AboutSettings } from "./about-settings";
import { McpSettings } from "./mcp-settings";
import { LoginDevicesSettings } from "./login-devices-settings";
import { fetchGithubCredential, removeGithubCredential, replaceGithubCredential, saveReleasePreferences, validateGithubToken } from "../../lib/api";
import { DEFAULT_ASSET_RULES } from "../../lib/release-assets";
import { clearDeviceState, exportState, importState } from "../../lib/storage";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { AiServicesState, AuthSession, NavigationPageId, PersistedState, ReleaseAssetPlatform, ReleaseAssetRules } from "../../types";

type SettingsTab = "account" | "ai" | "mcp" | "categories" | "appearance" | "navigation" | "release" | "data";

const tabValues: SettingsTab[] = ["account", "ai", "mcp", "categories", "appearance", "navigation", "release", "data"];
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
const navMeta: Record<NavigationPageId, { label: string; en?: string; tw?: string; icon: ElementType; required?: boolean }> = {
  repositories: { label: "星标", en: "Star", tw: "星標", icon: StarIcon, required: true },
  releases: { label: "发布", en: "Release", tw: "發布", icon: TagIcon },
  forks: { label: "复刻", en: "Fork", tw: "復刻", icon: GitForkIcon },
  discover: { label: "热门", en: "Discover", tw: "熱門", icon: SearchIcon },
  settings: { label: "设置", en: "Settings", tw: "設定", icon: SettingsIcon, required: true },
};

const accentOptions = [
  { value: "neutral" as const, label: "中性", tw: "中性", en: "Neutral", swatch: "bg-neutral-700 dark:bg-neutral-300" },
  { value: "blue" as const, label: "蓝色", tw: "藍色", en: "Blue", swatch: "bg-blue-500" },
  { value: "violet" as const, label: "紫色", tw: "紫色", en: "Violet", swatch: "bg-violet-500" },
  { value: "emerald" as const, label: "翠绿", tw: "翠綠", en: "Emerald", swatch: "bg-emerald-500" },
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
export function SettingsPage({ state, onStateChange, onAiServicesChange, session, onLogout, onNavigatePath, initialLoading = false }: { state: PersistedState; onStateChange: StateChange; onAiServicesChange: (services: AiServicesState) => void; session: AuthSession | null; onLogout: () => void; onNavigatePath: (path: string) => void; initialLoading?: boolean }) {
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
    ["account", t("账户与 GitHub", "Account & GitHub", "帳戶與 GitHub")],
    ["ai", "AI"],
    ["mcp", t("MCP 连接", "MCP connections", "MCP 連線")],
    ["categories", t("分类", "Categories", "分類")],
    ["appearance", t("外观", "Appearance", "外觀")],
    ["navigation", t("导航", "Navigation", "導航")],
    ["release", t("发布与下载", "Release & downloads", "發布與下載")],
    ["data", t("本机数据", "Device data", "本機資料")],
  ];
  const mobileTabTitle = mobileSettingsItems.find(([value]) => value === tab)?.[1] ?? t("设置", "Settings", "設定");

  useEffect(() => { replaceQueryParams({ tab: tab !== "account" ? tab : (mobileDetail ? "account" : "") }); }, [tab, mobileDetail]);
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
    if (!token) { setCredentialStatus(t("请输入新的 GitHub Token", "Enter a new GitHub Token", "請輸入新的 GitHub Token")); setCredentialStatusError(true); return; }
    setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      const credential = await replaceGithubCredential(token);
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: "", githubIdentity: credential.identity, credentialConnected: credential.connected } }));
      setCredentialToken("");
      setCredentialStatus(t(`已连接 @${credential.identity.login}；Token 不会在页面回显`, `Connected @${credential.identity.login}; the Token will not be shown again`, `已連線 @${credential.identity.login}；Token 不會在頁面回顯`));
      notify(t("GitHub 已连接", "GitHub connected", "GitHub 已連線"), credential.identity.login, "success");
      returnAfterCredential();
    } catch (error) {
      setCredentialStatus(error instanceof Error ? error.message : t("凭据连接失败", "Failed to connect credentials", "憑據連線失敗"));
      setCredentialStatusError(true);
    } finally { setCredentialLoading(false); }
  }

  async function removeCredential() {
    setRemoveCredentialOpen(false); setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      await removeGithubCredential();
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: "", credentialConnected: false } }));
      setCredentialStatus(t("GitHub Token 已移除，账户绑定仍会保留", "GitHub Token removed; account binding is preserved", "GitHub Token 已移除，帳戶繫結仍會保留"));
      notify(t("GitHub Token 已移除", "GitHub Token removed", "GitHub Token 已移除"), t("账户绑定仍保留", "Account binding is preserved", "帳戶繫結仍保留"), "success");
    } catch (error) {
      setCredentialStatus(error instanceof Error ? error.message : t("移除凭据失败，请稍后重试", "Failed to remove credentials. Try again later.", "移除憑據失敗，請稍後重試"));
      setCredentialStatusError(true);
      return false;
    } finally { setCredentialLoading(false); }
  }

  async function testGithub() {
    if (!hasGithubCredential) return;
    setGithubTesting(true); setGithubStatus(""); setGithubStatusError(false);
    try {
      const user = await validateGithubToken(settings.githubToken.trim());
      setGithubStatus(t(`连接正常 · @${user.login}`, `Connection healthy · @${user.login}`, `連線正常 · @${user.login}`));
      notify(t("GitHub 连接正常", "GitHub connection is healthy", "GitHub 連線正常"), `@${user.login}`, "success");
    } catch (error) {
      setGithubStatus(error instanceof Error ? error.message : t("连接失败", "Connection failed", "連線失敗"));
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
      setReleaseRulesStatus(t("下载规则已同步", "Download rules synced", "下載規則已同步"));
    } catch (error) {
      const detail = error instanceof Error ? error.message : t("当前设备仍会继续使用这组规则", "This device will keep using these rules", "當前裝置仍會繼續使用這組規則");
      setReleaseRulesStatus(t(`Release 规则暂未同步：${detail}`, `Release rules have not synced yet: ${detail}`, `Release 規則暫未同步：${detail}`));
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
    catch (error) { setDataStatus(error instanceof Error ? error.message : t("导入失败", "Import failed", "匯入失敗")); setDataStatusError(true); }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader layout="simple" className="mb-4"><PageHeaderTitle>{t("设置", "Settings", "設定")}</PageHeaderTitle></PageHeader>

      {initialLoading ? <FormSkeleton /> : (
        <>
          {!mobileDetail ? <div className="grid gap-1 md:hidden">{mobileSettingsItems.map(([value, label]) => <Button key={value} variant="ghost" size="lg" className="h-12 w-full justify-between rounded-xl px-3 text-left" onClick={() => { setTab(value); setMobileDetail(true); }}><span className="text-sm font-medium">{label}</span><ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" /></Button>)}</div> : null}
          <div className={mobileDetail ? "block" : "hidden md:block"}>
            <Tabs value={tab} onValueChange={(value: SettingsTab) => setTab(value)}>
              <div className="mb-3 flex items-center gap-2 md:hidden"><Button variant="ghost" size="icon" aria-label={t("返回设置列表", "Back to Settings", "返回設定列表")} onClick={() => { setMobileDetail(false); setTab("account"); }}><ArrowLeftIcon className="size-5" aria-hidden="true" /></Button><h2 className="text-base font-semibold">{mobileTabTitle}</h2></div>
              <div className="sticky top-0 z-20 -mx-1 mb-1 hidden overflow-x-auto overflow-y-hidden overscroll-x-contain bg-background/95 px-1 pb-1 pt-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block">
                <TabsList variant="underline" size="sm" className="w-fit max-w-full justify-start">
                  <TabsTab value="account">{t("账户与 GitHub", "Account & GitHub", "帳戶與 GitHub")}</TabsTab>
                  <TabsTab value="ai">AI</TabsTab>
                  <TabsTab value="mcp">MCP</TabsTab>
                  <TabsTab value="categories">{t("分类", "Categories", "分類")}</TabsTab>
                  <TabsTab value="appearance">{t("外观", "Appearance", "外觀")}</TabsTab>
                  <TabsTab value="navigation">{t("导航", "Navigation", "導航")}</TabsTab>
                  <TabsTab value="release">{t("发布", "Release", "發布")}</TabsTab>
                  <TabsTab value="data">{t("本机数据", "Device data", "本機資料")}</TabsTab>
                </TabsList>
              </div>

              <TabsPanel value="mcp"><McpSettings /></TabsPanel>
              <TabsPanel value="account">
                <SettingsSection title="GitHub" description={t("连接 GitHub 后，可同步 Star、Release 和 Fork。", "Connect GitHub to sync Star, Release, and Fork data.", "連線 GitHub 後，可同步 Star、Release 和 Fork。")}>
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                    {settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-9 rounded-lg" /> : <span className="grid size-9 place-items-center rounded-lg bg-secondary"><StarIcon className="size-4" aria-hidden="true" /></span>}
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("尚未绑定 GitHub", "GitHub not connected", "尚未繫結 GitHub")}</p><p className="mt-0.5 text-xs text-muted-foreground">{settings.credentialConnected ? t("已连接", "Connected", "已連線") : settings.githubIdentity ? t("身份已绑定，当前未托管 Token", "Identity bound; Token is not currently stored", "身份已繫結，當前未託管 Token") : t("连接后可同步 Stars、Release 与 Fork 数据", "Connect to sync Stars, Release, and Fork data", "連線後可同步 Stars、Release 與 Fork 資料")}</p></div>
                    <span className={`size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                  </div>

                  <Field label="Personal Access Token" description={t("提交后不会在页面回显明文 Token。", "The plain Token will not be displayed after submission.", "提交後不會在頁面回顯明文 Token。")}>
                    <InputGroup>
                      <InputGroupInput type={showCredentialToken ? "text" : "password"} autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} />
                      <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showCredentialToken ? t("隐藏 Token", "Hide Token", "隱藏 Token") : t("显示 Token", "Show Token", "顯示 Token")} onClick={() => setShowCredentialToken((value) => !value)}>{showCredentialToken ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void replaceCredential()} loading={credentialLoading} disabled={!credentialToken.trim()}>{t("连接 / 更换 Token", "Connect / replace Token", "連線 / 更換 Token")}</Button>
                    <Button variant="outline" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}>{t("测试连接", "Test connection", "測試連線")}</Button>
                    <Button variant="ghost" onClick={() => setRemoveCredentialOpen(true)} disabled={!settings.githubToken && !settings.credentialConnected}>{t("移除 Token", "Remove Token", "移除 Token")}</Button>
                    {returnTo && hasGithubCredential ? <Button variant="ghost" onClick={returnAfterCredential}>{t("返回原流程", "Return", "返回原流程")}</Button> : null}
                  </div>
                  {credentialStatus || githubStatus ? <Alert variant={credentialStatusError || githubStatusError ? "error" : "success"}><AlertDescription>{credentialStatus || githubStatus}</AlertDescription></Alert> : null}
                </SettingsSection>

                <SettingsSection title={t("Star 操作", "Star actions", "Star 操作")} description={t("控制会批量修改 GitHub Star 状态的高影响操作。该偏好会在已登录设备间同步。", "Control high-impact actions that modify GitHub Star state in bulk. This preference syncs across signed-in devices.", "控制會批次修改 GitHub Star 狀態的高影響操作。該偏好會在已登入裝置間同步。")}>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
                    <div className="min-w-0"><p className="text-sm font-medium">{t("允许批量取消 Star", "Allow batch unstar", "允許批次取消 Star")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("开启后，Star 多选菜单才会显示“取消 Star”。长按“取消 Star”即可执行批量取消。", "When enabled, the Star multi-select menu shows “Unstar”. Press and hold “Unstar” to run the batch action.", "開啟後，Star 多選選單才會顯示“取消 Star”。長按“取消 Star”即可執行批次取消。")}</p></div>
                    <Switch checked={settings.batchUnstarEnabled} onCheckedChange={(checked) => onStateChange((current) => ({ ...current, settings: { ...current.settings, batchUnstarEnabled: Boolean(checked) } }))} aria-label={t("允许批量取消 Star", "Allow batch unstar", "允許批次取消 Star")} />
                  </div>
                </SettingsSection>

                <SettingsSection title={t("登录设备", "Login devices", "登入裝置")} description={t("查看当前账户的登录设备、最近访问时间，并可单独退出设备。", "Review signed-in devices and recent activity, and sign out individual devices.", "檢視當前帳戶的登入裝置、最近訪問時間，並可單獨退出裝置。")}>
                  <LoginDevicesSettings username={session?.username} onCurrentRevoked={onLogout} onSignOut={onLogout} />
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="ai">
                <SettingsSection title={t("AI 集成", "AI integration", "AI 整合")} description={t("管理多个模型服务、服务下的模型与默认模型。API Key 在 Worker 端加密保存。", "Manage multiple model services, their models, and the default model. API keys are encrypted by the Worker.", "管理多個模型服務、服務下的模型與預設模型。API Key 在 Worker 端加密儲存。")}>
                  <AiServicesSettings onRegistryChange={onAiServicesChange} />
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="categories">
                <SettingsSection title={t("分类", "Categories", "分類")} description={t("管理 Stars 的自定义分类；锁定分类不会被 AI 自动改写。", "Manage custom Star categories; locked categories are not changed automatically by AI.", "管理 Stars 的自定義分類；鎖定分類不會被 AI 自動改寫。")}>
                  <CategorySettingsPanel state={state} onStateChange={onStateChange} />
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="appearance">
                <SettingsSection title={t("语言", "Language", "語言")} description={t("选择 StarBox 的界面语言。登录后会在设备间同步。", "Choose the StarBox interface language. This preference syncs across signed-in devices.", "選擇 StarBox 的介面語言。登入後會在裝置間同步。")}>
                  <ToggleGroup className="w-fit max-w-full flex-wrap justify-self-start" aria-label={t("界面语言", "Interface language", "介面語言")} value={[settings.language]} onValueChange={(values) => { const value = values.at(-1); if (value === "zh-CN" || value === "zh-TW" || value === "en") onStateChange({ ...state, settings: { ...settings, language: value } }); }}>
                    <ToggleGroupItem value="zh-CN" className="min-w-20 w-auto whitespace-nowrap px-4">简体中文</ToggleGroupItem>
                    <ToggleGroupItem value="zh-TW" className="min-w-20 w-auto whitespace-nowrap px-4">繁體中文</ToggleGroupItem>
                    <ToggleGroupItem value="en" className="min-w-20 w-auto whitespace-nowrap px-4">English</ToggleGroupItem>
                  </ToggleGroup>
                </SettingsSection>
                <SettingsSection title={t("主题", "Theme", "主題")} description={t("选择 StarBox 的显示模式。修改会立即生效。", "Choose how StarBox looks. Changes apply immediately.", "選擇 StarBox 的顯示模式。修改會立即生效。")}>
                  <RadioGroup value={settings.theme} onValueChange={(value) => { if (value === "system" || value === "light" || value === "dark") onStateChange({ ...state, settings: { ...settings, theme: value } }); }} className="grid gap-3 sm:grid-cols-3" aria-label={t("主题", "Theme", "主題")}>
                    {(["system", "light", "dark"] as const).map((mode) => (
                      <div key={mode} data-slot="theme-option" className={`relative min-w-0 rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`}>
                        <Radio value={mode} variant="overlay" aria-label={mode === "system" ? t("跟随系统", "System", "跟隨系統") : mode === "light" ? t("浅色", "Light", "淺色") : t("深色", "Dark", "深色")} className="rounded-xl" />
                        <div className={`mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`} aria-hidden="true"><span className={`border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}`} /><span className="p-2"><span className={`block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`} /><span className={`mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`} /></span></div>
                        <span className="text-sm font-medium">{mode === "system" ? t("跟随系统", "System", "跟隨系統") : mode === "light" ? t("浅色", "Light", "淺色") : t("深色", "Dark", "深色")}</span>
                      </div>
                    ))}
                  </RadioGroup>
                </SettingsSection>
                <SettingsSection title={t("强调色", "Accent color", "強調色")} description={t("用于选中状态、关键操作和焦点提示。", "Used for selected states, key actions, and focus indicators.", "用於選中狀態、關鍵操作和焦點提示。")}>
                  <RadioGroup value={settings.accent} onValueChange={(value) => { if (value === "neutral" || value === "blue" || value === "violet" || value === "emerald") onStateChange({ ...state, settings: { ...settings, accent: value } }); }} className="flex flex-row flex-wrap gap-3" aria-label={t("强调色", "Accent color", "強調色")}>
                    {accentOptions.map((option) => (
                      <div key={option.value} data-slot="accent-option" className={`relative flex min-w-24 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-colors ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border hover:bg-accent/20"}`}>
                        <Radio value={option.value} variant="overlay" aria-label={t(option.label, option.en, option.tw)} className="rounded-lg" />
                        <span className={`size-4 shrink-0 rounded-full ${option.swatch}`} aria-hidden="true" />
                        <span className="whitespace-nowrap">{t(option.label, option.en, option.tw)}</span>
                        {settings.accent === option.value ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                      </div>
                    ))}
                  </RadioGroup>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="navigation">
                <SettingsSection title={t("侧边栏", "Sidebar", "側邊欄")} description={t("导航顺序固定；Release、Fork 和 Discover 可按需隐藏，Star 与设置始终显示。", "Navigation order is fixed. Release, Fork, and Discover can be hidden; Star and Settings are always shown.", "導航順序固定；Release、Fork 和 Discover 可按需隱藏，Star 與設定始終顯示。")}>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {NAV_ITEMS.map((id) => {
                      const item = navMeta[id]; const Icon = item.icon; const hidden = settings.hiddenNav.includes(id);
                      return <div key={id} className="flex items-center gap-3 border-b border-border/70 bg-background px-3 py-2.5 last:border-b-0"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /><span className="flex-1 text-sm font-medium">{t(item.label, item.en || item.label, item.tw || item.label)}</span>{item.required ? <span className="text-xs text-muted-foreground">{t("始终显示", "Always shown", "始終顯示")}</span> : <Switch checked={!hidden} onCheckedChange={() => toggleNav(id)} aria-label={t(`${hidden ? "显示" : "隐藏"} ${item.label}`, `${hidden ? "Show" : "Hide"} ${item.en || item.label}`, `${hidden ? "顯示" : "隱藏"} ${item.label}`)} />}</div>;
                    })}
                  </div>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="release">
                <SettingsSection title={t("发布与下载", "Release & downloads", "發布與下載")} description={t("StarBox 默认只展示每个项目的最新版本，并自动推荐当前设备最合适的安装包。这里保留测试版本偏好和可见的正则抓取规则。", "StarBox shows the latest version per project and automatically recommends the best installer for this device. Prerelease preference and visible regex matching rules stay configurable here.", "StarBox 預設只展示每個專案的最新版本，並自動推薦當前裝置最合適的安裝包。這裡保留測試版本偏好和可見的正則抓取規則。")}>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t("接收测试版本", "Include prereleases", "接收測試版本")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("开启后，Beta / RC 等测试版本可以成为项目的最新版本。", "When enabled, Beta / RC releases can become the latest version shown for a project.", "開啟後，Beta / RC 等測試版本可以成為專案的最新版本。")}</p></div>
                    <Switch checked={state.releaseSettings.includePrereleases} onCheckedChange={(checked) => updateReleaseSettings({ includePrereleases: checked })} aria-label={t("接收测试版本", "Include prereleases", "接收測試版本")} />
                  </div>

                  <Collapsible>
                    <div className="overflow-hidden rounded-xl border border-border/70">
                      <CollapsibleTrigger render={<Button variant="ghost" className="h-auto w-full justify-between whitespace-normal rounded-none px-4 py-3 text-left hover:bg-secondary/40" />}>
                        <span className="min-w-0"><span className="block text-sm font-semibold">{t("高级设置", "Advanced settings", "進階設定")}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{t("自定义 macOS、Windows 与 Linux 的安装包匹配正则。默认推荐规则适用于大多数项目。", "Customize installer matching regex for macOS, Windows, and Linux. The recommended defaults work for most projects.", "自定義 macOS、Windows 與 Linux 的安裝包匹配正則。預設推薦規則適用於大多數專案。")}</span></span>
                        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </CollapsibleTrigger>
                      <CollapsiblePanel>
                        <div className="border-t border-border/70 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="max-w-2xl"><h3 className="text-sm font-semibold">{t("安装包抓取规则", "Installer matching rules", "安裝包抓取規則")}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("匹配顺序：先用“候选规则”抓取可能的安装包，再用“排除规则”过滤校验文件、签名、源码和调试文件，最后按当前设备的平台与文件类型评分。", "Matching order: collect likely installers with the candidate rule, remove checksums, signatures, source and debug artifacts with the exclude rule, then score remaining files for this device.", "匹配順序：先用“候選規則”抓取可能的安裝包，再用“排除規則”過濾校驗檔案、簽名、原始碼和除錯檔案，最後按當前裝置的平台與檔案型別評分。")}</p></div>
                            <Button variant="outline" size="sm" onClick={resetReleaseRules}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("重置为推荐规则", "Reset recommended rules", "重置為推薦規則")}</Button>
                          </div>
                          <div className="mt-4 grid gap-4">
                            {RELEASE_RULE_PLATFORMS.map(({ id, label, description }) => (
                              <section key={id} className="min-w-0 rounded-xl bg-secondary/30 p-3.5">
                                <div className="mb-3"><h4 className="text-sm font-semibold">{label}</h4><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
                                <div className="grid min-w-0 gap-3">
                                  <Field label={t("候选安装包正则", "Candidate installer regex", "候選安裝包正則")} description={t("仅用于当前平台，不与其他平台共用。", "Used only for this platform; it is not shared with other platforms.", "僅用於當前平台，不與其他平台共用。")} error={ruleErrors[id].include}>
                                    <Input type="text" className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].includePattern} onChange={(event) => updateReleaseRule(id, "includePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} />
                                  </Field>
                                  <Field label={t("排除文件正则", "Exclude artifact regex", "排除檔案正則")} description={t("仅过滤当前平台的候选文件。", "Filters candidate files for this platform only.", "僅過濾當前平台的候選檔案。")} error={ruleErrors[id].exclude}>
                                    <Input type="text" className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].excludePattern} onChange={(event) => updateReleaseRule(id, "excludePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} />
                                  </Field>
                                </div>
                              </section>
                            ))}
                          </div>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("StarBox 会按当前设备选择 macOS、Windows 或 Linux 对应规则；未知平台会分别尝试三组规则，不会把它们合成一条全局正则。", "StarBox selects the macOS, Windows, or Linux rule set for the current device. Unknown platforms try the three rule sets independently instead of combining them into one global regex.", "StarBox 會按當前裝置選擇 macOS、Windows 或 Linux 對應規則；未知平台會分別嘗試三組規則，不會把它們合成一條全域性正則。")}</p>
                          {releaseRulesStatus ? <Alert variant={releaseRulesStatusError ? "error" : "success"}><AlertDescription>{releaseRulesStatus}</AlertDescription></Alert> : null}
                        </div>
                      </CollapsiblePanel>
                    </div>
                  </Collapsible>
                </SettingsSection>
              </TabsPanel>

              <TabsPanel value="data">
                <SettingsSection title={t("本机状态导出与导入", "Device state export & import", "本機狀態匯出與匯入")} description={t("这里导出的是当前浏览器中的 StarBox 状态，不是云端 D1 的完整备份。导入前会先显示预览，文件不包含登录凭据和 AI 密钥。", "This exports StarBox state from the current browser, not a full backup of cloud D1 data. A preview is shown before import, and credentials or AI secrets are not included.", "這裡匯出的是當前瀏覽器中的 StarBox 狀態，不是雲端 D1 的完整備份。匯入前會先顯示預覽，檔案不包含登入憑據和 AI 金鑰。")}>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportState(state)}><DownloadIcon className="size-4" aria-hidden="true" />{t("导出本机状态", "Export device state", "匯出本機狀態")}</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><UploadIcon className="size-4" aria-hidden="true" />{t("选择状态文件", "Choose state file", "選擇狀態檔案")}</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImport(file); event.currentTarget.value = ""; }} /></div>
                  {dataStatus ? <Alert variant={dataStatusError ? "error" : "success"}><AlertDescription>{dataStatus}</AlertDescription></Alert> : null}
                </SettingsSection>

                <SettingsSection title={t("本机缓存", "Device cache", "本機快取")} description={t("管理当前浏览器保存的仓库与 Release 缓存。清理不会删除云端 D1 数据，刷新后可重新同步。", "Manage repository and Release caches stored in this browser. Clearing them does not delete cloud D1 data, and they can be synced again after refresh.", "管理當前瀏覽器儲存的儲存庫與 Release 快取。清理不會刪除雲端 D1 資料，重新整理後可重新同步。")}>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3"><div><p className="text-sm font-medium">{t("清除本机缓存", "Clear device cache", "清除本機快取")}</p><p className="mt-1 text-xs text-muted-foreground">{t("保留偏好和连接设置；已同步的数据可从云端重新加载。", "Preferences and connection settings are kept; synced data can be loaded again from the cloud.", "保留偏好和連線設定；已同步的資料可從雲端重新載入。")}</p></div><Button variant="outline" onClick={() => setClearOpen(true)}>{t("清除缓存", "Clear cache", "清除快取")}</Button></div>
                </SettingsSection>
              </TabsPanel>
            </Tabs>
          </div>
          {!mobileDetail ? <AboutSettings /> : <div className="hidden md:block"><AboutSettings /></div>}
        </>
      )}

      <AlertDialog open={removeCredentialOpen} onOpenChange={setRemoveCredentialOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("移除 GitHub Token？", "Remove GitHub Token?", "移除 GitHub Token？")}</AlertDialogTitle><AlertDialogDescription>{t("只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。", "This only removes the encrypted credential stored by the Worker. The bound GitHub numeric identity is preserved, so only the same GitHub identity can be reconnected later.", "只會刪除 Worker 中儲存的加密憑據。已繫結的 GitHub numeric identity 會繼續保留，後續只能重新連線同一 GitHub 身份。")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} disabled={credentialLoading} label={t("按住移除 Token", "Hold to remove Token", "按住移除 Token")} confirmedLabel={t("正在移除", "Removing", "正在移除")} ariaLabel={t("按住 1.2 秒移除 GitHub Token", "Hold for 1.2 seconds to remove GitHub Token", "按住 1.2 秒移除 GitHub Token")} onConfirm={() => removeCredential()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("清除此设备的数据？", "Clear data on this device?", "清除此裝置的資料？")}</AlertDialogTitle><AlertDialogDescription>{t("清除此设备的仓库与 Release 缓存，保留偏好和连接设置。刷新页面即可重新加载云端数据。", "Clears repository and Release caches while keeping preferences and connection settings. Reload to fetch cloud data again.", "清除此裝置的儲存庫與 Release 快取，保留偏好和連線設定。重新整理頁面即可重新載入雲端資料。")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} label={t("按住清空本地数据", "Hold to clear local data", "按住清空本地資料")} confirmedLabel={t("正在清空", "Clearing", "正在清空")} ariaLabel={t("按住 1.2 秒清空此设备的仓库与 Release 缓存", "Hold for 1.2 seconds to clear repository and Release caches on this device", "按住 1.2 秒清空此裝置的儲存庫與 Release 快取")} onConfirm={() => { onStateChange(clearDeviceState(state)); setClearOpen(false); notify(t("此设备的数据已清除", "Data on this device was cleared", "此裝置的資料已清除"), t("偏好和连接设置已保留", "Preferences and connection settings were kept", "偏好和連線設定已保留"), "success"); }} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <ResponsiveDialog open={Boolean(importPreview)} title={t("本机状态导入预览", "Device state import preview", "本機狀態匯入預覽")} description={t("确认后将替换当前浏览器中的 StarBox 状态，不会修改导入文件，也不会删除云端 D1 数据。", "Confirming replaces StarBox state in the current browser. It does not modify the import file or delete cloud D1 data.", "確認後將替換當前瀏覽器中的 StarBox 狀態，不會修改匯入檔案，也不會刪除雲端 D1 資料。")} onClose={() => setImportPreview(null)}>{importPreview ? <div className="grid gap-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("仓库", "Repositories", "儲存庫")}</div><div className="mt-1 font-semibold">{importPreview.repositories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("分类", "Categories", "分類")}</div><div className="mt-1 font-semibold">{importPreview.categories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("Release 订阅", "Release subscriptions", "Release 訂閱")}</div><div className="mt-1 font-semibold">{importPreview.releaseSubscriptions.length}</div></div></div><Alert variant="warning"><AlertDescription>{t("确认导入后会替换当前浏览器状态；云端数据不会在此步骤被删除。", "Importing replaces the current browser state; cloud data is not deleted in this step.", "確認匯入後會替換當前瀏覽器狀態；雲端資料不會在此步驟被刪除。")}</AlertDescription></Alert><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setImportPreview(null)}>{t("取消", "Cancel", "取消")}</Button><Button onClick={() => { onStateChange((current) => ({ ...importPreview, settings: { ...importPreview.settings, githubToken: current.settings.githubToken, githubIdentity: current.settings.githubIdentity, credentialConnected: current.settings.credentialConnected, ai: current.settings.ai } })); setImportPreview(null); setDataStatus(t("导入成功", "Import successful", "匯入成功")); setDataStatusError(false); notify(t("导入完成", "Import complete", "匯入完成"), t("当前浏览器状态已替换", "Current browser state was replaced", "當前瀏覽器狀態已替換"), "success"); }}>{t("确认导入", "Import", "確認匯入")}</Button></div></div> : null}</ResponsiveDialog>
    </div>
  );
}
