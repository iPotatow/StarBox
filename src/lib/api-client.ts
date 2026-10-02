import type { ApiErrorPayload } from "../../shared/contracts.js";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  diagnostics?: string;
  retryable: boolean;
  constructor(message: string, status: number, code?: string, details?: unknown, diagnostics?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.diagnostics = diagnostics;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}
async function readError(response: Response) {
  try {
    const data = (await response.json()) as Partial<ApiErrorPayload>;
    const structured = data.error && typeof data.error === "object" ? data.error : undefined;
    const base = structured?.message || (typeof data.error === "string" ? data.error : "") || `请求失败 (${response.status})`;
    const diagnostics = data.diagnostics;
    return new ApiError(diagnostics ? `${base} · ${diagnostics}` : base, response.status, structured?.code, structured?.details, diagnostics);
  } catch { return new ApiError(`请求失败 (${response.status})`, response.status); }
}
let sessionEpoch = 0;
let mutationEpoch = 0;
const activeRequests = new Set<AbortController>();
const pendingWrites = new Set<Promise<void>>();
export function apiSessionEpoch() { return sessionEpoch; }
export function resetApiSession() {
  sessionEpoch += 1;
  for (const controller of activeRequests) controller.abort();
}
async function waitForWrites() {
  while (pendingWrites.size) await Promise.all([...pendingWrites]);
}
export async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const writing = method !== "GET";
  const epoch = sessionEpoch;
  const controller = new AbortController();
  activeRequests.add(controller);
  let finish: (() => void) | undefined;
  const write = writing ? new Promise<void>((resolve) => { finish = resolve; }) : undefined;
  if (write) { pendingWrites.add(write); mutationEpoch += 1; }
  const headers = new Headers(init?.headers);
  if (writing) headers.set("content-type", "application/json");
  try {
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    const response = await fetch(url, { ...init, signal, headers, credentials: init?.credentials ?? "same-origin", ...(writing && init?.body === undefined ? { body: "{}" } : {}) });
    if (!response.ok) throw await readError(response);
    const result = await response.json() as T;
    if (epoch !== sessionEpoch) throw new ApiError("登录会话已改变", 401, "session_changed");
    return result;
  } finally {
    activeRequests.delete(controller);
    if (write) { pendingWrites.delete(write); mutationEpoch += 1; finish?.(); }
  }
}

export async function readConsistentSnapshot<T>(read: () => Promise<T>) {
  const session = sessionEpoch;
  for (;;) {
    await waitForWrites();
    if (session !== sessionEpoch) throw new ApiError("登录会话已改变", 401, "session_changed");
    const generation = mutationEpoch;
    const snapshot = await read();
    await waitForWrites();
    if (session !== sessionEpoch) throw new ApiError("登录会话已改变", 401, "session_changed");
    // A snapshot read during a write can predate its acknowledgement.
    if (generation === mutationEpoch) return snapshot;
  }
}
