export type CodexDesktopPreset = {
  version: string;
  headers: Record<string, string>;
  checkedAt: string;
  stale: boolean;
};

export const CODEX_DESKTOP_FEED = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";

export function desktopPreset(version: string, checkedAt: string, stale = false): CodexDesktopPreset {
  return { version, checkedAt, stale, headers: { originator: "Codex Desktop", "User-Agent": `Codex Desktop/${version} (Mac OS; arm64)` } };
}

export function latestDesktopVersion(xml: string): string {
  const versions = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)).flatMap((match) => {
    const item = match[1];
    if (/<sparkle:channel\b/.test(item) || !/<sparkle:hardwareRequirements>\s*arm64\s*<\/sparkle:hardwareRequirements>/.test(item)) return [];
    const version = item.match(/<sparkle:shortVersionString>\s*(\d+\.\d+\.\d+)\s*<\/sparkle:shortVersionString>/)?.[1];
    return version ? [version] : [];
  });
  versions.sort((a, b) => {
    const left = a.split(".").map(Number), right = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return right[i] - left[i];
    return 0;
  });
  if (!versions.length) throw new Error("官方更新源未提供有效的 macOS ARM64 稳定版本");
  return versions[0];
}
