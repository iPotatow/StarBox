import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "./dialog";

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
    <Dialog open={open} onOpenChange={(nextOpen: boolean) => { if (!nextOpen) onClose(); }}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className={className}>
            <DialogHeader>
              <div className="min-w-0">
                <DialogTitle>{title}</DialogTitle>
                {description ? <DialogDescription>{description}</DialogDescription> : null}
              </div>
              <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="关闭" />}>
                <RiCloseLine className="size-4" aria-hidden="true" />
              </DialogClose>
            </DialogHeader>
            <DialogPanel>{children}</DialogPanel>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
