BEGIN;
CREATE TABLE order_reconciliation_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','PARTIAL','FAILED')),
  window_hours integer NOT NULL CHECK(window_hours BETWEEN 1 AND 168),
  actor_id text NOT NULL,
  workspace_count integer NOT NULL DEFAULT 0 CHECK(workspace_count>=0),
  succeeded_count integer NOT NULL DEFAULT 0 CHECK(succeeded_count>=0),
  failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count>=0),
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_reconciliation_runs_recent ON order_reconciliation_runs(started_at DESC);
COMMIT;
