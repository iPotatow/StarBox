import type { AccountRecord, D1Database, D1PreparedStatement, GithubCredentialRecord, SessionRecord } from "./types.js";

const nowIso = () => new Date().toISOString();
const encoded = (value: unknown) => JSON.stringify(value ?? {});
const decoded = (value: unknown) => { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; } };
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

type GithubListSnapshot = { id: string; name: string; description?: string | null; isPrivate?: boolean; items?: Array<{ id: string; fullName: string; htmlUrl?: string }> };
export type MutationOperation =
  | "category.create" | "category.update" | "category.rename" | "category.delete" | "category.reorder"
  | "repository_meta.update" | "repository_meta.ai" | "repository_meta.ai_batch" | "repository_meta.batch_category"
  | "release.subscribe" | "release.unsubscribe" | "release.subscribe.batch"
  | "fork.save" | "fork.update"
  | "list.create" | "list.update" | "list.delete" | "list.membership"
  | "unstar" | "star.unstar" | "star.unstarBatch";

type ChangeInput = { entityType: string; entityKey: string; operation: string };
type ActivityInput = { type: string; payload: unknown };
type ChangeResult = { seq: number; revision: number };

const mutationOperations = new Set<MutationOperation>([
  "category.create", "category.update", "category.rename", "category.delete", "category.reorder",
  "repository_meta.update", "repository_meta.ai", "repository_meta.ai_batch", "repository_meta.batch_category",
  "release.subscribe", "release.unsubscribe", "release.subscribe.batch",
  "fork.save", "fork.update",
  "list.create", "list.update", "list.delete", "list.membership",
  "unstar", "star.unstar", "star.unstarBatch",
]);

export class MutationRequestError extends Error {
  readonly status = 400;
}

export class DataRepository {
  constructor(private readonly db: D1Database, private readonly clock: () => string = nowIso) {}
  private stmt(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values); }
  async batch(statements: D1PreparedStatement[]) { const result: unknown[] = []; for (let i = 0; i < statements.length; i += 50) result.push(...await this.db.batch(statements.slice(i, i + 50))); return result; }

  async ensureAccount() { const now = this.clock(); await this.stmt("INSERT INTO app_account (account_id, created_at, updated_at) VALUES ('primary', ?1, ?1) ON CONFLICT(account_id) DO UPDATE SET updated_at = excluded.updated_at", now).run(); return (await this.account())!; }
  async account() { return this.stmt("SELECT account_id, github_user_id, github_login, revision, created_at, updated_at FROM app_account WHERE account_id = 'primary' LIMIT 1").first<AccountRecord>(); }
  async createSession(session: SessionRecord) { await this.stmt("INSERT INTO app_sessions (token_hash, account_id, created_at, expires_at, last_seen_at, revoked_at) VALUES (?1, 'primary', ?2, ?3, ?4, NULL)", session.token_hash, session.created_at, session.expires_at, session.last_seen_at).run(); }
  async sessionByHash(hash: string) { return this.stmt("SELECT token_hash, account_id, created_at, expires_at, last_seen_at, revoked_at FROM app_sessions WHERE token_hash = ?1 AND account_id = 'primary' LIMIT 1", hash).first<SessionRecord>(); }
  async touchSession(hash: string) { await this.stmt("UPDATE app_sessions SET last_seen_at = ?1 WHERE token_hash = ?2 AND account_id = 'primary' AND revoked_at IS NULL", this.clock(), hash).run(); }
  async revokeSession(hash: string) { await this.stmt("UPDATE app_sessions SET revoked_at = ?1 WHERE token_hash = ?2 AND account_id = 'primary'", this.clock(), hash).run(); }

  async credential() { return this.stmt("SELECT account_id, github_numeric_id, github_login, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status FROM github_credentials WHERE account_id = 'primary' LIMIT 1").first<GithubCredentialRecord>(); }
  async saveCredential(input: GithubCredentialRecord) { const now = this.clock(); await this.batch([this.stmt("INSERT INTO github_credentials (account_id, github_numeric_id, github_login, ciphertext, iv, key_version, fingerprint, validated_at, created_at, updated_at, status) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9) ON CONFLICT(account_id) DO UPDATE SET github_numeric_id = excluded.github_numeric_id, github_login = excluded.github_login, ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, fingerprint = excluded.fingerprint, validated_at = excluded.validated_at, updated_at = excluded.updated_at, status = excluded.status", input.github_numeric_id, input.github_login, input.ciphertext, input.iv, input.key_version, input.fingerprint, input.validated_at, now, input.status), this.stmt("UPDATE app_account SET github_user_id = ?1, github_login = ?2, updated_at = ?3 WHERE account_id = 'primary'", input.github_numeric_id, input.github_login, now)]); }
  async rotateCredential(input: Pick<GithubCredentialRecord, "ciphertext" | "iv" | "key_version" | "fingerprint">) { await this.stmt("UPDATE github_credentials SET ciphertext = ?1, iv = ?2, key_version = ?3, fingerprint = ?4, updated_at = ?5 WHERE account_id = 'primary'", input.ciphertext, input.iv, input.key_version, input.fingerprint, this.clock()).run(); }
  async deleteCredential() { await this.stmt("DELETE FROM github_credentials WHERE account_id = 'primary'").run(); }

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
      ["githubLists", "SELECT * FROM github_lists WHERE account_id = 'primary' ORDER BY updated_at DESC"],
      ["githubListMemberships", "SELECT * FROM github_list_memberships WHERE account_id = 'primary' ORDER BY updated_at DESC"],
      ["notifications", "SELECT * FROM notifications WHERE account_id = 'primary' ORDER BY created_at DESC LIMIT 100"],
    ] as const;
    const entries = Object.fromEntries(await Promise.all(queries.map(async ([key, sql]) => [key, (await this.db.prepare(sql).all()).results ?? []] as const)));
    const memberships = (entries.githubListMemberships ?? []) as Array<Record<string, unknown>>;
    const githubLists = ((entries.githubLists ?? []) as Array<Record<string, unknown>>).map((list) => ({
      ...list,
      items: memberships.filter((membership) => membership.list_id === list.list_id).map((membership) => ({
        id: String(membership.github_repo_id ?? ""),
        fullName: String(membership.repo_full_name ?? ""),
        htmlUrl: String(membership.html_url ?? ""),
      })).filter((item) => item.fullName),
    }));
    delete (entries as Record<string, unknown>).githubListMemberships;
    entries.githubLists = githubLists;
    const credential = await this.credential();
    const lastSeq = await this.stmt("SELECT MAX(seq) AS seq FROM sync_changes WHERE account_id = 'primary'").first<{ seq: number }>();
    return { account, githubCredential: credential ? { connected: true, login: credential.github_login, githubUserId: credential.github_numeric_id, fingerprint: credential.fingerprint, keyVersion: credential.key_version } : { connected: false }, ...entries, revision: account?.revision ?? 0, lastSeq: Number(lastSeq?.seq ?? 0) };
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

  async saveList(list: { id: string; name: string; description?: string | null; isPrivate?: boolean }, operation = "upsert") {
    const statement = this.stmt("INSERT INTO github_lists (account_id, list_id, name, description, is_private, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, list_id) DO UPDATE SET name = excluded.name, description = excluded.description, is_private = excluded.is_private, updated_at = excluded.updated_at", list.id, list.name, list.description ?? null, list.isPrivate ? 1 : 0, this.clock());
    return this.commitWrites([statement], [{ entityType: "list", entityKey: list.id, operation }], { type: `list_${operation}`, payload: { listId: list.id } });
  }
  async deleteList(id: string) {
    const statements = [this.stmt("DELETE FROM github_list_memberships WHERE account_id = 'primary' AND list_id = ?1", id), this.stmt("DELETE FROM github_lists WHERE account_id = 'primary' AND list_id = ?1", id)];
    return this.commitWrites(statements, [{ entityType: "list", entityKey: id, operation: "tombstone" }], { type: "list_deleted", payload: { listId: id } });
  }
  async saveMembership(repoId: string, listIds: string[], repoFullName = "", htmlUrl = "") {
    const statements = [this.stmt("DELETE FROM github_list_memberships WHERE account_id = 'primary' AND github_repo_id = ?1", repoId)];
    for (const listId of listIds) statements.push(this.stmt("INSERT INTO github_list_memberships (account_id, list_id, github_repo_id, repo_full_name, html_url, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, list_id, github_repo_id) DO UPDATE SET repo_full_name = excluded.repo_full_name, html_url = excluded.html_url, updated_at = excluded.updated_at", listId, repoId, repoFullName, htmlUrl, this.clock()));
    return this.commitWrites(statements, [{ entityType: "listMembership", entityKey: repoFullName || repoId, operation: "upsert" }], { type: "list_membership_updated", payload: { repoId, repoFullName, listIds } });
  }
  async replaceListsSnapshot(lists: GithubListSnapshot[]) {
    const statements = [
      this.stmt("DELETE FROM github_list_memberships WHERE account_id = 'primary'"),
      this.stmt("DELETE FROM github_lists WHERE account_id = 'primary'"),
    ];
    for (const list of lists) {
      statements.push(this.stmt("INSERT INTO github_lists (account_id, list_id, name, description, is_private, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5)", list.id, list.name, list.description ?? null, list.isPrivate ? 1 : 0, this.clock()));
      for (const item of list.items ?? []) statements.push(this.stmt("INSERT INTO github_list_memberships (account_id, list_id, github_repo_id, repo_full_name, html_url, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5)", list.id, item.id, item.fullName, item.htmlUrl ?? `https://github.com/${item.fullName}`, this.clock()));
    }
    return this.commitWrites(statements, [{ entityType: "list", entityKey: "snapshot", operation: "replace" }], { type: "lists_synced", payload: { count: lists.length } });
  }

  private upsertCategoryStatement(category: Record<string, unknown>) {
    const now = this.clock();
    const id = String(category.id ?? category.categoryId ?? category.entityKey ?? "");
    if (!id) throw new MutationRequestError("Category ID 不能为空");
    return { id, statement: this.stmt("INSERT INTO categories (account_id, category_id, name, color, sort_order, locked, created_at, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(account_id, category_id) DO UPDATE SET name = excluded.name, color = excluded.color, sort_order = excluded.sort_order, locked = excluded.locked, updated_at = excluded.updated_at", id, String(category.name ?? "未分类"), typeof category.color === "string" ? category.color : null, Number(category.sortOrder ?? category.order ?? 0), category.locked ? 1 : 0, now) };
  }
  private upsertRepositoryMetaStatement(fullName: string, payload: Record<string, unknown>) {
    const now = this.clock();
    const aiTags = Array.isArray(payload.aiTags) ? payload.aiTags.map(String) : [];
    return this.stmt("INSERT INTO repository_meta (account_id, github_repo_id, category_id, note, pinned, ai_summary, ai_tags_json, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(account_id, github_repo_id) DO UPDATE SET category_id = excluded.category_id, note = excluded.note, pinned = excluded.pinned, ai_summary = excluded.ai_summary, ai_tags_json = excluded.ai_tags_json, updated_at = excluded.updated_at", fullName, typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null, typeof payload.note === "string" ? payload.note : null, payload.pinned ? 1 : 0, typeof payload.aiSummary === "string" ? payload.aiSummary : null, encoded(aiTags), now);
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
      case "list.delete": {
        const id = String(payload.listId ?? entityKey);
        statements.push(this.stmt("DELETE FROM github_list_memberships WHERE account_id = 'primary' AND list_id = ?1", id));
        statements.push(this.stmt("DELETE FROM github_lists WHERE account_id = 'primary' AND list_id = ?1", id));
        changes.push({ entityType: "list", entityKey: id, operation: "tombstone" });
        activity = { type: "list_deleted", payload: { listId: id } };
        break;
      }
      case "list.membership": {
        const repoId = String(payload.repoId ?? payload.fullName ?? entityKey);
        const repoFullName = String(payload.repoFullName ?? payload.fullName ?? "");
        const htmlUrl = typeof payload.htmlUrl === "string" ? payload.htmlUrl : "";
        const listIds = strings(payload.listIds);
        statements.push(this.stmt("DELETE FROM github_list_memberships WHERE account_id = 'primary' AND github_repo_id = ?1", repoId));
        for (const listId of listIds) statements.push(this.stmt("INSERT INTO github_list_memberships (account_id, list_id, github_repo_id, repo_full_name, html_url, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, list_id, github_repo_id) DO UPDATE SET repo_full_name = excluded.repo_full_name, html_url = excluded.html_url, updated_at = excluded.updated_at", listId, repoId, repoFullName, htmlUrl, this.clock()));
        changes.push({ entityType: "listMembership", entityKey: repoFullName || repoId, operation: "upsert" });
        activity = { type: "list_membership_updated", payload: { repoId, repoFullName, listIds } };
        break;
      }
      case "list.create":
      case "list.update": {
        const id = String(payload.listId ?? entityKey);
        const listOperation = typedOperation === "list.create" ? "upsert" : "update";
        statements.push(this.stmt("INSERT INTO github_lists (account_id, list_id, name, description, is_private, updated_at) VALUES ('primary', ?1, ?2, ?3, ?4, ?5) ON CONFLICT(account_id, list_id) DO UPDATE SET name = excluded.name, description = excluded.description, is_private = excluded.is_private, updated_at = excluded.updated_at", id, String(payload.name ?? ""), typeof payload.description === "string" ? payload.description : null, payload.isPrivate ? 1 : 0, this.clock()));
        changes.push({ entityType: "list", entityKey: id, operation: listOperation });
        activity = { type: `list_${listOperation}`, payload: { listId: id } };
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
          statements.push(this.stmt("INSERT INTO repository_meta (account_id, github_repo_id, category_id, note, pinned, ai_summary, ai_tags_json, updated_at) VALUES ('primary', ?1, ?2, NULL, 0, NULL, '[]', ?3) ON CONFLICT(account_id, github_repo_id) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at", fullName, categoryId, this.clock()));
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
