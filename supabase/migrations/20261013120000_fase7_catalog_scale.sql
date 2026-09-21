-- Fase 7 — Catalog Scale
-- Additive food_items columns for EAN lookup and internal source versioning.
-- No new food_catalog tables. RLS unchanged.

ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS source_version text;

CREATE UNIQUE INDEX IF NOT EXISTS food_items_ean_unique
  ON public.food_items (ean)
  WHERE ean IS NOT NULL AND btrim(ean) <> '';
