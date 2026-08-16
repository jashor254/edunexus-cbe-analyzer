-- Recovered from production migrations 20260701015329-20260701043142
-- (devportal_developer_profiles, devportal_projects, devportal_api_keys,
-- devportal_usage_and_requests, devportal_usage_increment_fn,
-- add_webhook_deliveries_and_secret, phase4_api_views_and_indexes [partial],
-- webhook_secret_raw_and_retry). Exact statement text via H1M-R2. No repo
-- files exist for these. Needed because 20260706_integration_connections.sql
-- (a real repo file) references developer_profiles.

CREATE TABLE IF NOT EXISTS public.developer_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  name         text NOT NULL,
  organization text,
  avatar_url   text,
  tier         text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','starter','pro','enterprise')),
  bio          text,
  website      text,
  github_username text,
  onboarded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can read own profile"
  ON public.developer_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Developers can update own profile"
  ON public.developer_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Developers can insert own profile"
  ON public.developer_profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER developer_profiles_updated_at
  BEFORE UPDATE ON public.developer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_developer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.developer_profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_developer();

CREATE TABLE IF NOT EXISTS public.developer_projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.developer_profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  environment  text NOT NULL DEFAULT 'development' CHECK (environment IN ('development','production')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developer_projects_developer_id ON public.developer_projects(developer_id);

ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage own projects"
  ON public.developer_projects FOR ALL
  USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

CREATE TRIGGER developer_projects_updated_at
  BEFORE UPDATE ON public.developer_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.developer_api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES public.developer_profiles(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.developer_projects(id) ON DELETE SET NULL,
  name            text NOT NULL,
  key_hash        text NOT NULL UNIQUE,
  key_prefix      text NOT NULL,
  environment     text NOT NULL DEFAULT 'test' CHECK (environment IN ('test','live')),
  scopes          text[] NOT NULL DEFAULT ARRAY['read'],
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),
  rate_limit_rpm  integer NOT NULL DEFAULT 60,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_developer_id ON public.developer_api_keys(developer_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_project_id   ON public.developer_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_key_hash      ON public.developer_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_status        ON public.developer_api_keys(status);

ALTER TABLE public.developer_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage own api keys"
  ON public.developer_api_keys FOR ALL
  USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

CREATE TRIGGER developer_api_keys_updated_at
  BEFORE UPDATE ON public.developer_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.developer_usage_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id  uuid NOT NULL REFERENCES public.developer_profiles(id) ON DELETE CASCADE,
  api_key_id    uuid REFERENCES public.developer_api_keys(id) ON DELETE SET NULL,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  requests      integer NOT NULL DEFAULT 0,
  tokens_used   integer NOT NULL DEFAULT 0,
  errors        integer NOT NULL DEFAULT 0,
  latency_p50   integer,
  latency_p99   integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (developer_id, api_key_id, date)
);

CREATE INDEX IF NOT EXISTS idx_dev_usage_daily_developer_id ON public.developer_usage_daily(developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_usage_daily_date         ON public.developer_usage_daily(date);

ALTER TABLE public.developer_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers read own usage"
  ON public.developer_usage_daily FOR SELECT USING (auth.uid() = developer_id);

CREATE TRIGGER developer_usage_daily_updated_at
  BEFORE UPDATE ON public.developer_usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.developer_request_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id  uuid NOT NULL REFERENCES public.developer_profiles(id) ON DELETE CASCADE,
  api_key_id    uuid REFERENCES public.developer_api_keys(id) ON DELETE SET NULL,
  method        text NOT NULL,
  path          text NOT NULL,
  status_code   integer NOT NULL,
  latency_ms    integer,
  tokens_used   integer,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_request_logs_developer_id ON public.developer_request_logs(developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_request_logs_created_at   ON public.developer_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_request_logs_api_key_id   ON public.developer_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_dev_request_logs_key_time     ON public.developer_request_logs(api_key_id, created_at DESC);

ALTER TABLE public.developer_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers read own request logs"
  ON public.developer_request_logs FOR SELECT USING (auth.uid() = developer_id);

CREATE TABLE IF NOT EXISTS public.developer_webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id  uuid NOT NULL REFERENCES public.developer_profiles(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES public.developer_projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  url           text NOT NULL,
  secret_hash   text NOT NULL,
  events        text[] NOT NULL DEFAULT ARRAY['*'],
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_ping_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  secret_prefix text,
  failure_count integer NOT NULL DEFAULT 0,
  secret_raw    text
);

CREATE INDEX IF NOT EXISTS idx_developer_webhooks_developer_id ON public.developer_webhooks(developer_id);
CREATE INDEX IF NOT EXISTS idx_developer_webhooks_project_id   ON public.developer_webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_developer_webhooks_developer_status ON public.developer_webhooks(developer_id, status);

ALTER TABLE public.developer_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage own webhooks"
  ON public.developer_webhooks FOR ALL
  USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);

CREATE TRIGGER developer_webhooks_updated_at
  BEFORE UPDATE ON public.developer_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.devportal_record_request(
  p_developer_id uuid, p_api_key_id uuid, p_method text, p_path text,
  p_status_code integer, p_latency_ms integer DEFAULT NULL,
  p_tokens_used integer DEFAULT 0, p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.developer_request_logs
    (developer_id, api_key_id, method, path, status_code, latency_ms, tokens_used, ip_address, user_agent)
  VALUES (p_developer_id, p_api_key_id, p_method, p_path, p_status_code, p_latency_ms, p_tokens_used, p_ip_address, p_user_agent);

  INSERT INTO public.developer_usage_daily
    (developer_id, api_key_id, date, requests, tokens_used, errors, latency_p50)
  VALUES (p_developer_id, p_api_key_id, CURRENT_DATE, 1, p_tokens_used,
    CASE WHEN p_status_code >= 400 THEN 1 ELSE 0 END, p_latency_ms)
  ON CONFLICT (developer_id, api_key_id, date) DO UPDATE SET
    requests = developer_usage_daily.requests + 1,
    tokens_used = developer_usage_daily.tokens_used + p_tokens_used,
    errors = developer_usage_daily.errors + CASE WHEN p_status_code >= 400 THEN 1 ELSE 0 END,
    latency_p50 = CASE WHEN p_latency_ms IS NOT NULL
      THEN ROUND(COALESCE(developer_usage_daily.latency_p50, p_latency_ms) * 0.9 + p_latency_ms * 0.1)
      ELSE developer_usage_daily.latency_p50 END,
    updated_at = now();

  UPDATE public.developer_api_keys SET last_used_at = now() WHERE id = p_api_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.devportal_record_request FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.developer_webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid NOT NULL REFERENCES public.developer_webhooks(id) ON DELETE CASCADE,
  developer_id    uuid NOT NULL,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  response_status integer,
  response_body   text,
  latency_ms      integer,
  success         boolean NOT NULL DEFAULT false,
  attempt         integer NOT NULL DEFAULT 1,
  next_retry_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id  ON public.developer_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_developer_id ON public.developer_webhook_deliveries(developer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at  ON public.developer_webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
  ON public.developer_webhook_deliveries (success, next_retry_at) WHERE success = false AND next_retry_at IS NOT NULL;

ALTER TABLE public.developer_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers see own deliveries"
  ON public.developer_webhook_deliveries FOR ALL USING (developer_id = auth.uid());
