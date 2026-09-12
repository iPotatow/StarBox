import { commitCanonicalMutation } from "./api.js";
export async function runOptimisticMutation(previous, optimistic, onStateChange, mutation, options = {}) {
    onStateChange(optimistic);
    try {
        await options.perform?.();
        const canonical = await commitCanonicalMutation(optimistic, { id: mutation.id ?? crypto.randomUUID(), operation: mutation.operation, payload: mutation.payload, baseRevision: mutation.baseRevision });
        onStateChange(canonical);
        return canonical;
    }
    catch (error) {
        onStateChange(previous);
        throw error;
    }
}
