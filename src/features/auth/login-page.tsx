import { RiEyeLine, RiEyeOffLine, RiShieldCheckLine, RiStarFill } from "@remixicon/react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { login } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { AuthSession } from "../../types";

interface LoginPageProps {
  onAuthenticated: (session: AuthSession) => void;
  serviceError?: string;
  onRetryService?: () => void;
  retryingService?: boolean;
}

export function LoginPage({ onAuthenticated, serviceError = "", onRetryService, retryingService = false }: LoginPageProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function submit() {
    const nextUsernameError = username.trim() ? "" : t("请输入账号", "Enter your username");
    const nextPasswordError = password ? "" : t("请输入密码", "Enter your password");
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextUsernameError || nextPasswordError) return;

    setLoading(true);
    setError("");
    try {
      onAuthenticated(await login(username.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("登录失败，请检查账号或稍后重试", "Login failed. Check your credentials or try again later."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card sm:p-8" aria-label={t("StarBox 登录", "StarBox login")}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background"><RiStarFill className="size-5" /></span>
          <div>
            <p className="text-lg font-semibold">{t("登录 StarBox", "Sign in to StarBox")}</p>
            <p className="text-xs text-muted-foreground">{t("使用部署配置的 StarBox 账号继续", "Continue with the StarBox account configured for this deployment")}</p>
          </div>
        </div>

        {serviceError ? (
          <Alert className="mt-6" variant="error">
            <AlertTitle>{t("无法连接 StarBox 服务", "Unable to connect to StarBox")}</AlertTitle>
            <AlertDescription>
              <span>{serviceError}</span>
              {onRetryService ? <Button className="w-fit" size="sm" variant="outline" loading={retryingService} onClick={onRetryService}>{t("重试", "Retry")}</Button> : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-7 grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
          <Field label={t("账号", "Username")} error={usernameError}>
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
          <Field label={t("密码", "Password")} error={passwordError} description={capsLock ? t("Caps Lock 已开启", "Caps Lock is on") : undefined}>
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
                <Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? t("隐藏密码", "Hide password") : t("显示密码", "Show password")} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {error ? <Alert variant="error" aria-live="polite"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button type="submit" loading={loading} disabled={Boolean(serviceError)}><RiShieldCheckLine className="size-4" />{loading ? t("登录中…", "Signing in…") : t("登录", "Sign in")}</Button>
        </form>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">{t("登录以访问你的 StarBox 数据。", "Sign in to access your StarBox data.")}</p>
      </section>
    </main>
  );
}
