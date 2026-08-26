BEGIN;

ALTER TABLE product_candidate_jobs
  ADD COLUMN locked_by text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN catalog_snapshot_id uuid,
  ADD CONSTRAINT product_candidate_jobs_lock_consistency CHECK (
    (status = 'RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL)
  );

CREATE TABLE catalog_snapshots (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('PRINTFUL', 'FIXTURE')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  product_count integer NOT NULL CHECK (product_count >= 0),
  checksum text NOT NULL,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_candidate_jobs
  ADD CONSTRAINT product_candidate_jobs_snapshot_fk
  FOREIGN KEY (catalog_snapshot_id) REFERENCES catalog_snapshots(id) ON DELETE RESTRICT;

CREATE TABLE product_candidates (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES product_candidate_jobs(id) ON DELETE CASCADE,
  catalog_snapshot_id uuid NOT NULL REFERENCES catalog_snapshots(id) ON DELETE RESTRICT,
  external_product_id text NOT NULL,
  product_type text NOT NULL,
  product_name text NOT NULL,
  eligibility text NOT NULL CHECK (eligibility IN ('ELIGIBLE', 'EXCLUDED')),
  exclusion_reasons jsonb NOT NULL,
  score numeric(5,2),
  score_breakdown jsonb,
  evidence jsonb NOT NULL,
  recommended_retail_minor bigint,
  variable_cost_minor bigint NOT NULL CHECK (variable_cost_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  margin_basis_points integer,
  rule_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, external_product_id),
  CHECK (
    (eligibility = 'ELIGIBLE' AND score IS NOT NULL AND score_breakdown IS NOT NULL AND recommended_retail_minor IS NOT NULL)
    OR
    (eligibility = 'EXCLUDED' AND score IS NULL AND recommended_retail_minor IS NULL)
  )
);

CREATE INDEX product_candidates_job_rank
  ON product_candidates (job_id, eligibility, score DESC NULLS LAST);

COMMIT;

