CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  document TEXT NOT NULL CHECK (json_valid(document)),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
