BEGIN;

CREATE OR REPLACE FUNCTION suspend_order_automation_on_integration_loss()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  suspension_reason text;
BEGIN
  IF OLD.status = 'CONNECTED' AND NEW.status IN ('DISCONNECTED', 'REAUTH_REQUIRED') THEN
    suspension_reason := CASE
      WHEN NEW.status = 'REAUTH_REQUIRED' THEN NEW.provider || ' 재인증 필요로 자동 중지'
      ELSE NEW.provider || ' 연결 해제로 자동 중지'
    END;

    UPDATE workspace_order_automation_controls
       SET enabled = false,
           approved_by = NULL,
           approved_at = NULL,
           reason = suspension_reason,
           updated_at = now()
     WHERE workspace_id = NEW.workspace_id
       AND enabled = true;

    IF FOUND THEN
      INSERT INTO workspace_order_automation_actions(id, workspace_id, action, actor_id, reason)
      VALUES (gen_random_uuid(), NEW.workspace_id, 'DISABLE', COALESCE(NULLIF(NEW.updated_by, ''), 'integration-safety-gate'), suspension_reason);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS integration_loss_suspends_order_automation ON integration_connections;
CREATE TRIGGER integration_loss_suspends_order_automation
AFTER UPDATE OF status ON integration_connections
FOR EACH ROW
EXECUTE FUNCTION suspend_order_automation_on_integration_loss();

COMMIT;
