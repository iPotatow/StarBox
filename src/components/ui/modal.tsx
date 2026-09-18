import type { ReactNode } from "react";
import { ResponsiveDialog } from "./responsive-dialog";

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
    <ResponsiveDialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className={className}
    >
      {children}
    </ResponsiveDialog>
  );
}
