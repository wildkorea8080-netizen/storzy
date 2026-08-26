BEGIN;
CREATE TABLE process_heartbeats(
  role text NOT NULL,
  instance_id text NOT NULL,
  process_type text NOT NULL CHECK(process_type IN('service','worker','scheduler')),
  status text NOT NULL CHECK(status IN('RUNNING','SUCCEEDED','FAILED','STOPPED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error text,
  PRIMARY KEY(role,instance_id)
);
CREATE INDEX process_heartbeats_role_latest ON process_heartbeats(role,heartbeat_at DESC);
COMMIT;
