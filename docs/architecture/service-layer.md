# Service Layer

The service layer is the entire collection of `lib/` modules. It contains all business logic for the EduNexus platform. Nothing outside of `lib/` is allowed to contain business logic — not route handlers, not components, not cron jobs.

---

## Why Business Logic Belongs in `lib/`

EduNexus serves the same educational intelligence through multiple clients:

- **Web App** — teacher dashboards, student home, parent insights
- **Developer APIs** — external developers building integrations
- **Cron Jobs** — scheduled background operations
- **SDKs** — future TypeScript/Python/Go client libraries
- **CLI** — future command-line tools for school administrators

If business logic lived in route handlers, it would have to be duplicated for every new client. If it lived in components, it could not be called from the server at all. By placing all logic in `lib/`, every client calls the same implementation. The web app is not special — it is just another consumer of the service layer.

---

## Service Domains

### Organizations (`lib/organizations/`)

Manages multi-tenant organizational units — the top-level concept that every other resource belongs to.

**Responsibilities:**
- Create, read, update organizations (with slug uniqueness enforcement)
- Manage organization members (invite, accept, remove)
- Manage organization roles (system and custom roles)
- Issue and revoke API keys
- Query organization settings and quotas
- Record membership changes to the audit log

**Key functions:**
- `createOrganization(input)` — validates slug uniqueness, inserts org, assigns owner role
- `inviteMember(orgId, email, role)` — creates invitation record, triggers email job
- `acceptInvitation(token, userId)` — validates token, creates membership
- `assertPermission(userId, orgId, permission)` — throws if user lacks the permission

### IAM (`lib/iam/`)

Defines the permission model and audit trail.

**Responsibilities:**
- System role permission matrix (`SYSTEM_ROLE_PERMISSIONS`)
- Custom role permission evaluation
- Audit log writes for all sensitive actions

**System roles (ordered by authority):**
1. `owner` — full control, cannot be removed
2. `admin` — full control except owner management
3. `billing_admin` — billing and subscription management
4. `developer` — API key management, developer platform access
5. `member` — standard educator access
6. `viewer` — read-only access

**Permission naming convention:** `resource:action` — e.g., `assessments:create`, `members:remove`, `api_keys:issue`.

### Teacher Academy (`lib/academy/`)

The professional development system for teachers.

**Responsibilities:**
- Manage academy cohorts (groups of teachers in a learning journey)
- Track teacher reflections and evidence submissions
- Issue missions (micro-learning tasks)
- Maintain teacher competency radar scores
- Trigger engagement nudges via WhatsApp

### Career Intelligence (`lib/career/`)

Provides students with career exploration, capability mapping, and life simulation tools.

**Responsibilities:**
- Capability engine — map student strengths to career families
- Career explorer — curate career paths with CBC subject alignment
- Matching — suggest careers based on competency profile
- Life simulation — project earnings, lifestyle, and educational pathways
- Parent intelligence — summarize career trajectory for parents
- Growth engine — generate development recommendations

### Curriculum Services (`lib/curriculum/`)

Wraps the Kenya CBC/8-4-4/IGCSE curriculum data as queryable services.

**Responsibilities:**
- Retrieve learning outcomes by subject, grade, and strand
- Map competencies to curriculum objectives
- Validate that generated content aligns with KICD standards
- Support Scheme of Work and Lesson Plan generation with curriculum anchors

### Assessment Engine (`lib/assessments/`)

Manages the full lifecycle of teacher-created assessments.

**Responsibilities:**
- Create assessments with mark scheme definition
- Generate question papers (PDF rendering)
- Upload and parse student score files (CSV/Excel)
- Compute class results and generate results analytics
- Update the learner model after assessment completion

### Scheme of Work (`lib/sow/`)

Generates and manages curriculum-aligned Schemes of Work.

**Responsibilities:**
- Generate multi-week SOW using DeepSeek AI
- Validate generated content against curriculum standards
- Render SOW as PDF for teacher download
- Track SOW history per class

### Lesson Plan (`lib/lessonPlan/`)

Generates and manages individual lesson plans.

**Responsibilities:**
- Generate lesson plans from SOW context using AI
- Render lesson plans as PDFs
- Track plans per SOW week

### Record of Work (`lib/row/`)

Documents what was actually taught each lesson.

**Responsibilities:**
- Record lesson coverage against planned objectives
- Render Records of Work as PDFs
- Support automated Monday-morning generation via cron

### Learner Model (`lib/learnerModel/`)

Maintains a per-student intelligence profile that grows over time.

**Responsibilities:**
- Update competency scores after assessments
- Run the remedial planner to identify learning gaps
- Generate holiday and weekend learning plans
- Power the Monday Panel briefing for teachers

### AI Services (`lib/ai/`)

Implements the low-level API calls to AI providers.

**Responsibilities:**
- `lib/ai/deepseek.ts` — DeepSeek API integration (chat completions, streaming)
- `lib/ai/gemini.ts` — Google Gemini integration (fallback provider)
- Structured prompt building
- Response parsing and validation
- Token usage extraction

All AI calls go through `lib/ai-orchestration/` for routing and cost tracking. Direct calls to `lib/ai/` are only made from the orchestration layer.

### Payments (`lib/payments/`)

Manages token balances and Paystack payment processing.

**Responsibilities:**
- Token balance reads and deductions (`token_balances` table)
- Paystack payment initiation and webhook verification
- Subscription management and renewal
- `TOKEN_COSTS` constant — the single source of truth for all token pricing

### Learning Intelligence (`lib/learnerModel/`, `lib/school/`)

**Monday Panel (`lib/school/intelligence.ts`):**
- Weekly briefing engine that summarizes class performance for teachers
- Identifies at-risk students before the week begins
- Aggregates assessment results, attendance patterns, and learner model data

---

## Service Layer Rules

These rules are non-negotiable. Violating them breaks the shared-service guarantee.

**1. No HTTP in `lib/`.** Service functions receive typed inputs and return typed outputs. They do not read from `req`, call `NextResponse.json()`, or reference HTTP status codes.

**2. No environment branching.** Service functions do not check `process.env.NODE_ENV` or `ctx.environment`. Infrastructure guards handle environment-specific behavior.

**3. Explicit return types on all functions.** TypeScript must be able to verify the contract of every service function.

**4. Throw errors, never return them.** Service functions `throw new Error('descriptive message')` for failures. Route handlers catch and convert to HTTP responses.

**5. No queries inside loops.** Always batch with `.in()` or join with related selects. A function that calls the database N times in a loop will not be merged.

**6. Named column selects only.** Never `select('*')`. Every query selects exactly the columns it needs.

**7. One function per operation.** Do not build multi-step utility functions that do several unrelated things. Each function has a single responsibility.

---

## How Clients Consume Services

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Web App    │   │   API Route  │   │   Cron Job   │   │  Future SDK  │
│ (Server Cmp) │   │ /app/api/... │   │ /api/cron/.. │   │  (external)  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                                     │
                                     ▼
                         ┌─────────────────────┐
                         │    lib/ (services)   │
                         │  organizations/      │
                         │  assessments/        │
                         │  sow/                │
                         │  learnerModel/       │
                         │  ...                 │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Supabase (data)   │
                         └─────────────────────┘
```

The service layer is the **only** path to the database. This guarantees that all clients apply the same business rules, the same validation, and the same audit logging — regardless of how they reached the service.
