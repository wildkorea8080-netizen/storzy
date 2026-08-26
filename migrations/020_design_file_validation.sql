BEGIN;
ALTER TABLE design_assets
  ADD COLUMN mime_type text,
  ADD COLUMN size_bytes bigint,
  ADD COLUMN validated_at timestamptz;
ALTER TABLE design_assets ADD CONSTRAINT design_assets_validated_file CHECK (
  (mime_type IS NULL AND size_bytes IS NULL AND validated_at IS NULL)
  OR (mime_type IN ('image/png','image/jpeg') AND size_bytes > 0 AND size_bytes <= 52428800 AND validated_at IS NOT NULL)
);
COMMIT;
