import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/features/settings/ai-services-settings.tsx", import.meta.url), "utf8");

test("AI custom headers do not require a replacement switch", () => {
  assert.doesNotMatch(source, /aria-label=\{t\("替换自定义请求头", "Replace custom headers"/);
  assert.match(source, /Saved headers are not echoed back\. Leave them untouched to keep the current headers/);
  assert.match(source, /setReplaceHeaders\(true\); setServiceDraft\(\(current\) => \(\{ \.\.\.current, headerPreset: null, headers: \[\.\.\.current\.headers, headerRow\(\)\] \}\)\)/);
});
