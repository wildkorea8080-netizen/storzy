ALTER TABLE admin_security_alerts
  ADD COLUMN resolution_status text NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN resolved_at timestamptz;

CREATE TABLE admin_security_alert_actions (
  id uuid PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES admin_security_alerts(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('ACKNOWLEDGE','RESOLVE','REQUEUE')),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  before_status text NOT NULL,
  after_status text NOT NULL,
  before_attempts integer NOT NULL CHECK (before_attempts>=0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_security_alert_actions_alert_idx ON admin_security_alert_actions(alert_id,created_at DESC);
