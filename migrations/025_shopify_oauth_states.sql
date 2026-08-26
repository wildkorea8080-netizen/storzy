BEGIN;
CREATE TABLE shopify_oauth_states (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  state_digest text NOT NULL UNIQUE,
  shop_domain text NOT NULL,
  actor_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_oauth_states_active ON shopify_oauth_states(expires_at) WHERE used_at IS NULL;
COMMIT;
