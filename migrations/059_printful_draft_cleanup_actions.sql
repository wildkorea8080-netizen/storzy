BEGIN;
CREATE TABLE printful_draft_cleanup_actions(
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  commerce_order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  printful_order_job_id uuid NOT NULL REFERENCES printful_order_jobs(id) ON DELETE RESTRICT,
  remote_order_id text NOT NULL,
  actor_id text NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX printful_draft_cleanup_history ON printful_draft_cleanup_actions(workspace_id,created_at DESC);
COMMIT;
