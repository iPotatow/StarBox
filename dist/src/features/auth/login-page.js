import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiEyeLine, RiEyeOffLine, RiGithubFill, RiShieldCheckLine } from "@remixicon/react";
import { useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { login } from "../../lib/api.js";
export function LoginPage({ onAuthenticated }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit() {
        if (!username.trim() || !password)
            return setError("请输入账号和密码");
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
    return _jsx("main", { className: "grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground", children: _jsxs("section", { className: "w-full max-w-md rounded-2xl bg-card p-6 shadow-card sm:p-8", "aria-label": "StarBox \u767B\u5F55", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "grid size-10 place-items-center rounded-xl bg-foreground text-background", children: _jsx(RiGithubFill, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-lg font-semibold", children: "\u767B\u5F55 StarBox" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "\u4F7F\u7528\u90E8\u7F72\u914D\u7F6E\u7684 StarBox \u8D26\u53F7\u7EE7\u7EED" })] })] }), _jsxs("form", { className: "mt-7 grid gap-4", onSubmit: (event) => { event.preventDefault(); void submit(); }, children: [_jsx(Field, { label: "\u8D26\u53F7", children: _jsx(Input, { required: true, autoComplete: "username", value: username, onChange: (event) => setUsername(event.target.value) }) }), _jsx(Field, { label: "\u5BC6\u7801", children: _jsxs("div", { className: "relative", children: [_jsx(Input, { required: true, type: showPassword ? "text" : "password", autoComplete: "current-password", value: password, onChange: (event) => setPassword(event.target.value), className: "pr-10" }), _jsx("span", { className: "absolute right-1 top-1/2 z-10 -translate-y-1/2", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": showPassword ? "隐藏密码" : "显示密码", onClick: () => setShowPassword((value) => !value), children: showPassword ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), error ? _jsx("p", { className: "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground", role: "alert", "aria-live": "polite", children: error }) : null, _jsxs(Button, { type: "submit", loading: loading, children: [_jsx(RiShieldCheckLine, { className: "size-4" }), "\u767B\u5F55"] })] }), _jsxs("p", { className: "mt-6 flex items-center gap-2 text-xs leading-5 text-muted-foreground", children: [_jsx(RiGithubFill, { className: "size-4" }), "\u767B\u5F55\u540E\uFF0CGitHub \u51ED\u636E\u4E0E\u4E1A\u52A1\u6570\u636E\u6309\u5F53\u524D Worker \u7684\u4F1A\u8BDD\u7B56\u7565\u5904\u7406\u3002"] })] }) });
}
