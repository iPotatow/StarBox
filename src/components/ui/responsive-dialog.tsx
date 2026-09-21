"use client";

import { XIcon } from "../../lib/animated-icons";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n";
import { Button } from "./button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "./dialog";
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "./drawer";

const MOBILE_DIALOG_QUERY = "(max-width: 767px)";

function useMobileDialog() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(MOBILE_DIALOG_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_DIALOG_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

export function ResponsiveDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const mobile = useMobileDialog();

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen: boolean) => { if (!nextOpen) onClose(); }}>
        <DrawerPopup className={className}>
          <DrawerHeader className="flex-row items-start justify-between gap-4">
            <div className="min-w-0">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? <DrawerDescription className="mt-1">{description}</DrawerDescription> : null}
            </div>
            <DrawerClose render={<Button variant="ghost" size="icon-sm" aria-label={t("关闭", "Close")} />}>
              <XIcon className="size-4" aria-hidden="true" />
            </DrawerClose>
          </DrawerHeader>
          <DrawerPanel className={footer ? "pb-0" : undefined}>{children}</DrawerPanel>
          {footer ? <DrawerFooter variant="bare">{footer}</DrawerFooter> : null}
        </DrawerPopup>
      </Drawer>
    );
  }

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
              <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label={t("关闭", "Close")} />}>
                <XIcon className="size-4" aria-hidden="true" />
              </DialogClose>
            </DialogHeader>
            <DialogPanel className={footer ? "pb-0" : undefined}>{children}</DialogPanel>
            {footer ? <DialogFooter variant="bare">{footer}</DialogFooter> : null}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
