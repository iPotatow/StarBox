CREATE TABLE processed_mutations (
  mutation_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL,
  seq INTEGER,
  revision INTEGER
);
