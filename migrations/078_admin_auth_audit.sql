CREATE TABLE admin_auth_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('LOGIN_SUCCEEDED','LOGIN_FAILED','LOGIN_RATE_LIMITED','LOGOUT','REVOKE_ALL')),
  outcome text NOT NULL CHECK (outcome IN ('SUCCEEDED','REJECTED')),
  session_id uuid REFERENCES admin_sessions(id) ON DELETE SET NULL,
  client_digest text NOT NULL CHECK (length(client_digest) = 64),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_auth_events_occurred_idx ON admin_auth_events(occurred_at DESC);
CREATE INDEX admin_auth_events_session_idx ON admin_auth_events(session_id,occurred_at DESC) WHERE session_id IS NOT NULL;
