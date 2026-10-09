import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync(new URL("../src/features/settings/ai-services-settings.tsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker/workers-ai.ts", import.meta.url), "utf8");
const services = readFileSync(new URL("../worker/ai-services.ts", import.meta.url), "utf8");
const aiRoutes = readFileSync(new URL("../worker/routes/ai.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../worker/router.ts", import.meta.url), "utf8");
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("Workers AI settings stay inside the COSS-owned UI system", () => {
  assert.match(settings, /from "\.\.\/\.\.\/components\/ui\/card"/);
  assert.match(settings, /<CardFrame/);
  assert.match(settings, /<Empty>/);
  assert.match(settings, /<ResponsiveDialog/);
  assert.match(settings, /<Badge/);
  assert.match(settings, /<Alert/);
  assert.doesNotMatch(settings, /<article\b/);
  assert.match(settings, /disabled=\{serviceModal === "edit"\}/);
});

test("Workers AI integration uses the native binding and official Analytics dataset", () => {
  assert.match(wrangler, /"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/s);
  assert.match(worker, /aiInferenceAdaptiveGroups/);
  assert.match(worker, /totalNeurons/);
  assert.match(worker, /overageNeurons/);
  assert.match(worker, /env\.AI\.run/);
  assert.match(settings, /Account Analytics > Read/);
  assert.match(settings, /usage\.freeAllocation/);
  assert.match(settings, /usage\.freeUsedNeurons/);
  assert.match(settings, /usage\.overageNeurons/);
  assert.match(settings, /Workers AI 今日免费额度/);
  assert.match(router, /\/api\/ai\/workers-ai\/usage/);
  assert.match(services, /runtime: "workers-ai"/);
  assert.match(services, /config_json: configJson/);
  assert.match(aiRoutes, /loadDefaultAiRuntimeConfig/);
  assert.match(aiRoutes, /callAiRuntime/);
});
