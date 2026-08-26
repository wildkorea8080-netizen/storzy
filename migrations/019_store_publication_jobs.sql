BEGIN;

CREATE TABLE shopify_store_publication_jobs (
  id uuid PRIMARY KEY,
  store_draft_id uuid NOT NULL UNIQUE REFERENCES store_drafts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  request_payload jsonb,
  response_payload jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CHECK (
    (status = 'RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL)
  )
);

CREATE INDEX shopify_store_publication_jobs_claimable
  ON shopify_store_publication_jobs (available_at, created_at)
  WHERE status = 'PENDING';

COMMIT;
