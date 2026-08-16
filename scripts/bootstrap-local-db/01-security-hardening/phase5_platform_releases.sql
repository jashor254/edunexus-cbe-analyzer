-- db_security_hardening_phase5_platform_releases (prod 20260702141911)
CREATE TABLE IF NOT EXISTS public.platform_releases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version          text        NOT NULL,
  channel          text        NOT NULL DEFAULT 'stable',
  title            text        NOT NULL,
  summary          text,
  changes          jsonb       NOT NULL DEFAULT '[]',
  breaking_changes jsonb       NOT NULL DEFAULT '[]',
  migration_guide  text,
  published_at     timestamptz,
  deprecated_at    timestamptz,
  sunset_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_releases: public read" ON public.platform_releases
  FOR SELECT USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "platform_releases: deny writes" ON public.platform_releases
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_platform_releases_channel        ON public.platform_releases(channel);
CREATE INDEX IF NOT EXISTS idx_platform_releases_published_at   ON public.platform_releases(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_platform_releases_version        ON public.platform_releases(version);
