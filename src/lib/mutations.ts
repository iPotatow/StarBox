import { ApiError, apiSessionEpoch, commitOptimisticMutation, fetchBootstrap } from "./api";
import type { PersistedState, StateChange } from "../types";

type Branch = keyof Pick<PersistedState, "repositories" | "repositoryMeta" | "categories" | "releaseSubscriptions" | "forkJobs">;

const mutationLanes = new Map<string, Promise<void>>();
const acknowledgedRevisions = new Map<string, number>();
let revisionSession = -1;

function laneFor(operation: string) {
  if (operation.startsWith("repository_meta.") || operation.startsWith("category.")) return "metadata";
  if (operation.startsWith("release.")) return "metadata";
  if (operation.startsWith("fork.")) return "forks";
  if (operation === "unstar" || operation.startsWith("star.")) return "repositories";
  return operation;
}

function branchesFor(operation: string): Branch[] {
  if (operation.startsWith("repository_meta.")) return operation.includes("ai") ? ["repositoryMeta", "categories"] : ["repositoryMeta"];
  if (operation.startsWith("category.")) return ["categories", "repositoryMeta"];
  if (operation.startsWith("release.")) return ["releaseSubscriptions"];
  if (operation.startsWith("fork.")) return ["forkJobs"];
  if (operation === "unstar" || operation.startsWith("star.")) return ["repositories"];
  return [];
}

function equal(left: unknown, right: unknown): boolean {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function entityKey(value: unknown) {
  if (typeof value === "string") return value;
  if (isRecord(value)) return String(value.full_name ?? value.id ?? "");
  return "";
}

// Rebase only changed fields. Rollback compares optimistic values, leaving
// newer edits intact even when a request fails after unrelated work succeeds.
function patchValue(current: unknown, before: unknown, after: unknown, inverse: boolean): unknown {
  if (equal(before, after)) return current;
  if (isRecord(before) && isRecord(after) && isRecord(current)) {
    const result = { ...current };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const value = patchValue(current[key], before[key], after[key], inverse);
      if (value === undefined) delete result[key]; else result[key] = value;
    }
    return result;
  }
  if (inverse && !equal(current, before)) return current;
  return after;
}

export function applyMutationPatch(current: PersistedState, before: PersistedState, after: PersistedState, operation: string, inverse = false): PersistedState {
  const next = { ...current };
  for (const branch of branchesFor(operation)) {
    const oldValue = before[branch]; const newValue = after[branch];
    if (equal(oldValue, newValue)) continue;
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      const oldMap = Object.fromEntries(oldValue.map((item) => [entityKey(item), item]));
      const newMap = Object.fromEntries(newValue.map((item) => [entityKey(item), item]));
      const currentMap = Object.fromEntries((current[branch] as unknown[]).map((item) => [entityKey(item), item]));
      const merged = patchValue(currentMap, oldMap, newMap, inverse) as Record<string, unknown>;
      Object.assign(next, { [branch]: Object.values(merged) });
    } else Object.assign(next, { [branch]: patchValue(current[branch], oldValue, newValue, inverse) });
  }
  return next;
}

async function runInLane<T>(lane: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutationLanes.get(lane) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chain = previous.catch(() => undefined).then(() => current);
  mutationLanes.set(lane, chain);
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (mutationLanes.get(lane) === chain) mutationLanes.delete(lane);
  }
}

export async function runOptimisticMutation(
  previous: PersistedState,
  optimistic: PersistedState,
  onStateChange: StateChange,
  mutation: { id?: string; operation: string; payload: unknown; baseRevision?: string },
  options: { perform?: () => Promise<unknown>; rollbackOnConflict?: boolean } = {},
) {
  const session = apiSessionEpoch();
  if (revisionSession !== session) { acknowledgedRevisions.clear(); revisionSession = session; }
  const subscription = mutation.operation.startsWith("release.");
  return runInLane(laneFor(mutation.operation), async () => {
    if (session !== apiSessionEpoch()) throw new ApiError("登录会话已改变", 401, "session_changed");
    let appliedPrevious: PersistedState | undefined;
    let appliedOptimistic: PersistedState | undefined;
    onStateChange((current) => {
      appliedPrevious = current;
      appliedOptimistic = applyMutationPatch(current, previous, optimistic, mutation.operation);
      return appliedOptimistic;
    });
    try {
      await options.perform?.();
      let payload = mutation.payload;
      const withRevisions = (source: Record<string, unknown>, revisions: Record<string, number>) => {
        const next = { ...source };
        if (typeof source.repoFullName === "string" && revisions[source.repoFullName] !== undefined) next.expectedUserRevision = Math.max(Number(source.expectedUserRevision) || 0, revisions[source.repoFullName]);
        if (Array.isArray(source.repoFullNames)) next.expectedUserRevisions = Object.fromEntries(source.repoFullNames.map((name) => [String(name), Math.max(revisions[String(name)] ?? 0, Number(isRecord(source.expectedUserRevisions) ? source.expectedUserRevisions[String(name)] : 0) || 0)]));
        return next;
      };
      if (subscription && isRecord(payload)) payload = withRevisions(payload, Object.fromEntries(acknowledgedRevisions));
      const commit = () => commitOptimisticMutation({
        id: mutation.id ?? crypto.randomUUID(),
        operation: mutation.operation,
        payload,
        baseRevision: mutation.baseRevision,
      });
      let result: Awaited<ReturnType<typeof commitOptimisticMutation>>;
      try { result = await commit(); } catch (error) {
        if (!subscription || !(error instanceof ApiError) || error.status !== 409) throw error;
        // Subscription commands only change a boolean, so refresh their base and retry
        // once. Never refresh an editor draft's revision to bypass its conflict guard.
        const canonical = await fetchBootstrap();
        if (session !== apiSessionEpoch()) throw new ApiError("登录会话已改变", 401, "session_changed");
        if (!canonical.authoritative || !canonical.state || !isRecord(payload)) throw error;
        const remote = canonical.state;
        const names = typeof payload.repoFullName === "string" ? [payload.repoFullName] : Array.isArray(payload.repoFullNames) ? payload.repoFullNames.map(String) : [];
        const revisions = Object.fromEntries(names.map((name) => [name, remote.repositoryMeta[name]?.userRevision ?? 0]));
        payload = withRevisions(payload, revisions);
        if (appliedPrevious) {
          const subscriptions = new Set(appliedPrevious.releaseSubscriptions);
          for (const name of names) { if (remote.releaseSubscriptions.includes(name)) subscriptions.add(name); else subscriptions.delete(name); }
          appliedPrevious = { ...appliedPrevious, releaseSubscriptions: [...subscriptions] };
        }
        result = await commit();
      }
      if (session !== apiSessionEpoch()) throw new ApiError("登录会话已改变", 401, "session_changed");
      for (const [name, revision] of Object.entries(result.userRevisions ?? {})) acknowledgedRevisions.set(name, revision);
      if (result.userRevisions && Object.keys(result.userRevisions).length) {
        onStateChange((current) => {
          const repositoryMeta = { ...current.repositoryMeta };
          for (const [fullName, revision] of Object.entries(result.userRevisions!)) {
            repositoryMeta[fullName] = {
              ...(repositoryMeta[fullName] ?? { category: "", note: "", aiSummary: "", aiTags: [], aiPlatforms: [] }),
              userRevision: revision,
            };
          }
          return { ...current, repositoryMeta };
        });
      }
      return optimistic;
    } catch (error) {
      if (session === apiSessionEpoch() && (subscription || options.rollbackOnConflict || !(error instanceof ApiError && error.status === 409))) {
        onStateChange((current) => appliedPrevious && appliedOptimistic ? applyMutationPatch(current, appliedOptimistic, appliedPrevious, mutation.operation, true) : current);
      }
      throw error;
    }
  });
}
