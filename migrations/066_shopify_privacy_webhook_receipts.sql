CREATE TABLE shopify_privacy_webhook_receipts (
  id uuid PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  request_id uuid REFERENCES shopify_privacy_requests(id) ON DELETE SET NULL,
  webhook_id text NOT NULL UNIQUE,
  topic text NOT NULL CHECK (topic IN ('CUSTOMERS_DATA_REQUEST','CUSTOMERS_REDACT','SHOP_REDACT')),
  shop_domain text NOT NULL,
  last_outcome text NOT NULL CHECK (last_outcome IN ('ACCEPTED','DUPLICATE')),
  delivery_count integer NOT NULL DEFAULT 1 CHECK (delivery_count > 0),
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopify_privacy_webhook_receipts_workspace_recent ON shopify_privacy_webhook_receipts(workspace_id,last_received_at DESC);

CREATE OR REPLACE FUNCTION redact_shopify_privacy_webhook_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.request_type='SHOP_REDACT' AND OLD.workspace_id IS NOT NULL AND NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE shopify_privacy_webhook_receipts
    SET workspace_id=NULL,webhook_id='redacted:'||id::text,shop_domain='redacted.invalid'
    WHERE workspace_id=OLD.workspace_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shopify_privacy_webhook_receipts_redaction
BEFORE UPDATE OF status ON shopify_privacy_requests
FOR EACH ROW EXECUTE FUNCTION redact_shopify_privacy_webhook_receipts();
