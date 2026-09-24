import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { createContext, useContext } from "react";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

const TabsPrimitive = BaseTabs;
type TabsVariant = "default" | "underline";
type TabsSize = "default" | "lg" | "sm";

const tabsSizeClassNames: Record<TabsSize, string> = {
  default: "h-8.5 px-[calc(--spacing(2.5)-1px)] sm:h-7.5",
  lg: "h-9.5 px-[calc(--spacing(3)-1px)] sm:h-8.5",
  sm: "h-7.5 px-[calc(--spacing(2)-1px)] sm:h-6.5",
};
const TabsListContext = createContext<TabsSize>("default");

export function Tabs({ className, ...props }: Omit<BaseTabs.Root.Props, "className"> & { className?: string }): ReactElement {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)} {...props} />;
}

export function TabsList({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: Omit<BaseTabs.List.Props, "className"> & { className?: string; size?: TabsSize; variant?: TabsVariant }): ReactElement {
  return (
    <TabsPrimitive.List
      data-size={size}
      data-slot="tabs-list"
      className={cn(
        "relative z-0 flex w-fit items-center justify-center gap-x-0.5 text-muted-foreground data-[orientation=vertical]:flex-col",
        variant === "default"
          ? "rounded-lg bg-muted p-0.5 text-muted-foreground/72"
          : "data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent",
        className,
      )}
      {...props}
    >
      <TabsListContext.Provider value={size}>{children}</TabsListContext.Provider>
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        className={cn(
          "absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out motion-reduce:transition-none",
          variant === "underline"
            ? "z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px data-[orientation=horizontal]:translate-y-px"
            : "-z-1 rounded-md bg-background shadow-sm/5 dark:bg-input",
        )}
      />
    </TabsPrimitive.List>
  );
}

export function TabsTab({ className, size, ...props }: Omit<BaseTabs.Tab.Props, "className"> & { className?: string; size?: TabsSize; value?: string }): ReactElement {
  const resolvedSize = size ?? useContext(TabsListContext);
  return (
    <TabsPrimitive.Tab
      data-size={resolvedSize}
      data-slot="tabs-tab"
      className={cn(
        "relative z-10 flex shrink-0 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-active:text-foreground data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
        tabsSizeClassNames[resolvedSize],
        className,
      )}
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: Omit<BaseTabs.Panel.Props, "className"> & { className?: string; value?: string }): ReactElement {
  return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { TabsPrimitive };
export type { TabsSize, TabsVariant };
