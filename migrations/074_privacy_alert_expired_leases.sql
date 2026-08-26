CREATE INDEX privacy_alert_deliveries_expired_lease
  ON privacy_alert_deliveries(lease_expires_at)
  WHERE status='RUNNING';

CREATE INDEX privacy_maintenance_alert_deliveries_expired_lease
  ON privacy_maintenance_alert_deliveries(lease_expires_at)
  WHERE status='RUNNING';
