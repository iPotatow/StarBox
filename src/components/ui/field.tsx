import { Field as BaseField } from "@base-ui/react/field";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

const FieldPrimitive = BaseField;

export function FieldRoot({ className, ...props }: Omit<BaseField.Root.Props, "className"> & { className?: string }) {
  return <FieldPrimitive.Root data-slot="field" className={cn("flex w-full flex-col items-stretch gap-2", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: Omit<BaseField.Label.Props, "className"> & { className?: string }) {
  return <FieldPrimitive.Label data-slot="field-label" className={cn("inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: Omit<BaseField.Description.Props, "className"> & { className?: string }) {
  return <FieldPrimitive.Description data-slot="field-description" className={cn("text-xs leading-5 text-muted-foreground", className)} {...props} />;
}

export function FieldError({ className, ...props }: Omit<BaseField.Error.Props, "className"> & { className?: string }) {
  return <FieldPrimitive.Error data-slot="field-error" className={cn("text-xs leading-5 text-destructive-foreground", className)} {...props} />;
}

export const FieldControl = FieldPrimitive.Control;
export const FieldValidity = FieldPrimitive.Validity;

export function Field({
  label,
  description,
  error,
  children,
  className,
}: {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FieldRoot className={className}>
      <FieldLabel>{label}</FieldLabel>
      {description ? <FieldDescription className="-mt-1">{description}</FieldDescription> : null}
      {children}
      {error ? <FieldError role="alert">{error}</FieldError> : null}
    </FieldRoot>
  );
}
