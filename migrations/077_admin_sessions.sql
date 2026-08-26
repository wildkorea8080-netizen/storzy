CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY,
  token_digest text NOT NULL UNIQUE CHECK (length(token_digest) = 64),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_by text NOT NULL DEFAULT 'admin-login',
  CHECK (expires_at > created_at),
  CHECK ((status = 'ACTIVE' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL))
);

CREATE INDEX admin_sessions_active_expiry_idx
  ON admin_sessions(expires_at)
  WHERE status = 'ACTIVE';
