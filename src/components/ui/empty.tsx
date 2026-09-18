import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Empty({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="empty" className={cn("grid min-h-64 place-items-center rounded-2xl border border-dashed border-border p-8 text-center text-balance", className)} {...props} />; }
export function EmptyContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="empty-content" className={cn("w-full min-w-0 max-w-sm", className)} {...props} />; }
export function EmptyIcon({ children, className }: { children: ReactNode; className?: string }) { return <div data-slot="empty-icon" aria-hidden="true" className={cn("mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card shadow-card", className)}>{children}</div>; }
export function EmptyTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h2 data-slot="empty-title" className={cn("mt-4 font-heading text-base font-semibold", className)} {...props} />; }
export function EmptyDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p data-slot="empty-description" className={cn("mt-2 text-sm leading-6 text-muted-foreground", className)} {...props} />; }
