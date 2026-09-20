-- Admin Console v1: remote CMS overrides + audit log (service_role only)

CREATE TABLE IF NOT EXISTS public.cms_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('exercise', 'meal')),
  entity_id text NOT NULL,
  media_url text,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'pin-admin',
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS cms_overrides_entity_idx
  ON public.cms_overrides (entity_type, entity_id);

ALTER TABLE public.cms_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cms_overrides FROM anon, authenticated;
GRANT ALL ON TABLE public.cms_overrides TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke'
    )
  ),
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'pin-admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;
