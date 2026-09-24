import { test, expect } from "@playwright/test";

const repositories = ["alpha", "beta"].map((name, index) => ({
  id: index + 1, name, full_name: `test/${name}`, html_url: `https://github.com/test/${name}`,
  description: `${name} repository`, language: "TypeScript", topics: [], stargazers_count: 10 - index,
  forks_count: 0, owner: { login: "test", avatar_url: "" },
  starred_at: `2026-09-${12 - index}T00:00:00Z`, updated_at: "2026-09-10T00:00:00Z",
}));

const syncedToday = new Date().toISOString();

const releaseVersions = [
  {
    id: 101, repoFullName: "test/alpha", tagName: "v2.0.0", name: "v2.0.0", body: "Second release",
    htmlUrl: "https://github.com/test/alpha/releases/tag/v2.0.0", publishedAt: "2026-09-18T10:00:00Z", createdAt: "2026-09-18T10:00:00Z",
    draft: false, prerelease: false, author: null, assets: [],
  },
  {
    id: 100, repoFullName: "test/alpha", tagName: "v1.0.0", name: "v1.0.0", body: "First release",
    htmlUrl: "https://github.com/test/alpha/releases/tag/v1.0.0", publishedAt: "2026-09-10T10:00:00Z", createdAt: "2026-09-10T10:00:00Z",
    draft: false, prerelease: false, author: null, assets: [],
  },
];


test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = path === "/api/auth/session" ? { authenticated: true, username: "tester" }
      : path === "/api/bootstrap" ? { repositories, categories: [], repositoryMeta: [], releaseSubscriptions: [], releases: [], forks: [], githubCredential: { connected: true, login: "test" }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday, releases: syncedToday, forks: syncedToday } }
      : path === "/api/data/changes" ? { changes: [], lastSeq: 0 }
      : path === "/api/ai/services" ? { services: [], defaultModelId: null }
      : path.endsWith("/readme") ? { content: "# README content", htmlUrl: "https://github.com/test/beta/blob/main/README.md", path: "README.md", language: "default", availableLanguages: [{ language: "default", path: "README.md" }] }
      : {};
    await route.fulfill({ json: response });
  });
  await page.goto("/");
  await expect(page.locator("[data-repository-full-name]")).toHaveCount(2);
});

test("appearance controls stay aligned without stretching or overlap", async ({ page }) => {
  await page.goto("/settings?tab=appearance");

  const languageGroup = page.locator('[data-slot="toggle-group"]').filter({ has: page.getByRole("button", { name: "English", exact: true }) });
  await expect(languageGroup).toBeVisible();
  const languageBox = await languageGroup.boundingBox();
  expect(languageBox).not.toBeNull();
  expect(languageBox!.width).toBeLessThanOrEqual(220);

  const themeOptions = page.locator('[data-slot="theme-option"]');
  await expect(themeOptions).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const option = themeOptions.nth(index);
    const optionBox = await option.boundingBox();
    const radioBox = await option.locator('[data-slot="radio"]').boundingBox();
    expect(optionBox).not.toBeNull();
    expect(radioBox).not.toBeNull();
    expect(Math.abs(radioBox!.x - optionBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(radioBox!.y - optionBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(radioBox!.width - optionBox!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(radioBox!.height - optionBox!.height)).toBeLessThanOrEqual(2);
  }

  const accentOptions = page.locator('[data-slot="accent-option"]');
  await expect(accentOptions).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const box = await accentOptions.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(48);
  }
});

test("Release target device defaults from UA Client Hints and can be switched", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      configurable: true,
      get: () => ({
        platform: "macOS",
        getHighEntropyValues: async () => ({ architecture: "arm", bitness: "64" }),
      }),
    });
  });
  await page.goto("/releases");

  const deviceButton = page.getByRole("button", { name: "Device · macOS · ARM64", exact: true });
  await expect(deviceButton).toBeVisible();
  await deviceButton.click();

  const platform = page.getByRole("combobox", { name: "Platform", exact: true });
  const architecture = page.getByRole("combobox", { name: "Architecture", exact: true });
  await expect(platform).toContainText("macOS");
  await expect(architecture).toContainText("ARM64");

  await platform.click();
  await page.getByRole("option", { name: "Windows", exact: true }).click();
  await architecture.click();
  await page.getByRole("option", { name: "x64", exact: true }).click();
  await expect(platform).toContainText("Windows");
  await expect(architecture).toContainText("x64");
  await expect(page.getByRole("button", { name: "Use current device", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Use current device", exact: true }).click();
  await expect(platform).toContainText("macOS");
  await expect(architecture).toContainText("ARM64");
});

test("Release details use vertical tag tabs on desktop and a compact tag selector on mobile", async ({ page }) => {
  await page.route("**/api/bootstrap", async (route) => {
    await route.fulfill({ json: {
      repositories,
      categories: [],
      repositoryMeta: [],
      releaseSubscriptions: ["test/alpha"],
      releases: releaseVersions,
      forks: [],
      githubCredential: { connected: true, login: "test" },
      appPreferences: { ui_language: "en" },
      syncSummary: { stars: syncedToday, releases: syncedToday, forks: syncedToday },
    } });
  });
  await page.route("**/api/releases/feed", async (route) => {
    await route.fulfill({ json: { releases: releaseVersions, failures: [] } });
  });
  await page.route(/\/api\/releases\/test\/alpha\/\d+$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    await route.fulfill({ json: { release: releaseVersions.find((release) => release.id === id) ?? releaseVersions[0] } });
  });
  await page.goto("/releases");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "View details", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "View details", exact: true }).click();
  const dialog = page.locator('[data-slot="dialog-popup"], [data-slot="drawer-popup"]');
  await expect(dialog).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport!.width >= 640) {
    const tabs = dialog.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText("v2.0.0");
    await expect(tabs.nth(1)).toContainText("v1.0.0");
    await tabs.nth(1).click();
    await expect(dialog.getByRole("heading", { name: "v1.0.0", exact: true })).toBeVisible();
  } else {
    const tagSelect = dialog.getByRole("combobox", { name: "Select Release tag", exact: true });
    await expect(tagSelect).toBeVisible();
    await tagSelect.click();
    await page.getByRole("option", { name: /v1\.0\.0/ }).click();
    await expect(dialog.getByRole("heading", { name: "v1.0.0", exact: true })).toBeVisible();
  }
});

test("search, explicit sort direction, and non-modal AI filtering work at both viewport sizes", async ({ page }) => {
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search repositories" });
  await expect(search).toBeFocused();
  await search.fill("alpha");
  await expect(page.locator("[data-repository-full-name]")).toHaveCount(1);
  await search.fill("");

  const sort = page.getByRole("combobox", { name: "Sort field", exact: true });
  await sort.click();
  await page.getByRole("option", { name: "Star count", exact: true }).click();
  await expect(sort).toContainText("Star count");
  await expect(page.getByRole("listbox")).toHaveCount(0);

  const ascending = page.getByRole("button", { name: "Switch to ascending", exact: true });
  await expect(ascending).toBeVisible();
  await ascending.click();
  await expect(page.getByRole("button", { name: "Switch to descending", exact: true })).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (viewport!.width >= 768) await page.getByRole("button", { name: "Filter repositories", exact: true }).click();
  else await page.getByRole("button", { name: "Filter", exact: true }).click();

  const aiStatus = page.getByRole("combobox", { name: "AI analysis status", exact: true });
  await expect(aiStatus).toBeVisible();
  await aiStatus.click();
  await page.getByRole("option", { name: "Analyzed", exact: true }).click();
  await expect(page.locator("[data-repository-full-name]")).toHaveCount(0);
  await aiStatus.click();
  await page.getByRole("option", { name: "Not analyzed", exact: true }).click();
  await expect(page.locator("[data-repository-full-name]")).toHaveCount(2);
});

test("batch toolbar stays inside the viewport and keeps secondary actions in More", async ({ page }) => {
  await page.getByRole("checkbox", { name: "Select test/alpha", exact: true }).check();
  const toolbar = page.locator('[data-slot="selection-toolbar"]');
  await expect(toolbar).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  const viewport = page.viewportSize();
  expect(toolbarBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(toolbarBox!.x).toBeGreaterThanOrEqual(0);
  expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(viewport!.width);

  await expect(toolbar.getByRole("button", { name: "Select all results", exact: true })).toBeVisible();
  await toolbar.getByRole("button", { name: "More batch actions", exact: true }).click();
  const skipAnalyzed = page.getByRole("menuitemcheckbox", { name: "Skip unchanged analysis", exact: true });
  await expect(skipAnalyzed).toBeChecked();

  const menu = page.locator('[data-slot="menu-popup"]').last();
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport!.width);
});

test("repository details use one enlarged surface with inline README and menu focus recovery", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "test/alpha", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "README content" })).toBeVisible();

  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  expect(viewport).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  if (viewport!.width >= 640) expect(dialogBox!.width).toBeGreaterThanOrEqual(1200);

  await dialog.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "DeepWiki" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("late README response cannot replace a newly opened repository", async ({ page }) => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  let started: () => void = () => {};
  const requested = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/api/github/repos/test/alpha/readme*", async (route) => {
    started(); await pending;
    await route.fulfill({ json: { content: "# Stale alpha README", htmlUrl: "https://github.com/test/alpha/blob/main/README.md", path: "README.md", language: "default", availableLanguages: [{ language: "default", path: "README.md" }] } });
  });
  await page.getByRole("button", { name: "test/alpha", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await requested;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "test/beta", exact: true }).click();
  const nextDialog = page.getByRole("dialog");
  await expect(nextDialog.getByRole("heading", { name: "test/beta", exact: true })).toBeVisible();
  finish();
  await expect(nextDialog.getByRole("heading", { name: "README content" })).toBeVisible();
  await expect(nextDialog.getByText("Stale alpha README")).toHaveCount(0);
});
