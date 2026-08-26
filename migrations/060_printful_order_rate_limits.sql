BEGIN;
CREATE TABLE workspace_printful_order_rate_limits(
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  used integer NOT NULL DEFAULT 0 CHECK(used>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
