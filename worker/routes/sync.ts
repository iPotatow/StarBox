import { caughtError } from "../http.js";
import type { BootstrapPayload, MutationResponse } from "../../shared/contracts.js";
import { error, json } from "../http.js";
import { body, rejectClientTenant, asRecord } from "../request.js";
import { fullPreferences } from "../preferences.js";
import type { StarBoxEnv, Identity } from "../types.js";
import { DataRepository, MutationRequestError } from "../repository.js";

export async function handleSync(request: Request, env: StarBoxEnv, identity: Identity, action: "delta" | "cursor" | "release" | "fork") { if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); try { if (action === "delta") { const url = new URL(request.url); const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 50)); const after = Math.max(0, Number(url.searchParams.get("after") || url.searchParams.get("cursor")) || 0); return json(await repository.changes(after, limit)); } const record = await body(request); rejectClientTenant(record); const scope = typeof record.scope === "string" && record.scope.trim() ? record.scope.trim() : action; const revision = Math.max(0, Number(record.revision) || 0); const cursor = typeof record.cursor === "string" ? record.cursor : null; await repository.saveSyncState(scope, cursor, revision); return json({ scope, cursor, revision }); } catch (reason) { return caughtError(reason, "同步状态请求失败", 400); } }

export async function handleBootstrap(_request: Request, env: StarBoxEnv, _identity: Identity) { if (!env.DB) return error("Worker 未配置 D1 DB", 503); const snapshot = await new DataRepository(env.DB).bootstrap(); const preferences = await fullPreferences(env); return json<BootstrapPayload>({ ...snapshot, account: snapshot.account ? { ...snapshot.account, github_avatar_url: preferences?.github_avatar_url || null } : snapshot.account, githubCredential: { ...snapshot.githubCredential, avatarUrl: preferences?.github_avatar_url || undefined }, appPreferences: preferences ?? snapshot.appPreferences }); }

export async function handleSyncMutation(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("Worker 未配置 D1 DB", 503); let mutationStarted = false;
  try {
    const record = await body(request); rejectClientTenant(record); const nestedMutation = asRecord(record.mutation); const operationValue = typeof record.operation === "string" ? record.operation : nestedMutation.operation; if (typeof operationValue !== "string") throw new MutationRequestError("mutation operation 无效"); const payloadValue = record.payload ?? nestedMutation.payload; const payload = payloadValue && typeof payloadValue === "object" ? payloadValue as Record<string, unknown> : record; rejectClientTenant(payload); const batchNames = payload.repoFullNames; if (Array.isArray(batchNames) && batchNames.length > 100) throw new MutationRequestError("单次批量操作最多 100 个仓库"); const mutationIdValue = record.id ?? record.mutationId ?? nestedMutation.id; if (typeof mutationIdValue !== "string" || !mutationIdValue.trim() || mutationIdValue.trim().length > 256) throw new MutationRequestError("mutation.id 无效"); mutationStarted = true; const repository = new DataRepository(env.DB);
    const result = await repository.mutate(operationValue, payload, mutationIdValue.trim()); return json<MutationResponse>({ ...result, state: {} });
  } catch (reason) { const status = reason && typeof reason === "object" && "status" in reason ? Number((reason as { status: number }).status) : mutationStarted ? 500 : 400; return caughtError(reason, "同步 mutation 失败", status); }
}

export async function handleNotifications(request: Request, env: StarBoxEnv, _identity: Identity, notificationId = "") { if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); if (request.method === "GET") { const url = new URL(request.url); return json({ items: await repository.listNotifications(Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50))) }); } await repository.markNotificationRead(notificationId); await repository.change("notification", notificationId, "read"); return json({ ok: true }); }
