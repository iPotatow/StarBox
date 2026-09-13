import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const TabsPrimitive = BaseTabs as any;
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "underline" }) {
  return <TabsPrimitive.List data-slot="tabs-list" data-variant={variant} className={cn("relative flex w-fit items-center gap-1 text-muted-foreground", variant === "default" ? "min-h-9 rounded-lg bg-muted p-1" : "min-h-10 gap-1 border-b border-border bg-transparent", className)} {...props}><>{props.children}</><TabsPrimitive.Indicator data-slot="tabs-indicator" className={cn("absolute bottom-0 left-0 transition-[width,translate] duration-200 ease-in-out", variant === "underline" ? "z-10 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-px bg-primary" : "inset-y-1 -z-0 h-auto w-(--active-tab-width) translate-x-(--active-tab-left) rounded-md bg-background shadow-xs")} /></TabsPrimitive.List>;
}
export function TabsTab({ className, ...props }: HTMLAttributes<HTMLButtonElement> & { value?: string }) { return <TabsPrimitive.Tab data-slot="tabs-tab" className={cn("relative z-10 inline-flex min-h-7 shrink-0 cursor-pointer items-center justify-center rounded-md px-2.5 text-sm font-medium outline-none transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[selected]:text-foreground", className)} {...props} />; }
export function TabsPanel({ className, ...props }: HTMLAttributes<HTMLDivElement> & { value?: string }) { return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("mt-3 outline-none", className)} {...props} />; }
