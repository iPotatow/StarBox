import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// coss Skeleton is intentionally a lightweight pulse div.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-md bg-secondary", className)} {...props} />;
}

export function RepositoryCardSkeleton() {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="flex items-start gap-3"><Skeleton className="size-4 mt-2" /><Skeleton className="size-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-24" /></div><Skeleton className="h-8 w-24" /></div><div className="mt-4 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /></div><div className="mt-4 flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-12" /></div><div className="mt-4 flex gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-24" /></div></div>;
}

export function RepositoryRowSkeleton() {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"><Skeleton className="size-4" /><Skeleton className="size-9 rounded-lg" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-8 w-28" /></div>;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="grid gap-3">{Array.from({ length: rows }, (_, index) => <RepositoryRowSkeleton key={index} />)}</div>;
}

export function FormSkeleton() {
  return <div className="grid gap-5"><Skeleton className="h-10 w-48" /><div className="grid gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div></div>;
}
