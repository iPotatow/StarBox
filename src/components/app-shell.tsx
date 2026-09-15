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
import { useI18n } from "../lib/i18n";
import type { AppSettings, AuthSession, NavigationPageId } from "../types";

export type AppPage = NavigationPageId;

const navMeta: Record<AppPage, { zh: string; en: string; icon: typeof RiStarLine }> = {
  repositories: { zh: "Star", en: "Star", icon: RiStarLine },
  releases: { zh: "Release", en: "Release", icon: RiPriceTag3Line },
  forks: { zh: "Fork", en: "Fork", icon: RiGitForkLine },
  discover: { zh: "Discover", en: "Discover", icon: RiSearchLine },
  settings: { zh: "设置", en: "Settings", icon: RiSettings4Line },
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
  const { t } = useI18n();
  const ordered = settings.navOrder.filter((item) => !settings.hiddenNav.includes(item));
  const nav = Array.from(new Set(["repositories" as const, ...ordered, "settings" as const]));

  return (
    <div className="app-shell min-h-screen bg-sidebar text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 bg-sidebar px-3 py-4 md:flex md:flex-col">
        <Button variant="ghost" size="none" onClick={() => onPageChange("repositories")} className="mb-5 flex items-center justify-start gap-2 px-2 text-left">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm"><RiStarLine className="size-4" /></span>
          <span className="text-sm font-semibold tracking-tight">StarBox</span>
        </Button>
        <nav className="grid gap-1" aria-label={t("主导航", "Main navigation")}>
          {nav.map((id) => {
            const item = navMeta[id];
            const Icon = item.icon;
            const active = page === id;
            const label = t(item.zh, item.en);
            return (
              <Button
                key={id}
                variant="ghost"
                size="none"
                onClick={() => onPageChange(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[38px] items-center justify-start gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" /><span>{label}</span>
              </Button>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 px-2 py-2 text-xs text-muted-foreground"><div className="flex items-center gap-2"><RiGithubFill className="size-4" />{session?.username || "StarBox"}</div><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500" />{t("会话已连接", "Session connected")}</div></div>
      </aside>

      <header className="mobile-topbar sticky top-0 z-20 flex h-13 items-center px-4 md:hidden">
        <Button variant="ghost" size="none" onClick={() => onPageChange("repositories")} className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm"><RiStarLine className="size-4" /></span>
          <span>StarBox</span>
        </Button>
      </header>

      <main className="app-main min-h-screen md:pl-56">
        <div className="content-surface" data-testid="content-surface" aria-label={t("主内容区", "Main content")}>
          {children}
        </div>
      </main>

      <nav className="mobile-tabbar md:hidden" aria-label={t("主导航", "Main navigation")}>
        {nav.map((id) => {
          const item = navMeta[id];
          const Icon = item.icon;
          const active = page === id;
          const label = t(item.zh, item.en);
          return (
            <Button
              key={id}
              variant="ghost"
              size="none"
              onClick={() => onPageChange(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mobile-tabbar-item min-w-0 flex-1 rounded-xl px-1.5 py-1 text-[11px] font-medium",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
