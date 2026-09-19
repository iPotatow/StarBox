-- GitHub Release payloads are fetched on demand and cached in the browser only.
-- Keep only StarBox-owned derived platform state on repositories.
UPDATE repositories
SET ai_platforms_json = '[]',
    release_last_synced_at = NULL,
    release_cursor = NULL;

DROP TABLE IF EXISTS releases;
