import { caughtError, json, error } from "./http.js";
import { asRecord, body, cleanHeaders, KEY_VERSION } from "./request.js";
import { decryptAiCredentials, decryptAiServiceCredentials, encryptAiServiceCredentials } from "./crypto.js";
import { callProvider, type ProviderConfig, type ProviderMessage } from "./provider.js";
import { callWorkersAi, fetchDailyWorkersAiUsage, type WorkersAiRuntimeConfig } from "./workers-ai.js";
import { DataRepository } from "./repository.js";
import { PRIMARY_ACCOUNT_ID, type AiProtocol, type Identity, type StarBoxEnv } from "./types.js";
import type { AiHeaderPreset } from "../shared/contracts.js";

export type AiServiceTransport = "http" | "workers-ai";
export type AiRuntimeConfig = ({ runtime: "http" } & ProviderConfig) | WorkersAiRuntimeConfig;

type ServiceConfig = {
  transport?: AiServiceTransport;
  gatewayId?: string;
  headerPreset?: AiHeaderPreset | null;
  [key: string]: unknown;
};

function secret(env: StarBoxEnv) { return env.STARBOX_ENCRYPTION_KEY || ""; }
function protocol(value: unknown): AiProtocol { if (value === "anthropic-messages" || value === "google-gemini" || value === "openai-compatible") return value; throw new Error("AI 协议无效"); }
function stringValue(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function boolValue(value: unknown, fallback = true) { return typeof value === "boolean" ? value : typeof value === "number" ? value !== 0 : fallback; }
function transport(value: unknown): AiServiceTransport { return value === "workers-ai" ? "workers-ai" : "http"; }
function workersModelId(value: unknown) { const model = stringValue(value, 200); if (!model.startsWith("@cf/")) throw new Error("Workers AI 模型 ID 必须以 @cf/ 开头"); return model; }
function gatewayId(value: unknown) {
  const id = stringValue(value, 120) || "default";
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)) throw new Error("AI Gateway ID 只能包含字母、数字、下划线和连字符");
  return id;
}
function parseServiceConfig(configJson: string): ServiceConfig {
  try { const value = JSON.parse(configJson); return value && typeof value === "object" && !Array.isArray(value) ? value as ServiceConfig : {}; }
  catch { return {}; }
}
function serviceTransport(configJson: string): AiServiceTransport { return transport(parseServiceConfig(configJson).transport); }
function headerPreset(configJson: string): AiHeaderPreset | null {
  const value = parseServiceConfig(configJson).headerPreset;
  return value === "codex-desktop-latest" || value === "codex-cli" ? value : null;
}
function serviceGatewayId(configJson: string) { return gatewayId(parseServiceConfig(configJson).gatewayId); }
function configJson(current: unknown, patch: { preset?: unknown; transport?: AiServiceTransport; gatewayId?: unknown } = {}) {
  const value = asRecord(current);
  const next: ServiceConfig = { ...value };
  if (patch.preset !== undefined) {
    if (patch.preset !== null && patch.preset !== "codex-desktop-latest" && patch.preset !== "codex-cli") throw new Error("请求头预设无效");
    next.headerPreset = patch.preset as AiHeaderPreset | null;
  }
  if (patch.transport !== undefined) next.transport = patch.transport;
  if (patch.gatewayId !== undefined) next.gatewayId = patch.transport === "workers-ai" || next.transport === "workers-ai" ? gatewayId(patch.gatewayId) : stringValue(patch.gatewayId, 120);
  return JSON.stringify(next);
}

async function legacyCredential(repository: DataRepository, env: StarBoxEnv) {
  const record = await repository.aiCredential();
  if (!record || record.status !== "active") return null;
  const current = secret(env); if (!current) throw new Error("AI 凭据加密密钥未配置");
  let plaintext = "";
  try { plaintext = await decryptAiCredentials(record, current); }
  catch { throw new Error("已保存的 AI 凭据无法解密，请检查 STARBOX_ENCRYPTION_KEY"); }
  try { const parsed = JSON.parse(plaintext) as { apiKey?: string; headers?: Record<string, string> }; return { apiKey: parsed.apiKey || "", headers: parsed.headers || {} }; }
  catch { throw new Error("已保存的 AI 凭据格式无效"); }
}

async function serviceCredential(repository: DataRepository, env: StarBoxEnv, serviceId: string) {
  const record = await repository.aiServiceCredential(serviceId);
  if (!record || record.status !== "active") {
    if (serviceId === "legacy-default") return legacyCredential(repository, env);
    return null;
  }
  const current = secret(env); if (!current) throw new Error("AI 凭据加密密钥未配置");
  let plaintext = "";
  try { plaintext = await decryptAiServiceCredentials(record, current); }
  catch { throw new Error("已保存的 AI 凭据无法解密，请检查 STARBOX_ENCRYPTION_KEY"); }
  try { const parsed = JSON.parse(plaintext) as { apiKey?: string; headers?: Record<string, string> }; return { apiKey: parsed.apiKey || "", headers: parsed.headers || {} }; }
  catch { throw new Error("已保存的 AI 凭据格式无效"); }
}

async function encryptCredential(env: StarBoxEnv, serviceId: string, apiKey: string, headers: Record<string, string>) {
  const encryptionKey = secret(env); if (!encryptionKey) throw new Error("Worker 未配置 STARBOX_ENCRYPTION_KEY");
  if (!apiKey.trim()) throw new Error("API Key 不能为空");
  const encrypted = await encryptAiServiceCredentials(JSON.stringify({ apiKey: apiKey.trim(), headers }), encryptionKey, PRIMARY_ACCOUNT_ID, serviceId, KEY_VERSION);
  return { service_id: serviceId, ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: encrypted.keyVersion, fingerprint: encrypted.fingerprint, status: "active" };
}

export async function loadDefaultAiRuntimeConfig(env: StarBoxEnv, task = "default"): Promise<AiRuntimeConfig> {
  if (!env.DB) throw new Error("AI 服务尚未配置");
  const repository = new DataRepository(env.DB);
  let binding = await repository.aiTaskBinding(task);
  if (!binding && task !== "default") binding = await repository.aiTaskBinding("default");
  if (binding) {
    const model = await repository.aiModel(binding.model_id);
    if (!model?.enabled) throw new Error("默认 AI 模型不存在或已停用");
    const service = await repository.aiService(model.service_id);
    if (!service?.enabled) throw new Error("默认 AI 模型所属服务已停用");
    if (serviceTransport(service.config_json) === "workers-ai") {
      return { runtime: "workers-ai", providerName: service.name, model: workersModelId(model.remote_model_id), gatewayId: serviceGatewayId(service.config_json) };
    }
    const credential = await serviceCredential(repository, env, service.service_id);
    if (!credential?.apiKey) throw new Error("默认 AI 模型的 API Key 尚未配置");
    return { runtime: "http", providerName: service.name, protocol: service.protocol, baseUrl: service.base_url, model: model.remote_model_id, apiKey: credential.apiKey, headers: credential.headers, headerPreset: headerPreset(service.config_json) };
  }
  const services = await repository.aiServices();
  if (services.length) throw new Error("请先选择默认 AI 模型");
  const preferences = await repository.appPreferences();
  const credential = await legacyCredential(repository, env);
  if (!preferences?.ai_base_url || !preferences.ai_model || !credential?.apiKey) throw new Error("AI 服务尚未配置");
  return { runtime: "http", providerName: preferences.ai_provider_name || "Custom HTTP", protocol: "openai-compatible", baseUrl: preferences.ai_base_url, model: preferences.ai_model, apiKey: credential.apiKey, headers: credential.headers };
}

export async function loadDefaultAiProviderConfig(env: StarBoxEnv, task = "default"): Promise<ProviderConfig> {
  const resolved = await loadDefaultAiRuntimeConfig(env, task);
  if (resolved.runtime !== "http") throw new Error("当前默认模型使用 Workers AI，不属于 HTTP AI 配置");
  const { runtime: _runtime, ...config } = resolved;
  return config;
}

export async function callAiRuntime(env: StarBoxEnv | undefined, config: AiRuntimeConfig, messages: ProviderMessage[], jsonMode = false) {
  if (config.runtime === "workers-ai") {
    if (!env) throw new Error("Workers AI 仅可在 Cloudflare Worker 运行时使用");
    return callWorkersAi(env, config, messages, jsonMode);
  }
  const { runtime: _runtime, ...http } = config;
  return callProvider(http, messages, jsonMode);
}

async function servicePayload(repository: DataRepository, env: StarBoxEnv) {
  const services = await repository.aiServices(); const models = await repository.aiModels(); const defaultBinding = await repository.aiTaskBinding("default");
  const legacy = await repository.aiCredential();
  const credentials = new Map<string, boolean>();
  await Promise.all(services.map(async (service) => { const credential = await repository.aiServiceCredential(service.service_id); credentials.set(service.service_id, credential?.status === "active" || (service.service_id === "legacy-default" && legacy?.status === "active")); }));
  return {
    defaultModelId: defaultBinding?.model_id ?? null,
    services: services.map((service) => {
      const runtime = serviceTransport(service.config_json);
      return {
        headerPreset: headerPreset(service.config_json), id: service.service_id, name: service.name, protocol: service.protocol, baseUrl: service.base_url, enabled: Boolean(service.enabled), credentialConfigured: credentials.get(service.service_id) ?? false,
        transport: runtime, requiresCredential: runtime === "http", gatewayId: runtime === "workers-ai" ? serviceGatewayId(service.config_json) : null,
        models: models.filter((model) => model.service_id === service.service_id).map((model) => ({ id: model.model_id, remoteModelId: model.remote_model_id, displayName: model.display_name || model.remote_model_id, enabled: Boolean(model.enabled), sortOrder: model.sort_order })),
      };
    }),
  };
}

export async function handleWorkersAiUsage(_request: Request, env: StarBoxEnv, _identity: Identity) {
  return json(await fetchDailyWorkersAiUsage(env));
}

export async function handleAiServices(request: Request, env: StarBoxEnv, _identity: Identity, segments: string[]) {
  if (!env.DB) return error("云端配置暂不可用", 503);
  const repository = new DataRepository(env.DB);
  try {
    if (!segments.length && request.method === "GET") return json(await servicePayload(repository, env));
    if (!segments.length && request.method === "POST") {
      const record = await body(request); const name = stringValue(record.name, 80); const runtime = transport(record.transport); const firstModelRaw = stringValue(record.modelId, 200);
      if (!name) return error("服务名称不能为空");
      const serviceId = crypto.randomUUID();
      const currentDefault = firstModelRaw ? await repository.aiTaskBinding("default") : null;
      if (runtime === "workers-ai") {
        const firstModelId = firstModelRaw ? workersModelId(firstModelRaw) : "";
        const model = firstModelId ? { model_id: crypto.randomUUID(), service_id: serviceId, remote_model_id: firstModelId, display_name: stringValue(record.modelName, 120) || firstModelId, enabled: 1, sort_order: 0 } : undefined;
        await repository.saveAiServiceAtomic(
          { service_id: serviceId, name, protocol: "openai-compatible", base_url: "", enabled: 1, config_json: configJson(record.config, { transport: runtime, gatewayId: record.gatewayId ?? "default" }) },
          undefined,
          model,
          Boolean(model && !currentDefault),
        );
      } else {
        const baseUrl = stringValue(record.baseUrl, 1000); const aiProtocol = protocol(record.protocol); const apiKey = stringValue(record.apiKey, 4000); const headers = cleanHeaders(record.headers);
        if (!baseUrl || !apiKey) return error("服务地址和 API Key 不能为空");
        const credential = await encryptCredential(env, serviceId, apiKey, headers);
        const model = firstModelRaw ? { model_id: crypto.randomUUID(), service_id: serviceId, remote_model_id: firstModelRaw, display_name: stringValue(record.modelName, 120) || firstModelRaw, enabled: 1, sort_order: 0 } : undefined;
        await repository.saveAiServiceAtomic(
          { service_id: serviceId, name, protocol: aiProtocol, base_url: baseUrl, enabled: 1, config_json: configJson(record.config, { preset: record.headerPreset, transport: runtime }) },
          credential,
          model,
          Boolean(model && !currentDefault),
        );
      }
      return json(await servicePayload(repository, env), { status: 201 });
    }
    const serviceId = decodeURIComponent(segments[0] || ""); const service = serviceId ? await repository.aiService(serviceId) : null;
    if (!service) return error("AI 服务不存在", 404);
    const currentTransport = serviceTransport(service.config_json);
    if (segments.length === 1 && request.method === "PATCH") {
      const record = await body(request); const nextTransport = record.transport === undefined ? currentTransport : transport(record.transport);
      const currentConfig = parseServiceConfig(service.config_json);
      const nextService = {
        service_id: serviceId,
        name: stringValue(record.name, 80) || service.name,
        protocol: nextTransport === "workers-ai" ? service.protocol : (record.protocol === undefined ? service.protocol : protocol(record.protocol)),
        base_url: nextTransport === "workers-ai" ? "" : (stringValue(record.baseUrl, 1000) || service.base_url),
        enabled: record.enabled === undefined ? service.enabled : (boolValue(record.enabled) ? 1 : 0),
        config_json: configJson(record.config === undefined ? currentConfig : record.config, { preset: record.headerPreset, transport: nextTransport, gatewayId: nextTransport === "workers-ai" ? (record.gatewayId ?? currentConfig.gatewayId ?? "default") : undefined }),
      };
      if (nextTransport === "http" && !nextService.base_url) return error("服务地址不能为空");
      let credential;
      if (nextTransport === "http" && (record.apiKey !== undefined || record.headers !== undefined)) {
        const providedApiKey = stringValue(record.apiKey, 4000);
        let existing: { apiKey: string; headers: Record<string, string> } | null = null;
        if (!providedApiKey || record.headers === undefined) {
          try { existing = await serviceCredential(repository, env, serviceId); }
          catch (reason) { if (!providedApiKey) throw reason; }
        }
        credential = await encryptCredential(env, serviceId, providedApiKey || existing?.apiKey || "", record.headers === undefined ? existing?.headers || {} : cleanHeaders(record.headers));
      }
      await repository.saveAiServiceAtomic(nextService, credential);
      return json(await servicePayload(repository, env));
    }
    if (segments.length === 1 && request.method === "DELETE") {
      await repository.deleteAiService(serviceId);
      if (serviceId === "legacy-default") {
        await repository.deleteAiCredential();
        await repository.saveAppPreferences({ ai_provider_name: "Custom HTTP", ai_base_url: "", ai_model: "" });
      }
      return json(await servicePayload(repository, env));
    }
    if (segments[1] === "test" && request.method === "POST") {
      const record = await body(request); const models = await repository.aiModels(serviceId); const modelId = stringValue(record.modelId, 200); const model = (modelId ? models.find((item) => item.model_id === modelId) : models.find((item) => item.enabled)) || null;
      if (!model) return error("请先为服务添加模型");
      const messages: ProviderMessage[] = [{ role: "system", content: "Reply with exactly: STARBOX_OK" }, { role: "user", content: "Connectivity test." }];
      if (currentTransport === "workers-ai") {
        await callWorkersAi(env, { runtime: "workers-ai", providerName: service.name, model: workersModelId(model.remote_model_id), gatewayId: serviceGatewayId(service.config_json) }, messages);
      } else {
        const credential = await serviceCredential(repository, env, serviceId); if (!credential?.apiKey) return error("API Key 尚未配置");
        const config: ProviderConfig = { providerName: service.name, protocol: service.protocol, baseUrl: service.base_url, model: model.remote_model_id, apiKey: credential.apiKey, headers: credential.headers, headerPreset: headerPreset(service.config_json) };
        await callProvider(config, messages);
      }
      return json({ message: `${service.name} 连接成功` });
    }
    if (segments[1] === "models" && segments.length === 2 && request.method === "POST") {
      const record = await body(request); const remoteModelId = currentTransport === "workers-ai" ? workersModelId(record.remoteModelId ?? record.modelId) : stringValue(record.remoteModelId ?? record.modelId, 200); if (!remoteModelId) return error("模型 ID 不能为空"); const existing = await repository.aiModels(serviceId);
      await repository.saveAiModel({ model_id: crypto.randomUUID(), service_id: serviceId, remote_model_id: remoteModelId, display_name: stringValue(record.displayName, 120) || remoteModelId, enabled: 1, sort_order: existing.length });
      return json(await servicePayload(repository, env), { status: 201 });
    }
    if (segments[1] === "models" && segments.length === 3) {
      const modelId = decodeURIComponent(segments[2]); const model = await repository.aiModel(modelId); if (!model || model.service_id !== serviceId) return error("AI 模型不存在", 404);
      if (request.method === "PATCH") { const record = await body(request); const remote = record.remoteModelId === undefined ? model.remote_model_id : (currentTransport === "workers-ai" ? workersModelId(record.remoteModelId) : stringValue(record.remoteModelId, 200)); await repository.saveAiModel({ model_id: modelId, service_id: serviceId, remote_model_id: remote || model.remote_model_id, display_name: record.displayName === undefined ? model.display_name : stringValue(record.displayName, 120), enabled: record.enabled === undefined ? model.enabled : (boolValue(record.enabled) ? 1 : 0), sort_order: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : model.sort_order }); return json(await servicePayload(repository, env)); }
      if (request.method === "DELETE") { await repository.deleteAiModel(modelId); return json(await servicePayload(repository, env)); }
    }
    return error("AI 服务路由不支持该方法", 405);
  } catch (reason) { return caughtError(reason, "AI 服务操作失败", 400); }
}

export async function handleAiDefaultModel(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("云端配置暂不可用", 503); if (request.method !== "PUT") return error("默认模型路由不支持该方法", 405);
  try { const record = await body(request); const modelId = stringValue(record.modelId, 200); if (!modelId) return error("默认模型不能为空"); const repository = new DataRepository(env.DB); const model = await repository.aiModel(modelId); if (!model?.enabled) return error("默认模型不存在或已停用", 404); const service = await repository.aiService(model.service_id); if (!service?.enabled) return error("模型服务已停用", 409); await repository.saveAiTaskBinding("default", modelId); return json(await servicePayload(repository, env)); }
  catch (reason) { return caughtError(reason, "默认模型保存失败", 400); }
}
