BEGIN;

ALTER TABLE shopify_publication_jobs DROP CONSTRAINT shopify_publication_jobs_status_check;
ALTER TABLE shopify_publication_jobs
  ADD CONSTRAINT shopify_publication_jobs_status_check
  CHECK (status IN ('WAITING_FOR_MOCKUP','PENDING','RUNNING','SUCCEEDED','FAILED'));

CREATE TABLE design_assets (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL UNIQUE REFERENCES product_candidates(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_url text NOT NULL CHECK (file_url ~ '^https://'),
  placement text NOT NULL,
  technique text NOT NULL,
  mockup_style_ids jsonb NOT NULL CHECK (jsonb_typeof(mockup_style_ids) = 'array' AND jsonb_array_length(mockup_style_ids) > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE printful_mockup_jobs (
  id uuid PRIMARY KEY,
  content_revision_id uuid NOT NULL UNIQUE REFERENCES product_content_revisions(id) ON DELETE RESTRICT,
  design_asset_id uuid NOT NULL REFERENCES design_assets(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','WAITING_REMOTE','SUCCEEDED','FAILED')),
  remote_task_ids jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((status='RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status<>'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX printful_mockup_jobs_ready ON printful_mockup_jobs (available_at, created_at) WHERE status IN ('PENDING','WAITING_REMOTE');

CREATE TABLE mockup_snapshots (
  id uuid PRIMARY KEY,
  mockup_job_id uuid NOT NULL UNIQUE REFERENCES printful_mockup_jobs(id) ON DELETE RESTRICT,
  data jsonb NOT NULL,
  checksum text NOT NULL,
  image_count integer NOT NULL CHECK (image_count > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shopify_publication_jobs ADD COLUMN mockup_snapshot_id uuid REFERENCES mockup_snapshots(id) ON DELETE RESTRICT;

COMMIT;
