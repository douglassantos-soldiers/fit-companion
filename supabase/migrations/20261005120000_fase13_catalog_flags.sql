-- Fase 13: catalog license flag. TACO rows in food_items are ignored unless taco_license_verified.
-- Writes via service_role (same pattern as cms_overrides / food catalog).

CREATE TABLE IF NOT EXISTS public.catalog_settings (
  id text PRIMARY KEY DEFAULT 'default',
  taco_license_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_settings (id, taco_license_verified)
VALUES ('default', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.catalog_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.catalog_settings TO service_role;
