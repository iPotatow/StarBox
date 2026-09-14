import type { GithubCredentialRecord } from "./types.js";
const encoder = new TextEncoder();
function b64(value: Uint8Array) { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function decode(value: string) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="); const binary = atob(normalized); const out = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i); return out; }
function keyBytes(value: string) { const trimmed = value.trim(); if (/^[0-9a-f]{64}$/i.test(trimmed)) { const out = new Uint8Array(32); for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16); return out; } try { const decoded = decode(trimmed); if (decoded.length === 32) return decoded; } catch { /* raw fallback */ } const raw = encoder.encode(trimmed); if (raw.length === 32) return raw; throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY 必须是 32 字节 AES-256 密钥"); }
async function importKey(secret: string) { return crypto.subtle.importKey("raw", keyBytes(secret), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); }
export function credentialAad(accountId: string, githubUserId: string, keyVersion: string) { return encoder.encode(`starbox:v1|account_id=${accountId}|github_user_id=${githubUserId}|key_version=${keyVersion}`); }
export async function fingerprintToken(token: string) { return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token)))).slice(0, 22); }
export async function encryptGithubToken(token: string, secret: string, accountId: string, githubUserId: string, keyVersion = "v1") { const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: credentialAad(accountId, githubUserId, keyVersion) }, await importKey(secret), encoder.encode(token)); return { ciphertext: b64(new Uint8Array(ciphertext)), iv: b64(iv), keyVersion, fingerprint: await fingerprintToken(token) }; }
export async function decryptGithubToken(record: GithubCredentialRecord, secret: string) { const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(record.iv), additionalData: credentialAad(record.account_id, record.github_numeric_id, record.key_version) }, await importKey(secret), decode(record.ciphertext)); return new TextDecoder().decode(plaintext); }

export function aiCredentialAad(accountId: string, keyVersion: string) { return encoder.encode(`starbox:v1|account_id=${accountId}|purpose=ai_credentials|key_version=${keyVersion}`); }
export async function fingerprintSecret(value: string) { return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))).slice(0, 22); }
export async function encryptAiCredentials(value: string, secret: string, accountId: string, keyVersion = "v1") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aiCredentialAad(accountId, keyVersion) }, await importKey(secret), encoder.encode(value));
  return { ciphertext: b64(new Uint8Array(ciphertext)), iv: b64(iv), keyVersion, fingerprint: await fingerprintSecret(value) };
}
export async function decryptAiCredentials(record: { account_id: string; ciphertext: string; iv: string; key_version: string }, secret: string) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(record.iv), additionalData: aiCredentialAad(record.account_id, record.key_version) }, await importKey(secret), decode(record.ciphertext));
  return new TextDecoder().decode(plaintext);
}

export function aiServiceCredentialAad(accountId: string, serviceId: string, keyVersion: string) { return encoder.encode(`starbox:v1|account_id=${accountId}|purpose=ai_service_credentials|service_id=${serviceId}|key_version=${keyVersion}`); }
export async function encryptAiServiceCredentials(value: string, secret: string, accountId: string, serviceId: string, keyVersion = "v1") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aiServiceCredentialAad(accountId, serviceId, keyVersion) }, await importKey(secret), encoder.encode(value));
  return { ciphertext: b64(new Uint8Array(ciphertext)), iv: b64(iv), keyVersion, fingerprint: await fingerprintSecret(value) };
}
export async function decryptAiServiceCredentials(record: { account_id: string; service_id: string; ciphertext: string; iv: string; key_version: string }, secret: string) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(record.iv), additionalData: aiServiceCredentialAad(record.account_id, record.service_id, record.key_version) }, await importKey(secret), decode(record.ciphertext));
  return new TextDecoder().decode(plaintext);
}
