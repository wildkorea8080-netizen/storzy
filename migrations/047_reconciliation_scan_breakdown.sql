BEGIN;
ALTER TABLE order_reconciliation_scans
  ADD COLUMN missing_local_order_count integer NOT NULL DEFAULT 0 CHECK(missing_local_order_count>=0),
  ADD COLUMN cancellation_mismatch_count integer NOT NULL DEFAULT 0 CHECK(cancellation_mismatch_count>=0),
  ADD COLUMN financial_status_mismatch_count integer NOT NULL DEFAULT 0 CHECK(financial_status_mismatch_count>=0);

CREATE FUNCTION increment_reconciliation_scan_breakdown() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.scan_id IS DISTINCT FROM NEW.scan_id THEN
    UPDATE order_reconciliation_scans SET
      missing_local_order_count=missing_local_order_count+(NEW.issue_type='MISSING_LOCAL_ORDER')::int,
      cancellation_mismatch_count=cancellation_mismatch_count+(NEW.issue_type='CANCELLATION_MISMATCH')::int,
      financial_status_mismatch_count=financial_status_mismatch_count+(NEW.issue_type='FINANCIAL_STATUS_MISMATCH')::int
    WHERE id=NEW.scan_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER order_reconciliation_scan_breakdown
AFTER INSERT OR UPDATE OF scan_id ON order_reconciliation_issues
FOR EACH ROW EXECUTE FUNCTION increment_reconciliation_scan_breakdown();
COMMIT;
