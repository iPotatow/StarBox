export type BuildIdentity = { version: string; buildId: string };
export type BuildInfo = BuildIdentity & { builtAt: string; source: "github-actions" | "local" };
export type SystemInfo = {
  build: BuildInfo | null;
  worker: { versionId: string | null; tag: string | null; createdAt: string | null };
  database: { backend: "D1" | null; status: "ready" | "incomplete" | "unavailable" | "unconfigured"; schemaFingerprint: string | null; tableCount: number | null };
  checks: { auth: boolean; encryption: boolean };
  retrievedAt: string;
};
export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(data.version) || typeof data.buildId !== "string" || !/^[a-f0-9]{16,64}$/.test(data.buildId) || typeof data.builtAt !== "string" || !Number.isFinite(Date.parse(data.builtAt)) || !["github-actions", "local"].includes(String(data.source))) return null;
  return { version: data.version, buildId: data.buildId, builtAt: data.builtAt, source: data.source as BuildInfo["source"] };
}
export function sameBuild(left: BuildIdentity, right: BuildIdentity) { return left.version === right.version && left.buildId === right.buildId; }
