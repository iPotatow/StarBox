import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { sqliteDatabase } from "./sqlite-fixture.mjs";
import { route } from "../.test-build/worker/router.js";
import { DataRepository } from "../.test-build/worker/repository.js";
import { McpRepository } from "../.test-build/worker/mcp/repository.js";
import { sha256Hex } from "../.test-build/worker/http.js";
import { encryptGithubToken } from "../.test-build/worker/crypto.js";
import { MCP_READ_TOOLS } from "../.test-build/shared/mcp.js";

const base = "https://starbox.example";
async function fixture(t, writeMetadata = false) {
  const data = sqliteDatabase(); t.after(data.close);
  const env = { DB: data.DB, LOGIN_PASSWORD: "secret", STARBOX_ENCRYPTION_KEY: "local-test-encryption-key" };
  const repository = new DataRepository(data.DB);
  const logged = await route(new Request(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "secret" }) }), env);
  assert.equal(logged.status, 200);
  const cookie = logged.headers.get("set-cookie").split(";")[0];
  const manage = (path = "", method = "GET", body) => route(new Request(base + "/api/mcp/connections" + path, { method, headers: { cookie, ...(method === "GET" ? {} : { "Content-Type": "application/json", Origin: base }) }, ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }) }), env);
  const createdResponse = await manage("", "POST", { name: "Test assistant", writeMetadata });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const raw = (payload, headers = {}, method = "POST") => route(new Request(base + "/mcp", { method, headers: { Authorization: `Bearer ${created.token}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", ...headers }, ...(method === "POST" ? { body: typeof payload === "string" ? payload : JSON.stringify(payload) } : {}) }), env);
  const client = new Client({ name: "StarBox integration test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), { requestInit: { headers: { Authorization: `Bearer ${created.token}` } }, fetch: (url, init) => route(new Request(url, init), env) });
  await client.connect(transport); t.after(() => client.close());
  const call = async (name, args = {}) => client.callTool({ name, arguments: args });
  return { ...data, env, repository, manage, created, raw, client, call };
}
async function seed(repository, fullName = "owner/tool", id = 42) {
  await repository.upsertRepository({ id, full_name: fullName, name: fullName.split("/")[1], html_url: `https://github.com/${fullName}`, description: "React animation library", language: "TypeScript", default_branch: "main", updated_at: "2026-10-01", pushed_at: "2026-10-01", starred_at: "2026-10-01", topics: [], owner: { login: "owner", avatar_url: "" } }, true);
}
const output = (result) => result.structuredContent ?? JSON.parse(result.content[0].text);

test("real MCP client initializes, lists six read tools and searches personal metadata with pagination", async (t) => {
  const { repository, client, call } = await fixture(t);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), [...MCP_READ_TOOLS].sort());
  await seed(repository); await seed(repository, "owner/second", 43);
  await repository.mutate("category.create", { id: "frontend", name: "Frontend" });
  await repository.mutate("repository_meta.update", { fullName: "owner/tool", categoryId: "frontend", note: "login motion 100%", aiTags: ["Animation"], expectedUserRevision: 0 });
  let found = output(await call("search_repositories", { query: "login", language: "typescript", tag: "animation" }));
  assert.equal(found.items.length, 1); assert.equal(found.items[0].note, "login motion 100%"); assert.equal(found.items[0].user_revision, 1);
  assert.equal(output(await call("search_repositories", { query: "100%" })).items.length, 1);
  assert.equal(output(await call("search_repositories", { query: "%' OR 1=1 --" })).items.length, 0);
  found = output(await call("search_repositories", { categoryId: null })); assert.equal(found.items[0].full_name, "owner/second");
  const page = output(await call("search_repositories", { limit: 1 })); assert.equal(page.nextOffset, 1);
  assert.equal(output(await call("search_repositories", { limit: 1, offset: page.nextOffset })).nextOffset, null);
  assert.equal(output(await call("list_categories")).items[0].id, "frontend");
  await repository.subscribeRelease("owner/tool", true, 1);
  assert.equal(output(await call("list_subscriptions")).items[0].full_name, "owner/tool");
  assert.equal(output(await call("get_repository", { fullName: "OWNER/tool" })).repository.user_revision, 2);
});

test("management requires a web session and same origin; tokens are hashed, omitted from bootstrap and shown only once", async (t) => {
  const { env, sqlite, manage, created, raw } = await fixture(t);
  const values = sqlite.prepare("SELECT key, value FROM settings WHERE key LIKE 'mcp.token.%'").all();
  assert.equal(JSON.stringify(values).includes(created.token), false);
  assert.equal(values[0].key, "mcp.token." + await sha256Hex(created.token));
  const listed = await (await manage()).json(); assert.equal(listed.tokens.length, 1); assert.equal(JSON.stringify(listed).includes(created.token), false); assert.equal(JSON.stringify(listed).includes(await sha256Hex(created.token)), false);
  const snapshot = JSON.stringify(await new DataRepository(env.DB).bootstrap()); assert.equal(snapshot.includes("mcp.token."), false);
  assert.equal((await route(new Request(base + "/api/mcp/connections"), env)).status, 401);
  assert.equal((await route(new Request(base + "/api/mcp/connections", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.token}` }, body: "{}" }), env)).status, 403);
  assert.equal((await raw({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Authorization: "" })).status, 401);
  assert.equal((await raw({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await raw({ jsonrpc: "2.0", id: 1, method: "tools/list" })).headers.get("cache-control"), "no-store");
  assert.equal((await manage("", "POST", { name: "", expiresInDays: 999 })).status, 400);
  assert.equal((await manage("", "POST", { name: "extra", accountId: "another" })).status, 400);
});

test("read-only connections cannot edit, and permission changes take effect on existing clients", async (t) => {
  const { call, manage, created, repository, client } = await fixture(t);
  await seed(repository);
  assert.equal((await call("update_repository_metadata", { fullName: "owner/tool", note: "denied", expectedUserRevision: 0 })).isError, true);
  assert.equal((await manage("/" + created.connection.id, "PATCH", { writeMetadata: true })).status, 200);
  assert.equal((await client.listTools()).tools.length, 7);
  assert.equal((await call("update_repository_metadata", { fullName: "owner/tool", note: "approved", expectedUserRevision: 0 })).isError, undefined);
  await manage("/" + created.connection.id, "PATCH", { writeMetadata: false });
  assert.equal((await call("update_repository_metadata", { fullName: "owner/tool", note: "denied again", expectedUserRevision: 1 })).isError, true);
  assert.equal(output(await call("get_repository", { fullName: "owner/tool" })).repository.note, "approved");
});

test("metadata edits share SQL revision guards, reject stale writes and only modify supplied fields", async (t) => {
  const { call, repository, sqlite } = await fixture(t, true); await seed(repository);
  await repository.mutate("category.create", { id: "front", name: "Frontend" });
  const updated = await call("update_repository_metadata", { fullName: "OWNER/tool", expectedUserRevision: 0, note: "approved note", categoryId: "front", tags: ["React", "React"] });
  assert.equal(output(updated).userRevision, 1);
  assert.equal(sqlite.prepare("SELECT category_locked FROM repositories").get().category_locked, 1);
  const stale = await call("update_repository_metadata", { fullName: "owner/tool", expectedUserRevision: 0, note: "lost write" });
  assert.equal(stale.isError, true); assert.equal(output(stale).error.code, "revision_conflict");
  assert.equal((await call("update_repository_metadata", { fullName: "owner/tool", expectedUserRevision: 1, categoryId: "missing" })).isError, true);
  assert.equal((await call("update_repository_metadata", { fullName: "owner/tool", expectedUserRevision: 1 })).isError, true);
  const noRevision = await call("update_repository_metadata", { fullName: "owner/tool", note: "unsafe" }); assert.equal(noRevision.isError, true);
  await call("update_repository_metadata", { fullName: "owner/tool", expectedUserRevision: 1, categoryId: null });
  const saved = output(await call("get_repository", { fullName: "owner/tool" })).repository;
  assert.equal(saved.note, "approved note"); assert.deepEqual(saved.ai_tags, ["React"]); assert.equal(saved.category_id, null); assert.equal(saved.user_revision, 2);
});

test("revoked and expired connections fail immediately; last-used patches preserve permissions", async (t) => {
  const { manage, created, raw, env, sqlite } = await fixture(t);
  const store = new McpRepository(env.DB); const hash = await sha256Hex(created.token);
  await store.updateToken(created.connection.id, true); await store.touchToken(hash, new Date().toISOString());
  assert.equal((await store.tokenByHash(hash)).writeMetadata, true);
  assert.ok((await store.tokenByHash(hash)).lastUsedAt);
  sqlite.prepare("UPDATE settings SET value = json_set(value, '$.expiresAt', '2000-01-01') WHERE key = ?").run("mcp.token." + hash);
  assert.equal((await raw({ jsonrpc: "2.0", id: 1, method: "ping" })).status, 401);
  await manage("/" + created.connection.id, "DELETE");
  assert.equal((await raw({ jsonrpc: "2.0", id: 2, method: "ping" })).status, 401);
  assert.equal((await manage()).status, 200); assert.equal((await (await manage()).json()).tokens.length, 0);
});

test("malformed protocol, invalid arguments, oversized bodies and disallowed methods are bounded", async (t) => {
  const { raw, call, env } = await fixture(t);
  assert.equal((await raw("{" )).status, 400);
  assert.equal((await raw(" ".repeat(65537))).status, 413);
  assert.equal((await raw({}, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await raw(null, {}, "GET")).status, 405);
  assert.equal((await raw(null, {}, "DELETE")).status, 405);
  assert.equal((await call("search_repositories", { limit: 5000 })).isError, true);
  assert.equal((await call("get_repository_readme", { fullName: "../evil/path" })).isError, true);
  const missing = await call("get_repository", { fullName: "missing/repo" }); assert.equal(output(missing).error.code, "repository_not_found");
  env.MCP_RATE_LIMITER = { limit: async () => ({ success: false }) };
  const limited = await raw({ jsonrpc: "2.0", id: 1, method: "ping" }); assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "60");
});

test("README and releases use the stored encrypted GitHub credential, with live paging and bounded content", async (t) => {
  const { call, repository, env } = await fixture(t); await seed(repository);
  assert.equal(output(await call("get_releases", { fullName: "owner/tool" })).error.code, "github_credential_missing");
  const encrypted = await encryptGithubToken("stored-github-token", env.STARBOX_ENCRYPTION_KEY, "primary", "7");
  await repository.saveCredential({ account_id: "primary", github_numeric_id: "7", github_login: "owner", ciphertext: encrypted.ciphertext, iv: encrypted.iv, key_version: "v1", fingerprint: encrypted.fingerprint, validated_at: "now", status: "active" });
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer stored-github-token");
    assert.match(String(url), /^https:\/\/api.github.com\/repos\/owner\/tool\//);
    if (String(url).endsWith("/readme")) return Response.json({ path: "README.md", html_url: "https://github.com/owner/tool#readme" });
    if (String(url).endsWith("/contents")) return Response.json([]);
    if (String(url).endsWith("/contents/README.md")) return new Response("a".repeat(500));
    assert.match(String(url), /releases\?per_page=1&page=2$/);
    return Response.json([{ id: 4, tag_name: "v2", name: "Version 2", body: "b".repeat(500), html_url: "https://github.com/owner/tool/releases/tag/v2", published_at: "2026-10-02", created_at: "2026-10-02", draft: false, prerelease: false, author: null, assets: [{ id: 5, name: "arm64.dmg", size: 10, download_count: 1, browser_download_url: "https://github.com/owner/tool/releases/download/v2/arm64.dmg" }] }]);
  };
  const readme = output(await call("get_repository_readme", { fullName: "owner/tool", maxChars: 100, offset: 100 }));
  assert.equal(readme.content.length, 100); assert.equal(readme.nextOffset, 200); assert.equal(readme.totalChars, 500);
  const release = output(await call("get_releases", { fullName: "owner/tool", page: 2, limit: 1, maxBodyChars: 100, bodyOffset: 100 }));
  assert.equal(release.nextPage, 3); assert.equal(release.items[0].body.length, 100); assert.equal(release.items[0].nextBodyOffset, 200); assert.equal(release.items[0].assets[0].name, "arm64.dmg");
  assert.equal(JSON.stringify(release).includes("stored-github-token"), false);
});
