import { jsx as _jsx } from "react/jsx-runtime";
import { Field as BaseField } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "../../lib/cn.js";
const FieldPrimitive = BaseField;
// Adapted from coss apps/ui registry textarea: Base UI Field behavior + coss sizing/focus treatment.
export function Textarea({ className, sizeVariant = "default", unstyled = false, ...props }) {
    if (unstyled)
        return _jsx("textarea", { "data-slot": "textarea", className: className, ...props });
    return (_jsx("span", { className: cn("relative inline-flex w-full rounded-lg border border-input bg-background text-sm shadow-xs ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] focus-within:border-ring focus-within:ring-[3px] has-[:disabled]:opacity-60", className), "data-size": sizeVariant, "data-slot": "textarea-control", children: _jsx(FieldPrimitive.Control, { ref: undefined, value: props.value, defaultValue: props.defaultValue, disabled: props.disabled, id: props.id, name: props.name, render: (defaultProps) => (_jsx("textarea", { className: cn("field-sizing-content w-full resize-y rounded-[inherit] bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed", sizeVariant === "sm" ? "min-h-20" : sizeVariant === "lg" ? "min-h-28" : "min-h-24"), "data-slot": "textarea", ...mergeProps(defaultProps, props) })) }) }));
}
