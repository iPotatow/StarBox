import { Eye as EyeIcon, EyeSlash as EyeOffIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../../components/ui/menu";
import { login } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { AppSettings, AuthSession } from "../../types";

interface LoginPageProps {
  onAuthenticated: (session: AuthSession) => void;
  theme: AppSettings["theme"];
  onThemeChange: (theme: AppSettings["theme"]) => void;
  onLanguageChange: (language: AppSettings["language"]) => void;
  serviceError?: string;
  onRetryService?: () => void;
  retryingService?: boolean;
}

export function LoginPage({ onAuthenticated, theme, onThemeChange, onLanguageChange, serviceError = "", onRetryService, retryingService = false }: LoginPageProps) {
  const { t, language } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function submit() {
    const nextUsernameError = username.trim() ? "" : t("请输入账号", "Enter your username", "請輸入帳號");
    const nextPasswordError = password ? "" : t("请输入密码", "Enter your password", "請輸入密碼");
    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);
    if (nextUsernameError || nextPasswordError) return;

    setLoading(true);
    setError("");
    try {
      onAuthenticated(await login(username.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("登录失败，请检查账号或稍后重试", "Login failed. Check your credentials or try again later.", "登入失敗，請檢查帳號或稍後重試"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sb-login h-full min-h-0 overflow-y-auto overscroll-contain bg-background text-foreground">
      <div className="sb-login-layout">
        <section className="sb-login-form w-full" aria-label={t("StarBox 登录", "StarBox login", "StarBox 登入")}>
          <h1 className="sb-login-title" aria-label={t("登录 StarBox", "Sign in to StarBox", "登入 StarBox")}>StarBox</h1>

        {serviceError ? (
          <Alert className="mt-6" variant="error">
            <AlertTitle>{t("无法连接 StarBox 服务", "Unable to connect to StarBox", "無法連線 StarBox 服務")}</AlertTitle>
            <AlertDescription>
              <span>{serviceError}</span>
              {onRetryService ? <Button className="w-fit" size="sm" variant="outline" loading={retryingService} onClick={onRetryService}>{t("重试", "Retry", "重試")}</Button> : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-8 grid gap-5" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
          <Field label={t("账号", "Username", "帳號")} error={usernameError}>
            <Input type="text"
              autoFocus
              required
              name="username"
              autoComplete="username"
              aria-invalid={Boolean(usernameError) || undefined}
              value={username}
              onChange={(event) => { setUsername(event.target.value); if (usernameError) setUsernameError(""); }}
            />
          </Field>
          <Field label={t("密码", "Password", "密碼")} error={passwordError} description={capsLock ? t("Caps Lock 已开启", "Caps Lock is on", "Caps Lock 已開啟") : undefined}>
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
                <Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? t("隐藏密码", "Hide password", "隱藏密碼") : t("显示密码", "Show password", "顯示密碼")} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOffIcon aria-hidden="true" className="size-4" /> : <EyeIcon aria-hidden="true" className="size-4" />}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {error ? <Alert variant="error" aria-live="polite"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button type="submit" loading={loading} disabled={Boolean(serviceError)}>{loading ? t("登录中…", "Signing in…", "登入中…") : t("登录", "Sign in", "登入")}</Button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4">
          <Menu>
            <MenuTrigger render={<Button type="button" variant="ghost" size="sm" className="text-muted-foreground" />}>
              {t("外观", "Appearance", "外觀")} · {theme === "system" ? t("系统", "System", "系統") : theme === "light" ? t("浅色", "Light", "淺色") : t("深色", "Dark", "深色")}
            </MenuTrigger>
            <MenuPopup side="top" align="center">
              <MenuRadioGroup value={theme} onValueChange={(value) => { if (value === "system" || value === "light" || value === "dark") onThemeChange(value); }}>
                <MenuRadioItem value="system">{t("跟随系统", "System", "跟隨系統")}</MenuRadioItem>
                <MenuRadioItem value="light">{t("浅色", "Light", "淺色")}</MenuRadioItem>
                <MenuRadioItem value="dark">{t("深色", "Dark", "深色")}</MenuRadioItem>
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger render={<Button type="button" variant="ghost" size="sm" className="text-muted-foreground" />} aria-label={t("语言", "Language", "語言")}>
              {language === "zh-CN" ? "简体中文" : language === "zh-TW" ? "繁體中文" : "English"}
            </MenuTrigger>
            <MenuPopup side="top" align="center">
              <MenuRadioGroup value={language} onValueChange={(value) => { if (value === "zh-CN" || value === "zh-TW" || value === "en") onLanguageChange(value); }}>
                <MenuRadioItem value="zh-CN">简体中文</MenuRadioItem>
                <MenuRadioItem value="zh-TW">繁體中文</MenuRadioItem>
                <MenuRadioItem value="en">English</MenuRadioItem>
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
        </div>
      </section>
      </div>
    </main>
  );
}
