import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiEyeLine, RiEyeOffLine, RiShieldCheckLine, RiStarFill } from "@remixicon/react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.js";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { login } from "../../lib/api.js";
export function LoginPage({ onAuthenticated, serviceError = "", onRetryService, retryingService = false }) {
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
        if (nextUsernameError || nextPasswordError)
            return;
        setLoading(true);
        setError("");
        try {
            onAuthenticated(await login(username.trim(), password));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "登录失败，请检查账号或稍后重试");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("main", { className: "grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground", children: _jsxs("section", { className: "w-full max-w-md rounded-2xl bg-card p-6 shadow-card sm:p-8", "aria-label": "StarBox \u767B\u5F55", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "grid size-10 place-items-center rounded-xl bg-foreground text-background", children: _jsx(RiStarFill, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-lg font-semibold", children: "\u767B\u5F55 StarBox" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "\u4F7F\u7528\u90E8\u7F72\u914D\u7F6E\u7684 StarBox \u8D26\u53F7\u7EE7\u7EED" })] })] }), serviceError ? (_jsxs(Alert, { className: "mt-6", variant: "error", children: [_jsx(AlertTitle, { children: "\u65E0\u6CD5\u8FDE\u63A5 StarBox \u670D\u52A1" }), _jsxs(AlertDescription, { children: [_jsx("span", { children: serviceError }), onRetryService ? _jsx(Button, { className: "w-fit", size: "sm", variant: "outline", loading: retryingService, onClick: onRetryService, children: "\u91CD\u8BD5" }) : null] })] })) : null, _jsxs("form", { className: "mt-7 grid gap-4", onSubmit: (event) => { event.preventDefault(); void submit(); }, noValidate: true, children: [_jsx(Field, { label: "\u8D26\u53F7", error: usernameError, children: _jsx(Input, { autoFocus: true, required: true, name: "username", autoComplete: "username", "aria-invalid": Boolean(usernameError) || undefined, value: username, onChange: (event) => { setUsername(event.target.value); if (usernameError)
                                    setUsernameError(""); } }) }), _jsx(Field, { label: "\u5BC6\u7801", error: passwordError, description: capsLock ? "Caps Lock 已开启" : undefined, children: _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { required: true, name: "password", type: showPassword ? "text" : "password", autoComplete: "current-password", "aria-invalid": Boolean(passwordError) || undefined, value: password, onChange: (event) => { setPassword(event.target.value); if (passwordError)
                                            setPasswordError(""); }, onKeyDown: (event) => setCapsLock(event.getModifierState("CapsLock")), onKeyUp: (event) => setCapsLock(event.getModifierState("CapsLock")), onBlur: () => setCapsLock(false) }), _jsx(InputGroupAddon, { align: "inline-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": showPassword ? "隐藏密码" : "显示密码", onClick: () => setShowPassword((value) => !value), children: showPassword ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), error ? _jsx(Alert, { variant: "error", "aria-live": "polite", children: _jsx(AlertDescription, { children: error }) }) : null, _jsxs(Button, { type: "submit", loading: loading, disabled: Boolean(serviceError), children: [_jsx(RiShieldCheckLine, { className: "size-4" }), loading ? "登录中…" : "登录"] })] }), _jsx("p", { className: "mt-6 text-xs leading-5 text-muted-foreground", children: "\u767B\u5F55\u4EE5\u8BBF\u95EE\u4F60\u7684 StarBox \u6570\u636E\u3002" })] }) }));
}
