"use client";

import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const Primitive = BaseAlertDialog;

export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogClose = Primitive.Close;

export function AlertDialogPopup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Primitive.Portal>
      <Primitive.Backdrop
        data-slot="alert-dialog-backdrop"
        className="fixed inset-0 z-[90] bg-black/32 backdrop-blur-sm transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
      />
      <Primitive.Viewport
        data-slot="alert-dialog-viewport"
        className="fixed inset-0 z-[90] grid grid-rows-[1fr_auto_3fr] justify-items-center p-4 max-md:grid-rows-[1fr_auto] max-md:p-0 max-md:pt-12"
      >
        <Primitive.Popup
          data-slot="alert-dialog-popup"
          className={cn(
            "relative row-start-2 flex max-h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-2xl outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-[ending-style]:scale-98 sm:data-[starting-style]:scale-98 max-md:max-w-none max-md:rounded-none max-md:border-x-0 max-md:border-b-0 max-md:data-[ending-style]:translate-y-4 max-md:data-[starting-style]:translate-y-4 dark:before:shadow-[0_-1px_--theme(--color-white/6%)] motion-reduce:transform-none motion-reduce:transition-none",
            className,
          )}
        >
          {children}
        </Primitive.Popup>
      </Primitive.Viewport>
    </Primitive.Portal>
  );
}

export function AlertDialogHeader({ children }: { children: ReactNode }) {
  return <div data-slot="alert-dialog-header" className="grid gap-1.5 px-5 pb-3 pt-5">{children}</div>;
}

export function AlertDialogTitle({ children }: { children: ReactNode }) {
  return <Primitive.Title data-slot="alert-dialog-title" className="font-heading text-base font-semibold">{children}</Primitive.Title>;
}

export function AlertDialogDescription({ children }: { children: ReactNode }) {
  return <Primitive.Description data-slot="alert-dialog-description" className="text-sm leading-6 text-muted-foreground">{children}</Primitive.Description>;
}

export function AlertDialogFooter({ children }: { children: ReactNode }) {
  return <div data-slot="alert-dialog-footer" className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-4 max-md:flex-col-reverse">{children}</div>;
}
