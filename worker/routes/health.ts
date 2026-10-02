import { json } from "../http.js";
import type { StarBoxEnv } from "../types.js";
import { validateEncryptionKey } from "../crypto.js";

export async function handleHealth(env?: StarBoxEnv) {
  if (!env) return json({ ok: true });
  let database = false;
  if (env.DB) {
    try { const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'repositories' LIMIT 1").first<{ name: string }>(); database = row?.name === "repositories"; } catch { database = false; }
  }
  const auth = Boolean(env.LOGIN_PASSWORD?.trim());
  const encryption = Boolean(env.STARBOX_ENCRYPTION_KEY?.trim()) && validateEncryptionKey(env.STARBOX_ENCRYPTION_KEY!);
  const ok = database && auth && encryption;
  return json({ ok, checks: { database, auth, encryption } }, { status: ok ? 200 : 503 });
}
