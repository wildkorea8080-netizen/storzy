BEGIN;
CREATE UNIQUE INDEX integration_connections_unique_connected_printful_store
  ON integration_connections((metadata->>'storeId'))
  WHERE provider='PRINTFUL' AND status='CONNECTED' AND metadata ? 'storeId';
COMMIT;
