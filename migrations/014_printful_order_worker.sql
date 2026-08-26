BEGIN;
ALTER TABLE commerce_orders DROP CONSTRAINT commerce_orders_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_status_check CHECK(status IN ('READY','WAITING','HELD','ALREADY_PROCESSED','SUBMITTED'));
CREATE TABLE printful_order_jobs (
 id uuid PRIMARY KEY,
 commerce_order_id uuid NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 external_id text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'PENDING_DRAFT' CHECK(status IN ('PENDING_DRAFT','RUNNING','WAITING_COST','READY_CONFIRM','SUCCEEDED','HELD','FAILED')),
 remote_order_id text,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_by text,
 lease_expires_at timestamptz,
 request_payload jsonb,
 draft_response jsonb,
 confirmed_response jsonb,
 quoted_cost_minor bigint,
 quoted_currency text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CHECK((status='RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status<>'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX printful_order_jobs_ready ON printful_order_jobs(available_at,created_at) WHERE status IN ('PENDING_DRAFT','WAITING_COST','READY_CONFIRM');
COMMIT;
