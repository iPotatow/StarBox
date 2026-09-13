import {
  RiCheckLine,
  RiDownload2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiFolder3Line,
  RiGitForkLine,
  RiKey2Line,
  RiNotification2Line,
  RiPriceTag3Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiShieldCheckLine,
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
import { Textarea } from "../../components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { notify } from "../../components/ui/toast";
import { CategorySettingsPanel } from "../repositories/category-manager";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, testAiProvider, validateGithubToken } from "../../lib/api";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage";
import { readQueryParam, replaceQueryParams } from "../../lib/url-state";
import type { AiSettings, AuthSession, GithubRateLimit, NavigationPageId, PersistedState } from "../../types";

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

const navMeta: Record<NavigationPageId, { label: string; icon: typeof RiStarLine; required?: boolean }> = {
  repositories: { label: "Star", icon: RiStarLine, required: true },
  releases: { label: "Release", icon: RiPriceTag3Line },
  forks: { label: "Fork", icon: RiGitForkLine },
  lists: { label: "Lists", icon: RiFolder3Line },
  discover: { label: "Discover", icon: RiSearchLine },
  notifications: { label: "通知", icon: RiNotification2Line },
  settings: { label: "设置", icon: RiSettings4Line, required: true },
};

const accentOptions = [
  { value: "neutral" as const, label: "中性", swatch: "bg-neutral-700 dark:bg-neutral-300" },
  { value: "blue" as const, label: "蓝色", swatch: "bg-blue-500" },
  { value: "violet" as const, label: "紫色", swatch: "bg-violet-500" },
  { value: "emerald" as const, label: "翠绿", swatch: "bg-emerald-500" },
];

function regexError(value: string) {
  if (!value.trim()) return "";
  try { new RegExp(value, "i"); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "正则无效"; }
}

function parseHeaders(raw: string): { headers: Record<string, string>; error: string } {
  try {
    const parsed = raw.trim() ? JSON.parse(raw) as unknown : {};
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Headers 必须是 JSON 对象");
    return { headers: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])), error: "" };
  } catch (reason) {
    return { headers: {}, error: reason instanceof Error ? reason.message : "Headers JSON 无效" };
  }
}

export function SettingsPage({ state, onStateChange, session, onLogout, onNavigatePath, initialLoading = false }: { state: PersistedState; onStateChange: (state: PersistedState) => void; session: AuthSession | null; onLogout: () => void; onNavigatePath: (path: string) => void; initialLoading?: boolean }) {
  const [tab, setTab] = useState<SettingsTab>(tabFromQuery);
  const [githubStatus, setGithubStatus] = useState("");
  const [githubStatusError, setGithubStatusError] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [rateLimits, setRateLimits] = useState<GithubRateLimit[]>([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiStatusError, setAiStatusError] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiSettings>(() => ({ ...state.settings.ai, headers: { ...state.settings.ai.headers } }));
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
  const [importPreview, setImportPreview] = useState<PersistedState | null>(null);
  const [assetTestName, setAssetTestName] = useState("StarBox-1.0.0-macos-arm64.dmg");
  const [draggedNav, setDraggedNav] = useState<NavigationPageId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = state.settings;
  const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
  const returnTo = readQueryParam("returnTo");
  const includeError = regexError(state.releaseSettings.assetIncludePattern);
  const excludeError = regexError(state.releaseSettings.assetExcludePattern);
  const parsedHeaders = useMemo(() => parseHeaders(headersText), [headersText]);
  const normalizedAiDraft = useMemo(() => ({ ...aiDraft, headers: parsedHeaders.headers }), [aiDraft, parsedHeaders.headers]);
  const aiDirty = useMemo(() => JSON.stringify(normalizedAiDraft) !== JSON.stringify(settings.ai), [normalizedAiDraft, settings.ai]);
  const assetTest = useMemo(() => {
    if (includeError || excludeError) return "规则无效";
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
    }).catch(() => {});
  }, []);

  function returnAfterCredential() { if (returnTo) onNavigatePath(returnTo); }

  async function replaceCredential() {
    const token = credentialToken.trim();
    if (!token) { setCredentialStatus("请输入新的 GitHub Token"); setCredentialStatusError(true); return; }
    setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      const credential = await replaceGithubCredential(token);
      onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } });
      setCredentialToken("");
      setCredentialStatus(`已连接 @${credential.identity.login}；Token 不会在页面回显`);
      notify("GitHub 已连接", credential.identity.login, "success");
      returnAfterCredential();
    } catch (error) {
      try {
        const user = await validateGithubToken(token);
        onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } });
        setCredentialToken("");
        setCredentialStatus(`当前 Worker 使用兼容模式连接 @${user.login}`);
        returnAfterCredential();
      } catch (fallbackError) {
        setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "凭据连接失败");
        setCredentialStatusError(true);
      }
    } finally { setCredentialLoading(false); }
  }

  async function removeCredential() {
    setRemoveCredentialOpen(false); setCredentialLoading(true); setCredentialStatus(""); setCredentialStatusError(false);
    try {
      await removeGithubCredential();
      onStateChange({ ...state, settings: { ...settings, githubToken: "", githubIdentity: settings.githubIdentity, credentialConnected: false } });
      setCredentialStatus("已移除加密 GitHub Token；GitHub identity binding 保留");
      notify("GitHub Token 已移除", "身份绑定仍保留", "success");
    } catch (error) {
      setCredentialStatus(error instanceof Error ? `${error.message}。请确认 Worker 已升级后重试。` : "移除凭据失败");
      setCredentialStatusError(true);
    } finally { setCredentialLoading(false); }
  }

  async function testGithub() {
    if (!hasGithubCredential) return;
    setGithubTesting(true); setGithubStatus(""); setGithubStatusError(false);
    try { const user = await validateGithubToken(settings.githubToken.trim()); setGithubStatus(`连接正常 · @${user.login}`); }
    catch (error) { setGithubStatus(error instanceof Error ? error.message : "连接失败"); setGithubStatusError(true); }
    finally { setGithubTesting(false); }
  }

  async function loadRateLimits() {
    if (!hasGithubCredential) return;
    setRateLoading(true);
    try { setRateLimits((await fetchGithubRateLimit(settings.githubToken.trim())).resources); }
    catch (error) { setGithubStatus(error instanceof Error ? error.message : "API 配额读取失败"); setGithubStatusError(true); }
    finally { setRateLoading(false); }
  }

  function updateHeaders(raw: string) {
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
    if (result.error) { setHeadersError(result.error); return; }
    setAiSaving(true);
    const nextAi = { ...aiDraft, headers: result.headers };
    onStateChange({ ...state, settings: { ...settings, ai: nextAi } });
    setAiDraft(nextAi);
    setAiSaving(false);
    notify("AI 配置已保存", nextAi.model || nextAi.providerName, "success");
  }

  async function testAi() {
    const result = parseHeaders(headersText);
    if (result.error) { setHeadersError(result.error); setAiStatus(result.error); setAiStatusError(true); return; }
    const candidate = { ...aiDraft, headers: result.headers };
    setAiTesting(true); setAiStatus(""); setAiStatusError(false);
    try { setAiStatus(await testAiProvider(candidate)); }
    catch (error) { setAiStatus(error instanceof Error ? error.message : "连接失败"); setAiStatusError(true); }
    finally { setAiTesting(false); }
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

  function updateReleaseSettings(patch: Partial<typeof state.releaseSettings>) { onStateChange({ ...state, releaseSettings: { ...state.releaseSettings, ...patch } }); }
  async function chooseImport(file: File) { try { setImportPreview(await importState(file)); setDataStatus(""); } catch (error) { setDataStatus(error instanceof Error ? error.message : "导入失败"); } }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4"><h1 className="text-xl font-semibold tracking-tight">设置</h1></header>
      {session?.defaultCredentialsActive ? <Alert variant="error" className="mb-5"><AlertTitle>生产凭据警告</AlertTitle><AlertDescription>当前 Worker 正在使用默认登录凭据 admin / 000000，请立即配置生产账号与密码。</AlertDescription></Alert> : null}

      {initialLoading ? <FormSkeleton /> : (
        <Tabs value={tab} onValueChange={(value: SettingsTab) => setTab(value)}>
          <div className="sticky top-0 z-20 -mx-1 mb-1 overflow-x-auto bg-background/95 px-1 pt-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList variant="underline" className="w-max min-w-full justify-start border-b border-border/80">
              <TabsTab value="account">账户与 GitHub</TabsTab>
              <TabsTab value="ai">AI</TabsTab>
              <TabsTab value="categories">分类</TabsTab>
              <TabsTab value="appearance">外观</TabsTab>
              <TabsTab value="navigation">导航</TabsTab>
              <TabsTab value="data">数据</TabsTab>
            </TabsList>
          </div>

          <TabsPanel value="account">
            <SettingsSection title="登录会话" description="StarBox 登录由 Worker 会话保护，Cookie 不暴露给前端脚本。">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-secondary"><RiShieldCheckLine className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{session?.username || "已登录"}</p><p className="mt-0.5 text-xs text-muted-foreground">当前设备会话有效</p></div>
                <Button variant="outline" onClick={onLogout}>退出登录</Button>
              </div>
            </SettingsSection>

            <SettingsSection title="GitHub" description="凭据由 Worker 管理并可跨设备复用；移除 Token 不解除 GitHub numeric identity binding。">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
                {settings.githubIdentity?.avatarUrl ? <img src={settings.githubIdentity.avatarUrl} alt="" className="size-9 rounded-lg" /> : <span className="grid size-9 place-items-center rounded-lg bg-secondary"><RiStarLine className="size-4" /></span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{settings.githubIdentity ? `@${settings.githubIdentity.login}` : "尚未绑定 GitHub"}</p><p className="mt-0.5 text-xs text-muted-foreground">{settings.credentialConnected ? "Connected · Token 由 Worker 加密托管" : settings.githubIdentity ? "身份已绑定，当前未托管 Token" : "连接后可同步 Stars、Release 与 Fork 数据"}</p></div>
                <span className={`size-2 rounded-full ${settings.credentialConnected ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden="true" />
              </div>

              <Field label="Personal Access Token" description="提交后不会在页面回显明文 Token。">
                <InputGroup>
                  <InputGroupInput type={showCredentialToken ? "text" : "password"} autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} />
                  <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showCredentialToken ? "隐藏 Token" : "显示 Token"} onClick={() => setShowCredentialToken((value) => !value)}>{showCredentialToken ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></InputGroupAddon>
                </InputGroup>
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void replaceCredential()} loading={credentialLoading} disabled={!credentialToken.trim()}>连接 / 更换 Token</Button>
                <Button variant="outline" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}>测试连接</Button>
                <Button variant="outline" onClick={() => void loadRateLimits()} loading={rateLoading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />API 配额</Button>
                <Button variant="ghost" onClick={() => setRemoveCredentialOpen(true)} disabled={!settings.githubToken && !settings.credentialConnected}>移除 Token</Button>
                {returnTo && hasGithubCredential ? <Button variant="ghost" onClick={returnAfterCredential}>返回原流程</Button> : null}
              </div>

              {credentialStatus || githubStatus ? <Alert variant={credentialStatusError || githubStatusError ? "error" : "success"}><AlertDescription>{credentialStatus || githubStatus}</AlertDescription></Alert> : null}
              {rateLimits.length ? <div className="grid gap-2 sm:grid-cols-2">{rateLimits.map((item) => <div key={item.resource} className="rounded-lg border border-border/70 p-3 text-xs"><div className="font-medium">{item.resource}</div><div className="mt-1 text-muted-foreground">剩余 {item.remaining.toLocaleString()} / {item.limit.toLocaleString()}</div><div className="mt-1 text-muted-foreground">重置时间 {new Date(item.resetAt).toLocaleString("zh-CN")}</div></div>)}</div> : null}
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="ai">
            <SettingsSection title="AI Provider" description="使用自定义 HTTP Provider。API Key 和自定义 Headers 仅保存在当前浏览器，不同步到 D1。">
              <Field label="Provider 名称"><Input value={aiDraft.providerName} onChange={(event) => setAiDraft((current) => ({ ...current, providerName: event.target.value }))} /></Field>
              <Field label="Base URL"><Input inputMode="url" value={aiDraft.baseUrl} onChange={(event) => setAiDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
              <Field label="Model"><Input value={aiDraft.model} onChange={(event) => setAiDraft((current) => ({ ...current, model: event.target.value }))} /></Field>
              <Field label="API Key">
                <InputGroup>
                  <InputGroupInput type={showAiKey ? "text" : "password"} autoComplete="off" value={aiDraft.apiKey} onChange={(event) => setAiDraft((current) => ({ ...current, apiKey: event.target.value }))} />
                  <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={showAiKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowAiKey((value) => !value)}>{showAiKey ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></InputGroupAddon>
                </InputGroup>
              </Field>
              <details className="rounded-xl border border-border/70 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">Advanced · Headers JSON</summary>
                <div className="mt-4"><Field label="Headers JSON" error={headersError}><Textarea value={headersText} onChange={(event) => updateHeaders(event.target.value)} spellCheck={false} className="min-h-32 font-mono text-xs" /></Field></div>
              </details>
              <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void testAi()} loading={aiTesting} disabled={!aiDraft.baseUrl || !aiDraft.apiKey || !aiDraft.model || Boolean(headersError)}><RiKey2Line className="size-4" />测试连接</Button>{aiStatus ? <Alert className="flex-1" variant={aiStatusError ? "error" : "success"}><AlertDescription>{aiStatus}</AlertDescription></Alert> : null}</div>
              {aiDirty ? <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-popover/95 px-4 py-3 shadow-lg/10 backdrop-blur"><span className="text-sm">有未保存的 AI 配置修改</span><div className="flex gap-2"><Button variant="ghost" onClick={resetAiDraft}>重置</Button><Button loading={aiSaving} onClick={saveAi}>保存配置</Button></div></div> : null}
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="categories">
            <SettingsSection title="分类" description="管理 Stars 的自定义分类；锁定分类不会被 AI 自动改写。">
              <CategorySettingsPanel state={state} onStateChange={onStateChange} />
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="appearance">
            <SettingsSection title="主题" description="选择 StarBox 的显示模式。修改会立即生效。">
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="主题">
                {(["system", "light", "dark"] as const).map((mode) => <Button key={mode} variant="ghost" size="none" role="radio" aria-checked={settings.theme === mode} onClick={() => onStateChange({ ...state, settings: { ...settings, theme: mode } })} className={`block rounded-xl border p-3 text-left transition-colors ${settings.theme === mode ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-accent/40"}`}><div className={`mb-3 grid h-20 grid-cols-[22px_1fr] overflow-hidden rounded-lg border ${mode === "dark" ? "border-white/10 bg-neutral-950" : mode === "light" ? "bg-white" : "bg-gradient-to-br from-white to-neutral-900"}`}><span className={`border-r ${mode === "dark" ? "border-white/10 bg-neutral-900" : "border-black/10 bg-neutral-100"}`} /><span className="p-2"><span className={`block h-2 w-12 rounded ${mode === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`} /><span className={`mt-2 block h-7 rounded ${mode === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`} /></span></div><span className="text-sm font-medium">{mode === "system" ? "跟随系统" : mode === "light" ? "浅色" : "深色"}</span></Button>)}
              </div>
            </SettingsSection>
            <SettingsSection title="强调色" description="用于选中状态、关键操作和焦点提示。">
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="强调色">{accentOptions.map((option) => <Button key={option.value} variant="ghost" size="none" role="radio" aria-checked={settings.accent === option.value} onClick={() => onStateChange({ ...state, settings: { ...settings, accent: option.value } })} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${settings.accent === option.value ? "border-primary bg-accent/40" : "border-border"}`}><span className={`size-4 rounded-full ${option.swatch}`} /><span>{option.label}</span>{settings.accent === option.value ? <RiCheckLine className="size-4" /> : null}</Button>)}</div>
            </SettingsSection>
            <SettingsSection title="界面密度" description="舒适模式增加留白；紧凑模式在同一屏幕展示更多内容。">
              <ToggleGroup value={[settings.density]} onValueChange={(values) => { const value = values.at(-1); if (value === "comfortable" || value === "compact") onStateChange({ ...state, settings: { ...settings, density: value } }); }}><ToggleGroupItem value="comfortable" className="w-auto px-4">舒适</ToggleGroupItem><ToggleGroupItem value="compact" className="w-auto px-4">紧凑</ToggleGroupItem></ToggleGroup>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="navigation">
            <SettingsSection title="侧边栏" description="拖动项目调整顺序；Star 与设置为固定入口。聚焦拖动手柄后可用 Alt + ↑ / ↓ 调整。">
              <div className="overflow-hidden rounded-xl border border-border/70">
                {settings.navOrder.map((id, index) => {
                  const item = navMeta[id]; const Icon = item.icon; const hidden = settings.hiddenNav.includes(id);
                  return <div key={id} draggable onDragStart={() => setDraggedNav(id)} onDragEnd={() => setDraggedNav(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedNav) moveNavTo(draggedNav, id); setDraggedNav(null); }} className={`flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0 ${draggedNav === id ? "bg-accent/50" : "bg-background"}`}><Button variant="ghost" size="none" className="cursor-grab rounded px-1 text-muted-foreground active:cursor-grabbing" aria-label={`拖动 ${item.label} 调整顺序`} onKeyDown={(event) => { if (!event.altKey) return; if (event.key === "ArrowUp") { event.preventDefault(); moveNav(index, -1); } else if (event.key === "ArrowDown") { event.preventDefault(); moveNav(index, 1); } }}>⠿</Button><Icon className="size-4 text-muted-foreground" /><span className="flex-1 text-sm font-medium">{item.label}</span>{item.required ? <span className="text-xs text-muted-foreground">始终显示</span> : <Switch checked={!hidden} onCheckedChange={() => toggleNav(id)} aria-label={`${hidden ? "显示" : "隐藏"} ${item.label}`} />}</div>;
                })}
              </div>
            </SettingsSection>
          </TabsPanel>

          <TabsPanel value="data">
            <SettingsSection title="Release 同步" description="Release 页面只消费 Stars 中的订阅；同步深度与 Asset Regex 在这里配置。">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="同步深度"><Select value={String(state.releaseSettings.syncPages)} onChange={(event) => updateReleaseSettings({ syncPages: Number(event.target.value) })}><option value="1">1 页 / 仓库</option><option value="3">3 页 / 仓库</option><option value="5">5 页 / 仓库</option></Select></Field>
                <Field label="每页数量"><Select value={String(state.releaseSettings.pageSize)} onChange={(event) => updateReleaseSettings({ pageSize: Number(event.target.value) })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></Select></Field>
                <Field label="Asset include Regex" error={includeError}><Input value={state.releaseSettings.assetIncludePattern} onChange={(event) => updateReleaseSettings({ assetIncludePattern: event.target.value })} /></Field>
                <Field label="Asset exclude Regex" error={excludeError}><Input value={state.releaseSettings.assetExcludePattern} onChange={(event) => updateReleaseSettings({ assetExcludePattern: event.target.value })} /></Field>
              </div>
              <Field label="测试文件名"><Input value={assetTestName} onChange={(event) => setAssetTestName(event.target.value)} /><span className={`text-xs ${assetTest === "会显示" ? "text-success-foreground" : "text-muted-foreground"}`}>{assetTest}</span></Field>
            </SettingsSection>
            <SettingsSection title="备份与导入" description="导入会先预览，确认后才替换当前浏览器状态。导出会移除 GitHub Token、AI API Key 与敏感 Headers。">
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportState(state)}><RiDownload2Line className="size-4" />导出数据</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><RiUpload2Line className="size-4" />选择导入文件</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImport(file); event.currentTarget.value = ""; }} /></div>
              {dataStatus ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RiCheckLine className="size-4" />{dataStatus}</p> : null}
            </SettingsSection>
            <SettingsSection title="危险区域" description="只清空当前浏览器的 localStorage 与 IndexedDB 缓存，不会删除 D1 云端数据。" danger>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-4 py-3"><div><p className="text-sm font-medium">重置本地 StarBox</p><p className="mt-1 text-xs text-muted-foreground">重新登录或同步后仍可从云端恢复权威状态。</p></div><Button variant="destructive" onClick={() => setClearOpen(true)}>清空本地数据</Button></div>
            </SettingsSection>
          </TabsPanel>
        </Tabs>
      )}

      <AlertDialog open={removeCredentialOpen} onOpenChange={setRemoveCredentialOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>移除 GitHub Token？</AlertDialogTitle><AlertDialogDescription>只会删除 Worker 中保存的加密凭据。已绑定的 GitHub numeric identity 会继续保留，后续只能重新连接同一 GitHub 身份。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" onClick={() => void removeCredential()}>移除 Token</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>清空当前浏览器数据？</AlertDialogTitle><AlertDialogDescription>会清除 localStorage 与 IndexedDB 缓存，但不会删除 D1 云端数据。重新登录/同步后云端状态仍可恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>取消</AlertDialogClose><Button variant="destructive" onClick={() => { clearState(); onStateChange(createInitialState()); setClearOpen(false); setDataStatus("本地数据已清空；D1 未删除"); }}>清空本地数据</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
      <Modal open={Boolean(importPreview)} title="导入预览" description="确认后将替换当前浏览器状态，不会修改导出文件本身。" onClose={() => setImportPreview(null)}>{importPreview ? <div className="grid gap-4"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">仓库</div><div className="mt-1 font-semibold">{importPreview.repositories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">分类</div><div className="mt-1 font-semibold">{importPreview.categories.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">Release 订阅</div><div className="mt-1 font-semibold">{importPreview.releaseSubscriptions.length}</div></div><div className="rounded-lg bg-secondary/50 p-3"><div className="text-xs text-muted-foreground">GitHub Lists</div><div className="mt-1 font-semibold">{importPreview.githubLists.length}</div></div></div><Alert variant="warning"><AlertDescription>确认导入后会替换当前浏览器状态；D1 权威数据不会在此步骤被删除。</AlertDescription></Alert><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setImportPreview(null)}>取消</Button><Button onClick={() => { onStateChange(importPreview); setImportPreview(null); setDataStatus("导入成功"); notify("导入完成", "当前浏览器状态已替换", "success"); }}>确认导入</Button></div></div> : null}</Modal>
    </div>
  );
}
