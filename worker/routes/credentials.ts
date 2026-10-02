import { githubFetch } from "../github.js";
import { encryptionKey, body, rejectClientTenant, asRecord, KEY_VERSION } from "../request.js";
import { error, json } from "../http.js";
import { fullPreferences, saveFullPreferences } from "../preferences.js";
import type { StarBoxEnv, Identity } from "../types.js";
import { DataRepository } from "../repository.js";
import { AppError } from "../errors.js";
import { decryptGithubToken, encryptGithubToken } from "../crypto.js";
import { PRIMARY_ACCOUNT_ID } from "../types.js";
import { currentTimeIso } from "../auth.js";

export async function hydrateGithubToken(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return request;
  const repository = new DataRepository(env.DB);
  const account = await repository.account();
  if (!account.github_user_id) return request; // pre-binding compatibility only
  const record = await repository.credential();
  if (!record || record.status !== "active") throw new AppError("github_credential_missing", "请重新连接已绑定账号的 GitHub 凭据", 409);
  const key = encryptionKey(env);
  if (!key) throw new AppError("encryption_not_configured", "Worker 未配置 STARBOX_ENCRYPTION_KEY", 503);
  let token: string;
  try { token = await decryptGithubToken(record, key); }
  catch { throw new AppError("credential_decryption_failed", "GitHub 凭据无法解密，请重新连接", 503); }
  const headers = new Headers(request.headers);
  headers.set("x-starbox-github-token", token);
  return new Request(request, { headers });
}

export async function handleGithubCredential(request: Request, env: StarBoxEnv, identity: Identity) {
  if (!env.DB) return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB);
  if (request.method === "GET") { const record = await repository.credential(); const preferences = await fullPreferences(env); return json(record ? { connected: true, githubUserId: record.github_numeric_id, login: record.github_login, avatarUrl: preferences?.github_avatar_url || undefined, fingerprint: record.fingerprint, keyVersion: record.key_version, validatedAt: record.validated_at, status: record.status } : { connected: false }); }
  const record = await body(request); rejectClientTenant(record);
  if (request.method === "DELETE") { const old = await repository.credential(); if (!old) return json({ connected: false }); await repository.deleteCredential(); await repository.recordActivity("github_credential_deleted", { fingerprint: null }); await repository.change("credential", PRIMARY_ACCOUNT_ID, "delete"); return json({ connected: false }); }
  if (request.method !== "PUT") return error("Credential 路由不支持该方法", 405);
  const token = typeof record.token === "string" ? record.token.trim() : ""; if (!token) return error("GitHub Token 不能为空", 400);
  const validation = await githubFetch("/user", token); if (!validation.ok) return error(validation.status === 401 ? "GitHub Token 无效或已过期" : "GitHub Token 校验失败", validation.status === 403 ? 403 : 401);
  const user = asRecord(await validation.json()); const githubNumericId = String(user.id ?? ""); const login = typeof user.login === "string" ? user.login : ""; const avatarUrl = typeof user.avatar_url === "string" ? user.avatar_url : ""; if (!githubNumericId || !login) return error("GitHub /user 返回缺少身份字段", 502); if (!env.STARBOX_ENCRYPTION_KEY) return error("Worker 未配置 STARBOX_ENCRYPTION_KEY", 503);
  const account = await repository.account(); const boundGithubUserId = account?.github_user_id?.trim() || ""; if (boundGithubUserId && boundGithubUserId !== githubNumericId) return error("当前 StarBox 已绑定其他 GitHub 账号；如需切换账号，请先执行独立的数据重置流程", 409);
  const encrypted = await encryptGithubToken(token, env.STARBOX_ENCRYPTION_KEY, PRIMARY_ACCOUNT_ID, githubNumericId, KEY_VERSION); const timestamp = currentTimeIso(); await repository.saveCredential({ account_id: PRIMARY_ACCOUNT_ID, github_numeric_id: githubNumericId, github_login: login, ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: encrypted.keyVersion, fingerprint: encrypted.fingerprint, validated_at: timestamp, created_at: timestamp, updated_at: timestamp, status: "active" }); await saveFullPreferences(env, { github_avatar_url: avatarUrl || null }); await repository.recordActivity("github_credential_saved", { fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion }); await repository.change("credential", PRIMARY_ACCOUNT_ID, "upsert"); return json({ connected: true, githubUserId: githubNumericId, login, avatarUrl: avatarUrl || undefined, fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion, validatedAt: timestamp });
}
