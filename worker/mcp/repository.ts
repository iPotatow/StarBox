import type { D1Database } from "../types.js";
import type { McpToken } from "../../shared/mcp.js";

const PREFIX = "mcp.token.";
type TokenRow = { key: string; value: string };
function readToken(row: TokenRow): McpToken {
  const data = JSON.parse(row.value) as McpToken;
  return { id: data.id, name: data.name, writeMetadata: data.writeMetadata === true, createdAt: data.createdAt, expiresAt: data.expiresAt, lastUsedAt: data.lastUsedAt ?? null };
}
const COLUMNS = "r.full_name, r.html_url, r.description, r.language, r.default_branch, r.is_starred, r.starred_at, r.category_id, c.name AS category_name, r.category_locked, r.note, r.ai_summary, r.ai_tags_json, r.release_subscribed, r.github_updated_at, r.github_pushed_at, r.synced_at, r.user_updated_at, r.user_revision, r.release_ai_release_id, r.release_ai_summary_json, r.release_ai_generated_at, r.github_snapshot_json";
const FROM = "FROM repositories r LEFT JOIN categories c ON c.category_id = r.category_id";
function repositoryResult(row: Record<string, unknown>): Record<string, unknown> {
  const { ai_tags_json, release_ai_summary_json, github_snapshot_json, ...data } = row;
  const snapshot = JSON.parse(String(github_snapshot_json || "{}")) as Record<string, unknown>;
  return { ...data, stars: snapshot.stargazers_count ?? null, forks: snapshot.forks_count ?? null, archived: snapshot.archived ?? null, topics: snapshot.topics ?? [], license: snapshot.license ?? null, is_starred: Boolean(data.is_starred), category_locked: Boolean(data.category_locked), release_subscribed: Boolean(data.release_subscribed), ai_tags: JSON.parse(String(ai_tags_json || "[]")), release_ai_summary: release_ai_summary_json ? JSON.parse(String(release_ai_summary_json)) : null };
}

/** MCP credentials share the settings table but never enter the public preferences contract. */
export class McpRepository {
  constructor(private readonly db: D1Database) {}
  async tokens() {
    const rows = await this.db.prepare("SELECT key, value FROM settings WHERE key LIKE 'mcp.token.%' ORDER BY updated_at DESC").all<TokenRow>();
    return (rows.results ?? []).map(readToken);
  }
  async tokenByHash(hash: string) {
    const row = await this.db.prepare("SELECT key, value FROM settings WHERE key = ?1").bind(PREFIX + hash).first<TokenRow>();
    return row ? readToken(row) : null;
  }
  async createToken(hash: string, token: McpToken) {
    await this.db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)").bind(PREFIX + hash, JSON.stringify(token), token.createdAt).run();
  }
  async touchToken(hash: string, now: string) {
    // Patch only the timestamp: a concurrent permission change must never be overwritten.
    await this.db.prepare("UPDATE settings SET value = json_set(value, '$.lastUsedAt', ?1) WHERE key = ?2").bind(now, PREFIX + hash).run();
  }
  async updateToken(id: string, writeMetadata: boolean) {
    const result = await this.db.prepare("UPDATE settings SET value = json_set(value, '$.writeMetadata', json(?1)), updated_at = ?2 WHERE key LIKE 'mcp.token.%' AND json_extract(value, '$.id') = ?3").bind(JSON.stringify(writeMetadata), new Date().toISOString(), id).run();
    return Number(result.meta?.changes ?? 0) > 0;
  }
  async revokeToken(id: string) {
    const result = await this.db.prepare("DELETE FROM settings WHERE key LIKE 'mcp.token.%' AND json_extract(value, '$.id') = ?1").bind(id).run();
    return Number(result.meta?.changes ?? 0) > 0;
  }
  async search(input: { query?: string; language?: string; categoryId?: string | null; tag?: string; subscribed?: boolean; limit: number; offset: number }) {
    const values: unknown[] = [];
    const conditions = [input.subscribed ? "r.release_subscribed = 1" : "r.is_starred = 1"];
    const bind = (value: unknown) => { values.push(value); return `?${values.length}`; };
    if (input.query) {
      const pattern = bind(`%${input.query.replace(/[\\%_]/g, "\\$&")}%`);
      conditions.push(`(r.full_name LIKE ${pattern} ESCAPE '\\' OR r.description LIKE ${pattern} ESCAPE '\\' OR r.note LIKE ${pattern} ESCAPE '\\' OR r.ai_summary LIKE ${pattern} ESCAPE '\\' OR c.name LIKE ${pattern} ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(r.ai_tags_json) WHERE value LIKE ${pattern} ESCAPE '\\'))`);
    }
    if (input.language) conditions.push(`r.language = ${bind(input.language)} COLLATE NOCASE`);
    if (input.categoryId === null) conditions.push("r.category_id IS NULL");
    else if (input.categoryId !== undefined) conditions.push(`r.category_id = ${bind(input.categoryId)}`);
    if (input.tag) conditions.push(`EXISTS (SELECT 1 FROM json_each(r.ai_tags_json) WHERE value = ${bind(input.tag)} COLLATE NOCASE)`);
    const limit = bind(input.limit + 1); const offset = bind(input.offset);
    const rows = await this.db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(r.starred_at, r.synced_at, r.user_updated_at) DESC, r.full_name COLLATE NOCASE LIMIT ${limit} OFFSET ${offset}`).bind(...values).all<Record<string, unknown>>();
    const items = rows.results ?? [];
    return { items: items.slice(0, input.limit).map(repositoryResult), nextOffset: items.length > input.limit ? input.offset + input.limit : null, retrievedAt: new Date().toISOString(), source: "StarBox synced data" };
  }
  async repository(fullName: string) {
    const row = await this.db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE r.full_name = ?1`).bind(fullName).first<Record<string, unknown>>();
    return row ? repositoryResult(row) : null;
  }
  async categories() {
    return (await this.db.prepare("SELECT category_id AS id, name, color, sort_order, locked FROM categories ORDER BY sort_order, created_at, category_id").all()).results ?? [];
  }
  async categoryExists(id: string) {
    return Boolean(await this.db.prepare("SELECT category_id FROM categories WHERE category_id = ?1").bind(id).first());
  }
}
