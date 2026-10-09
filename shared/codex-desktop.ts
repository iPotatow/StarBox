export type CodexDesktopPreset = {
  headers: Record<string, string>;
  stale: boolean;
};

export function desktopPreset(): CodexDesktopPreset {
  return { stale: false, headers: { originator: "Codex Desktop" } };
}
