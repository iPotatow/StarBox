import assert from "node:assert/strict";
import test from "node:test";
import { parseFullName, route } from "../.test-build/worker/index.js";
import { DataRepository } from "../.test-build/worker/repository.js";
import { customHttpProviderAdapter, providerEndpoint } from "../.test-build/worker/provider.js";
import { sha256Hex } from "../.test-build/worker/auth.js";
import { credentialAad, decryptGithubToken, encryptGithubToken } from "../.test-build/worker/crypto.js";
import { readFileSync } from "node:fs";

const repo = {
  id: 1,
  name: "react",
  full_name: "facebook/react",
  description: "React",
  html_url: "https://github.com/facebook/react",
  stargazers_count: 100,
  forks_count: 10,
  language: "JavaScript",
  license: { spdx_id: "MIT" },
  updated_at: "2026-09-10T00:00:00Z",
  pushed_at: "2026-09-10T00:00:00Z",
  archived: false,
  topics: ["ui"],
  owner: { login: "facebook", avatar_url: "https://example.com/a.png" },
};

function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-starbox-github-token", "token");
  return new Request(`https://starbox.example${path}`, { ...init, headers });
}

function mockFetch(handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = previous; };
}

class MemoryD1 {
  constructor() {
    this.tables = {
      accounts: [], app_account: [], app_sessions: [], github_credentials: [], activity_log: [], notifications: [], migration_runs: [],
      repositories: [], repository_meta: [], categories: [], release_subscriptions: [], releases: [], release_states: [], forks: [], github_lists: [], github_list_memberships: [], sync_state: [], release_sync_state: [], fork_snapshots: [], fork_events: [], sync_changes: [], processed_mutations: [], login_rate_limits: [],
    };
    this.batchTail = Promise.resolve();
    this.failNextBatch = false;
    this.failBatchAtIndex = null;
  }
  prepare(sql) {
    const db = this;
    const statement = { sql, values: [] };
    statement.bind = (...values) => { statement.values = values; return statement; };
    statement.run = async () => db.run(statement.sql, statement.values) ?? { success: true, meta: {}, results: [] };
    statement.first = async () => db.first(statement.sql, statement.values);
    statement.all = async () => ({ results: db.all(statement.sql, statement.values) });
    return statement;
  }
  async batch(statements) {
    const previous = this.batchTail;
    let release;
    this.batchTail = new Promise((resolve) => { release = resolve; });
    await previous;
    const before = structuredClone(this.tables);
    try {
      if (this.failNextBatch) { this.failNextBatch = false; throw new Error("injected D1 batch failure"); }
      const results = [];
      for (let index = 0; index < statements.length; index += 1) {
        if (this.failBatchAtIndex === index) { this.failBatchAtIndex = null; throw new Error("injected mid-batch failure"); }
        results.push(await statements[index].run());
      }
      return results;
    } catch (reason) {
      this.tables = before;
      throw reason;
    } finally {
      release();
    }
  }
  run(sql, values) {
    if (sql.startsWith("INSERT INTO processed_mutations")) {
      if (this.tables.processed_mutations.some((row) => row.mutation_id === values[0])) throw new Error("UNIQUE constraint failed: processed_mutations.mutation_id");
      this.tables.processed_mutations.push({ mutation_id: values[0], processed_at: values[1], seq: null, revision: null }); return;
    }
    if (sql.startsWith("UPDATE processed_mutations SET")) {
      const row = this.tables.processed_mutations.find((item) => item.mutation_id === values[0]);
      if (row) { row.seq = this.tables.sync_changes.at(-1)?.seq ?? 0; row.revision = this.tables.app_account[0]?.revision ?? 0; }
      return;
    }
    if (sql.startsWith("UPDATE app_account SET revision = revision + 1")) {
      const row = this.tables.app_account[0];
      if (!row) throw new Error("app_account missing");
      row.revision += 1; row.updated_at = values[0];
      return { success: true, meta: {}, results: [{ revision: row.revision }] };
    }
    if (sql.includes("INSERT INTO sync_changes") && sql.includes("SELECT 'primary'")) {
      const row = { seq: (this.tables.sync_changes.at(-1)?.seq ?? 0) + 1, account_id: "primary", entity_type: values[0], entity_key: values[1], operation: values[2], revision: this.tables.app_account[0]?.revision ?? 0, created_at: values[3] };
      this.tables.sync_changes.push(row);
      return { success: true, meta: {}, results: [{ seq: row.seq, revision: row.revision }] };
    }
    if (sql.includes("INSERT INTO app_account")) {
      const existing = this.tables.app_account.find((row) => row.account_id === "primary");
      if (existing) { existing.updated_at = values[0]; return; }
      this.tables.app_account.push({ account_id: "primary", github_user_id: null, github_login: null, revision: 0, created_at: values[0], updated_at: values[0] }); return;
    }
    if (sql.includes("INSERT INTO login_rate_limits")) {
      const existing = this.tables.login_rate_limits.find((row) => row.rate_key === values[0]);
      if (existing) { existing.attempt_count += 1; existing.reset_at = values[1]; } else this.tables.login_rate_limits.push({ rate_key: values[0], attempt_count: 1, reset_at: values[1] }); return;
    }
    if (sql.startsWith("DELETE FROM login_rate_limits")) { this.tables.login_rate_limits = this.tables.login_rate_limits.filter((row) => row.rate_key !== values[0]); return; }
    if (sql.startsWith("UPDATE app_account SET revision")) { const row = this.tables.app_account[0]; if (row) { row.revision = values[0]; row.updated_at = values[1]; } return; }
    if (sql.startsWith("UPDATE app_account SET github_user_id = NULL")) { const row = this.tables.app_account[0]; if (row) { row.github_user_id = null; row.github_login = null; row.updated_at = values[0]; } return; }
    if (sql.startsWith("UPDATE app_account SET github_user_id")) { const row = this.tables.app_account[0]; if (row) { row.github_user_id = values[0]; row.github_login = values[1]; row.updated_at = values[2]; } return; }
    if (sql.includes("INSERT INTO sync_changes")) { this.tables.sync_changes.push({ seq: this.tables.sync_changes.length + 1, account_id: "primary", entity_type: values[0], entity_key: values[1], operation: values[2], revision: values[3], created_at: values[4] }); return; }
    if (sql.includes("INSERT INTO releases")) { const row = { account_id: "primary", release_id: values[0], repo_full_name: values[1], tag_name: values[2], payload_json: values[3], published_at: values[4], created_at: values[5] }; const index = this.tables.releases.findIndex((item) => item.release_id === row.release_id); if (index >= 0) this.tables.releases[index] = row; else this.tables.releases.push(row); return; }
    if (sql.includes("INSERT INTO notifications") && sql.includes("SELECT ?1")) {
      const releaseId = values[3];
      if (!this.tables.releases.some((row) => row.release_id === releaseId)) this.tables.notifications.push({ id: values[0], account_id: "primary", kind: "new_release", title: "发现新 Release", body: values[1], read_at: null, created_at: values[2] });
      return;
    }
    if (sql.includes("INSERT INTO notifications") && sql.includes("'fork_ready'")) {
      this.tables.notifications.push({ id: values[0], account_id: "primary", kind: "fork_ready", title: "Fork 已就绪", body: values[1], read_at: null, created_at: values[2] }); return;
    }
    if (sql.includes("INSERT INTO notifications") && sql.includes("'fork_sync_failed'")) {
      this.tables.notifications.push({ id: values[0], account_id: "primary", kind: "fork_sync_failed", title: "Fork 操作失败", body: values[1], read_at: null, created_at: values[2] }); return;
    }
    if (sql.includes("INSERT INTO notifications")) { this.tables.notifications.push({ id: values[0], account_id: "primary", kind: values[1], title: values[2], body: values[3], read_at: null, created_at: values[4] }); return; }
    if (sql.includes("INSERT INTO forks")) { const row = { account_id: "primary", full_name: values[0], parent_full_name: values[1], status: values[2], updated_at: values[3], payload_json: values[4] }; const index = this.tables.forks.findIndex((item) => item.full_name === row.full_name); if (index >= 0) this.tables.forks[index] = row; else this.tables.forks.push(row); return; }
    if (sql.includes("INSERT INTO github_lists")) { const row = { account_id: "primary", list_id: values[0], name: values[1], description: values[2], is_private: values[3], updated_at: values[4] }; const index = this.tables.github_lists.findIndex((item) => item.list_id === row.list_id); if (index >= 0) this.tables.github_lists[index] = row; else this.tables.github_lists.push(row); return; }
    if (sql.startsWith("DELETE FROM github_lists")) { this.tables.github_lists = values.length ? this.tables.github_lists.filter((row) => row.list_id !== values[0]) : []; return; }
    if (sql.includes("INSERT INTO github_list_memberships")) { this.tables.github_list_memberships ??= []; const row = { account_id: "primary", list_id: values[0], github_repo_id: values[1], repo_full_name: values.length >= 5 ? values[2] : "", html_url: values.length >= 5 ? values[3] : "", updated_at: values.length >= 5 ? values[4] : values[2] }; const index = this.tables.github_list_memberships.findIndex((item) => item.list_id === row.list_id && item.github_repo_id === row.github_repo_id); if (index >= 0) this.tables.github_list_memberships[index] = row; else this.tables.github_list_memberships.push(row); return; }
    if (sql.startsWith("DELETE FROM github_list_memberships")) { if (sql.includes("list_id = ?1")) this.tables.github_list_memberships = (this.tables.github_list_memberships || []).filter((row) => row.list_id !== values[0]); else if (sql.includes("github_repo_id = ?1")) this.tables.github_list_memberships = (this.tables.github_list_memberships || []).filter((row) => row.github_repo_id !== values[0]); else this.tables.github_list_memberships = []; return; }
    if (sql.includes("INSERT INTO sync_state")) { const row = { account_id: "primary", scope: values[0], cursor: values[1], revision: values[2], updated_at: values[3] }; const index = this.tables.sync_state.findIndex((item) => item.scope === row.scope); if (index >= 0) this.tables.sync_state[index] = row; else this.tables.sync_state.push(row); return; }
    if (sql.includes("INSERT INTO accounts")) {
      const existing = this.tables.accounts.find((row) => row.id === values[0]);
      if (existing) { existing.updated_at = values[2]; return; }
      this.tables.accounts.push({ id: values[0], github_user_id: null, username: values[1], created_at: values[2], updated_at: values[2] }); return;
    }
    if (sql.startsWith("UPDATE accounts SET github_user_id = NULL")) { for (const row of this.tables.accounts) if (row.id === values[1] && row.github_user_id === values[2]) row.github_user_id = null; return; }
    if (sql.startsWith("UPDATE accounts SET github_user_id")) { for (const row of this.tables.accounts) if (row.id === values[2]) row.github_user_id = values[0]; return; }
    if (sql.includes("INSERT INTO app_sessions")) { const legacy = values.length >= 6; this.tables.app_sessions.push({ token_hash: values[0], account_id: legacy ? values[1] : "primary", github_user_id: legacy ? values[2] : null, created_at: legacy ? values[3] : values[1], expires_at: legacy ? values[4] : values[2], last_seen_at: legacy ? values[5] : values[3], revoked_at: null }); return; }
    if (sql.startsWith("UPDATE app_sessions SET last_seen_at")) { for (const row of this.tables.app_sessions) if (row.token_hash === values[1] && !row.revoked_at) row.last_seen_at = values[0]; return; }
    if (sql.startsWith("UPDATE app_sessions SET revoked_at")) { for (const row of this.tables.app_sessions) if (row.token_hash === values[1]) row.revoked_at = values[0]; return; }
    if (sql.startsWith("UPDATE app_sessions SET github_user_id = NULL")) { for (const row of this.tables.app_sessions) if (row.account_id === values[1] && row.github_user_id === values[2]) row.github_user_id = null; return; }
    if (sql.includes("INSERT INTO github_credentials")) { const modern = sql.includes("account_id, github_numeric_id"); const row = modern ? { account_id: "primary", github_user_id: values[0], github_numeric_id: values[0], github_login: values[1], ciphertext: values[2], iv: values[3], key_version: values[4], fingerprint: values[5], validated_at: values[6], created_at: values[7], updated_at: values[7], status: values[8] } : { github_user_id: values[0], ciphertext: values[1], iv: values[2], key_version: values[3], fingerprint: values[4], github_numeric_id: values[5], github_login: values[6], validated_at: values[7], created_at: values[7], updated_at: values[7], status: values[8] }; const index = this.tables.github_credentials.findIndex((item) => modern ? item.account_id === "primary" : item.github_user_id === row.github_user_id); if (index >= 0) this.tables.github_credentials[index] = row; else this.tables.github_credentials.push(row); return; }
    if (sql.startsWith("UPDATE github_credentials SET ciphertext")) { const row = this.tables.github_credentials[0]; if (row) { row.ciphertext = values[0]; row.iv = values[1]; row.key_version = values[2]; row.fingerprint = values[3]; row.updated_at = values[4]; } return; }
    if (sql.startsWith("DELETE FROM github_credentials")) { this.tables.github_credentials = values.length ? this.tables.github_credentials.filter((row) => row.github_user_id !== values[0]) : []; return; }
    if (sql.includes("UPDATE app_sessions SET github_user_id = ?1")) { for (const row of this.tables.app_sessions) if (row.token_hash === values[2] && !row.revoked_at) { row.github_user_id = values[0]; row.last_seen_at = values[1]; } return; }
    if (sql.includes("INSERT INTO activity_log")) { const modern = sql.includes("account_id, type"); this.tables.activity_log.push(modern ? { id: values[0], account_id: "primary", github_user_id: null, type: values[1], payload_json: values[2], created_at: values[3] } : { id: values[0], github_user_id: values[1], type: values[2], payload_json: values[3], created_at: values[4] }); return; }
    if (sql.includes("INSERT INTO migration_runs")) { this.tables.migration_runs.push({ run_id: values[0], github_user_id: values[1], source_version: values[2], state: values[3], expected_count: values[4], uploaded_count: values[5], checksum: values[6], verified_at: values[7], created_at: values[8], updated_at: values[8] }); return; }
    if (sql.startsWith("UPDATE migration_runs")) { for (const row of this.tables.migration_runs) if (row.github_user_id === values[5] && row.run_id === values[6]) { row.state = values[0]; row.uploaded_count = values[1]; row.checksum = values[2]; row.verified_at = values[3]; row.updated_at = values[4]; } return; }
    if (sql.includes("INSERT INTO repositories")) { const modern = sql.includes("account_id, github_repo_id"); const row = modern ? { account_id: "primary", github_repo_id: values[0], full_name: values[1], name: values[2], html_url: values[3], description: values[4], language: values[5], default_branch: values[6], is_starred: values[7], starred_at: values[8], updated_at: values[9], raw_json: values[10] } : { github_user_id: values[0], github_repo_id: values[1], full_name: values[2], name: values[3], html_url: values[4], description: values[5], language: values[6], default_branch: values[7], updated_at: values[8], raw_json: values[9] }; const index = this.tables.repositories.findIndex((item) => item.github_repo_id === row.github_repo_id); if (index >= 0) this.tables.repositories[index] = row; else this.tables.repositories.push(row); return; }
    if (sql.startsWith("UPDATE repositories SET is_starred = 0")) { const row = this.tables.repositories.find((item) => item.full_name === values[1]); if (row) { row.is_starred = 0; row.starred_at = null; row.updated_at = values[0]; } return; }
    if (sql.includes("INSERT INTO release_states")) { const row = { account_id: "primary", release_id: values[0], read_at: values[1] }; const index = this.tables.release_states.findIndex((item) => item.release_id === row.release_id); if (index >= 0) this.tables.release_states[index] = row; else this.tables.release_states.push(row); return; }
    if (sql.includes("INSERT INTO categories")) { const row = { account_id: "primary", category_id: values[0], id: values[0], name: values[1], color: values[2], sort_order: values[3], locked: values[4], created_at: values[5], updated_at: values[5] }; const index = this.tables.categories.findIndex((item) => item.category_id === row.category_id); if (index >= 0) this.tables.categories[index] = row; else this.tables.categories.push(row); return; }
    if (sql.startsWith("DELETE FROM categories")) { this.tables.categories = this.tables.categories.filter((row) => row.category_id !== values[0]); return; }
    if (sql.includes("INSERT INTO release_subscriptions")) { if (!this.tables.release_subscriptions.some((row) => row.repo_full_name === values[0])) this.tables.release_subscriptions.push({ account_id: "primary", repo_full_name: values[0], created_at: values[1] }); return; }
    if (sql.startsWith("DELETE FROM release_subscriptions")) { this.tables.release_subscriptions = this.tables.release_subscriptions.filter((row) => row.repo_full_name !== values[0]); return; }
    if (sql.includes("INSERT INTO release_sync_state")) { const row = { account_id: "primary", repo_full_name: values[0], cursor: values[1], revision: values[2], last_synced_at: values[3], updated_at: values[3] }; const index = this.tables.release_sync_state.findIndex((item) => item.repo_full_name === row.repo_full_name); if (index >= 0) this.tables.release_sync_state[index] = row; else this.tables.release_sync_state.push(row); return; }
    if (sql.includes("INSERT INTO fork_snapshots")) {
      const atomicRevision = sql.includes("SELECT revision + 1") ? (this.tables.app_account[0]?.revision ?? 0) + 1 : values[2];
      const statusIndex = sql.includes("SELECT revision + 1") ? 2 : 3;
      this.tables.fork_snapshots.push({ account_id: "primary", repo_full_name: values[0], cursor: values[1], revision: atomicRevision, status: values[statusIndex], created_at: values[statusIndex + 1] }); return;
    }
    if (sql.includes("INSERT INTO fork_events")) { this.tables.fork_events.push({ id: values[0], account_id: "primary", repo_full_name: values[1], event_type: values[2], payload_json: values[3], created_at: values[4] }); return; }
    if (sql.includes("INSERT INTO repository_meta")) { const batchCategoryOnly = sql.includes("DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at"); const row = { account_id: "primary", github_repo_id: values[0], category_id: values[1], note: values.length >= 7 ? values[2] : null, pinned: values.length >= 7 ? values[3] : 0, ai_summary: values.length >= 7 ? values[4] : null, ai_tags_json: values.length >= 7 ? values[5] : "[]", updated_at: values.length >= 7 ? values[6] : values[2] }; const index = this.tables.repository_meta.findIndex((item) => item.github_repo_id === row.github_repo_id); if (index >= 0) this.tables.repository_meta[index] = batchCategoryOnly ? { ...this.tables.repository_meta[index], category_id: row.category_id, updated_at: row.updated_at } : { ...this.tables.repository_meta[index], ...row }; else this.tables.repository_meta.push(row); return; }
    if (sql.startsWith("UPDATE repository_meta SET category_id = NULL")) { for (const row of this.tables.repository_meta) if (row.category_id === values[1]) { row.category_id = null; row.updated_at = values[0]; } return; }
    throw new Error(`Unhandled SQL run: ${sql}`);
  }
  first(sql, values) {
    if (sql.includes("FROM app_account")) return this.tables.app_account[0] || null;
    if (sql.includes("FROM processed_mutations")) return this.tables.processed_mutations.find((row) => row.mutation_id === values[0]) || null;
    if (sql.includes("FROM accounts WHERE username")) return this.tables.accounts.find((row) => row.username === values[0]) || null;
    if (sql.includes("FROM app_sessions WHERE token_hash") && sql.includes("LIMIT 1")) return this.tables.app_sessions.find((row) => row.token_hash === values[0]) || null;
    if (sql.includes("SELECT github_user_id FROM app_sessions")) { const row = this.tables.app_sessions.find((item) => item.token_hash === values[0]); return row ? { github_user_id: row.github_user_id } : null; }
    if (sql.includes("FROM github_credentials")) return this.tables.github_credentials.find((row) => sql.includes("account_id = 'primary'") ? row.account_id === "primary" : row.github_user_id === values[0]) || null;
    if (sql.includes("FROM releases")) return this.tables.releases.find((row) => row.release_id === values[0]) || null;
    if (sql.includes("FROM login_rate_limits")) return this.tables.login_rate_limits.find((row) => row.rate_key === values[0]) || null;
    if (sql.includes("SELECT revision FROM app_account")) return { revision: this.tables.app_account[0]?.revision || 0 };
    if (sql.includes("INSERT INTO sync_changes")) { this.tables.sync_changes.push({ seq: this.tables.sync_changes.length + 1, account_id: "primary", entity_type: values[0], entity_key: values[1], operation: values[2], revision: values[3], created_at: values[4] }); return this.tables.sync_changes.at(-1); }
    if (sql.includes("MAX(seq)")) return { seq: this.tables.sync_changes.at(-1)?.seq || 0 };
    if (sql.includes("FROM migration_runs")) return this.tables.migration_runs.find((row) => row.github_user_id === values[0] && row.run_id === values[1]) || null;
    if (sql.includes("FROM sync_state")) return this.tables.sync_state.find((row) => row.github_user_id === values[0] && row.scope === values[1]) || null;
    throw new Error(`Unhandled SQL first: ${sql}`);
  }
  all(sql, values) {
    if (sql.includes("FROM sync_changes")) return this.tables.sync_changes.filter((row) => row.seq > values[0]).slice(0, values[1]);
    if (sql.includes("FROM activity_log")) return this.tables.activity_log.filter((row) => row.account_id === "primary" || row.github_user_id === values[0]).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, values[0] && !sql.includes("account_id") ? values[2] : values[0]);
    if (sql.includes("FROM notifications")) return this.tables.notifications.filter((row) => row.github_user_id === values[0]).slice(0, values[1]);
    if (sql.includes("FROM repositories")) { const rows = this.tables.repositories; return sql.includes("is_starred = 1") ? rows.filter((row) => row.is_starred === 1) : rows; }
    if (sql.includes("FROM repository_meta")) return this.tables.repository_meta;
    if (sql.includes("FROM categories")) return this.tables.categories;
    if (sql.includes("FROM release_subscriptions")) return this.tables.release_subscriptions;
    if (sql.includes("FROM releases")) return [];
    if (sql.includes("FROM release_states")) return this.tables.release_states;
    if (sql.includes("FROM forks")) return this.tables.forks;
    if (sql.includes("FROM github_lists")) return this.tables.github_lists;
    if (sql.includes("FROM github_list_memberships")) return this.tables.github_list_memberships;
    throw new Error(`Unhandled SQL all: ${sql}`);
  }
}

function d1Env(overrides = {}) { return { DB: new MemoryD1(), GITHUB_TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012", ...overrides }; }
function appRequest(path, init = {}, cookie = "") {
  const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); if (init.method && init.method !== "GET") headers.set("origin", "https://starbox.example");
  return new Request(`https://starbox.example${path}`, { ...init, headers });
}
async function login(env, username = "admin", password = "000000") {
  const response = await route(appRequest("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }), env);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
  return { response, cookie };
}
function attachTenant(env, githubUserId = "42") {
  if (env.DB.tables.app_account[0]) env.DB.tables.app_account[0].github_user_id = githubUserId;
}

test("parseFullName validates owner/repo", () => {
  assert.deepEqual(parseFullName("facebook/react"), { owner: "facebook", repo: "react", fullName: "facebook/react" });
  assert.throws(() => parseFullName("bad value"), /owner\/repo/);
});

test("custom provider validates endpoint and optional headers", () => {
  assert.equal(providerEndpoint("https://api.example.com/v1/").toString(), "https://api.example.com/v1/chat/completions");
  assert.throws(() => providerEndpoint("http://localhost:11434/v1"), /HTTPS|本地/);
  const headers = customHttpProviderAdapter.buildHeaders({
    providerName: "custom",
    baseUrl: "https://api.example.com/v1",
    apiKey: "secret",
    model: "m",
    headers: { "X-Tenant": "team-a", Authorization: "ignored" },
  });
  assert.equal(headers.get("authorization"), "Bearer secret");
  assert.equal(headers.get("x-tenant"), "team-a");
});

test("health route works without credentials", async () => {
  const response = await route(new Request("https://starbox.example/api/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("single star writes GitHub then returns repository", async () => {
  const calls = [];
  const restore = mockFetch(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", headers: new Headers(init.headers) });
    if (calls.length === 1) return new Response(null, { status: 204 });
    return Response.json(repo);
  });
  try {
    const response = await route(request("/api/github/stars/facebook/react", { method: "PUT" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.repository.full_name, "facebook/react");
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].headers.get("authorization"), "Bearer token");
    assert.match(calls[1].url, /\/repos\/facebook\/react$/);
  } finally { restore(); }
});

test("single unstar sends DELETE", async () => {
  const restore = mockFetch(async (_url, init = {}) => {
    assert.equal(init.method, "DELETE");
    return new Response(null, { status: 204 });
  });
  try {
    const response = await route(request("/api/github/stars/facebook/react", { method: "DELETE" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally { restore(); }
});

test("batch unstar reports per-repository result", async () => {
  const restore = mockFetch(async () => new Response(null, { status: 204 }));
  try {
    const response = await route(request("/api/github/stars/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories: ["facebook/react", "vuejs/core"], action: "unstar" }),
    }));
    const body = await response.json();
    assert.equal(body.results.length, 2);
    assert.equal(body.results.every((item) => item.ok), true);
  } finally { restore(); }
});

test("release feed normalizes list items", async () => {
  const release = {
    id: 9,
    tag_name: "v1.0.0",
    name: "One",
    body: "notes",
    html_url: "https://github.com/facebook/react/releases/tag/v1.0.0",
    published_at: "2026-09-11T00:00:00Z",
    created_at: "2026-09-10T00:00:00Z",
    draft: false,
    prerelease: false,
    author: { login: "dev", avatar_url: "https://example.com/dev.png" },
    assets: [{ id: 1, name: "a.zip", size: 10, download_count: 2, browser_download_url: "https://example.com/a.zip" }],
  };
  const restore = mockFetch(async () => Response.json([release]));
  try {
    const response = await route(request("/api/releases/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories: ["facebook/react"] }),
    }));
    const body = await response.json();
    assert.equal(body.releases[0].repoFullName, "facebook/react");
    assert.equal(body.releases[0].tagName, "v1.0.0");
    assert.equal(body.releases[0].assets[0].downloadCount, 2);
  } finally { restore(); }
});

test("release detail uses requested release id", async () => {
  let requested = "";
  const restore = mockFetch(async (url) => {
    requested = String(url);
    return Response.json({
      id: 7, tag_name: "v7", name: "Seven", body: "detail", html_url: "https://example.com/r", published_at: null,
      created_at: "2026-09-11T00:00:00Z", draft: false, prerelease: false, author: null, assets: [],
    });
  });
  try {
    const response = await route(request("/api/releases/facebook/react/7"));
    assert.equal(response.status, 200);
    assert.match(requested, /\/releases\/7$/);
    assert.equal((await response.json()).release.name, "Seven");
  } finally { restore(); }
});

test("fork creation endpoint is disabled and does not call GitHub", async () => {
  let calls = 0;
  const restore = mockFetch(async () => { calls += 1; return Response.json({}); });
  try {
    const response = await route(request("/api/forks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceFullName: "facebook/react" }) }));
    assert.equal(response.status, 405);
    assert.match((await response.json()).error, /不提供 Fork 创建/);
    assert.equal(calls, 0);
  } finally { restore(); }
});

test("fork status maps 404 to pending and repository to ready", async () => {
  let call = 0;
  const restore = mockFetch(async () => {
    call += 1;
    if (call === 1) return Response.json({ message: "Not Found" }, { status: 404 });
    return Response.json({ ...repo, full_name: "me/react", html_url: "https://github.com/me/react" });
  });
  try {
    const pending = await route(request("/api/forks/status?full_name=me%2Freact"));
    assert.equal((await pending.json()).status, "pending");
    const ready = await route(request("/api/forks/status?full_name=me%2Freact"));
    const body = await ready.json();
    assert.equal(body.status, "ready");
    assert.equal(body.htmlUrl, "https://github.com/me/react");
  } finally { restore(); }
});

test("batch star is rejected before any GitHub mutation", async () => {
  const methods = [];
  const restore = mockFetch(async (_url, init = {}) => {
    methods.push(init.method || "GET");
    return new Response(null, { status: 204 });
  });
  try {
    const response = await route(request("/api/github/stars/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories: ["facebook/react", "cosscom/coss"], action: "star" }),
    }));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /批量 Star 不受支持/);
    assert.deepEqual(methods, []);
  } finally { restore(); }
});

test("release feed keeps successful items when another repository fails", async () => {
  const restore = mockFetch(async (url) => {
    if (String(url).includes("facebook/react")) {
      return Response.json([{
        id: 10, tag_name: "v10", name: "Ten", body: "notes", html_url: "https://example.com/r",
        published_at: "2026-09-11T00:00:00Z", created_at: "2026-09-10T00:00:00Z", draft: false, prerelease: false,
        author: null, assets: [],
      }]);
    }
    return Response.json({ message: "Not Found" }, { status: 404 });
  });
  try {
    const response = await route(request("/api/releases/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories: ["facebook/react", "missing/repo"] }),
    }));
    const body = await response.json();
    assert.equal(body.releases.length, 1);
    assert.equal(body.failures.length, 1);
    assert.equal(body.failures[0].fullName, "missing/repo");
  } finally { restore(); }
});

test("fork creation stays disabled regardless of requested target options", async () => {
  const response = await route(request("/api/forks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceFullName: "facebook/react", organization: "acme", name: "copy", defaultBranchOnly: true }) }));
  assert.equal(response.status, 405);
  assert.match((await response.json()).error, /GitHub 创建 Fork/);
});

test("GitHub exhausted rate limit maps 403 to 429 with diagnostics", async () => {
  const restore = mockFetch(async () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403, headers: { "content-type": "application/json", "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1893456000" } }));
  try {
    const response = await route(request("/api/github/starred"));
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.match(body.error, /速率/);
    assert.match(body.diagnostics, /0\/5000/);
  } finally { restore(); }
});

test("AI provider connection route uses custom HTTP adapter", async () => {
  const restore = mockFetch(async (url, init = {}) => {
    assert.equal(String(url), "https://api.example.com/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer secret");
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.model, "model-a");
    return Response.json({ choices: [{ message: { content: "STARBOX_OK" } }] });
  });
  try {
    const response = await route(new Request("https://starbox.example/api/ai/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerName: "Custom A", baseUrl: "https://api.example.com/v1", apiKey: "secret", model: "model-a", headers: { "X-Tenant": "a" } }),
    }));
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /Custom A 连接成功/);
  } finally { restore(); }
});

test("AI organize route parses provider JSON into repository metadata", async () => {
  const restore = mockFetch(async (_url, init = {}) => {
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.response_format.type, "json_object");
    return Response.json({ choices: [{ message: { content: '{"summary":"界面组件库","category":"前端","tags":["React","UI"]}' } }] });
  });
  try {
    const response = await route(new Request("https://starbox.example/api/ai/organize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ai: { providerName: "Custom", baseUrl: "https://api.example.com/v1", apiKey: "secret", model: "model-a", headers: {} },
        repository: { full_name: "facebook/react", description: "React", language: "JavaScript", topics: ["ui"], stargazers_count: 100 },
      }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.category, "前端");
    assert.deepEqual(body.tags, ["React", "UI"]);
  } finally { restore(); }
});


test("rate-limit diagnostics normalize resources and use current API version", async () => {
  let version = "";
  const restore = mockFetch(async (_url, init = {}) => {
    version = new Headers(init.headers).get("x-github-api-version") || "";
    return Response.json({ resources: { core: { limit: 5000, remaining: 4321, used: 679, reset: 1893456000 } } });
  });
  try {
    const response = await route(request("/api/github/rate-limit"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.resources[0].resource, "core");
    assert.equal(body.resources[0].remaining, 4321);
    assert.equal(version, "2026-03-10");
  } finally { restore(); }
});

test("rate exhausted 403 is surfaced as 429 with diagnostics", async () => {
  const restore = mockFetch(async () => Response.json({ message: "rate limit exceeded" }, {
    status: 403,
    headers: { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1893456000" },
  }));
  try {
    const response = await route(request("/api/github/rate-limit"));
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.match(body.error, /速率额度/);
    assert.match(body.diagnostics, /0\/5000/);
  } finally { restore(); }
});

test("watched repositories and README routes normalize browser data", async () => {
  let calls = 0;
  const restore = mockFetch(async (url, init = {}) => {
    calls += 1;
    if (String(url).includes("/user/subscriptions")) return Response.json([{ ...repo, id: 2, full_name: "cosscom/coss", name: "coss" }]);
    assert.equal(new Headers(init.headers).get("accept"), "application/vnd.github.raw+json");
    return new Response("# React\nUseful docs.");
  });
  try {
    const watched = await route(request("/api/github/watched"));
    assert.equal((await watched.json()).repositories[0].full_name, "cosscom/coss");
    const readme = await route(request("/api/github/repos/facebook/react/readme"));
    const body = await readme.json();
    assert.match(body.content, /# React/);
    assert.match(body.htmlUrl, /facebook\/react#readme/);
    assert.equal(calls, 2);
  } finally { restore(); }
});

test("release feed performs incremental filtering", async () => {
  const releases = [
    { id: 2, tag_name: "v2", name: "Two", body: "", html_url: "https://example.com/v2", published_at: "2026-09-11T10:00:00Z", created_at: "2026-09-11T10:00:00Z", draft: false, prerelease: false, author: null, assets: [] },
    { id: 1, tag_name: "v1", name: "One", body: "", html_url: "https://example.com/v1", published_at: "2026-09-10T10:00:00Z", created_at: "2026-09-10T10:00:00Z", draft: false, prerelease: false, author: null, assets: [] },
  ];
  const restore = mockFetch(async () => Response.json(releases));
  try {
    const response = await route(request("/api/releases/feed", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositories: ["facebook/react"], sinceByRepo: { "facebook/react": "2026-09-11T00:00:00Z" }, pages: 5 }),
    }));
    const body = await response.json();
    assert.deepEqual(body.releases.map((item) => item.tagName), ["v2"]);
  } finally { restore(); }
});

test("fork inventory enriches owned forks with parent metadata", async () => {
  let call = 0;
  const candidate = { ...repo, id: 22, full_name: "me/react", name: "react", fork: true, owner: { login: "me", avatar_url: "https://example.com/me.png" } };
  const full = { ...candidate, default_branch: "main", parent: { full_name: "facebook/react", html_url: "https://github.com/facebook/react", default_branch: "main" } };
  const restore = mockFetch(async (url) => {
    call += 1;
    if (String(url).includes("/user/repos")) return Response.json([candidate]);
    return Response.json(full);
  });
  try {
    const response = await route(request("/api/forks/list"));
    const body = await response.json();
    assert.equal(body.forks.length, 1);
    assert.equal(body.forks[0].fullName, "me/react");
    assert.equal(body.forks[0].parentFullName, "facebook/react");
    assert.equal(body.forks[0].owner.login, "me");
    assert.equal(call, 2);
  } finally { restore(); }
});

test("fork details include upstream divergence and latest Actions run", async () => {
  const full = { ...repo, id: 22, full_name: "me/react", name: "react", fork: true, default_branch: "main", owner: { login: "me", avatar_url: "https://example.com/me.png" }, parent: { full_name: "facebook/react", html_url: "https://github.com/facebook/react", default_branch: "main" } };
  const restore = mockFetch(async (url) => {
    const value = String(url);
    if (/\/repos\/me\/react$/.test(value)) return Response.json(full);
    if (value.includes("/compare/")) return Response.json({ ahead_by: 1, behind_by: 3, status: "diverged" });
    if (value.includes("/actions/runs")) return Response.json({ workflow_runs: [{ id: 99, name: "CI", status: "completed", conclusion: "success", html_url: "https://github.com/me/react/actions/runs/99", created_at: "2026-09-11T08:00:00Z" }] });
    throw new Error(`unexpected ${value}`);
  });
  try {
    const response = await route(request("/api/forks/details?full_name=me%2Freact"));
    const body = await response.json();
    assert.equal(body.behindBy, 3);
    assert.equal(body.aheadBy, 1);
    assert.equal(body.compareStatus, "diverged");
    assert.equal(body.latestWorkflow.name, "CI");
  } finally { restore(); }
});

test("fork upstream sync calls merge-upstream using fork default branch", async () => {
  const calls = [];
  const full = { ...repo, id: 22, full_name: "me/react", name: "react", fork: true, default_branch: "main", owner: { login: "me", avatar_url: "" }, parent: { full_name: "facebook/react", html_url: "https://github.com/facebook/react", default_branch: "main" } };
  const restore = mockFetch(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(String(init.body)) : null });
    if (calls.length === 1) return Response.json(full);
    return Response.json({ message: "Successfully synced", merge_type: "fast-forward" });
  });
  try {
    const response = await route(request("/api/forks/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: "me/react" }) }));
    const body = await response.json();
    assert.equal(body.mergeType, "fast-forward");
    assert.match(calls[1].url, /\/repos\/me\/react\/merge-upstream$/);
    assert.equal(calls[1].method, "POST");
    assert.equal(calls[1].body.branch, "main");
  } finally { restore(); }
});

test("GitHub Lists retrieval loads list metadata and repository items", async () => {
  const queries = [];
  const restore = mockFetch(async (_url, init = {}) => {
    const payload = JSON.parse(String(init.body));
    queries.push(payload.query);
    if (payload.query.includes("viewer { lists")) {
      return Response.json({ data: { viewer: { lists: { nodes: [{ id: "L1", name: "Core", description: "core repos", isPrivate: false }], pageInfo: { hasNextPage: false, endCursor: null } } } } });
    }
    return Response.json({ data: { node: { items: { nodes: [{ id: "R1", nameWithOwner: "facebook/react", url: "https://github.com/facebook/react" }], pageInfo: { hasNextPage: false, endCursor: null } } } } });
  });
  try {
    const response = await route(request("/api/github/lists"));
    const body = await response.json();
    assert.equal(body.lists[0].name, "Core");
    assert.equal(body.lists[0].items[0].fullName, "facebook/react");
    assert.equal(queries.length, 2);
  } finally { restore(); }
});

test("GitHub Lists membership resolves repository node id then replaces memberships", async () => {
  const payloads = [];
  const restore = mockFetch(async (_url, init = {}) => {
    const payload = JSON.parse(String(init.body)); payloads.push(payload);
    if (payload.query.includes("repository")) return Response.json({ data: { repository: { id: "R1" } } });
    if (payload.query.includes("updateUserListsForItem")) return Response.json({ data: { updateUserListsForItem: { lists: [{ id: "L1" }, { id: "L2" }] } } });
    return Response.json({ data: { updateUserListsForItem: { lists: [{ id: "L1" }, { id: "L2" }] } } });
  });
  try {
    const response = await route(request("/api/github/lists/membership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoFullName: "facebook/react", listIds: ["L1", "L2"] }) }));
    assert.deepEqual((await response.json()).listIds, ["L1", "L2"]);
    assert.deepEqual(payloads[1].variables.listIds, ["L1", "L2"]);
  } finally { restore(); }
});

test("Discover builds ordinary GitHub Search query and normalizes repositories", async () => {
  let requested = "";
  const restore = mockFetch(async (url) => { requested = String(url); return Response.json({ items: [repo] }); });
  try {
    const response = await route(request("/api/discover?channel=active&language=TypeScript&topic=react&days=14"));
    const body = await response.json();
    assert.equal(body.repositories[0].full_name, "facebook/react");
    assert.match(body.query, /pushed:>=/);
    assert.match(body.query, /language:TypeScript/);
    assert.match(body.query, /topic:react/);
    assert.match(requested, /\/search\/repositories\?/);
  } finally { restore(); }
});

test("default login exposes a critical fallback-credentials warning and secure opaque cookie", async () => {
  const env = d1Env();
  const { response, cookie } = await login(env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.defaultCredentialsActive, true);
  assert.equal(body.warningLevel, "critical");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.ok(cookie);
  assert.equal(env.DB.tables.app_sessions[0].token_hash.length, 64);
  assert.equal(env.DB.tables.app_sessions[0].token_hash.includes(cookie.split("=")[1]), false);
});

test("invalid login is rejected and login rate limit returns 429", async () => {
  const env = d1Env();
  for (let index = 0; index < 5; index += 1) {
    const result = await login(env, "brute-force", "bad");
    assert.equal(result.response.status, 401);
  }
  const limited = await login(env, "brute-force", "bad");
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
});

test("session endpoint expires and logout revokes the D1 session", async () => {
  const env = d1Env(); const first = await login(env); assert.equal(first.response.status, 200);
  const active = await route(appRequest("/api/auth/session", {}, first.cookie), env); assert.equal((await active.json()).authenticated, true);
  const row = env.DB.tables.app_sessions[0]; row.expires_at = "2000-01-01T00:00:00.000Z";
  const expired = await route(appRequest("/api/auth/session", {}, first.cookie), env); assert.equal((await expired.json()).authenticated, false);
  const second = await login(env); const logout = await route(appRequest("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, second.cookie), env);
  assert.equal(logout.status, 200); assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.ok(env.DB.tables.app_sessions.some((item) => item.revoked_at));
});

test("cookie-auth mutations enforce same-origin Origin and application/json", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const missingOrigin = await route(new Request("https://starbox.example/api/activity", { method: "POST", headers: { "content-type": "application/json", cookie }, body: "{}" }), env);
  assert.equal(missingOrigin.status, 403);
  const missingJson = await route(new Request("https://starbox.example/api/activity", { method: "POST", headers: { origin: "https://starbox.example", cookie }, body: "{}" }), env);
  assert.equal(missingJson.status, 415);
});

test("GitHub credential is validated, encrypted at rest, replaceable and deletable", async () => {
  const env = d1Env({ GITHUB_TOKEN_ENCRYPTION_KEY_VERSION: "v2" }); const { cookie } = await login(env); let calls = 0;
  const restore = mockFetch(async (url, init = {}) => { calls += 1; assert.equal(String(url), "https://api.github.com/user"); assert.match(new Headers(init.headers).get("authorization"), /Bearer token/); return Response.json({ id: 42, login: "octocat" }); });
  try {
    const put = await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token" }) }, cookie), env);
    const body = await put.json(); assert.equal(put.status, 200); assert.equal(body.login, "octocat"); assert.equal(body.keyVersion, "v2"); assert.equal(body.token, undefined);
    const stored = env.DB.tables.github_credentials[0]; assert.equal(stored.github_user_id, "42"); assert.equal(stored.key_version, "v2"); assert.equal(stored.ciphertext.includes("token"), false); assert.equal(stored.iv.length > 0, true);
    const secondDevice = await login(env); const metadata = await route(appRequest("/api/github/credential", {}, secondDevice.cookie), env); assert.equal((await metadata.json()).connected, true);
    const replace = await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token-two" }) }, secondDevice.cookie), env); assert.equal(replace.status, 200); assert.notEqual((await replace.json()).fingerprint, body.fingerprint);
    const remove = await route(appRequest("/api/github/credential", { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}" }, secondDevice.cookie), env); assert.equal(remove.status, 200); assert.equal((await remove.json()).connected, false); assert.equal(env.DB.tables.github_credentials.length, 0); assert.equal(env.DB.tables.app_account[0].github_user_id, "42"); assert.equal(env.DB.tables.app_account[0].github_login, "octocat"); assert.equal(calls, 2);
  } finally { restore(); }
});



test("GitHub identity binding rejects another account before and after credential removal", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const restore = mockFetch(async (_url, init = {}) => {
    const authorization = new Headers(init.headers).get("authorization") || "";
    return authorization.includes("token-a") ? Response.json({ id: 42, login: "octocat" }) : Response.json({ id: 99, login: "other-user" });
  });
  try {
    const first = await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token-a" }) }, cookie), env);
    assert.equal(first.status, 200);

    const replacement = await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token-b" }) }, cookie), env);
    assert.equal(replacement.status, 409);
    assert.match((await replacement.json()).error, /绑定其他 GitHub 账号/);
    assert.equal(env.DB.tables.github_credentials[0].github_numeric_id, "42");

    const remove = await route(appRequest("/api/github/credential", { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}" }, cookie), env);
    assert.equal(remove.status, 200);
    assert.equal(env.DB.tables.github_credentials.length, 0);
    assert.equal(env.DB.tables.app_account[0].github_user_id, "42");

    const reconnectOther = await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token-b" }) }, cookie), env);
    assert.equal(reconnectOther.status, 409);
    assert.equal(env.DB.tables.github_credentials.length, 0);
    assert.equal(env.DB.tables.app_account[0].github_user_id, "42");
  } finally { restore(); }
});

test("second device reuses encrypted credential without browser token", async () => {
  const env = d1Env(); const first = await login(env); let userCalls = 0; let rateLimitAuth = "";
  const restore = mockFetch(async (url, init = {}) => { if (String(url).endsWith("/user")) { userCalls += 1; return Response.json({ id: 7, login: "multi-device" }); } rateLimitAuth = new Headers(init.headers).get("authorization") || ""; return Response.json({ resources: {} }); });
  try {
    await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "persisted-token" }) }, first.cookie), env);
    const second = await login(env); const response = await route(appRequest("/api/github/rate-limit", {}, second.cookie), env);
    assert.equal(response.status, 200); assert.equal(rateLimitAuth, "Bearer persisted-token"); assert.equal(userCalls, 1);
  } finally { restore(); }
});

test("legacy migration runtime is removed from the final v5 Worker", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const response = await route(appRequest("/api/migration/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, cookie), env);
  assert.equal(response.status, 404);
  assert.equal(env.DB.tables.migration_runs.length, 0);
});

test("primary account bootstrap and changes are independent from Activity", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const activity = await route(appRequest("/api/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "starred", payload: { fullName: "tenant/repo" } }) }, cookie), env); assert.equal(activity.status, 200);
  const mutation = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "category-update-primary", operation: "category.update", payload: { entityType: "category", entityKey: "frontend" } }) }, cookie), env); assert.equal(mutation.status, 200); assert.equal(env.DB.tables.sync_changes.length, 1);
  const changes = await route(appRequest("/api/data/changes?after=0&limit=10", {}, cookie), env); const changeBody = await changes.json(); assert.equal(changeBody.changes.length, 1); assert.equal(changeBody.changes[0].account_id, "primary");
  const bootstrap = await route(appRequest("/api/bootstrap", {}, cookie), env); const bootstrapBody = await bootstrap.json(); assert.equal(bootstrapBody.account.account_id, "primary"); assert.ok(Array.isArray(bootstrapBody.repositories)); assert.equal(bootstrapBody.lastSeq, 1);
});

test("session TTL defaults to seven days and login limiter binding is preferred", async () => {
  let limiterCalls = 0;
  const env = d1Env({ LOGIN_RATE_LIMITER: { limit: async () => { limiterCalls += 1; return { success: true }; } } });
  const result = await login(env);
  assert.equal(result.response.status, 200);
  assert.equal(limiterCalls, 1);
  const session = env.DB.tables.app_sessions[0];
  assert.equal(Date.parse(session.expires_at) - Date.parse(session.created_at), 7 * 24 * 60 * 60 * 1000);
  assert.match(result.response.headers.get("set-cookie"), /Max-Age=604800/);
});

test("AES-GCM binds account, GitHub identity and key version as AAD", async () => {
  const secret = "12345678901234567890123456789012";
  const encrypted = await encryptGithubToken("aad-token", secret, "primary", "42", "v1");
  const record = { account_id: "primary", github_numeric_id: "42", github_login: "octocat", ...encrypted, key_version: encrypted.keyVersion, validated_at: "", created_at: "", updated_at: "", status: "active" };
  assert.equal(await decryptGithubToken(record, secret), "aad-token");
  await assert.rejects(() => decryptGithubToken({ ...record, account_id: "attacker" }, secret));
  await assert.rejects(() => decryptGithubToken({ ...record, key_version: "v2" }, secret));
  assert.match(new TextDecoder().decode(credentialAad("primary", "42", "v1")), /account_id=primary/);
});

test("previous encryption key is lazily rotated on first authenticated request", async () => {
  const oldKey = "12345678901234567890123456789012";
  const currentKey = "abcdefghijklmnopqrstuvwxyz123456";
  const env = d1Env({ GITHUB_TOKEN_ENCRYPTION_KEY: oldKey, GITHUB_TOKEN_ENCRYPTION_KEY_VERSION: "v1" });
  const first = await login(env);
  const restore = mockFetch(async (url) => String(url).endsWith("/user") ? Response.json({ id: 42, login: "octocat" }) : Response.json({ resources: {} }));
  try {
    await route(appRequest("/api/github/credential", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "rotate-me" }) }, first.cookie), env);
    env.GITHUB_TOKEN_ENCRYPTION_KEY = currentKey;
    env.GITHUB_TOKEN_ENCRYPTION_KEY_VERSION = "v2";
    env.GITHUB_TOKEN_ENCRYPTION_KEY_PREVIOUS = oldKey;
    const second = await login(env);
    const response = await route(appRequest("/api/github/rate-limit", {}, second.cookie), env);
    assert.equal(response.status, 200);
    assert.equal(env.DB.tables.github_credentials[0].key_version, "v2");
  } finally { restore(); }
});

test("final v5 schema uses primary account keys and has independent sync changes without migration_runs", () => {
  const schema = readFileSync("migrations/0001_v5_schema.sql", "utf8");
  const indexes = readFileSync("migrations/0002_v5_indexes.sql", "utf8");
  const mutations = readFileSync("migrations/0004_processed_mutations.sql", "utf8");
  assert.match(schema, /account_id TEXT PRIMARY KEY CHECK \(account_id = 'primary'\)/);
  assert.match(schema, /CREATE TABLE sync_changes/);
  assert.doesNotMatch(schema, /CREATE TABLE migration_runs/);
  assert.doesNotMatch(schema, /github_user_id TEXT NOT NULL/);
  assert.match(indexes, /idx_sync_changes_account_seq/);
  assert.match(mutations, /CREATE TABLE processed_mutations/);
  assert.match(mutations, /mutation_id TEXT PRIMARY KEY/);
  assert.match(mutations, /revision INTEGER/);
});

test("GET starred syncs canonical repositories into D1 with activity and changes", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const restore = mockFetch(async () => Response.json([{ starred_at: "2026-09-11T10:00:00Z", repo }]));
  try {
    const response = await route(appRequest("/api/github/starred", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    assert.equal(response.status, 200);
    assert.equal(env.DB.tables.repositories.length, 1);
    assert.equal(env.DB.tables.repositories[0].account_id, "primary");
    assert.equal(env.DB.tables.repositories[0].is_starred, 1);
    assert.equal(env.DB.tables.sync_changes.some((item) => item.entity_type === "repository"), true);
    assert.equal(env.DB.tables.activity_log.some((item) => item.type === "stars_synced"), true);
  } finally { restore(); }
});

test("release feed persists releases and emits new_release notification", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const release = { id: 101, tag_name: "v1", name: "One", body: "notes", html_url: "https://example.com/r", published_at: "2026-09-11T00:00:00Z", created_at: "2026-09-10T00:00:00Z", draft: false, prerelease: false, author: null, assets: [] };
  const restore = mockFetch(async () => Response.json([release]));
  try {
    const response = await route(appRequest("/api/releases/feed", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repositories: ["facebook/react"] }) }, cookie), env);
    assert.equal(response.status, 200);
    assert.equal(env.DB.tables.releases[0].account_id, "primary");
    assert.equal(env.DB.tables.notifications.some((item) => item.kind === "new_release"), true);
    assert.equal(env.DB.tables.activity_log.some((item) => item.type === "release_synced"), true);
    assert.equal(env.DB.tables.sync_changes.some((item) => item.entity_type === "release"), true);
  } finally { restore(); }
});

test("release subscribe and read mutations persist through sync/mutate", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const subscribe = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "release-subscribe-primary", operation: "release.subscribe", payload: { repoFullName: "facebook/react", entityKey: "facebook/react" } }) }, cookie), env);
  const read = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "release-read-primary", operation: "release.read", payload: { entityKey: "101", readAt: "2026-09-11T11:00:00Z" } }) }, cookie), env);
  assert.equal(subscribe.status, 200); assert.equal(read.status, 200);
  assert.equal(env.DB.tables.release_subscriptions[0].account_id, "primary");
  assert.equal(env.DB.tables.release_states.length, 1);
  assert.equal(env.DB.tables.activity_log.some((item) => item.type === "release_subscribed"), true);
  assert.equal(env.DB.tables.sync_changes.filter((item) => item.entity_type.startsWith("release")).length, 2);
});

test("existing fork status and upstream sync persist state and fork notifications", async () => {
  const env = d1Env(); const { cookie } = await login(env); let call = 0;
  const restore = mockFetch(async (url) => {
    call += 1; const value = String(url);
    if (value.endsWith("/repos/me/react-copy")) return Response.json({ ...repo, id: 202, full_name: "me/react-copy", name: "react-copy", html_url: "https://github.com/me/react-copy", owner: { login: "me", avatar_url: "" }, parent: { full_name: "facebook/react", html_url: "https://github.com/facebook/react" } });
    if (value.includes("/merge-upstream")) return Response.json({ message: "ok", merge_type: "fast-forward" });
    throw new Error(`unexpected response ${value}`);
  });
  try {
    const create = await route(appRequest("/api/forks", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ sourceFullName: "facebook/react" }) }, cookie), env);
    const status = await route(appRequest("/api/forks/status?full_name=me%2Freact-copy", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    const sync = await route(appRequest("/api/forks/sync", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ fullName: "me/react-copy" }) }, cookie), env);
    assert.equal(create.status, 405); assert.equal(status.status, 200); assert.equal(sync.status, 200);
    assert.equal(env.DB.tables.forks[0].status, "ready");
    assert.equal(env.DB.tables.notifications.some((item) => item.kind === "fork_ready"), true);
    assert.equal(env.DB.tables.activity_log.some((item) => item.type === "fork_ready"), true);
    assert.equal(env.DB.tables.sync_changes.some((item) => item.entity_type === "fork"), true);
    assert.equal(call, 3);
  } finally { restore(); }
});

test("Lists CRUD and membership persist primary rows and delete tombstones", async () => {
  const env = d1Env(); const { cookie } = await login(env); const payloads = [];
  const restore = mockFetch(async (_url, init = {}) => {
    const payload = JSON.parse(String(init.body)); payloads.push(payload);
    if (payload.query.includes("createUserList")) return Response.json({ data: { createUserList: { list: { id: "L1", name: "Core", description: "core", isPrivate: false } } } });
    if (payload.query.includes("updateUserListsForItem")) return Response.json({ data: { updateUserListsForItem: { lists: [{ id: "L1" }] } } });
    if (payload.query.includes("updateUserList")) return Response.json({ data: { updateUserList: { list: { id: "L1", name: "Core 2", description: "updated", isPrivate: true } } } });
    if (payload.query.includes("deleteUserList")) return Response.json({ data: { deleteUserList: { clientMutationId: null } } });
    if (payload.query.includes("repository(owner:")) return Response.json({ data: { repository: { id: "R1" } } });
    return Response.json({ data: { updateUserListsForItem: { lists: [{ id: "L1" }] } } });
  });
  try {
    const create = await route(appRequest("/api/github/lists", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ name: "Core" }) }, cookie), env);
    const update = await route(appRequest("/api/github/lists/L1", { method: "PUT", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ name: "Core 2", description: "updated", isPrivate: true }) }, cookie), env);
    const membership = await route(appRequest("/api/github/lists/membership", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repoFullName: "facebook/react", listIds: ["L1"] }) }, cookie), env);
    assert.equal(membership.status, 200);
    assert.equal(env.DB.tables.github_list_memberships[0].account_id, "primary");
    assert.equal(env.DB.tables.github_list_memberships[0].repo_full_name, "facebook/react");
    const remove = await route(appRequest("/api/github/lists/L1", { method: "DELETE", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: "{}" }, cookie), env);
    assert.equal(create.status, 200); assert.equal(update.status, 200); assert.equal(remove.status, 200);
    assert.equal(env.DB.tables.activity_log.some((item) => item.type === "list_deleted"), true);
    assert.equal(env.DB.tables.sync_changes.some((item) => item.entity_type === "list" && item.operation === "tombstone"), true);
    assert.equal(env.DB.tables.github_list_memberships.length, 0);
    assert.equal(payloads.length, 5);
  } finally { restore(); }
});

test("full Stars sync reconciles repositories removed on GitHub and bootstrap hides tombstones", async () => {
  const env = d1Env(); const { cookie } = await login(env); let call = 0;
  const restore = mockFetch(async () => { call += 1; return Response.json(call === 1 ? [{ starred_at: "2026-09-11T10:00:00Z", repo }] : []); });
  try {
    const first = await route(appRequest("/api/github/starred", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    const second = await route(appRequest("/api/github/starred", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.equal(env.DB.tables.repositories[0].is_starred, 0);
    assert.equal(env.DB.tables.sync_changes.some((item) => item.entity_type === "repository" && item.operation === "tombstone"), true);
    const bootstrap = await route(appRequest("/api/bootstrap", {}, cookie), env);
    assert.deepEqual((await bootstrap.json()).repositories, []);
  } finally { restore(); }
});

test("release unread and batch subscriptions use explicit D1 mutation semantics", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const batch = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "release-subscribe-batch", operation: "release.subscribe.batch", payload: { repoFullNames: ["facebook/react", "vercel/next.js"] } }) }, cookie), env);
  const read = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "release-read-101", operation: "release.read", payload: { releaseId: 101 } }) }, cookie), env);
  const unread = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "release-unread-101", operation: "release.unread", payload: { releaseId: 101 } }) }, cookie), env);
  assert.equal(batch.status, 200); assert.equal(read.status, 200); assert.equal(unread.status, 200);
  assert.deepEqual(env.DB.tables.release_subscriptions.map((item) => item.repo_full_name).sort(), ["facebook/react", "vercel/next.js"]);
  assert.equal(env.DB.tables.release_states.find((item) => String(item.release_id) === "101")?.read_at, null);
  assert.equal(env.DB.tables.activity_log.filter((item) => item.type === "release_subscribed_batch").length, 1);
  assert.equal(env.DB.tables.activity_log.filter((item) => item.type === "release_unread").length, 1);
});

test("category delete reorder and batch assignment persist without overwriting unrelated metadata", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  for (const body of [
    { id: "category-create-frontend", operation: "category.create", payload: { id: "frontend", name: "前端", color: "blue", sortOrder: 0 } },
    { id: "category-create-tools", operation: "category.create", payload: { id: "tools", name: "工具", color: "neutral", sortOrder: 1 } },
    { id: "repository-meta-update-react", operation: "repository_meta.update", payload: { fullName: "facebook/react", categoryId: "tools", note: "keep", pinned: true, aiSummary: "summary", aiTags: ["ui"] } },
    { id: "category-reorder", operation: "category.reorder", payload: { categories: [{ id: "tools", name: "工具", color: "neutral", sortOrder: 0 }, { id: "frontend", name: "前端", color: "blue", sortOrder: 1 }] } },
    { id: "repository-meta-batch-category", operation: "repository_meta.batch_category", payload: { repoFullNames: ["facebook/react", "vercel/next.js"], categoryId: "frontend" } },
  ]) {
    const response = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, cookie), env); assert.equal(response.status, 200);
  }
  const reactMeta = env.DB.tables.repository_meta.find((item) => item.github_repo_id === "facebook/react");
  assert.equal(reactMeta.category_id, "frontend"); assert.equal(reactMeta.note, "keep"); assert.equal(reactMeta.pinned, 1); assert.equal(reactMeta.ai_summary, "summary");
  const remove = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "category-delete-frontend", operation: "category.delete", payload: { id: "frontend" } }) }, cookie), env);
  assert.equal(remove.status, 200);
  assert.equal(env.DB.tables.categories.some((item) => item.category_id === "frontend"), false);
  assert.equal(env.DB.tables.repository_meta.every((item) => item.category_id !== "frontend"), true);
});

test("AI organize metadata and generated category are authoritative in D1", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const response = await route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "repository-meta-ai-react", operation: "repository_meta.ai", payload: { fullName: "facebook/react", categoryId: "frontend", category: { id: "frontend", name: "前端", color: "violet", sortOrder: 0, locked: false }, note: "note", pinned: true, aiSummary: "React UI library", aiTags: ["react", "ui"] } }) }, cookie), env);
  assert.equal(response.status, 200);
  const meta = env.DB.tables.repository_meta.find((item) => item.github_repo_id === "facebook/react");
  assert.equal(meta.ai_summary, "React UI library");
  assert.deepEqual(JSON.parse(meta.ai_tags_json), ["react", "ui"]);
  assert.equal(env.DB.tables.categories.some((item) => item.category_id === "frontend"), true);
  assert.equal(env.DB.tables.activity_log.filter((item) => item.type === "repository_ai_organized").length, 1);
});

test("authenticated session last_seen writes are throttled", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  env.DB.tables.app_sessions[0].last_seen_at = fiveMinutesAgo;
  const response = await route(appRequest("/api/auth/session", {}, cookie), env);
  assert.equal(response.status, 200);
  assert.equal(env.DB.tables.app_sessions[0].last_seen_at, fiveMinutesAgo);
});

test("changes pagination advances only through the last returned sequence", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  env.DB.tables.sync_changes = Array.from({ length: 101 }, (_, index) => ({ seq: index + 1, account_id: "primary", entity_type: "category", entity_key: `category-${index + 1}`, operation: "update", revision: index + 1, created_at: "2026-09-12T00:00:00.000Z" }));
  const first = await route(appRequest("/api/data/changes?after=0&limit=100", {}, cookie), env);
  const pageOne = await first.json();
  assert.equal(pageOne.changes.length, 100);
  assert.equal(pageOne.lastSeq, 100);
  assert.equal(pageOne.hasMore, true);
  const second = await route(appRequest("/api/data/changes?after=100&limit=100", {}, cookie), env);
  const pageTwo = await second.json();
  assert.deepEqual(pageTwo.changes.map((item) => item.seq), [101]);
  assert.equal(pageTwo.lastSeq, 101);
  assert.equal(pageTwo.hasMore, false);
});

test("concurrent mutations receive distinct atomic revisions and change sequences", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const send = (id, categoryId) => route(appRequest("/api/sync/mutate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, operation: "category.create", payload: { id: categoryId, name: categoryId } }),
  }, cookie), env);
  const responses = await Promise.all([send("concurrent-a", "a"), send("concurrent-b", "b")]);
  const results = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(results.map((item) => item.revision).sort(), [1, 2]);
  assert.deepEqual(results.map((item) => item.seq).sort(), [1, 2]);
  assert.equal(env.DB.tables.app_account[0].revision, 2);
  assert.deepEqual(env.DB.tables.sync_changes.map((item) => item.revision).sort(), [1, 2]);
});

test("mutation replay is idempotent and unknown operation is rejected", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const send = (body) => route(appRequest("/api/sync/mutate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, cookie), env);
  const mutation = { id: "retry-category-create", operation: "category.create", payload: { id: "frontend", name: "前端" } };
  const first = await send(mutation); const firstBody = await first.json();
  const replay = await send(mutation); const replayBody = await replay.json();
  assert.equal(first.status, 200); assert.equal(replay.status, 200);
  assert.deepEqual({ seq: replayBody.seq, revision: replayBody.revision }, { seq: firstBody.seq, revision: firstBody.revision });
  assert.equal(env.DB.tables.categories.length, 1);
  assert.equal(env.DB.tables.sync_changes.length, 1);
  assert.equal(env.DB.tables.activity_log.filter((item) => item.type === "category_updated").length, 1);
  assert.equal(env.DB.tables.processed_mutations.length, 1);

  const unknown = await send({ id: "unknown-operation", operation: "repository.do_magic", payload: { fullName: "facebook/react" } });
  assert.equal(unknown.status, 400);
  assert.equal(env.DB.tables.sync_changes.length, 1);
  assert.equal(env.DB.tables.processed_mutations.length, 1);
  const missingId = await send({ operation: "category.create", payload: { id: "tools", name: "工具" } });
  assert.equal(missingId.status, 400);
});

test("sync mutation reports D1 failures without leaving a success record", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  env.DB.failNextBatch = true;
  const response = await route(appRequest("/api/sync/mutate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "failed-category-create", operation: "category.create", payload: { id: "frontend", name: "前端" } }),
  }, cookie), env);
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /D1 batch failure/);
  assert.equal(env.DB.tables.categories.length, 0);
  assert.equal(env.DB.tables.app_account[0].revision, 0);
  assert.equal(env.DB.tables.sync_changes.length, 0);
  assert.equal(env.DB.tables.activity_log.length, 0);
  assert.equal(env.DB.tables.processed_mutations.length, 0);
});

test("fork.read is an idempotent local-only operation and leaves lifecycle status unchanged", async () => {
  const env = d1Env(); const { cookie } = await login(env); const repository = new DataRepository(env.DB);
  await repository.saveFork("me/react-copy", "facebook/react", "ready", { ready: true });
  const revision = env.DB.tables.app_account[0].revision;
  const changes = env.DB.tables.sync_changes.length;
  const response = await route(appRequest("/api/sync/mutate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "fork-read-local", operation: "fork.read", payload: { fullName: "me/react-copy", status: "read" } }),
  }, cookie), env);
  assert.equal(response.status, 200);
  assert.equal(env.DB.tables.forks[0].status, "ready");
  assert.equal(env.DB.tables.app_account[0].revision, revision);
  assert.equal(env.DB.tables.sync_changes.length, changes);
});

test("Lists snapshot replacement rolls back deletes and earlier inserts on a later failure", async () => {
  const env = d1Env(); const repository = new DataRepository(env.DB);
  await repository.ensureAccount();
  await repository.replaceListsSnapshot([{ id: "old", name: "Old", items: [{ id: "old-repo", fullName: "owner/old" }] }]);
  env.DB.failBatchAtIndex = 4;
  await assert.rejects(() => repository.replaceListsSnapshot([{ id: "new", name: "New", items: [
    { id: "new-one", fullName: "owner/one" }, { id: "new-two", fullName: "owner/two" },
  ] }]), /mid-batch/);
  assert.deepEqual(env.DB.tables.github_lists.map((item) => item.list_id), ["old"]);
  assert.deepEqual(env.DB.tables.github_list_memberships.map((item) => item.repo_full_name), ["owner/old"]);
  assert.equal(env.DB.tables.app_account[0].revision, 1);
  assert.equal(env.DB.tables.sync_changes.length, 1);
});

test("single and batch unstar update numeric-ID repository rows before bootstrap", async () => {
  const env = d1Env(); const { cookie } = await login(env); const repository = new DataRepository(env.DB);
  await repository.upsertRepository({ ...repo, id: 10270250, full_name: "facebook/react", name: "react" }, true);
  let restore = mockFetch(async (_url, init = {}) => { assert.equal(init.method, "DELETE"); return new Response(null, { status: 204 }); });
  try {
    const single = await route(appRequest("/api/github/stars/facebook/react", { method: "DELETE", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: "{}" }, cookie), env);
    assert.equal(single.status, 200);
    assert.equal(env.DB.tables.repositories[0].github_repo_id, "10270250");
    assert.equal(env.DB.tables.repositories[0].is_starred, 0);
    const bootstrap = await route(appRequest("/api/bootstrap", {}, cookie), env);
    assert.deepEqual((await bootstrap.json()).repositories, []);
  } finally { restore(); }

  await repository.upsertRepository({ ...repo, id: 202, full_name: "vuejs/core", name: "core" }, true);
  await repository.upsertRepository({ ...repo, id: 303, full_name: "vitejs/vite", name: "vite" }, true);
  restore = mockFetch(async (_url, init = {}) => { assert.equal(init.method, "DELETE"); return new Response(null, { status: 204 }); });
  try {
    const batch = await route(appRequest("/api/github/stars/batch", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repositories: ["vuejs/core", "vitejs/vite"], action: "unstar" }) }, cookie), env);
    assert.equal(batch.status, 200);
    assert.equal((await batch.json()).results.every((item) => item.ok), true);
    const bootstrap = await route(appRequest("/api/bootstrap", {}, cookie), env);
    assert.deepEqual((await bootstrap.json()).repositories, []);
    assert.deepEqual(env.DB.tables.repositories.filter((item) => item.is_starred === 1), []);
  } finally { restore(); }
});

test("single and batch unstar surface D1 persistence failures", async () => {
  const env = d1Env(); const { cookie } = await login(env); const repository = new DataRepository(env.DB);
  await repository.upsertRepository({ ...repo, id: 10270250, full_name: "facebook/react", name: "react" }, true);
  const restore = mockFetch(async () => new Response(null, { status: 204 }));
  try {
    env.DB.failNextBatch = true;
    const single = await route(appRequest("/api/github/stars/facebook/react", { method: "DELETE", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: "{}" }, cookie), env);
    assert.equal(single.status, 500);
    assert.equal(env.DB.tables.repositories[0].is_starred, 1);

    env.DB.failNextBatch = true;
    const batch = await route(appRequest("/api/github/stars/batch", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repositories: ["facebook/react"], action: "unstar" }) }, cookie), env);
    const result = (await batch.json()).results[0];
    assert.equal(batch.status, 200);
    assert.equal(result.ok, false);
    assert.match(result.error, /D1 batch failure/);
    assert.equal(env.DB.tables.repositories[0].is_starred, 1);
  } finally { restore(); }
});

test("a full 30-page Stars response with a next link does not reconcile older rows", async () => {
  const env = d1Env(); const { cookie } = await login(env); const repository = new DataRepository(env.DB);
  await repository.upsertRepository({ ...repo, id: 777, full_name: "owner/previous", name: "previous" }, true);
  let calls = 0;
  const restore = mockFetch(async (url) => {
    calls += 1;
    const page = Number(new URL(String(url)).searchParams.get("page"));
    const items = Array.from({ length: 100 }, () => ({ starred_at: "2026-09-12T00:00:00.000Z", repo }));
    return new Response(JSON.stringify(items), { headers: { link: `<https://api.github.com/user/starred?per_page=100&page=${page + 1}>; rel="next"` } });
  });
  try {
    const response = await route(appRequest("/api/github/starred", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.partial, true);
    assert.equal(calls, 30);
    assert.equal(env.DB.tables.repositories.find((item) => item.full_name === "owner/previous").is_starred, 1);
  } finally { restore(); }
});



test("an exact 30-page Stars result without a next link on the last page is complete", async () => {
  const env = d1Env(); const { cookie } = await login(env); let calls = 0;
  const restore = mockFetch(async (url) => {
    calls += 1;
    const page = Number(new URL(String(url)).searchParams.get("page"));
    const items = Array.from({ length: 100 }, (_, index) => ({ starred_at: "2026-09-12T00:00:00.000Z", repo: { ...repo, id: page * 1000 + index, full_name: `owner${page}/repo${index}`, name: `repo${index}` } }));
    const headers = page < 30 ? { link: `<https://api.github.com/user/starred?per_page=100&page=${page + 1}>; rel="next"` } : {};
    return new Response(JSON.stringify(items), { headers });
  });
  try {
    const response = await route(appRequest("/api/github/starred", { headers: { "x-starbox-github-token": "token" } }, cookie), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.partial, false);
    assert.equal(body.repositories.length, 3000);
    assert.equal(calls, 30);
  } finally { restore(); }
});

test("Release page failure discards that repository's staged items and preserves its cursor", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  env.DB.tables.release_sync_state.push({ account_id: "primary", repo_full_name: "facebook/react", cursor: "2026-09-10T00:00:00.000Z", revision: 2, last_synced_at: "2026-09-10T00:00:00.000Z", updated_at: "2026-09-10T00:00:00.000Z" });
  const pageOne = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, tag_name: `v${index + 1}`, name: `Release ${index + 1}`, body: "", html_url: "https://example.com/r", published_at: "2026-09-11T00:00:00.000Z", created_at: "2026-09-11T00:00:00.000Z", draft: false, prerelease: false, author: null, assets: [] }));
  const restore = mockFetch(async (url) => String(url).includes("page=1") ? Response.json(pageOne) : Response.json({ message: "GitHub unavailable" }, { status: 500 }));
  try {
    const response = await route(appRequest("/api/releases/feed", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repositories: ["facebook/react"], sinceByRepo: { "facebook/react": "2026-09-10T00:00:00.000Z" }, pages: 2 }) }, cookie), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.releases.length, 0);
    assert.equal(body.failures.length, 1);
    assert.equal(env.DB.tables.releases.length, 0);
    assert.equal(env.DB.tables.release_sync_state[0].cursor, "2026-09-10T00:00:00.000Z");
  } finally { restore(); }
});

test("Release page-limit truncation is reported without returning or persisting partial data", async () => {
  const env = d1Env(); const { cookie } = await login(env);
  const page = (start) => Array.from({ length: 50 }, (_, index) => ({ id: start + index, tag_name: `v${start + index}`, name: `Release ${start + index}`, body: "", html_url: "https://example.com/r", published_at: "2026-09-11T00:00:00.000Z", created_at: "2026-09-11T00:00:00.000Z", draft: false, prerelease: false, author: null, assets: [] }));
  const restore = mockFetch(async (url) => Response.json(String(url).includes("page=1") ? page(1) : page(51)));
  try {
    const response = await route(appRequest("/api/releases/feed", { method: "POST", headers: { "content-type": "application/json", "x-starbox-github-token": "token" }, body: JSON.stringify({ repositories: ["facebook/react"], pages: 2 }) }, cookie), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.releases.length, 0);
    assert.match(body.failures[0].error, /分页上限/);
    assert.equal(env.DB.tables.releases.length, 0);
    assert.equal(env.DB.tables.release_sync_state.length, 0);
  } finally { restore(); }
});
