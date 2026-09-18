import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export function SettingsList({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-list" className={cn("overflow-hidden rounded-xl border border-border/70", className)} {...props} />;
}

export function SettingsRow({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-row" className={cn("flex flex-col gap-3 px-4 py-4 not-last:border-b not-last:border-border/70 sm:flex-row sm:items-center", className)} {...props} />;
}

export function SettingsRowIcon({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="settings-row-icon" className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground", className)} {...props} />;
}

export function SettingsRowContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-row-content" className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function SettingsRowHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-row-header" className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function SettingsRowTitle({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="settings-row-title" className={cn("truncate text-sm font-medium", className)} {...props} />;
}

export function SettingsRowDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="settings-row-description" className={cn("mt-1 text-xs text-muted-foreground", className)} {...props} />;
}

export function SettingsRowActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-row-actions" className={cn("flex shrink-0 flex-wrap gap-2 self-end sm:self-auto", className)} {...props} />;
}
