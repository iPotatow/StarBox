import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "../../lib/cn.js";
const Primitive = BaseAlertDialog;
export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogClose = Primitive.Close;
export function AlertDialogPopup({ className, children }) { return _jsxs(Primitive.Portal, { children: [_jsx(Primitive.Backdrop, { className: "fixed inset-0 z-[70] bg-black/32 backdrop-blur-sm" }), _jsx(Primitive.Viewport, { className: "fixed inset-0 z-[70] grid place-items-center p-4", children: _jsx(Primitive.Popup, { className: cn("w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none", className), children: children }) })] }); }
export function AlertDialogHeader({ children }) { return _jsx("div", { className: "grid gap-1.5 px-5 pb-3 pt-5", children: children }); }
export function AlertDialogTitle({ children }) { return _jsx(Primitive.Title, { className: "text-base font-semibold", children: children }); }
export function AlertDialogDescription({ children }) { return _jsx(Primitive.Description, { className: "text-sm leading-6 text-muted-foreground", children: children }); }
export function AlertDialogFooter({ children }) { return _jsx("div", { className: "flex justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-4", children: children }); }
