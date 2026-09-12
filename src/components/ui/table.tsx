import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
export function Table({ className, variant = "default", ...props }: TableHTMLAttributes<HTMLTableElement> & { variant?: "default" | "card" }) { return <div className={cn("w-full overflow-x-auto", variant === "card" && "rounded-xl border border-border")}><table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} /></div>; }
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead data-slot="table-header" className={cn("border-b border-border bg-secondary/40", className)} {...props} />; }
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody data-slot="table-body" className={cn("divide-y divide-border", className)} {...props} />; }
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr data-slot="table-row" className={cn("transition-colors hover:bg-accent/35", className)} {...props} />; }
export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th data-slot="table-head" className={cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)} {...props} />; }
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td data-slot="table-cell" className={cn("px-3 py-3 align-middle", className)} {...props} />; }
export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) { return <caption data-slot="table-caption" className={cn("mt-3 text-xs text-muted-foreground", className)} {...props} />; }
