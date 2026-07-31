import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
