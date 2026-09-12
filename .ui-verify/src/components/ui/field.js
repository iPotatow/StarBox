import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Field as BaseField } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
const FieldPrimitive = BaseField;
export function Field({ label, description, children }) {
    return (_jsxs(FieldPrimitive.Root, { "data-slot": "field", className: "flex flex-col items-start gap-2", children: [_jsx(FieldPrimitive.Label, { "data-slot": "field-label", className: "inline-flex items-center gap-2 text-sm font-medium text-foreground", children: label }), description ? _jsx(FieldPrimitive.Description, { "data-slot": "field-description", className: "-mt-1 text-xs leading-5 text-muted-foreground", children: description }) : null, children] }));
}
