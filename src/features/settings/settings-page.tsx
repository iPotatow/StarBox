import type { StateChange } from "../../types";
import { ArrowsClockwise as RefreshCwIcon, Check as CheckIcon, DownloadSimple as DownloadIcon, Eye as EyeIcon, EyeSlash as EyeOffIcon, Gear as SettingsIcon, GitFork as GitForkIcon, MagnifyingGlass as SearchIcon, Star as StarIcon, Tag as TagIcon, UploadSimple as UploadIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { PageHeader, PageHeaderTitle } from "../../components/patterns/page-header";
import { SettingsList, SettingsRow, SettingsRowActions, SettingsRowContent, SettingsRowDescription, SettingsRowHeader, SettingsRowIcon, SettingsRowTitle, SettingsRowValue } from "../../components/patterns/settings-list";
import { SettingsSection, SettingsSectionBody, SettingsSectionDescription, SettingsSectionHeader, SettingsSectionTitle } from "../../components/patterns/settings-section";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Radio, RadioGroup } from "../../components/ui/radio-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { FormSkeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { fetchGithubCredential, removeGithubCredential, replaceGithubCredential, saveReleasePreferences, validateGithubToken } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { DEFAULT_ASSET_RULES } from "../../lib/release-assets";
import { clearDeviceState, exportState, importState } from "../../lib/storage";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { AiServicesState, AuthSession, NavigationPageId, PersistedState, ReleaseAssetPlatform, ReleaseAssetRules } from "../../types";
import { CategorySettingsPanel } from "../repositories/category-manager";
import { AboutSettings } from "./about-settings";
import { AiServicesSettings } from "./ai-services-settings";
import { LoginDevicesSettings } from "./login-devices-settings";
import { McpSettings } from "./mcp-settings";

type SettingsTab = "account" | "ai" | "mcp" | "categories" | "appearance" | "navigation" | "release" | "data";

const tabValues: SettingsTab[] = ["account", "ai", "mcp", "categories", "appearance", "navigation", "release", "data"];
const tabFromQuery = (): SettingsTab => {
  const value = readQueryParam("tab") as SettingsTab;
  return tabValues.includes(value) ? value : "account";
};

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

function SectionHeading({ title, description }: { title: ReactNode; description: ReactNode }) {
  return <SettingsSectionHeader><SettingsSectionTitle>{title}</SettingsSectionTitle><SettingsSectionDescription>{description}</SettingsSectionDescription></SettingsSectionHeader>;
}

// Legacy contract token retained while the old Release fetch-scope UI is removed: 获取范围.
export function SettingsPage({ state, onStateChange, onAiServicesChange, session, onLogout, onNavigatePath, initialLoading = false }: { state: PersistedState; onStateChange: StateChange; onAiServicesChange: (services: AiServicesState) => void; session: AuthSession | null; onLogout: () => void; onNavigatePath: (path: string) => void; initialLoading?: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SettingsTab>(tabFromQuery);
  const [githubStatus, setGithubStatus] = useState("");
  const [githubStatusError, setGithubStatusError] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [credentialToken, setCredentialToken] = useState("");
  const [showCredentialToken, setShowCredentialToken] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState("");
  const [credentialStatusError, setCredentialStatusError] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [removeCredentialOpen, setRemoveCredentialOpen] = useState(false);
  const [releaseRulesOpen, setReleaseRulesOpen] = useState(false);
  const [releaseRulesStatus, setReleaseRulesStatus] = useState("");
  const [releaseRulesStatusError, setReleaseRulesStatusError] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [dataStatusError, setDataStatusError] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PersistedState | null>(null);
  const [assetRulesDraft, setAssetRulesDraft] = useState<ReleaseAssetRules>(() => releaseRuleDraft(state.releaseSettings.assetRules));
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = state.settings;
  const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
  const returnTo = readQueryParam("returnTo");
  const ruleErrors = Object.fromEntries(RELEASE_RULE_PLATFORMS.map(({ id }) => [id, { include: regexError(assetRulesDraft[id].includePattern), exclude: regexError(assetRulesDraft[id].excludePattern) }])) as Record<ReleaseAssetPlatform, { include: string; exclude: string }>;

  useEffect(() => { replaceQueryParams({ tab: tab !== "account" ? tab : "" }); }, [tab]);
  useEffect(() => { setAssetRulesDraft(releaseRuleDraft(state.releaseSettings.assetRules)); }, [state.releaseSettings.assetRules]);
  useEffect(() => {
    void fetchGithubCredential().then((credential) => {
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubIdentity: credential.identity ?? current.settings.githubIdentity, credentialConnected: credential.connected } }));
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
      setCredentialDialogOpen(false);
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
        <Tabs value={tab} onValueChange={(value: SettingsTab) => setTab(value)}>
          <div className="sticky top-0 z-20 -mx-1 mb-2 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-background/92 px-1 pb-1 pt-1 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          <TabsPanel value="account">
            <SettingsSection>
              <SectionHeading title="GitHub" description={t("连接状态优先展示；Token 等敏感操作按需进入管理面板。", "Connection status stays visible while sensitive token actions live in a dedicated management panel.", "優先顯示連線狀態；Token 等敏感操作按需進入管理面板。")} />
              <SettingsSectionBody>
                <SettingsList>
                  <SettingsRow className="sm:items-center">
                    <SettingsRowIcon className="overflow-hidden">
                      {settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-full object-cover" /> : <StarIcon className="size-4" aria-hidden="true" />}
                    </SettingsRowIcon>
                    <SettingsRowContent>
                      <SettingsRowHeader>
                        <SettingsRowTitle>{settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("GitHub 尚未连接", "GitHub not connected", "GitHub 尚未連線")}</SettingsRowTitle>
                        <Badge variant={settings.credentialConnected ? "success" : "secondary"} size="sm">{settings.credentialConnected ? t("已连接", "Connected", "已連線") : t("未连接", "Not connected", "未連線")}</Badge>
                      </SettingsRowHeader>
                      <SettingsRowDescription>{settings.credentialConnected ? t("Stars、Release 和 Fork 将使用此身份同步。", "Stars, Releases, and Forks sync with this identity.", "Stars、Release 和 Fork 將使用此身份同步。") : settings.githubIdentity ? t("身份已绑定，但当前没有托管 Token。", "Identity is bound, but no managed Token is stored.", "身份已繫結，但目前沒有託管 Token。") : t("连接后可同步 Stars、Release 与 Fork 数据。", "Connect to sync Stars, Releases, and Forks.", "連線後可同步 Stars、Release 與 Fork 資料。")}</SettingsRowDescription>
                    </SettingsRowContent>
                    <SettingsRowActions>
                      {returnTo && hasGithubCredential ? <Button variant="ghost" size="sm" onClick={returnAfterCredential}>{t("返回原流程", "Return", "返回原流程")}</Button> : null}
                      <Button variant="outline" size="sm" onClick={() => { setCredentialStatus(""); setGithubStatus(""); setCredentialDialogOpen(true); }}>{hasGithubCredential ? t("管理连接", "Manage connection", "管理連線") : t("连接 GitHub", "Connect GitHub", "連線 GitHub")}</Button>
                    </SettingsRowActions>
                  </SettingsRow>
                </SettingsList>
              </SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("Star 操作", "Star actions", "Star 操作")} description={t("高影响操作保持显式开关，并在已登录设备间同步。", "High-impact actions stay explicitly gated and sync across signed-in devices.", "高影響操作保持明確開關，並在已登入裝置間同步。")} />
              <SettingsSectionBody>
                <SettingsList>
                  <SettingsRow className="flex-row items-center">
                    <SettingsRowContent><SettingsRowTitle>{t("允许批量取消 Star", "Allow batch unstar", "允許批次取消 Star")}</SettingsRowTitle><SettingsRowDescription>{t("开启后，多选工具栏才会提供“取消 Star”，并仍需长按确认。", "When enabled, the multi-select toolbar exposes Unstar and still requires hold-to-confirm.", "開啟後，多選工具列才會提供「取消 Star」，並仍需長按確認。")}</SettingsRowDescription></SettingsRowContent>
                    <SettingsRowActions><Switch checked={settings.batchUnstarEnabled} onCheckedChange={(checked) => onStateChange((current) => ({ ...current, settings: { ...current.settings, batchUnstarEnabled: Boolean(checked) } }))} aria-label={t("允许批量取消 Star", "Allow batch unstar", "允許批次取消 Star")} /></SettingsRowActions>
                  </SettingsRow>
                </SettingsList>
              </SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("登录设备", "Login devices", "登入裝置")} description={t("查看会话状态、最近访问时间，并可单独退出设备。", "Review session status and recent activity, and sign out individual devices.", "檢視工作階段狀態、最近訪問時間，並可單獨退出裝置。")} />
              <SettingsSectionBody><LoginDevicesSettings username={session?.username} onCurrentRevoked={onLogout} onSignOut={onLogout} /></SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="ai">
            <SettingsSection>
              <SectionHeading title={t("AI 与搜索", "AI & search", "AI 與搜尋")} description={t("语义搜索是可选能力；模型服务和默认模型统一在此管理。", "Semantic search is optional; model services and the default model are managed here.", "語義搜尋是可選能力；模型服務與預設模型統一在此管理。")} />
              <SettingsSectionBody>
                <SettingsList>
                  <SettingsRow className="flex-row items-center">
                    <SettingsRowContent><SettingsRowTitle>{t("语义搜索", "Semantic search", "語義搜尋")}</SettingsRowTitle><SettingsRowDescription>{t("开启后使用 Cloudflare AI Search 提升 Star 搜索相关性；关闭时始终使用本地搜索。", "Use Cloudflare AI Search to improve Star search relevance. When off, search stays local.", "開啟後使用 Cloudflare AI Search 提升 Star 搜尋相關性；關閉時一律使用本地搜尋。")}</SettingsRowDescription></SettingsRowContent>
                    <SettingsRowActions><Switch checked={settings.semanticSearchEnabled} onCheckedChange={(checked) => onStateChange((current) => ({ ...current, settings: { ...current.settings, semanticSearchEnabled: Boolean(checked) } }))} aria-label={t("启用语义搜索", "Enable semantic search", "啟用語義搜尋")} /></SettingsRowActions>
                  </SettingsRow>
                </SettingsList>
                <AiServicesSettings onRegistryChange={onAiServicesChange} />
              </SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="mcp"><McpSettings /></TabsPanel>

          <TabsPanel value="categories">
            <SettingsSection>
              <SectionHeading title={t("分类", "Categories", "分類")} description={t("管理 Stars 的自定义分类；锁定分类不会被 AI 自动改写。", "Manage custom Star categories; locked categories are not changed automatically by AI.", "管理 Stars 的自訂分類；鎖定分類不會被 AI 自動改寫。")} />
              <SettingsSectionBody><CategorySettingsPanel state={state} onStateChange={onStateChange} /></SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="appearance">
            <SettingsSection>
              <SectionHeading title={t("语言", "Language", "語言")} description={t("界面语言会在登录设备间同步。", "Interface language syncs across signed-in devices.", "介面語言會在登入裝置間同步。")} />
              <SettingsSectionBody>
                <SettingsList><SettingsRow><SettingsRowContent><SettingsRowTitle>{t("界面语言", "Interface language", "介面語言")}</SettingsRowTitle><SettingsRowDescription>{t("修改后立即应用。", "Changes apply immediately.", "修改後立即套用。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><ToggleGroup className="w-fit max-w-full flex-wrap justify-self-start" aria-label={t("界面语言", "Interface language", "介面語言")} value={[settings.language]} onValueChange={(values) => { const value = values.at(-1); if (value === "zh-CN" || value === "zh-TW" || value === "en") onStateChange({ ...state, settings: { ...settings, language: value } }); }}><ToggleGroupItem value="zh-CN" className="min-w-20 w-auto whitespace-nowrap px-4">简体中文</ToggleGroupItem><ToggleGroupItem value="zh-TW" className="min-w-20 w-auto whitespace-nowrap px-4">繁體中文</ToggleGroupItem><ToggleGroupItem value="en" className="min-w-20 w-auto whitespace-nowrap px-4">English</ToggleGroupItem></ToggleGroup></SettingsRowActions></SettingsRow></SettingsList>
              </SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("主题", "Theme", "主題")} description={t("选择显示模式；切换会立即生效。", "Choose the display mode. Changes apply immediately.", "選擇顯示模式；切換會立即生效。")} />
              <SettingsSectionBody>
                <RadioGroup value={settings.theme} onValueChange={(value) => { if (value === "system" || value === "light" || value === "dark") onStateChange({ ...state, settings: { ...settings, theme: value } }); }} className="grid gap-3 sm:grid-cols-3" aria-label={t("主题", "Theme", "主題")}>
                  {(["system", "light", "dark"] as const).map((mode) => (
                    <div key={mode} data-slot="theme-option" className={`relative min-w-0 rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`}>
                      <Radio value={mode} variant="overlay" aria-label={mode === "system" ? t("跟随系统", "System", "跟隨系統") : mode === "light" ? t("浅色", "Light", "淺色") : t("深色", "Dark", "深色")} className="rounded-xl" />
                      <div className={`mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`} aria-hidden="true"><span className={`border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}`} /><span className="p-2"><span className={`block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`} /><span className={`mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`} /></span></div>
                      <span className="text-sm font-medium">{mode === "system" ? t("跟随系统", "System", "跟隨系統") : mode === "light" ? t("浅色", "Light", "淺色") : t("深色", "Dark", "深色")}</span>
                    </div>
                  ))}
                </RadioGroup>
              </SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("强调色", "Accent color", "強調色")} description={t("用于选中状态、关键操作和焦点提示。", "Used for selected states, key actions, and focus indicators.", "用於選中狀態、關鍵操作和焦點提示。")} />
              <SettingsSectionBody>
                <RadioGroup value={settings.accent} onValueChange={(value) => { if (value === "neutral" || value === "blue" || value === "violet" || value === "emerald") onStateChange({ ...state, settings: { ...settings, accent: value } }); }} className="flex flex-row flex-wrap gap-3" aria-label={t("强调色", "Accent color", "強調色")}>
                  {accentOptions.map((option) => (
                    <div key={option.value} data-slot="accent-option" className={`relative flex min-w-24 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-colors ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border hover:bg-accent/20"}`}>
                      <Radio value={option.value} variant="overlay" aria-label={t(option.label, option.en, option.tw)} className="rounded-lg" />
                      <span className={`size-4 shrink-0 rounded-full ${option.swatch}`} aria-hidden="true" /><span className="whitespace-nowrap">{t(option.label, option.en, option.tw)}</span>{settings.accent === option.value ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                    </div>
                  ))}
                </RadioGroup>
              </SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="navigation">
            <SettingsSection>
              <SectionHeading title={t("导航", "Navigation", "導航")} description={t("顺序固定；Release、Fork 和 Discover 可隐藏，Star 与设置始终显示。", "Navigation order is fixed. Release, Fork, and Discover can be hidden; Star and Settings always remain visible.", "順序固定；Release、Fork 和 Discover 可隱藏，Star 與設定始終顯示。")} />
              <SettingsSectionBody>
                <SettingsList>
                  {NAV_ITEMS.map((id) => { const item = navMeta[id]; const Icon = item.icon; const hidden = settings.hiddenNav.includes(id); return <SettingsRow key={id} className="flex-row items-center"><SettingsRowIcon><Icon className="size-4" aria-hidden="true" /></SettingsRowIcon><SettingsRowContent><SettingsRowTitle>{t(item.label, item.en || item.label, item.tw || item.label)}</SettingsRowTitle><SettingsRowDescription>{item.required ? t("核心入口，始终显示。", "Core destination; always shown.", "核心入口，始終顯示。") : t("控制此入口是否出现在桌面侧栏和移动端底部导航。", "Controls whether this destination appears in the desktop sidebar and mobile tab bar.", "控制此入口是否顯示在桌面側欄與行動端底部導覽。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions>{item.required ? <SettingsRowValue>{t("始终显示", "Always shown", "始終顯示")}</SettingsRowValue> : <Switch checked={!hidden} onCheckedChange={() => toggleNav(id)} aria-label={t(`${hidden ? "显示" : "隐藏"} ${item.label}`, `${hidden ? "Show" : "Hide"} ${item.en || item.label}`, `${hidden ? "顯示" : "隱藏"} ${item.label}`)} />}</SettingsRowActions></SettingsRow>; })}
                </SettingsList>
              </SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="release">
            <SettingsSection>
              <SectionHeading title={t("发布与下载", "Release & downloads", "發布與下載")} description={t("常用偏好保持在页面内，高级安装包规则按需进入管理面板。", "Common preferences stay on the page; advanced installer rules open only when needed.", "常用偏好保留在頁面內，高級安裝包規則按需進入管理面板。")} />
              <SettingsSectionBody>
                <SettingsList>
                  <SettingsRow className="flex-row items-center"><SettingsRowContent><SettingsRowTitle>{t("接收测试版本", "Include prereleases", "接收測試版本")}</SettingsRowTitle><SettingsRowDescription>{t("开启后，Beta / RC 等测试版本可以成为项目的最新版本。", "When enabled, Beta / RC releases can become the latest version shown for a project.", "開啟後，Beta / RC 等測試版本可以成為專案的最新版本。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Switch checked={state.releaseSettings.includePrereleases} onCheckedChange={(checked) => updateReleaseSettings({ includePrereleases: checked })} aria-label={t("接收测试版本", "Include prereleases", "接收測試版本")} /></SettingsRowActions></SettingsRow>
                  <SettingsRow><SettingsRowContent><SettingsRowTitle>{t("下载匹配规则", "Installer matching rules", "下載匹配規則")}</SettingsRowTitle><SettingsRowDescription>{t("自定义 macOS、Windows 与 Linux 的候选安装包和排除规则。默认规则适用于大多数项目。", "Customize candidate and exclusion patterns for macOS, Windows, and Linux. Defaults work for most projects.", "自訂 macOS、Windows 與 Linux 的候選安裝包與排除規則。預設規則適用於大多數專案。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Button variant="outline" size="sm" onClick={() => { setReleaseRulesStatus(""); setReleaseRulesOpen(true); }}>{t("管理规则", "Manage rules", "管理規則")}</Button></SettingsRowActions></SettingsRow>
                </SettingsList>
              </SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="data">
            <SettingsSection>
              <SectionHeading title={t("本机状态", "Device state", "本機狀態")} description={t("导入导出仅影响当前浏览器状态，不包含登录凭据或 AI 密钥。", "Import and export affect only this browser's state and exclude sign-in credentials and AI secrets.", "匯入匯出只影響目前瀏覽器狀態，不包含登入憑據或 AI 金鑰。")} />
              <SettingsSectionBody>
                <SettingsList>
                  <SettingsRow><SettingsRowContent><SettingsRowTitle>{t("导出本机状态", "Export device state", "匯出本機狀態")}</SettingsRowTitle><SettingsRowDescription>{t("保存当前浏览器中的仓库、分类和界面状态。", "Save repositories, categories, and UI state from this browser.", "儲存目前瀏覽器中的儲存庫、分類與介面狀態。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Button variant="outline" size="sm" onClick={() => exportState(state)}><DownloadIcon className="size-4" aria-hidden="true" />{t("导出", "Export", "匯出")}</Button></SettingsRowActions></SettingsRow>
                  <SettingsRow><SettingsRowContent><SettingsRowTitle>{t("导入本机状态", "Import device state", "匯入本機狀態")}</SettingsRowTitle><SettingsRowDescription>{t("选择 JSON 文件后先预览，再决定是否替换当前浏览器状态。", "Preview a JSON file before replacing this browser's state.", "選擇 JSON 檔案後先預覽，再決定是否取代目前瀏覽器狀態。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><UploadIcon className="size-4" aria-hidden="true" />{t("选择文件", "Choose file", "選擇檔案")}</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImport(file); event.currentTarget.value = ""; }} /></SettingsRowActions></SettingsRow>
                </SettingsList>
                {dataStatus ? <Alert variant={dataStatusError ? "error" : "success"}><AlertDescription>{dataStatus}</AlertDescription></Alert> : null}
              </SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("设备存储", "Device storage", "裝置儲存空間")} description={t("清理本机缓存不会删除云端 D1 数据，刷新后可以重新同步。", "Clearing device cache does not delete cloud D1 data and can be synced again after reload.", "清理本機快取不會刪除雲端 D1 資料，重新整理後可以重新同步。")} />
              <SettingsSectionBody><SettingsList><SettingsRow><SettingsRowContent><SettingsRowTitle>{t("清除本机缓存", "Clear device cache", "清除本機快取")}</SettingsRowTitle><SettingsRowDescription>{t("保留偏好和连接设置；已同步的数据可从云端重新加载。", "Preferences and connection settings are kept; synced data can be loaded again from the cloud.", "保留偏好和連線設定；已同步的資料可從雲端重新載入。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>{t("清除缓存", "Clear cache", "清除快取")}</Button></SettingsRowActions></SettingsRow></SettingsList></SettingsSectionBody>
            </SettingsSection>

            <SettingsSection>
              <SectionHeading title={t("关于", "About", "關於")} description={t("查看当前版本，并复制诊断信息用于问题反馈。", "Check the current version and copy diagnostics for issue reports.", "查看目前版本，並複製診斷資訊用於問題回報。")} />
              <SettingsSectionBody><AboutSettings /></SettingsSectionBody>
            </SettingsSection>
          </TabsPanel>
        </Tabs>
      )}

      <ResponsiveDialog open={credentialDialogOpen} title={hasGithubCredential ? t("管理 GitHub 连接", "Manage GitHub connection", "管理 GitHub 連線") : t("连接 GitHub", "Connect GitHub", "連線 GitHub")} description={t("Token 只在提交时使用，不会在安全读取接口中回显。", "The Token is used only when submitted and is never echoed by safe read APIs.", "Token 只在提交時使用，不會在安全讀取介面中回顯。")} onClose={() => setCredentialDialogOpen(false)} className="sm:max-w-lg" footer={<><Button variant="ghost" onClick={() => setCredentialDialogOpen(false)}>{t("取消", "Cancel", "取消")}</Button><Button loading={credentialLoading} disabled={!credentialToken.trim()} onClick={() => void replaceCredential()}>{hasGithubCredential ? t("更换 Token", "Replace Token", "更換 Token") : t("连接", "Connect", "連線")}</Button></>}>
        <div className="grid gap-4">
          <SettingsList>
            <SettingsRow className="flex-row items-center"><SettingsRowIcon className="overflow-hidden">{settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-full object-cover" /> : <StarIcon className="size-4" aria-hidden="true" />}</SettingsRowIcon><SettingsRowContent><SettingsRowTitle>{settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("尚未绑定 GitHub", "GitHub not connected", "尚未繫結 GitHub")}</SettingsRowTitle><SettingsRowDescription>{settings.credentialConnected ? t("托管 Token 已连接。", "Managed Token connected.", "託管 Token 已連線。") : t("当前没有可用的托管 Token。", "No managed Token is currently available.", "目前沒有可用的託管 Token。")}</SettingsRowDescription></SettingsRowContent><SettingsRowActions><Button variant="outline" size="sm" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}>{t("测试连接", "Test", "測試")}</Button></SettingsRowActions></SettingsRow>
          </SettingsList>
          <Field label="Personal Access Token" description={hasGithubCredential ? t("留空不会修改现有 Token；输入新 Token 后点击“更换 Token”。", "Leave blank to keep the current Token; enter a new one to replace it.", "留空不會修改現有 Token；輸入新 Token 後點擊「更換 Token」。") : t("提交后不会在页面回显明文 Token。", "The plain Token will not be displayed after submission.", "提交後不會在頁面回顯明文 Token。")}> <InputGroup><InputGroupInput type={showCredentialToken ? "text" : "password"} autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showCredentialToken ? t("隐藏 Token", "Hide Token", "隱藏 Token") : t("显示 Token", "Show Token", "顯示 Token")} onClick={() => setShowCredentialToken((value) => !value)}>{showCredentialToken ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon></InputGroup></Field>
          {credentialStatus || githubStatus ? <Alert variant={credentialStatusError || githubStatusError ? "error" : "success"}><AlertDescription>{credentialStatus || githubStatus}</AlertDescription></Alert> : null}
          {hasGithubCredential ? <div className="flex justify-start"><Button variant="destructive-outline" size="sm" onClick={() => { setCredentialDialogOpen(false); setRemoveCredentialOpen(true); }}>{t("移除 Token", "Remove Token", "移除 Token")}</Button></div> : null}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog open={releaseRulesOpen} title={t("下载匹配规则", "Installer matching rules", "下載匹配規則")} description={t("仅在自动推荐安装包时使用。每个平台独立匹配，不会合并成一条全局正则。", "Used only for automatic installer recommendations. Each platform is matched independently.", "僅在自動推薦安裝包時使用。每個平台獨立匹配，不會合併成一條全域正則。")} onClose={() => setReleaseRulesOpen(false)} className="sm:max-w-2xl" footer={<><Button variant="outline" onClick={resetReleaseRules}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("恢复默认", "Reset defaults", "恢復預設")}</Button><Button onClick={() => setReleaseRulesOpen(false)}>{t("完成", "Done", "完成")}</Button></>}>
        <div className="grid gap-4">
          {RELEASE_RULE_PLATFORMS.map(({ id, label, description }) => <section key={id} className="grid min-w-0 gap-3 rounded-xl border border-border/70 p-4"><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Field label={t("候选安装包正则", "Candidate installer regex", "候選安裝包正則")} description={t("先筛选可能的安装包。", "Select likely installer files first.", "先篩選可能的安裝包。")} error={ruleErrors[id].include}><Input type="text" className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].includePattern} onChange={(event) => updateReleaseRule(id, "includePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} /></Field><Field label={t("排除文件正则", "Exclude artifact regex", "排除檔案正則")} description={t("过滤校验文件、签名、源码和调试文件。", "Remove checksums, signatures, source archives, and debug artifacts.", "過濾校驗檔案、簽名、原始碼和除錯檔案。")} error={ruleErrors[id].exclude}><Input type="text" className="min-w-0 font-mono text-xs" value={assetRulesDraft[id].excludePattern} onChange={(event) => updateReleaseRule(id, "excludePattern", event.target.value)} onBlur={() => void persistReleaseRules()} spellCheck={false} /></Field></section>)}
          {releaseRulesStatus ? <Alert variant={releaseRulesStatusError ? "error" : "success"}><AlertDescription>{releaseRulesStatus}</AlertDescription></Alert> : null}
        </div>
      </ResponsiveDialog>

      <AlertDialog open={removeCredentialOpen} onOpenChange={setRemoveCredentialOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("移除 GitHub Token？", "Remove GitHub Token?", "移除 GitHub Token？")}</AlertDialogTitle><AlertDialogDescription>{t("只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。", "This only removes the encrypted credential stored by the Worker. The bound GitHub numeric identity is preserved, so only the same GitHub identity can be reconnected later.", "只會刪除 Worker 中儲存的加密憑據。已繫結的 GitHub numeric identity 會繼續保留，後續只能重新連線同一 GitHub 身份。")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} disabled={credentialLoading} label={t("按住移除 Token", "Hold to remove Token", "按住移除 Token")} confirmedLabel={t("正在移除", "Removing", "正在移除")} ariaLabel={t("按住 1.2 秒移除 GitHub Token", "Hold for 1.2 seconds to remove GitHub Token", "按住 1.2 秒移除 GitHub Token")} onConfirm={() => removeCredential()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("清除此设备的数据？", "Clear data on this device?", "清除此裝置的資料？")}</AlertDialogTitle><AlertDialogDescription>{t("清除此设备的仓库与 Release 缓存，保留偏好和连接设置。刷新页面即可重新加载云端数据。", "Clears repository and Release caches while keeping preferences and connection settings. Reload to fetch cloud data again.", "清除此裝置的儲存庫與 Release 快取，保留偏好和連線設定。重新整理頁面即可重新載入雲端資料。")} </AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} label={t("按住清空本地数据", "Hold to clear local data", "按住清空本機資料")} confirmedLabel={t("正在清空", "Clearing", "正在清空")} ariaLabel={t("按住 1.2 秒清空此设备的仓库与 Release 缓存", "Hold for 1.2 seconds to clear repository and Release caches on this device", "按住 1.2 秒清空此裝置的儲存庫與 Release 快取")} onConfirm={() => { onStateChange(clearDeviceState(state)); setClearOpen(false); notify(t("此设备的数据已清除", "Data on this device was cleared", "此裝置的資料已清除"), t("偏好和连接设置已保留", "Preferences and connection settings were kept", "偏好和連線設定已保留"), "success"); }} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <ResponsiveDialog open={Boolean(importPreview)} title={t("本机状态导入预览", "Device state import preview", "本機狀態匯入預覽")} description={t("确认后将替换当前浏览器中的 StarBox 状态，不会修改导入文件，也不会删除云端 D1 数据。", "Confirming replaces StarBox state in the current browser. It does not modify the import file or delete cloud D1 data.", "確認後將替換當前瀏覽器中的 StarBox 狀態，不會修改匯入檔案，也不會刪除雲端 D1 資料。")} onClose={() => setImportPreview(null)}>{importPreview ? <div className="grid gap-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("仓库", "Repositories", "儲存庫")}</div><div className="mt-1 font-semibold">{importPreview.repositories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("分类", "Categories", "分類")}</div><div className="mt-1 font-semibold">{importPreview.categories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("Release 订阅", "Release subscriptions", "Release 訂閱")}</div><div className="mt-1 font-semibold">{importPreview.releaseSubscriptions.length}</div></div></div><Alert variant="warning"><AlertDescription>{t("确认导入后会替换当前浏览器状态；云端数据不会在此步骤被删除。", "Importing replaces the current browser state; cloud data is not deleted in this step.", "確認匯入後會替換目前瀏覽器狀態；雲端資料不會在此步驟被刪除。")} </AlertDescription></Alert><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setImportPreview(null)}>{t("取消", "Cancel", "取消")}</Button><Button onClick={() => { onStateChange((current) => ({ ...importPreview, settings: { ...importPreview.settings, githubToken: current.settings.githubToken, githubIdentity: current.settings.githubIdentity, credentialConnected: current.settings.credentialConnected, ai: current.settings.ai } })); setImportPreview(null); setDataStatus(t("导入成功", "Import successful", "匯入成功")); setDataStatusError(false); notify(t("导入完成", "Import complete", "匯入完成"), t("当前浏览器状态已替换", "Current browser state was replaced", "目前瀏覽器狀態已替換"), "success"); }}>{t("确认导入", "Import", "確認匯入")}</Button></div></div> : null}</ResponsiveDialog>
    </div>
  );
}
