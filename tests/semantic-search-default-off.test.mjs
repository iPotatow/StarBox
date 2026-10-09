import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("semantic search is opt-in and disabled by default", () => {
  const storage = read("src/lib/storage.ts");
  const page = read("src/features/repositories/repositories-page.tsx");
  const settings = read("src/features/settings/settings-page.tsx");
  assert.ok(storage.includes("semanticSearchEnabled: false"));
  assert.ok(page.includes("if (!semanticSearchEnabled)"));
  assert.ok(page.includes("semanticActive = semanticSearchEnabled &&"));
  assert.ok(settings.includes("checked={settings.semanticSearchEnabled}"));
});
