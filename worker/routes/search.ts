import { error, json, parseBody } from "../http.js";
import type { AiSearchChunk, AiSearchInstance, StarBoxEnv } from "../types.js";

export const SEARCH_INSTANCE_ID = "starbox-repositories";
export const SEARCH_REBUILD_PAGE_SIZE = 20;
const SEARCH_MAX_RESULTS = 50;

type SearchRepositoryRow = {
  full_name: string;
  description: string | null;
  language: string | null;
  note: string | null;
  ai_summary: string | null;
  ai_tags_json: string;
  platforms_json: string;
  starred_at: string | null;
  github_snapshot_json: string;
  category: string | null;
};

type SearchIndexBody = {
  fullNames?: unknown;
  rebuild?: unknown;
  offset?: unknown;
  limit?: unknown;
};

function parseStringArray(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  } catch {
    return [] as string[];
  }
}

function parseSnapshot(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function cleanStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

export function repositorySearchKey(fullName: string) {
  return `repos/${encodeURIComponent(fullName)}.md`;
}

export function repositoryFullNameFromSearchKey(key: string) {
  if (!key.startsWith("repos/") || !key.endsWith(".md")) return "";
  try {
    return decodeURIComponent(key.slice("repos/".length, -".md".length));
  } catch {
    return "";
  }
}

export function buildRepositorySearchDocument(row: SearchRepositoryRow) {
  const snapshot = parseSnapshot(row.github_snapshot_json);
  const topics = cleanStrings(snapshot.topics);
  const aiTags = parseStringArray(row.ai_tags_json);
  const platforms = parseStringArray(row.platforms_json);
  const parts = [`# ${row.full_name}`, `Repository: ${row.full_name}`];
  if (row.description?.trim()) parts.push(`Description: ${row.description.trim()}`);
  if (row.language?.trim()) parts.push(`Language: ${row.language.trim()}`);
  if (topics.length) parts.push(`Topics: ${topics.join(", ")}`);
  if (row.ai_summary?.trim()) parts.push(`AI Summary: ${row.ai_summary.trim()}`);
  if (aiTags.length) parts.push(`AI Tags: ${aiTags.join(", ")}`);
  if (row.category?.trim()) parts.push(`Category: ${row.category.trim()}`);
  if (row.note?.trim()) parts.push(`Note: ${row.note.trim()}`);
  if (platforms.length) parts.push(`Platforms: ${platforms.join(", ")}`);
  return `${parts.join("\n\n")}\n`;
}

function metadataFor(row: SearchRepositoryRow) {
  return {
    language: row.language?.trim() || "__none__",
    category: row.category?.trim() || "__uncategorized__",
    ai_analyzed: row.ai_summary?.trim() ? "1" : "0",
  };
}

async function searchInstanceExists(env: StarBoxEnv) {
  if (!env.AI_SEARCH) return false;
  const instances = await env.AI_SEARCH.list();
  return Boolean(instances.result?.some((item) => item.id === SEARCH_INSTANCE_ID));
}

async function createSearchInstance(env: StarBoxEnv) {
  if (!env.AI_SEARCH) throw new Error("Worker 未配置 AI Search");
  return env.AI_SEARCH.create({
    id: SEARCH_INSTANCE_ID,
    custom_metadata: [
      { field_name: "language", data_type: "text" },
      { field_name: "category", data_type: "text" },
      { field_name: "ai_analyzed", data_type: "text" },
    ],
  });
}

async function ensureSearchInstance(env: StarBoxEnv) {
  if (!env.AI_SEARCH) throw new Error("Worker 未配置 AI Search");
  if (await searchInstanceExists(env)) return env.AI_SEARCH.get(SEARCH_INSTANCE_ID);
  try {
    return await createSearchInstance(env);
  } catch (reason) {
    if (await searchInstanceExists(env)) return env.AI_SEARCH.get(SEARCH_INSTANCE_ID);
    throw reason;
  }
}

async function resetSearchInstance(env: StarBoxEnv) {
  if (!env.AI_SEARCH) throw new Error("Worker 未配置 AI Search");
  if (await searchInstanceExists(env)) await env.AI_SEARCH.delete(SEARCH_INSTANCE_ID);
  return createSearchInstance(env);
}

function repositoriesSql(extraWhere = "", suffix = "") {
  return `SELECT r.full_name, r.description, r.language, r.note, r.ai_summary, r.ai_tags_json, r.platforms_json, r.starred_at, r.github_snapshot_json, c.name AS category
    FROM repositories r
    LEFT JOIN categories c ON c.category_id = r.category_id
    WHERE r.is_starred = 1${extraWhere}
    ORDER BY COALESCE(r.starred_at, r.synced_at) DESC${suffix}`;
}

async function allRepositoryPage(env: StarBoxEnv, offset: number, limit: number) {
  if (!env.DB) return [] as SearchRepositoryRow[];
  const rows = await env.DB.prepare(repositoriesSql("", " LIMIT ?1 OFFSET ?2")).bind(limit, offset).all<SearchRepositoryRow>();
  return rows.results ?? [];
}

async function selectedRepositories(env: StarBoxEnv, fullNames: string[]) {
  if (!env.DB || !fullNames.length) return [] as SearchRepositoryRow[];
  const placeholders = fullNames.map((_, index) => `?${index + 1}`).join(", ");
  const rows = await env.DB.prepare(repositoriesSql(` AND r.full_name IN (${placeholders})`)).bind(...fullNames).all<SearchRepositoryRow>();
  return rows.results ?? [];
}

async function starredRepositoryCount(env: StarBoxEnv) {
  if (!env.DB) return 0;
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM repositories WHERE is_starred = 1").first<{ count: number }>();
  return Math.max(0, Number(row?.count) || 0);
}

async function deleteExistingItem(instance: AiSearchInstance, key: string) {
  const page = await instance.items.list({ search: key, source: "builtin", per_page: 50 });
  const exact = (page.result ?? []).filter((item) => item.key === key);
  await Promise.all(exact.map((item) => instance.items.delete(item.id)));
}

async function uploadRepository(instance: AiSearchInstance, row: SearchRepositoryRow, replaceExisting: boolean) {
  const key = repositorySearchKey(row.full_name);
  if (replaceExisting) await deleteExistingItem(instance, key);
  await instance.items.upload(key, buildRepositorySearchDocument(row), { metadata: metadataFor(row) });
}

function normalizedFullNames(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const fullName = item.trim();
    if (fullName && fullName.length <= 200) unique.add(fullName);
  }
  return [...unique];
}

export async function handleRepositorySearchIndex(request: Request, env?: StarBoxEnv) {
  if (!env?.DB) return error("Worker 未配置 D1 DB", 503);
  if (!env.AI_SEARCH) return error("Worker 未配置 AI Search", 503);

  const body = await parseBody<SearchIndexBody>(request);
  const fullNames = normalizedFullNames(body.fullNames);
  if (fullNames.length > 100) return error("单次最多更新 100 个仓库的搜索索引", 400);

  const rebuild = body.rebuild === true;
  const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
  const limit = Math.min(SEARCH_REBUILD_PAGE_SIZE, Math.max(1, Math.floor(Number(body.limit) || SEARCH_REBUILD_PAGE_SIZE)));
  if (!rebuild && !fullNames.length) return error("需要指定 fullNames 或 rebuild", 400);

  let instance: AiSearchInstance;
  let rows: SearchRepositoryRow[];
  let total = 0;
  let replaceExisting = true;

  if (rebuild) {
    instance = offset === 0 ? await resetSearchInstance(env) : await ensureSearchInstance(env);
    rows = await allRepositoryPage(env, offset, limit);
    total = await starredRepositoryCount(env);
    replaceExisting = false;
  } else {
    const existed = await searchInstanceExists(env);
    if (!existed) return json({ ok: false, needsRebuild: true, indexed: 0, failed: [] as string[] });
    instance = env.AI_SEARCH.get(SEARCH_INSTANCE_ID);
    rows = await selectedRepositories(env, fullNames);
  }

  const results = await Promise.allSettled(rows.map((row) => uploadRepository(instance, row, replaceExisting)));
  const failed = results.flatMap((result, index) => result.status === "rejected" ? [rows[index].full_name] : []);
  const indexed = results.length - failed.length;
  const nextOffset = rebuild ? offset + rows.length : null;
  const done = rebuild ? offset + rows.length >= total || rows.length === 0 : true;

  return json({ ok: failed.length === 0, needsRebuild: false, rebuilt: rebuild, indexed, failed, total, nextOffset, done });
}

function searchFilters(url: URL) {
  const filters: Record<string, string> = {};
  const language = url.searchParams.get("language")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const ai = url.searchParams.get("ai")?.trim();
  if (language) filters.language = language;
  if (category) filters.category = category === "__uncategorized" ? "__uncategorized__" : category;
  if (ai === "analyzed") filters.ai_analyzed = "1";
  if (ai === "unanalyzed") filters.ai_analyzed = "0";
  return filters;
}

function chunkScore(chunk: AiSearchChunk) {
  return Number(chunk.score ?? chunk.scoring_details?.reranking_score ?? chunk.scoring_details?.vector_score ?? 0) || 0;
}

async function currentStarredSet(env: StarBoxEnv, fullNames: string[]) {
  if (!env.DB || !fullNames.length) return new Set<string>();
  const placeholders = fullNames.map((_, index) => `?${index + 1}`).join(", ");
  const rows = await env.DB.prepare(`SELECT full_name FROM repositories WHERE is_starred = 1 AND full_name IN (${placeholders})`).bind(...fullNames).all<{ full_name: string }>();
  return new Set((rows.results ?? []).map((row) => row.full_name));
}

export async function handleRepositorySearch(request: Request, env?: StarBoxEnv) {
  if (!env?.DB || !env.AI_SEARCH) return json({ available: false, needsRebuild: false, items: [] });
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return json({ available: true, needsRebuild: false, items: [] });

  try {
    if (!(await searchInstanceExists(env))) return json({ available: false, needsRebuild: true, items: [] });
    const filters = searchFilters(url);
    const limit = Math.min(SEARCH_MAX_RESULTS, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || SEARCH_MAX_RESULTS)));
    const response = await env.AI_SEARCH.get(SEARCH_INSTANCE_ID).search({
      query,
      ai_search_options: {
        retrieval: {
          retrieval_type: "hybrid",
          fusion_method: "rrf",
          max_num_results: limit,
          ...(Object.keys(filters).length ? { filters } : {}),
        },
      },
    });

    const byName = new Map<string, AiSearchChunk>();
    for (const chunk of response.chunks ?? []) {
      const fullName = repositoryFullNameFromSearchKey(chunk.item.key);
      if (fullName && !byName.has(fullName)) byName.set(fullName, chunk);
    }
    const names = [...byName.keys()];
    const current = await currentStarredSet(env, names);
    const items = names
      .filter((fullName) => current.has(fullName))
      .map((fullName) => {
        const chunk = byName.get(fullName)!;
        return { fullName, score: chunkScore(chunk), scoringDetails: chunk.scoring_details ?? {} };
      });
    return json({ available: true, needsRebuild: false, items });
  } catch (reason) {
    return json({ available: false, needsRebuild: false, items: [], error: reason instanceof Error ? reason.message : "AI Search 查询失败" });
  }
}
