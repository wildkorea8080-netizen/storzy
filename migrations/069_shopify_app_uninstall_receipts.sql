CREATE TABLE shopify_app_uninstall_receipts (
  id uuid PRIMARY KEY,
  webhook_id text NOT NULL UNIQUE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  shop_domain text NOT NULL,
  workspace_matched boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_app_uninstall_receipts_recent ON shopify_app_uninstall_receipts(received_at DESC);
