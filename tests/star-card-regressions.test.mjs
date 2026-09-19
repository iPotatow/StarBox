import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("Star cards keep a stable header rhythm and expose persisted AI analyzed state", () => {
  const card = source("src/features/repositories/repository-card.tsx");
  const page = source("src/features/repositories/repositories-page.tsx");

  assert.match(card, /className="flex h-5 w-full/);
  assert.match(card, /className="mt-1 flex min-h-5 min-w-0 flex-wrap items-center/);
  assert.match(card, /visibleStatusItems\.map/);
  assert.match(card, /hiddenStatusItems\.map/);
  assert.match(card, /RiInformationLine/);
  assert.match(card, /RiEditLine/);
  assert.match(card, /const aiAnalyzed = Boolean\(meta\.aiSummary\.trim\(\)\)/);
  assert.match(card, /key: "ai"[\s\S]*variant: "success"/);
  assert.match(card, /AI 已分析，点击重新分析/);
  assert.match(card, /import \{ BorderBeam \} from "border-beam";/);
  assert.match(card, /<BorderBeam active=\{aiLoading\} size="md" colorVariant="colorful"[\s\S]*?<Card/);
  assert.match(card, /data-repository-full-name=\{repository\.full_name\}/);
  assert.match(page, /querySelectorAll<HTMLElement>\("\[data-repository-full-name\]"\)/);
  assert.match(page, /scrollIntoView\(\{ behavior: reduceMotion \? "auto" : "smooth", block: "center", inline: "nearest" \}\)/);
  assert.doesNotMatch(card, /ThinkingOrb/);
  assert.doesNotMatch(card, /role="status"/);
  assert.doesNotMatch(card, /opacity-65/);
  assert.doesNotMatch(card, /aiLoading && "animate-pulse/);
  assert.doesNotMatch(card, /\bdensity\b/);
  assert.doesNotMatch(page, /settings\.density|density=/);
});

test("repository AI keeps tags private and derives visible platforms from Releases", () => {
  const worker = source("worker/index.ts");
  const api = source("src/lib/api.ts");
  const types = source("src/types.ts");
  const page = source("src/features/repositories/repositories-page.tsx");
  const card = source("src/features/repositories/repository-card.tsx");
  const releaseAssets = source("src/lib/release-assets.ts");

  assert.match(worker, /tags \(2-5 short Chinese strings\)/);
  assert.match(worker, /const tags = Array\.isArray\(parsed\.tags\)/);
  assert.match(worker, /resolveReleasePlatforms\(request, env, fullName\)/);
  assert.match(worker, /releases\?per_page=5&page=1/);
  assert.match(worker, /Name: \$\{repo\.name\}/);
  assert.doesNotMatch(worker, /Stars: \$\{repo\.stargazers_count\}/);
  assert.doesNotMatch(worker, /Platform hints:/);
  assert.doesNotMatch(worker, /platforms \(array using only/);
  assert.match(api, /fullName: repository\.full_name/);
  assert.match(api, /name: repository\.name/);
  assert.doesNotMatch(api, /stargazers_count: repository\.stargazers_count/);
  assert.doesNotMatch(api, /owner: repository\.owner/);
  assert.match(types, /aiTags: string\[\]/);
  assert.match(types, /interface AiOrganizeResult \{ summary: string; category: string; tags: string\[\]; platforms: string\[\]; \}/);
  assert.match(page, /\.\.\.meta\.aiTags/);
  assert.match(page, /aiTags: result\.tags/);
  assert.match(page, /inferReleasePlatforms/);
  assert.match(releaseAssets, /export function inferReleasePlatforms/);
  assert.doesNotMatch(card, /aria-label=\{t\("AI 标签", "AI tags"\)\}/);
  assert.doesNotMatch(card, /aiTags\.map/);
  assert.match(card, /aria-label=\{t\("支持平台", "Platforms"\)\}/);
  assert.match(card, /variant="outline" size="sm"/);
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
