import { commitOptimisticMutation } from "./api";
import type { PersistedState } from "../types";

export async function runOptimisticMutation(
  previous: PersistedState,
  optimistic: PersistedState,
  onStateChange: (state: PersistedState) => void,
  mutation: { id?: string; operation: string; payload: unknown; baseRevision?: string },
  options: { perform?: () => Promise<unknown> } = {},
) {
  onStateChange(optimistic);
  try {
    await options.perform?.();
    await commitOptimisticMutation({ id: mutation.id ?? crypto.randomUUID(), operation: mutation.operation, payload: mutation.payload, baseRevision: mutation.baseRevision });
    return optimistic;
  } catch (error) {
    onStateChange(previous);
    throw error;
  }
}
