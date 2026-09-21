import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "destructive-outline" | "link";
export type ButtonSize = "default" | "xs" | "sm" | "lg" | "xl" | "icon" | "icon-xs" | "icon-sm" | "icon-lg" | "icon-xl";

const variantClass: Record<ButtonVariant, string> = {
  default: "border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs inset-shadow-[0_1px_--theme(--color-white/16%)] hover:bg-primary/90 active:bg-primary/85 active:shadow-none active:inset-shadow-[0_1px_--theme(--color-black/8%)] data-[pressed]:bg-primary/90 data-[pressed]:shadow-none data-[pressed]:inset-shadow-[0_1px_--theme(--color-black/8%)]",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80 data-[pressed]:bg-secondary/80",
  outline: "border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 hover:bg-accent/60 active:bg-accent active:shadow-none data-[pressed]:bg-accent data-[pressed]:shadow-none before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
  ghost: "border-transparent text-foreground hover:bg-accent active:bg-accent data-[pressed]:bg-accent",
  destructive: "border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs inset-shadow-[0_1px_--theme(--color-white/16%)] hover:bg-destructive/90 active:bg-destructive/85 active:shadow-none active:inset-shadow-[0_1px_--theme(--color-black/8%)] data-[pressed]:bg-destructive/90 data-[pressed]:shadow-none data-[pressed]:inset-shadow-[0_1px_--theme(--color-black/8%)]",
  "destructive-outline": "border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 hover:border-destructive/30 hover:bg-destructive/5 active:bg-destructive/10 active:shadow-none data-[pressed]:bg-destructive/10 data-[pressed]:shadow-none before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
  link: "border-transparent text-foreground underline-offset-4 hover:underline active:underline",
};
const sizeClass: Record<ButtonSize, string> = {
  default: "h-9 px-3",
  xs: "h-7 gap-1 rounded-md px-2 text-xs",
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  lg: "h-10 px-3.5",
  xl: "h-11 px-4 text-base",
  icon: "size-9 p-0",
  "icon-xs": "size-7 rounded-md p-0",
  "icon-sm": "size-8 p-0",
  "icon-lg": "size-10 p-0",
  "icon-xl": "size-11 p-0 [&_svg:not([class*='size-'])]:size-5",
};

export interface ButtonProps extends Omit<useRender.ComponentProps<"button">, "className"> {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ className, variant = "default", size = "default", loading = false, render, children, disabled, ...props }: ButtonProps) {
  const defaultProps = {
    children: <>{children}{loading ? <Spinner data-slot="button-loading-indicator" className={cn("pointer-events-none absolute", variant === "default" ? "text-primary-foreground" : variant === "destructive" ? "text-white" : "text-foreground")} /> : null}</>,
    className: cn(
      "group/button relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-[background-color,border-color,box-shadow,color,transform] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] active:scale-[0.98] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 data-loading:select-none data-loading:text-transparent motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4",
      variantClass[variant], sizeClass[size], className,
    ),
    disabled: Boolean(disabled || loading),
    type: render ? undefined : (props.type ?? "button"),
    "data-slot": "button",
    "data-size": size,
    "data-loading": loading ? "" : undefined,
    "aria-disabled": loading || undefined,
    "aria-busy": loading || undefined,
  };
  return useRender({ defaultTagName: "button", props: mergeProps(defaultProps, props), render });
}
