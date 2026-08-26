BEGIN;

CREATE TABLE product_content_revisions (
  id uuid PRIMARY KEY,
  product_content_id uuid NOT NULL REFERENCES product_contents(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  content_data jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('AI', 'EDITOR')),
  status text NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  created_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (product_content_id, revision),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
);

CREATE UNIQUE INDEX product_content_one_approved_revision
  ON product_content_revisions (product_content_id) WHERE status = 'APPROVED';

CREATE TABLE shopify_publication_jobs (
  id uuid PRIMARY KEY,
  content_revision_id uuid NOT NULL UNIQUE REFERENCES product_content_revisions(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  correlation_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX shopify_publication_jobs_pending ON shopify_publication_jobs (available_at, created_at) WHERE status = 'PENDING';

COMMIT;
