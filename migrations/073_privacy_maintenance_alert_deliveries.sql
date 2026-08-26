CREATE TABLE privacy_maintenance_alert_deliveries (
  id uuid PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES privacy_maintenance_incidents(id) ON DELETE CASCADE,
  incident_opened_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','RUNNING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(incident_id,incident_opened_at),
  CHECK((status='RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status<>'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL))
);

CREATE INDEX privacy_maintenance_alert_deliveries_ready
  ON privacy_maintenance_alert_deliveries(available_at,created_at)
  WHERE status IN('PENDING','FAILED');
