-- Session RPE / express for Customer 360 reconstruction
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS rpe TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS express BOOLEAN DEFAULT false;
