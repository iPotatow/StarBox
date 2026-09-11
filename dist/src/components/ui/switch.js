import { jsx as _jsx } from "react/jsx-runtime";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/cn.js";
const SwitchPrimitive = BaseSwitch;
export function Switch({ className, checked, defaultChecked, onCheckedChange, ...props }) {
    return (_jsx(SwitchPrimitive.Root, { ...props, "data-slot": "switch", checked: checked, defaultChecked: defaultChecked, onCheckedChange: (next) => onCheckedChange?.(Boolean(next)), className: cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary outline-none ring-ring transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60", className), children: _jsx(SwitchPrimitive.Thumb, { className: "block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-[18px]" }) }));
}
