BEGIN;
CREATE TABLE shopify_privacy_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK(request_type IN ('CUSTOMERS_DATA_REQUEST','CUSTOMERS_REDACT','SHOP_REDACT')),
  shop_domain text NOT NULL,
  shop_id text NOT NULL,
  customer_id text,
  order_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(order_ids)='array'),
  external_request_id text,
  payload_digest text NOT NULL UNIQUE,
  webhook_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED','RETAINED_LEGAL','FAILED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
  completed_at timestamptz,
  completion_note text
);
CREATE INDEX shopify_privacy_requests_due ON shopify_privacy_requests(status,due_at) WHERE status IN ('PENDING','IN_PROGRESS','FAILED');
COMMIT;
