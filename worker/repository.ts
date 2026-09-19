import type {
  AccountRecord,
  AiCredentialRecord,
  AiModelRecord,
  AiServiceCredentialRecord,
  AiServiceRecord,
  AiTaskBindingRecord,
  AppPreferencesRecord,
  D1Database,
  D1PreparedStatement,
  GithubCredentialRecord,
  SessionRecord,
} from "./types.js";

const nowIso = () => new Date().toISOString();
const encoded = (value: unknown) => JSON.stringify(value ?? {});
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const storedStrings = (value: unknown) => {
  if (Array.isArray(value)) return strings(value);
  if (typeof value !== "string" || !value.trim()) return [];
  try { return strings(JSON.parse(value)); } catch { return []; }
};

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

  async ensureAccount() { return this.account(); }
  async account(): Promise<AccountRecord> {
    const [credential, values] = await Promise.all([this.credential(), this.settings()]);
    const now = this.clock();
    return {
      account_id: "primary",
      github_user_id: values["github.bound_user_id"] || credential?.github_numeric_id || null,
      github_login: values["github.bound_login"] || credential?.github_login || null,
      revision: 0,
      created_at: credential?.created_at ?? now,
      updated_at: credential?.updated_at ?? values["meta.preferences_updated_at"] ?? now,
    };
  }

  async createSession(session: SessionRecord) {
    await this.stmt(
      "INSERT INTO app_sessions (token_hash, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent) VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
      session.token_hash, session.created_at, session.expires_at, session.last_seen_at,
      session.device_id, session.device_name, session.device_type, session.os, session.browser,
      session.ip_address, session.country_code, session.region, session.city, session.user_agent,
    ).run();
  }
  async sessionByHash(hash: string) {
    return this.stmt(
      "SELECT token_hash, 'primary' AS account_id, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent FROM app_sessions WHERE token_hash = ?1 LIMIT 1",
      hash,
    ).first<SessionRecord>();
  }
  async touchSession(hash: string) { await this.stmt("UPDATE app_sessions SET last_seen_at = ?1 WHERE token_hash = ?2 AND revoked_at IS NULL", this.clock(), hash).run(); }
  async updateSessionDevice(hash: string, input: Pick<SessionRecord, "device_id" | "device_name" | "device_type" | "os" | "browser" | "ip_address" | "country_code" | "region" | "city" | "user_agent">) {
    await this.stmt(
      "UPDATE app_sessions SET device_id = ?1, device_name = ?2, device_type = ?3, os = ?4, browser = ?5, ip_address = ?6, country_code = ?7, region = ?8, city = ?9, user_agent = ?10 WHERE token_hash = ?11",
      input.device_id, input.device_name, input.device_type, input.os, input.browser,
      input.ip_address, input.country_code, input.region, input.city, input.user_agent, hash,
    ).run();
  }
  async listSessions() {
    const rows = await this.stmt(
      "SELECT token_hash, 'primary' AS account_id, created_at, expires_at, last_seen_at, revoked_at, device_id, device_name, device_type, os, browser, ip_address, country_code, region, city, user_agent FROM app_sessions WHERE revoked_at IS NULL AND expires_at > ?1 ORDER BY last_seen_at DESC",
      this.clock(),
    ).all<SessionRecord>();
    return rows.results ?? [];
  }
  async renameSession(deviceId: string, name: string) { await this.stmt("UPDATE app_sessions SET device_name = ?1 WHERE device_id = ?2 AND revoked_at IS NULL", name, deviceId).run(); }
  async revokeSession(hash: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE token_hash = ?2", this.clock(), hash).run(); }
  async revokeSessionByDeviceId(deviceId: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE device_id = ?2 AND revoked_at IS NULL", this.clock(), deviceId).run(); }
  async revokeOtherSessions(hash: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE token_hash <> ?2 AND revoked_at IS NULL", this.clock(), hash).run(); }

  async credential() {
    return this.stmt(
      "SELECT 'primary' AS account_id, owner_id AS github_numeric_id, label AS github_login, ciphertext, iv, key_version, fingerprint, COALESCE(validated_at, updated_at) AS validated_at, created_at, updated_at, status FROM credentials WHERE credential_id = 'github' LIMIT 1",
    ).first<GithubCredentialRecord>();
  }
  async saveCredential(input: GithubCredentialRecord) {
    const now = this.clock();
    await this.batch([
      this.stmt(
        "INSERT INTO credentials (credential_id, kind, owner_id, label, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES ('github', 'github', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9) ON CONFLICT(credential_id) DO UPDATE SET owner_id = excluded.owner_id, label = excluded.label, ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, validated_at = excluded.validated_at, updated_at = excluded.updated_at, status = excluded.status",
        input.github_numeric_id, input.github_login, input.ciphertext, input.iv, input.key_version,
        input.fingerprint, input.validated_at, now, input.status,
      ),
      this.settingStatement("github.bound_user_id", input.github_numeric_id, now),
      this.settingStatement("github.bound_login", input.github_login, now),
    ]);
  }
  async rotateCredential(input: Pick<GithubCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint">) {
    await this.stmt("UPDATE credentials SET ciphertext = ?1, iv = ?2, key_version = ?3, fingerprint = ?4, updated_at = ?5 WHERE credential_id = 'github'", input.ciphertext, input.iv, input.key_version, input.fingerprint, this.clock()).run();
  }
  async deleteCredential() { await this.stmt("DELETE FROM credentials WHERE credential_id = 'github'").run(); }

  async aiCredential() {
    return this.stmt(
      "SELECT 'primary' AS account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status FROM credentials WHERE credential_id = 'ai:legacy' LIMIT 1",
    ).first<AiCredentialRecord>();
  }
  async saveAiCredential(input: Pick<AiCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">) {
    const now = this.clock();
    await this.stmt(
      "INSERT INTO credentials (credential_id, kind, owner_id, label, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES ('ai:legacy', 'ai', 'legacy-default', NULL, ?1, ?2, ?3, ?4, NULL, ?5, ?5, ?6) ON CONFLICT(credential_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status",
      input.ciphertext, input.iv, input.key_version, input.fingerprint, now, input.status,
    ).run();
  }
  async deleteAiCredential() { await this.stmt("DELETE FROM credentials WHERE credential_id = 'ai:legacy'").run(); }

  async aiServices() {
    const rows = await this.stmt("SELECT service_id, 'primary' AS account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at FROM ai_services ORDER BY created_at, name").all<AiServiceRecord>();
    return rows.results ?? [];
  }
  async aiService(serviceId: string) {
    return this.stmt("SELECT service_id, 'primary' AS account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at FROM ai_services WHERE service_id = ?1 LIMIT 1", serviceId).first<AiServiceRecord>();
  }
  async saveAiService(input: Pick<AiServiceRecord, "service_id" | "name" | "protocol" | "base_url" | "enabled" | "config_json">) {
    const now = this.clock();
    await this.stmt(
      "INSERT INTO ai_services (service_id, name, protocol, base_url, enabled, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(service_id) DO UPDATE SET name = excluded.name, protocol = excluded.protocol, base_url = excluded.base_url, enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at",
      input.service_id, input.name, input.protocol, input.base_url, input.enabled, input.config_json, now,
    ).run();
    return (await this.aiService(input.service_id))!;
  }
  async deleteAiService(serviceId: string) {
    const models = await this.aiModels(serviceId);
    const statements: D1PreparedStatement[] = [
      this.stmt("DELETE FROM credentials WHERE credential_id = ?1", `ai:${serviceId}`),
      this.stmt("DELETE FROM ai_models WHERE service_id = ?1", serviceId),
      this.stmt("DELETE FROM ai_services WHERE service_id = ?1", serviceId),
    ];
    const defaultBinding = await this.aiTaskBinding("default");
    if (defaultBinding && models.some((model) => model.model_id === defaultBinding.model_id)) statements.push(this.deleteSettingStatement("ai.default_model_id"));
    await this.batch(statements);
  }
  async aiServiceCredential(serviceId: string) {
    return this.stmt(
      "SELECT owner_id AS service_id, 'primary' AS account_id, ciphertext, iv, key_version, fingerprint, created_at, updated_at, status FROM credentials WHERE credential_id = ?1 LIMIT 1",
      `ai:${serviceId}`,
    ).first<AiServiceCredentialRecord>();
  }
  async saveAiServiceCredential(input: Pick<AiServiceCredentialRecord, "service_id" | "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">) {
    const now = this.clock();
    await this.stmt(
      "INSERT INTO credentials (credential_id, kind, owner_id, label, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES (?1, 'ai', ?2, NULL, ?3, ?4, ?5, ?6, NULL, ?7, ?7, ?8) ON CONFLICT(credential_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status",
      `ai:${input.service_id}`, input.service_id, input.ciphertext, input.iv, input.key_version, input.fingerprint, now, input.status,
    ).run();
  }

  async saveAiServiceAtomic(
    service: Pick<AiServiceRecord, "service_id" | "name" | "protocol" | "base_url" | "enabled" | "config_json">,
    credential?: Pick<AiServiceCredentialRecord, "service_id" | "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">,
    model?: Pick<AiModelRecord, "model_id" | "service_id" | "remote_model_id" | "display_name" | "enabled" | "sort_order">,
    setDefault = false,
  ) {
    const now = this.clock();
    const statements: D1PreparedStatement[] = [
      this.stmt(
        "INSERT INTO ai_services (service_id, name, protocol, base_url, enabled, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(service_id) DO UPDATE SET name = excluded.name, protocol = excluded.protocol, base_url = excluded.base_url, enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at",
        service.service_id, service.name, service.protocol, service.base_url, service.enabled, service.config_json, now,
      ),
    ];
    if (credential) {
      statements.push(this.stmt(
        "INSERT INTO credentials (credential_id, kind, owner_id, label, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES (?1, 'ai', ?2, NULL, ?3, ?4, ?5, ?6, NULL, ?7, ?7, ?8) ON CONFLICT(credential_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status",
        `ai:${credential.service_id}`, credential.service_id, credential.ciphertext, credential.iv, credential.key_version, credential.fingerprint, now, credential.status,
      ));
    }
    if (model) {
      statements.push(this.aiModelStatement(model, now));
      if (setDefault) statements.push(this.settingStatement("ai.default_model_id", model.model_id, now));
    }
    await this.batch(statements);
    return (await this.aiService(service.service_id))!;
  }

  async deleteAiServiceCredential(serviceId: string) { await this.stmt("DELETE FROM credentials WHERE credential_id = ?1", `ai:${serviceId}`).run(); }
  async aiModels(serviceId?: string) {
    const rows = serviceId
      ? await this.stmt("SELECT model_id, 'primary' AS account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models WHERE service_id = ?1 ORDER BY sort_order, created_at", serviceId).all<AiModelRecord>()
      : await this.stmt("SELECT model_id, 'primary' AS account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models ORDER BY service_id, sort_order, created_at").all<AiModelRecord>();
    return rows.results ?? [];
  }
  async aiModel(modelId: string) {
    return this.stmt("SELECT model_id, 'primary' AS account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at FROM ai_models WHERE model_id = ?1 LIMIT 1", modelId).first<AiModelRecord>();
  }
  private aiModelStatement(input: Pick<AiModelRecord, "model_id" | "service_id" | "remote_model_id" | "display_name" | "enabled" | "sort_order">, now = this.clock()) {
    return this.stmt(
      "INSERT INTO ai_models (model_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(model_id) DO UPDATE SET service_id = excluded.service_id, remote_model_id = excluded.remote_model_id, display_name = excluded.display_name, enabled = excluded.enabled, sort_order = excluded.sort_order, updated_at = excluded.updated_at",
      input.model_id, input.service_id, input.remote_model_id, input.display_name, input.enabled, input.sort_order, now,
    );
  }
  async saveAiModel(input: Pick<AiModelRecord, "model_id" | "service_id" | "remote_model_id" | "display_name" | "enabled" | "sort_order">) {
    await this.aiModelStatement(input).run();
    return (await this.aiModel(input.model_id))!;
  }
  async deleteAiModel(modelId: string) {
    const binding = await this.aiTaskBinding("default");
    const statements = [this.stmt("DELETE FROM ai_models WHERE model_id = ?1", modelId)];
    if (binding?.model_id === modelId) statements.push(this.deleteSettingStatement("ai.default_model_id"));
    await this.batch(statements);
  }
  async aiTaskBinding(task = "default") {
    const row = await this.stmt("SELECT value, updated_at FROM settings WHERE key = ?1 LIMIT 1", `ai.${task}_model_id`).first<{ value: string; updated_at: string }>();
    return row ? { account_id: "primary", task, model_id: row.value, updated_at: row.updated_at } satisfies AiTaskBindingRecord : null;
  }
  async saveAiTaskBinding(task: string, modelId: string) {
    const now = this.clock();
    await this.settingStatement(`ai.${task}_model_id`, modelId, now).run();
    return { account_id: "primary", task, model_id: modelId, updated_at: now } satisfies AiTaskBindingRecord;
  }

  private settingStatement(key: string, value: string, now = this.clock()) {
    return this.stmt(
      "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      key, value, now,
    );
  }
  private deleteSettingStatement(key: string) { return this.stmt("DELETE FROM settings WHERE key = ?1", key); }
  async settings() {
    const rows = await this.stmt("SELECT key, value, updated_at FROM settings").all<{ key: string; value: string; updated_at: string }>();
    return Object.fromEntries((rows.results ?? []).map((row) => [row.key, row.value]));
  }
  async saveSettings(values: Record<string, string | number | boolean | null | undefined>) {
    const now = this.clock();
    const statements = Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => value === null ? this.deleteSettingStatement(key) : this.settingStatement(key, String(value), now));
    await this.batch(statements);
  }

  async appPreferences(): Promise<AppPreferencesRecord> {
    const values = await this.settings();
    return {
      account_id: "primary",
      ai_provider_name: values["ai.provider_name"] || "Custom HTTP",
      ai_base_url: values["ai.base_url"] || "",
      ai_model: values["ai.model"] || "",
      release_sync_pages: Math.max(1, Number(values["release.sync_pages"] || 3)),
      release_asset_include_pattern: values["release.asset_include_pattern"] || "",
      release_asset_exclude_pattern: values["release.asset_exclude_pattern"] || "",
      updated_at: values["meta.preferences_updated_at"] || this.clock(),
    };
  }
  async saveAppPreferences(input: Partial<Pick<AppPreferencesRecord, "ai_provider_name" | "ai_base_url" | "ai_model" | "release_sync_pages" | "release_asset_include_pattern" | "release_asset_exclude_pattern">>) {
    const current = await this.appPreferences();
    const now = this.clock();
    const next = {
      ai_provider_name: input.ai_provider_name ?? current.ai_provider_name,
      ai_base_url: input.ai_base_url ?? current.ai_base_url,
      ai_model: input.ai_model ?? current.ai_model,
      release_sync_pages: Math.max(1, Number(input.release_sync_pages ?? current.release_sync_pages)),
      release_asset_include_pattern: input.release_asset_include_pattern ?? current.release_asset_include_pattern,
      release_asset_exclude_pattern: input.release_asset_exclude_pattern ?? current.release_asset_exclude_pattern,
    };
    await this.saveSettings({
      "ai.provider_name": next.ai_provider_name,
      "ai.base_url": next.ai_base_url,
      "ai.model": next.ai_model,
      "release.sync_pages": next.release_sync_pages,
      "release.asset_include_pattern": next.release_asset_include_pattern,
      "release.asset_exclude_pattern": next.release_asset_exclude_pattern,
      "meta.preferences_updated_at": now,
    });
    return { account_id: "primary", ...next, updated_at: now } satisfies AppPreferencesRecord;
  }

  async saveAiConfigAtomic(
    input: Pick<AppPreferencesRecord, "ai_provider_name" | "ai_base_url" | "ai_model">,
    credential?: Pick<AiCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint" | "status">,
  ) {
    const now = this.clock();
    const statements: D1PreparedStatement[] = [
      this.settingStatement("ai.provider_name", input.ai_provider_name, now),
      this.settingStatement("ai.base_url", input.ai_base_url, now),
      this.settingStatement("ai.model", input.ai_model, now),
      this.settingStatement("meta.preferences_updated_at", now, now),
    ];
    if (credential) {
      statements.push(this.stmt(
        "INSERT INTO credentials (credential_id, kind, owner_id, label, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES ('ai:legacy', 'ai', 'legacy-default', NULL, ?1, ?2, ?3, ?4, NULL, ?5, ?5, ?6) ON CONFLICT(credential_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at, status = excluded.status",
        credential.ciphertext, credential.iv, credential.key_version, credential.fingerprint, now, credential.status,
      ));
    }
    await this.batch(statements);
    return { ...(await this.appPreferences()), updated_at: now };
  }

  async recordActivity(type: string, _payload: unknown) {
    if (type === "stars_synced") await this.saveSettings({ "sync.stars_last_at": this.clock() });
    return crypto.randomUUID();
  }
  async listNotifications(_limit: number) { return []; }
  async markNotificationRead(_id: string) { /* notifications are no longer persisted */ }
  async addNotification(_kind: string, _title: string, _body: string) { /* notifications are no longer persisted */ }

  async revision() { return 0; }

  private async commitWrites(
    businessStatements: D1PreparedStatement[],
    _changes: ChangeInput[],
    _activity?: ActivityInput,
    _mutationId?: string,
  ): Promise<ChangeResult> {
    if (businessStatements.length > 50) throw new MutationRequestError("单次原子 D1 mutation 过大，请减少批量项目后重试");
    const results = businessStatements.length ? await this.db.batch(businessStatements) : [];
    if (results.some((result) => result.success === false)) throw new Error("D1 batch statement failed");
    return { seq: 0, revision: 0 };
  }

  async change(entityType: string, entityKey: string, operation: string) {
    return this.commitWrites([], [{ entityType, entityKey, operation }]);
  }
  async changes(_after: number, _limit: number) { return { changes: [], lastSeq: 0, hasMore: false }; }

  async bootstrap() {
    const queries = [
      ["repositories", "SELECT full_name, github_repo_id, name, html_url, description, language, default_branch, is_starred, starred_at, updated_at, raw_json FROM repositories WHERE is_starred = 1 ORDER BY updated_at DESC"],
      ["repositoryMeta", "SELECT full_name AS github_repo_id, category_id, note, ai_summary, ai_tags_json, ai_platforms_json, updated_at FROM repositories WHERE category_id IS NOT NULL OR note IS NOT NULL OR ai_summary IS NOT NULL OR ai_tags_json <> '[]' OR ai_platforms_json <> '[]'"],
      ["categories", "SELECT category_id, category_id AS id, name, color, sort_order, locked, created_at, updated_at FROM categories ORDER BY sort_order, created_at"],
      ["releaseSubscriptions", "SELECT full_name AS repo_full_name FROM repositories WHERE release_subscribed = 1"],
      ["forks", "SELECT full_name, parent_full_name, status, updated_at, payload_json FROM forks ORDER BY updated_at DESC"],
    ] as const;
    const entries = Object.fromEntries(await Promise.all(queries.map(async ([key, sql]) => [key, (await this.db.prepare(sql).all()).results ?? []] as const)));
    const credential = await this.credential();
    const aiCredential = await this.aiCredential();
    const preferences = await this.appPreferences();
    const settings = await this.settings();
    return {
      account: await this.account(),
      githubCredential: credential ? { connected: true, login: credential.github_login, githubUserId: credential.github_numeric_id, fingerprint: credential.fingerprint, keyVersion: credential.key_version } : { connected: false },
      aiCredential: aiCredential ? { configured: aiCredential.status === "active", keyVersion: aiCredential.key_version, fingerprint: aiCredential.fingerprint, updatedAt: aiCredential.updated_at } : { configured: false },
      appPreferences: preferences,
      syncSummary: { stars: settings["sync.stars_last_at"] ?? null, releases: null },
      ...entries,
      revision: 0,
      lastSeq: 0,
    };
  }

  async upsertRepository(repository: Record<string, unknown>, starred: boolean) {
    const now = this.clock();
    const fullName = String(repository.full_name ?? "");
    const repoId = String(repository.id ?? fullName);
    const statement = this.stmt(
      "INSERT INTO repositories (full_name, github_repo_id, name, html_url, description, language, default_branch, is_starred, starred_at, updated_at, raw_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(full_name) DO UPDATE SET github_repo_id = excluded.github_repo_id, name = excluded.name, html_url = excluded.html_url, description = excluded.description, language = excluded.language, default_branch = excluded.default_branch, is_starred = excluded.is_starred, starred_at = excluded.starred_at, updated_at = excluded.updated_at, raw_json = excluded.raw_json",
      fullName, repoId, String(repository.name ?? fullName.split("/").pop() ?? ""), String(repository.html_url ?? `https://github.com/${fullName}`),
      typeof repository.description === "string" ? repository.description : null,
      typeof repository.language === "string" ? repository.language : null,
      String(repository.default_branch ?? "main"), starred ? 1 : 0,
      starred ? String(repository.starred_at ?? now) : null, now, encoded(repository),
    );
    return this.commitWrites([statement], [{ entityType: "repository", entityKey: fullName, operation: starred ? "upsert" : "tombstone" }]);
  }
  async listStarredFullNames() {
    const rows = await this.stmt("SELECT full_name FROM repositories WHERE is_starred = 1").all<{ full_name: string }>();
    return (rows.results ?? []).map((row) => row.full_name);
  }
  async markRepositoryUnstarred(fullName: string, recordActivity = false) {
    const now = this.clock();
    const statement = this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE full_name = ?2 AND is_starred = 1", now, fullName);
    const activity = recordActivity ? { type: "unstarred", payload: { fullName } } : undefined;
    return this.commitWrites([statement], [{ entityType: "repository", entityKey: fullName, operation: "tombstone" }], activity);
  }

  private repositoryPlaceholder(fullName: string, now = this.clock()) {
    return this.stmt(
      "INSERT INTO repositories (full_name, github_repo_id, name, html_url, is_starred, updated_at, raw_json) VALUES (?1, ?1, ?2, ?3, 0, ?4, '{}') ON CONFLICT(full_name) DO NOTHING",
      fullName, fullName.split("/").pop() || fullName, `https://github.com/${fullName}`, now,
    );
  }
  async releasePlatformState(fullName: string) {
    const row = await this.stmt(
      "SELECT ai_platforms_json, release_last_synced_at FROM repositories WHERE full_name = ?1 LIMIT 1",
      fullName,
    ).first<{ ai_platforms_json: string | null; release_last_synced_at: string | null }>();
    return {
      platforms: storedStrings(row?.ai_platforms_json),
      checkedAt: row?.release_last_synced_at ?? null,
    };
  }
  async saveReleasePlatformState(fullName: string, platforms: string[], cursor: string | null = null) {
    const now = this.clock();
    await this.batch([
      this.repositoryPlaceholder(fullName, now),
      this.stmt(
        "UPDATE repositories SET ai_platforms_json = ?1, release_last_synced_at = ?2, release_cursor = ?3, updated_at = ?2 WHERE full_name = ?4",
        encoded(strings(platforms)), now, cursor, fullName,
      ),
    ]);
  }
  async subscribeRelease(repoFullName: string, subscribed: boolean) {
    const statements = [this.repositoryPlaceholder(repoFullName), this.stmt("UPDATE repositories SET release_subscribed = ?1 WHERE full_name = ?2", subscribed ? 1 : 0, repoFullName)];
    return this.commitWrites(statements, [{ entityType: "releaseSubscription", entityKey: repoFullName, operation: subscribed ? "upsert" : "tombstone" }]);
  }
  private batchReleaseSubscriptionStatement(repoFullNames: string[]) {
    const now = this.clock();
    const values: unknown[] = [];
    const rows = repoFullNames.map((fullName, index) => {
      const offset = index * 4 + 1;
      values.push(fullName, fullName.split("/").pop() || fullName, `https://github.com/${fullName}`, now);
      return `(?${offset}, ?${offset}, ?${offset + 1}, ?${offset + 2}, 0, 1, ?${offset + 3}, '{}')`;
    });
    return this.stmt(
      `INSERT INTO repositories (full_name, github_repo_id, name, html_url, is_starred, release_subscribed, updated_at, raw_json) VALUES ${rows.join(", ")} ON CONFLICT(full_name) DO UPDATE SET release_subscribed = 1`,
      ...values,
    );
  }
  async subscribeReleaseBatch(repoFullNames: string[]) {
    const unique = Array.from(new Set(repoFullNames.filter(Boolean)));
    if (!unique.length) return { seq: 0, revision: 0 };
    return this.commitWrites(
      [this.batchReleaseSubscriptionStatement(unique)],
      [{ entityType: "releaseSubscription", entityKey: "batch", operation: "batch_upsert" }],
    );
  }

  async saveFork(fullName: string, parentFullName: string | null, status: string, payload: unknown) {
    const now = this.clock();
    const statement = this.stmt(
      "INSERT INTO forks (full_name, parent_full_name, status, updated_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(full_name) DO UPDATE SET parent_full_name = excluded.parent_full_name, status = excluded.status, updated_at = excluded.updated_at, payload_json = excluded.payload_json",
      fullName, parentFullName, status, now, encoded(payload),
    );
    return this.commitWrites([statement], [{ entityType: "fork", entityKey: fullName, operation: status === "deleted" ? "tombstone" : "upsert" }]);
  }

  private upsertCategoryStatement(category: Record<string, unknown>) {
    const now = this.clock();
    const id = String(category.id ?? category.categoryId ?? category.entityKey ?? "");
    if (!id) throw new MutationRequestError("Category ID 不能为空");
    return {
      id,
      statement: this.stmt(
        "INSERT INTO categories (category_id, name, color, sort_order, locked, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(category_id) DO UPDATE SET name = excluded.name, color = excluded.color, sort_order = excluded.sort_order, locked = excluded.locked, updated_at = excluded.updated_at",
        id, String(category.name ?? "未分类"), typeof category.color === "string" ? category.color : null,
        Number(category.sortOrder ?? category.order ?? 0), category.locked ? 1 : 0, now,
      ),
    };
  }

  private upsertRepositoryMetaStatement(fullName: string, payload: Record<string, unknown>) {
    const now = this.clock();
    const hasCategory = Object.prototype.hasOwnProperty.call(payload, "categoryId");
    const hasNote = Object.prototype.hasOwnProperty.call(payload, "note");
    const hasSummary = Object.prototype.hasOwnProperty.call(payload, "aiSummary");
    const hasTags = Array.isArray(payload.aiTags);
    const hasPlatforms = Array.isArray(payload.aiPlatforms);
    return this.stmt(
      "INSERT INTO repositories (full_name, github_repo_id, name, html_url, is_starred, category_id, note, ai_summary, ai_tags_json, ai_platforms_json, updated_at, raw_json) VALUES (?1, ?1, ?2, ?3, 0, ?4, ?5, ?6, ?7, ?8, ?9, '{}') ON CONFLICT(full_name) DO UPDATE SET category_id = CASE WHEN ?10 THEN excluded.category_id ELSE repositories.category_id END, note = CASE WHEN ?11 THEN excluded.note ELSE repositories.note END, ai_summary = CASE WHEN ?12 THEN excluded.ai_summary ELSE repositories.ai_summary END, ai_tags_json = CASE WHEN ?13 THEN excluded.ai_tags_json ELSE repositories.ai_tags_json END, ai_platforms_json = CASE WHEN ?14 THEN excluded.ai_platforms_json ELSE repositories.ai_platforms_json END, updated_at = excluded.updated_at",
      fullName,
      fullName.split("/").pop() || fullName,
      `https://github.com/${fullName}`,
      typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null,
      typeof payload.note === "string" ? payload.note : null,
      typeof payload.aiSummary === "string" ? payload.aiSummary : null,
      encoded(strings(payload.aiTags)),
      encoded(strings(payload.aiPlatforms)),
      now,
      hasCategory ? 1 : 0,
      hasNote ? 1 : 0,
      hasSummary ? 1 : 0,
      hasTags ? 1 : 0,
      hasPlatforms ? 1 : 0,
    );
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
        statements.push(this.repositoryPlaceholder(repoFullName));
        statements.push(this.stmt("UPDATE repositories SET release_subscribed = ?1 WHERE full_name = ?2", typedOperation === "release.subscribe" ? 1 : 0, repoFullName));
        changes.push({ entityType: "releaseSubscription", entityKey: repoFullName, operation: typedOperation === "release.subscribe" ? "upsert" : "tombstone" });
        break;
      }
      case "release.subscribe.batch": {
        const repoFullNames = Array.from(new Set(strings(payload.repoFullNames)));
        if (repoFullNames.length) statements.push(this.batchReleaseSubscriptionStatement(repoFullNames));
        changes.push({ entityType: "releaseSubscription", entityKey: "batch", operation: "batch_upsert" });
        break;
      }
      case "fork.save":
      case "fork.update": {
        const fullName = String(payload.fullName ?? entityKey);
        const parentFullName = typeof payload.parentFullName === "string" ? payload.parentFullName : null;
        const status = typeof payload.status === "string" ? payload.status : "unknown";
        const now = this.clock();
        statements.push(this.stmt(
          "INSERT INTO forks (full_name, parent_full_name, status, updated_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(full_name) DO UPDATE SET parent_full_name = excluded.parent_full_name, status = excluded.status, updated_at = excluded.updated_at, payload_json = excluded.payload_json",
          fullName, parentFullName, status, now, encoded(payload),
        ));
        changes.push({ entityType: "fork", entityKey: fullName, operation: status === "deleted" ? "tombstone" : "upsert" });
        break;
      }
      case "category.delete": {
        const id = String(payload.id ?? entityKey);
        statements.push(this.stmt("UPDATE repositories SET category_id = NULL, updated_at = ?1 WHERE category_id = ?2", this.clock(), id));
        statements.push(this.stmt("DELETE FROM categories WHERE category_id = ?1", id));
        changes.push({ entityType: "category", entityKey: id, operation: "tombstone" });
        break;
      }
      case "category.reorder": {
        const categories = Array.isArray(payload.categories) ? payload.categories.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}) : [];
        for (const category of categories) statements.push(this.upsertCategoryStatement(category).statement);
        changes.push({ entityType: "category", entityKey: "order", operation: "reorder" });
        break;
      }
      case "category.create":
      case "category.update":
      case "category.rename": {
        const { id, statement } = this.upsertCategoryStatement({ ...payload, id: payload.id ?? entityKey });
        statements.push(statement);
        changes.push({ entityType: "category", entityKey: id, operation: "update" });
        break;
      }
      case "repository_meta.batch_category": {
        const names = strings(payload.repoFullNames);
        const categoryId = typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null;
        for (const fullName of names) {
          statements.push(this.repositoryPlaceholder(fullName));
          statements.push(this.stmt("UPDATE repositories SET category_id = ?1, updated_at = ?2 WHERE full_name = ?3", categoryId, this.clock(), fullName));
          changes.push({ entityType: "repositoryMeta", entityKey: fullName, operation: "update" });
        }
        break;
      }
      case "repository_meta.ai":
      case "repository_meta.update": {
        const category = payload.category && typeof payload.category === "object" ? payload.category as Record<string, unknown> : null;
        if (category) statements.push(this.upsertCategoryStatement(category).statement);
        statements.push(this.upsertRepositoryMetaStatement(entityKey, payload));
        changes.push({ entityType: "repositoryMeta", entityKey, operation: "update" });
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
        break;
      }
      case "unstar":
      case "star.unstar": {
        const fullName = String(payload.fullName ?? payload.repoFullName ?? entityKey);
        statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE full_name = ?2 AND is_starred = 1", this.clock(), fullName));
        changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        break;
      }
      case "star.unstarBatch": {
        const rawNames = Array.isArray(payload.repoFullNames) ? payload.repoFullNames : payload.repositories;
        const fullNames = Array.from(new Set(strings(rawNames)));
        for (const fullName of fullNames) {
          statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, updated_at = ?1 WHERE full_name = ?2 AND is_starred = 1", this.clock(), fullName));
          changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        }
        break;
      }
      default: {
        const exhaustive: never = typedOperation;
        throw new MutationRequestError(`未知 mutation operation: ${String(exhaustive)}`);
      }
    }

    return this.commitWrites(statements, changes, activity, mutationId);
  }

  async saveSyncState(_scope: string, _cursor: string | null, _revision: number) { /* retained for API compatibility */ }
}
