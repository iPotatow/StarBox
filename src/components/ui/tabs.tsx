import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const TabsPrimitive = BaseTabs as any;
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <TabsPrimitive.List data-slot="tabs-list" className={cn("relative inline-flex min-h-9 items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground", className)} {...props} />; }
export function TabsTab({ className, ...props }: HTMLAttributes<HTMLButtonElement> & { value?: string }) { return <TabsPrimitive.Tab data-slot="tabs-tab" className={cn("relative z-10 inline-flex min-h-7 items-center justify-center rounded-md px-2.5 text-sm font-medium outline-none transition-colors data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50", className)} {...props} />; }
export function TabsPanel({ className, ...props }: HTMLAttributes<HTMLDivElement> & { value?: string }) { return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("mt-3 outline-none", className)} {...props} />; }
export function TabsIndicator({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <TabsPrimitive.Indicator data-slot="tabs-indicator" className={cn("absolute inset-y-1 rounded-md bg-background shadow-xs transition-all", className)} {...props} />; }
