BEGIN;
ALTER TABLE design_assets
  ADD COLUMN resolution_status text NOT NULL DEFAULT 'NOT_EVALUATED'
    CHECK (resolution_status IN ('NOT_EVALUATED','PASSED','GUIDELINE_MISSING')),
  ADD COLUMN effective_dpi numeric(10,2),
  ADD COLUMN print_guideline jsonb;
ALTER TABLE design_assets ADD CONSTRAINT design_assets_resolution_result CHECK (
  (resolution_status = 'NOT_EVALUATED' AND effective_dpi IS NULL AND print_guideline IS NULL)
  OR (resolution_status = 'GUIDELINE_MISSING' AND effective_dpi IS NULL AND print_guideline IS NULL)
  OR (resolution_status = 'PASSED' AND effective_dpi >= 150 AND print_guideline IS NOT NULL)
);
COMMIT;
