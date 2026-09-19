import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const rawSemanticPaletteClass = /\b(?:bg|text|border|ring)-(?:emerald|green|red|rose|yellow|amber|blue|violet)-\d{2,3}(?:\/\d+)?\b/g;
const rawSemanticPaletteAllowlist = new Set([
  "src/features/settings/settings-page.tsx",
  "src/features/repositories/category-manager.tsx",
]);

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function requireIncludes(source, needle, message) {
  if (!source.includes(needle)) failures.push(message);
}

const styles = await readFile(join(root, "src/styles.css"), "utf8");
for (const token of [
  "--card-foreground:",
  "--muted:",
  "--sidebar-foreground:",
  "--sidebar-primary:",
  "--sidebar-accent:",
  "--sidebar-border:",
  "--sidebar-ring:",
  "--color-card-foreground:",
  "--color-muted:",
  "--color-sidebar-foreground:",
]) {
  requireIncludes(styles, token, `styles.css: missing COSS token ${token}`);
}
requireIncludes(
  styles,
  "margin: 8px 8px 8px 0;",
  "styles.css: desktop Content Surface must keep top/right/bottom 8px and left 0",
);
requireIncludes(styles, ':not([data-slot="dialog-backdrop"]):not([data-slot="drawer-backdrop"]):not([data-slot="alert-dialog-backdrop"])', "styles.css: reduced transparency must not replace overlay backdrop colors");
requireIncludes(styles, '[data-slot="dialog-backdrop"],', "styles.css: dialog/drawer backdrops must disable blur without becoming opaque page material");

const button = await readFile(join(root, "src/components/ui/button.tsx"), "utf8");
requireIncludes(button, '"destructive-outline"', "button.tsx: missing COSS destructive-outline variant");
requireIncludes(button, '"icon-xs"', "button.tsx: missing COSS icon-xs size");
requireIncludes(button, "pointer-coarse:after:min-h-11", "button.tsx: missing COSS 44px coarse-pointer hit target");
requireIncludes(button, "inset-shadow-[0_1px_--theme(--color-white/16%)]", "button.tsx: primary actions must keep the subtle COSS highlight");
requireIncludes(button, "not-dark:bg-clip-padding", "button.tsx: outlined controls must keep light-mode material clipping");
requireIncludes(button, "active:scale-[0.98]", "button.tsx: preserve StarBox instant press feedback");
if (button.includes('"none"')) failures.push("button.tsx: migration-only none size must not return");

const menu = await readFile(join(root, "src/components/ui/menu.tsx"), "utf8");
requireIncludes(menu, 'variant?: "default" | "destructive"', "menu.tsx: missing destructive item variant");
requireIncludes(menu, "data-variant={variant}", "menu.tsx: destructive variant is not surfaced through data-variant");
for (const exportName of ["MenuCreateHandle", "MenuLinkItem", "MenuCheckboxItem", "MenuRadioGroup", "MenuRadioItem", "MenuSub", "MenuSubTrigger", "MenuSubPopup"]) {
  requireIncludes(menu, exportName, `menu.tsx: missing COSS ${exportName} contract`);
}
requireIncludes(menu, "DropdownMenuCheckboxItem", "menu.tsx: missing DropdownMenu compatibility aliases");
requireIncludes(menu, "portalProps?:", "menu.tsx: popup must forward portal props");

const input = await readFile(join(root, "src/components/ui/input.tsx"), "utf8");
requireIncludes(input, 'size?: InputSize | number', "input.tsx: missing COSS size prop contract");
requireIncludes(input, "sizeVariant?: InputSize", "input.tsx: missing temporary sizeVariant compatibility alias");
requireIncludes(input, "export { InputPrimitive }", "input.tsx: missing InputPrimitive export");
requireIncludes(input, "if (unstyled) return control", "input.tsx: InputGroup compatibility requires an unwrapped unstyled input");
requireIncludes(input, "typeof size === \"number\"", "input.tsx: numeric HTML size forwarding is missing");
requireIncludes(input, "not-dark:bg-clip-padding", "input.tsx: input material must match Textarea/InputGroup");
requireIncludes(input, "before:shadow-[0_1px_--theme(--color-black/4%)]", "input.tsx: input material edge highlight is missing");

const inputGroup = await readFile(join(root, "src/components/ui/input-group.tsx"), "utf8");
requireIncludes(inputGroup, "not-dark:bg-clip-padding", "input-group.tsx: group material must match Input/Textarea");
requireIncludes(inputGroup, "before:shadow-[0_1px_--theme(--color-black/4%)]", "input-group.tsx: group material edge highlight is missing");

const textarea = await readFile(join(root, "src/components/ui/textarea.tsx"), "utf8");
requireIncludes(textarea, 'size?: TextareaSize | number', "textarea.tsx: missing COSS size prop contract");
requireIncludes(textarea, "sizeVariant?: TextareaSize", "textarea.tsx: missing temporary sizeVariant compatibility alias");
requireIncludes(textarea, "export { FieldPrimitive }", "textarea.tsx: missing FieldPrimitive export");
requireIncludes(textarea, "not-dark:bg-clip-padding", "textarea.tsx: missing input-like material treatment");
requireIncludes(textarea, 'resolvedSize === "lg" ? "min-h-28" : "min-h-24"', "textarea.tsx: existing StarBox textarea heights must remain stable");

const card = await readFile(join(root, "src/components/ui/card.tsx"), "utf8");
for (const exportName of ["CardFrame", "CardFrameHeader", "CardFrameTitle", "CardFrameDescription", "CardFrameAction", "CardFrameFooter"]) {
  requireIncludes(card, exportName, `card.tsx: missing COSS ${exportName} export`);
}
requireIncludes(card, "export { CardPanel as CardContent }", "card.tsx: missing CardContent compatibility alias");
requireIncludes(card, "not-dark:bg-clip-padding", "card.tsx: missing subtle COSS light-material clipping");
requireIncludes(card, "before:shadow-[0_1px_--theme(--color-black/4%)]", "card.tsx: missing subtle COSS card edge highlight");
requireIncludes(card, "font-heading font-semibold", "card.tsx: CardTitle must use the heading font token");
requireIncludes(card, 'data-slot": slot', "card.tsx: shared slot rendering contract is missing");

const dialog = await readFile(join(root, "src/components/ui/dialog.tsx"), "utf8");
requireIncludes(dialog, "export function DialogFooter", "dialog.tsx: missing DialogFooter contract");
requireIncludes(dialog, "font-heading text-base font-semibold", "dialog.tsx: desktop dialog title must match Drawer heading typography");

const alertDialog = await readFile(join(root, "src/components/ui/alert-dialog.tsx"), "utf8");
for (const slot of ["alert-dialog-backdrop", "alert-dialog-viewport", "alert-dialog-popup", "alert-dialog-header", "alert-dialog-title", "alert-dialog-description", "alert-dialog-footer"]) {
  requireIncludes(alertDialog, `data-slot="${slot}"`, `alert-dialog.tsx: missing ${slot} slot`);
}
requireIncludes(alertDialog, "font-heading text-base font-semibold", "alert-dialog.tsx: title typography must match other overlays");

const aiRepositoriesPage = await readFile(join(root, "src/features/repositories/repositories-page.tsx"), "utf8");
const aiRepositoryCard = await readFile(join(root, "src/features/repositories/repository-card.tsx"), "utf8");
requireIncludes(aiRepositoryCard, 'from "border-beam"', "repository-card.tsx: AI analysis card must use Libraries.dev BorderBeam");
requireIncludes(aiRepositoryCard, 'active={aiLoading}', "repository-card.tsx: BorderBeam must follow AI loading state");
requireIncludes(aiRepositoryCard, '<BorderBeam active={aiLoading}', "repository-card.tsx: BorderBeam must wrap the repository card during AI loading");
requireIncludes(aiRepositoryCard, 'data-repository-full-name={repository.full_name}', "repository-card.tsx: repository cards must expose a stable locator for AI auto-scroll");
requireIncludes(aiRepositoriesPage, 'scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" })', "repositories-page.tsx: active AI repository must scroll into the center of the viewport");
if (aiRepositoryCard.includes("<ThinkingOrb")) failures.push("repository-card.tsx: card-level AI loading must use BorderBeam only, without an in-card ThinkingOrb");
if (aiRepositoryCard.includes('role="status"')) failures.push("repository-card.tsx: card-level AI loading must not render an in-card status banner");
requireIncludes(aiRepositoriesPage, 'from "thinking-orbs"', "repositories-page.tsx: batch AI state must use Libraries.dev ThinkingOrb");

const select = await readFile(join(root, "src/components/ui/select.tsx"), "utf8");
for (const exportName of ["SelectRoot", "SelectTrigger", "SelectValue", "SelectPopup", "SelectItem"]) {
  requireIncludes(select, exportName, `select.tsx: missing styled ${exportName} contract`);
}
requireIncludes(select, "<SelectRoot", "select.tsx: shorthand Select must compose the styled root");
requireIncludes(select, "<SelectPopup>", "select.tsx: shorthand Select must compose the styled popup");
requireIncludes(select, "pointer-coarse:after:min-h-11", "select.tsx: trigger must preserve a coarse-pointer hit target");

const tabs = await readFile(join(root, "src/components/ui/tabs.tsx"), "utf8");
requireIncludes(tabs, "motion-reduce:transition-none", "tabs.tsx: tab motion must respect reduced-motion");
requireIncludes(tabs, "h-(--active-tab-height)", "tabs.tsx: COSS indicator must track active tab height");
requireIncludes(tabs, "-translate-y-(--active-tab-bottom)", "tabs.tsx: COSS indicator must track active tab bottom offset");
requireIncludes(tabs, "data-active:text-foreground", "tabs.tsx: selected tab styling must use Base UI data-active state");
requireIncludes(tabs, "TabsListContext", "tabs.tsx: tab sizes must inherit from TabsList");
requireIncludes(aiRepositoriesPage, 'scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" })', "repositories-page.tsx: active AI repository must scroll into the center of the viewport");

const tooltip = await readFile(join(root, "src/components/ui/tooltip.tsx"), "utf8");
requireIncludes(tooltip, 'data-slot="tooltip-popup"', "tooltip.tsx: missing styled popup slot");
requireIncludes(tooltip, "bg-popover", "tooltip.tsx: tooltip must use the shared popover material");
requireIncludes(tooltip, "not-dark:bg-clip-padding", "tooltip.tsx: tooltip must keep light-mode material clipping");
requireIncludes(tooltip, "motion-reduce:transition-none", "tooltip.tsx: tooltip motion must respect reduced-motion");
requireIncludes(tooltip, "TooltipPopup as TooltipContent", "tooltip.tsx: missing TooltipContent compatibility alias");

const pagination = await readFile(join(root, "src/components/ui/pagination.tsx"), "utf8");
if ((pagination.match(/aria-hidden="true"/g) ?? []).length < 3) failures.push("pagination.tsx: decorative navigation icons must be hidden from assistive tech");

const radioGroup = await readFile(join(root, "src/components/ui/radio-group.tsx"), "utf8");
requireIncludes(radioGroup, 'data-slot="radio-group"', "radio-group.tsx: missing COSS RadioGroup slot contract");
requireIncludes(radioGroup, 'data-slot="radio"', "radio-group.tsx: missing COSS Radio slot contract");

const collapsible = await readFile(join(root, "src/components/ui/collapsible.tsx"), "utf8");
requireIncludes(collapsible, 'data-slot="collapsible-panel"', "collapsible.tsx: missing COSS CollapsiblePanel contract");

const drawer = await readFile(join(root, "src/components/ui/drawer.tsx"), "utf8");
requireIncludes(drawer, 'data-slot="drawer-popup"', "drawer.tsx: missing COSS DrawerPopup contract");
requireIncludes(drawer, "export function DrawerFooter", "drawer.tsx: missing COSS DrawerFooter contract");

const modal = await readFile(join(root, "src/components/ui/modal.tsx"), "utf8");
requireIncludes(modal, "<ResponsiveDialog", "modal.tsx: informational modal must share the ResponsiveDialog desktop/mobile contract");
if (modal.includes('from "./dialog"')) failures.push("modal.tsx: do not duplicate Dialog composition outside ResponsiveDialog");

const responsiveDialog = await readFile(join(root, "src/components/ui/responsive-dialog.tsx"), "utf8");
requireIncludes(responsiveDialog, "MOBILE_DIALOG_QUERY", "responsive-dialog.tsx: missing explicit mobile breakpoint contract");
requireIncludes(responsiveDialog, "<DialogPopup", "responsive-dialog.tsx: desktop path must use DialogPopup");
requireIncludes(responsiveDialog, "<DrawerPopup", "responsive-dialog.tsx: mobile path must use DrawerPopup");
requireIncludes(responsiveDialog, "<DialogFooter", "responsive-dialog.tsx: desktop actions must use DialogFooter");
requireIncludes(responsiveDialog, "<DrawerFooter", "responsive-dialog.tsx: mobile actions must use DrawerFooter");

const settingsList = await readFile(join(root, "src/components/patterns/settings-list.tsx"), "utf8");
for (const slot of ["settings-list", "settings-row", "settings-row-icon", "settings-row-content", "settings-row-actions"]) {
  requireIncludes(settingsList, `data-slot="${slot}"`, `settings-list.tsx: missing ${slot} pattern slot`);
}

const filterBar = await readFile(join(root, "src/components/patterns/filter-bar.tsx"), "utf8");
for (const slot of ["filter-bar", "filter-bar-mobile", "filter-bar-desktop", "filter-bar-search", "filter-bar-controls"]) {
  requireIncludes(filterBar, `data-slot="${slot}"`, `filter-bar.tsx: missing ${slot} pattern slot`);
}

const pageHeader = await readFile(join(root, "src/components/patterns/page-header.tsx"), "utf8");
for (const slot of ["page-header", "page-header-content", "page-header-title", "page-header-description", "page-header-actions"]) {
  requireIncludes(pageHeader, `data-slot="${slot}"`, `page-header.tsx: missing ${slot} pattern slot`);
}
requireIncludes(pageHeader, '"responsive"', "page-header.tsx: missing responsive layout contract");
requireIncludes(pageHeader, '"simple"', "page-header.tsx: missing simple layout contract");

const selectionToolbar = await readFile(join(root, "src/components/patterns/selection-toolbar.tsx"), "utf8");
requireIncludes(selectionToolbar, 'data-slot="selection-toolbar"', "selection-toolbar.tsx: missing toolbar slot");
requireIncludes(selectionToolbar, 'data-slot="selection-toolbar-label"', "selection-toolbar.tsx: missing label slot");

const alert = await readFile(join(root, "src/components/ui/alert.tsx"), "utf8");
requireIncludes(alert, "text-card-foreground", "alert.tsx: alert chrome should keep neutral text hierarchy");
requireIncludes(alert, "text-muted-foreground", "alert.tsx: descriptions should use muted hierarchy");

const statusBanner = await readFile(join(root, "src/components/ui/status-banner.tsx"), "utf8");
if ((statusBanner.match(/aria-hidden="true"/g) ?? []).length < 2) failures.push("status-banner.tsx: status icons must be decorative to assistive tech");

const empty = await readFile(join(root, "src/components/ui/empty.tsx"), "utf8");
requireIncludes(empty, 'aria-hidden="true"', "empty.tsx: decorative empty icon must be hidden from assistive tech");
requireIncludes(empty, "font-heading", "empty.tsx: title must use the heading font token");

const sidebar = await readFile(join(root, "src/components/ui/sidebar.tsx"), "utf8");
requireIncludes(sidebar, 'size = "sm"', "sidebar.tsx: SidebarMenuButton must default to a semantic Button size");
if (sidebar.includes('size = "none"')) failures.push("sidebar.tsx: SidebarMenuButton must not default to size=none");

const appShell = await readFile(join(root, "src/components/app-shell.tsx"), "utf8");
requireIncludes(appShell, "bg-success", "app-shell.tsx: session status must use semantic success color");
requireIncludes(appShell, "mobile-tabbar-item h-auto min-h-12", "app-shell.tsx: mobile tabbar must preserve its 48px visual/touch contract");
if (appShell.includes("bg-emerald-500")) failures.push("app-shell.tsx: raw success palette class returned");
if (appShell.includes('size="none"')) failures.push("app-shell.tsx: navigation must use semantic Button sizes");
if (styles.includes('[data-size="none"]')) failures.push("styles.css: coarse-pointer touch targets must not depend on size=none exceptions");

const aiServices = await readFile(join(root, "src/features/settings/ai-services-settings.tsx"), "utf8");
if (/<button\b/.test(aiServices)) failures.push("ai-services-settings.tsx: native button bypasses the Button contract");
requireIncludes(aiServices, 'size="icon-xs"', "ai-services-settings.tsx: compact model delete action must use Button icon-xs");
requireIncludes(aiServices, "<ResponsiveDialog", "ai-services-settings.tsx: form-heavy overlays must use ResponsiveDialog");
requireIncludes(aiServices, "<Collapsible", "ai-services-settings.tsx: advanced settings must use Collapsible");
if (aiServices.includes("<Modal")) failures.push("ai-services-settings.tsx: form-heavy overlays should not fall back to Modal");
if (aiServices.includes("<details")) failures.push("ai-services-settings.tsx: native details should use the shared Collapsible contract");

const settingsPage = await readFile(join(root, "src/features/settings/settings-page.tsx"), "utf8");
requireIncludes(settingsPage, "<RadioGroup value={settings.theme}", "settings-page.tsx: theme selection must use RadioGroup");
requireIncludes(settingsPage, "<RadioGroup value={settings.accent}", "settings-page.tsx: accent selection must use RadioGroup");
requireIncludes(settingsPage, '<PageHeader layout="simple" className="mb-4">', "settings-page.tsx: page heading must use simple PageHeader");
if (settingsPage.includes('role="radiogroup"') || settingsPage.includes('role="radio"')) failures.push("settings-page.tsx: appearance selection must not hand-roll radio ARIA roles");
if (settingsPage.includes('size="none"')) failures.push("settings-page.tsx: size=none should not bypass semantic Button sizes");

const categoryManager = await readFile(join(root, "src/features/repositories/category-manager.tsx"), "utf8");
requireIncludes(categoryManager, '<MenuItem variant="destructive"', "category-manager.tsx: destructive action must use MenuItem destructive variant");
if (categoryManager.includes('size="none"')) failures.push("category-manager.tsx: size=none should not bypass semantic Button sizes");

const repositoryEditor = await readFile(join(root, "src/features/repositories/repository-editor.tsx"), "utf8");
requireIncludes(repositoryEditor, "<ResponsiveDialog", "repository-editor.tsx: form-heavy editor must use ResponsiveDialog");
requireIncludes(repositoryEditor, "footer={", "repository-editor.tsx: editor actions must use the shared dialog footer contract");
if (repositoryEditor.includes("<Modal")) failures.push("repository-editor.tsx: form-heavy editor should not fall back to Modal");

const repositoriesPage = await readFile(join(root, "src/features/repositories/repositories-page.tsx"), "utf8");
requireIncludes(repositoriesPage, "<FilterBar>", "repositories-page.tsx: Stars filters must use the shared FilterBar pattern");
requireIncludes(repositoriesPage, "<ResponsiveDialog", "repositories-page.tsx: mobile Stars filters must use ResponsiveDialog/Drawer");
requireIncludes(repositoriesPage, "<PageHeader>", "repositories-page.tsx: Stars page heading must use the shared PageHeader pattern");
requireIncludes(repositoriesPage, "<SelectionToolbar>", "repositories-page.tsx: batch selection actions must use the shared SelectionToolbar pattern");
if (repositoriesPage.includes("<Modal")) failures.push("repositories-page.tsx: Stars filter overlay should not fall back to Modal");

const repositoryCard = await readFile(join(root, "src/features/repositories/repository-card.tsx"), "utf8");
if (repositoryCard.includes('size="none"')) failures.push("repository-card.tsx: title actions must use semantic Button sizes");

const releasesPage = await readFile(join(root, "src/features/releases/releases-page.tsx"), "utf8");
requireIncludes(releasesPage, "<FilterBar>", "releases-page.tsx: Release filters must use the shared FilterBar pattern");
requireIncludes(releasesPage, "<Collapsible", "releases-page.tsx: AI summary disclosure must use Collapsible");
requireIncludes(releasesPage, '<PageHeader layout="responsive">', "releases-page.tsx: page heading must use responsive PageHeader");
if (releasesPage.includes("<details")) failures.push("releases-page.tsx: native details should use the shared Collapsible contract");
if (releasesPage.includes('size="none"')) failures.push("releases-page.tsx: actions must use semantic Button sizes");

const forksPage = await readFile(join(root, "src/features/forks/forks-page.tsx"), "utf8");
requireIncludes(forksPage, "<FilterBar>", "forks-page.tsx: Fork filters must use the shared FilterBar pattern");
requireIncludes(forksPage, "<ResponsiveDialog", "forks-page.tsx: mobile Fork filters must use ResponsiveDialog/Drawer");
requireIncludes(forksPage, "<PageHeader>", "forks-page.tsx: Fork page heading must use the shared PageHeader pattern");
requireIncludes(forksPage, "<Collapsible", "forks-page.tsx: advanced Workflow inputs must use Collapsible");
if (forksPage.includes("<details")) failures.push("forks-page.tsx: native details should use the shared Collapsible contract");
if (forksPage.includes("bg-emerald-500")) failures.push("forks-page.tsx: workflow success state must use semantic success color");
if (forksPage.includes('size="none"')) failures.push("forks-page.tsx: actions must use semantic Button sizes");

const loginDevices = await readFile(join(root, "src/features/settings/login-devices-settings.tsx"), "utf8");
requireIncludes(loginDevices, "<SettingsList>", "login-devices-settings.tsx: device groups must use SettingsList");
requireIncludes(loginDevices, "<SettingsRow", "login-devices-settings.tsx: device entries must use SettingsRow");
requireIncludes(loginDevices, '<Badge variant="success" size="sm">', "login-devices-settings.tsx: current device state must use semantic Badge");

const discoverPage = await readFile(join(root, "src/features/discover/discover-page.tsx"), "utf8");
requireIncludes(discoverPage, "<FilterBar", "discover-page.tsx: loaded-result filtering must use the shared FilterBar pattern");
requireIncludes(discoverPage, "<FieldRoot", "discover-page.tsx: GitHub query controls must use Field semantics");
requireIncludes(discoverPage, "<FieldLabel", "discover-page.tsx: GitHub query controls must use Field labels");
requireIncludes(discoverPage, '<PageHeader layout="simple" className="mb-6">', "discover-page.tsx: page heading must use simple PageHeader");
if (discoverPage.includes("<label")) failures.push("discover-page.tsx: query controls should use Field instead of hand-rolled labels");
if (discoverPage.includes('size="none"')) failures.push("discover-page.tsx: size=none should not bypass semantic Button sizes");

for (const file of await walk(join(root, "src"))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const rel = relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (!rel.startsWith("src/components/ui/") && source.includes("@base-ui/react/")) {
    failures.push(`${rel}: import Base UI through src/components/ui instead of feature/product code`);
  }
  if (rel.startsWith("src/features/") && /<button\b/.test(source)) {
    failures.push(`${rel}: native <button> bypasses the shared Button contract`);
  }
  if (rel.startsWith("src/features/") && /<details\b/.test(source)) {
    failures.push(`${rel}: native <details> bypasses the shared Collapsible contract`);
  }
  if (source.includes('size="none"')) {
    failures.push(`${rel}: size=none is not part of the COSS Button contract`);
  }
  if (/\bspace-[xy]-/.test(source)) {
    failures.push(`${rel}: use flex/grid gap instead of Tailwind space-x/space-y utilities`);
  }
  if (!rawSemanticPaletteAllowlist.has(rel)) {
    const rawPaletteClasses = source.match(rawSemanticPaletteClass) ?? [];
    if (rawPaletteClasses.length) failures.push(`${rel}: raw semantic palette classes must use semantic tokens (${[...new Set(rawPaletteClasses)].join(", ")})`);
  }

}

if (failures.length) {
  console.error("UI source contract verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("UI source contract verification passed");
