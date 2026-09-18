"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type { InputHTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";

export type InputSize = "sm" | "default" | "lg";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize | number;
  /** Compatibility alias while product callers migrate to the COSS size prop. */
  sizeVariant?: InputSize;
  unstyled?: boolean;
  nativeInput?: boolean;
}

export function Input({
  className,
  size,
  sizeVariant,
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): ReactElement {
  const resolvedSize: InputSize = sizeVariant ?? (typeof size === "string" ? size : "lg");
  const nativeSize = typeof size === "number" ? size : undefined;
  const inputClassName = cn(
    "w-full min-w-0 rounded-[inherit] bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed autofill:[-webkit-text-fill-color:var(--foreground)]",
    resolvedSize === "sm" ? "h-8" : resolvedSize === "default" ? "h-8" : "h-9",
    props.type === "search" && "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" && "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
    unstyled && className,
  );

  const control = nativeInput
    ? <input data-slot="input" className={inputClassName} size={nativeSize} style={style} {...props} />
    : <InputPrimitive data-slot="input" className={inputClassName} size={nativeSize} style={style} {...props} />;

  // StarBox compatibility: InputGroup depends on the unstyled path being the input itself.
  if (unstyled) return control;

  return (
    <span
      data-slot="input-control"
      data-size={size ?? resolvedSize}
      className={cn(
        "relative inline-flex w-full min-w-0 rounded-lg border border-input bg-background not-dark:bg-clip-padding text-sm shadow-xs/5 ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-[:disabled]:opacity-60 has-[[aria-invalid=true]]:border-destructive/40 focus-within:has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
    >
      {control}
    </span>
  );
}

export { InputPrimitive };
