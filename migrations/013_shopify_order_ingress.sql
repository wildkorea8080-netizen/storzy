BEGIN;
CREATE TABLE shopify_order_webhook_receipts (
  id uuid PRIMARY KEY,
  webhook_id text NOT NULL UNIQUE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  topic text NOT NULL,
  shop_domain text NOT NULL,
  api_version text,
  payload_digest text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commerce_orders (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  order_name text NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  revenue_minor bigint NOT NULL CHECK (revenue_minor >= 0),
  approved_variable_cost_minor bigint NOT NULL CHECK (approved_variable_cost_minor >= 0),
  current_variable_cost_minor bigint NOT NULL CHECK (current_variable_cost_minor >= 0),
  shipping_country text NOT NULL,
  item_count integer NOT NULL CHECK (item_count >= 0),
  financial_status text NOT NULL,
  status text NOT NULL CHECK (status IN ('READY','WAITING','HELD','ALREADY_PROCESSED')),
  decision_reasons jsonb NOT NULL,
  margin_basis_points integer NOT NULL,
  rule_version text NOT NULL,
  source_webhook_id uuid NOT NULL REFERENCES shopify_order_webhook_receipts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,shopify_order_id)
);
CREATE TABLE commerce_order_lines (
  id uuid PRIMARY KEY,
  commerce_order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  shopify_line_item_id text NOT NULL,
  shopify_product_id text NOT NULL,
  sku text NOT NULL,
  printful_variant_id text,
  candidate_id uuid REFERENCES product_candidates(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_revenue_minor bigint NOT NULL CHECK (unit_revenue_minor >= 0),
  mapping_count integer NOT NULL CHECK (mapping_count >= 0),
  design_present boolean NOT NULL,
  UNIQUE(commerce_order_id,shopify_line_item_id)
);
CREATE INDEX commerce_orders_exception_queue ON commerce_orders(workspace_id,status,created_at) WHERE status IN ('WAITING','HELD');
COMMIT;
