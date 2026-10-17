import type { AppPage } from "../app-shell";
import { ListSkeleton, RepositoryCardSkeleton, Skeleton } from "../ui/skeleton";

export function PassivePageLoading({ page, label }: { page: AppPage; label: string }) {
  return (
    <div className={`sb-page sb-${page === "repositories" ? "stars" : page} mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8`} aria-busy="true" data-slot="page-loading">
      <span className="sr-only" role="status">{label}</span>
      <div aria-hidden="true">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="grid flex-1 gap-4"><Skeleton className="h-9 w-24" /><Skeleton className="h-4 w-2/3 max-w-96" /></div>
          {page !== "settings" && page !== "discover" ? <Skeleton className="h-9 w-28 rounded-lg" /> : null}
        </div>
        {page === "settings" ? (
          <div className="grid gap-5">
            <div className="mb-2 flex gap-4 overflow-hidden border-b border-border pb-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-9 w-20 shrink-0 rounded-xl" />)}</div>
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="grid gap-5 rounded-2xl bg-secondary/60 p-6"><Skeleton className="h-6 w-28" /><div className="flex items-center justify-between gap-4 rounded-xl bg-card p-5"><div className="grid flex-1 gap-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-9 w-20 rounded-lg" /></div></div>)}
          </div>
        ) : (
          <>
            <div className="mb-7 grid gap-4">
              <Skeleton className={page === "discover" ? "h-32 w-full rounded-2xl" : page === "repositories" ? "h-14 w-full rounded-2xl" : "h-16 w-full rounded-2xl"} />
              {page === "repositories" ? <div className="flex justify-between border-b border-border pb-5"><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-40 rounded-lg" /></div> : null}
            </div>
            {page === "forks" ? <ListSkeleton rows={4} />
              : page === "releases" ? <div className="grid gap-4">{Array.from({ length: 3 }, (_, index) => <div key={index} className="grid gap-5 rounded-2xl border border-border p-5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,30%)]"><div className="grid gap-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div><div className="grid content-start gap-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-8 w-20 rounded-lg" /></div></div>)}</div>
                : <div className={page === "repositories" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3 lg:grid-cols-2"}>{Array.from({ length: page === "repositories" ? 3 : 4 }, (_, index) => <RepositoryCardSkeleton key={index} variant={page === "discover" ? "discover" : "star"} />)}</div>}
          </>
        )}
      </div>
    </div>
  );
}
