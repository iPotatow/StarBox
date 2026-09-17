import { Input as BaseInput } from "@base-ui/react/input";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const InputPrimitive = BaseInput;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  sizeVariant?: "sm" | "default" | "lg";
  unstyled?: boolean;
  nativeInput?: boolean;
}

export function Input({ className, sizeVariant = "lg", unstyled = false, nativeInput = false, ...props }: InputProps) {
  const inputClassName = cn(
    "w-full min-w-0 rounded-[inherit] bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed",
    sizeVariant === "sm" ? "h-8" : sizeVariant === "default" ? "h-8" : "h-9",
    props.type === "search" && "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    unstyled && className,
  );
  const control = nativeInput
    ? <input data-slot="input" className={inputClassName} {...props} />
    : <InputPrimitive data-slot="input" className={inputClassName} {...props} />;

  if (unstyled) return control;
  return (
    <span
      data-slot="input-control"
      data-size={sizeVariant}
      className={cn(
        "relative inline-flex w-full min-w-0 rounded-lg border border-input bg-background text-sm shadow-xs ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] focus-within:border-ring focus-within:ring-[3px] has-[:disabled]:opacity-60 has-[[aria-invalid=true]]:border-destructive/40 focus-within:has-[[aria-invalid=true]]:ring-destructive/20",
        className,
      )}
    >
      {control}
    </span>
  );
}
