BEGIN;

CREATE TABLE outbox_event_actions (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('REQUEUED')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_event_actions_event_time ON outbox_event_actions (event_id, created_at DESC);

COMMIT;

