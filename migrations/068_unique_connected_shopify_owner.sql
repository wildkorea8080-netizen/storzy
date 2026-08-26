CREATE UNIQUE INDEX integration_connections_unique_connected_shopify_account
ON integration_connections(lower(account_label))
WHERE provider='SHOPIFY' AND status='CONNECTED';
