import Bowser from "bowser";

export interface ClientMetadata {
  browserName: string;
  browserVersion: string | null;
  osName: string;
  osVersion: string | null;
  engineName: string | null;
  deviceType: "desktop" | "mobile" | "tablet";
}

export function parseClientMetadata(userAgent: string, hints?: Bowser.ClientHints): ClientMetadata {
  const result = Bowser.parse(userAgent.trim().slice(0, 1000) || "Unknown", hints);
  const rawOs = result.os?.name || "Unknown";
  const osName = rawOs === "macOS" || rawOs === "Mac OS X" ? "macOS" : rawOs;
  const type = result.platform?.type;
  return {
    browserName: result.browser?.name || "Browser",
    browserVersion: result.browser?.version || null,
    osName,
    // Frozen macOS UAs report 10.15.7 for modern systems. Do not invent an OS version.
    osVersion: osName === "macOS" && result.os?.version === "10.15.7" ? null : result.os?.version || null,
    engineName: result.engine?.name || null,
    deviceType: type === "mobile" || type === "tablet" ? type : "desktop",
  };
}

export function normalizeClientMetadata(value: unknown, fallback: ClientMetadata): ClientMetadata {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (key: keyof ClientMetadata, previous: string | null) => typeof source[key] === "string" ? String(source[key]).trim().slice(0, 80) || previous : source[key] === null ? null : previous;
  return {
    browserName: text("browserName", fallback.browserName) || "Browser",
    browserVersion: text("browserVersion", fallback.browserVersion),
    osName: text("osName", fallback.osName) || "Unknown",
    osVersion: text("osVersion", fallback.osVersion),
    engineName: text("engineName", fallback.engineName),
    deviceType: ["desktop", "mobile", "tablet"].includes(String(source.deviceType)) ? source.deviceType as ClientMetadata["deviceType"] : fallback.deviceType,
  };
}

export function splitVersionLabel(label: string | null, fallback: string) {
  const match = (label || "").match(/^(.*?) \[(.*?)\]$/);
  return { name: match?.[1] || label || fallback, version: match?.[2] || null };
}
export function versionLabel(name: string, version: string | null) { return version ? `${name} [${version}]` : name; }
