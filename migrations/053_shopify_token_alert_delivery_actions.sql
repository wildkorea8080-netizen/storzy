BEGIN;
CREATE TABLE shopify_token_alert_delivery_actions (
  id uuid PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES shopify_token_alert_deliveries(id) ON DELETE CASCADE,
  action text NOT NULL CHECK(action='REQUEUE'),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  before_status text NOT NULL,
  after_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_token_alert_delivery_actions_history ON shopify_token_alert_delivery_actions(delivery_id,created_at DESC);
COMMIT;
