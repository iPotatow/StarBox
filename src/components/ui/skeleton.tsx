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

function StarRepositoryCardSkeleton() {
  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <div className="absolute right-4 top-4 z-10"><Skeleton className="size-5 rounded-[4px]" /></div>
      <header className="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-secondary/40 px-4 py-3.5 pr-14">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <div className="mt-1 flex h-5 min-w-0 items-center gap-1.5 overflow-hidden">
            <Skeleton className="h-3 w-20 shrink-0" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
          </div>
        </div>
      </header>
      <div className="min-w-0 flex-1 px-4 pb-4 pt-3.5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
      </div>
      <footer className="mt-auto border-t border-border/70 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="mt-2 flex items-center justify-start gap-0.5">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="size-8 rounded-lg" />)}
        </div>
      </footer>
    </div>
  );
}

function DiscoverRepositoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-2/3" />
          <div className="mt-2 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="ml-auto h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function RepositoryCardSkeleton({ variant = "star" }: { variant?: "star" | "discover" }) {
  return variant === "discover" ? <DiscoverRepositoryCardSkeleton /> : <StarRepositoryCardSkeleton />;
}

function ForkRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_90px]">
      <div className="min-w-0">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-3/4" />
        <div className="mt-2 hidden flex-wrap gap-2 max-md:flex">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="max-md:hidden"><Skeleton className="h-5 w-16 rounded-md" /></div>
      <div className="max-md:hidden"><Skeleton className="h-3 w-24" /></div>
      <div className="flex justify-end gap-1">
        {index % 3 === 0 ? <Skeleton className="h-8 w-14 rounded-lg" /> : null}
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
    </div>
  );
}

export function RepositoryRowSkeleton() {
  return <ForkRowSkeleton />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] gap-3 border-b border-border bg-secondary/35 px-4 py-2 max-md:grid-cols-[minmax(0,1fr)_90px]">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 max-md:hidden" />
        <Skeleton className="h-3 w-16 max-md:hidden" />
        <Skeleton className="ml-auto h-3 w-12" />
      </div>
      {Array.from({ length: rows }, (_, index) => <ForkRowSkeleton key={index} index={index} />)}
    </div>
  );
}

export function FormSkeleton() {
  const mobileRows = ["w-32", "w-16", "w-20", "w-16", "w-20", "w-16"];
  const tabs = ["w-24", "w-10", "w-14", "w-14", "w-14", "w-14"];
  return (
    <>
      <div className="grid gap-1 md:hidden">
        {mobileRows.map((width, index) => (
          <div key={index} className="flex min-h-12 items-center justify-between rounded-xl px-3">
            <Skeleton className={cn("h-4", width)} />
            <Skeleton className="size-5 rounded-md" />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="mb-1 border-b border-border/80">
          <div className="flex min-h-10 items-center gap-6 px-1">
            {tabs.map((width, index) => <Skeleton key={index} className={cn("h-4", width)} />)}
          </div>
        </div>
        <section className="py-7 pt-3">
          <div className="mb-5 max-w-3xl">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2.5 h-3 w-2/3" />
          </div>
          <div className="grid max-w-5xl gap-4">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-4"><div className="min-w-0 flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-2/3" /></div><Skeleton className="h-8 w-20 rounded-lg" /></div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-10 w-full rounded-lg" />
            </div>
          </div>
        </section>
        <section className="border-t border-border/70 py-7">
          <div className="mb-5 max-w-3xl">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-2.5 h-3 w-3/4" />
          </div>
          <div className="grid max-w-5xl gap-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </section>
      </div>
    </>
  );
}
