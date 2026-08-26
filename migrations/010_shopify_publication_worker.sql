BEGIN;
ALTER TABLE shopify_publication_jobs
  ADD COLUMN locked_by text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN shopify_product_id text,
  ADD COLUMN request_payload jsonb,
  ADD COLUMN response_payload jsonb,
  ADD CONSTRAINT shopify_publication_lock_consistency CHECK (
    (status='RUNNING' AND locked_by IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status<>'RUNNING' AND locked_by IS NULL AND lease_expires_at IS NULL)
  );
COMMIT;
