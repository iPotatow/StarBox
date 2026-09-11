import { commitCanonicalMutation } from "./api";
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
    const canonical = await commitCanonicalMutation(optimistic, { id: mutation.id ?? crypto.randomUUID(), operation: mutation.operation, payload: mutation.payload, baseRevision: mutation.baseRevision });
    onStateChange(canonical);
    return canonical;
  } catch (error) {
    onStateChange(previous);
    throw error;
  }
}
