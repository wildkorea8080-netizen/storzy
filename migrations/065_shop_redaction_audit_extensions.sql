BEGIN;
CREATE OR REPLACE FUNCTION redact_provider_audit_extensions_on_shop_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_workspace uuid := OLD.workspace_id;
BEGIN
  IF target_workspace IS NULL THEN RETURN NEW; END IF;

  UPDATE printful_order_job_events
  SET remote_order_id=NULL,detail=NULL
  WHERE workspace_id=target_workspace;

  UPDATE shopify_fulfillment_job_events
  SET shopify_fulfillment_id=NULL,detail=NULL
  WHERE workspace_id=target_workspace;

  UPDATE shopify_fulfillment_requeue_actions
  SET reason='REDACTED'
  WHERE workspace_id=target_workspace;

  UPDATE printful_draft_cleanup_actions
  SET remote_order_id='redacted:'||id::text,reason='REDACTED'
  WHERE workspace_id=target_workspace;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shop_redaction_audit_extensions
BEFORE UPDATE OF status ON shopify_privacy_requests
FOR EACH ROW
WHEN (
  OLD.request_type='SHOP_REDACT'
  AND OLD.status IS DISTINCT FROM 'COMPLETED'
  AND NEW.status='COMPLETED'
)
EXECUTE FUNCTION redact_provider_audit_extensions_on_shop_completion();
COMMIT;
