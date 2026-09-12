import { DataRepository } from "./repository.js";
import { PRIMARY_ACCOUNT_ID } from "./types.js";
export const SESSION_COOKIE = "starbox_session";
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, init = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function now() { return Date.now(); }
function isoNow() { return new Date(now()).toISOString(); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); let value = ""; for (const byte of bytes)
    value += String.fromCharCode(byte); return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
export async function sha256Hex(value) { const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left, right) { if (left.length !== right.length)
    return false; let result = 0; for (let i = 0; i < left.length; i += 1)
    result |= left.charCodeAt(i) ^ right.charCodeAt(i); return result === 0; }
export function sessionTtlSeconds(env) { const value = Number(env.SESSION_TTL_SECONDS); return Number.isInteger(value) && value > 0 ? value : DEFAULT_SESSION_TTL_SECONDS; }
export function loginConfig(env) { const username = env.LOGIN_USERNAME?.trim() || "admin"; const password = env.LOGIN_PASSWORD || "000000"; return { username, password, defaultCredentialsActive: !env.LOGIN_USERNAME?.trim() || !env.LOGIN_PASSWORD, warning: "当前仍在使用默认登录凭据，请立即设置 LOGIN_USERNAME / LOGIN_PASSWORD。", warningLevel: "critical" }; }
function publicLoginConfig(env) { const { password: _password, ...config } = loginConfig(env); return config; }
function cookieValue(request) { for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SESSION_COOKIE)
        return rest.join("=");
} return ""; }
function cookieHeader(token, maxAge) { return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`; }
export function clearSessionCookie() { return cookieHeader("", 0); }
export function sameOrigin(request) { const origin = request.headers.get("origin"); return Boolean(origin && origin === new URL(request.url).origin); }
export function isJsonRequest(request) { return (request.headers.get("content-type") || "").toLowerCase().split(";", 1)[0].trim() === "application/json"; }
export function validateMutationRequest(request, requireOrigin = true) { if (!isJsonRequest(request))
    return json({ error: "Mutation 请求必须使用 application/json" }, { status: 415 }); if (requireOrigin && !sameOrigin(request))
    return json({ error: "Mutation 请求必须来自同源 Origin" }, { status: 403 }); return null; }
function rateKey(request, username) { return `${request.headers.get("cf-connecting-ip") || "unknown"}:${username}`; }
async function persistentRateLimit(env, request, username) { if (!env.DB)
    return null; const key = await sha256Hex(rateKey(request, username)); const nowIsoValue = isoNow(); const reset = new Date(now() + 60_000).toISOString(); await env.DB.prepare("INSERT INTO login_rate_limits (rate_key, attempt_count, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(rate_key) DO UPDATE SET attempt_count = CASE WHEN reset_at <= ?3 THEN 1 ELSE attempt_count + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END").bind(key, reset, nowIsoValue).run(); const row = await env.DB.prepare("SELECT attempt_count, reset_at FROM login_rate_limits WHERE rate_key = ?1 LIMIT 1").bind(key).first(); if (!row || row.attempt_count <= 5)
    return null; return Math.max(1, Math.ceil((Date.parse(row.reset_at) - now()) / 1000)); }
async function checkLoginRateLimit(request, env, username) { const key = await sha256Hex(rateKey(request, username)); if (env.LOGIN_RATE_LIMITER) {
    const result = await env.LOGIN_RATE_LIMITER.limit({ key });
    return result.success ? null : 60;
} return persistentRateLimit(env, request, username); }
async function clearLoginRateLimit(env, request, username) { if (!env.DB)
    return; const key = await sha256Hex(rateKey(request, username)); await env.DB.prepare("DELETE FROM login_rate_limits WHERE rate_key = ?1").bind(key).run(); }
export function resetLoginRateLimits() { }
export async function authenticate(request, env) { if (!env.DB)
    return { response: json({ error: "Worker 未配置 D1 DB" }, { status: 503 }) }; const token = cookieValue(request); if (!token)
    return { response: json({ authenticated: false, ...publicLoginConfig(env) }) }; const repository = new DataRepository(env.DB); const session = await repository.sessionByHash(await sha256Hex(token)); if (!session || session.account_id !== PRIMARY_ACCOUNT_ID || session.revoked_at || Date.parse(session.expires_at) <= now())
    return { response: json({ authenticated: false, ...publicLoginConfig(env) }) }; if (!Number.isFinite(Date.parse(session.last_seen_at)) || now() - Date.parse(session.last_seen_at) >= 15 * 60_000) {
    await repository.touchSession(session.token_hash);
    session.last_seen_at = isoNow();
} return { identity: { accountId: PRIMARY_ACCOUNT_ID, session } }; }
export async function requireIdentity(request, env) { const result = await authenticate(request, env); return result.identity || result.response; }
export async function handleLogin(request, env) { const config = loginConfig(env); if (!isJsonRequest(request))
    return json({ error: "登录请求必须使用 application/json" }, { status: 415 }); let body; try {
    body = await request.json();
}
catch {
    return json({ error: "请求 JSON 无效" }, { status: 400 });
} const username = typeof body.username === "string" ? body.username.trim() : ""; const password = typeof body.password === "string" ? body.password : ""; const retryAfter = await checkLoginRateLimit(request, env, username || "unknown"); if (retryAfter)
    return json({ error: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "retry-after": String(retryAfter) } }); if (!constantTimeEqual(username, config.username) || !constantTimeEqual(password, config.password))
    return json({ error: "用户名或密码错误" }, { status: 401 }); if (!env.DB)
    return json({ error: "Worker 未配置 D1 DB" }, { status: 503 }); const repository = new DataRepository(env.DB); await repository.ensureAccount(); const token = randomToken(); const timestamp = new Date(now()); const ttl = sessionTtlSeconds(env); const session = { token_hash: await sha256Hex(token), account_id: PRIMARY_ACCOUNT_ID, created_at: timestamp.toISOString(), expires_at: new Date(timestamp.getTime() + ttl * 1000).toISOString(), last_seen_at: timestamp.toISOString(), revoked_at: null }; await repository.createSession(session); await clearLoginRateLimit(env, request, username); return json({ authenticated: true, accountId: PRIMARY_ACCOUNT_ID, expiresAt: session.expires_at, defaultCredentialsActive: config.defaultCredentialsActive, warningLevel: config.defaultCredentialsActive ? config.warningLevel : null, warning: config.defaultCredentialsActive ? config.warning : null }, { headers: { "set-cookie": cookieHeader(token, ttl) } }); }
export async function handleSession(request, env) { const result = await authenticate(request, env); if (result.identity) {
    const config = loginConfig(env);
    return json({ authenticated: true, accountId: PRIMARY_ACCOUNT_ID, expiresAt: result.identity.session.expires_at, lastSeenAt: result.identity.session.last_seen_at, defaultCredentialsActive: config.defaultCredentialsActive, warningLevel: config.defaultCredentialsActive ? config.warningLevel : null, warning: config.defaultCredentialsActive ? config.warning : null });
} return result.response; }
export async function handleLogout(request, env) { const token = cookieValue(request); if (token && env.DB)
    await new DataRepository(env.DB).revokeSession(await sha256Hex(token)); return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } }); }
export function sessionTokenFromRequest(request) { return cookieValue(request); }
export function currentTimeIso() { return isoNow(); }
