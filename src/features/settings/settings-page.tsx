import {
  RiCheckLine,
  RiDatabase2Line,
  RiDownload2Line,
  RiFolder3Line,
  RiGitForkLine,
  RiGithubFill,
  RiKey2Line,
  RiMoonLine,
  RiPriceTag3Line,
  RiRefreshLine,
  RiRobot2Line,
  RiSearchLine,
  RiSettings4Line,
  RiShieldCheckLine,
  RiStarLine,
  RiSunLine,
  RiUpload2Line,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select } from "../../components/ui/select";
import { fetchGithubCredential, fetchGithubRateLimit, removeGithubCredential, replaceGithubCredential, testAiProvider, validateGithubToken } from "../../lib/api";
import { clearState, createInitialState, exportState, importState } from "../../lib/storage";
import type { AuthSession, GithubRateLimit, NavigationPageId, PersistedState } from "../../types";

function Section({ icon: Icon, title, description, children }: { icon: typeof RiGithubFill; title: string; description: string; children: ReactNode }) {
  return <section className="grid gap-5 border-b border-border py-7 lg:grid-cols-[220px_minmax(0,1fr)]"><div><div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" />{title}</div><p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p></div><div className="grid max-w-2xl gap-4">{children}</div></section>;
}

const navMeta: Record<NavigationPageId, { label: string; icon: typeof RiStarLine; required?: boolean }> = {
  repositories: { label: "Stars", icon: RiStarLine, required: true }, releases: { label: "Release", icon: RiPriceTag3Line }, forks: { label: "Fork", icon: RiGitForkLine }, lists: { label: "Lists", icon: RiFolder3Line }, discover: { label: "Discover", icon: RiSearchLine }, activity: { label: "Activity", icon: RiDatabase2Line }, notifications: { label: "通知", icon: RiDatabase2Line }, settings: { label: "设置", icon: RiSettings4Line, required: true },
};

export function SettingsPage({ state, onStateChange, session, onLogout }: { state: PersistedState; onStateChange: (state: PersistedState) => void; session: AuthSession | null; onLogout: () => void }) {
  const [githubStatus, setGithubStatus] = useState("");
  const [githubTesting, setGithubTesting] = useState(false);
  const [rateLimits, setRateLimits] = useState<GithubRateLimit[]>([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [dataStatus, setDataStatus] = useState("");
  const [headersText, setHeadersText] = useState(() => JSON.stringify(state.settings.ai.headers, null, 2));
  const [headersError, setHeadersError] = useState("");
  const [credentialToken, setCredentialToken] = useState("");
  const [credentialStatus, setCredentialStatus] = useState("");
  const [credentialLoading, setCredentialLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const settings = state.settings;
  const hasGithubCredential = Boolean(settings.githubToken.trim() || settings.credentialConnected);
  useEffect(() => setHeadersText(JSON.stringify(settings.ai.headers, null, 2)), [settings.ai.headers]);
  useEffect(() => { void Promise.resolve().then(() => fetchGithubCredential()).then((credential) => onStateChange({ ...state, settings: { ...settings, githubIdentity: credential.identity, credentialConnected: credential.connected } })).catch(() => { /* Older workers use the compatibility token input below. */ }); }, []);

  async function replaceCredential() { const token = credentialToken.trim(); if (!token) return setCredentialStatus("请输入新的 GitHub Token"); setCredentialLoading(true); setCredentialStatus(""); try { const credential = await replaceGithubCredential(token); onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: credential.identity, credentialConnected: credential.connected } }); setCredentialToken(""); setCredentialStatus(`已连接 @${credential.identity.login}；Token 不会在页面回显`); } catch (error) { try { const user = await validateGithubToken(token); onStateChange({ ...state, settings: { ...settings, githubToken: token, githubIdentity: { login: user.login, avatarUrl: user.avatarUrl }, credentialConnected: false } }); setCredentialToken(""); setCredentialStatus(`当前 Worker 尚未提供云端凭据接口，已使用兼容模式连接 @${user.login}；Token 不会写入本地存储`); } catch (fallbackError) { setCredentialStatus(fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "凭据连接失败"); } } finally { setCredentialLoading(false); } }
  async function removeCredential() { setCredentialLoading(true); setCredentialStatus(""); try { await removeGithubCredential(); onStateChange({ ...state, settings: { ...settings, githubToken: "", githubIdentity: null, credentialConnected: false } }); setCredentialStatus("已移除云端 GitHub 凭据"); } catch (error) { setCredentialStatus(error instanceof Error ? `${error.message}。请确认 Worker 已升级后重试。` : "移除凭据失败"); } finally { setCredentialLoading(false); } }
  async function testGithub() { if (!hasGithubCredential) return; setGithubTesting(true); setGithubStatus(""); try { const user = await validateGithubToken(settings.githubToken.trim()); setGithubStatus(`已连接 @${user.login}`); } catch (error) { setGithubStatus(error instanceof Error ? error.message : "连接失败"); } finally { setGithubTesting(false); } }
  async function loadRateLimits() { if (!hasGithubCredential) return; setRateLoading(true); try { const data = await fetchGithubRateLimit(settings.githubToken.trim()); setRateLimits(data.resources); } catch (error) { setGithubStatus(error instanceof Error ? error.message : "Rate Limit 读取失败"); } finally { setRateLoading(false); } }
  function updateHeaders(raw: string) { setHeadersText(raw); try { const parsed = raw.trim() ? JSON.parse(raw) as unknown : {}; if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Headers 必须是 JSON 对象"); const headers = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])); setHeadersError(""); onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, headers } } }); } catch (reason) { setHeadersError(reason instanceof Error ? reason.message : "Headers JSON 无效"); } }
  async function testAi() { if (headersError) return setAiStatus(headersError); setAiTesting(true); setAiStatus(""); try { setAiStatus(await testAiProvider(settings.ai)); } catch (error) { setAiStatus(error instanceof Error ? error.message : "连接失败"); } finally { setAiTesting(false); } }
  function moveNav(index: number, delta: number) { const list = [...settings.navOrder]; const target = index + delta; if (target < 0 || target >= list.length) return; [list[index], list[target]] = [list[target], list[index]]; onStateChange({ ...state, settings: { ...settings, navOrder: list } }); }
  function toggleNav(id: NavigationPageId) { if (navMeta[id].required) return; const hidden = settings.hiddenNav.includes(id) ? settings.hiddenNav.filter((item) => item !== id) : [...settings.hiddenNav, id]; onStateChange({ ...state, settings: { ...settings, hiddenNav: hidden } }); }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
      <header className="pb-5"><h1 className="text-xl font-semibold tracking-tight">设置</h1><p className="mt-1 text-sm text-muted-foreground">会话、云端凭据、IndexedDB 缓存、导航外观和自定义 HTTP Provider。</p></header>
      {session?.defaultCredentialsActive ? <div className="mb-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive-foreground" role="alert"><strong>Critical deployment warning：</strong>当前 Worker 正在使用默认登录凭据 admin / 000000，请立即配置生产账号与密码。</div> : null}
      <Section icon={RiShieldCheckLine} title="登录会话" description="StarBox 登录由 Worker 会话保护；Cookie 不暴露给前端脚本。"><div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/45 p-4"><RiShieldCheckLine className="size-5" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{session?.username || "已登录"}</p><p className="mt-1 text-xs text-muted-foreground">当前部署支持同一账号多设备会话。</p></div><Button variant="outline" onClick={onLogout}>退出登录</Button></div></Section>

      <Section icon={RiGithubFill} title="GitHub 凭据" description="Token 通过凭据 API 跨设备连接；页面不提供 reveal。旧 Worker 不支持凭据 API 时，兼容模式只保留当前运行时 Token。">
        <div className="rounded-xl bg-secondary/45 p-4"><p className="text-sm font-medium">{settings.githubIdentity ? `已连接 @${settings.githubIdentity.login}` : settings.githubToken ? "已连接当前运行时 Token" : "尚未连接 GitHub"}</p><p className="mt-1 text-xs text-muted-foreground">{settings.credentialConnected ? "凭据由 Worker 管理，Token 不会返回浏览器。" : "连接身份会显示，但现有 Token 不会回显。"}</p></div>
        <Field label="Replace Token" description="输入新 Token 后由 Worker 验证并替换，不会显示或导出已有 Token。"><Input type="password" autoComplete="off" value={credentialToken} placeholder="github_pat_…" onChange={(event) => setCredentialToken(event.target.value)} /></Field>
        <div className="flex flex-wrap items-center gap-3"><Button onClick={() => void replaceCredential()} loading={credentialLoading} disabled={!credentialToken.trim()}><RiShieldCheckLine className="size-4" />连接 / 替换 Token</Button><Button variant="outline" onClick={() => void removeCredential()} loading={credentialLoading} disabled={!settings.githubIdentity && !settings.githubToken && !settings.credentialConnected}><RiCheckLine className="size-4" />Remove Token</Button><Button variant="outline" onClick={() => void testGithub()} loading={githubTesting} disabled={!hasGithubCredential}><RiShieldCheckLine className="size-4" />测试兼容连接</Button><Button variant="outline" onClick={() => void loadRateLimits()} loading={rateLoading} disabled={!hasGithubCredential}><RiRefreshLine className="size-4" />API 配额</Button></div>
        {credentialStatus || githubStatus ? <p className="text-xs text-muted-foreground">{credentialStatus || githubStatus}</p> : null}
        {rateLimits.length ? <div className="grid gap-2 sm:grid-cols-2">{rateLimits.map((item) => <div key={item.resource} className="rounded-lg border border-border p-3 text-xs"><div className="font-medium">{item.resource}</div><div className="mt-1 text-muted-foreground">{item.remaining.toLocaleString()} / {item.limit.toLocaleString()} remaining</div><div className="mt-1 text-muted-foreground">Reset {new Date(item.resetAt).toLocaleString("zh-CN")}</div></div>)}</div> : null}
      </Section>

      <Section icon={RiRobot2Line} title="AI Provider" description="仅使用自定义 HTTP Provider。Provider 配置与 API Key 保存在浏览器本地；Worker 只按当前请求转发。">
        <Field label="Provider 名称"><Input value={settings.ai.providerName} placeholder="My Provider" onChange={(event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, providerName: event.target.value } } })} /></Field>
        <Field label="Base URL" description="必须使用 HTTPS，且不能指向本地或私网地址。"><Input inputMode="url" value={settings.ai.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, baseUrl: event.target.value } } })} /></Field>
        <Field label="Model"><Input value={settings.ai.model} placeholder="your-model-name" onChange={(event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, model: event.target.value } } })} /></Field>
        <Field label="API Key" description="仅保存在当前浏览器；导出备份时会自动移除。"><Input type="password" autoComplete="off" value={settings.ai.apiKey} placeholder="sk-…" onChange={(event) => onStateChange({ ...state, settings: { ...settings, ai: { ...settings.ai, apiKey: event.target.value } } })} /></Field>
        <Field label="附加 Headers" description='可选 JSON 对象，例如 {"X-Tenant":"team-a"}。Authorization 由 API Key 生成。'><Textarea value={headersText} onChange={(event) => updateHeaders(event.target.value)} spellCheck={false} className="font-mono text-xs" />{headersError ? <span className="text-xs text-destructive-foreground">{headersError}</span> : null}</Field>
        <div className="flex items-center gap-3"><Button variant="outline" onClick={() => void testAi()} loading={aiTesting} disabled={!settings.ai.baseUrl || !settings.ai.apiKey || !settings.ai.model || Boolean(headersError)}><RiKey2Line className="size-4" />测试 Provider</Button>{aiStatus ? <span className="text-xs text-muted-foreground">{aiStatus}</span> : null}</div>
      </Section>

      <Section icon={RiSunLine} title="外观" description="主题、密度、强调色与主导航都由前端即时应用。">
        <div className="grid gap-4 sm:grid-cols-3"><Field label="主题"><Select value={settings.theme} onChange={(event) => onStateChange({ ...state, settings: { ...settings, theme: event.target.value as typeof settings.theme } })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></Select></Field><Field label="卡片密度"><Select value={settings.density} onChange={(event) => onStateChange({ ...state, settings: { ...settings, density: event.target.value as typeof settings.density } })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></Select></Field><Field label="强调色"><Select value={settings.accent} onChange={(event) => onStateChange({ ...state, settings: { ...settings, accent: event.target.value as typeof settings.accent } })}><option value="neutral">中性</option><option value="blue">蓝色</option><option value="violet">紫色</option><option value="emerald">翠绿</option></Select></Field></div>
        <div className="flex gap-2 text-xs text-muted-foreground"><RiMoonLine className="size-4" /><span>主题、强调色切换即时生效。</span></div>
        <div className="rounded-xl border border-border"><div className="border-b border-border px-3 py-2 text-xs font-semibold">导航顺序与显示</div>{settings.navOrder.map((id, index) => { const item = navMeta[id]; const Icon = item.icon; return <div key={id} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"><Icon className="size-4 text-muted-foreground" /><span className="flex-1 text-sm">{item.label}</span><label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={!settings.hiddenNav.includes(id)} disabled={item.required} onCheckedChange={() => toggleNav(id)} aria-label={`显示 ${item.label}`} />显示</label><Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveNav(index, -1)}>上移</Button><Button size="sm" variant="ghost" disabled={index === settings.navOrder.length - 1} onClick={() => moveNav(index, 1)}>下移</Button></div>; })}</div>
      </Section>

      <Section icon={RiDatabase2Line} title="数据与缓存" description="D1 是权威数据源，IndexedDB 作为实体缓存；localStorage 只保留少量 UI 状态与浏览器本地 AI Secret。">
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportState(state)}><RiDownload2Line className="size-4" />导出 JSON</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><RiUpload2Line className="size-4" />导入 JSON</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void importState(file).then((next) => { onStateChange(next); setDataStatus("导入成功"); }).catch((error: unknown) => setDataStatus(error instanceof Error ? error.message : "导入失败")); event.currentTarget.value = ""; }} /><Button variant="destructive" onClick={() => { if (!window.confirm("确定清空 StarBox 当前浏览器中的所有数据吗？")) return; clearState(); onStateChange(createInitialState()); setDataStatus("本地数据已清空"); }}>清空本地数据</Button></div>
        <p className="text-xs leading-5 text-muted-foreground">导出文件会移除 GitHub Token、AI API Key 与敏感自定义 Headers，避免把密钥写入备份。</p>
        {dataStatus ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RiCheckLine className="size-4" />{dataStatus}</p> : null}
      </Section>

      <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-xs leading-6 text-muted-foreground"><strong className="font-semibold text-foreground">运行边界：</strong>前端是 React SPA，后端只使用同源 Cloudflare Worker 与外部 HTTP API；不需要桌面运行时或本机常驻服务。</div>
    </div>
  );
}
