import {
  RiGitForkLine,
  RiGithubFill,
  RiPriceTag3Line,
  RiSearchLine,
  RiSettings4Line,
  RiStarLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";
import type { AppSettings, AuthSession, NavigationPageId } from "../types";

export type AppPage = NavigationPageId;

const navMeta: Record<AppPage, { label: string; icon: typeof RiStarLine }> = {
  repositories: { label: "Star", icon: RiStarLine },
  releases: { label: "Release", icon: RiPriceTag3Line },
  forks: { label: "Fork", icon: RiGitForkLine },
  discover: { label: "Discover", icon: RiSearchLine },
  settings: { label: "设置", icon: RiSettings4Line },
};

export function AppShell({
  page,
  settings,
  session,
  onPageChange,
  children,
}: {
  page: AppPage;
  settings: AppSettings;
  session: AuthSession | null;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
}) {
  const ordered = settings.navOrder.filter((item) => !settings.hiddenNav.includes(item));
  const nav = Array.from(new Set(["repositories" as const, ...ordered, "settings" as const]));
  return (
    <div className="app-shell min-h-screen bg-sidebar text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 bg-sidebar px-3 py-4 md:flex md:flex-col">
        <Button variant="ghost" size="none" onClick={() => onPageChange("repositories")} className="mb-5 flex items-center justify-start gap-2 px-2 text-left">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm"><RiStarLine className="size-4" /></span>
          <span className="text-sm font-semibold tracking-tight">StarBox</span>
        </Button>
        <nav className="grid gap-1" aria-label="主导航">
          {nav.map((id) => {
            const item = navMeta[id];
            const Icon = item.icon;
            const active = page === id;
            return (
              <Button
                key={id}
                variant="ghost"
                size="none"
                onClick={() => onPageChange(id)}
                className={cn(
                  "flex h-[38px] items-center justify-start gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" /><span>{item.label}</span>              </Button>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 px-2 py-2 text-xs text-muted-foreground"><div className="flex items-center gap-2"><RiGithubFill className="size-4" />{session?.username || "StarBox"}</div><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500" />会话已连接</div></div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/92 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="none" onClick={() => onPageChange("repositories")} className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background"><RiStarLine className="size-4" /></span>StarBox
        </Button>
        <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="主导航">
          {nav.map((id) => {
            const item = navMeta[id];
            const Icon = item.icon;
            return (
              <Button key={id} variant="ghost" size="none" onClick={() => onPageChange(id)} aria-label={item.label} className={cn("relative grid size-9 shrink-0 place-items-center rounded-lg", page === id ? "bg-accent" : "text-muted-foreground")}>
                <Icon className="size-4" />              </Button>
            );
          })}
        </nav>
      </header>

      <main className="app-main min-h-screen md:pl-56">
        <div className="content-surface" data-testid="content-surface" aria-label="主内容区">
          {children}
        </div>
      </main>
    </div>
  );
}
