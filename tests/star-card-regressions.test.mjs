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

test("repository AI analysis does not generate, search, or render AI tags", () => {
  const worker = source("worker/index.ts");
  const types = source("src/types.ts");
  const page = source("src/features/repositories/repositories-page.tsx");
  const card = source("src/features/repositories/repository-card.tsx");

  assert.match(worker, /Return JSON only with: summary \(Chinese, <= 80 chars\), category \(Chinese, concise\)\./);
  assert.doesNotMatch(worker, /tags \(2-5 short strings\)/);
  assert.doesNotMatch(worker, /const tags = Array\.isArray\(parsed\.tags\)/);
  assert.doesNotMatch(worker, /return json\(\{ summary, category, tags \}\)/);
  assert.match(types, /interface AiOrganizeResult \{ summary: string; category: string; \}/);
  assert.doesNotMatch(page, /\.\.\.meta\.aiTags/);
  assert.doesNotMatch(page, /aiTags: result\.tags/);
  assert.match(card, /const tags = Array\.from\(new Set\(repository\.topics\)\)/);
  assert.doesNotMatch(card, /meta\.aiTags/);
});

test("page loading skeletons mirror their rendered layouts", () => {
  const skeleton = source("src/components/ui/skeleton.tsx");
  const discover = source("src/features/discover/discover-page.tsx");

  assert.match(skeleton, /variant = "star"/);
  assert.match(skeleton, /variant === "discover"/);
  assert.match(skeleton, /absolute right-4 top-4 z-10/);
  assert.match(skeleton, /mt-2 flex items-center justify-start gap-0\.5/);
  assert.match(skeleton, /grid-cols-\[minmax\(0,1fr\)_110px_140px_140px\]/);
  assert.match(skeleton, /max-md:grid-cols-\[minmax\(0,1fr\)_90px\]/);
  assert.match(skeleton, /grid gap-1 md:hidden/);
  assert.match(skeleton, /hidden md:block/);
  assert.match(discover, /grid gap-3 lg:grid-cols-2/);
  assert.match(discover, /RepositoryCardSkeleton key=\{index\} variant="discover"/);
  assert.doesNotMatch(discover, /RepositoryCardSkeleton key=\{index\} \/>/);
});
