import {
  RiCheckLine,
  RiDownload2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiGitForkLine,
  RiPriceTag3Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiStarLine,
  RiUpload2Line,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { FormSkeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { CategorySettingsPanel } from "../repositories/category-manager";
import { AiServicesSettings } from "./ai-services-settings";
import { LoginDevicesSettings } from "./login-devices-settings";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, saveReleasePreferences, validateGithubToken } from "../../lib/api";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import { useI18n } from "../../lib/i18n";
import type { AuthSession, GithubRateLimit, NavigationPageId, PersistedState } from "../../types";

type SettingsTab = "account" | "ai" | "categories" | "appearance" | "navigation" | "data";

const tabValues: SettingsTab[] = ["account", "ai", "categories", "appearance", "navigation", "data"];
const tabFromQuery = (): SettingsTab => {
  const value = readQueryParam("tab") as SettingsTab;
  return tabValues.includes(value) ? value : "account";
};

function SettingsSection({ title, description, children, danger = false }: { title: string; description: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className="border-b border-border/70 py-7 first:pt-3 last:border-b-0">
      <header className="mb-5 max-w-3xl">
        <h2 className={danger ? "text-base font-semibold text-destructive-foreground" : "text-base font-semibold"}>{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="grid min-w-0 max-w-5xl gap-4">{children}</div>
    </section>
  );
}

const navMeta: Record<NavigationPageId, { label: string; en?: string; icon: typeof RiStarLine; required?: boolean }> = {
  repositories: { label: "Star", icon: RiStarLine, required: true },
  releases: { label: "Release", icon: RiPriceTag3Line },
  forks: { label: "Fork", icon: RiGitForkLine },
  discover: { label: "Discover", icon: RiSearchLine },
  settings: { label: "设置", en: "Settings", icon: RiSettings4Line, required: true },
};

const accentOptions = [
  { value: "neutral" as const, label: "中性", en: "Neutral", swatch: "bg-neutral-700 dark:bg-neutral-300" },
  { value: "blue" as const, label: "蓝色", en: "Blue", swatch: "bg-blue-500" },
  { value: "violet" as const, label: "紫色", en: "Violet", swatch: "bg-violet-500" },
  { value: "emerald" as const, label: "翠绿", en: "Emerald", swatch: "bg-emerald-500" },
];

function regexError(value: string) {
  if (!value.trim()) return "";
  try { new RegExp(value, "i"); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "正则无效"; }
}


export function SettingsPage({ state, onStateChange, session, onLogout, onNavigatePath, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; session: AuthSession | null; onLogout: () => void; onNavigatePath: (path: string) => void; initialLoading?: boolean }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<SettingsTab>(tabFromQuery);
  const [githubStatus, setGithubStatus] = useState("");
  const [githubStatusError, setGithubStatusError] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [rateLimits, setRateLimits] = useState<GithubRateLimit[]>([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [credentialToken, setCredentialToken] = useState("");
  const [showCredentialToken, setShowCredentialToken] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState("");
  const [credentialStatusError, setCredentialStatusError] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [removeCredentialOpen, setRemoveCredentialOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PersistedState | null>(null);
  const [assetTestName, setAssetTestName] = useState("StarBox-1.0.0-macos-arm64.dmg");
  const [draggedNav, setDraggedNav] = useState<NavigationPageId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = state.settings;
  const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
  const returnTo = readQueryParam("returnTo");
  const includeError = regexError(state.releaseSettings.assetIncludePattern);
  const excludeError = regexError(state.releaseSettings.assetExcludePattern);
  const assetTest = useMemo(() => {
    if (includeError || excludeError) return t("规则无效", "Invalid rule");
    const included = !state.releaseSettings.assetIncludePattern || new RegExp(state.releaseSettings.assetIncludePattern, "i").test(assetTestName);
    const excluded = Boolean(state.releaseSettings.assetExcludePattern && new RegExp(state.releaseSettings.assetExcludePattern, "i").test(assetTestName));
    return included && !excluded ? t("会显示", "Visible") : t("会隐藏", "Hidden");
  }, [assetTestName, state.releaseSettings.assetIncludePattern, state.releaseSettings.assetExcludePattern, includeError, excludeError, t]);

  useEffect(() => { replaceQueryParams({ tab: tab === "account" ? "" : tab }); }, [tab]);
  useEffect(() => {
    void fetchGithubCredential().then((credential) => {
      onStateChange({ ...state, settings: { ...settings, githubIdentity: credential.identity ?? settings.githubIdentity, credentialConnected: credential.connected } });
    }).catch(() => {});
  }, []);

  function returnAfterCredential() { if (returnTo) onNavigatePath(returnTo); }

  async function replaceCredential() {
    const token = credentialToken.trim();
    if (!token) { setCredentialStatus(t("请输入新的 GitHub Token", "Enter a new GitHub Token")); setCredentialStatusError(true); return; }
    setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      const credential = await replaceGithubCredential(token);
      onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } });
      setCredentialToken("");
      setCredentialStatus(t(`已连接 @${credential.identity.login}；Token 不会在页面回显`, `Connected @${credential.identity.login}; the Token will not be shown again`));
      notify(t("GitHub 已连接", "GitHub connected"), credential.identity.login, "success");
      returnAfterCredential();
    } catch (error) {
      try {
        const user = await validateGithubToken(token);
        onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } });
        setCredentialToken("");
        setCredentialStatus(t(`已连接 @${user.login}`, `Connected @${user.login}`));
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
      onStateChange({ ...state, settings: { ...settings, githubToken: "", githubIdentity: settings.githubIdentity, credentialConnected: false } });
      setCredentialStatus(t("GitHub Token 已移除，账户绑定仍会保留", "GitHub Token removed; account binding is preserved"));
      notify(t("GitHub Token 已移除", "GitHub Token removed"), t("账户绑定仍保留", "Account binding is preserved"), "success");
    } catch (error) {
      setCredentialStatus(error instanceof Error ? t(`${error.message}。请稍后重试。`, `${error.message}. Try again later.`) : t("移除凭据失败", "Failed to remove credentials"));
      setCredentialStatusError(true);
    } finally { setCredentialLoading(false); }
  }

  async function testGithub() {
    if (!hasGithubCredential) return;
    setGithubTesting(true); setGithubStatus(""); setGithubStatusError(false);
    try { const user = await validateGithubToken(settings.githubToken.trim()); setGithubStatus(t(`连接正常 · @${user.login}`, `Connected · @${user.login}`)); }
    catch (error) { setGithubStatus(error instanceof Error ? error.message : t("连接失败", "Connection failed")); setGithubStatusError(true); }
    finally { setGithubTesting(false); }
  }

  async function loadRateLimits() {
    if (!hasGithubCredential) return;
    setRateLoading(true);
    try { setRateLimits((await fetchGithubRateLimit(settings.githubToken.trim())).resources); }
    catch (error) { setGithubStatus(error instanceof Error ? error.message : t("API 配额读取失败", "Failed to load API quota")); setGithubStatusError(true); }
    finally { setRateLoading(false); }
  }

  function moveNav(index: number, delta: number) {
    const list = [...settings.navOrder];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    onStateChange({ ...state, settings: { ...settings, navOrder: list } });
  }

  function moveNavTo(source: NavigationPageId, target: NavigationPageId) {
    if (source === target) return;
    const list = [...settings.navOrder];
    const from = list.indexOf(source);
    const to = list.indexOf(target);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    onStateChange({ ...state, settings: { ...settings, navOrder: list } });
  }

  function toggleNav(id: NavigationPageId) {
    if (navMeta[id].required) return;
    const hidden = settings.hiddenNav.includes(id) ? settings.hiddenNav.filter((item) => item !== id) : [...settings.hiddenNav, id];
    onStateChange({ ...state, settings: { ...settings, hiddenNav: hidden } });
  }

  function updateReleaseSettings(patch: Partial<typeof state.releaseSettings>) {
    const next = { ...state.releaseSettings, ...patch }; onStateChange({ ...state, releaseSettings: next });
    if (patch.syncPages !== undefined || patch.assetIncludePattern !== undefined || patch.assetExcludePattern !== undefined) void saveReleasePreferences({ syncPages: next.syncPages, assetIncludePattern: next.assetIncludePattern, assetExcludePattern: next.assetExcludePattern }).catch(() => notify(t("Release 设置暂未同步", "Release settings have not synced yet"), t("稍后会继续使用当前设备上的设置", "This device will keep using the current settings for now"), "error"));
  }
  async function chooseImport(file: File) { try { setImportPreview(await importState(file)); setDataStatus(""); } catch (error) { setDataStatus(error instanceof Error ? error.message : t("导入失败", "Import failed")); } }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4"><h1 className="text-xl font-semibold tracking-tight">{t("设置", "Settings")}</h1></header>
      {session?.defaultCredentialsActive ? <Alert variant="error" className="mb-5"><AlertTitle>{t("生产凭据警告", "Production credential warning")}</AlertTitle><AlertDescription>{t("当前 Worker 正在使用默认登录凭据 admin / 000000，请立即配置生产账号与密码。", "The Worker is using the default admin / 000000 login. Configure production credentials immediately.")}</AlertDescription></Alert> : null}

      {initialLoading ? <FormSkeleton /> : (
        <Tabs value={tab} onValueChange={(value: SettingsTab) => setTab(value)}>
          <div className="sticky top-0 z-20 -mx-1 mb-1 overflow-x-auto bg-background/95 px-1 pt-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList variant="underline" className="w-max min-w-full justify-start border-b border-border/80">
              <TabsTab value="account">{t("账户与 GitHub", "Account & GitHub")}</TabsTab>
              <TabsTab value="ai">AI</TabsTab>
              <TabsTab value="categories">{t("分类", "Categories")}</TabsTab>
              <TabsTab value="appearance">{t("外观", "Appearance")}</TabsTab>
              <TabsTab value="navigation">{t("导航", "Navigation")}</TabsTab>
              <TabsTab value="data">{t("数据", "Data")}</TabsTab>
            </TabsList>
          </div>

          <TabsPanel value="account">
            <SettingsSection title={t("登录设备", "Login devices")} description={t("查看当前账户的登录设备、最近访问时间，并可单独退出设备。", "Review signed-in devices and recent activity, and sign out individual devices.")}>
              <LoginDevicesSettings username={session?.username} onCurrentRevoked={onLogout} onSignOut={onLogout} />
            </SettingsSection>

            <SettingsSection title="GitHub" description={t("连接 GitHub 后，可同步 Star、Release 和 Fork。", "Connect GitHub to sync Star, Release, and Fork data.")}>
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                {settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-9 rounded-lg" /> : <span className="grid size-9 place-items-center rounded-lg bg-secondary"><RiStarLine className="size-4" /></span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{settings.githubIdentity ? `@${settings.githubIdentity.login}` : t("尚未绑定 GitHub", "GitHub not connected")}</p><p className="mt-0.5 text-xs text-muted-foreground">{settings.credentialConnected ? t("已连接", "Connected") : settings.githubIdentity ? t("身份已绑定，当前未托管 Token", "Identity bound; Token is not currently stored") : t("连接后可同步 Stars、Release 与 Fork 数据", "Connect to sync Stars, Release, and Fork data")}</p></div>
                <span className={`size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden="true" />
              </div>

              <Field label="Personal Access Token" description={t("提交后不会在页面回显明文 Token。", "The plain Token will not be displayed after submission.")}>
                <InputGroup>
                  <InputGroupInput type={showCredentialToken ? "text" : "password"} autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} />
                  <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showCredentialToken ? t("隐藏 Token", "Hide Token") : t("显示 Token", "Show Token")} onClick={() => setShowCredentialToken((value) => !value)}>{showCredentialToken ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></InputGroupAddon>
                </InputGroup>
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void replaceCredential()} loading={credentialLoading} disabled={!credentialToken.trim()}>{t("连接 / 更换 Token", "Connect / replace Token")}</Button>
                <Button variant="outline" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}>{t("测试连接", "Test connection")}</Button>
                <Button variant="outline" onClick={() => void loadRateLimits()} loading={rateLoading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />{t("API 配额", "API quota")}</Button>
                <Button variant="ghost" onClick={() => setRemoveCredentialOpen(true)} disabled={!settings.githubToken && !settings.credentialConnected}>{t("移除 Token", "Remove Token")}</Button>
                {returnTo && hasGithubCredential ? <Button variant="ghost" onClick={returnAfterCredential}>{t("返回原流程", "Return")}</Button> : null}
              </div>

              {credentialStatus || githubStatus ? <Alert variant={credentialStatusError || githubStatusError ? "error" : "success"}><AlertDescription>{credentialStatus || githubStatus}</AlertDescription></Alert> : null}
              {rateLimits.length ? <div className="grid gap-2 sm:grid-cols-2">{rateLimits.map((item) => <div key={item.resource} className="rounded-lg border border-border/70 p-3 text-xs"><div className="font-medium">{item.resource}</div><div className="mt-1 text-muted-foreground">{t("剩余", "Remaining")} {item.remaining.toLocaleString(locale)} / {item.limit.toLocaleString(locale)}</div><div className="mt-1 text-muted-foreground">{t("重置时间", "Resets")} {new Date(item.resetAt).toLocaleString(locale)}</div></div>)}</div> : null}
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
            <SettingsSection title={t("语言", "Language")} description={t("选择 StarBox 的界面语言。此设置仅保存在当前设备。", "Choose the StarBox interface language. This preference is stored on this device.")}>
              <ToggleGroup value={[settings.language]} onValueChange={(values) => { const value = values.at(-1); if (value === "zh-CN" || value === "en") onStateChange({ ...state, settings: { ...settings, language: value } }); }}>
                <ToggleGroupItem value="zh-CN" className="w-auto px-4">中文</ToggleGroupItem>
                <ToggleGroupItem value="en" className="w-auto px-4">English</ToggleGroupItem>
              </ToggleGroup>
            </SettingsSection>
            <SettingsSection title={t("主题", "Theme")} description={t("选择 StarBox 的显示模式。修改会立即生效。", "Choose how StarBox looks. Changes apply immediately.")}>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t("主题", "Theme")}>
                {(["system", "light", "dark"] as const).map((mode) => <Button key={mode} variant="ghost" size="none" role="radio" aria-checked={settings.theme === mode} onClick={() => onStateChange({ ...state, settings: { ...settings, theme: mode } })} className={`block rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`}><div className={`mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`}><span className={`border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}`} /><span className="p-2"><span className={`block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`} /><span className={`mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`} /></span></div><span className="text-sm font-medium">{mode === "system" ? t("跟随系统", "System") : mode === "light" ? t("浅色", "Light") : t("深色", "Dark")}</span></Button>)}
              </div>
            </SettingsSection>
            <SettingsSection title={t("强调色", "Accent color")} description={t("用于选中状态、关键操作和焦点提示。", "Used for selected states, key actions, and focus indicators.")}>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t("强调色", "Accent color")}>{accentOptions.map((option) => <Button key={option.value} variant="ghost" size="none" role="radio" aria-checked={settings.accent === option.value} onClick={() => onStateChange({ ...state, settings: { ...settings, accent: option.value } })} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border"}`}><span className={`size-4 rounded-full ${option.swatch}`} /><span>{t(option.label, option.en)}</span>{settings.accent === option.value ? <RiCheckLine className="size-4" /> : null}</Button>)}</div>
            </SettingsSection>
            <SettingsSection title={t("界面密度", "Interface density")} description={t("舒适模式增加留白；紧凑模式在同一屏幕展示更多内容。", "Comfortable adds spacing; Compact shows more content on screen.")}>
              <ToggleGroup value={[settings.density]} onValueChange={(values) => { const value = values.at(-1); if (value === "comfortable" || value === "compact") onStateChange({ ...state, settings: { ...settings, density: value } }); }}><ToggleGroupItem value="comfortable" className="w-auto px-4">{t("舒适", "Comfortable")}</ToggleGroupItem><ToggleGroupItem value="compact" className="w-auto px-4">{t("紧凑", "Compact")}</ToggleGroupItem></ToggleGroup>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="navigation">
            <SettingsSection title={t("侧边栏", "Sidebar")} description={t("拖动项目调整顺序；Star 与设置为固定入口。聚焦拖动手柄后可用 Alt + ↑ / ↓ 调整。", "Drag items to reorder them. Star and Settings are fixed. With the drag handle focused, use Alt + ↑ / ↓ to move items.")}>
              <div className="overflow-hidden rounded-xl border border-border/70">
                {settings.navOrder.map((id, index) => {
                  const item = navMeta[id]; const Icon = item.icon; const hidden = settings.hiddenNav.includes(id);
                  return <div key={id} draggable onDragStart={() => setDraggedNav(id)} onDragEnd={() => setDraggedNav(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedNav) moveNavTo(draggedNav, id); setDraggedNav(null); }} className={`flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0 ${draggedNav === id ? "bg-accent/50" : "bg-background"}`}><Button variant="ghost" size="none" className="cursor-grab rounded px-1 text-muted-foreground active:cursor-grabbing" aria-label={t(`拖动 ${item.label} 调整顺序`, `Reorder ${item.en || item.label}`)} onKeyDown={(event) => { if (!event.altKey) return; if (event.key === "ArrowUp") { event.preventDefault(); moveNav(index, -1); } else if (event.key === "ArrowDown") { event.preventDefault(); moveNav(index, 1); } }}>⠿</Button><Icon className="size-4 text-muted-foreground" /><span className="flex-1 text-sm font-medium">{t(item.label, item.en || item.label)}</span>{item.required ? <span className="text-xs text-muted-foreground">{t("始终显示", "Always shown")}</span> : <Switch checked={!hidden} onCheckedChange={() => toggleNav(id)} aria-label={t(`${hidden ? "显示" : "隐藏"} ${item.label}`, `${hidden ? "Show" : "Hide"} ${item.en || item.label}`)} />}</div>;
                })}
              </div>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="data">
            <SettingsSection title={t("Release 更新", "Release updates")} description={t("设置 Release 的获取范围和文件筛选规则。", "Configure Release fetch scope and asset filename filters.")}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("获取范围", "Fetch scope")}><Select value={String(state.releaseSettings.syncPages)} onChange={(event) => updateReleaseSettings({ syncPages: Number(event.target.value) })}><option value="1">{t("最近 1 页", "Latest 1 page")}</option><option value="3">{t("最近 3 页", "Latest 3 pages")}</option><option value="5">{t("最近 5 页", "Latest 5 pages")}</option></Select></Field>
                <Field label={t("每页数量", "Items per page")}><Select value={String(state.releaseSettings.pageSize)} onChange={(event) => updateReleaseSettings({ pageSize: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></Select></Field>
                <Field label={t("包含文件名规则", "Include filename pattern")} error={includeError}><Input value={state.releaseSettings.assetIncludePattern} onChange={(event) => updateReleaseSettings({ assetIncludePattern: event.target.value })} /></Field>
                <Field label={t("排除文件名规则", "Exclude filename pattern")} error={excludeError}><Input value={state.releaseSettings.assetExcludePattern} onChange={(event) => updateReleaseSettings({ assetExcludePattern: event.target.value })} /></Field>
              </div>
              <Field label={t("测试规则", "Test rule")}><Input value={assetTestName} onChange={(event) => setAssetTestName(event.target.value)} /><span className={`text-xs ${(assetTest === "会显示" || assetTest === "Visible") ? "text-success-foreground" : "text-muted-foreground"}`}>{assetTest}</span></Field>
            </SettingsSection>
            <SettingsSection title={t("备份与导入", "Backup & import")} description={t("导入前会先显示预览。导出的文件不会包含登录凭据和 AI 密钥。", "A preview is shown before import. Exported files do not include login credentials or AI secrets.")}>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportState(state)}><RiDownload2Line className="size-4" />{t("导出数据", "Export data")}</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><RiUpload2Line className="size-4" />{t("选择导入文件", "Choose import file")}</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImport(file); event.currentTarget.value = ""; }} /></div>
              {dataStatus ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RiCheckLine className="size-4" />{dataStatus}</p> : null}
            </SettingsSection>
            <SettingsSection title={t("危险区域", "Danger zone")} description={t("只清除此设备上的 StarBox 数据，不会删除云端数据。", "Only clears StarBox data on this device; cloud data is not deleted.")} danger>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-4 py-3"><div><p className="text-sm font-medium">{t("清除此设备的数据", "Clear this device data")}</p><p className="mt-1 text-xs text-muted-foreground">{t("重新登录后仍可从云端恢复已同步的数据。", "Synced data can be restored from the cloud after signing in again.")}</p></div><Button variant="destructive" onClick={() => setClearOpen(true)}>{t("清空本地数据", "Clear local data")}</Button></div>
            </SettingsSection>
          </TabsPanel>
        </Tabs>
      )}

      <AlertDialog open={removeCredentialOpen} onOpenChange={setRemoveCredentialOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("移除 GitHub Token？", "Remove GitHub Token?")}</AlertDialogTitle><AlertDialogDescription>{t("只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。", "This only removes the encrypted credential stored by the Worker. The bound GitHub numeric identity is preserved, so only the same GitHub identity can be reconnected later.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => void removeCredential()}>{t("移除 Token", "Remove Token")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("清除此设备的数据？", "Clear data on this device?")}</AlertDialogTitle><AlertDialogDescription>{t("此操作只清除当前设备的数据，不会删除云端内容。重新登录后可恢复已同步的数据。", "This only clears data on the current device and does not delete cloud content. Synced data can be restored after signing in again.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" onClick={() => { clearState(); onStateChange(createInitialState()); setClearOpen(false); setDataStatus(t("此设备的数据已清除", "Data on this device was cleared")); }}>{t("清空本地数据", "Clear local data")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <Modal open={Boolean(importPreview)} title={t("导入预览", "Import preview")} description={t("确认后将替换当前浏览器状态，不会修改导出文件本身。", "Confirming will replace the current browser state without modifying the import file.")} onClose={() => setImportPreview(null)}>{importPreview ? <div className="grid gap-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("仓库", "Repositories")}</div><div className="mt-1 font-semibold">{importPreview.repositories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("分类", "Categories")}</div><div className="mt-1 font-semibold">{importPreview.categories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">{t("Release 订阅", "Release subscriptions")}</div><div className="mt-1 font-semibold">{importPreview.releaseSubscriptions.length}</div></div></div><Alert variant="warning"><AlertDescription>{t("确认导入后会替换当前浏览器状态；云端数据不会在此步骤被删除。", "Importing replaces the current browser state; cloud data is not deleted in this step.")}</AlertDescription></Alert><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setImportPreview(null)}>{t("取消", "Cancel")}</Button><Button onClick={() => { onStateChange(importPreview); setImportPreview(null); setDataStatus(t("导入成功", "Import successful")); notify(t("导入完成", "Import complete"), t("当前浏览器状态已替换", "Current browser state was replaced"), "success"); }}>{t("确认导入", "Import")}</Button></div></div> : null}</Modal>
    </div>
  );
}
