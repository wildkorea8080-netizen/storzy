BEGIN;
ALTER TABLE order_reconciliation_scan_export_actions
  ADD COLUMN reason text NOT NULL DEFAULT '이전 버전에서 기록되지 않음' CHECK(char_length(reason) BETWEEN 1 AND 500);
COMMIT;
