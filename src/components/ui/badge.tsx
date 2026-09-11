import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant = "secondary" | "default" | "outline" | "destructive" | "success" | "warning" | "error" | "info";
export type BadgeSize = "sm" | "default" | "lg";
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  render?: any;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-white",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border-input bg-background text-foreground dark:bg-input/32",
  success: "bg-success/8 text-success-foreground dark:bg-success/16",
  warning: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
  error: "bg-destructive/8 text-destructive-foreground dark:bg-destructive/16",
  info: "bg-info/8 text-info-foreground dark:bg-info/16",
};
const sizes: Record<BadgeSize, string> = {
  sm: "h-4 min-w-4 rounded px-1 text-[10px]",
  default: "h-5 min-w-5 px-1.5 text-[11px]",
  lg: "h-6 min-w-6 px-2 text-sm",
};

// Adapted from coss apps/ui registry badge; useRender preserves link/button polymorphism.
export function Badge({ className, variant = "secondary", size = "default", render, ...props }: BadgeProps) {
  const defaultProps = {
    className: cn(
      "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent font-medium outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      variants[variant], sizes[size], className,
    ),
    "data-slot": "badge",
  };
  return useRender({ defaultTagName: "span", props: mergeProps(defaultProps, props), render }) as ReactElement;
}
