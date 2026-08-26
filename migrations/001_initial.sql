BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brand_profiles (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brand_profile_revisions (
  id uuid PRIMARY KEY,
  brand_profile_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN (
    'GENERATING', 'REVIEW_REQUIRED', 'APPROVED', 'SUPERSEDED', 'GENERATION_FAILED'
  )),
  schema_version text NOT NULL DEFAULT '1.0.0',
  onboarding_answers jsonb NOT NULL,
  profile_data jsonb,
  prompt_version text,
  model text,
  failure_code text,
  created_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz,
  approved_at timestamptz,
  UNIQUE (brand_profile_id, revision),
  CHECK ((status IN ('REVIEW_REQUIRED', 'APPROVED', 'SUPERSEDED')) = (profile_data IS NOT NULL)),
  CHECK ((approved_at IS NULL) = (approved_by IS NULL))
);

CREATE UNIQUE INDEX brand_profile_one_approved_revision
  ON brand_profile_revisions (brand_profile_id)
  WHERE status = 'APPROVED';

CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY,
  revision_id uuid NOT NULL UNIQUE REFERENCES brand_profile_revisions(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('BRAND_PROFILE_GENERATION')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generation_jobs_claimable
  ON generation_jobs (available_at, created_at)
  WHERE status = 'PENDING';

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_events_pending
  ON outbox_events (available_at, created_at)
  WHERE status = 'PENDING';

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_workspace_time ON audit_events (workspace_id, created_at DESC);

COMMIT;

