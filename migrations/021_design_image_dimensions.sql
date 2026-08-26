BEGIN;
ALTER TABLE design_assets ADD COLUMN width_px integer, ADD COLUMN height_px integer;
ALTER TABLE design_assets ADD CONSTRAINT design_assets_image_dimensions CHECK (
  (validated_at IS NULL AND width_px IS NULL AND height_px IS NULL)
  OR (validated_at IS NOT NULL AND width_px BETWEEN 1 AND 20000 AND height_px BETWEEN 1 AND 20000)
);
COMMIT;
