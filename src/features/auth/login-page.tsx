import { RiEyeLine, RiEyeOffLine, RiShieldCheckLine, RiStarFill } from "@remixicon/react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { login } from "../../lib/api";
import type { AuthSession } from "../../types";

interface LoginPageProps {
  onAuthenticated: (session: AuthSession) => void;
  serviceError?: string;
  onRetryService?: () => void;
  retryingService?: boolean;
}

export function LoginPage({ onAuthenticated, serviceError = "", onRetryService, retryingService = false }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function submit() {
    const nextUsernameError = username.trim() ? "" : "请输入账号";
    const nextPasswordError = password ? "" : "请输入密码";
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextUsernameError || nextPasswordError) return;

    setLoading(true);
    setError("");
    try {
      onAuthenticated(await login(username.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请检查账号或稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card sm:p-8" aria-label="StarBox 登录">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><RiStarFill className="size-5" /></span>
          <div>
            <p className="text-lg font-semibold">登录 StarBox</p>
            <p className="text-xs text-muted-foreground">使用部署配置的 StarBox 账号继续</p>
          </div>
        </div>

        {serviceError ? (
          <Alert className="mt-6" variant="error">
            <AlertTitle>无法连接 StarBox 服务</AlertTitle>
            <AlertDescription>
              <span>{serviceError}</span>
              {onRetryService ? <Button className="w-fit" size="sm" variant="outline" loading={retryingService} onClick={onRetryService}>重试</Button> : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-7 grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
          <Field label="账号" error={usernameError}>
            <Input
              autoFocus
              required
              name="username"
              autoComplete="username"
              aria-invalid={Boolean(usernameError) || undefined}
              value={username}
              onChange={(event) => { setUsername(event.target.value); if (usernameError) setUsernameError(""); }}
            />
          </Field>
          <Field label="密码" error={passwordError} description={capsLock ? "Caps Lock 已开启" : undefined}>
            <InputGroup>
              <InputGroupInput
                required
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(passwordError) || undefined}
                value={password}
                onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError(""); }}
                onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                onBlur={() => setCapsLock(false)}
              />
              <InputGroupAddon align="inline-end">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {error ? <Alert variant="error" aria-live="polite"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button type="submit" loading={loading} disabled={Boolean(serviceError)}><RiShieldCheckLine className="size-4" />{loading ? "登录中…" : "登录"}</Button>
        </form>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">登录以访问你的 StarBox 数据。</p>
      </section>
    </main>
  );
}
