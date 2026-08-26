BEGIN;
CREATE TABLE order_reconciliation_scan_issue_snapshots(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES order_reconciliation_scans(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  issue_type text NOT NULL CHECK(issue_type IN('MISSING_LOCAL_ORDER','CANCELLATION_MISMATCH','FINANCIAL_STATUS_MISMATCH')),
  local_value text,
  remote_value text,
  remote_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scan_id,shopify_order_id,issue_type)
);
CREATE INDEX order_reconciliation_scan_snapshots_lookup ON order_reconciliation_scan_issue_snapshots(workspace_id,scan_id,created_at);

CREATE OR REPLACE FUNCTION increment_reconciliation_scan_breakdown() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.scan_id IS DISTINCT FROM NEW.scan_id THEN
    UPDATE order_reconciliation_scans SET
      missing_local_order_count=missing_local_order_count+(NEW.issue_type='MISSING_LOCAL_ORDER')::int,
      cancellation_mismatch_count=cancellation_mismatch_count+(NEW.issue_type='CANCELLATION_MISMATCH')::int,
      financial_status_mismatch_count=financial_status_mismatch_count+(NEW.issue_type='FINANCIAL_STATUS_MISMATCH')::int
    WHERE id=NEW.scan_id;
    INSERT INTO order_reconciliation_scan_issue_snapshots(scan_id,workspace_id,shopify_order_id,issue_type,local_value,remote_value,remote_updated_at)
    VALUES(NEW.scan_id,NEW.workspace_id,NEW.shopify_order_id,NEW.issue_type,NEW.local_value,NEW.remote_value,NEW.remote_updated_at)
    ON CONFLICT(scan_id,shopify_order_id,issue_type) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

INSERT INTO order_reconciliation_scan_issue_snapshots(scan_id,workspace_id,shopify_order_id,issue_type,local_value,remote_value,remote_updated_at,created_at)
SELECT scan_id,workspace_id,shopify_order_id,issue_type,local_value,remote_value,remote_updated_at,created_at FROM order_reconciliation_issues
ON CONFLICT(scan_id,shopify_order_id,issue_type) DO NOTHING;
COMMIT;
