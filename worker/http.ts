import { AppError, apiError } from "./errors.js";
import { body } from "./request.js";


export const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function json<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(jsonHeaders);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message: string, status = 400, diagnostics = "") { return json({ error: message, ...(diagnostics ? { diagnostics } : {}) }, { status }); }

export function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export async function parseBody<T>(request: Request): Promise<T> { return await body(request) as T; }

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}


export function caughtError(reason: unknown, fallbackMessage: string, fallbackStatus = 400, diagnostics = "") {
  if (reason instanceof AppError) return apiError(reason.code, reason.message, reason.status, reason.details);
  return error(reason instanceof Error ? reason.message : fallbackMessage, fallbackStatus, diagnostics);
}
