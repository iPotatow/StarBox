import { CODEX_DESKTOP_FEED, desktopPreset, latestDesktopVersion, type CodexDesktopPreset } from "../../shared/codex-desktop.js";
import { fetchBounded } from "../outbound.js";
import { AppError } from "../errors.js";

const FRESH_MS = 5 * 60 * 1000;
let cached: CodexDesktopPreset | null = null;
let pending: Promise<CodexDesktopPreset> | null = null;

async function readCache(): Promise<CodexDesktopPreset | null> {
  if (cached) return cached;
  try {
    if (typeof caches === "undefined") return null;
    const response = await (await caches.open("starbox-codex-desktop")).match(CODEX_DESKTOP_FEED);
    if (!response) return null;
    const value = await response.json() as CodexDesktopPreset;
    if (!/^\d+\.\d+\.\d+$/.test(value.version) || !Number.isFinite(Date.parse(value.checkedAt))) return null;
    cached = desktopPreset(value.version, value.checkedAt);
  } catch { /* Memory cache and upstream remain available when the edge cache fails. */ }
  return cached;
}

async function refresh(): Promise<CodexDesktopPreset> {
  const response = await fetchBounded(CODEX_DESKTOP_FEED, { headers: { Accept: "application/rss+xml, application/xml" }, redirect: "error", cache: "no-store" }, { timeoutMs: 8000, maxBytes: 1024 * 1024 });
  if (!response.ok) throw new Error(`官方版本查询失败 (${response.status})`);
  const value = desktopPreset(latestDesktopVersion(await response.text()), new Date().toISOString());
  cached = value;
  try {
    if (typeof caches !== "undefined") await (await caches.open("starbox-codex-desktop")).put(CODEX_DESKTOP_FEED, new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" } }));
  } catch { /* A cache write failure does not invalidate the verified upstream version. */ }
  return value;
}

export async function latestCodexDesktop(savedUserAgent?: string): Promise<CodexDesktopPreset> {
  const previous = await readCache();
  if (previous && Date.now() - Date.parse(previous.checkedAt) < FRESH_MS) return previous;
  pending ??= refresh().finally(() => { pending = null; });
  try { return await pending; }
  catch {
    if (previous) return { ...previous, stale: true };
    const version = savedUserAgent?.match(/^Codex Desktop\/(\d+\.\d+\.\d+) \(Mac OS; arm64\)$/)?.[1];
    if (version) return desktopPreset(version, "", true);
    throw new AppError("codex_version_unavailable", "暂时无法获取 Codex Desktop 官方版本，请稍后重试", 503);
  }
}
