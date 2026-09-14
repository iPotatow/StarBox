import type { AiProtocol } from "./types.js";

export type ProviderConfig = {
  providerName: string;
  protocol?: AiProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

export type ProviderMessage = { role: "system" | "user"; content: string };

export interface HttpProviderAdapter {
  id: string;
  buildEndpoint(config: ProviderConfig): URL;
  buildHeaders(config: ProviderConfig): Headers;
  buildBody(config: ProviderConfig, messages: ProviderMessage[], jsonMode: boolean): unknown;
  readContent(payload: unknown): string;
}

function privateIpv4(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function validatedBaseUrl(baseUrl: string) {
  let url: URL;
  try { url = new URL(baseUrl); }
  catch { throw new Error("AI 服务地址 格式无效"); }
  if (url.protocol !== "https:") throw new Error("AI 服务地址 必须使用 HTTPS");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.includes(":") || privateIpv4(host)) throw new Error("AI 服务地址 不允许本地或私网地址");
  url.search = ""; url.hash = "";
  return url;
}

function appendEndpoint(baseUrl: string, suffix: string) {
  const url = validatedBaseUrl(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = `${path}/${suffix.replace(/^\/+/, "")}`.replace(/\/+/g, "/");
  return url;
}

export function providerEndpoint(baseUrl: string) {
  const url = validatedBaseUrl(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`.replace(/\/+/g, "/");
  return url;
}

const blockedHeaderNames = new Set(["host", "content-length", "connection", "transfer-encoding"]);
function addCustomHeaders(headers: Headers, config: ProviderConfig, blocked = new Set<string>()) {
  for (const [key, value] of Object.entries(config.headers ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || blockedHeaderNames.has(normalized) || blocked.has(normalized)) continue;
    if (typeof value === "string" && value.trim()) headers.set(key.trim(), value.trim());
  }
  return headers;
}
function requireConfig(config: ProviderConfig) {
  if (!config.baseUrl?.trim() || !config.apiKey?.trim() || !config.model?.trim()) throw new Error("AI 服务配置不完整");
}

export const customHttpProviderAdapter: HttpProviderAdapter = {
  id: "openai-compatible",
  buildEndpoint(config) { requireConfig(config); return providerEndpoint(config.baseUrl.trim()); },
  buildHeaders(config) {
    const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${config.apiKey.trim()}` });
    return addCustomHeaders(headers, config, new Set(["authorization"]));
  },
  buildBody(config, messages, jsonMode) {
    return { model: config.model.trim(), messages, temperature: 0.2, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) };
  },
  readContent(payload) {
    const body = payload as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI 服务返回了空响应");
    return content;
  },
};

export const anthropicMessagesAdapter: HttpProviderAdapter = {
  id: "anthropic-messages",
  buildEndpoint(config) {
    requireConfig(config);
    const base = config.baseUrl.trim().replace(/\/+$/, "");
    return appendEndpoint(base, base.endsWith("/v1") ? "messages" : "v1/messages");
  },
  buildHeaders(config) {
    const headers = new Headers({ "content-type": "application/json", "x-api-key": config.apiKey.trim(), "anthropic-version": "2023-06-01" });
    return addCustomHeaders(headers, config, new Set(["x-api-key", "anthropic-version", "authorization"]));
  },
  buildBody(config, messages) {
    const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
    const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({ role: "user", content: item.content }));
    return { model: config.model.trim(), max_tokens: 2048, temperature: 0.2, ...(system ? { system } : {}), messages: userMessages.length ? userMessages : [{ role: "user", content: "" }] };
  },
  readContent(payload) {
    const body = payload as { content?: Array<{ type?: string; text?: string }> };
    const content = (body.content ?? []).filter((item) => item.type === "text" || item.text).map((item) => item.text || "").join("\n").trim();
    if (!content) throw new Error("AI 服务返回了空响应");
    return content;
  },
};

export const googleGeminiAdapter: HttpProviderAdapter = {
  id: "google-gemini",
  buildEndpoint(config) {
    requireConfig(config);
    const base = config.baseUrl.trim().replace(/\/+$/, "");
    return appendEndpoint(base, `models/${encodeURIComponent(config.model.trim())}:generateContent`);
  },
  buildHeaders(config) {
    const headers = new Headers({ "content-type": "application/json", "x-goog-api-key": config.apiKey.trim() });
    return addCustomHeaders(headers, config, new Set(["x-goog-api-key", "authorization"]));
  },
  buildBody(_config, messages, jsonMode) {
    const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
    const contents = messages.filter((item) => item.role !== "system").map((item) => ({ role: "user", parts: [{ text: item.content }] }));
    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: contents.length ? contents : [{ role: "user", parts: [{ text: "" }] }],
      generationConfig: { temperature: 0.2, ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
    };
  },
  readContent(payload) {
    const body = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text || "").join("\n").trim();
    if (!content) throw new Error("AI 服务返回了空响应");
    return content;
  },
};

export function adapterForProtocol(protocol: AiProtocol | undefined) {
  if (protocol === "anthropic-messages") return anthropicMessagesAdapter;
  if (protocol === "google-gemini") return googleGeminiAdapter;
  return customHttpProviderAdapter;
}

export async function callProvider(config: ProviderConfig, messages: ProviderMessage[], jsonMode = false, adapter: HttpProviderAdapter = adapterForProtocol(config.protocol)) {
  const response = await fetch(adapter.buildEndpoint(config), { method: "POST", headers: adapter.buildHeaders(config), body: JSON.stringify(adapter.buildBody(config, messages, jsonMode)) });
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } | string; message?: string };
      detail = typeof body.error === "string" ? body.error : body.error?.message || body.message || "";
    } catch { /* Provider response body may not be JSON. */ }
    throw new Error(detail ? `AI 服务错误：${detail.slice(0, 220)}` : `AI 服务请求失败 (${response.status})`);
  }
  return adapter.readContent(await response.json());
}
