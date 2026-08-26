BEGIN;
CREATE TABLE design_resolution_overrides (
  id uuid PRIMARY KEY,
  design_asset_id uuid NOT NULL UNIQUE REFERENCES design_assets(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  print_guideline jsonb NOT NULL,
  effective_dpi numeric(10,2) NOT NULL CHECK (effective_dpi >= 150),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);
COMMIT;
