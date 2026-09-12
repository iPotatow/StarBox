import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckboxCircleLine, RiErrorWarningLine } from "@remixicon/react";
import { Alert, AlertDescription } from "./alert.js";
export function StatusBanner({ error, warning, success }) {
    if (!error && !warning && !success)
        return null;
    const isError = Boolean(error);
    const isWarning = !isError && Boolean(warning);
    return (_jsxs(Alert, { className: "mb-4", variant: isError ? "error" : isWarning ? "warning" : "success", role: isError || isWarning ? "alert" : "status", children: [isError || isWarning ? _jsx(RiErrorWarningLine, { className: "mt-0.5 size-4 shrink-0" }) : _jsx(RiCheckboxCircleLine, { className: "mt-0.5 size-4 shrink-0" }), _jsx(AlertDescription, { children: error || warning || success })] }));
}
