import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../ui/toolbar";

export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="filter-bar" className={cn("mb-5 grid gap-2", className)} {...props} />;
}

export function FilterBarMobile({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="filter-bar-mobile" className={cn("grid gap-2 md:hidden", className)} {...props} />;
}

export function FilterBarMobileControls({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="filter-bar-mobile-controls" className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2", className)} {...props} />;
}

export function FilterBarDesktop({ className, ...props }: ComponentProps<typeof Toolbar>) {
  return <Toolbar data-slot="filter-bar-desktop" className={cn("hidden md:flex", className)} {...props} />;
}

export function FilterBarSearch({ className, ...props }: ComponentProps<typeof ToolbarGroup>) {
  return <ToolbarGroup data-slot="filter-bar-search" className={cn("min-w-[240px] flex-1", className)} {...props} />;
}

export function FilterBarControls({ className, ...props }: ComponentProps<typeof ToolbarGroup>) {
  return <ToolbarGroup data-slot="filter-bar-controls" className={cn("min-w-0", className)} {...props} />;
}

export function FilterBarSeparator({ className, ...props }: ComponentProps<typeof ToolbarSeparator>) {
  return <ToolbarSeparator data-slot="filter-bar-separator" className={className} {...props} />;
}

export function FilterBarChips({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="filter-bar-chips" className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)} {...props} />;
}
