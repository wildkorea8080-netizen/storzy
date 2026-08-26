BEGIN;

CREATE OR REPLACE FUNCTION hold_queued_printful_orders_on_automation_stop()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.enabled = true AND NEW.enabled = false THEN
    WITH held AS (
      UPDATE printful_order_jobs
         SET status = 'HELD', last_error = 'ORDER_AUTOMATION_SUSPENDED', finished_at = now(), locked_by = NULL, lease_expires_at = NULL
       WHERE workspace_id = NEW.workspace_id
         AND status IN ('PENDING_DRAFT', 'WAITING_COST', 'READY_CONFIRM')
      RETURNING commerce_order_id
    )
    UPDATE commerce_orders o
       SET status = 'HELD',
           decision_reasons = CASE WHEN o.decision_reasons @> '["ORDER_AUTOMATION_SUSPENDED"]'::jsonb THEN o.decision_reasons ELSE o.decision_reasons || '["ORDER_AUTOMATION_SUSPENDED"]'::jsonb END,
           updated_at = now()
     WHERE o.id IN (SELECT commerce_order_id FROM held);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_automation_stop_holds_queued_jobs
AFTER UPDATE OF enabled ON workspace_order_automation_controls
FOR EACH ROW EXECUTE FUNCTION hold_queued_printful_orders_on_automation_stop();

CREATE OR REPLACE FUNCTION guard_printful_queue_when_automation_stopped()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('PENDING_DRAFT', 'WAITING_COST', 'READY_CONFIRM')
     AND NOT EXISTS (SELECT 1 FROM workspace_order_automation_controls c WHERE c.workspace_id = NEW.workspace_id AND c.enabled = true) THEN
    NEW.status := 'HELD';
    NEW.last_error := 'ORDER_AUTOMATION_SUSPENDED';
    NEW.finished_at := now();
    NEW.locked_by := NULL;
    NEW.lease_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stopped_automation_guards_printful_queue
BEFORE INSERT OR UPDATE OF status ON printful_order_jobs
FOR EACH ROW EXECUTE FUNCTION guard_printful_queue_when_automation_stopped();

COMMIT;
