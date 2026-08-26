BEGIN;

CREATE TABLE integration_connections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('SHOPIFY','PRINTFUL')),
  status text NOT NULL DEFAULT 'CONNECTED' CHECK (status IN ('CONNECTED','DISCONNECTED','REAUTH_REQUIRED')),
  account_label text NOT NULL,
  encrypted_payload bytea NOT NULL,
  encryption_iv bytea NOT NULL CHECK (octet_length(encryption_iv) = 12),
  encryption_auth_tag bytea NOT NULL CHECK (octet_length(encryption_auth_tag) = 16),
  encryption_key_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE TABLE integration_connection_actions (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('SHOPIFY','PRINTFUL')),
  action text NOT NULL CHECK (action IN ('CONNECTED','CREDENTIALS_ROTATED','DISCONNECTED','REAUTH_REQUIRED')),
  actor_id text NOT NULL,
  before_status text,
  after_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX integration_connections_workspace_status ON integration_connections(workspace_id,status);
CREATE INDEX integration_connection_actions_history ON integration_connection_actions(workspace_id,provider,created_at DESC);

COMMIT;
