import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { openaiResponsesAdapter as adapter, adapterForProtocol, callProvider } from "../.test-build/worker/provider.js";
import { responsesProtocolUpgradeSql } from "../scripts/deploy.mjs";
import { sqliteDatabase } from "./sqlite-fixture.mjs";

const config = { providerName: "Responses", protocol: "openai-responses", baseUrl: "https://api.example.com/v1", apiKey: "secret", model: "gpt-test" };
test("Responses endpoint accepts host, version base, and complete endpoint", () => {
  for (const baseUrl of ["https://api.example.com", "https://api.example.com/", config.baseUrl, `${config.baseUrl}/`, `${config.baseUrl}/responses/`]) {
    assert.equal(adapter.buildEndpoint({ ...config, baseUrl }).href, `${config.baseUrl}/responses`);
  }
  assert.equal(adapter.buildEndpoint({ ...config, baseUrl: "https://gateway.example/proxy/v1" }).pathname, "/proxy/v1/responses");
});
test("Responses uses input and text.format without unsupported temperature", () => {
  const messages = [{ role: "system", content: "Return JSON" }, { role: "user", content: "Hello" }];
  const body = adapter.buildBody(config, messages, true);
  assert.deepEqual(body, { model: "gpt-test", input: messages, store: false, text: { format: { type: "json_object" } } });
  assert.equal(adapter.buildBody(config, messages, false).text, undefined);
});
test("Responses reads message output only and rejects partial, refused, failed, or empty results", () => {
  const message = (text) => ({ type: "message", content: [{ type: "output_text", text }] });
  assert.equal(adapter.readContent({ status: "completed", output: [{ type: "reasoning", content: [{ type: "output_text", text: "private" }] }, message("hello"), message(" world")] }), "hello world");
  for (const payload of [{ output: [] }, { status: "incomplete", output: [message("partial")] }, { status: "failed" }, { error: { message: "failed" } }, { output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] }]) {
    assert.throws(() => adapter.readContent(payload));
  }
});
test("removed and missing protocols never fall back to an HTTP adapter", async () => {
  for (const protocol of [undefined, "openai-compatible", "google-gemini", "unknown"]) {
    assert.throws(() => adapterForProtocol(protocol), /协议无效/);
    await assert.rejects(callProvider({ ...config, protocol }, [{ role: "user", content: "hello" }]), /协议无效/);
  }
});
test("protocol schema replacement preserves credentials, models, and Workers AI", () => {
  const baseline = readFileSync(new URL("../migrations/0001_schema.sql", import.meta.url), "utf8");
  const oldSchema = baseline.replace("'openai-responses', 'anthropic-messages'", "'openai-compatible', 'anthropic-messages', 'google-gemini'");
  const { sqlite, close } = sqliteDatabase(oldSchema);
  try {
    for (const [id, protocol, configJson] of [["http", "openai-compatible", "{}"], ["worker", "openai-compatible", '{"transport":"workers-ai"}'], ["claude", "anthropic-messages", "{}"]]) {
      sqlite.prepare("INSERT INTO ai_services VALUES (?, ?, ?, ?, 1, ?, 'now', 'now')").run(id, id, protocol, "https://example.com/v1", configJson);
    }
    sqlite.exec("INSERT INTO ai_models VALUES ('model', 'http', 'remote', 'Model', 1, 0, 'now', 'now')");
    sqlite.exec("INSERT INTO credentials VALUES ('ai:http', 'ai', NULL, 'http', NULL, 'ciphertext', 'iv', 'v1', 'fingerprint', NULL, 'now', 'now', 'active')");
    sqlite.exec("BEGIN");
    sqlite.exec(responsesProtocolUpgradeSql(baseline));
    sqlite.exec("COMMIT");
    assert.equal(sqlite.prepare("SELECT ciphertext FROM credentials").get().ciphertext, "ciphertext");
    assert.equal(sqlite.prepare("SELECT service_id FROM ai_models").get().service_id, "http");
    assert.equal(sqlite.prepare("SELECT enabled FROM ai_services WHERE service_id = 'worker'").get().enabled, 1);
    assert.equal(sqlite.prepare("SELECT enabled FROM ai_services WHERE service_id = 'http'").get().enabled, 0);
    assert.equal(sqlite.prepare("SELECT protocol FROM ai_services WHERE service_id = 'claude'").get().protocol, "anthropic-messages");
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.throws(() => sqlite.exec("UPDATE ai_services SET protocol = 'openai-compatible'"));
  } finally { close(); }
});
