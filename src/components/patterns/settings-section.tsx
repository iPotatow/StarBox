import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function SettingsSection({ className, ...props }: ComponentProps<"section">) {
  return <section data-slot="settings-section" className={cn("py-7 first:pt-3", className)} {...props} />;
}

export function SettingsSectionHeader({ className, ...props }: ComponentProps<"header">) {
  return <header data-slot="settings-section-header" className={cn("mb-4 max-w-3xl", className)} {...props} />;
}

export function SettingsSectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="settings-section-title" className={cn("font-heading text-base font-semibold tracking-tight", className)} {...props} />;
}

export function SettingsSectionDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="settings-section-description" className={cn("mt-1.5 text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export function SettingsSectionBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="settings-section-body" className={cn("grid min-w-0 max-w-5xl gap-4", className)} {...props} />;
}
