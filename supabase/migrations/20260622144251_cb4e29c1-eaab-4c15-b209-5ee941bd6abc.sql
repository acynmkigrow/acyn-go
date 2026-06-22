
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- device_profiles
CREATE TABLE public.device_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT 'huawei',
  model TEXT,
  family TEXT NOT NULL CHECK (family IN ('hg','gpon','xpon','olt','switch')),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_profiles TO authenticated;
GRANT ALL ON public.device_profiles TO service_role;
ALTER TABLE public.device_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own device_profiles" ON public.device_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- command_runs
CREATE TABLE public.command_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_profile_id UUID REFERENCES public.device_profiles(id) ON DELETE SET NULL,
  intent TEXT NOT NULL,
  family TEXT,
  commands JSONB NOT NULL DEFAULT '[]'::jsonb,
  output TEXT,
  ok BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_runs TO authenticated;
GRANT ALL ON public.command_runs TO service_role;
ALTER TABLE public.command_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own command_runs" ON public.command_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX command_runs_user_created_idx ON public.command_runs(user_id, created_at DESC);
