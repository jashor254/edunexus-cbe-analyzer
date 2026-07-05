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

DO $$ BEGIN
  CREATE TYPE org_type AS ENUM (
    'school', 'district', 'county', 'ministry',
    'publisher', 'university', 'ngo', 'developer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_status AS ENUM (
    'active', 'trial', 'suspended', 'churned', 'pending_verification'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8.2 — ORGANIZATION IAM
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8.2.2  MEMBERS ───────────────────────────────────────────────────────────
-- Created before organizations'/organization_roles' RLS policies below, since
-- those policies query organization_members in an EXISTS(...) subquery —
-- Postgres resolves those table references at CREATE POLICY time, so the
-- table must already exist.

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('active', 'suspended', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- ── Membership-check helper functions ────────────────────────────────────────
-- SECURITY DEFINER + owned by the migration-executing role (postgres, which
-- has BYPASSRLS in Supabase) so the internal query against
-- organization_members skips RLS entirely. Without this, any policy that
-- checks membership via a subquery on organization_members recurses into
-- organization_members' own RLS policies infinitely — including policies
-- defined on OTHER tables, since resolving their subquery still requires
-- evaluating organization_members' RLS.
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_role(check_org_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = ANY(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_org_role(check_org_id, ARRAY['owner', 'admin']);
$$;

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Members see their own record + fellow members in the same org
DROP POLICY IF EXISTS "org_members_self_read" ON organization_members;
CREATE POLICY "org_members_self_read"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_members_peer_read" ON organization_members;
CREATE POLICY "org_members_peer_read"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

-- Owners/admins can manage members
DROP POLICY IF EXISTS "org_members_admin_manage" ON organization_members;
CREATE POLICY "org_members_admin_manage"
  ON organization_members FOR ALL
  USING (is_org_admin(organization_id));


-- ── organizations RLS (needs organization_members, created above) ───────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can see their own org(s)
DROP POLICY IF EXISTS "organizations_member_read" ON organizations;
CREATE POLICY "organizations_member_read"
  ON organizations FOR SELECT
  USING (is_org_member(id));

-- Only owners/admins can update
DROP POLICY IF EXISTS "organizations_admin_update" ON organizations;
CREATE POLICY "organizations_admin_update"
  ON organizations FOR UPDATE
  USING (is_org_admin(id));

-- Link existing schools to organizations
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_organization_id ON schools (organization_id);


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

DROP POLICY IF EXISTS "org_roles_member_read" ON organization_roles;
CREATE POLICY "org_roles_member_read"
  ON organization_roles FOR SELECT
  USING (
    is_system = true OR is_org_member(organization_id)
  );

DROP POLICY IF EXISTS "org_roles_admin_manage" ON organization_roles;
CREATE POLICY "org_roles_admin_manage"
  ON organization_roles FOR ALL
  USING (
    NOT is_system AND is_org_admin(organization_id)
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


-- ── 8.2.3  INVITATIONS ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
DROP POLICY IF EXISTS "invitations_admin_read" ON organization_invitations;
CREATE POLICY "invitations_admin_read"
  ON organization_invitations FOR SELECT
  USING (is_org_admin(organization_id));

DROP POLICY IF EXISTS "invitations_admin_manage" ON organization_invitations;
CREATE POLICY "invitations_admin_manage"
  ON organization_invitations FOR ALL
  USING (is_org_admin(organization_id));


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
DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
CREATE POLICY "audit_logs_admin_read"
  ON audit_logs FOR SELECT
  USING (is_org_admin(organization_id));

-- Only service role can insert (app layer writes audit entries)
-- No DELETE policy — audit logs are immutable


-- ── 8.2.5  API KEYS ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DROP POLICY IF EXISTS "api_keys_member_read" ON api_keys;
CREATE POLICY "api_keys_member_read"
  ON api_keys FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "api_keys_developer_manage" ON api_keys;
CREATE POLICY "api_keys_developer_manage"
  ON api_keys FOR ALL
  USING (is_org_role(organization_id, ARRAY['owner', 'admin', 'developer']));


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
DROP POLICY IF EXISTS "subscription_plans_public_read" ON subscription_plans;
CREATE POLICY "subscription_plans_public_read"
  ON subscription_plans FOR SELECT USING (is_active = true);


-- ── 8.3.2  ORGANIZATION SUBSCRIPTIONS ────────────────────────────────────────
-- Named org_subscription_status, NOT subscription_status — production already
-- has an orphaned "subscription_status" enum (different values: active/expired/
-- cancelled, from an earlier, unrelated refactor; zero columns reference it
-- today, but the type object itself still exists and CREATE TYPE has no
-- IF NOT EXISTS in any Postgres version, so reusing the name would abort
-- this migration). Renaming avoids the collision without touching the
-- orphaned type or anything that might reference it.

DO $$ BEGIN
  CREATE TYPE org_subscription_status AS ENUM (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                  uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid                NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id             uuid                NOT NULL REFERENCES subscription_plans(id),
  status              org_subscription_status NOT NULL DEFAULT 'trialing',
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

DROP POLICY IF EXISTS "org_subs_admin_read" ON organization_subscriptions;
CREATE POLICY "org_subs_admin_read"
  ON organization_subscriptions FOR SELECT
  USING (is_org_member(organization_id));


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
DROP POLICY IF EXISTS "usage_events_admin_read" ON usage_events;
CREATE POLICY "usage_events_admin_read"
  ON usage_events FOR SELECT
  USING (is_org_role(organization_id, ARRAY['owner', 'admin', 'billing_admin']));


-- ── 8.3.4  INVOICES ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
DROP POLICY IF EXISTS "invoices_billing_read" ON invoices;
CREATE POLICY "invoices_billing_read"
  ON invoices FOR SELECT
  USING (is_org_role(organization_id, ARRAY['owner', 'admin', 'billing_admin']));


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
DROP POLICY IF EXISTS "platform_events_admin_read" ON platform_events;
CREATE POLICY "platform_events_admin_read"
  ON platform_events FOR SELECT
  USING (is_org_admin(organization_id));


-- ── 8.4.2  EVENT SUBSCRIPTIONS ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE sub_delivery_method AS ENUM ('webhook', 'internal', 'email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_pattern   text                NOT NULL,   -- 'teacher.*', 'student.assessment.*'
  delivery_method sub_delivery_method NOT NULL DEFAULT 'webhook',
  endpoint_url    text,               -- for webhook delivery
  handler_name    text,               -- for internal delivery (maps to lib/events/handlers/)
  signing_secret  text,               -- HMAC-SHA256 key for webhook deliveries; generated at
                                      -- subscription-creation time, never displayed again after
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
DROP POLICY IF EXISTS "event_subs_admin_manage" ON event_subscriptions;
CREATE POLICY "event_subs_admin_manage"
  ON event_subscriptions FOR ALL
  USING (is_org_role(organization_id, ARRAY['owner', 'admin', 'developer']));


-- ── 8.4.3  EVENT DELIVERIES (DLQ + retries) ──────────────────────────────────

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'pending', 'processing', 'delivered', 'failed', 'dead_letter'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
DROP POLICY IF EXISTS "event_deliveries_admin_read" ON event_deliveries;
CREATE POLICY "event_deliveries_admin_read"
  ON event_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_subscriptions es
      WHERE es.id = event_deliveries.subscription_id
        AND is_org_role(es.organization_id, ARRAY['owner', 'admin', 'developer'])
    )
  );

-- Atomically claims a batch of due deliveries by marking them 'processing'
-- and returning exactly the rows this call claimed. SELECT ... FOR UPDATE
-- SKIP LOCKED means two concurrent callers (e.g. overlapping cron
-- invocations) can never claim the same row — the loser skips locked rows
-- and simply claims fewer or none, instead of both processing the same
-- delivery. This replaces a separate SELECT-then-UPDATE pair, which left a
-- window where both could read the same 'pending' rows before either had
-- committed its status update.
CREATE OR REPLACE FUNCTION public.claim_pending_deliveries(batch_size int DEFAULT 50)
RETURNS SETOF event_deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE event_deliveries
  SET status = 'processing', last_attempted_at = now()
  WHERE id IN (
    SELECT id FROM event_deliveries
    WHERE status IN ('pending', 'failed') AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- CRITICAL: without this, the function inherits Postgres/Supabase's default
-- EXECUTE grant to anon AND authenticated (confirmed via pg_default_acl —
-- every new function gets this by default). Since this function is
-- SECURITY DEFINER and mutates event_deliveries with no tenant-scoping
-- parameter, an unauthenticated caller with only the public anon key could
-- call it directly via POST /rest/v1/rpc/claim_pending_deliveries and claim
-- (lock into 'processing') every pending webhook delivery platform-wide —
-- a trivial, repeatable, zero-auth denial-of-service against webhook
-- delivery for every organization, plus incidental disclosure of
-- event_id/subscription_id UUIDs. Proven via an actual anonymous HTTP call
-- against a local instance before this fix, and confirmed blocked after it.
-- The only legitimate caller is dispatch.ts's cron route, which always uses
-- the service-role client — never exposed to any browser/client context.
REVOKE EXECUTE ON FUNCTION public.claim_pending_deliveries(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_deliveries(int) TO service_role;


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

-- Operational config, not tenant data — read/managed only by backend job
-- processing via the service-role client, which bypasses RLS regardless.
-- No policies: default-deny for anon/authenticated (Supabase grants full
-- CRUD to those roles on every new table by default, so RLS must be
-- enabled even with zero end-user access needed).
ALTER TABLE job_queues ENABLE ROW LEVEL SECURITY;


-- ── 8.5.2  JOBS ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'queued', 'processing', 'completed', 'failed', 'canceled', 'dead_letter'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

DROP POLICY IF EXISTS "jobs_user_read" ON jobs;
CREATE POLICY "jobs_user_read"
  ON jobs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "jobs_admin_read" ON jobs;
CREATE POLICY "jobs_admin_read"
  ON jobs FOR SELECT
  USING (is_org_admin(organization_id));


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
DROP POLICY IF EXISTS "job_logs_user_read" ON job_logs;
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
-- NOTE: public.set_updated_at() already exists in production (added by the
-- 2026-07-02 security hardening migrations) with SET search_path TO 'public',
-- and 5 live Developer Portal tables (developer_api_keys, developer_profiles,
-- developer_projects, developer_usage_daily, developer_webhooks) depend on it
-- via trigger. This definition must match that hardened version exactly —
-- omitting SET search_path here would silently strip that hardening from
-- those 5 unrelated tables the moment this CREATE OR REPLACE runs.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
