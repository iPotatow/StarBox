import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Toast as BaseToast } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine, RiLoader4Line } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { cn } from "../../lib/cn.js";
const ToastPrimitive = BaseToast;
export const toastManager = ToastPrimitive.createToastManager();
const icons = { error: RiErrorWarningLine, success: RiCheckboxCircleLine, info: RiInformationLine, loading: RiLoader4Line, warning: RiErrorWarningLine };
function ToastViewport() {
    const { toasts } = ToastPrimitive.useToastManager();
    return _jsx(ToastPrimitive.Portal, { children: _jsx(ToastPrimitive.Viewport, { "data-slot": "toast-viewport", className: "fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2", children: toasts.map((toast) => { const Icon = icons[toast.type] ?? RiInformationLine; return _jsx(ToastPrimitive.Root, { toast: toast, swipeDirection: ["right", "down"], className: "rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg/10 transition-all data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0", children: _jsxs(ToastPrimitive.Content, { className: "flex gap-2 text-sm", children: [_jsx(Icon, { className: cn("mt-0.5 size-4 shrink-0", toast.type === "loading" && "animate-spin") }), _jsxs("div", { className: "min-w-0", children: [_jsx(ToastPrimitive.Title, { className: "font-medium" }), _jsx(ToastPrimitive.Description, { className: "mt-0.5 text-muted-foreground" })] })] }) }, toast.id); }) }) });
}
export function ToastProvider({ children }) { return _jsxs(ToastPrimitive.Provider, { toastManager: toastManager, children: [children, _jsx(ToastViewport, {})] }); }
