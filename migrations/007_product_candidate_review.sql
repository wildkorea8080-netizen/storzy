BEGIN;

ALTER TABLE product_candidates
  ADD COLUMN decision_status text NOT NULL DEFAULT 'UNREVIEWED'
    CHECK (decision_status IN ('UNREVIEWED', 'APPROVED', 'REJECTED')),
  ADD COLUMN decision_reason text,
  ADD COLUMN reviewed_by text,
  ADD COLUMN reviewed_at timestamptz,
  ADD CONSTRAINT product_candidates_review_consistency CHECK (
    (decision_status = 'UNREVIEWED' AND reviewed_by IS NULL AND reviewed_at IS NULL AND decision_reason IS NULL)
    OR
    (decision_status <> 'UNREVIEWED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  ADD CONSTRAINT product_candidates_only_eligible_approval CHECK (
    decision_status <> 'APPROVED' OR eligibility = 'ELIGIBLE'
  );

CREATE TABLE product_candidate_actions (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES product_candidates(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('APPROVED', 'REJECTED')),
  actor_id text NOT NULL,
  reason text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_candidates_job_review_rank
  ON product_candidates (job_id, eligibility, decision_status, score DESC NULLS LAST, id);

CREATE INDEX product_candidate_actions_candidate_time
  ON product_candidate_actions (candidate_id, created_at);

COMMIT;
