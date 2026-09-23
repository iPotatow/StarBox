-- Canonical StarBox D1 schema.
-- D1 enforces foreign keys by default; do not emit PRAGMA foreign_keys in import files.
-- This file is used only for an empty database. The production model is exactly
-- eight product tables; historical migration state is intentionally not encoded here.

CREATE TABLE categories (
  category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_services (
  service_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('openai-compatible', 'anthropic-messages', 'google-gemini')),
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_models (
  model_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  remote_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (service_id, remote_model_id),
  FOREIGN KEY (service_id) REFERENCES ai_services(service_id) ON DELETE CASCADE
);

CREATE TABLE credentials (
  credential_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('github', 'ai')),
  owner_id TEXT,
  service_id TEXT,
  label TEXT,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (service_id) REFERENCES ai_services(service_id) ON DELETE CASCADE,
  CHECK (
    (kind = 'github' AND service_id IS NULL)
    OR
    (kind = 'ai' AND (credential_id = 'ai:legacy' OR service_id IS NOT NULL))
  )
);

CREATE TABLE repositories (
  repository_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  github_repo_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  html_url TEXT NOT NULL,
  description TEXT,
  language TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_starred INTEGER NOT NULL DEFAULT 0 CHECK (is_starred IN (0, 1)),
  starred_at TEXT,
  category_id TEXT,
  category_locked INTEGER NOT NULL DEFAULT 0 CHECK (category_locked IN (0, 1)),
  note TEXT,
  ai_summary TEXT,
  ai_tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ai_tags_json) AND json_type(ai_tags_json) = 'array'),
  platforms_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(platforms_json) AND json_type(platforms_json) = 'array'),
  release_subscribed INTEGER NOT NULL DEFAULT 0 CHECK (release_subscribed IN (0, 1)),
  release_ai_release_id INTEGER,
  release_ai_tag TEXT,
  release_ai_summary_json TEXT CHECK (release_ai_summary_json IS NULL OR (json_valid(release_ai_summary_json) AND json_type(release_ai_summary_json) = 'object')),
  release_ai_model_id TEXT,
  release_ai_generated_at TEXT,
  github_updated_at TEXT,
  github_pushed_at TEXT,
  synced_at TEXT,
  user_updated_at TEXT,
  user_revision INTEGER NOT NULL DEFAULT 0 CHECK (user_revision >= 0),
  ai_analyzed_at TEXT,
  ai_input_hash TEXT,
  ai_prompt_version TEXT,
  ai_model_id TEXT,
  platform_checked_at TEXT,
  platform_rule_version TEXT,
  platform_check_state TEXT NOT NULL DEFAULT 'never' CHECK (platform_check_state IN ('never', 'success', 'error')),
  github_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(github_snapshot_json) AND json_type(github_snapshot_json) = 'object'),
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

CREATE TABLE forks (
  fork_id TEXT PRIMARY KEY,
  github_repo_id INTEGER UNIQUE,
  full_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  parent_full_name TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'pending', 'ready', 'failed', 'deleted')),
  github_pushed_at TEXT,
  snapshot_at TEXT,
  checked_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object')
);

CREATE TABLE app_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  device_id TEXT,
  device_name TEXT,
  device_type TEXT,
  os TEXT,
  browser TEXT,
  ip_address TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  user_agent TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_repositories_starred_at
  ON repositories(is_starred, starred_at DESC);
CREATE INDEX idx_repositories_category_user
  ON repositories(category_id, user_updated_at DESC);
CREATE INDEX idx_repositories_release_subscription
  ON repositories(release_subscribed, platform_checked_at DESC);
CREATE INDEX idx_ai_models_service_order
  ON ai_models(service_id, sort_order, created_at);
CREATE INDEX idx_credentials_service
  ON credentials(service_id);
CREATE INDEX idx_forks_status_checked
  ON forks(status, checked_at DESC);
CREATE UNIQUE INDEX idx_app_sessions_device_id
  ON app_sessions(device_id)
  WHERE device_id IS NOT NULL;
CREATE INDEX idx_app_sessions_active
  ON app_sessions(revoked_at, expires_at, last_seen_at DESC);

CREATE TRIGGER prune_expired_sessions_after_insert
AFTER INSERT ON app_sessions
BEGIN
  DELETE FROM app_sessions
  WHERE julianday(expires_at) < julianday('now', '-7 days')
     OR (revoked_at IS NOT NULL AND julianday(revoked_at) < julianday('now', '-7 days'));
END;
