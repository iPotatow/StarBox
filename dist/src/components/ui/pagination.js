import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { RiArrowLeftSLine, RiArrowRightSLine, RiMoreLine } from "@remixicon/react";
import { cn } from "../../lib/cn.js";
import { useI18n } from "../../lib/i18n.js";
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
export function PaginationPrevious({ className, children, ...props }) { const { t } = useI18n(); const label = children ?? t("上一页", "Previous"); return _jsxs(PaginationLink, { "aria-label": t("上一页", "Previous page"), className: cn("gap-1", className), ...props, children: [_jsx(RiArrowLeftSLine, { className: "size-4" }), label] }); }
export function PaginationNext({ className, children, ...props }) { const { t } = useI18n(); const label = children ?? t("下一页", "Next"); return _jsxs(PaginationLink, { "aria-label": t("下一页", "Next page"), className: cn("gap-1", className), ...props, children: [label, _jsx(RiArrowRightSLine, { className: "size-4" })] }); }
export function PaginationEllipsis({ className, ...props }) { const { t } = useI18n(); return _jsxs("span", { "aria-hidden": true, "data-slot": "pagination-ellipsis", className: cn("flex min-w-7 justify-center", className), ...props, children: [_jsx(RiMoreLine, { className: "size-4" }), _jsx("span", { className: "sr-only", children: t("更多页面", "More pages") })] }); }
export function PaginationButton({ active, ...props }) { return _jsx(Button, { "data-slot": "pagination-button", variant: active ? "outline" : "ghost", size: "icon-sm", ...props }); }
