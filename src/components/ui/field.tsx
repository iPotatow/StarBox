import type { ReactNode } from "react";

export function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description ? <span className="text-xs leading-5 text-muted-foreground">{description}</span> : null}
      {children}
    </label>
  );
}
