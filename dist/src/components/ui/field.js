import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Field as BaseField } from "@base-ui/react/field";
import { cn } from "../../lib/cn.js";
const FieldPrimitive = BaseField;
export function FieldRoot({ className, ...props }) {
    return _jsx(FieldPrimitive.Root, { "data-slot": "field", className: cn("flex w-full flex-col items-stretch gap-2", className), ...props });
}
export function FieldLabel({ className, ...props }) {
    return _jsx(FieldPrimitive.Label, { "data-slot": "field-label", className: cn("inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground", className), ...props });
}
export function FieldDescription({ className, ...props }) {
    return _jsx(FieldPrimitive.Description, { "data-slot": "field-description", className: cn("text-xs leading-5 text-muted-foreground", className), ...props });
}
export function FieldError({ className, ...props }) {
    return _jsx(FieldPrimitive.Error, { "data-slot": "field-error", className: cn("text-xs leading-5 text-destructive-foreground", className), ...props });
}
export const FieldControl = FieldPrimitive.Control;
export const FieldValidity = FieldPrimitive.Validity;
export function Field({ label, description, error, children, className, }) {
    return (_jsxs(FieldRoot, { className: className, children: [_jsx(FieldLabel, { children: label }), description ? _jsx(FieldDescription, { className: "-mt-1", children: description }) : null, children, error ? _jsx(FieldError, { role: "alert", children: error }) : null] }));
}
