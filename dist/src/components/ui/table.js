import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
export function Table({ className, variant = "default", ...props }) { return _jsx("div", { className: cn("w-full overflow-x-auto", variant === "card" && "rounded-xl border border-border"), children: _jsx("table", { "data-slot": "table", className: cn("w-full caption-bottom text-sm", className), ...props }) }); }
export function TableHeader({ className, ...props }) { return _jsx("thead", { "data-slot": "table-header", className: cn("border-b border-border bg-secondary/40", className), ...props }); }
export function TableBody({ className, ...props }) { return _jsx("tbody", { "data-slot": "table-body", className: cn("divide-y divide-border", className), ...props }); }
export function TableRow({ className, ...props }) { return _jsx("tr", { "data-slot": "table-row", className: cn("transition-colors hover:bg-accent/35", className), ...props }); }
export function TableHead({ className, ...props }) { return _jsx("th", { "data-slot": "table-head", className: cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className), ...props }); }
export function TableCell({ className, ...props }) { return _jsx("td", { "data-slot": "table-cell", className: cn("px-3 py-3 align-middle", className), ...props }); }
export function TableCaption({ className, ...props }) { return _jsx("caption", { "data-slot": "table-caption", className: cn("mt-3 text-xs text-muted-foreground", className), ...props }); }
