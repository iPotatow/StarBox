-- StarBox keeps exactly two tracked SQL files.
-- This compatibility file contains two named stages. Deploy tooling selects:
--   multi-tenant source: MULTI_TENANT + CONSOLIDATED
--   consolidated source: CONSOLIDATED only
-- The whole file is not executed blindly.
-- STARBOX_UPGRADE_STAGE: MULTI_TENANT
-- Normalize the retired multi-tenant schema into the retired consolidated single-user shape.

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

-- STARBOX_UPGRADE_STAGE: CONSOLIDATED
-- Upgrade the retired consolidated single-user shape to the current canonical eight-table schema.

CREATE TABLE starbox_upgrade_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

-- Reject ambiguous repository names and conflicting rows that share a real GitHub ID.
INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM repositories
  GROUP BY lower(full_name)
  HAVING COUNT(*) > 1
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1
  FROM repositories
  WHERE github_repo_id IS NOT NULL
    AND trim(github_repo_id) <> ''
    AND github_repo_id NOT GLOB '*[^0-9]*'
  GROUP BY CAST(github_repo_id AS INTEGER)
  HAVING COUNT(DISTINCT NULLIF(trim(note), '')) > 1
     OR COUNT(DISTINCT category_id) > 1
);

-- New normalized category names must remain unique.
INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM categories
  GROUP BY lower(trim(name))
  HAVING COUNT(*) > 1
);

-- Fail closed on broken relations rather than silently discarding user state.
INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM repositories r
  WHERE r.category_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.category_id = r.category_id)
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM ai_models m
  WHERE NOT EXISTS (SELECT 1 FROM ai_services s WHERE s.service_id = m.service_id)
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM credentials c
  WHERE c.credential_id LIKE 'ai:%'
    AND c.credential_id <> 'ai:legacy'
    AND NOT EXISTS (
      SELECT 1 FROM ai_services s
      WHERE s.service_id = substr(c.credential_id, 4)
    )
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM settings x
  WHERE x.key = 'ai.default_model_id'
    AND trim(x.value) <> ''
    AND NOT EXISTS (SELECT 1 FROM ai_models m WHERE m.model_id = x.value)
);

-- Validate legacy JSON before adding stricter checks.
INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM repositories
  WHERE NOT json_valid(ai_tags_json)
     OR json_type(ai_tags_json) <> 'array'
     OR NOT json_valid(ai_platforms_json)
     OR json_type(ai_platforms_json) <> 'array'
     OR NOT json_valid(raw_json)
     OR json_type(raw_json) <> 'object'
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM ai_services
  WHERE NOT json_valid(config_json) OR json_type(config_json) <> 'object'
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1 FROM forks
  WHERE NOT json_valid(payload_json) OR json_type(payload_json) <> 'object'
);

INSERT INTO starbox_upgrade_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT CAST(json_extract(payload_json, '$.id') AS INTEGER) AS github_id
  FROM forks
  WHERE json_type(payload_json, '$.id') = 'integer'
  GROUP BY github_id
  HAVING COUNT(*) > 1
);

CREATE TABLE categories_next (
  category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO categories_next (category_id, name, name_key, color, sort_order, locked, created_at, updated_at)
SELECT category_id, name, lower(trim(name)), color, sort_order,
       CASE WHEN locked = 1 THEN 1 ELSE 0 END,
       created_at, updated_at
FROM categories;

CREATE TABLE ai_services_next (
  service_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('openai-compatible', 'anthropic-messages', 'google-gemini')),
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO ai_services_next
SELECT service_id, name, protocol, base_url,
       CASE WHEN enabled = 0 THEN 0 ELSE 1 END,
       config_json, created_at, updated_at
FROM ai_services;

CREATE TABLE ai_models_next (
  model_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  remote_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (service_id, remote_model_id),
  FOREIGN KEY (service_id) REFERENCES ai_services_next(service_id) ON DELETE CASCADE
);

INSERT INTO ai_models_next
SELECT model_id, service_id, remote_model_id, display_name,
       CASE WHEN enabled = 0 THEN 0 ELSE 1 END,
       sort_order, created_at, updated_at
FROM ai_models;

CREATE TABLE credentials_next (
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
  FOREIGN KEY (service_id) REFERENCES ai_services_next(service_id) ON DELETE CASCADE,
  CHECK (
    (kind = 'github' AND service_id IS NULL)
    OR
    (kind = 'ai' AND (credential_id = 'ai:legacy' OR service_id IS NOT NULL))
  )
);

INSERT INTO credentials_next (
  credential_id, kind, owner_id, service_id, label, ciphertext, iv, key_version,
  fingerprint, validated_at, created_at, updated_at, status
)
SELECT
  credential_id,
  kind,
  CASE WHEN kind = 'github' THEN owner_id ELSE NULL END,
  CASE
    WHEN kind = 'ai' AND credential_id LIKE 'ai:%' AND credential_id <> 'ai:legacy'
      THEN substr(credential_id, 4)
    ELSE NULL
  END,
  label,
  ciphertext,
  iv,
  key_version,
  fingerprint,
  validated_at,
  created_at,
  updated_at,
  status
FROM credentials;

CREATE TABLE repositories_next (
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
  FOREIGN KEY (category_id) REFERENCES categories_next(category_id) ON DELETE SET NULL
);

-- Canonicalize all rows that carry a real numeric GitHub repository ID.
INSERT INTO repositories_next (
  repository_id, full_name, github_repo_id, name, html_url, description, language, default_branch,
  is_starred, starred_at, category_id, category_locked, note, ai_summary, ai_tags_json, platforms_json,
  release_subscribed, github_updated_at, github_pushed_at, synced_at, user_updated_at, user_revision,
  ai_analyzed_at, ai_input_hash, ai_prompt_version, ai_model_id,
  platform_checked_at, platform_rule_version, platform_check_state, github_snapshot_json
)
SELECT
  lower(hex(randomblob(16))),
  r.full_name,
  CAST(r.github_repo_id AS INTEGER),
  r.name,
  r.html_url,
  r.description,
  r.language,
  r.default_branch,
  CASE WHEN EXISTS (
    SELECT 1 FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.is_starred = 1
  ) THEN 1 ELSE 0 END,
  (
    SELECT x.starred_at FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.starred_at IS NOT NULL
    ORDER BY x.starred_at DESC LIMIT 1
  ),
  (
    SELECT x.category_id FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.category_id IS NOT NULL
    ORDER BY x.updated_at DESC LIMIT 1
  ),
  0,
  (
    SELECT x.note FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND NULLIF(trim(x.note), '') IS NOT NULL
    ORDER BY x.updated_at DESC LIMIT 1
  ),
  (
    SELECT x.ai_summary FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND NULLIF(trim(x.ai_summary), '') IS NOT NULL
    ORDER BY x.updated_at DESC LIMIT 1
  ),
  COALESCE((
    SELECT x.ai_tags_json FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.ai_tags_json <> '[]'
    ORDER BY x.updated_at DESC LIMIT 1
  ), '[]'),
  COALESCE((
    SELECT x.ai_platforms_json FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.ai_platforms_json <> '[]'
    ORDER BY COALESCE(x.release_last_synced_at, x.updated_at) DESC LIMIT 1
  ), '[]'),
  CASE WHEN EXISTS (
    SELECT 1 FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
      AND x.release_subscribed = 1
  ) THEN 1 ELSE 0 END,
  CASE WHEN json_valid(r.raw_json) THEN json_extract(r.raw_json, '$.updated_at') ELSE NULL END,
  CASE WHEN json_valid(r.raw_json) THEN json_extract(r.raw_json, '$.pushed_at') ELSE NULL END,
  CASE WHEN r.raw_json <> '{}' THEN r.updated_at ELSE NULL END,
  CASE WHEN r.category_id IS NOT NULL OR NULLIF(trim(r.note), '') IS NOT NULL OR r.release_subscribed = 1 THEN r.updated_at ELSE NULL END,
  0,
  CASE WHEN NULLIF(trim(r.ai_summary), '') IS NOT NULL OR r.ai_tags_json <> '[]' THEN r.updated_at ELSE NULL END,
  NULL,
  NULL,
  NULL,
  r.release_last_synced_at,
  NULL,
  CASE WHEN r.release_last_synced_at IS NOT NULL THEN 'success' ELSE 'never' END,
  CASE WHEN json_valid(r.raw_json) AND json_type(r.raw_json) = 'object' THEN r.raw_json ELSE '{}' END
FROM repositories r
WHERE r.github_repo_id IS NOT NULL
  AND trim(r.github_repo_id) <> ''
  AND r.github_repo_id NOT GLOB '*[^0-9]*'
  AND r.rowid = (
    SELECT x.rowid
    FROM repositories x
    WHERE x.github_repo_id IS NOT NULL
      AND trim(x.github_repo_id) <> ''
      AND x.github_repo_id NOT GLOB '*[^0-9]*'
      AND CAST(x.github_repo_id AS INTEGER) = CAST(r.github_repo_id AS INTEGER)
    ORDER BY x.updated_at DESC, x.is_starred DESC, x.rowid DESC
    LIMIT 1
  );

-- Preserve path placeholders, but remove the old fake string GitHub ID.
INSERT INTO repositories_next (
  repository_id, full_name, github_repo_id, name, html_url, description, language, default_branch,
  is_starred, starred_at, category_id, category_locked, note, ai_summary, ai_tags_json, platforms_json,
  release_subscribed, github_updated_at, github_pushed_at, synced_at, user_updated_at, user_revision,
  ai_analyzed_at, ai_input_hash, ai_prompt_version, ai_model_id,
  platform_checked_at, platform_rule_version, platform_check_state, github_snapshot_json
)
SELECT
  lower(hex(randomblob(16))),
  r.full_name,
  NULL,
  r.name,
  r.html_url,
  r.description,
  r.language,
  r.default_branch,
  CASE WHEN r.is_starred = 1 THEN 1 ELSE 0 END,
  r.starred_at,
  r.category_id,
  0,
  r.note,
  r.ai_summary,
  r.ai_tags_json,
  r.ai_platforms_json,
  CASE WHEN r.release_subscribed = 1 THEN 1 ELSE 0 END,
  CASE WHEN json_valid(r.raw_json) THEN json_extract(r.raw_json, '$.updated_at') ELSE NULL END,
  CASE WHEN json_valid(r.raw_json) THEN json_extract(r.raw_json, '$.pushed_at') ELSE NULL END,
  CASE WHEN r.raw_json <> '{}' THEN r.updated_at ELSE NULL END,
  CASE WHEN r.category_id IS NOT NULL OR NULLIF(trim(r.note), '') IS NOT NULL OR r.release_subscribed = 1 THEN r.updated_at ELSE NULL END,
  0,
  CASE WHEN NULLIF(trim(r.ai_summary), '') IS NOT NULL OR r.ai_tags_json <> '[]' THEN r.updated_at ELSE NULL END,
  NULL,
  NULL,
  NULL,
  r.release_last_synced_at,
  NULL,
  CASE WHEN r.release_last_synced_at IS NOT NULL THEN 'success' ELSE 'never' END,
  r.raw_json
FROM repositories r
WHERE r.github_repo_id IS NULL
   OR trim(r.github_repo_id) = ''
   OR r.github_repo_id GLOB '*[^0-9]*';

CREATE TABLE forks_next (
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

INSERT INTO forks_next (
  fork_id, github_repo_id, full_name, parent_full_name, status,
  github_pushed_at, snapshot_at, checked_at, payload_json
)
SELECT
  lower(hex(randomblob(16))),
  CASE WHEN json_type(payload_json, '$.id') = 'integer' THEN CAST(json_extract(payload_json, '$.id') AS INTEGER) ELSE NULL END,
  full_name,
  parent_full_name,
  CASE WHEN status IN ('unknown', 'pending', 'ready', 'failed', 'deleted') THEN status ELSE 'unknown' END,
  CASE WHEN json_type(payload_json, '$.pushed_at') = 'text' THEN json_extract(payload_json, '$.pushed_at') ELSE NULL END,
  CASE WHEN payload_json <> '{}' THEN updated_at ELSE NULL END,
  updated_at,
  payload_json
FROM forks;

-- Release payloads are browser-owned now. The legacy persisted Release table is retired.
DROP TABLE IF EXISTS releases;

DROP TABLE repositories;
DROP TABLE forks;
DROP TABLE ai_models;
DROP TABLE credentials;
DROP TABLE categories;
DROP TABLE ai_services;

ALTER TABLE categories_next RENAME TO categories;
ALTER TABLE ai_services_next RENAME TO ai_services;
ALTER TABLE ai_models_next RENAME TO ai_models;
ALTER TABLE credentials_next RENAME TO credentials;
ALTER TABLE repositories_next RENAME TO repositories;
ALTER TABLE forks_next RENAME TO forks;

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

DROP TABLE starbox_upgrade_guard;

-- STARBOX_UPGRADE_STAGE: RELEASE_AI
-- Upgrade the previous final eight-table schema in place.
ALTER TABLE repositories ADD COLUMN release_ai_release_id INTEGER;
ALTER TABLE repositories ADD COLUMN release_ai_tag TEXT;
ALTER TABLE repositories ADD COLUMN release_ai_summary_json TEXT CHECK (release_ai_summary_json IS NULL OR (json_valid(release_ai_summary_json) AND json_type(release_ai_summary_json) = 'object'));
ALTER TABLE repositories ADD COLUMN release_ai_model_id TEXT;
ALTER TABLE repositories ADD COLUMN release_ai_generated_at TEXT;
