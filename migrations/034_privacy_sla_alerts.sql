BEGIN;
CREATE TABLE privacy_sla_alerts (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES shopify_privacy_requests(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  level text NOT NULL CHECK(level IN ('DUE_SOON','OVERDUE','FAILED')),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  due_at timestamptz NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  UNIQUE(request_id,level),
  CHECK((acknowledged_at IS NULL)=(acknowledged_by IS NULL)),
  CHECK(status<>'RESOLVED' OR resolved_at IS NOT NULL)
);
CREATE INDEX privacy_sla_alerts_open ON privacy_sla_alerts(status,level,due_at) WHERE status IN ('OPEN','ACKNOWLEDGED');
COMMIT;
