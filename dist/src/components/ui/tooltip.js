import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "../../lib/cn.js";
const TooltipPrimitive = BaseTooltip;
export function Tooltip({ children, content, side = "top", }) {
    return (_jsx(TooltipPrimitive.Provider, { children: _jsxs(TooltipPrimitive.Root, { children: [_jsx(TooltipPrimitive.Trigger, { render: children }), _jsx(TooltipPrimitive.Portal, { children: _jsx(TooltipPrimitive.Positioner, { side: side, sideOffset: 6, children: _jsx(TooltipPrimitive.Popup, { className: cn("z-50 max-w-64 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md", "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"), children: content }) }) })] }) }));
}
