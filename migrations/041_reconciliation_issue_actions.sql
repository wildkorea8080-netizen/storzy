BEGIN;
ALTER TABLE order_reconciliation_issues DROP CONSTRAINT order_reconciliation_issues_status_check;
ALTER TABLE order_reconciliation_issues ADD CONSTRAINT order_reconciliation_issues_status_check CHECK(status IN ('OPEN','ACKNOWLEDGED','RESOLVED'));
ALTER TABLE order_reconciliation_issues ADD COLUMN acknowledged_at timestamptz;
ALTER TABLE order_reconciliation_issues ADD COLUMN acknowledged_by text;
ALTER TABLE order_reconciliation_issues ADD COLUMN resolved_at timestamptz;
CREATE TABLE order_reconciliation_issue_actions (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES order_reconciliation_issues(id) ON DELETE CASCADE,
  action text NOT NULL CHECK(action IN ('ACKNOWLEDGE','RESOLVE')),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  before_status text NOT NULL,
  after_status text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id,idempotency_key)
);
CREATE INDEX order_reconciliation_issue_actions_history ON order_reconciliation_issue_actions(issue_id,created_at DESC);
COMMIT;
