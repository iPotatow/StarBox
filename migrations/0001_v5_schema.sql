PRAGMA foreign_keys = ON;

CREATE TABLE app_account (
  account_id TEXT PRIMARY KEY CHECK (account_id = 'primary'),
  github_user_id TEXT,
  github_login TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE app_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE github_credentials (
  account_id TEXT PRIMARY KEY REFERENCES app_account(account_id) ON DELETE CASCADE,
  github_numeric_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  validated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE repositories (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  github_repo_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  name TEXT NOT NULL,
  html_url TEXT NOT NULL,
  description TEXT,
  language TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_starred INTEGER NOT NULL DEFAULT 0,
  starred_at TEXT,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (account_id, github_repo_id)
);
CREATE TABLE repository_meta (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  github_repo_id TEXT NOT NULL,
  category_id TEXT,
  note TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, github_repo_id)
);
CREATE TABLE categories (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, category_id)
);
CREATE TABLE release_subscriptions (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, repo_full_name)
);
CREATE TABLE releases (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, release_id)
);
CREATE TABLE release_states (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL,
  read_at TEXT,
  PRIMARY KEY (account_id, release_id)
);
CREATE TABLE release_sync_state (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  cursor TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, repo_full_name)
);
CREATE TABLE forks (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  parent_full_name TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (account_id, full_name)
);
CREATE TABLE fork_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  cursor TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE fork_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE github_lists (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, list_id)
);
CREATE TABLE github_list_memberships (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  list_id TEXT NOT NULL,
  github_repo_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, list_id, github_repo_id)
);
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sync_state (
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  cursor TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, scope)
);
CREATE TABLE sync_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES app_account(account_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE login_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL,
  reset_at TEXT NOT NULL
);
