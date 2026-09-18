import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export function SelectionToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="selection-toolbar"
      className={cn(
        "pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-[100px] bg-primary px-3 py-2 text-primary-foreground shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SelectionToolbarLabel({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="selection-toolbar-label" className={cn("shrink-0 px-3 text-sm font-medium", className)} {...props} />;
}
