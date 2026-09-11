import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md border border-border bg-secondary/60 px-1.5 text-[11px] font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
