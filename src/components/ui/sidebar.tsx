import type { ComponentProps, CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export function SidebarProvider({ className, style, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-wrapper"
      className={cn("group/sidebar-wrapper isolate min-h-screen w-full", className)}
      style={{ "--sidebar-width": "14rem", ...style } as CSSProperties}
      {...props}
    />
  );
}

export function Sidebar({ className, ...props }: ComponentProps<"aside">) {
  return <aside data-slot="sidebar" className={cn("flex flex-col bg-sidebar text-foreground", className)} {...props} />;
}

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col", className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full min-w-0", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("m-0 grid min-w-0 list-none gap-1 p-0", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("relative min-w-0", className)} {...props} />;
}

export function SidebarMenuButton({
  active = false,
  className,
  variant = "ghost",
  size = "none",
  ...props
}: ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      data-slot="sidebar-menu-button"
      data-active={active ? "true" : "false"}
      variant={variant}
      size={size}
      className={cn("w-full", className)}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("relative min-w-0", className)} {...props} />;
}
