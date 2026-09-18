-- Shopify Companion F1: email-level entitlements, magic link, order snapshot

CREATE TABLE IF NOT EXISTS public.app_entitlement_emails (
  email TEXT NOT NULL PRIMARY KEY,
  shopify_customer_id TEXT,
  order_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  magic_token_hash TEXT,
  magic_expires_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  access_tier TEXT NOT NULL DEFAULT 'base',
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_entitlement_emails_token_hash_idx
  ON public.app_entitlement_emails (magic_token_hash)
  WHERE magic_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_entitlement_emails_customer_idx
  ON public.app_entitlement_emails (shopify_customer_id);

ALTER TABLE public.app_entitlement_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_entitlement_emails_all" ON public.app_entitlement_emails;
CREATE POLICY "app_entitlement_emails_all" ON public.app_entitlement_emails
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_entitlement_emails TO anon, authenticated;
GRANT ALL ON public.app_entitlement_emails TO service_role;

ALTER TABLE public.app_entitlements
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS product_ids TEXT[] NOT NULL DEFAULT '{}';
