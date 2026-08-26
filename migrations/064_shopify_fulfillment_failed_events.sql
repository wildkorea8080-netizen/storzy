BEGIN;
ALTER TABLE shopify_fulfillment_job_events DROP CONSTRAINT shopify_fulfillment_job_events_event_type_check;
ALTER TABLE shopify_fulfillment_job_events ADD CONSTRAINT shopify_fulfillment_job_events_event_type_check CHECK(event_type IN ('CREATED','RECOVERED','FAILED'));
ALTER TABLE shopify_fulfillment_job_events ADD COLUMN detail text;
ALTER TABLE shopify_fulfillment_job_events ALTER COLUMN shopify_fulfillment_id DROP NOT NULL;
COMMIT;
