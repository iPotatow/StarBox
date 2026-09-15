import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");

test("production auth is fail-closed and no default password remains", () => {
  const auth = source("worker/auth.ts");
  assert.doesNotMatch(auth, /000000/);
  assert.match(auth, /auth_not_configured/);
  assert.match(auth, /LOGIN_PASSWORD/);
});

test("all D1 credentials use one encryption secret", () => {
  const types = source("worker/types.ts");
  const v5 = source("worker/v5.ts");
  const ai = source("worker/ai-services.ts");
  assert.match(types, /STARBOX_ENCRYPTION_KEY\?: string/);
  for (const code of [types, v5, ai]) {
    assert.doesNotMatch(code, /GITHUB_TOKEN_ENCRYPTION_KEY/);
    assert.doesNotMatch(code, /STARBOX_CREDENTIAL_ENCRYPTION_KEY/);
    assert.doesNotMatch(code, /_PREVIOUS/);
  }
});

test("AI preferences and credentials use one atomic repository commit", () => {
  const v5 = source("worker/v5.ts");
  const ai = source("worker/ai-services.ts");
  const repository = source("worker/repository.ts");
  assert.match(v5, /saveAiConfigAtomic/);
  assert.match(repository, /async saveAiConfigAtomic/);
  assert.match(repository, /async saveAiServiceAtomic/);
  assert.match(ai, /saveAiServiceAtomic/);
  assert.doesNotMatch(repository, /for \(let i = 0; i < statements\.length; i \+= 50\)/);
});

test("deployment verifies login and encryption secrets", () => {
  const deploy = source("scripts/deploy.mjs");
  const verify = source("scripts/verify-deployment.mjs");
  assert.match(deploy, /LOGIN_PASSWORD/);
  assert.match(deploy, /STARBOX_ENCRYPTION_KEY/);
  assert.match(verify, /checks\?\.database/);
  assert.match(verify, /checks\?\.auth/);
  assert.match(verify, /checks\?\.encryption/);
});

test("cache writes are generation-fenced and logout is not faked locally", () => {
  const storage = source("src/lib/storage.ts");
  const app = source("src/app.tsx");
  assert.match(storage, /cacheGeneration/);
  assert.match(storage, /cacheQueue = cacheQueue/);
  assert.doesNotMatch(app, /local logout still clears the UI session/);
  assert.match(app, /Sign out failed/);
});

test("mobile navigation uses labeled bottom tabs", () => {
  const shell = source("src/components/app-shell.tsx");
  const settings = source("src/features/settings/settings-page.tsx");
  assert.match(shell, /mobile-tabbar/);
  assert.match(shell, /aria-current/);
  assert.match(settings, /Back to Settings/);
  assert.match(settings, /mobileSettingsItems/);
});

test("protected repository card and multi-select action surfaces remain present", () => {
  const page = source("src/features/repositories/repositories-page.tsx");
  assert.match(page, /<RepositoryCard/);
  assert.match(page, /selected\.size \? <div className="pointer-events-none fixed/);
  assert.match(page, /AI analysis/);
  assert.match(page, /Unstar/);
});


test("encryption secret accepts any non-empty value via SHA-256 derivation", () => {
  const crypto = source("worker/crypto.ts");
  assert.match(crypto, /subtle\.digest\("SHA-256"/);
  assert.match(crypto, /Boolean\(secret\.trim\(\)\)/);
  assert.doesNotMatch(crypto, /必须是 32 字节/);
});
