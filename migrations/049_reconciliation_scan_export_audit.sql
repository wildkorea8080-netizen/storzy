BEGIN;
CREATE TABLE order_reconciliation_scan_export_actions(
  id uuid PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES order_reconciliation_scans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  issue_count integer NOT NULL CHECK(issue_count>=0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_reconciliation_scan_exports_lookup ON order_reconciliation_scan_export_actions(workspace_id,scan_id,created_at DESC);
COMMIT;
