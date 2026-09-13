import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
export function Spinner({ className, ...props }) {
    return (_jsx("span", { "data-slot": "spinner", "aria-hidden": "true", className: cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className), ...props }));
}
