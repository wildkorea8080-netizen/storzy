BEGIN;
CREATE TABLE printful_order_job_events(
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  commerce_order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  printful_order_job_id uuid NOT NULL REFERENCES printful_order_jobs(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN ('CONFIRMED','CONFIRMATION_RECOVERED','HELD')),
  actor_id text NOT NULL,
  remote_order_id text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX printful_order_job_event_history ON printful_order_job_events(workspace_id,commerce_order_id,created_at DESC);
COMMIT;
