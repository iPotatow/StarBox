import { GitForkIcon, GithubIcon, StarIcon, TagIcon } from "lucide-react";
import { SearchIcon, SettingsIcon } from "../lib/animated-icons";
import type { ElementType, ReactNode } from "react";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./ui/sidebar";
import { cn } from "../lib/cn";
import { useI18n } from "../lib/i18n";
import type { AppSettings, AuthSession, NavigationPageId } from "../types";

export type AppPage = NavigationPageId;

const navMeta: Record<AppPage, { zh: string; en: string; icon: ElementType }> = {
  repositories: { zh: "Star", en: "Star", icon: StarIcon },
  releases: { zh: "Release", en: "Release", icon: TagIcon },
  forks: { zh: "Fork", en: "Fork", icon: GitForkIcon },
  discover: { zh: "Discover", en: "Discover", icon: SearchIcon },
  settings: { zh: "设置", en: "Settings", icon: SettingsIcon },
};
const NAV_ITEMS: AppPage[] = ["repositories", "releases", "forks", "discover", "settings"];

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
  const nav = NAV_ITEMS.filter((id) => id === "repositories" || id === "settings" || !settings.hiddenNav.includes(id));

  return (
    <SidebarProvider className="app-shell min-h-screen bg-sidebar text-foreground">
      <Sidebar className="fixed inset-y-0 left-0 z-20 hidden w-56 bg-sidebar px-3 py-4 md:flex" aria-label={t("主导航", "Main navigation")}>
        <SidebarHeader>
          <div className="mb-3 flex min-h-8 items-center gap-2 px-2 py-0 text-left" aria-label="StarBox">
            <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm"><StarIcon className="size-4" aria-hidden="true" /></span>
            <span className="text-sm font-semibold tracking-tight">StarBox</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label={t("主导航", "Main navigation")}>
            <SidebarMenu>
              {nav.map((id) => {
                const item = navMeta[id];
                const Icon = item.icon;
                const active = page === id;
                const label = t(item.zh, item.en);
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      active={active}
                      onClick={() => onPageChange(id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-[38px] items-center justify-start gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors",
                        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" /><span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarContent>
        <SidebarFooter className="mt-auto px-2 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><GithubIcon className="size-4" aria-hidden="true" />{session?.username || "StarBox"}</div>
        </SidebarFooter>
      </Sidebar>

      <header className="mobile-topbar sticky top-0 z-20 flex h-13 items-center px-4 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => onPageChange("repositories")} className="h-auto min-h-8 items-center gap-2 px-0 py-0 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background shadow-sm"><StarIcon className="size-4" aria-hidden="true" /></span>
          <span>StarBox</span>
        </Button>
      </header>

      <SidebarInset className="app-main min-h-screen md:pl-56">
        <div className="content-surface" data-testid="content-surface" aria-label={t("主内容区", "Main content")}>
          {children}
        </div>
      </SidebarInset>

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
              size="sm"
              onClick={() => onPageChange(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mobile-tabbar-item h-auto min-h-12 min-w-0 flex-1 rounded-xl px-1.5 py-1 text-[11px] font-medium",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Button>
          );
        })}
      </nav>
    </SidebarProvider>
  );
}
