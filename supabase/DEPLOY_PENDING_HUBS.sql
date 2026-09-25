-- Creator Hubs MVP (consumer): seeded Performance Hubs
--
-- !!! DO NOT RUN after FASE1/FASE2 security harden !!!
-- This script grants anon/authenticated ALL + USING(true) on hubs.
-- Use versioned migrations under supabase/migrations/ instead.
--
CREATE TABLE IF NOT EXISTS public.hubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  creator_name TEXT NOT NULL DEFAULT 'Soldiers',
  avatar_url TEXT,
  cover_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubs TO anon, authenticated;
GRANT ALL ON public.hubs TO service_role;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hubs_access ON public.hubs;
CREATE POLICY hubs_access ON public.hubs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.hub_challenges (
  hub_id UUID NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hub_id, challenge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_challenges TO anon, authenticated;
GRANT ALL ON public.hub_challenges TO service_role;
ALTER TABLE public.hub_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_challenges_access ON public.hub_challenges;
CREATE POLICY hub_challenges_access ON public.hub_challenges FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS hub_challenges_challenge_idx ON public.hub_challenges (challenge_id);

CREATE TABLE IF NOT EXISTS public.hub_members (
  hub_id UUID NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_members TO anon, authenticated;
GRANT ALL ON public.hub_members TO service_role;
ALTER TABLE public.hub_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_members_access ON public.hub_members;
CREATE POLICY hub_members_access ON public.hub_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS hub_members_device_idx ON public.hub_members (device_id);

-- Seed: Soldiers Performance Hub
INSERT INTO public.hubs (id, slug, name, tagline, creator_name, active)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'soldiers-performance',
  'Soldiers Performance Hub',
  'Consistência e evolução com a marca Soldiers — ranking por %.',
  'Soldiers',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  creator_name = EXCLUDED.creator_name,
  active = EXCLUDED.active;

INSERT INTO public.hub_challenges (hub_id, challenge_id, sort) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'evolucao-consistencia-14', 0),
  ('a1000000-0000-4000-8000-000000000001', 'consistencia-21', 1)
ON CONFLICT DO NOTHING;

-- Seed: Projeto Massa 60d
INSERT INTO public.hubs (id, slug, name, tagline, creator_name, active)
VALUES (
  'a1000000-0000-4000-8000-000000000002',
  'projeto-massa-60',
  'Projeto Massa 60d',
  '60 dias de hipertrofia com ranking relativo — hub seed Soldiers.',
  'Soldiers Coach',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  creator_name = EXCLUDED.creator_name,
  active = EXCLUDED.active;

INSERT INTO public.hub_challenges (hub_id, challenge_id, sort) VALUES
  ('a1000000-0000-4000-8000-000000000002', 'hub-massa-60', 0),
  ('a1000000-0000-4000-8000-000000000002', 'evolucao-volume-21', 1)
ON CONFLICT DO NOTHING;
