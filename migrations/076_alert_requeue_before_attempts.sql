ALTER TABLE privacy_alert_delivery_actions
  ADD COLUMN before_attempts integer CHECK(before_attempts>=0);

ALTER TABLE privacy_maintenance_delivery_actions
  ADD COLUMN before_attempts integer CHECK(before_attempts>=0);

ALTER TABLE shopify_token_alert_delivery_actions
  ADD COLUMN before_attempts integer CHECK(before_attempts>=0);
