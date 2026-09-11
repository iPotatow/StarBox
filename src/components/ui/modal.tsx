import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/cn";

const DialogPrimitive = BaseDialog as any;

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen: boolean) => { if (!nextOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className="fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Viewport data-slot="dialog-viewport" className="fixed inset-0 z-50 grid grid-rows-[1fr_auto_2fr] justify-items-center overflow-y-auto p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12">
          <DialogPrimitive.Popup data-slot="dialog-popup" className={cn("relative row-start-2 flex max-h-[90vh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover text-foreground shadow-2xl outline-none transition-[transform,opacity] data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 max-sm:max-w-none max-sm:rounded-b-none", className)}>
            <div data-slot="dialog-header" className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                {description ? <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">{description}</DialogPrimitive.Description> : null}
              </div>
              <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label="关闭" />}>
                <RiCloseLine className="size-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <div data-slot="dialog-panel" className="min-h-0 overflow-auto px-5 pb-5">{children}</div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
