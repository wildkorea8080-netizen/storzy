BEGIN;
CREATE TABLE printful_webhook_receipts (
  id uuid PRIMARY KEY,
  payload_digest text NOT NULL UNIQUE,
  event_type text NOT NULL,
  remote_task_id text,
  store_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  retries integer NOT NULL CHECK (retries >= 0),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX printful_webhook_receipts_task ON printful_webhook_receipts (remote_task_id) WHERE remote_task_id IS NOT NULL;
COMMIT;
