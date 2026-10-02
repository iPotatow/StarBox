import type { StarBoxEnv } from "./types.js";

export function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function body(request: Request) {
  let value: unknown;
  try { value = await request.json(); } catch { throw new Error("请求 JSON 无效"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求 JSON 必须是对象");
  return value as Record<string, unknown>;
}

export function rejectClientTenant(record: Record<string, unknown>) { for (const key of ["account_id", "accountId", "github_user_id", "githubUserId"]) if (Object.prototype.hasOwnProperty.call(record, key)) throw new Error("客户端不得传入 tenant/account identity"); }

export const KEY_VERSION = "v1";

export function encryptionKey(env: StarBoxEnv) { return env.STARBOX_ENCRYPTION_KEY || ""; }

export function cleanHeaders(value: unknown) { const record = asRecord(value); return Object.fromEntries(Object.entries(record).filter(([key, item]) => key.trim() && typeof item === "string").map(([key, item]) => [key.trim(), String(item)])); }
