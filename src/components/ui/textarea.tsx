"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type TextareaSize = "sm" | "default" | "lg";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  size?: TextareaSize | number;
  /** Compatibility alias while product callers migrate to the COSS size prop. */
  sizeVariant?: TextareaSize;
  unstyled?: boolean;
}

// COSS-compatible size contract with StarBox's existing visual heights preserved.
export function Textarea({ className, size, sizeVariant, unstyled = false, ...props }: TextareaProps) {
  const resolvedSize: TextareaSize = sizeVariant ?? (typeof size === "string" ? size : "default");

  if (unstyled) return <textarea data-slot="textarea" className={className} {...props} />;

  return (
    <span
      className={cn(
        "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-sm shadow-xs/5 ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-[:disabled]:opacity-60 has-[[aria-invalid=true]]:border-destructive/40 focus-within:has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      data-size={size ?? resolvedSize}
      data-slot="textarea-control"
    >
      <FieldPrimitive.Control
        ref={undefined}
        value={props.value}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        render={(defaultProps) => (
          <textarea
            className={cn(
              "field-sizing-content w-full resize-y rounded-[inherit] bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed",
              resolvedSize === "sm" ? "min-h-20" : resolvedSize === "lg" ? "min-h-28" : "min-h-24",
            )}
            data-slot="textarea"
            {...(mergeProps(defaultProps, props) as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        )}
      />
    </span>
  );
}

export { FieldPrimitive };
