"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

type RadioGroupProps = Omit<RadioGroupPrimitive.Props, "className"> & { className?: string };
type RadioProps = Omit<RadioPrimitive.Root.Props, "className"> & { className?: string; variant?: "default" | "overlay" };

export function RadioGroup({ className, ...props }: RadioGroupProps): ReactElement {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("flex flex-col gap-3", className)} {...props} />;
}

export function Radio({ className, variant = "default", ...props }: RadioProps): ReactElement {
  return (
    <RadioPrimitive.Root
      data-slot="radio"
      data-variant={variant}
      className={cn(
        variant === "default" && "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border border-input bg-background shadow-xs outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/50 data-disabled:cursor-not-allowed data-disabled:opacity-60 data-checked:border-primary data-checked:bg-primary sm:size-4",
        variant === "overlay" && "absolute inset-0 z-10 size-full cursor-pointer border-0 bg-transparent shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_[data-slot=radio-indicator]]:hidden",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-indicator"
        className="absolute flex size-full items-center justify-center rounded-full before:size-2 before:rounded-full before:bg-primary-foreground data-unchecked:hidden sm:before:size-1.5"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroupPrimitive, RadioPrimitive, Radio as RadioGroupItem };
