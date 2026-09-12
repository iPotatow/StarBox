import { jsx as _jsx } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Tabs as BaseTabs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { cn } from "../../lib/cn.js";
const TabsPrimitive = BaseTabs;
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }) { return _jsx(TabsPrimitive.List, { "data-slot": "tabs-list", className: cn("relative inline-flex min-h-9 items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground", className), ...props }); }
export function TabsTab({ className, ...props }) { return _jsx(TabsPrimitive.Tab, { "data-slot": "tabs-tab", className: cn("relative z-10 inline-flex min-h-7 items-center justify-center rounded-md px-2.5 text-sm font-medium outline-none transition-colors data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50", className), ...props }); }
export function TabsPanel({ className, ...props }) { return _jsx(TabsPrimitive.Panel, { "data-slot": "tabs-panel", className: cn("mt-3 outline-none", className), ...props }); }
export function TabsIndicator({ className, ...props }) { return _jsx(TabsPrimitive.Indicator, { "data-slot": "tabs-indicator", className: cn("absolute inset-y-1 rounded-md bg-background shadow-xs transition-all", className), ...props }); }
