BEGIN;
CREATE TABLE shopify_fulfillment_job_events(
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES fulfillment_shipments(id) ON DELETE RESTRICT,
  shopify_fulfillment_job_id uuid NOT NULL REFERENCES shopify_fulfillment_jobs(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN ('CREATED','RECOVERED')),
  actor_id text NOT NULL,
  shopify_fulfillment_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_fulfillment_job_event_history ON shopify_fulfillment_job_events(workspace_id,shipment_id,created_at DESC);
COMMIT;
