ALTER TABLE shopify_app_uninstall_receipts
  ADD COLUMN anonymized_at timestamptz;

CREATE INDEX shopify_app_uninstall_receipts_anonymized_at
  ON shopify_app_uninstall_receipts(anonymized_at DESC)
  WHERE anonymized_at IS NOT NULL;
