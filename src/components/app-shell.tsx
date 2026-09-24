import { Gear as SettingsIcon, GitFork as GitForkIcon, GithubLogo as GithubIcon, MagnifyingGlass as SearchIcon, Translate as LanguagesIcon, Palette as PaletteIcon, Star as StarIcon, Tag as TagIcon } from "@phosphor-icons/react";
import type { ElementType, ReactNode } from "react";
import { Button } from "./ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./ui/menu";
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
  onLanguageChange,
  onThemeChange,
  children,
}: {
  page: AppPage;
  settings: AppSettings;
  session: AuthSession | null;
  onPageChange: (page: AppPage) => void;
  onLanguageChange: (language: AppSettings["language"]) => void;
  onThemeChange: (theme: AppSettings["theme"]) => void;
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
          <div className="grid gap-1 border-t border-border/70 pt-2">
            <Menu>
              <MenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-xs font-normal text-muted-foreground hover:text-foreground" />}>
                <LanguagesIcon className="size-4" aria-hidden="true" />
                <span>{t("语言", "Language")}</span>
                <span className="ml-auto text-[11px] opacity-70">{settings.language === "zh-CN" ? "中文" : "EN"}</span>
              </MenuTrigger>
              <MenuPopup side="right" align="end" className="w-40">
                <MenuRadioGroup value={settings.language} onValueChange={(value) => { if (value === "zh-CN" || value === "en") onLanguageChange(value); }}>
                  <MenuRadioItem value="zh-CN">中文</MenuRadioItem>
                  <MenuRadioItem value="en">English</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
            <Menu>
              <MenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-xs font-normal text-muted-foreground hover:text-foreground" />}>
                <PaletteIcon className="size-4" aria-hidden="true" />
                <span>{t("外观", "Appearance")}</span>
                <span className="ml-auto text-[11px] opacity-70">{settings.theme === "system" ? t("系统", "System") : settings.theme === "light" ? t("浅色", "Light") : t("深色", "Dark")}</span>
              </MenuTrigger>
              <MenuPopup side="right" align="end" className="w-40">
                <MenuRadioGroup value={settings.theme} onValueChange={(value) => { if (value === "system" || value === "light" || value === "dark") onThemeChange(value); }}>
                  <MenuRadioItem value="system">{t("跟随系统", "System")}</MenuRadioItem>
                  <MenuRadioItem value="light">{t("浅色", "Light")}</MenuRadioItem>
                  <MenuRadioItem value="dark">{t("深色", "Dark")}</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <div className="mt-2 flex items-center gap-2 px-2 py-1"><GithubIcon className="size-4" aria-hidden="true" />{session?.username || "StarBox"}</div>
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
