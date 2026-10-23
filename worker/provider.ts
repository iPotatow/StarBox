import { fetchBounded } from "./outbound.js";
import type { AiProtocol } from "./types.js";

import type { AiHeaderPreset, ProviderConfig } from "../shared/contracts.js";
export type { ProviderConfig } from "../shared/contracts.js";

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

export function responsesEndpoint(baseUrl: string) {
  const url = validatedBaseUrl(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/responses") ? path : `${path || "/v1"}/responses`.replace(/\/+/g, "/");
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

const AGENT_ROUTER_CODEX_VERSION = "0.149.1";
function isAgentRouterHost(baseUrl: string) {
  const host = validatedBaseUrl(baseUrl).hostname.toLowerCase();
  return host === "agentrouter.org" || host.endsWith(".agentrouter.org") || host === "ps.air-outer.com" || host.endsWith(".ps.air-outer.com");
}
function addAgentRouterCompatibilityHeaders(headers: Headers, config: ProviderConfig) {
  if (config.headerPreset || !isAgentRouterHost(config.baseUrl)) return headers;
  if (!headers.has("originator")) headers.set("originator", "codex_cli_rs");
  if (!headers.has("user-agent")) headers.set("user-agent", `codex_cli_rs/${AGENT_ROUTER_CODEX_VERSION}`);
  if (!headers.has("version")) headers.set("version", AGENT_ROUTER_CODEX_VERSION);
  return headers;
}

function presetOriginator(preset: AiHeaderPreset | null | undefined) {
  if (preset === "codex-desktop-latest") return "Codex Desktop";
  if (preset === "codex-cli") return "codex_cli_rs";
  return null;
}

function requireConfig(config: ProviderConfig) {
  if (!config.baseUrl?.trim() || !config.apiKey?.trim() || !config.model?.trim()) throw new Error("AI 服务配置不完整");
}

export const openaiResponsesAdapter: HttpProviderAdapter = {
  id: "openai-responses",
  buildEndpoint(config) { requireConfig(config); return responsesEndpoint(config.baseUrl.trim()); },
  buildHeaders(config) {
    const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${config.apiKey.trim()}` });
    addCustomHeaders(headers, config, new Set(["authorization"]));
    return addAgentRouterCompatibilityHeaders(headers, config);
  },
  buildBody(config, messages, jsonMode) {
    return { model: config.model.trim(), input: messages, store: false, ...(jsonMode ? { text: { format: { type: "json_object" } } } : {}) };
  },
  readContent(payload) {
    const body = payload as { status?: string; error?: { message?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };
    if (body.status === "failed" || body.error) throw new Error("AI 服务生成失败");
    if (body.status === "incomplete") throw new Error("AI 服务返回内容不完整，请调整输出限制后重试");
    const parts = (body.output ?? []).filter((item) => item.type === "message").flatMap((item) => item.content ?? []);
    if (parts.some((part) => part.type === "refusal")) throw new Error("AI 服务拒绝了该请求");
    const content = parts.filter((part) => part.type === "output_text" && typeof part.text === "string").map((part) => part.text).join("").trim();
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

export function adapterForProtocol(protocol: AiProtocol | undefined) {
  if (protocol === "anthropic-messages") return anthropicMessagesAdapter;
  if (protocol === "openai-responses") return openaiResponsesAdapter;
  throw new Error("AI 协议无效，请选择 OpenAI Responses 或 Anthropic Messages");
}

export async function callProvider(config: ProviderConfig, messages: ProviderMessage[], jsonMode = false, adapter: HttpProviderAdapter = adapterForProtocol(config.protocol)) {
  const endpoint = adapter.buildEndpoint(config);
  const headers = adapter.buildHeaders(config);
  const originator = presetOriginator(config.headerPreset);
  if (originator) {
    headers.delete("user-agent");
    headers.delete("version");
    headers.set("originator", originator);
  }
  const response = await fetchBounded(endpoint, { method: "POST", redirect: "manual", headers, body: JSON.stringify(adapter.buildBody(config, messages, jsonMode)) }, { timeoutMs: 60_000, maxBytes: 2 * 1024 * 1024 });
  if (response.status >= 300 && response.status < 400) throw new Error(`AI 服务拒绝重定向 (${response.status})`);
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
