import { commitOptimisticMutation } from "./api";
import type { PersistedState } from "../types";

type StateChange = (state: PersistedState) => void;
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

function rollbackMutationBranches(current: PersistedState, previous: PersistedState, optimistic: PersistedState, operation: string) {
  const branches = branchesFor(operation);
  if (!branches.length) return current;
  let next = current;
  for (const branch of branches) {
    // Only roll back a branch if nothing else has replaced the optimistic
    // branch since this mutation started. Mutations touching the same branch
    // are serialized through the lane above.
    if (current[branch] !== optimistic[branch]) continue;
    if (next === current) next = { ...current };
    (next as unknown as Record<string, unknown>)[branch] = previous[branch];
  }
  return next;
}

function applyStateUpdate(onStateChange: StateChange, update: PersistedState | ((current: PersistedState) => PersistedState)) {
  // App currently passes React's setState through page props typed as a simple
  // callback. Keep the public prop surface unchanged while using the functional
  // updater form to make rollback concurrency-safe.
  (onStateChange as unknown as (value: PersistedState | ((current: PersistedState) => PersistedState)) => void)(update);
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
    onStateChange(optimistic);
    try {
      await options.perform?.();
      await commitOptimisticMutation({
        id: mutation.id ?? crypto.randomUUID(),
        operation: mutation.operation,
        payload: mutation.payload,
        baseRevision: mutation.baseRevision,
      });
      return optimistic;
    } catch (error) {
      applyStateUpdate(onStateChange, (current) => rollbackMutationBranches(current, previous, optimistic, mutation.operation));
      throw error;
    }
  });
}
