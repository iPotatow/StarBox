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
  assert.match(card, /import \{ BorderBeam \} from "border-beam";/);
  assert.match(card, /import \{ ThinkingOrb \} from "thinking-orbs";/);
  assert.match(card, /<BorderBeam active=\{aiLoading\} size="md" colorVariant="colorful"/);
  assert.match(card, /<ThinkingOrb state="working" size=\{20\} theme="auto" aria-hidden="true" \/>/);
  assert.doesNotMatch(card, /aiLoading && "animate-pulse/);
  assert.doesNotMatch(card, /\bdensity\b/);
  assert.doesNotMatch(page, /settings\.density|density=/);
});

test("repository AI tags are generated, searchable, persisted, and visually distinct from GitHub Topics", () => {
  const worker = source("worker/index.ts");
  const types = source("src/types.ts");
  const page = source("src/features/repositories/repositories-page.tsx");
  const card = source("src/features/repositories/repository-card.tsx");

  assert.match(worker, /tags \(2-5 short Chinese strings\)/);
  assert.match(worker, /const tags = Array\.isArray\(parsed\.tags\)/);
  assert.match(worker, /return json\(\{ summary, category, tags, platforms \}\)/);
  assert.match(types, /aiTags: string\[\]/);
  assert.match(types, /interface AiOrganizeResult \{ summary: string; category: string; tags: string\[\]; platforms: string\[\]; \}/);
  assert.match(page, /\.\.\.meta\.aiTags/);
  assert.match(page, /aiTags: result\.tags/);
  assert.match(card, /const aiTags = Array\.from\(new Set\(meta\.aiTags\)\)/);
  assert.match(card, /aria-label=\{t\("AI 标签", "AI tags"\)\}/);
  assert.match(card, /<SparklesIcon className="size-3\.5" aria-hidden="true" \/>/);
  assert.match(card, /aiTags\.map\(\(tag\) => <Badge key=\{tag\} variant="info"/);
  assert.match(card, /const topics = Array\.from\(new Set\(repository\.topics\)\)/);
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
