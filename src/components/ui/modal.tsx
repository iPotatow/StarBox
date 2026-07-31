import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-popover p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭"><RiCloseLine className="size-4" /></Button>
        </div>
        {children}
      </section>
    </div>
  );
}
