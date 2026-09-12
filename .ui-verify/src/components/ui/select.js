import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Select as BaseSelect } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { RiArrowDownSLine, RiCheckLine } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { Children, isValidElement } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/react.js";
import { cn } from "../../lib/cn.js";
const SelectPrimitive = BaseSelect;
function optionRecords(children) {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement(child))
            return [];
        if (child.type === "option") {
            const props = child.props;
            const value = String(props.value ?? (typeof props.children === "string" || typeof props.children === "number" ? props.children : ""));
            const text = typeof props.children === "string" || typeof props.children === "number" ? String(props.children) : value;
            return [{ label: props.children, text, value, disabled: Boolean(props.disabled) }];
        }
        return optionRecords(child.props?.children);
    });
}
export function Select({ className, children, value, defaultValue, onChange, disabled, name, required, sizeVariant = "lg", ...props }) {
    const options = optionRecords(children);
    const stringValue = value == null ? undefined : String(value);
    const stringDefault = defaultValue == null ? undefined : String(defaultValue);
    const items = options.map((item) => ({ label: item.text, value: item.value }));
    function onValueChange(next) {
        if (!onChange)
            return;
        const target = { value: String(next ?? ""), name: name ?? "" };
        onChange({ target, currentTarget: target });
    }
    return (_jsxs(SelectPrimitive.Root, { value: stringValue, defaultValue: stringDefault, onValueChange: onValueChange, disabled: disabled, name: name, required: required, items: items, children: [_jsxs(SelectPrimitive.Trigger, { ...props, "data-slot": "select-trigger", className: cn("relative inline-flex w-full min-w-28 select-none items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-foreground shadow-xs outline-none ring-ring/25 transition-shadow focus-visible:border-ring focus-visible:ring-[3px] data-[disabled]:pointer-events-none data-[disabled]:opacity-60", sizeVariant === "sm" ? "h-8" : sizeVariant === "default" ? "h-8" : "h-9", className), children: [_jsx(SelectPrimitive.Value, { className: "min-w-0 flex-1 truncate" }), _jsx(SelectPrimitive.Icon, { children: _jsx(RiArrowDownSLine, { className: "size-4 shrink-0 text-muted-foreground", "aria-hidden": "true" }) })] }), _jsx(SelectPrimitive.Portal, { children: _jsx(SelectPrimitive.Positioner, { className: "z-[60] select-none", side: "bottom", sideOffset: 4, align: "start", children: _jsx(SelectPrimitive.Popup, { "data-slot": "select-popup", className: "min-w-[var(--anchor-width)] rounded-lg border border-border bg-popover p-1 text-foreground shadow-xl outline-none", children: _jsx(SelectPrimitive.List, { className: "max-h-[min(20rem,var(--available-height))] overflow-y-auto", children: options.map((option) => (_jsxs(SelectPrimitive.Item, { value: option.value, disabled: option.disabled, className: "grid min-h-8 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent", children: [_jsx(SelectPrimitive.ItemIndicator, { className: "col-start-1", children: _jsx(RiCheckLine, { className: "size-3.5", "aria-hidden": "true" }) }), _jsx(SelectPrimitive.ItemText, { className: "col-start-2 truncate", children: option.label })] }, option.value))) }) }) }) })] }));
}
