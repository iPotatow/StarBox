import { jsx as _jsx, jsxs as _jsxs } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { mergeProps } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { useRender } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { RiArrowLeftSLine, RiArrowRightSLine, RiMoreLine } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/remixicon.js";
import { cn } from "../../lib/cn.js";
import { Button } from "./button.js";
export function Pagination({ className, ...props }) { return _jsx("nav", { "aria-label": "pagination", "data-slot": "pagination", className: cn("mx-auto flex w-full justify-center", className), ...props }); }
export function PaginationContent({ className, ...props }) { return _jsx("ul", { "data-slot": "pagination-content", className: cn("flex flex-row items-center gap-1", className), ...props }); }
export function PaginationItem(props) { return _jsx("li", { "data-slot": "pagination-item", ...props }); }
export function PaginationLink({ className, isActive, render, ...props }) {
    return useRender({
        defaultTagName: "a",
        props: mergeProps({ "aria-current": isActive ? "page" : undefined, "data-active": isActive || undefined, "data-slot": "pagination-link", className: cn("inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", isActive && "border border-input bg-background", className) }, props),
        render,
    });
}
export function PaginationPrevious({ className, children = "上一页", ...props }) { return _jsxs(PaginationLink, { "aria-label": "\u4E0A\u4E00\u9875", className: cn("gap-1", className), ...props, children: [_jsx(RiArrowLeftSLine, { className: "size-4" }), children] }); }
export function PaginationNext({ className, children = "下一页", ...props }) { return _jsxs(PaginationLink, { "aria-label": "\u4E0B\u4E00\u9875", className: cn("gap-1", className), ...props, children: [children, _jsx(RiArrowRightSLine, { className: "size-4" })] }); }
export function PaginationEllipsis({ className, ...props }) { return _jsxs("span", { "aria-hidden": true, "data-slot": "pagination-ellipsis", className: cn("flex min-w-7 justify-center", className), ...props, children: [_jsx(RiMoreLine, { className: "size-4" }), _jsx("span", { className: "sr-only", children: "\u66F4\u591A\u9875\u9762" })] }); }
export function PaginationButton({ active, ...props }) { return _jsx(Button, { "data-slot": "pagination-button", variant: active ? "outline" : "ghost", size: "icon-sm", ...props }); }
