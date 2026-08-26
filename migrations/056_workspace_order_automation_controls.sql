BEGIN;
CREATE TABLE workspace_order_automation_controls (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((enabled AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR NOT enabled)
);
CREATE TABLE workspace_order_automation_actions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('ENABLE','DISABLE')),
  actor_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_order_automation_actions_history ON workspace_order_automation_actions(workspace_id, created_at DESC);
COMMIT;
