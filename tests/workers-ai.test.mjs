import assert from "node:assert/strict";
import test from "node:test";
import { CLOUDFLARE_FREE_DAILY_NEURONS, callWorkersAi, fetchDailyWorkersAiUsage } from "../.test-build/worker/workers-ai.js";

test("Workers AI usage reads official account-level neurons for the UTC day", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ count: 19, sum: { totalNeurons: 282.9529535770416, totalInputTokens: 3344, totalOutputTokens: 8434 } }] }] } } });
  };
  const now = new Date("2026-10-05T11:07:58.304Z");
  const usage = await fetchDailyWorkersAiUsage({ CLOUDFLARE_API_TOKEN: "test-token", CLOUDFLARE_ACCOUNT_ID: "account" }, now);
  assert.equal(request.url, "https://api.cloudflare.com/client/v4/graphql");
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.variables.start, "2026-10-05T00:00:00.000Z");
  assert.equal(payload.variables.end, now.toISOString());
  assert.match(payload.query, /aiInferenceAdaptiveGroups/);
  assert.match(payload.query, /totalNeurons/);
  assert.equal(usage.available, true);
  assert.equal(usage.usedNeurons, 282.9529535770416);
  assert.equal(usage.freeUsedNeurons, 282.9529535770416);
  assert.equal(usage.remainingNeurons, CLOUDFLARE_FREE_DAILY_NEURONS - 282.9529535770416);
  assert.equal(usage.overageNeurons, 0);
  assert.equal(usage.inferences, 19);
  assert.equal(usage.inputTokens, 3344);
  assert.equal(usage.outputTokens, 8434);
  assert.equal(usage.resetAt, "2026-10-06T00:00:00.000Z");
});

test("Workers AI usage keeps total account usage after the free allocation is exceeded", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ count: 42, sum: { totalNeurons: 16_000, totalInputTokens: 90_000, totalOutputTokens: 12_000 } }] }] } } });
  const usage = await fetchDailyWorkersAiUsage({ CLOUDFLARE_API_TOKEN: "test-token", CLOUDFLARE_ACCOUNT_ID: "account" }, new Date("2026-10-05T23:59:59.000Z"));
  assert.equal(usage.usedNeurons, 16_000);
  assert.equal(usage.freeUsedNeurons, 10_000);
  assert.equal(usage.remainingNeurons, 0);
  assert.equal(usage.overageNeurons, 6_000);
  assert.equal(usage.usagePercent, 100);
});

test("Workers AI usage remains optional when Analytics credentials are absent", async () => {
  const usage = await fetchDailyWorkersAiUsage({});
  assert.equal(usage.configured, false);
  assert.equal(usage.available, false);
  assert.equal(usage.error, "analytics_not_configured");
  assert.equal(usage.freeAllocation, 10_000);
  assert.equal(usage.freeUsedNeurons, 0);
  assert.equal(usage.overageNeurons, 0);
});

test("Workers AI usage reports read-only Analytics permission failures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ errors: [{ message: "denied" }] }, { status: 403 });
  const usage = await fetchDailyWorkersAiUsage({ CLOUDFLARE_API_TOKEN: "test-token", CLOUDFLARE_ACCOUNT_ID: "account" });
  assert.equal(usage.configured, true);
  assert.equal(usage.available, false);
  assert.equal(usage.error, "analytics_permission_denied");
});

test("Workers AI usage recognizes GraphQL permission errors returned with HTTP 200", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ errors: [{ message: "Permission denied for Account Analytics", extensions: { code: "FORBIDDEN" } }] });
  const usage = await fetchDailyWorkersAiUsage({ CLOUDFLARE_API_TOKEN: "test-token", CLOUDFLARE_ACCOUNT_ID: "account" });
  assert.equal(usage.available, false);
  assert.equal(usage.error, "analytics_permission_denied");
});

test("Workers AI runtime uses the native binding and default AI Gateway", async () => {
  let invocation;
  const env = {
    AI: {
      async run(model, input, options) {
        invocation = { model, input, options };
        return { choices: [{ message: { content: "STARBOX_OK" } }] };
      },
    },
  };
  const result = await callWorkersAi(env, { runtime: "workers-ai", providerName: "Cloudflare Workers AI", model: "@cf/zai-org/glm-4.7-flash", gatewayId: "default" }, [{ role: "user", content: "Connectivity test." }], true);
  assert.equal(result, "STARBOX_OK");
  assert.equal(invocation.model, "@cf/zai-org/glm-4.7-flash");
  assert.equal(invocation.options.gateway.id, "default");
  assert.equal(invocation.input.response_format.type, "json_object");
});

test("Workers AI runtime rejects non-Cloudflare model IDs", async () => {
  await assert.rejects(() => callWorkersAi({ AI: { run: async () => ({ response: "ok" }) } }, { runtime: "workers-ai", providerName: "Cloudflare Workers AI", model: "gpt-5", gatewayId: "default" }, [{ role: "user", content: "test" }]), /@cf\//);
});
