import { RiArrowDownSLine } from "@remixicon/react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex min-w-0">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground shadow-xs outline-none focus:ring-2 focus:ring-ring/25",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <RiArrowDownSLine className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}
