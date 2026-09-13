import { RiEyeLine, RiEyeOffLine, RiGithubFill, RiShieldCheckLine } from "@remixicon/react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { login } from "../../lib/api";
import type { AuthSession } from "../../types";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!username.trim() || !password) return setError("请输入账号和密码");
    setLoading(true); setError("");
    try { onAuthenticated(await login(username.trim(), password)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败，请检查账号或稍后重试"); }
    finally { setLoading(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground"><section className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card sm:p-8" aria-label="StarBox 登录"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><RiGithubFill className="size-5" /></span><div><p className="text-lg font-semibold">登录 StarBox</p><p className="text-xs text-muted-foreground">使用部署配置的 StarBox 账号继续</p></div></div><form className="mt-7 grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}><Field label="账号"><Input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></Field><Field label="密码"><div className="relative"><Input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pr-10" /><span className="absolute right-1 top-1/2 z-10 -translate-y-1/2"><Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}</Button></span></div></Field>{error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground" role="alert" aria-live="polite">{error}</p> : null}<Button type="submit" loading={loading}><RiShieldCheckLine className="size-4" />登录</Button></form><p className="mt-6 flex items-center gap-2 text-xs leading-5 text-muted-foreground"><RiGithubFill className="size-4" />登录后，GitHub 凭据与业务数据按当前 Worker 的会话策略处理。</p></section></main>;
}
