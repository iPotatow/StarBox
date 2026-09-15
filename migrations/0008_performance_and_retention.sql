CREATE INDEX IF NOT EXISTS idx_repositories_account_starred_updated
  ON repositories(account_id, is_starred, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_releases_account_published_global
  ON releases(account_id, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processed_mutations_processed_at
  ON processed_mutations(processed_at);

CREATE TRIGGER IF NOT EXISTS prune_processed_mutations_after_insert
AFTER INSERT ON processed_mutations
BEGIN
  DELETE FROM processed_mutations
  WHERE julianday(processed_at) < julianday('now', '-30 days');
END;

CREATE TRIGGER IF NOT EXISTS prune_expired_sessions_after_insert
AFTER INSERT ON app_sessions
BEGIN
  DELETE FROM app_sessions
  WHERE julianday(expires_at) < julianday('now', '-7 days')
     OR (revoked_at IS NOT NULL AND julianday(revoked_at) < julianday('now', '-7 days'));
END;

CREATE TRIGGER IF NOT EXISTS prune_login_rate_limits_after_insert
AFTER INSERT ON login_rate_limits
BEGIN
  DELETE FROM login_rate_limits
  WHERE julianday(reset_at) < julianday('now', '-1 day');
END;

CREATE TRIGGER IF NOT EXISTS prune_activity_log_after_insert
AFTER INSERT ON activity_log
BEGIN
  DELETE FROM activity_log
  WHERE julianday(created_at) < julianday('now', '-90 days');
END;

CREATE TRIGGER IF NOT EXISTS prune_sync_changes_after_insert
AFTER INSERT ON sync_changes
BEGIN
  DELETE FROM sync_changes
  WHERE julianday(created_at) < julianday('now', '-90 days');
END;
