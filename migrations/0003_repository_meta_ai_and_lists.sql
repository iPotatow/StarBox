ALTER TABLE repository_meta ADD COLUMN ai_summary TEXT;
ALTER TABLE repository_meta ADD COLUMN ai_tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE github_list_memberships ADD COLUMN repo_full_name TEXT;
ALTER TABLE github_list_memberships ADD COLUMN html_url TEXT;
CREATE INDEX idx_list_memberships_account_full_name ON github_list_memberships(account_id, repo_full_name);
