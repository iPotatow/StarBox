import { parseClientMetadata, type ClientMetadata } from "../../shared/client-metadata";

type ClientNavigator = Pick<Navigator, "userAgent" | "maxTouchPoints"> & {
  brave?: { isBrave?: () => Promise<boolean> };
  userAgentData?: { brands?: Array<{ brand: string; version: string }>; mobile?: boolean; platform?: string; getHighEntropyValues?: (hints: string[]) => Promise<{ fullVersionList?: Array<{ brand: string; version: string }>; platformVersion?: string }> };
};

async function bounded<T>(operation: Promise<T>, fallback: T) {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([operation.catch(() => fallback), new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), 300); })]); }
  finally { clearTimeout(timer!); }
}

export async function detectClient(nav: ClientNavigator = navigator): Promise<ClientMetadata> {
  let brands = nav.userAgentData?.brands;
  let platformVersion: string | undefined;
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const hints = await bounded(nav.userAgentData.getHighEntropyValues(["fullVersionList", "platformVersion"]), {});
      brands = hints.fullVersionList || brands;
      platformVersion = hints.platformVersion;
    }
  } catch { /* UA-only detection remains available. */ }
  const metadata = parseClientMetadata(nav.userAgent, { brands, platformVersion, platform: nav.userAgentData?.platform, mobile: nav.userAgentData?.mobile });
  try {
    if (nav.brave?.isBrave && await bounded(nav.brave.isBrave(), false)) {
      metadata.browserName = "Brave";
      metadata.browserVersion = brands?.find((brand) => brand.brand === "Brave")?.version || null;
    }
  } catch { /* Runtime detection must never block sign-in. */ }
  if (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1) { metadata.osName = "iOS"; metadata.osVersion = null; metadata.deviceType = "tablet"; }
  return metadata;
}
