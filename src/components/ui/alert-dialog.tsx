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
      <Primitive.Backdrop className="fixed inset-0 z-[70] bg-black/32 backdrop-blur-sm transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
      <Primitive.Viewport className="fixed inset-0 z-[70] grid grid-rows-[1fr_auto_3fr] justify-items-center p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12">
        <Primitive.Popup
          className={cn(
            "relative row-start-2 flex max-h-full min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-2xl outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-[ending-style]:scale-98 sm:data-[starting-style]:scale-98 max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:data-[ending-style]:translate-y-4 max-sm:data-[starting-style]:translate-y-4 motion-reduce:transform-none motion-reduce:transition-none",
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
  return <div className="grid gap-1.5 px-5 pb-3 pt-5">{children}</div>;
}

export function AlertDialogTitle({ children }: { children: ReactNode }) {
  return <Primitive.Title className="text-base font-semibold">{children}</Primitive.Title>;
}

export function AlertDialogDescription({ children }: { children: ReactNode }) {
  return <Primitive.Description className="text-sm leading-6 text-muted-foreground">{children}</Primitive.Description>;
}

export function AlertDialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-4 max-sm:flex-col-reverse">{children}</div>;
}
