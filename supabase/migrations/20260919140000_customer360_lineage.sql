-- Customer 360 lineage columns (flat metrics + JSON metrics for estimates/lineage)
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS supplement_adherence NUMERIC(6, 2);

CREATE INDEX IF NOT EXISTS customer_profiles_shopify_customer_id_idx
  ON public.customer_profiles (shopify_customer_id)
  WHERE shopify_customer_id IS NOT NULL;

COMMENT ON COLUMN public.customer_profiles.shopify_customer_id IS
  'Denormalized Shopify customer id from customer_identities (provider=shopify).';
COMMENT ON COLUMN public.customer_profiles.supplement_adherence IS
  '30d supplement adherence (0-1); detailed estimates/lineage live in metrics JSON.';
COMMENT ON COLUMN public.customer_profiles.metrics IS
  'JSON: performance/nutrition/recovery/behavior/supplements + lineage + estimates (kind=estimate).';
COMMENT ON COLUMN public.customer_profiles.restock_estimates IS
  'Derived restock estimates (kind=estimate). Source of truth vs entitlement order_snapshot.';
