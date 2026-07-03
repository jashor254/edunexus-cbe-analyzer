-- ═══════════════════════════════════════════════════════════════════════════════
-- EduNexus Phase 8 — Cloud Platform Foundation
-- 2026-07-01
--
-- Transforms EduNexus into a multi-tenant cloud platform.
--
-- Phase 8.1 — Multi-tenancy
--   organizations          → top-level tenant entity
--   organization_hierarchy → parent/child tree (schools → districts → counties)
--
-- Phase 8.2 — Organization IAM
--   organization_members   → user ↔ org with role
--   organization_roles     → custom RBAC roles per org (+ system roles)
--   organization_invitations → email-based team invitations
--   audit_logs             → immutable event trail
--   api_keys               → per-org API key management
--
-- Phase 8.3 — Billing Foundation
--   subscription_plans     → plan definitions
--   organization_subscriptions → org ↔ active plan
--   usage_events           → per-request metering
--   usage_quotas           → quota limits per plan
--   invoices               → billing records
--
-- Phase 8.4 — Event Bus
--   platform_events        → all platform events (publish side)
--   event_subscriptions    → route events to handlers
--   event_deliveries       → delivery attempts + DLQ
--
-- Phase 8.5 — Background Jobs
--   job_queues             → named queues
--   jobs                   → job records with status, retries, payload
--   job_logs               → per-attempt execution logs
--
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.1 — MULTI-TENANCY
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE org_type AS ENUM (
  'school', 'district', 'county', 'ministry',
  'publisher', 'university', 'ngo', 'developer'
);

CREATE TYPE org_status AS ENUM (
  'active', 'trial', 'suspended', 'churned', 'pending_verification'
);

CREATE TABLE IF NOT EXISTS organizations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  slug                text        NOT NULL UNIQUE,
  type                org_type    NOT NULL,
  parent_id           uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  status              org_status  NOT NULL DEFAULT 'trial',
  -- Branding
  logo_url            text,
  primary_color       text        DEFAULT '#4F46E5',
  website             text,
  country             text        NOT NULL DEFAULT 'KE',
  timezone            text        NOT NULL DEFAULT 'Africa/Nairobi',
  locale              text        NOT NULL DEFAULT 'en-KE',
  currency            text        NOT NULL DEFAULT 'KES',
  -- API access
  api_quota_daily     int         NOT NULL DEFAULT 500,
  api_quota_monthly   int         NOT NULL DEFAULT 10000,
  -- Flexible settings per org type
  settings            jsonb       NOT NULL DEFAULT '{}',
  metadata            jsonb       NOT NULL DEFAULT '{}',
  trial_ends_at       timestamptz DEFAULT (now() + interval '30 days'),
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_type      ON organizations (type);
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations (parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status    ON organizations (status);
CREATE INDEX IF NOT EXISTS idx_organizations_slug      ON organizations (slug);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can see their own org(s)
CREATE POLICY "organizations_member_read"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Only owners/admins can update
CREATE POLICY "organizations_admin_update"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- Link existing schools to organizations
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_organization_id ON schools (organization_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.2 — ORGANIZATION IAM
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8.2.1  CUSTOM ROLES ──────────────────────────────────────────────────────
-- organization_id = NULL means it's a system-defined role available to all orgs.

CREATE TABLE IF NOT EXISTS organization_roles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  is_system       boolean     NOT NULL DEFAULT false,
  -- Array of permission strings: ["org:read", "members:invite", "api:use", ...]
  permissions     text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_organization_id ON organization_roles (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_roles_is_system       ON organization_roles (is_system) WHERE is_system = true;

ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_roles_member_read"
  ON organization_roles FOR SELECT
  USING (
    is_system = true OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_roles.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "org_roles_admin_manage"
  ON organization_roles FOR ALL
  USING (
    NOT is_system AND
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_roles.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- Seed system roles (runs once; UNIQUE constraint prevents duplicates)
INSERT INTO organization_roles (organization_id, name, description, is_system, permissions) VALUES
  (NULL, 'owner',         'Full organization control',        true, ARRAY[
    'org:read','org:update','org:delete','org:transfer',
    'members:invite','members:remove','members:update_role',
    'billing:read','billing:update',
    'api:use','api:manage',
    'schools:manage','analytics:read','audit:read','roles:manage'
  ]),
  (NULL, 'admin',         'Manage org settings and members',  true, ARRAY[
    'org:read','org:update',
    'members:invite','members:remove','members:update_role',
    'billing:read',
    'api:use','api:manage',
    'schools:manage','analytics:read','audit:read','roles:manage'
  ]),
  (NULL, 'member',        'Standard org member',              true, ARRAY[
    'org:read','api:use','analytics:read'
  ]),
  (NULL, 'billing_admin', 'Manage subscriptions and invoices', true, ARRAY[
    'org:read','billing:read','billing:update'
  ]),
  (NULL, 'developer',     'API access only',                  true, ARRAY[
    'org:read','api:use','api:manage'
  ]),
  (NULL, 'viewer',        'Read-only access',                 true, ARRAY[
    'org:read','analytics:read'
  ])
ON CONFLICT (organization_id, name) DO NOTHING;


-- ── 8.2.2  MEMBERS ───────────────────────────────────────────────────────────

CREATE TYPE member_status AS ENUM ('active', 'suspended', 'removed');

CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text          NOT NULL DEFAULT 'member',
  status          member_status NOT NULL DEFAULT 'active',
  invited_by      uuid          REFERENCES auth.users(id),
  joined_at       timestamptz,
  last_active_at  timestamptz,
  metadata        jsonb         NOT NULL DEFAULT '{}',
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id         ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role            ON organization_members (role);
CREATE INDEX IF NOT EXISTS idx_org_members_status          ON organization_members (status);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Members see their own record + fellow members in the same org
CREATE POLICY "org_members_self_read"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "org_members_peer_read"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Owners/admins can manage members
CREATE POLICY "org_members_admin_manage"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );


-- ── 8.2.3  INVITATIONS ───────────────────────────────────────────────────────

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE IF NOT EXISTS organization_invitations (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text              NOT NULL,
  role            text              NOT NULL DEFAULT 'member',
  token           text              NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid              NOT NULL REFERENCES auth.users(id),
  status          invitation_status NOT NULL DEFAULT 'pending',
  expires_at      timestamptz       NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     timestamptz,
  accepted_by     uuid              REFERENCES auth.users(id),
  message         text,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email           ON organization_invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_token           ON organization_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_status          ON organization_invitations (status);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Admins see all invitations for their org
CREATE POLICY "invitations_admin_read"
  ON organization_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_invitations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

CREATE POLICY "invitations_admin_manage"
  ON organization_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_invitations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );


-- ── 8.2.4  AUDIT LOGS ────────────────────────────────────────────────────────
-- Immutable — no UPDATE or DELETE policies.

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text        NOT NULL,     -- 'member.invited', 'role.updated', 'api_key.created'
  resource_type   text        NOT NULL,     -- 'organization', 'member', 'invitation', 'api_key'
  resource_id     text,                     -- the affected record id
  old_values      jsonb,
  new_values      jsonb,
  ip_address      inet,
  user_agent      text,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id         ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action          ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource        ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at      ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Members with audit:read permission can view (enforced in app layer via role check)
CREATE POLICY "audit_logs_admin_read"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = audit_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- Only service role can insert (app layer writes audit entries)
-- No DELETE policy — audit logs are immutable


-- ── 8.2.5  API KEYS ──────────────────────────────────────────────────────────

CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');

CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid           NOT NULL REFERENCES auth.users(id),
  name            text           NOT NULL,
  description     text,
  key_prefix      text           NOT NULL,          -- first 8 chars for display: "en_live_"
  key_hash        text           NOT NULL UNIQUE,   -- SHA-256 of the full key — NEVER store plaintext
  scopes          text[]         NOT NULL DEFAULT '{"api:use"}',
  status          api_key_status NOT NULL DEFAULT 'active',
  last_used_at    timestamptz,
  expires_at      timestamptz,
  rate_limit_rpm  int            NOT NULL DEFAULT 60,  -- requests per minute
  rate_limit_rpd  int            NOT NULL DEFAULT 1000, -- requests per day
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys (organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash        ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status          ON api_keys (status);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_member_read"
  ON api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = api_keys.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "api_keys_developer_manage"
  ON api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = api_keys.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
        AND om.status = 'active'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.3 — BILLING FOUNDATION
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8.3.1  SUBSCRIPTION PLANS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL UNIQUE,  -- 'free', 'starter', 'pro', 'enterprise'
  display_name        text        NOT NULL,
  description         text,
  price_monthly_kes   int         NOT NULL DEFAULT 0,
  price_annual_kes    int         NOT NULL DEFAULT 0,
  -- Quotas included in plan
  api_quota_daily     int         NOT NULL DEFAULT 100,
  api_quota_monthly   int         NOT NULL DEFAULT 1000,
  ai_token_quota      int         NOT NULL DEFAULT 0,
  max_members         int         NOT NULL DEFAULT 5,
  max_schools         int         NOT NULL DEFAULT 1,
  -- Feature flags
  features            text[]      NOT NULL DEFAULT '{}',
  -- Stripe / Paystack price IDs for future integration
  paystack_plan_code  text,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  is_active           boolean     NOT NULL DEFAULT true,
  sort_order          int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans
  (name, display_name, description, price_monthly_kes, price_annual_kes,
   api_quota_daily, api_quota_monthly, ai_token_quota, max_members, max_schools,
   features, sort_order)
VALUES
  ('free', 'Free', 'For individuals and small pilots',
   0, 0, 100, 1000, 10, 3, 1,
   ARRAY['basic_api','teacher_tools'], 0),
  ('starter', 'Starter', 'For individual schools',
   1999, 19990, 1000, 20000, 100, 10, 3,
   ARRAY['basic_api','teacher_tools','ai_generation','analytics'], 1),
  ('pro', 'Pro', 'For districts and networks',
   7999, 79990, 10000, 200000, 1000, 50, 20,
   ARRAY['basic_api','teacher_tools','ai_generation','analytics',
         'bulk_export','whatsapp','custom_branding','priority_support'], 2),
  ('enterprise', 'Enterprise', 'For counties and ministries',
   0, 0, 100000, 2000000, 10000, 500, 1000,
   ARRAY['basic_api','teacher_tools','ai_generation','analytics',
         'bulk_export','whatsapp','custom_branding','priority_support',
         'sla','dedicated_support','sso','audit_logs','custom_roles'], 3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans_public_read"
  ON subscription_plans FOR SELECT USING (is_active = true);


-- ── 8.3.2  ORGANIZATION SUBSCRIPTIONS ────────────────────────────────────────

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'unpaid'
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                  uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid                NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id             uuid                NOT NULL REFERENCES subscription_plans(id),
  status              subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz        NOT NULL DEFAULT now(),
  current_period_end  timestamptz         NOT NULL DEFAULT (now() + interval '30 days'),
  trial_end           timestamptz,
  canceled_at         timestamptz,
  -- External billing reference (Paystack subscription code)
  external_id         text,
  metadata            jsonb               NOT NULL DEFAULT '{}',
  created_at          timestamptz         NOT NULL DEFAULT now(),
  updated_at          timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_subs_organization_id ON organization_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_plan_id         ON organization_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_status          ON organization_subscriptions (status);

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_subs_admin_read"
  ON organization_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_subscriptions.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );


-- ── 8.3.3  USAGE EVENTS (metering) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id      uuid        REFERENCES api_keys(id) ON DELETE SET NULL,
  event_type      text        NOT NULL,   -- 'api.request', 'ai.completion', 'report.generated'
  resource        text,                   -- endpoint or feature name
  quantity        int         NOT NULL DEFAULT 1,
  cost_tokens     int         NOT NULL DEFAULT 0,
  cost_units      numeric(10,4) NOT NULL DEFAULT 0,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_organization_id ON usage_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type      ON usage_events (event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_recorded_at     ON usage_events (recorded_at DESC);

-- Usage events are write-only for users; reads via aggregation views
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_events_admin_read"
  ON usage_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = usage_events.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'billing_admin')
        AND om.status = 'active'
    )
  );


-- ── 8.3.4  INVOICES ──────────────────────────────────────────────────────────

CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     uuid           REFERENCES organization_subscriptions(id),
  status              invoice_status NOT NULL DEFAULT 'draft',
  amount_kes          int            NOT NULL DEFAULT 0,
  tax_kes             int            NOT NULL DEFAULT 0,
  total_kes           int            NOT NULL DEFAULT 0,
  currency            text           NOT NULL DEFAULT 'KES',
  period_start        timestamptz    NOT NULL,
  period_end          timestamptz    NOT NULL,
  due_date            timestamptz,
  paid_at             timestamptz,
  external_id         text,           -- Paystack transaction reference
  line_items          jsonb          NOT NULL DEFAULT '[]',
  metadata            jsonb          NOT NULL DEFAULT '{}',
  created_at          timestamptz    NOT NULL DEFAULT now(),
  updated_at          timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status          ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at      ON invoices (created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_billing_read"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = invoices.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'billing_admin')
        AND om.status = 'active'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.4 — EVENT BUS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8.4.1  PLATFORM EVENTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text        NOT NULL,   -- 'teacher.sow.generated', 'student.assessment.completed'
  event_version   text        NOT NULL DEFAULT '1.0',
  organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type   text        NOT NULL,
  resource_id     text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  -- Idempotency: prevent duplicate events for the same action
  idempotency_key text        UNIQUE,
  published_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_event_type      ON platform_events (event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_organization_id ON platform_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_resource        ON platform_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_published_at    ON platform_events (published_at DESC);

-- Partition hint for future time-based partitioning
COMMENT ON TABLE platform_events IS 'append-only; candidate for pg_partman time partitioning at scale';

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_events_admin_read"
  ON platform_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = platform_events.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );


-- ── 8.4.2  EVENT SUBSCRIPTIONS ───────────────────────────────────────────────

CREATE TYPE sub_delivery_method AS ENUM ('webhook', 'internal', 'email', 'whatsapp');

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_pattern   text                NOT NULL,   -- 'teacher.*', 'student.assessment.*'
  delivery_method sub_delivery_method NOT NULL DEFAULT 'webhook',
  endpoint_url    text,               -- for webhook delivery
  handler_name    text,               -- for internal delivery (maps to lib/events/handlers/)
  is_active       boolean             NOT NULL DEFAULT true,
  -- Retry policy
  max_retries     int                 NOT NULL DEFAULT 3,
  retry_delay_ms  int                 NOT NULL DEFAULT 1000,
  -- Filtering
  filter_expr     jsonb               NOT NULL DEFAULT '{}',
  created_at      timestamptz         NOT NULL DEFAULT now(),
  updated_at      timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_subs_organization_id ON event_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_event_subs_event_pattern   ON event_subscriptions (event_pattern);
CREATE INDEX IF NOT EXISTS idx_event_subs_is_active       ON event_subscriptions (is_active) WHERE is_active = true;

ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_subs_admin_manage"
  ON event_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = event_subscriptions.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
        AND om.status = 'active'
    )
  );


-- ── 8.4.3  EVENT DELIVERIES (DLQ + retries) ──────────────────────────────────

CREATE TYPE delivery_status AS ENUM (
  'pending', 'processing', 'delivered', 'failed', 'dead_letter'
);

CREATE TABLE IF NOT EXISTS event_deliveries (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid            NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  subscription_id     uuid            NOT NULL REFERENCES event_subscriptions(id) ON DELETE CASCADE,
  status              delivery_status NOT NULL DEFAULT 'pending',
  attempt_count       int             NOT NULL DEFAULT 0,
  max_attempts        int             NOT NULL DEFAULT 3,
  next_attempt_at     timestamptz     NOT NULL DEFAULT now(),
  last_attempted_at   timestamptz,
  last_response_code  int,
  last_response_body  text,
  error_message       text,
  delivered_at        timestamptz,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_deliveries_event_id        ON event_deliveries (event_id);
CREATE INDEX IF NOT EXISTS idx_event_deliveries_subscription_id ON event_deliveries (subscription_id);
CREATE INDEX IF NOT EXISTS idx_event_deliveries_status          ON event_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_event_deliveries_next_attempt    ON event_deliveries (next_attempt_at) WHERE status IN ('pending', 'failed');

ALTER TABLE event_deliveries ENABLE ROW LEVEL SECURITY;
-- Only service role processes deliveries; admins can read for debugging
CREATE POLICY "event_deliveries_admin_read"
  ON event_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_subscriptions es
      JOIN organization_members om ON om.organization_id = es.organization_id
      WHERE es.id = event_deliveries.subscription_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'developer')
        AND om.status = 'active'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.5 — BACKGROUND JOBS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8.5.1  JOB QUEUES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_queues (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,
  description     text,
  concurrency     int         NOT NULL DEFAULT 1,
  max_retries     int         NOT NULL DEFAULT 3,
  timeout_ms      int         NOT NULL DEFAULT 30000,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO job_queues (name, description, concurrency, max_retries, timeout_ms) VALUES
  ('ai.generation',       'AI content generation (SOW, lessons, assessments)', 3, 2, 120000),
  ('report.generation',   'PDF report generation',                             5, 3, 60000),
  ('data.import',         'Bulk data imports',                                 2, 3, 300000),
  ('data.export',         'Bulk data exports',                                 2, 3, 300000),
  ('email.send',          'Transactional email delivery',                      10, 5, 10000),
  ('whatsapp.send',       'WhatsApp message delivery',                         5, 5, 15000),
  ('analytics.aggregate', 'Analytics aggregation jobs',                        2, 3, 600000),
  ('webhook.deliver',     'Outbound webhook delivery',                         10, 5, 10000)
ON CONFLICT (name) DO NOTHING;


-- ── 8.5.2  JOBS ──────────────────────────────────────────────────────────────

CREATE TYPE job_status AS ENUM (
  'queued', 'processing', 'completed', 'failed', 'canceled', 'dead_letter'
);

CREATE TABLE IF NOT EXISTS jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name      text        NOT NULL REFERENCES job_queues(name),
  organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type            text        NOT NULL,       -- 'ai.sow.generate', 'report.academic_clinic'
  status          job_status  NOT NULL DEFAULT 'queued',
  priority        int         NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  payload         jsonb       NOT NULL DEFAULT '{}',
  result          jsonb,
  error_message   text,
  attempt_count   int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 3,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Idempotency key prevents duplicate job submission
  idempotency_key text        UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_name      ON jobs (queue_name, status, priority DESC, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id ON jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id         ON jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status          ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_type            ON jobs (type);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at    ON jobs (scheduled_at) WHERE status = 'queued';

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_user_read"
  ON jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "jobs_admin_read"
  ON jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = jobs.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );


-- ── 8.5.3  JOB LOGS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt     int         NOT NULL DEFAULT 1,
  level       text        NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  message     text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id     ON job_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs (created_at DESC);

ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_logs_user_read"
  ON job_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_logs.job_id AND j.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- UTILITY FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at on all new tables
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','organization_roles','organization_members',
    'organization_invitations','api_keys',
    'subscription_plans','organization_subscriptions','invoices',
    'event_subscriptions','event_deliveries',
    'job_queues','jobs'
  ] LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%1$s_updated_at
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- AGGREGATE VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Daily API usage per org (used by quota enforcement)
CREATE OR REPLACE VIEW org_daily_usage AS
SELECT
  organization_id,
  event_type,
  date_trunc('day', recorded_at) AS day,
  SUM(quantity)     AS total_quantity,
  SUM(cost_tokens)  AS total_tokens,
  SUM(cost_units)   AS total_cost
FROM usage_events
WHERE recorded_at >= now() - interval '90 days'
GROUP BY organization_id, event_type, date_trunc('day', recorded_at);

-- Pending jobs count per queue (for monitoring)
CREATE OR REPLACE VIEW queue_depth AS
SELECT
  queue_name,
  COUNT(*) FILTER (WHERE status = 'queued')      AS queued,
  COUNT(*) FILTER (WHERE status = 'processing')  AS processing,
  COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
  COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
  MIN(scheduled_at) FILTER (WHERE status = 'queued') AS oldest_queued_at
FROM jobs
GROUP BY queue_name;
