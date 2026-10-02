import { detectClient } from "./client-detection";
import type { ClientMetadata } from "../../shared/client-metadata";
export type SystemClientInfo = {
  client: ClientMetadata;
  architecture: string | null;
  model: string | null;
  language: string;
  timezone: string;
  screen: { width: number; height: number; scale: number };
  viewport: { width: number; height: number };
};
type HardwareHints = { architecture?: string; bitness?: string; model?: string; fullVersionList?: Array<{ brand: string; version: string }>; platformVersion?: string };
type SystemNavigator = Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<HardwareHints> } };
async function hardwareHints(nav: SystemNavigator): Promise<HardwareHints> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = nav.userAgentData?.getHighEntropyValues?.(["architecture", "bitness", "model"]);
    if (!operation) return {};
    return await Promise.race([operation.catch(() => ({})), new Promise<HardwareHints>((resolve) => { timer = setTimeout(() => resolve({}), 300); })]);
  } catch { return {}; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export function reportedArchitecture(architecture?: string, bitness?: string) {
  if (!architecture) return null;
  const family = architecture.toLowerCase();
  if (family === "arm") return bitness === "64" ? "arm64" : bitness === "32" ? "arm32" : "arm";
  if (family === "x86") return bitness === "64" ? "x64" : bitness === "32" ? "x86" : "x86 (bitness unknown)";
  return architecture.slice(0, 80);
}
export async function captureSystemClient(nav: SystemNavigator = navigator, view: Pick<Window, "screen" | "devicePixelRatio" | "innerWidth" | "innerHeight"> = window): Promise<SystemClientInfo> {
  const [client, hints] = await Promise.all([detectClient(nav), hardwareHints(nav)]);
  return {
    client,
    architecture: reportedArchitecture(hints.architecture, hints.bitness),
    model: hints.model?.trim().slice(0, 100) || null,
    language: nav.language || "Unknown",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    screen: { width: view.screen.width, height: view.screen.height, scale: view.devicePixelRatio || 1 },
    viewport: { width: view.innerWidth, height: view.innerHeight },
  };
}
