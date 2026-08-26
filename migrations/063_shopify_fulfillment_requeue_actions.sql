BEGIN;
CREATE TABLE shopify_fulfillment_requeue_actions(
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  commerce_order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  shopify_fulfillment_job_id uuid NOT NULL REFERENCES shopify_fulfillment_jobs(id) ON DELETE RESTRICT,
  actor_id text NOT NULL,
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 1 AND 500),
  idempotency_key text NOT NULL,
  before_attempts integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX shopify_fulfillment_requeue_history ON shopify_fulfillment_requeue_actions(workspace_id,commerce_order_id,created_at DESC);
COMMIT;
