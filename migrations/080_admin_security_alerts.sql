CREATE TABLE admin_security_alerts (
  id uuid PRIMARY KEY,
  alert_type text NOT NULL CHECK (alert_type IN ('LOGIN_RATE_LIMITED')),
  client_digest text NOT NULL CHECK (length(client_digest)=64),
  occurrence_key timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  lease_expires_at timestamptz,
  response_status integer,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alert_type,client_digest,occurrence_key)
);

CREATE OR REPLACE FUNCTION enqueue_admin_security_alert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type='LOGIN_RATE_LIMITED' THEN
    INSERT INTO admin_security_alerts(id,alert_type,client_digest,occurrence_key)
    VALUES(gen_random_uuid(),'LOGIN_RATE_LIMITED',NEW.client_digest,date_bin('15 minutes',NEW.occurred_at,timestamptz '2000-01-01'))
    ON CONFLICT(alert_type,client_digest,occurrence_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER admin_auth_event_security_alert AFTER INSERT ON admin_auth_events
FOR EACH ROW EXECUTE FUNCTION enqueue_admin_security_alert();

CREATE INDEX admin_security_alerts_delivery_idx ON admin_security_alerts(available_at,created_at) WHERE status IN ('PENDING','FAILED');
