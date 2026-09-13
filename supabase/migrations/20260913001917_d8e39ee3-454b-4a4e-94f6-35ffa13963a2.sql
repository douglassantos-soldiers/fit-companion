CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  device_id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'saude',
  level TEXT NOT NULL DEFAULT 'iniciante',
  days_per_week INTEGER NOT NULL DEFAULT 3,
  age INTEGER NOT NULL DEFAULT 30,
  height_cm INTEGER NOT NULL DEFAULT 175,
  weight_kg NUMERIC NOT NULL DEFAULT 75,
  equipment TEXT NOT NULL DEFAULT 'academia',
  restrictions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_device_access" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  day_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT current_date,
  duration_min INTEGER NOT NULL DEFAULT 0,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  volume_kg NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_device_access" ON public.sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX sessions_device_idx ON public.sessions (device_id, date DESC);

CREATE TABLE public.weights (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weights TO anon, authenticated;
GRANT ALL ON public.weights TO service_role;
ALTER TABLE public.weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weights_device_access" ON public.weights FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_weights_updated_at BEFORE UPDATE ON public.weights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_metrics (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  water_ml INTEGER NOT NULL DEFAULT 0,
  meals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_metrics TO anon, authenticated;
GRANT ALL ON public.daily_metrics TO service_role;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_metrics_device_access" ON public.daily_metrics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON public.daily_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supplement_logs (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  supplement_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_logs TO anon, authenticated;
GRANT ALL ON public.supplement_logs TO service_role;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_logs_device_access" ON public.supplement_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_supplement_logs_updated_at BEFORE UPDATE ON public.supplement_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.app_state (
  device_id TEXT NOT NULL PRIMARY KEY,
  supplement_routine TEXT[] NOT NULL DEFAULT '{}',
  challenges TEXT[] NOT NULL DEFAULT '{}',
  chat JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_state_device_access" ON public.app_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_app_state_updated_at BEFORE UPDATE ON public.app_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();