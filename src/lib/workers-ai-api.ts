import type { AiService, AiServicesState } from "../types";
import { jsonRequest } from "./api-client";

export type AiServiceTransport = "http" | "workers-ai";
export type RuntimeAiService = AiService & {
  transport?: AiServiceTransport;
  gatewayId?: string | null;
  requiresCredential?: boolean;
};
export type RuntimeAiServicesState = Omit<AiServicesState, "services"> & { services: RuntimeAiService[] };

export type WorkersAiUsage = {
  configured: boolean;
  available: boolean;
  freeAllocation: number;
  usedNeurons: number;
  freeUsedNeurons: number;
  remainingNeurons: number;
  overageNeurons: number;
  usagePercent: number;
  inferences: number;
  inputTokens: number;
  outputTokens: number;
  periodStart: string;
  resetAt: string;
  checkedAt: string;
  error?: "analytics_not_configured" | "analytics_unavailable" | "analytics_permission_denied" | "analytics_account_not_found" | "analytics_invalid_response" | string;
};

export function asRuntimeAiServices(state: AiServicesState): RuntimeAiServicesState {
  return state as RuntimeAiServicesState;
}

export function fetchWorkersAiUsage() {
  return jsonRequest<WorkersAiUsage>("/api/ai/workers-ai/usage");
}

export function createRuntimeAiService(input: {
  name: string;
  transport: AiServiceTransport;
  protocol?: AiService["protocol"];
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  headerPreset?: AiService["headerPreset"];
  gatewayId?: string;
  modelId?: string;
  modelName?: string;
}) {
  return jsonRequest<RuntimeAiServicesState>("/api/ai/services", { method: "POST", body: JSON.stringify(input) });
}

export function updateRuntimeAiService(id: string, patch: {
  name?: string;
  transport?: AiServiceTransport;
  protocol?: AiService["protocol"];
  baseUrl?: string;
  enabled?: boolean;
  apiKey?: string;
  headers?: Record<string, string>;
  headerPreset?: AiService["headerPreset"];
  gatewayId?: string;
}) {
  return jsonRequest<RuntimeAiServicesState>(`/api/ai/services/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}
