-- Fase 6 Soldiers Media Governance
-- Additive: status machine, variants/regions, checksums, CMS authorization.
-- No new media tables. Does not generate 800 assets.

ALTER TABLE public.soldiers_media
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS animation_spec jsonb,
  ADD COLUMN IF NOT EXISTS checksums jsonb;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.soldiers_media'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.soldiers_media DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

UPDATE public.soldiers_media
SET status = 'draft'
WHERE status = 'pending';

ALTER TABLE public.soldiers_media
  ADD CONSTRAINT soldiers_media_status_check
  CHECK (
    status IN ('draft', 'generated', 'qa', 'approved', 'published', 'rejected', 'archived')
  );

ALTER TABLE public.soldiers_media DROP CONSTRAINT IF EXISTS soldiers_media_pkey;
ALTER TABLE public.soldiers_media
  ADD PRIMARY KEY (kind, entity_id, version, variant, region);

CREATE UNIQUE INDEX IF NOT EXISTS soldiers_media_one_published_default_uidx
  ON public.soldiers_media (kind, entity_id, region)
  WHERE status = 'published' AND variant = 'default';

CREATE INDEX IF NOT EXISTS soldiers_media_kind_entity_status_idx
  ON public.soldiers_media (kind, entity_id, status);

COMMENT ON COLUMN public.soldiers_media.variant IS
  'A/B visual slot. Resolver v1 uses default only.';
COMMENT ON COLUMN public.soldiers_media.region IS
  'Regional variant. Resolver v1 uses global only.';
COMMENT ON COLUMN public.soldiers_media.checksums IS
  'sha256 hex per asset key: poster, thumbnail, webm, mp4, gif.';

ALTER TABLE public.cms_overrides
  ADD COLUMN IF NOT EXISTS authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorized_by text;

COMMENT ON COLUMN public.cms_overrides.authorized IS
  'When true AND URL is Soldiers-owned, CMS may fill a production gap (never beats published Soldiers media).';

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
      'user_suspend',
      'user_ban',
      'user_unsuspend',
      'catalog_exercise_save',
      'catalog_challenge_save',
      'training_rules_save',
      'content_item_save',
      'content_item_delete',
      'content_report_resolve',
      'activity_hide',
      'activity_unhide',
      'comment_hide',
      'comment_unhide',
      'shopify_customers_import',
      'media_status_change'
    )
  );
