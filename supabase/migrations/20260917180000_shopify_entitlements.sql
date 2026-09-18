-- Shopify purchase entitlements (permanent access after any paid order)

CREATE TABLE IF NOT EXISTS public.app_entitlements (
  device_id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  shopify_customer_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'shopify_order',
  order_count INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_entitlements_email_idx ON public.app_entitlements (lower(email));

ALTER TABLE public.app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_entitlements_all" ON public.app_entitlements;
CREATE POLICY "app_entitlements_all" ON public.app_entitlements
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_entitlements TO anon, authenticated;
GRANT ALL ON public.app_entitlements TO service_role;
