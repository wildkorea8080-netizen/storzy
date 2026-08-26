BEGIN;
WITH ranked AS (
  SELECT id,row_number() OVER(PARTITION BY workspace_id,shopify_order_id,issue_type ORDER BY created_at DESC,id DESC) AS position
  FROM order_reconciliation_issues
  WHERE status IN ('OPEN','ACKNOWLEDGED')
)
UPDATE order_reconciliation_issues i SET status='RESOLVED',resolved_at=now()
FROM ranked r WHERE i.id=r.id AND r.position>1;
CREATE UNIQUE INDEX order_reconciliation_one_active_issue
  ON order_reconciliation_issues(workspace_id,shopify_order_id,issue_type)
  WHERE status IN ('OPEN','ACKNOWLEDGED');
ALTER TABLE order_reconciliation_issue_actions DROP CONSTRAINT order_reconciliation_issue_actions_action_check;
ALTER TABLE order_reconciliation_issue_actions ADD CONSTRAINT order_reconciliation_issue_actions_action_check CHECK(action IN ('ACKNOWLEDGE','RESOLVE','REPLAY_MISSING_ORDER','SYNC_CANCELLATION','SYNC_FINANCIAL_STATUS','AUTO_RESOLVE_MATCHED'));
COMMIT;
