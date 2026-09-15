import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-skeleton rounded-sm [--skeleton-highlight:rgb(255_255_255_/_64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--secondary)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:rgb(255_255_255_/_4%)]",
        className,
      )}
      {...props}
    />
  );
}

export function RepositoryCardSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <div className="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 px-4 py-3.5">
        <Skeleton className="size-4 shrink-0" />
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex shrink-0 gap-1">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="flex min-h-40 flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-auto border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="mt-3 flex justify-end gap-1">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RepositoryRowSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border/80 bg-card/75 p-3 shadow-card xl:grid-cols-[minmax(0,1.45fr)_minmax(13rem,0.85fr)_auto] xl:items-center xl:gap-x-6 xl:gap-y-0 xl:p-3.5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="size-4 shrink-0" />
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex shrink-0 gap-1">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
        <Skeleton className="mt-2.5 h-3 w-4/5" />
        <div className="mt-2.5 flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/70 pt-2.5 xl:border-t-0 xl:pt-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-12 rounded-lg" />
        <Skeleton className="h-8 w-12 rounded-lg" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="grid gap-3">{Array.from({ length: rows }, (_, index) => <RepositoryRowSkeleton key={index} />)}</div>;
}

export function FormSkeleton() {
  return <div className="grid gap-5"><Skeleton className="h-10 w-48" /><div className="grid gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /></div></div>;
}
