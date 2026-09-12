import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Button as BaseButton } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { cn } from "../../lib/cn.js";
// COSS UI-compatible source adaptation: Base UI behavior + COSS semantic variants.
const ButtonPrimitive = BaseButton;
const variantClass = {
    default: "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85 data-[pressed]:bg-primary/90",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80 data-[pressed]:bg-secondary/80",
    outline: "border-input bg-background text-foreground shadow-xs hover:bg-accent/60 active:bg-accent data-[pressed]:bg-accent",
    ghost: "border-transparent text-foreground hover:bg-accent active:bg-accent data-[pressed]:bg-accent",
    destructive: "border-destructive bg-destructive text-white shadow-xs hover:bg-destructive/90 active:bg-destructive/85 data-[pressed]:bg-destructive/90",
    link: "border-transparent text-foreground underline-offset-4 hover:underline active:underline",
};
// Preserve StarBox's existing density while mapping onto coss size semantics.
const sizeClass = {
    default: "h-9 px-3",
    sm: "h-8 gap-1.5 px-2.5 text-xs",
    lg: "h-10 px-3.5",
    xl: "h-11 px-4 text-base",
    icon: "size-9 p-0",
    "icon-sm": "size-8 p-0",
    "icon-lg": "size-10 p-0",
    none: "",
};
export function Button({ className, variant = "default", size = "default", loading = false, children, disabled, ...props }) {
    return (_jsxs(ButtonPrimitive, { type: props.type ?? "button", "data-slot": "button", "data-loading": loading ? "" : undefined, "aria-busy": loading || undefined, "aria-disabled": loading || undefined, className: cn("relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-[background-color,border-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", variantClass[variant], sizeClass[size], className), disabled: Boolean(disabled || loading), ...props, children: [loading ? _jsx("span", { "data-slot": "button-loading-indicator", className: "pointer-events-none size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" }) : null, children] }));
}
