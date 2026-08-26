BEGIN;
ALTER TABLE order_reconciliation_issue_actions DROP CONSTRAINT order_reconciliation_issue_actions_action_check;
ALTER TABLE order_reconciliation_issue_actions ADD CONSTRAINT order_reconciliation_issue_actions_action_check CHECK(action IN ('ACKNOWLEDGE','RESOLVE','REPLAY_MISSING_ORDER'));
COMMIT;
