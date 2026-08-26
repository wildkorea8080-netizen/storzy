ALTER TABLE admin_auth_events DROP CONSTRAINT admin_auth_events_event_type_check;
ALTER TABLE admin_auth_events ADD CONSTRAINT admin_auth_events_event_type_check
  CHECK (event_type IN ('LOGIN_SUCCEEDED','LOGIN_FAILED','LOGIN_RATE_LIMITED','LOGOUT','REVOKE_SESSION','REVOKE_ALL','RETENTION_CLEANUP'));
