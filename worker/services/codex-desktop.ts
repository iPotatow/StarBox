import { desktopPreset, type CodexDesktopPreset } from "../../shared/codex-desktop.js";

/**
 * Returns the fixed Codex Desktop compatibility preset.
 *
 * The legacy function name is retained for call-site compatibility, but this
 * no longer performs any version lookup or outbound request.
 */
export async function latestCodexDesktop(_savedUserAgent?: string): Promise<CodexDesktopPreset> {
  return desktopPreset();
}
