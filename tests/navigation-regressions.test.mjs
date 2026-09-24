import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("navigation order is fixed and settings only control visibility", () => {
  const shell = source("src/components/app-shell.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  const preferences = source("src/lib/preferences.ts");

  assert.match(shell, /const NAV_ITEMS: AppPage\[\] = \["repositories", "releases", "forks", "discover", "settings"\]/);
  assert.doesNotMatch(shell, /settings\.navOrder/);
  const sidebarHeader = shell.slice(shell.indexOf("<SidebarHeader>"), shell.indexOf("</SidebarHeader>") + "</SidebarHeader>".length);
  assert.match(sidebarHeader, /<div className="mb-3 flex min-h-8 items-center gap-2 px-2 py-0 text-left" aria-label="StarBox">/);
  assert.doesNotMatch(sidebarHeader, /<Button|onClick=|hover:/);
  assert.match(settings, /Navigation order is fixed/);
  assert.match(settings, /NAV_ITEMS\.map/);
  assert.doesNotMatch(settings, /draggable|setDraggedNav|moveNav\(|moveNavTo|cursor-grab|Reorder /);
  assert.doesNotMatch(preferences, /navOrder: state\.settings\.navOrder|normalizeNavOrder/);
});
