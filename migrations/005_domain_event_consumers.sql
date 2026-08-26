BEGIN;

CREATE TABLE event_consumptions (
  event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE RESTRICT,
  consumer_name text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer_name)
);

CREATE TABLE operator_notifications (
  id uuid PRIMARY KEY,
  source_event_id uuid NOT NULL UNIQUE REFERENCES outbox_events(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES brand_profile_revisions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('BRAND_PROFILE_REVIEW_REQUIRED')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ')),
  correlation_id text NOT NULL,
  read_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK ((read_by IS NULL) = (read_at IS NULL))
);

CREATE INDEX operator_notifications_workspace_status_time
  ON operator_notifications (workspace_id, status, created_at DESC);

CREATE TABLE product_candidate_jobs (
  id uuid PRIMARY KEY,
  source_event_id uuid NOT NULL UNIQUE REFERENCES outbox_events(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL UNIQUE REFERENCES brand_profile_revisions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correlation_id text NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_candidate_jobs_pending
  ON product_candidate_jobs (available_at, created_at)
  WHERE status = 'PENDING';

COMMIT;

