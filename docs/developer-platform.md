# EduNexus Developer Platform

## Building Educational Intelligence Applications on the EduNexus Platform

**Edition 1.0 — June 2026**

---

> *Developers should never need to become curriculum experts in order to build world-class educational software.*

---

## Preface

This book is for builders.

Not for teachers. Not for curriculum designers. Not for policy makers. This book is for the software developers, startup founders, systems integrators, enterprise architects, and AI engineers who want to build the next generation of educational technology — and who want to do it without spending years learning the intricacies of the Kenyan Competency Based Curriculum, without duplicating learner progression logic that already exists, and without reinventing assessment engines that have already been proven in production.

The EduNexus Developer Platform is educational intelligence as infrastructure.

If you have built on Stripe, you understand what it means to offload payment complexity to a specialized infrastructure layer and focus entirely on your product. If you have built on Twilio, you understand what it means to abstract away telecommunications infrastructure and simply send messages. If you have built on Supabase, you understand what it means to have a backend-as-a-service that handles authentication, storage, and data so that you can focus on user experience.

EduNexus does for educational intelligence what those platforms did for payments, communications, and backend services.

This book defines:

- What the EduNexus Developer Platform is and why it exists
- How the platform is architected at every layer
- How to authenticate, integrate, and build on top of it
- What APIs, SDKs, events, and plugins are available
- How to publish to the EduNexus Marketplace
- How to build internationally across multiple curriculum systems
- What the long-term vision for educational intelligence infrastructure looks like

This is not the EduNexus Engineering Handbook, which documents how the EduNexus platform itself is built internally. This is the external developer's guide — the document you hand to a partner engineering team, a startup CTO, a government integration architect, or an independent developer who wants to build something extraordinary on top of EduNexus.

Read it cover to cover if you are architecting a large integration. Jump to the relevant chapter if you are building a specific feature. Return to it as your understanding deepens.

The future of educational technology is not a thousand isolated applications each reinventing the same curriculum logic. It is a shared intelligence layer upon which thousands of applications build specialized experiences — a true educational ecosystem.

This book is your map.

---

## Part One — Foundation

---

## Overall Philosophy — The Educational Intelligence Layer

### Why Educational Software Is Different

Educational software occupies a peculiar position in the software industry. On the surface, it looks like any other vertical SaaS: data models, APIs, user interfaces, business logic. But beneath the surface, educational software carries a weight that generic SaaS does not: it must encode the rules of learning.

Learning is not a simple domain. It involves:

**Curriculum hierarchies.** Every country organizes knowledge into strands, sub-strands, learning outcomes, performance indicators, and assessment rubrics. These hierarchies are nested, cross-referenced, and constantly revised. A single country can have dozens of curriculum documents spanning thousands of pages. Encoding this accurately requires months of domain expertise.

**Competency progression models.** Learners do not move through a curriculum linearly. They move through zones of proximal development, they have gaps and strengths that do not align neatly with grade levels, and they require differentiated pathways. A software system that assumes linear progression will consistently fail real learners.

**Pedagogical assumptions.** Different assessment types — formative, summative, portfolio-based, observation-based — imply different data models, different workflows, and different analytical frameworks. A rubric for observational assessment in a competency-based system is not the same as a rubric for a written test in an examination-based system.

**Teacher workflows.** Teachers do not interact with software the way office workers do. They interact with it in ten-minute windows between lessons, on mobile phones in noisy staffrooms, with low-reliability internet, while managing classrooms of forty students. Software designed without understanding teacher cognitive load is software that will not be used.

**Regulatory and policy constraints.** Education is a government function in most countries. Curriculum standards, examination rules, progression policies, and reporting requirements are mandated by ministries. Software that ignores these constraints cannot be used in real schools.

**Cultural and linguistic context.** Education happens within cultures. The examples in a mathematics lesson, the scenarios in an assessment, the language of feedback — all of these must reflect the learner's world or the software will feel alien.

Generic SaaS platforms ignore all of this. They provide general-purpose tools — forms, databases, dashboards, workflows — and leave educational organizations to encode their domain logic themselves. The result is predictable: every organization duplicates the same curriculum logic, the same assessment frameworks, the same learner progression models. Every ERP vendor builds their own grade book. Every LMS vendor builds their own curriculum browser. Every assessment platform builds its own rubric engine. Every AI company builds its own educational prompting layer.

This duplication is not just expensive. It is dangerous. Each implementation makes different assumptions, introduces different errors, and creates a fragmented ecosystem where data cannot flow, intelligence cannot be shared, and learners fall through the cracks between systems.

### The Fragmentation Problem

Consider what happens when a school district tries to use modern educational technology:

The school management system knows which students are enrolled in which classes. The learning management system knows which assignments have been submitted. The assessment platform knows how students performed on standardized tests. The parent communication platform knows which messages have been sent. The AI tutoring system knows which concepts a student has struggled with.

None of these systems talk to each other.

A student who is struggling in mathematics — falling behind in algebraic thinking, showing early signs of dropout risk, coming from a home with limited academic support — is visible as a pattern only if you have all the data together. But the data lives in five different systems with five different schemas, five different authentication models, and five different vendors who have no commercial incentive to integrate deeply.

This is not a technology failure. This is an architectural failure. The industry built applications when it should have built infrastructure.

### The Stripe Moment for Education

Stripe was not the first company to process payments online. PayPal existed. Banks offered payment gateways. Enterprise merchants had custom integrations with Visa and Mastercard. But Stripe recognized that every developer who wanted to accept a payment was solving the same problems: PCI compliance, fraud detection, currency handling, webhook reliability, recurring billing logic. Stripe built that infrastructure once, made it beautifully accessible to developers, and created a platform that now processes hundreds of billions of dollars annually.

The insight was not technical. It was architectural: payment logic should be infrastructure, not application code.

Twilio made the same observation about telecommunications. Every application that wanted to send an SMS, make a phone call, or verify a user's identity was solving the same problems. Twilio built that infrastructure once.

Supabase made the same observation about backend services. Every developer who wanted authentication, a database, and file storage was solving the same problems.

OpenAI made the same observation about intelligence. Every company that wanted to integrate AI was solving the same problems around model access, context management, and prompt engineering.

EduNexus makes this observation about educational intelligence. Every developer who wants to build educational software is solving the same problems: encoding curriculum structure, modeling learner progression, generating educationally sound AI content, assessing against competency frameworks, producing teacher-facing analytics, and understanding learner risk.

EduNexus builds that infrastructure once.

### The Four Layers of Educational Software

To understand where EduNexus sits, it helps to think about educational software in four layers:

**The Infrastructure Layer** provides raw computational resources: databases, compute, storage, networking, authentication primitives. This is Supabase, AWS, Google Cloud, Vercel. EduNexus is built on this layer but does not compete with it.

**The Intelligence Layer** provides domain-specific intelligence that transforms raw infrastructure into meaningful educational capability: curriculum knowledge, learner models, pedagogical AI, assessment logic, progression frameworks. This is EduNexus. The intelligence layer takes raw data and turns it into educational insight. It takes raw AI capability and turns it into educationally valid generation. It takes raw assessment scores and turns them into actionable learner understanding.

**The Experience Layer** provides user-facing workflows and interfaces: teacher dashboards, student portals, parent apps, administrator consoles, classroom tools. This is where partner applications live. Partner applications focus entirely on user experience — on making workflows intuitive, making information beautiful, making interactions delightful — without needing to encode the educational logic that drives them.

**The Application Layer** provides specialized end-to-end products for specific use cases: an exam preparation platform, a special needs assessment tool, a professional development tracker, a school inspection system. These applications consume both the intelligence layer and experience components to create complete products for specific markets.

EduNexus occupies the intelligence layer. Partner applications occupy the experience and application layers. The infrastructure layer is provided by existing cloud platforms that EduNexus builds on.

This separation is not merely conceptual. It has profound practical consequences:

- A partner building a parent communication app does not need to implement curriculum knowledge. EduNexus provides it.
- A partner building an LMS does not need to model learner progression. EduNexus provides it.
- A partner building an assessment platform does not need to encode CBC rubric logic. EduNexus provides it.
- A partner building an AI tutoring system does not need to engineer educational prompting. EduNexus provides it.

Each partner focuses on what they do best. EduNexus handles the educational intelligence they share.

### Platform Network Effects

The intelligence layer becomes more valuable as more partners build on it. This is not merely a commercial observation. It is an architectural one.

When more schools use EduNexus, learner data becomes richer, and learner models become more accurate. When more assessment data flows through the platform, assessment calibration improves. When more teachers use AI generation, the feedback loops that improve AI quality become stronger. When more partners build integrations, the data flows between systems improve, and the insight available to any individual partner increases.

This is the network effect of educational intelligence: every participant makes the intelligence better for every other participant.

It is the same network effect that makes Stripe's fraud detection better as more transactions flow through it. It is the same network effect that makes Google Maps better as more drivers contribute traffic data. Intelligence infrastructure gets smarter with scale in a way that isolated applications never can.

### The Long-Term Vision

> Stripe became payment infrastructure.
>
> Twilio became communication infrastructure.
>
> Supabase became backend infrastructure.
>
> OpenAI became intelligence infrastructure.
>
> EduNexus becomes Educational Intelligence Infrastructure.

This is not a metaphor. It is a technical and commercial roadmap.

In ten years, the question "should we integrate with EduNexus?" should have the same answer as "should we integrate with Stripe for payments?" The answer should be: of course. The alternative is building something inferior yourself, maintaining it forever, and being perpetually behind the state of the art in educational intelligence.

The goal of this book is to make that future possible. Every developer who reads it and builds on the platform moves the ecosystem closer to that outcome.

---

## Chapter 1 — Platform Vision

### What Is an Educational Intelligence Platform?

An educational intelligence platform is a shared service layer that provides educational domain knowledge, learner models, curriculum logic, assessment frameworks, and AI capabilities as reusable APIs and SDKs to application developers.

The key word is *shared*. The intelligence is not locked inside a single application. It is exposed as infrastructure that any qualified developer can build on, that any certified partner can extend, and that any educational ecosystem participant can benefit from.

An educational intelligence platform has four defining characteristics:

**Domain depth.** It encodes educational knowledge that would take months or years for an application developer to replicate. This includes curriculum hierarchies, assessment frameworks, pedagogical models, progression theories, and learner risk indicators. The depth of this domain knowledge is the core value proposition.

**Developer accessibility.** The platform exposes its intelligence through well-designed APIs that are easy to integrate with regardless of programming language, framework, or architectural style. A developer with no prior educational technology experience should be able to integrate in hours, not weeks.

**Composability.** The platform's capabilities combine with each other and with partner capabilities. A learner intelligence API can combine with a partner's communication system to trigger personalized interventions. A curriculum API can combine with a partner's content system to validate that content aligns with learning outcomes. Composability multiplies the value of the platform.

**Continuous improvement.** The platform's intelligence improves over time as more data flows through it, as AI models are refined, and as domain knowledge is updated. Every partner who builds on the platform benefits from these improvements without needing to upgrade their own code.

EduNexus satisfies all four characteristics. It encodes Kenya's CBC curriculum deeply, in a way that would take any individual development team months to replicate correctly. It exposes this intelligence through RESTful APIs with official SDKs in eight languages. Its capabilities compose with each other and with partner systems. And it improves continuously as more schools, teachers, and learners use it.

### Why Educational Intelligence Should Be Reusable

The educational software industry currently wastes an enormous amount of engineering effort. Every company building an educational product encodes the same curriculum logic, implements the same learner progression model, writes the same assessment rubric evaluator, and engineers the same AI prompting patterns. This duplication is not because the problems are different. It is because there has been no shared infrastructure layer to build on.

Consider a simple example: generating a lesson plan that aligns to the Kenyan CBC curriculum for Grade 8 Mathematics, Strand 3 (Algebra), Sub-Strand 3.2 (Linear Equations).

To do this correctly, an application needs to know:
- What the exact learning outcomes for that sub-strand are
- What performance indicators distinguish below-expectation from above-expectation performance
- What prerequisite sub-strands a learner must have mastered before this topic
- What the recommended teaching approaches are for this age group
- What the appropriate assessment types are for a competency-based system
- How this topic connects to subsequent sub-strands that will depend on it

Every educational AI company building a lesson planning tool in Kenya is answering these same questions. Most are answering them incorrectly, or approximately, because they lack the deep curriculum expertise required to encode them precisely.

EduNexus encodes all of this once, correctly, with input from curriculum experts and practicing teachers, and exposes it through an API. A developer integrating with EduNexus does not need to know any of this. They call the API, specify the context, and receive a lesson plan that is grounded in accurate curriculum knowledge.

The reusability of this intelligence is not merely a convenience. It is a quality improvement. Every application that builds on EduNexus benefits from the curriculum expertise that went into the platform. Every application that builds in isolation risks encoding that expertise incorrectly.

### How Educational Software Becomes Composable

Composability is the ability to combine components in new ways to create new value. The web became composable when HTTP became universal. The smartphone became composable when app stores opened platform APIs to developers. Financial services became composable when open banking regulations required banks to expose APIs.

Educational software becomes composable when educational intelligence is exposed through standard APIs.

Consider what becomes possible when educational intelligence is composable:

A school ERP vendor can integrate learner risk scores directly into their student management dashboard, without building a risk model themselves.

An LMS vendor can integrate curriculum alignment checking directly into their content authoring tool, without encoding curriculum knowledge themselves.

A parent app can display personalized learning trajectories for each child, without building a learner model themselves.

A government reporting system can aggregate curriculum coverage analytics across an entire county, without standardizing data models across all the school systems they oversee.

An EdTech startup can build a specialized intervention tool for numeracy difficulties, consuming a rich learner intelligence API rather than building their own assessment engine.

None of these applications need to duplicate the educational intelligence that drives them. They focus on the specific experience or workflow they are creating, and they delegate educational intelligence to the platform.

This composability creates an ecosystem. In an ecosystem, the value of every participant is amplified by the existence of every other participant. The parent app is more valuable because it can show learner data that comes from the LMS. The LMS is more valuable because it can show risk scores that come from the intelligence platform. The government system is more valuable because it can aggregate data that flows through all connected applications.

An ecosystem built on shared educational intelligence is qualitatively more powerful than a collection of isolated applications.

### The Transition from Application to Platform

EduNexus began as an application: a tool for Kenyan teachers to generate lesson plans, schemes of work, and learner reports. Like most successful software, it started by solving a specific problem for a specific user in a specific context.

But applications that solve domain problems well accumulate domain knowledge. That knowledge, properly structured, becomes infrastructure. The transition from application to platform is the recognition that the domain knowledge is more valuable as shared infrastructure than as a competitive differentiator inside a single product.

This transition is not automatic. It requires:

**API design.** The internal functions of an application are not the same as the public contracts of a platform. Internal functions can change freely. Public APIs must be versioned, stable, and designed for developers who do not know the internal implementation. Platform thinking requires API design discipline from the beginning.

**Security architecture.** Applications trust their own users. Platforms must trust many different developers building many different products for many different users. The security model changes fundamentally: authentication, authorization, rate limiting, isolation, and audit logging all become more complex.

**Documentation culture.** Applications can survive with thin internal documentation because the team knows how everything works. Platforms require comprehensive external documentation because developers who have never spoken with the platform team must be able to integrate successfully.

**Ecosystem thinking.** Applications optimize for their own users. Platforms optimize for the ecosystem of applications and users that builds on them. This requires thinking differently about feature prioritization: which capabilities, if exposed, would unlock the most ecosystem value?

EduNexus is making this transition deliberately. This book is part of that transition.

### Platform Network Effects

Educational intelligence platforms exhibit two types of network effects:

**Data network effects.** As more learners use applications built on EduNexus, the learner models that power EduNexus become more accurate. More assessment data improves calibration. More teaching interactions improve AI quality. More learning trajectories improve risk prediction. The intelligence becomes more valuable with scale, which makes the platform more valuable to new partners, which attracts more users, which generates more data. This is a compounding flywheel.

**Ecosystem network effects.** As more applications build on EduNexus, the educational ecosystem becomes more interconnected. A student's data from their school LMS can inform their parent app. A teacher's data from their lesson planning tool can inform the school administrator's analytics. Data that previously lived in silos begins to flow meaningfully. This interconnection creates value that no individual application could create alone, which makes the platform more valuable to participants, which attracts more participants.

The combination of both network effects creates a platform that is qualitatively harder to displace than any individual application. Displacing an application requires building a better application. Displacing a platform requires rebuilding an entire ecosystem.

### Why Intelligence Is More Valuable Than Isolated Features

A common mistake in educational technology is to compete on features. Feature X versus feature Y. More modules. More integrations. More report types. This is a race that has no sustainable end.

Intelligence competition is different. Intelligence competition asks: which system better understands learners? Which system better predicts which student needs intervention before they fail? Which system generates content that is more educationally sound? Which system gives teachers more actionable insight?

Intelligence is harder to replicate than features. A competitor can copy a UI. They cannot quickly copy two years of learner progression data, curriculum expert input, teacher feedback loops, and AI training that produced a learner risk model with 87% predictive accuracy.

Intelligence is also more valuable to end users. A teacher does not want more report types. A teacher wants to know which three students in her class of forty are most at risk this week and what specifically she should do about it. That answer requires intelligence, not features.

EduNexus positions itself on intelligence, not features. The intelligence it accumulates becomes the sustainable competitive moat — for EduNexus as a platform, and for every partner application that builds on it.

---

## Chapter 2 — Platform Architecture

### Overview

The EduNexus Developer Platform is a multi-layered architecture designed for composability, security, scalability, and developer ergonomics. At its highest level, it consists of twelve major components organized into four zones.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PARTNER ZONE                                 │
│  Developer Portal  │  Partner Dashboard  │  Marketplace             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                       GATEWAY ZONE                                  │
│  API Gateway  │  AI Gateway  │  Analytics Gateway  │  Event Bus     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     INTELLIGENCE ZONE                               │
│  Curriculum Engine  │  Assessment Engine  │  Learner Intelligence   │
│  Teacher Copilot    │  Career Intelligence │  Plugin Runtime        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    INFRASTRUCTURE ZONE                              │
│  Identity Platform  │  Supabase  │  AI Models  │  SDKs             │
└─────────────────────────────────────────────────────────────────────┘
```

### Developer Portal

The Developer Portal is the primary entry point for external developers. It provides:

**Application registration.** Developers register applications, receive API keys, and configure OAuth clients. Each application is associated with a partner account, a use-case category, and a set of requested permission scopes.

**Documentation.** All API reference documentation, tutorial guides, conceptual explanations, and integration examples live in the Developer Portal. Documentation is versioned alongside API versions.

**API Explorer.** An interactive API exploration environment where developers can test API calls directly in the browser without writing any code. The API Explorer uses the developer's own sandbox credentials, so responses reflect realistic data.

**Analytics.** Per-application usage metrics: API call volume, error rates, latency percentiles, AI token consumption, and cost estimates. Developers can monitor their integrations and identify performance issues before they affect users.

**Quota management.** Developers can view their current quota limits, request quota increases, and set up alerts when they approach limits.

**Webhook management.** Developers configure webhook endpoints, view recent delivery attempts, replay failed deliveries, and inspect webhook payloads.

### Identity Platform

Authentication and authorization for the EduNexus Developer Platform is built on a purpose-designed identity system that supports multiple authentication patterns:

**API key authentication.** Server-to-server integrations use API keys. API keys are scoped to specific resources and actions. They can be rotated without downtime. They support IP allowlisting.

**OAuth 2.0.** Partner applications that act on behalf of teachers, students, or parents use OAuth 2.0 with PKCE. The authorization flow follows the Authorization Code flow with refresh token rotation.

**Service accounts.** Automated systems — cron jobs, data pipelines, background processors — use service account credentials with short-lived JWT tokens issued by the identity platform.

**Federated identity.** Schools that use existing identity providers — Google Workspace for Education, Microsoft Entra ID, or national education identity systems — can federate those identities with EduNexus. Users log in with their existing credentials; EduNexus receives a verified identity claim.

The identity platform enforces:

**Tenant isolation.** Every API call is scoped to a specific tenant (school, district, county, or country). A teacher at School A cannot access data for School B even with valid credentials. Tenant isolation is enforced at the identity layer, not in application code.

**Scope-based authorization.** API keys and OAuth tokens carry explicit scopes. `learner:read` is different from `learner:write`. `curriculum:read` is different from `ai:generate`. Scopes are granular and additive.

**Audit logging.** Every authentication event, every authorization decision, and every API call is logged with full context: who, what, when, from where, and the result. Audit logs are immutable and retained for regulatory compliance.

### Public APIs

The public API surface is organized around educational resources, not technical resources. See Chapter 3 for the full API philosophy. The API families are:

| API Family | Purpose |
|---|---|
| Curriculum API | Structured curriculum data for CBC, 8-4-4, IGCSE, and future curricula |
| Learner Intelligence API | Learner models, risk scores, trajectories, and recommendations |
| Assessment API | Assessment creation, rubric evaluation, and result analytics |
| Teacher Intelligence API | Teacher performance, professional development, and workload analytics |
| School Intelligence API | School-level aggregates, trends, and comparative analytics |
| AI API | Educational content generation with pedagogical grounding |
| Career Intelligence API | Career matching, pathway modeling, and labor market intelligence |
| Events API | Subscription and delivery of domain events |
| Webhooks API | Configuration of webhook endpoints and delivery management |
| Marketplace API | Plugin discovery, installation, and lifecycle management |

### SDKs

Official SDKs are provided for nine programming languages and frameworks. Each SDK provides:

- Typed client classes for every API family
- Authentication helpers
- Retry logic with exponential backoff
- Pagination helpers that abstract cursor-based pagination
- Streaming support for AI generation APIs
- Offline support for mobile SDKs
- Comprehensive error types that map to API error codes

See Chapter 4 for the complete SDK architecture.

### Webhooks

The webhook system delivers educational domain events to partner applications in near-real-time. Partners subscribe to specific event types; EduNexus delivers those events via HTTPS to configured endpoints.

Webhook delivery guarantees:
- At-least-once delivery with idempotency keys
- Automatic retry with exponential backoff
- Dead letter queue for undeliverable events
- Delivery order guarantees within a tenant
- Replay for any event in the last 90 days

See Chapter 7 for the complete event platform design.

### Event Bus

Internally, EduNexus uses an event bus architecture to decouple its components. Educational domain events flow through the event bus asynchronously. The event bus is not directly accessible to partners but powers the webhook system, the analytics pipeline, and the learner intelligence engine.

The event bus is built on a durable, ordered message queue. Events are never lost. Processing failures trigger automatic retries. The event bus provides the ordering guarantees that make the intelligence platform reliable.

### Marketplace

The EduNexus Marketplace is the distribution mechanism for platform extensions. Partners can publish applications, plugins, AI skills, curriculum packs, and subject modules. Schools and districts can discover and install these extensions directly from the marketplace.

See Chapter 8 for the complete marketplace design.

### AI Gateway

The AI Gateway abstracts all interactions with underlying AI models. Partner applications that use EduNexus AI APIs never interact directly with DeepSeek, GPT-4, Claude, or any specific AI provider. They interact with the AI Gateway, which:

- Routes requests to the appropriate AI model for the task
- Enforces educational quality guidelines through system prompts
- Applies curriculum context automatically
- Enforces token budgets per tenant and per API key
- Logs all AI interactions for quality monitoring
- Provides streaming responses with educational structure
- Handles failover between AI providers transparently

The AI Gateway is what turns raw AI capability into educationally reliable AI capability. A lesson plan generated through the AI Gateway will be grounded in accurate curriculum knowledge. A lesson plan generated by calling an AI API directly will be grounded in whatever the AI model learned from its training data — which may be incorrect, outdated, or irrelevant to the Kenyan context.

### Analytics Gateway

The Analytics Gateway aggregates data from all platform components and makes it available through structured analytics APIs. Partners can query:

- School-level aggregates (average learner progress, assessment completion rates, teacher engagement)
- Class-level analytics (topic coverage, performance distributions, intervention triggers)
- Individual learner analytics (progress trajectories, risk indicators, competency gaps)
- Platform usage analytics (API call volumes, feature adoption, integration health)

The Analytics Gateway provides pre-computed aggregates for common queries (daily, weekly, term, year) and ad-hoc query capability for custom analysis. All analytics are tenant-scoped: a partner can only query analytics for tenants they are authorized to access.

### Partner Dashboard

The Partner Dashboard is the operational console for registered partners. It provides:

**Application management.** Create, configure, and delete applications. Manage API keys and OAuth clients. View application health and usage metrics.

**Tenant management.** View all schools and districts using the partner's applications. Monitor per-tenant usage and health. Configure tenant-specific settings.

**Revenue analytics.** For marketplace publishers, the Partner Dashboard shows install counts, active tenants, and revenue sharing payouts.

**Support tools.** Access to support ticket submission, technical escalation, and integration debugging tools.

**Certification status.** View certification level, certification expiry, and certification requirements.

### API Gateway

The API Gateway is the traffic management layer between the internet and the EduNexus intelligence services. It handles:

**Request routing.** Routes API requests to the appropriate service based on the request path and version.

**Authentication verification.** Validates API keys and JWT tokens on every request. Rejects unauthenticated requests before they reach the intelligence services.

**Rate limiting.** Enforces per-application, per-tenant, and global rate limits. Returns 429 responses with Retry-After headers when limits are exceeded.

**Request validation.** Validates request schemas before they reach the intelligence services. Returns 400 responses with detailed validation errors.

**Response transformation.** Normalizes response formats, injects pagination metadata, and handles response compression.

**Circuit breaking.** Implements circuit breaker patterns to protect intelligence services from cascading failures. When a service is degraded, the circuit breaker fails fast and returns 503 rather than queuing requests.

**Observability.** Emits metrics, traces, and logs for every request. The API Gateway is the primary source of reliability and performance data.

### Curriculum Engine

The Curriculum Engine is the authoritative source of structured curriculum knowledge. It contains:

- Complete CBC curriculum for Grade 7 through Grade 12
- 8-4-4 curriculum for Form 1 through Form 4
- IGCSE curriculum for relevant subject areas
- Curriculum relationship graphs (prerequisites, co-requisites, progressions)
- Assessment framework definitions
- Performance indicator matrices
- Competency definitions and descriptors

The Curriculum Engine is not a database. It is a queryable knowledge graph that understands curriculum semantics. You can ask it:

- "What are the prerequisite sub-strands for Grade 9 Mathematics, Strand 4, Sub-Strand 4.3?"
- "What performance indicators distinguish Exceeding Expectation from Meeting Expectation for this learning outcome?"
- "Which learning outcomes in Grade 8 Science connect to which career pathways?"
- "What assessment types are appropriate for this strand?"

These are semantic questions that require curriculum understanding, not just data retrieval.

### Assessment Engine

The Assessment Engine handles the full lifecycle of educational assessment:

- Assessment schema definition (question types, rubric structures, marking schemes)
- Item banking and curriculum alignment tagging
- Assessment delivery tracking
- Automatic marking for structured response types
- Rubric-based evaluation for open-ended responses
- Psychometric calibration for item difficulty and discrimination
- Assessment analytics (item analysis, class performance, reliability estimates)
- Standard-setting support

The Assessment Engine is used both by EduNexus's own teacher tools and exposed to partners through the Assessment API.

### Learner Intelligence Engine

The Learner Intelligence Engine is the most sophisticated component of the platform. It maintains a continuous model of each learner's:

- Competency states across curriculum strands and sub-strands
- Learning trajectory (rate of progress, acceleration, deceleration)
- Risk indicators (dropout risk, performance decline, engagement decline)
- Strength profile (areas of relative mastery)
- Gap profile (areas of relative weakness and their likely causes)
- Learning preferences (inferred from interaction patterns)
- Intervention history (what has been tried, what has worked)

The learner model is updated continuously as new data flows in: assessment results, lesson attendance, assignment completion, teacher observations, and any other data partners contribute.

The Learner Intelligence Engine uses this model to generate:

- Risk scores with explanatory factors
- Personalized learning pathway recommendations
- Intervention priority rankings
- Parent communication recommendations
- Teacher action suggestions

### Teacher Copilot

The Teacher Copilot component provides intelligence specifically oriented around teacher workflows:

- Lesson plan generation grounded in curriculum knowledge
- Scheme of work generation across a full term or year
- Record of work tracking against intended schemes
- Assessment generation aligned to specific learning outcomes
- Observation framework support
- Professional development recommendations based on class performance patterns
- Workload analytics and teacher wellbeing indicators

The Teacher Copilot is exposed to partners through both the Teacher Intelligence API and the AI API.

### Career Intelligence Engine

The Career Intelligence Engine links learner competencies to career pathways and labor market outcomes:

- Career pathway models connecting subject competencies to career requirements
- Labor market data for Kenyan and East African employment contexts
- University program requirements mapped to CBC competency profiles
- Career exploration tools that translate competency profiles into career matches
- Longitudinal tracking of how early competency patterns predict career outcomes

The Career Intelligence Engine is exposed through the Career Intelligence API.

### Plugin Runtime

The Plugin Runtime executes partner-supplied plugins in a sandboxed environment within the EduNexus platform. Plugins extend platform capabilities without requiring platform code changes. The plugin system supports:

- AI skill plugins (custom AI prompts and workflows)
- Curriculum pack plugins (additional curriculum content)
- Assessment plugin extensions
- Analytics extension plugins
- UI extension plugins (for EduNexus's own interfaces)
- Webhook processor plugins

See Chapter 9 for the complete plugin architecture.

---

## Chapter 3 — API Philosophy

### Educational Resources, Not CRUD

Most web APIs are built around CRUD operations on database tables: create a record, read a record, update a record, delete a record. This reflects the internal data model of the application, not the concepts that matter to the domain.

EduNexus APIs are built around educational resources and operations:

Not: `POST /records/{id}` (CRUD)
But: `POST /learners/{id}/assessments/{assessmentId}/evaluate` (educational operation)

Not: `GET /plans/{id}` (CRUD)
But: `GET /teachers/{id}/lesson-plans?term=2&week=4&subject=mathematics` (educational query)

Not: `PUT /students/{id}/scores` (CRUD)
But: `POST /learners/{id}/competencies/update` with a structured update that the Intelligence Engine evaluates and integrates into the learner model.

This distinction matters because educational resources have semantics that CRUD does not capture. When you update a learner's competency state, the intelligence engine does not just store the new value — it updates the trajectory model, recalculates risk scores, checks for prerequisite unlocks, and potentially triggers intervention recommendations. A simple `PUT` on a record cannot express this.

### Domain-First API Design

Every API endpoint is named and structured from the educational domain perspective, not from the technical implementation perspective. A developer who knows educational concepts should be able to read an EduNexus API reference and understand what each endpoint does without needing to understand the underlying data model.

This means:

- Use educational vocabulary: `competencies`, `learning-outcomes`, `strands`, `sub-strands`, `schemes-of-work`, `lesson-plans`, `rubrics`, `performance-indicators`
- Structure queries around educational relationships: a lesson plan belongs to a teacher, a term, a class, and a curriculum position
- Return educational context alongside data: when returning a learner's risk score, return the explanatory factors, not just the number
- Design operations around educational workflows: `generate-lesson-plan`, `evaluate-assessment`, `compute-risk-score`, `recommend-intervention`

### Stable Contracts

The public API is a contract with developers. Breaking changes to a public API break applications that developers have already built and deployed. The cost of a breaking API change is not just the engineering effort to update — it is the loss of developer trust.

EduNexus maintains API stability through:

**Versioning.** Every API endpoint is versioned in its URL: `/v1/`, `/v2/`. A new major version is only introduced when a breaking change is required. Old versions are supported for a minimum of 24 months after a new version is released.

**Additive changes only.** Within a major version, changes are always additive: new fields, new endpoints, new optional parameters. Existing fields are never removed. Existing parameter semantics never change.

**Deprecation notices.** Fields and endpoints that will be removed in the next major version are marked as deprecated with a migration guide. Deprecation warnings appear in API response headers.

**Changelog.** Every change to the public API is documented in a public changelog with the date, the affected endpoints, and the reason for the change.

**Migration guides.** Every major version is accompanied by a comprehensive migration guide that walks developers through every change and provides before/after examples.

### Versioning Strategy

API versioning in EduNexus follows a structured lifecycle:

**Current.** The current major version is actively maintained with bug fixes and new additive features.

**Supported.** The previous major version receives security fixes only. No new features.

**Deprecated.** Versions older than the previous major version receive no updates and display deprecation warnings. Developers have 12 months to migrate.

**Sunset.** Deprecated versions are shut down. Requests to sunset versions receive 410 Gone responses.

The version lifecycle applies to the entire API, not to individual endpoints. This simplifies the lifecycle management and makes it clear to developers when they need to upgrade.

### Idempotency

Distributed systems fail. Networks drop. Responses get lost. Developers must be able to safely retry failed requests without causing duplicate operations.

All EduNexus write operations that have side effects support idempotency keys. A developer supplies an `Idempotency-Key` header with a unique string (typically a UUID). EduNexus stores the result of the first request with that key and returns the stored result for any subsequent requests with the same key. This means the developer can retry freely without worrying about duplicate lesson plans being created, duplicate tokens being consumed, or duplicate assessments being submitted.

Idempotency keys expire after 24 hours. Requests with expired keys are treated as new requests.

### Error Handling

EduNexus error responses follow a consistent structure across all APIs:

```json
{
  "error": {
    "code": "LEARNER_NOT_FOUND",
    "message": "No learner with id 'abc123' exists in this tenant.",
    "details": {
      "tenant_id": "school-xyz",
      "learner_id": "abc123"
    },
    "documentation_url": "https://developers.edunexus.africa/errors/LEARNER_NOT_FOUND",
    "request_id": "req_8f3k2m9x"
  }
}
```

Error codes are:

**Machine-readable.** `LEARNER_NOT_FOUND` is unambiguous. `Not found` is ambiguous. Machine-readable codes allow developers to handle specific error conditions programmatically.

**Documented.** Every error code has a documentation page that explains the error, lists common causes, and provides solutions.

**Contextual.** The `details` field provides context specific to the request that failed. A developer debugging a failed request can see exactly which resource was not found.

**Traceable.** Every error includes a `request_id` that can be provided to EduNexus support for debugging.

HTTP status codes follow standard semantics: 400 for client errors, 401 for authentication failures, 403 for authorization failures, 404 for not found, 409 for conflicts, 422 for validation errors, 429 for rate limiting, and 500/503 for server errors.

### Pagination

All list endpoints that can return more than one page of results use cursor-based pagination. Cursor-based pagination is stable: adding or removing records in the middle of a result set does not cause pages to skip or duplicate records.

Pagination response format:

```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "count": 25,
    "total": 340
  }
}
```

Clients pass `?cursor=eyJpZCI6IjEyMyJ9&limit=25` to fetch the next page. The cursor is opaque — clients should not parse it.

All SDKs provide pagination helpers that abstract this into async iterators, generators, or similar language-appropriate constructs. Developers should not need to implement cursor pagination manually.

### Filtering

List endpoints support structured filtering. Filters are expressed as query parameters with a consistent syntax:

- Equality: `?subject=mathematics`
- Multiple values: `?subject=mathematics,science`
- Date ranges: `?created_after=2026-01-01&created_before=2026-06-30`
- Numeric ranges: `?risk_score_min=70&risk_score_max=100`
- Text search: `?q=algebra`

All available filters are documented for each endpoint. Filters compose with AND semantics: all specified filters must match.

### SDK Generation

The public API is defined in an OpenAPI 3.1 specification. SDKs in all supported languages are generated from this specification and then layered with hand-written conveniences. This approach ensures:

- SDK types stay in sync with API types automatically
- New API capabilities appear in SDKs quickly
- The API specification is the single source of truth
- SDK generation can be run by partners to create bindings in languages not officially supported

### OpenAPI

The complete EduNexus API is documented in an OpenAPI 3.1 specification available at `https://api.edunexus.africa/openapi.yaml`. This specification is:

- Complete: every endpoint, parameter, request body, and response schema is documented
- Machine-readable: tools like Postman, Insomnia, and other API clients can import it directly
- Versioned: each API version has its own OpenAPI document
- Interactive: the Developer Portal API Explorer is powered by this specification

### GraphQL Discussion

GraphQL offers advantages for certain use cases: arbitrary field selection, relationship traversal, and subscription-based real-time updates. These are appealing for developer experience.

EduNexus does not offer a public GraphQL API in v1, for considered reasons:

**Caching complexity.** RESTful APIs cache cleanly at the HTTP level. GraphQL's POST-based query model makes CDN caching unreliable.

**Authorization complexity.** REST APIs can enforce authorization at the endpoint level. GraphQL requires field-level authorization that is harder to audit and easier to misconfigure.

**Versioning complexity.** Adding fields to a GraphQL schema is additive, but removing fields requires deprecation and coordination. The versioning story is less clear than REST.

**Tooling maturity.** REST tooling — API explorers, code generation, documentation — is universally supported. GraphQL tooling is more variable across languages and ecosystems.

A GraphQL API may be introduced in a future version based on partner demand. Partners who need GraphQL-like flexibility should use the Analytics Gateway's ad-hoc query capability, which supports structured queries against pre-authorized data shapes.

### Future gRPC Possibilities

For high-throughput, low-latency server-to-server integrations — particularly in data pipeline contexts — gRPC offers performance advantages over REST: binary serialization, multiplexing, and built-in streaming.

EduNexus will evaluate gRPC as a complement to REST for specific high-throughput APIs in future versions. gRPC will not replace REST for the general public API because REST is universally accessible from any programming environment.

---

## Chapter 4 — SDK Architecture

### Design Principles

Official EduNexus SDKs are designed around four principles:

**Ergonomics first.** A developer should be able to complete a common operation in fewer than ten lines of code. The SDK should feel natural in the programming language it targets, following language idioms rather than imposing a foreign API style.

**Safety by default.** The SDK should make it hard to make mistakes. Authentication should be handled automatically. Sensitive credentials should be kept in configuration, not hardcoded. Error conditions should surface as typed exceptions, not silent failures.

**Reliability built in.** Network calls fail. The SDK should retry automatically with appropriate backoff. It should handle token refresh transparently. It should manage connection pools correctly.

**Complete coverage.** Every public API endpoint should be represented in the SDK. Partial SDKs force developers to drop down to raw HTTP for unsupported endpoints, which defeats the purpose.

### TypeScript SDK

The TypeScript SDK is the primary SDK and receives the most investment. It targets both Node.js server environments and browser environments, with appropriate capability sets for each.

```typescript
import { EduNexus } from '@edunexus/sdk';

const client = new EduNexus({
  apiKey: process.env.EDUNEXUS_API_KEY,
  tenant: 'school-xyz',
});

// Typed, auto-completed, fully async
const learner = await client.learners.get('learner-id');
const riskScore = await client.intelligence.computeRiskScore({
  learnerId: 'learner-id',
  context: 'end-of-term',
});

// Streaming AI generation
const stream = client.ai.generateLessonPlan({
  teacherId: 'teacher-id',
  curriculum: { strand: 3, subStrand: 2, grade: 8 },
  duration: 80,
  stream: true,
});

for await (const chunk of stream) {
  console.log(chunk.text);
}
```

The TypeScript SDK provides:

- Full type definitions for all API resources and parameters
- Zod-based runtime validation of responses in development mode
- Automatic token refresh for OAuth flows
- Cursor-based pagination as async iterables
- Streaming support using standard web streams
- Request/response interceptors for logging and monitoring
- Webhook signature verification utilities
- React hooks package (`@edunexus/react`) that wraps the SDK for React applications

### Python SDK

The Python SDK targets Django, FastAPI, Flask, and standalone script environments. It supports both synchronous and asynchronous usage.

```python
from edunexus import EduNexus

client = EduNexus(
    api_key=os.environ["EDUNEXUS_API_KEY"],
    tenant="school-xyz",
)

# Synchronous
learner = client.learners.get("learner-id")

# Async
async with EduNexus(...) as client:
    learner = await client.learners.get_async("learner-id")

# Streaming
for chunk in client.ai.generate_lesson_plan(
    teacher_id="teacher-id",
    curriculum={"strand": 3, "sub_strand": 2, "grade": 8},
    stream=True,
):
    print(chunk.text)
```

The Python SDK provides:
- Pydantic models for all API resources
- Both sync and async clients
- Django integration helpers
- FastAPI dependency injection support
- Pandas integration for analytics responses

### Flutter SDK

The Flutter SDK targets mobile and web applications built with Flutter and Dart.

```dart
final client = EduNexus(
  apiKey: const String.fromEnvironment('EDUNEXUS_API_KEY'),
  tenant: 'school-xyz',
);

final learner = await client.learners.get('learner-id');
```

The Flutter SDK provides:
- Full Dart type safety with null safety
- Offline caching via SQLite for critical learner data
- Background sync when connectivity is restored
- Flutter state management integration (Riverpod, Bloc providers)
- Responsive handling of 2G/3G connectivity common in East African mobile contexts
- Platform-appropriate authentication flows (biometric, SMS OTP)

The offline support is specifically designed for the Kenyan context, where reliable connectivity cannot be assumed. Teachers using Flutter applications built on EduNexus can view learner profiles, record observations, and mark assessments while offline. Changes sync automatically when connectivity is restored.

### Kotlin SDK

The Kotlin SDK targets Android applications and Kotlin-based server applications.

```kotlin
val client = EduNexus.Builder()
    .apiKey(BuildConfig.EDUNEXUS_API_KEY)
    .tenant("school-xyz")
    .build()

// Coroutines
val learner = client.learners.get("learner-id")

// Flow for streaming
client.ai.generateLessonPlan(params).collect { chunk ->
    println(chunk.text)
}
```

The Kotlin SDK provides:
- Full Kotlin coroutines support
- Flow-based streaming
- Android-specific offline support using Room
- Jetpack Compose integration

### Swift SDK

The Swift SDK targets iOS applications.

```swift
let client = EduNexus(
    apiKey: Bundle.main.infoDictionary?["EDUNEXUS_API_KEY"] as! String,
    tenant: "school-xyz"
)

let learner = try await client.learners.get(id: "learner-id")
```

The Swift SDK provides:
- Full async/await support
- Combine framework integration
- Core Data offline caching
- SwiftUI property wrappers

### PHP SDK

The PHP SDK targets school management systems, WordPress integrations, and traditional web applications common in educational institutions.

```php
$client = new EduNexus\Client([
    'api_key' => getenv('EDUNEXUS_API_KEY'),
    'tenant' => 'school-xyz',
]);

$learner = $client->learners->get('learner-id');
```

The PHP SDK provides:
- PSR-18 HTTP client compatibility
- Laravel service provider
- Symfony bundle
- Guzzle and cURL HTTP adapters

### Java SDK

The Java SDK targets enterprise school management systems and university integrations.

```java
EduNexusClient client = EduNexusClient.builder()
    .apiKey(System.getenv("EDUNEXUS_API_KEY"))
    .tenant("school-xyz")
    .build();

Learner learner = client.learners().get("learner-id");

// CompletableFuture for async
CompletableFuture<Learner> future = client.learners().getAsync("learner-id");
```

The Java SDK provides:
- CompletableFuture for async operations
- Spring Boot autoconfiguration
- Jackson serialization
- Java 11+ compatibility

### .NET SDK

The .NET SDK targets school management systems built on .NET and government systems using Microsoft technology stacks.

```csharp
var client = new EduNexusClient(
    apiKey: Environment.GetEnvironmentVariable("EDUNEXUS_API_KEY"),
    tenant: "school-xyz"
);

var learner = await client.Learners.GetAsync("learner-id");
```

The .NET SDK provides:
- Full async/await support
- IAsyncEnumerable for pagination
- ASP.NET Core dependency injection
- Entity Framework integration for caching

### Go SDK

The Go SDK targets high-performance server applications and microservices.

```go
client := edunexus.NewClient(
    edunexus.WithAPIKey(os.Getenv("EDUNEXUS_API_KEY")),
    edunexus.WithTenant("school-xyz"),
)

learner, err := client.Learners.Get(ctx, "learner-id")
if err != nil {
    log.Fatal(err)
}
```

The Go SDK provides:
- Context propagation throughout
- Structured error types
- Exponential backoff with jitter
- Prometheus metrics integration
- Idiomatic Go patterns (no generics overuse)

### Authentication Across SDKs

All SDKs handle authentication consistently:

1. API key is passed at client construction time
2. The client includes the key in every request header
3. On 401 responses (token expired for OAuth clients), the client automatically refreshes the token and retries
4. On 403 responses, the client surfaces a typed `AuthorizationError` — no automatic retry
5. API keys never appear in logs or error messages

### Retry Logic

All SDKs implement exponential backoff with jitter for transient failures:

- 5xx errors: retry up to 3 times with exponential backoff
- 429 (rate limit): retry after the `Retry-After` header value
- Network errors: retry up to 3 times with exponential backoff
- 4xx errors (except 429): do not retry

The backoff formula: `min(initial_delay * 2^attempt + jitter, max_delay)` where jitter is a random value in `[0, initial_delay]`.

---

## Chapter 5 — AI APIs

### The AI Gateway Philosophy

EduNexus AI APIs are not wrappers around a raw AI API. They are educationally grounded generation services. Every AI API call passes through three layers:

**Curriculum grounding.** The request is enriched with accurate curriculum knowledge before it reaches the AI model. A lesson plan request for Grade 8 Mathematics, Strand 3, automatically retrieves the exact learning outcomes, performance indicators, and prerequisite structure from the Curriculum Engine and includes them in the AI context.

**Pedagogical constraints.** The AI model operates within pedagogical guidelines that reflect best practice for the target educational context. These constraints are expressed as system prompts and guardrails that the AI Gateway enforces on every request.

**Quality validation.** AI responses are validated against the curriculum before they are returned. A lesson plan that references a learning outcome that does not exist in the curriculum is flagged and rejected. A rubric that contradicts the assessment framework is corrected before delivery.

This three-layer approach is what distinguishes EduNexus AI APIs from simply calling an AI model directly. The caller gets educationally valid output, not statistically plausible text.

### Lesson Plan Generation

```
POST /v1/ai/lesson-plans/generate
```

Generates a complete lesson plan for a specified teacher, class, curriculum position, and duration.

**Request:**
```json
{
  "teacher_id": "teacher-abc",
  "class_id": "class-xyz",
  "curriculum": {
    "type": "CBC",
    "grade": 8,
    "subject": "mathematics",
    "strand": 3,
    "sub_strand": 2
  },
  "duration_minutes": 80,
  "prior_lesson_id": "lesson-789",
  "differentiation": {
    "include_remedial": true,
    "include_extension": true
  },
  "stream": true
}
```

The AI Gateway:
1. Retrieves the exact learning outcomes and performance indicators for Grade 8 Maths Strand 3.2 from the Curriculum Engine
2. Retrieves the learner intelligence summary for the specified class — average competency level, known gaps, and at-risk learners
3. Retrieves the prior lesson to ensure continuity
4. Constructs a grounded system prompt that includes all of this context
5. Calls the AI model with the enriched prompt
6. Validates the generated lesson plan against curriculum requirements
7. Streams the validated output to the caller

The result is a lesson plan that is grounded in the actual CBC curriculum, calibrated to the actual learners in the class, and validated before delivery.

**Response (streaming):**
```json
{
  "id": "lp-generated-123",
  "status": "streaming",
  "stream_url": "https://api.edunexus.africa/v1/ai/lesson-plans/lp-generated-123/stream",
  "curriculum_context": {
    "strand": "Algebra",
    "sub_strand": "Linear Equations in One Unknown",
    "learning_outcomes": [...],
    "performance_indicators": {...}
  }
}
```

### Scheme of Work Generation

```
POST /v1/ai/schemes-of-work/generate
```

Generates a complete scheme of work for a teacher for a full term, distributing topics across weeks and ensuring curriculum coverage.

The SOW Generator:
- Maps the full curriculum for the subject and grade across the available teaching weeks
- Accounts for public holidays, examination periods, and school events
- Ensures prerequisite ordering (prerequisite sub-strands are scheduled before dependent sub-strands)
- Distributes content evenly, accounting for topic difficulty
- Generates sub-strand-level entries for each teaching week
- Allows the teacher to specify topics they want to prioritize or adjust

### Assessment Generation

```
POST /v1/ai/assessments/generate
```

Generates a complete assessment instrument — question items, rubrics, and marking schemes — aligned to specified learning outcomes.

Assessment types supported:
- Multiple choice (single and multiple answer)
- Short answer
- Structured response
- Essay
- Project brief with rubric
- Observation checklist
- Portfolio prompt

The Assessment Generator:
- Generates items at specified difficulty levels
- Ensures Bloom's Taxonomy coverage (recall, comprehension, application, analysis, synthesis, evaluation)
- Creates rubrics that align to CBC performance indicators (Below Expectation, Approaching Expectation, Meeting Expectation, Exceeding Expectation)
- Generates Kenyan-context examples and scenarios
- Validates that items assess the specified learning outcomes

### Rubric Generation

```
POST /v1/ai/rubrics/generate
```

Generates assessment rubrics for any educational task — essays, projects, oral presentations, practical work, or portfolio evidence.

Rubrics are generated with:
- CBC-aligned performance levels
- Clear, observable behavioral descriptors at each level
- Subject-specific criteria appropriate to the task
- Holistic and analytic variants

### Observation Analysis

```
POST /v1/ai/observations/analyze
```

Analyzes a teacher's narrative observation of a learner and extracts structured competency assessments.

A teacher writes: *"Amina demonstrated clear understanding of algebraic expressions, accurately solving three out of four problems independently. She struggled with word problems requiring translation from verbal to algebraic form. She supported two classmates in understanding the basic concepts."*

The Observation Analyzer:
- Maps this narrative to specific CBC sub-strands and performance indicators
- Extracts competency assessments with evidence references
- Identifies the competency being evidenced (mathematical reasoning, peer collaboration)
- Updates the learner's competency model
- Flags the word problem difficulty as a targeted gap for intervention

### Learner Risk Analysis

```
POST /v1/ai/learners/{id}/risk/analyze
```

Generates a comprehensive risk analysis for a specific learner with explanatory factors and recommended interventions.

The AI enriches statistical risk scores with:
- Narrative explanation of the primary risk drivers
- Historical pattern analysis
- Comparable learner profiles and what worked for them
- Specific, actionable intervention recommendations ordered by expected impact

### Career Intelligence

```
POST /v1/ai/learners/{id}/career/match
```

Generates personalized career pathway recommendations based on a learner's competency profile, interest signals, and labor market intelligence.

### Report Comment Generation

```
POST /v1/ai/learners/{id}/reports/generate-comment
```

Generates a personalized, meaningful report comment for a learner based on their performance data, teacher observations, and competency assessments. Comments are:
- Specific to the individual learner
- Referenced to actual evidence
- Written in appropriate language for the report audience (parents, students)
- Constructive and growth-oriented
- Free from generic phrases like "a pleasure to teach"

### Intervention Recommendations

```
POST /v1/ai/learners/{id}/interventions/recommend
```

Generates a prioritized list of intervention recommendations for a learner, organized by urgency, resource requirement, and expected impact.

### Curriculum Validation

```
POST /v1/ai/content/validate
```

Validates any educational content — a lesson plan, an assessment, a learning resource, a textbook chapter — for alignment to specified curriculum requirements.

Returns:
- Alignment score
- Specific learning outcomes covered
- Gaps in coverage
- Factual accuracy issues
- Pedagogical concerns
- Age-appropriateness assessment

### Prompt Abstraction

Partners who use EduNexus AI APIs never write AI prompts. They provide educational parameters — grade, subject, curriculum position, learner context — and the AI Gateway constructs appropriate prompts.

This abstraction is not just a convenience. It is a quality guarantee. EduNexus invests significant effort in prompt engineering for the educational context. The prompts encode curriculum knowledge, pedagogical best practices, and the Kenyan educational context in ways that a developer building their first educational AI feature could not replicate.

Partners who want to customize AI behavior can do so through parameters (tone, length, differentiation level) and through the plugin system (custom AI skills that extend base prompts).

### Streaming Generation

All AI generation endpoints support streaming. Streaming is strongly recommended for long-form generation (lesson plans, schemes of work, reports) to provide responsive user experiences:

- The first token arrives in under 2 seconds
- Content appears progressively, allowing users to start reading while generation continues
- Partial results can be saved as drafts
- Generation can be cancelled if the user decides to adjust parameters

Streaming uses server-sent events (SSE) for web clients and streaming RPC semantics for gRPC clients (when available).

### Draft Workflows

AI generation produces drafts, not final outputs. The platform treats all AI-generated content as a starting point for human review and editing.

The draft workflow:
1. AI generation produces a draft with a unique draft ID
2. The draft is stored in the platform with `status: draft`
3. The teacher or developer reviews and edits the draft
4. When satisfied, the teacher approves the draft, setting `status: approved`
5. Approved content is published to its destination (lesson plan library, assessment bank, etc.)
6. Approved content feeds back into AI quality monitoring

This workflow ensures that AI-generated content is always human-reviewed before it affects learners. It also creates a feedback dataset: the edits that teachers make to AI drafts reveal where the AI falls short, and this feedback improves future generation.

### AI Quality Guarantees

EduNexus provides the following quality commitments for AI API outputs:

**Curriculum accuracy.** Generated content references only learning outcomes, sub-strands, and performance indicators that exist in the specified curriculum. Hallucinated curriculum elements are detected and rejected.

**Contextual relevance.** Generated examples, scenarios, and contexts are relevant to Kenya and to the specified learner age group. Generic or culturally mismatched content is flagged.

**Pedagogical appropriateness.** Generated content follows established pedagogical principles for the specified educational level. Developmentally inappropriate content is rejected.

**Language quality.** Generated content is grammatically correct and appropriately formal for educational use.

These guarantees are enforced through a combination of validation prompts, curriculum checks, and human review of sampled outputs.

---

## Chapter 6 — Educational Intelligence APIs

### The Intelligence API Philosophy

The Educational Intelligence APIs expose computed intelligence — not raw data. The distinction is fundamental:

Raw data: `{"assessment_score": 62, "previous_score": 71}`

Intelligence: `{"competency_trajectory": "declining", "risk_level": "elevated", "primary_driver": "algebraic_reasoning_gap", "recommended_intervention": {...}, "similar_learner_outcomes": {...}}`

Any application can store and retrieve raw data. Only an intelligence layer can transform raw data into actionable educational insight. The Educational Intelligence APIs expose that transformation as a service.

### Learner Intelligence API

#### Get Learner Model

```
GET /v1/intelligence/learners/{id}/model
```

Returns the complete learner intelligence model:

```json
{
  "learner_id": "learner-abc",
  "model_version": "2026-06",
  "competency_states": {
    "CBC_G8_MATHS_S3_SS2": {
      "level": "approaching_expectation",
      "confidence": 0.87,
      "evidence_count": 12,
      "trajectory": "improving",
      "last_updated": "2026-06-15T09:23:00Z"
    }
  },
  "risk_profile": {
    "overall_risk": 42,
    "risk_level": "moderate",
    "primary_risk_factors": [
      {
        "factor": "algebraic_reasoning_gap",
        "weight": 0.34,
        "evidence": "4 consecutive assessments below expectation in Strand 3"
      }
    ]
  },
  "strength_profile": {
    "top_competencies": [...],
    "learning_preferences": {...}
  },
  "trajectory": {
    "grade_7_average": 68,
    "grade_8_current": 71,
    "trend": "improving",
    "projected_grade_8_final": 74
  }
}
```

#### Compute Risk Score

```
POST /v1/intelligence/learners/{id}/risk/compute
```

Computes a fresh risk score for a learner, using all available data. Optionally accepts additional context:

```json
{
  "context": "end_of_term",
  "include_factors": true,
  "include_recommendations": true,
  "include_comparable_cases": true
}
```

#### Get Learning Trajectory

```
GET /v1/intelligence/learners/{id}/trajectory
```

Returns the learner's historical progression across all tracked competencies, with trend lines and projections.

#### Recommend Pathway

```
POST /v1/intelligence/learners/{id}/pathway/recommend
```

Recommends the optimal learning pathway for the next teaching period, based on the learner's current competency state, identified gaps, and curriculum position.

#### Batch Learner Intelligence

```
POST /v1/intelligence/learners/batch/risk
```

Computes risk scores for a list of learners in a single request. Essential for class-level risk reporting where computing individual scores sequentially would be too slow.

### Teacher Intelligence API

#### Get Teacher Intelligence Summary

```
GET /v1/intelligence/teachers/{id}/summary
```

Returns a summary of teacher intelligence:
- Class performance metrics
- Teaching pattern analysis
- Professional development indicators
- Workload assessment
- Student engagement metrics

#### Analyze Class Performance

```
POST /v1/intelligence/teachers/{id}/classes/{classId}/analyze
```

Provides a structured analysis of class performance:
- Competency distribution (what percentage of the class is at each performance level for each sub-strand)
- Cluster analysis (groups of learners with similar profiles)
- Coverage analysis (curriculum coverage against the scheme of work)
- Teaching effectiveness indicators

#### Recommend Professional Development

```
POST /v1/intelligence/teachers/{id}/development/recommend
```

Analyzes teaching patterns and class outcomes to recommend professional development priorities. For example: if a teacher's class consistently underperforms on higher-order thinking tasks, the system recommends CPD focused on Bloom's higher-order questioning techniques.

### School Intelligence API

#### Get School Intelligence Dashboard

```
GET /v1/intelligence/schools/{id}/dashboard
```

Returns a school-level intelligence summary:
- Average learner progress across all grades and subjects
- Curriculum coverage rates
- At-risk learner counts and trends
- Teacher activity metrics
- Assessment completion rates
- Year-on-year comparisons

#### Analyze Curriculum Coverage

```
GET /v1/intelligence/schools/{id}/curriculum-coverage
```

Returns a detailed breakdown of curriculum coverage across all teachers and classes:
- Which sub-strands have been taught
- Which are on track to be completed by end of term
- Which are at risk of being missed
- Teacher-by-teacher comparison

#### Get Assessment Analytics

```
GET /v1/intelligence/schools/{id}/assessments/analytics
```

Aggregates assessment data across all classes:
- Assessment completion rates
- Score distributions
- Subject difficulty analysis
- Assessment quality indicators

### Assessment Analytics API

#### Analyze Assessment Results

```
POST /v1/intelligence/assessments/{id}/analyze
```

Performs psychometric analysis on assessment results:
- Item difficulty (p-value)
- Item discrimination (point-biserial correlation)
- Reliability estimate (Cronbach's alpha)
- Difficulty range analysis
- Bias indicators

#### Get Competency Diagnostics

```
POST /v1/intelligence/assessments/{id}/competency-diagnostics
```

Maps assessment results to competency states for all assessed learners. Returns a structured update for the Learner Intelligence Engine.

### Progress Tracking API

#### Record Learner Progress

```
POST /v1/intelligence/learners/{id}/progress
```

Records a progress event that updates the learner model. Progress events can be:
- Assessment result
- Teacher observation
- Assignment completion
- Formative check-in
- Peer assessment
- Portfolio evidence submission

#### Get Progress Timeline

```
GET /v1/intelligence/learners/{id}/progress/timeline
```

Returns a chronological timeline of all progress events for a learner, with the competency impact of each event.

### Curriculum Coverage API

#### Record Teaching Event

```
POST /v1/intelligence/teachers/{id}/teaching-events
```

Records that a teacher has taught a specific curriculum sub-strand to a specific class. Updates the Record of Work and curriculum coverage model.

#### Get Coverage Report

```
GET /v1/intelligence/teachers/{id}/coverage
```

Returns curriculum coverage analysis for a teacher — what they intended to teach (scheme of work), what they have taught (record of work), and the gap.

### Intervention Scoring API

#### Score Intervention Effectiveness

```
POST /v1/intelligence/interventions/{id}/score
```

Scores the effectiveness of a completed intervention by comparing the learner's trajectory before and after. Returns an effectiveness score and updates the intervention recommendation model.

#### Get Intervention History

```
GET /v1/intelligence/learners/{id}/interventions/history
```

Returns the complete history of interventions applied to a learner, with effectiveness scores.

### Risk Prediction API

#### Predict Dropout Risk

```
POST /v1/intelligence/schools/{id}/risk/dropout/predict
```

Predicts dropout risk for all learners in a school using the full available data. Returns a ranked list of at-risk learners with explanatory factors.

#### Predict Grade Risk

```
POST /v1/intelligence/learners/{id}/risk/grade/predict
```

Predicts end-of-term grade risk for a learner — what grade they are likely to achieve if current trends continue.

### Behavioral Insights API

#### Analyze Engagement Patterns

```
GET /v1/intelligence/learners/{id}/engagement
```

Analyzes engagement patterns from platform interaction data:
- Login frequency and patterns
- Assignment completion times
- Time-on-task metrics
- Help-seeking behavior
- Peer collaboration patterns

### Career Matching API

#### Match Learner to Careers

```
POST /v1/intelligence/learners/{id}/careers/match
```

Matches a learner's competency profile to career pathways with probability scores and gap analysis.

#### Get Career Trajectory

```
GET /v1/intelligence/learners/{id}/careers/trajectory
```

Projects how the learner's current competency trajectory translates to career readiness over time.

### Growth Modeling API

#### Model Growth Scenarios

```
POST /v1/intelligence/learners/{id}/growth/model
```

Models what the learner could achieve under different intervention scenarios. Returns projected competency states for each scenario.

### Learning Trajectories API

#### Get Class Trajectory Comparison

```
GET /v1/intelligence/classes/{id}/trajectories/compare
```

Compares learning trajectories across all learners in a class, identifying clusters of similar progression patterns and outliers requiring attention.

---

## Chapter 7 — Event Platform

### Why Event-Driven Integration Matters

Polling APIs for changes is expensive and slow. An application that checks every five minutes whether a learner's risk score has changed is making twelve API calls per hour per learner — and still responding with up to five minutes of delay.

Event-driven integration is both cheaper and faster. EduNexus emits an event the moment a learner's risk score crosses a threshold. A subscribed application receives that event within seconds and can act immediately. No polling. No delay. No wasted API calls.

More importantly, events enable integration patterns that polling cannot. A parent communication application can listen for learner performance events and send a message to the parent the same day a concern emerges — not at the next parent-teacher meeting. A school ERP can listen for enrollment events and automatically provision accounts in connected systems. A district analytics system can maintain a real-time aggregate without querying thousands of individual schools.

### Educational Domain Events

EduNexus emits educational domain events that describe meaningful changes in the educational world:

**Learner events:**
- `learner.risk_score.elevated` — a learner's risk score has crossed the elevated threshold
- `learner.risk_score.critical` — a learner's risk score has crossed the critical threshold
- `learner.competency.milestone` — a learner has reached a competency milestone (e.g., passing a prerequisite that unlocks a new strand)
- `learner.intervention.triggered` — an automated intervention recommendation has been generated
- `learner.trajectory.changed` — a learner's progress trajectory has shifted (improving, declining, stalled)

**Assessment events:**
- `assessment.completed` — an assessment session has been completed
- `assessment.result.available` — a result has been calculated and validated
- `assessment.anomaly.detected` — an assessment result is outside expected ranges (possible anomaly)

**Teacher events:**
- `teacher.lesson_plan.approved` — a teacher has approved a lesson plan
- `teacher.record_of_work.updated` — a teacher has updated their record of work
- `teacher.class.coverage_alert` — a class is falling behind on curriculum coverage

**School events:**
- `school.term.started` — a new term has begun
- `school.term.ended` — a term has ended
- `school.risk.cohort_alert` — a significant proportion of the school is at elevated risk

**Platform events:**
- `api.quota.approaching` — an application is approaching its quota limit
- `webhook.delivery.failing` — webhook deliveries to an endpoint are failing

### Event Schema

All EduNexus events follow a consistent schema:

```json
{
  "id": "evt_8f3k2m9x",
  "type": "learner.risk_score.elevated",
  "version": "1.0",
  "timestamp": "2026-06-29T14:23:45Z",
  "tenant_id": "school-xyz",
  "data": {
    "learner_id": "learner-abc",
    "previous_risk_level": "moderate",
    "current_risk_level": "elevated",
    "risk_score": 72,
    "primary_factor": "assessment_decline",
    "recommended_actions": [...]
  },
  "metadata": {
    "source": "learner-intelligence-engine",
    "idempotency_key": "risk-elevation-learner-abc-2026-06-29"
  }
}
```

### Subscriptions

Partners subscribe to event types through the Webhooks API or the Partner Dashboard. Subscriptions are:

**Typed.** Subscribe to specific event types, not a firehose. A parent communication application subscribes to `learner.risk_score.elevated`, not to all events.

**Filtered.** Apply filters to reduce noise. Subscribe to `learner.risk_score.elevated` only for learners with parent communication enabled.

**Scoped.** Subscriptions are automatically scoped to the partner's authorized tenants. A partner cannot receive events for schools they are not authorized to access.

### Webhook Delivery

EduNexus delivers events via HTTPS POST to a configured endpoint. Each delivery:

1. Constructs the event payload as JSON
2. Signs the payload with the partner's webhook secret using HMAC-SHA256
3. Sends a POST request with the signed payload
4. Expects a 2xx response within 30 seconds
5. On failure, schedules a retry

Partners verify the signature using the webhook secret:

```typescript
import { EduNexus } from '@edunexus/sdk';

const event = EduNexus.webhooks.constructEvent(
  rawBody,
  request.headers['edunexus-signature'],
  process.env.EDUNEXUS_WEBHOOK_SECRET
);
```

### Retries

Failed deliveries are retried with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | Immediately |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 6 hours |
| 7 | 24 hours |

After 7 failed attempts, the event is moved to the dead letter queue.

### Dead Letter Queue

Events in the dead letter queue are retained for 30 days. Partners can inspect the dead letter queue through the Partner Dashboard, fix the issue with their endpoint, and replay events.

### Ordering Guarantees

Within a single tenant, events are delivered in the order they were emitted. Cross-tenant ordering is not guaranteed.

This ordering guarantee matters for educational workflows. If a learner completes an assessment (event A) and then the risk score is recalculated (event B), the partner application receives A before B. It can safely use A to update its local state before processing B.

### Replay

Any event from the last 90 days can be replayed through the Events API:

```
POST /v1/events/replay
```

```json
{
  "event_types": ["learner.risk_score.elevated"],
  "from": "2026-06-01T00:00:00Z",
  "to": "2026-06-29T23:59:59Z",
  "tenant_id": "school-xyz"
}
```

Replay is useful for:
- Recovering from extended webhook endpoint outages
- Onboarding a new application that needs to process historical events
- Testing event processing logic against real historical data

### Event Versioning

Event schemas are versioned. The `version` field in every event indicates the schema version. When EduNexus needs to change an event schema in a breaking way, it introduces a new version.

Partners subscribe to specific versions:
- `learner.risk_score.elevated:1.0`
- `learner.risk_score.elevated:2.0`

Old versions are supported for 12 months after a new version is introduced. Partners receive deprecation notices with a migration guide.

### Partner Event Processing

Partners that consume events should:

**Process idempotently.** Events may be delivered more than once (at-least-once delivery). Partners must handle duplicate delivery without side effects. Use the event `id` as an idempotency key.

**Respond quickly.** Return a 2xx response as quickly as possible. If processing takes more than a few seconds, queue the event internally and process asynchronously. A slow or timing-out endpoint causes retries.

**Handle failures gracefully.** Not every event requires a user-facing action. If processing fails, log the failure and continue. Do not crash the application.

**Monitor the dead letter queue.** Check the dead letter queue regularly. Events in the DLQ represent actions that were never taken on real educational data.

---

## Chapter 8 — Marketplace

### The EduNexus Marketplace Vision

The EduNexus Marketplace is where the platform becomes an ecosystem.

Without a marketplace, EduNexus is a platform: a set of capabilities that developers access through APIs. With a marketplace, EduNexus becomes an ecosystem: a collection of applications, plugins, content packs, and AI skills that schools can discover, evaluate, and install directly.

The marketplace lowers the barrier to integration for schools (they discover and install without procurement complexity) and creates a distribution channel for partners (they publish once and reach every EduNexus school). It also creates a quality signal: marketplace listing requires a certification review that gives schools confidence in the quality and security of what they install.

### Marketplace Item Types

**Applications.** Full partner applications that integrate with EduNexus. An application appears as a card in the marketplace with a description, screenshots, pricing, ratings, and an install button. When a school administrator installs an application, the application is authorized to access the school's EduNexus data according to the scopes it has requested.

**Plugins.** Extensions to the EduNexus core experience. A plugin adds a capability to EduNexus itself — a new assessment type, a new report format, a new AI skill, a new UI widget in the teacher dashboard. Plugins run inside the Plugin Runtime (Chapter 9).

**AI Skills.** Custom AI prompting extensions. An AI skill defines a new generation capability: "Generate a remedial worksheet for this sub-strand" or "Analyze this essay for persuasive writing techniques." AI skills extend the AI Gateway's capability set without requiring platform code changes.

**Curriculum Packs.** Additional curriculum data for curricula not built into the core platform. A curriculum pack could add the Cambridge IGCSE Mathematics curriculum, the IB Middle Years Programme, or a national curriculum from another African country.

**Subject Modules.** Deep, subject-specific content for a particular curriculum subject. A Subject Module for Grade 10 Chemistry might include complete learning resources, assessment banks, and AI skills specific to that subject.

**Partner Integrations.** Certified integrations with third-party systems — specific school ERPs, LMS platforms, payment gateways, communication systems. These appear in the marketplace as integration options that school administrators can activate.

### Billing

The marketplace supports multiple pricing models:

**Free.** No cost to install or use.

**Freemium.** Free tier with premium capabilities available through upgrade.

**Subscription.** Monthly or annual per-school or per-teacher pricing.

**Per-use.** Pricing based on consumption (per learner, per assessment, per AI generation).

**One-time.** A single purchase price for perpetual use.

EduNexus handles all billing through the marketplace. Schools pay EduNexus; EduNexus pays partners. Partners do not need to build their own billing infrastructure for marketplace sales.

### Revenue Sharing

EduNexus retains a platform fee (20% for applications, 15% for plugins and curriculum packs) from marketplace revenue. Partners receive the remainder. Revenue is calculated on net transactions after refunds.

Partners can set their own pricing within marketplace guidelines. EduNexus does not dictate pricing, but provides pricing analytics and recommendations based on market data.

### Certification

All marketplace items require certification before listing. Certification levels:

**Basic Certification.** Technical review: does the integration work correctly? Does it follow security guidelines? Is the documentation complete?

**Standard Certification.** Basic certification plus: does the integration respect learner data privacy? Is the user experience appropriate for educational contexts?

**Premium Certification.** Standard certification plus: has the educational quality been reviewed by curriculum experts? Does the AI content meet educational quality standards? Has the integration been tested in real school environments?

Schools can filter marketplace listings by certification level. Enterprise and government customers may require Premium Certification for all integrations.

### Security Review

Every marketplace item undergoes a security review as part of certification:

- API scope audit: does the application request only the scopes it needs?
- Data handling audit: does the application handle learner data appropriately?
- Vulnerability assessment: does the integration introduce security vulnerabilities?
- Privacy compliance: does the integration comply with Kenya's Data Protection Act and relevant GDPR principles?

Applications that fail the security review are not listed until the issues are resolved.

### Publishing Workflow

The publication workflow:

1. **Submit.** Partner submits the application, documentation, and certification request through the Partner Dashboard.

2. **Technical Review.** EduNexus engineers review the integration for correctness and security. Feedback is provided within 5 business days.

3. **Certification Review.** A curriculum or educational quality review (for Premium Certification). Feedback is provided within 10 business days.

4. **Approval.** The item is approved and listed in the marketplace.

5. **Launch.** The partner may request a featured placement for a launch period.

6. **Ongoing Monitoring.** EduNexus monitors listed applications for quality signals: user ratings, error rates, support ticket volume. Items that fall below quality thresholds receive warnings and can be delisted.

### Developer Ratings

Schools rate marketplace items on five dimensions:
- Ease of integration
- Reliability
- Educational quality
- Support responsiveness
- Value for price

Ratings are weighted by school size and tenure. A large school that has used an application for a full year has a higher-weighted rating than a small school that installed it last week.

Partners can respond publicly to reviews. EduNexus mediates disputes.

### Enterprise Marketplace

Large districts, counties, and government agencies need more than self-service marketplace installation. The Enterprise Marketplace provides:

**Bulk installation.** Install an application across hundreds of schools in a single operation.

**Centralized billing.** All marketplace spending aggregated to a single invoice for the district or county.

**Policy enforcement.** Set policies about which applications schools in the district may install, and which require district approval.

**Custom procurement.** For applications not in the marketplace, the enterprise marketplace supports custom procurement with negotiated pricing.

---

## Chapter 9 — Plugin Architecture

### What Is a Plugin?

A plugin is a packaged extension to the EduNexus platform that runs inside the EduNexus environment with access to controlled platform capabilities. Plugins extend EduNexus without requiring changes to the core platform code.

The distinction between an application and a plugin:

An **application** is an independent product that integrates with EduNexus via APIs. It runs on the partner's own infrastructure. It has its own database, its own servers, its own user interface. EduNexus is one of its integrations.

A **plugin** runs inside EduNexus. It has no separate server. It executes within the Plugin Runtime, which provides sandboxed access to platform capabilities. A plugin extends what EduNexus can do rather than building a separate application.

### Plugin Lifecycle

**Development.** Partners develop plugins using the EduNexus Plugin SDK. Plugins are JavaScript/TypeScript modules that export a plugin manifest and capability handlers.

**Local testing.** The EduNexus CLI provides a local plugin development environment that simulates the Plugin Runtime without requiring a live platform connection.

**Submission.** The partner submits the plugin through the Partner Dashboard. The plugin is reviewed for security and functionality.

**Certification.** The plugin goes through the standard marketplace certification process.

**Installation.** Schools install the plugin from the marketplace. The Plugin Runtime loads it for that tenant.

**Execution.** When a capability handled by the plugin is triggered, the Plugin Runtime executes the plugin handler in a sandboxed environment.

**Updates.** Plugin updates are submitted, reviewed, and published. The Plugin Runtime automatically updates plugins with tenant permission.

### Plugin Capabilities

Plugins can extend the following capability areas:

**AI extensions.** Define new AI generation skills that appear alongside EduNexus's built-in AI capabilities. An AI extension can define new prompting strategies, integrate external knowledge sources, or extend the output format.

**Assessment extensions.** Add new assessment item types that the Assessment Engine can handle. A partner with specialized assessment expertise can add item types (e.g., adaptive items, multimedia items) not in the core engine.

**Curriculum extensions.** Add curriculum packs that the Curriculum Engine can reference. A curriculum extension adds a new curriculum structure to the Curriculum Engine's knowledge graph.

**Analytics extensions.** Add new analytics computations to the Analytics Gateway. An analytics extension can define custom metrics, custom aggregations, or custom visualizations.

**Workflow extensions.** Add new automated workflows triggered by platform events. A workflow extension can define triggers, conditions, and actions in a declarative format.

**UI extensions.** Add new UI components to EduNexus's own teacher and administrator interfaces. UI extensions render inside designated extension points in the EduNexus UI using a sandboxed iframe model.

### Permission Model

Plugins operate under a strict permission model. A plugin must declare all permissions it needs in its manifest. Installing the plugin prompts the school administrator to approve the requested permissions. Plugins cannot access any resource beyond their approved permissions.

Plugin permission examples:
- `learner.risk:read` — read learner risk scores for the tenant
- `ai.generate:lesson_plan` — use AI generation for lesson plans
- `curriculum:read` — read curriculum data
- `events.subscribe:learner.*` — subscribe to all learner events

Permissions are enforced by the Plugin Runtime. A plugin handler that attempts to access a resource it was not granted permission for receives an authorization error.

### Sandboxing

Plugins execute in a secure sandbox:

**Compute isolation.** Each plugin handler executes in an isolated JavaScript context with a strict timeout (typically 30 seconds for synchronous operations, 5 minutes for background operations).

**Memory isolation.** Plugins cannot access memory from other plugins or from the core platform.

**Network isolation.** By default, plugins cannot make outbound network requests. Plugins that need to call external APIs must declare this in their manifest and receive explicit permission.

**File system isolation.** Plugins have no access to the file system.

**Capability-only access.** Plugins interact with the platform only through the Plugin SDK's capability APIs, never through direct database access or internal service calls.

### Extension APIs

The Plugin SDK provides Extension APIs that plugins use to interact with the platform:

```typescript
import { PluginContext, LearnerAPI, CurriculumAPI } from '@edunexus/plugin-sdk';

export async function handleRiskAlert(
  context: PluginContext,
  event: LearnerRiskElevatedEvent
): Promise<void> {
  const learner = await context.learners.get(event.learnerId);
  const curriculum = await context.curriculum.getCompetencyState({
    learnerId: event.learnerId,
    strandId: 'CBC_G8_MATHS_S3',
  });

  await context.notifications.send({
    recipient: learner.parentContactId,
    template: 'risk-alert-parent',
    data: { learner, curriculum },
  });
}
```

### Version Compatibility

Plugins declare the minimum platform version they require. The Plugin Runtime validates compatibility before installing or updating a plugin. Plugins that require capabilities not available in the current platform version are not installed.

Platform version changes that would break existing plugins are introduced with a compatibility layer and a migration period.

---

## Chapter 10 — Multi-Tenant Partner Platform

### Tenant Hierarchy

EduNexus organizes tenants in a hierarchy that reflects the structure of educational systems:

```
Country
  └── County / District
       └── Zone / Circuit
            └── School
                 ├── Campus
                 └── Class
```

Partners can operate at any level of this hierarchy. A school-level application accesses data for a single school. A district-level application accesses data for all schools in the district. A county-level analytics platform accesses data for all schools in the county. A national government integration accesses aggregate data for the entire country.

Authorization is automatically scoped to the tenant level the partner has been granted access to.

### Tenant Isolation

Tenant isolation is absolute. A query issued in the context of School A will never return data for School B, even if the same API key is used. Isolation is enforced at the database level, the API Gateway level, and the identity platform level.

Cross-tenant queries (district-level aggregates, county-level analytics) are explicitly modeled as aggregate queries and return only aggregated data, not individual school records.

### Tenant Configuration

Each tenant can configure:

- **Branding.** Logo, colors, and display name for EduNexus-powered interfaces.
- **Language preferences.** Primary language for AI content generation.
- **Calendar.** School calendar including term dates, holiday dates, and examination dates.
- **Class structure.** Class groupings, stream names, and teacher assignments.
- **Notification preferences.** Which events trigger which notifications to which stakeholders.
- **Feature flags.** Which EduNexus capabilities are enabled for this tenant.
- **Data retention policies.** How long different data types are retained.

Partners can read tenant configuration for their authorized tenants and, with appropriate permissions, contribute configuration (e.g., a communication app might contribute notification preferences).

### White-Label Support

Partners who want to provide a white-label EduNexus experience can configure:

- Custom domain (e.g., `ai.myschool.co.ke` instead of `edunexus.africa`)
- Complete branding replacement (logo, colors, fonts, terminology)
- Custom email sending domain and templates
- Custom SMS sender ID
- Suppression of EduNexus branding in generated documents

White-label support is available to partners with Enterprise-level agreements and Premium Certification.

### Partner Quotas

Every partner application operates within quota limits:

**API rate limits.** Maximum requests per minute per API family.

**AI token budget.** Maximum AI tokens consumed per day across all tenants.

**Webhook concurrency.** Maximum simultaneous webhook deliveries.

**Tenant limit.** Maximum number of tenants the application can be installed in.

**Event subscription limit.** Maximum number of event subscriptions.

Quota limits are set based on the partner tier (Starter, Professional, Enterprise) and can be increased through a quota request process.

### Usage Analytics

Partners have full visibility into their usage through the Partner Dashboard:

- API call volume over time
- API call breakdown by endpoint
- Error rate breakdown by error type
- AI token consumption by capability
- Webhook delivery success rate
- Active tenant count over time

Usage analytics update in near real-time and are available with day-level granularity going back 12 months.

### API Billing

For partners beyond the free tier, API usage is billed based on consumption:

| API Family | Unit | Price |
|---|---|---|
| Learner Intelligence | Per learner model read | $0.001 |
| AI Generation | Per 1000 tokens | $0.002 |
| Assessment API | Per assessment session | $0.005 |
| Curriculum API | Per 1000 requests | $0.10 |
| Events | Per 10,000 events delivered | $0.50 |

Pricing is designed to make EduNexus economically accessible for small applications while reflecting the cost of providing the intelligence infrastructure.

Enterprise partners negotiate custom pricing based on committed volumes.

---

## Chapter 11 — Educational Ecosystem

### The Ecosystem Vision

A true educational ecosystem is one in which data, intelligence, and workflows flow freely between specialized systems — where the school ERP and the LMS and the assessment platform and the parent app all share a common understanding of each learner, each curriculum, and each educational outcome.

EduNexus is the hub of this ecosystem: the shared intelligence layer that gives every participating system a common vocabulary and common intelligence. Without this hub, ecosystem participants must build bilateral integrations with every other participant — an n-squared problem that never gets solved. With the hub, each participant integrates once with EduNexus and gains interoperability with every other participant.

### School ERP Integration

School ERPs are the operational backbone of schools: they manage enrollment, attendance, timetabling, examinations, fees, and HR. They hold the source of truth for basic school operational data.

EduNexus integrates with school ERPs in both directions:

**ERP to EduNexus.** The ERP pushes enrollment events, attendance records, and class assignments to EduNexus. EduNexus incorporates this data into learner models and school intelligence.

**EduNexus to ERP.** EduNexus pushes assessment results, risk alerts, and curriculum progress data to the ERP, allowing ERP operators to see educational outcomes alongside operational data.

Certified ERP integrations are available in the marketplace for the most common school management systems used in Kenya.

### LMS Integration

Learning Management Systems manage learning resources, assignments, and digital submission workflows. EduNexus integrates with LMS platforms to:

- Provide curriculum-aligned assignment templates
- Receive assignment completion data to update learner models
- Surface learner risk intelligence within the LMS teacher experience
- Push AI-generated content directly into the LMS content library
- Validate that LMS content aligns to curriculum requirements

The LMS integration uses the standard Events API for real-time data flow and the Educational Intelligence APIs for intelligence retrieval.

### Assessment Provider Integration

Specialized assessment platforms — examination systems, psychometric testing platforms, diagnostic assessment tools — integrate with EduNexus to:

- Tag assessment items with CBC curriculum alignment
- Receive learner models to inform adaptive assessment
- Push assessment results to update EduNexus learner models
- Access assessment analytics and calibration services

### Learning Content Publishers

Educational publishers — textbook publishers, digital content creators, video learning platforms — integrate with EduNexus to:

- Validate that their content is curriculum-aligned using the Curriculum Validation API
- Tag content items with curriculum alignment for searchability
- Surface content recommendations based on learner models
- Receive usage data to understand how their content affects learning outcomes

### Libraries and Resource Centers

School libraries and educational resource centers integrate with EduNexus to:

- Recommend resources to learners based on their curriculum position and learning profile
- Track how resource usage correlates with learning outcomes
- Support teacher discovery of resources aligned to their planned lessons

### Government Systems

National and county government educational systems integrate with EduNexus for:

- Aggregate analytics across all schools in a jurisdiction
- Early warning systems for schools with high learner risk concentrations
- Teacher deployment intelligence (where are teachers most needed based on learning outcomes?)
- Examination and credential management
- Policy evaluation (is this curriculum change improving outcomes?)

Government integrations receive aggregate and anonymized data, not individual learner records, unless the government entity has a direct regulatory relationship with the schools in question.

### University Systems

Universities integrate with EduNexus to:

- Validate secondary school credentials against verified assessment records
- Assess applicant readiness using EduNexus learner intelligence
- Provide early admission signals to secondary schools
- Feed graduate outcome data back into career intelligence models

### Research Platforms

Educational researchers integrate with EduNexus (with appropriate ethical approvals and data governance agreements) to:

- Access anonymized longitudinal learner data for research
- Test intervention effectiveness at scale
- Validate predictive models against real outcomes
- Contribute research findings to improve platform intelligence

### Payment Providers

EduNexus integrates with payment providers to support:

- School fee collection through partner financial apps
- Teacher token purchases for AI capabilities
- Marketplace subscription billing
- Parent payment for premium learner tools

### Identity Providers

Schools using existing identity infrastructure (Google Workspace for Education, Microsoft Entra, national education ID systems) can federate their identity with EduNexus. Users log in once and access all EduNexus-powered applications without additional authentication.

### Interoperability Standards

EduNexus aims to support established educational interoperability standards where they apply to the Kenyan context:

**IMS Global standards.** LTI (Learning Tools Interoperability) for LMS integration, QTI (Question and Test Interoperability) for assessment item exchange, and Caliper for learning activity events.

**Ed-Fi.** The Ed-Fi data standard for student information interoperability.

**OpenBadges.** For competency and achievement credential issuance.

**CASE.** The Competency and Academic Standards Exchange for curriculum data interoperability.

Support for these standards grows as the ecosystem matures and as specific partner needs require it.

---

## Chapter 12 — Developer Experience

### DX as a Core Platform Capability

Developer experience is not a nice-to-have. It is a core capability that determines whether developers choose EduNexus over building their own educational intelligence.

The best API in the world will not be adopted if developers cannot understand it, test it, debug it, and build confidence in it. The best educational intelligence will not be used if the integration takes weeks to complete. The best platform will be abandoned if the documentation is incomplete or outdated.

EduNexus treats DX with the same seriousness it treats uptime, security, and data accuracy.

### Quick Starts

Every major integration scenario has a Quick Start guide that gets a developer from zero to a working integration in under 30 minutes:

- **Lesson Plan Generation.** Get a CBC-aligned lesson plan with 20 lines of code.
- **Learner Risk Dashboard.** Display risk scores for a class of learners.
- **Assessment Creation.** Generate and deliver an assessment aligned to a learning outcome.
- **Parent Communication Integration.** Subscribe to learner events and trigger parent messages.
- **School Analytics Dashboard.** Build a real-time school intelligence dashboard.

Each Quick Start:
- Provides a complete, copy-pasteable working example
- Assumes no prior EduNexus knowledge
- Works with the sandbox environment, requiring no live school data
- Links to the relevant API reference and deeper guides

### Interactive Documentation

All API reference documentation is interactive. Every endpoint has:

- A description written in plain English
- A list of all parameters with types, constraints, and descriptions
- An interactive example builder that lets developers construct requests
- A "Try it" button that executes the request against their sandbox environment
- A response viewer that shows the actual response with annotations

The interactive documentation is powered by the OpenAPI specification. It stays in sync with the actual API automatically.

### API Explorer

The API Explorer is a standalone tool in the Developer Portal for exploring the full API surface:

- Browse all API families and endpoints
- Filter by resource type, operation type, or search term
- Construct and execute requests interactively
- View request history
- Save and share example requests
- Export requests as code snippets in any supported SDK language

### Code Playground

The Code Playground is a browser-based code environment where developers can run EduNexus SDK code without any local setup:

- Preconfigured with sandbox credentials
- Supports TypeScript, Python, and PHP
- Provides autocomplete and inline documentation
- Saves code snippets to the developer's account
- Shares playgrounds via URL

The Code Playground removes the friction of local environment setup for initial exploration and prototyping.

### CLI

The EduNexus CLI provides a local development experience:

```bash
# Install
npm install -g @edunexus/cli

# Authenticate
edunexus login

# Initialize a new project
edunexus init my-integration

# Start the local plugin development environment
edunexus plugin dev

# Validate an integration against the API spec
edunexus validate

# Tail webhook events for local debugging
edunexus webhooks tail

# Inspect and replay events from the event log
edunexus events list
edunexus events replay <event-id>

# Run SDK diagnostics
edunexus doctor
```

### Local Development

The `edunexus doctor` command validates the local development environment and provides a checklist of potential issues. The CLI also provides:

**Environment management.** Manage sandbox, staging, and production environments from the CLI.

**Secret management.** Store API keys securely in the system keychain, never in environment files.

**Log tailing.** Stream API call logs from the platform during local development.

**Webhook forwarding.** Forward webhook events from the platform to a local development server (similar to Stripe's webhook forwarding).

### Mock Server

For developers who want to develop without any platform connectivity, EduNexus provides a mock server:

```bash
edunexus mock start --port 4000
```

The mock server:
- Implements the full API surface
- Returns realistic mock data for all endpoints
- Simulates AI generation with realistic (though artificial) responses
- Emits mock events on a configurable schedule
- Responds with realistic error scenarios for testing error handling

The mock server is seeded with a sample school — teachers, students, assessments, and learner models — so developers have realistic data to develop against immediately.

### Sandbox Environments

Every developer account includes a sandbox environment:

- Full platform capability (all APIs, all event types, all AI generation)
- Seeded with sample data (teachers, students, assessments)
- No impact on any real school
- AI generation uses a lower-cost model (responses are realistic but not production-grade)
- Resets on request (useful for testing onboarding flows)

### Example Applications

EduNexus provides open-source example applications that demonstrate complete integrations:

**Parent Dashboard.** A complete parent-facing application showing a child's curriculum progress, risk status, and teacher communications. Built with Next.js and the TypeScript SDK.

**Teacher Planning Tool.** A lesson planning application demonstrating AI generation, curriculum alignment, and scheme of work management.

**School Analytics Dashboard.** A school administrator dashboard showing real-time learner intelligence and curriculum coverage.

**Assessment Platform.** A minimal assessment delivery application demonstrating assessment creation, delivery, result processing, and learner model updates.

**Government Reporting System.** A county-level analytics system demonstrating multi-tenant aggregate queries.

All example applications are available on GitHub with complete documentation.

### Tutorials

The documentation library includes step-by-step tutorials for common integration scenarios:

- Building your first learner dashboard
- Integrating AI lesson plan generation into an existing LMS
- Setting up webhook event processing
- Building a real-time risk alert system
- Creating a custom plugin for the EduNexus marketplace
- Integrating parent communication with learner events
- Building a cross-school analytics report

Tutorials include working code, screenshots, and explanations of the decisions made along the way.

### Reference Architectures

For common integration patterns, EduNexus provides reference architectures:

- LMS integration reference architecture
- School ERP integration reference architecture
- Parent communication platform architecture
- Government analytics platform architecture
- Assessment platform architecture

Reference architectures include:
- Architecture diagrams
- Component selection guidance
- Security considerations
- Scalability considerations
- Example code for critical components

---

## Chapter 13 — Certification Program

### Why Certification Matters

Educational data is sensitive. Learner performance records, risk assessments, and behavioral profiles are among the most sensitive personal data about a child. Parents trust schools with this data. Schools trust EduNexus with this data. EduNexus must be confident that partners who access this data through the platform do so responsibly.

Certification is how EduNexus provides that confidence. It is also how EduNexus helps schools make confident procurement decisions: a school that installs a Premium-certified application from the marketplace knows it has been reviewed for security, educational quality, and data protection.

### Developer Certification

Individual developer certification demonstrates competency with the EduNexus platform:

**EduNexus Developer Associate.** Foundational knowledge of the platform APIs, authentication model, and basic integration patterns. Assessed through a practical integration project and a written examination.

**EduNexus Developer Professional.** Advanced knowledge including event-driven integration, plugin development, and AI API usage. Assessed through a substantial integration project reviewed by a platform engineer.

**EduNexus Developer Expert.** Deep expertise including performance optimization, security architecture, and educational domain knowledge. Assessed through peer review and contribution to the ecosystem (open source, documentation, community support).

Certified developers can display certification badges and are listed in the EduNexus Certified Developer directory, which schools can use when sourcing development talent.

### Partner Certification

Partner organization certification covers the organization's practices, not individual developers:

**EduNexus Partner.** Basic tier. Organization has completed technical review and agreed to data handling terms.

**EduNexus Certified Partner.** Organization demonstrates security practices, has at least one Professional-certified developer, and has a successful marketplace deployment reviewed by EduNexus.

**EduNexus Premier Partner.** Organization has demonstrated educational quality standards, has successful deployments across multiple schools, maintains Premium Certified marketplace listings, and participates actively in the partner ecosystem.

### Solution Architect Certification

Solution architects who design EduNexus integrations for clients can certify their architectural competency:

**EduNexus Certified Architect.** Demonstrates ability to design complete EduNexus integrations: tenant hierarchy design, security model, event-driven architecture, performance and scalability planning, and multi-system integration.

Assessed through a case study review and peer assessment from existing certified architects.

### Marketplace Approval

Marketplace approval is the certification of a specific application or plugin:

**Basic Approval.** Technical review: the integration works, is secure, and has adequate documentation.

**Standard Approval.** Basic plus data protection review and user experience review.

**Premium Approval.** Standard plus curriculum and educational quality review. Requires at least one real school pilot with documented outcomes.

### Security Certification

Security certification is available for partners who process particularly sensitive data (learner health information, special educational needs data, safeguarding data):

**EduNexus Security Certified.** Demonstrates security controls meeting a defined standard: encryption at rest and in transit, access logging, incident response plan, penetration testing, and data minimization practice.

### Educational Quality Certification

Educational quality certification validates that AI-generated content and educational workflows in a partner application meet pedagogical standards:

**EduNexus Education Quality Certified.** Assessed by a panel of curriculum experts and practicing teachers. Validates that the application's AI output is educationally sound, curriculum-aligned, and appropriate for learner age groups.

### AI Quality Certification

AI quality certification validates the quality and reliability of AI capabilities in partner applications:

**EduNexus AI Quality Certified.** Demonstrates that AI-generated content undergoes human review, that hallucination rates are monitored and controlled, that curriculum accuracy is validated, and that AI quality improves over time through feedback loops.

---

## Chapter 14 — International Expansion

### The Vision Beyond CBC

EduNexus begins in Kenya with the CBC curriculum. But educational intelligence as infrastructure is not limited to a single country or curriculum. The intelligence layer — learner models, assessment frameworks, AI generation, risk prediction — is fundamentally reusable across educational systems.

The international expansion strategy is to add curriculum engines for additional education systems while reusing the entire intelligence and platform layer. A school in Rwanda using the REB curriculum should be able to access the same learner intelligence quality that a school in Kenya using CBC receives. A government in Tanzania should be able to access the same analytics capability. A developer in Nigeria should be able to build with the same SDK.

### Multiple Curriculum Engines

The Curriculum Engine is designed for extensibility. Adding a new curriculum involves:

1. Encoding the curriculum hierarchy (strands, sub-strands, learning outcomes, performance indicators)
2. Encoding prerequisite relationships between curriculum elements
3. Encoding assessment framework definitions
4. Validating the encoding against official curriculum documents and with curriculum experts
5. Building AI prompt templates appropriate to the curriculum's pedagogical approach
6. Testing the curriculum engine against sample lesson plans, assessments, and observations from practicing teachers

The core intelligence layer — learner models, risk prediction, trajectory analysis — works across curricula without modification, because the underlying educational processes (competency development, progression, risk) are universal. Only the curriculum-specific knowledge must be encoded for each new system.

Priority for international expansion:

| Phase | Curricula |
|---|---|
| 1 | Kenya CBC, Kenya 8-4-4 |
| 2 | Rwanda REB, Uganda NCDC |
| 3 | Tanzania NECTA, Ethiopia MOE |
| 4 | Nigeria WAEC/NERDC, Ghana NaCCA |
| 5 | South Africa CAPS, Zimbabwe ZIMSEC |
| 6 | East African Community regional standards |
| 7 | Cambridge IGCSE, IB (international schools) |

### Country-Specific Educational Rules

Each country has regulatory and policy requirements that must be encoded:

- **Assessment calendars.** When national examinations occur, how they are administered, what they assess.
- **Progression rules.** Under what conditions learners move between grades, repeat a grade, or receive special provisions.
- **Reporting requirements.** What reports must be submitted to which government bodies, on what schedule, in what format.
- **Teacher certification requirements.** What teaching credentials are required for different subjects and levels.
- **Special educational needs provisions.** What accommodations are required for learners with special needs.

These rules are encoded as country-specific modules in the platform. A school in Uganda sees the Ugandan regulatory requirements; a school in Rwanda sees the Rwandan ones.

### Localization

EduNexus localizes across multiple dimensions:

**Language.** AI-generated content is produced in the language of instruction appropriate for the context: English, Swahili, French (for Francophone Africa), Amharic, and others as needed.

**Cultural context.** Examples, scenarios, and contexts in AI-generated content reflect the learner's cultural environment — Kenyan landscapes and names for Kenyan schools, Rwandan contexts for Rwandan schools.

**Calendar.** Academic calendars, term dates, and public holidays are country-specific.

**Currency.** Financial features (payments, token pricing) use the local currency.

### Translation

The EduNexus developer documentation and API reference is translated into French and Portuguese to support Francophone and Lusophone Africa. Community-contributed translations are accepted for other languages.

AI-generated educational content is generated directly in the target language, not translated from English. Direct generation produces culturally and linguistically appropriate content; translation produces technically accurate but contextually awkward content.

### Curriculum Adapters

Partners building cross-country applications face a challenge: the same educational concept (algebra, for example) has different curriculum positions, different performance indicator frameworks, and different assessment expectations in different countries.

EduNexus provides Curriculum Adapters — mapping layers that translate between curriculum systems. An application that knows a learner is in "Grade 8 Mathematics, Strand 3 in CBC" can use the Curriculum Adapter to understand the equivalent curriculum position in the Rwandan REB system, enabling cross-country comparison and content reuse.

Curriculum Adapters are approximate: curricula do not map perfectly across national systems. The adapter returns a confidence score alongside each mapping, and surfacing that uncertainty to the end user is expected.

### International AI Models

The AI Gateway supports multiple AI model providers, and different providers may perform better in different languages and regional contexts. The AI Gateway routes requests to appropriate models:

- English-language Kenyan content: DeepSeek, optimized with Kenyan curriculum fine-tuning
- French-language content: models with stronger French capability
- Swahili content: models with demonstrated Swahili performance

As the East African AI ecosystem matures, locally developed and locally trained models will be prioritized where they demonstrate superior performance in the regional context.

### Cross-Country Analytics

For governments and international organizations (World Bank, UNICEF, regional education bodies), cross-country analytics enable:

- Comparative learning outcome data across countries
- Regional risk patterns and trends
- Curriculum coverage comparison
- Teacher development needs across a region

Cross-country analytics use normalized metrics that allow comparison despite different curriculum systems. The normalization methodology is documented and auditable.

### Educational Standards Interoperability

As EduNexus expands internationally, participation in global educational data standards becomes important:

**PISA alignment.** Mapping national curriculum assessments to PISA competency frameworks.

**SDG4 reporting.** Supporting government reporting on Sustainable Development Goal 4 (quality education) indicators.

**UNESCO ISCED.** Mapping EduNexus curriculum structures to the International Standard Classification of Education.

**Africa Union Continental Education Strategy.** Aligning with the AU's education development framework.

---

## Chapter 15 — Future Platform Vision

### Educational Agents

The next evolution of AI in education is not generation — it is agency. An educational agent does not merely respond to queries; it pursues goals, monitors progress, takes proactive action, and adapts its behavior based on outcomes.

EduNexus is building toward an agent architecture where AI agents take an active role in the educational process:

**Learner agents.** An agent assigned to each learner that continuously monitors their progress, identifies learning gaps as they emerge, recommends resources, schedules practice, and escalates concerns to human teachers. The learner agent acts as a persistent, adaptive educational companion — not replacing teachers, but ensuring that no student is unnoticed.

**Teacher agents.** An agent that supports each teacher's professional practice — drafting lesson plans, scheduling curriculum coverage to avoid end-of-term rushes, flagging learners who need attention, and preparing observation notes. The teacher agent handles the administrative overhead of teaching so the teacher can focus on pedagogy.

**School agents.** An agent at the school level that monitors school-wide patterns, flags systemic issues (a curriculum gap that affects an entire grade, a teacher who needs professional support, a cohort of students at dropout risk), and coordinates interventions across the school system.

The agent architecture is being designed on top of the same API surface described in this book. Partner applications will be able to create and deploy agents using the Agent Platform API — launching agents that access EduNexus intelligence, take educational actions, and report outcomes through standard interfaces.

### AI-Native Classrooms

The classroom of the future is not a room where an AI chatbot answers student questions. It is an environment where intelligence flows continuously:

- Every interaction is captured and contributes to the learner model
- Real-time feedback loops connect learner behavior to teacher decision-making
- The physical space adapts to learning data (room temperature, lighting, seating configurations based on learning activity types)
- Assessment is continuous and unobtrusive rather than periodic and stressful
- Teachers receive a live intelligence feed that gives them visibility into every learner's state, not just a post-lesson summary

EduNexus is building the intelligence infrastructure that enables AI-native classrooms. The IoT integration platform, the real-time event bus, and the learner intelligence engine are the foundation. Partners building classroom technology — smart boards, learning tablets, attendance systems, classroom observation tools — will plug into this infrastructure and contribute to and consume the intelligence it provides.

### Digital Twins of Learners

A digital twin is a continuously updated digital model of a physical entity. In manufacturing, digital twins of machines enable predictive maintenance. In urban planning, digital twins of cities enable simulation of policy changes.

EduNexus is building toward a digital twin of each learner: a comprehensive, continuously updated model that captures not just academic performance, but social-emotional development, engagement patterns, home environment factors, peer relationships, and health indicators (where ethically collected).

The learner digital twin enables:

**Counterfactual simulation.** What would happen if this learner changed schools? What if an intervention is applied at week 8 versus week 12? The digital twin can be run forward in time to simulate outcomes.

**Personalized learning design.** Instead of designing learning experiences for the average learner, design them for the specific learner. The digital twin provides the parameters.

**Early identification.** Identify the earliest possible signal that a learner is at risk — not when they fail an exam, but when the pattern in their digital twin first diverges from expected trajectories.

**Longitudinal research.** Track learner development from early childhood through career entry, enabling the most comprehensive longitudinal educational research ever conducted.

The ethical implications of learner digital twins are profound and must be navigated carefully: data governance, consent, transparency, and the right not to be defined by one's digital record. EduNexus is developing ethical frameworks alongside the technical architecture.

### School Operating Systems

A school operating system is the complete digital infrastructure of a school — all the software systems that support teaching, learning, administration, communication, and operations — unified into a coherent platform.

Today, schools assemble this infrastructure piece by piece: an ERP for administration, an LMS for learning, an assessment platform for examinations, a communication app for parents, separate tools for teachers. These systems do not talk to each other. Data does not flow. Intelligence is fragmented.

The school operating system vision: a unified platform where all school functions — from enrollment to graduation, from daily attendance to career placement — operate coherently, sharing data, sharing intelligence, and creating a seamless experience for every stakeholder.

EduNexus positions itself as the intelligence layer of the school operating system. Partner applications provide the functional components. The EduNexus event bus connects them. The educational intelligence APIs give all of them access to the same learner models, the same curriculum knowledge, and the same AI capabilities.

The school operating system is not built by EduNexus alone. It is assembled from the best components available on the platform — the LMS partner, the ERP partner, the assessment partner, the communication partner — all integrated through EduNexus's shared intelligence layer.

### Government Intelligence Platforms

At the government level, educational intelligence enables a fundamentally different approach to education policy:

**Evidence-based policy.** Policy decisions informed by real learning outcome data rather than examination scores, which are often unreliable proxies.

**Early warning systems.** Government-level systems that identify schools, districts, or counties at risk of educational failure before those failures manifest in examination results.

**Teacher deployment intelligence.** Understanding where teachers with specific subject expertise are most needed, enabling data-informed deployment decisions.

**Resource allocation optimization.** Understanding which schools have the greatest need for additional resources, based on learning outcome data and risk indicators.

**Intervention evaluation.** Measuring the actual impact of government educational interventions at scale.

EduNexus provides government intelligence platforms through the Government Analytics API — a secured, aggregate data access layer that gives government systems the intelligence they need without exposing individual learner records.

### Research Ecosystems

Educational research has historically been slow, expensive, and limited in scale. Studies are conducted with small samples over short periods, making it difficult to understand long-term outcomes or to detect effects of modest magnitude.

EduNexus enables a new model of educational research:

**Large-scale longitudinal data.** Instead of a 100-student study over six months, research conducted on data from 100,000 students over five years — with proper ethical governance and consent.

**Real-world validity.** Research conducted on data from real schools, real teachers, and real learners — not laboratory studies.

**Rapid cycle evaluation.** Interventions can be evaluated at scale within a single school year, accelerating the cycle from hypothesis to evidence.

**Open educational data.** A curated, anonymized dataset made available to accredited researchers globally, enabling the educational research community to build on the platform.

The Research Platform API provides accredited researchers with governed access to anonymized EduNexus data. Access requires ethical approval, data governance agreement, and alignment with the EduNexus research ethics framework.

### Global Educational APIs

The long-term vision of EduNexus is a global educational intelligence API — an infrastructure layer that any application, anywhere in the world, can use to access educational intelligence for any curriculum, in any language, for any learner.

This vision involves:

**Curriculum universality.** Curriculum engines for every major national curriculum system, enabling developers to build applications that work globally.

**Learner universality.** A learner identity model that follows the learner through educational systems — across grade levels, across schools, across countries — giving them a persistent and portable educational record.

**Intelligence universality.** Intelligence capabilities that are equally powerful for a learner in Nairobi, Lagos, Kigali, Dar es Salaam, Abuja, or Johannesburg.

**Developer universality.** An API that any developer in the world can integrate with in hours, regardless of their location, programming language, or prior educational technology experience.

### Open Educational Infrastructure

The final stage of the EduNexus vision is to transition from a commercial platform to open educational infrastructure — infrastructure that, like the internet itself, is no longer owned by any single commercial entity but is governed as a global public good.

This is a long-term aspiration, not a near-term commitment. Commercial sustainability must precede structural openness. But the direction is clear: educational intelligence is too important to be permanently controlled by a single company. The goal is to build infrastructure that is eventually as open, as universal, and as foundational as TCP/IP.

Open educational infrastructure might take the form of:
- Open-source core components that any government or institution can run
- Open standards for educational data interoperability
- An open curriculum knowledge graph available to any educational application
- An open learner model format that applications can read and write
- A global consortium of educational organizations that governs the infrastructure

EduNexus does not need to be the entity that governs this infrastructure in its final form. EduNexus needs to be the entity that builds it to the point where it is sufficiently valuable and trustworthy to be entrusted to a broader governance structure.

### Cross-Border Educational Intelligence

As East Africa moves toward deeper regional integration, educational intelligence that crosses national borders becomes more important:

- A Kenyan student moving to Rwanda should not lose their educational record
- A teacher moving between countries should carry their professional portfolio
- A university admissions process should be able to evaluate credentials from any East African country
- A government comparing educational outcomes across the region should have reliable comparable data

EduNexus is positioned to become the cross-border educational intelligence layer for the East African Community and, eventually, for the African Union's continental education strategy.

### Autonomous Educational Workflows

Today, EduNexus intelligence informs human decisions. Tomorrow, EduNexus agents will execute complete educational workflows autonomously — with human oversight but without requiring human action for each step.

Examples of autonomous educational workflows:

**Automated intervention dispatch.** When a learner crosses a risk threshold, an autonomous workflow identifies the appropriate intervention, contacts the responsible stakeholders, schedules the intervention, and tracks follow-through — without requiring a human to initiate each step.

**Continuous curriculum coverage monitoring.** A school's scheme of work is monitored continuously. When a teacher falls behind, an autonomous workflow reschedules the outstanding topics, alerts the teacher to the adjustment, and flags the situation to the head teacher if it is not resolved.

**Adaptive examination preparation.** As the national examination date approaches, autonomous workflows identify each student's specific areas of weakness, generate targeted practice materials, schedule revision sessions, and track progress — adapting the schedule based on actual outcomes.

**Professional development scheduling.** Based on class performance patterns, autonomous workflows identify teachers who need professional development in specific areas, search the available CPD library for appropriate programs, schedule participation during available windows in the school calendar, and track completion.

### Lifelong Learner Intelligence

The most ambitious long-term vision for EduNexus is a lifelong learner intelligence system — a continuous intelligence service that serves a person from early childhood through career and into lifelong learning.

In this vision:
- A child's first educational record is created when they start school
- Every educational interaction across their lifetime contributes to their learner model
- When they transition from school to university, their intelligence travels with them
- When they enter the workforce, their career intelligence service helps them grow
- When they change careers, their skills are re-evaluated against new pathways
- Throughout life, a personalized learning intelligence service helps them grow

This is not a single company's product. It is infrastructure that many applications contribute to and consume — a lifelong learner record and intelligence service that is as fundamental to a person's digital life as their identity or their financial record.

EduNexus is not building this alone and is not trying to. It is building the foundation: the curriculum intelligence layer, the learner model architecture, the assessment framework, and the API standards that make this vision composable.

### The Long-Term View

In twenty years, the question of how to add educational intelligence to a software application should have as obvious an answer as the question of how to add payment processing. You call EduNexus.

In twenty years, the question of whether a learner's educational record is portable should be as obvious as whether their financial record is portable. Of course it is.

In twenty years, the question of whether a government has actionable intelligence about the learning outcomes of its children should be as obvious as whether it has data about public health. Of course it does.

In twenty years, the question of whether a teacher should have to manually encode curriculum knowledge into a lesson plan should seem as archaic as the question of whether a doctor should manually calculate drug interactions. Of course not — the intelligence is in the infrastructure.

EduNexus is building toward this future. It is building educational intelligence as infrastructure. Not as a feature. Not as a product. As foundational infrastructure upon which thousands of applications, millions of learners, and generations of educators will build their work.

Every developer who reads this book and builds on the platform moves the ecosystem closer to that outcome.

---

## Appendix A — API Quick Reference

### Authentication Headers

```
Authorization: Bearer <api_key>
X-EduNexus-Tenant: <tenant_id>
X-Idempotency-Key: <uuid>
```

### Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://api.edunexus.africa/v1` |
| Sandbox | `https://sandbox.api.edunexus.africa/v1` |

### Common Response Headers

```
X-Request-ID: req_8f3k2m9x
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1719672000
```

### Error Code Reference

| Code | HTTP Status | Description |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | 401 | No valid API key or token |
| `INSUFFICIENT_PERMISSIONS` | 403 | Key does not have required scope |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `TENANT_MISMATCH` | 403 | Resource belongs to a different tenant |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `RATE_LIMIT_EXCEEDED` | 429 | Request rate limit exceeded |
| `AI_GENERATION_FAILED` | 503 | AI generation service unavailable |
| `CURRICULUM_NOT_FOUND` | 404 | Specified curriculum position not found |
| `QUOTA_EXCEEDED` | 429 | API quota for this period exceeded |

---

## Appendix B — SDK Installation Reference

| Language | Package Manager | Command |
|---|---|---|
| TypeScript/JS | npm | `npm install @edunexus/sdk` |
| Python | pip | `pip install edunexus` |
| Flutter/Dart | pub | `flutter pub add edunexus` |
| Kotlin | Gradle | `implementation("africa.edunexus:sdk:1.0.0")` |
| Swift | SPM | Add `https://github.com/edunexus/swift-sdk` |
| PHP | Composer | `composer require edunexus/sdk` |
| Java | Maven | `<dependency>...</dependency>` |
| .NET | NuGet | `dotnet add package EduNexus.SDK` |
| Go | go get | `go get github.com/edunexus/go-sdk` |

---

## Appendix C — Webhook Event Reference

### Learner Events

| Event | Trigger |
|---|---|
| `learner.risk_score.elevated` | Risk score crosses 60 |
| `learner.risk_score.critical` | Risk score crosses 80 |
| `learner.risk_score.resolved` | Risk score drops below 40 after elevation |
| `learner.competency.milestone` | Learner reaches a significant competency milestone |
| `learner.trajectory.improving` | Trajectory shifts from flat/declining to improving |
| `learner.trajectory.declining` | Trajectory shifts from flat/improving to declining |
| `learner.intervention.triggered` | Automated intervention recommendation generated |

### Assessment Events

| Event | Trigger |
|---|---|
| `assessment.session.started` | A learner begins an assessment |
| `assessment.session.completed` | A learner completes an assessment |
| `assessment.result.available` | A result has been calculated |
| `assessment.result.anomaly` | Result is statistically anomalous |

### Teacher Events

| Event | Trigger |
|---|---|
| `teacher.lesson_plan.generated` | AI lesson plan generation completed |
| `teacher.lesson_plan.approved` | Teacher approved a lesson plan |
| `teacher.sow.generated` | Scheme of work generation completed |
| `teacher.coverage.at_risk` | Class is behind on curriculum coverage |

### School Events

| Event | Trigger |
|---|---|
| `school.risk.elevated_cohort` | >15% of school at elevated risk |
| `school.term.started` | New academic term began |
| `school.term.ended` | Academic term ended |

---

## Appendix D — Glossary

**API Gateway.** The traffic management layer between the internet and EduNexus intelligence services, handling authentication, rate limiting, and routing.

**Assessment Engine.** Platform component handling the full lifecycle of educational assessment creation, delivery, evaluation, and analytics.

**CBC.** Competency-Based Curriculum. Kenya's current school curriculum for Grade 7 onwards.

**Competency State.** A learner's current level of mastery on a specific curriculum competency, expressed as Below Expectation, Approaching Expectation, Meeting Expectation, or Exceeding Expectation.

**Curriculum Engine.** Platform component containing the authoritative knowledge graph of curriculum structures.

**Digital Twin (Learner).** A continuously updated, comprehensive digital model of an individual learner's educational state.

**Educational Intelligence.** Computed insight derived from educational data — risk scores, trajectory analyses, competency states, intervention recommendations — as opposed to raw data.

**Intelligence Layer.** The architectural layer that transforms raw data into educational insight, occupied by EduNexus in the four-layer educational software architecture.

**Learner Model.** The complete computational representation of a learner's competency states, trajectory, risk profile, and strengths within the Learner Intelligence Engine.

**Partner.** An organization that has registered with EduNexus to build applications on the platform.

**Plugin.** An extension to the EduNexus platform that runs inside the Plugin Runtime.

**Plugin Runtime.** The sandboxed execution environment for partner plugins within the EduNexus platform.

**Scheme of Work.** A term-level or year-level plan specifying which curriculum sub-strands will be taught in which weeks.

**Strand.** A major organizational unit within the CBC curriculum (e.g., Strand 3: Algebra in Grade 8 Mathematics).

**Sub-Strand.** A subdivision of a curriculum strand, representing a specific topic or skill area.

**Tenant.** A school, district, county, or other organizational unit that uses EduNexus.

**Webhook.** An HTTPS endpoint to which EduNexus delivers event notifications.

---

*EduNexus Developer Platform — Edition 1.0*

*For support, visit developers.edunexus.africa*

*For the latest version of this document, visit developers.edunexus.africa/platform-guide*
