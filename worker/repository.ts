import type { AccountRecord, AiCredentialRecord, AiModelRecord, AiServiceCredentialRecord, AiServiceRecord, AiTaskBindingRecord, AppPreferencesRecord, D1Database, D1PreparedStatement, GithubCredentialRecord, SessionRecord } from "./types.js";

const nowIso = () => new Date().toISOString();
const encoded = (value: unknown) => JSON.stringify(value ?? {});
const decoded = (value: unknown) => { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; } };
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export type MutationOperation =
  | "category.create" | "category.update" | "category.rename" | "category.delete" | "category.reorder"
  | "repository_meta.update" | "repository_meta.ai" | "repository_meta.ai_batch" | "repository_meta.batch_category"
  | "release.subscribe" | "release.unsubscribe" | "release.subscribe.batch"
  | "fork.save" | "fork.update"
  | "unstar" | "star.unstar" | "star.unstarBatch";

type ChangeInput = { entityType: string; entityKey: string; operation: string };
type ActivityInput = { type: string; payload: unknown };
type ChangeResult = { seq: number; revision: number };

const mutationOperations = new Set<MutationOperation>([
  "category.create", "category.update", "category.rename", "category.delete", "category.reorder",
  "repository_meta.update", "repository_meta.ai", "repository_meta.ai_batch", "repository_meta.batch_category",
  "release.subscribe", "release.unsubscribe", "release.subscribe.batch",
  "fork.save", "fork.update",
  "unstar", "star.unstar", "star.unstarBatch",
]);

export class MutationRequestError extends Error {
  readonly status = 400;
}

export class DataRepository {
  constructor(private readonly db: D1Database, private readonly clock: () => string = nowIso) {}
  private stmt(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values); }
  async batch(statements: D1PreparedStatement[]) {
    if (statements.length > 50) throw new MutationRequestError("单次原子 D1 写入最多 50 条语句");
    return statements.length ? this.db.batch(statements) : [];
  }

  async ensureAccount() { const now = this.clock(); await this.stmt("INSERT INTO app_account (account_id, created_at, updated_at) VALUES ('primary', ?1, ?1) ON CONFLICT(account_id) DO UPDATE SET updated_at = excluded.updated_at", now).run(); return (await this.account())!; }
  async account() { return this.stmt("SELECT account_id, github_user_id, github_login, revision, created_at, updated_at FROM app_account WHERE account_id = 'primary' LIMIT 1").first<AccountRecord>(); }
  async createSession(session: SessionRecord) { await this.stmt("INSERT INTO app_sessions (token_hash, account_id, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent) VALUES (?1, 'primary', ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)", session.token_hash, session.created_at, session.expires_at, session.last_seen_at, session.device_id, session.device_name, session.device_type, session.os, session.browser, session.ip_address, session.country_code, session.region, session.city, session.user_agent).run(); }
  async sessionByHash(hash: string) { return this.stmt("SELECT token_hash, account_id, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent FROM app_sessions WHERE token_hash = ?1 AND account_id = 'primary' LIMIT 1", hash).first<SessionRecord>(); }
  async touchSession(hash: string) { await this.stmt("UPDATE app_sessions SET last_seen_at = ?1 WHERE token_hash = ?2 AND account_id = 'primary' AND revoked_at IS NULL", this.clock(), hash).run(); }
  async updateSessionDevice(hash: string, input: Pick<SessionRecord, "device_id" | "device_name" | "device_type" | "os" | "browser" | "ip_address" | "country_code" | "region" | "city" | "user_agent">) { await this.stmt("UPDATE app_sessions SET device_id = ?1, device_name = ?2, device_type = ?3, os = ?4, browser = ?5, ip_address = ?6, country_code = ?7, region = ?8, city = ?9, user_agent = ?10 WHERE token_hash = ?11 AND account_id = 'primary'", input.device_id, input.device_name, input.device_type, input.os, input.browser, input.ip_address, input.country_code, input.region, input.city, input.user_agent, hash).run(); }
  async listSessions() { const rows = await this.stmt("SELECT token_hash, account_id, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent FROM app_sessions WHERE account_id = 'primary' AND revoked_at IS NULL AND expires_at > ?1 ORDER BY last_seen_at DESC", this.clock()).all<SessionRecord>(); return rows.results ?? []; }
  async renameSession(deviceId: string, name: string) { await this.stmt("UPDATE app_sessions SET device_name = ?1 WHERE device_id = ?2 AND account_id = 'primary' AND revoked_at IS NULL", name, deviceId).run(); }
  async revokeSession(hash: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE token_hash = ?2 AND account_id = 'primary'", this.clock(), hash).run(); }
  async revokeSessionByDeviceId(deviceId: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE device_id = ?2 AND account_id = 'primary' AND revoked_at IS NULL", this.clock(), deviceId).run(); }
  async revokeOtherSessions(hash: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE account_id = 'primary' AND token_hash <> ?2 AND revoked_at IS NULL", this.clock(), hash).run(); }

  async credential() { return this.stmt("SELECT account_id, github_numeric_id, github_login, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status FROM github_credentials WHERE account_id = 'primary' LIMIT 1").first<GithubCredentialRecord>(); }
  async saveCredential(input: GithubCredentialRecord) { const now = this.clock(); await this.batch([this.stmt("INSERT INTO github_credentials (account_id, github_numeric_id, github_login, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9) ON CONFLICT(account_id) DO UPDATE SET github_numeric_id = excluded.github_numeric_id, github_login = excluded.github_login, ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, validated_at = excluded.validated_at, updated_at = excluded.updated_at, status = excluded.status", input.github_numeric_id, input.github_login, input.ciphertext, input.iv, input.key_version, input.fingerprint, input.validated_at, now, input.status), this.stmt("UPDATE app_account SET github_user_id = ?1, github_login = ?2, updated_at = ?3 WHERE account_id = 'primary'", input.github_numeric_id, input.github_login, now)]); }
  async rotateCredential(input: Pick<GithubCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint">) { await this.stmt("UPDATE github_credentials SET ciphertext = ?1, iv = ?2, key_version = ?3, fingerprint = ?4, updated_at = ?5 WHERE account_id = 'primary'", input.ciphertext, input.iv, input.key_version, input.fingerprint, this.clock()).run(); }
  async deleteCredential() { await this.stmt("DELETE FROM github_credentials WHERE account_id = 'primary'").run(); }

  async aiCredential() { return this.stmt("SELECT account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status FROM ai_credentials WHERE account_id = 'primary' LIMIT 1").first<AiCredentialRecord>(); }
  async saveAiCredential(input: Pick<AiCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">) { const now = this.clock(); await this.stmt("INSERT INTO ai_credentials (account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?5, ?6) ON CONFLICT(account_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status", input.ciphertext, input.iv, input.key_version, input.fingerprint, now, input.status).run(); }
  async deleteAiCredential() { await this.stmt("DELETE FROM ai_credentials WHERE account_id = 'primary'").run(); }
  async aiServices() { const rows = await this.stmt("SELECT service_id, account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at FROM ai_services WHERE account_id = 'primary' ORDER BY created_at, name").all<AiServiceRecord>(); return rows.results ?? []; }
  async aiService(serviceId: string) { return this.stmt("SELECT service_id, account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at FROM ai_services WHERE account_id = 'primary' AND service_id = ?1 LIMIT 1", serviceId).first<AiServiceRecord>(); }
  async saveAiService(input: Pick<AiServiceRecord, "service_id" | "name" | "protocol" | "base_url" | "enabled" | "config_json">) { const now = this.clock(); await this.stmt("INSERT INTO ai_services (service_id, account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(service_id) DO UPDATE SET name = excluded.name, protocol = excluded.protocol, base_url = excluded.base_url, enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at", input.service_id, input.name, input.protocol, input.base_url, input.enabled, input.config_json, now).run(); return (await this.aiService(input.service_id))!; }
  async deleteAiService(serviceId: string) { await this.stmt("DELETE FROM ai_services WHERE account_id = 'primary' AND service_id = ?1", serviceId).run(); }
  async aiServiceCredential(serviceId: string) { return this.stmt("SELECT service_id, account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status FROM ai_service_credentials WHERE account_id = 'primary' AND service_id = ?1 LIMIT 1", serviceId).first<AiServiceCredentialRecord>(); }
  async saveAiServiceCredential(input: Pick<AiServiceCredentialRecord, "service_id" | "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">) { const now = this.clock(); await this.stmt("INSERT INTO ai_service_credentials (service_id, account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?6, ?7) ON CONFLICT(service_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status", input.service_id, input.ciphertext, input.iv, input.key_version, input.fingerprint, now, input.status).run(); }
  async saveAiServiceAtomic(
    service: Pick<AiServiceRecord, "service_id" | "name" | "protocol" | "base_url" | "enabled" | "config_json">,
    credential?: Pick<AiServiceCredentialRecord, "service_id" | "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">,
    model?: Pick<AiModelRecord, "model_id" | "service_id" | "remote_model_id" | "display_name" | "enabled" | "sort_order">,
    setDefault = false,
  ) {
    const now = this.clock();
    const statements: D1PreparedStatement[] = [this.stmt("INSERT INTO ai_services (service_id, account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(service_id) DO UPDATE SET name = excluded.name, protocol = excluded.protocol, base_url = excluded.base_url, enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at", service.service_id, service.name, service.protocol, service.base_url, service.enabled, service.config_json, now)];
    if (credential) statements.push(this.stmt("INSERT INTO ai_service_credentials (service_id, account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?6, ?7) ON CONFLICT(service_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status", credential.service_id, credential.ciphertext, credential.iv, credential.key_version, credential.fingerprint, now, credential.status));
    if (model) {
      statements.push(this.stmt("INSERT INTO ai_models (model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(model_id) DO UPDATE SET remote_model_id = excluded.remote_model_id, display_name = excluded.display_name, enabled = excluded.enabled, sort_order = excluded.sort_order, updated_at = excluded.updated_at", model.model_id, model.service_id, model.remote_model_id, model.display_name, model.enabled, model.sort_order, now));
      if (setDefault) statements.push(this.stmt("INSERT INTO ai_task_bindings (account_id, task, model_id, updated_at) VALUES ('primary', 'default', ?1, ?2) ON CONFLICT(account_id, task) DO UPDATE SET model_id = excluded.model_id, updated_at = excluded.updated_at", model.model_id, now));
    }
    await this.batch(statements);
    return (await this.aiService(service.service_id))!;
  }

  async deleteAiServiceCredential(serviceId: string) { await this.stmt("DELETE FROM ai_service_credentials WHERE account_id = 'primary' AND service_id = ?1", serviceId).run(); }
  async aiModels(serviceId?: string) { const rows = serviceId ? await this.stmt("SELECT model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models WHERE account_id = 'primary' AND service_id = ?1 ORDER BY sort_order, created_at", serviceId).all<AiModelRecord>() : await this.stmt("SELECT model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models WHERE account_id = 'primary' ORDER BY service_id, sort_order, created_at").all<AiModelRecord>(); return rows.results ?? []; }
  async aiModel(modelId: string) { return this.stmt("SELECT model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models WHERE account_id = 'primary' AND model_id = ?1 LIMIT 1", modelId).first<AiModelRecord>(); }
  async saveAiModel(input: Pick<AiModelRecord, "model_id" | "service_id" | "remote_model_id" | "display_name" | "enabled" | "sort_order">) { const now = this.clock(); await this.stmt("INSERT INTO ai_models (model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(model_id) DO UPDATE SET remote_model_id = excluded.remote_model_id, display_name = excluded.display_name, enabled = excluded.enabled, sort_order = excluded.sort_order, updated_at = excluded.updated_at", input.model_id, input.service_id, input.remote_model_id, input.display_name, input.enabled, input.sort_order, now).run(); return (await this.aiModel(input.model_id))!; }
  async deleteAiModel(modelId: string) { await this.stmt("DELETE FROM ai_models WHERE account_id = 'primary' AND model_id = ?1", modelId).run(); }
  async aiTaskBinding(task = "default") { return this.stmt("SELECT account_id, task, model_id, updated_at FROM ai_task_bindings WHERE account_id = 'primary' AND task = ?1 LIMIT 1", task).first<AiTaskBindingRecord>(); }
  async saveAiTaskBinding(task: string, modelId: string) { const now = this.clock(); await this.stmt("INSERT INTO ai_task_bindings (account_id, task, model_id, updated_at) VALUES ('primary', ?1, ?2, ?3) ON CONFLICT(account_id, task) DO UPDATE SET model_id = excluded.model_id, updated_at = excluded.updated_at", task, modelId, now).run(); return { account_id: 'primary', task, model_id: modelId, updated_at: now } satisfies AiTaskBindingRecord; }
  async appPreferences() { return this.stmt("SELECT account_id, ai_provider_name, ai_base_url, ai_model, release_sync_pages, release_asset_include_pattern, release_asset_exclude_pattern, updated_at FROM app_preferences WHERE account_id = 'primary' LIMIT 1").first<AppPreferencesRecord>(); }
  async saveAppPreferences(input: Partial<Pick<AppPreferencesRecord, "ai_provider_name" | "ai_base_url" | "ai_model" | "release_sync_pages" | "release_asset_include_pattern" | "release_asset_exclude_pattern">>) {
    const current = await this.appPreferences(); const now = this.clock();
    const next = { ai_provider_name: input.ai_provider_name ?? current?.ai_provider_name ?? "Custom HTTP", ai_base_url: input.ai_base_url ?? current?.ai_base_url ?? "", ai_model: input.ai_model ?? current?.ai_model ?? "", release_sync_pages: Math.max(1, Number(input.release_sync_pages ?? current?.release_sync_pages ?? 3)), release_asset_include_pattern: input.release_asset_include_pattern ?? current?.release_asset_include_pattern ?? "", release_asset_exclude_pattern: input.release_asset_exclude_pattern ?? current?.release_asset_exclude_pattern ?? "" };
    if (current && current.ai_provider_name === next.ai_provider_name && current.ai_base_url === next.ai_base_url && current.ai_model === next.ai_model && current.release_sync_pages === next.release_sync_pages && current.release_asset_include_pattern === next.release_asset_include_pattern && current.release_asset_exclude_pattern === next.release_asset_exclude_pattern) return current;
    await this.stmt("INSERT INTO app_preferences (account_id, ai_provider_name, ai_base_url, ai_model, release_sync_pages, release_asset_include_pattern, release_asset_exclude_pattern, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(account_id) DO UPDATE SET ai_provider_name = excluded.ai_provider_name, ai_base_url = excluded.ai_base_url, ai_model = excluded.ai_model, release_sync_pages = excluded.release_sync_pages, release_asset_include_pattern = excluded.release_asset_include_pattern, release_asset_exclude_pattern = excluded.release_asset_exclude_pattern, updated_at = excluded.updated_at", next.ai_provider_name, next.ai_base_url, next.ai_model, next.release_sync_pages, next.release_asset_include_pattern, next.release_asset_exclude_pattern, now).run();
    return { account_id: "primary", ...next, updated_at: now } satisfies AppPreferencesRecord;
  }

  async saveAiConfigAtomic(
    input: Pick<AppPreferencesRecord, "ai_provider_name" | "ai_base_url" | "ai_model">,
    credential?: Pick<AiCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">,
  ) {
    const current = await this.appPreferences(); const now = this.clock();
    const next = {
      ai_provider_name: input.ai_provider_name, ai_base_url: input.ai_base_url, ai_model: input.ai_model,
      release_sync_pages: current?.release_sync_pages ?? 3,
      release_asset_include_pattern: current?.release_asset_include_pattern ?? "",
      release_asset_exclude_pattern: current?.release_asset_exclude_pattern ?? "",
    };
    const statements: D1PreparedStatement[] = [];
    const preferencesChanged = !current || current.ai_provider_name !== next.ai_provider_name || current.ai_base_url !== next.ai_base_url || current.ai_model !== next.ai_model;
    if (preferencesChanged) statements.push(this.stmt("INSERT INTO app_preferences (account_id, ai_provider_name, ai_base_url, ai_model, release_sync_pages, release_asset_include_pattern, release_asset_exclude_pattern, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(account_id) DO UPDATE SET ai_provider_name = excluded.ai_provider_name, ai_base_url = excluded.ai_base_url, ai_model = excluded.ai_model, release_sync_pages = excluded.release_sync_pages, release_asset_include_pattern = excluded.release_asset_include_pattern, release_asset_exclude_pattern = excluded.release_asset_exclude_pattern, updated_at = excluded.updated_at", next.ai_provider_name, next.ai_base_url, next.ai_model, next.release_sync_pages, next.release_asset_include_pattern, next.release_asset_exclude_pattern, now));
    if (credential) statements.push(this.stmt("INSERT INTO ai_credentials (account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?5, ?6) ON CONFLICT(account_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status", credential.ciphertext, credential.iv, credential.key_version, credential.fingerprint, now, credential.status));
    await this.batch(statements);
    return { account_id: "primary", ...next, updated_at: preferencesChanged ? now : current?.updated_at ?? now } satisfies AppPreferencesRecord;
  }

  async recordActivity(type: string, payload: unknown) { const id = crypto.randomUUID(); await this.stmt("INSERT INTO activity_log (id, account_id, type, payload_json, created_at) VALUES (?1, 'primary', ?2, ?3, ?4)", id, type, encoded(payload), this.clock()).run(); return id; }
  async listNotifications(limit: number) { const rows = await this.stmt("SELECT id, kind, title, body, read_at, created_at FROM notifications WHERE account_id = 'primary' ORDER BY created_at DESC LIMIT ?1", limit).all(); return rows.results ?? []; }
  async markNotificationRead(id: string) { await this.stmt("UPDATE notifications SET read_at = ?1 WHERE id = ?2 AND account_id = 'primary'", this.clock(), id).run(); }
  async addNotification(kind: string, title: string, body: string) { await this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) VALUES (?1, 'primary', ?2, ?3, ?4, NULL, ?5)", crypto.randomUUID(), kind, title, body, this.clock()).run(); }

  async revision() { return (await this.stmt("SELECT revision FROM app_account WHERE account_id = 'primary' LIMIT 1").first<{ revision: number }>())?.revision ?? 0; }
  private async processedMutation(mutationId: string): Promise<ChangeResult | null> {
    const row = await this.stmt("SELECT seq, revision FROM processed_mutations WHERE mutation_id = ?1 LIMIT 1", mutationId).first<{ seq: number | null; revision: number | null }>();
    return row ? { seq: Number(row.seq ?? 0), revision: Number(row.revision ?? 0) } : null;
  }

  private activityStatement(activity: ActivityInput) {
    return this.stmt("INSERT INTO activity_log (id, account_id, type, payload_json, created_at) VALUES (?1, 'primary', ?2, ?3, ?4)", crypto.randomUUID(), activity.type, encoded(activity.payload), this.clock());
  }

  private async commitWrites(
    businessStatements: D1PreparedStatement[],
    changes: ChangeInput[],
    activity?: ActivityInput,
    mutationId?: string,
  ): Promise<ChangeResult> {
    const validMutationId = mutationId?.trim() || "";
    if (validMutationId) {
      const existing = await this.processedMutation(validMutationId);
      if (existing) return existing;
    }

    const statements: D1PreparedStatement[] = [];
    const estimatedStatements = businessStatements.length + changes.length * 2 + (activity ? 1 : 0) + (validMutationId ? 2 : 0);
    if (estimatedStatements > 45) throw new MutationRequestError("单次原子 D1 mutation 过大，请减少批量项目后重试");
    if (validMutationId) statements.push(this.stmt(
      "INSERT INTO processed_mutations (mutation_id, processed_at, seq, revision) VALUES (?1, ?2, NULL, NULL)",
      validMutationId, this.clock(),
    ));
    statements.push(...businessStatements);

    const changeResultIndexes: number[] = [];
    for (const change of changes) {
      statements.push(this.stmt("UPDATE app_account SET revision = revision + 1, updated_at = ?1 WHERE account_id = 'primary' RETURNING revision", this.clock()));
      changeResultIndexes.push(statements.length);
      statements.push(this.stmt(
        "INSERT INTO sync_changes (account_id, entity_type, entity_key, operation, revision, created_at) SELECT 'primary', ?1, ?2, ?3, revision, ?4 FROM app_account WHERE account_id = 'primary' RETURNING seq, revision",
        change.entityType, change.entityKey, change.operation, this.clock(),
      ));
    }
    if (activity) statements.push(this.activityStatement(activity));
    if (validMutationId) statements.push(this.stmt(
      "UPDATE processed_mutations SET seq = COALESCE((SELECT MAX(seq) FROM sync_changes WHERE account_id = 'primary'), 0), revision = (SELECT revision FROM app_account WHERE account_id = 'primary') WHERE mutation_id = ?1",
      validMutationId,
    ));

    let results: Awaited<ReturnType<D1Database["batch"]>>;
    try {
      results = statements.length ? await this.db.batch(statements) : [];
      if (results.some((result) => result.success === false)) throw new Error("D1 batch statement failed");
    } catch (reason) {
      if (validMutationId) {
        const existing = await this.processedMutation(validMutationId);
        if (existing) return existing;
      }
      throw reason;
    }

    if (validMutationId) return (await this.processedMutation(validMutationId)) ?? { seq: 0, revision: await this.revision() };
    const lastResultIndex = changeResultIndexes.at(-1);
    const row = lastResultIndex === undefined ? null : results[lastResultIndex]?.results?.[0] as { seq?: number; revision?: number } | undefined;
    return row ? { seq: Number(row.seq ?? 0), revision: Number(row.revision ?? 0) } : { seq: 0, revision: await this.revision() };
  }

  async change(entityType: string, entityKey: string, operation: string) {
    return this.commitWrites([], [{ entityType, entityKey, operation }]);
  }

  async changes(after: number, limit: number) {
    const rows = await this.stmt("SELECT seq, account_id, entity_type, entity_key, operation, revision, created_at FROM sync_changes WHERE account_id = 'primary' AND seq > ?1 ORDER BY seq ASC LIMIT ?2", after, limit + 1).all();
    const fetched = rows.results ?? [];
    const changes = fetched.slice(0, limit);
    const lastSeq = changes.length ? Number(changes.at(-1)?.seq ?? after) : after;
    return { changes, lastSeq, hasMore: fetched.length > limit };
  }

  async bootstrap() {
    const account = await this.account();
    const queries = [
      ["repositories", "SELECT * FROM repositories WHERE account_id = 'primary' AND is_starred = 1 ORDER BY updated_at DESC"],
      ["repositoryMeta", "SELECT * FROM repository_meta WHERE account_id = 'primary' ORDER BY updated_at DESC"],
      ["categories", "SELECT * FROM categories WHERE account_id = 'primary' ORDER BY sort_order, created_at"],
      ["releaseSubscriptions", "SELECT * FROM release_subscriptions WHERE account_id = 'primary'"],
      ["releases", "SELECT * FROM releases WHERE account_id = 'primary' ORDER BY COALESCE(published_at, created_at) DESC"],
      ["forks", "SELECT * FROM forks WHERE account_id = 'primary' ORDER BY updated_at DESC"],
    ] as const;
    const entries = Object.fromEntries(await Promise.all(queries.map(async ([key, sql]) => [key, (await this.db.prepare(sql).all()).results ?? []] as const)));
    const credential = await this.credential();
    const aiCredential = await this.aiCredential();
    const preferences = await this.appPreferences();
    const syncRows = await this.stmt("SELECT scope, updated_at FROM sync_state WHERE account_id = 'primary'").all<{ scope: string; updated_at: string }>();
    const releaseSync = await this.stmt("SELECT MAX(last_synced_at) AS updated_at FROM release_sync_state WHERE account_id = 'primary'").first<{ updated_at: string | null }>();
    const syncMap = Object.fromEntries((syncRows.results ?? []).map((row) => [row.scope, row.updated_at]));
    const lastSeq = await this.stmt("SELECT MAX(seq) AS seq FROM sync_changes WHERE account_id = 'primary'").first<{ seq: number }>();
    return { account, githubCredential: credential ? { connected: true, login: credential.github_login, githubUserId: credential.github_numeric_id, fingerprint: credential.fingerprint, keyVersion: credential.key_version } : { connected: false }, aiCredential: aiCredential ? { configured: aiCredential.status === "active", keyVersion: aiCredential.key_version, fingerprint: aiCredential.fingerprint, updatedAt: aiCredential.updated_at } : { configured: false }, appPreferences: preferences, syncSummary: { stars: syncMap.stars ?? null, releases: releaseSync?.updated_at ?? null }, ...entries, revision: account?.revision ?? 0, lastSeq: Number(lastSeq?.seq ?? 0) };
  }

  async upsertRepository(repository: Record<string, unknown>, starred: boolean) {
    const now = this.clock();
    const fullName = String(repository.full_name ?? "");
    const repoId = String(repository.id ?? fullName);
    const statement = this.stmt("INSERT INTO repositories (account_id, github_repo_id, full_name, name, html_url, description, language, default_branch, is_starred, starred_at, updated_at, raw_json) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(account_id, github_repo_id) DO UPDATE SET full_name = excluded.full_name, name = excluded.name, html_url = excluded.html_url, description = excluded.description, language = excluded.language, default_branch = excluded.default_branch, is_starred = excluded.is_starred, starred_at = excluded.starred_at, updated_at = excluded.updated_at, raw_json = excluded.raw_json", repoId, fullName, String(repository.name ?? fullName.split("/").pop() ?? ""), String(repository.html_url ?? ""), typeof repository.description === "string" ? repository.description : null, typeof repository.language === "string" ? repository.language : null, String(repository.default_branch ?? "main"), starred ? 1 : 0, starred ? String(repository.starred_at ?? now) : null, now, encoded(repository));
    return this.commitWrites([statement], [{ entityType: "repository", entityKey: fullName, operation: starred ? "upsert" : "tombstone" }]);
  }
  async listStarredFullNames() { const rows = await this.stmt("SELECT full_name FROM repositories WHERE account_id = 'primary' AND is_starred = 1").all<{ full_name: string }>(); return (rows.results ?? []).map((row) => row.full_name); }
  async markRepositoryUnstarred(fullName: string, recordActivity = false) {
    const now = this.clock();
    const statement = this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE account_id = 'primary' AND full_name = ?2 AND is_starred = 1", now, fullName);
    const activity = recordActivity ? { type: "unstarred", payload: { fullName } } : undefined;
    return this.commitWrites([statement], [{ entityType: "repository", entityKey: fullName, operation: "tombstone" }], activity);
  }

  async upsertRelease(release: Record<string, unknown>) {
    const repoFullName = String(release.repoFullName ?? "");
    const releaseId = String(release.id ?? "");
    const existing = await this.stmt("SELECT release_id FROM releases WHERE account_id = 'primary' AND release_id = ?1 LIMIT 1", releaseId).first<{ release_id: string }>();
    const now = this.clock();
    const statements: D1PreparedStatement[] = [];
    if (!existing) statements.push(this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) SELECT ?1, 'primary', 'new_release', '发现新 Release', ?2, NULL, ?3 WHERE NOT EXISTS (SELECT 1 FROM releases WHERE account_id = 'primary' AND release_id = ?4)", crypto.randomUUID(), `${repoFullName} ${String(release.tagName ?? "")}`, now, releaseId));
    statements.push(this.stmt("INSERT INTO releases (account_id, release_id, repo_full_name, tag_name, payload_json, published_at, created_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(account_id, release_id) DO UPDATE SET repo_full_name = excluded.repo_full_name, tag_name = excluded.tag_name, payload_json = excluded.payload_json, published_at = excluded.published_at", releaseId, repoFullName, String(release.tagName ?? ""), encoded(release), typeof release.publishedAt === "string" ? release.publishedAt : null, typeof release.createdAt === "string" ? release.createdAt : now));
    return this.commitWrites(statements, [{ entityType: "release", entityKey: releaseId, operation: existing ? "update" : "upsert" }], { type: "release_synced", payload: { releaseId, repoFullName, newRelease: !existing } });
  }
  async saveReleaseSyncState(repoFullName: string, cursor: string | null) { const revision = await this.revision(); const now = this.clock(); await this.stmt("INSERT INTO release_sync_state (account_id, repo_full_name, cursor, revision, last_synced_at, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?4) ON CONFLICT(account_id, repo_full_name) DO UPDATE SET cursor = excluded.cursor, revision = excluded.revision, last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at", repoFullName, cursor, revision, now).run(); }
  async subscribeRelease(repoFullName: string, subscribed: boolean) {
    const statement = subscribed
      ? this.stmt("INSERT INTO release_subscriptions (account_id, repo_full_name, created_at) VALUES ('primary', ?1, ?2) ON CONFLICT(account_id, repo_full_name) DO NOTHING", repoFullName, this.clock())
      : this.stmt("DELETE FROM release_subscriptions WHERE account_id = 'primary' AND repo_full_name = ?1", repoFullName);
    return this.commitWrites([statement], [{ entityType: "releaseSubscription", entityKey: repoFullName, operation: subscribed ? "upsert" : "tombstone" }], { type: subscribed ? "release_subscribed" : "release_unsubscribed", payload: { repoFullName } });
  }
  async subscribeReleaseBatch(repoFullNames: string[]) {
    const unique = Array.from(new Set(repoFullNames.filter(Boolean)));
    const statements = unique.map((repoFullName) => this.stmt("INSERT INTO release_subscriptions (account_id, repo_full_name, created_at) VALUES ('primary', ?1, ?2) ON CONFLICT(account_id, repo_full_name) DO NOTHING", repoFullName, this.clock()));
    return this.commitWrites(statements, [{ entityType: "releaseSubscription", entityKey: `batch:${crypto.randomUUID()}`, operation: "batch_upsert" }], { type: "release_subscribed_batch", payload: { count: unique.length, repoFullNames: unique } });
  }

  async saveFork(fullName: string, parentFullName: string | null, status: string, payload: unknown) {
    const now = this.clock();
    const serialized = encoded(payload);
    const statements = [
      this.stmt("INSERT INTO forks (account_id, full_name, parent_full_name, status, updated_at, payload_json) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, full_name) DO UPDATE SET parent_full_name = excluded.parent_full_name, status = excluded.status, updated_at = excluded.updated_at, payload_json = excluded.payload_json", fullName, parentFullName, status, now, serialized),
      this.stmt("INSERT INTO fork_snapshots (account_id, repo_full_name, cursor, revision, status, created_at) VALUES ('primary', ?1, ?2, (SELECT revision + 1 FROM app_account WHERE account_id = 'primary'), ?3, ?4)", fullName, null, status, now),
      this.stmt("INSERT INTO fork_events (id, account_id, repo_full_name, event_type, payload_json, created_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5)", crypto.randomUUID(), fullName, status.toUpperCase(), serialized, now),
    ];
    if (status === "ready") statements.push(this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) VALUES (?1, 'primary', 'fork_ready', 'Fork 已就绪', ?2, NULL, ?3)", crypto.randomUUID(), fullName, now));
    if (status === "failed") statements.push(this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) VALUES (?1, 'primary', 'fork_sync_failed', 'Fork 操作失败', ?2, NULL, ?3)", crypto.randomUUID(), fullName, now));
    return this.commitWrites(statements, [{ entityType: "fork", entityKey: fullName, operation: status === "deleted" ? "tombstone" : "upsert" }], { type: `fork_${status}`, payload: { fullName, parentFullName } });
  }

  private upsertCategoryStatement(category: Record<string, unknown>) {
    const now = this.clock();
    const id = String(category.id ?? category.categoryId ?? category.entityKey ?? "");
    if (!id) throw new MutationRequestError("Category ID 不能为空");
    return { id, statement: this.stmt("INSERT INTO categories (account_id, category_id, name, color, sort_order, locked, created_at, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(account_id, category_id) DO UPDATE SET name = excluded.name, color = excluded.color, sort_order = excluded.sort_order, locked = excluded.locked, updated_at = excluded.updated_at", id, String(category.name ?? "未分类"), typeof category.color === "string" ? category.color : null, Number(category.sortOrder ?? category.order ?? 0), category.locked ? 1 : 0, now) };
  }
  private upsertRepositoryMetaStatement(fullName: string, payload: Record<string, unknown>) {
    const now = this.clock();
    return this.stmt("INSERT INTO repository_meta (account_id, github_repo_id, category_id, note, ai_summary, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, github_repo_id) DO UPDATE SET category_id = excluded.category_id, note = excluded.note, ai_summary = excluded.ai_summary, updated_at = excluded.updated_at", fullName, typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null, typeof payload.note === "string" ? payload.note : null, typeof payload.aiSummary === "string" ? payload.aiSummary : null, now);
  }

  async mutate(operation: string, payload: Record<string, unknown>, mutationId?: string) {
    if (!mutationOperations.has(operation as MutationOperation)) throw new MutationRequestError(`未知 mutation operation: ${operation}`);

    const typedOperation = operation as MutationOperation;
    const entityKey = typeof payload.entityKey === "string" ? payload.entityKey : typeof payload.fullName === "string" ? payload.fullName : typeof payload.id === "string" ? payload.id : crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    const changes: ChangeInput[] = [];
    let activity: ActivityInput | undefined;

    switch (typedOperation) {
      case "release.subscribe":
      case "release.unsubscribe": {
        const repoFullName = String(payload.repoFullName ?? entityKey);
        const subscribed = typedOperation === "release.subscribe";
        statements.push(subscribed
          ? this.stmt("INSERT INTO release_subscriptions (account_id, repo_full_name, created_at) VALUES ('primary', ?1, ?2) ON CONFLICT(account_id, repo_full_name) DO NOTHING", repoFullName, this.clock())
          : this.stmt("DELETE FROM release_subscriptions WHERE account_id = 'primary' AND repo_full_name = ?1", repoFullName));
        changes.push({ entityType: "releaseSubscription", entityKey: repoFullName, operation: subscribed ? "upsert" : "tombstone" });
        activity = { type: subscribed ? "release_subscribed" : "release_unsubscribed", payload: { repoFullName } };
        break;
      }
      case "release.subscribe.batch": {
        const repoFullNames = Array.from(new Set(strings(payload.repoFullNames)));
        for (const repoFullName of repoFullNames) statements.push(this.stmt("INSERT INTO release_subscriptions (account_id, repo_full_name, created_at) VALUES ('primary', ?1, ?2) ON CONFLICT(account_id, repo_full_name) DO NOTHING", repoFullName, this.clock()));
        changes.push({ entityType: "releaseSubscription", entityKey: `batch:${crypto.randomUUID()}`, operation: "batch_upsert" });
        activity = { type: "release_subscribed_batch", payload: { count: repoFullNames.length, repoFullNames } };
        break;
      }
      case "fork.save":
      case "fork.update": {
        const fullName = String(payload.fullName ?? entityKey);
        const parentFullName = typeof payload.parentFullName === "string" ? payload.parentFullName : null;
        const status = typeof payload.status === "string" ? payload.status : "unknown";
        const now = this.clock();
        const serialized = encoded(payload);
        statements.push(this.stmt("INSERT INTO forks (account_id, full_name, parent_full_name, status, updated_at, payload_json) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, full_name) DO UPDATE SET parent_full_name = excluded.parent_full_name, status = excluded.status, updated_at = excluded.updated_at, payload_json = excluded.payload_json", fullName, parentFullName, status, now, serialized));
        statements.push(this.stmt("INSERT INTO fork_snapshots (account_id, repo_full_name, cursor, revision, status, created_at) VALUES ('primary', ?1, ?2, (SELECT revision + 1 FROM app_account WHERE account_id = 'primary'), ?3, ?4)", fullName, null, status, now));
        statements.push(this.stmt("INSERT INTO fork_events (id, account_id, repo_full_name, event_type, payload_json, created_at) VALUES (?1, 'primary', ?2, ?3, ?4, ?5)", crypto.randomUUID(), fullName, status.toUpperCase(), serialized, now));
        changes.push({ entityType: "fork", entityKey: fullName, operation: status === "deleted" ? "tombstone" : "upsert" });
        activity = { type: `fork_${status}`, payload: { fullName, parentFullName } };
        if (status === "ready") statements.push(this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) VALUES (?1, 'primary', 'fork_ready', 'Fork 已就绪', ?2, NULL, ?3)", crypto.randomUUID(), fullName, now));
        if (status === "failed") statements.push(this.stmt("INSERT INTO notifications (id, account_id, kind, title, body, read_at, created_at) VALUES (?1, 'primary', 'fork_sync_failed', 'Fork 操作失败', ?2, NULL, ?3)", crypto.randomUUID(), fullName, now));
        break;
      }
      case "category.delete": {
        const id = String(payload.id ?? entityKey);
        statements.push(this.stmt("UPDATE repository_meta SET category_id = NULL, updated_at = ?1 WHERE account_id = 'primary' AND category_id = ?2", this.clock(), id));
        statements.push(this.stmt("DELETE FROM categories WHERE account_id = 'primary' AND category_id = ?1", id));
        changes.push({ entityType: "category", entityKey: id, operation: "tombstone" });
        activity = { type: "category_deleted", payload: { id } };
        break;
      }
      case "category.reorder": {
        const categories = Array.isArray(payload.categories) ? payload.categories.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}) : [];
        for (const category of categories) statements.push(this.upsertCategoryStatement(category).statement);
        changes.push({ entityType: "category", entityKey: "order", operation: "reorder" });
        activity = { type: "category_reordered", payload: { count: categories.length } };
        break;
      }
      case "category.create":
      case "category.update":
      case "category.rename": {
        const { id, statement } = this.upsertCategoryStatement({ ...payload, id: payload.id ?? entityKey });
        statements.push(statement);
        changes.push({ entityType: "category", entityKey: id, operation: "update" });
        activity = { type: "category_updated", payload: { id } };
        break;
      }
      case "repository_meta.batch_category": {
        const names = strings(payload.repoFullNames);
        const categoryId = typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null;
        for (const fullName of names) {
          statements.push(this.stmt("INSERT INTO repository_meta (account_id, github_repo_id, category_id, note, ai_summary, updated_at) VALUES ('primary', ?1, ?2, NULL, NULL, ?3) ON CONFLICT(account_id, github_repo_id) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at", fullName, categoryId, this.clock()));
          changes.push({ entityType: "repositoryMeta", entityKey: fullName, operation: "update" });
        }
        activity = { type: "repository_meta_batch_category", payload: { count: names.length, categoryId } };
        break;
      }
      case "repository_meta.ai":
      case "repository_meta.update": {
        const category = payload.category && typeof payload.category === "object" ? payload.category as Record<string, unknown> : null;
        if (category) statements.push(this.upsertCategoryStatement(category).statement);
        statements.push(this.upsertRepositoryMetaStatement(entityKey, payload));
        changes.push({ entityType: "repositoryMeta", entityKey, operation: "update" });
        activity = { type: typedOperation === "repository_meta.ai" ? "repository_ai_organized" : "repository_meta_updated", payload: { fullName: entityKey } };
        break;
      }
      case "repository_meta.ai_batch": {
        const categories = Array.isArray(payload.categories) ? payload.categories : [];
        for (const item of categories) if (item && typeof item === "object") statements.push(this.upsertCategoryStatement(item as Record<string, unknown>).statement);
        const items = Array.isArray(payload.items) ? payload.items : [];
        for (const item of items) if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const fullName = String(record.fullName ?? "");
          if (!fullName) continue;
          statements.push(this.upsertRepositoryMetaStatement(fullName, record));
          changes.push({ entityType: "repositoryMeta", entityKey: fullName, operation: "update" });
        }
        activity = { type: "repository_ai_organized_batch", payload: { count: items.length } };
        break;
      }
      case "unstar":
      case "star.unstar": {
        const fullName = String(payload.fullName ?? payload.repoFullName ?? entityKey);
        statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE account_id = 'primary' AND full_name = ?2 AND is_starred = 1", this.clock(), fullName));
        changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        activity = { type: "unstarred", payload: { fullName } };
        break;
      }
      case "star.unstarBatch": {
        const rawNames = Array.isArray(payload.repoFullNames) ? payload.repoFullNames : payload.repositories;
        const fullNames = Array.from(new Set(strings(rawNames)));
        for (const fullName of fullNames) {
          statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE account_id = 'primary' AND full_name = ?2 AND is_starred = 1", this.clock(), fullName));
          changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        }
        activity = { type: "unstarred_batch", payload: { fullNames } };
        break;
      }
      default: {
        const exhaustive: never = typedOperation;
        throw new MutationRequestError(`未知 mutation operation: ${String(exhaustive)}`);
      }
    }

    return this.commitWrites(statements, changes, activity, mutationId);
  }

  async saveSyncState(scope: string, cursor: string | null, revision: number) { await this.stmt("INSERT INTO sync_state (account_id, scope, cursor, revision, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4) ON CONFLICT(account_id, scope) DO UPDATE SET cursor = excluded.cursor, revision = excluded.revision, updated_at = excluded.updated_at", scope, cursor, revision, this.clock()).run(); }
}
