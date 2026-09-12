import { decryptGithubToken, encryptGithubToken } from "./crypto.js";
import { currentTimeIso } from "./auth.js";
import { DataRepository } from "./repository.js";
import { PRIMARY_ACCOUNT_ID } from "./types.js";
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, init = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function error(message, status = 400) { return json({ error: message }, { status }); }
function asRecord(value) { return value && typeof value === "object" ? value : {}; }
async function body(request) { try {
    return asRecord(await request.json());
}
catch {
    throw new Error("请求 JSON 无效");
} }
function rejectClientTenant(record) { for (const key of ["account_id", "accountId", "github_user_id", "githubUserId"])
    if (Object.prototype.hasOwnProperty.call(record, key))
        throw new Error("客户端不得传入 tenant/account identity"); }
function keyVersion(env) { return env.GITHUB_TOKEN_ENCRYPTION_KEY_VERSION || "v1"; }
function previousKey(env) { return env.GITHUB_TOKEN_ENCRYPTION_KEY_PREVIOUS || env.GITHUB_TOKEN_ENCRYPTION_KEY_OLD; }
export async function hydrateGithubToken(request, env, identity) {
    if (request.headers.get("x-starbox-github-token")?.trim() || !env.DB || !env.GITHUB_TOKEN_ENCRYPTION_KEY)
        return request;
    const repository = new DataRepository(env.DB);
    const record = await repository.credential();
    if (!record || record.status !== "active")
        return request;
    let token = "";
    let usedPrevious = false;
    try {
        if (record.key_version === keyVersion(env))
            token = await decryptGithubToken(record, env.GITHUB_TOKEN_ENCRYPTION_KEY);
        else if (previousKey(env)) {
            token = await decryptGithubToken(record, previousKey(env));
            usedPrevious = true;
        }
    }
    catch {
        return request;
    }
    if (!token)
        return request;
    if (usedPrevious) {
        const encrypted = await encryptGithubToken(token, env.GITHUB_TOKEN_ENCRYPTION_KEY, PRIMARY_ACCOUNT_ID, record.github_numeric_id, keyVersion(env));
        await repository.rotateCredential({ ...encrypted, key_version: encrypted.keyVersion });
    }
    const headers = new Headers(request.headers);
    headers.set("x-starbox-github-token", token);
    return new Request(request, { headers });
}
export async function handleGithubCredential(request, env, identity) {
    if (!env.DB)
        return error("Worker 未配置 D1 DB", 503);
    const repository = new DataRepository(env.DB);
    if (request.method === "GET") {
        const record = await repository.credential();
        return json(record ? { connected: true, githubUserId: record.github_numeric_id, login: record.github_login, fingerprint: record.fingerprint, keyVersion: record.key_version, validatedAt: record.validated_at, status: record.status } : { connected: false });
    }
    const record = await body(request);
    rejectClientTenant(record);
    if (request.method === "DELETE") {
        const old = await repository.credential();
        if (!old)
            return json({ connected: false });
        await repository.deleteCredential();
        await repository.recordActivity("github_credential_deleted", { fingerprint: null });
        await repository.change("credential", PRIMARY_ACCOUNT_ID, "delete");
        return json({ connected: false });
    }
    if (request.method !== "PUT")
        return error("Credential 路由不支持该方法", 405);
    const token = typeof record.token === "string" ? record.token.trim() : "";
    if (!token)
        return error("GitHub Token 不能为空", 400);
    const validation = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "StarBox-Workers", "X-GitHub-Api-Version": "2026-03-10" } });
    if (!validation.ok)
        return error(validation.status === 401 ? "GitHub Token 无效或已过期" : "GitHub Token 校验失败", validation.status === 403 ? 403 : 401);
    const user = asRecord(await validation.json());
    const githubNumericId = String(user.id ?? "");
    const login = typeof user.login === "string" ? user.login : "";
    if (!githubNumericId || !login)
        return error("GitHub /user 返回缺少身份字段", 502);
    if (!env.GITHUB_TOKEN_ENCRYPTION_KEY)
        return error("Worker 未配置 GITHUB_TOKEN_ENCRYPTION_KEY", 503);
    const encrypted = await encryptGithubToken(token, env.GITHUB_TOKEN_ENCRYPTION_KEY, PRIMARY_ACCOUNT_ID, githubNumericId, keyVersion(env));
    const timestamp = currentTimeIso();
    await repository.saveCredential({ account_id: PRIMARY_ACCOUNT_ID, github_numeric_id: githubNumericId, github_login: login, ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: encrypted.keyVersion, fingerprint: encrypted.fingerprint, validated_at: timestamp, created_at: timestamp, updated_at: timestamp, status: "active" });
    await repository.recordActivity("github_credential_saved", { fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion });
    await repository.change("credential", PRIMARY_ACCOUNT_ID, "upsert");
    return json({ connected: true, githubUserId: githubNumericId, login, fingerprint: encrypted.fingerprint, keyVersion: encrypted.keyVersion, validatedAt: timestamp });
}
export async function handleSync(request, env, identity, action) {
    if (!env.DB)
        return error("Worker 未配置 D1 DB", 503);
    const repository = new DataRepository(env.DB);
    try {
        if (action === "delta") {
            const url = new URL(request.url);
            const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 50));
            const after = Math.max(0, Number(url.searchParams.get("after") || url.searchParams.get("cursor")) || 0);
            return json(await repository.changes(after, limit));
        }
        const record = await body(request);
        rejectClientTenant(record);
        const scope = typeof record.scope === "string" && record.scope.trim() ? record.scope.trim() : action;
        const revision = Math.max(0, Number(record.revision) || 0);
        const cursor = typeof record.cursor === "string" ? record.cursor : null;
        await repository.saveSyncState(scope, cursor, revision);
        return json({ scope, cursor, revision });
    }
    catch (reason) {
        return error(reason instanceof Error ? reason.message : "同步状态请求失败", 400);
    }
}
export async function handleBootstrap(_request, env, _identity) { if (!env.DB)
    return error("Worker 未配置 D1 DB", 503); return json(await new DataRepository(env.DB).bootstrap()); }
export async function handleSyncMutation(request, env, _identity) { if (!env.DB)
    return error("Worker 未配置 D1 DB", 503); try {
    const record = await body(request);
    rejectClientTenant(record);
    const repository = new DataRepository(env.DB);
    const operation = typeof record.operation === "string" ? record.operation : "mutation";
    const result = await repository.mutate(operation, record.payload && typeof record.payload === "object" ? record.payload : record);
    return json({ ...result, state: {} });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "同步 mutation 失败", 400);
} }
export async function handleActivity(request, env, _identity) { if (!env.DB)
    return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); if (request.method === "GET") {
    const url = new URL(request.url);
    return json({ items: await repository.listActivity(Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50))) });
} try {
    const record = await body(request);
    rejectClientTenant(record);
    const id = await repository.recordActivity(typeof record.type === "string" ? record.type : "event", record.payload ?? {});
    return json({ id });
}
catch (reason) {
    return error(reason instanceof Error ? reason.message : "Activity 写入失败", 400);
} }
export async function handleNotifications(request, env, _identity, notificationId = "") { if (!env.DB)
    return error("Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); if (request.method === "GET") {
    const url = new URL(request.url);
    return json({ items: await repository.listNotifications(Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50))) });
} await repository.markNotificationRead(notificationId); await repository.change("notification", notificationId, "read"); return json({ ok: true }); }
