# EduNexus Developer Experience Ecosystem — Complete Blueprint

## The Master Design Document for developers.edunexus.co.ke

**Edition 1.0 — June 2026**
**Classification: Internal Product Blueprint**

---

> *The measure of a developer platform is not the quality of its documentation. It is the speed at which a developer goes from zero to something real.*

---

## How to Read This Document

This blueprint is structured for five audiences who will use it simultaneously:

- **Product designers** — UI structure, user journeys, interaction patterns
- **Frontend engineers** — page architecture, component requirements, state management needs
- **Backend engineers** — APIs, data models, infrastructure requirements
- **Technical writers** — content structure, information architecture, governance
- **DevRel** — community features, onboarding flows, developer success metrics

Each section covers purpose, user journeys, UI structure, backend requirements, APIs, data model, security, EduNexus integration, best practices, and extensibility.

Read it end to end when architecting the platform. Jump to sections when implementing a specific surface.

---

## Table of Contents

1. Developer Experience Philosophy
2. Information Architecture and Navigation
3. Landing Page and Onboarding Journey
4. Authentication and API Key Management
5. Interactive API Documentation
6. SDK Documentation
7. AI Playground and API Explorer
8. Educational Knowledge Graph Explorer
9. Event Explorer and Webhook Testing
10. Marketplace Documentation
11. Plugin Development Portal
12. CLI Documentation
13. Quickstart Guides
14. Architecture Diagrams and Visualizations
15. Code Examples and Sample Applications
16. Versioning Strategy and Changelog
17. Search Architecture and Discoverability
18. Developer Dashboard and Analytics
19. Certification Portal Integration
20. Community, RFC Process, and Partner Onboarding
21. Accessibility, Localization, and Mobile Experience
22. Documentation Governance and Content Lifecycle
23. Future Evolution

---

---

# Part One — Foundation

---

## 1. Developer Experience Philosophy

### 1.1 The Core Principle

The EduNexus Developer Platform exists to make one thing true: a developer who has never heard of CBC, KICD, or competency-based education should be able to ship a production-grade educational application in one afternoon.

This is a bold claim. It requires that we absorb all curriculum complexity, all learner progression logic, all assessment frameworks, and all pedagogical nuance into our platform — so that developers never have to think about any of it unless they choose to.

The DX philosophy is built on five pillars:

**Pillar 1: Zero to Real in Minutes**
Every journey on the developer platform must end with a working artifact — a running application, a live API call, a rendered dashboard, a generated lesson plan. Not a "hello world." Not a stub. Something real that a teacher or student could actually use.

We measure this as Time to First Value (TTFV). Our target is under 10 minutes for any quickstart guide.

**Pillar 2: Progressive Disclosure**
The platform must be approachable for a junior developer building their first integration and deep enough for a staff engineer building a national-scale system. These are not two different platforms. They are two depths of the same platform.

The landing page and quickstarts serve the junior developer. The API reference, SDK internals documentation, and event system documentation serve the staff engineer. Both users must feel the platform was designed for them.

**Pillar 3: Educational Context Without Curriculum Expertise**
Our APIs must be self-contextualizing. When a developer calls `/v1/curriculum/strands`, the response must include enough context — names, descriptions, grade bands, competency indicators — that the developer understands what they are working with without needing to read a separate curriculum document.

When a developer calls `/v1/learner/{id}/profile`, the response must explain what each field means in educational terms, not just return raw data.

**Pillar 4: Trust Through Consistency**
Stripe earns developer trust by being relentlessly consistent: consistent naming, consistent error formats, consistent pagination, consistent authentication. Developers who learn one part of the Stripe API immediately know how every other part works.

EduNexus must earn the same trust. One authentication pattern. One error format. One pagination style. One webhook signature scheme. One SDK call pattern across all languages.

**Pillar 5: Africa-First, World-Class**
The platform is built for the Kenyan market but must be world-class by global standards. This means:
- All documentation available in English and Swahili
- Latency targets appropriate for Kenyan connectivity (sub-3G conditions)
- Mobile-first documentation browsing
- Payment flows that support M-Pesa and mobile money
- Examples that use Kenyan names, Kenyan schools, Kenyan contexts

It must simultaneously meet the technical standards that international partners — edtech companies, NGOs, government ministries, research institutions — expect from an enterprise API platform.

### 1.2 Developer Personas

**The Integration Developer**
A software developer at a school management software company (e.g., Kes School Manager, iSams Kenya, or a government EMIS system). They need to pull learner data, push assessment results, and subscribe to enrollment events. They care about reliability, documentation quality, and SLA guarantees.

*Their question:* "How do I connect my existing system to EduNexus without rebuilding it?"

**The AI Builder**
A developer building a tutoring app, a study assistant, or a homework helper. They want to call EduNexus AI APIs without building curriculum awareness from scratch. They care about response quality, cost per call, and rate limits.

*Their question:* "How do I add CBC-aware intelligence to my app in a weekend?"

**The Startup Founder**
Building a specialized edtech product — a parent dashboard, a teacher tool, a student motivation system. They want to use EduNexus as a backend so they can focus entirely on their UX. They care about time to market, pricing tiers, and marketplace reach.

*Their question:* "Can I build my entire product on top of EduNexus APIs?"

**The Ministry/Enterprise Architect**
Designing a national system — a curriculum delivery platform, a national assessment system, an EMIS integration. They need enterprise-grade security, audit trails, data residency guarantees, and custom SLAs.

*Their question:* "Is this platform appropriate for national-scale deployment and government use?"

**The Researcher**
An academic or data scientist studying learning outcomes, curriculum effectiveness, or educational AI. They need access to anonymized datasets, bulk export APIs, and the Knowledge Graph query interface.

*Their question:* "Can I access the educational data I need for my research without compromising student privacy?"

**The Plugin Developer**
A developer who wants to extend EduNexus with a new capability — an integration with a third-party tool, a custom AI model, a specialized assessment type. They want to publish to the marketplace and reach EduNexus schools.

*Their question:* "How do I build something that integrates deeply with EduNexus and distribute it to schools?"

### 1.3 The Non-Negotiables

These standards apply to every surface of the developer platform without exception:

- Every code example must be tested and working on the day of publication
- Every API response shown in documentation must be real — no fabricated JSON
- Every error message must be actionable — tell the developer what to do, not just what went wrong
- Every breaking change must be announced at least 90 days in advance
- The platform must work on a 3G connection — no bloated JavaScript bundles
- Every page must be screen reader accessible
- Every page must have a "suggest an edit" link

---

## 2. Information Architecture and Navigation

### 2.1 Purpose

The information architecture (IA) is the skeleton of the developer platform. A poor IA means developers cannot find what they need, become frustrated, and either abandon the platform or flood support with questions that the documentation already answers. A great IA means developers navigate the platform intuitively, discovering capabilities they did not know existed.

### 2.2 User Journeys Through the IA

**Journey 1: First-time visitor**
Landing page → "Get Started" → Quickstart guide → API key creation → First API call → Dashboard

**Journey 2: Evaluating the platform**
Landing page → API Reference → "Try it" interactive example → Pricing → Sign up

**Journey 3: Building a specific feature**
Search → Relevant guide → Code example → SDK reference → Copy code

**Journey 4: Debugging a problem**
Error message → Search → Troubleshooting guide or API error reference → Community

**Journey 5: Publishing to marketplace**
Marketplace docs → Plugin development guide → Plugin CLI → Submit for review

### 2.3 Top-Level Navigation Structure

```
developers.edunexus.co.ke
├── /                          → Landing page
├── /docs                      → Documentation home
│   ├── /docs/quickstart       → Quickstart guides (by use case)
│   ├── /docs/guides           → Conceptual and how-to guides
│   │   ├── /authentication
│   │   ├── /curriculum
│   │   ├── /learners
│   │   ├── /assessments
│   │   ├── /ai
│   │   ├── /events
│   │   ├── /webhooks
│   │   ├── /marketplace
│   │   ├── /plugins
│   │   └── /security
│   ├── /docs/api              → API reference (auto-generated + hand-edited)
│   │   ├── /v1                → Current stable version
│   │   └── /v2-beta           → Beta version
│   ├── /docs/sdks             → SDK documentation
│   │   ├── /javascript
│   │   ├── /python
│   │   ├── /dart
│   │   └── /go
│   ├── /docs/cli              → CLI documentation
│   ├── /docs/changelog        → Version history
│   └── /docs/errors           → Error code reference
├── /playground                → AI Playground and API Explorer
├── /graph                     → Knowledge Graph Explorer
├── /events                    → Event Explorer
├── /marketplace               → Marketplace browser
├── /dashboard                 → Developer dashboard (authenticated)
│   ├── /dashboard/keys        → API key management
│   ├── /dashboard/usage       → Usage analytics
│   ├── /dashboard/logs        → Request logs
│   ├── /dashboard/webhooks    → Webhook management
│   └── /dashboard/apps        → Registered applications
├── /community                 → Community hub
│   ├── /community/forum       → Discussion forum
│   ├── /community/rfc         → RFC tracker
│   └── /community/showcase    → Developer showcase
├── /certification             → Certification portal
├── /partners                  → Partner onboarding
├── /status                    → Platform status page
└── /blog                      → Developer blog
```

### 2.4 Left Sidebar Navigation (Documentation)

The sidebar is the primary navigation surface within documentation. It must:

- Be persistent (fixed) on desktop — never scroll away
- Show the user's current location with a highlighted active state
- Be collapsible on mobile via a hamburger trigger
- Support keyboard navigation fully
- Show breadcrumbs in the page header to reinforce location

**Sidebar structure within /docs:**

```
▸ Getting Started
  • Introduction
  • Platform overview
  • Authentication
  • Your first API call
  • Rate limits and quotas

▸ Quickstarts
  • Lesson plan generator
  • Learner progress dashboard
  • AI tutoring assistant
  • Parent progress report
  • School analytics

▸ Core Concepts
  • Educational Knowledge Graph
  • Curriculum structure
  • Learner profiles
  • Competency progression
  • Assessment framework
  • Event system

▸ API Reference
  • Curriculum APIs
  • Learner APIs
  • Assessment APIs
  • AI APIs
  • Event APIs
  • Webhook APIs
  • Admin APIs

▸ SDKs
  • JavaScript / TypeScript
  • Python
  • Dart / Flutter
  • Go

▸ CLI
  • Installation
  • Commands
  • Configuration

▸ Marketplace & Plugins
  • Overview
  • Plugin spec
  • Publishing guide
  • Review process

▸ Security
  • API key security
  • Webhook verification
  • Data residency
  • Compliance

▸ Changelog
▸ Error Reference
▸ Status
```

### 2.5 Header Navigation

The persistent top header contains:

```
[EduNexus Dev Logo]  Docs  API  Playground  Graph  Community  Blog  [Search]  [Dashboard →]
```

- Logo links to `/` (landing page)
- Search opens a full-screen modal with instant results (Cmd+K / Ctrl+K trigger)
- "Dashboard →" is the primary CTA when signed out (shows "Sign up free"), becomes user avatar with dropdown when signed in
- Active section is highlighted

### 2.6 Secondary Navigation Patterns

**In-page table of contents:** Right sidebar on desktop showing H2/H3 headings with scroll-spy highlighting. Collapses on mobile.

**Breadcrumbs:** Below the header. `Docs / Guides / Curriculum / Strands and Sub-strands`

**Prev/Next navigation:** At the bottom of every documentation page, linking to the logical previous and next page within the current section.

**Related content:** After main content, before prev/next. 3–5 manually curated related guides or API references. Not algorithmic — curated by technical writers.

**Version selector:** Dropdown in the header of API reference pages. `v1 (stable) ▾` with options for `v1 (stable)`, `v2 (beta)`, `v0 (deprecated)`.

---

## 3. Landing Page and Onboarding Journey

### 3.1 Purpose

The landing page has one job: convert a visiting developer into an active developer within 10 minutes. Every element on the page must serve that goal. No marketing fluff. No abstract value proposition. Show the code, show what it produces, show the path to building.

### 3.2 User Journey

```
Arrive via search / word of mouth / conference / partner referral
→ Scan hero section (15 seconds) — understand what the platform does
→ See live code example (30 seconds) — understand how it works
→ See use case cards (30 seconds) — confirm it applies to their problem
→ Click "Get Started" or "Try in Playground"
→ [Path A] Sign up → API key → Quickstart → First working call
→ [Path B] Playground (no sign-up) → See output → Sign up
```

### 3.3 Hero Section

**Headline:**
`Educational Intelligence APIs for Kenya and Beyond`

**Subheading:**
`Build CBC-aware applications, AI tutors, parent dashboards, and school analytics without becoming a curriculum expert. EduNexus handles the educational intelligence layer.`

**Two CTAs:**
- `Start Building →` (primary, filled) — goes to `/docs/quickstart`
- `Try the API →` (secondary, outlined) — goes to `/playground`

**Hero Code Block:**
A live, syntax-highlighted, copyable code snippet demonstrating the most impressive single API call — the one that shows the most value in the fewest lines. The block auto-cycles between JavaScript, Python, and cURL every 5 seconds, or the user can click tabs.

```javascript
// Generate a CBC-aligned lesson plan in seconds
const edunexus = new EduNexus('your-api-key');

const plan = await edunexus.lessonPlans.generate({
  subject: 'Mathematics',
  strand: 'Numbers',
  grade: 7,
  duration: 40,
  learnerCount: 35
});

console.log(plan.objectives);   // ['Identify place values...', ...]
console.log(plan.activities);   // Structured 40-min lesson flow
console.log(plan.assessment);   // Formative rubric aligned to KICD
```

**On the right:** Rendered output panel showing the actual response — animated to appear line by line as if it just returned. This makes the value visceral, not abstract.

### 3.4 Stats Bar

Below the hero, a horizontal band of 4 metrics:

```
  42 APIs   |   6 SDKs   |   CBC + 8-4-4 + IGCSE   |   < 200ms avg latency
```

These should be real numbers pulled from a `/v1/platform/stats` endpoint and hydrated server-side.

### 3.5 Use Case Cards

Six cards in a 3×2 grid. Each card has an icon, a title, two sentences of description, and a "See guide →" link.

| Use Case | Description |
|----------|-------------|
| AI Tutoring | Build a study companion that knows exactly which CBC competencies a learner needs to practice next. |
| Parent Dashboards | Give parents real-time progress visibility aligned to CBC strands and competency levels. |
| School Analytics | Surface aggregated performance data across classes, grades, and competency areas. |
| Assessment Tools | Build formative and summative assessment tools with CBC-aligned rubrics pre-loaded. |
| EMIS Integration | Connect government education management systems to learner intelligence APIs. |
| Marketplace Apps | Publish a specialized tool to the EduNexus marketplace and reach 1,000+ schools. |

### 3.6 Interactive API Explorer Preview

A stripped-down version of the API Explorer embedded directly in the landing page. No sign-up required. The developer can:
- Select from 5 pre-configured example requests
- Click "Send"
- See the real (or realistic sandbox) response in under 500ms

This is the most important conversion mechanism on the page. Developers who try an API call before signing up convert at 3–5× the rate of those who only read about it.

### 3.7 Trust Section

Three columns:

**Who is building on EduNexus:**
Logos of partner schools, edtech companies, and government integrations (with permission). Or, in early days: "Used by 50+ pioneer schools across Kenya."

**Security and compliance:**
- "Data stays in Kenya" (flag icon)
- "ISO 27001 aligned" (shield icon)
- "KICD-approved curriculum data" (badge icon)

**Support:**
- "Developer Slack community"
- "99.9% uptime SLA"
- "Response in < 4 hours for production issues"

### 3.8 Onboarding Journey (Post Sign-Up)

Once a developer signs up, the platform must continue the journey rather than dropping them into a cold dashboard.

**Step 1: Welcome screen**
Single screen. One question: "What are you building?" with 4 radio options:
- An AI tutoring or study tool
- A parent or student dashboard
- A school management integration
- Something else

The selection routes to a personalized quickstart.

**Step 2: Personalized quickstart**
A 5-step guide specific to their stated use case. Progress indicator at the top. Each step has a code snippet, a "Run this" button that calls the actual API using their newly issued sandbox key, and a results pane.

**Step 3: Key issuance**
After step 2, their sandbox API key is highlighted. Copy button. One-click to view in dashboard.

**Step 4: Sandbox to production**
A clear prompt: "Ready for production? Upgrade your plan and switch your key." The step is present but not pushed — developers should be allowed to explore at their own pace.

**Step 5: Slack invite**
"Join 200+ developers building on EduNexus." Single-click Slack invite link.

### 3.9 Backend Requirements for Landing Page

- `/v1/platform/stats` endpoint returning platform metrics for the stats bar
- Sandbox API keys auto-issued on sign-up (no manual approval for sandbox)
- Quickstart API calls routable to a dedicated sandbox environment with pre-seeded data
- Analytics events: `developer_signup`, `quickstart_started`, `quickstart_step_completed`, `first_api_call_made`, `playground_used`
- A/B test framework for hero headline and CTA copy

---

## 4. Authentication and API Key Management

### 4.1 Purpose

Authentication is the first technical interaction a developer has with the platform. A confusing auth model is the most common cause of early developer abandonment. EduNexus uses a single, consistent auth model across all APIs.

### 4.2 Auth Model

**Primary mechanism:** Bearer token (API key) in the `Authorization` header.

```
Authorization: Bearer enx_live_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

No cookies. No session tokens for API calls. No OAuth for machine-to-machine. Simple, predictable, debuggable.

**OAuth 2.0 for user-facing applications:** Applications that act on behalf of EduNexus users (teachers, parents, students) use OAuth 2.0 with PKCE. This is for scenarios where the developer's application needs to read a specific teacher's lesson plans or a specific parent's child's progress.

**Service-to-service:** Standard API key in header. For high-trust integrations (EMIS connections, ministry systems), mTLS is available as an option.

### 4.3 Key Namespacing

Every API key has a structured prefix that communicates its scope at a glance:

```
enx_live_sk_...    → Live secret key (full access, never expose client-side)
enx_test_sk_...    → Test/sandbox secret key
enx_live_pk_...    → Live publishable key (safe for client-side, read-limited)
enx_test_pk_...    → Test publishable key
enx_rk_...         → Restricted key (scoped to specific endpoints)
```

This pattern is borrowed from Stripe and is immediately intuitive to any developer who has used a modern API.

### 4.4 Key Management UI (Dashboard)

**Location:** `/dashboard/keys`

**UI structure:**

```
API Keys

[+ Create new key]

Live keys                                          Test keys
─────────────────────────────────────────────     ────────────────────
Name               Created    Last used   [...]    Name           Created
Default secret     Jun 1      2 hours ago  ⋮       Default test   Jun 1
Server key         Jun 12     Never        ⋮

Restricted keys
────────────────────────────────────────────────────────────────────────
Name               Permissions            Created    Last used   [...]
Read-only key      Curriculum: read       Jun 15     Yesterday    ⋮
Webhook key        Events: read/write     Jun 20     1 hour ago   ⋮
```

**Creating a key:**
Modal with fields:
- Name (for developer reference only)
- Type: Secret / Publishable / Restricted
- For restricted keys: a permissions matrix listing each API group with checkboxes for None / Read / Write / Admin

**Rolling a key:**
Two-step process: click "Roll key" → confirmation modal warns that the old key stops working immediately → new key shown once with copy button. Forces intentional action.

**Key detail page:**
Shows full key (once, on creation only — thereafter it is masked to `enx_live_sk_xxx...xxx`), creation time, last used time, created by (user email), requests in last 7 days chart, and a request log sample.

### 4.5 OAuth 2.0 Application Management

**Location:** `/dashboard/apps`

**Fields for registering an OAuth app:**
- Application name
- Description
- Homepage URL
- Redirect URIs (multiple allowed, each must be HTTPS in production)
- Scopes requested (displayed to users during authorization)
- Logo (displayed on the consent screen)
- Webhook URL (optional, for app-level events)

**OAuth scopes available:**

```
learner:read              → Read learner profiles and progress
learner:write             → Update learner data
curriculum:read           → Read curriculum structure
assessments:read          → Read assessment results
assessments:write         → Create/update assessment results
lesson_plans:read         → Read lesson plans
lesson_plans:write        → Create/update lesson plans
ai:generate               → Use AI generation APIs
events:subscribe          → Subscribe to events
school:admin              → Administrative access to a school's data
```

### 4.6 API Key Security in Documentation

Every page in the documentation that shows an API key uses the placeholder `enx_test_sk_YOUR_KEY_HERE`. The platform detects when a developer pastes a real key into a documentation code example and shows a warning banner: "This looks like a real API key. Remove it from this page."

The documentation never shows a real key, ever.

### 4.7 Data Model

```sql
-- API keys table
CREATE TABLE developer_api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developers(id),
  name            text NOT NULL,
  key_hash        text NOT NULL UNIQUE,  -- bcrypt hash, never store plaintext
  key_prefix      text NOT NULL,         -- first 12 chars for identification
  key_type        text NOT NULL CHECK (key_type IN ('live_secret', 'test_secret', 'live_publishable', 'test_publishable', 'restricted')),
  scopes          jsonb NOT NULL DEFAULT '[]',
  is_active       boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- OAuth applications
CREATE TABLE developer_oauth_apps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developers(id),
  name            text NOT NULL,
  client_id       text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  redirect_uris   text[] NOT NULL,
  scopes          text[] NOT NULL,
  homepage_url    text,
  logo_url        text,
  webhook_url     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### 4.8 Security Considerations

- API keys are hashed (bcrypt) before storage — the plaintext is never persisted after initial display
- Key lookups use the `key_prefix` to find candidates, then bcrypt compare — prevents timing attacks
- Rate limiting is applied per key, not per developer account — allows fine-grained control
- Suspicious key usage (geographic anomaly, sudden traffic spike) triggers an email alert
- Keys generated on the server side using `crypto.randomBytes(32)` — never on the client
- All key operations (create, roll, delete) are audit logged with actor, timestamp, and IP
- mTLS certificates for enterprise integrations are issued and rotated by the platform's PKI service

---

## 5. Interactive API Documentation

### 5.1 Purpose

The API reference is the most visited surface on any developer platform. It must be fast, searchable, accurate, and interactive. A developer should be able to understand, test, and copy-implement any API call without leaving the reference page.

### 5.2 Architecture

**Documentation source:**
- OpenAPI 3.1 spec as the single source of truth
- Hand-edited enrichments layered on top of the auto-generated spec via a sidecar JSON file
- The spec is version-controlled in the same monorepo as the API code
- CI/CD validates that the spec matches the deployed API on every PR

**Rendering engine:**
A custom renderer built on top of the raw OpenAPI spec. Not Swagger UI, not Redoc (both are inflexible and produce generic-looking output that signals "we didn't care about DX"). Custom rendering allows:
- Our exact visual design
- Embedded interactive examples
- Contextual educational notes
- Cross-linking to related guides and SDK methods

### 5.3 Page Structure for Each API Endpoint

```
[Endpoint title]           [Method badge: GET/POST/PUT/DELETE]   [Endpoint path]

[One-paragraph description — what this endpoint does in plain English]

[Educational context box — when relevant, explains the curriculum or pedagogical
concept behind the data. e.g., "A strand is the top-level organizing unit of
CBC curriculum. Each subject has 2–6 strands..."]

Authentication: Bearer token required. Scopes: curriculum:read

Parameters
──────────────────────────────────────────────────────
Path parameters:
  grade_id     integer    required    CBC grade (7–12)

Query parameters:
  subject      string     optional    Filter by subject name
  include      string[]   optional    Related resources to include: ['strands', 'outcomes']
  limit        integer    optional    Default: 20, max: 100
  cursor       string     optional    Pagination cursor from previous response

Request headers:
  Authorization  string   required    Bearer {api_key}

Request body: [For POST/PUT endpoints]
  [Interactive JSON editor with schema validation and live type hints]

Try it
──────────────────────────────────────────────────────
[API key selector — shows "Use test key" or user's key if signed in]
[Parameter input fields auto-generated from the schema]
[Send →] button

Response
[Tabbed: 200 OK | 400 Bad Request | 401 Unauthorized | 404 Not Found | 429 Too Many Requests]
[Syntax-highlighted JSON with field descriptions on hover]

Code examples
──────────────────────────────────────────────────────
[Tabs: cURL | JavaScript | Python | Go | Dart]
[Copyable, tested, working code for each language]

Response schema
──────────────────────────────────────────────────────
[Collapsible tree of all response fields with types and descriptions]

Related
──────────────────────────────────────────────────────
[3 curated links to related guides or endpoints]
```

### 5.4 The "Try It" Interactive Panel

The Try It panel is the highest-value feature of the API reference. Implementation requirements:

- Works without signing in (uses a shared demo key with rate-limited, read-only sandbox access)
- Signs-in state auto-populates the developer's own test key from the dashboard
- Inputs are validated client-side against the schema before sending (prevents pointless error roundtrips)
- The request is proxied through a `/api/proxy` endpoint on the docs site to avoid CORS issues and to inject the appropriate auth header without exposing keys in browser history
- Response is rendered with full JSON syntax highlighting
- Response time is shown: "Responded in 142ms"
- The full request (including headers) is shown in a collapsible "Request details" panel below the response, formatted as cURL
- A "Share" button generates a shareable URL that encodes the input parameters, so developers can link to a specific example

### 5.5 OpenAPI Spec Enrichment Format

The sidecar enrichment file (`api-enrichments.json`) adds fields the OpenAPI spec cannot express:

```json
{
  "paths": {
    "/v1/curriculum/grades/{grade_id}/strands": {
      "get": {
        "educational_context": "A strand is the top-level organizing unit...",
        "best_practices": [
          "Cache strand data — it changes only when KICD releases a new curriculum edition",
          "Use the include parameter to fetch outcomes in a single request"
        ],
        "common_errors": [
          {
            "code": "GRADE_NOT_FOUND",
            "description": "The grade_id must be between 7 and 12 for CBC Senior"
          }
        ],
        "changelog": [
          {
            "version": "v1.2",
            "change": "Added the include parameter for nested outcome fetching"
          }
        ],
        "related_guides": ["/docs/guides/curriculum/understanding-strands"],
        "sdk_examples": {
          "javascript": "edunexus.curriculum.strands.list({ gradeId: 7 })",
          "python": "edunexus.curriculum.strands.list(grade_id=7)"
        }
      }
    }
  }
}
```

### 5.6 API Versioning Display

Every endpoint clearly shows which version it belongs to and what changed between versions:

```
⚠ This endpoint changed in v1.2
  The response now includes competency_level. Applications using v1.1 will
  not receive this field. See the migration guide →
```

### 5.7 Error Reference Integration

Every error code that can be returned by an endpoint is hyperlinked to its entry in `/docs/errors`. The errors page has:
- The error code
- HTTP status
- Plain English description
- Common causes
- How to fix it
- A code example of how to handle it

This eliminates the "what does this error mean?" stack overflow search that kills developer momentum.

---

## 6. SDK Documentation

### 6.1 Purpose

SDKs are the primary interface for most developers. A developer who uses the JavaScript SDK never needs to know the raw HTTP API unless they hit an edge case. The SDK documentation must be complete, accurate, and mirror the quality of the SDK itself.

### 6.2 Officially Supported SDKs

| SDK | Target | Maturity |
|-----|--------|----------|
| `@edunexus/sdk` (JavaScript/TypeScript) | Web, Node.js, Next.js | GA |
| `edunexus-python` | Data science, backend | GA |
| `edunexus_dart` | Flutter mobile apps | GA |
| `edunexus-go` | Backend services, EMIS | GA |

### 6.3 SDK Documentation Structure (per language)

```
/docs/sdks/javascript
├── Installation
├── Configuration
├── Authentication
├── Curriculum
│   ├── List grades
│   ├── List strands
│   ├── List sub-strands
│   └── Get learning outcomes
├── Learners
│   ├── Get learner profile
│   ├── Update learner data
│   └── Get progress
├── Assessments
│   ├── Create assessment
│   ├── Submit results
│   └── Get report
├── AI
│   ├── Generate lesson plan
│   ├── Generate assessment
│   ├── Analyze learner
│   └── Generate report
├── Events
│   ├── Subscribe to webhook
│   └── Verify signature
├── Error handling
├── TypeScript types
├── Pagination utilities
├── Retry behavior
└── Changelog
```

### 6.4 Installation Section

**JavaScript:**
```bash
npm install @edunexus/sdk
# or
yarn add @edunexus/sdk
# or
pnpm add @edunexus/sdk
```

**Python:**
```bash
pip install edunexus
# or
poetry add edunexus
```

**Dart/Flutter:**
```yaml
# pubspec.yaml
dependencies:
  edunexus: ^1.0.0
```

**Go:**
```bash
go get github.com/edunexus/edunexus-go
```

### 6.5 Configuration Section

Every SDK has identical configuration concepts, expressed in the language's idioms:

**JavaScript:**
```typescript
import EduNexus from '@edunexus/sdk';

const edunexus = new EduNexus({
  apiKey: process.env.EDUNEXUS_API_KEY,
  environment: 'production',  // or 'sandbox'
  timeout: 30000,
  maxRetries: 3,
  onRequest: (req) => console.log(req),   // optional request hook
  onResponse: (res) => console.log(res),  // optional response hook
});
```

**Python:**
```python
from edunexus import EduNexus

client = EduNexus(
    api_key=os.environ.get("EDUNEXUS_API_KEY"),
    environment="production",
    timeout=30.0,
    max_retries=3,
)
```

### 6.6 SDK Design Principles

**Principle 1: Resource-method pattern**
All SDK methods follow the pattern `client.resource.action(params)`. Never flat functions. This makes the SDK self-documenting in any IDE with autocomplete.

```typescript
edunexus.curriculum.strands.list({ gradeId: 7 })
edunexus.learners.get({ learnerId: 'abc123' })
edunexus.ai.lessonPlans.generate({ subject: 'Math', grade: 7 })
```

**Principle 2: Typed parameters and responses**
Every method parameter and every response field is typed. The TypeScript SDK exports all types for use in user applications:

```typescript
import type { Learner, ProgressReport, LessonPlan } from '@edunexus/sdk';
```

**Principle 3: Consistent pagination**
All list methods return an `AsyncIterable` / generator that handles cursor pagination automatically:

```typescript
// Auto-handles pagination
for await (const learner of edunexus.learners.list({ schoolId: 'sch_123' })) {
  console.log(learner.name);
}

// Or manual page control
const page = await edunexus.learners.list({ schoolId: 'sch_123', limit: 20 });
const nextPage = await page.getNextPage();
```

**Principle 4: Consistent error handling**
All SDK errors extend `EduNexusError` with typed subclasses:

```typescript
try {
  const plan = await edunexus.ai.lessonPlans.generate(params);
} catch (error) {
  if (error instanceof EduNexus.APIError) {
    console.error(error.status);   // HTTP status
    console.error(error.code);     // EduNexus error code
    console.error(error.message);  // Human-readable message
  }
  if (error instanceof EduNexus.RateLimitError) {
    // Wait error.retryAfter seconds
  }
  if (error instanceof EduNexus.AuthenticationError) {
    // API key invalid or expired
  }
}
```

**Principle 5: Automatic retries with backoff**
The SDK retries transient errors (429, 503, network timeouts) with exponential backoff. This behavior is configurable and transparent — the developer can see retry attempts via the `onRequest` hook.

### 6.7 SDK Documentation Page Design

Each method in the SDK documentation has:
- Method signature with all parameter types
- Parameter table (name, type, required/optional, description, default)
- Return type and structure
- Working code example
- Common use cases (as collapsible sections)
- Link to the corresponding raw API endpoint
- Link to a playground example

### 6.8 SDK Source Code Quality Standards

For the documentation to be trustworthy, the SDK itself must meet these standards (enforced via CI):
- 100% TypeScript strict mode
- All public methods documented with JSDoc
- Integration test suite runs against the real sandbox API on every PR
- Bundle size budgets enforced — the JS SDK must not bloat a Next.js app
- The SDK source code is open source (MIT license) — developers can read the implementation

---

## 7. AI Playground and API Explorer

### 7.1 Purpose

The AI Playground is the highest-engagement surface on the developer platform. It lets developers experience the EduNexus AI APIs without writing a single line of code — and then shows them the code that would produce the same result. It is a sales tool, a learning tool, and a debugging tool simultaneously.

### 7.2 User Journey

```
Open playground (no login required for demo mode)
→ Select an AI endpoint from the sidebar
→ Fill in the input form
→ Click "Generate"
→ See the response rendered beautifully
→ Click "View code" to see the SDK call that produced it
→ Click "Try in your app" to copy the code
→ Sign up to unlock higher rate limits and save examples
```

### 7.3 Available Playground Modes

**Lesson Plan Generator**
Input form:
- Subject (dropdown populated from curriculum API)
- Grade (dropdown: 7–12)
- Strand (dynamically populated based on subject + grade)
- Sub-strand (dynamically populated based on strand)
- Duration (30 / 40 / 60 minutes)
- Class size
- Learner context (optional: "mix of English and Swahili learners", "many learners behind on multiplication")

Output: A fully formatted lesson plan with objectives, activities, differentiation strategies, and assessment rubric. Rendered as a structured document, not raw JSON.

**Assessment Generator**
Input form:
- Subject, grade, strand/sub-strand
- Assessment type: Formative / Summative / Diagnostic
- Number of questions
- Difficulty distribution

Output: A complete assessment with questions, answer key, and CBC-aligned marking rubric.

**Learner Analysis**
Input form: A pre-seeded example learner profile (sandbox data) or upload a JSON learner profile.
Output: AI-generated analysis of the learner's strengths, gaps, and recommended next steps.

**Progress Report Generator**
Input form: Example learner + term data.
Output: A narrative parent-facing report in formal English (and optionally Swahili).

**API Explorer**
A raw API explorer for any EduNexus endpoint. Not AI-specific. Allows:
- Select any API from a searchable list
- Fill in parameters
- Send the request
- See the response
- See the generated code

### 7.4 UI Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  EduNexus Playground                              [Sign in to save] │
├───────────────┬─────────────────────────────────────────────────────┤
│               │                                                     │
│  Endpoints    │  Lesson Plan Generator                              │
│  ──────────   │  ──────────────────────────────────────────────     │
│  ▸ AI APIs    │                                                     │
│    Lesson Plan│  Subject      [Mathematics        ▾]               │
│    Assessment │  Grade        [Grade 7            ▾]               │
│    Learner    │  Strand       [Numbers            ▾]               │
│    Report     │  Sub-strand   [Whole numbers      ▾]               │
│               │  Duration     [40 minutes         ▾]               │
│  ▸ Curriculum │  Class size   [35                    ]               │
│  ▸ Learners   │                                                     │
│  ▸ Assessment │  Learner context (optional):                        │
│  ▸ Events     │  [                                               ]  │
│               │                                                     │
│               │                            [Generate →]            │
│               │                                                     │
│               ├─────────────────────────────────────────────────────┤
│               │  Response                     [View code] [Copy]   │
│               │  ──────────────────────────────────────────────     │
│               │                                                     │
│               │  📋 Lesson Plan: Whole Numbers                      │
│               │  Grade 7 | Mathematics | 40 minutes                │
│               │                                                     │
│               │  Learning Objectives                                │
│               │  • By the end of this lesson, learners will be     │
│               │    able to identify place values up to millions     │
│               │  • ...                                              │
│               │                                                     │
│               │  [Full rendered plan continues...]                  │
│               │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

### 7.5 "View Code" Panel

When the developer clicks "View code", a drawer slides in from the right (or a tab below the response reveals) showing the exact SDK code that produced this result:

```typescript
// JavaScript
import EduNexus from '@edunexus/sdk';

const edunexus = new EduNexus({ apiKey: 'enx_test_sk_YOUR_KEY_HERE' });

const plan = await edunexus.ai.lessonPlans.generate({
  subject: 'Mathematics',
  grade: 7,
  strand: 'Numbers',
  subStrand: 'Whole numbers',
  duration: 40,
  learnerCount: 35,
});
```

Language tabs: JavaScript | Python | cURL | Go | Dart. One-click copy for each.

### 7.6 Saved Examples

Signed-in developers can:
- Save a playground configuration with a name
- Share a configuration via URL (the URL encodes all inputs)
- See their history of playground runs
- Export a response as JSON or PDF

### 7.7 Backend Architecture

- Playground requests proxied through `developers.edunexus.co.ke/api/playground`
- Anonymous users get a shared playground API key with rate limiting: 10 requests/hour
- Signed-in users on free plan: 100 requests/hour with their own test key
- Paid plans: unlimited playground requests
- Playground calls are logged for analytics but marked as `source: playground` and excluded from billing
- Response streaming: AI responses are streamed using SSE so the developer sees text appearing in real time, which is more impressive and accurate to the actual product behavior

---

## 8. Educational Knowledge Graph Explorer

### 8.1 Purpose

The Educational Knowledge Graph (EKG) is one of EduNexus's most powerful and differentiating assets. The EKG Explorer makes it tangible and explorable — a visual, interactive interface to the entire CBC, 8-4-4, and IGCSE curriculum structures and their interconnections.

For developers, the EKG Explorer serves three functions:
1. **Discovery:** Understand what curriculum data is available and how it is structured
2. **Debugging:** Trace why a learner was assigned a particular remediation pathway
3. **Integration design:** Plan how to integrate curriculum data into their application

### 8.2 Visual Graph Interface

**Technology:** A force-directed graph using D3.js or Cytoscape.js, with a custom rendering layer for educational node types.

**Node types (visually distinct by color and shape):**
- Curriculum system (CBC, 8-4-4, IGCSE) — large circle, dark teal
- Subject — medium circle, blue
- Strand — medium circle, purple
- Sub-strand — small circle, indigo
- Learning outcome — small square, orange
- Performance indicator — tiny square, amber
- Competency — diamond, green
- Learner profile node — circle with user icon, red (only in debug mode)

**Edge types:**
- `has_strand` (subject → strand)
- `has_sub_strand` (strand → sub-strand)
- `has_outcome` (sub-strand → learning outcome)
- `indicates` (outcome → performance indicator)
- `develops` (activity → competency)
- `prerequisites` (outcome → outcome, across subjects)
- `assessed_by` (outcome → assessment type)

### 8.3 Explorer UI Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  Knowledge Graph Explorer                          [Export] [API →]  │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                    │
│  Filters         │                    [Graph viewport]               │
│  ──────────      │                                                    │
│  System          │          ○ CBC                                    │
│  [CBC      ▾]   │        ╱   ╲                                      │
│                  │      ○       ○ 8-4-4                              │
│  Grade           │   Maths   Science                                 │
│  [Grade 7  ▾]   │    │         │                                     │
│                  │    ○ Numbers ○ Living...                          │
│  Subject         │    │                                              │
│  [All      ▾]   │    ○ Whole #s                                     │
│                  │    │                                              │
│  Show:           │    ○ [outcome]                                   │
│  ✓ Outcomes      │                                                    │
│  ✓ Indicators    │                                                    │
│  □ Prerequisites │                                                    │
│  □ Competencies  │                                                    │
│                  │                                                    │
│  Search nodes    │  [Zoom in +] [Zoom out -] [Reset] [Full screen]  │
│  [__________]   │                                                    │
├──────────────────┴───────────────────────────────────────────────────┤
│  Selected: Sub-strand — Whole Numbers (Grade 7, Mathematics)         │
│  ID: ss_math_g7_numbers_whole    API: GET /v1/curriculum/sub-strands/ss_math_g7_numbers_whole  │
│  Learning outcomes: 4    Performance indicators: 12    Prerequisites: 2                        │
│                                          [View in API →] [Try query →]                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4 Graph Query Interface

Beyond the visual explorer, power users (researchers, architects) need a query interface. We implement a simplified graph query language:

```graphql
# Find all learning outcomes that are prerequisites for
# "Solve linear equations" in Grade 9 Mathematics

MATCH (outcome:LearningOutcome {name: "Solve linear equations"})
      <-[:PREREQUISITE]-(prereq:LearningOutcome)
RETURN prereq.name, prereq.grade, prereq.subject
```

The query interface is a code editor (Monaco) with:
- Syntax highlighting for the query language
- Autocomplete for node types and relationship types
- Query history
- Export results as JSON or CSV

### 8.5 Learner Debug Mode

When a developer is debugging why their application recommended a specific intervention for a learner, they can enter a learner ID (from their sandbox environment) and the graph will highlight:
- Which nodes the learner has mastered (green)
- Which nodes the learner is working on (yellow)
- Which nodes are identified as gaps (red)
- The recommended next pathway (animated arrows)

This makes the AI's recommendations auditable and explainable.

### 8.6 API Integration

Every selected node in the explorer shows the corresponding API endpoint. One click on "Try in API Explorer" opens the API Explorer pre-populated with that node's data. This creates a tight loop between visual exploration and API integration.

```
Selected node: Strand — Numbers (Grade 7, Mathematics)
API endpoint: GET /v1/curriculum/strands/str_math_g7_numbers
[Open in API Explorer →]
```

---

## 9. Event Explorer and Webhook Testing

### 9.1 Purpose

The event system is how applications stay synchronized with EduNexus in real time. A teacher saves a lesson plan — your app knows immediately. A learner completes an assessment — your app receives the event. Understanding and debugging the event system is critical for any integration developer.

### 9.2 Event Catalog

All EduNexus events follow a consistent naming scheme:
`{resource}.{action}` — for example:
- `learner.enrolled`
- `learner.progress_updated`
- `assessment.submitted`
- `assessment.graded`
- `lesson_plan.created`
- `lesson_plan.published`
- `school.teacher_added`
- `payment.completed`
- `token.balance_updated`

**Event payload structure (consistent across all events):**

```json
{
  "id": "evt_01J2N4X5Y6Z7A8B9C0",
  "type": "learner.progress_updated",
  "version": "1.0",
  "created_at": "2026-06-30T14:23:45Z",
  "livemode": true,
  "data": {
    "object": {
      "id": "lrn_01J2N4X5Y6Z7",
      "name": "Amina Wanjiku",
      "grade": 7,
      "school_id": "sch_01K3M5N6O7P8",
      "progress": { ... }
    },
    "previous": {
      "competency_level": "approaching"
    }
  },
  "metadata": {
    "school_id": "sch_01K3M5N6O7P8",
    "triggered_by": "assessment_submission"
  }
}
```

### 9.3 Event Explorer UI

**Location:** `/events`

**Purpose:** Browse all event types, see their schemas, view historical events (sandbox), and replay events to test webhook handlers.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Event Explorer                                    [Your webhooks →] │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                    │
│  Event types     │  learner.progress_updated                         │
│  ──────────      │                                                    │
│  ▸ Learner       │  Fired when a learner's competency level          │
│    enrolled      │  changes in any strand or sub-strand.             │
│    progress_up.. │                                                    │
│    transferred   │  Payload schema                                   │
│                  │  ─────────────────────────────────────────        │
│  ▸ Assessment    │  {                                                │
│    submitted     │    "id": "evt_...",                               │
│    graded        │    "type": "learner.progress_updated",            │
│    returned      │    "data": {                                      │
│                  │      "object": {                                  │
│  ▸ Lesson Plan   │        "id": "lrn_...",              ← learner   │
│    created       │        "progress": { ... }           ← delta     │
│    published     │      },                                           │
│    archived      │      "previous": { ... }             ← old state │
│                  │    }                                              │
│  ▸ School        │  }                                                │
│  ▸ Payment       │                                                   │
│  ▸ Token         │  [View full schema]  [Test this event →]         │
│                  │                                                    │
│                  │  Recent events (sandbox)                          │
│                  │  ─────────────────────────────────                │
│                  │  evt_01J2N  14:23:45  learner.progress_updated    │
│                  │  evt_01J2M  14:21:12  assessment.submitted        │
│                  │  evt_01J2L  14:18:03  lesson_plan.created         │
│                  │                            [View all →]          │
└──────────────────┴───────────────────────────────────────────────────┘
```

### 9.4 Webhook Testing Tools

**Location:** `/dashboard/webhooks`

**Creating a webhook:**
- Name
- Endpoint URL (must be HTTPS)
- Events to subscribe to (multi-select from the event catalog)
- Active/paused toggle

**Testing a webhook:**
The dashboard provides a "Send test event" button for each registered webhook. The developer selects an event type, optionally edits the payload, and clicks send. The dashboard shows:
- The request headers (including `Edunexus-Signature`)
- The request body
- The response status and body from the developer's endpoint
- Latency

**Webhook logs:**
For each webhook endpoint, a log of the last 30 days of deliveries:
- Event ID
- Event type
- Delivery timestamp
- HTTP status returned by the endpoint
- Latency
- Response body (truncated)
- "Replay" button to resend the exact event

**Local testing with the CLI:**
```bash
# Forward webhook events to a local development server
edunexus listen --forward-to localhost:3000/webhooks/edunexus

# Filter to specific events
edunexus listen --events learner.progress_updated,assessment.submitted \
  --forward-to localhost:3000/webhooks/edunexus
```

### 9.5 Signature Verification Documentation

Every webhook delivery includes an `Edunexus-Signature` header. The documentation includes a complete verification implementation for every supported language:

**JavaScript:**
```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSig = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expectedSig}` === signature;
}
```

**Python:**
```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

The documentation explains *why* we use `compare_digest` / a timing-safe comparison — preventing timing attacks. This level of explanation is what distinguishes excellent security documentation from mediocre documentation.

---

## 10. Marketplace Documentation

### 10.1 Purpose

The EduNexus Marketplace is where the ecosystem of third-party applications, integrations, and tools lives. Marketplace documentation serves two audiences: developers who want to find and use marketplace apps, and developers who want to publish apps to the marketplace.

### 10.2 Marketplace Structure

**Categories:**
- Learning Tools (tutoring, study aids, flashcards)
- Parent Communication (progress reports, attendance alerts)
- Assessment (quiz builders, rubric tools, exam prep)
- School Management (EMIS integrations, timetabling, records)
- Teacher Tools (lesson planning, curriculum browsers, resource libraries)
- Analytics (school dashboards, LEA reporting, research tools)
- Accessibility (tools for learners with special needs)

**App types:**
- **Embedded apps:** Appear within the EduNexus teacher/student/parent dashboard via an iframe or web component
- **Integration apps:** Connect EduNexus to external systems (Google Classroom, Microsoft Teams, EMIS)
- **AI extensions:** Add custom AI capabilities (custom assessment engines, specialized tutoring)
- **Webhook consumers:** Listen to EduNexus events and act on them (push notifications, third-party sync)

### 10.3 Listing Page Structure

Each marketplace listing shows:
- App name and logo
- Short description (160 characters)
- Long description with screenshots
- App type badge
- Rating (1–5 stars, minimum 10 reviews before rating is shown)
- Number of installs
- Developer name and verification badge
- Pricing (Free / Free trial + paid / Paid / Per-school)
- Permissions requested (clear list of OAuth scopes)
- Support contact
- Last updated
- Compatible EduNexus plan tiers
- [Install] button

### 10.4 Publisher Documentation Structure

```
/docs/marketplace
├── Overview
│   └── What is the marketplace?
├── Getting started
│   ├── Developer account verification
│   ├── App manifest format
│   └── Development environment setup
├── App types
│   ├── Embedded apps
│   ├── Integration apps
│   ├── AI extensions
│   └── Webhook consumer apps
├── Building your app
│   ├── OAuth integration
│   ├── Embedding guidelines
│   ├── Event subscriptions
│   ├── AI extension API
│   └── Testing your app
├── Submission and review
│   ├── Submission checklist
│   ├── Review process
│   ├── Common rejection reasons
│   └── Appeals process
├── Distribution
│   ├── Pricing models
│   ├── Revenue sharing
│   └── Partner agreement
└── Maintaining your app
    ├── Version updates
    ├── Deprecation policy
    └── Support requirements
```

### 10.5 App Manifest Format

Every marketplace app is described by a manifest file (`edunexus-app.json`):

```json
{
  "name": "SmartParent",
  "slug": "smartparent",
  "version": "2.1.0",
  "description": "Real-time CBC progress updates for parents via WhatsApp and SMS",
  "type": "webhook_consumer",
  "developer": {
    "name": "EduTech Kenya Ltd",
    "email": "support@edutechkenya.co.ke",
    "website": "https://smartparent.co.ke"
  },
  "scopes": [
    "learner:read",
    "assessments:read",
    "events:subscribe"
  ],
  "events": [
    "learner.progress_updated",
    "assessment.graded",
    "lesson_plan.published"
  ],
  "webhook_url": "https://api.smartparent.co.ke/webhooks/edunexus",
  "oauth_redirect_uri": "https://smartparent.co.ke/auth/edunexus/callback",
  "pricing": {
    "model": "per_school",
    "plans": [
      { "name": "Starter", "price_kes": 500, "period": "monthly", "schools": 1 },
      { "name": "Growth", "price_kes": 1500, "period": "monthly", "schools": 5 }
    ]
  },
  "screenshots": [
    "https://cdn.smartparent.co.ke/screenshots/1.png"
  ],
  "support_url": "https://smartparent.co.ke/support",
  "privacy_url": "https://smartparent.co.ke/privacy",
  "terms_url": "https://smartparent.co.ke/terms"
}
```

### 10.6 Review Process Documentation

The review process must be documented with complete transparency so developers know what to expect:

**Automated checks (instant):**
- Manifest schema validation
- URL reachability checks
- OAuth callback URL validation
- Scope request validation (no requesting scopes not needed for stated functionality)

**Security review (1–3 business days):**
- A member of the EduNexus security team tests the app in a sandbox environment
- Checks for: data exfiltration, excessive scope usage, insecure storage of EduNexus data, injection vulnerabilities in any rendered content

**Content review (1–3 business days):**
- Screenshots match actual functionality
- Description is accurate
- Privacy policy covers all data collected
- Support contact is responsive (test email sent)

**Total time target:** 5 business days from submission to decision.

**Common rejection reasons (with fixes documented):**
- "Requesting `school:admin` scope but your app only reads learner data" → remove the scope
- "Privacy policy does not mention CBC assessment data" → update privacy policy
- "App crashes when learner has no assessment history" → handle the empty state

---

## 11. Plugin Development Portal

### 11.1 Purpose

Plugins are deeper integrations than marketplace apps. They extend EduNexus's core capabilities: new curriculum systems, new AI models, new assessment engines, new output formats. A plugin is trusted, versioned code that runs within the EduNexus execution environment.

The plugin development portal provides everything a developer needs to build, test, and publish a plugin.

### 11.2 Plugin Types

**Curriculum plugins:** Add a new curriculum system to the EKG. Example: an IGCSE plugin that maps Cambridge curriculum into EduNexus's strand/sub-strand/outcome hierarchy.

**AI model plugins:** Substitute or augment the EduNexus AI layer with a custom model. Example: a Swahili-optimized language model for East African learners.

**Assessment engine plugins:** Add a new assessment type. Example: a portfolio assessment engine, an oral examination scoring tool.

**Report format plugins:** Add new output formats for reports and lesson plans. Example: PDF with a school's branding, PowerPoint export, government EMIS report format.

**Integration plugins:** Deep integrations with external systems that require access to internal EduNexus APIs not available via the public REST API.

### 11.3 Plugin SDK

Plugins are written in TypeScript and deployed as sandboxed edge functions. The plugin SDK provides:

```typescript
import { definePlugin, PluginContext } from '@edunexus/plugin-sdk';

export default definePlugin({
  name: 'igcse-curriculum',
  version: '1.0.0',
  type: 'curriculum',

  // Called when the plugin is installed on a school
  onInstall: async (ctx: PluginContext) => {
    await ctx.curriculum.registerSystem({
      name: 'IGCSE',
      grades: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
      subjects: igcseSubjects,
    });
  },

  // Extend the curriculum graph
  extendGraph: async (ctx: PluginContext) => {
    return {
      nodes: igcseNodes,
      edges: igcseEdges,
    };
  },
});
```

### 11.4 Plugin Development Environment

The plugin portal provides:

**Local development:**
```bash
# Install the plugin CLI
npm install -g @edunexus/plugin-cli

# Create a new plugin from a template
edunexus-plugin init my-plugin --type curriculum

# Start local development server (mounts your plugin into a local EduNexus sandbox)
edunexus-plugin dev

# Run plugin tests
edunexus-plugin test

# Build for deployment
edunexus-plugin build
```

**Plugin sandbox:**
A dedicated sandbox environment where the plugin runs against real EduNexus core APIs. The developer can see all logs, errors, and performance metrics in real time.

**Plugin inspector:**
A UI tool that shows:
- All API calls made by the plugin in the last 24 hours
- CPU and memory usage per invocation
- Error rate and error details
- Side effects produced (curriculum nodes added, assessments created, etc.)

### 11.5 Plugin Manifest

```json
{
  "name": "igcse-curriculum",
  "version": "1.0.0",
  "type": "curriculum",
  "entry": "dist/index.js",
  "permissions": [
    "curriculum:write",
    "graph:extend"
  ],
  "resources": {
    "memory_mb": 128,
    "timeout_ms": 30000
  },
  "compatibility": {
    "edunexus_min_version": "2.0.0"
  }
}
```

### 11.6 Plugin Security Model

Plugins run in a strict sandbox:
- V8 isolates with no filesystem access
- Network access only to explicitly declared external URLs
- Memory and CPU limits enforced at the runtime level
- All plugin calls are audited
- Plugins cannot access data from schools that have not explicitly installed them
- Plugin code is reviewed by the EduNexus security team before publication

---

## 12. CLI Documentation

### 12.1 Purpose

The EduNexus CLI is the developer's workbench. It provides everything needed for local development, testing, deployment, and operations — without opening a browser.

### 12.2 Installation

```bash
# macOS / Linux (via curl installer)
curl -fsSL https://cli.edunexus.co.ke/install.sh | bash

# macOS (via Homebrew)
brew install edunexus/tap/edunexus

# Windows (via Scoop)
scoop bucket add edunexus https://github.com/edunexus/scoop-bucket
scoop install edunexus

# npm (cross-platform)
npm install -g @edunexus/cli

# Verify installation
edunexus --version
```

### 12.3 Authentication

```bash
# Interactive login (opens browser)
edunexus login

# CI/CD environments (use env var)
export EDUNEXUS_API_KEY=enx_test_sk_xxx
edunexus whoami  # verify the key works
```

### 12.4 Command Reference

**Full command structure:**

```
edunexus <command> [subcommand] [flags]

Global flags:
  --api-key    Override the API key for this command
  --env        Environment: production | sandbox (default: sandbox)
  --format     Output format: json | table | yaml (default: table)
  --no-color   Disable colored output
  --debug      Show HTTP request/response details

Commands:
  login           Authenticate with EduNexus
  logout          Clear stored credentials
  whoami          Show current authenticated user

  curriculum      Curriculum data commands
    list grades   List all grades
    list strands  List strands for a grade and subject
    get outcome   Get a learning outcome

  learners        Learner data commands
    list          List learners in a school
    get           Get a specific learner's profile
    progress      Show a learner's competency progress

  ai              AI generation commands
    generate lesson-plan    Generate a lesson plan
    generate assessment     Generate an assessment
    generate report         Generate a progress report

  events          Event system commands
    list          List recent events
    inspect       Inspect a specific event

  listen          Forward webhook events to a local server
    --forward-to  Local URL to forward events to
    --events      Comma-separated event types to filter

  keys            API key management
    list          List your API keys
    create        Create a new API key
    roll          Roll (regenerate) a key
    delete        Delete a key

  logs            Request and error logs
    list          List recent API requests
    errors        List recent errors

  plugin          Plugin development commands
    init          Create a new plugin project
    dev           Start local development server
    test          Run plugin tests
    build         Build plugin for deployment
    deploy        Deploy plugin to sandbox
    publish       Submit plugin for review

  config          CLI configuration
    set           Set a configuration value
    get           Get a configuration value
    list          List all configuration
```

### 12.5 Most Common CLI Workflows

**Local webhook development:**
```bash
# Terminal 1: Start your local app
npm run dev

# Terminal 2: Forward EduNexus events to it
edunexus listen --forward-to http://localhost:3000/api/webhooks/edunexus \
  --events learner.progress_updated,assessment.submitted

# The CLI shows each event as it arrives:
# ← learner.progress_updated [evt_01J2N...] ✓ 200 (142ms)
# ← assessment.submitted     [evt_01J2M...] ✓ 200 (89ms)
```

**Quick curriculum exploration:**
```bash
# See what strands exist for Grade 7 Mathematics
edunexus curriculum list strands --grade 7 --subject Mathematics

# Output (table format):
# ID                          NAME           OUTCOMES
# str_math_g7_numbers         Numbers        12
# str_math_g7_algebra         Algebra        8
# str_math_g7_geometry        Geometry       10
```

**Generate a test lesson plan from the CLI:**
```bash
edunexus ai generate lesson-plan \
  --subject Mathematics \
  --grade 7 \
  --strand Numbers \
  --duration 40 \
  --output lesson-plan.json
```

### 12.6 CI/CD Integration

Documentation for using the CLI in CI/CD pipelines (GitHub Actions, Bitbucket Pipelines):

```yaml
# .github/workflows/test.yml
- name: Test EduNexus webhook handler
  env:
    EDUNEXUS_API_KEY: ${{ secrets.EDUNEXUS_TEST_KEY }}
  run: |
    # Start the app in background
    npm start &
    APP_PID=$!

    # Send a test webhook event
    edunexus events send learner.progress_updated \
      --data-file test/fixtures/progress_event.json \
      --to http://localhost:3000/api/webhooks/edunexus \
      --expect-status 200

    kill $APP_PID
```

---

## 13. Quickstart Guides

### 13.1 Purpose

Quickstart guides are the most important content on the developer platform. They must get a developer from zero to a working, meaningful application in under 10 minutes. Not a stub. Not a hello world. A real, deployable application.

### 13.2 Quickstart Philosophy

**Rule 1: Start with the finished product**
Every quickstart opens with a screenshot or video of what will be built. The developer knows exactly what they are working toward before they write a single line of code.

**Rule 2: Assume nothing**
The guide assumes the developer has never heard of EduNexus. It does not assume they know CBC. It does not assume they know what a strand is. Every educational term is explained inline, briefly, the first time it appears.

**Rule 3: Every step is independently runnable**
At the end of each step, the developer has a running system. They are not accumulating a pile of code that only works at the end.

**Rule 4: Copy-pasteable code**
Every code block is complete. No `// ... rest of your code here`. No `import ...`. The complete, working code is shown.

**Rule 5: Test on the day of publication**
Every quickstart is run end-to-end on the day it is published. The CI pipeline runs every quickstart once per week and alerts if any step fails.

### 13.3 Available Quickstart Guides

**1. Lesson Plan Generator (15 minutes)**
Build a web app that lets a teacher enter their subject and grade and receive a complete CBC-aligned lesson plan in seconds.

Tech options: Next.js | React | Vanilla HTML | Python/Flask

**2. Parent Progress Dashboard (20 minutes)**
Build a read-only dashboard that shows a parent their child's competency progress across all CBC strands for the current term.

Tech options: Next.js | React Native | Flutter

**3. AI Tutoring Assistant (25 minutes)**
Build a chat interface that answers curriculum questions and suggests practice activities aligned to the learner's current level.

Tech options: Next.js with streaming | Python/FastAPI

**4. School Analytics Dashboard (30 minutes)**
Build an admin dashboard showing aggregated performance across all classes in a school, with breakdowns by strand and competency level.

Tech options: Next.js | Python/Streamlit

**5. Webhook Integration (10 minutes)**
Build a webhook handler that receives EduNexus events and stores them in your own database.

Tech options: Node.js/Express | Python/FastAPI | Go

**6. CBC-Aware Assessment Builder (30 minutes)**
Build a tool that generates formative assessments for any CBC learning outcome, with a marking rubric.

Tech options: Next.js | React

**7. Flutter Mobile App (30 minutes)**
Build a mobile app for students with lesson content, progress tracking, and AI-powered practice questions.

Tech options: Flutter (Dart)

**8. EMIS Integration (45 minutes)**
Connect a school management system to EduNexus to sync learner enrollment data and receive progress events.

Tech options: Node.js | Python | Go

### 13.4 Quickstart Structure (Template)

Every quickstart follows this exact structure:

```markdown
# [Build: What you'll build in one line]

**Time:** ~X minutes | **Difficulty:** Beginner | **Stack:** Next.js, TypeScript

## What you'll build

[Screenshot or animated GIF of the finished app]

[2 sentences describing what the app does and who would use it]

## Prerequisites

- Node.js 18+ installed
- An EduNexus account (free) — [sign up here](...)
- A sandbox API key — [get one in 30 seconds](...)

## Step 1: Set up the project

[Exact commands, zero ambiguity]

## Step 2: Make your first API call

[Code with explanation. Show the output.]

## Step 3: [...]

## Step N: Deploy (optional)

[One-click deploy to Vercel / Render / Railway]

## What's next?

- [Related guide 1]
- [Related guide 2]
- [Join the community]
```

---

## 14. Architecture Diagrams and Visualizations

### 14.1 Purpose

Architecture diagrams help developers understand how the platform fits together — where their application sits relative to EduNexus's components, how data flows, how the event system works. Bad diagrams are abstract boxes. Good diagrams tell a story.

### 14.2 Diagram Standards

**Format:** SVG, embedded in documentation pages. Not raster images — SVG scales perfectly on all screens and can be themed.

**Tooling:** Diagrams are authored in code (Mermaid or D3), not in visual tools. This ensures they are version-controlled, diffable, and updateable without special software.

**Theme:** Diagrams match the platform's visual design system — same colors, same font, same corner radius. They feel like part of the documentation, not a screenshot from a presentation.

**Accessibility:** Every diagram has an `alt` text and a text-based description below it for screen readers.

### 14.3 Required Diagrams

**1. Platform Overview Diagram**
Shows the EduNexus platform layers and where developer applications connect:

```
[Your Application]
       ↕ REST API / WebSocket
[EduNexus API Gateway]
  ├── Curriculum Service ←→ [Educational Knowledge Graph]
  ├── Learner Service    ←→ [Learner Database]
  ├── Assessment Service ←→ [Assessment Engine]
  ├── AI Service         ←→ [DeepSeek / Custom Models]
  └── Event Service      →  [Your Webhook Endpoint]
```

**2. Authentication Flow Diagram**
Step-by-step OAuth 2.0 flow between the developer's application, the user's browser, and EduNexus.

**3. Event System Diagram**
Shows how actions in the EduNexus platform generate events, how events flow through the event bus, and how they reach webhook endpoints.

**4. Curriculum Hierarchy Diagram**
A visual tree showing the relationship between Curriculum System → Subject → Strand → Sub-strand → Learning Outcome → Performance Indicator.

**5. Learner Data Model Diagram**
Entity-relationship diagram showing how learner profiles, assessments, progress records, and school enrollment relate.

**6. Plugin Architecture Diagram**
Shows how plugins extend the EduNexus core, what interfaces they implement, and how they are isolated from each other.

### 14.4 Interactive Diagrams

For complex flows (the event system, the OAuth flow), the documentation provides an animated, step-by-step version where the developer can click "Next step" to see each step highlighted and explained.

This is more effective than a static diagram for developers who are unfamiliar with the pattern.

---

## 15. Code Examples and Sample Applications

### 15.1 Purpose

Sample applications are fully working, production-ready reference implementations that demonstrate best practices. They are not toys — they are the applications a developer would reasonably deploy, with proper error handling, proper authentication, proper loading states, and proper test coverage.

### 15.2 Official Sample Applications

**1. edunexus-next-starter**
A Next.js 15 app with TypeScript, EduNexus authentication, a teacher dashboard, and lesson plan generation. Deployable in one click to Vercel.

Demonstrates: OAuth flow, SDK usage, streaming AI responses, loading states, error handling.

**2. edunexus-parent-app**
A Next.js app for parents to view their children's CBC progress. Read-only API usage.

Demonstrates: Public key usage, read-only integration, mobile-responsive UI.

**3. edunexus-webhook-handler**
A Node.js/Express application that receives EduNexus webhooks, verifies signatures, processes events, and stores them in a PostgreSQL database.

Demonstrates: Webhook verification, idempotency, event processing patterns, database integration.

**4. edunexus-python-analysis**
A Python Jupyter notebook and a FastAPI application that pulls anonymized learner data from the EduNexus API and produces visualizations of competency distributions.

Demonstrates: Python SDK, bulk data patterns, pandas integration, visualization.

**5. edunexus-flutter-student**
A Flutter application for students with lesson content, practice questions, and progress tracking.

Demonstrates: Dart SDK, mobile authentication, offline caching, push notifications via EduNexus events.

**6. edunexus-go-emis-bridge**
A Go service that acts as a bridge between a school EMIS system and EduNexus, syncing enrollment data and forwarding events.

Demonstrates: Go SDK, event subscriptions, bulk operations, enterprise patterns.

### 15.3 Code Snippet Library

Beyond full applications, the documentation maintains a searchable library of individual code snippets covering every common task:

```
Curriculum:
- List all grades
- Get all strands for Grade 7 Mathematics
- Get learning outcomes for a specific sub-strand
- Search curriculum by keyword

Learners:
- Create a learner profile
- Get a learner's full progress report
- Bulk fetch learners by school
- Update a learner's competency level

AI:
- Generate a lesson plan (basic)
- Generate a lesson plan (with learner context)
- Generate a CBC-aligned assessment
- Stream a lesson plan response
- Generate a parent-facing narrative report
- Analyze a learner's strengths and gaps

Events:
- Verify a webhook signature
- Process a learner.progress_updated event
- Idempotently handle duplicate events
- Replay a failed event

Error Handling:
- Handle rate limit errors with backoff
- Handle authentication errors
- Handle network timeouts
- Display user-friendly error messages
```

Each snippet has: the code, the language selector, a "Copy" button, and a "Try in playground" link.

### 15.4 Code Quality Standards

All official code examples must:
- Pass TypeScript strict mode (for TypeScript examples)
- Pass linting (ESLint, Black, gofmt, dart format)
- Be covered by integration tests that run weekly in CI
- Handle errors explicitly — no unhandled promise rejections, no bare `try/catch` with empty catch blocks
- Use environment variables for API keys — never hardcode
- Include a comment explaining any non-obvious line

---

## 16. Versioning Strategy and Changelog

### 16.1 API Versioning Strategy

**Version format:** `/v{major}` in the URL path. Minor and patch versions are non-breaking and do not require a URL change.

**Breaking change definition:**
A breaking change is any change that would require a developer to modify their existing code to continue working. Examples:
- Removing a field from a response
- Changing a field's type
- Removing an endpoint
- Changing authentication requirements
- Changing pagination behavior

**Non-breaking changes (no version bump required):**
- Adding a new optional field to a response
- Adding a new optional query parameter
- Adding a new endpoint
- Performance improvements
- Bug fixes that make the API behave as documented

**Deprecation timeline:**
1. A feature is deprecated: `X-EduNexus-Deprecation` header added to responses, documentation updated with deprecation notice and migration guide
2. 90 days later: A final warning email is sent to all developers using the deprecated feature (identified via API key usage)
3. 90 days after that: The feature is removed

**Version lifespan:**
- Versions receive bug fixes and security patches for 2 years after the next major version is released
- Security patches only for 1 year after the end-of-life date

### 16.2 SDK Versioning

SDKs use semantic versioning (semver). The SDK major version tracks the API major version it targets. SDK 1.x targets API v1. SDK 2.x targets API v2.

### 16.3 Changelog Design

**Location:** `/docs/changelog`

**Structure:**
```
Changelog

Filter by: [All] [Breaking] [New Features] [Bug Fixes] [SDK] [Security]
Search: [______________]

─────────────────────────────────────────────────────────────────
v1.8.0 — June 30, 2026

  🆕 New: Learner batch progress endpoint
     GET /v1/learners/progress/batch now accepts up to 100 learner IDs
     in a single request.  See docs →

  🔧 Fix: Assessment submission timestamp now stored in UTC
     Previously, submissions from GMT+3 were stored with timezone offset.
     All new submissions use UTC. Existing data is unaffected.
     See migration note →

  📦 SDK: @edunexus/sdk v1.8.0 released
     Adds EduNexus.learners.progress.batch() method.
     npm install @edunexus/sdk@1.8.0

─────────────────────────────────────────────────────────────────
v1.7.2 — June 15, 2026
  ...
```

**RSS feed:** Available at `/docs/changelog/feed.xml` for developers who want to subscribe to updates.

**Email subscriptions:** Developers can opt in to changelog email notifications (filtered by severity: all changes, breaking changes only, security patches only).

---

## 17. Search Architecture and Discoverability

### 17.1 Purpose

Search is how developers find what they need when they do not know where to look. A slow or inaccurate search is a broken developer experience. The platform search must be fast (< 100ms), relevant, and comprehensive.

### 17.2 Search Architecture

**Technology:** Typesense (self-hosted, running in the same Kenyan infrastructure as EduNexus core) for primary search. Typesense is chosen over Algolia because:
- Data sovereignty: all search index data stays in Kenya
- No external dependency for a core user-facing feature
- Cost: no per-search pricing at scale
- Typo tolerance, faceting, and multi-index search built in

**Content indexed:**
- All documentation pages (title, headings, body text)
- All API endpoints (path, description, parameters)
- All error codes
- All SDK methods
- All event types
- All marketplace app listings
- All changelog entries

**Index update frequency:**
- Documentation: on every deploy (CI triggers a re-index)
- API spec: on every API deployment
- Marketplace: on every app submission or update

### 17.3 Search UI

**Trigger:** Cmd+K (Mac) / Ctrl+K (Windows/Linux) from anywhere on the developer platform. Also available via clicking the search icon in the header.

**Modal design:**

```
┌────────────────────────────────────────────────────────────┐
│  🔍  Search documentation...                    [Esc]      │
├────────────────────────────────────────────────────────────┤
│  Recent searches                                           │
│  • webhook signature verification                          │
│  • learner progress API                                    │
│                                                            │
│  Quick jump                                                │
│  [API Reference]  [Quickstarts]  [Changelog]  [Errors]    │
└────────────────────────────────────────────────────────────┘

[After typing "progress update":]

┌────────────────────────────────────────────────────────────┐
│  🔍  progress update                            [Esc]      │
├────────────────────────────────────────────────────────────┤
│  API Reference                                             │
│  → GET /v1/learners/{id}/progress                          │
│    Get a learner's full competency progress                │
│                                                            │
│  Events                                                    │
│  → learner.progress_updated                                │
│    Fired when a learner's competency level changes         │
│                                                            │
│  Guides                                                    │
│  → Understanding learner progress in CBC                   │
│    How the EduNexus competency model represents progress   │
│                                                            │
│  Code Examples                                             │
│  → Handle progress_updated webhook event                   │
└────────────────────────────────────────────────────────────┘
```

### 17.4 Search Quality Metrics

The platform tracks:
- **Zero results rate:** What searches return no results? These queries reveal documentation gaps.
- **Click-through rate by result position:** Are the most relevant results appearing first?
- **Search-to-completion rate:** After searching, do developers find what they need (measured by no follow-up search within 60 seconds)?
- **Most common searches:** What are developers looking for most? This informs content priorities.

These metrics are reviewed monthly by the DevRel team and feed directly into documentation improvement priorities.

---

## 18. Developer Dashboard and Usage Analytics

### 18.1 Purpose

The developer dashboard is the developer's home base. It gives them visibility into how their applications are using EduNexus APIs, where errors are occurring, and how to optimize their integration.

### 18.2 Dashboard Structure

**Location:** `/dashboard`

```
/dashboard              → Overview
/dashboard/keys         → API key management
/dashboard/apps         → OAuth app management
/dashboard/usage        → Usage analytics
/dashboard/logs         → Request logs
/dashboard/webhooks     → Webhook management
/dashboard/billing      → Plan and billing (if on a paid plan)
/dashboard/team         → Team members (organization accounts)
/dashboard/settings     → Account settings
```

### 18.3 Overview Page

The overview page shows the most important metrics at a glance:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Developer Dashboard                    [Environment: Sandbox ▾]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Last 7 days                                                        │
│  ──────────────────────────────────────────────                     │
│  API Requests        Error Rate        Avg Latency    Token Cost    │
│  12,847              0.3%              187ms          KES 234       │
│  ↑ 23% vs last week  ↓ healthy         ↑ 12ms        ↑ KES 45     │
│                                                                     │
│  Request volume [line chart, 7 days]                                │
│  [▁▂▃▄▅▆▇ bar chart showing daily requests]                        │
│                                                                     │
│  Top endpoints           Requests    Error rate                     │
│  GET /v1/learners/...    4,231       0.1%                           │
│  POST /v1/ai/lesson...   2,847       0.4%                           │
│  GET /v1/curriculum/...  1,923       0.0%                           │
│                                                                     │
│  Recent errors                                                      │
│  429 Too Many Requests   2 hours ago   [View →]                    │
│  404 Learner not found   5 hours ago   [View →]                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 18.4 Usage Analytics Page

**Filters:** Date range, API key, endpoint, HTTP status

**Visualizations:**
- Request volume over time (line chart)
- Requests by endpoint (bar chart)
- Error rate over time (line chart)
- Latency percentiles over time (p50, p95, p99)
- Requests by status code (pie chart)
- AI token usage over time (line chart with cost overlay)

**Export:** All data exportable as CSV for external analysis.

### 18.5 Request Logs

A searchable, filterable log of every API request:

```
Timestamp           Method  Endpoint                    Status  Latency  API Key
2026-06-30 14:23    POST    /v1/ai/lesson-plans/generate   200     847ms   Default
2026-06-30 14:21    GET     /v1/learners/lrn_01J2...       200     123ms   Default
2026-06-30 14:18    GET     /v1/curriculum/strands          429     12ms    Default
```

Clicking any log entry shows:
- Full request headers (API key masked)
- Request body
- Response body
- Response headers
- Latency breakdown (DNS, connection, first byte, total)

**Log retention:** 30 days for free tier, 90 days for paid tiers, unlimited for enterprise.

### 18.6 Data Model

```sql
-- Developer accounts
CREATE TABLE developers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  organization    text,
  plan_tier       text NOT NULL DEFAULT 'free',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- API request logs
CREATE TABLE api_request_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developers(id),
  api_key_id      uuid NOT NULL REFERENCES developer_api_keys(id),
  method          text NOT NULL,
  path            text NOT NULL,
  status          integer NOT NULL,
  latency_ms      integer NOT NULL,
  request_body    jsonb,
  response_body   jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Pre-aggregated usage metrics (for fast dashboard rendering)
CREATE TABLE developer_usage_hourly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developers(id),
  api_key_id      uuid REFERENCES developer_api_keys(id),
  hour            timestamptz NOT NULL,
  endpoint        text NOT NULL,
  method          text NOT NULL,
  total_requests  integer NOT NULL DEFAULT 0,
  error_requests  integer NOT NULL DEFAULT 0,
  total_latency_ms bigint NOT NULL DEFAULT 0,
  ai_tokens_used  integer NOT NULL DEFAULT 0,
  UNIQUE (developer_id, api_key_id, hour, endpoint, method)
);

-- Webhook deliveries
CREATE TABLE webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid NOT NULL REFERENCES developer_webhooks(id),
  event_id        text NOT NULL,
  event_type      text NOT NULL,
  status          integer,
  latency_ms      integer,
  request_body    jsonb NOT NULL,
  response_body   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## 19. Certification Portal Integration

### 19.1 Purpose

The EduNexus Developer Certification Program formally recognizes developers who have demonstrated proficiency in building on the EduNexus platform. Certification serves developers (credential for their resume, profile, and marketplace listings), EduNexus (quality signal for marketplace apps), and schools (confidence in certified integration partners).

### 19.2 Certification Tracks

**Track 1: EduNexus Developer Associate**
- Understands the EduNexus platform and API design
- Can build basic integrations using the REST API
- Can implement OAuth authentication for user-facing apps
- Can build and verify webhook handlers
- Exam: 60 questions, 90 minutes, passing score 75%

**Track 2: EduNexus Curriculum Integration Specialist**
- Deep understanding of the CBC curriculum data model
- Can design systems that use the Educational Knowledge Graph
- Can build curriculum-aware applications
- Exam + practical project: build a curriculum browser application meeting a specification

**Track 3: EduNexus AI Builder**
- Proficiency with all AI generation APIs
- Can design systems with appropriate token management and cost controls
- Can build streaming AI applications
- Understands AI safety considerations in educational contexts
- Exam + practical project

**Track 4: EduNexus Platform Architect**
- Enterprise-level integration patterns
- Event-driven architecture with EduNexus
- Multi-school, multi-tenant applications
- Security and compliance requirements
- Practical project: design review by the EduNexus platform team

### 19.3 Certification Portal UI

**Location:** `/certification`

```
┌─────────────────────────────────────────────────────────────────────┐
│  EduNexus Developer Certification                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Your certifications]  [Study]  [Take exam]  [Verify a cert]      │
│                                                                     │
│  Available Certifications                                           │
│  ─────────────────────────────────────────────────                  │
│                                                                     │
│  🎓 EduNexus Developer Associate                                    │
│     Foundation certification for EduNexus API integration          │
│     Prerequisites: None    Cost: Free                               │
│     [Study guide →] [Take exam →]                                  │
│                                                                     │
│  🎓 Curriculum Integration Specialist                               │
│     Deep certification for CBC curriculum integration               │
│     Prerequisites: Developer Associate    Cost: Free                │
│     [Study guide →] [Take exam →]                                  │
│                                                                     │
│  [AI Builder]  [Platform Architect]                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 19.4 Certification Integration with Developer Profile

On the developer's dashboard, their certifications are displayed with:
- Certificate name
- Date earned
- Expiry date (certifications expire after 2 years — the platform evolves rapidly)
- Shareable URL for the certificate (publicly verifiable)
- LinkedIn share button

### 19.5 Certification on Marketplace Listings

Marketplace app listings show a "Certified Developer" badge when the publisher holds at least the Associate certification. Listings from Platform Architects get a "Platform Certified" badge.

This creates a quality signal for schools evaluating which marketplace apps to trust.

---

## 20. Community, RFC Process, Issue Reporting, and Partner Onboarding

### 20.1 Community Hub

**Location:** `/community`

**Purpose:** Connect developers with each other and with the EduNexus team. Reduce support burden by enabling peer-to-peer help. Surface developer needs and feature requests.

**Platform choice:** A custom-embedded community forum (using Discourse, self-hosted in Kenya for data sovereignty) embedded within the developer platform. Not Discord alone — Discord is great for real-time chat but terrible for searchable knowledge. Not GitHub Discussions alone — too code-specific. Discourse provides searchable, categorized, SEO-indexed community knowledge.

**Supplementary channels:**
- Developer Slack workspace (real-time chat, announcements)
- GitHub Discussions (for SDK-specific technical issues)
- Twitter/X @EduNexusDev (announcements and highlights)

### 20.2 Forum Categories

```
📢 Announcements (EduNexus team only — posts here are pushed to Slack and email)
   └── Platform updates, API changes, new features

❓ Help & Support
   └── Questions about the API, SDK, documentation

💡 Show & Tell
   └── Share what you've built with EduNexus

🔌 Integrations
   └── Technical discussion about specific integration patterns

🤖 AI & Curriculum
   └── Questions and discussion about the AI APIs and EKG

🛒 Marketplace
   └── Discussion about publishing and discovering marketplace apps

🐛 Bug Reports
   └── Confirmed platform bugs (triaged from GitHub Issues)

🗳️ Feature Requests
   └── Request new features (linked to the RFC process for major requests)
```

### 20.3 RFC Process

The EduNexus Request for Comments (RFC) process is how major platform changes are discussed publicly before they are built. Modeled on the Rust RFC process and the TC39 proposal process.

**Why an RFC process?**
Because developers have built systems on our APIs, and major changes affect their systems. The RFC process:
- Gives developers advance warning of upcoming changes
- Allows the platform team to hear about integration impacts before building
- Creates a public record of why design decisions were made
- Builds community trust by demonstrating that developer input shapes the platform

**RFC stages:**

```
Idea → Draft RFC → Comment period (14 days minimum) → Accepted / Rejected / Withdrawn → Implemented
```

**RFC format:**

```markdown
# RFC-0042: Batch Learner Progress API

**Status:** Draft
**Author:** [EduNexus platform team or community member]
**Created:** 2026-06-30
**Discussion:** [link to forum thread]

## Summary
One paragraph explaining the proposal.

## Motivation
Why does this need to exist? What problem does it solve?

## Design
The proposed API design, including request/response format.

## Impact on existing integrations
What do developers need to change if this is adopted?

## Alternatives considered
What other approaches were evaluated and why were they rejected?

## Open questions
What is not yet decided?
```

**RFC location:** `/community/rfc` — a list of all RFCs with their status, linked to their GitHub PR (the canonical source of truth for the RFC text is a GitHub repository).

### 20.4 Issue Reporting

**Bug reports:** GitHub Issues on the `edunexus/developer-platform` repository. A bug report template ensures developers provide:
- SDK version
- API version
- Request that produced the issue (sanitized)
- Response received
- Expected behavior
- Steps to reproduce

**Security issues:** NOT GitHub Issues. A dedicated security contact (`security@edunexus.co.ke`) and a private security disclosure form at `/security`. The responsible disclosure policy is published and includes a 90-day disclosure timeline and a recognition program (Hall of Fame page).

**Documentation issues:** A "Was this page helpful? [Yes] [No]" widget at the bottom of every documentation page. "No" opens a small form: "What was wrong?" with options: "Code example doesn't work", "Information is missing", "Information is incorrect", "Page is confusing". These are filed to a private documentation issues tracker reviewed weekly by technical writers.

### 20.5 Partner Onboarding

**Location:** `/partners`

**Partner tiers:**

**Technology Partners:** Companies that have built integrations or marketplace apps. Benefits:
- "EduNexus Technology Partner" badge
- Co-marketing opportunities
- Early access to new API features
- Joint customer case studies
- Listing in the partner directory

**Reseller Partners:** Companies that sell EduNexus to schools. Benefits:
- Revenue share
- Partner pricing
- Sales training and certification
- Co-branded materials

**Research Partners:** Universities and research institutions studying educational AI and curriculum. Benefits:
- Access to anonymized research datasets (subject to ethics review)
- EduNexus data science team collaboration
- Publication co-authorship opportunities

**Government Partners:** Ministry of Education, county education offices, and similar. Benefits:
- Dedicated integration support team
- Direct API access at national scale
- Custom SLAs and data governance agreements
- Government-specific pricing

**Partner Application:** A form at `/partners/apply` collecting:
- Organization name and type
- Website
- Number of schools or users served
- Integration description
- Contact information
- Intended use of the EduNexus platform

Applications reviewed within 5 business days. Accepted partners are added to the partner directory and onboarded to the partner Slack channel.

---

## 21. Accessibility, Localization, and Mobile Experience

### 21.1 Accessibility

The developer platform must be accessible to developers with disabilities. This is not only the right thing to do — in Kenya, the Persons with Disabilities Act and international WCAG standards apply.

**WCAG 2.1 Level AA compliance is a non-negotiable requirement for every page.**

**Specific requirements:**

**Color contrast:** All text meets a 4.5:1 contrast ratio against its background. Code blocks meet 3:1. Colors are never the only way to convey information (e.g., error states use both color and an icon).

**Keyboard navigation:** Every interactive element is reachable and operable via keyboard. Tab order is logical. Focus state is visually obvious (not removed). All modals and dropdowns trap focus appropriately and release on Escape.

**Screen reader support:** Every image has `alt` text. Every icon button has an `aria-label`. Modals use `role="dialog"` and `aria-labelledby`. Code blocks have `role="region"` and `aria-label="Code example"`. The page structure uses semantic HTML (`<nav>`, `<main>`, `<article>`, `<aside>`).

**Reduced motion:** All animations respect `prefers-reduced-motion`. The code block cycling on the landing page and the animated diagrams stop animating when this media query is active.

**Text resize:** The page is functional and readable when the browser text size is increased to 200%.

**Testing cadence:** Automated accessibility testing runs on every PR (using axe-core). A manual screen-reader test is conducted quarterly by a member of the team.

### 21.2 Localization

**Languages supported:**

**English (en-KE):** The primary language of the developer platform. All content is authored in English first.

**Swahili (sw-KE):** Full translation of:
- Getting started guides
- All quickstart guides
- Core concept guides
- Error reference
- CLI reference

Not translated: API reference (field names are in English as they match the API response), code examples (code is language-agnostic).

**Translation workflow:**
- Source content authored by technical writers in English
- Swahili translation by a professional technical translator with software development knowledge (not a general translator)
- Review by a bilingual developer on the EduNexus team
- Published simultaneously with the English version for new content; existing content translated within 14 days of English publication

**Language switcher:** A language selector in the header. When the developer switches language, the choice is persisted in their account preferences (or a cookie if not signed in). The URL includes the language prefix: `/sw/docs/quickstart`.

**RTL support:** Not required at launch (Swahili is LTR). Built into the design system as a future requirement.

### 21.3 Mobile Experience

Many Kenyan developers browse documentation on mobile phones. The developer platform must be genuinely useful on a 5-inch screen over a 3G connection.

**Performance targets on 3G:**
- Time to First Contentful Paint: < 2.5 seconds
- Time to Interactive: < 5 seconds
- Total page weight (including JS): < 200KB for documentation pages

**Mobile-specific requirements:**

**Sidebar:** Collapses to a drawer accessible via a hamburger menu. The drawer opens with a slide-in animation. Closes on tap outside the drawer or on pressing the X button.

**Code blocks:** Horizontally scrollable on mobile. The copy button is always visible (sticky to the top-right corner of the code block). Code blocks do not force the page to scroll horizontally — they contain their own horizontal scroll.

**Tables:** The parameter tables in API reference pages collapse to a card layout on mobile, with each parameter shown as a card with label/value pairs stacked vertically.

**Interactive API explorer:** On mobile, the request form and response panel stack vertically. The "Send" button is full-width. The response panel scrolls independently.

**Navigation:** The "Try it" functionality in the API reference is accessible on mobile but opens in a bottom sheet rather than an inline panel, to maximize screen real estate.

**Progressive Web App:** The developer platform is a PWA — it can be installed to the home screen on Android (common among Kenyan developers using Android devices). Offline reading is supported for documentation pages that have been previously visited (Service Worker caches documentation pages after first load).

---

## 22. Documentation Governance and Content Lifecycle

### 22.1 Purpose

A developer platform's documentation quality degrades over time without deliberate governance. APIs change, code examples rot, guides become outdated. This section defines the processes that prevent documentation debt from accumulating.

### 22.2 Roles

**Technical Writers:** Own the documentation. They write guides, quickstarts, conceptual content, and review API documentation for clarity and completeness. They do not need to be engineers, but they must be capable of reading and running code.

**API Authors (engineers):** Own the OpenAPI spec. Every API change requires an OpenAPI spec update as part of the PR. Engineers do not write guides, but they are responsible for accurate API documentation.

**DevRel Engineers:** Own the sample applications, quickstarts, and community engagement. They are developers who write for developers. They prioritize the quality and currency of runnable code.

**Technical Review:** Every new documentation page is reviewed by at least one engineer (for technical accuracy) and one technical writer (for clarity).

### 22.3 Content Creation Process

```
1. Identify the need
   (New API feature, new quickstart, common support question, RFC accepted)

2. Create a documentation issue
   (GitHub issue with template: Type, Audience, Outline, Priority)

3. Draft
   (Author writes the draft in a branch, commits to the /docs directory)

4. Technical review
   (An engineer runs every code example and verifies technical accuracy)

5. Editorial review
   (A technical writer reviews for clarity, structure, and consistency)

6. Merge and publish
   (Merged to main triggers a deploy. Documentation is live within 5 minutes.)
```

### 22.4 Content Currency: The Freshness System

Every documentation page has a "last reviewed" date stored in its frontmatter:

```markdown
---
title: Webhook Signature Verification
last_reviewed: 2026-06-30
reviewer: mwangi.omondi@edunexus.co.ke
review_due: 2026-09-30
---
```

The platform displays a banner on pages that have not been reviewed in 90 days:

```
⏰ This page was last reviewed 95 days ago. It may be out of date.
   [Flag for review] [Suggest an edit]
```

**Automated freshness triggers:**
- When an API endpoint referenced in a documentation page is changed (detected by comparing the page text to the OpenAPI diff in each PR), the page's `review_due` is set to today + 7 days
- When a new SDK version ships, all pages referencing that SDK method are flagged for review
- When a quickstart's sample application fails its weekly CI test, the page is immediately flagged as outdated

### 22.5 Code Example Currency

Every code example in the documentation is registered in a manifest (`docs/code-examples.json`):

```json
[
  {
    "id": "webhook-verify-js",
    "file": "docs/guides/webhooks.md",
    "language": "javascript",
    "sdk_version": "1.8.0",
    "last_tested": "2026-06-30",
    "test_command": "node scripts/test-examples/webhook-verify.js"
  }
]
```

A weekly CI job runs every test command and fails if the code example no longer works. Failures create a GitHub issue assigned to the author and send a Slack alert to `#dev-docs`.

### 22.6 Contribution Process

External developers can contribute to the documentation:

**For small fixes** (typos, broken links, minor clarifications):
- "Suggest an edit" link on every page opens the file in GitHub for inline editing
- The contributor submits a PR
- A technical writer reviews and merges within 48 hours

**For new content** (new guide, new example):
- Open a documentation issue first with an outline
- Discuss scope and approach with the DevRel team
- Submit a PR following the contribution guide
- Review process (same as internal: technical + editorial)

**Recognition:**
Contributors are listed in a `/docs/contributors` page. PRs include contributors in the git blame. Significant contributors (3+ merged PRs) are invited to the Community Contributors Slack channel and receive EduNexus developer platform swag.

### 22.7 Documentation Infrastructure

**Hosting:** Vercel (or equivalent edge hosting) for sub-100ms global TTFB, with Kenyan edge presence.

**Build system:** Next.js with MDX for documentation pages. The MDX components provide:
- `<CodeBlock>` — syntax-highlighted, copyable code with language selector
- `<APIEndpoint>` — auto-renders a summary of an API endpoint from the spec
- `<Alert>` — info / warning / danger callout boxes
- `<Tabs>` — tabbed content (for multi-language examples)
- `<EducationalContext>` — collapsible box for curriculum explanations
- `<RelatedContent>` — curated related links section
- `<Changelog>` — renders changelog entries from a data file

**Search indexing:** Typesense is updated via a post-deploy webhook that re-indexes all changed pages.

**Analytics:** Plausible Analytics (privacy-first, GDPR-compliant, no cookie banner required) for page views and engagement metrics. Custom events for "copy code button clicked", "search performed", "playground tried", "quickstart completed".

---

## 23. Future Evolution of the Developer Platform

### 23.1 Near-Term (6–12 months)

**AI-powered documentation search**
Beyond keyword search: a natural language interface where developers ask questions and receive answers synthesized from the documentation. "How do I handle rate limits in Python?" returns a direct answer with code, not a list of links.

The AI is built on EduNexus's own AI infrastructure — using our platform to power our platform is a powerful demonstration.

**Personalized developer home**
The documentation home page adapts to the signed-in developer based on:
- Which APIs they have called recently
- Which guides they have read
- Which SDK they appear to be using
- Their stated use case (from onboarding)

A teacher-tool developer sees curriculum and lesson plan content prominently. An EMIS integration developer sees event and webhook content.

**In-editor documentation (IDE extensions)**
VS Code and JetBrains extensions that surface EduNexus documentation inline:
- Hover over an SDK method to see its documentation
- `Ctrl+Click` on an SDK type to jump to its API reference
- Inline error explanations when an EduNexus API error occurs in a test run

**Sandbox replay**
A feature in the dashboard where developers can replay any request from their logs — useful for debugging production issues in a sandbox environment.

### 23.2 Medium-Term (12–24 months)

**Multi-curriculum expansion**
As EduNexus expands to other African curriculum systems (CAPS in South Africa, NERDC in Nigeria, KICD aligned systems in Uganda and Tanzania), the developer platform expands its curriculum documentation to cover all supported systems. The Knowledge Graph Explorer shows multi-system cross-curriculum views.

**Developer ecosystem programs**
A structured developer relations program:
- EduNexus Developer Advocates: 2–3 dedicated developer advocates in Kenya who run workshops, write blog posts, produce video tutorials
- Sponsored hackathons (partnered with Nairobi, Mombasa, Kisumu tech communities)
- An annual EduNexus developer conference

**AI-assisted code review for integrations**
When a developer submits a marketplace app for review, an AI pre-review runs automatically:
- Checks for common security issues
- Verifies scope usage matches stated functionality
- Tests the OAuth flow
- Checks webhook verification implementation

Results are available within minutes, before the human security review begins.

**Headless CMS for documentation**
Migration from MDX files to a headless CMS (Sanity or similar) for non-technical content creators to contribute without needing to use GitHub. Engineers and technical writers continue to use GitHub for code-heavy content.

### 23.3 Long-Term (24+ months)

**National-scale developer certification**
In partnership with ICT Authority Kenya, Jomo Kenyatta University of Agriculture and Technology (JKUAT), and Kenya National Examination Council (KNEC), the EduNexus Developer Associate certification becomes a recognized professional credential in the Kenyan ICT sector.

**Open-source curriculum data**
The KICD-approved curriculum data in the EduNexus Knowledge Graph is published as an open dataset (with KICD permission) that any developer can access without an API key — removing the largest barrier to entry for small developers and researchers.

**EduNexus Protocol**
A proposed open standard (initially incubated as an RFC, then submitted to an appropriate standards body) for educational intelligence APIs across multiple platforms. EduNexus publishes the protocol and implements it, other edtech platforms are invited to implement it, creating a cross-platform learner data portability ecosystem.

This mirrors what Stripe did for payments with the creation of industry standards, what Twilio did for communications APIs, and what Supabase has done for the PostgreSQL ecosystem.

**The EduNexus Fund**
A grant program for African developers building educational applications on EduNexus. KES 10M allocated annually, in grants of KES 100K–1M. Applications reviewed quarterly. Focus: applications that serve learners in underserved communities, applications that work offline-first, applications in Swahili and other African languages.

---

---

# Appendix A — Design System Tokens

```css
/* Colors */
--color-primary: #0F4C81;        /* EduNexus blue */
--color-primary-light: #1A6DB8;
--color-secondary: #00A67E;      /* EduNexus green */
--color-danger: #DC2626;
--color-warning: #D97706;
--color-success: #059669;
--color-info: #0284C7;

/* Code block */
--color-code-bg: #0D1117;        /* GitHub dark — familiar to developers */
--color-code-text: #E6EDF3;
--color-code-keyword: #FF7B72;
--color-code-string: #A5D6FF;
--color-code-comment: #8B949E;
--color-code-number: #79C0FF;

/* Typography */
--font-body: 'Inter', system-ui, sans-serif;
--font-code: 'JetBrains Mono', 'Fira Code', monospace;
--font-heading: 'Inter', system-ui, sans-serif;

/* Spacing */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 48px;
--space-2xl: 96px;
```

---

# Appendix B — Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Documentation page LCP | < 1.5s (4G) / < 3s (3G) | Lighthouse |
| Dashboard TTI | < 2s (4G) | Lighthouse |
| Search response time | < 100ms | Typesense metrics |
| API reference page size | < 150KB JS | Webpack bundle analyzer |
| Playground first response | < 500ms | Custom instrumentation |
| CLI command response | < 200ms | CLI test suite |

---

# Appendix C — Security Requirements Checklist

For every new feature or surface on the developer platform, verify:

- [ ] API keys are never logged in plaintext
- [ ] API keys are never exposed in URLs or query strings (always in headers)
- [ ] All forms use CSRF tokens
- [ ] All OAuth redirects validate the `state` parameter
- [ ] Webhook payloads are verified before processing
- [ ] User-uploaded content (app icons, screenshots) is scanned before display
- [ ] All third-party scripts are either self-hosted or loaded from a controlled CDN
- [ ] Content Security Policy (CSP) is set and does not include `unsafe-eval` or `unsafe-inline`
- [ ] All pages set appropriate security headers: HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] All developer account actions are audit-logged
- [ ] PII (email addresses, names) is not included in error logs or analytics events
- [ ] The developer platform does not share infrastructure with the student-facing EduNexus platform (separate blast radius)

---

# Appendix D — Launch Checklist

Before developers.edunexus.co.ke goes live:

**Content:**
- [ ] All quickstart guides tested end-to-end on the published date
- [ ] All code examples tested and passing
- [ ] API reference 100% complete (no placeholder descriptions)
- [ ] Error reference complete for all API error codes
- [ ] At least 2 sample applications published and deployable
- [ ] SDK documentation complete for JavaScript and Python (minimum)
- [ ] Changelog populated back to v1.0

**Infrastructure:**
- [ ] Search index populated and returning relevant results
- [ ] Sandbox environment pre-seeded with realistic demo data
- [ ] Rate limiting configured per plan tier
- [ ] Webhook delivery retry logic implemented and tested
- [ ] Monitoring and alerting configured for the developer platform itself

**Community:**
- [ ] Forum set up with initial categories and pinned getting-started threads
- [ ] Slack workspace created with `#general`, `#help`, `#announcements`, `#show-and-tell`
- [ ] First RFC published (even if a minor one — establishes the process)
- [ ] Security disclosure policy published

**Legal:**
- [ ] Developer Terms of Service published
- [ ] API Usage Policy published (rate limits, acceptable use, data handling)
- [ ] Privacy Policy for the developer platform published
- [ ] Marketplace Publisher Agreement ready for signing

**Team:**
- [ ] On-call rotation established for developer-platform-reported issues
- [ ] SLA response times defined and communicated
- [ ] Internal escalation path documented (developer reports bug → who handles it)

---

*This document is the definitive blueprint for developers.edunexus.co.ke.*
*It supersedes all previous developer platform design documents.*
*Last updated: June 30, 2026*
*Owner: EduNexus Platform Team*
