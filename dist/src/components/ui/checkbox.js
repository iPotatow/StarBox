import { jsx as _jsx } from "react/jsx-runtime";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { RiCheckLine } from "@remixicon/react";
import { cn } from "../../lib/cn.js";
const CheckboxPrimitive = BaseCheckbox;
export function Checkbox({ className, checked, defaultChecked, onCheckedChange, ...props }) {
    return (_jsx(CheckboxPrimitive.Root, { ...props, "data-slot": "checkbox", checked: checked, defaultChecked: defaultChecked, onCheckedChange: (next) => onCheckedChange?.(Boolean(next)), className: cn("relative inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-background shadow-xs outline-none ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60", className), children: _jsx(CheckboxPrimitive.Indicator, { className: "absolute -inset-px flex items-center justify-center rounded-[4px] bg-primary text-primary-foreground data-[unchecked]:hidden", children: _jsx(RiCheckLine, { className: "size-3", "aria-hidden": "true" }) }) }));
}
