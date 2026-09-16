ALTER TABLE app_preferences ADD COLUMN ui_theme TEXT NOT NULL DEFAULT 'system';
ALTER TABLE app_preferences ADD COLUMN ui_accent TEXT NOT NULL DEFAULT 'neutral';
ALTER TABLE app_preferences ADD COLUMN ui_language TEXT NOT NULL DEFAULT 'zh-CN';
ALTER TABLE app_preferences ADD COLUMN nav_order_json TEXT NOT NULL DEFAULT '["repositories","releases","forks","discover","settings"]';
ALTER TABLE app_preferences ADD COLUMN hidden_nav_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE app_preferences ADD COLUMN release_include_prereleases INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_preferences ADD COLUMN github_avatar_url TEXT;

ALTER TABLE releases ADD COLUMN ai_summary_json TEXT;
