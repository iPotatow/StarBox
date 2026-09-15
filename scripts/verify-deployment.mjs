import process from "node:process";

const raw = process.env.STARBOX_DEPLOYMENT_URL?.trim() || "";
if (!raw) {
  console.log("[skip] live Worker health: set STARBOX_DEPLOYMENT_URL to verify the deployed custom domain.");
  process.exit(0);
}

let base;
try {
  base = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
} catch {
  console.error("STARBOX_DEPLOYMENT_URL is invalid.");
  process.exit(1);
}
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
  console.error("STARBOX_DEPLOYMENT_URL must use HTTP(S) without embedded credentials.");
  process.exit(1);
}

const healthUrl = new URL('/api/health', base).toString();
let lastError = null;
for (let attempt = 1; attempt <= 4; attempt += 1) {
  try {
    const response = await fetch(healthUrl, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.ok === true && body?.checks?.database && body?.checks?.auth && body?.checks?.encryption) {
      console.log(`[ok] deployed Worker health: ${healthUrl}`);
      process.exit(0);
    }
    lastError = new Error(`health returned ${response.status}: ${JSON.stringify(body)}`);
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }
  if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error(`[fail] deployed Worker health: ${lastError?.message || 'unknown error'}`);
process.exit(1);
