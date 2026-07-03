# EduNexus Developer Platform — Implementation Blueprint
## developers.edunexus.co.ke

**Version:** 1.0
**Status:** Authoritative Implementation Reference
**Audience:** Senior engineers building the Developer Platform
**Date:** 2026-06-30

---

> This document is the implementation specification for developers.edunexus.co.ke. It answers one question per chapter: what exactly are engineers expected to build? Every recommendation is specific enough for a senior engineer to translate immediately into code.

---

## Table of Contents

- [PART I — PRODUCT STRUCTURE](#part-i--product-structure)
  - [Chapter 1 — Complete Product Inventory](#chapter-1--complete-product-inventory)
  - [Chapter 2 — Navigation System](#chapter-2--navigation-system)
  - [Chapter 3 — Screen Inventory](#chapter-3--screen-inventory)
- [PART II — UI SYSTEM](#part-ii--ui-system)
  - [Chapter 4 — Design System](#chapter-4--design-system)
  - [Chapter 5 — Component Library](#chapter-5--component-library)

---

# PART I — PRODUCT STRUCTURE

---

## Chapter 1 — Complete Product Inventory

This chapter catalogs every feature inside developers.edunexus.co.ke. Each feature entry is a contract: it states what the feature does, who uses it, what it depends on, what backend services power it, which frontend modules render it, which database tables store its data, and how it can grow.

---

### 1.1 Developer Portal Core

#### Feature: Portal Home / Dashboard
- **Purpose:** Central command screen for authenticated developers. Surfaces live API health, token usage, recent events, quick-start links, and personalized recommendations.
- **Primary users:** Any authenticated developer
- **Dependencies:** Auth session, application records, usage aggregates, platform status feed
- **Backend services:** `portal-api/dashboard`, `platform-status-service`, `usage-aggregation-cron`
- **Frontend modules:** `app/(portal)/dashboard/page.tsx`, `components/dashboard/MetricTiles.tsx`, `components/dashboard/RecentEvents.tsx`, `components/dashboard/QuickStart.tsx`, `components/dashboard/PlatformStatusBar.tsx`
- **Database tables:** `developer_apps`, `api_usage_daily`, `platform_events`, `developer_sessions`
- **Future extensions:** AI-generated weekly developer digest, anomaly detection alerts, personalized learning path widget

#### Feature: Documentation Site
- **Purpose:** Full API reference, guide articles, tutorials, changelog, and migration guides rendered from MDX source files with live search.
- **Primary users:** All visitors including unauthenticated
- **Dependencies:** MDX content pipeline, Algolia search index, GitHub content source
- **Backend services:** `content-build-service`, `algolia-indexer`
- **Frontend modules:** `app/(docs)/[...slug]/page.tsx`, `components/docs/DocLayout.tsx`, `components/docs/TableOfContents.tsx`, `components/docs/DocSearch.tsx`, `components/docs/Feedback.tsx`
- **Database tables:** `doc_feedback`, `doc_search_analytics`
- **Future extensions:** AI-powered doc assistant, versioned docs per API version, community-contributed examples

#### Feature: Changelog
- **Purpose:** Chronological feed of API changes, new features, deprecations, and breaking changes. Each entry links to affected docs and migration guide.
- **Primary users:** All developers
- **Dependencies:** Content pipeline, version tagging
- **Backend services:** `changelog-publish-service`
- **Frontend modules:** `app/(docs)/changelog/page.tsx`, `components/changelog/ChangelogEntry.tsx`
- **Database tables:** `changelog_entries` (id, title, body_mdx, version, type ENUM['feature','fix','breaking','deprecation'], published_at, author_id)
- **Future extensions:** RSS feed, email digest subscription, Slack webhook integration

---

### 1.2 Authentication & Identity

#### Feature: Developer Registration
- **Purpose:** Onboard a new developer with email/password or Google OAuth. Creates developer profile, seeds trial quota, sends welcome email.
- **Primary users:** New developers
- **Dependencies:** Supabase Auth, email service, quota seeding function
- **Backend services:** `auth-service`, `onboarding-orchestrator`, `email-service`
- **Frontend modules:** `app/(auth)/register/page.tsx`, `components/auth/RegisterForm.tsx`
- **Database tables:** `developer_profiles` (id, user_id FK auth.users, display_name, avatar_url, bio, website_url, github_handle, created_at, updated_at), `developer_quotas`
- **Future extensions:** SSO for enterprise organizations, magic link sign-in, passkey support

#### Feature: Developer Login / Session Management
- **Purpose:** Authenticate a developer, issue a session JWT, handle MFA if enabled. Persist session across tabs.
- **Primary users:** Returning developers
- **Dependencies:** Supabase Auth, MFA configuration
- **Backend services:** `auth-service`
- **Frontend modules:** `app/(auth)/login/page.tsx`, `components/auth/LoginForm.tsx`, `lib/auth/session.ts`
- **Database tables:** `developer_sessions` (id, developer_id, created_at, last_active_at, ip_address, user_agent, revoked_at)
- **Future extensions:** Device trust management, login activity map, suspicious login detection

#### Feature: Multi-Factor Authentication
- **Purpose:** Enforce TOTP-based 2FA for developers accessing production API keys or sensitive billing actions.
- **Primary users:** Developers with MFA enabled or required by org policy
- **Dependencies:** Supabase Auth MFA, TOTP library
- **Backend services:** `auth-service`
- **Frontend modules:** `app/(auth)/mfa/page.tsx`, `components/auth/MFASetup.tsx`, `components/auth/MFAVerify.tsx`
- **Database tables:** Supabase Auth MFA tables (managed by Supabase)
- **Future extensions:** Hardware key (WebAuthn/FIDO2) support, backup code download

#### Feature: API Key Management
- **Purpose:** Create, list, rotate, and revoke API keys scoped to an application. Show last-used timestamp, request count, and IP allowlist.
- **Primary users:** Developers managing application credentials
- **Dependencies:** Cryptographic key generation service, Redis (key cache), audit log
- **Backend services:** `key-management-service`
- **Frontend modules:** `app/(portal)/apps/[id]/keys/page.tsx`, `components/keys/KeyList.tsx`, `components/keys/CreateKeyModal.tsx`, `components/keys/KeyDisplay.tsx`
- **Database tables:** `api_keys` (id, app_id FK developer_apps, key_prefix VARCHAR(8), key_hash VARCHAR(64), name, scopes TEXT[], environment ENUM['sandbox','production'], ip_allowlist INET[], last_used_at, request_count BIGINT, expires_at, revoked_at, created_at, created_by)
- **Future extensions:** Key rotation reminders, automated rotation via GitHub Actions integration, per-key rate limit overrides

---

### 1.3 API Management

#### Feature: Application Registry
- **Purpose:** Create and manage developer applications. Each application has a client ID, one or more API keys, webhook endpoints, quota allocation, and environment (sandbox vs production).
- **Primary users:** Developers
- **Dependencies:** Auth, quota service, webhook service
- **Backend services:** `app-registry-service`
- **Frontend modules:** `app/(portal)/apps/page.tsx`, `app/(portal)/apps/[id]/page.tsx`, `app/(portal)/apps/new/page.tsx`, `components/apps/AppCard.tsx`, `components/apps/AppForm.tsx`
- **Database tables:** `developer_apps` (id, developer_id, org_id, name, description, icon_url, client_id UUID, environment ENUM['sandbox','production'], status ENUM['active','suspended','deleted'], webhook_url, webhook_secret, allowed_origins TEXT[], created_at, updated_at)
- **Future extensions:** App templates, app cloning, multi-region app deployment

#### Feature: Interactive API Explorer
- **Purpose:** Browser-based REST client that auto-populates the developer's API key. Supports request building with schema validation, response viewing with syntax highlight, and request history.
- **Primary users:** Developers evaluating or debugging the API
- **Dependencies:** OpenAPI spec parser, API keys, schema validation
- **Backend services:** `api-proxy-service` (to avoid CORS and inject auth)
- **Frontend modules:** `app/(portal)/explorer/page.tsx`, `components/explorer/EndpointList.tsx`, `components/explorer/TryItPanel.tsx`, `components/explorer/RequestBuilder.tsx`, `components/explorer/ResponseViewer.tsx`
- **Database tables:** `explorer_request_history` (id, developer_id, endpoint, method, request_body JSONB, response_status, response_body JSONB, latency_ms, created_at)
- **Future extensions:** Request collections / saved requests, share request URL, import from curl command

#### Feature: Webhook Management
- **Purpose:** Register, configure, and test webhook endpoints. Show delivery history, retry status, and payload inspector for each delivery attempt.
- **Primary users:** Developers integrating with EduNexus events
- **Dependencies:** Webhook delivery service, event bus
- **Backend services:** `webhook-service`, `event-bus`
- **Frontend modules:** `app/(portal)/apps/[id]/webhooks/page.tsx`, `components/webhooks/WebhookCard.tsx`, `components/webhooks/WebhookForm.tsx`, `components/webhooks/WebhookEventLog.tsx`
- **Database tables:** `webhooks` (id, app_id, url, events TEXT[], secret_hash, enabled BOOL, created_at, updated_at), `webhook_deliveries` (id, webhook_id, event_type, payload JSONB, status ENUM['pending','success','failed'], attempt_count, next_retry_at, response_status, response_body, latency_ms, delivered_at, created_at)
- **Future extensions:** Webhook signature verification playground, delivery SLA monitoring, bulk retry

#### Feature: Rate Limit Configuration
- **Purpose:** View current rate limit tier, live window usage, and request quota per endpoint group. Enterprise developers can configure custom limits.
- **Primary users:** Developers and org admins
- **Dependencies:** Redis rate limit store, quota service
- **Backend services:** `rate-limit-service`
- **Frontend modules:** `components/usage/RateLimitBar.tsx`, `app/(portal)/usage/page.tsx`
- **Database tables:** `rate_limit_tiers` (id, name, requests_per_minute INT, requests_per_day INT, concurrent_connections INT, price_monthly NUMERIC), `developer_rate_limits` (developer_id, tier_id, custom_overrides JSONB, effective_at)
- **Future extensions:** Burst credit system, per-endpoint custom limits, rate limit exemptions for internal services

---

### 1.4 SDK Hub

#### Feature: SDK Library Listing
- **Purpose:** Catalog all official and community EduNexus SDKs. Each card shows language, version, install command, weekly downloads, and GitHub star count.
- **Primary users:** Developers choosing an SDK
- **Dependencies:** npm/PyPI/pub download stats API, GitHub API
- **Backend services:** `sdk-metadata-aggregator-cron`
- **Frontend modules:** `app/(portal)/sdks/page.tsx`, `components/sdks/SDKCard.tsx`, `components/sdks/SDKGrid.tsx`
- **Database tables:** `sdk_packages` (id, language ENUM['typescript','python','dart','php','go','ruby'], package_name, github_repo, current_version, changelog_url, weekly_downloads INT, github_stars INT, last_updated_at, maintained_by ENUM['official','community'], status ENUM['stable','beta','deprecated'])
- **Future extensions:** SDK compatibility matrix, auto-generated SDK from OpenAPI spec, community SDK submission workflow

#### Feature: SDK Detail Page
- **Purpose:** Full documentation for one SDK including: installation, authentication setup, quick-start code example, full method reference with live try-it, and version history.
- **Primary users:** Developers integrating a specific SDK
- **Dependencies:** MDX content, package registry API
- **Backend services:** `content-build-service`
- **Frontend modules:** `app/(portal)/sdks/[language]/page.tsx`, `components/sdks/SDKTabs.tsx`, `components/sdks/MethodReference.tsx`, `components/sdks/InstallCommand.tsx`
- **Database tables:** `sdk_packages`, `sdk_changelogs` (id, sdk_id, version, notes_mdx, breaking_changes BOOL, published_at)
- **Future extensions:** SDK playground with sandboxed runtime, per-method usage analytics, community ratings

---

### 1.5 AI Studio

#### Feature: Prompt Playground
- **Purpose:** Interactive prompt testing environment for EduNexus AI endpoints (lesson plan generation, SOW generation, assessment generation, parent pulse). Shows token cost preview, streaming response, and history.
- **Primary users:** Developers building AI-powered features
- **Dependencies:** EduNexus AI API, token cost config, streaming SSE
- **Backend services:** `ai-studio-proxy`
- **Frontend modules:** `app/(portal)/studio/page.tsx`, `components/studio/PromptEditor.tsx`, `components/studio/StreamingOutput.tsx`, `components/studio/TokenCostPreview.tsx`, `components/studio/PromptHistory.tsx`
- **Database tables:** `studio_sessions` (id, developer_id, prompt_text, system_prompt, model, parameters JSONB, response_text, input_tokens INT, output_tokens INT, cost_usd NUMERIC(10,6), latency_ms, created_at)
- **Future extensions:** Prompt versioning / A-B comparison, batch evaluation, prompt sharing

#### Feature: Model Comparison
- **Purpose:** Run the same prompt against multiple EduNexus AI model configurations side-by-side. Compare latency, quality, and token cost.
- **Primary users:** Developers optimizing AI integration
- **Dependencies:** AI Studio proxy, multiple model endpoints
- **Backend services:** `ai-studio-proxy`
- **Frontend modules:** `components/studio/ModelComparison.tsx`
- **Database tables:** `studio_comparisons` (id, developer_id, prompt_text, model_a, model_b, response_a, response_b, cost_a NUMERIC, cost_b NUMERIC, latency_a_ms INT, latency_b_ms INT, created_at)
- **Future extensions:** Multi-model tournament evaluation, automated quality scoring

#### Feature: Token Cost Calculator
- **Purpose:** Pre-flight cost estimator. Input token count and endpoint, get exact cost in KES and USD. Show monthly projections at given request volume.
- **Primary users:** Developers or product managers evaluating cost
- **Dependencies:** `TOKEN_COSTS` config from `lib/payments/config.ts` exposed via API
- **Backend services:** `pricing-api`
- **Frontend modules:** `components/studio/TokenCostCalculator.tsx`
- **Database tables:** None (reads from config)
- **Future extensions:** Savings comparison across tiers, bulk pricing negotiation request form

---

### 1.6 Knowledge Graph Explorer

#### Feature: Curriculum Graph Viewer
- **Purpose:** Interactive force-directed visualization of the KICD CBC curriculum knowledge graph. Navigate nodes (learning outcomes, competencies, topics, subjects, strands) with zoom, pan, filter, and expand.
- **Primary users:** Developers building curriculum-aware features
- **Dependencies:** EduNexus Knowledge Graph API, D3.js / Cytoscape.js
- **Backend services:** `knowledge-graph-api`
- **Frontend modules:** `app/(portal)/graph/page.tsx`, `components/graph/GraphCanvas.tsx`, `components/graph/GraphNode.tsx`, `components/graph/GraphSidebar.tsx`, `components/graph/GraphFilter.tsx`
- **Database tables:** Reads from EduNexus core curriculum graph (read-only replica)
- **Future extensions:** Graph diff view per curriculum revision, custom overlay (student mastery heat-map), export to JSON-LD

#### Feature: Node Inspector
- **Purpose:** Click a node in the graph to open a detailed panel: full node metadata, relationship list, associated API objects (questions, lesson plans), and example API call.
- **Primary users:** Developers querying the knowledge graph
- **Dependencies:** Knowledge Graph API, Explorer component
- **Frontend modules:** `components/graph/NodeInspector.tsx`, `components/graph/SchemaExplorer.tsx`
- **Database tables:** Read-only access to curriculum tables
- **Future extensions:** Bookmark nodes, annotate nodes with private notes, share node permalink

---

### 1.7 Marketplace

#### Feature: Plugin / Extension Listing
- **Purpose:** Browse, search, and filter community plugins. Plugins extend EduNexus with custom report types, content generators, integrations, and assessment providers.
- **Primary users:** Developers looking for extensions; school administrators
- **Dependencies:** Marketplace service, plugin registry
- **Backend services:** `marketplace-service`
- **Frontend modules:** `app/(portal)/marketplace/page.tsx`, `components/marketplace/PluginCard.tsx`, `components/marketplace/MarketplaceCard.tsx`, `components/marketplace/MarketplaceFilter.tsx`
- **Database tables:** `marketplace_plugins` (id, slug, name, description, long_description_mdx, icon_url, screenshots TEXT[], author_id, author_name, category ENUM['content','assessment','report','integration','analytics','notification'], tags TEXT[], version, install_count INT, rating_avg NUMERIC(3,2), rating_count INT, price_model ENUM['free','paid','freemium'], price_monthly NUMERIC, status ENUM['pending','approved','rejected','deprecated'], approved_at, created_at, updated_at)
- **Future extensions:** Plugin bundle / starter kit, plugin analytics dashboard for authors, sponsored placement

#### Feature: Plugin Detail Page
- **Purpose:** Full plugin profile: description, screenshots carousel, installation instructions, configuration schema, reviews, version history, and one-click install.
- **Primary users:** Developers evaluating a plugin
- **Dependencies:** Marketplace service, app registry (to associate installation with an app)
- **Frontend modules:** `app/(portal)/marketplace/[slug]/page.tsx`, `components/marketplace/PluginCard.tsx`, `components/marketplace/PluginInstaller.tsx`, `components/marketplace/ReviewList.tsx`
- **Database tables:** `plugin_installations` (id, plugin_id, app_id, developer_id, installed_at, config JSONB, enabled BOOL), `plugin_reviews` (id, plugin_id, developer_id, rating INT, body TEXT, created_at)
- **Future extensions:** Plugin sandbox environment, automated compatibility testing

#### Feature: Plugin Submission
- **Purpose:** Developer submits a new plugin for review. Upload manifest, source repo URL, icon, screenshots, and documentation. Admin review workflow with approval/rejection feedback.
- **Primary users:** Third-party developers building plugins
- **Dependencies:** File storage (Supabase Storage), admin console, email notification
- **Backend services:** `marketplace-service`, `email-service`
- **Frontend modules:** `app/(portal)/marketplace/submit/page.tsx`, `components/marketplace/PluginSubmitForm.tsx`
- **Database tables:** `marketplace_plugins`, `plugin_review_queue` (id, plugin_id, reviewer_id, notes TEXT, decision ENUM['approved','rejected','changes_requested'], decided_at)
- **Future extensions:** Automated static analysis on plugin manifest, sandboxed preview before approval

---

### 1.8 CLI Portal

#### Feature: CLI Installation Guide
- **Purpose:** Step-by-step CLI installation for macOS, Linux, and Windows. Shows version badge, install command (Homebrew, npm, curl), and first-run checklist.
- **Primary users:** Developers setting up local tooling
- **Dependencies:** CLI release API (GitHub Releases or internal CDN)
- **Frontend modules:** `app/(portal)/cli/page.tsx`, `components/cli/InstallGuide.tsx`, `components/cli/VersionBadge.tsx`
- **Database tables:** `cli_releases` (id, version, channel ENUM['stable','beta'], release_notes_mdx, download_urls JSONB, published_at)
- **Future extensions:** In-browser CLI emulator, auto-update instructions

#### Feature: CLI Authentication Flow
- **Purpose:** Deep-link flow: developer runs `edunexus auth login` in terminal, browser opens portal, developer approves, token written to local config file.
- **Primary users:** CLI users
- **Dependencies:** OAuth device flow or portal-issued CLI tokens
- **Backend services:** `cli-auth-service`
- **Frontend modules:** `app/(portal)/cli/authorize/page.tsx`, `components/cli/CLIAuthApproval.tsx`
- **Database tables:** `cli_auth_sessions` (id, device_code, user_code, developer_id, expires_at, approved_at, token_issued_at)
- **Future extensions:** Multiple named CLI profiles, workspace-scoped tokens

---

### 1.9 Organizations & Teams

#### Feature: Organization Management
- **Purpose:** Create and manage a developer organization. Invite members, assign roles, share applications and billing across the org.
- **Primary users:** Org owners and admins
- **Dependencies:** Auth service, RBAC engine, billing service
- **Backend services:** `org-service`
- **Frontend modules:** `app/(portal)/org/settings/page.tsx`, `components/org/OrgSettingsForm.tsx`
- **Database tables:** `organizations` (id, name, slug, avatar_url, billing_email, plan ENUM['free','growth','enterprise'], created_at, updated_at), `org_members` (id, org_id, developer_id, role ENUM['owner','admin','member','viewer'], invited_by, joined_at), `org_invitations` (id, org_id, email, role, token, expires_at, accepted_at, created_by)
- **Future extensions:** SSO enforcement per org, IP allowlist at org level, audit log export

#### Feature: Team Members & Roles
- **Purpose:** List org members, invite by email, change roles, remove members. Show each member's last login and active app count.
- **Primary users:** Org owners and admins
- **Dependencies:** Org service, auth service
- **Frontend modules:** `app/(portal)/org/members/page.tsx`, `components/org/MemberList.tsx`, `components/org/InviteModal.tsx`
- **Database tables:** `org_members`, `org_invitations`
- **Future extensions:** Team sub-groups, per-team app access control, member activity reports

---

### 1.10 Billing & Usage

#### Feature: Plan Management
- **Purpose:** View current plan, usage against plan limits, and upgrade/downgrade. Show per-feature entitlements clearly.
- **Primary users:** Individual developers or org billing admins
- **Dependencies:** Paystack subscription API, quota service
- **Backend services:** `billing-service`
- **Frontend modules:** `app/(portal)/billing/page.tsx`, `components/billing/PlanCard.tsx`, `components/billing/UpgradeModal.tsx`
- **Database tables:** `developer_subscriptions` (id, developer_id, org_id, plan_id, status ENUM['active','past_due','cancelled'], current_period_start, current_period_end, paystack_subscription_code, created_at), `billing_plans` (id, name, price_monthly NUMERIC, features JSONB, quota JSONB)
- **Future extensions:** Annual billing discount, metered billing for AI tokens over quota

#### Feature: Usage Dashboard
- **Purpose:** Time-series charts for API calls, token consumption, webhook deliveries, and cost. Breakdown by application, endpoint, and time granularity (day/week/month).
- **Primary users:** Developers monitoring consumption
- **Dependencies:** Usage aggregation service
- **Backend services:** `usage-aggregation-service`
- **Frontend modules:** `app/(portal)/usage/page.tsx`, `components/usage/UsageChart.tsx`, `components/usage/QuotaIndicator.tsx`, `components/usage/MetricTile.tsx`
- **Database tables:** `api_usage_daily` (developer_id, app_id, endpoint_group, date, request_count BIGINT, token_count BIGINT, error_count BIGINT, cost_usd NUMERIC), `api_usage_hourly` (same + hour INT)
- **Future extensions:** Cost anomaly alerts, budget cap with auto-suspend, usage export to CSV

---

### 1.11 Observability & Logs

#### Feature: Request Logs
- **Purpose:** Searchable, filterable log of all API requests from the developer's apps. Show endpoint, status code, latency, region, and payload inspector.
- **Primary users:** Developers debugging integrations
- **Dependencies:** API gateway logging pipeline, ElasticSearch or Supabase full-text
- **Backend services:** `log-ingestion-service`, `log-query-api`
- **Frontend modules:** `app/(portal)/logs/page.tsx`, `components/logs/LogTable.tsx`, `components/logs/LogDetail.tsx`, `components/logs/LogFilter.tsx`
- **Database tables:** `request_logs` (id, app_id, api_key_prefix, endpoint, method, status_code SMALLINT, latency_ms INT, request_headers JSONB, request_body_hash VARCHAR(64), response_body_size INT, error_code VARCHAR(32), ip_address INET, region VARCHAR(16), created_at) — partitioned by month
- **Future extensions:** Log retention configuration, log streaming to external SIEM, anomaly highlighting

#### Feature: Platform Status Feed
- **Purpose:** Real-time and historical status of all EduNexus API services. Shows current incidents, scheduled maintenance, and 90-day uptime history.
- **Primary users:** All developers
- **Dependencies:** Status monitoring service, incident management system
- **Backend services:** `status-service`
- **Frontend modules:** `components/dashboard/PlatformStatusBar.tsx`, `app/(portal)/status/page.tsx`, `components/status/IncidentTimeline.tsx`
- **Database tables:** `service_components` (id, name, slug, category), `status_incidents` (id, title, body_mdx, status ENUM['investigating','identified','monitoring','resolved'], components_affected TEXT[], started_at, resolved_at), `status_updates` (id, incident_id, body, status, created_at)
- **Future extensions:** Subscribe to status updates via email/Slack, embed status badge in external sites

---

### 1.12 Certifications

#### Feature: Certification Tracks
- **Purpose:** Structured learning paths and assessments that award a verifiable digital credential. Four tracks: Core API Integration, AI Features Engineer, CBC Knowledge Graph Specialist, Marketplace Plugin Developer.
- **Primary users:** Developers building portfolio credentials
- **Dependencies:** Content pipeline, assessment engine, credential issuance service
- **Backend services:** `certification-service`
- **Frontend modules:** `app/(portal)/certifications/page.tsx`, `components/certifications/TrackCard.tsx`, `components/certifications/ProgressTracker.tsx`
- **Database tables:** `cert_tracks` (id, name, slug, description, level ENUM['associate','professional','expert'], modules JSONB, passing_score INT, badge_image_url, validity_months INT), `cert_enrollments` (id, developer_id, track_id, started_at, completed_at, score INT, status ENUM['enrolled','in_progress','passed','failed','expired']), `cert_credentials` (id, enrollment_id, credential_url, issued_at, expires_at, verification_hash)
- **Future extensions:** Employer-shared credential verification, certified developer directory, exam proctoring integration

---

### 1.13 Community & Support

#### Feature: Community Forum
- **Purpose:** Developer discussion forum organized by topic area. Post questions, share examples, report bugs, and upvote answers.
- **Primary users:** All developers
- **Dependencies:** Forum service (Discourse embed or custom), auth SSO
- **Frontend modules:** `app/(portal)/community/page.tsx`, `components/community/ThreadList.tsx`, `components/community/ThreadCard.tsx`
- **Database tables:** `forum_threads` (id, developer_id, category_id, title, body_mdx, upvotes INT, reply_count INT, pinned BOOL, locked BOOL, created_at, updated_at), `forum_replies` (id, thread_id, developer_id, body_mdx, upvotes INT, is_accepted BOOL, created_at)
- **Future extensions:** AI-assisted answer suggestions, official EduNexus team response badges, featured community projects

#### Feature: Support Ticket System
- **Purpose:** Create, track, and reply to support tickets. Tier 1 tickets answered by AI; escalated to human for billing and security issues.
- **Primary users:** Developers with integration problems
- **Dependencies:** Ticket service, email integration, AI triage service
- **Backend services:** `support-service`, `ai-triage-service`
- **Frontend modules:** `app/(portal)/support/page.tsx`, `components/support/TicketForm.tsx`, `components/support/TicketList.tsx`, `components/support/TicketThread.tsx`
- **Database tables:** `support_tickets` (id, developer_id, subject, body, category ENUM['billing','technical','account','security','other'], priority ENUM['low','medium','high','critical'], status ENUM['open','ai_responded','pending_human','in_progress','resolved','closed'], assignee_id, created_at, updated_at), `ticket_messages` (id, ticket_id, sender_id, sender_type ENUM['developer','ai','agent'], body TEXT, attachments JSONB, created_at)
- **Future extensions:** AI ticket deflection rate dashboard, SLA tracking, knowledge base auto-suggest

---

### 1.14 Admin Console

#### Feature: Developer Management
- **Purpose:** Internal admin screen to search, view, suspend, and restore developer accounts. See all applications, usage, and support history for any developer.
- **Primary users:** EduNexus internal admins
- **Dependencies:** Admin auth (separate admin role), all developer tables
- **Backend services:** `admin-api`
- **Frontend modules:** `app/(admin)/developers/page.tsx`, `components/admin/DeveloperTable.tsx`, `components/admin/DeveloperDetail.tsx`
- **Database tables:** All developer-facing tables plus `admin_audit_log` (id, admin_id, action, target_type, target_id, metadata JSONB, ip_address, created_at)
- **Future extensions:** Bulk developer communication, developer segmentation for beta programs

#### Feature: Plugin Review Queue
- **Purpose:** Internal workflow for reviewing submitted marketplace plugins. Shows plugin diff, security scan results, and action buttons (approve/reject/request changes).
- **Primary users:** Marketplace review team
- **Dependencies:** Marketplace service, static analysis service
- **Frontend modules:** `app/(admin)/marketplace/page.tsx`, `components/admin/PluginReviewCard.tsx`
- **Database tables:** `plugin_review_queue`, `marketplace_plugins`
- **Future extensions:** Automated security scanning, reviewer assignment and workload balancing

#### Feature: Platform Configuration
- **Purpose:** Toggle feature flags, adjust global rate limits, manage API versions, and publish announcements. All changes are audited.
- **Primary users:** Platform engineers and product admins
- **Dependencies:** Feature flag service, config store
- **Backend services:** `config-service`
- **Frontend modules:** `app/(admin)/config/page.tsx`, `components/admin/FeatureFlagTable.tsx`, `components/admin/AnnouncementForm.tsx`
- **Database tables:** `feature_flags` (id, key, enabled BOOL, rollout_percentage INT, metadata JSONB, updated_by, updated_at), `platform_announcements` (id, title, body_mdx, type ENUM['info','warning','critical'], target_audience ENUM['all','beta','enterprise'], visible_from, visible_until, created_by, created_at)
- **Future extensions:** A/B flag experiments, gradual rollout automation, flag dependency graph

---

## Chapter 2 — Navigation System

The navigation system is a first-class product concern on the Developer Platform. It must support keyboard-first navigation, contextual depth, and graceful collapse on small screens. This chapter specifies every navigational surface.

---

### 2.1 Top Navigation Bar

The top bar is `components/nav/TopBar.tsx`. It is `position: sticky; top: 0; z-index: 50` and `height: 56px`. It renders differently based on auth state.

#### Unauthenticated top bar items (left to right):
1. **Logo** — `components/nav/Logo.tsx` — SVG + wordmark, links to `/`
2. **Products** (dropdown) — API, AI Studio, Knowledge Graph, Marketplace
3. **Docs** (dropdown) — Getting Started, API Reference, SDKs, Changelog
4. **Pricing** — direct link to `/pricing`
5. **Community** — direct link to `/community`
6. **Search icon** — opens Cmd+K palette on click
7. **Sign in** — text button → `/auth/login`
8. **Get started** — filled button → `/auth/register`

#### Authenticated top bar items (left to right):
1. **Logo** — links to `/dashboard`
2. **Products** (dropdown) — same as unauthenticated
3. **Docs** (dropdown) — same as unauthenticated
4. **Search icon** — opens Cmd+K palette
5. **Notifications bell** — badge with unread count, dropdown shows recent notifications inline
6. **Help icon** — dropdown: Documentation, Status, Support ticket
7. **Avatar / user menu** — dropdown: Profile, Organization, Billing, Settings, Sign out

#### Dropdown behavior:
- Open on hover with `150ms` delay to prevent accidental trigger; open immediately on click
- Close on outside click or `Escape`
- Keyboard: `ArrowDown` opens and focuses first item, `ArrowUp`/`ArrowDown` navigate items, `Enter` activates, `Escape` closes
- Dropdowns use `role="menu"` with `role="menuitem"` children

#### TypeScript type for top nav items:
```typescript
type NavDropdownItem = {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ size: number }>;
  description?: string;
  badge?: string;
  external?: boolean;
};

type NavTopItem =
  | { type: 'link'; label: string; href: string; external?: boolean }
  | { type: 'dropdown'; label: string; items: NavDropdownItem[]; columns?: 1 | 2 | 3 }
  | { type: 'button'; label: string; href: string; variant: 'ghost' | 'filled' }
  | { type: 'icon'; icon: React.ComponentType<{ size: number }>; onClick: () => void; label: string; badge?: number };
```

---

### 2.2 Sidebar Navigation

The sidebar is `components/nav/Sidebar.tsx`. It is `width: 240px` when expanded and `width: 56px` when collapsed. It renders only for authenticated users inside the `(portal)` layout.

#### Sidebar sections and items:

**Section: Overview**
- Dashboard — `/dashboard` — icon: `LayoutDashboard`
- Applications — `/apps` — icon: `Layers`
- Usage — `/usage` — icon: `BarChart2`

**Section: Build**
- API Explorer — `/explorer` — icon: `Terminal`
- AI Studio — `/studio` — icon: `Sparkles`
- Knowledge Graph — `/graph` — icon: `Network`
- SDKs — `/sdks` — icon: `Package`

**Section: Publish**
- Marketplace — `/marketplace` — icon: `Store`
- CLI — `/cli` — icon: `CommandLine`
- Webhooks — `/apps/[current-app-id]/webhooks` — icon: `Webhook` (contextual — shows app name as sub-label)

**Section: Monitor**
- Logs — `/logs` — icon: `FileText`
- Alerts — `/alerts` — icon: `Bell`
- Status — `/status` — icon: `Activity`

**Section: Team**
- Organization — `/org/settings` — icon: `Building2`
- Members — `/org/members` — icon: `Users`
- Billing — `/billing` — icon: `CreditCard`

**Section: Learn**
- Certifications — `/certifications` — icon: `Award`
- Community — `/community` — icon: `MessageSquare`
- Support — `/support` — icon: `LifeBuoy`

**Bottom (pinned):**
- Developer Profile — `/profile` — avatar thumbnail + name
- Settings — `/settings` — icon: `Settings`
- Collapse toggle — collapses sidebar to icon-only mode

#### Sidebar behaviors:
- Active state: left accent bar `3px wide, bg-brand-500`, item `bg-surface-100`, text `text-brand-600 font-medium`
- Hover state: `bg-surface-50`, `150ms` transition
- When collapsed: icons only, `Tooltip` shows label on hover with `delay: 300ms`
- Section headers hidden when collapsed
- Collapse state persisted in `localStorage` key `"sidebar_collapsed"`
- On mobile (`< 768px`): sidebar converts to a drawer. Overlay rendered behind drawer. Close on outside click or swipe left.
- Sub-items: up to one level of nesting. Parent item has a `ChevronRight` that rotates to `ChevronDown` on expand. Sub-items indented `16px`. Expand state persisted in `localStorage` key `"sidebar_expanded_sections"` (array of section keys).

#### TypeScript type for sidebar items:
```typescript
type SidebarItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  external?: boolean;
  contextual?: boolean; // derives href from current context (active app)
  subItems?: Omit<SidebarItem, 'subItems' | 'icon'>[];
};

type SidebarSection = {
  key: string;
  title: string;
  items: SidebarItem[];
  collapsible?: boolean;
};
```

---

### 2.3 Breadcrumbs

Breadcrumbs render in `components/nav/Breadcrumbs.tsx` as a `<nav aria-label="Breadcrumb">` element. They appear on all pages except the dashboard and landing page.

#### Rules:
- Maximum depth: 4 segments before truncation
- Truncation strategy: hide middle segments behind a `…` button (expand on click)
- Separator: `/` rendered as `aria-hidden` span
- Current page: rendered as `<span aria-current="page">` — not a link
- Dynamic segments (e.g., app name) resolved from `usePathname()` + local state/SWR data

#### Route → breadcrumb mapping:
```
/apps                              → Home > Applications
/apps/new                          → Home > Applications > New Application
/apps/[id]                         → Home > Applications > [App Name]
/apps/[id]/keys                    → Home > Applications > [App Name] > API Keys
/apps/[id]/webhooks                → Home > Applications > [App Name] > Webhooks
/marketplace/[slug]                → Home > Marketplace > [Plugin Name]
/org/members                       → Home > Organization > Members
/certifications/[track]            → Home > Certifications > [Track Name]
/sdks/[language]                   → Home > SDKs > [Language]
```

---

### 2.4 Context Menus

Context menus (right-click) are rendered via `components/nav/ContextMenu.tsx` using a `radix-ui/react-context-menu` primitive.

| Surface | Right-click items |
|---|---|
| App card in `/apps` list | Open, Open in new tab, Edit, Duplicate, Delete |
| API Key row | Copy key prefix, View usage, Revoke |
| Log row | Copy request ID, Copy as curl, Open in Explorer |
| Webhook card | Edit, Test, View deliveries, Disable, Delete |
| Plugin card in Marketplace | View details, Install, Copy slug |
| Community thread | Open, Share link, Bookmark, Report |

---

### 2.5 Quick Actions (Cmd+K Command Palette)

The command palette is rendered by `components/nav/CommandPalette.tsx`. It is triggered by:
- Keyboard shortcut `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux)
- Click on the search icon in the top bar
- Any element with `data-shortcut="cmdk"` attribute

The palette uses `cmdk` library wrapped in a `Dialog` from `radix-ui`.

#### Result categories:
1. **Recent** — last 5 visited pages (from `sessionStorage`)
2. **Applications** — fuzzy-match on app name, shows environment badge
3. **Navigation** — all sidebar items
4. **Docs** — top 5 fuzzy-matched doc pages (Algolia instant search)
5. **API Endpoints** — endpoint search from OpenAPI spec
6. **Actions** — Create app, Generate API key, Submit support ticket, Open AI Studio
7. **Settings** — links to specific settings sections

#### Keyboard navigation within palette:
- `ArrowUp` / `ArrowDown` — move between items
- `Enter` — activate selected item
- `Escape` — close
- Type continuously — filters all categories simultaneously
- `Tab` — cycle through category sections

---

### 2.6 Complete Keyboard Shortcuts Table

| Shortcut | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `Cmd+/` | Toggle sidebar |
| `Cmd+Shift+N` | New application |
| `Cmd+Shift+L` | Go to logs |
| `Cmd+Shift+E` | Go to API Explorer |
| `Cmd+Shift+S` | Go to AI Studio |
| `Cmd+Shift+U` | Go to usage dashboard |
| `Cmd+Shift+B` | Go to billing |
| `G then D` | Go to dashboard (vim-style chord) |
| `G then A` | Go to applications |
| `G then M` | Go to marketplace |
| `?` | Open keyboard shortcut help modal |
| `Escape` | Close any open modal/drawer |
| `Cmd+Enter` (in AI Studio) | Run prompt |
| `Cmd+C` (focused code block) | Copy code |

Shortcuts registered via a global `useKeyboardShortcuts()` hook in `hooks/useKeyboardShortcuts.ts`. Hook maintains a registry `Map<string, () => void>` and listens on `document.addEventListener('keydown')`. Shortcuts are suppressed when focus is inside an `<input>`, `<textarea>`, or `contenteditable` element unless flagged `captureInInput: true`.

---

### 2.7 Responsive Navigation

| Breakpoint | Behavior |
|---|---|
| `< 640px` (mobile) | Top bar: logo + hamburger only. Sidebar: hidden, opens as full-screen drawer on hamburger tap. Bottom tab bar shows 5 most-used items. |
| `640px–1024px` (tablet) | Top bar: logo + icon buttons. Sidebar: icon-only (collapsed) by default, can expand on tap. |
| `> 1024px` (desktop) | Full top bar + full sidebar. |

Bottom tab bar (mobile only) — `components/nav/MobileTabBar.tsx`:
- Items: Dashboard, Apps, Explorer, Studio, Profile
- Fixed to bottom, `height: 56px`, `z-index: 40`
- Active item: brand color fill + label shown; inactive: muted icon only
- Hidden when keyboard is open (detected via `visualViewport` resize event)

---

### 2.8 Empty Navigation States

- **No applications:** Sidebar webhook item hidden. Apps link in sidebar shows `(0)` badge. CTA card renders inside the content area of the Apps page.
- **No active plan (trial expired):** Billing item in sidebar shows pulsing red dot badge. Clicking any feature item that requires a paid plan shows an upgrade interstitial instead of the feature.
- **Organization not set up:** Team section in sidebar shows `Set up org →` in place of Members and Settings.

---

## Chapter 3 — Screen Inventory

Every screen in the Developer Platform is specified here. For each screen: purpose, URL, components used, permissions, and all relevant UI states.

---

### Screen 1 — Landing Page

**URL:** `/`
**Purpose:** Convert visiting developers into registered users. Communicate EduNexus API value proposition, show live API stats, link to quick-start, and feature the Marketplace and AI Studio.
**Components:** `components/landing/HeroSection.tsx`, `components/landing/FeatureGrid.tsx`, `components/landing/LiveAPIStats.tsx`, `components/landing/CodeShowcase.tsx`, `components/landing/Testimonials.tsx`, `components/landing/PricingTeaser.tsx`, `components/landing/CTASection.tsx`
**Permissions:** Public (no auth required)
**Loading state:** Page skeleton with shimmer on stats cards. Stats fetched client-side with `SWR`.
**Error state:** Stats silently fail to a static fallback number if API call fails. No visible error.
**Empty state:** N/A (static content)
**Responsive:** Full-width hero on desktop → stacked single-column on mobile. Code showcase tabs collapse to vertical list on mobile.
**Analytics events:** `landing_page_viewed`, `cta_clicked(position: 'hero'|'pricing'|'bottom')`, `code_language_switched`, `live_stats_loaded`
**Accessibility:** Hero heading is `<h1>`. Feature grid uses `<section>` with `aria-labelledby`. Code examples have `aria-label="Code example in {language}"`.

---

### Screen 2 — Dashboard

**URL:** `/dashboard`
**Purpose:** Developer command center. Shows API health, recent usage metrics, last 5 log entries, quota status, quick links, and a getting-started checklist for new developers.
**Components:** `components/dashboard/MetricTiles.tsx` (API calls today, tokens consumed, errors, latency), `components/dashboard/UsageMiniChart.tsx`, `components/dashboard/RecentLogs.tsx`, `components/dashboard/QuotaBar.tsx`, `components/dashboard/QuickActions.tsx`, `components/dashboard/GettingStartedChecklist.tsx`, `components/dashboard/PlatformStatusBar.tsx`
**Permissions:** Authenticated developer
**Loading state:** Metric tiles show skeleton pulse. Each widget loads independently with SWR so partial data appears immediately.
**Error state:** Failed widgets show `<ErrorWidget message="Could not load {metric}" retry />` in place. Dashboard never shows a blank screen.
**Empty state:** New developer (0 apps, 0 requests): `GettingStartedChecklist` is promoted to full-width, other widgets hidden until first API call.
**Analytics events:** `dashboard_viewed`, `quick_action_clicked(action)`, `checklist_step_clicked(step)`
**Accessibility:** Metric tiles use `role="status"` with `aria-live="polite"` for live updates. Charts include `aria-label` with full data summary.

---

### Screen 3 — Applications List

**URL:** `/apps`
**Purpose:** List all developer applications with summary stats (requests today, last used, environment). Create, search, and filter applications.
**Components:** `components/apps/AppCard.tsx`, `components/apps/AppGrid.tsx`, `components/apps/AppListEmpty.tsx`, `components/apps/AppSearch.tsx`, `components/apps/EnvironmentFilter.tsx`
**Permissions:** Authenticated developer
**Loading state:** 3 skeleton `AppCard` components
**Error state:** Full-width error banner with retry button
**Empty state:** Illustrated empty state with headline "Build your first integration" and CTA to `/apps/new`
**Analytics events:** `apps_list_viewed`, `app_card_clicked(app_id)`, `environment_filter_changed(env)`

---

### Screen 4 — Application Detail

**URL:** `/apps/[id]`
**Purpose:** Single application overview: health metrics, API key count, webhook status, recent log activity, and quick navigation to sub-sections.
**Components:** `components/apps/AppHeader.tsx` (name, icon, environment badge, edit button), `components/apps/AppMetrics.tsx`, `components/apps/AppKeysSummary.tsx`, `components/apps/AppWebhookStatus.tsx`, `components/apps/AppRecentLogs.tsx`
**Permissions:** Authenticated developer who owns the app (or org member with viewer+ role)
**Loading state:** Header skeleton + 4 metric tile skeletons
**Error state:** If app ID not found → redirect to `/apps` with toast "Application not found"
**Analytics events:** `app_detail_viewed(app_id)`, `app_section_clicked(section)`

---

### Screen 5 — Create Application

**URL:** `/apps/new`
**Purpose:** Multi-step form to create a new application. Steps: (1) Basic info (name, description, icon), (2) Environment selection, (3) Webhook URL (optional), (4) Review & create.
**Components:** `components/apps/AppForm.tsx`, `components/apps/AppCreateStepper.tsx`, `components/forms/StepIndicator.tsx`
**Permissions:** Authenticated developer
**Loading state:** Submit button shows spinner, all fields disabled during submission
**Error state:** Inline field validation via Zod. Server errors shown as toast.
**Success state:** After creation, redirect to `/apps/[new-id]` with toast "Application created. Your first API key is ready."
**Analytics events:** `app_create_started`, `app_create_step_completed(step)`, `app_create_submitted`, `app_create_succeeded(app_id)`

---

### Screen 6 — API Keys

**URL:** `/apps/[id]/keys`
**Purpose:** List all API keys for an application. Create new keys with optional IP allowlist, expiry, and scope selection. Reveal key once (shown in modal after creation, never again). Revoke keys.
**Components:** `components/keys/KeyList.tsx`, `components/keys/KeyRow.tsx`, `components/keys/KeyDisplay.tsx`, `components/keys/CreateKeyModal.tsx`, `components/keys/RevokeKeyConfirm.tsx`
**Permissions:** Authenticated app owner or org admin
**Loading state:** Table skeleton with 3 rows
**Error state:** Failed revoke shows error toast; row state reverts optimistically
**Empty state:** "No API keys yet" with CTA to create first key
**Success state (key creation):** Modal shows full key value once with copy button, countdown timer warning "This key will not be shown again", and "Done" button.
**Analytics events:** `api_keys_viewed(app_id)`, `api_key_created(app_id)`, `api_key_revoked(app_id)`, `api_key_copied`

---

### Screen 7 — SDK Hub

**URL:** `/sdks`
**Purpose:** Grid of all SDK cards grouped by official vs community. Filter by language. Each card shows version, install command preview, and download stats.
**Components:** `components/sdks/SDKGrid.tsx`, `components/sdks/SDKCard.tsx`, `components/sdks/LanguageFilter.tsx`
**Permissions:** Public
**Loading state:** 8 skeleton SDK cards
**Empty state:** N/A (always has official SDKs)
**Analytics events:** `sdk_hub_viewed`, `sdk_card_clicked(language)`, `language_filter_selected(language)`

---

### Screen 8 — SDK Detail

**URL:** `/sdks/[language]`
**Purpose:** Full SDK documentation: install, authenticate, first API call, full method reference, and version history. Language tabs allow switching between code examples.
**Components:** `components/sdks/SDKTabs.tsx`, `components/sdks/InstallCommand.tsx`, `components/sdks/MethodReference.tsx`, `components/sdks/SDKChangelog.tsx`, `components/sdks/SDKBadges.tsx`
**Permissions:** Public
**Loading state:** MDX content loaded statically (SSG); method reference lazy-loads
**Error state:** 404 page if language not found
**Analytics events:** `sdk_detail_viewed(language)`, `install_command_copied(language)`, `method_clicked(method, language)`

---

### Screen 9 — API Explorer

**URL:** `/explorer`
**Purpose:** Interactive REST client pre-loaded with the developer's API key. Left panel: endpoint list organized by resource group. Right panel: request builder + response viewer. Bottom panel: request history.
**Components:** `components/explorer/EndpointList.tsx`, `components/explorer/EndpointCard.tsx`, `components/explorer/TryItPanel.tsx`, `components/explorer/RequestBuilder.tsx`, `components/explorer/ResponseViewer.tsx`, `components/explorer/RequestHistory.tsx`
**Permissions:** Authenticated developer (API key auto-injected)
**Loading state:** OpenAPI spec fetch shows skeleton endpoint list
**Error state:** Network errors shown inline in ResponseViewer with status badge
**Streaming state:** Streaming endpoints show real-time token output in ResponseViewer with a stop button
**Offline state:** Shows "No network connection" banner; history still browsable
**Analytics events:** `explorer_viewed`, `endpoint_selected(endpoint, method)`, `request_sent(endpoint, method, status)`, `request_history_item_loaded`

---

### Screen 10 — AI Studio

**URL:** `/studio`
**Purpose:** Prompt playground for EduNexus AI APIs. Left: endpoint selector + parameter config. Center: prompt editor (system + user). Right: streaming output + token cost display. Bottom: session history.
**Components:** `components/studio/EndpointSelector.tsx`, `components/studio/ParameterPanel.tsx`, `components/studio/PromptEditor.tsx`, `components/studio/StreamingOutput.tsx`, `components/studio/TokenCostDisplay.tsx`, `components/studio/SessionHistory.tsx`, `components/studio/ModelComparison.tsx`
**Permissions:** Authenticated developer with API key
**Loading state:** Skeleton for endpoint list; instant on prompt editor
**Streaming state:** `StreamingOutput` renders tokens as they arrive via SSE. Shows "Generating…" badge + live token count + stop button.
**Error state:** API error shown inline in output panel with error code and human-readable description
**Analytics events:** `studio_viewed`, `studio_prompt_submitted(endpoint, input_tokens)`, `studio_response_received(endpoint, output_tokens, latency_ms)`, `studio_comparison_opened`

---

### Screen 11 — Knowledge Graph Explorer

**URL:** `/graph`
**Purpose:** Force-directed interactive visualization of the KICD CBC curriculum graph. Filter panel on left, graph canvas in center, node inspector panel on right (opens on node click).
**Components:** `components/graph/GraphCanvas.tsx`, `components/graph/GraphFilter.tsx`, `components/graph/NodeInspector.tsx`, `components/graph/GraphControls.tsx` (zoom, fit, reset), `components/graph/SchemaExplorer.tsx`
**Permissions:** Authenticated developer
**Loading state:** Canvas shows loading spinner; filter panel loads immediately
**Empty state (no filter results):** Canvas shows "No nodes match your filter" message with reset filter button
**Analytics events:** `graph_explorer_viewed`, `graph_node_clicked(node_type, node_id)`, `graph_filter_applied(filter_type)`, `graph_zoom_changed`

---

### Screen 12 — Marketplace

**URL:** `/marketplace`
**Purpose:** Browse and search community plugins. Filter by category, price model, rating, and compatibility. Featured plugins shown in hero row.
**Components:** `components/marketplace/MarketplaceHero.tsx`, `components/marketplace/MarketplaceCard.tsx`, `components/marketplace/MarketplaceFilter.tsx`, `components/marketplace/MarketplaceSearch.tsx`, `components/marketplace/FeaturedRow.tsx`
**Permissions:** Public (install requires auth)
**Loading state:** Skeleton grid of 8 plugin cards
**Empty state (no search results):** "No plugins found for '{query}'" with suggestion to submit a plugin
**Analytics events:** `marketplace_viewed`, `plugin_card_clicked(slug)`, `marketplace_search_performed(query)`, `marketplace_filter_applied(filter)`

---

### Screen 13 — Plugin Detail

**URL:** `/marketplace/[slug]`
**Purpose:** Full plugin profile: hero image, description, screenshots carousel, install button (one-click for authenticated users), configuration schema, reviews, and version history.
**Components:** `components/marketplace/PluginHero.tsx`, `components/marketplace/ScreenshotsCarousel.tsx`, `components/marketplace/PluginInstaller.tsx`, `components/marketplace/PluginConfigSchema.tsx`, `components/marketplace/ReviewList.tsx`, `components/marketplace/PluginCard.tsx`
**Permissions:** Public view; install requires auth + active plan
**Loading state:** Hero skeleton + content skeleton
**Error state:** 404 if slug not found
**Success state (install):** Toast "Plugin installed to [App Name]" + sidebar item for plugin configuration appears
**Analytics events:** `plugin_detail_viewed(slug)`, `plugin_install_clicked(slug)`, `plugin_installed(slug, app_id)`, `plugin_review_submitted(slug)`

---

### Screen 14 — CLI Portal

**URL:** `/cli`
**Purpose:** CLI download page with install instructions per OS, version history, and the authentication approval screen for the device flow.
**Components:** `components/cli/InstallGuide.tsx`, `components/cli/OSTabSelector.tsx`, `components/cli/VersionBadge.tsx`, `components/cli/CLIAuthApproval.tsx`, `components/cli/CommandReference.tsx`
**Permissions:** Install guide is public; auth approval requires authentication
**Loading state:** Version badge fetched client-side
**Success state (CLI auth approval):** "CLI authenticated successfully. You may close this tab."
**Analytics events:** `cli_page_viewed`, `cli_install_tab_selected(os)`, `cli_auth_approved`, `cli_auth_denied`

---

### Screen 15 — Organization Settings

**URL:** `/org/settings`
**Purpose:** Edit organization name, avatar, billing email, and SSO configuration. View and manage API key policies and enforce MFA for org members.
**Components:** `components/org/OrgSettingsForm.tsx`, `components/org/OrgAvatarUpload.tsx`, `components/org/SSOConfig.tsx`, `components/org/SecurityPolicies.tsx`
**Permissions:** Org owner only
**Loading state:** Form skeleton
**Success state:** Toast "Organization settings saved"
**Analytics events:** `org_settings_viewed`, `org_settings_saved`, `sso_configured`

---

### Screen 16 — Team Members

**URL:** `/org/members`
**Purpose:** List all org members with their role, last active date, and app access count. Invite new members by email. Change roles. Remove members.
**Components:** `components/org/MemberList.tsx`, `components/org/MemberRow.tsx`, `components/org/InviteModal.tsx`, `components/org/RoleSelector.tsx`
**Permissions:** Org owner and admin
**Loading state:** Table skeleton with 5 rows
**Empty state:** "Invite your first team member" CTA
**Analytics events:** `members_page_viewed`, `member_invited(role)`, `member_role_changed`, `member_removed`

---

### Screen 17 — Billing

**URL:** `/billing`
**Purpose:** Current plan display with entitlements, payment method management, invoice history, and plan upgrade/downgrade modal.
**Components:** `components/billing/PlanCard.tsx`, `components/billing/EntitlementList.tsx`, `components/billing/PaymentMethod.tsx`, `components/billing/InvoiceTable.tsx`, `components/billing/UpgradeModal.tsx`
**Permissions:** Developer or org billing admin
**Loading state:** Plan card skeleton + table skeleton
**Error state:** Payment method failure shown with inline alert and update card CTA
**Analytics events:** `billing_page_viewed`, `upgrade_modal_opened(current_plan)`, `plan_upgrade_confirmed(new_plan)`, `invoice_downloaded(invoice_id)`

---

### Screen 18 — Usage Dashboard

**URL:** `/usage`
**Purpose:** Full time-series analytics for API usage, token consumption, error rates, and cost. Granularity selector (day/week/month). Breakdown by app, endpoint group, and geography.
**Components:** `components/usage/UsageChart.tsx`, `components/usage/MetricTile.tsx`, `components/usage/QuotaIndicator.tsx`, `components/usage/GranularitySelector.tsx`, `components/usage/BreakdownTable.tsx`, `components/usage/ExportButton.tsx`
**Permissions:** Authenticated developer
**Loading state:** Metric tiles skeleton + chart skeleton with animated placeholder line
**Empty state (new developer, 0 requests):** "No usage data yet. Make your first API call to start seeing data here."
**Analytics events:** `usage_dashboard_viewed`, `granularity_changed(period)`, `breakdown_filter_applied(dimension)`, `usage_exported`

---

### Screen 19 — Logs

**URL:** `/logs`
**Purpose:** Filterable, searchable request log viewer. Filter by app, endpoint, status code range, and time range. Click any row to expand request/response detail.
**Components:** `components/logs/LogTable.tsx`, `components/logs/LogRow.tsx`, `components/logs/LogDetail.tsx` (drawer), `components/logs/LogFilter.tsx`, `components/logs/LogSearch.tsx`, `components/logs/LogExport.tsx`
**Permissions:** Authenticated developer
**Loading state:** Table skeleton
**Empty state (no logs for filter):** "No requests match your filters" with clear filters button
**Streaming state:** Live mode toggle auto-appends new log rows via SSE subscription
**Analytics events:** `logs_viewed`, `log_filter_applied`, `log_row_expanded(request_id)`, `log_live_mode_toggled(enabled)`, `logs_exported`

---

### Screen 20 — Certifications

**URL:** `/certifications`
**Purpose:** Browse four certification tracks, view enrollment status, and start/resume a track. Shows earned badges prominently.
**Components:** `components/certifications/TrackGrid.tsx`, `components/certifications/TrackCard.tsx`, `components/certifications/BadgeShelf.tsx`, `components/certifications/ProgressTracker.tsx`
**Permissions:** Authenticated developer
**Loading state:** Track cards skeleton
**Empty state (no enrollments):** "Start your first certification to build credentials"
**Analytics events:** `certifications_viewed`, `track_card_clicked(track_slug)`, `track_enrollment_started(track_slug)`

---

### Screen 21 — Community

**URL:** `/community`
**Purpose:** Forum thread list organized by category. Search, sort by (recent, trending, unanswered). New thread composer. Pinned announcements at top.
**Components:** `components/community/ThreadList.tsx`, `components/community/ThreadCard.tsx`, `components/community/CategoryFilter.tsx`, `components/community/NewThreadButton.tsx`, `components/community/PinnedAnnouncements.tsx`
**Permissions:** Authenticated to post; public to read
**Loading state:** Thread list skeleton
**Empty state:** "Be the first to post in this category"
**Analytics events:** `community_viewed`, `thread_clicked(thread_id)`, `category_filter_changed`, `new_thread_started`

---

### Screen 22 — Support

**URL:** `/support`
**Purpose:** Support ticket creation form and ticket history list. AI-powered category detection auto-fills category field. Ticket status tracker with message thread.
**Components:** `components/support/TicketForm.tsx`, `components/support/TicketList.tsx`, `components/support/TicketStatus.tsx`, `components/support/TicketThread.tsx`, `components/support/AITriage.tsx`
**Permissions:** Authenticated developer
**Loading state:** Ticket list skeleton
**Empty state:** "No support tickets. We hope you never need this page."
**Analytics events:** `support_viewed`, `ticket_submitted(category)`, `ticket_status_viewed(ticket_id)`, `ai_suggestion_accepted`

---

### Screen 23 — Admin Console

**URL:** `/admin`
**Purpose:** Internal admin dashboard. Search and manage developer accounts, review plugin submissions, configure feature flags, and view platform-wide metrics.
**Components:** `components/admin/AdminNav.tsx`, `components/admin/DeveloperSearch.tsx`, `components/admin/DeveloperTable.tsx`, `components/admin/PluginReviewQueue.tsx`, `components/admin/FeatureFlagTable.tsx`, `components/admin/PlatformMetrics.tsx`
**Permissions:** `admin` role only (checked server-side in middleware). Non-admins receive 403.
**Loading state:** Each section skeleton loads independently
**Analytics events:** `admin_console_viewed(section)`, `developer_suspended(developer_id)`, `plugin_approved(plugin_id)`, `feature_flag_toggled(flag_key)`

---

### Screen 24 — Developer Profile

**URL:** `/profile`
**Purpose:** Edit display name, avatar, bio, GitHub handle, and website. View earned certifications. Copy public profile URL.
**Components:** `components/profile/ProfileForm.tsx`, `components/profile/AvatarUpload.tsx`, `components/profile/CertBadgeList.tsx`, `components/profile/PublicProfileLink.tsx`
**Permissions:** Authenticated developer (own profile)
**Loading state:** Form skeleton
**Success state:** Toast "Profile updated"
**Analytics events:** `profile_viewed`, `profile_saved`, `public_profile_link_copied`

---

### Screen 25 — Settings

**URL:** `/settings`
**Purpose:** Account security settings: change email, change password, enable/disable MFA, manage active sessions, manage notification preferences, and delete account.
**Components:** `components/settings/EmailForm.tsx`, `components/settings/PasswordForm.tsx`, `components/settings/MFASettings.tsx`, `components/settings/SessionList.tsx`, `components/settings/NotificationPreferences.tsx`, `components/settings/DangerZone.tsx`
**Permissions:** Authenticated developer
**Loading state:** Per-section skeleton loading
**Success state:** Section-level "Saved" confirmation (inline, not toast — avoids conflicting toasts)
**Analytics events:** `settings_viewed(section)`, `mfa_enabled`, `session_revoked`, `account_deletion_requested`

---

# PART II — UI SYSTEM

---

## Chapter 4 — Design System

The design system for developers.edunexus.co.ke is implemented as a set of CSS custom properties applied to the `:root` and `[data-theme="dark"]` selectors. All component styles reference these tokens — never hard-coded hex values.

The design system lives in `styles/design-system.css`. Tailwind config in `tailwind.config.ts` reads these tokens via the `var()` function so Tailwind utility classes map to design tokens.

---

### 4.1 Color System

```css
:root {
  /* Brand */
  --color-brand-50:  #eef5ff;
  --color-brand-100: #d9e9ff;
  --color-brand-200: #bcd4fe;
  --color-brand-300: #8eb8fd;
  --color-brand-400: #5a91fa;
  --color-brand-500: #3b6ef6;  /* Primary brand */
  --color-brand-600: #2350e8;
  --color-brand-700: #1b3ecc;
  --color-brand-800: #1d35a5;
  --color-brand-900: #1d3182;

  /* Secondary (teal) */
  --color-secondary-50:  #edfcf7;
  --color-secondary-100: #d1f8ec;
  --color-secondary-200: #a8efda;
  --color-secondary-300: #70e1c0;
  --color-secondary-400: #37cba1;
  --color-secondary-500: #19b08a;  /* Secondary brand */
  --color-secondary-600: #0f8e70;
  --color-secondary-700: #0e715b;
  --color-secondary-800: #0e5a49;
  --color-secondary-900: #0e4a3c;

  /* Accent (amber) */
  --color-accent-400: #fbbf24;
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;

  /* Semantic */
  --color-success-50:  #f0fdf4;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;

  --color-warning-50:  #fffbeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;

  --color-error-50:  #fef2f2;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;

  --color-info-50:  #eff6ff;
  --color-info-500: #3b82f6;
  --color-info-600: #2563eb;

  /* Surfaces */
  --color-bg:         #ffffff;
  --color-surface:    #f8fafc;
  --color-surface-50: #f1f5f9;
  --color-surface-100:#e2e8f0;
  --color-elevated:   #ffffff;
  --color-overlay:    rgba(0, 0, 0, 0.5);

  /* Text */
  --color-text-primary:   #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted:     #94a3b8;
  --color-text-inverse:   #ffffff;
  --color-text-link:      #3b6ef6;

  /* Borders */
  --color-border:         #e2e8f0;
  --color-border-strong:  #cbd5e1;
  --color-border-focus:   #3b6ef6;
  --color-border-error:   #ef4444;
}

[data-theme="dark"] {
  --color-bg:         #0b0f1a;
  --color-surface:    #111827;
  --color-surface-50: #1e293b;
  --color-surface-100:#293548;
  --color-elevated:   #1e293b;
  --color-overlay:    rgba(0, 0, 0, 0.7);

  --color-text-primary:   #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted:     #64748b;
  --color-text-inverse:   #0f172a;
  --color-text-link:      #5a91fa;

  --color-border:         #1e293b;
  --color-border-strong:  #293548;
  --color-border-focus:   #5a91fa;

  /* Brand stays consistent in dark mode */
  /* Semantic backgrounds shift to darker variants */
  --color-success-50:  #052e16;
  --color-warning-50:  #1c1007;
  --color-error-50:    #1c0606;
  --color-info-50:     #06111c;
}
```

---

### 4.2 Spacing Scale

Base unit: `4px`. All spacing tokens are multiples.

```css
:root {
  --space-px:  1px;
  --space-0:   0px;
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-14:  56px;
  --space-16:  64px;
  --space-20:  80px;
  --space-24:  96px;
}
```

Named semantic tokens mapped from scale:
- `--spacing-page-x: var(--space-6)` — horizontal page padding (24px)
- `--spacing-section: var(--space-16)` — between major sections (64px)
- `--spacing-card-pad: var(--space-5)` — inside a card (20px)
- `--spacing-input-x: var(--space-3)` — input horizontal padding (12px)
- `--spacing-input-y: var(--space-2)` — input vertical padding (8px)

---

### 4.3 Typography

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  --font-display: 'Inter', var(--font-sans);

  /* Size scale */
  --text-xs:   12px;  /* line-height: 16px */
  --text-sm:   14px;  /* line-height: 20px */
  --text-base: 16px;  /* line-height: 24px */
  --text-lg:   18px;  /* line-height: 28px */
  --text-xl:   20px;  /* line-height: 28px */
  --text-2xl:  24px;  /* line-height: 32px */
  --text-3xl:  30px;  /* line-height: 36px */
  --text-4xl:  36px;  /* line-height: 40px */
  --text-5xl:  48px;  /* line-height: 52px */

  /* Weight scale */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* Letter spacing */
  --tracking-tight:  -0.025em;
  --tracking-normal:  0em;
  --tracking-wide:    0.025em;
  --tracking-wider:   0.05em;
  --tracking-widest:  0.1em;
}
```

Semantic text styles (applied via Tailwind component classes):
- `.text-heading-1` → 48px bold -0.025em
- `.text-heading-2` → 36px semibold -0.025em
- `.text-heading-3` → 24px semibold -0.015em
- `.text-heading-4` → 20px semibold 0
- `.text-body-lg` → 18px normal 0
- `.text-body` → 16px normal 0
- `.text-body-sm` → 14px normal 0
- `.text-caption` → 12px normal 0.01em
- `.text-code` → 14px mono 0 (JetBrains Mono)
- `.text-label` → 12px semibold 0.05em uppercase

---

### 4.4 Icons

Library: `lucide-react` (tree-shaken via named imports only).

Size variants and usage rules:

| Size | Token | Use case |
|---|---|---|
| 12px | `--icon-xs` | Badge icons, inline text icons |
| 16px | `--icon-sm` | Button icons, input prefix/suffix |
| 20px | `--icon-md` | Default — nav items, card icons |
| 24px | `--icon-lg` | Section headings, feature icons |
| 32px | `--icon-xl` | Empty state illustrations, hero icons |

Icon wrapper: `components/ui/Icon.tsx` — accepts `name: LucideIconName`, `size: 12 | 16 | 20 | 24 | 32`, `className`, `aria-hidden` (default `true`). Never render icons without either a visible text label or an `aria-label` on the parent.

---

### 4.5 Elevation (Shadow Scale)

```css
:root {
  --shadow-0: none;
  --shadow-1: 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-2: 0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10);
  --shadow-3: 0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10);
  --shadow-4: 0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10);
  --shadow-5: 0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10);
}
```

Usage guidance:
- `shadow-0` — flat elements (table rows, list items)
- `shadow-1` — input fields, small form controls
- `shadow-2` — cards on a white background
- `shadow-3` — dropdowns, popovers, tooltips
- `shadow-4` — dialogs, modals
- `shadow-5` — full-screen overlays, command palette

Dark mode: reduce all shadow opacities by 50% and add a subtle border: `border: 1px solid var(--color-border)` compensates for lost shadow definition.

---

### 4.6 Motion

```css
:root {
  --duration-instant:  0ms;
  --duration-fast:     100ms;
  --duration-normal:   200ms;
  --duration-slow:     300ms;
  --duration-slower:   500ms;

  --ease-default:   cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:        cubic-bezier(0.4, 0, 1, 1);
  --ease-out:       cubic-bezier(0, 0, 0.2, 1);
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-linear:    linear;
}
```

Reduced motion: every animated element wraps its transition in:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Animation usage rules:
- Hover state changes: `duration-fast` + `ease-default`
- Dropdown/popover open: `duration-normal` + `ease-out` (fade + slide 4px)
- Modal enter: `duration-slow` + `ease-spring` (scale 0.95→1 + fade)
- Page transitions: `duration-normal` + `ease-default` (fade only, no slide)
- Skeleton shimmer: `duration-slower` linear infinite
- Toast enter: `duration-normal` ease-spring (slide up 8px + fade)

---

### 4.7 Cards

Variants implemented in `components/ui/Card.tsx`:

| Variant | Style |
|---|---|
| `default` | `bg-elevated`, `border border-border`, `shadow-2`, `rounded-xl` |
| `bordered` | `bg-elevated`, `border-2 border-border-strong`, no shadow, `rounded-xl` |
| `elevated` | `bg-elevated`, `shadow-4`, no border, `rounded-xl` |
| `interactive` | `default` + `hover:shadow-3 hover:border-brand-200 cursor-pointer transition-all duration-fast` |
| `ghost` | `bg-transparent`, no border, no shadow — structure only |

Padding rules: `p-5` (20px) default. `p-3` for compact variants. `p-8` for feature/hero cards.

Card anatomy: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — composable sub-components, each a `div` with appropriate semantic padding and border.

---

### 4.8 Tables

`components/ui/DataTable.tsx` — built on `@tanstack/react-table` v8.

Column sizing: `minWidth: 80px` per column. Columns are resizable via drag. Column visibility toggle in header toolbar.

Row behaviors:
- Hover: `bg-surface-50` transition `duration-fast`
- Striping: `even:bg-surface` (optional, off by default)
- Selected: `bg-brand-50 border-l-2 border-brand-500`
- Clickable rows: `cursor-pointer` + full-row click handler

Sort indicators: `ArrowUp` / `ArrowDown` / `ArrowUpDown` icons (16px) appended to column header. Sorted column header text: `font-semibold`.

Pagination: `components/ui/TablePagination.tsx` — page size selector (`[10, 25, 50, 100]`), page info "1–25 of 1,234", prev/next buttons, first/last buttons on desktop.

Responsive collapse (mobile `< 768px`): DataTable renders each row as a stacked card with label:value pairs. Column headers hidden. Sort available via a select dropdown above the list.

---

### 4.9 Charts

Library: `recharts` v2.

Color palette (consistent across all chart types):
```
series-1: var(--color-brand-500)
series-2: var(--color-secondary-500)
series-3: var(--color-accent-500)
series-4: #8b5cf6  (violet)
series-5: #ec4899  (pink)
series-6: #06b6d4  (cyan)
```

Chart types implemented in `components/charts/`:

- `LineChart.tsx` — smooth curves, dot on hover, area fill at 10% opacity
- `BarChart.tsx` — vertical bars, grouped or stacked variants
- `AreaChart.tsx` — stacked area, gradient fill
- `DonutChart.tsx` — center label showing total or selected value
- `SparklineChart.tsx` — no axes, no grid, just the line — 60×24px default

All charts:
- Tooltip: `bg-elevated shadow-4 border-border rounded-lg p-3 text-sm`
- Axis: `text-text-muted text-xs`
- Grid lines: `stroke: var(--color-border) stroke-dasharray: 4 4`
- Responsive: wrapped in `ResponsiveContainer width="100%" height={height}`
- Loading state: skeleton rectangle of chart height
- Empty state: dashed border container with "No data for selected period" text centered

---

### 4.10 Forms

All form primitives in `components/ui/forms/`. Built on `react-hook-form` v7 + Zod resolver.

#### Input states:
```
default:  border-border bg-bg text-text-primary placeholder:text-text-muted
focus:    border-border-focus ring-2 ring-brand-500/20
error:    border-error-500 ring-2 ring-error-500/20
disabled: bg-surface-50 text-text-muted cursor-not-allowed opacity-60
loading:  bg-surface-50 with shimmer animation
```

All inputs: `height: 36px` (sm), `40px` (default), `48px` (lg). Font size: `14px` (sm/default), `16px` (lg). Padding: `12px` horizontal, `8px` vertical.

Form field wrapper `FormField.tsx`: renders label (above), input, and error message (below). Error message: `text-error-600 text-xs mt-1` with `role="alert"`.

Components:
- `Input` — text, email, password (with show/hide toggle), number, search (with clear button)
- `Textarea` — auto-resize (via `useAutoResize` hook), min-height 80px
- `Select` — custom styled, `radix-ui/react-select`, searchable with `cmdk` inside popover
- `Checkbox` — custom SVG checkmark, intermediate state supported
- `RadioGroup` — `radix-ui/react-radio-group`, card-style variant available
- `Toggle` / `Switch` — animated, `radix-ui/react-switch`
- `FileUpload` — drag-and-drop zone + click to open, file type/size validation, progress bar
- `DatePicker` — calendar popover, `date-fns` for formatting, range picker variant
- `ColorPicker` — hex input + hue/saturation picker, preset swatches

---

### 4.11 Dialogs

`components/ui/Dialog.tsx` — built on `radix-ui/react-dialog` with focus trap and scroll lock.

Sizes:
| Name | Max width | Use case |
|---|---|---|
| `sm` | 400px | Confirmation, simple form |
| `md` | 560px | Standard form, detail view |
| `lg` | 720px | Complex form, multi-step |
| `xl` | 960px | Preview, code viewer |
| `fullscreen` | 100vw 100vh | Studio, Graph Explorer fullscreen |

Animation: backdrop `fade-in duration-normal`. Dialog panel: `scale-from-95 fade-in duration-slow ease-spring`.

Structure: `DialogOverlay` (backdrop, `bg-overlay`), `DialogContent` (white panel, `shadow-5 rounded-2xl`), `DialogHeader`, `DialogTitle` (`text-heading-4`), `DialogDescription` (`text-text-secondary text-sm`), `DialogFooter` (right-aligned buttons), `DialogClose` (×  button, top-right absolute).

---

### 4.12 Notifications

`components/ui/Toast.tsx` — built on `sonner` library.

Positions: `bottom-right` (default desktop), `top-center` (mobile).

Variants:
| Variant | Icon | Left border color | Auto-dismiss |
|---|---|---|---|
| `success` | CheckCircle | `--color-success-500` | 4s |
| `error` | XCircle | `--color-error-500` | 8s (longer — needs reading) |
| `warning` | AlertTriangle | `--color-warning-500` | 6s |
| `info` | Info | `--color-info-500` | 4s |
| `loading` | Spinner | `--color-brand-500` | never (must be dismissed programmatically) |

Max visible toasts: 3. Stack with gap `8px`. On overflow, oldest dismissed.

API:
```typescript
import { toast } from 'lib/ui/toast';
toast.success('Application created');
toast.error('Failed to save — try again');
toast.loading('Generating AI response…', { id: 'ai-gen' });
toast.dismiss('ai-gen');
```

---

### 4.13 Badges

`components/ui/Badge.tsx`

```typescript
type BadgeProps = {
  children: React.ReactNode;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'secondary' | 'ghost';
  size: 'sm' | 'md';
  dot?: boolean;           // colored dot prepended
  icon?: React.ReactNode;  // icon prepended
  pulse?: boolean;         // pulsing animation on dot (for live indicators)
};
```

Sizes: `sm` — `h-5 px-2 text-xs rounded-full`, `md` — `h-6 px-2.5 text-xs rounded-full`

HTTP method badges (special variant): `GET`=info, `POST`=success, `PUT`=warning, `PATCH`=warning, `DELETE`=error. Monospace font. `uppercase`.

Status code badges: `2xx`=success, `3xx`=info, `4xx`=warning, `5xx`=error.

---

### 4.14 Code Blocks

`components/ui/CodeBlock.tsx`

```typescript
type CodeBlockProps = {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];   // e.g. [3, 4, 5] highlighted with bg-brand-50
  diff?: boolean;              // render +/- prefixes in diff color
  copyable?: boolean;          // default true
  maxHeight?: number;          // px — enables scrollable code area
  wrapLong?: boolean;          // default false — horizontal scroll vs wrap
};
```

Syntax highlighting: `shiki` with themes `github-light` (light mode) and `github-dark-dimmed` (dark mode). Themes applied via CSS variable override to stay in sync with `data-theme` attribute.

Copy button: absolute top-right, icon-only with `title="Copy"`, shows checkmark for 2s after copy then reverts.

Filename bar (when `filename` provided): dark bar above code area showing filename with appropriate file icon from `lucide-react`. Same bar shows language tag if no filename.

---

### 4.15 Terminal Component

`components/ui/Terminal.tsx`

```css
.terminal {
  background: #0d1117;
  color: #c9d1d9;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #30363d;
  overflow-y: auto;
  max-height: 400px;
  scrollbar-width: thin;
  scrollbar-color: #30363d transparent;
}
.terminal-prompt::before {
  content: '$ ';
  color: #3fb950;
  user-select: none;
}
.terminal-output { color: #c9d1d9; }
.terminal-error  { color: #f85149; }
.terminal-cursor {
  display: inline-block;
  width: 8px;
  height: 14px;
  background: #c9d1d9;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}
@keyframes blink { 50% { opacity: 0; } }
```

Scrollback: virtual scrolling via `react-virtual` for large output buffers (>500 lines). Auto-scroll to bottom on new output unless user has scrolled up (detected via scroll position threshold).

---

### 4.16 API Response Viewer

`components/ui/ResponseViewer.tsx`

Layout: tabs across top — `Response`, `Headers`, `Cookies`, `Raw`.

Status bar: `HTTPStatusBadge` (variant by code range) + latency chip (`{n}ms`) + size chip (`{n} KB`) — all in a gray bar below tabs.

Body tab: syntax-highlighted JSON via `shiki`. Collapsible tree via `components/ui/JSONViewer.tsx` for objects. Binary/non-JSON: hex view with ASCII side panel.

Headers tab: key-value table, `text-code` font for both columns.

When `streaming: true`: body tab shows streaming tokens in real-time. Typing cursor at end. Token count increments live. Stop button (`StopCircle` icon, red) appears.

---

### 4.17 JSON Viewer

`components/ui/JSONViewer.tsx`

Interactive collapsible JSON tree.
- Top-level: expand/collapse all button
- Each object/array node: clickable chevron to collapse, path shown in breadcrumb on hover
- String values: `text-success-600`, numbers: `text-brand-500`, booleans: `text-accent-500`, null: `text-text-muted italic`
- Search: text input at top filters visible nodes (highlights match, collapses non-matching paths)
- Copy path: hover any key → copy icon appended → copies JSON path (e.g. `data.students[0].name`)
- Max depth auto-collapsed: objects/arrays deeper than 3 levels collapse by default

---

### 4.18 Markdown Renderer

`components/ui/MarkdownRenderer.tsx` — built on `next-mdx-remote` for MDX content.

GFM support: tables, strikethrough, task lists, autolinks.

Code fences: delegated to `CodeBlock` component with language from fence info string. Languages supported: `typescript`, `javascript`, `python`, `dart`, `bash`, `json`, `yaml`, `sql`, `go`, `ruby`, `php`.

Anchor links: every `h2`/`h3`/`h4` heading gets an auto-generated ID and a `#` link icon on hover.

Table of contents sidebar: `components/ui/TableOfContents.tsx` — sticky `aside` panel on desktop (`>1280px`) showing all `h2` headings with active highlight based on scroll position (IntersectionObserver).

Admonitions: special blockquote syntax `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, `> [!DANGER]` rendered as colored callout boxes.

---

### 4.19 Graph Visualization

`components/ui/GraphCanvas.tsx` — built on `cytoscape.js` with `cytoscape-fcose` layout algorithm.

Node shapes by type:
| Node type | Shape | Fill color |
|---|---|---|
| Subject | Circle | `--color-brand-500` |
| Strand | RoundRectangle | `--color-secondary-500` |
| Topic | Hexagon | `--color-accent-500` |
| Learning Outcome | Diamond | `#8b5cf6` |
| Competency | Star | `#ec4899` |
| Assessment | Triangle | `#06b6d4` |

Edge types: solid (prerequisite), dashed (related), dotted (assessment-to-outcome mapping).

Controls: zoom in/out buttons, fit-to-view button, reset layout button, fullscreen toggle. All implemented as overlay buttons on the canvas `div`.

Selection: click selects node (highlight ring `3px brand-500`), `Shift+click` multi-select, click empty space deselects all.

Tooltip on hover: `NodeTooltip.tsx` — shows node type badge + name + ID + relationship count. Appears after `200ms` hover delay. Positioned 16px right of cursor.

---

### 4.20 Dark Mode

Implementation:
1. `data-theme` attribute set on `<html>` element by `ThemeProvider` (`components/providers/ThemeProvider.tsx`)
2. Default: system preference via `window.matchMedia('(prefers-color-scheme: dark)')`
3. User override stored in `localStorage` key `"theme"` (`"light"` | `"dark"` | `"system"`)
4. On hydration: theme applied before paint via inline script in `<head>` (prevents flash of wrong theme)
5. All colors reference `var(--color-*)` tokens — dark mode variants override the same tokens inside `[data-theme="dark"]`
6. Third-party components (Shiki, Recharts, Cytoscape): receive theme prop derived from current `data-theme` and re-render when theme changes

Theme switcher: `components/ui/ThemeSwitcher.tsx` — three-way toggle: Light / System / Dark. Renders in top bar user menu and in `/settings`.

---

### 4.21 Accessibility

WCAG 2.1 AA targets. Minimum color contrast:
- Normal text: 4.5:1
- Large text (≥18px bold or ≥24px): 3:1
- UI components and graphical objects: 3:1

Focus ring: `outline: 2px solid var(--color-border-focus); outline-offset: 2px` — applied globally via:
```css
:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
```

Skip link: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>` as first element in `<body>`.

ARIA patterns:
- Navigation: `role="navigation"` with `aria-label`
- Live regions: metric tiles use `aria-live="polite"` with `aria-atomic="true"`
- Modal dialogs: `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to dialog title
- Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"` per ARIA Authoring Practices
- Combobox (Cmd+K): ARIA combobox pattern with `aria-expanded`, `aria-owns`, `aria-activedescendant`

---

## Chapter 5 — Component Library

Every reusable component is specified below with its complete TypeScript props interface, behavior description, and accessibility notes. All components live in `components/ui/` or the domain subfolder indicated.

---

### 5.1 `CodeBlock`

```typescript
// components/ui/CodeBlock.tsx
type CodeBlockProps = {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;       // default: false
  highlightLines?: number[];       // 1-indexed line numbers to highlight
  diff?: boolean;                  // enable diff mode: lines starting with '+'/'-' colored
  copyable?: boolean;              // default: true — show copy button
  maxHeight?: number;              // if set, enables vertical scroll
  wrapLong?: boolean;              // default: false — horizontal scroll
  className?: string;
  onCopy?: () => void;             // callback after copy
};
```

**Behavior:** Uses `shiki` to tokenize and highlight. In diff mode, lines prefixed `+` get `bg-success-50` highlight and `+` shown in green; lines prefixed `-` get `bg-error-50` and `-` in red; the prefix character is `user-select: none`. `highlightLines` applies `bg-brand-50` to specified line numbers. Copy button uses `navigator.clipboard.writeText()` with fallback to `execCommand('copy')`. After copy, icon switches from `Copy` to `Check` for 2000ms.

**Accessibility:** Code block wrapped in `<figure>` with optional `<figcaption>` (filename). Copy button has `aria-label="Copy code"` and `aria-pressed` toggled to `"true"` for 2s after copy. `<code>` element has `role="code"`.

---

### 5.2 `EndpointCard`

```typescript
// components/ui/EndpointCard.tsx
type EndpointCardProps = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: 'required' | 'optional' | 'none';
  deprecated?: boolean;
  beta?: boolean;
  onClick?: () => void;
  className?: string;
};
```

**Behavior:** Renders as a clickable card (if `onClick` provided) showing `HTTPMethodBadge` + `path` in mono font + description in muted text. If `deprecated=true`: `path` has `line-through` and a yellow warning badge "Deprecated" appended. If `beta=true`: blue "Beta" badge appended after path. Auth indicator: `Lock` icon if required, `LockOpen` if optional, nothing if none.

**Accessibility:** `role="button"` when clickable with `tabIndex=0` and `onKeyDown` handling Enter/Space. `aria-label="{method} {path}"`. Deprecated state adds `aria-description="This endpoint is deprecated"`.

---

### 5.3 `SDKTabs`

```typescript
// components/ui/SDKTabs.tsx
type SDKSnippet = {
  language: string;
  label: string;           // e.g. "TypeScript", "Python"
  code: string;
  packageManager?: string; // e.g. "npm install @edunexus/sdk"
};

type SDKTabsProps = {
  languages: string[];
  defaultLanguage?: string;
  snippets: Record<string, SDKSnippet>;
  onCopy?: (language: string) => void;
  className?: string;
  showPackageManager?: boolean;  // default: true — show install command above code
};
```

**Behavior:** Renders a tab bar with one tab per language. Tab labels use language icon (via `components/ui/LanguageIcon.tsx`) + label text. Active tab state: bottom border `2px brand-500` + text `brand-600`. Switching tabs swaps the displayed `CodeBlock`. If `showPackageManager=true` and `packageManager` exists, shows a secondary `CodeBlock` with `language="bash"` above the main snippet. Selected language persisted in `localStorage` key `"preferred_sdk_language"` and applied as default on subsequent views.

**Accessibility:** `role="tablist"` with `aria-label="Code language"`. Each tab: `role="tab"` with `aria-selected` and `aria-controls` pointing to panel ID. Tab panel: `role="tabpanel"`. Keyboard: `ArrowLeft`/`ArrowRight` navigate tabs.

---

### 5.4 `TryItPanel`

```typescript
// components/ui/TryItPanel.tsx
type TryItPanelProps = {
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
  };
  defaultParams?: Record<string, unknown>;
  auth: {
    type: 'bearer' | 'apikey';
    value?: string;     // pre-filled from developer's active key
    label?: string;     // key name display
  };
  onSend: (request: TryItRequest) => Promise<TryItResponse>;
  streaming?: boolean;
  className?: string;
};

type TryItRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

type TryItResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  latencyMs: number;
  streaming?: ReadableStream<string>;
};
```

**Behavior:** Composed panel: top bar shows method badge + URL with path params editable inline. Headers section (collapsible). Body section (JSON editor with schema-based autocomplete for known endpoints). Auth section shows pre-filled key with mask + change option. Send button triggers `onSend`. While loading: button shows spinner and is disabled, response panel shows loading skeleton. If `streaming=true`: response streams token by token via `ReadableStream`. Stop button appears to abort.

**Accessibility:** Send button `aria-busy="true"` during request. Status section has `role="status"` with `aria-live="polite"`.

---

### 5.5 `ResponseViewer`

```typescript
// components/ui/ResponseViewer.tsx
type ResponseViewerProps = {
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    latencyMs: number;
    sizeBytes: number;
  };
  loading?: boolean;
  error?: string;
  streaming?: boolean;
  streamContent?: string;   // accumulated streaming text so far
  maxHeight?: number;       // default: 400
  onStop?: () => void;      // stop streaming
  className?: string;
};
```

**Behavior:** Tab bar: Response / Headers / Raw. Status bar (always visible): `HTTPStatusBadge` + latency chip + size chip. Response tab: `JSONViewer` if body is valid JSON, else `CodeBlock language="text"`. Headers tab: `DataTable` with key/value columns. Raw tab: raw string in `Terminal`-style component. Streaming: body tab shows accumulating text + cursor + live token count. Loading: all areas show skeleton. Error: red banner with error message in place of tabs.

**Accessibility:** `aria-live="polite"` on body panel during streaming. Status bar `role="status"`.

---

### 5.6 `RequestBuilder`

```typescript
// components/ui/RequestBuilder.tsx
type RequestBuilderProps = {
  endpoint: {
    method: string;
    path: string;
    pathParams?: Record<string, { type: string; required: boolean; description: string }>;
    queryParams?: Record<string, { type: string; required: boolean; description: string; default?: unknown }>;
    bodySchema?: JSONSchema;
    headers?: Record<string, { type: string; required: boolean }>;
  };
  value: RequestBuilderValue;
  onChange: (value: RequestBuilderValue) => void;
  onSubmit: (request: TryItRequest) => void;
  className?: string;
};

type RequestBuilderValue = {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body: string;  // JSON string
};
```

**Behavior:** Four sections: Path Params (inputs for `{param}` placeholders), Query Params (key-value table with schema-driven inputs), Headers (key-value table), Body (JSON editor with Zod-schema autocomplete). Path params auto-extracted from endpoint path template. Body editor uses Monaco Editor in JSON mode with schema validation. Required fields marked with `*` and show validation error if empty on submit.

**Accessibility:** Each section is a `<fieldset>` with `<legend>`. Error messages linked via `aria-describedby`.

---

### 5.7 `APIStatus`

```typescript
// components/ui/APIStatus.tsx
type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';

type APIStatusProps = {
  service: string;
  status: ServiceStatus;
  latency?: number;        // p95 latency in ms
  uptime?: number;         // percentage, e.g. 99.98
  incidents?: { title: string; startedAt: string }[];
  compact?: boolean;       // badge-only display
  className?: string;
};
```

**Behavior:** Full mode: service name + status indicator dot (green/yellow/orange/red/blue for operational/degraded/partial/major/maintenance) + latency + uptime bar (90-day green blocks) + incident count. Compact mode: just name + colored dot + status text. Status dot `pulse` animation for non-operational statuses. Click opens status incident timeline drawer.

**Accessibility:** Status color alone not relied upon — also shown as text. `aria-label="{service}: {status}"` on the dot indicator.

---

### 5.8 `WebhookCard`

```typescript
// components/ui/WebhookCard.tsx
type WebhookCardProps = {
  webhook: {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    lastDeliveryAt?: string;
    lastDeliveryStatus?: 'success' | 'failed';
    failureCount?: number;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  className?: string;
};
```

**Behavior:** Card shows masked URL (show domain only by default, full URL expandable), event tags (up to 3 shown, `+N more` badge for rest), last delivery indicator (green checkmark or red X with failure count). Three-dot menu in top-right with Edit / Test / Delete actions. Toggle switch for enable/disable. Test action sends a test payload and shows inline toast with result.

**Accessibility:** Toggle has `aria-label="Enable webhook for {url}"`. Action menu button `aria-label="Webhook actions"` with `aria-haspopup="menu"`.

---

### 5.9 `PluginCard`

```typescript
// components/ui/PluginCard.tsx
type PluginCardProps = {
  plugin: {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    author: string;
    version: string;
    rating: number;      // 0–5
    installCount: number;
    priceModel: 'free' | 'paid' | 'freemium';
    category: string;
    tags: string[];
  };
  installed?: boolean;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onClick: (id: string) => void;
  className?: string;
};
```

**Behavior:** Square card with icon (48px, rounded-lg), name, description (2-line clamp), star rating display, install count, price badge. Install button changes to "Installed" with checkmark when `installed=true`; Uninstall appears as secondary button on hover. Card click navigates to plugin detail. Price model: "Free" (success badge), "Paid" (brand badge), "Freemium" (secondary badge).

**Accessibility:** Card `role="article"` with `aria-label="{name} plugin"`. Rating `aria-label="Rated {n} out of 5 stars"`.

---

### 5.10 `MarketplaceCard`

```typescript
// components/ui/MarketplaceCard.tsx
type MarketplaceCardProps = {
  plugin: PluginCardProps['plugin'];
  featured?: boolean;       // wider card with screenshot preview
  onInstall: (id: string) => void;
  onViewDetails: (id: string) => void;
  className?: string;
};
```

**Behavior:** Standard variant: same as `PluginCard`. Featured variant: wider (spans 2 columns in grid), shows a screenshot image in the top half with gradient overlay, larger description area, prominent CTA button. Featured badge ("Featured") shown as an absolute badge in top-left of screenshot.

**Accessibility:** Featured badge `aria-label="Featured plugin"`. Screenshot `alt="{name} plugin screenshot"`.

---

### 5.11 `MetricTile`

```typescript
// components/ui/MetricTile.tsx
type MetricTileProps = {
  label: string;
  value: string | number;
  delta?: number;                    // change vs previous period, e.g. +12.5
  deltaDirection?: 'up' | 'down';    // whether 'up' is good or bad
  deltaGood?: 'up' | 'down';         // which direction is positive (default: 'up')
  sparklineData?: number[];          // 7–30 data points for sparkline
  loading?: boolean;
  unit?: string;                     // e.g. 'req', 'tokens', 'ms'
  className?: string;
};
```

**Behavior:** Card with label (small, muted), value (large, bold), delta (with up/down arrow, colored green if good direction, red if bad), and 60×24px sparkline. Loading state: all text areas shimmer. Delta direction and `deltaGood` control color independently (e.g. for error rate: up=bad→delta red even when positive number).

**Accessibility:** `role="status"` with `aria-label="{label}: {value} {unit}, {delta direction} {|delta|}% from last period"`.

---

### 5.12 `GraphNode`

```typescript
// components/ui/GraphNode.tsx  (used as Cytoscape.js node renderer extension)
type GraphNodeProps = {
  node: {
    id: string;
    label: string;
    type: 'subject' | 'strand' | 'topic' | 'outcome' | 'competency' | 'assessment';
    level?: string;       // e.g. 'Grade 7'
    metadata?: Record<string, unknown>;
  };
  selected?: boolean;
  hovered?: boolean;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  onExpand: (nodeId: string) => void;  // load and show children
};
```

**Behavior:** Cytoscape node styled per node type (shape and color per Chapter 4.19). Selected: `3px` ring in `brand-500`. Hovered: `2px` ring in `secondary-500`, scale `1.05` transform. Double-click triggers `onExpand` to lazy-load children from API. Right-click opens context menu: Inspect, Expand, Collapse, Copy ID, View in Docs.

**Accessibility:** Cytoscape canvas has `role="img"` with `aria-label="CBC Curriculum Knowledge Graph"`. Node details accessible via the `NodeInspector` panel which renders DOM (accessible); canvas itself is a non-DOM rendering surface.

---

### 5.13 `Timeline`

```typescript
// components/ui/Timeline.tsx
type TimelineEvent = {
  id: string;
  timestamp: string;     // ISO 8601
  title: string;
  description?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  metadata?: Record<string, string>;
};

type TimelineProps = {
  events: TimelineEvent[];
  loading?: boolean;
  onLoadMore?: () => void;   // if present, "Load more" button shown at bottom
  emptyState?: React.ReactNode;
  className?: string;
};
```

**Behavior:** Vertical timeline with left-side connecting line (`2px border-border`). Each event: colored dot (by type), title + relative timestamp (`date-fns formatDistanceToNow`), optional description. Loading: skeleton dots + skeleton text lines. `onLoadMore` shows a "Load older events" button that shows spinner while loading. Empty state renders `emptyState` prop or default "No events" message.

**Accessibility:** `<ol>` with each event as `<li>`. Timestamps use `<time dateTime={iso}>` with relative display text. Live updates (new prepended events) announced via `aria-live="polite"`.

---

### 5.14 `StreamingOutput`

```typescript
// components/ui/StreamingOutput.tsx
type StreamingOutputProps = {
  stream?: ReadableStream<string>;
  content?: string;        // static content (non-streaming mode)
  loading?: boolean;
  error?: string;
  onStop?: () => void;
  formatter?: 'plain' | 'markdown' | 'json';  // default: 'plain'
  className?: string;
  maxHeight?: number;
};
```

**Behavior:** Renders accumulated streaming content. In `plain` mode: monospace pre-formatted text. In `markdown` mode: renders `MarkdownRenderer` updating as content grows. In `json` mode: `JSONViewer` updated in real time. Cursor blinks at end while streaming. Stop button (`StopCircle` icon, red, top-right) visible during streaming. Auto-scrolls to bottom unless user scrolled up. Token count shown in bottom-right corner (updated every 100ms debounced to avoid thrash). Streaming ends: cursor disappears, stop button disappears, "Done" indicator fades in.

**Accessibility:** `role="log"` with `aria-live="polite"` and `aria-atomic="false"`. Stop button `aria-label="Stop generation"`. Token count `aria-live="off"` (decorative).

---

### 5.15 `CommandPalette`

```typescript
// components/ui/CommandPalette.tsx
type CommandSection = {
  id: string;
  heading: string;
  items: CommandItem[];
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string[];    // e.g. ['⌘', 'N']
  onSelect: () => void;
  badge?: string;
  group?: string;         // sub-grouping within section
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  sections: CommandSection[];
  onSelect?: (item: CommandItem) => void;  // before item's own onSelect
  placeholder?: string;
  className?: string;
};
```

**Behavior:** Fullscreen overlay (mobile) or centered modal (`560px` wide, desktop). Input at top with search icon. Sections rendered with headings. Items: icon + label + optional description + optional keyboard shortcut badge. Keyboard: `ArrowUp`/`ArrowDown` navigate, `Enter` activates, `Escape` closes. Mouse hover also tracks active item. Filtering: case-insensitive fuzzy match using `fuse.js` across all items. Score threshold `0.4`. Zero results: "No results for '{query}'" message.

**Accessibility:** `role="combobox"` on input with `aria-controls` pointing to listbox. `role="listbox"` on results. Active item tracked with `aria-activedescendant`. Dialog wrapped in `aria-modal="true"`.

---

### 5.16 `DeveloperProfileCard`

```typescript
// components/ui/DeveloperProfileCard.tsx
type DeveloperProfileCardProps = {
  developer: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    githubHandle?: string;
    websiteUrl?: string;
    joinedAt: string;
    certifications?: { name: string; badgeUrl: string }[];
    stats?: { apps: number; apiCalls: number; plugins: number };
  };
  showStats?: boolean;    // default: true
  showBadges?: boolean;   // default: true
  compact?: boolean;      // avatar + name only, tooltip with full info on hover
  className?: string;
};
```

**Behavior:** Avatar (48px rounded-full, fallback initials generated from `displayName`), name, bio (2-line clamp), GitHub/website links as icon buttons. Stats row if `showStats`: apps count, API calls, plugins published. Certification badges row if `showBadges` (24px badge icons with tooltip). Compact mode shows just avatar + name; full card expands in a popover on hover/focus. Join date: "Member since {month} {year}".

**Accessibility:** Avatar `aria-label="{displayName}'s avatar"`. Compact popover: `role="tooltip"` association via `aria-describedby`.

---

### 5.17 `UsageChart`

```typescript
// components/ui/UsageChart.tsx
type UsageDataPoint = {
  date: string;    // ISO date string
  value: number;
};

type UsageChartProps = {
  data: UsageDataPoint[];
  metric: 'requests' | 'tokens' | 'errors' | 'latency' | 'cost';
  period: 'day' | 'week' | 'month';
  comparison?: UsageDataPoint[];   // prior period data for overlay
  loading?: boolean;
  height?: number;                 // default: 200
  className?: string;
};
```

**Behavior:** Line chart using `recharts`. Primary series in `brand-500` with area fill at 10% opacity. Comparison series (if provided) in dashed `text-muted` line, no fill. X-axis: date labels formatted by period (day=`HH:mm`, week/month=`MMM dd`). Y-axis: auto-scaled with nice tick values, unit suffix appended to label (`req`, `tok`, `ms`, `KES`). Tooltip: date + current value + comparison value + delta%. Loading: skeleton rectangle. Empty (all zeros): chart renders but with "No data" overlay text.

**Accessibility:** `role="img"` with `aria-label="Usage chart: {metric} over last {period}"` summarizing total and trend direction.

---

### 5.18 `QuotaIndicator`

```typescript
// components/ui/QuotaIndicator.tsx
type QuotaIndicatorProps = {
  used: number;
  limit: number;
  label: string;
  warningThreshold?: number;    // default: 0.8 (80%)
  criticalThreshold?: number;   // default: 0.95 (95%)
  unit?: string;
  showNumbers?: boolean;        // default: true — show "{used} / {limit} {unit}"
  compact?: boolean;            // thin bar only, no label or numbers
  className?: string;
};
```

**Behavior:** Labeled progress bar. Bar fill: `success-500` below warning threshold, `warning-500` between warning and critical, `error-500` above critical. Numbers shown as `"{used formatted} / {limit formatted} {unit}"` below bar. Overage (used > limit): bar solid red, numbers show `"{used} / {limit} — OVER LIMIT"`. Compact mode: just the bar `height: 4px`, label in tooltip.

**Accessibility:** `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-label`. When over limit: `aria-describedby` points to hidden text "You have exceeded your quota limit".

---

### 5.19 `KeyDisplay`

```typescript
// components/ui/KeyDisplay.tsx
type KeyDisplayProps = {
  apiKey: string;         // full key value (only known at creation time)
  prefix?: string;        // e.g. "en_live_" prefix for display in list view
  masked?: boolean;       // default: true — show as "en_live_••••••••••••xxxx"
  onCopy: () => void;
  onReveal?: () => void;  // null if key can no longer be revealed
  onRevoke: () => void;
  className?: string;
};
```

**Behavior:** Key value displayed in monospace. Masked by default: prefix shown, middle replaced with `•` characters, last 4 chars shown. If `masked=true` and `onReveal` provided: eye icon button to reveal full key. Reveal requires MFA confirmation if developer has MFA enabled (opens MFA modal, calls `onReveal` only on success). Copy button copies currently displayed value (masked or revealed). Revoke: destructive secondary button, opens confirmation dialog before calling `onRevoke`. After revoke: component grays out with "Revoked" badge.

**Accessibility:** Key input `aria-label="API key, masked"` (or `"API key, revealed"` when shown). Copy button `aria-label="Copy API key"`. Revoke `aria-label="Revoke this API key"`.

---

### 5.20 `WebhookEventLog`

```typescript
// components/ui/WebhookEventLog.tsx
type WebhookDelivery = {
  id: string;
  eventType: string;
  deliveredAt: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus?: number;
  latencyMs?: number;
  attemptCount: number;
  payload?: Record<string, unknown>;
  responseBody?: string;
};

type WebhookEventLogProps = {
  events: WebhookDelivery[];
  loading?: boolean;
  onFilter: (filter: { status?: string; eventType?: string }) => void;
  onRetry: (deliveryId: string) => void;
  className?: string;
};
```

**Behavior:** Table of delivery attempts. Columns: Event type, Status badge, Response code, Latency, Time, Attempts, Actions. Status: green checkmark (success), red X (failed), spinner (pending). Row click expands inline detail: request payload (JSON), response body, full timestamp. Retry button (failed deliveries only): sends re-delivery and updates row to pending state optimistically. Filter bar above table: event type multi-select, status filter, time range picker.

**Accessibility:** Table `role="grid"`. Expandable rows: expanded row has `aria-expanded="true"`. Retry button `aria-label="Retry delivery {id}"`.

---

### 5.21 `SchemaExplorer`

```typescript
// components/ui/SchemaExplorer.tsx
type SchemaNode = {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;   // for array types
  example?: unknown;
};

type SchemaExplorerProps = {
  schema: SchemaNode;
  path?: string;              // current path for breadcrumb
  onNavigate?: (path: string) => void;  // for deep schemas
  onSearch?: (query: string) => void;
  className?: string;
};
```

**Behavior:** Renders a JSON Schema as an interactive tree. Each property shown as a row: name (code font), type badge (colored by type: `string`=teal, `number`=blue, `boolean`=amber, `object`=purple, `array`=orange), required indicator (`*`), and description. Object/array types are expandable. Path breadcrumb shown above when navigated into a nested object. Search filters visible properties. Example values shown in muted text when `example` provided.

**Accessibility:** Tree uses `role="tree"` with `role="treeitem"` for each property. `aria-expanded` on expandable nodes. `aria-level` tracks nesting depth.

---

### 5.22 `EnvironmentSwitcher`

```typescript
// components/ui/EnvironmentSwitcher.tsx
type Environment = {
  id: string;
  name: string;
  type: 'sandbox' | 'production';
  appId: string;
  color?: string;    // custom hex for visual differentiation
};

type EnvironmentSwitcherProps = {
  environments: Environment[];
  current: string;    // environment id
  onChange: (envId: string) => void;
  onCreate?: () => void;  // opens create environment flow
  className?: string;
};
```

**Behavior:** Dropdown trigger shows current environment name + colored dot + type badge. Dropdown lists all environments with colored dots. Switching environment triggers `onChange` and updates all API calls in the Explorer and Studio to use the new app context. Production environments: orange dot + "Production" badge with a `!` warning shown in dropdown. Creating via `onCreate`: opens a modal to name and configure the new environment.

**Accessibility:** `role="combobox"` on trigger. `role="listbox"` on dropdown. Production option has `aria-description="Production environment — requests are live"`.

---

### 5.23 `AuthBadge`

```typescript
// components/ui/AuthBadge.tsx
type AuthBadgeProps = {
  type: 'bearer' | 'apikey' | 'oauth2' | 'none';
  required: boolean;
  description?: string;
  className?: string;
};
```

**Behavior:** Small inline badge showing auth type. `bearer` → `Lock` icon + "Bearer JWT". `apikey` → `Key` icon + "API Key". `oauth2` → `Shield` icon + "OAuth 2.0". `none` → `LockOpen` icon + "No auth". Color: required=`brand` variant, optional=`secondary` variant. On hover: tooltip showing `description` text or default description per auth type.

**Accessibility:** Badge `aria-label="Authentication: {type}, {required ? 'required' : 'optional'}"`. Tooltip linked via `aria-describedby`.

---

### 5.24 `RateLimitBar`

```typescript
// components/ui/RateLimitBar.tsx
type RateLimitBarProps = {
  requests: number;     // requests made in current window
  limit: number;        // max requests in window
  resetAt: string;      // ISO timestamp when window resets
  tier: string;         // e.g. "Free", "Growth", "Enterprise"
  className?: string;
};
```

**Behavior:** Thin progress bar (`height: 6px`) + text below: `"{requests} / {limit} requests — resets in {time}"` where time is computed live using `useInterval` every second (countdown). Bar color: `success-500` below 80%, `warning-500` 80–95%, `error-500` above 95%. At 100%: bar is solid red, text shows "Rate limit reached — resets in {countdown}". Tier badge shown inline. Upgrade CTA link appended when on Free tier and above 80%.

**Accessibility:** `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-label="Rate limit: {requests} of {limit} requests used"`. Reset time announced via `aria-describedby` pointing to the countdown text.

---

---

## PART III — DEVELOPER EXPERIENCE

### Chapter 6 — Onboarding Journey

Onboarding is the moment a developer decides whether to stay. Every step must be deliberate, fast, and rewarding. This chapter specifies every screen, database write, analytics event, and recovery path in the complete onboarding flow.

---

#### Anonymous Visitor Flow

**URL:** `/` (marketing landing page)

The landing page renders immediately without authentication. The hero section contains a single primary CTA: "Start building free." Clicking it opens a `SignupModal` component (Dialog, no page navigation). The modal collects: email, password, developer name. On submit it calls `POST /api/auth/signup` which creates a Supabase auth user and inserts a row into `developer_profiles`. Email verification is sent automatically.

**URL:** `/verify` — awaiting email confirmation. Shows countdown "Resend in {seconds}" using `useInterval`. Clicking the verification link lands on `/dashboard?onboarding=true`.

Components: `HeroSection`, `SignupModal`, `VerifyEmailScreen`

Progress indicators: none at this stage — flow is too short.

---

#### Registered Developer Flow — First 10 Minutes

The onboarding wizard renders as an overlay on top of `/dashboard` when `?onboarding=true` is present in the URL. It uses a `StepWizard` component with a top progress bar (5 steps, filled as each completes).

**Step 1 — Create First Application**

URL: `/dashboard?onboarding=true&step=1`

Components: `OnboardingStep`, `CreateAppForm`

Form fields: `name` (required, max 60 chars), `description` (optional, max 200 chars), `tier` (`free` | `growth` | `pro` — rendered as radio cards with feature bullets).

Database writes:
- INSERT into `developer_applications` (id uuid, developer_id, name, description, tier, environment, created_at, updated_at)

Analytics: `onboarding_step_viewed { step: 'create_app', step_number: 1 }`, `first_app_created { tier }` on success.

Drop-off recovery: if the developer closes the wizard, a `developer_onboarding_progress` row is updated with `last_step = 1`, `abandoned_at = now()`. Next login shows a "Continue where you left off" banner with a "Resume" button.

Error states: duplicate app name → inline field error "You already have an app with this name." Server error → toast "Something went wrong. Please try again."

---

**Step 2 — Generate First API Key**

URL: `/dashboard?onboarding=true&step=2`

Components: `OnboardingStep`, `GenerateKeyCard`, `KeyRevealModal`

Behaviour: clicking "Generate API Key" calls `POST /api/keys/create` with `{ appId, name: 'Default Key' }`. The response includes the full key value — shown exactly once. The `KeyRevealModal` renders:
- Masked key display: `en_live_••••••••••••••••••••••••••••••••` with "Reveal" toggle
- Copy-to-clipboard button (copies the full value, shows "Copied!" for 2s)
- Download `.env` button — generates a text file containing `EDUNEXUS_API_KEY=<value>`
- Warning box: "This key will not be shown again. Store it securely."

Database writes:
- INSERT into `api_keys` (id, app_id, developer_id, name, key_hash, key_prefix, last_four, created_at)

Analytics: `first_key_generated { app_id }`

Drop-off recovery: key already exists → skip to step 3 automatically.

---

**Step 3 — SDK Selection**

URL: `/dashboard?onboarding=true&step=3`

Components: `OnboardingStep`, `LanguagePicker`, `InstallCommandBlock`

Language options rendered as icon cards: Node.js, Python, Go, PHP, Ruby, HTTP (bare). On selection, an `InstallCommandBlock` component renders the install command:

- Node.js: `npm install @edunexus/sdk`
- Python: `pip install edunexus`
- Go: `go get github.com/edunexus/go-sdk`
- PHP: `composer require edunexus/sdk`
- Ruby: `gem install edunexus`
- HTTP: shows base URL + curl example

Copy button on the command block. "I've already installed it — skip" text link.

Database writes: UPDATE `developer_onboarding_progress` SET `preferred_language = ?`

Analytics: `first_sdk_installed { language }` on step completion.

---

**Step 4 — Make First Request**

URL: `/dashboard?onboarding=true&step=4`

Components: `OnboardingStep`, `InteractiveRequestEditor`, `LiveResponsePanel`

The editor is a Monaco Editor instance (read/edit mode) pre-populated with a starter snippet in the developer's chosen language. The snippet calls `GET /v1/curriculum/outcomes?grade=7&subject=Mathematics&limit=3`. A "Run" button calls `POST /api/explorer/proxy` with the request definition and the developer's key. The response renders in a `LiveResponsePanel` with JSON syntax highlighting.

Analytics: `first_api_request_made { endpoint: '/v1/curriculum/outcomes', success: boolean }`

Drop-off recovery: "Skip — I'll try this later" link advances to step 5 without requiring a successful run.

---

**Step 5 — First Success**

URL: `/dashboard?onboarding=true&step=5`

Components: `OnboardingStep`, `ActivationSuccessScreen`, `WhatNextCards`

Triggers `confetti()` (canvas-confetti library) on mount if a real API request succeeded in step 4. Shows: large checkmark animation, "You're all set, {name}!" heading, share button (copies "I just built my first EduNexus API call! https://developers.edunexus.co.ke"), and a row of `WhatNextCard` components:
- Explore the full API (→ /explorer)
- Try the AI Studio (→ /studio)
- Browse the marketplace (→ /marketplace)
- Read the docs (→ /docs)

Analytics: `developer_activated { time_to_activation_minutes }` — computed as `now() - developer_profiles.created_at` in minutes.

Database writes: UPDATE `developer_onboarding_progress` SET `activated_at = now(), completed = true`

---

#### Organization Owner Flow

URL: `/org/new`

Steps: Create org (name, slug, logo upload) → Invite team (email inputs with role selector: admin / developer / viewer, max 5 in free tier) → Set billing (plan selection, payment method — Paystack or invoice for enterprise) → Configure SSO (optional, SAML/OIDC endpoint + certificate upload) → Assign roles (drag-and-drop role assignment grid).

Database writes: INSERT `developer_organizations`, INSERT `org_members` (bulk), UPDATE `developer_profiles SET org_id`.

---

#### Marketplace Publisher Flow

URL: `/marketplace/publish`

Steps: Install CLI (`npm install -g @edunexus/cli`) → Scaffold plugin (`edunexus dev init --template plugin`) → Upload manifest (`edunexus deploy plugin --env staging`) → Review queue notification → Publish.

---

#### Enterprise / Government Partner Flow

URL: `/enterprise/contact`

Custom form: org name, contact name, email, phone, use case description, expected API call volume, data residency requirements, SLA preference (99.9% / 99.99%), IP allowlist ranges. On submit: inserts into `enterprise_enquiries` and triggers Slack webhook to `#enterprise-sales`. A dedicated account manager is assigned within 24 hours. Auto-email confirms receipt.

---

#### Onboarding Database Schema

```sql
CREATE TABLE developer_onboarding_progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id     uuid NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  current_step     integer NOT NULL DEFAULT 1,       -- 1–5
  last_step        integer NOT NULL DEFAULT 1,
  preferred_lang   text,                             -- 'nodejs' | 'python' | 'go' | 'php' | 'ruby' | 'http'
  first_app_id     uuid REFERENCES developer_applications(id),
  first_key_id     uuid REFERENCES api_keys(id),
  first_request_at timestamptz,
  activated_at     timestamptz,
  abandoned_at     timestamptz,
  completed        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_developer_id ON developer_onboarding_progress(developer_id);
CREATE INDEX idx_onboarding_activated ON developer_onboarding_progress(activated_at) WHERE activated_at IS NOT NULL;
```

---

#### Friction Metrics

| Metric | Definition | Target |
|---|---|---|
| Time-to-first-key | signup_at → first key created | < 3 minutes |
| Time-to-first-request | first key → first API call via Explorer | < 7 minutes |
| Time-to-first-success | signup_at → activated_at | < 10 minutes |
| Activation rate (7-day) | activated / signed_up within 7 days | > 60% |

The **activation event** is the moment `developer_onboarding_progress.activated_at` is written — which requires either a successful live API request in step 4 OR a successful request made outside the wizard within 7 days of signup.

---

### Chapter 7 — API Explorer

The API Explorer at `/explorer` is the primary interface for discovering and testing EduNexus endpoints. It is a three-panel application backed by a live OpenAPI specification.

---

#### URL Structure

| URL | View |
|---|---|
| `/explorer` | All endpoints grouped by resource tag |
| `/explorer/[tag]` | Endpoints filtered to a specific tag (e.g., `/explorer/curriculum`) |
| `/explorer/[tag]/[operationId]` | Specific endpoint open in center panel (e.g., `/explorer/curriculum/getOutcomes`) |

URL state is the single source of truth — sharing the URL opens the same endpoint view for any authenticated developer.

---

#### Left Panel — Endpoint List

Component: `ExplorerEndpointList`

- `SearchBox` at top: debounced 200ms, filters endpoints by path + summary + tags client-side
- Method filter chips: GET (green), POST (blue), PUT (amber), DELETE (red), PATCH (purple) — multi-select
- `TagAccordion`: groups endpoints by OpenAPI tag, each group is a collapsible `<details>` element, open by default on first load
- Each endpoint item: `MethodBadge` + path text + summary text + optional `DeprecatedBadge` (red strikethrough) + optional `BetaBadge` (purple)
- Keyboard navigation: `ArrowUp` / `ArrowDown` moves focus between items, `Enter` opens the endpoint, `Space` toggles method chip
- Active item: highlighted background, URL updated to `/explorer/[tag]/[operationId]`

---

#### Center Panel — Endpoint Detail

Component: `ExplorerEndpointDetail`

**Endpoint header:** `MethodBadge` (large) + path in monospace + description paragraph + tag pills + deprecation alert (if applicable).

**Authentication section:** shows required auth type from OpenAPI securitySchemes. Link to `/apps/[active-app]/keys` for key management. If no key is set in the environment bar, a yellow warning banner shows "Add an API key to the environment bar to send live requests."

**Parameters section:** table with columns: Name | In | Type | Required | Description | Example. Path params auto-populated from URL. Query params editable via `ParamInputRow` — input type matches schema type (text, number, boolean checkbox, enum select). Array params rendered as tag-input.

**Request body section:** content-type selector (application/json). Schema tree renders on the left; a Monaco Editor JSON input on the right. Real-time JSON schema validation — red underline on invalid fields, inline error message. "Load example" button fills the editor with the example from the OpenAPI spec.

**Try It button:** disabled if no auth key set. On click: sends request via `POST /api/explorer/proxy` (server-side proxy to avoid CORS and to attach rate limit tracking). Shows spinner in button during flight. Response appears in right panel. Keyboard shortcut: `Cmd+Enter`.

**Code generation tabs:** cURL | JavaScript | Python | Go | PHP | Ruby. Auto-generated from current parameter values and auth key (key shown as `$EDUNEXUS_API_KEY` variable). Copy button per tab. Language icons. Tab preference stored in `localStorage`.

**Response schema section:** tabs for each documented response status (200, 400, 401, 403, 404, 422, 500). Each tab shows the JSON schema tree rendered as an interactive tree (expandable nodes, type badges, required badges, description tooltips).

---

#### Right Panel — Response Viewer

Component: `ExplorerResponsePanel`

- `StatusCodeBadge`: 2xx = green, 3xx = blue, 4xx = amber, 5xx = red
- `LatencyDisplay`: shows total round-trip latency in ms
- Response headers: `CollapsibleSection` component, shows as key-value table
- Response body: `JsonViewer` component (collapsible tree + raw toggle). "Copy response" button. "Save to collection" button opens `SaveToCollectionModal`
- "Diff with previous" toggle: splits view, left = previous response, right = current, differences highlighted with `react-diff-viewer`

---

#### Environment Bar (Top)

Component: `ExplorerEnvironmentBar`

- Environment selector: Production (`https://api.edunexus.co.ke`) | Staging (`https://staging.api.edunexus.co.ke`) | Sandbox (`https://sandbox.api.edunexus.co.ke`) | Custom URL (text input)
- Auth method: API Key | Bearer Token | OAuth (radio)
- Auth value input: masked (`type="password"`), "Show" toggle
- Base URL display: read-only text showing resolved base URL

---

#### Collections

Component: `CollectionsSidebar`

Saved requests organized in user-named folders. Each saved item stores: endpoint operation ID, parameter values, auth method. "Share collection" generates a signed URL valid for 30 days. Import from Postman (JSON) and Insomnia (YAML) via file upload — parsed and stored as `explorer_collections` rows.

---

#### Mock Mode

Toggle in environment bar. When enabled: requests are not sent to the real API; instead `POST /api/explorer/mock` returns a response generated from the response schema using `json-schema-faker`. A `MockBadge` (purple, "MOCK") replaces the status badge in the response panel. Useful for demos and development without consuming rate limits.

---

#### OpenAPI Sync

On page load: `GET /api/openapi.json`. Response is cached in React Query with 5-minute stale time. If the spec version has changed since last render, a "Schema updated" toast appears with a "Reload" button. The last-updated timestamp is shown in the bottom-left of the left panel.

---

#### Explorer State Shape

```typescript
type ExplorerState = {
  spec: OpenAPIObject | null
  specLastFetched: string | null
  activeTag: string | null
  activeOperationId: string | null
  searchQuery: string
  methodFilters: HttpMethod[]
  environment: 'production' | 'staging' | 'sandbox' | 'custom'
  customBaseUrl: string
  authMethod: 'api_key' | 'bearer' | 'oauth'
  authValue: string
  params: Record<string, unknown>          // keyed by param name
  requestBody: string                      // JSON string
  response: ExplorerResponse | null
  previousResponse: ExplorerResponse | null
  isLoading: boolean
  mockMode: boolean
  collections: Collection[]
  preferredCodeLanguage: CodeLanguage
}

type ExplorerResponse = {
  status: number
  headers: Record<string, string>
  body: unknown
  latencyMs: number
  timestamp: string
  isMock: boolean
}
```

---

### Chapter 8 — AI Studio

The AI Studio at `/studio` is the primary interface for prompt engineering against EduNexus AI APIs. It is a three-panel application with real-time streaming, prompt versioning, and curriculum-aware context building.

---

#### Layout

Three panels: left (configuration, 280px), center (editor + output, flex-grow), right (stats + history, 320px). On screens narrower than 1280px, the right panel collapses into a bottom drawer. On mobile, each panel is a full-screen step with navigation arrows.

---

#### Left Panel — Configuration

Component: `StudioConfigPanel`

**Curriculum selector:** cascading dropdowns: Curriculum (CBC Junior / CBC Senior / 8-4-4 / IGCSE) → Grade (auto-populated per curriculum) → Subject (auto-populated per grade). Selection stored in Zustand `studioStore`. Selection is injected as system prompt context.

**Prompt template library:** `TemplateLibrary` component. Lists saved templates (name + 60-char preview). Search box. "New template" button. Each item: click to load into editors, three-dot menu (rename, duplicate, delete, share). Templates are grouped: My Templates / Team Templates / EduNexus Built-ins.

**Context builder:** `ContextDocumentList`. Add button opens a modal: paste text / upload file (PDF, DOCX, TXT) / reference URL (fetched server-side). Each document shows a token count estimate. Total context token counter at bottom with warning at 70% of model context window.

**Model selector:** radio cards: `deepseek-chat` (latency: fast, cost: $0.14/1M input) | `deepseek-reasoner` (latency: slow, cost: $0.55/1M input). Latency and cost shown per card.

**Parameters:** temperature slider (0.0–2.0, step 0.1, default 0.7), `max_tokens` number input (default 2048, max 8192), top_p slider (0.0–1.0), stop sequences tag-input (up to 4), stream toggle (on by default).

---

#### Center Panel — Editor + Output

Component: `StudioEditorPanel`

**System prompt editor:** Monaco Editor instance, language `markdown`, theme `vs-dark`. Supports `{{variable}}` syntax — variables detected by regex and surfaced in the variable panel below. Line count and token estimate in the editor gutter.

**User prompt editor:** same configuration, smaller default height. Both editors are resizable (drag handle between them).

**Variable panel:** auto-detected from `{{...}}` patterns in either editor. Renders one `VariableInput` per unique variable name. Inputs are plain text. Values are substituted at runtime before sending.

**Run button:** `Cmd+Enter` shortcut. During streaming: shows spinner, button text changes to "Stop", clicking sends abort signal via `AbortController`. On completion: button returns to "Run".

**Output area:** `StreamingTextRenderer` component. Renders chunks as they arrive (SSE stream). Code blocks detected and syntax-highlighted. LaTeX detected (`$...$`, `$$...$$`) and rendered via KaTeX. After completion: copy button (copies full output text), word count badge, token count badge.

---

#### Right Panel — Stats + History

Component: `StudioStatsPanel`

**Token usage:** `prompt_tokens`, `completion_tokens`, `total_tokens`, cost estimate in KES and USD. Rendered as a small table.

**Latency:** time-to-first-token (TTFT), total time, tokens per second.

**Safety report:** if any content categories are flagged, a `SafetyReport` component renders: category name, severity (low/medium/high), recommended action. Green "All clear" state when no flags.

**Evaluation panel:** thumbs up / thumbs down. Rubric checkboxes: factually accurate, curriculum-aligned, age-appropriate, language appropriate. Score (0–4 based on checkboxes). On submit: writes to `studio_runs.score`.

**History:** `StudioRunHistory` — last 20 runs, each showing timestamp, first 80 chars of user prompt, score (star icon if rated), latency. Click to restore run context.

---

#### Version Management

Component: `PromptVersionManager`

"Save version" button: modal asks for version name + changelog text. Creates `studio_prompt_versions` row with full snapshot (both prompts, variables, config). Version list on left shows version number, name, date. "Diff" button opens a side-by-side Monaco diff viewer between any two versions. "Restore" button loads a version back into the editors (with confirmation dialog if current run is unsaved). "Fork" creates a new prompt with version 1 copied from the selected version.

---

#### Export

"Export" button in toolbar: modal with format selector (JSON / YAML / Markdown). JSON export shape:
```json
{ "name": "...", "system_prompt": "...", "user_prompt": "...", "variables": {}, "model": "...", "parameters": {} }
```

"Generate SDK code" button: opens `SdkCodeModal` with language selector. Generates a complete function in the selected language that calls the EduNexus AI API with the current prompt configuration.

---

#### Database Tables

```sql
CREATE TABLE studio_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  system_prompt   text NOT NULL DEFAULT '',
  user_prompt     text NOT NULL DEFAULT '',
  variables       jsonb NOT NULL DEFAULT '{}',
  model           text NOT NULL DEFAULT 'deepseek-chat',
  parameters      jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE studio_prompt_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id       uuid NOT NULL REFERENCES studio_prompts(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  snapshot        jsonb NOT NULL,   -- full prompt + config at save time
  changelog       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prompt_id, version_number)
);

CREATE TABLE studio_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id        uuid REFERENCES studio_prompts(id) ON DELETE SET NULL,
  version_id       uuid REFERENCES studio_prompt_versions(id) ON DELETE SET NULL,
  developer_id     uuid NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  input_variables  jsonb NOT NULL DEFAULT '{}',
  output           text,
  prompt_tokens    integer,
  completion_tokens integer,
  latency_ms       integer,
  ttft_ms          integer,
  safety_report    jsonb,
  score            smallint CHECK (score BETWEEN 0 AND 4),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_prompts_developer ON studio_prompts(developer_id);
CREATE INDEX idx_studio_runs_prompt ON studio_runs(prompt_id);
CREATE INDEX idx_studio_runs_developer ON studio_runs(developer_id, created_at DESC);
```

---

### Chapter 9 — Knowledge Graph Explorer

The Knowledge Graph Explorer at `/graph` renders the EduNexus Educational Knowledge Graph as an interactive, navigable canvas. It enables developers to visualise curriculum structure, discover node relationships, and understand the graph API through direct interaction.

---

#### Layout

Full-canvas layout: the graph occupies 100vw × 100vh. All controls are floating panels positioned over the canvas. No fixed sidebars — panels are draggable and collapsible.

---

#### Canvas

Component: `GraphCanvas` — wraps Cytoscape.js mounted on a `<div id="cy">` element.

**Node types and visual encoding:**

| Node Type | Shape | Color |
|---|---|---|
| Strand | Hexagon | #6366F1 (indigo) |
| SubStrand | Rectangle | #8B5CF6 (violet) |
| Indicator | Circle | #0EA5E9 (sky) |
| LearningOutcome | Ellipse | #10B981 (emerald) |
| Assessment | Diamond | #F59E0B (amber) |
| Skill | Roundrectangle | #EC4899 (pink) |
| Competency | Pentagon | #14B8A6 (teal) |

Node size scales with `Math.log(degree + 1) * 8 + 20` pixels. Label shown below node, font 11px, hidden below zoom threshold 0.4.

**Edge types and visual encoding:**

| Edge Type | Style | Color |
|---|---|---|
| hasSubStrand | Solid arrow | #6B7280 |
| hasIndicator | Solid arrow | #9CA3AF |
| assessedBy | Dashed arrow | #F59E0B |
| requiresSkill | Dotted arrow | #EC4899 |
| prerequisiteOf | Solid arrow, thick | #EF4444 |

Edge thickness from `weight` property: `1 + weight * 3`. Directed arrows (triangle arrowhead).

**Default view on mount:** Grade 7 CBC Junior Mathematics strand, force-directed layout, fit to viewport.

---

#### Controls Panel (floating top-left)

Component: `GraphControlsPanel`

- Curriculum selector: cascading CBC Junior/Senior/8-4-4/IGCSE → Grade → Subject
- Overlay selector: None | Learner Performance | Assessment Coverage | Teacher Activity (each overlay fetches additional data and adds visual properties to nodes)
- Layout selector: Force-Directed (`cose-bilkent`) | Hierarchical (`dagre`) | Circular (`circle`) | Grid
- Show/hide toggles: labels, edge labels, isolated nodes (degree=0), deprecated nodes
- "Reset view" button: re-runs layout and fits viewport
- "Fit screen" button: `cy.fit()` with 40px padding

---

#### Search Panel (floating top-right)

Component: `GraphSearchPanel`

Live search via `GET /api/graph/search?q=&type=&grade=&subject=` — debounced 300ms. Results dropdown shows: node type badge, label, parent strand name. Clicking a result: pans canvas to node, selects it, opens node inspector. Recent searches stored in `localStorage` (max 10). Filter chips by node type.

---

#### Node Inspector (floating right panel)

Component: `GraphNodeInspector`

Appears when a node is clicked. Shows: node label (heading), type badge, description text, properties table (key-value pairs from node data). Connected nodes grouped by relationship type — each as a clickable chip that navigates to that node. Overlay sections (learner/assessment) appear only when overlay is active.

"Expand neighbourhood" button: calls `GET /api/graph/neighbours?nodeId=&depth=1`, merges result into current graph data, re-runs layout.

"View API" button: navigates to `/explorer/graph` with the relevant endpoint highlighted.

"Copy node ID" button: copies UUID to clipboard.

---

#### Relationship Inspector

Component: `GraphEdgeInspector`

Appears when an edge is clicked. Shows: relationship type badge, source node label → target node label (clickable), weight value, evidence count (from edge data).

---

#### History and Bookmarks

Back/forward navigation buttons (floating bottom-left): navigate through graph state history (stored as a stack of `{ nodes, edges, viewport, filters }` snapshots). Breadcrumb trail shows expansion path. "Bookmark view" button: saves current state to `localStorage` with a user-provided name. Bookmark list accessible via bookmarks icon.

---

#### Developer Graph APIs Panel (floating bottom)

Component: `GraphApiPanel`

Shows the API call that produced the current view, e.g., `GET /v1/graph/subgraph?grade=7&subject=Mathematics&depth=2`. Parameters are editable inline. "Execute" button re-fetches and re-renders. "Copy as SDK code" generates ready-to-paste SDK code in the developer's preferred language.

---

#### Performance

- Max rendered nodes: 500. If query returns more, a warning banner shows "Showing 500 of {total} nodes — refine your filters."
- Level-of-detail: labels hidden below zoom 0.4, edge labels hidden below zoom 0.6.
- Progressive loading: visible viewport nodes loaded first (Cytoscape viewport culling enabled).
- Layout calculation runs in a Web Worker via `cytoscape-layout-utilities` worker mode — UI remains responsive during layout.

---

#### Graph Data Types

```typescript
type NodeType = 'Strand' | 'SubStrand' | 'Indicator' | 'LearningOutcome' | 'Assessment' | 'Skill' | 'Competency'
type EdgeType = 'hasSubStrand' | 'hasIndicator' | 'assessedBy' | 'requiresSkill' | 'prerequisiteOf'

type GraphNode = {
  id: string
  label: string
  type: NodeType
  properties: Record<string, unknown>
  x?: number
  y?: number
}

type GraphEdge = {
  id: string
  source: string
  target: string
  type: EdgeType
  weight: number
}

type Viewport = {
  x: number
  y: number
  zoom: number
}

type GraphFilters = {
  curriculum: string
  grade: number
  subject: string
  nodeTypes: NodeType[]
  overlay: 'none' | 'learner' | 'assessment' | 'teacher'
  showIsolated: boolean
  showDeprecated: boolean
}

type GraphState = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNode: string | null
  selectedEdge: string | null
  viewport: Viewport
  filters: GraphFilters
}
```

---

## PART IV — PLATFORM OPERATIONS

### Chapter 10 — Developer Dashboard

The dashboard at `/dashboard` is the operational home for every developer. It must load fast, show the most actionable information immediately, and never require navigation to answer the question "how is my integration doing?"

---

#### Header Section

Component: `DashboardHeader`

- Welcome message: "Good morning, {first_name}" (time-aware: morning/afternoon/evening)
- Quick stats row: four `MetricTile` components side by side

| Metric | Description |
|---|---|
| Total API calls (30d) | Sum of calls across all apps |
| Active applications | Count of apps with at least 1 call in last 7d |
| Error rate (%) | (5xx errors / total calls) * 100, last 30d |
| Tokens consumed | Sum of AI tokens across all studio runs, last 30d |

Each tile: current value (large), delta from previous period (green arrow up / red arrow down), sparkline (7 data points, 7 days). Rendered as `<button>` linking to the relevant drill-down page.

---

#### Applications Section

Component: `ApplicationsGrid`

Grid of `ApplicationCard` components, max 6 shown. Each card:
- App name (heading)
- Environment badge (Production = green, Staging = amber, Sandbox = gray)
- API call count (7d) — with sparkline
- Error rate — color-coded
- Last active (relative time: "2 hours ago")
- Quick actions: Keys icon (→ `/apps/[id]/keys`), Logs icon (→ `/apps/[id]/logs`), Settings icon (→ `/apps/[id]`)

The last card is always `CreateAppCard` — dashed border, plus icon, "New application" label. If developer has 0 apps and onboarding is complete, this card is shown prominently with a pulsing ring.

---

#### Usage Chart

Component: `UsageChartSection`

Line chart via Recharts: x-axis = date, y-axis = API call count. Default period 30d, period selector (7d / 30d / 90d) in top-right of section. "Breakdown by app" toggle adds one series per app (max 5, others aggregated as "Other"). Anomaly days (> 2 standard deviations above 30d mean) shown as red dots on the line.

---

#### Error Feed

Component: `ErrorFeedSection`

Last 10 errors across all apps. Each `ErrorFeedItem`: timestamp (absolute), app name badge, endpoint (truncated to 40 chars), status code badge, error message preview (first 80 chars). "View all logs" link → `/logs`. Polling: refetched every 30 seconds using TanStack Query `refetchInterval`.

---

#### Rate Limits Section

Component: `RateLimitSection`

Current tier badge. Three `RateLimitBar` components:
- Requests / minute: shows current window usage
- Requests / day: resets at midnight UTC
- Tokens / day: AI token budget

When any bar exceeds 80%: inline "Upgrade" CTA link → `/billing`. When at 100%: red section header, toast notification shown if developer is on the dashboard when limit is hit (via SSE).

---

#### Webhooks Section

Component: `WebhookSummarySection`

Last 5 webhook deliveries across all apps. Each item: timestamp, event type badge, endpoint URL (truncated), status (success = green check / failed = red x / pending = spinner). "Retry" button on failed items calls `POST /api/webhooks/[deliveryId]/retry`. "View all webhooks" link → `/apps/[id]/webhooks`.

---

#### Marketplace Section

Component: `MarketplaceSummarySection`

Installed plugins count. `UpdateAvailableBadge` on each plugin with a pending update. "Browse marketplace" CTA → `/marketplace`.

---

#### Certifications Section

Component: `CertificationsSummarySection`

Earned badges rendered as `CertificationBadge` components (icon + name). If 0 certifications: "Earn your first certification" CTA → `/certifications`. Next certification progress bar: "Level 1 — 3 of 5 requirements complete."

---

#### Audit Log Section

Component: `AuditLogSummarySection`

Last 5 security events. Event types: `key_created`, `key_revoked`, `login_new_ip`, `org_member_added`, `permission_changed`. Each item: timestamp, event type, actor (email), IP (truncated). "View full audit log" link.

---

#### Data Fetch Strategy

Single endpoint: `GET /api/developer/dashboard` returns `DashboardSummary`. TanStack Query: stale time 60 seconds, background refetch every 5 minutes on tab focus. Each dashboard section renders a `Skeleton` loading state that matches the shape of the final content. The endpoint is a single Supabase `Promise.all` of parallel queries — no sequential waterfall.

```typescript
type DashboardSummary = {
  stats: {
    apiCalls30d: number
    activeApps: number
    errorRate: number
    tokensConsumed: number
    apiCallsDelta: number        // % change vs previous 30d
    errorRateDelta: number
    tokensConsumedDelta: number
  }
  applications: ApplicationSummary[]
  usageChart: UsageDataPoint[]
  recentErrors: ErrorEvent[]
  rateLimits: RateLimitStatus
  webhooks: WebhookDelivery[]
  marketplace: { installed: number; updatesAvailable: number }
  certifications: CertificationBadge[]
  auditEvents: AuditEvent[]
}

type UsageDataPoint = { date: string; calls: number; byApp?: Record<string, number> }
type RateLimitStatus = { requestsPerMinute: { used: number; limit: number }; requestsPerDay: { used: number; limit: number }; tokensPerDay: { used: number; limit: number }; tier: string }
```

---

### Chapter 11 — Marketplace Experience

The marketplace at `/marketplace` is the distribution layer for EduNexus plugins. It serves three audiences simultaneously: developers browsing for tools, publishers selling plugins, and platform admins reviewing submissions.

---

#### Listing Page

Component: `MarketplaceListingPage`

**Hero banner:** `FeaturedPluginBanner` — editor's choice plugin of the week, full-width, gradient background, install count, publisher badge, tagline, "Install" CTA.

**Category filter bar:** `CategoryFilterBar` — horizontal scroll on mobile. Categories: All | AI & Generation | Analytics | Integrations | Curriculum | Assessment | Communication | Developer Tools. Active category stored in URL search param `?category=`.

**Sort options:** dropdown — Popular (install count desc) | Newest (created_at desc) | Recently Updated | Top Rated (rating_avg desc) | Revenue (publisher view only, hidden for others).

**Search:** `MarketplaceSearchInput` — debounced 300ms, updates URL `?q=` param. Server-side full-text search via `GET /api/marketplace/search`.

**Plugin grid:** `MarketplaceGrid` of `MarketplaceCard` components. Infinite scroll with `IntersectionObserver` — loads 24 items per page.

Each `MarketplaceCard`: 64px icon, name (bold), publisher name + verified tick, tagline (2 lines max, ellipsis), install count (formatted: "1.2k"), star rating (5-star display, 1 decimal), price badge (Free / Paid / Freemium), category badge, "Install" / "Installed" button.

---

#### Plugin Detail Page

URL: `/marketplace/[slug]`

Component: `MarketplacePluginDetail`

**Header:** 80px icon, name (h1), publisher `VerifiedBadge`, version badge, last updated date, install count, star rating distribution (bar chart).

**Tab navigation:** `TabNav` — Overview | Documentation | Changelog | Reviews | API Reference.

- **Overview:** long description (react-markdown), screenshots carousel (lightbox on click), key features list, tech requirements (Node.js version, EduNexus version range).
- **Documentation:** full markdown docs rendered with syntax-highlighted code blocks and anchor links.
- **Changelog:** version history in reverse chronological order. Each entry: version number, date, breaking change indicator (red), bullet list of changes.
- **Reviews:** star distribution bar chart (5 → 1 star, count per level). `ReviewCard` list: avatar, developer name, date, star rating, comment, "Helpful ({count})" upvote button. Pagination (10 per page). "Write a review" button (requires install).
- **API Reference:** embedded `ExplorerEndpointList` and `ExplorerEndpointDetail` components filtered to the plugin's tag.

**Right sidebar:** "Install" button (large, primary), pricing details (free / $X per month / custom), `PublisherProfileCard` (avatar, name, verified, joined date, total install count), category tags, compatible EduNexus version range, "Support" link, "Report plugin" link (opens `ReportPluginModal`).

---

#### Submission Flow (Publisher)

URL: `/marketplace/publish` (5-step wizard)

**Step 1 — Plugin info:** name, tagline (max 80 chars), description (markdown editor), category selector, tags (tag input, max 10), icon upload (PNG/SVG, 256×256 min), screenshots upload (max 5, 1280×800 min).

**Step 2 — Technical requirements:** `manifest.json` upload or paste. Live validation via `POST /api/marketplace/validate-manifest` — shows a `ValidationResultList` with pass/fail per field. Required fields: `name`, `version`, `entrypoint`, `permissions[]`, `edunexusVersion`.

**Step 3 — Pricing:** radio cards — Free | Paid one-time ($X) | Subscription (monthly tiers — up to 3, each with name, price, feature list).

**Step 4 — Review:** summary card, estimated review timeline ("3–5 business days"), checkbox "I confirm this plugin complies with the EduNexus Developer Policy."

**Step 5 — Confirmation:** plugin ID displayed, link to publisher dashboard, "Track review status" link.

---

#### Review Pipeline (Admin)

URL: `/admin/plugins`

Queue view with SLA timers (color: green >3d, amber 1–3d, red <1d to SLA breach). `PluginReviewCard` per submission. Review checklist: manifest valid ✓, no malicious code flags (automated scan result) ✓, documentation complete ✓, screenshots present ✓, privacy policy linked ✓. Action buttons: "Approve" | "Request changes" (required comment, sent as email) | "Reject" (required reason, sent as email). Status tracked in `marketplace_plugins.status` enum: `draft` | `under_review` | `changes_requested` | `approved` | `rejected` | `deprecated`.

---

#### Publisher Revenue Dashboard

URL: `/marketplace/publisher`

MRR chart (line), total revenue (all time), payout history table (amount, date, status, M-Pesa/bank). Per-plugin table: name, installs (total), active (last 30d), churn (uninstalls last 30d), MRR, total revenue. Payout settings: M-Pesa number or bank account details (encrypted at rest).

---

#### Version Management

"Publish new version" button on publisher dashboard opens `PublishVersionModal`: version number input (semver validated), changelog textarea, breaking change checkbox. Submit calls `POST /api/marketplace/[slug]/versions`. Force-update toggle: if enabled, all installed instances receive a `plugin.update_available` webhook event. Deprecation workflow: set `deprecated_at` date, enter migration guide URL, confirm — EduNexus sends an email to all developers with the plugin installed.

---

#### Database Tables

```sql
CREATE TABLE marketplace_plugins (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  name             text NOT NULL,
  publisher_id     uuid NOT NULL REFERENCES developer_profiles(id),
  description      text NOT NULL,
  category         text NOT NULL,
  tags             text[] NOT NULL DEFAULT '{}',
  icon_url         text,
  screenshots      text[] NOT NULL DEFAULT '{}',
  manifest         jsonb NOT NULL DEFAULT '{}',
  version          text NOT NULL DEFAULT '1.0.0',
  status           text NOT NULL DEFAULT 'draft',
  install_count    integer NOT NULL DEFAULT 0,
  rating_avg       numeric(3,2) NOT NULL DEFAULT 0,
  pricing_type     text NOT NULL DEFAULT 'free',
  price_amount     numeric(10,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_installs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id         uuid NOT NULL REFERENCES marketplace_plugins(id),
  developer_id      uuid NOT NULL REFERENCES developer_profiles(id),
  app_id            uuid REFERENCES developer_applications(id),
  installed_version text NOT NULL,
  status            text NOT NULL DEFAULT 'active',
  installed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plugin_id, developer_id, app_id)
);

CREATE TABLE marketplace_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id    uuid NOT NULL REFERENCES marketplace_plugins(id),
  developer_id uuid NOT NULL REFERENCES developer_profiles(id),
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plugin_id, developer_id)
);

CREATE TABLE marketplace_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id        uuid NOT NULL REFERENCES marketplace_plugins(id),
  version          text NOT NULL,
  changelog        text,
  breaking_changes boolean NOT NULL DEFAULT false,
  published_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plugin_id, version)
);
```

---

### Chapter 12 — CLI Experience

The `edunexus` CLI is the power tool for developers who live in the terminal. It must be fast, scriptable, and delightful.

---

#### Command Hierarchy

```
edunexus
├── auth
│   ├── login              # OAuth device flow, opens browser
│   ├── logout             # Clears ~/.edunexus/credentials.json
│   └── whoami             # Prints current identity
├── apps
│   ├── list               # Table of apps with ID, name, tier, last active
│   ├── create [name]      # Interactive prompts if name omitted
│   └── delete [id]        # Requires --confirm flag
├── keys
│   ├── list [--app <id>]
│   ├── create [--app <id>] [--name <name>]
│   └── revoke [key-id]    # Requires --confirm flag
├── deploy
│   ├── plugin [--app <id>] [--env <env>]
│   └── status [deployment-id]
├── dev
│   ├── init [template]    # Scaffold new project
│   ├── serve [--port 3001] # Local dev server with hot reload
│   └── tunnel             # Expose local server via ngrok-style tunnel
├── webhook
│   ├── listen [--app <id>] [--event <event>]
│   └── test [--event <event>] [--payload <json>]
├── logs
│   ├── tail [--app <id>] [--level <level>]
│   └── export [--from <date>] [--to <date>] [--format json|csv]
├── test
│   ├── run [test-file]
│   └── mock [--endpoint <path>] [--response <json>]
└── config
    ├── get [key]
    ├── set [key] [value]
    └── list
```

**Interactive mode:** `edunexus` with no args enters a REPL powered by `inquirer` with full command autocomplete (tab completion) and command history (stored in `~/.edunexus/history`).

---

#### Authentication — OAuth Device Flow

`edunexus auth login`:
1. Calls `POST /api/cli/device/code` → receives `device_code`, `user_code`, `verification_uri`
2. Prints: "Open this URL in your browser: {verification_uri}" and "Enter code: {user_code}"
3. Opens browser automatically via `open` package
4. Polls `POST /api/cli/device/token?device_code={code}` every 5 seconds
5. On success: writes `{ access_token, refresh_token, expires_at, developer_id }` to `~/.edunexus/credentials.json` (file permissions 0600)
6. Prints: "Logged in as {email}"

---

#### Project Generation — `edunexus dev init`

Interactive prompts (if args not provided):
- Project name (validates: no spaces, no special chars)
- Template: Node.js starter | Python starter | Next.js integration | Bare HTTP
- Language: TypeScript | JavaScript (only for Node template)

Scaffolds:
- `package.json` / `requirements.txt` with `@edunexus/sdk` / `edunexus` dep
- `.env.example` with all required env vars
- `src/index.ts` (or `main.py`) with a working starter that calls `/v1/curriculum/outcomes`
- `edunexus.config.ts` with default config
- `README.md` with quick-start steps

Runs `npm install` / `pip install` automatically after scaffold. Total time target: < 30 seconds.

---

#### Deploy Flow — `edunexus deploy plugin`

1. Reads `edunexus.config.ts` for `appId` and `environment`
2. Validates `manifest.json` against JSON schema (local validation, no network)
3. Bundles plugin using esbuild: `esbuild src/index.ts --bundle --platform=node --outfile=dist/bundle.js`
4. Computes SHA-256 of bundle
5. Calls `POST /api/deploy/upload` (multipart/form-data, streams bundle with progress bar via `cli-progress`)
6. Polls `GET /api/deploy/status/[deploymentId]` every 3 seconds (max 120s timeout)
7. On success: prints deployment URL and "Plugin live at: {url}"
8. On failure: prints error details and exit code 1

---

#### Webhook Listener — `edunexus webhook listen`

1. Starts local HTTP server on `--port` (default: random available port)
2. Calls `POST /api/webhooks/tunnel/register` → receives a relay URL like `https://relay.edunexus.co.ke/dev/{token}`
3. Establishes SSE connection to the relay URL
4. Forwards incoming webhook payloads to the local server
5. Renders each event in the terminal: timestamp, event type (bold), JSON body (formatted, colored)
6. `--replay` flag: fetches last 20 webhook deliveries and replays them
7. Auto-reconnects on SSE disconnect (exponential backoff: 1s, 2s, 4s, max 30s)

---

#### Logs Tail — `edunexus logs tail`

SSE stream from `GET /api/logs/stream?appId={id}&level={level}`. Each log line rendered with ANSI color:
- DEBUG: dim gray
- INFO: white
- WARN: yellow
- ERROR: red bold

`--grep "pattern"`: client-side regex filter. `--since 10m`: filter logs from the last N minutes. `--format json`: disables ANSI, outputs one JSON object per line (for piping to `jq`).

---

#### CI Integration

`--ci` flag on any command: enables non-interactive mode (no spinners, no prompts, JSON output to stdout, errors to stderr). Exit codes: 0 = success, 1 = API/runtime error, 2 = authentication required, 3 = validation error.

GitHub Actions example workflow:
```yaml
- uses: edunexus/setup-cli@v1
  with:
    version: latest
- run: edunexus deploy plugin --ci --app ${{ vars.APP_ID }} --env production
  env:
    EDUNEXUS_API_KEY: ${{ secrets.EDUNEXUS_API_KEY }}
```

---

#### Config File — `edunexus.config.ts`

```typescript
export default {
  appId: string,
  environment: 'production' | 'staging' | 'sandbox',
  plugins: string[],
  webhooks: { event: string; handler: string }[],
  rateLimit: { tier: string }
}
```

The CLI reads this file on every command (except `auth` and `config`). If absent, CLI falls back to environment variables (`EDUNEXUS_APP_ID`, `EDUNEXUS_ENV`).

---

## PART V — IMPLEMENTATION

### Chapter 13 — Frontend Folder Structure

Exact folder structure for the Next.js 16 App Router project, with naming rules, import conventions, and feature boundary rules.

---

#### Directory Tree

```
apps/developer-portal/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx             # Marketing layout (no sidebar)
│   │   └── pricing/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify/page.tsx
│   ├── (portal)/
│   │   ├── layout.tsx             # Portal shell (sidebar + topnav)
│   │   ├── dashboard/page.tsx
│   │   ├── apps/
│   │   │   ├── page.tsx           # Apps list
│   │   │   ├── new/page.tsx       # Create app form
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # App overview
│   │   │       ├── keys/page.tsx
│   │   │       ├── webhooks/page.tsx
│   │   │       └── logs/page.tsx
│   │   ├── explorer/
│   │   │   ├── page.tsx
│   │   │   └── [tag]/
│   │   │       ├── page.tsx
│   │   │       └── [operationId]/page.tsx
│   │   ├── studio/page.tsx
│   │   ├── graph/page.tsx
│   │   ├── marketplace/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── cli/page.tsx
│   │   ├── usage/page.tsx
│   │   ├── billing/page.tsx
│   │   ├── logs/page.tsx
│   │   ├── certifications/page.tsx
│   │   ├── community/page.tsx
│   │   ├── support/page.tsx
│   │   ├── org/
│   │   │   ├── settings/page.tsx
│   │   │   └── members/page.tsx
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx
│   ├── admin/
│   │   ├── layout.tsx             # Admin shell (requires admin role)
│   │   ├── page.tsx
│   │   ├── plugins/page.tsx
│   │   ├── developers/page.tsx
│   │   └── system/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── apps/
│       │   ├── route.ts           # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts       # GET, PATCH, DELETE
│       │       ├── keys/route.ts
│       │       ├── webhooks/route.ts
│       │       └── logs/route.ts
│       ├── explorer/
│       │   ├── proxy/route.ts     # Forward live requests
│       │   └── mock/route.ts
│       ├── studio/
│       │   ├── prompts/route.ts
│       │   └── runs/route.ts
│       ├── graph/
│       │   ├── subgraph/route.ts
│       │   ├── neighbours/route.ts
│       │   └── search/route.ts
│       ├── marketplace/
│       │   ├── route.ts
│       │   ├── search/route.ts
│       │   ├── [slug]/route.ts
│       │   └── validate-manifest/route.ts
│       ├── logs/
│       │   └── stream/route.ts    # SSE endpoint
│       ├── usage/route.ts
│       ├── webhooks/
│       │   └── [deliveryId]/retry/route.ts
│       ├── developer/
│       │   └── dashboard/route.ts
│       └── openapi.json/route.ts
├── components/
│   ├── ui/                        # Design system primitives (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   ├── portal/                    # Portal layout components
│   │   ├── sidebar.tsx
│   │   ├── top-nav.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── command-palette.tsx
│   ├── explorer/
│   │   ├── endpoint-list.tsx
│   │   ├── endpoint-detail.tsx
│   │   ├── response-panel.tsx
│   │   ├── environment-bar.tsx
│   │   ├── code-generator.tsx
│   │   └── collections-sidebar.tsx
│   ├── studio/
│   │   ├── config-panel.tsx
│   │   ├── editor-panel.tsx
│   │   ├── stats-panel.tsx
│   │   ├── streaming-text-renderer.tsx
│   │   ├── version-manager.tsx
│   │   └── template-library.tsx
│   ├── graph/
│   │   ├── graph-canvas.tsx
│   │   ├── controls-panel.tsx
│   │   ├── node-inspector.tsx
│   │   ├── edge-inspector.tsx
│   │   ├── search-panel.tsx
│   │   └── api-panel.tsx
│   ├── marketplace/
│   │   ├── marketplace-card.tsx
│   │   ├── plugin-detail.tsx
│   │   ├── submission-wizard.tsx
│   │   └── review-card.tsx
│   └── shared/
│       ├── code-block.tsx
│       ├── endpoint-card.tsx
│       ├── metric-tile.tsx
│       ├── rate-limit-bar.tsx
│       ├── method-badge.tsx
│       ├── json-viewer.tsx
│       └── skeleton-grid.tsx
├── lib/
│   ├── api/
│   │   ├── apps.ts
│   │   ├── keys.ts
│   │   ├── explorer.ts
│   │   ├── studio.ts
│   │   ├── graph.ts
│   │   ├── marketplace.ts
│   │   └── usage.ts
│   ├── auth/
│   │   └── session.ts
│   ├── openapi/
│   │   ├── parser.ts
│   │   └── code-generator.ts
│   ├── graph/
│   │   ├── cytoscape-config.ts
│   │   └── layout.worker.ts
│   └── utils/
│       ├── format.ts
│       └── token-counter.ts
├── hooks/
│   ├── use-apps.ts
│   ├── use-explorer.ts
│   ├── use-studio.ts
│   ├── use-graph.ts
│   ├── use-marketplace.ts
│   ├── use-usage.ts
│   └── use-command-palette.ts
├── stores/
│   ├── explorer-store.ts          # Zustand
│   ├── studio-store.ts
│   ├── graph-store.ts
│   └── ui-store.ts
├── types/
│   ├── api.ts
│   ├── explorer.ts
│   ├── studio.ts
│   ├── graph.ts
│   └── marketplace.ts
├── styles/
│   ├── globals.css
│   ├── tokens.css
│   └── components/
└── public/
    ├── icons/
    └── images/
```

---

#### Naming Rules

- All filenames: `kebab-case.tsx`
- React components: `PascalCase` export default, filename matches
- Hooks: `use-` prefix, camelCase, e.g., `useApps`
- Stores: `<feature>-store.ts`, export as `use<Feature>Store`
- Types: `PascalCase`, defined in `types/` and re-exported from feature index

---

#### Import Conventions

- Path alias `@/` resolves to `apps/developer-portal/`
- Component imports: `import { MetricTile } from '@/components/shared/metric-tile'`
- Type imports: always use `import type { ... }` for type-only imports
- Third-party UI: always re-export from `components/ui/` — never import shadcn directly from `@/components/ui` in feature components (import from the file in `ui/`)

---

#### Feature Boundary Rules

1. Components in `components/explorer/` must never import from `components/studio/`
2. `lib/api/` functions are the only place that may call `fetch` against EduNexus API routes
3. `stores/` may only be imported by React components and hooks — never by `lib/` functions
4. `app/api/` route files must have zero business logic — they call `lib/` functions only
5. Zustand stores must not contain async logic — async operations live in hooks, which call `lib/api/` and then update the store

---

### Chapter 14 — Backend Integration

This chapter maps every major frontend screen to its complete backend specification.

---

#### Dashboard

**Endpoint:** `GET /api/developer/dashboard`

**Response type:**
```typescript
type DashboardResponse = { data: DashboardSummary; error: null } | { data: null; error: string }
```

**Supabase service function:** `lib/api/dashboard.ts → getDashboardSummary(developerId: string): Promise<DashboardSummary>`

**Database query:** parallel `Promise.all` of:
1. `SELECT COUNT(*), SUM(calls), AVG(error_rate) FROM app_usage_daily WHERE developer_id = $1 AND date >= now() - interval '30 days'`
2. `SELECT id, name, tier, environment, last_active_at FROM developer_applications WHERE developer_id = $1 AND last_active_at >= now() - interval '7 days' ORDER BY last_active_at DESC LIMIT 6`
3. `SELECT date, SUM(calls) FROM app_usage_daily WHERE developer_id = $1 AND date >= now() - interval '30 days' GROUP BY date ORDER BY date`
4. `SELECT * FROM api_request_logs WHERE developer_id = $1 AND status_code >= 500 ORDER BY created_at DESC LIMIT 10`

**RLS policy:** `developer_id = auth.uid()`

**Cache:** TanStack Query staleTime 60 000ms, refetchInterval 300 000ms (5 min) on tab focus.

**Retry:** 3 attempts, exponential backoff 500ms → 1000ms → 2000ms. On final failure: show stale data with "Last updated {time}" banner.

**Offline:** renders cached data from TanStack Query cache. Offline banner shown.

---

#### Application CRUD

**Create:** `POST /api/apps` — body `{ name: string; description: string; tier: string }`. Validates with Zod. Calls `createApplication(developerId, input)`. Optimistic update in TanStack Query (adds temp app with `id: 'temp'` to cache, replaced on success).

**Read (list):** `GET /api/apps` — calls `getApplications(developerId)`. Query: `SELECT id, name, description, tier, environment, created_at, updated_at, last_active_at FROM developer_applications WHERE developer_id = $1 ORDER BY created_at DESC`.

**Read (single):** `GET /api/apps/[id]` — calls `getApplication(developerId, appId)`. Returns 404 if not found, 403 if `developer_id` does not match `auth.uid()`.

**Update:** `PATCH /api/apps/[id]` — body `Partial<{ name, description, environment }>`. Calls `updateApplication(developerId, appId, patch)`.

**Delete:** `DELETE /api/apps/[id]` — calls `deleteApplication(developerId, appId)`. Soft delete: sets `deleted_at = now()`, does not destroy keys (keys are separately revoked).

**RLS:** all policies check `developer_id = auth.uid()`.

**Cache invalidation:** on any mutation, invalidate `['apps']` and `['apps', appId]` query keys.

---

#### API Key CRUD

**Create:** `POST /api/apps/[id]/keys` — body `{ name: string }`. Generates key: `en_live_` + 48 random base62 chars via `crypto.randomBytes`. Stores SHA-256 hash in `api_keys.key_hash`, stores prefix + last 4 chars. Returns **full key value once** — never stored in plaintext after this response.

**List:** `GET /api/apps/[id]/keys` — returns `id, name, key_prefix, last_four, created_at, last_used_at, expires_at`. Never returns hash.

**Revoke:** `DELETE /api/apps/[id]/keys/[keyId]` — sets `revoked_at = now()`. Key becomes invalid immediately (middleware checks `revoked_at IS NULL` on every request).

**Cache:** staleTime 5 000ms (keys are security-sensitive, keep fresh). No background refetch.

---

#### API Explorer — Live Request Proxy

**Endpoint:** `POST /api/explorer/proxy`

**Request type:**
```typescript
type ProxyRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  params: Record<string, string>
  headers: Record<string, string>
  body: unknown
  environment: 'production' | 'staging' | 'sandbox' | 'custom'
  baseUrl?: string
  authValue: string
}
```

**Behaviour:** The route constructs the target URL from `environment` + `path` + `params`. It forwards the request server-side (avoiding CORS). It injects a `X-Explorer-Request: true` header so EduNexus API logs can identify explorer traffic. It returns the full response (status, headers, body, latency).

**Security:** validates `authValue` is not empty and matches a valid key for the developer. Does not allow proxy to internal/private IP ranges (SSRF protection: validates target URL is in the allowed base URL list).

---

#### AI Studio Runs

**Endpoint:** `POST /api/studio/runs` — streams `text/event-stream`.

**Request:** `{ promptId?: string; systemPrompt: string; userPrompt: string; variables: Record<string, string>; model: string; parameters: StudioParameters; curriculumContext: CurriculumContext }`

**Behaviour:**
1. Auth check: 401 if no user
2. Token balance check: if developer has exceeded monthly AI token budget for their tier → 429
3. Variable substitution: replace `{{var}}` in prompts with values
4. Safety pre-check: `lib/ai/safety.ts → checkPromptSafety(systemPrompt + userPrompt)`
5. Stream DeepSeek response, forwarding SSE chunks to client
6. On stream end: compute token counts, latency, cost; INSERT `studio_runs`; UPDATE token usage counter

**Cache:** no caching for runs (always live). TanStack Query `enabled: false` (manual trigger).

---

#### Graph Queries

**Endpoint:** `GET /api/graph/subgraph?grade=7&subject=Mathematics&depth=2`

**Response:**
```typescript
type SubgraphResponse = { nodes: GraphNode[]; edges: GraphEdge[]; totalNodes: number; truncated: boolean }
```

**Database query:** recursive CTE:
```sql
WITH RECURSIVE graph AS (
  SELECT id, label, type, properties, 0 AS depth
  FROM curriculum_nodes
  WHERE grade = $1 AND subject = $2 AND type = 'Strand'
  UNION ALL
  SELECT n.id, n.label, n.type, n.properties, g.depth + 1
  FROM curriculum_nodes n
  JOIN curriculum_edges e ON e.target_id = n.id
  JOIN graph g ON g.id = e.source_id
  WHERE g.depth < $3
)
SELECT * FROM graph LIMIT 500
```

**Cache:** TanStack Query staleTime 300 000ms (5 min) — curriculum graph is static, changes only on curriculum updates. Cache key: `['graph', grade, subject, depth]`.

---

#### Marketplace Install

**Endpoint:** `POST /api/marketplace/[slug]/install` — body `{ appId: string }`

**Service function:** `installPlugin(developerId, slug, appId): Promise<MarketplaceInstall>`

**Steps:**
1. Fetch plugin record, check `status = 'approved'`
2. Check for existing install (UNIQUE constraint) — if exists, return 409 "Already installed"
3. INSERT `marketplace_installs`
4. Increment `marketplace_plugins.install_count` (UPDATE with `install_count = install_count + 1`)
5. If paid plugin: verify payment/subscription via Paystack before insert
6. Trigger `plugin.installed` webhook to developer's registered webhooks

**Offline:** install action disabled when offline — shows tooltip "Requires internet connection."

---

#### Logs Streaming

**Endpoint:** `GET /api/logs/stream?appId={id}&level={level}`

SSE endpoint. Returns `Content-Type: text/event-stream`. Established via `new EventSource('/api/logs/stream?...')` on the client (custom hook `useLogStream`). Each event: `data: { timestamp, level, message, meta }` as JSON. Server: pulls from `api_request_logs` via Supabase Realtime channel subscribed to `INSERT` on `api_request_logs WHERE app_id = $1`. Filters by level client-side.

---

#### Usage Aggregation

**Endpoint:** `GET /api/usage?appId={id}&period=30d`

```sql
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE status_code >= 500) AS errors,
  SUM(response_time_ms) / COUNT(*) AS avg_latency_ms,
  SUM(tokens_used) AS tokens
FROM api_request_logs
WHERE app_id = $1
  AND created_at >= now() - $2::interval
GROUP BY 1
ORDER BY 1
```

**Cache:** staleTime 120 000ms (2 min). Background refetch every 2 min.

---

### Chapter 15 — State Management

This chapter defines the complete state management architecture — what lives where, why, and exactly how each piece behaves.

---

#### Server State — TanStack Query

All server state (data that lives in the database and is fetched over the network) is managed by TanStack Query v5.

**Query key conventions:**

```typescript
['apps']                          // all apps for current developer
['apps', appId]                   // single app
['apps', appId, 'keys']           // keys for an app
['apps', appId, 'logs']           // logs for an app
['apps', appId, 'webhooks']       // webhooks for an app
['marketplace']                   // marketplace listing
['marketplace', slug]             // plugin detail
['graph', grade, subject, depth]  // graph subgraph
['studio', 'prompts']             // prompt list
['studio', 'prompts', promptId]   // single prompt
['usage', appId, period]          // usage aggregation
['dashboard']                     // dashboard summary
```

**Stale times:**

| Query | staleTime |
|---|---|
| `['dashboard']` | 60 000 ms |
| `['apps']` | 30 000 ms |
| `['apps', id, 'keys']` | 5 000 ms |
| `['usage']` | 120 000 ms |
| `['marketplace']` | 300 000 ms |
| `['graph']` | 300 000 ms |
| `['apps', id, 'logs']` | 0 ms (always fresh) |

**Background refetch intervals:**

| Query | refetchInterval |
|---|---|
| `['dashboard']` | 300 000 ms |
| `['usage']` | 120 000 ms |

All queries: `refetchOnWindowFocus: true`.

---

#### Optimistic Update Pattern — App Creation

```typescript
// hooks/use-apps.ts
const createApp = useMutation({
  mutationFn: (input: CreateAppInput) => api.apps.create(input),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ['apps'] })
    const previous = queryClient.getQueryData<App[]>(['apps'])
    queryClient.setQueryData<App[]>(['apps'], (old = []) => [
      { id: 'temp-' + Date.now(), ...input, created_at: new Date().toISOString() },
      ...old,
    ])
    return { previous }
  },
  onError: (_err, _input, context) => {
    if (context?.previous) queryClient.setQueryData(['apps'], context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['apps'] })
  },
})
```

The same pattern applies to key creation, marketplace installs, and review submissions.

---

#### Client State — Zustand Stores

**`explorerStore`** — manages the API Explorer UI state:
```typescript
type ExplorerStore = ExplorerState & {
  setActiveOperation: (tag: string, operationId: string) => void
  setParam: (name: string, value: unknown) => void
  setRequestBody: (body: string) => void
  setAuthValue: (value: string) => void
  setEnvironment: (env: ExplorerState['environment']) => void
  setResponse: (response: ExplorerResponse) => void
  toggleMockMode: () => void
  saveToCollection: (name: string) => void
  reset: () => void
}
```

**`studioStore`** — manages AI Studio:
```typescript
type StudioStore = {
  systemPrompt: string
  userPrompt: string
  variables: Record<string, string>
  config: StudioConfig
  currentRun: StudioRun | null
  streamingState: StreamingState
  versions: PromptVersion[]
  setSystemPrompt: (v: string) => void
  setUserPrompt: (v: string) => void
  setVariable: (name: string, value: string) => void
  setConfig: (patch: Partial<StudioConfig>) => void
  startStream: () => void
  appendChunk: (chunk: string) => void
  finalizeStream: (run: StudioRun) => void
  errorStream: (error: string) => void
  resetStream: () => void
}
```

**`graphStore`** — manages graph canvas state (see `GraphState` type in Chapter 9).

**`uiStore`** — cross-cutting UI state:
```typescript
type UIStore = {
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  theme: 'light' | 'dark' | 'system'
  notifications: Notification[]
  toggleSidebar: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  pushNotification: (n: Notification) => void
  dismissNotification: (id: string) => void
}
```

---

#### Streaming State Machine — AI Studio

The streaming lifecycle is modeled as an explicit finite state machine:

```typescript
type StreamingState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'streaming'; chunks: string[]; abortController: AbortController }
  | { status: 'complete'; output: string; run: StudioRun }
  | { status: 'error'; message: string }
  | { status: 'timeout' }

type StreamingEvent =
  | { type: 'START' }
  | { type: 'CHUNK'; data: string }
  | { type: 'DONE'; run: StudioRun }
  | { type: 'ERROR'; message: string }
  | { type: 'ABORT' }
  | { type: 'TIMEOUT' }
```

Transition table:

| From | Event | To |
|---|---|---|
| idle | START | pending |
| pending | CHUNK | streaming |
| pending | TIMEOUT | timeout |
| pending | ERROR | error |
| streaming | CHUNK | streaming |
| streaming | DONE | complete |
| streaming | ERROR | error |
| streaming | ABORT | idle |
| complete | START | pending |
| error | START | pending |
| timeout | START | pending |

React hook interface: `useStreamingState()` returns `{ state, dispatch }`. The hook in `studioStore` delegates to this FSM.

---

#### Offline Detection and Behavior

```typescript
// hooks/use-online.ts
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }, [])
  return online
}
```

`OfflineBanner` component renders at the top of the portal layout when `!online`. Text: "You appear to be offline. Some features are unavailable." Actions that require network (new API request, AI run, plugin install) are disabled with a tooltip when offline. Read operations (viewing cached data) remain available.

---

#### Background Refresh

`refetchOnWindowFocus: true` on all queries handles the common case of returning to the tab after time away. For real-time log streaming: `EventSource` connection is opened on mount of the logs page and closed on unmount. Reconnection is handled by the browser for `EventSource` (automatic retry).

---

### Chapter 16 — Search System

Global search is a core navigation primitive. Developers who know what they want should reach it in under 3 keystrokes.

---

#### Global Search — Cmd+K

Component: `CommandPalette` — renders as a `Dialog` over all portal pages. Triggered by `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux), also by clicking the search input in the top nav.

**Index sources:**

| Source | Fields indexed | When updated |
|---|---|---|
| Applications | name, description | On app create/update |
| API Endpoints | path, summary, tags | On OpenAPI spec reload |
| Docs pages | title, headings, body excerpt | On docs deploy |
| Marketplace plugins | name, description, tags | Hourly sync |
| Graph nodes | label, type, properties.description | Nightly rebuild |

**Search execution:**
1. Empty query: shows "Recent" (localStorage) and "Trending" (server, `/api/search/trending`)
2. Query < 2 chars: debounce only
3. Query ≥ 2 chars: debounced 150ms, calls `GET /api/search/global?q=`

**Result ranking:** server-side: exact match (score 100) > prefix match (score 80) > full-text (score 60). Boosted by: recent access (+10), installed (marketplace, +5), relevance score from PostgreSQL `ts_rank`.

**Result display:** grouped by category — Apps (up to 3), Endpoints (up to 5), Docs (up to 5), Plugins (up to 3), Graph Nodes (up to 3). Total max 19 results. Each result: icon, title, subtitle, category badge. Arrow key navigation, Enter to navigate, Escape to close.

---

#### API Explorer Search

Client-side filter against the loaded OpenAPI spec (all operations loaded once, cached in React Query). Filter fields: `operationId`, `summary`, `description`, `tags`, `path`. Method filter chips: multi-select. Deprecated filter: hide deprecated by default, toggle to show. Results update synchronously (no debounce needed — client-side).

---

#### Docs Search

Pagefind integration: static search index built at docs deploy time. Loaded lazily (`import('@pagefind/default-ui')` on first search interaction). Shows snippets with highlighted search terms. Fallback: `GET /api/search/docs?q=` (server-side full-text via pgvector similarity).

---

#### Marketplace Search

Server-side: `GET /api/marketplace/search?q=&category=&sort=&pricingType=&minRating=&version=`. Debounced 300ms. URL sync: search state persisted in URL search params (shareable search URLs). Faceted filtering: category, pricing type (free/paid/freemium), minimum rating (1–5), compatible EduNexus version.

---

#### Graph Search

`GET /api/graph/search?q=&type=&grade=&subject=` — searches `curriculum_nodes` via full-text index on `label || ' ' || coalesce(description, '')`. Returns matching nodes with summary of their immediate neighbours (1 hop). "Load in explorer" button in results: navigates to `/graph` with `?nodeId=` param, which triggers node selection on mount.

---

#### CLI Search

`edunexus search <query>` — searches all resources (apps, keys, plugins, endpoints, docs). Results rendered as a formatted table in the terminal. Tab completion provided for subcommand arguments via `omelette` library integration.

---

#### Search Analytics

Every search event logged to `search_analytics` table:
```sql
CREATE TABLE search_analytics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid REFERENCES developer_profiles(id),
  query        text NOT NULL,
  source       text NOT NULL,  -- 'global' | 'explorer' | 'docs' | 'marketplace' | 'graph'
  results_count integer NOT NULL,
  result_clicked_position integer,  -- null if no click
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Zero-results query alert: a Supabase Edge Function runs every hour, aggregates zero-results queries. If any query accounts for > 5% of searches in the last 24 hours, sends a Slack alert to `#developer-platform`.

---

### Chapter 17 — Analytics

Complete analytics specification — every event tracked, every funnel defined, every metric computed.

---

#### Event Schema

```typescript
type AnalyticsEvent = {
  event: string
  properties: Record<string, unknown>
  user_id: string
  session_id: string
  timestamp: string      // ISO 8601
  page_url: string
  referrer: string
  user_agent: string
  sdk_version?: string
}
```

Events are sent to `POST /api/analytics/track` (batched, max 10 per call, flushed every 2 seconds or on page unload via `navigator.sendBeacon`). Server inserts into `analytics_events` table.

---

#### Identity Events

| Event | Properties |
|---|---|
| `developer_signed_up` | `{ method: 'email' \| 'google' \| 'github', plan: string, referrer: string }` |
| `developer_logged_in` | `{ method: string, org_id: string \| null }` |
| `developer_invited_team_member` | `{ role: string, org_id: string }` |

---

#### Onboarding Funnel Events

| Event | Properties |
|---|---|
| `onboarding_step_viewed` | `{ step: string, step_number: number }` |
| `onboarding_step_completed` | `{ step: string, duration_ms: number }` |
| `onboarding_step_skipped` | `{ step: string }` |
| `first_app_created` | `{ tier: string }` |
| `first_key_generated` | `{ app_id: string }` |
| `first_sdk_installed` | `{ language: string }` |
| `first_api_request_made` | `{ endpoint: string, success: boolean }` |
| `developer_activated` | `{ time_to_activation_minutes: number }` |

---

#### API Explorer Events

| Event | Properties |
|---|---|
| `explorer_endpoint_opened` | `{ method: string, path: string, tag: string }` |
| `explorer_request_sent` | `{ method: string, path: string, auth_type: string, environment: string }` |
| `explorer_request_succeeded` | `{ method: string, path: string, status_code: number, latency_ms: number }` |
| `explorer_request_failed` | `{ method: string, path: string, status_code: number, error: string }` |
| `explorer_code_snippet_copied` | `{ language: string }` |
| `explorer_collection_saved` | `{ endpoint_count: number }` |
| `explorer_mock_mode_toggled` | `{ enabled: boolean }` |

---

#### AI Studio Events

| Event | Properties |
|---|---|
| `studio_prompt_run` | `{ model: string, curriculum: string, tokens: number, latency_ms: number, score: number \| null }` |
| `studio_prompt_saved` | `{ has_variables: boolean, version_count: number }` |
| `studio_prompt_shared` | `{}` |
| `studio_code_exported` | `{ language: string }` |
| `studio_safety_flag_seen` | `{ category: string, severity: string }` |

---

#### Marketplace Events

| Event | Properties |
|---|---|
| `marketplace_plugin_viewed` | `{ slug: string, from: 'listing' \| 'search' \| 'featured' \| 'direct' }` |
| `marketplace_plugin_installed` | `{ slug: string, pricing_type: string }` |
| `marketplace_plugin_uninstalled` | `{ slug: string, days_installed: number }` |
| `marketplace_search_performed` | `{ query: string, results_count: number, category: string }` |
| `marketplace_review_submitted` | `{ slug: string, rating: number }` |
| `marketplace_plugin_submitted` | `{ slug: string }` |

---

#### Documentation Events

| Event | Properties |
|---|---|
| `docs_page_viewed` | `{ path: string, time_on_page_ms: number }` |
| `docs_search_performed` | `{ query: string, results_count: number }` |
| `docs_code_copied` | `{ language: string, page: string }` |
| `docs_feedback_given` | `{ page: string, helpful: boolean }` |

---

#### Billing Events

| Event | Properties |
|---|---|
| `plan_upgrade_started` | `{ from_plan: string, to_plan: string }` |
| `plan_upgrade_completed` | `{ from_plan: string, to_plan: string, mrr_delta: number }` |
| `plan_downgrade` | `{ from_plan: string, to_plan: string }` |
| `invoice_downloaded` | `{}` |

---

#### Developer Funnels

**1. Activation Funnel:**
signup → `first_app_created` → `first_key_generated` → `first_api_request_made` → `developer_activated`

**2. SDK Adoption Funnel:**
`first_key_generated` → docs SDK page viewed → `first_sdk_installed` → first SDK API call

**3. Marketplace Funnel:**
`marketplace_plugin_viewed` → "Install" clicked → `marketplace_plugin_installed` → first plugin API call

**4. Upgrade Funnel:**
rate limit hit (internal event) → upgrade CTA viewed → `plan_upgrade_started` → Paystack checkout → `plan_upgrade_completed`

---

#### Internal Metrics Dashboard

Platform team dashboard (internal Metabase or Supabase Studio):

- **DAU / WAU / MAU**: `COUNT(DISTINCT developer_id)` from `analytics_events` by window
- **Activation rate**: `COUNT(*) FILTER (WHERE activated_at <= signup_at + interval '7 days') / COUNT(*)` from `developer_profiles`
- **SDK adoption by language**: breakdown from `first_sdk_installed` events
- **API call volume by endpoint**: aggregated from `api_request_logs`
- **Error rate by endpoint**: errors/total from `api_request_logs`
- **Marketplace GMV**: `SUM(amount)` from `marketplace_transactions` per period
- **NPS**: quarterly in-app survey (1–10 rating); NPS = % promoters (9–10) - % detractors (1–6)

---

## PART VI — FUTURE

### Chapter 18 — AI Documentation Assistant

The AI documentation assistant makes the developer portal self-service for 95% of questions. Developers get answers without leaving their context.

---

#### Entry Points

1. Floating chat bubble (bottom-right, 52px circle, `MessageCircle` icon) — visible on all portal pages
2. "Ask AI" contextual button in docs pages (appears in the page right margin)
3. `POST /api/ai-docs/chat` — programmatic access for advanced integrations

---

#### Capabilities

**1. Natural language search.** Query: "how do I get a student's learning outcomes?" → response: direct prose answer + an `EndpointCard` component (embedded in chat) for `GET /v1/curriculum/outcomes` + a code snippet in the developer's preferred language. Sources listed at the bottom: [docs/api-reference/curriculum.md, docs/guides/student-data.md].

**2. Context-aware answers.** The system prompt includes: current page URL, active application ID (if on a portal page), developer's preferred language, developer's tier. "What are my rate limits?" → answers with the developer's actual tier limits, not generic docs.

**3. Code generation.** Query: "generate a Node.js function that fetches CBC Grade 8 Mathematics outcomes" → streams a complete, runnable TypeScript function using `@edunexus/sdk`. Code blocks have "Copy" and "Open in Studio" buttons.

**4. API explanation.** Query: "explain what the graph traversal endpoint does" → prose explanation + visual description of request/response + example use case.

**5. Request debugging.** Developer pastes a curl command or JSON error response → AI diagnoses: "This 422 error means the `grade` parameter is out of range. The valid range for CBC Junior is 7–9. You passed grade=13."

**6. Plugin generation.** Query: "create a plugin that sends weekly progress reports to parents via WhatsApp" → streams `manifest.json` + starter `index.ts` with the appropriate EduNexus webhook subscriptions and API calls pre-wired.

---

#### UI Design

Component: `AiDocsChatPanel` — slides in from the right (width: 400px), does not cover main content (portal layout adjusts: `margin-right: 400px` when panel is open). Not a full modal — developer can still interact with the page behind it.

Chat interface: `ChatMessageList` + `ChatInput`. Messages: user (right-aligned, gray bubble), assistant (left-aligned, white bubble, monospace code blocks). Each assistant message: sources footer (collapsible list of doc links), thumbs up/down feedback buttons.

Controls: "Clear conversation" (trash icon, top right of panel) — clears session history. Session history is in-memory only — not persisted across page reloads.

---

#### Backend — `POST /api/ai-docs/chat`

**Request:**
```typescript
type AiDocsChatRequest = {
  messages: { role: 'user' | 'assistant'; content: string }[]
  context: {
    page: string
    appId?: string
    language?: string
  }
}
```

**Response:** `text/event-stream` (SSE).

**Processing pipeline:**
1. Rate limit check: max 20 requests/hour per developer (stored in Redis or Supabase with TTL)
2. Content safety pre-check: refuse if prompt contains PII request, or is entirely off-topic
3. RAG retrieval: embed the last user message via `text-embedding-3-small`, query `pgvector` index on `docs_chunks` table, retrieve top-5 chunks by cosine similarity
4. System prompt construction: EduNexus API overview + retrieved chunks + current page context + developer tier + "Refuse questions not about EduNexus APIs or educational technology."
5. Stream response via DeepSeek or Claude
6. Parse response for endpoint references (regex: `/v1/[a-z/]+`) — inject `EndpointCard` data after stream

**Docs vector index:**
```sql
CREATE TABLE docs_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path   text NOT NULL,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_chunks_embedding ON docs_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

#### Safety

- Rate limit: 20 requests/hour per developer. Over limit: HTTP 429 with `Retry-After` header.
- Content filter: system prompt instructs the model to refuse off-topic requests. If model refuses, response includes a polite redirect: "I can only answer questions about EduNexus APIs and educational technology. For other questions, please visit [our community forum]."
- No PII in responses: system prompt instructs the model never to include student names, IDs, or other personal data in generated code or explanations — use placeholder values only.

---

### Chapter 19 — IDE Ecosystem

The IDE ecosystem brings EduNexus context directly into the developer's workflow — zero context switching.

---

#### VS Code Extension (`edunexus.vscode-extension`)

**Sidebar panel** (`EduNexusExplorerView`):
- Applications tree: each app as a tree node, expandable to show: API Keys (last 4 chars visible), Usage (today's call count), Environment badge
- Quick actions: "Copy API Key" (copies masked value, prompts to reveal), "Open Explorer" (opens browser), "View Logs" (opens `/apps/[id]/logs` in browser)

**IntelliSense:**
- TypeScript type definitions auto-downloaded from `@edunexus/types` on extension activate
- Autocomplete for SDK functions: `edunexus.curriculum.` → shows all methods with signatures
- Parameter suggestions: `getOutcomes({ grade: ` → suggests `7 | 8 | 9` etc.

**Inline documentation:**
- Hover over any `edunexus.*` SDK method → shows JSDoc with description, parameters, return type, example

**Code lens:**
- Above any `edunexus.*` API call: "Try in Explorer ↗" — opens the corresponding endpoint in the web explorer with the same parameters pre-filled

**Status bar item:**
- Left side: `EduNexus: Production` (clickable, opens environment selector quick pick)
- Right side: `EN: 2,341 calls today` (clickable, opens usage page in browser)

**Commands** (accessible via `Cmd+Shift+P`):
- `EduNexus: Create API Key`
- `EduNexus: Open Explorer`
- `EduNexus: Deploy Plugin`
- `EduNexus: Switch Environment`
- `EduNexus: Open AI Studio`

**Configuration (`settings.json`):**
```json
{
  "edunexus.apiKey": "",
  "edunexus.environment": "production",
  "edunexus.showStatusBar": true,
  "edunexus.inlineDocumentation": true
}
```

---

#### Cursor Extension

VS Code-compatible — identical to VS Code extension. Additional feature: auto-generates `.cursorrules` file in the project root when `edunexus dev init` is run. The `.cursorrules` file contains:
- EduNexus API patterns and naming conventions
- Common SDK usage patterns
- Link to OpenAPI spec for context
- "Do not invent API endpoints — always check the spec at /api/openapi.json"

---

#### Claude Code MCP Server (`edunexus-mcp`)

Enables Claude Code to make authenticated EduNexus API calls directly.

**Configuration (`~/.edunexus/mcp-config.json`):**
```json
{
  "apiKey": "en_live_...",
  "environment": "production",
  "appId": "..."
}
```

**MCP tools defined:**

| Tool | Description | Parameters |
|---|---|---|
| `edunexus_list_endpoints` | Returns full OpenAPI spec as structured JSON | none |
| `edunexus_make_request` | Makes authenticated API request | `method`, `path`, `params`, `body` |
| `edunexus_get_graph_node` | Fetches graph node by ID with neighbours | `nodeId`, `depth` |
| `edunexus_search_curriculum` | Searches CBC curriculum nodes by natural language query | `query`, `grade`, `subject` |
| `edunexus_get_student_profile` | Fetches anonymized learning profile | `studentId` |

**Registration in Claude Code `settings.json`:**
```json
{
  "mcpServers": {
    "edunexus": {
      "command": "edunexus-mcp",
      "env": { "EDUNEXUS_MCP_CONFIG": "~/.edunexus/mcp-config.json" }
    }
  }
}
```

---

#### JetBrains Plugin

**Tool window:** mirrors VS Code sidebar panel — applications list, quick key copy, usage stats.

**Live templates:** file `edunexus.xml` installed to JetBrains live templates directory. Template abbreviations: `en-outcomes` (expands to SDK call for `getOutcomes`), `en-ai-generate` (expands to AI generation call), `en-webhook` (expands to webhook handler boilerplate).

**HTTP client integration:** `edunexus.http` file auto-generated in project root with all common EduNexus API calls in JetBrains HTTP format. Variables: `@baseUrl = https://api.edunexus.co.ke`, `@apiKey = {{EDUNEXUS_API_KEY}}`.

---

#### TypeScript SDK Types (`@edunexus/types`)

Zero-runtime-dependency package containing all TypeScript types for the EduNexus API. Auto-generated from the OpenAPI spec on every release using `openapi-typescript`. Published to npm. Types include:
- All request body types (e.g., `CreateApplicationRequest`)
- All response types (e.g., `CurriculumOutcomesResponse`)
- All enum values as TypeScript string unions
- All error response shapes

Import pattern:
```typescript
import type { CurriculumOutcome, CreateApplicationRequest } from '@edunexus/types'
```

---

### Chapter 20 — Product Roadmap

A phased delivery plan that moves from functional to world-class in 24 months.

---

#### Version 1.0 — MVP (Month 1–3)

**Developer portal infrastructure:**
- Developer registration (email + Google OAuth)
- API key management (create, list, revoke)
- Basic developer dashboard (usage charts, error feed)
- Rate limit display

**API Explorer (v1):**
- Full endpoint listing from OpenAPI spec
- Parameter display and schema rendering
- Code snippet generation (cURL, JS, Python)
- No live requests (sandbox only in v1)

**Documentation (v1):**
- Getting started guide
- SDK reference (Node.js, Python)
- API reference (auto-generated from OpenAPI)
- Authentication guide

**Marketplace (browse-only):**
- Plugin listing page
- Plugin detail page
- No install/uninstall in v1

**CLI (v1):**
- `auth` commands
- `apps` and `keys` commands
- `logs tail`

**Certifications:** none in v1.

---

#### Version 1.5 — Month 3–6

- Live API requests in Explorer (proxy endpoint, auth integration)
- AI Studio (full feature: streaming, versioning, export)
- Knowledge Graph Explorer (read-only, no overlays)
- Marketplace install/uninstall (free plugins only)
- Webhook management UI (CRUD, delivery log)
- CLI: `deploy plugin`, `webhook listen`, `test`
- VS Code extension (sidebar, IntelliSense)
- SDK: Go, PHP

---

#### Version 2.0 — Month 6–12

- Organizations and teams (roles, SSO with Google Workspace)
- Marketplace publisher portal (submission, review queue, revenue dashboard)
- Knowledge Graph overlays (learner performance, assessment coverage)
- AI Documentation Assistant (RAG-powered chat)
- Claude Code MCP server
- Certification program Level 1 (API Fundamentals)
- SDK: Ruby
- CLI: `config`, `dev serve`, `dev tunnel`
- Cursor extension

---

#### Version 2.5 — Month 12–18

- Enterprise SSO (SAML 2.0, OIDC)
- Private marketplace (enterprise-only plugins, per-org approval)
- Advanced analytics (funnel analysis, cohort retention, custom date ranges)
- Certification Level 2 (AI Integration) and Level 3 (Knowledge Graph Expert)
- JetBrains plugin
- Windsurf extension
- Government partner portal (MOE, KNEC integration endpoints documented)
- SLA tier selection (99.9% / 99.99%)

---

#### Version 3.0 — Month 18–24

- Educational Intelligence Protocol (EIP) v1 — open standard published, reference implementation open-sourced
- Multi-tenant white-label platform (LMSes can embed EduNexus APIs under their own brand)
- Continental API gateway (regional nodes in Nigeria, South Africa, Ghana, Tanzania)
- Developer Fund: grant programme for African edtech builders ($500–$5,000 USD grants, application via portal)
- Annual DevSummit: in-person developer conference, Nairobi

---

#### Enterprise Tier Features

| Feature | Detail |
|---|---|
| Dedicated infrastructure | Single-tenant deployment, isolated Supabase project |
| SLA | 99.99% uptime, backed by credits |
| Custom rate limits | Negotiated per contract |
| IP allowlisting | CIDR ranges via portal UI |
| Audit log export | SIEM integration (Splunk, Datadog, Elastic) |
| Priority support | 4-hour response SLA, dedicated Slack channel |
| Custom contract | PO-based invoicing, net-30 terms |
| Professional services | Dedicated onboarding engineer, integration review |

---

#### Government Partner Tier

| Integration | API |
|---|---|
| KNEC | Exam results (KCSE, KCPE) lookup by school code |
| TSC | Teacher registration validation |
| MOE | Official CBC curriculum feed (KICD-sourced) |
| NEMIS | Student registration number validation |
| HELB | Higher education loan data (future) |

Data residency: all government partner data processed and stored within Kenya (AWS af-south-1 or local cloud). Data Processing Agreement (DPA) executed with each government entity before API access is granted.

---

#### Continental Expansion — Month 24+

| Country | Curriculum | Standards Body |
|---|---|---|
| Nigeria | NERDC (National curriculum) | WAEC, NECO |
| South Africa | CAPS (Curriculum Assessment Policy Statements) | DBE, NSC |
| Ghana | NaCCA (National Curriculum) | WAEC |
| Tanzania | NECTA curriculum | NECTA |

The **Pan-African Educational Intelligence Exchange (PAEIE)** protocol: a proposed open standard for cross-border curriculum data exchange. EduNexus publishes the PAEIE v1 specification alongside the EIP v1 spec as open standards under a Creative Commons licence. Any African EdTech platform can implement PAEIE and exchange curriculum data without going through EduNexus.

---

## FINAL CHAPTER — Developer Experience Manifesto

### Why developers.edunexus.co.ke Must Become the Stripe of Educational Intelligence

---

#### The Problem With Building Educational Software Today

Anyone who has tried to build an educational application in Africa knows the feeling. You start with a good idea — personalised tutoring, automated progress reports, adaptive assessments — and immediately hit a wall. There is no standard way to access curriculum data. Every school uses a different format. The Ministry of Education publishes KICD materials as PDFs. There is no API for learning outcomes. There is no graph of which skills are prerequisites for which. There is no event stream when a student completes an assessment. There is no infrastructure.

So you build it yourself. You manually scrape curriculum documents. You build a custom data model that only works for your context. You write one-off integrations with each school you serve. You reinvent the same foundation that every other edtech company in Nairobi is also reinventing, at the same time, in isolation.

The result is a fragmented ecosystem where good ideas die not because they were bad ideas, but because the foundational infrastructure cost was too high to justify. Brilliant engineers spend months building data pipelines that should already exist. Founders run out of runway before reaching product-market fit because they were too busy re-implementing curriculum parsers.

This is the problem. And it is solvable.

---

#### What Infrastructure Does for an Ecosystem

In 2010, accepting a payment online as a small company required integrating with a bank, signing merchant agreements, handling fraud detection, building reconciliation pipelines, and managing PCI compliance. Stripe reduced all of that to four lines of code. The result was not just convenience — it was a Cambrian explosion of new businesses that previously could not have existed. Shopify, Lyft, Airbnb, and thousands of others were built on the assumption that payments were solved.

Supabase did the same for the backend. Firebase showed the way; Supabase made it open, Postgres-native, and developer-beloved. Suddenly a solo developer could ship a full-stack application with authentication, a relational database, real-time subscriptions, and file storage in an afternoon. An entire category of "build your own backend" labour simply disappeared.

Vercel did the same for deployment. Netlify, then Vercel, removed the operational burden of running a global CDN, handling build pipelines, and managing edge infrastructure. Shipping a Next.js application to 30 global regions is now a git push.

Notice the pattern: each of these companies attacked a specific layer of the stack that every developer had to build, made it radically simpler, and then watched an ecosystem explode on top of it.

**EduNexus must do this for educational intelligence.**

The CBC curriculum graph, the learner model, the assessment engine, the AI generation APIs, the knowledge graph — these are infrastructure. They should not be rebuilt by every edtech company in Africa. They should be built once, made correct, made fast, made secure, and made available to every developer on the continent through a clean API.

---

#### The Three Principles of World-Class Developer Experience

**First principle: zero friction to first value.**

A developer who lands on developers.edunexus.co.ke should be able to make a real API call within 10 minutes. Not a mock. Not a tutorial. A real, authenticated call that returns real CBC curriculum data. This is the activation event. Everything before this moment is onboarding. Everything after is retention. The 10-minute window is where the platform wins or loses the developer permanently.

This is why Chapter 6 specifies every step, every error state, and every drop-off recovery in excruciating detail. Friction compounds. A confusing signup screen, a slow email verification, an unclear key generation step — each one loses 10% of developers. The cumulative effect of four 10% drop-offs is that you keep 66% of the developers who started. Fix those four friction points and you keep 90%. That is not a small difference: it is the difference between a thriving developer ecosystem and a ghost town.

**Second principle: everything is an API.**

The curriculum is an API. The learner model is an API. The knowledge graph is an API. The AI generation is an API. Assessment templates are an API. Every piece of educational intelligence that EduNexus has built should be exposed as a clean, documented, versioned API endpoint. Developers should never need to ask "can I access that?" The answer should always be yes — with appropriate auth, appropriate rate limits, and a clear data model.

This principle has an implication that runs deeper than just endpoint design. It means EduNexus must eat its own cooking. The main teacher-facing application should be built on the same APIs that external developers use. If the internal app needs a capability that the external API does not expose, the external API is incomplete. Dogfooding is the quality signal.

**Third principle: community is infrastructure.**

Great developer platforms are not just APIs and documentation. They are communities where developers learn from each other, share patterns, publish plugins, and collectively raise the quality of what gets built on the platform. The forum, the Discord, the certification programme, the hackathons, the developer fund — none of these are nice-to-haves. They are infrastructure.

A developer who earns a Level 1 EduNexus certification is not just learning. They are becoming an ambassador. A developer who publishes a plugin in the marketplace is not just shipping code. They are extending the platform. A developer who answers a question in the community forum is not just being helpful. They are compounding the value of every developer who comes after them.

---

#### What Winning Looks Like

Here is a concrete definition of success for this platform, five years from now.

Every Kenyan edtech startup builds its first prototype using EduNexus APIs. Not because they are required to. Because it is the fastest path to a working product. The infrastructure is already there. The curriculum data is already modelled. The AI generation is already safe and curriculum-aligned. The learner model is already built. They can focus entirely on the problem they are actually trying to solve.

Every African learning management system uses the CBC curriculum graph as its canonical data source. When KICD updates the curriculum, every LMS on the continent receives the update through the EduNexus API. There is one source of truth, and it is maintained by the people best positioned to maintain it.

The Educational Intelligence Protocol becomes an ISO standard. EduNexus does not just build the best implementation — it publishes the specification. Other platforms, including competitors, implement the same protocol. Data portability becomes possible. A student's learning record, built up over years of engagement with multiple platforms, can move with them. The student owns their educational data.

A Kenyan developer in Eldoret builds a Swahili-language tutoring app for Standard 4 students. They use the EduNexus curriculum graph API to get the exact learning outcomes for that grade, the knowledge graph API to understand prerequisite skills, and the AI generation API to produce explanations in age-appropriate Swahili. They launch in three weeks. They charge KES 50 per month. They reach 10,000 students in the first year. They would not have been able to build this without the infrastructure EduNexus provides.

That is winning.

---

#### The Developer Covenant

EduNexus makes the following promises to every developer who builds on this platform.

**Stability.** API versions are supported for a minimum of 24 months after a new version is released. Breaking changes never happen within a version. Deprecation notices are given at least 6 months in advance, with migration guides.

**Transparency.** The status page shows real uptime, not just current status. Incident post-mortems are published publicly within 72 hours. Pricing changes are announced 60 days in advance. The roadmap is public.

**Fair pricing.** The free tier is genuinely useful — not a trial. Paid tiers are priced so that a profitable indie developer can afford them. Enterprise pricing does not require a sales call to discover. Rate limits are documented, not hidden.

**Developer advocate support.** There is a human developer advocate whose job is to answer questions, review plugins, write tutorials, and listen to feedback. Their response time is measured. Their helpfulness is rated. They are not a gatekeeper — they are a multiplier.

**Open standards.** EduNexus will not lock developers into proprietary formats. The curriculum graph data model, the learner model schema, the event format — all published as open specifications. Developers can always export their data and take it elsewhere.

---

#### A Call to the Engineers Building This

You are not building a developer portal.

You are building the foundational layer of African educational infrastructure. That is not a metaphor. It is a literal description of what this platform is.

When you design the API Explorer, you are deciding how easy it is for a developer in Mombasa to discover that EduNexus has exactly the curriculum data they need for their app. When you write the onboarding flow, you are deciding whether that developer will activate or abandon. When you build the rate limit system, you are deciding which developers can afford to build on this platform and which cannot.

Every decision you make in this codebase has a downstream effect on the quality of educational software in Kenya. The teacher who generates a better lesson plan, the parent who finally understands their child's learning journey, the student who discovers that they are good at spatial reasoning but struggles with abstract algebra — all of it runs on the APIs you build and the developer experience you design.

This is rare. Most software makes something slightly more convenient. This software has the potential to change what is possible in education on a continent with 400 million school-age children and a chronic shortage of quality teaching support tools.

Build it like it matters. Because it does.

The quality bar is not "good enough for a developer portal." The quality bar is: would Stripe engineers be proud of this? Would the first developer to land on this site think "finally, someone built this properly"?

Make the documentation so clear that developers never have to ask a question. Make the APIs so consistent that developers can guess the endpoint before looking it up. Make the error messages so specific that developers fix their issue on the first read. Make the CLI so fast and satisfying that developers reach for it without thinking.

You are building infrastructure. Infrastructure lasts. Infrastructure compounds. Infrastructure, built well, becomes invisible — and that is the highest compliment you can give a piece of engineering. When the developer in Eldoret builds their tutoring app in three weeks, they will not think about the API design decisions that made that possible. They will just think: "it works."

Make it work. Make it last. Make it worthy of the students who will learn on the software that is built on top of it.

---

```
---
*EduNexus Developer Platform Implementation Blueprint v1.0*  
*Authored: 2026-06-30*  
*Next review: 2026-09-30*
```
