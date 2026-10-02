import { test, expect } from "@playwright/test";

const repositories = ["alpha", "beta"].map((name, index) => ({
  id: index + 1, name, full_name: `test/${name}`, html_url: `https://github.com/test/${name}`,
  description: `${name} repository`, language: "TypeScript", topics: [], stargazers_count: 10 - index,
  forks_count: 0, owner: { login: "test", avatar_url: "" },
  starred_at: `2026-09-${12 - index}T00:00:00Z`, updated_at: "2026-09-10T00:00:00Z", github_updated_at: "2026-09-10T00:00:00Z",
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
      : path === "/api/auth/devices" ? { devices: [] }
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


test("README failure waits for an explicit retry", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/github/repos/test/alpha/readme*", async (route) => {
    requests += 1;
    await route.fulfill(requests === 1 ? { status: 502, json: { error: "README unavailable" } } : { json: { content: "# Recovered README", htmlUrl: "https://github.com/test/alpha", path: "README.md", language: "default", availableLanguages: [] } });
  });
  await page.getByRole("button", { name: "test/alpha", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("README unavailable")).toBeVisible();
  // Trigger another UI update; the error must still suppress autoload.
  await page.setViewportSize({ width: 420, height: 900 });
  await expect(dialog.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Recovered README" })).toBeVisible();
  expect(requests).toBe(2);
});

test("metadata conflicts preserve the editor draft and show the save failure", async ({ page }) => {
  await page.route("**/api/sync/mutate", async (route) => {
    await route.fulfill({ status: 409, json: { error: "Revision conflict" } });
  });
  await page.locator('[data-repository-full-name="test/alpha"]').getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Notes", exact: true }).fill("Keep this draft");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByText("Save failed. Check the error and try again.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Notes", exact: true })).toHaveValue("Keep this draft");
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
});

test("a failed page chunk offers reload and recovers without losing navigation", async ({ page }) => {
  const pattern = "**/chunks/settings-page-*.js";
  await page.route(pattern, (route) => route.abort("failed"));
  await page.goto("/settings?tab=appearance");
  await expect(page.getByRole("alert")).toContainText(/could not load|无法加载/);
  await expect(page.getByRole("button", { name: /Reload|重新加载/, exact: true })).toBeVisible();
  await page.unroute(pattern);
  await page.getByRole("button", { name: /Reload|重新加载/, exact: true }).click();
  await expect(page.getByRole("button", { name: "English", exact: true })).toBeVisible();
});

const configuredAi = { services: [{ id: "s1", name: "Test service", protocol: "openai-compatible", baseUrl: "https://example.test/v1", enabled: true, credentialConfigured: true, models: [{ id: "m1", remoteModelId: "test-model", displayName: "Test model", enabled: true }] }], defaultModelId: "m1" };

test("AI registry survives a later legacy bootstrap", async ({ page }) => {
  await page.route("**/api/ai/services", (route) => route.fulfill({ json: configuredAi }));
  await page.route("**/api/bootstrap", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: { repositories, categories: [], repositoryMeta: [], releaseSubscriptions: [], releases: [], forks: [], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, aiCredential: { configured: false }, syncSummary: { stars: syncedToday } } });
  });
  await page.reload();
  await expect(page.locator("[data-repository-full-name]")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "AI analysis", exact: true }).first()).toBeEnabled();
});

test("Release settings controls fit the viewport", async ({ page }) => {
  await page.goto("/settings?tab=release");
  const toggle = page.getByRole("switch", { name: "Include prereleases", exact: true });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("settings tab persists through refresh", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop tab navigation");
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await expect(page).toHaveURL(/tab=appearance/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Appearance", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("search cannot relabel an older Release as latest", async ({ page }) => {
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, categories: [], repositoryMeta: [], releaseSubscriptions: ["test/alpha"], releases: releaseVersions, forks: [], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday, releases: syncedToday } } }));
  await page.route("**/api/releases/feed**", (route) => route.fulfill({ json: { releases: releaseVersions, failures: [] } }));
  await page.goto("/releases");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "View details", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("First release");
  await expect(page.getByRole("button", { name: "View details", exact: true })).toHaveCount(0);
});

test("AI edits show failures in the dialog and allow explicitly clearing headers", async ({ page }) => {
  await page.route("**/api/ai/services", (route) => route.fulfill({ json: configuredAi }));
  await page.goto("/settings?tab=ai");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.route("**/api/ai/services/s1", (route) => route.fulfill({ status: 500, json: { error: "Service save failed" } }));
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Service save failed");
  await dialog.getByRole("button", { name: "Advanced settings", exact: true }).click();
  await dialog.getByRole("switch", { name: "Replace custom headers", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Custom headers", exact: true }).fill("{}");
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/ai/services/s1", async (route) => { payload = route.request().postDataJSON(); await route.fulfill({ json: configuredAi }); });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  expect(payload?.headers).toEqual({});
});

test("importing an export preserves the active GitHub connection", async ({ page }) => {
  await page.goto("/settings?tab=data");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export device state", exact: true }).click();
  const file = await (await download).path();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await page.getByRole("dialog").getByRole("button", { name: "Import", exact: true }).click();
  await page.goto("/discover");
  await expect(page.getByRole("button", { name: "Search GitHub", exact: true })).toBeEnabled();
});

test("failed unstar waits for the response and never announces success", async ({ page }) => {
  await page.route("**/api/discover**", (route) => route.fulfill({ json: { repositories } }));
  let finish: (() => void) | undefined;
  await page.route("**/api/github/stars/test/alpha", async (route) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    await route.fulfill({ status: 500, json: { error: "GitHub rejected request" } });
  });
  await page.goto("/discover");
  await page.getByRole("button", { name: "Search GitHub", exact: true }).click();
  const hold = page.getByRole("button", { name: "Hold for 1.2 seconds to unstar test/alpha", exact: true });
  await hold.focus();
  await page.keyboard.down("Space");
  await expect(hold).toHaveAttribute("aria-busy", "true");
  await page.keyboard.up("Space");
  await expect(hold).not.toHaveAttribute("data-confirmed", "");
  finish!();
  await expect(hold).toBeEnabled();
  await expect(hold).not.toHaveAttribute("data-confirmed", "");
  await expect(page.getByText("GitHub rejected request", { exact: true })).toBeVisible();
});

test("empty login fields expose visible validation messages", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: false } }));
  await page.reload();
  await page.getByRole("button", { name: /Sign in|登录/, exact: true }).click();
  await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
});

test("tablet toolbar and narrow Release settings remain reachable", async ({ page }, testInfo) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/settings?tab=release");
    const toggle = page.getByRole("switch", { name: "Include prereleases", exact: true });
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`release-settings-${width}.png`) });
  }
  await page.goto("/");
  const toolbar = page.getByRole("toolbar", { name: "Stars toolbar", exact: true });
  await expect(toolbar).toBeVisible();
  const outside = await toolbar.locator("button,[role=combobox]").evaluateAll((controls) => controls.filter((control) => control.getClientRects().length && control.getBoundingClientRect().right > innerWidth).map((control) => control.textContent));
  expect(outside).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("tablet-toolbar.png") });
});


test("subscription blocks duplicate clicks and recovers a stale revision", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let writes = 0;
  let finishFirst!: () => void;
  const gate = new Promise<void>((resolve) => { finishFirst = resolve; });
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, categories: [], repositoryMeta: [{ full_name: "test/alpha", user_revision: 7 }], releaseSubscriptions: [], githubCredential: { connected: true }, syncSummary: { stars: syncedToday } } }));
  await page.route("**/api/sync/mutate", async (route) => {
    const body = route.request().postDataJSON(); writes++;
    if (writes === 1) { await gate; await route.fulfill({ status: 409, json: { error: "Revision conflict" } }); }
    else { expect(body.payload.expectedUserRevision).toBe(7); await route.fulfill({ json: { userRevisions: { "test/alpha": 8 } } }); }
  });
  const card = page.locator('[data-repository-full-name="test/alpha"]');
  await card.getByRole("button", { name: "Subscribe to Releases", exact: true }).click();
  const pending = card.locator('button[aria-busy="true"]');
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveCount(1);
  finishFirst();
  const subscribed = card.getByRole("button", { name: "Unsubscribe from Releases", exact: true });
  await expect(subscribed).toBeEnabled();
  await expect(subscribed).toHaveAttribute("aria-pressed", "true");
  expect(writes).toBe(2); expect(errors).toEqual([]);
});

test("subscription failure restores the button after a repeated conflict", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, repositoryMeta: [{ full_name: "test/alpha", user_revision: 2 }], releaseSubscriptions: [] } }));
  await page.route("**/api/sync/mutate", async (route) => { writes++; await route.fulfill({ status: 409, json: { error: "Revision conflict" } }); });
  const card = page.locator('[data-repository-full-name="test/alpha"]');
  await card.getByRole("button", { name: "Subscribe to Releases", exact: true }).click();
  await expect(page.getByText(/Failed to update Release subscription/).first()).toBeVisible();
  await expect(card.getByRole("button", { name: "Subscribe to Releases", exact: true })).toBeEnabled();
  expect(writes).toBe(2);
});

test("desktop toolbars keep control groups aligned and inside their surface", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop and tablet toolbar layout");
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of ["/", "/releases", "/forks"]) {
      await page.goto(path);
      const toolbar = page.locator('[data-slot="filter-bar-desktop"]');
      await expect(toolbar).toBeVisible();
      const layout = await toolbar.evaluate((surface) => {
        const bounds = surface.getBoundingClientRect();
        const controls = Array.from(surface.querySelectorAll('[data-slot="filter-bar-controls"] button'))
          .filter((control) => control.getClientRects().length)
          .map((control) => {
            const rect = control.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top };
          });
        return { left: bounds.left, right: bounds.right, controls };
      });
      expect(layout.controls.length).toBeGreaterThan(0);
      for (const control of layout.controls) {
        expect(control.left).toBeGreaterThanOrEqual(layout.left);
        expect(control.right).toBeLessThanOrEqual(layout.right);
      }
      const rows = layout.controls.map((control) => control.top);
      expect(Math.max(...rows) - Math.min(...rows)).toBeLessThan(5);
      if (width === 1440) {
        const search = await toolbar.getByRole("searchbox").boundingBox();
        expect(Math.abs(search!.y - rows[0])).toBeLessThan(8);
      }
    }
  }
});

test("long category names cannot push repository editor controls outside the dialog", async ({ page }) => {
  const category = "A very long category name for repository organization";
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, categories: [{ category_id: "c1", name: category, color: "blue", sort_order: 0 }], repositoryMeta: [{ github_repo_id: "test/alpha", category_id: "c1", note: "Original saved note" }], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday } } }));
  await page.reload();
  await page.locator('[data-repository-full-name="test/alpha"]').getByRole("button", { name: "Edit", exact: true }).click();
  const popup = page.locator('[data-slot="dialog-popup"], [data-slot="drawer-popup"]');
  await expect(popup.getByRole("button", { name: "Manage categories", exact: true })).toBeVisible();
  const bounds = await popup.boundingBox();
  for (const control of await popup.locator('button,textarea,[role="combobox"]').all()) {
    const rect = await control.boundingBox();
    if (!rect) continue;
    expect(rect.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
  await popup.getByRole("button", { name: "Manage categories", exact: true }).click();
  await expect(page).toHaveURL(/tab=categories/);
});

test("discarding a conflicted editor draft does not change the saved card", async ({ page }) => {
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, repositoryMeta: [{ github_repo_id: "test/alpha", note: "Original saved note", user_revision: 1 }], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday } } }));
  await page.route("**/api/sync/mutate", (route) => route.fulfill({ status: 409, json: { error: "Revision conflict" } }));
  await page.reload();
  const card = page.locator('[data-repository-full-name="test/alpha"]');
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const popup = page.locator('[data-slot="dialog-popup"], [data-slot="drawer-popup"]');
  await popup.getByRole("textbox", { name: "Notes", exact: true }).fill("Unsaved conflicted draft");
  await popup.getByRole("button", { name: "Save", exact: true }).click();
  await expect(popup.getByText("Save failed. Check the error and try again.", { exact: true })).toBeVisible();
  await expect(popup.getByRole("textbox", { name: "Notes", exact: true })).toHaveValue("Unsaved conflicted draft");
  await popup.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(card).toContainText("Original saved note");
  await expect(card.getByText("Unsaved conflicted draft", { exact: true })).toHaveCount(0);
});

test("mobile Settings back clears the detail URL and survives refresh", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile settings navigation");
  await page.goto("/settings?tab=ai");
  await page.getByRole("button", { name: "Back to Settings", exact: true }).click();
  await expect(page).not.toHaveURL(/tab=/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Back to Settings", exact: true })).toHaveCount(0);
});

test("popular Discover results consistently show an unrestricted time range", async ({ page }) => {
  await page.route("**/api/discover**", (route) => route.fulfill({ json: { repositories } }));
  await page.goto("/discover");
  await page.getByRole("button", { name: "Popular", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Period", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Search GitHub", exact: true }).click();
  await expect(page.getByText(/Popular · All languages · All topics · Any time/)).toBeVisible();
});

test("failed category renames keep the name draft available for retry", async ({ page }) => {
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, categories: [{ category_id: "c1", name: "Original category", color: "blue", sort_order: 0 }], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday } } }));
  await page.route("**/api/sync/mutate", (route) => route.fulfill({ status: 500, json: { error: "Category save failed" } }));
  await page.goto("/settings?tab=categories");
  await page.getByRole("button", { name: "Original category", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Category name: Original category", exact: true });
  await input.fill("Keep this name draft");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Category save failed");
  await expect(page.getByRole("textbox", { name: "Category name: Original category", exact: true })).toHaveValue("Keep this name draft");
});

test("Release AI failures remain visible inside the open details surface", async ({ page }) => {
  await page.route("**/api/ai/services", (route) => route.fulfill({ json: configuredAi }));
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, releaseSubscriptions: ["test/alpha"], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday, releases: syncedToday } } }));
  await page.route("**/api/releases/feed**", (route) => route.fulfill({ json: { releases: releaseVersions, failures: [] } }));
  await page.route(/\/api\/releases\/test\/alpha\/\d+$/, (route) => route.fulfill({ json: { release: releaseVersions[0] } }));
  await page.route("**/api/ai/release-summary", (route) => route.fulfill({ status: 502, json: { error: "AI summary unavailable" } }));
  await page.goto("/releases");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  const popup = page.locator('[data-slot="dialog-popup"], [data-slot="drawer-popup"]');
  await popup.getByRole("button", { name: "AI summary", exact: true }).click();
  await expect(popup.getByRole("alert")).toContainText("AI summary unavailable");
  await expect(popup.getByRole("button", { name: "AI summary", exact: true })).toBeEnabled();
});

test("tablet Release cards keep version notes readable", async ({ page, isMobile }) => {
  test.skip(isMobile, "Tablet content area with desktop sidebar");
  await page.setViewportSize({ width: 768, height: 960 });
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { repositories, releaseSubscriptions: ["test/alpha"], githubCredential: { connected: true }, appPreferences: { ui_language: "en" }, syncSummary: { stars: syncedToday, releases: syncedToday } } }));
  await page.route("**/api/releases/feed**", (route) => route.fulfill({ json: { releases: releaseVersions, failures: [] } }));
  await page.goto("/releases");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  const notes = page.getByText("Second release", { exact: true });
  await expect(notes).toBeVisible();
  const notesRect = await notes.boundingBox();
  const delivery = await page.getByText("This release has no assets", { exact: true }).boundingBox();
  expect(notesRect!.width).toBeGreaterThan(200);
  expect(delivery!.y).toBeGreaterThan(notesRect!.y + notesRect!.height);
});

test("tablet Fork rows keep upstream headings separate and actions reachable", async ({ page, isMobile }) => {
  test.skip(isMobile, "Tablet content area with desktop sidebar");
  await page.setViewportSize({ width: 768, height: 960 });
  const fork = { id: 1, fullName: "test/fork", htmlUrl: "https://github.com/test/fork", description: "Fork fixture", defaultBranch: "main", pushedAt: syncedToday, owner: { login: "test", avatarUrl: "" }, parentFullName: "upstream/alpha", parentHtmlUrl: "https://github.com/upstream/alpha", aheadBy: 0, behindBy: 3, compareStatus: "behind", latestWorkflow: null, workflows: [] };
  await page.route("**/api/forks/list", (route) => route.fulfill({ json: { forks: [fork], complete: true } }));
  await page.goto("/forks");
  await page.getByRole("button", { name: "Refresh GitHub", exact: true }).click();
  const row = page.getByRole("article").filter({ has: page.getByRole("button", { name: "test/fork", exact: true }) });
  await expect(row.getByText("Upstream: upstream/alpha", { exact: true })).toBeVisible();
  const sync = await row.getByRole("button", { name: "Sync", exact: true }).boundingBox();
  const bounds = await row.boundingBox();
  expect(sync!.x + sync!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
});

test("tablet Settings can scroll to the final tab", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop tab strip on tablet width");
  await page.setViewportSize({ width: 768, height: 960 });
  await page.goto("/settings?tab=appearance");
  const tab = page.getByRole("tab", { name: "Device data", exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/tab=data/);
  const rect = await tab.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(224);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(768);
});

test("narrow mobile navigation labels stay inside their buttons", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  for (const button of await nav.getByRole("button").all()) {
    const buttonRect = await button.boundingBox();
    const labelRect = await button.locator("span").boundingBox();
    expect(labelRect!.x).toBeGreaterThanOrEqual(buttonRect!.x);
    expect(labelRect!.x + labelRect!.width).toBeLessThanOrEqual(buttonRect!.x + buttonRect!.width + 1);
  }
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/settings/);
});
