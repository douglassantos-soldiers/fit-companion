-- Identity + Customer 360 (safe, non-destructive)
-- App identity (public.users) is distinct from auth.users.

-- ===== 1. Identity core =====
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_customer_id TEXT NOT NULL,
  external_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_customer_id)
);

CREATE INDEX IF NOT EXISTS customer_identities_user_id_idx
  ON public.customer_identities (user_id);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  platform TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices (user_id);

-- ===== 2. Backfill users/devices from existing device_ids =====
DO $$
DECLARE
  d TEXT;
  uid UUID;
  em TEXT;
  cid TEXT;
BEGIN
  FOR d IN
    SELECT DISTINCT device_id FROM (
      SELECT device_id FROM public.profiles
      UNION SELECT device_id FROM public.app_state
      UNION SELECT device_id FROM public.app_entitlements
      UNION SELECT device_id FROM public.sessions
    ) x
    WHERE device_id IS NOT NULL AND length(device_id) > 0
  LOOP
    IF EXISTS (SELECT 1 FROM public.devices WHERE device_id = d) THEN
      CONTINUE;
    END IF;

    SELECT e.email, e.shopify_customer_id INTO em, cid
    FROM public.app_entitlements e
    WHERE e.device_id = d
    LIMIT 1;

    IF em IS NOT NULL AND length(trim(em)) > 0 THEN
      SELECT u.id INTO uid FROM public.users u WHERE lower(u.email) = lower(em) LIMIT 1;
      IF uid IS NULL THEN
        INSERT INTO public.users (email) VALUES (lower(trim(em)))
        RETURNING id INTO uid;
      END IF;
    ELSE
      INSERT INTO public.users DEFAULT VALUES RETURNING id INTO uid;
    END IF;

    INSERT INTO public.devices (user_id, device_id, platform)
    VALUES (uid, d, 'web')
    ON CONFLICT (device_id) DO NOTHING;

    IF cid IS NOT NULL AND length(trim(cid)) > 0 THEN
      INSERT INTO public.customer_identities (user_id, provider, external_customer_id, external_email)
      VALUES (uid, 'shopify', trim(cid), em)
      ON CONFLICT (provider, external_customer_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            external_email = COALESCE(EXCLUDED.external_email, public.customer_identities.external_email),
            updated_at = now();
    END IF;
  END LOOP;
END $$;

-- Safer email identity backfill (no nested insert)
INSERT INTO public.users (email)
SELECT DISTINCT lower(trim(ae.email))
FROM public.app_entitlement_emails ae
WHERE ae.email IS NOT NULL AND length(trim(ae.email)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE lower(u.email) = lower(trim(ae.email))
  );

INSERT INTO public.customer_identities (user_id, provider, external_customer_id, external_email)
SELECT u.id, 'shopify', ae.shopify_customer_id, ae.email
FROM public.app_entitlement_emails ae
JOIN public.users u ON lower(u.email) = lower(ae.email)
WHERE ae.shopify_customer_id IS NOT NULL
  AND length(trim(ae.shopify_customer_id)) > 0
ON CONFLICT (provider, external_customer_id) DO NOTHING;

-- ===== 3. user_id columns on domain tables =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.weights ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.supplement_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.app_state ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.engagement_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

UPDATE public.profiles p SET user_id = d.user_id
FROM public.devices d WHERE p.device_id = d.device_id AND p.user_id IS NULL;
UPDATE public.sessions s SET user_id = d.user_id
FROM public.devices d WHERE s.device_id = d.device_id AND s.user_id IS NULL;
UPDATE public.weights w SET user_id = d.user_id
FROM public.devices d WHERE w.device_id = d.device_id AND w.user_id IS NULL;
UPDATE public.daily_metrics m SET user_id = d.user_id
FROM public.devices d WHERE m.device_id = d.device_id AND m.user_id IS NULL;
UPDATE public.supplement_logs s SET user_id = d.user_id
FROM public.devices d WHERE s.device_id = d.device_id AND s.user_id IS NULL;
UPDATE public.app_state a SET user_id = d.user_id
FROM public.devices d WHERE a.device_id = d.device_id AND a.user_id IS NULL;
UPDATE public.engagement_events e SET user_id = d.user_id
FROM public.devices d WHERE e.device_id = d.device_id AND e.user_id IS NULL;

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS weights_user_id_idx ON public.weights (user_id);
CREATE INDEX IF NOT EXISTS daily_metrics_user_id_idx ON public.daily_metrics (user_id);
CREATE INDEX IF NOT EXISTS supplement_logs_user_id_idx ON public.supplement_logs (user_id);
CREATE INDEX IF NOT EXISTS app_state_user_id_idx ON public.app_state (user_id);
CREATE INDEX IF NOT EXISTS engagement_events_user_id_idx ON public.engagement_events (user_id);

-- ===== 4. Orders + order_items =====
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shopify_order_id TEXT NOT NULL,
  ordered_at TIMESTAMPTZ,
  total NUMERIC(12, 2),
  currency TEXT DEFAULT 'BRL',
  financial_status TEXT,
  fulfillment_status TEXT,
  channel TEXT DEFAULT 'shopify',
  email TEXT,
  shopify_customer_id TEXT,
  raw_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shopify_order_id)
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_ordered_at_idx ON public.orders (ordered_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT,
  variant_id TEXT,
  product_title TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2),
  total_price NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items (product_id);

-- ===== 5. user_events =====
CREATE TABLE IF NOT EXISTS public.user_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'app',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_events_idempotency_unique
  ON public.user_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_events_user_type_idx
  ON public.user_events (user_id, event_type, occurred_at DESC);

-- ===== 6. Shopify webhook idempotency + sync cursors =====
CREATE TABLE IF NOT EXISTS public.shopify_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT,
  topic TEXT NOT NULL,
  shop_domain TEXT,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payload_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_webhook_events_webhook_id_unique
  ON public.shopify_webhook_events (webhook_id)
  WHERE webhook_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shopify_sync_cursors (
  id TEXT PRIMARY KEY,
  cursor_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 7. customer_profiles (derived) =====
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_purchase_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC(14, 2) NOT NULL DEFAULT 0,
  average_order_value NUMERIC(12, 2),
  purchase_frequency_days NUMERIC(10, 2),
  favorite_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  favorite_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_goal TEXT,
  performance_level TEXT,
  training_frequency NUMERIC(6, 2),
  nutrition_adherence NUMERIC(6, 2),
  recovery_score NUMERIC(6, 2),
  estimated_ltv NUMERIC(14, 2),
  estimated_next_purchase TIMESTAMPTZ,
  restock_estimates JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 8. meal_entries =====
CREATE TABLE IF NOT EXISTS public.meal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT,
  meal_type TEXT,
  protein_g NUMERIC(8, 2),
  carbs_g NUMERIC(8, 2),
  fat_g NUMERIC(8, 2),
  kcal NUMERIC(8, 2),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);

CREATE INDEX IF NOT EXISTS meal_entries_user_date_idx ON public.meal_entries (user_id, date);
CREATE INDEX IF NOT EXISTS meal_entries_device_date_idx ON public.meal_entries (device_id, date);

-- ===== 9. user_patterns (learning) =====
CREATE TABLE IF NOT EXISTS public.user_patterns (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 10. RLS: service_role for new sensitive tables =====
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'customer_identities',
    'devices',
    'orders',
    'order_items',
    'user_events',
    'shopify_webhook_events',
    'shopify_sync_cursors',
    'customer_profiles',
    'meal_entries',
    'user_patterns'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- meal_entries: allow device-scoped client sync (interim, same model as core tables)
GRANT SELECT, INSERT, UPDATE ON TABLE public.meal_entries TO anon, authenticated;
DROP POLICY IF EXISTS meal_entries_all ON public.meal_entries;
CREATE POLICY meal_entries_all ON public.meal_entries
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
