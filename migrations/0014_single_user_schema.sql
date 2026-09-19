PRAGMA foreign_keys = OFF;

-- StarBox is a single-user application. Consolidate the old pseudo-multi-tenant
-- schema into nine product-focused tables and migrate all user-visible data.

CREATE TABLE repositories_next (
  full_name TEXT PRIMARY KEY,
  github_repo_id TEXT NOT NULL,
  name TEXT NOT NULL,
  html_url TEXT NOT NULL,
  description TEXT,
  language TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_starred INTEGER NOT NULL DEFAULT 0,
  starred_at TEXT,
  category_id TEXT,
  note TEXT,
  ai_summary TEXT,
  ai_tags_json TEXT NOT NULL DEFAULT '[]',
  ai_platforms_json TEXT NOT NULL DEFAULT '[]',
  release_subscribed INTEGER NOT NULL DEFAULT 0,
  release_cursor TEXT,
  release_last_synced_at TEXT,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO repositories_next (
  full_name, github_repo_id, name, html_url, description, language, default_branch,
  is_starred, starred_at, category_id, note, ai_summary, ai_tags_json, ai_platforms_json,
  release_subscribed, release_cursor, release_last_synced_at, updated_at, raw_json
)
SELECT
  r.full_name,
  r.github_repo_id,
  r.name,
  r.html_url,
  r.description,
  r.language,
  r.default_branch,
  r.is_starred,
  r.starred_at,
  (SELECT m.category_id FROM repository_meta m WHERE m.github_repo_id IN (r.full_name, r.github_repo_id) LIMIT 1),
  (SELECT m.note FROM repository_meta m WHERE m.github_repo_id IN (r.full_name, r.github_repo_id) LIMIT 1),
  (SELECT m.ai_summary FROM repository_meta m WHERE m.github_repo_id IN (r.full_name, r.github_repo_id) LIMIT 1),
  COALESCE((SELECT m.ai_tags_json FROM repository_meta m WHERE m.github_repo_id IN (r.full_name, r.github_repo_id) LIMIT 1), '[]'),
  COALESCE((SELECT m.ai_platforms_json FROM repository_meta m WHERE m.github_repo_id IN (r.full_name, r.github_repo_id) LIMIT 1), '[]'),
  CASE WHEN EXISTS (SELECT 1 FROM release_subscriptions s WHERE s.repo_full_name = r.full_name) THEN 1 ELSE 0 END,
  (SELECT s.cursor FROM release_sync_state s WHERE s.repo_full_name = r.full_name LIMIT 1),
  (SELECT s.last_synced_at FROM release_sync_state s WHERE s.repo_full_name = r.full_name LIMIT 1),
  r.updated_at,
  r.raw_json
FROM repositories r
WHERE r.account_id = 'primary';

INSERT OR IGNORE INTO repositories_next (
  full_name, github_repo_id, name, html_url, is_starred, category_id, note,
  ai_summary, ai_tags_json, ai_platforms_json, updated_at, raw_json
)
SELECT
  m.github_repo_id,
  m.github_repo_id,
  substr(m.github_repo_id, instr(m.github_repo_id, '/') + 1),
  'https://github.com/' || m.github_repo_id,
  0,
  m.category_id,
  m.note,
  m.ai_summary,
  COALESCE(m.ai_tags_json, '[]'),
  COALESCE(m.ai_platforms_json, '[]'),
  m.updated_at,
  '{}'
FROM repository_meta m
WHERE m.account_id = 'primary' AND instr(m.github_repo_id, '/') > 0;

INSERT OR IGNORE INTO repositories_next (
  full_name, github_repo_id, name, html_url, is_starred, release_subscribed, updated_at, raw_json
)
SELECT
  s.repo_full_name,
  s.repo_full_name,
  substr(s.repo_full_name, instr(s.repo_full_name, '/') + 1),
  'https://github.com/' || s.repo_full_name,
  0,
  1,
  s.created_at,
  '{}'
FROM release_subscriptions s
WHERE s.account_id = 'primary';

UPDATE repositories_next
SET release_subscribed = 1
WHERE full_name IN (SELECT repo_full_name FROM release_subscriptions WHERE account_id = 'primary');

INSERT OR IGNORE INTO repositories_next (
  full_name, github_repo_id, name, html_url, is_starred,
  release_cursor, release_last_synced_at, updated_at, raw_json
)
SELECT
  s.repo_full_name,
  s.repo_full_name,
  substr(s.repo_full_name, instr(s.repo_full_name, '/') + 1),
  'https://github.com/' || s.repo_full_name,
  0,
  s.cursor,
  s.last_synced_at,
  s.updated_at,
  '{}'
FROM release_sync_state s
WHERE s.account_id = 'primary';

UPDATE repositories_next
SET
  release_cursor = COALESCE((SELECT s.cursor FROM release_sync_state s WHERE s.repo_full_name = repositories_next.full_name LIMIT 1), release_cursor),
  release_last_synced_at = COALESCE((SELECT s.last_synced_at FROM release_sync_state s WHERE s.repo_full_name = repositories_next.full_name LIMIT 1), release_last_synced_at)
WHERE full_name IN (SELECT repo_full_name FROM release_sync_state WHERE account_id = 'primary');

CREATE TABLE categories_next (
  category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO categories_next
SELECT category_id, name, color, sort_order, locked, created_at, updated_at
FROM categories
WHERE account_id = 'primary';

CREATE TABLE releases_next (
  release_id TEXT PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  ai_summary_json TEXT
);
INSERT INTO releases_next
SELECT release_id, repo_full_name, tag_name, payload_json, published_at, created_at, ai_summary_json
FROM releases
WHERE account_id = 'primary';

CREATE TABLE forks_next (
  full_name TEXT PRIMARY KEY,
  parent_full_name TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO forks_next
SELECT full_name, parent_full_name, status, updated_at, payload_json
FROM forks
WHERE account_id = 'primary';

CREATE TABLE app_sessions_next (
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
INSERT INTO app_sessions_next
SELECT token_hash, created_at, expires_at, last_seen_at, revoked_at,
       device_id, device_name, device_type, os, browser, ip_address,
       country_code, region, city, user_agent
FROM app_sessions
WHERE account_id = 'primary';

CREATE TABLE credentials (
  credential_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  owner_id TEXT,
  label TEXT,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
INSERT INTO credentials
SELECT 'github', 'github', github_numeric_id, github_login, ciphertext, iv, key_version,
       fingerprint, validated_at, created_at, updated_at, status
FROM github_credentials
WHERE account_id = 'primary';

INSERT OR IGNORE INTO credentials
SELECT 'ai:legacy', 'ai', 'legacy-default', NULL, ciphertext, iv, key_version,
       fingerprint, NULL, created_at, updated_at, status
FROM ai_credentials
WHERE account_id = 'primary';

INSERT OR REPLACE INTO credentials
SELECT 'ai:' || service_id, 'ai', service_id, NULL, ciphertext, iv, key_version,
       fingerprint, NULL, created_at, updated_at, status
FROM ai_service_credentials
WHERE account_id = 'primary';

CREATE TABLE ai_services_next (
  service_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('openai-compatible', 'anthropic-messages', 'google-gemini')),
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO ai_services_next
SELECT service_id, name, protocol, base_url, enabled, config_json, created_at, updated_at
FROM ai_services
WHERE account_id = 'primary';

CREATE TABLE ai_models_next (
  model_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  remote_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (service_id, remote_model_id)
);
INSERT INTO ai_models_next
SELECT model_id, service_id, remote_model_id, display_name, enabled, sort_order, created_at, updated_at
FROM ai_models
WHERE account_id = 'primary';

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO settings SELECT 'ai.provider_name', ai_provider_name, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ai.base_url', ai_base_url, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ai.model', ai_model, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ai.default_model_id', model_id, updated_at FROM ai_task_bindings WHERE account_id = 'primary' AND task = 'default';
INSERT INTO settings SELECT 'release.sync_pages', CAST(release_sync_pages AS TEXT), updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'release.asset_include_pattern', release_asset_include_pattern, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'release.asset_exclude_pattern', release_asset_exclude_pattern, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'release.asset_rules_json', release_asset_rules_json, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'release.include_prereleases', CAST(release_include_prereleases AS TEXT), updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ui.theme', ui_theme, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ui.accent', ui_accent, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ui.language', ui_language, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'ui.hidden_nav_json', hidden_nav_json, updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings SELECT 'github.avatar_url', COALESCE(github_avatar_url, ''), updated_at FROM app_preferences WHERE account_id = 'primary';
INSERT INTO settings
SELECT 'github.bound_user_id', COALESCE(NULLIF(a.github_user_id, ''), (SELECT g.github_numeric_id FROM github_credentials g WHERE g.account_id = 'primary' LIMIT 1), ''), a.updated_at
FROM app_account a WHERE a.account_id = 'primary';
INSERT INTO settings
SELECT 'github.bound_login', COALESCE(NULLIF(a.github_login, ''), (SELECT g.github_login FROM github_credentials g WHERE g.account_id = 'primary' LIMIT 1), ''), a.updated_at
FROM app_account a WHERE a.account_id = 'primary';

DROP TABLE IF EXISTS fork_snapshots;
DROP TABLE IF EXISTS fork_events;
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS sync_changes;
DROP TABLE IF EXISTS processed_mutations;
DROP TABLE IF EXISTS login_rate_limits;
DROP TABLE IF EXISTS release_subscriptions;
DROP TABLE IF EXISTS release_sync_state;
DROP TABLE IF EXISTS repository_meta;
DROP TABLE IF EXISTS ai_task_bindings;
DROP TABLE IF EXISTS ai_service_credentials;
DROP TABLE IF EXISTS ai_credentials;
DROP TABLE IF EXISTS github_credentials;
DROP TABLE IF EXISTS app_preferences;

-- Drop every legacy child table before app_account. This remains safe even if a
-- migration runner wraps the file in a transaction where PRAGMA foreign_keys
-- cannot be toggled.
DROP TABLE repositories;
DROP TABLE categories;
DROP TABLE releases;
DROP TABLE forks;
DROP TABLE app_sessions;
DROP TABLE ai_models;
DROP TABLE ai_services;
DROP TABLE IF EXISTS app_account;

ALTER TABLE repositories_next RENAME TO repositories;
ALTER TABLE categories_next RENAME TO categories;
ALTER TABLE releases_next RENAME TO releases;
ALTER TABLE forks_next RENAME TO forks;
ALTER TABLE app_sessions_next RENAME TO app_sessions;
ALTER TABLE ai_services_next RENAME TO ai_services;
ALTER TABLE ai_models_next RENAME TO ai_models;

CREATE INDEX idx_repositories_starred_updated ON repositories(is_starred, updated_at DESC);
CREATE INDEX idx_repositories_category ON repositories(category_id, updated_at DESC);
CREATE INDEX idx_repositories_release_subscription ON repositories(release_subscribed, release_last_synced_at DESC);
CREATE INDEX idx_releases_published ON releases(published_at DESC, created_at DESC);
CREATE INDEX idx_releases_repo ON releases(repo_full_name, published_at DESC, created_at DESC);
CREATE UNIQUE INDEX idx_app_sessions_device_id ON app_sessions(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_app_sessions_active ON app_sessions(revoked_at, expires_at, last_seen_at DESC);
CREATE INDEX idx_ai_models_service ON ai_models(service_id, enabled, sort_order, created_at);

CREATE TRIGGER prune_expired_sessions_after_insert
AFTER INSERT ON app_sessions
BEGIN
  DELETE FROM app_sessions
  WHERE julianday(expires_at) < julianday('now', '-7 days')
     OR (revoked_at IS NOT NULL AND julianday(revoked_at) < julianday('now', '-7 days'));
END;

PRAGMA foreign_keys = ON;
