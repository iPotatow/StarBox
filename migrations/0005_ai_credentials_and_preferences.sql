CREATE TABLE IF NOT EXISTS ai_credentials (
  account_id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (account_id) REFERENCES app_account(account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_preferences (
  account_id TEXT PRIMARY KEY,
  ai_provider_name TEXT NOT NULL DEFAULT 'Custom HTTP',
  ai_base_url TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  release_sync_pages INTEGER NOT NULL DEFAULT 3,
  release_asset_include_pattern TEXT NOT NULL DEFAULT '',
  release_asset_exclude_pattern TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES app_account(account_id) ON DELETE CASCADE
);
