import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export function SelectionToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      data-slot="selection-toolbar"
      className={cn(
        "pointer-events-auto flex min-w-0 max-w-[calc(100vw-1rem)] items-center gap-1 overflow-hidden rounded-[100px] border border-border/70 bg-sidebar px-2 py-2 text-foreground shadow-2xl sm:px-3",
        className,
      )}
      {...props}
    />
  );
}

export function SelectionToolbarLabel({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="selection-toolbar-label" className={cn("shrink-0 px-3 text-sm font-medium", className)} {...props} />;
}
