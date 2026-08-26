BEGIN;
ALTER TABLE commerce_orders DROP CONSTRAINT commerce_orders_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_status_check CHECK(status IN ('READY','WAITING','HELD','REJECTED','ALREADY_PROCESSED','SUBMITTED'));
CREATE TABLE order_exception_actions (
 id uuid PRIMARY KEY,
 commerce_order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('REVALIDATE','MANUAL_APPROVE','REJECT')),
 actor_id text NOT NULL,
 reason text,
 before_status text NOT NULL,
 after_status text NOT NULL,
 before_reasons jsonb NOT NULL,
 after_reasons jsonb NOT NULL,
 idempotency_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(commerce_order_id,idempotency_key),
 CHECK(action='REVALIDATE' OR char_length(reason) BETWEEN 1 AND 500)
);
CREATE INDEX order_exception_actions_order_time ON order_exception_actions(commerce_order_id,created_at DESC);
COMMIT;
