import { decryptAiCredentials, decryptGithubToken, encryptAiCredentials, encryptGithubToken } from "./crypto.js";
import { currentTimeIso, sessionTokenFromRequest, sha256Hex } from "./auth.js";
import { DataRepository, MutationRequestError } from "./repository.js";
import { PRIMARY_ACCOUNT_ID } from "./types.js";
import type { Identity, StarBoxEnv } from "./types.js";
import type { ProviderConfig } from "./provider.js";
import { loadDefaultAiProviderConfig } from "./ai-services.js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function error(message: string, status = 400) { return json({ error: message }, { status }); }
function asRecord(value: unknown) { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
async function body(request: Request) { try { return asRecord(await request.json()); } catch { throw new Error("请求 JSON 无效"); } }
function rejectClientTenant(record: Record<string, unknown>) { for (const key of ["account_id", "accountId", "github_user_id", "githubUserId"]) if (Object.prototype.hasOwnProperty.call(record, key)) throw new Error("客户端不得传入 tenant/account identity"); }
const KEY_VERSION = "v1";
function encryptionKey(env: StarBoxEnv) { return env.STARBOX_ENCRYPTION_KEY || ""; }
function cleanHeaders(value: unknown) { const record = asRecord(value); return Object.fromEntries(Object.entries(record).filter(([key, item]) => key.trim() && typeof item === "string").map(([key, item]) => [key.trim(), String(item)])); }


export async function hydrateGithubToken(request: Request, env: StarBoxEnv, identity: Identity) {
  const key = encryptionKey(env);
  if (request.headers.get("x-starbox-github-token")?.trim() || !env.DB || !key) return request;
  const repository = new DataRepository(env.DB);
  const record = await repository.credential();
  if (!record || record.status !== "active") return request;
  let token = "";
  try { token = await decryptGithubToken(record, key); } catch { return request; }
  if (!token) return request;
  const headers = new Headers(request.headers); headers.set("x-starbox-github-token", token);
  return new Request(request, { headers });
}

export async function handleGithubCredential(request: Request, env: StarBoxEnv, identity: Identity) {
  if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB);
  if (request.method === "GET") { const record = await repository.credential(); return json(record ? { connected: true, githubUserId: record.github_numeric_id, login: record.github_login, fingerprint: record.fingerprint, keyVersion: record.key_version, validatedAt: record.validated_at, status: record.status } : { connected: false }); }
  const record = await body(request); rejectClientTenant(record);
  if (request.method === "DELETE") { const old = await repository.credential(); if (!old) return json({ connected: false }); await repository.deleteCredential(); await repository.recordActivity("github_credential_deleted", { fingerprint: null }); await repository.change("credential", PRIMARY_ACCOUNT_ID, "delete"); return json({ connected: false }); }
  if (request.method !== "PUT") return error("Credential 路由不支持该方法", 405);
  const token = typeof record.token === "string" ? record.token.trim() : ""; if (!token) return error("GitHub Token 不能为空", 400);
  const validation = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "StarBox-Workers", "X-GitHub-Api-Version": "2026-03-10" } }); if (!validation.ok) return error(validation.status === 401 ? "GitHub Token 无效或已过期" : "GitHub Token 校验失败", validation.status === 403 ? 403 : 401);
  const user = asRecord(await validation.json()); const githubNumericId = String(user.id ?? ""); const login = typeof user.login === "string" ? user.login : ""; if (!githubNumericId || !login) return error("GitHub /user 返回缺少身份字段", 502); if (!env.STARBOX_ENCRYPTION_KEY) return error("Worker 未配置 STARBOX_ENCRYPTION_KEY", 503);
  const account = await repository.account();
  const boundGithubUserId = account?.github_user_id?.trim() || "";
  if (boundGithubUserId && boundGithubUserId !== githubNumericId) return error("当前 StarBox 已绑定其他 GitHub 账号；如需切换账号，请先执行独立的数据重置流程", 409);
  const encrypted = await encryptGithubToken(token, env.STARBOX_ENCRYPTION_KEY, PRIMARY_ACCOUNT_ID, githubNumericId, KEY_VERSION); const timestamp = currentTimeIso(); await repository.saveCredential({ account_id: PRIMARY_ACCOUNT_ID, github_numeric_id: githubNumericId, github_login: login, ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: encrypted.keyVersion, fingerprint: encrypted.fingerprint, validated_at: timestamp, created_at: timestamp, updated_at: timestamp, status: "active" }); await repository.recordActivity("github_credential_saved", { fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion }); await repository.change("credential", PRIMARY_ACCOUNT_ID, "upsert"); return json({ connected: true, githubUserId: githubNumericId, login, fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion, validatedAt: timestamp });
}

export async function handleSync(request: Request, env: StarBoxEnv, identity: Identity, action: "delta" | "cursor" | "release" | "fork") {
  if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB);
  try { if (action === "delta") { const url = new URL(request.url); const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 50)); const after = Math.max(0, Number(url.searchParams.get("after") || url.searchParams.get("cursor")) || 0); return json(await repository.changes(after, limit)); } const record = await body(request); rejectClientTenant(record); const scope = typeof record.scope === "string" && record.scope.trim() ? record.scope.trim() : action; const revision = Math.max(0, Number(record.revision) || 0); const cursor = typeof record.cursor === "string" ? record.cursor : null; await repository.saveSyncState(scope, cursor, revision); return json({ scope, cursor, revision }); } catch (reason) { return error(reason instanceof Error ? reason.message : "同步状态请求失败", 400); }
}
export async function handleBootstrap(_request: Request, env: StarBoxEnv, _identity: Identity) { if (!env.DB) return error("Worker 未配置 D1 DB", 503); return json(await new DataRepository(env.DB).bootstrap()); }
export async function handleSyncMutation(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("Worker 未配置 D1 DB", 503);
  let mutationStarted = false;
  try {
    const record = await body(request);
    rejectClientTenant(record);
    const nestedMutation = asRecord(record.mutation);
    const operationValue = typeof record.operation === "string" ? record.operation : nestedMutation.operation;
    if (typeof operationValue !== "string") throw new MutationRequestError("mutation operation 无效");
    const payloadValue = record.payload ?? nestedMutation.payload;
    const payload = payloadValue && typeof payloadValue === "object" ? payloadValue as Record<string, unknown> : record;
    rejectClientTenant(payload);
    const batchNames = payload.repoFullNames;
    if (Array.isArray(batchNames) && batchNames.length > 100) throw new MutationRequestError("单次批量操作最多 100 个仓库");
    const mutationIdValue = record.id ?? record.mutationId ?? nestedMutation.id;
    if (typeof mutationIdValue !== "string" || !mutationIdValue.trim() || mutationIdValue.trim().length > 256) throw new MutationRequestError("mutation.id 无效");
    const mutationId = mutationIdValue.trim();
    mutationStarted = true;
    const result = await new DataRepository(env.DB).mutate(operationValue, payload, mutationId);
    return json({ ...result, state: {} });
  } catch (reason) {
    const status = reason && typeof reason === "object" && "status" in reason ? Number((reason as { status: number }).status) : mutationStarted ? 500 : 400;
    return error(reason instanceof Error ? reason.message : "同步 mutation 失败", status);
  }
}
export async function handleNotifications(request: Request, env: StarBoxEnv, _identity: Identity, notificationId = "") { if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); if (request.method === "GET") { const url = new URL(request.url); return json({ items: await repository.listNotifications(Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50))) }); } await repository.markNotificationRead(notificationId); await repository.change("notification", notificationId, "read"); return json({ ok: true }); }

export async function loadAiProviderConfig(env: StarBoxEnv, draft?: Partial<ProviderConfig>): Promise<ProviderConfig> {
  if (draft?.baseUrl && draft?.apiKey && draft?.model) return { providerName: draft.providerName || "Custom HTTP", protocol: draft.protocol, baseUrl: draft.baseUrl, apiKey: draft.apiKey, model: draft.model, headers: draft.headers ?? {} };
  return loadDefaultAiProviderConfig(env);
}

export async function handleAiConfig(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("云端配置暂不可用", 503);
  const repository = new DataRepository(env.DB);
  if (request.method === "GET") {
    const preferences = await repository.appPreferences(); const credential = await repository.aiCredential();
    return json({ providerName: preferences?.ai_provider_name ?? "Custom HTTP", baseUrl: preferences?.ai_base_url ?? "", model: preferences?.ai_model ?? "", credentialConfigured: credential?.status === "active", updatedAt: credential?.updated_at ?? preferences?.updated_at ?? null });
  }
  if (request.method !== "PUT") return error("AI 配置不支持该方法", 405);
  try {
    const record = await body(request); rejectClientTenant(record);
    const providerName = typeof record.providerName === "string" ? record.providerName.trim() : "Custom HTTP";
    const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
    const model = typeof record.model === "string" ? record.model.trim() : "";
    const nextKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
    const hasHeaders = record.headers && typeof record.headers === "object";
    let encryptedCredential: { ciphertext: string; iv: string; key_version: string; fingerprint: string; status: string } | undefined;

    // Resolve, validate and encrypt every fallible credential input before the
    // first D1 write so preferences and credentials cannot diverge.
    if (nextKey || hasHeaders) {
      let existing = { apiKey: "", headers: {} as Record<string, string> };
      const old = await repository.aiCredential();
      if (old?.status === "active" && (!nextKey || !hasHeaders)) {
        try { const loaded = await loadAiProviderConfig(env); existing = { apiKey: loaded.apiKey, headers: loaded.headers ?? {} }; }
        catch (reason) { if (!nextKey) return error(reason instanceof Error ? reason.message : "无法读取已保存的 AI 凭据", 409); }
      }
      const bundle = { apiKey: nextKey || existing.apiKey, headers: hasHeaders ? cleanHeaders(record.headers) : existing.headers };
      if (!bundle.apiKey) return error("API Key 不能为空", 400);
      const key = encryptionKey(env); if (!key) return error("Worker 未配置 STARBOX_ENCRYPTION_KEY", 503);
      const encrypted = await encryptAiCredentials(JSON.stringify(bundle), key, PRIMARY_ACCOUNT_ID, KEY_VERSION);
      encryptedCredential = { ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: encrypted.keyVersion, fingerprint: encrypted.fingerprint, status: "active" };
    }

    const saved = await repository.saveAiConfigAtomic({
      ai_provider_name: providerName || "Custom HTTP",
      ai_base_url: baseUrl,
      ai_model: model,
    }, encryptedCredential);
    const credential = await repository.aiCredential();
    return json({ providerName: saved.ai_provider_name, baseUrl: saved.ai_base_url, model: saved.ai_model, credentialConfigured: credential?.status === "active", updatedAt: credential?.updated_at ?? saved.updated_at ?? null });
  } catch (reason) { return error(reason instanceof Error ? reason.message : "AI 配置保存失败", 400); }
}

export async function handlePreferences(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("云端配置暂不可用", 503);
  const repository = new DataRepository(env.DB);
  if (request.method === "GET") return json(await repository.appPreferences());
  if (request.method !== "PUT") return error("设置不支持该方法", 405);
  try { const record = await body(request); rejectClientTenant(record); const saved = await repository.saveAppPreferences({ release_sync_pages: Math.max(1, Number(record.syncPages) || 3), release_asset_include_pattern: typeof record.assetIncludePattern === "string" ? record.assetIncludePattern : "", release_asset_exclude_pattern: typeof record.assetExcludePattern === "string" ? record.assetExcludePattern : "" }); return json({ syncPages: saved.release_sync_pages, assetIncludePattern: saved.release_asset_include_pattern, assetExcludePattern: saved.release_asset_exclude_pattern }); } catch (reason) { return error(reason instanceof Error ? reason.message : "设置保存失败", 400); }
}
