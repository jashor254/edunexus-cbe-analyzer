-- Backs the developer-platform integration flow (app/api/v1/integrations in
-- edunexus-devportal) — a developer/school connects an existing system
-- (Google Classroom, Teams, LTI, Canvas, Moodle, SSO, custom webhook/API) so
-- its data can feed the intelligence layer. Table was missing entirely,
-- causing every call to this endpoint to fail with a raw DB error.

CREATE TABLE IF NOT EXISTS integration_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id      uuid NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  integration_type  text NOT NULL CHECK (integration_type IN (
                       'google_classroom', 'microsoft_teams', 'lti_1_3', 'canvas',
                       'moodle', 'sso_saml', 'sso_oidc', 'custom_webhook', 'custom_api'
                     )),
  name              text NOT NULL,
  config            jsonb NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_developer_id
  ON integration_connections (developer_id);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage own integration connections"
  ON integration_connections FOR ALL
  USING (auth.uid() = developer_id)
  WITH CHECK (auth.uid() = developer_id);
