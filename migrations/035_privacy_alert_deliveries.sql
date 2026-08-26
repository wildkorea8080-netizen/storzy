BEGIN;
CREATE TABLE privacy_alert_deliveries (
  id uuid PRIMARY KEY,
  alert_id uuid NOT NULL UNIQUE REFERENCES privacy_sla_alerts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  response_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CHECK((status='RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status<>'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX privacy_alert_deliveries_ready ON privacy_alert_deliveries(available_at,created_at) WHERE status IN ('PENDING','FAILED');
COMMIT;
