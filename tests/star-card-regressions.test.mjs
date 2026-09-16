import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("Star cards keep a stable header rhythm and expose persisted AI analyzed state", () => {
  const card = source("src/features/repositories/repository-card.tsx");
  const page = source("src/features/repositories/repositories-page.tsx");

  assert.match(card, /className="flex h-5 w-full/);
  assert.match(card, /className="mt-1 flex h-5 min-w-0 flex-nowrap items-center/);
  assert.match(card, /const aiAnalyzed = Boolean\(meta\.aiSummary\.trim\(\)\)/);
  assert.match(card, /variant="success"[\s\S]*AI 已分析/);
  assert.match(card, /AI 已分析，点击重新分析/);
  assert.doesNotMatch(card, /\bdensity\b/);
  assert.doesNotMatch(page, /settings\.density|density=/);
});
