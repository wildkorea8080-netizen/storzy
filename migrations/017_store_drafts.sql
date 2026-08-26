BEGIN;

CREATE TABLE store_drafts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_profile_revision_id uuid NOT NULL REFERENCES brand_profile_revisions(id),
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED')),
  template_key text NOT NULL CHECK (template_key IN (
    'MINIMAL_FASHION', 'KOREAN_STREET', 'OUTDOOR_LIFESTYLE', 'TOURIST_SOUVENIR', 'CREATOR_MERCHANDISE'
  )),
  config_data jsonb NOT NULL,
  created_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (workspace_id, revision),
  UNIQUE (brand_profile_revision_id)
);

CREATE INDEX store_drafts_workspace_revision ON store_drafts (workspace_id, revision DESC);

COMMIT;
