import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "xl" | "icon" | "icon-sm" | "icon-lg" | "none";

const variantClass: Record<ButtonVariant, string> = {
  default: "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85 data-[pressed]:bg-primary/90",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80 data-[pressed]:bg-secondary/80",
  outline: "border-input bg-background text-foreground shadow-xs hover:bg-accent/60 active:bg-accent data-[pressed]:bg-accent",
  ghost: "border-transparent text-foreground hover:bg-accent active:bg-accent data-[pressed]:bg-accent",
  destructive: "border-destructive bg-destructive text-white shadow-xs hover:bg-destructive/90 active:bg-destructive/85 data-[pressed]:bg-destructive/90",
  link: "border-transparent text-foreground underline-offset-4 hover:underline active:underline",
};
const sizeClass: Record<ButtonSize, string> = {
  default: "h-9 px-3",
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  lg: "h-10 px-3.5",
  xl: "h-11 px-4 text-base",
  icon: "size-9 p-0",
  "icon-sm": "size-8 p-0",
  "icon-lg": "size-10 p-0",
  none: "",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  render?: any;
  children?: ReactNode;
}

export function Button({ className, variant = "default", size = "default", loading = false, render, children, disabled, ...props }: ButtonProps) {
  const defaultProps = {
    children: <>{children}{loading ? <Spinner data-slot="button-loading-indicator" className="pointer-events-none absolute" /> : null}</>,
    className: cn(
      "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-[background-color,border-color,box-shadow,color,transform] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 data-loading:text-transparent motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
  return useRender({ defaultTagName: "button", props: mergeProps(defaultProps, props), render }) as any;
}
