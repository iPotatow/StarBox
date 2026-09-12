import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { RiCheckboxCircleLine, RiErrorWarningLine } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { Alert, AlertDescription } from "./alert.js";
export function StatusBanner({ error, success }) {
    if (!error && !success)
        return null;
    const isError = Boolean(error);
    return (_jsxs(Alert, { className: "mb-4", variant: isError ? "error" : "success", role: isError ? "alert" : "status", children: [isError ? _jsx(RiErrorWarningLine, { className: "mt-0.5 size-4 shrink-0" }) : _jsx(RiCheckboxCircleLine, { className: "mt-0.5 size-4 shrink-0" }), _jsx(AlertDescription, { children: error || success })] }));
}
