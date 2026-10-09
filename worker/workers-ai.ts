import type { StarBoxEnv } from "./types.js";
import type { ProviderMessage } from "./provider.js";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
export const CLOUDFLARE_FREE_DAILY_NEURONS = 10_000;

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
  error?: string;
};

export type WorkersAiRuntimeConfig = {
  runtime: "workers-ai";
  providerName: string;
  model: string;
  gatewayId: string;
};

type UsageBase = Pick<WorkersAiUsage, "configured" | "freeAllocation" | "periodStart" | "resetAt" | "checkedAt">;

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcDay(now = new Date()) {
  const start = utcDayStart(now);
  return new Date(start.getTime() + 86_400_000);
}

function stringValue(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function unavailableUsage(base: UsageBase, error: string): WorkersAiUsage {
  return {
    ...base,
    available: false,
    usedNeurons: 0,
    freeUsedNeurons: 0,
    remainingNeurons: CLOUDFLARE_FREE_DAILY_NEURONS,
    overageNeurons: 0,
    usagePercent: 0,
    inferences: 0,
    inputTokens: 0,
    outputTokens: 0,
    error,
  };
}

function analyticsPermissionDenied(response: Response, payload: any) {
  if (response.status === 401 || response.status === 403) return true;
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const text = errors.map((item: any) => `${item?.message ?? ""} ${item?.extensions?.code ?? ""}`).join(" ");
  return /permission|forbidden|unauthori[sz]ed|not authorized|access denied|authentication/i.test(text);
}

export function workersAiAnalyticsConfigured(env: StarBoxEnv) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim());
}

export async function fetchDailyWorkersAiUsage(env: StarBoxEnv, now = new Date()): Promise<WorkersAiUsage> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() || "";
  const token = env.CLOUDFLARE_API_TOKEN?.trim() || "";
  const start = utcDayStart(now);
  const reset = nextUtcDay(now);
  const base: UsageBase = {
    configured: Boolean(accountId && token),
    freeAllocation: CLOUDFLARE_FREE_DAILY_NEURONS,
    periodStart: start.toISOString(),
    resetAt: reset.toISOString(),
    checkedAt: now.toISOString(),
  };
  if (!accountId || !token) return unavailableUsage(base, "analytics_not_configured");

  const query = `query WorkersAiUsage($accountTag: string, $start: Time, $end: Time) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        aiInferenceAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, datetime_leq: $end }) {
          count
          sum { totalNeurons totalInputTokens totalOutputTokens }
        }
      }
    }
  }`;

  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { accountTag: accountId, start: start.toISOString(), end: now.toISOString() } }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return unavailableUsage(base, "analytics_unavailable");
  }

  let payload: any;
  try { payload = await response.json(); }
  catch { payload = null; }
  if (!response.ok || payload?.errors?.length) {
    return unavailableUsage(base, analyticsPermissionDenied(response, payload) ? "analytics_permission_denied" : "analytics_unavailable");
  }

  const accounts = payload?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) return unavailableUsage(base, "analytics_account_not_found");

  const row = accounts[0]?.aiInferenceAdaptiveGroups?.[0];
  const usedNeurons = Number(row?.sum?.totalNeurons || 0);
  const inferences = Number(row?.count || 0);
  const inputTokens = Number(row?.sum?.totalInputTokens || 0);
  const outputTokens = Number(row?.sum?.totalOutputTokens || 0);
  if (![usedNeurons, inferences, inputTokens, outputTokens].every(Number.isFinite) || usedNeurons < 0 || inferences < 0 || inputTokens < 0 || outputTokens < 0) {
    return unavailableUsage(base, "analytics_invalid_response");
  }

  const freeUsedNeurons = Math.min(CLOUDFLARE_FREE_DAILY_NEURONS, usedNeurons);
  const remainingNeurons = Math.max(0, CLOUDFLARE_FREE_DAILY_NEURONS - usedNeurons);
  const overageNeurons = Math.max(0, usedNeurons - CLOUDFLARE_FREE_DAILY_NEURONS);

  return {
    ...base,
    available: true,
    usedNeurons,
    freeUsedNeurons,
    remainingNeurons,
    overageNeurons,
    usagePercent: Math.min(100, Math.max(0, freeUsedNeurons / CLOUDFLARE_FREE_DAILY_NEURONS * 100)),
    inferences,
    inputTokens,
    outputTokens,
  };
}

function workersAiContent(result: unknown) {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") throw new Error("Workers AI 返回了空响应");
  const body = result as Record<string, any>;
  const direct = stringValue(body.response, 2_000_000);
  if (direct) return direct;
  const choice = body.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice.trim();
  const nested = body.result?.response;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  throw new Error("Workers AI 返回了空响应");
}

export async function callWorkersAi(env: StarBoxEnv, config: WorkersAiRuntimeConfig, messages: ProviderMessage[], jsonMode = false) {
  if (!env.AI?.run) throw new Error("Worker 未配置 Workers AI binding");
  const model = config.model.trim();
  if (!model.startsWith("@cf/")) throw new Error("Workers AI 模型 ID 必须以 @cf/ 开头");
  const gatewayId = config.gatewayId.trim() || "default";
  try {
    const result = await env.AI.run(
      model,
      {
        messages,
        temperature: 0.2,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      },
      { gateway: { id: gatewayId } },
    );
    return workersAiContent(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason || "");
    if (/3036|daily free allocation|neuron/i.test(message)) throw new Error("今日 Workers AI 免费额度已用尽");
    throw new Error(message ? `Workers AI 请求失败：${message.slice(0, 220)}` : "Workers AI 请求失败");
  }
}
