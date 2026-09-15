import { decryptAiCredentials, decryptAiServiceCredentials, encryptAiServiceCredentials } from "./crypto.js";
import { callProvider, type ProviderConfig } from "./provider.js";
import { DataRepository } from "./repository.js";
import { PRIMARY_ACCOUNT_ID, type AiProtocol, type Identity, type StarBoxEnv } from "./types.js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(data), { ...init, headers: { ...jsonHeaders, ...(init.headers || {}) } }); }
function error(message: string, status = 400) { return json({ error: message }, { status }); }
function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
async function body(request: Request) { try { return asRecord(await request.json()); } catch { throw new Error("请求 JSON 无效"); } }
function cleanHeaders(value: unknown) { const record = asRecord(value); return Object.fromEntries(Object.entries(record).filter(([key, item]) => key.trim() && typeof item === "string").map(([key, item]) => [key.trim(), String(item)])); }
const KEY_VERSION = "v1";
function secret(env: StarBoxEnv) { return env.STARBOX_ENCRYPTION_KEY || ""; }
function protocol(value: unknown): AiProtocol { if (value === "anthropic-messages" || value === "google-gemini" || value === "openai-compatible") return value; throw new Error("AI 协议无效"); }
function stringValue(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function boolValue(value: unknown, fallback = true) { return typeof value === "boolean" ? value : typeof value === "number" ? value !== 0 : fallback; }
function safeConfigJson(value: unknown) { return JSON.stringify(asRecord(value)); }

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

export async function loadDefaultAiProviderConfig(env: StarBoxEnv, task = "default"): Promise<ProviderConfig> {
  if (!env.DB) throw new Error("AI 服务尚未配置");
  const repository = new DataRepository(env.DB);
  let binding = await repository.aiTaskBinding(task);
  if (!binding && task !== "default") binding = await repository.aiTaskBinding("default");
  if (binding) {
    const model = await repository.aiModel(binding.model_id);
    if (!model?.enabled) throw new Error("默认 AI 模型不存在或已停用");
    const service = await repository.aiService(model.service_id);
    if (!service?.enabled) throw new Error("默认 AI 模型所属服务已停用");
    const credential = await serviceCredential(repository, env, service.service_id);
    if (!credential?.apiKey) throw new Error("默认 AI 模型的 API Key 尚未配置");
    return { providerName: service.name, protocol: service.protocol, baseUrl: service.base_url, model: model.remote_model_id, apiKey: credential.apiKey, headers: credential.headers };
  }
  const services = await repository.aiServices();
  if (services.length) throw new Error("请先选择默认 AI 模型");
  const preferences = await repository.appPreferences();
  const credential = await legacyCredential(repository, env);
  if (!preferences?.ai_base_url || !preferences.ai_model || !credential?.apiKey) throw new Error("AI 服务尚未配置");
  return { providerName: preferences.ai_provider_name || "Custom HTTP", protocol: "openai-compatible", baseUrl: preferences.ai_base_url, model: preferences.ai_model, apiKey: credential.apiKey, headers: credential.headers };
}

async function servicePayload(repository: DataRepository, env: StarBoxEnv) {
  const services = await repository.aiServices(); const models = await repository.aiModels(); const defaultBinding = await repository.aiTaskBinding("default");
  const legacy = await repository.aiCredential();
  const credentials = new Map<string, boolean>();
  await Promise.all(services.map(async (service) => { const credential = await repository.aiServiceCredential(service.service_id); credentials.set(service.service_id, credential?.status === "active" || (service.service_id === "legacy-default" && legacy?.status === "active")); }));
  return {
    defaultModelId: defaultBinding?.model_id ?? null,
    services: services.map((service) => ({
      id: service.service_id, name: service.name, protocol: service.protocol, baseUrl: service.base_url, enabled: Boolean(service.enabled), credentialConfigured: credentials.get(service.service_id) ?? false,
      models: models.filter((model) => model.service_id === service.service_id).map((model) => ({ id: model.model_id, remoteModelId: model.remote_model_id, displayName: model.display_name || model.remote_model_id, enabled: Boolean(model.enabled), sortOrder: model.sort_order })),
    })),
  };
}

export async function handleAiServices(request: Request, env: StarBoxEnv, _identity: Identity, segments: string[]) {
  if (!env.DB) return error("云端配置暂不可用", 503);
  const repository = new DataRepository(env.DB);
  try {
    if (!segments.length && request.method === "GET") return json(await servicePayload(repository, env));
    if (!segments.length && request.method === "POST") {
      const record = await body(request); const name = stringValue(record.name, 80); const baseUrl = stringValue(record.baseUrl, 1000); const aiProtocol = protocol(record.protocol); const apiKey = stringValue(record.apiKey, 4000); const headers = cleanHeaders(record.headers); const firstModelId = stringValue(record.modelId, 200);
      if (!name || !baseUrl || !apiKey) return error("服务名称、服务地址和 API Key 不能为空");
      const serviceId = crypto.randomUUID();
      const credential = await encryptCredential(env, serviceId, apiKey, headers);
      const currentDefault = firstModelId ? await repository.aiTaskBinding("default") : null;
      const model = firstModelId ? { model_id: crypto.randomUUID(), service_id: serviceId, remote_model_id: firstModelId, display_name: stringValue(record.modelName, 120) || firstModelId, enabled: 1, sort_order: 0 } : undefined;
      await repository.saveAiServiceAtomic(
        { service_id: serviceId, name, protocol: aiProtocol, base_url: baseUrl, enabled: 1, config_json: safeConfigJson(record.config) },
        credential,
        model,
        Boolean(model && !currentDefault),
      );
      return json(await servicePayload(repository, env), { status: 201 });
    }
    const serviceId = decodeURIComponent(segments[0] || ""); const service = serviceId ? await repository.aiService(serviceId) : null;
    if (!service) return error("AI 服务不存在", 404);
    if (segments.length === 1 && request.method === "PATCH") {
      const record = await body(request);
      const nextService = { service_id: serviceId, name: stringValue(record.name, 80) || service.name, protocol: record.protocol === undefined ? service.protocol : protocol(record.protocol), base_url: stringValue(record.baseUrl, 1000) || service.base_url, enabled: record.enabled === undefined ? service.enabled : (boolValue(record.enabled) ? 1 : 0), config_json: record.config === undefined ? service.config_json : safeConfigJson(record.config) };
      let credential;
      if (record.apiKey !== undefined || record.headers !== undefined) {
        const providedApiKey = stringValue(record.apiKey, 4000);
        let existing: { apiKey: string; headers: Record<string, string> } | null = null;
        if (!providedApiKey || record.headers === undefined) {
          try { existing = await serviceCredential(repository, env, serviceId); }
          catch (reason) { if (!providedApiKey) throw reason; }
        }
        credential = await encryptCredential(env, serviceId, providedApiKey || existing?.apiKey || "", record.headers === undefined ? existing?.headers || {} : cleanHeaders(record.headers));
      }
      const next = await repository.saveAiServiceAtomic(nextService, credential);
      return json({ service: next, ...(await servicePayload(repository, env)) });
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
      if (!model) return error("请先为服务添加模型"); const credential = await serviceCredential(repository, env, serviceId); if (!credential?.apiKey) return error("API Key 尚未配置");
      const config: ProviderConfig = { providerName: service.name, protocol: service.protocol, baseUrl: service.base_url, model: model.remote_model_id, apiKey: credential.apiKey, headers: credential.headers };
      await callProvider(config, [{ role: "system", content: "Reply with exactly: STARBOX_OK" }, { role: "user", content: "Connectivity test." }]);
      return json({ message: `${service.name} 连接成功` });
    }
    if (segments[1] === "models" && segments.length === 2 && request.method === "POST") {
      const record = await body(request); const remoteModelId = stringValue(record.remoteModelId ?? record.modelId, 200); if (!remoteModelId) return error("模型 ID 不能为空"); const existing = await repository.aiModels(serviceId);
      await repository.saveAiModel({ model_id: crypto.randomUUID(), service_id: serviceId, remote_model_id: remoteModelId, display_name: stringValue(record.displayName, 120) || remoteModelId, enabled: 1, sort_order: existing.length });
      return json(await servicePayload(repository, env), { status: 201 });
    }
    if (segments[1] === "models" && segments.length === 3) {
      const modelId = decodeURIComponent(segments[2]); const model = await repository.aiModel(modelId); if (!model || model.service_id !== serviceId) return error("AI 模型不存在", 404);
      if (request.method === "PATCH") { const record = await body(request); await repository.saveAiModel({ model_id: modelId, service_id: serviceId, remote_model_id: stringValue(record.remoteModelId, 200) || model.remote_model_id, display_name: record.displayName === undefined ? model.display_name : stringValue(record.displayName, 120), enabled: record.enabled === undefined ? model.enabled : (boolValue(record.enabled) ? 1 : 0), sort_order: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : model.sort_order }); return json(await servicePayload(repository, env)); }
      if (request.method === "DELETE") { await repository.deleteAiModel(modelId); return json(await servicePayload(repository, env)); }
    }
    return error("AI 服务路由不支持该方法", 405);
  } catch (reason) { return error(reason instanceof Error ? reason.message : "AI 服务操作失败", 400); }
}

export async function handleAiDefaultModel(request: Request, env: StarBoxEnv, _identity: Identity) {
  if (!env.DB) return error("云端配置暂不可用", 503); if (request.method !== "PUT") return error("默认模型路由不支持该方法", 405);
  try { const record = await body(request); const modelId = stringValue(record.modelId, 200); if (!modelId) return error("默认模型不能为空"); const repository = new DataRepository(env.DB); const model = await repository.aiModel(modelId); if (!model?.enabled) return error("默认模型不存在或已停用", 404); const service = await repository.aiService(model.service_id); if (!service?.enabled) return error("模型服务已停用", 409); await repository.saveAiTaskBinding("default", modelId); return json(await servicePayload(repository, env)); }
  catch (reason) { return error(reason instanceof Error ? reason.message : "默认模型保存失败", 400); }
}
