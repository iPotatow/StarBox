import { jsx as _jsx } from "react/jsx-runtime";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "../../lib/cn.js";
const MenuPrimitive = BaseMenu;
export const Menu = MenuPrimitive.Root;
export const MenuPortal = MenuPrimitive.Portal;
export function MenuTrigger(props) { return _jsx(MenuPrimitive.Trigger, { "data-slot": "menu-trigger", ...props }); }
export function MenuPopup({ className, ...props }) { return _jsx(MenuPrimitive.Portal, { children: _jsx(MenuPrimitive.Positioner, { className: "z-50", sideOffset: 4, children: _jsx(MenuPrimitive.Popup, { "data-slot": "menu-popup", className: cn("min-w-40 origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg/5 outline-none", className), ...props }) }) }); }
export function MenuItem({ className, inset, ...props }) { return _jsx(MenuPrimitive.Item, { "data-slot": "menu-item", className: cn("flex min-h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-8", className), ...props }); }
export function MenuGroup(props) { return _jsx(MenuPrimitive.Group, { "data-slot": "menu-group", ...props }); }
export function MenuGroupLabel({ className, ...props }) { return _jsx(MenuPrimitive.GroupLabel, { "data-slot": "menu-group-label", className: cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className), ...props }); }
export function MenuSeparator({ className, ...props }) { return _jsx(MenuPrimitive.Separator, { "data-slot": "menu-separator", className: cn("-mx-1 my-1 h-px bg-border", className), ...props }); }
export function MenuShortcut({ className, children, ...props }) { return _jsx("span", { "data-slot": "menu-shortcut", className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className), ...props, children: children }); }
