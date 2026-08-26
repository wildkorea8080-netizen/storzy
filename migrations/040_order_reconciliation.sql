BEGIN;
CREATE TABLE order_reconciliation_scans (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  remote_order_count integer NOT NULL CHECK(remote_order_count>=0),
  matched_order_count integer NOT NULL CHECK(matched_order_count>=0),
  issue_count integer NOT NULL CHECK(issue_count>=0),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_reconciliation_issues (
  id uuid PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES order_reconciliation_scans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  issue_type text NOT NULL CHECK(issue_type IN ('MISSING_LOCAL_ORDER','CANCELLATION_MISMATCH','FINANCIAL_STATUS_MISMATCH')),
  local_value text,
  remote_value text,
  remote_updated_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id,shopify_order_id,issue_type)
);
CREATE INDEX order_reconciliation_issues_open ON order_reconciliation_issues(workspace_id,status,created_at DESC) WHERE status='OPEN';
COMMIT;
