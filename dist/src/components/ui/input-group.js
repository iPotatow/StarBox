import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
import { Input } from "./input.js";
export function InputGroup({ className, ...props }) {
    return (_jsx("div", { "data-slot": "input-group", role: "group", className: cn("relative inline-flex w-full min-w-0 items-center rounded-lg border border-input bg-background text-sm text-foreground shadow-xs ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] focus-within:border-ring focus-within:ring-[3px] has-[input:disabled]:opacity-60 has-[input[aria-invalid=true]]:border-destructive/40 focus-within:has-[input[aria-invalid=true]]:ring-destructive/20", className), ...props }));
}
export function InputGroupInput({ className, ...props }) {
    return _jsx(Input, { unstyled: true, className: cn("flex-1", className), ...props });
}
export function InputGroupAddon({ className, align = "inline-end", ...props }) {
    return (_jsx("div", { "data-slot": "input-group-addon", "data-align": align, className: cn("flex shrink-0 items-center justify-center gap-1 text-muted-foreground", align === "inline-start" ? "order-first pl-2" : "order-last pr-1", className), onMouseDown: (event) => {
            const target = event.target;
            if (target.closest("button,a,input,select,textarea,[role='button']"))
                return;
            event.preventDefault();
            event.currentTarget.parentElement?.querySelector("input")?.focus();
        }, ...props }));
}
