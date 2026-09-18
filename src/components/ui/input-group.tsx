import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Input, type InputProps } from "./input";

export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background not-dark:bg-clip-padding text-sm text-foreground shadow-xs/5 ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-[input:disabled]:opacity-60 has-[input[aria-invalid=true]]:border-destructive/40 focus-within:has-[input[aria-invalid=true]]:ring-destructive/20 dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({ className, ...props }: InputProps) {
  return <Input unstyled className={cn("flex-1", className)} {...props} />;
}

export function InputGroupAddon({ className, align = "inline-end", ...props }: HTMLAttributes<HTMLDivElement> & { align?: "inline-start" | "inline-end" }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1 text-muted-foreground",
        align === "inline-start" ? "order-first pl-2" : "order-last pr-1",
        className,
      )}
      onMouseDown={(event) => {
        const target = event.target as Element;
        if (target.closest("button,a,input,select,textarea,[role='button']")) return;
        event.preventDefault();
        (event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null)?.focus();
      }}
      {...props}
    />
  );
}
