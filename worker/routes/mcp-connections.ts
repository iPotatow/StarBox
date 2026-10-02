import { z } from "zod";
import { json, sha256Hex } from "../http.js";
import { body, rejectClientTenant } from "../request.js";
import { apiError } from "../errors.js";
import type { StarBoxEnv } from "../types.js";
import type { McpToken, McpTokenCreated } from "../../shared/mcp.js";
import { McpRepository } from "../mcp/repository.js";

const createSchema = z.object({ name: z.string().trim().min(1).max(80), writeMetadata: z.boolean().default(false), expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(90) }).strict();
const updateSchema = z.object({ writeMetadata: z.boolean() }).strict();
export async function handleMcpConnections(request: Request, env: StarBoxEnv, id?: string) {
  if (!env.DB) return apiError("database_not_ready", "Worker 未配置 D1 DB", 503);
  const repository = new McpRepository(env.DB);
  if (request.method === "GET" && !id) return json({ endpoint: new URL("/mcp", request.url).href, tokens: await repository.tokens() });
  if (request.method === "DELETE" && id) {
    return await repository.revokeToken(id) ? json({ ok: true }) : apiError("not_found", "MCP 连接不存在", 404);
  }
  let data: Record<string, unknown>;
  try { data = await body(request); rejectClientTenant(data); }
  catch { return apiError("invalid_input", "MCP 请求必须为有效 JSON 对象", 400); }
  if (request.method === "PATCH" && id) {
    const parsed = updateSchema.safeParse(data);
    if (!parsed.success) return apiError("invalid_input", "MCP 权限参数无效", 400);
    return await repository.updateToken(id, parsed.data.writeMetadata) ? json({ ok: true }) : apiError("not_found", "MCP 连接不存在", 404);
  }
  if (request.method !== "POST" || id) return apiError("method_not_allowed", "MCP 连接不支持该方法", 405);
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) return apiError("invalid_input", "请输入 1–80 字的连接名称，有效期为 7、30 或 90 天", 400);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = "sb_mcp_" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const connection: McpToken = { id: crypto.randomUUID(), name: parsed.data.name, writeMetadata: parsed.data.writeMetadata, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + parsed.data.expiresInDays * 86400_000).toISOString(), lastUsedAt: null };
  await repository.createToken(await sha256Hex(token), connection);
  return json<McpTokenCreated>({ token, connection }, { status: 201 });
}
