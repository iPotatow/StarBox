ALTER TABLE app_sessions ADD COLUMN device_id TEXT;
ALTER TABLE app_sessions ADD COLUMN device_name TEXT;
ALTER TABLE app_sessions ADD COLUMN device_type TEXT;
ALTER TABLE app_sessions ADD COLUMN os TEXT;
ALTER TABLE app_sessions ADD COLUMN browser TEXT;
ALTER TABLE app_sessions ADD COLUMN ip_address TEXT;
ALTER TABLE app_sessions ADD COLUMN country_code TEXT;
ALTER TABLE app_sessions ADD COLUMN region TEXT;
ALTER TABLE app_sessions ADD COLUMN city TEXT;
ALTER TABLE app_sessions ADD COLUMN user_agent TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_sessions_device_id
  ON app_sessions(account_id, device_id)
  WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_sessions_active
  ON app_sessions(account_id, revoked_at, expires_at, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS ai_services (
  service_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('openai-compatible', 'anthropic-messages', 'google-gemini')),
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_service_credentials (
  service_id TEXT PRIMARY KEY REFERENCES ai_services(service_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS ai_models (
  model_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES ai_services(service_id) ON DELETE CASCADE,
  remote_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (account_id, service_id, remote_model_id)
);

CREATE TABLE IF NOT EXISTS ai_task_bindings (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES ai_models(model_id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, task)
);

CREATE INDEX IF NOT EXISTS idx_ai_services_account
  ON ai_services(account_id, enabled, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_models_service
  ON ai_models(account_id, service_id, enabled, sort_order, created_at);

-- Preserve the existing single-provider configuration as the first service/model.
-- The encrypted legacy credential remains in ai_credentials and is read as a
-- compatibility fallback until the service is saved again through the new UI.
INSERT OR IGNORE INTO ai_services (
  service_id, account_id, name, protocol, base_url, enabled, config_json, created_at, updated_at
)
SELECT
  'legacy-default',
  'primary',
  CASE WHEN TRIM(ai_provider_name) = '' THEN 'AI Service' ELSE ai_provider_name END,
  'openai-compatible',
  ai_base_url,
  1,
  '{}',
  updated_at,
  updated_at
FROM app_preferences
WHERE account_id = 'primary'
  AND (TRIM(ai_base_url) <> '' OR TRIM(ai_model) <> '' OR EXISTS (SELECT 1 FROM ai_credentials WHERE account_id = 'primary'));

INSERT OR IGNORE INTO ai_models (
  model_id, account_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at
)
SELECT
  'legacy-default-model',
  'primary',
  'legacy-default',
  ai_model,
  ai_model,
  1,
  0,
  updated_at,
  updated_at
FROM app_preferences
WHERE account_id = 'primary' AND TRIM(ai_model) <> '';

INSERT OR IGNORE INTO ai_task_bindings (account_id, task, model_id, updated_at)
SELECT 'primary', 'default', 'legacy-default-model', updated_at
FROM app_preferences
WHERE account_id = 'primary' AND TRIM(ai_model) <> '';
