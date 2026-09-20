-- PHASE 2 Nutrition Intelligence — food catalog + meal_items
-- meal_entries remains Meal SoT; meal_items are composed foods.
-- Catalog: read-only for authenticated; not user-editable.
-- User-owned: meal_items with owner policies.

-- ===== meal_entries: fiber_g =====
ALTER TABLE public.meal_entries
  ADD COLUMN IF NOT EXISTS fiber_g NUMERIC;

-- ===== Catalog tables =====
CREATE TABLE IF NOT EXISTS public.food_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('taco', 'user', 'imported', 'ai_estimate', 'internal')),
  serving_reference TEXT NOT NULL DEFAULT 's-100g',
  active BOOLEAN NOT NULL DEFAULT true,
  confidence NUMERIC NOT NULL DEFAULT 0.85,
  synonyms TEXT[] NOT NULL DEFAULT '{}',
  per100g JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.food_nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id TEXT NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  nutrient_key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('taco', 'user', 'imported', 'ai_estimate', 'internal')),
  kind TEXT NOT NULL DEFAULT 'observed'
    CHECK (kind IN ('observed', 'derived', 'estimated')),
  confidence NUMERIC NOT NULL DEFAULT 0.85,
  UNIQUE (food_id, nutrient_key, source)
);

CREATE TABLE IF NOT EXISTS public.food_servings (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grams_equivalent NUMERIC NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS food_items_name_idx ON public.food_items (name);
CREATE INDEX IF NOT EXISTS food_items_category_idx ON public.food_items (category);
CREATE INDEX IF NOT EXISTS food_items_active_idx ON public.food_items (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS food_nutrients_food_idx ON public.food_nutrients (food_id);
CREATE INDEX IF NOT EXISTS food_servings_food_idx ON public.food_servings (food_id);

CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  servings NUMERIC NOT NULL DEFAULT 1,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('facil', 'medio', 'dificil')),
  total_macros JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('taco', 'user', 'imported', 'ai_estimate', 'internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES public.food_items(id),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  grams NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS recipe_items_recipe_idx ON public.recipe_items (recipe_id);

-- ===== User-owned meal_items =====
CREATE TABLE IF NOT EXISTS public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL,
  meal_client_id TEXT NOT NULL,
  food_id TEXT,
  food_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'g',
  grams NUMERIC NOT NULL DEFAULT 0,
  nutrient_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('taco', 'user', 'imported', 'ai_estimate', 'internal')),
  source_kind TEXT NOT NULL DEFAULT 'informed'
    CHECK (source_kind IN ('informed', 'estimated')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS meal_items_user_meal_idx ON public.meal_items (user_id, meal_client_id);
CREATE INDEX IF NOT EXISTS meal_items_user_idx ON public.meal_items (user_id);

-- ===== RLS: catalog (SELECT authenticated, no user writes) =====
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.food_items FROM anon, authenticated;
REVOKE ALL ON public.food_nutrients FROM anon, authenticated;
REVOKE ALL ON public.food_servings FROM anon, authenticated;
REVOKE ALL ON public.recipes FROM anon, authenticated;
REVOKE ALL ON public.recipe_items FROM anon, authenticated;

GRANT ALL ON public.food_items TO service_role;
GRANT ALL ON public.food_nutrients TO service_role;
GRANT ALL ON public.food_servings TO service_role;
GRANT ALL ON public.recipes TO service_role;
GRANT ALL ON public.recipe_items TO service_role;

GRANT SELECT ON public.food_items TO authenticated;
GRANT SELECT ON public.food_nutrients TO authenticated;
GRANT SELECT ON public.food_servings TO authenticated;
GRANT SELECT ON public.recipes TO authenticated;
GRANT SELECT ON public.recipe_items TO authenticated;

DROP POLICY IF EXISTS food_items_read ON public.food_items;
CREATE POLICY food_items_read ON public.food_items
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS food_nutrients_read ON public.food_nutrients;
CREATE POLICY food_nutrients_read ON public.food_nutrients
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS food_servings_read ON public.food_servings;
CREATE POLICY food_servings_read ON public.food_servings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS recipes_read ON public.recipes;
CREATE POLICY recipes_read ON public.recipes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS recipe_items_read ON public.recipe_items;
CREATE POLICY recipe_items_read ON public.recipe_items
  FOR SELECT TO authenticated USING (true);

-- ===== RLS: meal_items (owner) =====
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meal_items FROM anon, authenticated;
GRANT ALL ON public.meal_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;

DROP POLICY IF EXISTS meal_items_owner_select ON public.meal_items;
CREATE POLICY meal_items_owner_select ON public.meal_items
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS meal_items_owner_write ON public.meal_items;
CREATE POLICY meal_items_owner_write ON public.meal_items
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- ===== Seed subset (Soldiers internal — full catalog lives in src/data/foods.ts) =====
INSERT INTO public.food_items (id, name, category, source, serving_reference, confidence, synonyms, per100g)
VALUES
  ('arroz-branco-cozido', 'Arroz branco cozido', 'cereais', 'internal', 's-100g', 0.85, ARRAY['arroz','arroz branco'], '{"energyKcal":128,"proteinG":2.5,"carbG":28.1,"fatG":0.2,"fiberG":1.6}'::jsonb),
  ('feijao-carioca-cozido', 'Feijão carioca cozido', 'leguminosas', 'internal', 's-100g', 0.85, ARRAY['feijão','feijao'], '{"energyKcal":76,"proteinG":4.8,"carbG":13.6,"fatG":0.5,"fiberG":8.5}'::jsonb),
  ('frango-peito-grelhado', 'Peito de frango grelhado', 'aves', 'internal', 's-100g', 0.85, ARRAY['frango','peito de frango'], '{"energyKcal":159,"proteinG":32,"carbG":0,"fatG":2.5}'::jsonb),
  ('ovo-cozido', 'Ovo de galinha cozido', 'ovos', 'internal', 's-unidade', 0.85, ARRAY['ovo','ovos'], '{"energyKcal":146,"proteinG":13.3,"carbG":0.6,"fatG":9.5}'::jsonb),
  ('banana-prata', 'Banana-prata', 'frutas', 'internal', 's-unidade', 0.85, ARRAY['banana'], '{"energyKcal":98,"proteinG":1.3,"carbG":26,"fatG":0.1,"fiberG":2}'::jsonb),
  ('batata-doce-cozida', 'Batata-doce cozida', 'tuberculos', 'internal', 's-100g', 0.85, ARRAY['batata doce'], '{"energyKcal":77,"proteinG":0.6,"carbG":18.4,"fatG":0.1,"fiberG":2.2}'::jsonb),
  ('whey-protein', 'Whey protein (concentrado)', 'suplementos', 'internal', 's-scoop', 0.85, ARRAY['whey','proteína'], '{"energyKcal":380,"proteinG":80,"carbG":6,"fatG":4}'::jsonb),
  ('leite-desnatado', 'Leite desnatado', 'laticinios', 'internal', 's-200ml', 0.85, ARRAY['leite desnatado'], '{"energyKcal":35,"proteinG":3.4,"carbG":5,"fatG":0.2}'::jsonb),
  ('pao-frances', 'Pão francês', 'cereais', 'internal', 's-unidade', 0.85, ARRAY['pão','pao'], '{"energyKcal":300,"proteinG":8,"carbG":58.6,"fatG":3.1,"fiberG":2.3}'::jsonb),
  ('iogurte-natural', 'Iogurte natural', 'laticinios', 'internal', 's-pote', 0.85, ARRAY['iogurte'], '{"energyKcal":51,"proteinG":4.1,"carbG":4,"fatG":2}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.food_servings (id, food_id, label, grams_equivalent, is_default) VALUES
  ('arroz-branco-cozido:s-100g', 'arroz-branco-cozido', '100 g', 100, true),
  ('arroz-branco-cozido:s-xicara', 'arroz-branco-cozido', '1 xícara', 160, false),
  ('feijao-carioca-cozido:s-100g', 'feijao-carioca-cozido', '100 g', 100, true),
  ('frango-peito-grelhado:s-100g', 'frango-peito-grelhado', '100 g', 100, true),
  ('frango-peito-grelhado:s-file', 'frango-peito-grelhado', '1 filé', 120, false),
  ('ovo-cozido:s-unidade', 'ovo-cozido', '1 unidade', 50, true),
  ('banana-prata:s-unidade', 'banana-prata', '1 unidade média', 100, true),
  ('batata-doce-cozida:s-100g', 'batata-doce-cozida', '100 g', 100, true),
  ('whey-protein:s-scoop', 'whey-protein', '1 scoop (30 g)', 30, true),
  ('leite-desnatado:s-200ml', 'leite-desnatado', '1 copo (200 ml)', 200, true),
  ('pao-frances:s-unidade', 'pao-frances', '1 unidade', 50, true),
  ('iogurte-natural:s-pote', 'iogurte-natural', '1 pote (170 g)', 170, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.food_nutrients (food_id, nutrient_key, value, unit, source, kind, confidence)
SELECT f.id, n.key, n.val, n.unit, 'internal', 'observed', 0.85
FROM public.food_items f
CROSS JOIN LATERAL (
  VALUES
    ('energyKcal', (f.per100g->>'energyKcal')::numeric, 'kcal'),
    ('proteinG', (f.per100g->>'proteinG')::numeric, 'g'),
    ('carbG', (f.per100g->>'carbG')::numeric, 'g'),
    ('fatG', (f.per100g->>'fatG')::numeric, 'g')
) AS n(key, val, unit)
WHERE f.id IN (
  'arroz-branco-cozido','feijao-carioca-cozido','frango-peito-grelhado','ovo-cozido',
  'banana-prata','batata-doce-cozida','whey-protein','leite-desnatado','pao-frances','iogurte-natural'
)
ON CONFLICT (food_id, nutrient_key, source) DO NOTHING;

INSERT INTO public.recipes (id, name, servings, prep_minutes, cook_minutes, difficulty, tags, source, total_macros)
VALUES (
  'recipe-frango-arroz-feijao',
  'Frango, arroz e feijão',
  1, 10, 25, 'facil',
  ARRAY['almoco','jantar','proteina'],
  'internal',
  '{"energyKcal":480,"proteinG":55,"carbG":56,"fatG":5,"fiberG":10}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recipe_items (recipe_id, food_id, quantity, unit, grams)
SELECT 'recipe-frango-arroz-feijao', x.food_id, x.quantity, x.unit, x.grams
FROM (VALUES
  ('frango-peito-grelhado', 150, 'g', 150),
  ('arroz-branco-cozido', 150, 'g', 150),
  ('feijao-carioca-cozido', 100, 'g', 100)
) AS x(food_id, quantity, unit, grams)
WHERE NOT EXISTS (
  SELECT 1 FROM public.recipe_items ri
  WHERE ri.recipe_id = 'recipe-frango-arroz-feijao' AND ri.food_id = x.food_id
);
