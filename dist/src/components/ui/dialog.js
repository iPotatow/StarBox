"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "../../lib/cn.js";
export const Dialog = DialogPrimitive.Root;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogBackdrop({ className, ...props }) {
    return (_jsx(DialogPrimitive.Backdrop, { "data-slot": "dialog-backdrop", className: cn("fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0", className), ...props }));
}
export function DialogViewport({ className, ...props }) {
    return (_jsx(DialogPrimitive.Viewport, { "data-slot": "dialog-viewport", className: cn("fixed inset-0 z-50 grid grid-rows-[1fr_auto_2fr] justify-items-center overflow-y-auto p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12", className), ...props }));
}
export function DialogPopup({ className, children, ...props }) {
    return (_jsx(DialogPrimitive.Popup, { "data-slot": "dialog-popup", className: cn("relative row-start-2 flex max-h-[90vh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover text-foreground shadow-2xl outline-none transition-[transform,opacity] data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 max-sm:max-w-none max-sm:rounded-b-none", className), ...props, children: children }));
}
export function DialogHeader({ className, children, ...props }) {
    return _jsx("div", { "data-slot": "dialog-header", className: cn("flex items-start justify-between gap-4 px-5 pb-3 pt-5", className), ...props, children: children });
}
export function DialogTitle({ className, ...props }) {
    return _jsx(DialogPrimitive.Title, { "data-slot": "dialog-title", className: cn("text-base font-semibold", className), ...props });
}
export function DialogDescription({ className, ...props }) {
    return _jsx(DialogPrimitive.Description, { "data-slot": "dialog-description", className: cn("mt-1 text-xs leading-5 text-muted-foreground", className), ...props });
}
export function DialogPanel({ className, children, ...props }) {
    return _jsx("div", { "data-slot": "dialog-panel", className: cn("min-h-0 overflow-auto px-5 pb-5", className), ...props, children: children });
}
export { DialogPrimitive };
