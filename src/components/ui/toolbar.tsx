import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const ToolbarPrimitive = BaseToolbar;

export function Toolbar({ className, ...props }: Omit<BaseToolbar.Root.Props, "className"> & { className?: string }) { return <ToolbarPrimitive.Root data-slot="toolbar" className={cn("flex min-h-11 w-full items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-card", className)} {...props} />; }
export function ToolbarGroup({ className, ...props }: Omit<BaseToolbar.Group.Props, "className"> & { className?: string }) { return <ToolbarPrimitive.Group data-slot="toolbar-group" className={cn("flex shrink-0 items-center gap-2", className)} {...props} />; }
export function ToolbarSeparator({ className, ...props }: Omit<BaseToolbar.Separator.Props, "className"> & { className?: string }) { return <ToolbarPrimitive.Separator data-slot="toolbar-separator" className={cn("mx-0.5 h-6 w-px shrink-0 bg-border", className)} {...props} />; }
export const ToolbarButton = ToolbarPrimitive.Button;
