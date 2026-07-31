import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm";

const variantClass: Record<ButtonVariant, string> = {
  default: "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
  outline: "border-input bg-background text-foreground shadow-xs hover:bg-accent active:bg-accent/80",
  ghost: "border-transparent text-foreground hover:bg-accent active:bg-accent/80",
  destructive: "border-destructive bg-destructive text-white shadow-xs hover:bg-destructive/90",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "h-9 px-3",
  sm: "h-8 px-2.5 text-xs",
  lg: "h-10 px-4",
  icon: "size-9 p-0",
  "icon-sm": "size-8 p-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ className, variant = "default", size = "default", loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-[background-color,border-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </button>
  );
}
