BEGIN;

CREATE TABLE product_content_jobs (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL UNIQUE REFERENCES product_candidates(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  correlation_id text NOT NULL,
  last_error text,
  provider_request_id text,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL))
);

CREATE INDEX product_content_jobs_claimable ON product_content_jobs (available_at, lease_expires_at, created_at)
  WHERE status IN ('PENDING', 'RUNNING');

CREATE TABLE product_contents (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL UNIQUE REFERENCES product_candidates(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL UNIQUE REFERENCES product_content_jobs(id) ON DELETE RESTRICT,
  content_data jsonb NOT NULL,
  schema_version text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
