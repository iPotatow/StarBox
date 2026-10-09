import { jsonRequest } from "./api-client";

export type RepositorySearchItem = {
  fullName: string;
  score: number;
  scoringDetails: {
    vector_score?: number;
    keyword_score?: number;
    keyword_rank?: number;
    vector_rank?: number;
    reranking_score?: number;
    fusion_method?: string;
    [key: string]: unknown;
  };
};

export type RepositorySearchResponse = {
  available: boolean;
  needsRebuild: boolean;
  items: RepositorySearchItem[];
  error?: string;
};

type SearchFilters = {
  language?: string;
  category?: string;
  ai?: "all" | "analyzed" | "unanalyzed";
};

type SearchIndexResponse = {
  ok: boolean;
  needsRebuild?: boolean;
  rebuilt?: boolean;
  indexed: number;
  failed: string[];
  total?: number;
  nextOffset?: number | null;
  done?: boolean;
};

const SEARCH_INDEX_BATCH_SIZE = 20;

export async function searchRepositories(query: string, filters: SearchFilters = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: "50" });
  if (filters.language) params.set("language", filters.language);
  if (filters.category) params.set("category", filters.category);
  if (filters.ai && filters.ai !== "all") params.set("ai", filters.ai);
  return jsonRequest<RepositorySearchResponse>(`/api/search?${params.toString()}`, { signal });
}

export async function indexRepositorySearch(fullNames: string[]) {
  let indexed = 0;
  const failed: string[] = [];
  for (let index = 0; index < fullNames.length; index += SEARCH_INDEX_BATCH_SIZE) {
    const page = await jsonRequest<SearchIndexResponse>("/api/search/index", {
      method: "POST",
      body: JSON.stringify({ fullNames: fullNames.slice(index, index + SEARCH_INDEX_BATCH_SIZE) }),
    });
    indexed += page.indexed;
    failed.push(...page.failed);
    if (page.needsRebuild) return { ...page, indexed, failed };
  }
  return { ok: failed.length === 0, needsRebuild: false, indexed, failed } satisfies SearchIndexResponse;
}

export async function rebuildRepositorySearchIndex(signal?: AbortSignal) {
  let offset = 0;
  let total = 0;
  let indexed = 0;
  const failed: string[] = [];
  while (true) {
    const page = await jsonRequest<SearchIndexResponse>("/api/search/index", {
      method: "POST",
      body: JSON.stringify({ rebuild: true, offset, limit: SEARCH_INDEX_BATCH_SIZE }),
      signal,
    });
    indexed += page.indexed;
    failed.push(...page.failed);
    total = page.total ?? total;
    if (page.done || page.nextOffset == null) return { ok: failed.length === 0, indexed, failed, total };
    offset = page.nextOffset;
  }
}
