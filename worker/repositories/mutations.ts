import type { D1Database, D1PreparedStatement } from "../types.js";
import type { MutationOperation } from "../../shared/contracts.js";
import { nowIso, encoded, strings, realGithubRepoId, categoryNameKey, expectedRevisionFor } from "./values.js";

export type RevisionGuard = { index: number; fullName: string; expected: number; allowMissing?: boolean };

export type ChangeInput = { entityType: string; entityKey: string; operation: string };

export type ActivityInput = { type: string; payload: unknown };

export type ChangeResult = { seq: number; revision: number; userRevisions?: Record<string, number> };

export const mutationOperations = new Set<MutationOperation>([
  "category.create", "category.update", "category.rename", "category.delete", "category.reorder",
  "repository_meta.update", "repository_meta.ai", "repository_meta.ai_batch", "repository_meta.batch_category",
  "release.subscribe", "release.unsubscribe", "release.subscribe.batch",
  "fork.save", "fork.update",
  "unstar", "star.unstar", "star.unstarBatch",
]);

export class MutationRequestError extends Error {
  readonly status = 400;
}

export class MutationConflictError extends Error {
  readonly status = 409;
}

/** Build one atomic business transaction. Execution stays in DataRepository. */
export class MutationPlanner {
  constructor(private readonly db: D1Database, private readonly clock: () => string = nowIso) {}
releaseSubscriptionStatement(fullName: string, subscribed: boolean, expected: number | null) {
    const now = this.clock();
    return this.stmt(
      "INSERT INTO repositories (repository_id, full_name, github_repo_id, name, html_url, is_starred, release_subscribed, user_updated_at, user_revision, github_snapshot_json) SELECT ?1, ?2, NULL, ?3, ?4, 0, ?5, ?6, 1, '{}' WHERE ?7 < 0 OR ?7 = 0 OR EXISTS (SELECT 1 FROM repositories WHERE full_name = ?2 AND user_revision = ?7) ON CONFLICT(full_name) DO UPDATE SET release_subscribed = excluded.release_subscribed, user_updated_at = excluded.user_updated_at, user_revision = repositories.user_revision + 1 WHERE ?7 < 0 OR repositories.user_revision = ?7",
      crypto.randomUUID(), fullName, fullName.split("/").pop() || fullName, `https://github.com/${fullName}`, subscribed ? 1 : 0, now, expected ?? -1,
    );
  }

  private stmt(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values); }

private upsertCategoryStatement(category: Record<string, unknown>) {
    const now = this.clock();
    const id = String(category.id ?? category.categoryId ?? category.entityKey ?? "");
    if (!id) throw new MutationRequestError("Category ID 不能为空");
    return {
      id,
      statement: this.stmt(
        "INSERT INTO categories (category_id, name, name_key, color, sort_order, locked, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(category_id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key, color = excluded.color, sort_order = excluded.sort_order, locked = excluded.locked, updated_at = excluded.updated_at",
        id, String(category.name ?? "未分类"), categoryNameKey(category.name ?? "未分类"), typeof category.color === "string" ? category.color : null,
        Number(category.sortOrder ?? category.order ?? 0), category.locked ? 1 : 0, now,
      ),
    };
  }

private upsertRepositoryMetaStatement(fullName: string, payload: Record<string, unknown>, source: "user" | "ai") {
    const now = this.clock();
    const hasCategory = Object.prototype.hasOwnProperty.call(payload, "categoryId");
    const hasCategoryLocked = source === "user" && Object.prototype.hasOwnProperty.call(payload, "categoryLocked");
    const hasNote = source === "user" && Object.prototype.hasOwnProperty.call(payload, "note");
    const hasSummary = Object.prototype.hasOwnProperty.call(payload, "aiSummary");
    const hasTags = Array.isArray(payload.aiTags);
    if (source === "user") {
      const expected = expectedRevisionFor(payload, fullName);
      return {
        expected,
        statement: this.stmt(
          "INSERT INTO repositories (repository_id, full_name, github_repo_id, name, html_url, is_starred, category_id, category_locked, note, ai_summary, ai_tags_json, user_updated_at, user_revision, github_snapshot_json) SELECT ?1, ?2, NULL, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10, 1, '{}' WHERE ?16 < 0 OR ?16 = 0 OR EXISTS (SELECT 1 FROM repositories WHERE full_name = ?2 AND user_revision = ?16) ON CONFLICT(full_name) DO UPDATE SET category_id = CASE WHEN ?11 THEN excluded.category_id ELSE repositories.category_id END, category_locked = CASE WHEN ?12 THEN excluded.category_locked ELSE repositories.category_locked END, note = CASE WHEN ?13 THEN excluded.note ELSE repositories.note END, ai_summary = CASE WHEN ?14 THEN excluded.ai_summary ELSE repositories.ai_summary END, ai_tags_json = CASE WHEN ?15 THEN excluded.ai_tags_json ELSE repositories.ai_tags_json END, user_updated_at = excluded.user_updated_at, user_revision = repositories.user_revision + 1 WHERE ?16 < 0 OR repositories.user_revision = ?16",
          crypto.randomUUID(),
          fullName,
          fullName.split("/").pop() || fullName,
          `https://github.com/${fullName}`,
          typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null,
          payload.categoryLocked ? 1 : 0,
          typeof payload.note === "string" ? payload.note : null,
          typeof payload.aiSummary === "string" ? payload.aiSummary : null,
          encoded(strings(payload.aiTags)),
          now,
          hasCategory ? 1 : 0,
          hasCategoryLocked ? 1 : 0,
          hasNote ? 1 : 0,
          hasSummary ? 1 : 0,
          hasTags ? 1 : 0,
          expected ?? -1,
        ),
      };
    }

    const analysisMeta = payload.analysisMeta && typeof payload.analysisMeta === "object" ? payload.analysisMeta as Record<string, unknown> : {};
    const aiInputHash = typeof analysisMeta.inputHash === "string" ? analysisMeta.inputHash : null;
    const aiPromptVersion = typeof analysisMeta.promptVersion === "string" ? analysisMeta.promptVersion : null;
    const aiModelId = typeof analysisMeta.modelId === "string" ? analysisMeta.modelId : null;
    return {
      expected: null,
      statement: this.stmt(
        "INSERT INTO repositories (repository_id, full_name, github_repo_id, name, html_url, is_starred, category_id, ai_summary, ai_tags_json, ai_analyzed_at, ai_input_hash, ai_prompt_version, ai_model_id, github_snapshot_json) VALUES (?1, ?2, NULL, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11, '{}') ON CONFLICT(full_name) DO UPDATE SET category_id = CASE WHEN repositories.category_locked = 1 THEN repositories.category_id WHEN ?12 THEN excluded.category_id ELSE repositories.category_id END, ai_summary = CASE WHEN ?13 THEN excluded.ai_summary ELSE repositories.ai_summary END, ai_tags_json = CASE WHEN ?14 THEN excluded.ai_tags_json ELSE repositories.ai_tags_json END, ai_analyzed_at = excluded.ai_analyzed_at, ai_input_hash = excluded.ai_input_hash, ai_prompt_version = excluded.ai_prompt_version, ai_model_id = excluded.ai_model_id",
        crypto.randomUUID(),
        fullName,
        fullName.split("/").pop() || fullName,
        `https://github.com/${fullName}`,
        typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null,
        typeof payload.aiSummary === "string" ? payload.aiSummary : null,
        encoded(strings(payload.aiTags)),
        now,
        aiInputHash,
        aiPromptVersion,
        aiModelId,
        hasCategory ? 1 : 0,
        hasSummary ? 1 : 0,
        hasTags ? 1 : 0,
      ),
    };
  }

async plan(operation: string, payload: Record<string, unknown>, mutationId?: string) {
    if (!mutationOperations.has(operation as MutationOperation)) throw new MutationRequestError(`未知 mutation operation: ${operation}`);

    const typedOperation = operation as MutationOperation;
    const entityKey = typeof payload.entityKey === "string" ? payload.entityKey : typeof payload.fullName === "string" ? payload.fullName : typeof payload.id === "string" ? payload.id : crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    const changes: ChangeInput[] = [];
    const revisionGuards: RevisionGuard[] = [];
    const revisionResultNames: string[] = [];
    const pushGuarded = (statement: D1PreparedStatement, fullName: string, expected: number | null) => {
      const index = statements.length;
      statements.push(statement);
      if (expected !== null) revisionGuards.push({ index, fullName, expected, allowMissing: true });
    };
    let activity: ActivityInput | undefined;

    switch (typedOperation) {
      case "release.subscribe":
      case "release.unsubscribe": {
        const repoFullName = String(payload.repoFullName ?? entityKey);
        const expected = expectedRevisionFor(payload, repoFullName);
        pushGuarded(this.releaseSubscriptionStatement(repoFullName, typedOperation === "release.subscribe", expected), repoFullName, expected);
        changes.push({ entityType: "releaseSubscription", entityKey: repoFullName, operation: typedOperation === "release.subscribe" ? "upsert" : "tombstone" });
        break;
      }
      case "release.subscribe.batch": {
        const repoFullNames = Array.from(new Set(strings(payload.repoFullNames)));
        if (repoFullNames.length > 50) throw new MutationRequestError("单次批量 Release 订阅最多 50 个仓库");
        for (const fullName of repoFullNames) {
          const expected = expectedRevisionFor(payload, fullName);
          pushGuarded(this.releaseSubscriptionStatement(fullName, true, expected), fullName, expected);
        }
        changes.push({ entityType: "releaseSubscription", entityKey: "batch", operation: "batch_upsert" });
        break;
      }
      case "fork.save":
      case "fork.update": {
        const fullName = String(payload.fullName ?? entityKey);
        const parentFullName = typeof payload.parentFullName === "string" ? payload.parentFullName : null;
        const status = typeof payload.status === "string" ? payload.status : "unknown";
        const now = this.clock();
        const record = payload.payload && typeof payload.payload === "object" ? payload.payload as Record<string, unknown> : payload;
        const githubRepoId = realGithubRepoId(record.id ?? payload.githubRepoId);
        const githubPushedAt = typeof record.pushed_at === "string" ? record.pushed_at : typeof payload.githubPushedAt === "string" ? payload.githubPushedAt : null;
        statements.push(githubRepoId !== null
          ? this.stmt("INSERT INTO forks (fork_id, github_repo_id, full_name, parent_full_name, status, github_pushed_at, snapshot_at, checked_at, payload_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8) ON CONFLICT(github_repo_id) DO UPDATE SET full_name = excluded.full_name, parent_full_name = excluded.parent_full_name, status = excluded.status, github_pushed_at = excluded.github_pushed_at, snapshot_at = excluded.snapshot_at, checked_at = excluded.checked_at, payload_json = excluded.payload_json ON CONFLICT(full_name) DO UPDATE SET github_repo_id = COALESCE(excluded.github_repo_id, forks.github_repo_id), parent_full_name = excluded.parent_full_name, status = excluded.status, github_pushed_at = excluded.github_pushed_at, snapshot_at = excluded.snapshot_at, checked_at = excluded.checked_at, payload_json = excluded.payload_json", crypto.randomUUID(), githubRepoId, fullName, parentFullName, status, githubPushedAt, now, encoded(record))
          : this.stmt("INSERT INTO forks (fork_id, github_repo_id, full_name, parent_full_name, status, checked_at, payload_json) VALUES (?1, NULL, ?2, ?3, ?4, ?5, '{}') ON CONFLICT(full_name) DO UPDATE SET parent_full_name = COALESCE(excluded.parent_full_name, forks.parent_full_name), status = excluded.status, checked_at = excluded.checked_at", crypto.randomUUID(), fullName, parentFullName, status, now));
        changes.push({ entityType: "fork", entityKey: fullName, operation: status === "deleted" ? "tombstone" : "upsert" });
        break;
      }
      case "category.delete": {
        const id = String(payload.id ?? entityKey);
        const affected = await this.stmt("SELECT full_name FROM repositories WHERE category_id = ?1", id).all<{ full_name: string }>();
        revisionResultNames.push(...(affected.results ?? []).map((row) => row.full_name));
        statements.push(this.stmt("UPDATE repositories SET category_id = NULL, category_locked = 0, user_updated_at = ?1, user_revision = user_revision + 1 WHERE category_id = ?2", this.clock(), id));
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
        if (names.length > 50) throw new MutationRequestError("单次批量分类最多 50 个仓库");
        const categoryId = typeof payload.categoryId === "string" && payload.categoryId ? payload.categoryId : null;
        for (const fullName of names) {
          const scopedPayload = { categoryId, categoryLocked: Boolean(payload.categoryLocked ?? categoryId), expectedUserRevisions: payload.expectedUserRevisions };
          const result = this.upsertRepositoryMetaStatement(fullName, scopedPayload, "user");
          pushGuarded(result.statement, fullName, result.expected);
          changes.push({ entityType: "repositoryMeta", entityKey: fullName, operation: "update" });
        }
        break;
      }
      case "repository_meta.ai":
      case "repository_meta.update": {
        const category = payload.category && typeof payload.category === "object" ? payload.category as Record<string, unknown> : null;
        if (category) statements.push(this.upsertCategoryStatement(category).statement);
        const result = this.upsertRepositoryMetaStatement(entityKey, payload, typedOperation === "repository_meta.ai" ? "ai" : "user");
        pushGuarded(result.statement, entityKey, result.expected);
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
          statements.push(this.upsertRepositoryMetaStatement(fullName, record, "ai").statement);
          changes.push({ entityType: "repositoryMeta", entityKey: fullName, operation: "update" });
        }
        break;
      }
      case "unstar":
      case "star.unstar": {
        const fullName = String(payload.fullName ?? payload.repoFullName ?? entityKey);
        const expected = expectedRevisionFor(payload, fullName);
        const index = statements.length;
        statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, user_updated_at = ?1, user_revision = user_revision + 1 WHERE full_name = ?2 AND (?3 < 0 OR user_revision = ?3)", this.clock(), fullName, expected ?? -1));
        if (expected !== null) revisionGuards.push({ index, fullName, expected });
        changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        break;
      }
      case "star.unstarBatch": {
        const rawNames = Array.isArray(payload.repoFullNames) ? payload.repoFullNames : payload.repositories;
        const fullNames = Array.from(new Set(strings(rawNames)));
        for (const fullName of fullNames) {
          const expected = expectedRevisionFor(payload, fullName);
          const index = statements.length;
          statements.push(this.stmt("UPDATE repositories SET is_starred = 0, starred_at = NULL, user_updated_at = ?1, user_revision = user_revision + 1 WHERE full_name = ?2 AND (?3 < 0 OR user_revision = ?3)", this.clock(), fullName, expected ?? -1));
          if (expected !== null) revisionGuards.push({ index, fullName, expected });
          changes.push({ entityType: "repository", entityKey: fullName, operation: "tombstone" });
        }
        break;
      }
      default: {
        const exhaustive: never = typedOperation;
        throw new MutationRequestError(`未知 mutation operation: ${String(exhaustive)}`);
      }
    }

    return { statements, changes, activity, mutationId, revisionGuards, revisionResultNames };
  }
}
