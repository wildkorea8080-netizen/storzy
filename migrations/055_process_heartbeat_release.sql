BEGIN;
ALTER TABLE process_heartbeats ADD COLUMN release text NOT NULL DEFAULT 'unknown';
COMMIT;
