ALTER TABLE sessions ADD COLUMN password_version TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS password_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_attempts_expiry ON password_attempts(reset_at);
