CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('agency', 'client')),
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  invitation_id TEXT NOT NULL REFERENCES invitations(id),
  name TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  path TEXT NOT NULL,
  deployment TEXT NOT NULL,
  anchor TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS annotations_page ON annotations(deployment, path, created_at);
CREATE INDEX IF NOT EXISTS annotations_session ON annotations(session_id, created_at);
CREATE INDEX IF NOT EXISTS sessions_invitation ON sessions(invitation_id, created_at);
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  author TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('agency', 'client')),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS replies_annotation ON replies(annotation_id, created_at);
CREATE INDEX IF NOT EXISTS replies_session ON replies(session_id, created_at);
