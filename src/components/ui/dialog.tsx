"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;
export const DialogPortal: typeof DialogPrimitive.Portal = DialogPrimitive.Portal;
export const DialogTrigger: typeof DialogPrimitive.Trigger = DialogPrimitive.Trigger;
export const DialogClose: typeof DialogPrimitive.Close = DialogPrimitive.Close;

export function DialogBackdrop({ className, ...props }: Omit<DialogPrimitive.Backdrop.Props, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function DialogViewport({ className, ...props }: Omit<DialogPrimitive.Viewport.Props, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className={cn(
        "fixed inset-0 z-50 grid grid-rows-[1fr_auto_2fr] justify-items-center overflow-y-auto p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
        className,
      )}
      {...props}
    />
  );
}

export function DialogPopup({ className, children, ...props }: Omit<DialogPrimitive.Popup.Props, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      className={cn(
        "relative row-start-2 flex max-h-[90vh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover text-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-2xl outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-[ending-style]:scale-98 sm:data-[starting-style]:scale-98 max-sm:max-w-none max-sm:rounded-b-none max-sm:data-[ending-style]:translate-y-4 max-sm:data-[starting-style]:translate-y-4 motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  );
}

export function DialogHeader({ className, children, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex items-start justify-between gap-4 px-5 pb-3 pt-5", className)} {...props}>{children}</div>;
}

export function DialogTitle({ className, ...props }: Omit<DialogPrimitive.Title.Props, "className"> & { className?: string }) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-heading text-base font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: Omit<DialogPrimitive.Description.Props, "className"> & { className?: string }) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("mt-1 text-xs leading-5 text-muted-foreground", className)} {...props} />;
}

export function DialogPanel({ className, children, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-panel" className={cn("min-h-0 overflow-auto px-5 pb-5", className)} {...props}>{children}</div>;
}

export function DialogFooter({ className, children, variant = "default", ...props }: ComponentProps<"div"> & { variant?: "default" | "bare" }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 px-5 sm:flex-row sm:justify-end",
        variant === "default" && "border-t bg-muted/72 py-4",
        variant === "bare" && "pt-3 pb-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { DialogPrimitive };
