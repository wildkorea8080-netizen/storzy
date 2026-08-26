BEGIN;
CREATE TABLE shopify_privacy_request_actions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES shopify_privacy_requests(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('START_REVIEW','LEGAL_HOLD')),
  actor_id text NOT NULL,
  reason text,
  before_status text NOT NULL,
  after_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(action<>'LEGAL_HOLD' OR length(reason) BETWEEN 1 AND 1000)
);
CREATE INDEX shopify_privacy_request_actions_history ON shopify_privacy_request_actions(request_id,created_at DESC);
COMMIT;
