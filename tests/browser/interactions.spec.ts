import { test, expect } from "@playwright/test";

const repositories = ["alpha", "beta"].map((name, index) => ({
  id: index + 1, name, full_name: `test/${name}`, html_url: `https://github.com/test/${name}`,
  description: `${name} repository`, language: "TypeScript", topics: [], stargazers_count: 10 - index,
  forks_count: 0, owner: { login: "test", avatar_url: "" },
  starred_at: `2026-09-${12 - index}T00:00:00Z`, updated_at: "2026-09-10T00:00:00Z",
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = path === "/api/auth/session" ? { authenticated: true, username: "tester" }
      : path === "/api/bootstrap" ? { repositories, categories: [], repositoryMeta: [], releaseSubscriptions: [], releases: [], forks: [], githubCredential: { connected: true, login: "test" }, appPreferences: { ui_language: "en" } }
      : path === "/api/data/changes" ? { changes: [], lastSeq: 0 }
      : path === "/api/ai/services" ? { services: [], defaultModelId: null }
      : path.endsWith("/readme") ? { content: "# README content", htmlUrl: "https://github.com/test/beta" }
      : {};
    await route.fulfill({ json: response });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "View details", exact: true })).toHaveCount(2);
});

test("visible search shortcut and items-based Select work at both viewport sizes", async ({ page }) => {
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search repositories" });
  await expect(search).toBeFocused();
  await search.fill("alpha");
  await expect(page.getByRole("button", { name: "View details", exact: true })).toHaveCount(1);
  await search.fill("");
  const sort = page.getByRole("combobox", { name: "Sort", exact: true });
  await sort.click();
  await page.getByRole("option", { name: "Star count", exact: true }).click();
  await expect(sort).toContainText("Star count");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("COSS modal, tabs and menu compose and return focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "View details", exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "DeepWiki" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "README", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "README content" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("late README response cannot replace the next repository", async ({ page }) => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  let started: () => void = () => {};
  const requested = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/api/github/repos/test/alpha/readme", async (route) => {
    started(); await pending;
    await route.fulfill({ json: { content: "# Stale alpha README", htmlUrl: "https://github.com/test/alpha" } });
  });
  await page.getByRole("button", { name: "View details", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "README", exact: true }).click();
  await requested;
  await dialog.getByRole("button", { name: "Next repository" }).click();
  await expect(dialog.getByRole("heading", { name: "test/beta", exact: true })).toBeVisible();
  finish();
  await dialog.getByRole("tab", { name: "README", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "README content" })).toBeVisible();
  await expect(dialog.getByText("Stale alpha README")).toHaveCount(0);
});
