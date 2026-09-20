-- Fase 12: social graph (follows/blocks/mutes), comments, reactions, privacy, invites.
-- Writes via service_role (same pattern as cms_overrides / content_reports).

-- ---------------------------------------------------------------------------
-- Privacy on social_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_profile text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_workouts text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_prs text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_weight text NOT NULL DEFAULT 'private';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_photos text NOT NULL DEFAULT 'private';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_nutrition text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_profile_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_profile_check
      CHECK (privacy_profile IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_workouts_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_workouts_check
      CHECK (privacy_workouts IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_prs_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_prs_check
      CHECK (privacy_prs IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_weight_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_weight_check
      CHECK (privacy_weight IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_photos_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_photos_check
      CHECK (privacy_photos IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_nutrition_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_nutrition_check
      CHECK (privacy_nutrition IN ('public', 'friends', 'private'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT social_follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS social_follows_following_idx ON public.social_follows (following_id);

CREATE TABLE IF NOT EXISTS public.social_blocks (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT social_blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS social_blocks_blocked_idx ON public.social_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS public.social_mutes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_id),
  CONSTRAINT social_mutes_no_self CHECK (user_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  hidden_by text,
  CONSTRAINT activity_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 280)
);
CREATE INDEX IF NOT EXISTS activity_comments_event_idx
  ON public.activity_comments (event_id, created_at);

CREATE TABLE IF NOT EXISTS public.activity_reactions (
  event_id uuid NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fire', 'muscle', 'clap', 'trophy', 'heart')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS activity_reactions_user_idx ON public.activity_reactions (user_id);

CREATE TABLE IF NOT EXISTS public.feed_dismissals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_user_id, kind)
);

CREATE TABLE IF NOT EXISTS public.challenge_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id text NOT NULL,
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_invites_no_self CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS challenge_invites_pending_unique
  ON public.challenge_invites (challenge_id, from_user_id, to_user_id)
  WHERE status = 'pending';

-- Backfill kudos → fire reactions when we can resolve user_id
INSERT INTO public.activity_reactions (event_id, user_id, kind)
SELECT k.event_id, COALESCE(sp.app_user_id, d.user_id), 'fire'
FROM public.activity_kudos k
LEFT JOIN public.social_profiles sp ON sp.device_id = k.device_id
LEFT JOIN public.devices d ON d.device_id = k.device_id
WHERE COALESCE(sp.app_user_id, d.user_id) IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Reports: allow comment | user besides activity_event
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_kind_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_kind_check
  CHECK (target_kind IN ('activity_event', 'comment', 'user'));

-- RLS: service_role only
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'social_follows',
    'social_blocks',
    'social_mutes',
    'activity_comments',
    'activity_reactions',
    'feed_dismissals',
    'challenge_invites'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

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
      'comment_unhide'
    )
  );
