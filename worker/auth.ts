import { DataRepository } from "./repository.js";
import { AppError, apiError } from "./errors.js";
import { PRIMARY_ACCOUNT_ID } from "./types.js";
import type { Identity, SessionRecord, StarBoxEnv } from "./types.js";

export const SESSION_COOKIE = "starbox_session";
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function now() { return Date.now(); }
function isoNow() { return new Date(now()).toISOString(); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); let value = ""; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
export async function sha256Hex(value: string) { const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left: string, right: string) { if (left.length !== right.length) return false; let result = 0; for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i); return result === 0; }
export function sessionTtlSeconds(env: StarBoxEnv) { const value = Number(env.SESSION_TTL_SECONDS); return Number.isInteger(value) && value > 0 ? value : DEFAULT_SESSION_TTL_SECONDS; }

/** Production auth is fail-closed. Username may keep the historical admin default; password never does. */
export function loginConfig(env: StarBoxEnv) {
  const username = env.LOGIN_USERNAME?.trim() || "admin";
  const password = env.LOGIN_PASSWORD || "";
  return {
    username,
    password,
    configured: Boolean(password),
    defaultCredentialsActive: false,
  };
}
function publicLoginConfig(env: StarBoxEnv) {
  const config = loginConfig(env);
  return { username: config.username, authConfigured: config.configured, defaultCredentialsActive: false };
}
function requireLoginConfig(env: StarBoxEnv) {
  const config = loginConfig(env);
  if (!config.configured) {
    throw new AppError(
      "auth_not_configured",
      "StarBox 登录尚未配置。请为 Worker 设置 LOGIN_PASSWORD Secret 后重新部署。",
      503,
    );
  }
  return config;
}
function cookieValue(request: Request) { for (const part of (request.headers.get("cookie") || "").split(";")) { const [key, ...rest] = part.trim().split("="); if (key === SESSION_COOKIE) return rest.join("="); } return ""; }
function cookieHeader(token: string, maxAge: number, secure = true) { return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly;${secure ? " Secure;" : ""} SameSite=Strict`; }
export function clearSessionCookie(secure = true) { return cookieHeader("", 0, secure); }
export function sameOrigin(request: Request) { const origin = request.headers.get("origin"); return Boolean(origin && origin === new URL(request.url).origin); }
export function isJsonRequest(request: Request) { return (request.headers.get("content-type") || "").toLowerCase().split(";", 1)[0].trim() === "application/json"; }
export function validateMutationRequest(request: Request, requireOrigin = true) { if (!isJsonRequest(request)) return apiError("unsupported_media_type", "Mutation 请求必须使用 application/json", 415); if (requireOrigin && !sameOrigin(request)) return apiError("origin_mismatch", "Mutation 请求必须来自同源 Origin", 403); return null; }
function rateKey(request: Request, username: string) { return `${request.headers.get("cf-connecting-ip") || "unknown"}:${username}`; }
async function persistentRateLimit(env: StarBoxEnv, request: Request, username: string) { if (!env.DB) return null; const key = await sha256Hex(rateKey(request, username)); const nowIsoValue = isoNow(); const reset = new Date(now() + 60_000).toISOString(); await env.DB.prepare("INSERT INTO login_rate_limits (rate_key, attempt_count, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(rate_key) DO UPDATE SET attempt_count = CASE WHEN reset_at <= ?3 THEN 1 ELSE attempt_count + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END").bind(key, reset, nowIsoValue).run(); const row = await env.DB.prepare("SELECT attempt_count, reset_at FROM login_rate_limits WHERE rate_key = ?1 LIMIT 1").bind(key).first<{ attempt_count: number; reset_at: string }>(); if (!row || row.attempt_count <= 5) return null; return Math.max(1, Math.ceil((Date.parse(row.reset_at) - now()) / 1000)); }
async function checkLoginRateLimit(request: Request, env: StarBoxEnv, username: string) { const key = await sha256Hex(rateKey(request, username)); if (env.LOGIN_RATE_LIMITER) { const result = await env.LOGIN_RATE_LIMITER.limit({ key }); return result.success ? null : 60; } return persistentRateLimit(env, request, username); }
async function clearLoginRateLimit(env: StarBoxEnv, request: Request, username: string) { if (!env.DB) return; const key = await sha256Hex(rateKey(request, username)); await env.DB.prepare("DELETE FROM login_rate_limits WHERE rate_key = ?1").bind(key).run(); }
export function resetLoginRateLimits() { /* retained as a no-op compatibility export; production state is never process-local */ }

function deviceMetadata(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  const lower = userAgent.toLowerCase();
  const os = /iphone|ipad|ipod/.test(lower) ? "iOS" : /android/.test(lower) ? "Android" : /mac os x|macintosh/.test(lower) ? "macOS" : /windows/.test(lower) ? "Windows" : /linux/.test(lower) ? "Linux" : "Unknown";
  const browser = /edg\//.test(lower) ? "Edge" : /firefox\//.test(lower) ? "Firefox" : /crios\//.test(lower) ? "Chrome" : /chrome\//.test(lower) ? "Chrome" : /safari\//.test(lower) ? "Safari" : "Browser";
  const deviceType = /ipad|tablet/.test(lower) ? "tablet" : /mobile|iphone|ipod|android/.test(lower) ? "mobile" : "desktop";
  const deviceName = /iphone/.test(lower) ? "iPhone" : /ipad/.test(lower) ? "iPad" : /android/.test(lower) ? "Android" : os === "macOS" ? "Mac" : os === "Windows" ? "Windows PC" : os === "Linux" ? "Linux PC" : "Device";
  const cf = (request as Request & { cf?: { country?: string; region?: string; city?: string } }).cf || {};
  return { device_id: crypto.randomUUID(), device_name: deviceName, device_type: deviceType, os, browser, ip_address: request.headers.get("cf-connecting-ip") || null, country_code: cf.country || null, region: cf.region || null, city: cf.city || null, user_agent: userAgent.slice(0, 1000) || null };
}
function publicDevice(session: SessionRecord, currentHash: string) { return { id: session.device_id || session.token_hash, name: session.device_name || "Device", type: session.device_type || "desktop", os: session.os || "Unknown", browser: session.browser || "Browser", ipAddress: session.ip_address, countryCode: session.country_code, region: session.region, city: session.city, createdAt: session.created_at, lastSeenAt: session.last_seen_at, expiresAt: session.expires_at, current: session.token_hash === currentHash }; }

export async function authenticate(request: Request, env: StarBoxEnv) {
  if (!env.DB) return { response: apiError("database_not_ready", "Worker 未配置 D1 DB", 503) } as const;
  try { requireLoginConfig(env); } catch (reason) { return { response: reason instanceof AppError ? apiError(reason.code, reason.message, reason.status) : apiError("auth_not_configured", "StarBox 登录尚未配置", 503) } as const; }
  const token = cookieValue(request);
  if (!token) return { response: json({ authenticated: false, ...publicLoginConfig(env) }) } as const;
  const repository = new DataRepository(env.DB);
  const session = await repository.sessionByHash(await sha256Hex(token));
  if (!session || session.account_id !== PRIMARY_ACCOUNT_ID || session.revoked_at || Date.parse(session.expires_at) <= now()) return { response: json({ authenticated: false, ...publicLoginConfig(env) }) } as const;
  if (!session.device_id) { const metadata = deviceMetadata(request); await repository.updateSessionDevice(session.token_hash, metadata); Object.assign(session, metadata); }
  if (!Number.isFinite(Date.parse(session.last_seen_at)) || now() - Date.parse(session.last_seen_at) >= 60 * 60_000) { await repository.touchSession(session.token_hash); session.last_seen_at = isoNow(); }
  return { identity: { accountId: PRIMARY_ACCOUNT_ID, session } satisfies Identity } as const;
}
export async function requireIdentity(request: Request, env: StarBoxEnv): Promise<Identity | Response> { const result = await authenticate(request, env); return result.identity || result.response; }

export async function handleLogin(request: Request, env: StarBoxEnv) {
  let config;
  try { config = requireLoginConfig(env); } catch (reason) { return reason instanceof AppError ? apiError(reason.code, reason.message, reason.status) : apiError("auth_not_configured", "StarBox 登录尚未配置", 503); }
  if (!isJsonRequest(request)) return apiError("unsupported_media_type", "登录请求必须使用 application/json", 415);
  let body: { username?: string; password?: string };
  try { body = await request.json() as { username?: string; password?: string }; } catch { return apiError("invalid_json", "请求 JSON 无效", 400); }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const retryAfter = await checkLoginRateLimit(request, env, username || "unknown");
  if (retryAfter) {
    const response = apiError("login_rate_limited", "登录尝试过于频繁，请稍后再试", 429, { retryAfter });
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
  if (!constantTimeEqual(username, config.username) || !constantTimeEqual(password, config.password)) return apiError("invalid_credentials", "用户名或密码错误", 401);
  if (!env.DB) return apiError("database_not_ready", "Worker 未配置 D1 DB", 503);
  const repository = new DataRepository(env.DB);
  await repository.ensureAccount();
  const token = randomToken();
  const timestamp = new Date(now());
  const ttl = sessionTtlSeconds(env);
  const metadata = deviceMetadata(request);
  const session: SessionRecord = { token_hash: await sha256Hex(token), account_id: PRIMARY_ACCOUNT_ID, created_at: timestamp.toISOString(), expires_at: new Date(timestamp.getTime() + ttl * 1000).toISOString(), last_seen_at: timestamp.toISOString(), revoked_at: null, ...metadata };
  await repository.createSession(session);
  await clearLoginRateLimit(env, request, username);
  const secure = new URL(request.url).protocol === "https:";
  return json({ authenticated: true, accountId: PRIMARY_ACCOUNT_ID, expiresAt: session.expires_at, deviceId: session.device_id, authConfigured: true, defaultCredentialsActive: false }, { headers: { "set-cookie": cookieHeader(token, ttl, secure) } });
}

export async function handleSession(request: Request, env: StarBoxEnv) {
  const result = await authenticate(request, env);
  if (result.identity) return json({ authenticated: true, accountId: PRIMARY_ACCOUNT_ID, deviceId: result.identity.session.device_id, expiresAt: result.identity.session.expires_at, lastSeenAt: result.identity.session.last_seen_at, authConfigured: true, defaultCredentialsActive: false });
  return result.response;
}
export async function handleLogout(request: Request, env: StarBoxEnv) { const token = cookieValue(request); if (token && env.DB) await new DataRepository(env.DB).revokeSession(await sha256Hex(token)); return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:") } }); }

export async function handleDevices(request: Request, env: StarBoxEnv, identity: Identity, deviceId?: string) {
  if (!env.DB) return apiError("database_not_ready", "Worker 未配置 D1 DB", 503);
  const repository = new DataRepository(env.DB);
  if (!deviceId && request.method === "GET") { const rows = await repository.listSessions(); return json({ devices: rows.map((session) => publicDevice(session, identity.session.token_hash)) }); }
  if (deviceId && request.method === "PATCH") { let record: { name?: string }; try { record = await request.json() as { name?: string }; } catch { return apiError("invalid_json", "请求 JSON 无效", 400); } const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : ""; if (!name) return apiError("invalid_device_name", "设备名称不能为空", 400); await repository.renameSession(deviceId, name); const rows = await repository.listSessions(); return json({ devices: rows.map((session) => publicDevice(session, identity.session.token_hash)) }); }
  if (deviceId && request.method === "DELETE") { const current = (identity.session.device_id || identity.session.token_hash) === deviceId; if (current) await repository.revokeSession(identity.session.token_hash); else await repository.revokeSessionByDeviceId(deviceId); const rows = await repository.listSessions(); return json({ devices: rows.map((session) => publicDevice(session, identity.session.token_hash)), currentRevoked: current }, current ? { headers: { "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:") } } : {}); }
  return apiError("method_not_allowed", "设备路由不支持该方法", 405);
}
export async function handleRevokeOtherDevices(_request: Request, env: StarBoxEnv, identity: Identity) { if (!env.DB) return apiError("database_not_ready", "Worker 未配置 D1 DB", 503); const repository = new DataRepository(env.DB); await repository.revokeOtherSessions(identity.session.token_hash); const rows = await repository.listSessions(); return json({ devices: rows.map((session) => publicDevice(session, identity.session.token_hash)) }); }
export function sessionTokenFromRequest(request: Request) { return cookieValue(request); }
export function currentTimeIso() { return isoNow(); }
