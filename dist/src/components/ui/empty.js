import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
export function Empty({ className, ...props }) { return _jsx("div", { "data-slot": "empty", className: cn("grid min-h-64 place-items-center rounded-2xl border border-dashed border-border p-8 text-center", className), ...props }); }
export function EmptyContent({ className, ...props }) { return _jsx("div", { "data-slot": "empty-content", className: cn("max-w-sm", className), ...props }); }
export function EmptyIcon({ children, className }) { return _jsx("div", { "data-slot": "empty-icon", className: cn("mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-card", className), children: children }); }
export function EmptyTitle({ className, ...props }) { return _jsx("h2", { "data-slot": "empty-title", className: cn("mt-4 text-base font-semibold", className), ...props }); }
export function EmptyDescription({ className, ...props }) { return _jsx("p", { "data-slot": "empty-description", className: cn("mt-2 text-sm leading-6 text-muted-foreground", className), ...props }); }
