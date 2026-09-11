import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
const variants = {
    default: "bg-transparent dark:bg-input/32 [&>svg]:text-muted-foreground",
    error: "border-destructive/32 bg-destructive/4 text-destructive-foreground [&>svg]:text-destructive",
    info: "border-info/32 bg-info/4 text-info-foreground [&>svg]:text-info",
    success: "border-success/32 bg-success/4 text-success-foreground [&>svg]:text-success",
    warning: "border-warning/32 bg-warning/4 text-warning-foreground [&>svg]:text-warning",
};
// Structure and semantic variants follow coss apps/ui registry alert.
export function Alert({ className, variant = "default", ...props }) {
    return _jsx("div", { role: "alert", "data-slot": "alert", className: cn("relative grid w-full items-start gap-x-2 gap-y-0.5 rounded-xl border px-3.5 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] [&>svg]:h-lh [&>svg]:w-4", variants[variant], className), ...props });
}
export function AlertTitle({ className, ...props }) { return _jsx("div", { "data-slot": "alert-title", className: cn("font-medium [svg~&]:col-start-2", className), ...props }); }
export function AlertDescription({ className, ...props }) { return _jsx("div", { "data-slot": "alert-description", className: cn("flex flex-col gap-2.5 [svg~&]:col-start-2", className), ...props }); }
export function AlertAction({ className, ...props }) { return _jsx("div", { "data-slot": "alert-action", className: cn("flex gap-1 [svg~&]:col-start-2", className), ...props }); }
