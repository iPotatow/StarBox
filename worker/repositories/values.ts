export const nowIso = () => new Date().toISOString();

export const encoded = (value: unknown) => JSON.stringify(value ?? {});

export const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const storedStrings = (value: unknown) => {
  if (Array.isArray(value)) return strings(value);
  if (typeof value !== "string" || !value.trim()) return [];
  try { return strings(JSON.parse(value)); } catch { return []; }
};

export const realGithubRepoId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const categoryNameKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const optionalRevision = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const expectedRevisionFor = (payload: Record<string, unknown>, fullName: string) => {
  const revisions = payload.expectedUserRevisions && typeof payload.expectedUserRevisions === "object"
    ? payload.expectedUserRevisions as Record<string, unknown>
    : {};
  return optionalRevision(revisions[fullName] ?? payload.expectedUserRevision);
};
