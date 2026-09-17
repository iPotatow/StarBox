-- Remove fields and tables whose product features have been retired.
ALTER TABLE repository_meta DROP COLUMN ai_tags_json;
ALTER TABLE repository_meta DROP COLUMN pinned;

DROP INDEX IF EXISTS idx_release_states_account_read;
DROP TABLE IF EXISTS release_states;

ALTER TABLE app_preferences DROP COLUMN nav_order_json;
