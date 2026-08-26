BEGIN;
ALTER TABLE order_exception_actions DROP CONSTRAINT order_exception_actions_action_check;
ALTER TABLE order_exception_actions ADD CONSTRAINT order_exception_actions_action_check CHECK(action IN ('REVALIDATE','MANUAL_APPROVE','REJECT','SHOPIFY_CANCELLED'));
CREATE TABLE shopify_order_cancellations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  webhook_receipt_id uuid NOT NULL UNIQUE REFERENCES shopify_order_webhook_receipts(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPLIED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  UNIQUE(workspace_id,shopify_order_id),
  CHECK((status='APPLIED')=(applied_at IS NOT NULL))
);
CREATE INDEX shopify_order_cancellations_pending ON shopify_order_cancellations(workspace_id,received_at) WHERE status='PENDING';
COMMIT;
