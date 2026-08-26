CREATE TABLE privacy_maintenance_incidents (
  id uuid PRIMARY KEY,
  incident_type text NOT NULL UNIQUE CHECK(incident_type IN('SLA_SCAN_FAILED','UNINSTALL_RETENTION_FAILED')),
  status text NOT NULL CHECK(status IN('OPEN','RESOLVED')),
  last_error text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX privacy_maintenance_incidents_open
  ON privacy_maintenance_incidents(updated_at DESC)
  WHERE status='OPEN';
