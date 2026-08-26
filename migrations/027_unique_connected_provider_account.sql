BEGIN;
CREATE UNIQUE INDEX integration_connections_unique_connected_account
  ON integration_connections(provider, lower(account_label))
  WHERE status='CONNECTED';
COMMIT;
