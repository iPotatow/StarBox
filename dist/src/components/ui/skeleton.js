import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
// coss Skeleton is intentionally a lightweight pulse div.
export function Skeleton({ className, ...props }) {
    return _jsx("div", { "data-slot": "skeleton", "aria-hidden": "true", className: cn("animate-pulse rounded-md bg-secondary", className), ...props });
}
export function RepositoryCardSkeleton() {
    return _jsxs("div", { className: "rounded-xl border border-border bg-card p-4 shadow-card", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Skeleton, { className: "size-4 mt-2" }), _jsx(Skeleton, { className: "size-10 rounded-lg" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-2/3" }), _jsx(Skeleton, { className: "h-3 w-24" })] }), _jsx(Skeleton, { className: "h-8 w-24" })] }), _jsxs("div", { className: "mt-4 space-y-2", children: [_jsx(Skeleton, { className: "h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-5/6" }), _jsx(Skeleton, { className: "h-3 w-2/3" })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx(Skeleton, { className: "h-5 w-16" }), _jsx(Skeleton, { className: "h-5 w-20" }), _jsx(Skeleton, { className: "h-5 w-12" })] }), _jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx(Skeleton, { className: "h-3 w-20" }), _jsx(Skeleton, { className: "h-3 w-16" }), _jsx(Skeleton, { className: "h-3 w-24" })] })] });
}
export function RepositoryRowSkeleton() {
    return _jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card", children: [_jsx(Skeleton, { className: "size-4" }), _jsx(Skeleton, { className: "size-9 rounded-lg" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-2/3" })] }), _jsx(Skeleton, { className: "h-8 w-28" })] });
}
export function ListSkeleton({ rows = 6 }) {
    return _jsx("div", { className: "grid gap-3", children: Array.from({ length: rows }, (_, index) => _jsx(RepositoryRowSkeleton, {}, index)) });
}
export function FormSkeleton() {
    return _jsxs("div", { className: "grid gap-5", children: [_jsx(Skeleton, { className: "h-10 w-48" }), _jsxs("div", { className: "grid gap-4", children: [_jsx(Skeleton, { className: "h-20 w-full" }), _jsx(Skeleton, { className: "h-20 w-full" }), _jsx(Skeleton, { className: "h-32 w-full" })] })] });
}
