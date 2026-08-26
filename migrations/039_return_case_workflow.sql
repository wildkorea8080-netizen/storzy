BEGIN;
ALTER TABLE commerce_orders DROP CONSTRAINT commerce_orders_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_status_check CHECK(status IN ('READY','WAITING','HELD','REJECTED','ALREADY_PROCESSED','SUBMITTED','RETURNED','RETURN_RESOLVED'));
CREATE TABLE return_cases (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  commerce_order_id uuid NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  shipment_id uuid NOT NULL UNIQUE REFERENCES fulfillment_shipments(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REFUND_REQUIRED','RESHIPMENT_REVIEW','RESOLVED')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK((status='RESOLVED')=(resolved_at IS NOT NULL))
);
CREATE TABLE return_case_actions (
  id uuid PRIMARY KEY,
  return_case_id uuid NOT NULL REFERENCES return_cases(id) ON DELETE CASCADE,
  action text NOT NULL CHECK(action IN ('REQUIRE_REFUND','REVIEW_RESHIPMENT','RESOLVE')),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  before_status text NOT NULL,
  after_status text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(return_case_id,idempotency_key)
);
CREATE INDEX return_cases_workspace_status ON return_cases(workspace_id,status,opened_at);
COMMIT;
