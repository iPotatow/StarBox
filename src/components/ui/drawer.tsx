"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../../lib/cn";

export const DrawerCreateHandle: typeof DrawerPrimitive.createHandle = DrawerPrimitive.createHandle;
export const DrawerPortal: typeof DrawerPrimitive.Portal = DrawerPrimitive.Portal;

export function Drawer({ swipeDirection = "down", ...props }: DrawerPrimitive.Root.Props): ReactElement {
  return <DrawerPrimitive.Root swipeDirection={swipeDirection} {...props} />;
}

export function DrawerTrigger(props: DrawerPrimitive.Trigger.Props): ReactElement {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

export function DrawerClose(props: DrawerPrimitive.Close.Props): ReactElement {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

export function DrawerBackdrop({ className, ...props }: Omit<DrawerPrimitive.Backdrop.Props, "className"> & { className?: string }): ReactElement {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-[70] bg-black/32 backdrop-blur-sm transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[swiping]:duration-0 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function DrawerViewport({ className, ...props }: Omit<DrawerPrimitive.Viewport.Props, "className"> & { className?: string }): ReactElement {
  return (
    <DrawerPrimitive.Viewport
      data-slot="drawer-viewport"
      className={cn("fixed inset-0 z-[70] grid grid-rows-[1fr_auto] overflow-hidden pt-12", className)}
      {...props}
    />
  );
}

export function DrawerPopup({
  className,
  children,
  portalProps,
  ...props
}: Omit<DrawerPrimitive.Popup.Props, "className"> & { className?: string; portalProps?: DrawerPrimitive.Portal.Props }): ReactElement {
  return (
    <DrawerPortal {...portalProps}>
      <DrawerBackdrop />
      <DrawerViewport>
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          className={cn(
            "relative row-start-2 flex max-h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 bg-popover text-popover-foreground shadow-2xl outline-none transition-[transform,box-shadow] duration-300 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full data-[swiping]:duration-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          {children}
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  );
}

export function DrawerHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="drawer-header" className={cn("flex flex-col gap-2 px-5 pt-5 pb-3", className)} {...props} />;
}

export function DrawerFooter({ className, variant = "default", ...props }: ComponentProps<"div"> & { variant?: "default" | "bare" }): ReactElement {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "flex flex-col-reverse gap-2 px-5 sm:flex-row sm:justify-end",
        variant === "default" && "border-t bg-muted/72 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        variant === "bare" && "pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
        className,
      )}
      {...props}
    />
  );
}

export function DrawerTitle({ className, ...props }: Omit<DrawerPrimitive.Title.Props, "className"> & { className?: string }): ReactElement {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cn("font-heading text-lg font-semibold leading-none", className)} {...props} />;
}

export function DrawerDescription({ className, ...props }: Omit<DrawerPrimitive.Description.Props, "className"> & { className?: string }): ReactElement {
  return <DrawerPrimitive.Description data-slot="drawer-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DrawerPanel({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="drawer-panel" className={cn("min-h-0 overflow-y-auto px-5 pb-5 overscroll-contain", className)} {...props} />;
}

export { DrawerPrimitive, DrawerPopup as DrawerContent };
