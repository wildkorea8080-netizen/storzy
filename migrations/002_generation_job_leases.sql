BEGIN;

ALTER TABLE generation_jobs
  ADD COLUMN locked_by text,
  ADD COLUMN lease_expires_at timestamptz;

ALTER TABLE generation_jobs
  ADD CONSTRAINT generation_jobs_lock_consistency CHECK (
    (status = 'RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL)
  );

DROP INDEX generation_jobs_claimable;

CREATE INDEX generation_jobs_claimable
  ON generation_jobs (available_at, lease_expires_at, created_at)
  WHERE status IN ('PENDING', 'RUNNING');

COMMIT;

