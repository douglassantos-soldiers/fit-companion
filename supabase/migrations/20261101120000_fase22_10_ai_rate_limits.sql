-- FASE 22.10 — Distributed AI rate limit buckets (atomic consume + TTL)
-- service_role only. Never expose to anon/authenticated.

CREATE TABLE IF NOT EXISTS public.ai_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_rate_limit_buckets_expires_idx
  ON public.ai_rate_limit_buckets (expires_at);

ALTER TABLE public.ai_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON public.ai_rate_limit_buckets TO service_role;

COMMENT ON TABLE public.ai_rate_limit_buckets IS
  'FASE22.10: distributed fixed-window rate/cost counters (service_role only).';

/**
 * Atomic consume (or peek). Fixed window with TTL.
 * Returns jsonb: allowed, remaining, limit, reset_at_ms, retry_after_sec, count
 */
CREATE OR REPLACE FUNCTION public.ai_rate_limit_consume(
  p_key TEXT,
  p_limit INT,
  p_window_ms BIGINT,
  p_amount INT DEFAULT 1,
  p_peek BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.ai_rate_limit_buckets%ROWTYPE;
  v_amount INT := GREATEST(COALESCE(p_amount, 1), 0);
  v_limit INT := GREATEST(COALESCE(p_limit, 1), 1);
  v_window_ms BIGINT := GREATEST(COALESCE(p_window_ms, 60000), 1);
  v_expires TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_count INT;
  v_remaining INT;
  v_retry INT;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', v_limit,
      'reset_at_ms', (extract(epoch from v_now) * 1000)::bigint,
      'retry_after_sec', 60,
      'count', 0,
      'error', 'empty_key'
    );
  END IF;

  -- Opportunistic cleanup of expired rows (cheap, best-effort)
  DELETE FROM public.ai_rate_limit_buckets
  WHERE expires_at < v_now - interval '1 hour'
    AND bucket_key = p_key;

  SELECT * INTO v_row
  FROM public.ai_rate_limit_buckets
  WHERE bucket_key = p_key
  FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at <= v_now THEN
    v_expires := v_now + (v_window_ms || ' milliseconds')::interval;
    v_count := CASE WHEN p_peek THEN 0 ELSE v_amount END;
    IF p_peek THEN
      v_allowed := v_amount <= v_limit;
    ELSE
      IF v_amount > v_limit THEN
        v_allowed := false;
        v_count := 0;
      ELSE
        v_allowed := true;
        INSERT INTO public.ai_rate_limit_buckets (bucket_key, count, window_started_at, expires_at)
        VALUES (p_key, v_amount, v_now, v_expires)
        ON CONFLICT (bucket_key) DO UPDATE
          SET count = EXCLUDED.count,
              window_started_at = EXCLUDED.window_started_at,
              expires_at = EXCLUDED.expires_at;
      END IF;
    END IF;
  ELSE
    v_expires := v_row.expires_at;
    IF p_peek THEN
      v_count := v_row.count;
      v_allowed := (v_row.count + v_amount) <= v_limit;
    ELSE
      IF (v_row.count + v_amount) <= v_limit THEN
        UPDATE public.ai_rate_limit_buckets
        SET count = count + v_amount
        WHERE bucket_key = p_key
          AND count + v_amount <= v_limit
        RETURNING count INTO v_count;
        IF FOUND THEN
          v_allowed := true;
        ELSE
          v_allowed := false;
          v_count := v_row.count;
        END IF;
      ELSE
        v_allowed := false;
        v_count := v_row.count;
      END IF;
    END IF;
  END IF;

  v_remaining := GREATEST(v_limit - v_count, 0);
  v_retry := GREATEST(ceil(extract(epoch from (v_expires - v_now))), 1)::int;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'limit', v_limit,
    'reset_at_ms', (extract(epoch from v_expires) * 1000)::bigint,
    'retry_after_sec', v_retry,
    'count', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) IS
  'FASE22.10: atomic fixed-window rate/cost consume (or peek) for AI distributed limits.';
