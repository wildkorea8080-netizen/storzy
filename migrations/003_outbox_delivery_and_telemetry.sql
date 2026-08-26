BEGIN;

ALTER TABLE generation_jobs
  ADD COLUMN correlation_id text NOT NULL DEFAULT 'legacy',
  ADD COLUMN provider_request_id text,
  ADD COLUMN latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  ADD COLUMN input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  ADD COLUMN output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  ADD COLUMN total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0);

ALTER TABLE outbox_events
  DROP CONSTRAINT outbox_events_status_check,
  ADD COLUMN correlation_id text NOT NULL DEFAULT 'legacy',
  ADD COLUMN locked_by text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD CONSTRAINT outbox_events_status_check CHECK (status IN ('PENDING', 'PUBLISHED', 'DEAD_LETTER')),
  ADD CONSTRAINT outbox_events_lock_consistency CHECK (
    (locked_by IS NULL AND lease_expires_at IS NULL)
    OR
    (status = 'PENDING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
  );

DROP INDEX outbox_events_pending;

CREATE INDEX outbox_events_claimable
  ON outbox_events (available_at, lease_expires_at, created_at)
  WHERE status = 'PENDING';

COMMIT;

