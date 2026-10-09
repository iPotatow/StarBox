import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRepositorySearchDocument,
  repositoryFullNameFromSearchKey,
  repositorySearchKey,
} from "../.test-build/worker/routes/search.js";

test("repository search keys round-trip unicode full names", () => {
  const fullName = "示例组织/菜单栏工具";
  const key = repositorySearchKey(fullName);
  assert.equal(repositoryFullNameFromSearchKey(key), fullName);
  assert.equal(repositoryFullNameFromSearchKey("other/file.md"), "");
});

test("repository search document contains semantic fields without README", () => {
  const document = buildRepositorySearchDocument({
    full_name: "owner/repo",
    description: "A fast menu bar system monitor",
    language: "Swift",
    note: "我用来监控 CPU",
    ai_summary: "macOS 菜单栏性能监控工具",
    ai_tags_json: JSON.stringify(["monitoring", "menu-bar"]),
    platforms_json: JSON.stringify(["macOS"]),
    starred_at: "2026-10-01T00:00:00Z",
    github_snapshot_json: JSON.stringify({ topics: ["swift", "system-monitor"] }),
    category: "Utilities",
  });

  assert.match(document, /Repository: owner\/repo/);
  assert.match(document, /Description: A fast menu bar system monitor/);
  assert.match(document, /Topics: swift, system-monitor/);
  assert.match(document, /AI Summary: macOS 菜单栏性能监控工具/);
  assert.match(document, /AI Tags: monitoring, menu-bar/);
  assert.match(document, /Category: Utilities/);
  assert.match(document, /Note: 我用来监控 CPU/);
  assert.match(document, /Platforms: macOS/);
  assert.doesNotMatch(document, /README:/);
});
