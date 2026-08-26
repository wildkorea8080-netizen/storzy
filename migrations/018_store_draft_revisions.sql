BEGIN;

ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_brand_profile_revision_id_key;
ALTER TABLE store_drafts
  ADD COLUMN source text NOT NULL DEFAULT 'GENERATED' CHECK (source IN ('GENERATED', 'EDITOR')),
  ADD COLUMN base_store_draft_id uuid REFERENCES store_drafts(id);

CREATE UNIQUE INDEX store_drafts_one_generated_per_brand_revision
  ON store_drafts (brand_profile_revision_id) WHERE source = 'GENERATED';
CREATE UNIQUE INDEX store_drafts_one_approved_per_workspace
  ON store_drafts (workspace_id) WHERE status = 'APPROVED';

COMMIT;
