# EduNexus Monorepo & Workspace Foundation Specification

**Version:** 1.0.0
**Classification:** Engineering Foundation Document
**Audience:** Senior Software Engineers, Platform Engineers, DevOps Engineers, AI Engineers, Frontend Engineers, Backend Engineers, Infrastructure Engineers, Technical Leads
**Status:** Canonical

---

> A newly hired senior engineer should be able to clone the repository, understand its organization, run the platform locally, and contribute confidently without tribal knowledge.

---

## Table of Contents

### Part I — Engineering Philosophy
- Chapter 1: Why a Monorepo?
- Chapter 2: Workspace Architecture

### Part II — Applications
- Chapter 3: Apps
- Chapter 4: Shared Packages

### Part III — Backend
- Chapter 5: Services
- Chapter 6: Workers

### Part IV — Engineering Tooling
- Chapter 7: Tooling
- Chapter 8: Infrastructure

### Part V — Engineering Standards
- Chapter 9: Dependency Rules
- Chapter 10: Repository Standards

### Part VI — Development Environment
- Chapter 11: Local Development
- Chapter 12: Build System

### Part VII — CI/CD
- Chapter 13: Continuous Integration
- Chapter 14: Release Engineering

### Part VIII — Platform Operations
- Chapter 15: Observability
- Chapter 16: Security

### Part IX — Engineering Culture
- Chapter 17: Contribution Model
- Chapter 18: Repository Governance

### Final Chapter: The First Commit

---

# Part I — Engineering Philosophy

---

## Chapter 1 — Why a Monorepo?

### 1.1 The Question Every Platform Team Faces

When an engineering organization begins to grow beyond a handful of engineers, it confronts a fundamental architectural decision that will shape its velocity, quality, and culture for years: should the codebase live in a single repository or be spread across many?

This question is not merely organizational. It is an architectural decision with deep implications for how code is shared, how changes propagate, how teams coordinate, how products are released, and how the engineering culture itself develops.

EduNexus has answered this question definitively: **a single monorepo, managed with Turborepo and pnpm workspaces**.

This chapter explains that decision — not as an appeal to authority or industry fashion, but as a rigorous engineering argument grounded in the specific constraints and ambitions of the EduNexus platform.

### 1.2 What EduNexus Is Building

EduNexus is a Kenya CBC/CBE AI education platform serving teachers, parents, and students. It is not a single web application. It is a platform — a constellation of user-facing applications, backend services, AI systems, data pipelines, developer APIs, and educational intelligence engines — all sharing a common domain model, common data, and common understanding of the Kenyan educational curriculum.

As of the current phase (50 pioneer beta teachers), the surface area is already significant:

- A teacher-facing web application for lesson planning, scheme of work generation, and record of work
- A learner-facing application for study, assessment, and career exploration
- A parent-facing application for progress monitoring and engagement
- An admin application for school and system management
- A developer platform (developers.edunexus.co.ke) exposing APIs, SDKs, and an AI playground
- An analytics platform for educational intelligence
- A content studio for curriculum authoring
- AI services for lesson generation, assessment generation, and learner modeling
- A knowledge graph service encoding the CBC curriculum
- Notification, billing, and search infrastructure

These are not independent products. They share:

- A common `Teacher` entity with a consistent data model
- A common `Learner` entity with learning profiles, competency maps, and career graphs
- A common CBC curriculum graph referenced by all AI and assessment systems
- A common token economy with a single payment infrastructure
- Common UI design system and component library
- Common authentication and authorization model
- Common observability infrastructure

The question is not whether to share code. The code **must** be shared. The question is **how** to share it.

### 1.3 The Polyrepo Alternative

Before committing to a monorepo, it is worth rigorously examining the polyrepo model — one repository per application or service.

#### 1.3.1 Apparent Benefits of Polyrepo

A polyrepo approach offers apparent benefits that are real but ultimately insufficient for EduNexus:

**Team autonomy:** Each team owns its repository and can deploy independently without coordinating with other teams.

**Isolation:** A breaking change in one repository cannot directly break another repository's CI pipeline.

**Smaller repositories:** Individual repositories are smaller and faster to clone.

**Independent access control:** Different teams can have different GitHub permissions.

#### 1.3.2 The Real Costs of Polyrepo

However, the polyrepo model introduces costs that compound as the platform grows:

**Code sharing becomes a distribution problem.** When `apps/teacher` and `apps/learner` both need the same `CurriculumGraph` type, polyrepo forces that type into a published npm package. That package must be versioned, published, downloaded, and updated independently in every consuming repository. A one-line type change becomes a multi-repository update process that spans hours or days.

**Cross-repository atomic changes are impossible.** When the `Learner` entity model changes — adding a new field required by both the learner application and the AI service — polyrepo forces two separate pull requests in two separate repositories. These changes can drift. The learner application may deploy with the new field while the AI service still expects the old schema. This is the root cause of the most pernicious production bugs.

**Dependency version drift is guaranteed.** When `apps/teacher` uses React 18.2 and `apps/learner` uses React 18.3, they have diverged. When each repository manages its own version of `zod`, `next`, `tailwindcss`, and `@supabase/supabase-js` independently, version inconsistency is the steady state, not the exception.

**Onboarding multiplies.** A new engineer who needs to work across the teacher application and the AI service must clone two repositories, configure two environments, understand two CI pipelines, and navigate two different tooling setups. With a polyrepo of ten repositories, onboarding a full-stack engineer who touches the entire platform becomes a week-long exercise in configuration.

**Refactoring becomes archaeology.** Renaming a shared function in a polyrepo requires finding every repository that calls it, submitting pull requests to each, coordinating their merges, and updating all published packages. Engineers avoid this work. The codebase fossilizes.

**Code review loses context.** When a feature spans the teacher application, the AI service, and the notification worker, reviewers must context-switch across three repositories to understand the full change. They frequently miss the cross-cutting implications.

**Discovery is lost.** In a polyrepo, an engineer working on the learner application cannot easily discover that the teacher application has already solved an identical problem. Knowledge stays siloed. Solutions are duplicated.

**Infrastructure duplication.** Each repository needs its own CI pipeline, its own tooling configuration, its own linting setup, its own test infrastructure. With ten repositories, you maintain ten GitHub Actions workflows. Updating the linting rules or the TypeScript configuration requires ten pull requests.

### 1.4 The Monorepo Argument

A monorepo is not the absence of structure. It is a different organizational model — one where all related code lives together, with explicit boundaries enforced through tooling rather than through repository isolation.

#### 1.4.1 Organizational Scalability

The monorepo scales with organizational complexity in a way the polyrepo does not. As EduNexus grows from 5 engineers to 50 to 500, the monorepo grows with it. The organizational structure — team ownership, package boundaries, approval gates — is encoded in the repository itself through `CODEOWNERS`, ESLint rules, import restrictions, and architectural tests.

Google, Meta, Twitter, Airbnb, and Stripe — organizations with thousands of engineers — have all chosen monorepos for their core platforms. The argument that monorepos "don't scale" is empirically false. Monorepos require investment in tooling to scale — specifically, build systems that understand the dependency graph and only rebuild what has changed. That investment, made once, pays compounding dividends.

#### 1.4.2 Code Reuse Without Distribution

In a monorepo, sharing the `CurriculumGraph` type between the teacher application and the AI service is a single import statement. No publishing. No versioning. No update cycle. The change propagates atomically.

```typescript
// In apps/teacher
import { CurriculumGraph } from '@edunexus/curriculum';

// In services/ai
import { CurriculumGraph } from '@edunexus/curriculum';
```

Both applications always use the same version of `CurriculumGraph` because there is only one version: the one in `packages/curriculum/`. If the type changes, the change affects both consumers simultaneously. The TypeScript compiler validates all consumers before any code ships.

#### 1.4.3 Shared Types

Type safety is the foundation of EduNexus's engineering culture. The platform's domain model — `Teacher`, `Learner`, `LessonPlan`, `SchemeOfWork`, `Assessment`, `CompetencyMap`, `CurriculumNode`, `TokenBalance` — must be consistent across every application, service, and worker that touches it.

In a monorepo, these types live in `packages/database/` and `packages/curriculum/`. Every consumer imports from the same source. The TypeScript compiler enforces consistency at compile time. There is no possibility of `apps/teacher` having a different definition of `LessonPlan` than `services/ai`.

In a polyrepo, this consistency must be enforced by convention and process — two mechanisms that always fail under deadline pressure.

#### 1.4.4 Shared UI

EduNexus serves four distinct user populations — teachers, learners, parents, and administrators — through four distinct applications. These applications share a common design system: consistent typography, color tokens, spacing system, component library, and accessibility standards.

In a monorepo, the design system lives in `packages/ui/`. A change to the `Button` component propagates to every application that uses it. Visual consistency is guaranteed at the code level, not through designer review or component audits.

In a polyrepo, the design system must be published as an npm package. When a designer discovers a color contrast accessibility issue in the primary button, fixing it requires a package release and four separate pull requests across four repositories — and all four applications must be deployed for the fix to take effect everywhere.

#### 1.4.5 Shared SDKs

EduNexus exposes a public API through `developers.edunexus.co.ke`. The JavaScript/TypeScript SDK for this API is built from the same source that powers the internal API clients used by `apps/teacher` and `apps/learner`. In a monorepo, the SDK is `packages/sdk/`. Internal applications use the same SDK as external developers. Any bug fix to the SDK is immediately available to all consumers. The external developer experience is automatically consistent with the internal developer experience.

#### 1.4.6 Shared Infrastructure

CI/CD configuration, Docker base images, Terraform modules, environment variable management, deployment scripts — all of this infrastructure is written once and reused across every application and service in the monorepo. Updating the base Docker image or the Terraform provider version is a single pull request that affects the entire platform.

#### 1.4.7 Atomic Commits

When a new AI feature requires changes to the `services/ai` endpoint, the `packages/ai` library, the `apps/teacher` UI, and the `workers/ai` queue processor simultaneously, a monorepo allows all four changes to be committed atomically in a single pull request. The CI pipeline validates all four changes together. The change either ships everywhere or ships nowhere.

This property — **atomic cross-cutting changes** — is perhaps the most important practical benefit of the monorepo for a platform with deep interdependencies. EduNexus's features are inherently cross-cutting: a new lesson plan generation feature touches AI, the database, the token economy, the teacher UI, and the notification system simultaneously.

#### 1.4.8 Coordinated Releases

The monorepo enables a single release train. All applications and services are versioned together. The release notes for version 2.3.0 describe the changes across the entire platform — not just the changes to one application. Operations teams deploy a single version of the platform, not independent versions of ten services.

This coordinated release model does not prevent independent deployment — applications can still deploy independently when needed. But it provides a coherent versioning story that is impossible in a polyrepo without significant additional tooling.

#### 1.4.9 Simplified Onboarding

A new engineer clones one repository. They run one command. The entire platform starts. They can navigate the entire codebase using their IDE's "go to definition" and "find all references" features. They can search for any symbol across every application, service, and package in seconds.

The monorepo is the best possible onboarding documentation because it is alive, up-to-date, and executable. No README can substitute for the ability to read the actual code.

#### 1.4.10 Architectural Consistency

ESLint rules, TypeScript configuration, test infrastructure, logging patterns, error handling conventions — all of this is defined once in the monorepo and applied uniformly across every package. An engineer cannot introduce `any` types in the AI service if the ESLint rule is enforced at the workspace level. An engineer cannot use `console.log` in production code if the linting rule forbids it.

Architectural consistency in a polyrepo requires constant vigilance and enforcement. In a monorepo, it is mechanically enforced.

### 1.5 Monorepo vs Polyrepo: The Comparison

| Dimension | Monorepo | Polyrepo |
|-----------|----------|---------|
| Code sharing | Import directly | Publish and version packages |
| Cross-cutting changes | Single atomic PR | Multiple PRs, coordination required |
| Type consistency | Guaranteed by compiler | Enforced by convention |
| Dependency versions | Single source of truth | Version drift guaranteed |
| Onboarding | Clone one repo, run one command | Clone N repos, configure N environments |
| Refactoring | Search and replace across entire platform | Multi-repo PR process |
| Infrastructure | Defined once, reused everywhere | Duplicated N times |
| CI pipeline | Defined once, incremental builds | N pipelines, full rebuilds |
| Code discovery | IDE search works across everything | Silo'd per repository |
| Architectural enforcement | Tooling at workspace level | Convention and process |
| Release coordination | Single release train | N independent release cycles |
| Team autonomy | Maintained through ownership rules | Maintained through repo isolation |
| Build speed | Turborepo incremental builds | Full rebuilds per repo |
| Scaling | Requires tooling investment | Appears simple, complexity is hidden |

### 1.6 Why Turborepo

Turborepo is the build system for the EduNexus monorepo. The choice of Turborepo over alternatives (Nx, Bazel, Lerna) is based on the following considerations:

**Task graph computation.** Turborepo builds a dependency graph of all tasks across all packages and applications. When you run `turbo build`, Turborepo determines the minimal set of packages that need to be rebuilt based on what has changed since the last build. It runs tasks in parallel across independent packages and in dependency order for dependent packages.

**Remote caching.** Turborepo can cache build artifacts remotely in Vercel's infrastructure (or a self-hosted cache). When a package has not changed since its last build, Turborepo restores the artifact from cache rather than rebuilding it. A CI pipeline that would otherwise take 20 minutes completes in 2 minutes because only the changed packages are rebuilt.

**Zero configuration for the common case.** Turborepo's `turbo.json` pipeline configuration is simple and opinionated. The most common pipeline — build all packages in dependency order, lint everything in parallel, test everything in parallel — requires fewer than 30 lines of configuration.

**Next.js native support.** EduNexus's primary applications are Next.js applications. Turborepo is developed by Vercel, the company behind Next.js, and the integration is first-class.

**TypeScript native.** Turborepo is written in Rust and Go but is configured in TypeScript-friendly JSON. Its ecosystem is deeply TypeScript-aware.

**Small footprint.** Turborepo is a single binary. It does not require a complex configuration language (like Bazel's Starlark) or a large plugin ecosystem to operate.

### 1.7 Why pnpm

pnpm is the package manager for the EduNexus monorepo. The choice over npm and yarn is deliberate:

**Workspace support.** pnpm workspaces are the native mechanism for linking packages within a monorepo. The `workspace:*` protocol in `package.json` tells pnpm that a dependency should be resolved from the local workspace rather than the npm registry.

**Disk efficiency.** pnpm uses a global content-addressable store and hard links rather than copying node_modules. A monorepo with 20 packages that all use `react@18` has a single copy of React on disk, hard-linked into each package's `node_modules`. This saves gigabytes of disk space and speeds up installation dramatically.

**Strict dependency isolation.** pnpm's default behavior is strictly correct: a package can only import packages listed in its own `package.json`. npm and yarn are permissive — they allow packages to import their dependencies' dependencies, which creates hidden coupling. pnpm's strictness enforces the dependency graph.

**Lockfile stability.** pnpm's lockfile is more stable than npm's under concurrent modification, which matters in CI environments where multiple jobs may install dependencies simultaneously.

**Speed.** pnpm installs are typically 2-3x faster than npm installs and comparable to or faster than yarn installs, due to the content-addressable store and parallel installation.

### 1.8 Scaling to Hundreds of Engineers

The investment in Turborepo and pnpm is not premature optimization. It is the foundation that makes scaling possible.

When EduNexus grows from 5 engineers to 50, the monorepo scales because:

- Turborepo's remote cache means CI times stay constant even as the codebase grows, because only changed packages are rebuilt
- pnpm workspaces enforce dependency isolation, preventing one team's dependency choices from affecting another team
- CODEOWNERS rules mean that as teams form, each team automatically owns the packages they maintain
- ESLint and TypeScript configuration at the workspace level means architectural standards scale without requiring manual review

When EduNexus grows from 50 engineers to 500, the same infrastructure scales because the fundamental property of the monorepo — that the build system understands the dependency graph — means build times remain proportional to the scope of changes, not the size of the repository.

The companies that have operated monorepos at this scale (Google: 2 billion lines of code, Meta: hundreds of thousands of engineers) have validated the model. Their investment was in build tooling. EduNexus makes the same investment upfront, at a fraction of the cost, by using Turborepo.

### 1.9 What This Chapter Establishes

The monorepo decision is made. The tooling is chosen. What follows in this specification is the complete engineering blueprint for initializing, organizing, and operating the EduNexus monorepo.

Every architectural decision in subsequent chapters — the directory structure, the package boundaries, the dependency rules, the CI pipeline, the release process — derives from the principles established here:

1. All code that belongs to the EduNexus platform lives in one repository
2. Sharing code means importing, not publishing and versioning
3. Cross-cutting changes ship atomically
4. Architectural standards are mechanically enforced
5. Build times are bounded by change scope, not repository size

---

## Chapter 2 — Workspace Architecture

### 2.1 Design Principles

The directory structure of the EduNexus monorepo is not arbitrary. Every decision about what goes where reflects one of five principles:

**Principle 1: Purpose is obvious from location.** An engineer should be able to determine the purpose of any file from its path alone. `apps/teacher/app/lesson-plans/page.tsx` is obviously the lesson plans page of the teacher application. `packages/curriculum/src/graph/traversal.ts` is obviously the graph traversal logic in the curriculum package.

**Principle 2: Ownership is clear.** Every directory has a designated owner. The owner is responsible for the correctness, documentation, and evolution of everything in that directory. Ownership is encoded in `CODEOWNERS`.

**Principle 3: Dependency direction is one-way.** Applications depend on packages. Services depend on packages. Packages do not depend on applications. Workers depend on packages. No circular dependencies exist anywhere.

**Principle 4: Boundaries are enforced.** Import restrictions are not conventions. They are ESLint rules that fail the CI pipeline. An engineer cannot accidentally import `apps/teacher` code from `packages/ui` — the build fails.

**Principle 5: Everything that needs to run locally, can run locally.** The `docker/` directory contains everything needed to run all external dependencies locally. No feature of the platform requires a production environment to develop.

### 2.2 The Repository Root

```
edunexus/
├── apps/                    # User-facing and internal applications
├── packages/                # Shared libraries and design system
├── services/                # Backend microservices
├── workers/                 # Asynchronous job processors
├── tooling/                 # Developer tools and code generators
├── infra/                   # Infrastructure as code
├── scripts/                 # Repository maintenance scripts
├── docker/                  # Docker Compose files for local development
├── docs/                    # Architecture and engineering documentation
├── examples/                # Example integrations for external developers
├── .github/                 # GitHub Actions workflows and templates
├── turbo.json               # Turborepo pipeline configuration
├── pnpm-workspace.yaml      # pnpm workspace definition
├── package.json             # Root package.json (workspace root)
├── tsconfig.base.json       # Base TypeScript configuration
├── .eslintrc.base.js        # Base ESLint configuration
├── .prettierrc              # Prettier configuration (single source)
├── .nvmrc                   # Node.js version pin
├── .node-version            # Node.js version pin (alternate)
├── .env.example             # Documentation of required environment variables
├── CLAUDE.md                # Engineering standards for Claude Code
├── CODEOWNERS               # GitHub CODEOWNERS file
├── CONTRIBUTING.md          # Contribution guide for engineers
├── SECURITY.md              # Security policy and disclosure process
├── LICENSE                  # Repository license
└── README.md                # Repository root README
```

### 2.3 The Apps Directory

```
apps/
├── web/                     # Main marketing and entry-point web app
├── teacher/                 # Teacher-facing platform (primary product)
├── learner/                 # Learner-facing platform
├── parent/                  # Parent-facing platform
├── admin/                   # Internal administration platform
├── analytics/               # Educational analytics dashboard
├── studio/                  # Curriculum content authoring studio
├── developers/              # Developer platform (developers.edunexus.co.ke)
├── docs/                    # Public documentation site
└── marketing/               # Marketing pages and landing pages
```

### 2.4 The Packages Directory

```
packages/
├── ui/                      # Shared React component library (design system)
├── icons/                   # SVG icon library
├── config/                  # Shared runtime configuration
├── eslint-config/           # Shared ESLint rules
├── typescript-config/       # Shared tsconfig bases
├── sdk/                     # Public EduNexus JavaScript/TypeScript SDK
├── api-client/              # Internal API client (generated from OpenAPI)
├── database/                # Database types, queries, and client factory
├── auth/                    # Authentication utilities and middleware
├── analytics/               # Analytics event tracking
├── events/                  # Event bus types and publishers
├── notifications/           # Notification templates and helpers
├── curriculum/              # CBC curriculum data, types, and graph
├── assessment/              # Assessment engine types and scoring
├── knowledge-graph/         # Knowledge graph client and types
├── ai/                      # AI provider clients and prompt utilities
├── search/                  # Search client and indexing utilities
├── utils/                   # Pure utility functions
├── validation/              # Zod schemas for all shared domain types
├── logging/                 # Structured logging utilities
├── observability/           # Tracing, metrics, and health check utilities
└── security/                # CSRF, rate limiting, and security helpers
```

### 2.5 The Services Directory

```
services/
├── gateway/                 # API gateway (rate limiting, auth, routing)
├── ai/                      # AI orchestration service
├── knowledge-graph/         # Knowledge graph query service
├── analytics/               # Analytics ingestion and query service
├── notifications/           # Notification dispatch service
├── billing/                 # Paystack billing and token management
├── search/                  # Full-text and semantic search service
├── webhooks/                # Webhook delivery and management service
└── identity/                # Identity and SSO service
```

### 2.6 The Workers Directory

```
workers/
├── ai/                      # AI generation job processor
├── email/                   # Email delivery worker
├── sms/                     # SMS delivery worker (Africa's Talking)
├── analytics/               # Analytics aggregation worker
├── webhooks/                # Webhook delivery retry worker
├── sync/                    # Data synchronization worker
├── pdf/                     # PDF report generation worker
├── import/                  # CSV/Excel data import worker
├── scheduler/               # Cron job orchestrator
├── dead-letter/             # Dead letter queue processor
└── retry/                   # Failed job retry processor
```

### 2.7 The Tooling Directory

```
tooling/
├── cli/                     # edunexus CLI tool (dx commands)
├── openapi-generator/       # Generates API clients from OpenAPI specs
├── sdk-generator/           # Generates typed SDK from OpenAPI
├── codegen/                 # Shared code generation utilities
├── db-generator/            # Generates TypeScript types from Supabase schema
├── graph-generator/         # Generates curriculum graph data structures
├── prompt-validator/        # Validates AI prompt templates
├── ai-evaluator/            # AI output quality evaluation tools
├── docs-generator/          # Generates API reference documentation
└── schema-validator/        # Validates JSON schemas and Zod schemas
```

### 2.8 The Infra Directory

```
infra/
├── terraform/               # Terraform modules and environments
│   ├── modules/             # Reusable Terraform modules
│   ├── environments/        # Environment-specific configurations
│   │   ├── production/
│   │   ├── staging/
│   │   └── preview/
│   └── shared/              # Shared infrastructure (DNS, CDN, etc.)
├── supabase/                # Supabase project configuration
│   ├── migrations/          # Database migrations (canonical source)
│   ├── seed/                # Database seed data
│   ├── functions/           # Supabase Edge Functions
│   └── config.toml          # Supabase configuration
├── redis/                   # Redis configuration and keyspace design
├── clickhouse/              # ClickHouse schemas and TTL policies
├── grafana/                 # Grafana dashboards as code
├── prometheus/              # Prometheus recording rules and alerts
├── tempo/                   # Tempo tracing configuration
├── loki/                    # Loki logging configuration
├── docker/                  # Shared Docker base images
└── secrets/                 # Secrets management documentation (no secrets stored here)
```

### 2.9 Supporting Directories

```
scripts/
├── setup.sh                 # First-time setup script
├── seed.sh                  # Database seeding script
├── check-node.sh            # Node version validation
├── generate-types.sh        # Regenerate all generated types
├── audit-deps.sh            # Dependency audit script
└── release.sh               # Release preparation script

docker/
├── docker-compose.yml       # Full local development stack
├── docker-compose.test.yml  # Test environment stack
├── supabase.yml             # Supabase local overrides
├── redis.yml                # Redis configuration
├── clickhouse.yml           # ClickHouse configuration
└── monitoring.yml           # Prometheus/Grafana stack

docs/
├── architecture/            # Architecture Decision Records (ADRs)
├── engineering/             # Engineering handbook and standards
├── api/                     # API reference documentation
├── runbooks/                # Operational runbooks
└── onboarding/              # New engineer onboarding guides

examples/
├── javascript/              # JavaScript SDK examples
├── typescript/              # TypeScript SDK examples
├── webhooks/                # Webhook integration examples
└── curriculum-api/          # Curriculum API usage examples

.github/
├── workflows/               # GitHub Actions workflow definitions
├── ISSUE_TEMPLATE/          # Issue templates
├── PULL_REQUEST_TEMPLATE.md # PR template
└── dependabot.yml           # Dependabot configuration
```

### 2.10 Ownership Rules

Every directory in the monorepo has a designated owner. Ownership is defined in `CODEOWNERS` and enforced by GitHub's pull request approval requirements.

| Directory | Owner | Rationale |
|-----------|-------|-----------|
| `apps/teacher/` | Teacher App Team | Primary product surface |
| `apps/learner/` | Learner App Team | Learner experience |
| `apps/parent/` | Learner App Team | Parent and learner share ownership |
| `apps/admin/` | Platform Team | Internal tooling |
| `apps/analytics/` | Data Team | Analytics surface |
| `apps/developers/` | Developer Platform Team | External developer experience |
| `packages/ui/` | Design System Team | Shared component library |
| `packages/curriculum/` | Curriculum Team | CBC curriculum data |
| `packages/ai/` | AI Team | AI infrastructure |
| `packages/database/` | Platform Team | Database contracts |
| `services/` | Platform Team | Backend services |
| `workers/` | Platform Team | Async infrastructure |
| `infra/` | DevOps Team | Infrastructure |
| `tooling/` | Developer Experience Team | Internal tooling |

### 2.11 Dependency Direction

The dependency graph is strictly acyclic and follows this direction:

```
apps/* → packages/*
services/* → packages/*
workers/* → packages/*
tooling/* → packages/*
packages/* → packages/* (with restrictions)

NEVER:
packages/* → apps/*
packages/* → services/*
packages/* → workers/*
services/* → apps/*
apps/* → services/* (use API calls, not imports)
```

This rule is enforced by ESLint's `no-restricted-imports` rule and by Turborepo's dependency graph. Any import that violates this direction fails the lint step of the CI pipeline.

### 2.12 Import Restrictions Summary

| Source | May import from | May NOT import from |
|--------|----------------|---------------------|
| `apps/*` | `packages/*` | Other `apps/*`, `services/*`, `workers/*` |
| `services/*` | `packages/*` | `apps/*`, other `services/*`, `workers/*` |
| `workers/*` | `packages/*` | `apps/*`, `services/*` |
| `packages/ui` | `packages/icons`, `packages/utils` | Everything else |
| `packages/database` | `packages/validation`, `packages/logging` | `packages/ai`, `packages/curriculum` |
| `packages/ai` | `packages/logging`, `packages/utils` | `packages/database`, `apps/*` |

---

# Part II — Applications

---

## Chapter 3 — Apps

### 3.1 Application Architecture Philosophy

Every EduNexus application follows the same architectural principles:

1. **Next.js App Router** — All applications are Next.js 15+ applications using the App Router. Server Components are the default. Client Components are opt-in.
2. **Route handlers are thin** — API routes call `packages/*` functions. They contain no business logic.
3. **Zero direct Supabase calls in components** — Components call API routes or Server Actions. Database access is always mediated through `lib/` functions (now `packages/`).
4. **TypeScript strict mode** — Every application has `strict: true` in its TypeScript configuration.
5. **Shared configuration** — TypeScript, ESLint, Prettier, and Tailwind configuration all extend from shared packages.

### 3.2 apps/web — Main Entry Point

#### 3.2.1 Purpose

`apps/web` is the primary marketing and entry-point web application at `edunexus.co.ke`. It serves prospective users, handles authentication entry (sign up, sign in, forgot password), and routes authenticated users to their appropriate application (`apps/teacher`, `apps/learner`, `apps/parent`).

#### 3.2.2 Users

- Prospective teachers discovering EduNexus
- Prospective schools evaluating EduNexus
- Authenticated users being routed to their application
- Search engines indexing EduNexus content

#### 3.2.3 Routing

```
/                           → Homepage (marketing)
/pricing                    → Pricing page
/about                      → About page
/features                   → Features overview
/curriculum                 → CBC curriculum overview
/blog/                      → Blog posts
/blog/[slug]                → Individual blog post
/auth/sign-in               → Sign in page
/auth/sign-up               → Sign up page
/auth/forgot-password       → Password reset request
/auth/reset-password        → Password reset (from email link)
/auth/verify-email          → Email verification
/auth/callback              → OAuth callback handler
/legal/privacy              → Privacy policy
/legal/terms                → Terms of service
```

#### 3.2.4 Technology

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS 4, `packages/ui`
- **Analytics:** `packages/analytics`
- **Authentication:** `packages/auth`, Supabase Auth
- **CMS:** MDX for blog content

#### 3.2.5 Folder Structure

```
apps/web/
├── app/
│   ├── (marketing)/         # Marketing route group (no auth)
│   │   ├── page.tsx         # Homepage
│   │   ├── pricing/
│   │   ├── about/
│   │   ├── features/
│   │   └── blog/
│   ├── (auth)/              # Authentication route group
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── forgot-password/
│   ├── auth/callback/       # OAuth callback (outside route groups)
│   ├── api/                 # API routes
│   │   └── waitlist/route.ts
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/              # App-specific components only
│   ├── hero.tsx
│   ├── features-grid.tsx
│   └── pricing-card.tsx
├── content/                 # MDX blog content
├── public/                  # Static assets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

#### 3.2.6 Authentication Flow

Users who sign in at `apps/web/auth/sign-in` are redirected to their role-specific application:

```typescript
// After successful authentication
switch (user.role) {
  case 'teacher':
    redirect('https://teacher.edunexus.co.ke/dashboard');
  case 'learner':
    redirect('https://app.edunexus.co.ke/dashboard');
  case 'parent':
    redirect('https://parent.edunexus.co.ke/dashboard');
  case 'admin':
    redirect('https://admin.edunexus.co.ke/dashboard');
}
```

#### 3.2.7 Deployment

- **Platform:** Vercel
- **Domain:** `edunexus.co.ke`
- **CDN:** Vercel Edge Network
- **Preview deployments:** Enabled for every pull request
- **Production branch:** `main`

### 3.3 apps/teacher — Teacher-Facing Platform

#### 3.3.1 Purpose

`apps/teacher` is the primary EduNexus product. It is the application teachers use daily to generate lesson plans, create schemes of work, record work completed, manage assessments, view learner analytics, and interact with the EduNexus AI teaching assistant.

This is the highest-value, highest-traffic application in the EduNexus platform. It receives the most engineering attention and the most rigorous testing.

#### 3.3.2 Users

- Primary: Kenyan teachers (Grade 7–12, CBC and 8-4-4)
- Secondary: School administrators reviewing teacher work
- Pioneer beta: 50 teachers in the current phase

#### 3.3.3 Routing

```
/dashboard                  → Teacher home dashboard
/lesson-plans/              → All lesson plans
/lesson-plans/new           → Generate new lesson plan
/lesson-plans/[id]          → View/edit lesson plan
/lesson-plans/[id]/slides   → View lesson slides
/sow/                       → All schemes of work
/sow/new                    → Generate new scheme of work
/sow/[id]                   → View/edit scheme of work
/row/                       → Record of work
/row/[id]                   → Individual RoW entry
/assessments/               → Assessment management
/assessments/new            → Create assessment
/assessments/[id]           → View/edit assessment
/learners/                  → Learner roster
/learners/[id]              → Individual learner profile
/learners/[id]/progress     → Learner progress view
/analytics/                 → Class analytics
/clinic/                    → Academic clinic reports
/clinic/[id]                → Individual clinic report
/career/                    → Career guidance tools
/settings/                  → Teacher settings
/settings/subscription      → Token balance and billing
/onboarding/                → New teacher onboarding flow
```

#### 3.3.4 Technology

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS 4, `packages/ui`
- **State management:** React Server Components + `useOptimistic` + Server Actions
- **Rich text:** Tiptap (lesson plan editor)
- **Charts:** Recharts
- **PDF generation:** React PDF (client-side preview), `workers/pdf` (server-side generation)
- **Real-time:** Supabase Realtime (for live learner updates)

#### 3.3.5 Folder Structure

```
apps/teacher/
├── app/
│   ├── (auth)/              # Protected routes (require authentication)
│   │   ├── dashboard/
│   │   ├── lesson-plans/
│   │   ├── sow/
│   │   ├── row/
│   │   ├── assessments/
│   │   ├── learners/
│   │   ├── analytics/
│   │   ├── clinic/
│   │   ├── career/
│   │   └── settings/
│   ├── api/
│   │   ├── lesson-plans/
│   │   ├── sow/
│   │   ├── row/
│   │   ├── assessments/
│   │   ├── ai/
│   │   └── tokens/
│   ├── onboarding/
│   ├── auth/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── lesson-plan/
│   ├── sow/
│   ├── assessment/
│   ├── learner/
│   └── shared/
├── lib/                     # App-specific lib functions
│   ├── lesson-plan/
│   ├── sow/
│   ├── row/
│   ├── assessment/
│   └── ai/
├── public/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

#### 3.3.6 Shared Packages Used

- `@edunexus/ui` — All UI components
- `@edunexus/database` — Database client and type-safe queries
- `@edunexus/auth` — Authentication middleware and hooks
- `@edunexus/curriculum` — CBC curriculum data and types
- `@edunexus/ai` — AI prompt utilities
- `@edunexus/analytics` — Event tracking
- `@edunexus/validation` — Zod schemas for all forms

#### 3.3.7 Authentication

All routes under `app/(auth)/` require authentication. The middleware at `middleware.ts` validates the Supabase session and redirects unauthenticated users to `apps/web/auth/sign-in`.

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { user, response } = await validateSession(request);
  if (!user) {
    return NextResponse.redirect(new URL('/auth/sign-in', WEB_URL));
  }
  return response;
}
```

#### 3.3.8 Deployment

- **Platform:** Vercel
- **Domain:** `teacher.edunexus.co.ke`
- **Preview:** `teacher-[branch].edunexus.co.ke`
- **Scaling:** Vercel serverless functions, automatic scaling

### 3.4 apps/learner — Learner-Facing Platform

#### 3.4.1 Purpose

`apps/learner` is the student-facing application. Students use it for self-directed learning, assessment, career exploration, revision, and tracking their own progress. It is the primary interface through which the EduNexus Learner Intelligence Engine surfaces personalized content.

#### 3.4.2 Users

- Students in Grade 7–12 (CBC and 8-4-4)
- Age range: 12–18 years
- Variable digital literacy — the application must be simple, fast, and forgiving

#### 3.4.3 Routing

```
/dashboard                  → Student home (today's missions, progress)
/learn/                     → Learning modules browser
/learn/[subjectId]/         → Subject learning path
/learn/[subjectId]/[topicId] → Topic learning module
/assessments/               → My assessments
/assessments/[id]           → Take assessment
/assessments/[id]/results   → Assessment results
/career/                    → Career explorer
/career/[careerId]          → Career detail page
/career/simulate/[careerId] → Career life simulation
/progress/                  → My progress dashboard
/competencies/              → Competency map
/notes/                     → My notes
/revision/                  → Revision planner
/revision/[planId]          → Active revision plan
/settings/                  → Account settings
```

#### 3.4.4 Technology

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS 4, `packages/ui` (learner-optimized variant)
- **Animations:** Framer Motion (engagement-critical)
- **Offline support:** Service Worker, `next-pwa`
- **Gamification:** Achievement system with client-side celebration animations

#### 3.4.5 Offline Support

Students in Kenya may have intermittent connectivity. `apps/learner` implements a Progressive Web App (PWA) with offline capability for:

- Viewing previously loaded learning modules
- Completing assessments started while online
- Viewing revision plans
- Accessing downloaded competency maps

Online-required features (AI generation, real-time progress sync, career simulation) degrade gracefully with a clear offline indicator.

#### 3.4.6 Deployment

- **Platform:** Vercel
- **Domain:** `app.edunexus.co.ke`
- **PWA:** Yes — installable on Android and iOS

### 3.5 apps/parent — Parent-Facing Platform

#### 3.5.1 Purpose

`apps/parent` gives parents visibility into their child's educational progress. It surfaces weekly summaries, assessment results, competency development, attendance patterns, teacher communications, and AI-generated recommendations for supporting learning at home.

#### 3.5.2 Users

- Parents and guardians of students in Grade 7–12
- Variable digital literacy — may include users with limited smartphone experience
- Majority mobile access — must be mobile-first

#### 3.5.3 Routing

```
/dashboard                  → Parent home (child summary)
/children/                  → All children (for multi-child households)
/children/[id]/             → Child overview
/children/[id]/progress     → Academic progress
/children/[id]/assessments  → Assessment history
/children/[id]/competencies → Competency development
/children/[id]/career       → Career readiness
/notifications/             → All notifications
/reports/                   → Downloaded reports
/settings/                  → Account settings
```

#### 3.5.4 Technology

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS 4 with mobile-first defaults
- **Charts:** Recharts (simplified variants for non-technical users)
- **Notifications:** Supabase Realtime + web push

#### 3.5.5 Deployment

- **Platform:** Vercel
- **Domain:** `parent.edunexus.co.ke`
- **Mobile optimization:** Core Web Vitals CLS < 0.1, LCP < 2.5s on 3G

### 3.6 apps/admin — Internal Administration Platform

#### 3.6.1 Purpose

`apps/admin` is the internal operations platform for EduNexus staff. It provides:

- School and teacher management
- Token allocation and billing administration
- Content moderation
- AI generation audit logs
- System health monitoring
- Feature flag management
- User support tools

#### 3.6.2 Users

- EduNexus operations team
- EduNexus engineering team (for debugging)
- EduNexus finance team (for billing)

#### 3.6.3 Access Control

`apps/admin` has two levels of access:
- **Operations:** Can view all data, manage schools and teachers, handle support tickets
- **Engineering:** Can access debug views, audit logs, and system health

Access is controlled by a separate `admin_roles` table in Supabase with RLS policies that restrict access to users with the `admin` role.

#### 3.6.4 Routing

```
/dashboard                  → System overview
/schools/                   → School management
/schools/[id]               → School detail
/teachers/                  → Teacher management
/teachers/[id]              → Teacher detail
/learners/                  → Learner management
/tokens/                    → Token allocation
/billing/                   → Billing and subscriptions
/content/                   → Content moderation queue
/ai/                        → AI audit logs
/ai/[requestId]             → AI request detail
/system/                    → System health
/system/queues              → Queue status
/system/flags               → Feature flags
/support/                   → Support tickets
```

#### 3.6.5 Deployment

- **Platform:** Vercel (separate deployment with IP allowlisting)
- **Domain:** `admin.edunexus.co.ke`
- **Access:** IP allowlisted to EduNexus office and VPN

### 3.7 apps/analytics — Educational Analytics Dashboard

#### 3.7.1 Purpose

`apps/analytics` is the educational intelligence dashboard for school administrators, curriculum coordinators, and EduNexus data analysts. It visualizes learning outcomes, competency trends, teacher engagement, and system usage at the school, class, and national levels.

#### 3.7.2 Users

- School principals and administrators
- Curriculum coordinators
- EduNexus data team
- Pilot partner coordinators at KICD

#### 3.7.3 Key Features

- **National competency heatmaps** — Which CBC competencies are being mastered at what rates, by county and school
- **Teacher engagement analytics** — How teachers use EduNexus and which features drive the most learning outcomes
- **Assessment analytics** — Difficulty calibration, item analysis, cohort comparison
- **Learning path optimization** — Which content sequences produce the best learning outcomes
- **AI usage analytics** — Token consumption, generation quality scores, teacher satisfaction

#### 3.7.4 Technology

- **Framework:** Next.js 15 with heavy use of React Server Components
- **Charting:** Recharts + D3.js for complex visualizations
- **Maps:** Mapbox GL JS for Kenya county maps
- **Data:** ClickHouse for analytics queries, Supabase for operational data
- **Export:** CSV and PDF export for all reports

#### 3.7.5 Deployment

- **Platform:** Vercel
- **Domain:** `analytics.edunexus.co.ke`
- **Access:** Role-based (school admin sees their school, EduNexus team sees all)

### 3.8 apps/studio — Curriculum Content Authoring Studio

#### 3.8.1 Purpose

`apps/studio` is the internal curriculum authoring tool used by EduNexus's curriculum team to create, review, and maintain:

- CBC curriculum node definitions
- AI prompt templates
- Assessment question banks
- Learning module content
- Career pathway definitions
- Competency rubrics

#### 3.8.2 Users

- EduNexus curriculum team
- Partner curriculum reviewers
- KICD curriculum consultants (read-only access)

#### 3.8.3 Technology

- **Framework:** Next.js 15
- **Rich text editor:** Tiptap with custom curriculum-aware extensions
- **Asset management:** Supabase Storage
- **Workflow:** Review and approval system with version history

#### 3.8.4 Deployment

- **Platform:** Vercel
- **Domain:** `studio.edunexus.co.ke`
- **Access:** Internal only, authentication required

### 3.9 apps/developers — Developer Platform

#### 3.9.1 Purpose

`apps/developers` is the external developer platform at `developers.edunexus.co.ke`. It is the interface through which external developers discover, learn, and integrate with the EduNexus API, SDKs, and curriculum graph.

The complete product specification for this application is documented in `docs/dx-ecosystem-blueprint.md`.

#### 3.9.2 Users

- EdTech developers building applications on EduNexus APIs
- School technology administrators building custom integrations
- Researchers accessing the EduNexus curriculum graph
- Third-party assessment platform developers

#### 3.9.3 Key Sections

- **API Documentation:** Interactive API reference (Stoplight Elements)
- **SDK Reference:** TypeScript SDK documentation
- **AI Playground:** Live API exploration with token metering
- **EKG Explorer:** Visual knowledge graph browser
- **Webhooks:** Webhook configuration and testing
- **Marketplace:** Directory of third-party integrations
- **Quickstarts:** Getting started guides
- **Dashboard:** Developer account management

#### 3.9.4 Deployment

- **Platform:** Vercel
- **Domain:** `developers.edunexus.co.ke`
- **Documentation hosting:** Docusaurus-compatible MDX content

### 3.10 apps/docs — Public Documentation Site

#### 3.10.1 Purpose

`apps/docs` is the public-facing documentation for EduNexus teachers and parents. It contains:

- Help center articles
- Feature guides
- Video tutorial embeds
- FAQ sections
- Troubleshooting guides
- Release notes

#### 3.10.2 Technology

- **Framework:** Next.js 15
- **Content:** MDX files in `apps/docs/content/`
- **Search:** Algolia DocSearch
- **Versioning:** Each major version of EduNexus has its own documentation branch

#### 3.10.3 Deployment

- **Platform:** Vercel
- **Domain:** `docs.edunexus.co.ke`

---

## Chapter 4 — Shared Packages

### 4.1 Package Design Principles

Every package in `packages/` follows these design rules:

1. **Single responsibility** — Each package does one thing well
2. **Explicit public API** — Only what is exported from the package's `index.ts` is public
3. **No circular dependencies** — Enforced by ESLint and the Turborepo dependency graph
4. **Complete test coverage** — Every package has unit tests with > 80% coverage
5. **Typed public API** — Every exported function and type has explicit TypeScript types
6. **Documented** — Every package has a README describing its purpose and public API
7. **Versioned** — Every package has a semantic version in its `package.json`

### 4.2 Package Structure Template

Every package follows this structure:

```
packages/[name]/
├── src/
│   ├── index.ts             # Public API (only export from here)
│   └── [module]/
│       ├── [module].ts      # Implementation
│       └── [module].test.ts # Tests alongside implementation
├── package.json
├── tsconfig.json            # Extends @edunexus/typescript-config/base
└── README.md
```

### 4.3 packages/ui — Design System

#### 4.3.1 Responsibilities

`packages/ui` is the EduNexus design system. It is the single source of truth for all visual UI components used across every application.

Every component in `packages/ui` is:

- Accessible (WCAG 2.1 AA compliance)
- Responsive (mobile-first)
- Tested (React Testing Library)
- Documented (Storybook)
- Themeable (Tailwind CSS tokens)

#### 4.3.2 Component Categories

```
packages/ui/src/
├── primitives/
│   ├── button.tsx           # Button (all variants)
│   ├── input.tsx            # Text input
│   ├── select.tsx           # Select dropdown
│   ├── checkbox.tsx         # Checkbox
│   ├── radio.tsx            # Radio button
│   ├── switch.tsx           # Toggle switch
│   ├── textarea.tsx         # Textarea
│   ├── badge.tsx            # Status badge
│   ├── avatar.tsx           # User avatar
│   └── spinner.tsx          # Loading spinner
├── layout/
│   ├── card.tsx             # Card container
│   ├── modal.tsx            # Modal/dialog
│   ├── drawer.tsx           # Side drawer
│   ├── tabs.tsx             # Tab navigation
│   ├── accordion.tsx        # Accordion/collapsible
│   └── tooltip.tsx          # Tooltip
├── navigation/
│   ├── sidebar.tsx          # Application sidebar
│   ├── top-nav.tsx          # Top navigation bar
│   ├── breadcrumbs.tsx      # Breadcrumb trail
│   └── pagination.tsx       # Pagination controls
├── feedback/
│   ├── alert.tsx            # Alert/notification
│   ├── toast.tsx            # Toast notification
│   ├── progress.tsx         # Progress bar
│   ├── skeleton.tsx         # Loading skeleton
│   └── empty-state.tsx      # Empty state illustration
├── data/
│   ├── table.tsx            # Data table
│   ├── data-list.tsx        # Data list
│   └── stat-card.tsx        # Statistics card
├── forms/
│   ├── form.tsx             # Form wrapper with React Hook Form integration
│   ├── form-field.tsx       # Form field with label and error
│   └── file-upload.tsx      # File upload component
└── educational/
    ├── competency-radar.tsx  # Competency spider chart
    ├── lesson-card.tsx       # Lesson plan card
    ├── assessment-card.tsx   # Assessment summary card
    └── progress-ring.tsx     # Circular progress indicator
```

#### 4.3.3 Storybook

`packages/ui` ships with a complete Storybook. Every component has:
- Default story
- All variant stories
- Responsive stories (mobile, tablet, desktop)
- Dark mode stories
- Accessibility audit results

Running `pnpm --filter @edunexus/ui storybook` starts the Storybook server.

#### 4.3.4 Dependency Rules

`packages/ui` may only depend on:
- `@edunexus/icons`
- `@edunexus/utils`
- External UI primitives: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`

`packages/ui` may NOT depend on:
- `@edunexus/database`
- `@edunexus/ai`
- `@edunexus/auth`
- Any application package

### 4.4 packages/icons — Icon Library

#### 4.4.1 Responsibilities

`packages/icons` provides the complete EduNexus icon set as optimized SVG React components. All icons are available in multiple sizes (16, 20, 24, 32) and follow a consistent naming convention.

#### 4.4.2 Icon Categories

```
packages/icons/src/
├── navigation/              # Menu, arrow, chevron icons
├── action/                  # Edit, delete, share, download icons
├── status/                  # Check, error, warning, info icons
├── educational/             # Book, pencil, brain, curriculum icons
├── assessment/              # Quiz, grade, rubric icons
├── career/                  # Job, university, skill icons
├── data/                    # Chart, graph, analytics icons
└── communication/           # Message, notification, email icons
```

#### 4.4.3 Generation

Icons are generated from Figma exports using `tooling/codegen/`. Running `pnpm generate:icons` regenerates all icons from the latest Figma export.

### 4.5 packages/config — Runtime Configuration

#### 4.5.1 Responsibilities

`packages/config` centralizes all runtime configuration for the EduNexus platform. It provides:

- Environment variable validation (using Zod)
- Application URLs for cross-app linking
- Feature flags
- Token costs and limits
- AI model configuration
- Rate limiting configuration

#### 4.5.2 Key Exports

```typescript
// @edunexus/config
export { env } from './src/env';           // Validated environment variables
export { appUrls } from './src/urls';       // Application URL map
export { tokenCosts } from './src/tokens';  // TOKEN_COSTS — single source of truth
export { aiConfig } from './src/ai';        // AI model configuration
export { rateLimits } from './src/limits';  // Rate limit configuration
```

#### 4.5.3 Environment Validation

```typescript
// packages/config/src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEEPSEEK_API_KEY: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

export const env = EnvSchema.parse(process.env);
```

This validation runs at startup. If any required environment variable is missing or malformed, the application fails immediately with a clear error — never silently in production.

### 4.6 packages/eslint-config — ESLint Configuration

#### 4.6.1 Responsibilities

`packages/eslint-config` defines all ESLint rules for the EduNexus platform. It is the single source of truth for code style and quality enforcement.

#### 4.6.2 Rule Sets

```typescript
// packages/eslint-config/src/
├── base.js                  # Base TypeScript rules (applies everywhere)
├── next.js                  # Next.js-specific rules
├── react.js                 # React component rules
├── imports.js               # Import order and restriction rules
└── ai.js                    # Special rules for AI-adjacent code
```

#### 4.6.3 Critical Rules

```javascript
// packages/eslint-config/src/base.js
module.exports = {
  rules: {
    // No any types
    '@typescript-eslint/no-explicit-any': 'error',
    // No unused variables
    '@typescript-eslint/no-unused-vars': 'error',
    // No console.log in production
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    // No default exports (named exports are searchable)
    'import/prefer-default-export': 'off',
    'import/no-default-export': 'error',  // Except Next.js pages
    // No direct supabase-js imports
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@supabase/supabase-js'],
          importNames: ['createClient'],
          message: 'Use @edunexus/database createServiceClient() or createBrowserClient() instead'
        }
      ]
    }],
  }
};
```

### 4.7 packages/typescript-config — TypeScript Configuration

#### 4.7.1 Responsibilities

`packages/typescript-config` provides shared `tsconfig.json` bases for all packages and applications.

#### 4.7.2 Configurations Provided

```
packages/typescript-config/
├── base.json                # Base strict configuration
├── nextjs.json              # Next.js App Router configuration
├── react-library.json       # React component library configuration
└── node.json                # Node.js service configuration
```

#### 4.7.3 Base Configuration

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 4.8 packages/sdk — Public EduNexus SDK

#### 4.8.1 Responsibilities

`packages/sdk` is the public JavaScript/TypeScript SDK for the EduNexus API. External developers use it to:

- Authenticate with the EduNexus API
- Query the curriculum graph
- Generate lesson plans programmatically
- Create and manage assessments
- Access learner profiles (with permission)
- Receive webhooks

The SDK is published to npm as `@edunexus/sdk`.

#### 4.8.2 Design Philosophy

The SDK follows the same design philosophy as Stripe's Node.js SDK: typed, chainable, and forgiving. Error messages are actionable. Types are complete. Documentation is inline.

```typescript
import { EduNexus } from '@edunexus/sdk';

const client = new EduNexus({ apiKey: 'en_live_...' });

// Generate a lesson plan
const lessonPlan = await client.lessonPlans.generate({
  subject: 'Mathematics',
  topic: 'Quadratic Equations',
  grade: 10,
  duration: 40,
  curriculum: 'cbc-senior',
});

// Fetch a curriculum node
const node = await client.curriculum.getNode({
  subject: 'Mathematics',
  strand: 'Algebra',
  subStrand: 'Quadratic Equations',
  grade: 10,
});
```

#### 4.8.3 Folder Structure

```
packages/sdk/src/
├── client.ts                # Main EduNexus client class
├── resources/
│   ├── curriculum.ts        # Curriculum resource
│   ├── lesson-plans.ts      # Lesson plans resource
│   ├── assessments.ts       # Assessments resource
│   ├── learners.ts          # Learners resource
│   ├── teachers.ts          # Teachers resource
│   └── webhooks.ts          # Webhooks resource
├── types/
│   ├── curriculum.ts        # Curriculum types
│   ├── lesson-plan.ts       # Lesson plan types
│   └── shared.ts            # Shared types (pagination, errors)
├── errors.ts                # SDK error classes
├── http.ts                  # HTTP client (fetch-based)
└── index.ts                 # Public API
```

### 4.9 packages/database — Database Layer

#### 4.9.1 Responsibilities

`packages/database` is the most critical shared package. It provides:

- The Supabase client factories (browser and server/service)
- TypeScript types generated from the Supabase schema
- Type-safe query builders for common operations
- Database error types

#### 4.9.2 Critical Rule

**`packages/database` is the ONLY package that creates Supabase clients.** No application, service, or worker may import `createClient` from `@supabase/supabase-js` directly. This is enforced by ESLint.

#### 4.9.3 Client Factories

```typescript
// packages/database/src/client/server.ts
import { createServerClient } from '@supabase/ssr';
import type { Database } from '../types/supabase';

export function createServerSupabaseClient(
  cookieStore: ReadonlyRequestCookies
) {
  return createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    { cookies: cookieStore }
  );
}

// packages/database/src/client/service.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export function createServiceClient() {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// packages/database/src/client/browser.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/supabase';

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
  );
}
```

#### 4.9.4 Type Generation

The `Database` type is generated from the live Supabase schema using:

```bash
supabase gen types typescript \
  --project-id $SUPABASE_PROJECT_ID \
  > packages/database/src/types/supabase.ts
```

This command is run as part of `turbo generate` and committed to the repository. The generated types are the contract between the application and the database.

### 4.10 packages/auth — Authentication

#### 4.10.1 Responsibilities

`packages/auth` provides:

- Session validation utilities
- Middleware factories for Next.js route protection
- User role type definitions
- Auth error types
- Helper functions for common auth operations

#### 4.10.2 Key Exports

```typescript
// @edunexus/auth
export { withAuth } from './src/middleware';          // Route protection middleware
export { getSession } from './src/session';           // Get current session
export { requireRole } from './src/authorization';    // Role-based access control
export type { AuthUser, UserRole } from './src/types';
```

### 4.11 packages/curriculum — CBC Curriculum

#### 4.11.1 Responsibilities

`packages/curriculum` is one of EduNexus's most strategically important packages. It encodes the complete Kenya CBC and 8-4-4 curricula as typed data structures that can be queried, traversed, and used as context for AI generation.

#### 4.11.2 Contents

```
packages/curriculum/src/
├── data/
│   ├── cbc-junior/          # CBC Junior Secondary (Grade 7–9) data
│   ├── cbc-senior/          # CBC Senior Secondary (Grade 10–12) data
│   └── 8-4-4/               # 8-4-4 (Form 3–4) data
├── graph/
│   ├── builder.ts           # Builds the curriculum graph from data
│   ├── traversal.ts         # Graph traversal algorithms
│   └── search.ts            # Curriculum node search
├── types/
│   ├── node.ts              # CurriculumNode type
│   ├── competency.ts        # Competency type
│   ├── strand.ts            # Strand and SubStrand types
│   └── learning-outcome.ts  # LearningOutcome type
├── validators/
│   └── node.ts              # Zod schemas for curriculum nodes
└── index.ts
```

#### 4.11.3 Curriculum Data Structure

```typescript
type CurriculumNode = {
  id: string;
  curriculumType: 'cbc-junior' | 'cbc-senior' | '8-4-4';
  grade: number;
  subject: string;
  strand: string;
  subStrand: string;
  topic: string;
  learningOutcomes: LearningOutcome[];
  coreCompetencies: CoreCompetency[];
  suggestedLearningActivities: string[];
  keyInquiryQuestions: string[];
  assessmentRubric: AssessmentRubric;
  prerequisiteNodes: string[];      // Node IDs
  prerequisiteOf: string[];         // Node IDs
  lessonCount: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
};
```

### 4.12 packages/ai — AI Utilities

#### 4.12.1 Responsibilities

`packages/ai` provides:

- DeepSeek API client configuration
- Prompt template utilities
- Token counting utilities
- AI response streaming utilities
- Model configuration types

#### 4.12.2 Architecture Note

`packages/ai` provides the low-level AI utilities. The actual prompt logic — generating lesson plans, creating assessments, modeling learners — lives in the application-specific `lib/` directories or in `services/ai/`. `packages/ai` does not contain prompts; it provides the infrastructure to execute them.

### 4.13 packages/validation — Shared Zod Schemas

#### 4.13.1 Responsibilities

`packages/validation` contains Zod schemas for all shared domain types: `Teacher`, `Learner`, `LessonPlan`, `SchemeOfWork`, `Assessment`, `TokenBalance`, and so on.

These schemas serve multiple purposes:
- API route input validation
- Form validation (with React Hook Form integration)
- Runtime type checking
- Documentation (schemas describe the shape of data)

#### 4.13.2 Schema Co-location

Schemas in `packages/validation` are co-located with their TypeScript types:

```typescript
// packages/validation/src/lesson-plan.ts
import { z } from 'zod';

export const LessonPlanSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  subject: z.string().min(1).max(100),
  topic: z.string().min(1).max(200),
  grade: z.number().int().min(7).max(12),
  duration: z.number().int().min(20).max(120),
  curriculumType: z.enum(['cbc-junior', 'cbc-senior', '8-4-4']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LessonPlan = z.infer<typeof LessonPlanSchema>;
```

### 4.14 packages/events — Event Bus

#### 4.14.1 Responsibilities

`packages/events` defines the event types and publishers for the EduNexus event system. Events are the primary mechanism for cross-service communication.

#### 4.14.2 Event Categories

```typescript
// packages/events/src/types/
├── lesson-plan.ts           # LessonPlanGenerated, LessonPlanPublished
├── assessment.ts            # AssessmentCreated, AssessmentSubmitted, AssessmentGraded
├── learner.ts               # LearnerEnrolled, LearnerProgressUpdated
├── token.ts                 # TokensDeducted, TokensPurchased
├── notification.ts          # NotificationRequested
└── analytics.ts             # AnalyticsEvent (base type for all analytics)
```

#### 4.14.3 Event Schema

```typescript
type EduNexusEvent<T extends string, P extends Record<string, unknown>> = {
  eventId: string;           // UUID, idempotency key
  eventType: T;
  version: '1.0';
  timestamp: string;         // ISO 8601
  sourceService: string;
  correlationId: string;     // For tracing
  payload: P;
};
```

### 4.15 packages/observability — Tracing and Metrics

#### 4.15.1 Responsibilities

`packages/observability` provides:

- OpenTelemetry tracer setup
- Span creation utilities
- Metric recorder utilities
- Health check response builders
- Request ID generation

#### 4.15.2 Key Exports

```typescript
// @edunexus/observability
export { tracer } from './src/tracing';
export { metrics } from './src/metrics';
export { createHealthResponse } from './src/health';
export { generateRequestId, generateCorrelationId } from './src/ids';
export { withSpan } from './src/decorators';
```

---

# Part III — Backend

---

## Chapter 5 — Services

### 5.1 Service Architecture Philosophy

EduNexus's backend services are not arbitrary microservices created to follow a trend. Each service exists because it has:

1. **A distinct scaling profile** — The AI service scales for computation-heavy generation tasks. The notification service scales for high-throughput delivery. These different scaling needs justify separation.
2. **A distinct failure mode** — If the search service is unavailable, teachers can still generate lesson plans. Service isolation limits the blast radius of failures.
3. **A clear domain boundary** — Each service owns a clear slice of the domain model.
4. **A stable API contract** — Services communicate through HTTP APIs with versioned, OpenAPI-documented contracts.

Services do not share databases. Each service has its own tables (though they live in the same Supabase project during the current phase — schema isolation enforced through naming conventions and RLS).

### 5.2 services/gateway — API Gateway

#### 5.2.1 Purpose

The API gateway is the single entry point for all external API requests. It handles:

- Authentication verification (validates Supabase JWTs)
- Rate limiting (by user, IP, and plan tier)
- Request routing to downstream services
- Request/response logging
- API key management for the developer platform
- CORS policy enforcement

#### 5.2.2 Folder Structure

```
services/gateway/
├── src/
│   ├── middleware/
│   │   ├── auth.ts          # JWT validation
│   │   ├── rate-limit.ts    # Rate limiting (Redis-backed)
│   │   ├── cors.ts          # CORS policy
│   │   └── logging.ts       # Request logging
│   ├── routes/
│   │   ├── ai.ts            # Routes to services/ai
│   │   ├── curriculum.ts    # Routes to services/knowledge-graph
│   │   └── analytics.ts     # Routes to services/analytics
│   ├── health/
│   │   └── check.ts         # /health endpoint
│   └── index.ts
├── tests/
├── Dockerfile
├── package.json
└── tsconfig.json
```

#### 5.2.3 Runtime

- **Runtime:** Bun (for high-performance HTTP handling)
- **Deployment:** Fly.io (low latency, African PoP available)
- **Scaling:** Horizontal (stateless, session data in Redis)

#### 5.2.4 Rate Limits

Rate limits are applied at three levels:

| Level | Window | Limit (Free) | Limit (Pro) | Limit (School) |
|-------|--------|--------------|-------------|----------------|
| Per User | 1 minute | 10 req | 60 req | 120 req |
| Per User | 1 hour | 100 req | 1000 req | 5000 req |
| Per IP | 1 minute | 30 req | 30 req | 30 req |
| AI Generation | 1 hour | 5 req | 50 req | 200 req |

### 5.3 services/ai — AI Orchestration Service

#### 5.3.1 Purpose

`services/ai` is the AI orchestration layer. It receives generation requests from applications and workers, constructs prompts from `packages/curriculum` context, calls the DeepSeek API (or other configured providers), validates responses, deducts tokens, and returns structured output.

#### 5.3.2 Why a Dedicated Service?

AI generation is the most expensive and most failure-prone operation in EduNexus. Isolating it in a dedicated service allows:

- Independent scaling (compute-intensive)
- Independent deployment (model upgrades don't require re-deploying teacher app)
- Centralized token accounting
- Centralized prompt versioning
- Centralized quality monitoring

#### 5.3.3 Folder Structure

```
services/ai/
├── src/
│   ├── generators/
│   │   ├── lesson-plan.ts   # Lesson plan generation
│   │   ├── sow.ts           # Scheme of work generation
│   │   ├── assessment.ts    # Assessment generation
│   │   ├── feedback.ts      # Student feedback generation
│   │   └── clinic.ts        # Academic clinic report generation
│   ├── prompts/
│   │   ├── templates/       # Prompt templates (versioned)
│   │   └── builder.ts       # Prompt construction utilities
│   ├── providers/
│   │   ├── deepseek.ts      # DeepSeek provider
│   │   └── registry.ts      # Provider registry
│   ├── quality/
│   │   ├── validator.ts     # Response quality validation
│   │   └── scorer.ts        # Response quality scoring
│   ├── tokens/
│   │   └── deduction.ts     # Token deduction after generation
│   ├── routes/
│   │   ├── generate/        # Generation endpoints
│   │   └── health.ts        # Health check
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── prompts/                 # Versioned prompt files (Markdown)
│   ├── v1/
│   └── v2/
├── Dockerfile
├── package.json
└── tsconfig.json
```

#### 5.3.4 Generation Flow

```
Request → Gateway → services/ai
  1. Validate request (auth, input schema)
  2. Check token balance (services/billing)
  3. Load curriculum context (packages/curriculum)
  4. Build prompt (src/prompts/builder.ts)
  5. Call AI provider (src/providers/deepseek.ts)
  6. Validate response quality (src/quality/validator.ts)
  7. Deduct tokens (src/tokens/deduction.ts)
  8. Publish event (LessonPlanGenerated)
  9. Return structured response
```

#### 5.3.5 API Contract

```typescript
// POST /generate/lesson-plan
type LessonPlanGenerateRequest = {
  subject: string;
  topic: string;
  grade: number;
  duration: number;
  curriculumType: 'cbc-junior' | 'cbc-senior' | '8-4-4';
  learnerLevel?: 'below-expected' | 'at-expected' | 'above-expected';
  specificObjectives?: string[];
};

type LessonPlanGenerateResponse = {
  lessonPlan: GeneratedLessonPlan;
  tokensUsed: number;
  generationId: string;
  qualityScore: number;
};
```

#### 5.3.6 Deployment

- **Runtime:** Bun
- **Deployment:** Fly.io (GPU-capable machines when needed)
- **Scaling:** Horizontal with queue-based backpressure

### 5.4 services/knowledge-graph — Curriculum Knowledge Graph

#### 5.4.1 Purpose

`services/knowledge-graph` provides the queryable interface to the EduNexus Educational Knowledge Graph (EKG). The EKG is described in full in `docs/the-educational-knowledge-graph.md`.

This service exposes:

- Graph traversal queries (prerequisite paths, learning sequences)
- Semantic similarity queries (find similar topics)
- Competency mapping queries (which topics develop which competencies)
- Curriculum coverage queries (what has been taught, what remains)

#### 5.4.2 Backend

The EKG is stored in a hybrid architecture:
- **Node data:** Supabase (PostgreSQL) with `pgvector` for semantic embeddings
- **Graph edges:** PostgreSQL adjacency lists (appropriate at CBC curriculum scale)
- **Full-text search:** PostgreSQL `tsvector` columns with GIN indexes

#### 5.4.3 Folder Structure

```
services/knowledge-graph/
├── src/
│   ├── graph/
│   │   ├── traversal.ts     # BFS/DFS traversal
│   │   ├── shortest-path.ts # Learning path optimization
│   │   └── subgraph.ts      # Subgraph extraction
│   ├── search/
│   │   ├── semantic.ts      # pgvector semantic search
│   │   └── text.ts          # Full-text search
│   ├── routes/
│   │   ├── nodes/           # Node CRUD
│   │   ├── paths/           # Path queries
│   │   └── search/          # Search endpoints
│   └── index.ts
├── Dockerfile
└── package.json
```

### 5.5 services/analytics — Analytics Service

#### 5.5.1 Purpose

`services/analytics` receives analytics events from all applications, stores them in ClickHouse, and provides aggregate query capabilities for `apps/analytics`.

#### 5.5.2 Architecture

```
Browser/Server → analytics.track() → services/gateway → services/analytics
  → Write to ClickHouse (async, batched)
  → Aggregate in workers/analytics
  → Query via services/analytics REST API
```

#### 5.5.3 Event Schema

```typescript
type AnalyticsEvent = {
  eventId: string;
  eventType: string;
  userId: string;
  userRole: 'teacher' | 'learner' | 'parent' | 'admin';
  sessionId: string;
  timestamp: string;
  properties: Record<string, string | number | boolean>;
  appVersion: string;
  appName: string;
};
```

### 5.6 services/notifications — Notification Service

#### 5.6.1 Purpose

`services/notifications` is the unified notification dispatch layer. Applications request notifications through this service; the service handles:

- Channel selection (email, SMS, push, in-app)
- Template rendering
- Delivery scheduling
- Delivery tracking
- Retry logic

#### 5.6.2 Notification Types

| Type | Channels | Use Cases |
|------|----------|-----------|
| Teacher engagement | Email, push | Weekly usage summary, AI feature announcements |
| Parent pulse | WhatsApp (Africa's Talking), email | Weekly child progress summary |
| Assessment reminder | Push, SMS | Upcoming assessments |
| Token alert | Email, push | Low token balance warning |
| System | Email | Account changes, security alerts |

#### 5.6.3 API Contract

```typescript
// POST /notifications/send
type SendNotificationRequest = {
  recipientId: string;
  notificationType: NotificationType;
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
  templateId: string;
  templateData: Record<string, string | number>;
  scheduledAt?: string;  // ISO 8601, undefined = send immediately
  priority: 'high' | 'normal' | 'low';
};
```

### 5.7 services/billing — Billing and Tokens

#### 5.7.1 Purpose

`services/billing` manages the EduNexus token economy:

- Paystack webhook processing (subscription payments, one-time purchases)
- Token balance management
- Token deduction authorization
- Subscription plan management
- Invoice generation

#### 5.7.2 Idempotency

All Paystack webhook handlers are idempotent. Before processing any webhook:

```typescript
async function processPaystackWebhook(event: PaystackEvent): Promise<void> {
  // 1. Verify Paystack signature
  verifyPaystackSignature(event, env.PAYSTACK_SECRET_KEY);
  
  // 2. Check for existing transaction (idempotency)
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.paystackReference, event.data.reference)
  });
  if (existing) return; // Already processed
  
  // 3. Process payment
  await processPayment(event);
}
```

### 5.8 services/search — Search Service

#### 5.8.1 Purpose

`services/search` provides full-text and semantic search across EduNexus content:

- Lesson plan search
- Assessment question search
- Curriculum topic search
- Career path search
- Blog content search

#### 5.8.2 Architecture

- **Full-text search:** PostgreSQL `tsvector` with GIN indexes (Supabase native)
- **Semantic search:** `pgvector` with `text-embedding-3-small` embeddings
- **Reindexing:** Triggered by database webhooks via `workers/sync`

### 5.9 services/webhooks — Webhook Delivery

#### 5.9.1 Purpose

`services/webhooks` manages the delivery of EduNexus event webhooks to external developer applications. It:

- Maintains webhook endpoint registrations
- Signs webhook payloads (HMAC-SHA256)
- Delivers events with retry logic
- Provides delivery logs and replay capability

#### 5.9.2 Delivery Guarantee

EduNexus webhooks offer **at-least-once delivery**. Developers must implement idempotency by checking the `eventId` field.

### 5.10 services/identity — Identity Service

#### 5.10.1 Purpose

`services/identity` extends Supabase Auth with EduNexus-specific identity features:

- Role assignment and management
- Multi-school affiliation (a teacher at two schools)
- School code registration flow
- SSO integration for school identity providers (ADFS, Google Workspace)
- API key management for developer platform

---

## Chapter 6 — Workers

### 6.1 Worker Architecture Philosophy

Workers are the asynchronous backbone of EduNexus. They process jobs that:

- Are too slow for synchronous HTTP (PDF generation, email delivery)
- Must be retried on failure (webhook delivery, AI generation)
- Are batched for efficiency (analytics aggregation, notification dispatch)
- Are scheduled (weekly parent summaries, usage reports)

All workers use BullMQ backed by Redis for job queuing.

### 6.2 Queue Topology

```
edunexus:ai:generation         → workers/ai
edunexus:email:delivery        → workers/email
edunexus:sms:delivery          → workers/sms
edunexus:analytics:aggregation → workers/analytics
edunexus:webhook:delivery      → workers/webhooks
edunexus:sync:reindex          → workers/sync
edunexus:pdf:generation        → workers/pdf
edunexus:import:process        → workers/import
edunexus:schedule:tick         → workers/scheduler
edunexus:dlq:*                 → workers/dead-letter (receives from all queues)
```

### 6.3 workers/ai — AI Generation Worker

#### 6.3.1 Purpose

The AI worker handles bulk AI generation jobs that are too slow for synchronous HTTP — specifically:

- Batch lesson plan generation (end-of-term scheme generation)
- Bulk assessment generation
- Weekly parent pulse AI narratives
- Holiday revision plan generation for all enrolled learners

#### 6.3.2 Job Schema

```typescript
type AIGenerationJob = {
  jobType: 'lesson-plan' | 'assessment' | 'parent-pulse' | 'revision-plan';
  teacherId?: string;
  learnerId?: string;
  context: Record<string, unknown>;
  priority: 1 | 2 | 3 | 4 | 5;  // 1 = highest priority
  callbackUrl?: string;
};
```

#### 6.3.3 Retry Policy

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,  // 2s, 4s, 8s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
}
```

### 6.4 workers/email — Email Worker

#### 6.4.1 Purpose

Handles all outbound email delivery via AWS SES. Email templates are React Email components rendered server-side to HTML.

#### 6.4.2 Email Templates

```
workers/email/src/templates/
├── welcome.tsx              # New account welcome email
├── lesson-plan-ready.tsx    # AI generation complete notification
├── weekly-summary.tsx       # Teacher weekly usage summary
├── parent-report.tsx        # Parent weekly progress report
├── payment-receipt.tsx      # Token purchase receipt
├── low-balance.tsx          # Low token balance warning
├── password-reset.tsx       # Password reset email
└── school-invitation.tsx    # School code invitation
```

#### 6.4.3 Delivery Tracking

Every email is tracked through AWS SES events (delivered, bounced, complained). Bounces and complaints are processed by `workers/webhooks` and update the recipient's notification preferences.

### 6.5 workers/sms — SMS Worker

#### 6.5.1 Purpose

Delivers SMS notifications via Africa's Talking. Primary use cases:

- Parent notifications (WhatsApp-like SMS for low-data parents)
- Critical alerts (account security, payment confirmation)
- Assessment reminders

Africa's Talking is chosen for its East Africa coverage and Kenya-specific virtual number support.

### 6.6 workers/analytics — Analytics Worker

#### 6.6.1 Purpose

The analytics worker performs the aggregate computations that power `apps/analytics`:

- Daily competency mastery rates by class and school
- Weekly teacher engagement scores
- Monthly assessment difficulty calibration
- Term-end progress reports

These computations run on ClickHouse materialized views, refreshed nightly by the analytics worker.

### 6.7 workers/pdf — PDF Generation Worker

#### 6.7.1 Purpose

Generates high-quality PDF documents:

- Lesson plans (formatted for printing and sharing)
- Schemes of work (full-term planning documents)
- Academic clinic reports (student performance analysis)
- Certificate of Achievement (learner milestone certificates)
- School analytics reports

#### 6.7.2 Technology

PDF generation uses Puppeteer to render Next.js-compatible HTML templates to PDF. The rendered PDFs are stored in Supabase Storage and linked back to the originating records.

### 6.8 workers/import — Data Import Worker

#### 6.8.1 Purpose

Processes bulk data imports:

- School roster imports (CSV of student names and classes)
- Historical assessment data imports
- Curriculum mapping imports (for schools with custom sequences)

#### 6.8.2 Import Flow

```
1. Teacher uploads CSV to Supabase Storage
2. Upload event triggers import job (via Supabase webhook)
3. workers/import:
   a. Downloads CSV from Storage
   b. Validates rows (Zod schema)
   c. Reports validation errors to teacher
   d. Inserts valid rows in batches of 100
   e. Notifies teacher of completion
```

### 6.9 workers/scheduler — Cron Orchestrator

#### 6.9.1 Purpose

The scheduler is the cron system for EduNexus. It does not execute jobs directly — it enqueues jobs in the appropriate BullMQ queue at the scheduled time.

#### 6.9.2 Schedule Registry

```typescript
// workers/scheduler/src/registry.ts
export const SCHEDULE_REGISTRY: ScheduleDefinition[] = [
  {
    name: 'weekly-parent-pulse',
    cron: '0 7 * * 0',  // Every Sunday at 7am EAT
    queue: 'edunexus:ai:generation',
    jobType: 'parent-pulse',
  },
  {
    name: 'daily-analytics-aggregation',
    cron: '0 2 * * *',  // Every day at 2am EAT
    queue: 'edunexus:analytics:aggregation',
    jobType: 'aggregate-daily',
  },
  {
    name: 'token-balance-alerts',
    cron: '0 8 * * 1',  // Every Monday at 8am EAT
    queue: 'edunexus:email:delivery',
    jobType: 'low-balance-alert',
  },
];
```

### 6.10 Idempotency in Workers

All workers implement idempotency at the job level. Before processing any job, the worker checks whether the job has already been successfully processed:

```typescript
async function processJob(job: Job<AIGenerationJob>): Promise<void> {
  const lockKey = `worker:lock:${job.id}`;
  const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
  if (!locked) {
    // Job already processing or processed
    return;
  }
  
  try {
    await executeJob(job.data);
    await redis.del(lockKey);
  } catch (error) {
    await redis.del(lockKey);
    throw error;
  }
}
```

---

# Part IV — Engineering Tooling

---

## Chapter 7 — Tooling

### 7.1 Philosophy

EduNexus invests heavily in developer tooling because every minute a developer spends on manual processes is a minute not spent building educational value. The rule is: **if a developer does it twice, automate it; if they do it once, document it**.

### 7.2 tooling/cli — EduNexus CLI

#### 7.2.1 Purpose

The `edunexus` CLI is the primary developer experience tool. It is installed globally once and provides commands for common development tasks.

```bash
# Install
pnpm add -g @edunexus/cli

# Usage
edunexus dev           # Start all apps and services
edunexus dev teacher   # Start only the teacher app
edunexus generate      # Run all code generators
edunexus db seed       # Seed the local database
edunexus db reset      # Reset the local database to seed state
edunexus test          # Run all tests
edunexus lint          # Lint all packages
edunexus build         # Build all packages
edunexus release       # Interactive release workflow
```

#### 7.2.2 Implementation

The CLI is built with `commander.js` and ships as a standalone binary via `pkg`.

```
tooling/cli/src/
├── commands/
│   ├── dev.ts           # Development server management
│   ├── generate.ts      # Code generation commands
│   ├── db.ts            # Database management commands
│   ├── test.ts          # Test runner
│   ├── lint.ts          # Linting
│   └── release.ts       # Release workflow
├── utils/
│   ├── process.ts       # Process management (spawn, kill)
│   ├── docker.ts        # Docker Compose utilities
│   └── git.ts           # Git utilities
└── index.ts             # CLI entry point
```

### 7.3 tooling/openapi-generator — API Client Generator

#### 7.3.1 Purpose

Generates type-safe HTTP client code from the OpenAPI specification maintained in `infra/openapi/`. This ensures that `packages/api-client` is always in sync with the actual API contract.

#### 7.3.2 Generation Command

```bash
pnpm --filter @edunexus/openapi-generator generate

# Output: packages/api-client/src/generated/
```

The generated client uses `fetch` with typed request/response bodies and is used internally by all applications to call backend services.

### 7.4 tooling/sdk-generator — SDK Generator

#### 7.4.1 Purpose

Generates the public EduNexus SDK (`packages/sdk`) from the OpenAPI specification. The SDK is a superset of the generated API client — it adds developer-friendly abstractions, pagination helpers, retry logic, and comprehensive TypeScript types.

### 7.5 tooling/db-generator — Database Type Generator

#### 7.5.1 Purpose

Generates TypeScript types from the Supabase schema. This is a thin wrapper around the Supabase CLI's type generation command that:

1. Connects to the configured Supabase project
2. Generates types to `packages/database/src/types/supabase.ts`
3. Validates the generated types compile successfully
4. Runs affected tests

```bash
pnpm generate:types
```

### 7.6 tooling/graph-generator — Curriculum Graph Generator

#### 7.6.1 Purpose

Generates the curriculum data structures in `packages/curriculum/src/data/` from the master curriculum spreadsheets maintained by the curriculum team.

The curriculum team maintains curriculum data in Google Sheets (structured format). The graph generator:

1. Pulls the latest curriculum data via Google Sheets API
2. Validates all entries against the `CurriculumNodeSchema`
3. Generates the TypeScript data files
4. Builds the graph structure
5. Generates semantic embeddings for each node (for semantic search)
6. Writes all outputs to `packages/curriculum/src/data/`

### 7.7 tooling/prompt-validator — Prompt Template Validator

#### 7.7.1 Purpose

AI prompt templates are critical infrastructure. The prompt validator:

1. Parses prompt templates in `services/ai/prompts/`
2. Validates that all template variables are defined
3. Validates that the prompt does not exceed the configured token budget
4. Runs the prompt against a sample set of inputs and validates the output structure
5. Generates a prompt metadata file with token count and complexity estimates

### 7.8 tooling/ai-evaluator — AI Quality Evaluation

#### 7.8.1 Purpose

Measures the quality of AI-generated content before deploying prompt changes. The evaluator:

1. Takes a sample of 100 real generation requests from production logs
2. Runs them against the new prompt version
3. Scores outputs on: curriculum alignment, language quality, pedagogical validity, format compliance
4. Compares scores against the current production prompt version
5. Reports a go/no-go recommendation

Quality must equal or improve before a prompt update ships to production.

### 7.9 tooling/docs-generator — Documentation Generator

#### 7.9.1 Purpose

Generates API reference documentation from:

- OpenAPI specifications → REST API reference
- TypeDoc comments in `packages/sdk` → SDK reference
- Prompt templates in `services/ai/prompts/` → AI prompt reference

Generated documentation is deployed to `apps/developers/docs/`.

---

## Chapter 8 — Infrastructure

### 8.1 Infrastructure Philosophy

EduNexus's infrastructure follows two rules:

**Rule 1: Everything is code.** No resource is created through the cloud provider's web console. All infrastructure is Terraform, version-controlled, reviewed, and applied through CI.

**Rule 2: Environments are identical.** The production, staging, and preview environments run identical infrastructure, differing only in size (number of instances, database plan) and in their environment variable values. A bug that appears only in production but not in staging is a bug in the environment management, not the application.

### 8.2 infra/terraform — Terraform Configuration

#### 8.2.1 Module Structure

```
infra/terraform/
├── modules/
│   ├── supabase/            # Supabase project configuration
│   ├── fly-app/             # Fly.io application module
│   ├── redis/               # Redis (Upstash) module
│   ├── clickhouse/          # ClickHouse (Tinybird) module
│   ├── vercel-project/      # Vercel deployment configuration
│   └── dns/                 # DNS (Cloudflare) configuration
├── environments/
│   ├── production/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars (not committed — loaded from 1Password)
│   ├── staging/
│   │   ├── main.tf
│   │   └── variables.tf
│   └── preview/
│       ├── main.tf
│       └── variables.tf
└── shared/
    ├── dns/                 # DNS zones (same across environments)
    └── cdn/                 # CDN configuration
```

#### 8.2.2 State Management

Terraform state is stored in a private S3-compatible bucket (Cloudflare R2) with state locking via DynamoDB. No Terraform state is stored locally or committed to the repository.

### 8.3 infra/supabase — Database Configuration

#### 8.3.1 Migration Strategy

Database migrations are the source of truth for the database schema. They are stored in `infra/supabase/migrations/` and applied in order by the Supabase CLI.

Migration naming convention:

```
20240101000000_initial_schema.sql
20240115000000_add_lesson_plans.sql
20240120000000_add_token_balances.sql
20240201000000_add_assessment_tables.sql
```

Every migration file is:
- Idempotent (uses `IF NOT EXISTS`, `IF EXISTS`, `OR REPLACE`)
- Reversible (a down migration comment is included)
- Reviewed by the platform team before merging

#### 8.3.2 RLS Policy Convention

Every table has RLS enabled. Every RLS policy follows this naming convention:

```sql
-- policy_name: [action]_[table]_[actor]
-- Examples:
CREATE POLICY "select_lesson_plans_as_teacher"
  ON lesson_plans FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "insert_lesson_plans_as_teacher"
  ON lesson_plans FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
```

#### 8.3.3 Seed Data

`infra/supabase/seed/` contains seed SQL files for:

- `subjects.sql` — All CBC and 8-4-4 subjects
- `curriculum_nodes.sql` — Sample curriculum nodes for development
- `demo_teacher.sql` — Demo teacher account for local development
- `demo_learners.sql` — 30 demo learner accounts for testing

### 8.4 infra/redis — Redis Configuration

#### 8.4.1 Usage

Redis is used for:
- BullMQ job queues (all workers)
- Session caching (gateway rate limiting)
- API response caching (curriculum graph queries)
- Distributed locks (idempotency)

#### 8.4.2 Keyspace Design

```
# Job queues (BullMQ)
bull:edunexus:ai:generation:*
bull:edunexus:email:delivery:*

# Rate limiting
rl:user:{userId}:minute
rl:user:{userId}:hour
rl:ip:{ip}:minute

# Locks
lock:job:{jobId}
lock:import:{importId}

# Cache
cache:curriculum:node:{nodeId}
cache:teacher:{teacherId}:token-balance
```

### 8.5 infra/clickhouse — ClickHouse Analytics

#### 8.5.1 Tables

```sql
-- Raw events table (append-only, partitioned by date)
CREATE TABLE analytics_events (
  event_id UUID,
  event_type String,
  user_id UUID,
  user_role Enum('teacher', 'learner', 'parent', 'admin'),
  timestamp DateTime64(3, 'Africa/Nairobi'),
  properties Map(String, String),
  app_name LowCardinality(String),
  app_version LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, event_type, timestamp)
TTL timestamp + INTERVAL 2 YEAR;

-- Materialized view: daily active users
CREATE MATERIALIZED VIEW daily_active_users
REFRESH EVERY 1 DAY
AS SELECT
  toDate(timestamp) as date,
  user_role,
  uniq(user_id) as dau
FROM analytics_events
GROUP BY date, user_role;
```

### 8.6 infra/grafana — Dashboards

All Grafana dashboards are defined as code in `infra/grafana/dashboards/`. Dashboard JSON is version-controlled and deployed through the Grafana API.

Dashboard naming convention: `[audience]-[subject].json`

```
infra/grafana/dashboards/
├── engineering-api-latency.json
├── engineering-ai-generation.json
├── engineering-queue-health.json
├── engineering-error-rates.json
├── business-daily-active-users.json
├── business-token-consumption.json
└── business-teacher-engagement.json
```

### 8.7 infra/prometheus — Alerts

Recording rules and alerting rules:

```yaml
# infra/prometheus/alerts/api.yml
groups:
  - name: api.latency
    rules:
      - alert: HighAPILatency
        expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API p99 latency > 2 seconds for 5 minutes"

      - alert: AIGenerationTimeout
        expr: rate(ai_generation_timeout_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
```

### 8.8 Environment Management

#### 8.8.1 Environment Variables

Environment variables are managed through 1Password Teams. Each environment (production, staging, preview) has its own 1Password vault.

In CI, environment variables are injected from GitHub Secrets (which are synchronized from 1Password via the 1Password GitHub Action).

In local development, engineers use the 1Password CLI to inject environment variables:

```bash
op run --env-file .env.1password -- pnpm dev
```

The `.env.example` file documents every required environment variable with its description and an example value. It is the single source of truth for what environment variables are needed.

#### 8.8.2 Environment Variable Scoping

Not every application needs every environment variable. Environment variables are scoped at the package level:

| Variable | Needed by |
|----------|-----------|
| `SUPABASE_URL` | All apps and services |
| `SUPABASE_SERVICE_ROLE_KEY` | `services/*`, `workers/*` only |
| `DEEPSEEK_API_KEY` | `services/ai` only |
| `PAYSTACK_SECRET_KEY` | `services/billing` only |
| `REDIS_URL` | `services/*`, `workers/*` |
| `CLICKHOUSE_URL` | `services/analytics`, `workers/analytics` |

Applications that receive `SUPABASE_SERVICE_ROLE_KEY` at build time are a security violation. The CI pipeline verifies that no Next.js application exposes service role credentials to the browser.

---

# Part V — Engineering Standards

---

## Chapter 9 — Dependency Rules

### 9.1 Why Strict Dependency Rules

Dependency rules are the architectural guardrails of the monorepo. Without them, the monorepo degrades into a ball of mud — every package importing every other package, circular dependencies forming over time, and changes to a leaf package causing unexpected cascading failures across the entire system.

Strict dependency rules guarantee:

1. **Architectural boundaries are maintained** even as the codebase grows
2. **Changes to a package have a predictable impact radius** — you know exactly what might break
3. **The build system can compute accurate dependency graphs** — enabling Turborepo's incremental builds
4. **New engineers understand the system's structure** immediately from the import graph

### 9.2 The Dependency Hierarchy

```
Layer 5: Apps (apps/*)
         ↓ (imports from)
Layer 4: Services (services/*)
         ↓ (imports from)
Layer 3: Business Logic Packages
         (packages/curriculum, packages/ai, packages/assessment)
         ↓ (imports from)
Layer 2: Infrastructure Packages
         (packages/database, packages/auth, packages/events)
         ↓ (imports from)
Layer 1: Foundation Packages
         (packages/utils, packages/validation, packages/logging,
          packages/config, packages/ui, packages/icons)
```

A package may only import from the same layer or a lower layer. Never from a higher layer.

### 9.3 Explicit Dependency Rules

#### 9.3.1 apps/* Rules

Applications may import:
- Any package in `packages/*`
- No other application in `apps/*`
- No service in `services/*` (API calls only — never direct imports)
- No worker in `workers/*`

#### 9.3.2 services/* Rules

Services may import:
- Any package in `packages/*`
- No application in `apps/*`
- No other service in `services/*` (HTTP calls only)
- No worker in `workers/*`

#### 9.3.3 workers/* Rules

Workers may import:
- Any package in `packages/*`
- No application in `apps/*`
- No service in `services/*` (queue-based communication only)

#### 9.3.4 packages/ui Rules

`packages/ui` may import:
- `packages/icons`
- `packages/utils`
- External UI dependencies (`@radix-ui/*`, etc.)

`packages/ui` may NOT import:
- `packages/database`
- `packages/ai`
- `packages/auth`
- `packages/curriculum`
- Any application, service, or worker

#### 9.3.5 packages/database Rules

`packages/database` may import:
- `packages/validation`
- `packages/logging`
- `packages/config`

`packages/database` may NOT import:
- `packages/ui`
- `packages/ai`
- `packages/curriculum`
- Any application, service, or worker

### 9.4 Forbidden Import Patterns

These import patterns are forbidden and will fail the lint step:

```typescript
// FORBIDDEN: Application importing another application
// In apps/teacher/src/something.ts:
import { ParentDashboard } from '../../parent/components/dashboard';  // ❌

// FORBIDDEN: Package importing application
// In packages/ui/src/button.tsx:
import { teacherAuth } from '../../apps/teacher/lib/auth';  // ❌

// FORBIDDEN: Package importing service
// In packages/ai/src/client.ts:
import { analyticsRouter } from '../../services/analytics/routes';  // ❌

// FORBIDDEN: Direct Supabase client creation
// In apps/teacher/src/lib/lesson-plan.ts:
import { createClient } from '@supabase/supabase-js';  // ❌

// FORBIDDEN: Worker importing application
// In workers/ai/src/processor.ts:
import { LessonPlanEditor } from '../../apps/teacher/components/editor';  // ❌
```

### 9.5 ESLint Enforcement

Dependency rules are enforced by ESLint's `import/no-restricted-paths` and `no-restricted-imports` rules in `packages/eslint-config/src/imports.js`:

```javascript
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // Packages cannot import from apps
          {
            target: './packages/**',
            from: './apps/**',
            message: 'Packages cannot import from applications'
          },
          // Packages cannot import from services
          {
            target: './packages/**',
            from: './services/**',
            message: 'Packages cannot import from services'
          },
          // Services cannot import from apps
          {
            target: './services/**',
            from: './apps/**',
            message: 'Services cannot import from applications'
          },
          // Workers cannot import from services
          {
            target: './workers/**',
            from: './services/**',
            message: 'Workers cannot import from services directly'
          },
          // UI package cannot import from data packages
          {
            target: './packages/ui/**',
            from: ['./packages/database/**', './packages/ai/**'],
            message: 'UI package cannot import from data or AI packages'
          },
        ]
      }
    ],
  }
};
```

### 9.6 Circular Dependency Prevention

Circular dependencies are detected by two mechanisms:

1. **ESLint `import/no-cycle` rule** — Detects circular imports at lint time
2. **Turborepo dependency graph** — Fails the build if a circular workspace dependency is detected
3. **Architecture tests** — `tooling/` includes an architecture test suite that validates the dependency graph on every CI run

```typescript
// tooling/arch-tests/src/dependency-graph.test.ts
import { buildDependencyGraph } from '../utils/graph';

describe('Dependency Graph', () => {
  test('has no circular dependencies', () => {
    const graph = buildDependencyGraph();
    expect(graph.hasCycles()).toBe(false);
  });

  test('packages do not import from apps', () => {
    const violations = findViolations(graph, 'packages → apps');
    expect(violations).toHaveLength(0);
  });
});
```

### 9.7 CI Enforcement

The CI pipeline enforces dependency rules through:

1. `turbo lint` — Runs ESLint with import restriction rules across all packages
2. `turbo typecheck` — TypeScript's module resolution fails on invalid imports
3. Architecture tests in `tooling/arch-tests/`

A pull request that violates any dependency rule cannot be merged. The CI check blocks the merge button on GitHub.

---

## Chapter 10 — Repository Standards

### 10.1 Naming Conventions

The naming conventions from `CLAUDE.md` apply across the entire monorepo:

| Thing | Convention | Example |
|-------|-----------|---------|
| Directories | kebab-case | `lesson-plans/` |
| Files | kebab-case | `lesson-plan-generator.ts` |
| React components | PascalCase | `LessonPlanCard` |
| Functions | camelCase | `generateLessonPlan` |
| TypeScript types | PascalCase | `LessonPlanContext` |
| Constants | UPPER_SNAKE_CASE | `MAX_LESSON_DURATION` |
| Environment variables | UPPER_SNAKE_CASE | `DEEPSEEK_API_KEY` |
| Package names | `@edunexus/[kebab-case]` | `@edunexus/curriculum` |
| Docker images | `edunexus/[kebab-case]` | `edunexus/ai-service` |
| Database tables | snake_case | `lesson_plans` |
| Database columns | snake_case | `teacher_id` |
| API routes | `/api/[kebab-case]/[kebab-case]` | `/api/lesson-plans/generate` |

### 10.2 Import Aliases

Every application and service configures import aliases for clean internal imports:

```json
// tsconfig.json (in each app/service)
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

Workspace packages are imported using their package name:

```typescript
import { Button } from '@edunexus/ui';
import { createServerSupabaseClient } from '@edunexus/database';
import { CBC_GRADE_10_MATHEMATICS } from '@edunexus/curriculum';
```

### 10.3 File Organization

Files within a package are organized by feature, not by file type. The feature-first organization ensures that all files related to a feature are colocated:

```
# Good (feature-first)
src/
├── lesson-plan/
│   ├── lesson-plan.ts       # Core logic
│   ├── lesson-plan.test.ts  # Tests
│   └── lesson-plan.types.ts # Types
└── sow/
    ├── sow.ts
    ├── sow.test.ts
    └── sow.types.ts

# Bad (type-first) — never do this
src/
├── types/
│   ├── lesson-plan.ts
│   └── sow.ts
├── utils/
│   ├── lesson-plan.ts
│   └── sow.ts
└── tests/
    ├── lesson-plan.ts
    └── sow.ts
```

### 10.4 README Standards

Every package, application, and service in the monorepo has a `README.md`. The README must include:

1. **One-line description** — What this package does
2. **Installation** (if it's a published package) — How to install it
3. **Usage** — At least one code example
4. **Public API** — List of exported functions and types
5. **Dependencies** — What this package depends on and why
6. **Owner** — Which team owns this package

README files are not optional. A package without a README fails the `turbo lint` step.

### 10.5 CODEOWNERS

The `CODEOWNERS` file at the repository root defines code ownership:

```
# Global ownership (required for all PRs)
* @edunexus/platform-team

# Application ownership
/apps/teacher/ @edunexus/teacher-app-team
/apps/learner/ @edunexus/learner-app-team
/apps/parent/ @edunexus/learner-app-team
/apps/admin/ @edunexus/platform-team
/apps/analytics/ @edunexus/data-team
/apps/developers/ @edunexus/developer-platform-team

# Package ownership
/packages/ui/ @edunexus/design-system-team
/packages/curriculum/ @edunexus/curriculum-team
/packages/ai/ @edunexus/ai-team
/packages/database/ @edunexus/platform-team

# Infrastructure
/infra/ @edunexus/devops-team
/docker/ @edunexus/devops-team
/.github/ @edunexus/platform-team
```

GitHub requires at least one CODEOWNER approval for every pull request before it can be merged.

### 10.6 Security Policy

`SECURITY.md` at the repository root defines the vulnerability disclosure policy:

- Security vulnerabilities are reported to security@edunexus.co.ke
- EduNexus commits to a 24-hour acknowledgement and 7-day remediation for critical vulnerabilities
- Responsible disclosure: vulnerabilities are not disclosed publicly until a fix is deployed
- Bug bounty: recognized in release notes and a Hall of Fame page

### 10.7 Contributing Guide

`CONTRIBUTING.md` documents the contribution process for engineers joining the team:

1. Read the Engineering Handbook (`docs/engineering/`)
2. Set up the local development environment (Chapter 11)
3. Understand the dependency rules (Chapter 9)
4. Branch from `main` with the naming convention `[type]/[description]`
5. Write tests before or alongside the implementation
6. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing
7. Open a pull request with the PR template filled out completely
8. Address all review comments before requesting re-review

---

# Part VI — Development Environment

---

## Chapter 11 — Local Development

### 11.1 Prerequisites

Before contributing to EduNexus, an engineer needs the following tools installed:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.x LTS | Runtime for all JS/TS |
| pnpm | 9.x | Package manager |
| Docker | 25.x | Local service infrastructure |
| Git | 2.40+ | Version control |
| Supabase CLI | Latest | Local Supabase management |
| 1Password CLI | Latest | Environment variable injection |

Optional but strongly recommended:

| Tool | Version | Purpose |
|------|---------|---------|
| VS Code | Latest | IDE with configured extensions |
| nvm | Latest | Node.js version management |
| `jq` | Latest | JSON processing for debugging |
| `curl` | Latest | API testing from terminal |

### 11.2 First-Time Setup

```bash
# 1. Clone the repository
git clone git@github.com:edunexus/edunexus.git
cd edunexus

# 2. Verify Node.js version
node --version  # Must be 22.x
# Or use nvm:
nvm use  # Reads .nvmrc automatically

# 3. Install dependencies
pnpm install

# 4. Set up environment variables
op run --env-file .env.1password -- cp .env.example .env.local
# Or: manually copy .env.example to .env.local and fill in values

# 5. Start local infrastructure
docker compose -f docker/docker-compose.yml up -d

# 6. Set up local Supabase
supabase start
supabase db reset  # Applies migrations and seed data

# 7. Generate TypeScript types from the database schema
pnpm generate:types

# 8. Verify setup
pnpm build
pnpm test

# 9. Start development
pnpm dev
```

The `scripts/setup.sh` script automates steps 4-8 for a fully fresh environment.

### 11.3 Node.js Version Management

The repository pins its Node.js version in two files for maximum compatibility:

```
# .nvmrc
22.12.0

# .node-version (for fnm)
22.12.0
```

CI uses the same version via GitHub Actions' `node-version-file` option.

### 11.4 pnpm Installation

```bash
# Install pnpm (if not already installed)
npm install -g pnpm@9

# Verify
pnpm --version
```

The repository uses pnpm's `packageManager` field in root `package.json` to enforce the correct pnpm version:

```json
{
  "packageManager": "pnpm@9.14.0+sha256=..."
}
```

### 11.5 Docker Setup

The local development stack requires Docker Compose. The stack includes:

```yaml
# docker/docker-compose.yml (excerpt)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  clickhouse:
    image: clickhouse/clickhouse-server:24
    ports:
      - "8123:8123"  # HTTP interface
      - "9000:9000"  # Native interface
    volumes:
      - ./infra/clickhouse/:/docker-entrypoint-initdb.d/

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
```

Supabase runs as its own local stack via `supabase start` (which internally uses Docker).

### 11.6 Running the Development Server

#### Running All Apps

```bash
pnpm dev
```

This starts all applications and services in parallel using Turborepo. Output from all processes is interleaved with color-coded labels.

#### Running Individual Apps

```bash
# Run only the teacher app
pnpm --filter apps/teacher dev

# Run only the teacher app and its dependencies
turbo dev --filter=apps/teacher...

# Run multiple specific apps
turbo dev --filter=apps/teacher --filter=apps/web
```

#### Development URLs

| Application | URL |
|-------------|-----|
| apps/web | http://localhost:3000 |
| apps/teacher | http://localhost:3001 |
| apps/learner | http://localhost:3002 |
| apps/parent | http://localhost:3003 |
| apps/admin | http://localhost:3004 |
| apps/analytics | http://localhost:3005 |
| apps/developers | http://localhost:3006 |
| Supabase Studio | http://localhost:54323 |
| Mailhog | http://localhost:8025 |
| Redis Commander | http://localhost:8081 |
| ClickHouse UI | http://localhost:8123 |

### 11.7 Database Management

```bash
# Apply all pending migrations
supabase db push

# Reset to clean seed state
supabase db reset

# Create a new migration
supabase migration new add_my_feature_table

# Generate TypeScript types after schema changes
pnpm generate:types
```

### 11.8 Hot Reload

All Next.js applications support Hot Module Replacement (HMR) out of the box. Changes to components, pages, and styles are reflected in the browser within milliseconds without a full page reload.

Server Component changes cause a full React tree refresh (fast — sub-second) but no full page navigation.

Changes to `packages/*` files are hot-reloaded in all applications that use them via Turborepo's watch mode.

### 11.9 Debugging

#### VS Code Debugging

The repository includes VS Code launch configurations in `.vscode/launch.json`:

```json
{
  "configurations": [
    {
      "name": "Debug Teacher App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/teacher/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/apps/teacher",
      "env": { "NODE_OPTIONS": "--inspect" }
    },
    {
      "name": "Debug AI Service",
      "type": "node",
      "request": "attach",
      "port": 9229
    }
  ]
}
```

#### Browser DevTools

All applications run with React DevTools integration enabled in development. The React Query DevTools panel is embedded in development builds of apps that use React Query.

### 11.10 VS Code Configuration

The repository includes recommended VS Code extensions in `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "supabase.vscode-supabase-cli",
    "github.copilot",
    "eamodio.gitlens",
    "christian-kohler.path-intellisense"
  ]
}
```

Workspace settings in `.vscode/settings.json` configure:
- Format on save with Prettier
- ESLint auto-fix on save
- TypeScript `strict` mode in editor
- Tailwind CSS IntelliSense for all `*.tsx` and `*.ts` files

### 11.11 Dev Containers

The repository includes a `.devcontainer/devcontainer.json` configuration for VS Code Dev Containers and GitHub Codespaces. Engineers who prefer containerized development can open the repository in a container with all prerequisites pre-installed.

```json
{
  "name": "EduNexus Development",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "scripts/setup.sh",
  "forwardPorts": [3000, 3001, 3002, 3003, 54323],
  "customizations": {
    "vscode": {
      "extensions": ["bradlc.vscode-tailwindcss", "esbenp.prettier-vscode"]
    }
  }
}
```

---

## Chapter 12 — Build System

### 12.1 Turborepo Configuration

The Turborepo pipeline is defined in `turbo.json` at the repository root:

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", ".eslintrc.js", "package.json"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/integration/**"],
      "cache": false
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "ai:evaluate": {
      "dependsOn": ["build"],
      "cache": false,
      "inputs": ["prompts/**", "src/generators/**"]
    },
    "storybook": {
      "cache": false,
      "persistent": true
    },
    "build:storybook": {
      "dependsOn": ["^build"],
      "outputs": ["storybook-static/**"]
    },
    "generate": {
      "cache": false,
      "inputs": ["schema.sql", "openapi.yaml"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 12.2 Task Execution Model

#### 12.2.1 Dependency-Order Tasks

Tasks that specify `"dependsOn": ["^build"]` wait for all dependency packages to complete their `build` task before starting. This ensures that when `apps/teacher` builds, all of its package dependencies (`@edunexus/ui`, `@edunexus/database`, etc.) have already been built.

#### 12.2.2 Parallel Tasks

Tasks that don't have dependencies on other packages' outputs run in parallel. `lint` and `typecheck` for independent packages run simultaneously.

#### 12.2.3 Persistent Tasks

`dev` is a persistent task — it starts and keeps running (the development server). Turborepo manages these processes with its terminal UI (`"ui": "tui"`).

### 12.3 Turborepo Caching

#### 12.3.1 Local Cache

Turborepo caches task outputs locally in `.turbo/`. When the inputs of a task haven't changed since the last run, Turborepo restores the outputs from cache rather than re-running the task.

Cache hit example:
```
tasks: build, test, lint

  apps/teacher:build - cache hit (restored in 0.4s)
  packages/ui:build - cache hit (restored in 0.2s)
  packages/database:build - MISS (package.json changed)
  packages/database:build - completed in 3.2s
```

#### 12.3.2 Remote Cache

For CI, Turborepo is configured with a remote cache hosted on Vercel's infrastructure. When a CI pipeline runs, it checks the remote cache first. On a cache hit, the artifact is downloaded from the remote cache (typically sub-second) rather than rebuilt.

Cache keys are based on:
- File hashes of all inputs
- Environment variables that affect the build
- The Turborepo configuration

#### 12.3.3 Cache Invalidation

The cache is automatically invalidated when:
- Any input file changes
- The package's `package.json` changes
- Any workspace package that the package depends on changes

Manual cache invalidation:

```bash
# Clear local cache
pnpm clean

# Clear and rebuild everything
turbo clean && turbo build --force
```

### 12.4 The pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
  - "workers/*"
  - "tooling/*"
```

This file tells pnpm which directories contain workspace packages. pnpm resolves `workspace:*` version specifiers in `package.json` files by linking to the local workspace package.

### 12.5 Root package.json Scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "test:integration": "turbo test:integration",
    "test:e2e": "turbo test:e2e",
    "clean": "turbo clean && rm -rf node_modules",
    "generate": "turbo generate",
    "generate:types": "pnpm --filter @edunexus/db-generator generate",
    "storybook": "pnpm --filter @edunexus/ui storybook",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "ai:evaluate": "turbo ai:evaluate"
  }
}
```

### 12.6 Per-Package Build Configuration

Each Next.js application has a `next.config.ts` that includes the `transpilePackages` option to ensure workspace packages are transpiled correctly:

```typescript
// apps/teacher/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@edunexus/ui',
    '@edunexus/icons',
    '@edunexus/curriculum',
    '@edunexus/analytics',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@edunexus/database'],
  },
};

export default nextConfig;
```

---

# Part VII — CI/CD

---

## Chapter 13 — Continuous Integration

### 13.1 CI Philosophy

The CI pipeline is the quality gate between a developer's local machine and the shared codebase. Its purpose is to:

1. **Catch regressions** before they reach other engineers
2. **Enforce standards** that are too tedious to check manually
3. **Provide confidence** that a change can be merged safely
4. **Deploy automatically** to preview environments for review

The CI pipeline must be **fast**. A pipeline that takes 30 minutes to run is not used — engineers push to main without waiting for CI, which defeats its purpose. The target CI time for a typical pull request is under 5 minutes, achieved through Turborepo's remote cache and aggressive parallelization.

### 13.2 GitHub Actions Workflow Architecture

```
.github/workflows/
├── ci.yml               # Main CI pipeline (runs on all PRs)
├── release.yml          # Release pipeline (runs on main branch merges)
├── preview.yml          # Preview deployment (runs on PR open/update)
├── ai-evaluate.yml      # AI quality evaluation (runs when AI prompts change)
├── security.yml         # Security scanning (daily + on PR)
├── dependency-audit.yml # Dependency vulnerability scan (daily)
└── stale.yml            # Stale issue/PR management
```

### 13.3 Main CI Pipeline (ci.yml)

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: edunexus

jobs:
  # ────────────────────────────────────────────────
  # Job 1: Validate (fast, runs first, gates everything)
  # ────────────────────────────────────────────────
  validate:
    name: Validate
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck
        name: Lint and Typecheck

  # ────────────────────────────────────────────────
  # Job 2: Unit Tests (parallel with validate)
  # ────────────────────────────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test
        env:
          NODE_ENV: test
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # ────────────────────────────────────────────────
  # Job 3: Build (depends on validate passing)
  # ────────────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [validate]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}

  # ────────────────────────────────────────────────
  # Job 4: Integration Tests (needs build)
  # ────────────────────────────────────────────────
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [build]
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: supabase db push --local
      - run: pnpm turbo test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379

  # ────────────────────────────────────────────────
  # Job 5: Architecture Tests
  # ────────────────────────────────────────────────
  arch-test:
    name: Architecture Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @edunexus/arch-tests test

  # ────────────────────────────────────────────────
  # Final: All checks passed gate
  # ────────────────────────────────────────────────
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [validate, test, build, test-integration, arch-test]
    if: always()
    steps:
      - name: Verify all jobs passed
        run: |
          if [[ "${{ needs.validate.result }}" != "success" || \
                "${{ needs.test.result }}" != "success" || \
                "${{ needs.build.result }}" != "success" || \
                "${{ needs.test-integration.result }}" != "success" || \
                "${{ needs.arch-test.result }}" != "success" ]]; then
            exit 1
          fi
```

### 13.4 Quality Gates

A pull request cannot be merged unless all of the following pass:

| Gate | Description | Failure Action |
|------|-------------|----------------|
| Lint | ESLint with all rules | Reject — fix lint errors |
| TypeCheck | TypeScript strict mode | Reject — fix type errors |
| Unit Tests | All unit tests pass | Reject — fix failing tests |
| Test Coverage | Coverage ≥ 80% for changed files | Block — add tests |
| Build | All packages build successfully | Reject — fix build errors |
| Integration Tests | All integration tests pass | Reject — fix test failures |
| Architecture Tests | No dependency violations | Reject — fix import structure |
| Security Scan | No new critical vulnerabilities | Block — assess and address |

### 13.5 Preview Deployments

Every pull request receives an automatic preview deployment:

- `apps/web` → `pr-{number}.edunexus.co.ke`
- `apps/teacher` → `teacher-pr-{number}.edunexus.co.ke`
- `apps/learner` → `app-pr-{number}.edunexus.co.ke`

Preview deployments use the staging Supabase project and are automatically cleaned up when the pull request is merged or closed.

### 13.6 Dependency Caching

CI pipelines cache the pnpm store to avoid downloading node_modules on every run:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc
    cache: pnpm
```

The Turborepo remote cache further eliminates redundant compilation — if a package's source hasn't changed since the last successful CI run, its build artifact is restored from the remote cache in under a second.

### 13.7 Build Matrix

The CI pipeline tests against multiple Node.js versions for packages that are published externally (primarily `packages/sdk`):

```yaml
strategy:
  matrix:
    node-version: ['20', '22']
```

Internal packages only test against the pinned version in `.nvmrc`.

### 13.8 Deployment to Staging

When a pull request is merged to the `main` branch:

1. The release pipeline runs `turbo build --filter=[HEAD^1]` (only packages changed since the last commit)
2. Changed Next.js applications are deployed to Vercel (staging)
3. Changed services are built into Docker images and pushed to GitHub Container Registry
4. Changed workers are restarted in their Fly.io machines

### 13.9 Canary Releases

For changes to `services/ai` or `workers/ai` that involve new prompt versions, a canary release process is used:

1. New version deploys to 5% of AI generation traffic
2. Quality metrics are monitored for 30 minutes
3. If quality score ≥ current production score, roll out to 100%
4. If quality degrades, automatically roll back to previous version

### 13.10 Rollback

Every deployment is tagged with a Docker image SHA and a Vercel deployment URL. Rolling back is:

```bash
# Roll back Vercel deployment
vercel rollback [deployment-url]

# Roll back service
fly deploy --image ghcr.io/edunexus/ai-service:v1.2.3

# Roll back database migration
supabase db reset --to [migration-timestamp]
```

The rollback procedure is documented in `docs/runbooks/rollback.md` and tested quarterly.

---

## Chapter 14 — Release Engineering

### 14.1 Versioning Strategy

EduNexus follows Semantic Versioning (SemVer) 2.0.0 for all published packages and a calendar-based versioning scheme for the platform itself.

**Platform releases:** `YYYY.MM.patch` (e.g., `2024.06.1`)
**Published packages:** `MAJOR.MINOR.PATCH` (e.g., `1.3.2`)

### 14.2 Release Cadence

| Release Type | Frequency | Process |
|-------------|-----------|---------|
| Patch (bug fixes) | As needed (same day) | Hotfix branch → main → deploy |
| Minor (new features) | Weekly | Staging validation → main → deploy |
| Major (breaking changes) | Quarterly | Architecture review → migration guide → staged rollout |

### 14.3 Release Train

Every Friday at 16:00 EAT, the weekly release train runs:

1. All feature branches merged to `main` before 15:00 EAT are included
2. The release pipeline builds and tests the complete platform
3. Staging is deployed and the QA team performs smoke tests
4. If smoke tests pass, production is deployed at 17:00 EAT

Emergency fixes bypass the release train via hotfix branches.

### 14.4 Package Versioning

Packages in `packages/` that are published to npm (`packages/sdk`, `packages/api-client`) use Changesets for versioning:

```bash
# After making a change to packages/sdk:
pnpm changeset

# This prompts for:
# - Which packages changed
# - Bump type (patch/minor/major)
# - Change description

# On release:
pnpm changeset version  # Bumps versions based on changesets
pnpm changeset publish  # Publishes to npm
```

Internal packages (not published to npm) use `workspace:*` for inter-package dependencies and do not need individual version management.

### 14.5 Docker Image Publishing

Service Docker images are built and pushed to GitHub Container Registry (GHCR) on every merge to `main`:

```
ghcr.io/edunexus/gateway:latest
ghcr.io/edunexus/gateway:2024.06.1
ghcr.io/edunexus/gateway:sha-abc1234

ghcr.io/edunexus/ai-service:latest
ghcr.io/edunexus/ai-service:2024.06.1
ghcr.io/edunexus/ai-service:sha-abc1234
```

Images are tagged with three tags: `latest`, the version number, and the commit SHA. Production deployments use the version number tag (not `latest`) to ensure deterministic deployments.

### 14.6 Changelog Generation

Changelogs are generated automatically from Conventional Commits:

```bash
# Automatically run as part of the release pipeline
pnpm changelog
```

The changelog is written to `CHANGELOG.md` and the GitHub Release notes. It groups changes by type: Features, Bug Fixes, Performance, Security.

### 14.7 Git Tagging

Every release is tagged in git:

```bash
git tag v2024.06.1 -m "Release 2024.06.1

Features:
- Academic clinic report generation
- Parent pulse WhatsApp notifications

Bug Fixes:
- Fixed token deduction race condition"

git push --tags
```

### 14.8 Rollback Strategy

Every release artifact is immutable and can be rolled back:

| Artifact | Rollback Mechanism |
|----------|-------------------|
| Vercel deployments | `vercel rollback [deployment-url]` |
| Fly.io services | `fly deploy --image [previous-image-tag]` |
| Database migrations | Only forward migrations (destructive rollback prevented) |
| npm packages | Deprecate the broken version, publish a patch |

Database migrations are never rolled back in production — they are always forward-only. If a migration causes issues, a new "rollback" migration is applied that undoes the change safely.

---

# Part VIII — Platform Operations

---

## Chapter 15 — Observability

### 15.1 The Three Pillars

EduNexus implements the three pillars of observability across the entire platform:

- **Logs** — Structured event records of what happened
- **Traces** — End-to-end request flows across services
- **Metrics** — Aggregated measurements of system behavior

All three are correlated by a shared `correlationId` and `requestId` that flow from the gateway through every downstream service and worker.

### 15.2 Structured Logging

All logging uses `packages/logging`, which wraps `pino` for structured JSON logging.

```typescript
// packages/logging/src/logger.ts
import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

// Usage in a service
const logger = createLogger('services/ai');

logger.info({ generationId, subject, grade, tokensUsed }, 'lesson plan generated');
logger.error({ error: err.message, stack: err.stack, requestId }, 'generation failed');
```

**Logging rules:**
- All log entries are JSON (never plain text)
- Every log entry includes `service`, `level`, `timestamp`
- Request logs include `requestId` and `correlationId`
- Error logs always include `error.message` and `error.stack`
- No PII in log entries (no student names, no teacher names in plain text)
- No `console.log` — always use the structured logger

### 15.3 Distributed Tracing

EduNexus uses OpenTelemetry with traces exported to Grafana Tempo.

Every request at the gateway generates a `traceId`. This trace ID is propagated through all downstream calls via `traceparent` headers (W3C Trace Context standard).

```typescript
// packages/observability/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

export function initTracing(serviceName: string) {
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  });
  sdk.start();
}
```

Tracing provides:
- End-to-end visibility of a teacher's lesson plan generation request from browser to AI service to database and back
- Identification of slow spans (which part of the system is slow?)
- Error context (which service threw the error that caused the 500?)

### 15.4 Metrics

EduNexus exposes Prometheus-compatible metrics from all services and workers via `/metrics` endpoints.

Key metrics collected:

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request latency by route and status |
| `ai_generation_duration_seconds` | Histogram | AI generation time by type |
| `ai_generation_token_usage` | Counter | AI tokens consumed by model and type |
| `ai_quality_score` | Histogram | AI response quality scores |
| `queue_depth` | Gauge | Number of jobs in each queue |
| `queue_processing_time_seconds` | Histogram | Job processing time by queue |
| `token_balance` | Gauge | Token balance by user |
| `active_users` | Gauge | Currently active users by role |
| `db_query_duration_seconds` | Histogram | Database query time by table |

### 15.5 Health Checks

Every service and application exposes a `/health` endpoint:

```typescript
// packages/observability/src/health.ts
type HealthResponse = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    ai_provider: 'ok' | 'error';
  };
};
```

Health checks are:
- Called every 30 seconds by the load balancer
- Published as metrics (health_check_status gauge)
- Used to drive automated rollback decisions

### 15.6 Request IDs

Every HTTP request receives a unique `requestId` generated at the gateway. This ID is:

- Included in all log entries
- Propagated to all downstream service calls via `X-Request-ID` header
- Returned to the client in the response as `X-Request-ID`
- Stored with all AI generation records for audit trails

When a user reports a problem, they can provide the `X-Request-ID` from their browser's network tab, and the EduNexus team can instantly find all logs and traces related to that specific request.

### 15.7 Error Boundaries

Every Next.js application implements React Error Boundaries that:

1. Catch unexpected rendering errors without white-screening the entire application
2. Log the error with full context (component stack, user ID, page URL)
3. Display a user-friendly error message with a support link
4. Include the `requestId` in the error UI so users can report it

### 15.8 Developer Diagnostics

In the staging environment, an engineering diagnostics panel is accessible via the `?debug=1` query parameter. It displays:

- Current user session data
- Recent API call logs for this session
- Token balance details
- Feature flag states
- Performance timing breakdown

This panel is never shown in production.

---

## Chapter 16 — Security

### 16.1 Secrets Management

Secrets are never stored in the repository. All secrets are:

1. Stored in 1Password Teams (one vault per environment)
2. Injected into CI via GitHub Secrets (synchronized from 1Password)
3. Injected into local development via the 1Password CLI
4. Injected into production via Fly.io secrets and Vercel environment variables

Secret rotation schedule:
- API keys: Every 90 days
- Service role key: Every 30 days
- Webhook signing secrets: On every vendor relationship review

### 16.2 Dependency Scanning

Dependency vulnerabilities are detected by three mechanisms:

**GitHub Dependabot:** Automatically opens pull requests for dependency updates. Configured for both npm and GitHub Actions dependencies.

**pnpm audit:** Run in CI on every pull request:
```yaml
- run: pnpm audit --audit-level critical
```
A pull request that introduces a critical-severity dependency vulnerability cannot be merged.

**Snyk:** Connected to the GitHub repository for continuous monitoring. Snyk alerts the DevOps team when new vulnerabilities are disclosed in existing dependencies.

### 16.3 CodeQL Security Analysis

GitHub CodeQL runs on every pull request and nightly:

```yaml
# .github/workflows/security.yml
- uses: github/codeql-action/analyze@v3
  with:
    languages: typescript, javascript
    queries: security-and-quality
```

CodeQL detects common vulnerability patterns including SQL injection (impossible with our ORM but defense-in-depth), XSS, command injection, and prototype pollution.

### 16.4 Secret Scanning

GitHub Secret Scanning is enabled for the repository. It:
- Scans all commits for known secret patterns (API keys, tokens, credentials)
- Blocks pushes that contain secrets matching known patterns
- Alerts the security team when a secret is found in history

Engineers who accidentally commit a secret must:
1. Rotate the secret immediately (treat it as compromised)
2. Remove it from git history using `git-filter-repo`
3. File an incident report

### 16.5 Supply Chain Protection

The repository uses npm provenance for published packages and pins all GitHub Actions to specific SHAs (not tags):

```yaml
# GOOD: Pinned to SHA
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# BAD: Pinned to mutable tag
- uses: actions/checkout@v4  # Can be moved to point to different commit
```

All third-party GitHub Actions used in the repository are reviewed for security before adoption. A whitelist of approved actions is maintained in `.github/actions-allowlist.yml`.

### 16.6 SBOM Generation

A Software Bill of Materials (SBOM) is generated on every release:

```bash
pnpm sbom --format spdx > sbom.json
```

The SBOM is published to the GitHub Release and enables customers to audit the dependencies of the EduNexus platform.

### 16.7 API Security

All API security measures are documented in `CLAUDE.md` and enforced mechanically:

- Every API route calls `auth.getUser()` first
- `userId` is never trusted from the request body
- Service role client is never exposed to client-side code
- Webhook endpoints verify provider signatures before processing
- Rate limiting at the gateway for all API endpoints

---

# Part IX — Engineering Culture

---

## Chapter 17 — Contribution Model

### 17.1 How Engineers Contribute

EduNexus follows a trunk-based development model with short-lived feature branches. The `main` branch is always deployable.

#### 17.1.1 The Contribution Cycle

```
1. Create a branch from main
   git checkout -b feat/lesson-plan-v2-editor

2. Implement the change
   - Follow engineering standards
   - Write tests alongside implementation
   - Update README if the public API changes

3. Run quality checks locally
   pnpm lint && pnpm typecheck && pnpm test

4. Push and open a pull request
   - Fill out the PR template completely
   - Link to the relevant issue or RFC
   - Add screenshots for UI changes

5. Address review feedback

6. Merge when CI passes and reviews are approved
```

### 17.2 Branching Convention

Branch names follow the format: `[type]/[brief-description]`

| Type | Use Case | Example |
|------|----------|---------|
| `feat/` | New feature | `feat/parent-pulse-whatsapp` |
| `fix/` | Bug fix | `fix/token-deduction-race-condition` |
| `refactor/` | Refactoring | `refactor/extract-curriculum-package` |
| `docs/` | Documentation | `docs/update-api-reference` |
| `perf/` | Performance | `perf/cache-curriculum-graph` |
| `security/` | Security fix | `security/fix-ssrf-in-webhook` |
| `hotfix/` | Emergency production fix | `hotfix/payment-webhook-500` |

Feature branches live no longer than 2 days before merging. Long-lived branches indicate a feature that needs to be broken down further.

### 17.3 RFCs — Request for Comments

Significant changes to the platform architecture, API contracts, database schemas, or engineering standards require an RFC before implementation begins.

#### 17.3.1 When an RFC is Required

- Adding a new package to `packages/`
- Adding a new service to `services/`
- Changing the public API contract
- Changing database table schemas in ways that affect multiple teams
- Introducing a new external dependency that will be used platform-wide
- Changing CI/CD pipeline architecture

#### 17.3.2 RFC Format

RFCs live in `docs/architecture/rfcs/` as Markdown files:

```
docs/architecture/rfcs/
├── 0001-monorepo-structure.md          # Accepted
├── 0002-event-driven-notifications.md  # Accepted
├── 0003-clickhouse-analytics.md        # Accepted
└── 0004-knowledge-graph-v2.md          # In Review
```

RFC template:
```markdown
# RFC [NUMBER]: [TITLE]

**Status:** Draft | In Review | Accepted | Rejected | Superseded
**Author:** [Name]
**Created:** [Date]
**Last Updated:** [Date]

## Summary
One paragraph describing what this RFC proposes.

## Motivation
Why is this change needed? What problem does it solve?

## Detailed Design
The complete technical specification.

## Drawbacks
What are the cons of this approach?

## Alternatives
What alternatives were considered and why were they rejected?

## Unresolved Questions
What is still unclear?

## Implementation Plan
How will this be implemented?
```

### 17.4 Code Reviews

Code reviews at EduNexus serve two purposes: quality assurance and knowledge sharing.

#### 17.4.1 Review Requirements

- All pull requests require at least 2 approvals
- Changes to `infra/` require DevOps team approval
- Changes to `packages/database/` require Platform team approval
- Changes to `services/billing/` require both Platform team and one additional senior engineer approval

#### 17.4.2 Review Guidelines

Reviewers focus on:

**Correctness:** Does the code do what it claims to do? Are edge cases handled? Could this introduce a regression?

**Security:** Is auth checked? Is user input validated? Is sensitive data exposed?

**Performance:** Are there N+1 queries? Are unbounded loops present? Is caching appropriate?

**Maintainability:** Is the code readable without comments? Are the abstractions at the right level?

**Standards:** Does the code follow the patterns established in this specification?

Reviewers do NOT focus on personal style preferences. Prettier enforces formatting. ESLint enforces lint rules. Reviews focus on substance.

### 17.5 Architecture Reviews

Changes that affect the architectural structure of the platform (new package, new service, new external dependency) require an architecture review meeting before implementation.

Architecture reviews involve:
- The engineer proposing the change
- Platform team leads
- The team most affected by the change

The outcome is either approval (with conditions) or rejection (with suggested alternatives).

### 17.6 Pair Programming

Pair programming is encouraged (not required) for:
- Onboarding new engineers to unfamiliar systems
- Solving complex bugs that have resisted solo debugging
- Implementing security-critical features
- Learning new technologies being introduced to the platform

Pair sessions are documented in the relevant pull request as a comment noting that the change was implemented through pair programming.

### 17.7 Documentation-First Development

For new features that add public API surface (new API routes, new SDK methods, new events), documentation is written before implementation:

1. Write the API documentation (what the endpoint does, its inputs, its outputs, its errors)
2. Write the SDK usage examples (what using this feature looks like)
3. Write the integration tests (what correct behavior looks like)
4. Implement the feature

This approach — README-driven development — ensures that the implementation matches the desired interface rather than the other way around.

---

## Chapter 18 — Repository Governance

### 18.1 Repository Maintainers

The EduNexus repository has five designated maintainers who are responsible for:

- Reviewing and merging RFCs
- Making final decisions on architectural disputes
- Managing the release process
- Maintaining the engineering standards documented in this specification
- Reviewing and updating CODEOWNERS

Maintainers rotate quarterly to distribute knowledge and prevent single points of failure.

### 18.2 Package Ownership

Every package in the repository has a designated owner team. Package owners are responsible for:

- The correctness and quality of the package
- Reviewing all pull requests that modify the package
- Maintaining the package README
- Evolving the public API responsibly (with backward compatibility or versioned deprecation)
- Monitoring the package's impact on CI performance

### 18.3 Approval Matrix

| Change Type | Required Approvals |
|-------------|-------------------|
| Bug fix in a single app | 1 × team member |
| New feature in a single app | 2 × team members |
| Change to a shared package | Package owner + 1 × any team member |
| Change to database schema | Platform team lead + 1 × architect |
| Change to CI/CD pipeline | DevOps team lead + 1 × architect |
| Change to billing code | Platform team lead + 1 × senior engineer |
| New external dependency | Package owner + 1 × security review |
| Breaking API change | 2 × architects + RFC accepted |

### 18.4 Architecture Ownership

The architectural decisions in this specification and the supporting documents (`docs/engineering/`) are owned by the Platform team leads. Any change to engineering standards follows the RFC process.

Architecture Decision Records (ADRs) in `docs/architecture/` document every significant architectural decision:
- What was decided
- What alternatives were considered
- Why this decision was made
- What the consequences are

ADRs are immutable once accepted. If a decision changes, a new ADR supersedes the old one.

### 18.5 Deprecation Policy

When a public API, package export, or configuration is deprecated:

1. Add a `@deprecated` JSDoc comment with the deprecation reason and the replacement
2. Log a deprecation warning when the deprecated code is used
3. Create a migration guide in `docs/`
4. Keep the deprecated code for 2 major release cycles
5. Remove it in the release following the removal milestone

No deprecation is immediate. Engineers and external developers always have time to migrate.

### 18.6 Long-Term Maintenance

The repository is maintained with a 5-year horizon. Engineering decisions are made with this time frame in mind.

Technical debt is tracked as GitHub Issues with the `technical-debt` label. A quarterly technical debt review assesses the backlog and schedules debt reduction alongside feature work. No feature quarter is debt-free; no quarter is all-debt.

Dependency updates are maintained by Dependabot for security patches (auto-merged if CI passes) and reviewed weekly for minor and major updates. The platform maintains a "freshness policy" — no dependency more than 2 major versions behind its latest release.

---

# Final Chapter — The First Commit

---

## The First Commit

The first commit to the EduNexus monorepo is not the beginning of the product. It is the beginning of the engineering environment in which the product will be built.

It establishes the structures, the standards, the tools, and the values that will govern every line of code written for the next decade of EduNexus's engineering.

Every decision in the first commit is load-bearing.

### What the First Commit Contains

The first commit establishes the complete repository skeleton. No application logic. No database queries. No AI integrations. The first commit is the engineering foundation on which all future work will stand.

Here is the complete manifest of what the first commit contains:

---

#### Root Configuration Files

```
/
├── .nvmrc                   # Node 22.x pinned
├── .node-version            # Node 22.x (fnm)
├── .gitignore               # Node, Next.js, Turbo, IDE, secrets
├── .gitattributes           # Line endings and binary handling
├── .prettierrc              # Prettier configuration
├── .prettierignore          # Prettier exclusions
├── turbo.json               # Turborepo pipeline definition
├── pnpm-workspace.yaml      # pnpm workspace packages
├── package.json             # Root package.json
│                              devDependencies: turbo, prettier
│                              engines: { node: ">=22.0.0", pnpm: ">=9.0.0" }
│                              packageManager: pnpm@9.14.0+sha256=...
├── tsconfig.base.json       # Strict TypeScript base configuration
├── .env.example             # ALL environment variables documented
├── CLAUDE.md                # Engineering standards for Claude Code
├── CODEOWNERS               # GitHub CODEOWNERS
├── CONTRIBUTING.md          # Contribution guide
├── SECURITY.md              # Security policy
├── LICENSE                  # MIT License
└── README.md                # Repository root README
```

#### Directory Structure

```
apps/
├── web/
│   ├── package.json         # name: @edunexus/app-web
│   ├── next.config.ts       # Minimal Next.js config
│   ├── tsconfig.json        # extends: @edunexus/typescript-config/nextjs
│   ├── tailwind.config.ts   # extends workspace config
│   ├── app/
│   │   ├── layout.tsx       # Root layout (empty)
│   │   └── page.tsx         # Homepage placeholder
│   └── README.md
├── teacher/
│   └── [same skeleton as web]
├── learner/
│   └── [same skeleton as web]
├── parent/
│   └── [same skeleton as web]
├── admin/
│   └── [same skeleton as web]
├── analytics/
│   └── [same skeleton as web]
├── studio/
│   └── [same skeleton as web]
├── developers/
│   └── [same skeleton as web]
├── docs/
│   └── [same skeleton as web]
└── marketing/
    └── [same skeleton as web]

packages/
├── ui/
│   ├── package.json         # name: @edunexus/ui
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts         # Empty — ready for components
│   └── README.md
├── icons/
│   └── [same skeleton]
├── config/
│   ├── package.json
│   ├── src/
│   │   ├── env.ts           # Environment variable Zod schema (complete)
│   │   ├── urls.ts          # Application URL map (development URLs)
│   │   └── index.ts
│   └── README.md
├── eslint-config/
│   ├── package.json
│   ├── src/
│   │   ├── base.js          # Complete base ESLint config
│   │   ├── next.js          # Next.js rules
│   │   └── imports.js       # Dependency restriction rules
│   └── README.md
├── typescript-config/
│   ├── base.json            # Complete strict TS config
│   ├── nextjs.json
│   ├── react-library.json
│   └── node.json
├── database/
│   ├── package.json
│   ├── src/
│   │   ├── client/
│   │   │   ├── server.ts    # createServerSupabaseClient
│   │   │   ├── service.ts   # createServiceClient
│   │   │   └── browser.ts   # createBrowserSupabaseClient
│   │   ├── types/
│   │   │   └── supabase.ts  # Placeholder — regenerated from schema
│   │   └── index.ts
│   └── README.md
├── auth/
│   └── [skeleton with middleware factory]
├── validation/
│   └── [skeleton with base Zod schemas]
├── logging/
│   └── [skeleton with pino logger factory]
├── observability/
│   └── [skeleton with OTel setup]
└── [all other packages as empty skeletons]

services/
├── gateway/
│   └── [skeleton with health endpoint]
├── ai/
│   └── [skeleton]
└── [all other services as skeletons]

workers/
└── [all workers as skeletons]

tooling/
└── [all tools as skeletons]

infra/
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20240101000000_initial_schema.sql  # Tables with RLS
├── terraform/
│   ├── modules/
│   └── environments/
└── [monitoring configs]

docker/
├── docker-compose.yml       # Complete local dev stack
└── [service-specific configs]

.github/
├── workflows/
│   ├── ci.yml               # Complete CI pipeline
│   ├── security.yml
│   └── dependabot.yml
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
└── PULL_REQUEST_TEMPLATE.md

docs/
├── architecture/
│   ├── rfcs/
│   │   └── 0001-monorepo-structure.md
│   └── adrs/
│       └── 0001-turborepo-pnpm-monorepo.md
└── onboarding/
    └── first-day.md
```

#### Engineering Policies Established in the First Commit

The first commit does not just initialize directories. It establishes every engineering policy that will govern the platform:

**Dependency rules** are enforced from day one. The ESLint configuration in `packages/eslint-config/` is complete and applied to all packages. Any engineer who writes `import { createClient } from '@supabase/supabase-js'` in an application file immediately sees an ESLint error. The architectural boundary is mechanically enforced from the moment the repository exists.

**TypeScript strict mode** is on from day one. `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — all enabled. There is no period of "we'll add types later." The codebase starts typed, and it stays typed.

**Testing infrastructure** is configured from day one. Every package has a `vitest.config.ts`. The CI pipeline runs tests on every pull request. There is no period of "we'll add tests when we have time."

**Formatting is enforced** from day one. Prettier is configured and run as a CI check. There are no style debates. The formatter decides.

**Commit message format** is documented in `CONTRIBUTING.md` and enforced by a commit-msg git hook that validates the format: `feat: description 🎯`, `fix: description 🔧`, etc.

**Secret management** is established from day one. `.env.example` documents every required variable. `.gitignore` excludes all `.env` files. The CI pipeline validates that no secrets are committed.

**CODEOWNERS** is established from day one. Every pull request requires CODEOWNER review. There is no unowned code.

---

### Why the First Commit Is What It Is

A common temptation is to start with a minimal repository — just enough configuration to write the first feature. This is the wrong instinct.

The cost of establishing engineering infrastructure early is low — a few hours or days. The cost of retrofitting engineering infrastructure onto an existing codebase is enormous — weeks of migration work, broken PRs, confused engineers, and the cultural debt of a codebase that "used to be" a certain way.

EduNexus starts with the full engineering infrastructure because:

**The costs are asymmetric.** Adding a feature to a well-structured codebase is easy. Restructuring a codebase to accommodate a feature is hard. Start with the structure.

**Standards are cultural artifacts.** A codebase without `any` types from day one has engineers who never write `any` types. A codebase that adds the `no-any` rule on day 200 has engineers who see the rule as an imposition rather than a principle. Start with the standards.

**Tools compound.** An engineer who learns Turborepo on day one doesn't think twice about it on day 1000. An engineer who is forced to learn Turborepo on day 300 resents the disruption. Start with the tools.

**First principles matter most early.** The principles in this specification — code sharing through imports, atomic cross-cutting commits, dependency direction enforcement, typed everything — are easy to establish in an empty repository and nearly impossible to establish in a mature one. Start with the principles.

---

### The Statement

A great educational platform is not built by writing features first.

It is built by creating an engineering environment in which thousands of future features can be added without sacrificing clarity, correctness, or coherence.

The first commit is therefore not the beginning of the codebase — it is the beginning of the engineering culture.

---

*EduNexus Monorepo & Workspace Foundation Specification*
*Version 1.0.0 | Engineering Foundation Document*
*Kenya CBC/CBE AI Education Platform*

---

**Document Information**

| Field | Value |
|-------|-------|
| Document ID | ENG-SPEC-001 |
| Version | 1.0.0 |
| Status | Canonical |
| Authors | EduNexus Platform Team |
| Reviewers | Architecture Board |
| Last Updated | 2026-06-30 |
| Next Review | 2026-12-30 |

**Related Documents**

- Engineering Handbook (`docs/engineering/`)
- Architecture Philosophy (`docs/engineering/architecture-philosophy.md`)
- Educational Knowledge Graph Book (`docs/the-educational-knowledge-graph.md`)
- Educational AI Systems Book (`docs/educational-ai-systems.md`)
- Canonical Reference Architecture (`docs/edunexus-canonical-architecture.md`)
- Developer Platform Guide (`docs/developer-platform.md`)
- DX Ecosystem Blueprint (`docs/dx-ecosystem-blueprint.md`)
- Platform Implementation Guide (`docs/platform-implementation-guide.md`)
