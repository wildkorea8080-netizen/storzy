BEGIN;
ALTER TABLE integration_connection_actions ADD COLUMN reason text;
ALTER TABLE integration_connection_actions ADD CONSTRAINT integration_connection_actions_reason CHECK (
  action IN ('CONNECTED','CREDENTIALS_ROTATED') OR length(reason) BETWEEN 1 AND 500
);
COMMIT;
