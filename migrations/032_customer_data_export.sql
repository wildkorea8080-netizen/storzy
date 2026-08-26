BEGIN;
ALTER TABLE shopify_privacy_requests ADD COLUMN last_exported_at timestamptz;
ALTER TABLE shopify_privacy_requests ADD COLUMN last_exported_by text;
ALTER TABLE shopify_privacy_request_actions DROP CONSTRAINT shopify_privacy_request_actions_action_check;
ALTER TABLE shopify_privacy_request_actions ADD CONSTRAINT shopify_privacy_request_actions_action_check CHECK(action IN ('START_REVIEW','LEGAL_HOLD','EXECUTE_CUSTOMER_REDACTION','GENERATE_DATA_EXPORT'));
COMMIT;
