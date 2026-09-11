import { Field as BaseField } from "@base-ui/react/field";
import type { ReactNode } from "react";

const FieldPrimitive = BaseField as any;

export function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <FieldPrimitive.Root data-slot="field" className="flex flex-col items-start gap-2">
      <FieldPrimitive.Label data-slot="field-label" className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        {label}
      </FieldPrimitive.Label>
      {description ? <FieldPrimitive.Description data-slot="field-description" className="-mt-1 text-xs leading-5 text-muted-foreground">{description}</FieldPrimitive.Description> : null}
      {children}
    </FieldPrimitive.Root>
  );
}
