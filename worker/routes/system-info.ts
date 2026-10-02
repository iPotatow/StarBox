import { json, sha256Hex } from "../http.js";
import { validateEncryptionKey } from "../crypto.js";
import type { StarBoxEnv } from "../types.js";
import { parseBuildInfo, type SystemInfo } from "../../shared/system-info.js";

const PRODUCT_TABLES = ["categories", "ai_services", "ai_models", "credentials", "repositories", "forks", "app_sessions", "settings"];
async function buildInfo(request: Request, env: StarBoxEnv) {
  if (!env.ASSETS) return null;
  try {
    const response = await env.ASSETS.fetch(new Request(new URL("/build-info.json", request.url), { headers: { Accept: "application/json" } }));
    return response.ok ? parseBuildInfo(await response.json()) : null;
  } catch { return null; }
}
async function databaseInfo(env: StarBoxEnv): Promise<SystemInfo["database"]> {
  if (!env.DB) return { backend: null, status: "unconfigured", schemaFingerprint: null, tableCount: null };
  try {
    const result = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name <> 'd1_migrations' ORDER BY name").all<{ name: string; sql: string }>();
    const rows = result.results ?? [];
    const names = new Set(rows.map((row) => row.name));
    const fingerprint = await sha256Hex(JSON.stringify(rows.map((row) => [row.name, row.sql.replace(/\s+/g, " ").trim()])));
    return { backend: "D1", status: PRODUCT_TABLES.every((name) => names.has(name)) ? "ready" : "incomplete", schemaFingerprint: fingerprint.slice(0, 16), tableCount: rows.length };
  } catch { return { backend: "D1", status: "unavailable", schemaFingerprint: null, tableCount: null }; }
}
export async function handleSystemInfo(request: Request, env: StarBoxEnv) {
  const [build, database] = await Promise.all([buildInfo(request, env), databaseInfo(env)]);
  const version = env.CF_VERSION_METADATA;
  return json<SystemInfo>({
    build, database,
    worker: { versionId: version?.id || null, tag: version?.tag || null, createdAt: version?.timestamp && Number.isFinite(Date.parse(version.timestamp)) ? version.timestamp : null },
    checks: { auth: Boolean(env.LOGIN_PASSWORD?.trim()), encryption: Boolean(env.STARBOX_ENCRYPTION_KEY?.trim()) && validateEncryptionKey(env.STARBOX_ENCRYPTION_KEY!) },
    retrievedAt: new Date().toISOString(),
  });
}
