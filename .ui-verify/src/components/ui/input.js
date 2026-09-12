import { jsx as _jsx } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { Input as BaseInput } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { cn } from "../../lib/cn.js";
const InputPrimitive = BaseInput;
export function Input({ className, sizeVariant = "lg", ...props }) {
    return (_jsx("span", { "data-slot": "input-control", "data-size": sizeVariant, className: cn("relative inline-flex w-full rounded-lg border border-input bg-background text-sm shadow-xs ring-ring/25 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] focus-within:border-ring focus-within:ring-[3px] has-[:disabled]:opacity-60", className), children: _jsx(InputPrimitive, { "data-slot": "input", className: cn("w-full min-w-0 rounded-[inherit] bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed", sizeVariant === "sm" ? "h-8" : sizeVariant === "default" ? "h-8" : "h-9", props.type === "search" && "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"), ...props }) }));
}
