CREATE OR REPLACE FUNCTION redact_shopify_privacy_webhook_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.request_type='SHOP_REDACT' AND OLD.workspace_id IS NOT NULL AND NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE shopify_privacy_webhook_receipts
    SET workspace_id=NULL,webhook_id='redacted:'||id::text,shop_domain='redacted.invalid'
    WHERE workspace_id=OLD.workspace_id;
    UPDATE shopify_app_uninstall_receipts
    SET workspace_id=NULL,connection_id=NULL,webhook_id='redacted:'||id::text,shop_domain='redacted.invalid'
    WHERE workspace_id=OLD.workspace_id;
  END IF;
  RETURN NEW;
END $$;
