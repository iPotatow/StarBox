import { ApiError, commitOptimisticMutation } from "./api";
import type { PersistedState, StateChange } from "../types";

type Branch = keyof Pick<PersistedState, "repositories" | "repositoryMeta" | "categories" | "releaseSubscriptions" | "forkJobs">;

const mutationLanes = new Map<string, Promise<void>>();

function laneFor(operation: string) {
  if (operation.startsWith("repository_meta.") || operation.startsWith("category.")) return "metadata";
  if (operation.startsWith("release.")) return "release-subscriptions";
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
  options: { perform?: () => Promise<unknown> } = {},
) {
  return runInLane(laneFor(mutation.operation), async () => {
    let appliedPrevious: PersistedState | undefined;
    let appliedOptimistic: PersistedState | undefined;
    onStateChange((current) => {
      appliedPrevious = current;
      appliedOptimistic = applyMutationPatch(current, previous, optimistic, mutation.operation);
      return appliedOptimistic;
    });
    try {
      await options.perform?.();
      const result = await commitOptimisticMutation({
        id: mutation.id ?? crypto.randomUUID(),
        operation: mutation.operation,
        payload: mutation.payload,
        baseRevision: mutation.baseRevision,
      });
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
      if (!(error instanceof ApiError && error.status === 409)) {
        onStateChange((current) => appliedPrevious && appliedOptimistic ? applyMutationPatch(current, appliedOptimistic, appliedPrevious, mutation.operation, true) : current);
      }
      throw error;
    }
  });
}
