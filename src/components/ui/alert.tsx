import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "default" | "error" | "info" | "success" | "warning";
const variants: Record<AlertVariant, string> = {
  default: "bg-transparent dark:bg-input/32 [&>svg]:text-muted-foreground",
  error: "border-destructive/32 bg-destructive/4 [&>svg]:text-destructive",
  info: "border-info/32 bg-info/4 [&>svg]:text-info",
  success: "border-success/32 bg-success/4 [&>svg]:text-success",
  warning: "border-warning/32 bg-warning/4 [&>svg]:text-warning",
};

// Structure and semantic variants follow coss apps/ui registry alert.
export function Alert({ className, variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return <div role="alert" data-slot="alert" className={cn("relative grid w-full items-start gap-x-2 gap-y-0.5 rounded-xl border px-3.5 py-3 text-card-foreground text-sm has-[>svg]:has-data-[slot=alert-action]:grid-cols-[1rem_1fr_auto] has-[>svg]:grid-cols-[1rem_1fr] has-data-[slot=alert-action]:grid-cols-[1fr_auto] [&>svg]:h-lh [&>svg]:w-4", variants[variant], className)} {...props} />;
}
export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-title" className={cn("font-medium [svg~&]:col-start-2", className)} {...props} />; }
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-description" className={cn("flex flex-col gap-2.5 text-muted-foreground [svg~&]:col-start-2", className)} {...props} />; }
export function AlertAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-action" className={cn("flex gap-1 max-sm:col-start-2 max-sm:mt-2 sm:row-start-1 sm:row-end-3 sm:self-center sm:[[data-slot=alert-description]~&]:col-start-2 sm:[[data-slot=alert-title]~&]:col-start-2 sm:[svg~&]:col-start-2 sm:[svg~[data-slot=alert-description]~&]:col-start-3 sm:[svg~[data-slot=alert-title]~&]:col-start-3", className)} {...props} />; }
