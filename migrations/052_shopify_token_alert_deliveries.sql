BEGIN;

CREATE TABLE shopify_token_alert_deliveries (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_kind text NOT NULL CHECK (alert_kind IN ('REAUTH_REQUIRED','REFRESH_REPEATED_FAILURE')),
  occurrence_key timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SENT','FAILED')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  response_status int,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id,alert_kind,occurrence_key)
);

CREATE INDEX shopify_token_alert_deliveries_ready ON shopify_token_alert_deliveries(available_at,created_at) WHERE status IN ('PENDING','FAILED');

COMMIT;
