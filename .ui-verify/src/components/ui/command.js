import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Autocomplete as BaseAutocomplete } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { Dialog as BaseDialog } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { RiSearchLine } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { cn } from "../../lib/cn.js";
const Auto = BaseAutocomplete;
const Dialog = BaseDialog;
export const Command = Auto.Root;
export function CommandInput({ className, ...props }) { return _jsxs("div", { className: "flex items-center gap-2 border-b border-border px-3", children: [_jsx(RiSearchLine, { className: "size-4 text-muted-foreground" }), _jsx(Auto.Input, { "data-slot": "command-input", className: cn("h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className), ...props })] }); }
export function CommandList({ className, ...props }) { return _jsx(Auto.List, { "data-slot": "command-list", className: cn("max-h-80 overflow-y-auto p-1", className), ...props }); }
export function CommandItem({ className, ...props }) { return _jsx(Auto.Item, { "data-slot": "command-item", className: cn("flex min-h-8 cursor-default select-none items-center rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50", className), ...props }); }
export function CommandEmpty({ className, ...props }) { return _jsx(Auto.Empty, { "data-slot": "command-empty", className: cn("p-6 text-center text-sm text-muted-foreground", className), ...props }); }
export function CommandGroup({ className, ...props }) { return _jsx(Auto.Group, { "data-slot": "command-group", className: cn("py-1", className), ...props }); }
export function CommandSeparator({ className, ...props }) { return _jsx(Auto.Separator, { "data-slot": "command-separator", className: cn("my-1 h-px bg-border", className), ...props }); }
export function CommandDialog({ open, onOpenChange, children }) { return _jsx(Dialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Backdrop, { className: "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm" }), _jsx(Dialog.Viewport, { className: "fixed inset-0 z-50 flex items-start justify-center px-4 py-[10vh]", children: _jsx(Dialog.Popup, { className: "w-full max-w-xl overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl outline-none", children: children }) })] }) }); }
