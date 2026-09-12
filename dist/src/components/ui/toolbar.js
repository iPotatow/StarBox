import { jsx as _jsx } from "react/jsx-runtime";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { cn } from "../../lib/cn.js";
const ToolbarPrimitive = BaseToolbar;
export function Toolbar({ className, ...props }) { return _jsx(ToolbarPrimitive.Root, { "data-slot": "toolbar", className: cn("flex min-h-11 w-full items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-card", className), ...props }); }
export function ToolbarGroup({ className, ...props }) { return _jsx(ToolbarPrimitive.Group, { "data-slot": "toolbar-group", className: cn("flex shrink-0 items-center gap-2", className), ...props }); }
export function ToolbarSeparator({ className, ...props }) { return _jsx(ToolbarPrimitive.Separator, { "data-slot": "toolbar-separator", className: cn("mx-0.5 h-6 w-px shrink-0 bg-border", className), ...props }); }
export const ToolbarButton = ToolbarPrimitive.Button;
