# EduNexus Canonical Reference Architecture
## The Definitive Blueprint of Educational Intelligence Infrastructure

**Version 1.0 — Canonical Edition**

*The supreme technical authority of the EduNexus platform. All engineering decisions, standards, APIs, SDKs, and research papers derive from this document.*

---

> *"Every sufficiently advanced educational software system eventually becomes an operating system in disguise."*

---

# ABSTRACT

EduNexus is a distributed educational intelligence platform designed to make the complete state of educational knowledge — curriculum, learner competency, pedagogical evidence, career pathways, and instructional intelligence — available as queryable, real-time, composable infrastructure. This document specifies the canonical architecture of EduNexus across thirteen dimensions: philosophy, fundamental principles, system overview, core domains, core engines, intelligence architecture, data architecture, APIs, AI systems, ecosystem, scaling, governance, and future computing.

EduNexus is not a learning management system, not a school ERP, not an AI chatbot, and not a content library. It is an **Educational Intelligence Operating System** — a platform on which educational applications, AI agents, government systems, and research infrastructure can be built, in the same way that Linux and the cloud are platforms on which web services are built.

The central architectural claim of this document: **Educational Intelligence Infrastructure will become a permanent layer of global computing architecture**, as fundamental to twenty-first century civilization as relational databases were to transactional computing, as operating systems were to personal computing, as search engines were to the web, and as cloud platforms are to modern software delivery.

This document is the complete specification of how EduNexus implements that infrastructure.

---

# TABLE OF CONTENTS

**PART I** — Philosophy: Educational Intelligence as Infrastructure
**PART II** — Fundamental Principles
**PART III** — System Overview: The EduNexus Computing Architecture
**PART IV** — Core Domains
**PART V** — Core Engines
**PART VI** — Intelligence Architecture
**PART VII** — Data Architecture
**PART VIII** — APIs and Developer Platform
**PART IX** — AI Copilots and Multi-Agent Systems
**PART X** — Ecosystem
**PART XI** — Scaling Architecture
**PART XII** — Governance
**PART XIII** — Future Computing
**FINAL CHAPTER** — The Architecture Beyond EduNexus

---

# PART I: PHILOSOPHY — EDUCATIONAL INTELLIGENCE AS INFRASTRUCTURE

## 1.1 The Fundamental Question

What is EduNexus?

Not as a product. Not as a company. Not as a set of features. As a **computing architecture** — what does EduNexus compute, store, transform, and serve?

The answer: EduNexus computes the educational state of learners, teachers, schools, curricula, and educational systems — continuously, accurately, at scale — and makes that state available as structured, queryable, composable intelligence to every stakeholder who needs it, in a form they can act on.

This is a new category of computing. It does not have a well-established name yet. We call it **Educational Intelligence Infrastructure**, and we argue that it is as fundamental to the future of civilization as any computing category that preceded it.

To understand why, we must understand the history of educational computing — and why every prior approach to educational software has failed to provide what educational systems actually need.

## 1.2 The Evolution of Educational Computing

### 1.2.1 The Paper Age

For most of human history, educational records existed on paper. Registers recorded attendance. Exercise books accumulated learner work. Annual reports summarized school performance. Examination certificates documented attainment.

Paper records share a common property: they are local, non-queryable, and non-composable. The information in a learner's exercise book is trapped in that book — it cannot be combined with attendance records to identify a correlation, cannot be compared across schools to identify curriculum gaps, cannot be retrieved by a future employer verifying credentials.

The paper educational record is a collection of isolated facts with no intelligence layer.

### 1.2.2 The Digital Records Age

The first wave of educational computing digitized records. School administration systems replaced paper registers with database tables. Grade books became spreadsheets. Examination results moved to digital databases.

Digital records solved the storage and retrieval problem: records could be searched, printed, and backed up. But they did not solve the intelligence problem. A digital register tells you which learner was absent; it does not tell you whether the absence pattern is contributing to a learning gap. A digital grade book stores scores; it does not explain what the scores mean about learner competency.

Digital records are paper records in a database. The information is there; the intelligence is not.

### 1.2.3 The School ERP Age

Enterprise Resource Planning systems entered education in the 1990s and 2000s. These systems — EMIS, Fedena, PowerSchool, and hundreds of national implementations — attempted to integrate school operations: enrollment, attendance, timetabling, examination management, and staff records.

School ERPs succeeded at operational coordination: the same learner record could inform enrollment, attendance, and examination registration simultaneously. But ERPs were built on the relational model with operational efficiency as the primary design goal. They were not designed for educational intelligence.

An ERP knows that learner ID 47291 attended 85% of days in Term 2 and scored 67 in the Term 2 mathematics examination. It does not know what that 67 means about the learner's understanding of linear equations, whether the attendance gap in week 6 corresponded to a specific curriculum unit, or whether the combination of these facts predicts term-end underperformance.

ERPs are sophisticated operational databases. Educational intelligence is not their purpose.

### 1.2.4 The LMS Age

Learning Management Systems — Moodle, Blackboard, Canvas, Google Classroom — emerged in higher education and spread to secondary schools. LMSs focused on content delivery and assignment management: uploading materials, submitting assignments, tracking completion, and managing gradebooks.

LMSs added the dimension of learning content to the school ERP. But they retained the fundamental limitation of prior approaches: they store and retrieve educational artifacts (assignments, scores, videos) rather than building intelligence from them.

An LMS knows that a learner watched a video and scored 72% on a quiz. It does not know whether the quiz score reflects understanding of the video's concepts, which specific concepts remain poorly understood, what prior learning gaps contributed to the quiz score, or what the learner needs to do next.

LMS gradebooks are sophisticated completion trackers. Educational intelligence is not their architecture.

### 1.2.5 The First-Wave AI Age

The 2020s saw the introduction of AI tools into educational software: AI tutors, AI lesson plan generators, AI feedback systems. These tools used large language models to produce educational content with unprecedented fluency and flexibility.

But first-wave educational AI tools share a critical architectural flaw: they operate without persistent educational knowledge. A conversation with an AI tutor starts from scratch each session. An AI lesson plan generator has no knowledge of what the teacher taught last week, what the class understood, or what the curriculum requires next. AI feedback systems generate responses with no grounding in the specific curriculum the learner is studying.

First-wave educational AI is general-purpose AI applied to education. It has the intelligence to generate educational-looking content; it lacks the educational knowledge to generate educationally correct content.

### 1.2.6 The Educational Intelligence Infrastructure Age

The architectural insight that defines EduNexus and distinguishes it from all prior approaches: **educational intelligence requires a persistent, structured, continuously updated model of educational reality** — the curriculum, the learner, the teacher, the school, the assessment evidence, the career pathway — that all AI systems, applications, and stakeholders can access as shared infrastructure.

This is the Educational Intelligence Layer: not a product feature, not an AI assistant, not a database. A computing layer that makes educational knowledge a first-class, queryable, reliable resource in the same way that the internet makes network connectivity a first-class resource.

The evolution is complete:

```
Paper Records
      ↓         [storage, no intelligence]
Digital Records
      ↓         [queryable storage, no intelligence]
School ERP
      ↓         [integrated operations, no intelligence]
LMS
      ↓         [content + completion, no intelligence]
First-Wave AI
      ↓         [fluent generation, no grounded knowledge]
Educational Intelligence Infrastructure
              [persistent knowledge + intelligence + composability]
```

## 1.3 Why Educational Software Has Been Fragmented

The fragmentation of educational software is not an accident. It reflects three structural forces that have prevented the emergence of coherent educational intelligence infrastructure.

### 1.3.1 The Institutional Silo Problem

Educational institutions are strongly autonomous: each school has its own records, its own practices, its own data systems. This autonomy is appropriate — school-level ownership of educational decisions is a fundamental value in most educational systems. But institutional autonomy, unmediated by shared infrastructure, creates silos.

A learner who changes schools loses their educational record (or carries a paper summary). A teacher who changes schools starts from scratch understanding each learner. A district education officer who wants to understand learning trends must aggregate reports from fifty different schools' spreadsheets. A national curriculum authority who wants to know how well a revised curriculum is being implemented has no data.

The institutional silo problem is not solved by giving each school better software. It is solved by building shared infrastructure that aggregates and protects institutional data while enabling institutional sovereignty.

### 1.3.2 The Curriculum-Software Decoupling Problem

Educational software has been built independently of the curriculum it is meant to serve. A content platform sells videos that are labeled as aligned to curriculum standards but the alignment is manually curated, not architecturally enforced. An assessment platform generates quizzes without knowledge of the prerequisite structure of the competencies being tested. An AI tutor answers curriculum questions without knowing the specific curriculum the learner is studying.

This decoupling means that no amount of technical sophistication in the software layer can produce educationally correct outputs, because the curriculum knowledge needed for correctness does not exist in the system. The curriculum is outside the architecture.

EduNexus solves the curriculum-software decoupling problem by making the curriculum a first-class architectural component — the Educational Knowledge Graph — that every AI system, every application, and every API query is grounded in.

### 1.3.3 The Longitudinal Data Problem

Educational development is inherently longitudinal. A learner's Grade 8 performance cannot be understood without knowing their Grade 7 foundation. A teacher's effectiveness cannot be assessed from one term's data. A curriculum revision's impact cannot be measured until the affected cohort completes their education.

But most educational software systems are designed for the operational present. They store what is happening now and provide limited historical analysis. They do not maintain the longitudinal learner record that would enable trajectory analysis, predictive intervention, and developmental reasoning.

EduNexus addresses the longitudinal data problem through its Temporal Knowledge Graph architecture: every educational fact is stored with valid time and transaction time, enabling point-in-time reconstruction of any educational state and longitudinal trajectory analysis across any time horizon.

## 1.4 Why Intelligence Must Become Infrastructure

The core architectural argument: educational intelligence cannot remain a feature of individual software products. It must become infrastructure — shared, reliable, composable, and available to all educational applications.

### 1.4.1 The Infrastructure Argument

Consider how the internet became infrastructure. Before the internet, each organization built its own networking capability. The emergence of TCP/IP as shared infrastructure enabled: any organization to be networked without rebuilding networking from scratch; any application to communicate over the network without understanding its physical implementation; any service to be discovered and used by any other service.

Consider how cloud computing became infrastructure. Before the cloud, each organization built its own computing infrastructure. The emergence of cloud platforms as shared infrastructure enabled: any organization to access computing resources without building data centers; any application to scale without understanding hardware procurement; any service to be globally available without global infrastructure investment.

Educational intelligence needs the same transition. Currently: each educational platform builds its own curriculum model, its own learner model, its own AI layer. Each of these is rebuilt from scratch, incompatible with every other platform, and available only within the walled garden of the platform that built it.

When educational intelligence becomes infrastructure: any educational application can ground its AI in the authoritative curriculum graph. Any teacher can access their learners' complete educational history regardless of which platform recorded it. Any researcher can query educational outcomes across institutional boundaries. Any government can monitor educational system health without building surveillance infrastructure.

### 1.4.2 The Network Effect Argument

Infrastructure becomes more valuable as more participants use it. The internet is more valuable with ten billion connected devices than it was with ten thousand. The telephone network became more valuable as more people got telephones.

Educational intelligence infrastructure exhibits the same network effect. The curriculum graph becomes more complete as more curriculum experts contribute to it. The learner model becomes more accurate as more assessment evidence is incorporated. The intervention efficacy data becomes more reliable as more intervention outcomes are recorded. The career pathway graph becomes more accurate as more employment outcome data is linked.

No single educational platform can capture the breadth of educational experience needed to build the most accurate educational intelligence. Infrastructure that aggregates across platforms, institutions, and jurisdictions can.

### 1.4.3 The Public Good Argument

Education is a public good — a service whose benefits are not exhausted by individual consumption and from which exclusion creates social harm. Educational intelligence, built on top of educational data, shares this public good character.

An accurate curriculum graph that makes it possible for AI to provide curriculum-grounded tutoring benefits not just the learners on the platform that built it, but all learners who could benefit from such tutoring. An accurate learner model that enables early intervention benefits not just the learner but the society that the learner will participate in as an adult.

Public goods are characteristically under-produced by private markets, because private producers cannot fully capture the social value they create. This is why educational intelligence, if left entirely to private platforms, will be under-produced and incorrectly incentivized — optimized for platform engagement rather than learner development.

EduNexus is designed as a public-good platform: open where openness serves the public good (curriculum graph, open standards, research data), commercial where commercial models provide sustainable incentives for quality (intelligence services, institutional subscriptions, developer platform).

## 1.5 EduNexus as an Educational Operating System

The appropriate metaphor for understanding EduNexus is not a school software product. It is an **operating system for educational intelligence**.

An operating system provides: a hardware abstraction layer (so applications don't need to know what CPU they're running on); process management (so multiple applications can share computing resources); memory management (so applications can share a common address space); file systems (so applications can share persistent storage); networking (so applications can communicate); and a security model (so applications are isolated from each other's data).

EduNexus provides: a curriculum abstraction layer (so applications don't need to build their own curriculum model); knowledge management (so multiple AI agents can share the same educational knowledge graph); learner memory (so applications can share access to the learner's educational history); event streaming (so applications can communicate through educational events); identity and consent (so applications can access learner data within appropriate boundaries); and a governance model (so applications are held to educational quality and safety standards).

The Operating System metaphor has design implications that are load-bearing throughout this architecture:

1. **EduNexus is the platform; applications run on EduNexus** — not the reverse.
2. **EduNexus does not compete with educational applications** — it enables them.
3. **EduNexus maintains the canonical truth** — applications may have their own data, but authoritative educational facts live in the EduNexus platform.
4. **EduNexus enforces the governance contract** — applications that access the platform agree to educational quality and safety standards.

---

# PART II: FUNDAMENTAL PRINCIPLES

The following principles are not guidelines or aspirations. They are architectural constraints — properties that every system component, every API decision, every data model, and every AI system must satisfy. Violations of these principles are architectural defects, not trade-offs.

## 2.1 Educational Correctness

**Definition**: An educational claim, output, or recommendation is educationally correct if it accurately represents educational reality — the curriculum, the learner's competency state, the pedagogical approach, and the assessment evidence — in a way that would be validated by a qualified educational expert.

**Architectural implication**: Educational correctness is a first-class system property, evaluated and enforced at every layer of the architecture. Technical performance metrics (latency, throughput, availability) are secondary to educational correctness. A system that is fast and highly available but educationally incorrect is not a better system — it is a more dangerous one.

**Implementation**: Every AI output passes through a curriculum alignment validator before delivery. Every competency state claim must have supporting evidence. Every assessment item has a verified curriculum alignment. Every intervention recommendation has an associated evidence base.

## 2.2 Canonical Truth

**Definition**: For any educational fact about which there is an authoritative source, EduNexus maintains exactly one representation of that fact — the canonical truth — and all derived representations are computable from it.

**Architectural implication**: There is no meaningful version of "the Kenya CBC Grade 8 Mathematics curriculum" other than the official KICD specification. EduNexus's curriculum graph is the machine-readable form of that canonical specification. Applications that need to know curriculum content do not build their own curriculum models — they query the canonical curriculum graph.

**Implementation**: The Curriculum Graph is managed as a versioned, authoritative, immutable-after-approval data structure. All curriculum content in AI generation, assessments, and intelligence is retrieved from the Curriculum Graph, never from model training data or external sources.

**Anti-pattern prevented**: Multiple applications each maintaining their own curriculum interpretation, resulting in inconsistency, drift, and curriculum accuracy that is impossible to audit.

## 2.3 Evidence-First Reasoning

**Definition**: All educational claims about a specific learner, teacher, or school must be grounded in specific, traceable evidence. Claims without evidence are hypotheses, and must be presented as such.

**Architectural implication**: The system's epistemic architecture distinguishes between observed facts (evidence), computed inferences (assessments of evidence), and generated artifacts (AI content). Each category has different confidence, different audit requirements, and different consequence levels for human review.

**Implementation**: The Evidence Graph links every competency state claim to the specific evidence items that support it. Every AI output that makes a claim about a specific learner cites the evidence that grounds the claim. Confidence scores reflect evidence quantity and quality, not model certainty.

## 2.4 Teacher Augmentation

**Definition**: Every intelligence capability in the platform exists to enhance teacher effectiveness, not to bypass or replace teacher judgment. The teacher is the principal stakeholder in instructional decisions.

**Architectural implication**: The system architecture enforces Teacher-in-the-Loop for all decisions above a defined consequence threshold. No system component is authorized to make high-consequence educational decisions autonomously — these decisions flow through a review workflow that requires teacher approval.

**Implementation**: The Consequence Routing Engine classifies every AI output by educational consequence level (1-5) and routes accordingly. All Level 2+ outputs enter the Teacher Review Queue before delivery.

## 2.5 Human Oversight

**Definition**: The platform maintains comprehensive, transparent, auditable records of all AI decisions, enabling human review of any AI action at any time.

**Architectural implication**: No AI action is unlogged. The Audit Architecture captures the full provenance of every AI output: which model, which prompt version, which retrieved context, which validation results, which human review decision (if any).

**Implementation**: The Audit Log is append-only, cryptographically signed, and retained for the educational record retention period (7+ years). Every AI output has a unique generation ID that traces to its full audit record.

## 2.6 Deterministic Data, Probabilistic Intelligence

**Definition**: Educational facts (curriculum competency descriptions, learner enrollment records, assessment submissions) are stored and served deterministically — the same query always returns the same result. Educational intelligence (competency level assessments, risk scores, intervention recommendations) is probabilistic — expressed with confidence intervals, evidence counts, and calibrated uncertainty.

**Architectural implication**: The platform maintains a strict data/intelligence separation. The data layer is a consistent, transactional store with deterministic query semantics. The intelligence layer is a probabilistic inference system with explicit uncertainty representation.

**Implementation**: The Knowledge Graph distinguishes fact nodes (immutable once created, versioned on change) from inference nodes (regularly recomputed, confidence-tagged, evidence-cited). APIs distinguish between data queries (return facts) and intelligence queries (return probabilistic assessments with confidence).

## 2.7 Longitudinal Thinking

**Definition**: Educational development is measured in years and decades, not sessions and terms. All architectural decisions that affect the learner record must account for the full educational lifetime.

**Architectural implication**: The learner record is designed for 20+ year retention. Temporal modeling is bi-temporal: valid time (when the educational fact was true) and transaction time (when the system recorded it) are independently tracked for every record. Point-in-time reconstruction of any learner's educational state is required.

**Implementation**: The Temporal Knowledge Graph uses bi-temporal edge properties throughout. All state-changing events are append-only; prior states are never overwritten. The full trajectory of any learner, competency, or educational relationship is recoverable from the audit record.

## 2.8 Educational Graphs

**Definition**: The primary data structure of educational intelligence is the graph. Educational reality is inherently relational: competencies have prerequisites; learners have evidence; evidence supports claims; claims trigger interventions; interventions have outcomes. This relational structure cannot be adequately represented in tabular form without significant information loss.

**Architectural implication**: The platform's core knowledge representation is a property graph with typed nodes, typed edges, temporal properties, and confidence weights. Relational databases and document stores are used for operational concerns (transactions, search, caching) but the knowledge representation layer is always a graph.

**Implementation**: The Educational Knowledge Graph (EKG) is the canonical knowledge store. All intelligence services query the EKG. The EKG is served by a native graph database (Neo4j Enterprise at current scale; custom distributed graph store at national scale) with a unified graph query API.

## 2.9 Institutional Memory

**Definition**: The platform maintains comprehensive institutional memory — the accumulated educational history of learners, teachers, schools, and curricula — and makes this memory available for longitudinal reasoning, cross-cohort analysis, and evidence-based decision-making.

**Architectural implication**: Deletion in the EduNexus platform is never physical deletion of educational records — it is anonymization, pseudonymization, or de-identification. The institutional memory accumulates; it does not shrink.

**Implementation**: The Learner History Store maintains the complete educational trajectory of every learner from enrollment to graduation. The School Memory Store maintains institutional patterns across cohorts. The Curriculum Memory Store maintains implementation history for every curriculum version.

## 2.10 Composable Intelligence

**Definition**: Intelligence capabilities are designed as composable services that can be combined to address complex educational questions, rather than as monolithic analyses that address pre-specified questions.

**Architectural implication**: Every intelligence service has a well-defined input/output contract and is independently deployable. Complex intelligence is composed from simpler services through the orchestration layer, not baked into monolithic analyses.

**Implementation**: The Intelligence Service Mesh exposes each reasoning capability (curriculum reasoning, competency reasoning, intervention reasoning, risk scoring) as an independently callable service. The AI Orchestration Engine composes these services into complex intelligence workflows.

## 2.11 Platform Thinking

**Definition**: EduNexus is a platform, not an application. It provides the infrastructure on which educational applications are built. Platform decisions optimize for ecosystem enablement, not for individual feature delivery.

**Architectural implication**: Every API is designed for external consumers, not just internal use. The platform charges for API usage, enabling third-party developers to build on EduNexus. The platform's value is measured not just by direct user activity but by the ecosystem it enables.

**Implementation**: The Developer Platform provides public APIs, SDKs in major languages, a developer console, and a plugin/marketplace framework. All internal intelligence services are implemented as APIs that could, in principle, be made public.

## 2.12 Open Ecosystems

**Definition**: EduNexus supports open standards, open data formats, and interoperability with external systems. No educational data is held hostage in a proprietary format that prevents learner portability or system integration.

**Architectural implication**: All data models are published as open schemas. All APIs follow open standards (REST, GraphQL, webhooks, CloudEvents). Learner data is exportable in open formats. Third-party systems can integrate as first-class participants.

**Implementation**: EduNexus implements: Ed-Fi alignment for learner records, IMS Global standards for learning content, xAPI for learning events, OpenID Connect for identity, and CloudEvents for event streaming. Proprietary extensions are clearly marked as such.

---

# PART III: SYSTEM OVERVIEW — THE EDUNEXUS COMPUTING ARCHITECTURE

## 3.1 The Six-Layer Platform Architecture

EduNexus is organized as a six-layer computing architecture. Each layer provides services to the layer above it and depends on the layers below it. The architecture is strictly hierarchical: upper layers cannot bypass lower layers, and lower layers have no knowledge of upper layers.

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER (Layer 6)                   │
│   Teacher App · Learner App · Parent App · Admin Dashboard       │
│   Developer Apps · Government Portals · Research Tools           │
├─────────────────────────────────────────────────────────────────┤
│                    EXPERIENCE LAYER (Layer 5)                    │
│   Copilot Agents · Review Workflows · Notification Engine        │
│   Personalization · Accessibility · Localization                 │
├─────────────────────────────────────────────────────────────────┤
│                    INTELLIGENCE LAYER (Layer 4)                  │
│   AI Orchestration · Reasoning Engines · Knowledge Graph         │
│   Risk Engine · Intervention Engine · Curriculum Engine          │
├─────────────────────────────────────────────────────────────────┤
│                    KNOWLEDGE LAYER (Layer 3)                     │
│   Curriculum Graph · Learner Graph · Teacher Graph               │
│   Assessment Bank · Evidence Store · Career Graph                │
├─────────────────────────────────────────────────────────────────┤
│                    PLATFORM LAYER (Layer 2)                      │
│   Event Bus · API Gateway · Identity · Auth · Audit              │
│   Plugin Engine · Marketplace · Developer Platform               │
├─────────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER (Layer 1)                   │
│   Compute · Storage · Network · Graph DB · Vector DB             │
│   Message Queue · Cache · Time-Series · Search                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1.1 Infrastructure Layer (Layer 1)

The Infrastructure Layer is the physical computing substrate: compute nodes, storage systems, network infrastructure, and the managed database services that all higher layers depend on.

**Compute**: Kubernetes-managed containerized workloads on multi-region cloud infrastructure. AI inference nodes use GPU instances (A10 or A100 class). Stateless services run on CPU instances with horizontal auto-scaling.

**Storage systems**:
- **Relational** (PostgreSQL / Supabase): Operational records — enrollment, authentication, billing, audit
- **Graph database** (Neo4j Enterprise): Educational Knowledge Graph — curriculum, learner, evidence, career
- **Vector database** (pgvector / Pinecone): Embedding store for semantic search
- **Object storage** (S3-compatible): Portfolio artifacts, assessment media, documents
- **Time-series** (TimescaleDB or InfluxDB): Usage metrics, performance monitoring, learning event streams
- **Document store** (Redis): Session state, conversation memory, short-lived caches
- **Search** (OpenSearch / Elasticsearch): Full-text search across curriculum content, resources, platform data

**Message Queue**: Apache Kafka for all event streaming. Partitioned by entity type (learner-events by learner_id, curriculum-events by curriculum_id). Retained for 90 days. Compacted topics for latest-state snapshots.

**Cache**: Three-tier cache architecture (in-process L1, Redis L2, CDN L3). Educational data cache TTL governed by data type: curriculum content cached until revision; learner state cached for 5 minutes; AI generated content cached for 24 hours.

### 3.1.2 Platform Layer (Layer 2)

The Platform Layer provides the shared services that all applications and intelligence systems depend on, without knowledge of their specific educational purpose.

**API Gateway**: Request routing, authentication verification, rate limiting, and audit log entry for all external API calls. Technology: Kong or AWS API Gateway, configured for educational platform traffic patterns.

**Event Bus**: The central nervous system of the EduNexus platform. Every significant state change in the system publishes an event. Every intelligence recomputation is triggered by events. Every external integration receives events. Based on Apache Kafka with CloudEvents envelope format.

**Identity Engine**: Learner, teacher, parent, administrator, and developer identity management. Federated with national identity systems (where available) and school information systems. OpenID Connect + OAuth 2.0. PKCE for mobile clients. Multi-factor authentication for sensitive administrative access.

**Authorization Engine**: Attribute-Based Access Control (ABAC) engine implementing the educational data access policies defined in Part XII. Every data access passes through the authorization engine before the data layer is queried.

**Audit Engine**: Append-only, cryptographically signed audit log for all platform operations. Records: who, what, when, why (authorization basis), result. Retained for 7+ years.

**Plugin Engine**: Runtime environment for third-party plugins that extend EduNexus capabilities. Sandboxed execution, API-mediated data access, resource quota enforcement.

**Marketplace Engine**: Catalog, discovery, licensing, and billing infrastructure for the EduNexus developer ecosystem. Curriculum-aligned content marketplace, plugin marketplace, professional service marketplace.

### 3.1.3 Knowledge Layer (Layer 3)

The Knowledge Layer is EduNexus's most distinctive architectural component: the persistent, structured, continuously updated repository of educational knowledge.

**Curriculum Graph**: The machine-readable representation of national curriculum specifications. Nodes: LearningArea, Strand, SubStrand, CompetencyUnit, LearningObjective, CurriculumCompetency, Indicator, CoreCompetency, PCI, Value. Edges: PART_OF, REQUIRES_PREREQUISITE, CROSS_REFERENCES, DEVELOPS_CORE_COMPETENCY. Version-controlled; immutable after approval; all revisions tracked.

**Learner Graph**: The persistent model of each learner's educational state. Nodes: Learner, CompetencyState, Evidence, Gap, Misconception, InterventionRecord, TrajectorySnapshot, RiskProfile. Continuously updated by assessment events, teacher observations, and AI inference.

**Teacher Graph**: The context model for each teacher's instructional responsibilities. Nodes: Teacher, AcademicClass, CurriculumCoverage, ProfessionalContext, TeacherDecision. Updated by teacher actions, curriculum coverage events, and professional development records.

**Assessment Bank**: Curriculum-aligned assessment items with psychometric properties. Nodes: AssessmentItem, AssessmentInstrument, Rubric, MasteryModel. Continuously validated against curriculum alignment and psychometric quality standards.

**Evidence Store**: The immutable record of all educational observations. Every assessment submission, teacher observation, portfolio artifact, and peer assessment is stored in the Evidence Store as an append-only record. Evidence is never modified; corrections create new evidence records that reference the original.

**Career Graph**: The connection between educational competencies and career pathways. Nodes: CareerPathway, RequiredCompetency, EmploymentData, SalaryData, GrowthProjection. Updated from labour market data, graduate employment surveys, and national skills frameworks.

### 3.1.4 Intelligence Layer (Layer 4)

The Intelligence Layer transforms raw knowledge into actionable educational intelligence through reasoning engines, AI systems, and inference computations.

**AI Orchestration Engine**: The central coordinator of all AI activity. Manages: prompt construction, model routing, context assembly, output validation, consequence routing, and persistence of AI outputs. Described fully in Part VI.

**Reasoning Engines**: Domain-specific computational reasoning systems (curriculum, competency, assessment, intervention, career, risk). Combine symbolic graph-based reasoning with probabilistic inference. Described in Part V.

**Risk Engine**: Computes and maintains learner risk profiles — probabilistic assessments of likelihood of not meeting educational targets — with calibrated confidence and evidence-backed explanations.

**Intervention Engine**: Matches learning gaps to evidence-backed interventions, ranks by expected efficacy, and generates implementation plans for teacher review.

**Analytics Engine**: Aggregates educational data for trend analysis, cohort comparison, curriculum effectiveness evaluation, and government reporting.

### 3.1.5 Experience Layer (Layer 5)

The Experience Layer mediates between the Intelligence Layer's outputs and the human stakeholders who use them.

**Copilot Agents**: Domain-specific AI assistants (Teacher Copilot, Learner Copilot, Parent Copilot, School Copilot) that translate intelligence outputs into stakeholder-appropriate interactions. Each Copilot is a thin translation layer over the Intelligence Layer's capabilities.

**Review Workflows**: Human-in-the-loop review interfaces for intelligence outputs above consequence threshold 1. Teacher review queue, specialist review queue, administrative approval workflows.

**Notification Engine**: Intelligent notification routing across channels (in-app, SMS, WhatsApp, email) with priority, timing, and cultural appropriateness calibration.

**Personalization Engine**: Adapts platform interfaces to user role, expertise level, device type, connectivity context, and language preference.

**Accessibility Engine**: WCAG 2.1 AA compliance, screen reader optimization, low-bandwidth mode, and inclusive design for learners with special needs.

**Localization Engine**: Multi-language support (English, Kiswahili, community languages), culturally appropriate content adaptation, and local calendar/timezone integration.

### 3.1.6 Application Layer (Layer 6)

The Application Layer is where human users interact with the EduNexus platform. Applications in this layer consume services from the Experience Layer and Intelligence Layer through well-defined APIs.

**Teacher Application**: The primary interface for instructional professionals. Lesson planning, assessment management, learner monitoring, intervention planning, professional development.

**Learner Application**: The primary interface for students. Personal tutoring, practice and feedback, progress visualization, portfolio management, study planning.

**Parent Application**: The family engagement interface. Progress reports, intervention communication, home support guidance, calendar and event visibility.

**School Administration Dashboard**: The institutional management interface. Risk monitoring, curriculum coverage, resource allocation, staff oversight, government reporting.

**Developer Console**: The third-party development interface. API access, plugin development, analytics, and marketplace management.

**Government Portal**: The national/county oversight interface. Pseudonymized aggregate analytics, policy simulation, curriculum effectiveness monitoring, equity analysis.

**Research Portal**: The educational research interface. Approved access to anonymized data, longitudinal cohort analysis, curriculum impact research.

## 3.2 Cross-Layer Interactions

The layers interact through defined protocols. Understanding these interactions is essential for understanding EduNexus's behavior.

```
CROSS-LAYER INTERACTION PROTOCOL:

Layer 6 (Application) → Layer 5 (Experience):
  All user interactions originate as API calls to Experience Layer services
  Experience Layer maintains session state (conversation history, UI preferences)
  Experience Layer translates user intent to Intelligence Layer queries

Layer 5 (Experience) → Layer 4 (Intelligence):
  Copilots query Intelligence Layer for educational recommendations
  Review workflows publish intelligence outputs for human review
  Notification engine subscribes to Intelligence Layer events

Layer 4 (Intelligence) → Layer 3 (Knowledge):
  All AI generation retrieves context from Knowledge Layer before generating
  Reasoning engines query Curriculum Graph and Learner Graph
  Intelligence results are persisted back to Knowledge Layer

Layer 3 (Knowledge) → Layer 2 (Platform):
  Knowledge Layer publishes state change events to Event Bus
  Knowledge Layer enforces authorization for all data access
  Knowledge Layer records all access in Audit Engine

Layer 2 (Platform) → Layer 1 (Infrastructure):
  Platform Layer manages connection pools to all storage systems
  Platform Layer monitors Infrastructure Layer health
  Platform Layer routes traffic to appropriate storage backends

REVERSE INTERACTIONS (events flowing up):
  Layer 1 (Infrastructure) → Layer 2 (Platform):
    Health metrics, capacity alerts, storage utilization

  Layer 2 (Platform) → Layer 3 (Knowledge):
    External events (new enrollment, payment, government integration)

  Layer 3 (Knowledge) → Layer 4 (Intelligence):
    Knowledge change events trigger intelligence recomputation
    New evidence events trigger competency state update

  Layer 4 (Intelligence) → Layer 5 (Experience):
    Intelligence update events trigger notification routing
    Risk threshold events trigger alert delivery

  Layer 5 (Experience) → Layer 6 (Application):
    Notification delivery, UI state refresh, real-time updates
```

## 3.3 The Event-Driven Core

Every significant state change in the EduNexus platform emits an event. Events are the primary mechanism by which system components communicate asynchronously, triggering downstream processing without tight coupling.

```
EDUNEXUS CANONICAL EVENTS:

CURRICULUM EVENTS:
  curriculum.competency.created
  curriculum.competency.updated
  curriculum.version.published
  curriculum.version.deprecated

ENROLLMENT EVENTS:
  learner.enrolled
  learner.transferred
  learner.graduated
  learner.withdrawn

ASSESSMENT EVENTS:
  assessment.submitted          (learner submits assessment)
  assessment.scored             (assessment scored — triggers competency state update)
  assessment.validated          (teacher validates AI scoring)

LEARNING EVENTS:
  learning.session.started
  learning.session.ended
  learning.milestone.achieved   (learner reaches mastery on competency)
  learning.gap.detected         (gap detection algorithm identifies a gap)

INTERVENTION EVENTS:
  intervention.recommended      (AI recommends an intervention)
  intervention.approved         (teacher approves intervention)
  intervention.applied          (intervention delivered to learner)
  intervention.outcome.recorded (outcome measured at follow-up)

INTELLIGENCE EVENTS:
  intelligence.risk.updated     (risk score changes above threshold)
  intelligence.recommendation.generated
  intelligence.review.required  (output routed to teacher review queue)
  intelligence.review.completed

INSTITUTIONAL EVENTS:
  school.term.started
  school.term.ended
  school.inspection.scheduled
  school.report.generated

GOVERNMENT EVENTS:
  government.report.requested
  government.policy.published   (new government policy affects curriculum)

ECOSYSTEM EVENTS:
  developer.plugin.installed
  marketplace.content.licensed
  partner.integration.synced
```

---

*End of Part I. Parts II-III complete above. Part IV continues in arc-part2.md.*
# EduNexus Canonical Reference Architecture — Part IV: Core Domains

---

# PART IV: CORE DOMAINS

## 4.0 Domain Architecture Overview

EduNexus is organized around bounded domains — distinct areas of educational concern with clearly defined responsibilities, data ownership, event contracts, and service boundaries. Domain architecture follows the principles of Domain-Driven Design (Evans, 2003) applied to the educational context.

Each domain is a **bounded context**: a sphere of consistency within which a ubiquitous language applies, a set of canonical objects are maintained, and a defined set of services operate. Domains communicate through well-defined event contracts and API boundaries, never through shared database access.

The eleven core domains of EduNexus:

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ CURRICULUM │  │ ASSESSMENT │  │  LEARNING  │  │ COMPETENCY │
│   Domain   │  │   Domain   │  │   Domain   │  │   Domain   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  TEACHER   │  │   SCHOOL   │  │   PARENT   │  │ GOVERNMENT │
│   Domain   │  │   Domain   │  │   Domain   │  │   Domain   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
┌────────────┐  ┌────────────┐  ┌────────────┐
│  RESEARCH  │  │   CAREER   │  │ IDENTITY & │
│   Domain   │  │   Domain   │  │ ECOSYSTEM  │
└────────────┘  └────────────┘  └────────────┘
```

---

## 4.1 Curriculum Domain

### Purpose

The Curriculum Domain is the canonical source of truth for all educational content standards: what learners are expected to know, in what order, at what cognitive level, and assessed by what means. It is the knowledge foundation on which all other domains depend.

### Responsibilities

- Maintain the authoritative machine-readable representation of all supported national curricula
- Version all curriculum content with full change history
- Validate and publish curriculum revisions through a defined governance process
- Serve curriculum knowledge to all other domains and AI systems
- Maintain prerequisite relationships, cross-curricular connections, and competency taxonomies
- Align external curricula to the Universal Concept Graph (UCG) for cross-country comparability

### Boundaries

The Curriculum Domain owns:
- All CurriculumCompetency nodes and their relationships
- The prerequisite graph (REQUIRES_PREREQUISITE edges)
- Curriculum versioning and approval workflow
- Mastery model definitions per competency
- Assessment strategy specifications per competency

The Curriculum Domain does NOT own:
- Specific assessment items (Assessment Domain)
- Learner competency states (Competency Domain)
- Instructional resources (Learning Domain)

### Canonical Data Objects

```
CURRICULUM DOMAIN CANONICAL OBJECTS:

Curriculum {
  id: UUID,
  code: String,              // e.g., "CBC-2023"
  jurisdiction: String,      // e.g., "Kenya"
  name: String,
  version: SemanticVersion,
  effective_from: Date,
  effective_until: Date | null,
  authority: String,         // e.g., "KICD"
  document_reference: URI
}

LearningArea {
  id: UUID,
  curriculum_id: UUID,
  code: String,              // e.g., "CBC-G8-MAT"
  name: String,
  bloom_taxonomy: BloomTaxonomy,
  time_allocation_hours_per_week: Float
}

CurriculumCompetency {
  id: UUID,
  code: String,              // e.g., "CBC-G8-MAT-ALG-003"
  title: String,
  description: String,
  bloom_level: BloomLevel,   // Remember | Understand | Apply | Analyse | Evaluate | Create
  grade_level: Integer,
  expected_mastery_term: Integer,
  expected_mastery_week: Integer | null,
  difficulty_estimate: Float,  // 0.0-1.0, calibrated from assessment data
  curriculum_id: UUID,
  curriculum_version: SemanticVersion,
  learning_area_id: UUID,
  strand_id: UUID,
  sub_strand_id: UUID,
  competency_unit_id: UUID,
  learning_objective_id: UUID
}

MasteryModel {
  competency_id: UUID,
  levels: [{
    level: MasteryLevel,     // Not Yet | Beginning | Developing | Proficient | Mastered
    description: String,
    evidence_requirements: {
      min_evidence_count: Integer,
      evidence_types: EvidenceType[],
      min_score_threshold: Float
    },
    behavioural_indicators: String[]
  }]
}
```

### Domain Events

```
curriculum.competency.created       { competency_id, curriculum_id, created_by }
curriculum.competency.updated       { competency_id, previous_version, new_version, changed_fields }
curriculum.prerequisite.added       { source_competency_id, target_competency_id, strength }
curriculum.version.published        { curriculum_id, version, effective_from }
curriculum.version.deprecated       { curriculum_id, version, deprecated_at, successor_version }
curriculum.mastery_model.updated    { competency_id, model_id }
```

### Services

**CurriculumQueryService**: Read-only query service for curriculum content. Serves prerequisite chains, competency hierarchies, mastery models, and curriculum mappings to all consumers.

**CurriculumAuthoringService**: Authenticated write service for curriculum content. Used by KICD-authorized curriculum authors. All mutations create audit records and require approval workflow completion before taking effect.

**CurriculumVersioningService**: Manages curriculum version transitions. Computes migration rules for learner records when curriculum versions change. Validates backward compatibility.

**UCGAlignmentService**: Aligns national curriculum competencies to the Universal Concept Graph for cross-country comparability. Computes alignment confidence scores.

### Security

Curriculum content is public (read access requires no authentication). Curriculum mutation requires KICD-level administrative credentials with two-person approval. Curriculum versioning events trigger downstream system notifications across all affected domains.

### Evolution

The Curriculum Domain is designed to support any national curriculum with the CBC structural model. Non-CBC curricula (8-4-4, IGCSE, Cambridge, US Common Core) are mapped to the same graph schema. Future evolution: UCG as a shared global foundation from which national curricula are derived, rather than each curriculum being independently authored.

---

## 4.2 Assessment Domain

### Purpose

The Assessment Domain manages the design, delivery, validation, and psychometric analysis of all educational assessments — from formative classroom observations to national examinations.

### Responsibilities

- Maintain the curriculum-aligned assessment item bank
- Manage assessment instrument design (test blueprints, rubrics, mark schemes)
- Coordinate assessment delivery (scheduling, access control, submission handling)
- Validate AI-scored responses with teacher confirmation
- Maintain psychometric properties of all assessment items
- Integrate with KNEC for national examination records

### Canonical Data Objects

```
ASSESSMENT DOMAIN CANONICAL OBJECTS:

AssessmentItem {
  id: UUID,
  code: String,
  version: SemanticVersion,
  item_type: ItemType,        // MCQ | ShortAnswer | Essay | Practical | Observation
  stem: String,
  options: Option[] | null,   // for MCQ
  answer_key: AnswerKey,
  rubric: Rubric | null,
  
  curriculum_alignment: [{
    competency_id: UUID,
    bloom_level: BloomLevel,
    alignment_strength: Float    // 0.0-1.0
  }],
  
  psychometrics: {
    difficulty_estimate: Float,     // 0.0-1.0 (IRT b parameter)
    discrimination_estimate: Float, // (IRT a parameter)
    n_responses: Integer,           // sample size used for calibration
    last_calibrated_at: Timestamp
  },
  
  provenance: {
    source: "human_authored" | "ai_generated" | "ai_generated_human_reviewed",
    author_id: UUID | null,
    ai_generation_id: UUID | null,
    review_status: ReviewStatus,
    reviewed_by: UUID | null,
    approved_at: Timestamp | null
  }
}

AssessmentInstrument {
  id: UUID,
  code: String,
  name: String,
  purpose: AssessmentPurpose,    // formative | summative | diagnostic | portfolio
  
  blueprint: {
    target_competencies: UUID[],
    bloom_distribution: {[BloomLevel]: Float},
    item_count: Integer,
    time_limit_minutes: Integer,
    total_marks: Integer
  },
  
  items: [{
    item_id: UUID,
    order: Integer,
    marks: Integer,
    required: Boolean
  }],
  
  administration: {
    allowed_for: AssessmentContext[],  // class | school | county | national
    requires_supervision: Boolean,
    open_book: Boolean,
    calculator_permitted: Boolean
  }
}

AssessmentEvent {
  id: UUID,
  instrument_id: UUID,
  class_id: UUID | null,
  school_id: UUID,
  administered_at: Timestamp,
  administered_by: UUID,
  learner_ids: UUID[],
  
  status: "scheduled" | "in_progress" | "completed" | "scored" | "validated"
}

AssessmentResponse {
  id: UUID,
  event_id: UUID,
  learner_id: UUID,
  item_id: UUID,
  
  response: {
    type: ResponseType,
    content: String | SelectedOption | null
  },
  
  scoring: {
    raw_score: Float,
    max_score: Float,
    scorer_type: "automated" | "ai" | "teacher",
    scorer_id: UUID | null,
    scored_at: Timestamp | null,
    rubric_applied: UUID | null
  },
  
  competency_mapping: [{
    competency_id: UUID,
    performance_indicator: Float  // 0.0-1.0 on this competency from this item
  }]
}
```

### Domain Events

```
assessment.event.scheduled      { event_id, instrument_id, class_id, date }
assessment.response.submitted   { response_id, learner_id, event_id, submitted_at }
assessment.response.scored      { response_id, scoring_result }
assessment.event.completed      { event_id, submission_count, completion_rate }
assessment.validation.requested { event_id, scorer_type: "ai", requires_teacher_review }
assessment.validation.completed { event_id, validator_id, validated_at }
assessment.national.synced      { examination_type, cohort_year, school_id }
```

### Services

**ItemBankService**: CRUD operations on assessment items. Validates curriculum alignment on every write. Computes and updates psychometric properties.

**AssessmentDesignService**: Constructs assessment instruments from blueprints. Uses AI generation + item bank retrieval to produce curriculum-aligned assessments. All AI-generated items require teacher review before deployment.

**AssessmentDeliveryService**: Manages assessment lifecycle: scheduling, access control, submission collection, time management.

**ScoringService**: Scores assessment responses. Routes to: automated scoring (MCQ), AI scoring with teacher validation (short answer, essay), teacher manual scoring.

**PsychometricsService**: Maintains Item Response Theory (IRT) parameters for all assessment items. Requires minimum sample sizes before reporting estimates.

**NKNECIntegrationService**: Secure synchronization of national examination records from KNEC. Pseudonymizes individual records for district/national analysis.

---

## 4.3 Learning Domain

### Purpose

The Learning Domain manages the instructional experience — what learners do to develop competency — including lesson delivery, tutoring interactions, portfolio management, and learning resource access.

### Responsibilities

- Deliver adaptive learning experiences grounded in the learner's competency state
- Maintain the learning session record (what was attempted, what was accomplished)
- Manage the instructional resource library with curriculum alignment
- Coordinate portfolio evidence collection and maintenance
- Serve the Learner Copilot interaction

### Canonical Data Objects

```
LEARNING DOMAIN CANONICAL OBJECTS:

LearningSession {
  id: UUID,
  learner_id: UUID,
  started_at: Timestamp,
  ended_at: Timestamp | null,
  session_type: SessionType,     // tutoring | practice | study | lesson | assessment_prep
  
  curriculum_focus: {
    primary_competency_id: UUID,
    secondary_competency_ids: UUID[]
  },
  
  interactions: Integer,         // number of AI turns
  competencies_addressed: UUID[],
  misconceptions_addressed: UUID[],
  scaffolding_level_start: Integer,   // 1-5
  scaffolding_level_end: Integer,     // adapted during session
  
  outcome: {
    learner_demonstrated_understanding: Boolean | null,
    ai_confidence_in_outcome: Float,
    recommended_followup: String | null
  },
  
  session_summary: String        // brief AI-generated summary for long-term memory
}

InstructionalResource {
  id: UUID,
  title: String,
  resource_type: ResourceType,   // video | workbook | practice_set | simulation | game | reading
  
  content: {
    uri: URI,
    format: String,
    duration_minutes: Integer | null,
    language: String,
    accessibility_features: String[]
  },
  
  curriculum_alignment: [{
    competency_id: UUID,
    alignment_strength: Float,
    bloom_level: BloomLevel
  }],
  
  appropriateness: {
    grade_range: { min: Integer, max: Integer },
    resource_level_required: ResourceLevel,  // basic | standard | enhanced
    connectivity_required: ConnectivityLevel // offline | low_bandwidth | high_bandwidth
  },
  
  quality: {
    source_type: "kicd_approved" | "publisher" | "teacher_contributed" | "ai_generated",
    review_status: ReviewStatus,
    teacher_rating: Float | null,    // crowd-sourced teacher rating
    learner_rating: Float | null,
    effectiveness_score: Float | null  // from intervention outcome analysis
  }
}

PortfolioArtifact {
  id: UUID,
  learner_id: UUID,
  created_at: Timestamp,
  artifact_type: ArtifactType,   // essay | project | presentation | recording | artwork | code
  
  content: {
    storage_uri: URI,
    format: String,
    description: String
  },
  
  curriculum_alignment: [{
    competency_id: UUID,
    performance_level: MasteryLevel,
    alignment_strength: Float
  }],
  
  evidence_quality: {
    authenticity: "self_authored" | "ai_assisted" | "collaborative",
    ai_assistance_level: Float | null,   // 0.0 = no AI; 1.0 = fully AI
    teacher_validated: Boolean,
    validation_notes: String | null
  },
  
  visibility: VisibilityScope    // private | teacher | parent | school | public
}
```

### Domain Events

```
learning.session.started        { session_id, learner_id, competency_focus }
learning.session.ended          { session_id, outcome_summary }
learning.milestone.achieved     { learner_id, competency_id, milestone_type }
learning.resource.accessed      { learner_id, resource_id, accessed_at }
learning.portfolio.artifact.added { learner_id, artifact_id, competency_alignment }
learning.misconception.detected { learner_id, misconception_id, confidence }
learning.misconception.addressed{ learner_id, misconception_id, addressed_at }
```

---

## 4.4 Competency Domain

### Purpose

The Competency Domain is the system of record for what every learner actually knows and can do — the continuously updated, evidence-grounded model of learner competency state. It is the domain that all intelligence depends on most critically.

### Responsibilities

- Maintain the authoritative competency state for every learner on every curriculum competency
- Update competency states when new evidence arrives
- Detect and maintain learning gaps
- Compute and maintain learner risk profiles
- Track learning trajectory across time
- Support competency certification and badging

### Canonical Data Objects

```
COMPETENCY DOMAIN CANONICAL OBJECTS:

CompetencyState {
  id: UUID,
  learner_id: UUID,
  competency_id: UUID,
  
  // Bi-temporal: when was this true (valid_time) vs. when did system record it (transaction_time)
  valid_from: Date,
  valid_until: Date | null,    // null = currently valid
  transaction_from: Timestamp,
  transaction_until: Timestamp | null,
  
  level: MasteryLevel,
  confidence: Float,           // 0.0-1.0; calibrated against evidence
  evidence_count: Integer,
  evidence_weight: Float,      // sum of evidence weights (recency-discounted)
  
  computation: {
    method: "bayesian_update" | "rule_based" | "teacher_override",
    model_version: String,
    computed_at: Timestamp,
    prior_distribution: Float[],     // distribution over MasteryLevels before update
    posterior_distribution: Float[], // distribution after update
    key_evidence_ids: UUID[]         // 3 most influential evidence items
  }
}

LearningGap {
  id: UUID,
  learner_id: UUID,
  competency_id: UUID,
  
  severity: GapSeverity,           // CRITICAL | HIGH | MEDIUM | LOW
  active: Boolean,
  
  detected_at: Timestamp,
  detected_by: DetectionMethod,    // prerequisite_analysis | assessment_pattern | teacher_report
  
  root_cause: {
    type: RootCauseType,           // missing_prerequisite | misconception | insufficient_practice
    root_competency_ids: UUID[],   // the deepest unmastered prerequisites
    confidence: Float
  },
  
  resolution: {
    resolved_at: Timestamp | null,
    resolution_method: String | null,
    intervention_id: UUID | null
  }
}

RiskProfile {
  id: UUID,
  learner_id: UUID,
  computed_at: Timestamp,
  is_current: Boolean,
  
  overall_score: Float,            // 0.0-1.0; 1.0 = highest risk
  confidence: Float,
  
  dimension_scores: {
    academic_risk: Float,
    attendance_risk: Float | null,  // if attendance data available
    engagement_risk: Float | null,
    transition_risk: Float          // risk of failing grade transition
  },
  
  risk_factors: [{
    factor_type: RiskFactorType,
    description: String,
    contribution: Float,            // this factor's contribution to overall score
    evidence: UUID[]
  }],
  
  trajectory: {
    trend: "improving" | "stable" | "declining",
    projected_term_end_state: Float,  // projected overall achievement
    projection_confidence: Float
  },
  
  recommended_actions: ActionRef[]
}

TrajectorySnapshot {
  id: UUID,
  learner_id: UUID,
  snapshot_date: Date,
  snapshot_type: "term_end" | "monthly" | "event_triggered",
  
  competency_summary: {
    total_assessable: Integer,
    mastered: Integer,
    proficient: Integer,
    developing: Integer,
    not_yet: Integer
  },
  
  per_strand: {[strand_code: String]: {
    competencies_mastered: Integer,
    competencies_total: Integer,
    average_confidence: Float
  }},
  
  risk_at_snapshot: Float,
  interventions_active: Integer
}
```

### Competency State Update Algorithm

The Competency State Update Algorithm is the most critical computation in the EduNexus platform. It runs every time new evidence arrives for a learner on a competency.

```
ALGORITHM: CompetencyStateUpdate

Input:
  learner_id: UUID
  competency_id: UUID
  new_evidence: Evidence

Step 1: RETRIEVE CURRENT STATE
  current_state = get_current_competency_state(learner_id, competency_id)
  prior = current_state?.posterior_distribution ?? population_prior(competency_id, learner.grade)

Step 2: RETRIEVE EVIDENCE HISTORY
  all_evidence = get_evidence(learner_id, competency_id, recency_window=365_days)
  all_evidence.append(new_evidence)

Step 3: COMPUTE EVIDENCE WEIGHTS
  for evidence in all_evidence:
    recency_weight = exp(-λ * days_since(evidence.occurred_at))
    quality_weight = evidence_quality_weight[evidence.evidence_type]
    evidence.weight = recency_weight * quality_weight

Step 4: BAYESIAN UPDATE
  likelihood = compute_likelihood(new_evidence, current_state.level)
  posterior = bayesian_update(prior, likelihood)

Step 5: DETERMINE LEVEL
  level = argmax(posterior)
  confidence = max(posterior)
  
  if confidence < 0.50: level = current_state.level (insufficient evidence to change)
  if evidence_count < MIN_EVIDENCE_THRESHOLD: confidence *= 0.7  // penalize sparse evidence

Step 6: DETECT CHANGES
  level_changed = (level != current_state?.level)
  confidence_change = abs(confidence - current_state?.confidence ?? 0)

Step 7: PERSIST
  new_state = CompetencyState {
    valid_from: today(),
    level: level,
    confidence: confidence,
    evidence_count: len(all_evidence),
    posterior_distribution: posterior,
    key_evidence_ids: top_3_by_weight(all_evidence)
  }
  
  if current_state: current_state.valid_until = today()  // close prior state
  insert(new_state)

Step 8: EMIT EVENTS
  if level_changed:
    emit(learning.milestone.achieved or learning.gap.detected)
  
  if level == MASTERED and level_changed:
    trigger: forward_dependency_activation_check(competency_id)
    // check if this mastery activates new prerequisite-satisfied competencies

Step 9: TRIGGER DOWNSTREAM RECOMPUTATION
  trigger: RiskProfileUpdate(learner_id)      // async
  trigger: GapDetectionCheck(learner_id)      // async
  trigger: InterventionReview(learner_id)     // async if gaps changed
```

---

## 4.5 Teacher Domain

### Purpose

The Teacher Domain manages the instructional professional's context, responsibilities, decisions, and professional development — enabling the Teacher Copilot to provide genuinely useful, contextually aware assistance.

### Responsibilities

- Maintain teacher instructional context (classes, curriculum position, term plan)
- Record teacher decisions (AI acceptance, modification, rejection with reasoning)
- Track professional development and curriculum expertise
- Coordinate inter-teacher collaboration
- Support performance observation workflows (without AI-generated performance ratings)
- Maintain class-level aggregate intelligence

### Canonical Data Objects

```
TEACHER DOMAIN CANONICAL OBJECTS:

Teacher {
  id: UUID,
  person_id: UUID,             // links to Identity Domain
  
  professional: {
    registration_number: String | null,  // TSC number (Kenya)
    certification_level: String,
    certification_status: CertificationStatus,
    subjects_qualified: SubjectRef[],
    years_experience: Integer
  },
  
  current_deployment: {
    school_id: UUID,
    deployed_from: Date,
    role: TeacherRole          // class_teacher | subject_teacher | HOD | deputy | head
  }
}

TeacherClass {
  id: UUID,
  teacher_id: UUID,
  class_id: UUID,
  curriculum_id: UUID,
  subject_ids: UUID[],
  academic_year: String,
  term: Integer,
  periods_per_week: Integer
}

TermPlan {
  id: UUID,
  teacher_id: UUID,
  class_id: UUID,
  term_id: UUID,
  
  curriculum_schedule: [{
    week_number: Integer,
    competency_ids: UUID[],
    estimated_hours: Float,
    status: "planned" | "in_progress" | "completed" | "deferred"
  }],
  
  assessment_schedule: [{
    week_number: Integer,
    instrument_id: UUID,
    purpose: AssessmentPurpose
  }],
  
  gap_remediation_plan: [{
    competency_id: UUID,
    week_number: Integer,
    approach: String
  }],
  
  created_by: "teacher" | "ai_assisted",
  teacher_approved: Boolean,
  approved_at: Timestamp | null
}

TeacherDecision {
  id: UUID,
  teacher_id: UUID,
  decided_at: Timestamp,
  
  ai_output_id: UUID,
  decision: "accepted" | "modified" | "rejected",
  
  if_modified: {
    original_hash: String,
    modified_hash: String,
    modification_summary: String | null  // teacher-described what they changed
  },
  
  if_rejected: {
    reason_category: RejectionReason,
    reason_detail: String | null
  }
}
```

### Domain Events

```
teacher.class.assigned        { teacher_id, class_id, subject_ids, term_id }
teacher.term_plan.created     { teacher_id, class_id, term_id, plan_id }
teacher.observation.recorded  { teacher_id, learner_id | class_id, competency_ids }
teacher.ai.decision.made      { teacher_id, ai_output_id, decision, modified }
teacher.coverage.updated      { teacher_id, class_id, competency_id, status }
teacher.intervention.approved { teacher_id, learner_id, intervention_id }
```

---

## 4.6 School Domain

### Purpose

The School Domain manages the institutional context of educational delivery: school profile, administrative structure, resource context, and institutional intelligence.

### Responsibilities

- Maintain authoritative school identity and enrollment records
- Coordinate school-level scheduling and resource management
- Aggregate learner and teacher intelligence to school-level views
- Support inspection and accountability workflows
- Integrate with national EMIS (Education Management Information System)
- Maintain school-level institutional memory

### Canonical Data Objects

```
SCHOOL DOMAIN CANONICAL OBJECTS:

School {
  id: UUID,
  emis_code: String,          // Kenya: from NEMIS/EMIS
  name: String,
  
  classification: {
    institution_type: InstitutionType,    // public | private | mission | community
    level: EducationLevel[],              // ECD | primary | junior_secondary | senior_secondary
    category: SchoolCategory,             // day | boarding | mixed
    ownership: OwnershipType
  },
  
  location: {
    county_id: UUID,
    sub_county: String,
    ward: String,
    gps_coordinates: GeoPoint | null,
    location_type: LocationType          // urban | peri_urban | rural | remote
  },
  
  contact: {
    principal_id: UUID,
    phone: String,
    email: String | null,
    postal_address: String | null
  },
  
  profile: {
    enrollment_capacity: Integer,
    current_enrollment: Integer,
    teacher_count: Integer,
    resource_level: ResourceLevel,       // basic | standard | enhanced | digital
    available_technology: Technology[],
    languages_of_instruction: String[]
  }
}

AcademicClass {
  id: UUID,
  school_id: UUID,
  grade_level: Integer,
  class_code: String,          // e.g., "8A", "8B"
  academic_year: String,
  
  enrollment: {
    capacity: Integer,
    current_enrollment: Integer
  },
  
  class_teacher_id: UUID,
  subject_teachers: [{
    teacher_id: UUID,
    subject_id: UUID
  }]
}

SchoolPerformanceSummary {
  school_id: UUID,
  academic_year: String,
  term: Integer,
  
  risk_distribution: {
    CRITICAL: Float,   // percentage of learners at each risk level
    HIGH: Float,
    MEDIUM: Float,
    LOW: Float
  },
  
  curriculum_coverage: {[subject_code: String]: Float},  // % of term plan completed
  
  assessment_regularity: {[subject_code: String]: {
    assessments_completed: Integer,
    target: Integer
  }},
  
  top_learning_gaps: [{
    competency_id: UUID,
    affected_learner_count: Integer,
    affected_percentage: Float
  }],
  
  generated_at: Timestamp
}
```

---

## 4.7 Parent Domain

### Purpose

The Parent Domain manages the relationship between guardians and the educational system, enabling informed family engagement with learner development.

### Responsibilities

- Maintain guardian-learner relationships with appropriate authorization
- Translate educational intelligence into parent-accessible insights
- Coordinate parent-teacher communication
- Manage consent for AI-generated parent communications
- Support parent-initiated support planning

### Key Design Decision: Parent as Translation Consumer

Parents do not access raw learner data. The Parent Domain exposes a **Translation API** that converts structured educational data into natural language summaries appropriate for the parent's language, literacy level, and cultural context. Parents see insights, not data.

```
PARENT DOMAIN CANONICAL OBJECTS:

GuardianRelationship {
  id: UUID,
  guardian_id: UUID,
  learner_id: UUID,
  relationship_type: GuardianshipType,  // parent | guardian | sponsor | sibling
  
  authorization: {
    is_active: Boolean,
    authorized_from: Date,
    data_access_level: DataAccessLevel,  // standard | enhanced (requires SENCO approval)
    communication_consent: ConsentRecord
  }
}

ParentCommunication {
  id: UUID,
  recipient_guardian_id: UUID,
  learner_id: UUID,
  
  channel: CommunicationChannel,  // in_app | sms | whatsapp | email
  sent_at: Timestamp | null,
  status: CommunicationStatus,
  
  content: {
    language: String,
    summary_type: SummaryType,    // progress_update | intervention_notice | milestone | alert
    subject: String,
    body: String,
    action_items: ActionItem[],
    next_check_in: Date | null
  },
  
  provenance: {
    generated_by: "ai" | "teacher" | "system",
    ai_generation_id: UUID | null,
    teacher_reviewed: Boolean,
    teacher_id: UUID | null
  }
}
```

---

## 4.8 Government Domain

### Purpose

The Government Domain enables appropriate oversight, policy implementation, and national intelligence for Ministry of Education, county governments, and regulatory bodies — while maintaining strict data privacy and institutional sovereignty.

### Responsibilities

- Serve pseudonymized aggregate educational analytics to government entities
- Implement national reporting standards (NEMIS, KICD, KNEC formats)
- Support policy simulation and curriculum impact analysis
- Maintain curriculum authority integration (KICD curriculum governance)
- Support inspection and quality assurance workflows
- Integrate with national identification and examination systems

### Data Architecture for Government

The Government Domain operates on a dedicated analytics replica containing only anonymized or pseudonymized data. No individual learner record with PII is accessible through Government Domain APIs.

```
GOVERNMENT DOMAIN DATA PRINCIPLES:

National Level:
  - Fully anonymized aggregate statistics
  - K-anonymity enforced (k ≥ 10 for any cohort)
  - Differential privacy noise added to reported statistics

County Level:
  - Pseudonymized school-level statistics
  - Individual learner data: NOT available
  - County education officer can see school aggregates, not individual records

District Level:
  - Pseudonymized school-level data
  - School access for their own data only (not peer schools)

ACCESS CONTROL:
  Government access requires:
    - Named government official with verified credentials
    - Defined purpose (inspection | planning | reporting | research)
    - Data access agreement signed
    - All access logged and auditable by institution
    - Time-limited access token (renewable by re-authorization)
```

---

## 4.9 Research Domain

### Purpose

The Research Domain enables educational researchers (universities, think tanks, international organizations) to access anonymized educational data for scientific research that advances educational knowledge globally.

### Responsibilities

- Manage research data access applications and ethics review
- Provide research-grade anonymized and pseudonymized data exports
- Support longitudinal cohort research with time-series data
- Maintain research citation and outcome tracking
- Prevent data misuse through technical and contractual controls

### Research Access Levels

```
RESEARCH ACCESS TIER SYSTEM:

Tier 1 (Open):
  Public aggregate statistics published monthly
  No application required
  Available at: data.edunexus.io/public

Tier 2 (Standard Research):
  Anonymized, cross-sectional cohort data
  Requires: IRB/ethics approval, institutional affiliation, data use agreement
  Available: specific data exports, no raw query access

Tier 3 (Longitudinal Research):
  Pseudonymized longitudinal data for approved research projects
  Requires: IRB approval, institutional oversight, named investigators, time-limited
  Access model: federated query (queries run server-side; researcher gets results, not data)

Tier 4 (Embedded Research):
  Real-time access for approved embedded researchers (faculty at partner universities)
  Requires: full ethics approval, institutional partnership agreement, on-site security review
  Access model: secure research enclave (no data leaves the platform)
```

---

## 4.10 Career Domain

### Purpose

The Career Domain connects educational competency development to career pathways, enabling intelligence about the relationship between what learners know and where they can go.

### Canonical Data Objects

```
CAREER DOMAIN CANONICAL OBJECTS:

CareerPathway {
  id: UUID,
  title: String,
  sector: String,
  
  education_requirements: [{
    level: EducationLevel,
    minimum_grade_requirements: GradeRequirement[],
    preferred_competencies: [{
      competency_id: UUID,
      required_mastery_level: MasteryLevel,
      weight: Float
    }]
  }],
  
  kenya_labour_market: {
    annual_openings_estimate: Integer,
    median_annual_salary_ksh: Integer,
    growth_rate_5yr: Float,
    geographic_concentration: String[],  // counties with most openings
    major_employers: String[]
  }
}

LearnerCareerAlignment {
  learner_id: UUID,
  computed_at: Timestamp,
  
  pathway_scores: [{
    pathway_id: UUID,
    alignment_score: Float,    // 0.0-1.0
    gap_analysis: [{
      competency_id: UUID,
      current_level: MasteryLevel,
      required_level: MasteryLevel,
      gap_magnitude: Float
    }]
  }],
  
  recommended_pathways: UUID[],  // top 3 by alignment
  stretch_pathways: UUID[]       // aspirational with identified development plan
}
```

---

## 4.11 Identity Domain

### Purpose

The Identity Domain is the security and authorization foundation of the platform. It manages all principal identities (learners, teachers, parents, administrators, developers, government officials, researchers) and enforces authorization policies across all domain access.

### Canonical Identity Model

```
IDENTITY DOMAIN MODEL:

Principal {
  id: UUID,                  // stable, internal identifier
  type: PrincipalType,       // Learner | Teacher | Guardian | Admin | Developer | Gov | Researcher
  
  credentials: [{
    type: CredentialType,    // email | phone | national_id | school_id | tsc_number
    value_hash: String,      // never store credential plaintext
    verified: Boolean,
    verified_at: Timestamp | null
  }],
  
  authentication: {
    mfa_enabled: Boolean,
    mfa_methods: MFAMethod[],
    last_login: Timestamp | null,
    active_sessions: SessionRef[]
  },
  
  linked_identities: [{
    external_system: String,  // NEMIS | Google | TSC
    external_id: String,
    linked_at: Timestamp
  }]
}

AuthorizationContext {
  principal_id: UUID,
  principal_type: PrincipalType,
  institution_ids: UUID[],    // what institutions does this principal belong to?
  roles: Role[],              // roles within each institution
  
  // Derived at query time from guardianship and enrollment records:
  learner_access_scope: UUID[],  // which learners can this principal access?
  institution_access_scope: UUID[], // which institutions?
  data_sensitivity_clearance: DataSensitivity  // maximum sensitivity level accessible
}
```

---

*End of Part IV — Core Domains. Part V (Core Engines) continues in arc-part3.md.*
# EduNexus Canonical Reference Architecture — Part V: Core Engines

---

# PART V: CORE ENGINES

## 5.0 Engine Architecture Overview

EduNexus's intelligence capabilities are organized as **Engines** — composable, independently deployable computing units that transform inputs into educational intelligence outputs. Engines are distinct from Domain services: Domains own data; Engines compute over data.

Each Engine is designed with these properties:
- **Stateless**: Engines do not maintain state; they compute from data stored in Domains
- **Idempotent**: Given the same inputs, an Engine produces the same outputs
- **Composable**: Engines can be chained by the AI Orchestration Engine to answer complex questions
- **Observable**: All Engine computations are logged with inputs, outputs, and computation metadata
- **Degradable**: Engines have defined degraded modes when dependencies are unavailable

```
ENGINE INTERACTION TOPOLOGY:

KNOWLEDGE GRAPH ENGINE ←── all engines read from and write to the graph
        ↑
        │
AI ORCHESTRATION ENGINE ──→ routes requests to appropriate engines
        │
        ├──→ CURRICULUM ENGINE      ──→ learning sequences, gap analysis
        ├──→ COMPETENCY ENGINE      ──→ mastery level computation
        ├──→ ASSESSMENT ENGINE      ──→ item selection, scoring
        ├──→ RISK ENGINE            ──→ risk scoring, trajectory
        ├──→ INTERVENTION ENGINE    ──→ intervention matching, planning
        ├──→ RECOMMENDATION ENGINE  ──→ resource, pathway, content recommendations
        ├──→ CAREER ENGINE          ──→ career alignment, pathway planning
        ├──→ ANALYTICS ENGINE       ──→ aggregation, trends, comparisons
        ├──→ SEARCH ENGINE          ──→ semantic and structured search
        ├──→ REPORTING ENGINE       ──→ institutional and government reports
        ├──→ PORTFOLIO ENGINE       ──→ portfolio analysis and evidence grounding
        ├──→ SCHEDULING ENGINE      ──→ timetables, assessment scheduling
        ├──→ OFFLINE SYNC ENGINE    ──→ offline state management, conflict resolution
        ├──→ EVENT ENGINE           ──→ event routing, subscription management
        └──→ PLUGIN ENGINE          ──→ third-party extension hosting and sandboxing
```

---

## 5.1 Curriculum Engine

### Purpose

The Curriculum Engine answers questions about the curriculum structure, sequencing, and requirements — computations that require traversal of the curriculum prerequisite graph combined with pedagogical knowledge.

### Inputs

```
CurriculumEngineInput {
  operation: CurriculumOperation,
  curriculum_id: UUID,
  curriculum_version: SemanticVersion,
  target_competency_id: UUID | null,
  learner_competency_state: CompetencyStateSummary | null,
  available_time_hours: Float | null,
  constraints: CurriculumConstraint[]
}
```

### Outputs

```
CurriculumEngineOutput {
  operation: CurriculumOperation,
  
  learning_sequence: LearningSequence | null,
  gap_analysis: GapAnalysis | null,
  coverage_analysis: CoverageAnalysis | null,
  prerequisite_chain: PrerequisiteChain | null,
  
  confidence: Float,
  computation_time_ms: Integer,
  graph_nodes_traversed: Integer,
  citations: CurriculumNodeRef[]
}
```

### Core Operations

**OPERATION: LEARNING_SEQUENCE**
Computes the optimal learning sequence from the learner's current position to a target competency.

```
Algorithm: LearningSequence

1. PREREQUISITE_CHAIN_EXTRACTION
   path = dijkstra(
     graph = curriculum_graph,
     source = target_competency,
     direction = INCOMING,  // follow prerequisite edges backward
     weight_function = lambda e: 1.0 / e.strength,  // strong prerequisites first
     max_depth = 8
   )

2. LEARNER_STATE_OVERLAY
   for node in path:
     node.learner_level = learner_competency_state.get(node.id, NOT_YET)
   
3. STARTING_POINT_IDENTIFICATION
   starting_node = last(n for n in path if n.learner_level >= PROFICIENT)
   // Start from just after the last mastered prerequisite

4. SEQUENCE_CONSTRUCTION
   active_sequence = path[starting_node.index + 1:] + [target]
   
5. TIME_ESTIMATION
   for node in active_sequence:
     base_time = node.expected_learning_time_hours
     adjustment = 1.0 + (1.0 - learner_readiness_score) * 0.5
     node.estimated_time = base_time * adjustment

6. RISK_IDENTIFICATION
   bottleneck_nodes = [n for n in active_sequence if n.degree_in > 3]
   // Nodes many other nodes depend on — high risk if not mastered

Output: {sequence: active_sequence, total_time: sum(times), bottlenecks, risks}
```

**OPERATION: GAP_ANALYSIS**
Identifies and characterizes learning gaps relative to curriculum expectations.

```
Algorithm: GapAnalysis

1. EXPECTED_COMPETENCIES = curriculum_expected_for_grade_and_term(grade, term_week)

2. for competency in EXPECTED_COMPETENCIES:
     learner_level = learner_competency_state.get(competency.id)
     expected_level = competency.expected_level_at_week(current_week)
     
     if learner_level < expected_level:
       gap_magnitude = expected_level - learner_level
       severity = classify_severity(gap_magnitude, competency.prerequisite_importance)
       
       root_cause = trace_prerequisite_chain(competency, learner_competency_state)
       // Walk backward through prerequisites to find deepest unmastered node
       
       gaps.append(LearningGap{
         competency, severity, root_cause, estimated_remediation_time
       })

3. PRIORITIZE
   gaps.sort(key=lambda g: severity * prerequisite_breadth / remediation_time)
   // Most impactful gaps first

4. GENERATE_NARRATIVE (LLM-grounded in symbolic output)
   narrative = ai_generate(
     "Generate a gap analysis narrative for a teacher based on this structured gap analysis: {gaps}
      Cite each gap by curriculum competency code. Do not add gaps not in the provided data."
   )
```

**OPERATION: CURRICULUM_COVERAGE**
Analyzes curriculum coverage at class or school level.

**OPERATION: PREREQUISITE_CHAIN**
Returns the full prerequisite chain for a competency with depth control.

**OPERATION: FORWARD_DEPENDENCIES**
Returns competencies that become accessible when a target competency is mastered.

### Scaling

The Curriculum Engine is CPU-bound during graph traversal. At scale: precomputed prerequisite chains for all curriculum competencies are cached in the graph database as materialized relationships. Cache is invalidated on curriculum revision events. Curriculum graphs are small enough (< 50K nodes) to be loaded into memory on each engine instance.

### Failure Modes

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Graph DB unavailable | Return cached prerequisite chains | Cache TTL: until curriculum revision |
| Curriculum version mismatch | Refuse operation; return error with correct version | Caller must use correct version |
| Circular prerequisites detected | Return error; alert curriculum team | Curriculum data quality issue |
| Learner state unavailable | Return curriculum structure without personalization | Disclose to caller |

---

## 5.2 Assessment Engine

### Purpose

The Assessment Engine manages assessment item selection, assembly, scoring, and quality control — bridging the Curriculum Domain (what to assess) and the Competency Domain (what was assessed).

### Core Operations

**OPERATION: ITEM_SELECTION**
Selects assessment items from the item bank for a given assessment purpose.

```
Algorithm: ItemSelection

Input: {target_competencies[], bloom_distribution, item_count, exclusions[]}

1. CANDIDATE_RETRIEVAL
   candidates = item_bank.query(
     competency_ids = target_competencies,
     bloom_levels = [l for l, w in bloom_distribution.items()],
     status = "validated",
     not_in = exclusions
   )

2. DIFFICULTY_TARGETING
   For each competency, compute target_difficulty:
     target_difficulty = mean(learner.evidence_scores[competency]) + 0.1
     // Slightly above demonstrated ability (challenge without overwhelm)
   
   candidates = rank_by_distance_to_target_difficulty(candidates, target_difficulty)

3. BLUEPRINT_SATISFACTION
   selected = []
   bloom_quotas = {l: round(w * item_count) for l, w in bloom_distribution.items()}
   
   for bloom_level in sorted_by_quota(bloom_quotas):
     bloom_candidates = [c for c in candidates if c.bloom_level == bloom_level]
     selected += bloom_candidates[:bloom_quotas[bloom_level]]

4. COVERAGE_VALIDATION
   for competency in target_competencies:
     assert len([i for i in selected if competency in i.aligned_competencies]) >= 2
     // Every target competency must have at least 2 items

5. PSYCHOMETRIC_VALIDATION
   assert estimated_reliability(selected) >= 0.70
   // Cronbach's alpha estimate must meet minimum

Output: AssessmentBlueprint{items: selected, estimated_reliability, coverage_map}
```

**OPERATION: AI_ITEM_GENERATION**
Generates new assessment items when the item bank is insufficient.

**OPERATION: SCORING**
Scores submitted responses — automated for MCQ, AI-assisted for constructed response.

```
Algorithm: Scoring (Constructed Response)

Input: {response, item, rubric, learner_context}

1. INITIAL_AI_SCORING
   score_result = ai_score(
     prompt_template = scoring_prompt[item.item_type],
     context = {item, rubric, response, curriculum_alignment}
   )
   // Returns: score, rubric_level, justification, confidence

2. CALIBRATION_CHECK
   if score_result.confidence < 0.75 OR item.item_type IN [Essay, Practical]:
     route_to_teacher_review(score_result, response, item)
     return: PendingScore{ai_initial_score, teacher_review_required: true}

3. CONSISTENCY_CHECK
   similar_responses = retrieve_similar_responses(response_embedding)
   if score_result.score deviates_from(similar_responses, threshold=1.5_sigma):
     flag_for_review("Outlier score — may indicate edge case")

4. CURRICULUM_ALIGNMENT_VERIFICATION
   for competency in item.curriculum_alignment:
     performance_indicator = infer_competency_performance(
       score = score_result.score,
       rubric_level = score_result.rubric_level,
       competency = competency,
       bloom_level = item.bloom_level
     )
     result.competency_mapping[competency.id] = performance_indicator

Output: ScoringResult{score, rubric_level, competency_mapping, teacher_review_required}
```

**OPERATION: PSYCHOMETRIC_CALIBRATION**
Updates IRT parameters for items based on accumulated response data.

### Failure Modes

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Item bank empty for query | Fall back to AI generation with flag | Mark generated items as unvalidated |
| AI scoring model unavailable | Route all scoring to teacher | Increase teacher review queue |
| Psychometric calibration fails | Retain prior parameters; flag as stale | Re-calibrate on next batch run |

---

## 5.3 Risk Engine

### Purpose

The Risk Engine computes and maintains probabilistic risk profiles for every learner — calibrated assessments of the likelihood that a learner will not meet expected educational outcomes — with evidence citations and calibrated confidence intervals.

### Risk Model Architecture

The Risk Engine uses a multi-factor model combining:
1. **Academic risk factors** (competency state, gap severity, assessment trajectory)
2. **Engagement risk factors** (session participation, assignment completion rate)
3. **Contextual risk factors** (attendance pattern if available, school context)

```
RISK MODEL SPECIFICATION:

RiskScore = sigmoid(
  β₀ +
  β₁ * academic_risk_score +
  β₂ * engagement_risk_score +
  β₃ * gap_severity_index +
  β₄ * trajectory_slope +
  β₅ * days_until_term_end_normalised
)

Where:
  academic_risk_score = weighted_sum(
    (expected_mastery - actual_mastery) * competency_importance
    for competency in term_required_competencies
  )
  
  engagement_risk_score = 1.0 - (
    active_learning_days / expected_active_learning_days
  )
  
  gap_severity_index = sum(
    gap.severity_weight * gap.prerequisite_breadth
    for gap in active_gaps
  )
  
  trajectory_slope = OLS_slope(
    [(t, achievement_score) for t, achievement_score in recent_trajectory_points]
  )

MODEL PARAMETERS (β₀-β₅):
  Calibrated quarterly using logistic regression on:
    Input: risk factors computed N weeks before term end
    Label: did learner meet term end expectations? (binary)
  
  Required: minimum 500 labeled examples per grade level per curriculum
  Update: quarterly after term-end outcomes are known
  Validation: held-out test set ECE < 0.05 before deployment
```

### Risk Score Calibration

Calibration is a first-class concern. An uncalibrated risk score misleads teachers and triggers incorrect interventions.

```
CALIBRATION MONITORING:

Weekly calibration check:
  For each risk score bucket (0.0-0.1, 0.1-0.2, ..., 0.9-1.0):
    sample = historical_predictions_in_bucket
    actual_negative_outcome_rate = mean(sample.actual_outcome)
    expected_rate = bucket_midpoint
    calibration_error = abs(actual_negative_outcome_rate - expected_rate)
  
  ECE = mean(calibration_error for all buckets)
  Alert if ECE > 0.05: model requires recalibration

FAIRNESS MONITORING:
  For each demographic group [gender, school_type, county, SES_proxy]:
    ECE_group = compute_ECE(predictions WHERE demographic = group)
    assert abs(ECE_group - ECE_overall) < 0.07
    // No demographic group should have substantially different calibration
```

### Intervention Trigger Architecture

Risk scores trigger interventions through a threshold-based system with teacher review:

```
RISK THRESHOLD SYSTEM:

CRITICAL (score > 0.80):
  Action: Immediate teacher notification + automatic addition to intervention queue
  Teacher review: Required within 24 hours
  Escalation: If not reviewed in 24 hours, escalate to HOD

HIGH (0.60-0.80):
  Action: Weekly teacher digest inclusion + intervention recommendation
  Teacher review: Within 72 hours

MEDIUM (0.40-0.60):
  Action: Monthly monitoring digest
  Teacher review: At teacher's discretion

LOW (< 0.40):
  Action: No notification
  Monitoring: Automated trajectory check weekly

THRESHOLD CALIBRATION:
  Thresholds are not fixed. They are calibrated to maintain:
    CRITICAL: false positive rate < 15% (avoid alert fatigue)
    HIGH: sensitivity > 85% (don't miss high-need learners)
  
  Recalibrated annually when term-end outcome data is available.
```

### Failure Modes

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Insufficient evidence | Report risk with confidence < 0.3; do not trigger alerts | Alert user of insufficient data |
| Stale learner state (> 30 days without new evidence) | Flag profile as stale; reduce confidence by 30% | Request new assessment event |
| Model version mismatch | Refuse computation; use last valid score | Alert AI operations team |
| Calibration ECE > 0.08 | Block new score deployment; use prior model | Recalibration investigation |

---

## 5.4 Intervention Engine

### Purpose

The Intervention Engine matches learning gaps to evidence-backed interventions, generates implementation plans, and tracks intervention outcomes to continuously improve recommendation quality.

### Intervention Matching Algorithm

```
Algorithm: InterventionMatching

Input:
  learner_id: UUID
  active_gaps: LearningGap[]
  teacher_context: TeacherContext
  school_context: SchoolContext

Step 1: GAP CHARACTERIZATION
  for gap in active_gaps:
    gap.type = classify_gap_type(gap, learner_profile)
    // types: missing_prerequisite | misconception | insufficient_practice | 
    //        language_barrier | attendance_related | engagement_deficit
    
    gap.root_competency = trace_to_root(gap, learner_profile)

Step 2: CANDIDATE RETRIEVAL
  candidates = intervention_database.query(
    gap_types = [gap.type for gap in active_gaps],
    competency_ids = [gap.competency_id for gap in active_gaps],
    grade = learner_profile.grade,
    resource_level = school_context.resource_level,
    time_available = teacher_context.intervention_time_budget
  )

Step 3: EFFICACY-BASED RANKING
  for candidate in candidates:
    efficacy_records = intervention_outcomes.query(
      intervention_type = candidate.type,
      gap_type = gap.type,
      similar_learner_profiles = find_similar_profiles(learner_profile, k=50)
    )
    
    if len(efficacy_records) >= MIN_SAMPLE_SIZE:
      candidate.expected_effect_size = mean(efficacy_records.effect_size)
      candidate.evidence_strength = min(1.0, len(efficacy_records) / 100)
      candidate.confidence_interval = bootstrap_CI(efficacy_records.effect_size, 0.95)
    else:
      candidate.expected_effect_size = POPULATION_PRIOR_EFFECT
      candidate.evidence_strength = 0.2  // low confidence without data
      candidate.confidence_interval = [0.0, 1.0]  // wide interval

Step 4: FEASIBILITY FILTERING
  candidates = [c for c in candidates if c.feasible_for(school_context, teacher_context)]
  // Feasibility: resource requirements, time requirements, teacher capability

Step 5: PRIORITY RANKING
  score(candidate) = (
    candidate.expected_effect_size * candidate.evidence_strength *
    candidate.feasibility_score * (1 / candidate.estimated_effort)
  )
  
  ranked = sorted(candidates, key=score, reverse=True)[:3]

Step 6: GENERATE IMPLEMENTATION PLAN
  for intervention in ranked:
    plan = LLM_generate(
      template = INTERVENTION_PLAN_PROMPT,
      context = {intervention, gap, learner_profile, teacher_context},
      citations = [intervention.evidence_sources]
    )

Step 7: OUTCOME TRACKING SETUP
  for approved_intervention in [approved by teacher]:
    schedule_outcome_check(
      intervention_id, 
      check_dates = [today + 7_days, today + 21_days, term_end]
    )

Output: [InterventionRecommendation{intervention, plan, evidence_strength, effect_size_CI}]
```

### Outcome Tracking

The Intervention Engine's quality depends on tracking outcomes — without feedback, it cannot improve.

```
OUTCOME TRACKING PROTOCOL:

At each scheduled check-in date:
  1. Retrieve: learner competency state at check-in vs. at intervention start
  2. Compute: delta_level, delta_confidence, delta_risk_score
  3. Compute: effect_size = (delta_achievement) / population_SD
  4. Store: InterventionOutcome{
       intervention_id, measurement_date, lag_days,
       effect_size, competency_before, competency_after,
       methodology: "observational"  // can't randomize, but can control
     }
  5. Update: intervention_database efficacy records for this intervention type
  6. Trigger: re-ranking of similar interventions in queue

CAUSAL ATTRIBUTION LIMITATIONS:
  Observational outcomes cannot prove causality.
  The Intervention Engine reports: "Among learners with similar profiles who received
  this intervention, X% improved by at least 1 mastery level within 3 weeks."
  It does NOT claim the intervention caused the improvement.
  Randomized controlled evidence (where available from research literature) is
  explicitly labeled as stronger evidence and weighted more heavily.
```

---

## 5.5 Knowledge Graph Engine

### Purpose

The Knowledge Graph Engine is the central data access layer for all graph operations. It abstracts the underlying graph database, provides educational-domain-specific query patterns, enforces authorization, and manages graph performance.

### Graph Query API

```
KNOWLEDGE GRAPH ENGINE API:

// Curriculum queries
GET /graph/curriculum/{curriculum_id}/competency/{competency_id}/prerequisites
  params: depth (1-8), include_learner_states (bool, requires learner_id)
  returns: PrerequisiteChain

GET /graph/curriculum/{curriculum_id}/competency/{competency_id}/forward-dependencies
  params: depth (1-3)
  returns: ForwardDependencyTree

GET /graph/learner/{learner_id}/competency-state
  params: curriculum_id, as_of_date (bi-temporal), subject_filter
  returns: CompetencyStateMap

GET /graph/learner/{learner_id}/learning-frontier
  description: Returns competencies the learner has the prerequisites for but hasn't mastered
  params: curriculum_id
  returns: FrontierCompetency[]

GET /graph/class/{class_id}/competency-distribution
  params: competency_id, as_of_date
  returns: MasteryDistribution  // histogram of class on this competency

POST /graph/intelligence/prerequisite-path
  body: {source_learner_state, target_competency_id, curriculum_id}
  returns: LearningSequence

POST /graph/intelligence/similar-learners
  body: {learner_id, k, similarity_features}
  returns: SimilarLearner[]  // for intervention efficacy matching

// Temporal queries
GET /graph/learner/{learner_id}/trajectory
  params: from_date, to_date, subject_filter
  returns: TrajectoryTimeSeries

GET /graph/learner/{learner_id}/state-at
  params: date (valid_time query)
  returns: CompetencyStateMap at that date
```

### Graph Performance Architecture

```
GRAPH PERFORMANCE STRATEGY:

QUERY CLASSIFICATION:
  Class A (< 50ms target): Single-node lookups, cached prerequisite chains
  Class B (< 200ms target): Multi-hop traversals (1-3 hops), learner state queries
  Class C (< 1s target): Complex traversals (4-8 hops), class aggregations
  Class D (< 10s target): Batch analytics, cohort comparisons
  Class E (background): National-scale analytics, curriculum impact analysis

INDEX STRATEGY:
  Required indexes:
    (Learner.id): primary key index
    (CurriculumCompetency.id): primary key index
    (CurriculumCompetency.code): unique secondary index
    (CompetencyState.learner_id, CompetencyState.competency_id): composite
    (CompetencyState.learner_id, CompetencyState.valid_until = NULL): for current-state queries
    (School.emis_code): secondary index
    (Evidence.learner_id, Evidence.occurred_at): for temporal evidence queries

MATERIALIZED PATHS:
  For high-frequency prerequisite chains: pre-compute and materialize as graph paths
  Materialization trigger: curriculum revision event
  Stored as: (competency)-[:MATERIALIZED_PREREQUISITE_CHAIN {depth, path_json}]->(competency)
  
CACHING LAYERS:
  L1 (in-process, Engine instance): curriculum nodes, frequently accessed learner states
    TTL: curriculum nodes → curriculum revision; learner states → 5 minutes
  L2 (Redis, shared): class-level aggregations, school-level summaries
    TTL: 15 minutes
  L3 (CDN): curriculum content for AI context assembly
    TTL: curriculum revision event invalidates
```

---

## 5.6 AI Orchestration Engine

### Purpose

The AI Orchestration Engine is the central coordinator of all AI activity on the platform. It is responsible for: assembling context from the Knowledge Graph and Memory systems; constructing prompts from versioned modules; routing requests to appropriate models; validating outputs; routing high-consequence outputs to human review; persisting results; and logging the complete provenance chain.

### Orchestration Request Lifecycle (Full)

```
COMPLETE ORCHESTRATION LIFECYCLE:

Phase 0: PRE-FLIGHT (< 10ms)
  0.1 Authenticate: verify JWT token
  0.2 Authorize: check ABAC policy for requested operation and data scope
  0.3 Rate check: verify caller within rate limits
  0.4 Schema validate: verify request body schema
  0.5 Create audit record: audit_id, timestamp, caller, operation
  0.6 Assign request_id: for distributed tracing

Phase 1: CONTEXT ASSEMBLY (< 300ms, parallelized)
  1.1 [Parallel] Load curriculum context:
      - Target competency node from KG
      - Prerequisite chain (depth 2)
      - Assessment strategies
      - Cross-curricular connections
      - Current curriculum version
  
  1.2 [Parallel] Load learner context (if learner-specific):
      - Current competency state (relevant competencies only)
      - Active gaps
      - Active misconceptions
      - Recent evidence (last 30 days)
      - Current risk profile summary
  
  1.3 [Parallel] Load teacher context (if teacher-facing):
      - Current class profile
      - Recent AI decisions
      - Term plan position
      - School resource context
  
  1.4 [Parallel] Load conversation history:
      - Last 5 turns (full) or session summary (if session > 10 turns)
  
  1.5 Validate context freshness:
      - Curriculum: must be current version
      - Learner state: must be < 5 minutes old (refresh if stale)
      - Stale data: disclose in prompt and response

Phase 2: PROMPT CONSTRUCTION (< 50ms)
  2.1 Select prompt modules from Prompt Registry by operation type + curriculum_id
  2.2 Compose modules: identity + curriculum + context + constraint + safety
  2.3 Inject knowledge context (from Phase 1)
  2.4 Inject learner/teacher context (from Phase 1)
  2.5 Validate token count: must fit within model's context window
      If overflow: compress context (summarize learner history, reduce prerequisite depth)
  2.6 Log prompt composition hash: for reproducibility

Phase 3: MODEL EXECUTION (< 15s for complex; < 1s for simple)
  3.1 Route to appropriate model (by quality tier, latency, cost, availability)
  3.2 Execute with retry logic:
      Attempt 1: primary model
      Attempt 2 (if error/timeout): same model, simplified prompt
      Attempt 3 (if again error): secondary model
      If all fail: return graceful degradation response
  3.3 Stream response if streaming mode requested
  3.4 Log: model used, token counts (input + output), latency

Phase 4: OUTPUT VALIDATION (< 700ms, parallelized)
  4.1 [Parallel] Schema validation: output matches required schema
  4.2 [Parallel] Citation validation: all citations exist in curriculum graph
  4.3 [Parallel] Curriculum alignment: claims aligned to cited competencies (embedding similarity)
  4.4 [Parallel] Safety check: content filter, PII detection, assessment integrity
  4.5 [Parallel] Completeness: all required output fields present
  
  On validation failure:
    Retryable failure: retry with corrected prompt (max 2 retries)
    Non-retryable: return error with specific failure reason
    Safety failure: block output; log safety event; do not retry

Phase 5: CONSEQUENCE ROUTING (< 10ms)
  5.1 Determine consequence level (1-5) based on output type + content analysis
  5.2 Route:
      Level 1: Pass directly to Phase 6
      Level 2-3: Add to teacher review queue; return "pending review" status
      Level 4-5: Add to specialist review queue; notify specialist; block until reviewed

Phase 6: PERSISTENCE (< 100ms)
  6.1 Store AI output (reference-only in audit; full output in output store)
  6.2 Update learner memory (if learner interaction resulted in state change)
  6.3 Emit downstream events (if output triggers downstream intelligence recomputation)
  6.4 Close audit record (all fields complete)
  6.5 Update token budget consumption

Phase 7: RESPONSE (< 10ms)
  7.1 Construct response envelope:
      { result, confidence, citations, ai_disclosure, generation_id, pending_review }
  7.2 Apply output format transform (JSON, HTML, plain text by caller preference)
  7.3 Return response
```

### Model Registry

```
MODEL REGISTRY SPECIFICATION:

ModelEntry {
  id: UUID,
  provider: String,            // "deepseek" | "openai" | "anthropic" | "google" | "local"
  model_name: String,
  model_version: String,
  
  capabilities: {
    max_context_tokens: Integer,
    max_output_tokens: Integer,
    supports_structured_output: Boolean,
    supports_streaming: Boolean,
    multilingual_quality: {[language: String]: Float},  // 0.0-1.0 quality per language
    reasoning_quality: Float,
    instruction_following: Float,
    educational_correctness_benchmark: Float
  },
  
  operational: {
    endpoint: URI,
    latency_p50_ms: Integer,   // tracked from observed traffic
    latency_p95_ms: Integer,
    error_rate: Float,
    cost_per_input_token: Float,
    cost_per_output_token: Float,
    availability: Float,
    data_residency: String[],  // where data is processed geographically
    data_retention_days: Integer  // how long provider retains prompts
  },
  
  governance: {
    approved_for_production: Boolean,
    approved_at: Timestamp,
    approved_by: UUID,  // Educational Review Board approval
    approved_operations: OperationType[],  // not all models approved for all operations
    excluded_operations: OperationType[],  // explicit exclusions
    data_processing_agreement: URI  // link to signed DPA
  }
}

CURRENT MODEL ROUTING TABLE (Kenya CBC primary deployment):

Interactive Tutoring (< 2s)      → DeepSeek-V3 (cost-effective, fast, good Kenya context)
Lesson Plan Generation           → Primary Tier LLM (highest quality generation)
Assessment Item Generation       → Primary Tier LLM (educational correctness critical)
Risk Narrative Explanation       → Primary Tier LLM (teacher-facing, high stakes)
Practice Problem Selection       → Secondary Tier (lower quality acceptable)
Translation (English → Kiswahili)→ Multilingual specialist model
Batch Analytics Narrative        → Secondary Tier (batch, cost-sensitive)
Government Reports               → Primary Tier (formal language critical)
```

---

## 5.7 Analytics Engine

### Purpose

The Analytics Engine aggregates educational data across learners, classes, schools, and time periods to produce insight for institutional decision-making, government reporting, and research.

### Analytics Architecture

```
ANALYTICS ARCHITECTURE:

RAW EVENTS (Kafka) → Event Consumer → Analytical Store (ClickHouse/BigQuery)
                                              ↓
                                    Analytics Engine (SQL + OLAP)
                                              ↓
                              Pre-aggregated Views + Materialized Summaries
                                              ↓
                            Analytics API → Dashboard | Report | Export

ANALYTICAL STORE SCHEMA (simplified):

FactLearningEvent {
  event_id: UUID,
  learner_pseudo_id: UUID,          // pseudonymized; reversible with authorized key
  school_id: UUID,
  grade_level: Integer,
  curriculum_id: UUID,
  competency_id: UUID,
  event_type: EventType,
  event_date: Date,
  
  // Pre-computed dimensional attributes for fast aggregation:
  county_id: UUID,
  school_type: SchoolType,
  gender: Gender | null,
  is_rural: Boolean
}

FactAssessmentResult {
  result_id: UUID,
  learner_pseudo_id: UUID,
  assessment_instrument_id: UUID,
  competency_id: UUID,
  score_normalized: Float,
  bloom_level: BloomLevel,
  assessment_date: Date,
  ...dimensional attributes
}

FactInterventionOutcome {
  outcome_id: UUID,
  intervention_type: InterventionType,
  gap_type: GapType,
  effect_size: Float,
  lag_days: Integer,
  learner_pseudo_id: UUID,
  school_type: SchoolType,
  ...dimensional attributes
}
```

### Analytics API

```
ANALYTICS API EXAMPLES:

GET /analytics/school/{school_id}/risk-distribution?term=2&year=2024
Returns: {critical: N, high: N, medium: N, low: N, as_of: timestamp}

GET /analytics/class/{class_id}/competency-coverage?curriculum_id={id}
Returns: {covered: [competency_ids], in_progress: [], not_started: []}

GET /analytics/county/{county_id}/learning-outcomes?year=2024&grade=8
Returns: PseudonymizedSchoolOutcomeMap (no individual learner data)

GET /analytics/national/curriculum-effectiveness?competency_id={id}&cohort_year=2024
Returns: {
  mean_mastery_at_expected_week: Float,
  schools_meeting_target: Float,  // percentage
  common_misconceptions: MisconceptionSummary[],
  prerequisite_bottlenecks: CompetencyRef[]
}

POST /analytics/research/cohort-analysis
  body: {cohort_definition, outcome_variables, covariates, time_period}
  requires: Tier 3 research access token
  returns: CohortAnalysisResult (pseudonymized, differential privacy applied)
```

---

## 5.8 Offline Sync Engine

### Purpose

Many EduNexus deployments operate in environments with intermittent connectivity — rural schools, mobile classrooms, remote monitoring stations. The Offline Sync Engine enables the platform to operate effectively without continuous connectivity and to synchronize state correctly when connectivity resumes.

### Offline Architecture

```
OFFLINE SYNC ARCHITECTURE:

LOCAL STATE (on device):
  Curriculum graph: full read-only copy (updated on connectivity)
  Learner roster: enrolled learners for this teacher's classes
  Learner competency states: latest known state
  Assessment instruments: downloaded instruments for offline assessment
  AI pre-generated content: pre-generated lesson plans, practice sets
  Pending event queue: events generated offline, awaiting sync

OFFLINE OPERATIONS SUPPORTED:
  ✓ View learner competency states (from local cache)
  ✓ Record teacher observations (queued for sync)
  ✓ Administer downloaded assessments (queued for sync)
  ✓ Access pre-generated lesson plans (from local cache)
  ✓ View pre-computed risk scores (from local cache; labeled as "last synced [date]")
  
  ✗ Generate new AI content requiring live model
  ✗ Access real-time learner state updates
  ✗ Access government reporting features
  ✗ Parent communication delivery (requires connectivity)

SYNC PROTOCOL (on connectivity restoration):

Step 1: CONFLICT DETECTION
  Compare: local pending events vs. server state
  Conflict types:
    Assessment conflict: same session submitted from two sources
      Resolution: trust device timestamp; flag for teacher review
    State conflict: server has newer evidence that changes competency state
      Resolution: apply server state; note conflict for audit

Step 2: UPLOAD (pending events → server)
  events = local_event_queue.get_all()
  events.sort(by=event_time)  // process in event-time order
  
  for event in events:
    server.ingest_event(event)  // idempotent ingestion
    if success: local_queue.mark_synced(event)

Step 3: DOWNLOAD (server state → local)
  delta = server.get_delta_since(last_sync_timestamp)
  local_state.apply_delta(delta)
  update: learner states, curriculum updates, new AI pre-generated content

Step 4: CONFLICT RESOLUTION
  For each conflict: generate teacher notification with both versions
  Teacher resolves: select correct version or merge

SYNC INTEGRITY:
  All events carry: device_id, sequence_number, timestamp, signature
  Server deduplicates: same device_id + sequence_number → idempotent (one ingestion)
  Network interruption during sync: resume from last acknowledged sequence number
```

---

## 5.9 Event Engine

### Purpose

The Event Engine is the nervous system of the EduNexus platform — routing educational events between system components, managing subscriptions, ensuring delivery guarantees, and providing event replay capabilities.

### Event Architecture

```
EVENT ARCHITECTURE:

PRODUCER → KAFKA TOPIC → CONSUMER GROUP → HANDLER

Topics (by domain):
  edunexus.curriculum.*    → Curriculum Domain events
  edunexus.assessment.*    → Assessment Domain events
  edunexus.learning.*      → Learning Domain events
  edunexus.competency.*    → Competency Domain events
  edunexus.teacher.*       → Teacher Domain events
  edunexus.school.*        → School Domain events
  edunexus.intelligence.*  → AI/Intelligence events
  edunexus.ecosystem.*     → Ecosystem/plugin events

CONSUMER GROUPS (examples):
  competency-state-updater:    Subscribes to assessment.response.scored
                               → Updates CompetencyState
  
  risk-profile-recomputer:     Subscribes to competency.state.updated
                               → Recomputes RiskProfile
  
  intervention-reviewer:       Subscribes to learning.gap.detected
                               → Checks if intervention already planned; if not, queues recommendation
  
  teacher-notification-router: Subscribes to intelligence.risk.threshold_crossed
                               → Routes notification to teacher via Notification Engine
  
  parent-digest-builder:       Subscribes to learning.milestone.achieved
                               → Queues parent communication for digest assembly
  
  plugin-event-relay:          Subscribes to configured events for installed plugins
                               → Relays to plugin webhooks (with authentication)

EVENT DELIVERY GUARANTEES:
  Exactly-once: for state-mutating operations (competency state update, enrollment)
    Achieved by: idempotency keys, deduplication at consumer
  
  At-least-once: for notification and analytics (acceptable to process twice)
    Achieved by: Kafka consumer offset management
  
  No guarantee: for ephemeral UI refresh events

EVENT RETENTION:
  State-changing events: retained indefinitely (educational record)
  Analytics events: retained 3 years (compressed after 90 days)
  Notification events: retained 90 days
  UI events: retained 7 days
```

---

*End of Part V — Core Engines. Parts VI-VII (Intelligence Architecture, Data Architecture) continue in arc-part4.md.*
# EduNexus Canonical Reference Architecture — Parts VI & VII: Intelligence & Data Architecture

---

# PART VI: INTELLIGENCE ARCHITECTURE

## 6.0 The Intelligence Stack

EduNexus's intelligence is not a single AI system. It is a layered stack of reasoning capabilities that, when composed, enable an AI to reason correctly about educational situations that no single language model trained on general text could address.

```
INTELLIGENCE STACK OVERVIEW:

┌──────────────────────────────────────────────────────────┐
│  EDUCATIONAL AI COPILOTS (Layer 6)                        │
│  Teacher | Learner | Parent | School | Government | Res.  │
├──────────────────────────────────────────────────────────┤
│  AI ORCHESTRATION ENGINE (Layer 5)                        │
│  Context assembly · Prompt construction · Model routing   │
│  Output validation · Consequence routing · Persistence    │
├──────────────────────────────────────────────────────────┤
│  REASONING ENGINES (Layer 4)                              │
│  Curriculum Reasoner · Competency Reasoner                │
│  Risk Reasoner · Intervention Reasoner · Career Reasoner  │
├──────────────────────────────────────────────────────────┤
│  KNOWLEDGE SYSTEMS (Layer 3)                              │
│  Educational Knowledge Graph (EKG)                        │
│  Embedding Store · Memory Systems · Context Assembler     │
├──────────────────────────────────────────────────────────┤
│  FOUNDATION MODELS (Layer 2)                              │
│  Primary LLM · Secondary LLM · Specialist Models          │
│  Embedding Model · Scoring Model · Vision Model           │
├──────────────────────────────────────────────────────────┤
│  INFERENCE INFRASTRUCTURE (Layer 1)                       │
│  GPU Nodes · Model Serving · Load Balancing · Caching     │
└──────────────────────────────────────────────────────────┘
```

## 6.1 Knowledge-Grounded AI Generation

The fundamental architecture for all AI generation in EduNexus is Knowledge-Grounded Generation (KGG): the principle that no AI output about a specific curriculum, learner, or school is produced without first retrieving the relevant knowledge from the Educational Knowledge Graph.

This is the architectural solution to the educational accuracy problem. A language model trained on general text knows something about mathematics education in general; it cannot know the specific Grade 8 Junior Secondary Mathematics curriculum sequence in the CBC 2023 specification unless that curriculum is explicitly provided as context.

### KGG Request Lifecycle

```
KNOWLEDGE-GROUNDED GENERATION LIFECYCLE:

1. REQUEST PARSING
   Parse: what competency? which learner? what purpose?
   Validate: parameters against schema
   Identify: knowledge retrieval requirements

2. KNOWLEDGE RETRIEVAL (parallel, from EKG)
   Retrieve:
     curriculum_node = KG.get_competency(competency_id, version=current)
     prerequisites = KG.get_prerequisites(competency_id, depth=2)
     mastery_model = KG.get_mastery_model(competency_id)
     learner_state = KG.get_learner_competency_state(learner_id, competency_id)
     learner_gaps = KG.get_active_gaps(learner_id, competency_ids=[competency_id] + prereq_ids)
     recent_evidence = KG.get_recent_evidence(learner_id, competency_id, days=30)
     misconceptions = KG.get_misconceptions(learner_id, competency_id)
     similar_resources = resource_index.semantic_search(competency_description, k=5)

3. CONTEXT WINDOW ASSEMBLY
   // Structured knowledge is more reliable than embedding-retrieved prose
   curriculum_context = format_curriculum_context(curriculum_node, prerequisites, mastery_model)
   learner_context = format_learner_context(learner_state, learner_gaps, recent_evidence, misconceptions)
   resource_context = format_resource_context(similar_resources)
   
   // Check token budget
   total_tokens = count(curriculum_context + learner_context + resource_context)
   if total_tokens > budget:
     // Compress: summarize evidence history, truncate resources
     learner_context = compress_learner_context(learner_context, budget - count(curriculum_context))

4. PROMPT CONSTRUCTION
   prompt = [
     SYSTEM_PROMPT(role, educational_correctness_requirements),
     CURRICULUM_MODULE(curriculum_context),
     LEARNER_MODULE(learner_context),
     TASK_MODULE(specific_task, output_format),
     CONSTRAINT_MODULE(grade_appropriate, language, length),
     SAFETY_MODULE(content_safety, assessment_integrity, pii)
   ]

5. GENERATION
   output = model.generate(prompt, temperature=task_temperature[operation])

6. POST-GENERATION VALIDATION
   // Citation verification: does the output cite competency codes that exist?
   cited_codes = extract_curriculum_citations(output)
   for code in cited_codes:
     assert curriculum_graph.exists(code) or flag_hallucination(code)
   
   // Alignment verification: are the claims about this learner grounded in provided context?
   learner_claims = extract_learner_claims(output)
   for claim in learner_claims:
     assert is_grounded_in(claim, learner_context) or flag_ungrounded_claim(claim)

7. KNOWLEDGE GRAPH UPDATE
   if output.contains_new_knowledge_about_learner:
     KG.update_interaction_record(learner_id, session_id, output_summary)
```

## 6.2 Prompt Architecture

Prompts in EduNexus are structured as composable **modules** stored in the Prompt Registry. This ensures: educational requirements are consistently enforced; prompts can be updated independently of deployment code; changes are versioned and auditable; A/B testing of prompt improvements is possible.

### Prompt Module Types

```
PROMPT MODULE SPECIFICATION:

IDENTITY MODULE
  Purpose: Establishes the AI's role, educational philosophy, and behavioral foundation
  Contains:
    - Role definition (e.g., "You are an educational intelligence assistant for the EduNexus platform...")
    - Educational values (educational correctness, learner welfare, teacher respect)
    - Epistemic commitments (evidence-first, cite your sources, express uncertainty)
    - Behavioral constraints (never make up curriculum facts, never fabricate learner data)
  Version: v{N} — updated when educational philosophy evolves
  Example:
    "You are an educational intelligence assistant. Your outputs will be used by teachers
     to make educational decisions. Educational correctness is your highest obligation.
     You must:
     - Only make claims about the curriculum that are supported by the provided curriculum context
     - Only make claims about this learner that are supported by the provided learner context
     - Cite the curriculum competency code for every curriculum claim
     - Express uncertainty when evidence is insufficient
     - Never fabricate learner performance data"

CURRICULUM MODULE
  Purpose: Injects the structured curriculum knowledge needed for this operation
  Contains:
    - Target competency definition and indicators
    - Prerequisite competency chain
    - Mastery model levels and evidence requirements
    - Cross-curricular connections
    - Assessment strategy specification
    - Current curriculum version identifier
  Dynamic: assembled per-request from EKG retrieval

LEARNER MODULE
  Purpose: Injects the learner's educational state and context
  Contains:
    - Current competency levels (structured, by code)
    - Active gaps and their severity
    - Known misconceptions
    - Recent evidence summary
    - Scaffolding preference (inferred from history)
    - Language and accessibility needs
  Dynamic: assembled per-request from Competency Domain
  Privacy: contains only educationally necessary data; no demographic data in generation prompts

CONTEXT MODULE
  Purpose: Situational context for the operation
  Contains:
    - School context (resource level, language of instruction)
    - Temporal context (term week, time available, assessment proximity)
    - Teacher context (style preferences, recent decisions)
    - Conversation history (relevant turns)
  Dynamic: assembled per-request from Teacher and School Domains

CONSTRAINT MODULE
  Purpose: Output format and boundary constraints
  Contains:
    - Target grade level for language (plain language for parents; technical for teachers)
    - Length constraints (word count, number of steps, sections)
    - Format constraints (structured JSON, markdown, plain text)
    - Language (English, Kiswahili, community language)
    - Curriculum version constraint (do not reference competencies from other versions)
  Static: per operation type + locale

SAFETY MODULE
  Purpose: Content safety and educational integrity constraints
  Contains:
    - Content filter (no violent, sexual, or harmful content)
    - PII guard (do not include learner names, national IDs, health data in outputs)
    - Assessment integrity (do not provide complete answers to assigned assessments)
    - Disclosure requirement (disclose if AI-generated for high-stakes outputs)
    - Edge case handling (what to say if question is outside scope)
  Static: universal for all operations; extended for high-risk operations
```

### Prompt Registry

```
PROMPT REGISTRY SCHEMA:

PromptTemplate {
  id: UUID,
  code: String,                  // e.g., "LESSON_PLAN_v3" or "RISK_NARRATIVE_v2"
  operation_type: OperationType,
  version: SemanticVersion,
  
  modules: {
    identity: PromptModuleRef,
    curriculum: PromptModuleRef,
    learner: PromptModuleRef | null,
    context: PromptModuleRef,
    constraint: PromptModuleRef,
    safety: PromptModuleRef
  },
  
  metadata: {
    created_at: Timestamp,
    created_by: UUID,
    approved_by: UUID,           // Educational Review Board approval required
    approved_at: Timestamp,
    evaluation_results: EvaluationResult[]  // must pass before production deployment
  },
  
  ab_config: ABTestConfig | null,  // if A/B testing is active
  
  rollout: {
    status: "development" | "testing" | "ab_test" | "production" | "deprecated",
    traffic_percentage: Float,    // 0.0-1.0; how much traffic this version receives
    fallback_version: String      // version to use if this fails validation
  }
}

PROMPT DEPLOYMENT PROCESS:
1. Author writes new prompt version
2. Automated evaluation: run standardized test set; must exceed baseline metrics
3. Educational Review Board: human review of educational correctness
4. A/B test deployment: 5% traffic; measure educational outcome metrics vs. baseline
5. Staged rollout: 10% → 25% → 50% → 100% (with outcome monitoring at each stage)
6. Full deployment: deprecate prior version
7. Prior versions retained: for audit, rollback, and research
```

## 6.3 Educational Reasoning Engines

Reasoning Engines in EduNexus are hybrid systems: they combine symbolic graph-based reasoning (for educational structure) with neural model capabilities (for natural language generation and judgment). This hybrid architecture is foundational — pure neural reasoning cannot provide the educational correctness guarantees that an operating system for education requires.

### Curriculum Reasoning Engine

```
CURRICULUM REASONING ENGINE:

Symbolic Component:
  - Prerequisite chain traversal (graph algorithms on EKG)
  - Competency gap computation (set operations on expected vs. actual)
  - Forward dependency activation detection (graph traversal)
  - Coverage analysis (set intersection of curriculum vs. taught competencies)

Neural Component:
  - Natural language generation of curriculum narratives
  - Curriculum alignment classification (for new content)
  - Pedagogy recommendation (given gap + context → approach recommendation)

Handoff Protocol:
  Symbolic engine computes structured answer (always)
  Neural engine receives structured answer as grounded context
  Neural engine generates natural language rendering
  Output must not introduce facts not in structured answer (validated)
```

### Competency Reasoning Engine

```
COMPETENCY REASONING ENGINE:

Symbolic Component:
  - Bayesian competency state update (from evidence)
  - Mastery level threshold computation
  - Evidence weight computation (recency decay, quality weighting)
  - Gap detection (comparison of state to expected level)

Neural Component:
  - Evidence interpretation (teacher observation → competency indicator)
  - Portfolio evidence evaluation (artifact → competency alignment assessment)
  - Competency-level narrative generation
  - Question answering about specific learner competency state

Confidence Architecture:
  All competency state claims carry calibrated confidence.
  Confidence is calibrated against historical accuracy:
    "When the system said 'confidence: 0.85', it was correct 83-87% of the time"
  Uncalibrated confidence scores are not reported.
```

### Risk Reasoning Engine

```
RISK REASONING ENGINE:

Symbolic Component:
  - Risk factor computation (multi-factor model)
  - Risk score calculation (logistic regression on risk factors)
  - Threshold comparison (which tier does this score fall in?)
  - Trend analysis (trajectory computation from historical scores)

Neural Component:
  - Risk factor narrative (teacher-readable explanation of which factors drive the score)
  - Intervention suggestion framing (given risk factors → actionable language)
  - Edge case handling (unusual patterns that the symbolic model may not capture)

Explainability Requirement:
  Every risk score delivered to a teacher must include:
  1. The top 3 risk factors and their contribution weights
  2. The evidence items behind each risk factor
  3. The confidence interval on the score
  4. A trajectory description (improving / stable / declining)
  
  Teachers must be able to say "I understand why this learner is flagged as HIGH risk"
  before taking action. This is a legal and ethical requirement, not an engineering nicety.
```

## 6.4 AI Safety Architecture

### Defense-in-Depth Safety Model

EduNexus implements a defense-in-depth safety architecture with seven layers. No single layer is assumed to be perfect; the system is designed to be safe even when individual layers fail.

```
SAFETY LAYER ARCHITECTURE:

Layer 1: INPUT SAFETY
  What it checks: incoming prompts and user inputs
  Methods:
    - PII detection (names, national IDs, phone numbers) → remove before logging
    - Injection detection (prompt injection patterns) → flag and block
    - Out-of-scope detection (non-educational requests) → redirect to scope
    - Malicious content detection (harmful requests) → block and audit

Layer 2: PROMPT SAFETY
  What it checks: constructed prompts before model execution
  Methods:
    - Constraint module validates required safety instructions are present
    - Context window scan: PII cannot appear in generation context
    - Prompt injection scan: user content in prompt must be quoted/separated

Layer 3: GENERATION SAFETY (REAL-TIME)
  What it checks: streaming model output in real-time
  Methods:
    - Content filter: violence, adult content, discriminatory content → terminate generation
    - PII generation detection: does output contain PII formats? → flag
    - Assessment answer detection: is output answering a live assessment question? → block

Layer 4: OUTPUT VALIDATION
  What it checks: complete model output before delivery
  Methods:
    - Schema validation: output matches required JSON schema
    - Curriculum citation verification: cited competency codes must exist in EKG
    - Factual grounding verification: claims about specific learners must be grounded in context
    - Completeness check: all required fields present
    - Bias detection: differential language quality for demographic proxies

Layer 5: CONSEQUENCE ROUTING
  What it checks: educational consequences of the output
  Methods:
    - Classify consequence level (1-5) by output type and content
    - Route high-consequence outputs to human review queue
    - Apply release hold: output not delivered until review completed
    - Escalation: if review not completed within SLA, escalate to specialist

Layer 6: DELIVERY SAFETY
  What it checks: how output is delivered to end users
  Methods:
    - AI disclosure: all AI-generated content labeled as such
    - Uncertainty disclosure: confidence scores displayed to appropriate stakeholders
    - Channel appropriateness: sensitive outputs not delivered via insecure channels
    - Recipient validation: output only delivered to authorized recipients

Layer 7: MONITORING AND AUDIT
  What it checks: system-level safety patterns over time
  Methods:
    - Bias monitoring: are outputs systematically different for demographic groups?
    - Calibration monitoring: are confidence scores calibrated against actual accuracy?
    - Incident detection: anomalous output rate, safety layer bypass attempts
    - Human audit: random sample review by educational experts
    - Feedback processing: teacher and learner feedback on output quality
```

### Consequence Level Classification

```
CONSEQUENCE LEVEL SYSTEM:

Level 1 (INFORMATIONAL):
  Examples: answer to factual curriculum question, resource suggestion
  Delivery: immediate
  Review: none required
  Disclosure: standard AI disclosure

Level 2 (ADVISORY):
  Examples: lesson plan suggestion, practice set, weekly summary
  Delivery: with review recommendation ("This AI suggestion is for your review")
  Review: optional teacher review; decision logged
  Disclosure: AI-generated, teacher review recommended

Level 3 (CONSEQUENTIAL):
  Examples: risk score narrative, intervention recommendation, parent communication
  Delivery: enters teacher review queue; not delivered until reviewed
  Review: teacher MUST review and approve/modify/reject within 72 hours
  Disclosure: AI-generated, teacher-reviewed, date of review

Level 4 (HIGH-STAKES):
  Examples: summative assessment score, official progress report, SENCO referral
  Delivery: enters specialist review queue; blocked until approved
  Review: qualified educator review required within 24 hours
  Disclosure: AI-assisted, reviewed by [professional] on [date]

Level 5 (CRITICAL):
  Examples: safeguarding concern detection, disability assessment implication
  Delivery: BLOCKED; human review before anything else
  Review: immediate specialist review + escalation to relevant authority
  Disclosure: human-only (AI output not delivered; used only to inform human decision)
```

## 6.5 AI Governance

### Educational Review Board

The Educational Review Board (ERB) is the human oversight body for all AI systems in EduNexus. The ERB is not a software component; it is an organizational governance structure with authority over AI system decisions.

```
EDUCATIONAL REVIEW BOARD STRUCTURE:

Composition:
  - Chief Educational Officer (EduNexus) — Chair
  - Senior Curriculum Expert (Kenya CBC expert)
  - Education Research Scientist
  - Teacher Representative (elected from active teacher cohort)
  - Special Needs Education Specialist
  - AI Safety Engineer
  - Privacy and Legal Counsel
  - Community Representative (parent)

ERB JURISDICTION (requires ERB approval):
  - Any new AI operation type deployed to production
  - Any prompt template change for Level 3-5 operations
  - Any change to the risk threshold system
  - Any new data type used in AI generation
  - Any model change for Level 4-5 operations
  - Any systematic output quality issue investigation
  - Any privacy impact assessment for new intelligence feature
  - Any expansion of AI autonomy (reducing human-in-the-loop requirements)

ERB MEETING CADENCE:
  Monthly: routine approvals, metrics review, incident reports
  Emergency: within 48 hours when: safety incident, model bias detected, 
             regulatory inquiry, or calibration failure

ERB AUDIT AUTHORITY:
  The ERB has authority to: halt any AI operation at any time;
  require additional human review; mandate model retraining;
  order data deletion; escalate to government authorities.
  
  The ERB does NOT have authority to: compromise learner privacy;
  override teacher decisions; access individual learner records
  without consent; direct the AI to take positions on contested
  educational policy questions.
```

---

# PART VII: DATA ARCHITECTURE

## 7.0 Data Architecture Overview

EduNexus's data architecture manages educational data across four categories with fundamentally different requirements:

```
DATA ARCHITECTURE OVERVIEW:

OPERATIONAL DATA:
  Storage: PostgreSQL (Supabase)
  Purpose: Transactional records — enrollment, auth, billing, scheduling
  Requirements: ACID, consistency, low latency, row-level security

KNOWLEDGE DATA:
  Storage: Neo4j graph database
  Purpose: Educational knowledge graph — curriculum, learner, evidence, career
  Requirements: Graph traversal, property access, temporal queries, relationship patterns

ANALYTICAL DATA:
  Storage: ClickHouse (or BigQuery)
  Purpose: Aggregated analytics, trend analysis, government reporting
  Requirements: High throughput aggregation, column compression, SQL compatibility

INTELLIGENCE DATA:
  Storage: pgvector + object storage
  Purpose: Embeddings, AI outputs, conversation histories, portfolio artifacts
  Requirements: Vector similarity search, object storage, retention management
```

## 7.1 Canonical Data Objects

The **Canonical Data Object** (CDO) is the authoritative representation of an educational entity in the EduNexus platform. CDOs define the schema that all systems use; there is no other authoritative representation.

### CDO Design Principles

1. **Every CDO has a stable UUID** — stable across schema revisions
2. **Every CDO is bi-temporally tracked** — valid_time and transaction_time
3. **CDOs are owned by their Domain** — only the owning domain writes to it
4. **CDOs emit events when they change** — downstream systems respond to events
5. **CDOs have explicit schema versions** — consumers handle version migration

### Core CDO Catalogue

```
CANONICAL DATA OBJECTS — CORE CATALOGUE:

IDENTITY:
  Principal               → base identity for all user types
  LearnerIdentity         → learner-specific identity attributes
  TeacherIdentity         → TSC registration, certification
  GuardianIdentity        → relationship to learner

CURRICULUM:
  Curriculum              → national curriculum specification
  LearningArea            → subject area
  Strand                  → curriculum strand
  SubStrand               → curriculum sub-strand
  CompetencyUnit          → curriculum competency unit
  LearningObjective       → learning objective
  CurriculumCompetency    → specific competency (assessable)
  CoreCompetency          → cross-cutting competency (CBC)
  PCI                     → Pertinent and Contemporary Issues (CBC)
  MasteryModel            → competency mastery criteria

ASSESSMENT:
  AssessmentItem          → individual assessment question
  AssessmentInstrument    → collection of items
  AssessmentEvent         → administration instance
  AssessmentResponse      → individual learner response
  ScoringRecord           → scoring result with provenance

LEARNING:
  LearningSession         → tutor interaction record
  InstructionalResource   → curriculum-aligned resource
  PortfolioArtifact       → learner work sample

COMPETENCY (INTELLIGENCE):
  CompetencyState         → learner's current state on one competency
  LearningGap             → detected learning gap
  Misconception           → identified misconception
  RiskProfile             → learner risk assessment
  TrajectorySnapshot      → periodic competency summary
  InterventionRecord      → applied intervention with outcome tracking

SCHOOL & INSTITUTION:
  School                  → school identity and profile
  AcademicClass           → class within a school
  TermPlan                → teacher's term curriculum plan
  SchoolPerformanceSummary→ aggregated school intelligence

AI:
  AIOutput                → AI generation record (for audit)
  PromptTemplate          → versioned prompt template
  ModelUsageRecord        → token consumption and cost tracking
  TeacherDecision         → teacher's review decision on AI output
```

## 7.2 The Temporal Data Model

Educational data is inherently bi-temporal. Two distinct time axes apply to every educational fact:

**Valid Time (VT)**: When the educational fact was true in reality.
**Transaction Time (TT)**: When the system recorded the fact.

These axes are independent and both matter for educational systems.

```
BI-TEMPORAL SCHEMA EXAMPLES:

CompetencyState (bi-temporal):
  valid_from:         Date     // when this assessment of learner became true
  valid_until:        Date | null   // null = currently valid
  transaction_from:   Timestamp    // when the system computed and recorded this
  transaction_until:  Timestamp | null // null = current system record

TEMPORAL QUERY EXAMPLES:

Current state (most common):
  WHERE valid_until IS NULL AND transaction_until IS NULL

State at a historical point in time (parent night queries "where was my child in week 6?"):
  WHERE valid_from <= $date AND (valid_until IS NULL OR valid_until > $date)
    AND transaction_from <= NOW() AND transaction_until IS NULL

What did the system believe on a specific date (audit investigation):
  WHERE valid_from <= $valid_date AND (valid_until IS NULL OR valid_until > $valid_date)
    AND transaction_from <= $transaction_date AND (transaction_until IS NULL OR transaction_until > $transaction_date)

Late-arriving evidence handling:
  SCENARIO: Assessment completed in week 6, not recorded until week 8
  valid_from = week_6_date (when the assessment occurred)
  transaction_from = week_8_timestamp (when it was entered)
  
  Point-in-time queries using valid_time will correctly show the state as of week 6.
  Point-in-time queries using transaction_time will show what the system knew in week 6
  (which excluded this assessment, since it wasn't entered yet).
  
  Both are valid and useful for different purposes.
```

## 7.3 Data Lineage

Every educational intelligence output must have traceable lineage: which data, which algorithm, which model, which human decision produced this output.

```
DATA LINEAGE SCHEMA:

LineageRecord {
  artifact_id: UUID,              // the output being traced
  artifact_type: ArtifactType,
  
  upstream_data: [{
    source_id: UUID,
    source_type: DataType,        // evidence | curriculum_node | assessment_result
    retrieved_at: Timestamp,
    data_snapshot_hash: String    // hash of retrieved data for tamper detection
  }],
  
  computation: {
    algorithm_name: String,
    algorithm_version: String,
    parameters: JSONObject,
    computed_at: Timestamp,
    computation_node: String      // which service instance
  },
  
  model_inference: [{             // if AI model was used
    model_id: UUID,
    model_name: String,
    model_version: String,
    prompt_template_version: String,
    generation_id: UUID,
    input_token_count: Integer,
    output_token_count: Integer
  }],
  
  human_review: [{                // if human reviewed
    reviewer_id: UUID,
    reviewed_at: Timestamp,
    decision: ReviewDecision,
    modification_summary: String | null
  }],
  
  downstream_effects: [{          // what this artifact affected
    affected_artifact_id: UUID,
    effect_type: EffectType
  }]
}
```

## 7.4 Database Architecture

### Primary Database (PostgreSQL / Supabase)

EduNexus uses PostgreSQL as the primary operational database, accessed through Supabase for its Row Level Security, authentication integration, and real-time subscription capabilities.

```
DATABASE ARCHITECTURE:

PRIMARY POSTGRESQL SCHEMA ORGANIZATION:
  Schema: auth           → Supabase authentication tables (managed)
  Schema: public         → all EduNexus application tables
  Schema: rls            → RLS policy functions (shared)
  Schema: analytics      → materialized views for dashboard queries
  Schema: audit          → append-only audit tables

ROW LEVEL SECURITY (RLS) ARCHITECTURE:
  Every table has RLS enabled.
  Policy evaluation order:
    1. Is the user authenticated? (auth.uid() IS NOT NULL)
    2. What is the user's role? (join to user_roles)
    3. Does the user's role grant access to this row?
       - Learner: own records only
       - Teacher: own classes' learner records; own school's curriculum data
       - Guardian: linked learners' records (via guardian_relationships)
       - School Admin: all records for their school_id
       - EduNexus Admin: all records (requires MFA + audit)
       - Government: anonymized views only (read-only, via analytics schema)

CRITICAL DATABASE RULES:
  1. NO select('*') — always name columns
  2. NO N+1 queries — batch with .in() or join
  3. INDEXES on: teacher_id, learner_id, school_id, competency_id, created_at
  4. EVERY FK column has an index
  5. Connection pool: service client in API routes; user client in Server Components
  6. NEVER use service role key in client-side code

CONNECTION PATTERN:
  Server-side (API routes, cron): createServiceClient() — bypasses RLS for system operations
  Server Components: createServerClient() — applies RLS with user session
  Client Components: createClient() — applies RLS with user session (read-only patterns)
  Webhooks: createServiceClient() — verifies webhook signature before any DB operation
```

### Graph Database (Neo4j Enterprise)

```
GRAPH DATABASE SCHEMA:

NODE LABELS:
  :Learner { id, pseudo_id, grade_level, school_id, enrollment_status }
  :CurriculumCompetency { id, code, title, grade_level, curriculum_version }
  :Evidence { id, type, occurred_at, score_normalized, weight }
  :School { id, emis_code, name, county_id }
  :LearningGap { id, severity, detected_at, active }
  :InterventionRecord { id, type, started_at, status }
  :CompetencyState { id, level, confidence, valid_from }
  :Assessment { id, code, instrument_id, occurred_at }
  :CareerPathway { id, title, sector }
  :CoreCompetency { id, code, name }
  :PCI { id, code, name }

RELATIONSHIP TYPES:
  (:Learner)-[:HAS_STATE]->(:CompetencyState)
  (:CompetencyState)-[:ON_COMPETENCY]->(:CurriculumCompetency)
  (:CurriculumCompetency)-[:REQUIRES_PREREQUISITE]->(:CurriculumCompetency)
  (:CurriculumCompetency)-[:DEVELOPS]->(:CoreCompetency)
  (:CurriculumCompetency)-[:ADDRESSES]->(:PCI)
  (:Learner)-[:HAS_GAP]->(:LearningGap)
  (:LearningGap)-[:ON_COMPETENCY]->(:CurriculumCompetency)
  (:Evidence)-[:SUPPORTS_STATE]->(:CompetencyState)
  (:Assessment)-[:PROVIDES_EVIDENCE]->(:Evidence)
  (:InterventionRecord)-[:TARGETS_GAP]->(:LearningGap)
  (:CareerPathway)-[:REQUIRES_COMPETENCY]->(:CurriculumCompetency)

GRAPH CONSTRAINTS:
  UNIQUE on: :CurriculumCompetency(code, curriculum_version)
  UNIQUE on: :School(emis_code)
  UNIQUE on: :Learner(id)
  INDEX on: :CurriculumCompetency(code)
  INDEX on: :Learner(school_id)
  INDEX on: :CompetencyState(valid_until)  // for current-state queries
  INDEX on: :Evidence(occurred_at)
```

## 7.5 Event Sourcing

For the highest-consequence data in the platform — competency state changes and assessment results — EduNexus uses event sourcing: the current state is always derivable by replaying the event log.

```
EVENT SOURCING IMPLEMENTATION:

SOURCED ENTITIES:
  CompetencyState: derived from stream of EvidenceEvent
  RiskProfile: derived from stream of CompetencyStateEvent + other events
  LearnerTrajectory: derived from stream of CompetencyStateEvent over time

EVENT LOG SCHEMA (CompetencyEvent):
  event_id:          UUID (primary key)
  event_type:        'evidence_added' | 'teacher_override' | 'state_computed'
  aggregate_id:      UUID  // learner_id + competency_id composite
  aggregate_version: Integer  // monotonic, per aggregate
  
  payload: {
    evidence_id:     UUID | null,
    computed_level:  MasteryLevel | null,
    confidence:      Float | null,
    prior_distribution: Float[] | null,
    posterior_distribution: Float[] | null,
    override_reason: String | null  // if teacher_override
  },
  
  metadata: {
    occurred_at:     Timestamp,  // when the real-world event happened
    recorded_at:     Timestamp,  // when the system recorded it
    recorded_by:     UUID,       // which service
    causation_id:    UUID,       // which upstream event triggered this
    correlation_id:  UUID        // traces back to originating request
  }

PROJECTION (current state):
  SELECT event from CompetencyEvent
  WHERE aggregate_id = $composite
  ORDER BY aggregate_version ASC
  // apply events sequentially → current state

SNAPSHOT OPTIMIZATION:
  // Full replay is expensive for long-running aggregates
  // Every 100 events, persist a snapshot:
  CompetencyStateSnapshot {
    aggregate_id: UUID,
    at_version: Integer,
    level: MasteryLevel,
    confidence: Float,
    posterior_distribution: Float[],
    snapshotted_at: Timestamp
  }
  
  // Projection: load latest snapshot + replay events after snapshot version
```

## 7.6 Data Privacy Architecture

### Privacy-by-Design

EduNexus implements privacy-by-design at the architectural level. Privacy is not an afterterought enforced by policy alone; it is enforced by data architecture.

```
PRIVACY ARCHITECTURE LAYERS:

LAYER 1: DATA CLASSIFICATION
  Tier 1 (Strictly Confidential):
    Individual competency states, risk scores, intervention records
    Access: learner (own), teacher (their classes), guardian (linked learners)
    Storage: encrypted at rest; encrypted in transit; RLS enforced
    Retention: 7 years from educational relationship end
  
  Tier 2 (Confidential):
    Assessment responses, portfolio artifacts, session transcripts
    Access: same as Tier 1
    Storage: encrypted at rest; encrypted in transit
    Retention: 5 years
  
  Tier 3 (Internal):
    School-level aggregates (without individual attribution)
    Access: school admins, authorized government (pseudonymized)
    Storage: encrypted in transit
    Retention: 10 years
  
  Tier 4 (Public):
    Curriculum content, open educational resources
    Access: public (no authentication required)
    Storage: standard; CDN-cacheable
    Retention: indefinite

LAYER 2: DATA MINIMIZATION
  Context assembly: retrieve only fields needed for the specific operation
  AI generation: learner context never includes: name, national ID, health data, 
                 family income, ethnicity, religion
  Logs: PII stripped from all log lines before persistence
  Analytics: individual records never exported; only aggregates with k-anonymity ≥ 10

LAYER 3: PURPOSE LIMITATION
  Each data access requires a declared purpose (from controlled vocabulary)
  The authorization engine validates that the access is within the declared purpose
  Government access limited to: inspection, planning, national reporting
  Research access limited to: approved research project scope

LAYER 4: CONSENT MANAGEMENT
  Learner data used for AI generation: requires consent (educator-consented under age 18)
  Parent communications: consent on first message; revocable
  Research participation: explicit opt-in; opt-out preserves educational records (not research)
  Cross-school intelligence sharing: school-to-school requires bilateral agreement

LAYER 5: DATA SUBJECT RIGHTS (Kenya Data Protection Act 2019)
  Right to access: learner can request their complete educational record (structured export)
  Right to correct: learner (or guardian) can flag incorrect records for review
  Right to erasure: implemented as anonymization (educational records cannot be
                    fully deleted due to institutional obligations, but PII is removed)
  Right to portability: export in open format (JSON, PDF summary)
  Right to object: to specific processing purposes (can opt out of research)
```

## 7.7 Caching Strategy

```
CACHING STRATEGY:

CACHE TIER DEFINITIONS:

L1 (In-Process Memory, per service instance):
  Contents: curriculum nodes accessed in last 5 minutes; hot learner states
  TTL: 5 minutes for learner state; until process restart for curriculum
  Eviction: LRU; max 256MB per service instance
  Consistency: may serve stale for up to 5 minutes (acceptable for all L1 use cases)

L2 (Redis, shared cluster):
  Contents: curriculum prerequisite chains; class aggregations; AI output results
  TTL: curriculum → invalidated by curriculum.revision.published event
       class aggregations → 15 minutes
       AI outputs → 24 hours (for same request with same context hash)
  Eviction: LRU with TTL enforcement
  Consistency: 15-minute staleness acceptable for aggregations; event-invalidated for curriculum

L3 (CDN):
  Contents: curriculum content for AI context; public educational resources
  TTL: until curriculum revision event; 30-day default for resources
  Eviction: curriculum revision event triggers CDN purge via webhook
  Consistency: eventual; may serve stale for up to 5 minutes during purge propagation

CACHE KEY DESIGN:
  All cache keys include:
    entity_type:entity_id:curriculum_version  (for curriculum-specific keys)
    entity_type:entity_id:date               (for time-sensitive keys)
  
  Cache key stability requirement:
    Keys must be stable across deployments (no code hash in key)
    Keys must be deterministic (same inputs → same key)

CACHE INVALIDATION:
  Pattern: Event-driven invalidation (preferred) + TTL expiry (safety net)
  
  curriculum.version.published event:
    → invalidate: ALL curriculum keys for that curriculum_id
    → invalidate: ALL prerequisite chain keys
    → trigger: curriculum context re-precomputation for active AI context stores
  
  competency.state.updated event for learner_id:
    → invalidate: learner_{learner_id}_* keys in L2
    → invalidate: class_{class_id}_* aggregate keys in L2
    → do NOT invalidate: L1 (TTL expiry handles L1)

CACHE-ASIDE PATTERN (for learner state):
  1. Check L1 cache → miss → check L2 cache → miss → query DB
  2. On DB hit: populate L2 (TTL: 5 min), populate L1 (TTL: 1 min)
  3. On write (new evidence): write to DB first (durability); then invalidate L1, L2
  4. Cache consistency guarantee: at most 5-minute read-your-own-writes delay
```

## 7.8 Data Warehouse and Long-Term Analytics

```
ANALYTICAL WAREHOUSE ARCHITECTURE:

INGESTION:
  Source: Kafka event stream (all educational events)
  Consumer: Kafka Connect → ClickHouse sink (or BigQuery)
  Lag: < 30 minutes from event occurrence to analytics availability
  
WAREHOUSE SCHEMA (star schema with educational dimensions):

Dimension: dim_learner (anonymized/pseudonymized)
  pseudo_id, grade_level, school_id, enrollment_cohort_year
  // No PII: no name, national_id, gender (unless aggregated)

Dimension: dim_school
  school_id, emis_code, county_id, school_type, resource_level, location_type

Dimension: dim_competency
  competency_id, code, learning_area, strand, grade_level, bloom_level, curriculum_version

Dimension: dim_date
  date_id, week_number, term, academic_year, is_school_day

Fact: fact_competency_state
  pseudo_id, competency_id, date_id, mastery_level, confidence, evidence_count

Fact: fact_assessment_result
  pseudo_id, competency_id, date_id, normalized_score, bloom_level

Fact: fact_intervention_outcome
  intervention_type, gap_type, date_id, effect_size, lag_days

MATERIALIZED VIEWS (pre-aggregated for dashboard performance):
  mv_school_weekly_risk_distribution
  mv_county_monthly_curriculum_coverage
  mv_national_competency_mastery_distribution
  mv_intervention_efficacy_by_type

QUERY ROUTING:
  Dashboard queries (< 5s requirement): hit materialized views
  Ad-hoc analysis (< 60s requirement): hit warehouse tables directly
  Research queries (< 10m): hit warehouse with query optimization
  National reporting (batch): scheduled warehouse jobs
```

---

*End of Parts VI-VII. Parts VIII-XIII and Final Chapter continue in arc-part5.md.*
# EduNexus Canonical Reference Architecture — Parts VIII-XIII & Final Chapter

---

# PART VIII: APIs AND DEVELOPER PLATFORM

## 8.0 API Philosophy

Every EduNexus API is designed on four principles:

1. **Educational intent is first-class**: API design reflects educational concepts, not database schemas. The API for a teacher's planning context returns a `TermPlan` with `competency_schedule`, not a `teacher_class_curriculum_mapping` join result.

2. **Safety by default**: APIs return only the minimum data required. Endpoints that expose sensitive learner data require explicit scope in the authentication token. There are no "return everything" endpoints.

3. **Composability**: Simple, well-scoped endpoints compose into complex workflows. The API surface area is narrow; complex intelligence is composed in the AI Orchestration Engine, not replicated across many endpoints.

4. **Predictability**: Given the same inputs, an API returns the same data. Side-effectful endpoints (those that change state) are clearly distinguished from read endpoints. All mutations are idempotent where possible.

## 8.1 REST API Architecture

```
REST API SURFACE:

BASE URL: https://api.edunexus.io/v1/

RESOURCE HIERARCHY:
  /curriculum/{curriculum_id}/competencies
  /curriculum/{curriculum_id}/competencies/{competency_id}
  /curriculum/{curriculum_id}/competencies/{competency_id}/prerequisites
  /curriculum/{curriculum_id}/competencies/{competency_id}/mastery-model
  
  /learners/{learner_id}/competency-states
  /learners/{learner_id}/competency-states/{competency_id}
  /learners/{learner_id}/gaps
  /learners/{learner_id}/risk-profile
  /learners/{learner_id}/interventions
  /learners/{learner_id}/portfolio
  /learners/{learner_id}/trajectory
  
  /teachers/{teacher_id}/classes
  /teachers/{teacher_id}/classes/{class_id}/learners
  /teachers/{teacher_id}/classes/{class_id}/term-plan
  /teachers/{teacher_id}/review-queue
  
  /schools/{school_id}/enrollment
  /schools/{school_id}/performance-summary
  /schools/{school_id}/risk-distribution
  
  /intelligence/generate/lesson-plan
  /intelligence/generate/assessment
  /intelligence/generate/practice-set
  /intelligence/generate/parent-summary
  /intelligence/analyze/competency-gap
  /intelligence/analyze/learning-sequence
  
  /events/subscribe
  /events/replay

COMMON RESPONSE ENVELOPE:
{
  "data": {},              // the requested resource or operation result
  "meta": {
    "request_id": "uuid",  // for distributed tracing
    "generated_at": "ISO8601",
    "curriculum_version": "CBC-2023",
    "data_freshness": {    // when key underlying data was last updated
      "learner_state": "2024-03-15T14:30:00Z",
      "curriculum": "2023-01-01T00:00:00Z"
    }
  },
  "ai_disclosure": {       // present if any part of response is AI-generated
    "generated_by": "EduNexus AI",
    "generation_id": "uuid",
    "model_tier": "primary",
    "confidence": 0.87,
    "reviewed_by_teacher": false,
    "review_recommended": true
  },
  "pagination": {          // present for list endpoints
    "page": 1,
    "per_page": 20,
    "total": 143,
    "next": "/learners?page=2"
  }
}

ERROR RESPONSE:
{
  "error": {
    "code": "CURRICULUM_VERSION_MISMATCH",
    "message": "Requested curriculum version CBC-2021 is deprecated. Use CBC-2023.",
    "documentation": "https://docs.edunexus.io/errors/curriculum-version-mismatch",
    "suggested_action": "Update your curriculum_id parameter to CBC-2023"
  },
  "meta": { "request_id": "uuid" }
}
```

## 8.2 Authentication and Authorization Architecture

```
AUTHENTICATION PROTOCOL:

TOKEN TYPES:

Platform Token (JWT):
  Issued by: EduNexus Identity Engine
  Validity: 1 hour (short-lived for security)
  Refresh: via refresh token (7-day validity)
  Claims: {
    sub: principal_id,
    type: principal_type,  // "teacher" | "learner" | "guardian" | "developer" | "government"
    school_id: UUID | null,
    institution_ids: UUID[],
    scope: Scope[]         // explicit list of data access scopes
  }

API Key (for developer access):
  Issued by: Developer Console
  Validity: never expires (but rotatable)
  Rate limited: by plan tier (Free: 100/day; Standard: 10K/day; Enterprise: custom)
  Claims: {
    developer_id: UUID,
    app_id: UUID,
    institution_id: UUID,  // API key is scoped to one institution
    approved_scopes: Scope[],
    data_use_agreement_signed: Boolean
  }

SCOPE VOCABULARY:
  curriculum.read         → read curriculum competencies and structure
  learner.state.read      → read own competency states (learner principal only)
  class.state.read        → read class members' competency states (teacher)
  assessment.write        → submit assessment responses
  intelligence.generate   → invoke AI generation endpoints
  portfolio.read          → read own portfolio
  portfolio.write         → upload portfolio artifacts
  parent.report.read      → read child's progress reports (guardian)
  school.analytics.read   → read school-level aggregates (school admin)
  government.analytics.read → read county/national anonymized aggregates
  research.data.read      → research-grade data access (tier-specific)
  developer.plugin.register → register and manage plugins

SCOPE VALIDATION AT EVERY REQUEST:
  API Gateway: checks token is valid and not expired
  Authorization Engine: checks token scope includes required scope for endpoint
  Data Layer: applies RLS regardless of API-level authorization
  Audit Engine: logs all access with scope used
```

## 8.3 GraphQL API

For complex queries that require deep educational graph traversal, EduNexus exposes a GraphQL API. GraphQL is appropriate for educational contexts where consumers need flexible access to interconnected educational data.

```graphql
# EduNexus GraphQL Schema (excerpt)

type Query {
  # Curriculum queries
  curriculum(id: ID!, version: String): Curriculum
  competency(id: ID!): CurriculumCompetency
  learningFrontier(learnerId: ID!, curriculumId: ID!): [CurriculumCompetency!]!
  
  # Learner intelligence queries
  learner(id: ID!): Learner
  competencyState(learnerId: ID!, competencyId: ID!): CompetencyState
  riskProfile(learnerId: ID!): RiskProfile
  
  # Class queries
  classPerformance(classId: ID!, competencyId: ID): ClassPerformance
  
  # Intelligence queries  
  learningSequence(
    learnerId: ID!,
    targetCompetencyId: ID!,
    curriculumId: ID!
  ): LearningSequence
  
  gapAnalysis(learnerId: ID!, classId: ID): GapAnalysis
}

type CurriculumCompetency {
  id: ID!
  code: String!
  title: String!
  description: String!
  bloomLevel: BloomLevel!
  gradeLevel: Int!
  
  prerequisites(depth: Int = 2): [CurriculumCompetency!]!
  forwardDependencies(depth: Int = 2): [CurriculumCompetency!]!
  coreCompetencies: [CoreCompetency!]!
  masteryModel: MasteryModel!
  
  # Requires learner_id in context (authentication + scope)
  learnerState(learnerId: ID!): CompetencyState
}

type Learner {
  id: ID!
  gradeLevel: Int!
  
  competencyStates(
    curriculumId: ID!,
    subjectFilter: [String],
    masteryFilter: [MasteryLevel]
  ): [CompetencyState!]!
  
  gaps(activeOnly: Boolean = true, severity: [GapSeverity]): [LearningGap!]!
  riskProfile: RiskProfile!
  trajectory(fromDate: Date!, toDate: Date!): TrajectoryTimeSeries!
  
  # Requires consequence level review to expose
  interventionRecommendations: [InterventionRecommendation!]!
}

# Depth limiting is enforced: max query depth = 5
# Complexity limiting is enforced: max query complexity = 100
# Rate limiting applies per principal, not per query
```

## 8.4 Streaming API

For real-time features — AI tutoring responses, live notification feeds, class activity monitoring — EduNexus provides a streaming API.

```
STREAMING ARCHITECTURE:

STREAMING PROTOCOLS SUPPORTED:
  Server-Sent Events (SSE): one-way, text streams; for AI response streaming
  WebSocket: bidirectional; for real-time tutoring sessions
  Webhook: for server-to-server event delivery; for developer integrations

AI RESPONSE STREAMING (SSE):
  Endpoint: GET /intelligence/stream?session_id={id}
  Authentication: Bearer token in query parameter (no body in GET)
  
  Event stream format:
    data: {"type": "token", "content": "The"}
    data: {"type": "token", "content": " quadratic"}
    data: {"type": "citation", "code": "CBC-G8-MAT-ALG-003"}
    data: {"type": "confidence", "score": 0.87}
    data: {"type": "complete", "generation_id": "uuid", "total_tokens": 234}
    data: [DONE]

REAL-TIME NOTIFICATION STREAM (WebSocket):
  Endpoint: wss://api.edunexus.io/v1/notifications
  Authentication: token in first WebSocket message
  
  Server sends:
    {"type": "risk_alert", "learner_id": "...", "score": 0.82, "review_required": true}
    {"type": "review_ready", "output_id": "...", "requires_action": true}
    {"type": "milestone", "learner_id": "...", "competency_code": "CBC-G8-MAT-ALG-003"}
  
  Client may send:
    {"type": "acknowledge", "notification_id": "..."}
    {"type": "dismiss", "notification_id": "...", "reason": "already_actioned"}

WEBHOOK DELIVERY (developer integrations):
  Registration: POST /webhooks with {url, events[], secret}
  Signature verification: HMAC-SHA256 of payload with registered secret
  Delivery guarantee: at-least-once (idempotency key in payload)
  Retry policy: exponential backoff: 1m, 5m, 30m, 2h, 24h, then dead-letter
  Payload format: CloudEvents v1.0 JSON
```

## 8.5 SDK Architecture

EduNexus provides officially maintained SDKs in three languages for the primary developer use cases:

```
SDK STRUCTURE (TypeScript as reference):

// edunexus/typescript SDK

// Primary client
const client = new EduNexusClient({
  apiKey: process.env.EDUNEXUS_API_KEY,
  institutionId: 'school-uuid',
  curriculum: 'CBC-2023',
  timeout: 30_000,
  retries: 3,
  onRateLimit: 'retry'  // or 'throw'
});

// Curriculum intelligence
const sequence = await client.curriculum.getLearningSequence({
  learnerId: '...',
  targetCompetencyId: 'CBC-G8-MAT-ALG-003',
  includeTimeEstimates: true
});

// Learner intelligence
const gaps = await client.learner.getGaps('learner-uuid', {
  activeOnly: true,
  minSeverity: 'HIGH',
  curriculumId: 'CBC-2023'
});

// AI generation with automatic grounding
const lessonPlan = await client.intelligence.generateLessonPlan({
  classId: '...',
  competencyIds: ['CBC-G8-MAT-ALG-003', 'CBC-G8-MAT-ALG-004'],
  durationMinutes: 40,
  teachingApproach: 'inquiry_based',
  gradeLevel: 8
});
// SDK automatically:
//   - retrieves curriculum context
//   - assembles learner state context  
//   - constructs grounded prompt
//   - validates output
//   - returns with generation_id and citations

// Streaming AI tutor session
const session = await client.tutor.createSession({
  learnerId: '...',
  competencyId: 'CBC-G8-MAT-ALG-003',
  sessionType: 'practice'
});

for await (const chunk of session.stream("I don't understand how to find x")) {
  process.stdout.write(chunk.content);
}

// Webhook handling
const webhookHandler = client.webhooks.createHandler({
  secret: process.env.EDUNEXUS_WEBHOOK_SECRET,
  handlers: {
    'intelligence.risk.threshold_crossed': async (event) => {
      await notifyTeacher(event.data.learner_id, event.data.risk_score);
    }
  }
});
```

---

# PART IX: AI COPILOTS AND MULTI-AGENT SYSTEMS

## 9.0 Copilot Architecture

Each EduNexus Copilot is a domain-specialized AI assistant that translates the Intelligence Layer's capabilities into stakeholder-appropriate interactions. Copilots are thin: they do not contain intelligence themselves; they are the interface between human stakeholders and the Intelligence Layer.

```
COPILOT ARCHITECTURE PATTERN:

Input (human message)
    ↓
Intent Classification (what is the user trying to do?)
    ↓
Entity Extraction (which learner? which competency? which class?)
    ↓
Context Assembly Request (to Intelligence Layer)
    ↓
Intelligence Retrieval (from Reasoning Engines + KG)
    ↓
Response Generation (LLM + knowledge context)
    ↓
Output Validation (curriculum alignment, safety, consequence level)
    ↓
Consequence Routing (human review if required)
    ↓
Response Delivery
```

## 9.1 Teacher Copilot

The Teacher Copilot is the most complex and consequential of the EduNexus Copilots. It serves as the primary AI interface for instructional professionals.

### Capabilities

```
TEACHER COPILOT CAPABILITY MATRIX:

PLANNING INTELLIGENCE:
  Lesson plan generation
    - Context: class competency states, term plan position, curriculum sequence
    - Output: structured lesson plan with objectives, activities, assessment
    - Consequence Level: 2 (advisory; teacher reviews before using)
  
  Term plan construction
    - Context: curriculum coverage requirements, class starting position, term weeks
    - Output: week-by-week curriculum schedule with flexibility buffers
    - Consequence Level: 3 (consequential; teacher approves plan)
  
  Assessment design
    - Context: competencies to assess, class level, blueprint requirements
    - Output: assessment instrument with items, rubrics, mark scheme
    - Consequence Level: 3 (teacher reviews and may modify before deployment)

LEARNER INTELLIGENCE:
  Competency gap briefing
    - Input: "give me a summary of where 8B is with algebra"
    - Output: class-level gap analysis with prioritized gaps
    - Context: all learners' competency states for the class
    - Consequence Level: 1 (informational aggregate)
  
  Individual learner briefing
    - Input: "what should I focus on with [student] today?"
    - Output: personalized intervention recommendations with evidence
    - Context: learner competency state, active gaps, intervention history
    - Consequence Level: 2 (advisory; teacher decides)
  
  Risk monitoring
    - Daily digest: learners crossing HIGH risk threshold
    - Context: risk profiles, contributing factors, evidence
    - Consequence Level: 3 (teacher must review each flagged learner)

INSTRUCTIONAL INTELLIGENCE:
  Differentiated activity generation
    - For multiple competency levels in one class
    - Context: class competency distribution across target competency
    - Output: tiered activity set (3-4 levels)
    - Consequence Level: 2

  Question bank generation
    - Quick practice questions during lesson
    - Context: competency, current scaffolding level in session
    - Output: 3-5 contextual practice questions
    - Consequence Level: 1

  Misconception handling
    - "My students are getting algebra sign errors repeatedly"
    - Context: common misconceptions taxonomy for this competency
    - Output: targeted misconception intervention activities
    - Consequence Level: 2

FEEDBACK INTELLIGENCE:
  Essay/portfolio feedback generation
    - Context: learner submission + rubric + competency
    - Output: structured feedback with evidence citation
    - Consequence Level: 3 (teacher reviews before giving to learner)
  
  Progress narrative for parent communication
    - Context: learner progress, gaps, milestones, recent term
    - Output: plain-language parent report in preferred language
    - Consequence Level: 3 (teacher reviews and approves)
```

### Teacher Decision Logging

Every Teacher Copilot AI output results in a teacher decision record, even if the teacher simply accepts without modification:

```
TEACHER DECISION RECORD (for AI output):
{
  "decision_id": "uuid",
  "teacher_id": "uuid",
  "decided_at": "2024-03-15T14:30:00Z",
  "ai_output_id": "uuid",
  "ai_output_type": "lesson_plan",
  
  "decision": "modified",
  "time_spent_reviewing_seconds": 127,
  
  "modification_summary": "Changed activity 2 to group work; adjusted time for activity 3",
  "rejection_reason": null,
  
  "meta": {
    "consequence_level": 2,
    "curriculum_codes": ["CBC-G8-MAT-ALG-003"],
    "prompt_template_version": "LESSON_PLAN_v3"
  }
}
```

This data is aggregated to improve prompts, understand teacher workflows, and calibrate consequence level assignments.

## 9.2 Learner Copilot

The Learner Copilot provides personalized tutoring and learning support. It is the most privacy-sensitive copilot: it has direct access to the learner's competency state and interacts directly with the learner.

### Adaptive Scaffolding Architecture

```
ADAPTIVE SCAFFOLDING SYSTEM:

Scaffolding Levels (1-5):
  Level 1: Maximum scaffolding — step-by-step worked examples, every step explained
  Level 2: High scaffolding — worked example, then guided practice with hints
  Level 3: Moderate scaffolding — conceptual explanation, practice with hints available
  Level 4: Low scaffolding — practice problems; hints on request
  Level 5: Minimal scaffolding — challenge problems; explanation on request only

Scaffolding Level Assignment:
  Initial level = function(learner_state.level, learner_state.confidence, session_history)
  
  Start at Level 3 for DEVELOPING learners
  Start at Level 2 for BEGINNING learners
  Start at Level 4 for PROFICIENT learners

Dynamic Adaptation Within Session:
  After each response:
    if learner_demonstrates_understanding and streak >= 2:
      scaffold_level = min(5, scaffold_level + 1)  // move toward independence
    
    if learner_makes_error:
      scaffold_level = max(1, scaffold_level - 1)  // return to more support
      identify_error_type → update misconception hypothesis
    
    if 3_consecutive_errors_on_same_concept:
      trigger: prerequisite_check
      // learner may need the prerequisite before this competency

Session Memory:
  Within session: full conversation history
  Long-term: session summary persisted to Learner Memory
    {date, competency, session_outcome, misconceptions_addressed, scaffolding_reached}
  Next session: prior session summary loaded into context
    "In your last session on linear equations, you showed understanding of..."
```

## 9.3 Parent Copilot

The Parent Copilot translates educational intelligence into accessible, actionable communication for guardians.

```
PARENT COPILOT DESIGN PRINCIPLES:

1. ALWAYS TRANSLATE
   Parents do not receive raw competency data. The Copilot translates:
   "CBC-G8-MAT-ALG-003: DEVELOPING, confidence 0.63" →
   "Alex is still building their skills in solving for unknown values in equations.
    They understand the basic concept but need more practice before the exam."

2. ACTION ORIENTATION
   Every report includes specific, achievable actions:
   "What you can do at home this week: Ask Alex to show you how they'd solve
    the number puzzle on page 47 of their Mathematics workbook."

3. LANGUAGE AND LITERACY CALIBRATION
   Kiswahili support for all communications
   Plain language (Flesch-Kincaid Grade 6-8 target for English parent comms)
   Positive framing (leads with progress, contextualizes gaps)
   Avoid educational jargon

4. TEACHER REVIEW GATING
   All substantive parent communications are reviewed by the teacher before delivery
   Exception: automated milestone notifications ("Alex mastered algebra this week!")
   which are Consequence Level 2 and reviewed by exception

5. COMMUNICATION FREQUENCY CALIBRATION
   Avoid notification fatigue:
   - Weekly digest (opt-in)
   - Milestone notification (always; max 3/week)
   - Risk alert (when learner crosses HIGH risk threshold; with teacher approval)
   - Response to parent-initiated queries: < 24 hours via in-app message
```

## 9.4 School Copilot

The School Copilot serves school administrators: principals, deputy principals, and Heads of Department.

```
SCHOOL COPILOT CAPABILITIES:

RISK MONITORING DASHBOARD:
  Real-time class-by-class risk distribution
  Learners who have crossed CRITICAL threshold (requires review within 24h)
  HOD escalation workflow for classes with > 20% HIGH risk learners

CURRICULUM COVERAGE MONITORING:
  For each class and subject: % of term plan completed vs. expected by this week
  Early warning: classes where curriculum is > 2 weeks behind schedule
  HOD coaching recommendation when systematic coverage lag detected

TEACHER SUPPORT INTELLIGENCE:
  For HODs: which teachers in your department have learners with systematic gaps
             in specific competency areas? (aggregated; not individual teacher rating)
  CPD recommendations: professional development resources for common gap areas
  
  IMPORTANT: The School Copilot NEVER generates performance ratings for teachers.
  It provides: resource utilization data, curriculum coverage, learner outcome aggregates.
  Performance evaluation is a human function done by qualified observers.

RESOURCE PLANNING:
  Term-end projection: which learners are projected to need additional support?
  Intervention resource estimation: how many hours of small-group support needed?
  Assessment calendar coordination: alert when multiple summative assessments coincide

GOVERNMENT REPORTING:
  Generate NEMIS-format enrollment and performance reports
  One-click county education reports (pseudonymized)
  Custom report builder (within approved data scope)
```

## 9.5 Multi-Agent Collaboration Architecture

For complex educational intelligence tasks that require reasoning across multiple domains, EduNexus implements a multi-agent architecture where specialized agents collaborate under the AI Orchestration Engine.

```
MULTI-AGENT TASK EXAMPLE: "Generate a comprehensive intervention plan for a learner"

Orchestration:
  Orchestrator receives: {learner_id, requesting_teacher_id, purpose: "intervention_plan"}

  Agent invocations (parallel where possible):
  
  [Parallel batch 1]:
    CompetencyAgent.analyze(learner_id) 
      → CompetencyReport{gaps, misconceptions, evidence_summary}
    
    RiskAgent.assess(learner_id)
      → RiskReport{score, trend, key_factors}
    
    CurriculumAgent.prerequisites(learner_id, active_gap_competencies)
      → PrerequisiteChain{root_gaps, critical_path, estimated_remediation_time}
  
  [Parallel batch 2 — depends on batch 1]:
    InterventionAgent.match(gap_analysis=CompetencyReport, school_context=SchoolProfile)
      → InterventionCandidates{top_3_interventions, efficacy_estimates}
    
    CareerAgent.impact(learner_profile, active_gaps)
      → CareerImpact{pathways_at_risk, immediate_vs_longterm_consequence}
  
  [Final synthesis — depends on all above]:
    SynthesisAgent.generate(
      competency=CompetencyReport,
      risk=RiskReport,
      prerequisites=PrerequisiteChain,
      interventions=InterventionCandidates,
      career_impact=CareerImpact
    )
    → InterventionPlan{
        executive_summary,
        prioritized_actions,
        implementation_schedule,
        success_metrics,
        review_timeline
      }

  Consequence Routing: Level 3 — enters teacher review queue
  
  Total latency target: < 8 seconds (parallel execution)
  Token budget: 12,000 tokens across all agents
  Cost: tracked per requesting teacher per operation type

AGENT FAILURE ISOLATION:
  If any agent fails: Orchestrator uses available results and notes missing data
  Synthesis agent has fallback templates for each combination of available/missing data
  Response includes: "Some intelligence components were unavailable; plan is partial"
  
  No agent failure causes a total orchestration failure.
  Partial intelligence is better than no intelligence, clearly disclosed.
```

---

# PART X: ECOSYSTEM

## 10.1 The EduNexus Ecosystem

EduNexus is designed as an ecosystem platform: the platform's value is amplified by the network of publishers, developers, researchers, universities, and government bodies that participate in and contribute to it.

### Ecosystem Participant Map

```
ECOSYSTEM PARTICIPANTS:

CONTENT PUBLISHERS:
  What they provide: curriculum-aligned educational content, assessment items, videos
  What they receive: distribution to EduNexus teachers/learners, revenue share
  Integration model: Content Publisher API + Marketplace listing
  Requirements: KICD alignment certification; quality review; royalty agreement

EDUCATION RESEARCHERS:
  What they provide: evidence-based interventions, curriculum analysis, pedagogy research
  What they receive: anonymized outcome data, research platform access, publication impact
  Integration model: Research Partner API (Tier 2-4 data access)
  Requirements: IRB approval, data use agreement, publication commitment

EDTECH DEVELOPERS:
  What they provide: specialized applications (career tools, special needs support, etc.)
  What they receive: access to curriculum intelligence, learner context (with consent)
  Integration model: Developer Platform API, Plugin Framework
  Requirements: API key, data use agreement, certification for high-access apps

UNIVERSITIES (Kenya and East African):
  What they provide: graduate employment data, admission criteria, research partnerships
  What they receive: curriculum-to-career intelligence, research data, recruitment reach
  Integration model: Career Domain API, Research Portal
  Requirements: institutional agreement, named data contacts

GOVERNMENT BODIES:
  Ministry of Education: curriculum authority, national reporting recipient
  County Education Offices: county-level reporting, school support coordination
  KICD: curriculum content authority, revision governance
  KNEC: examination data integration, results validation
  Requirements: formal MOU, named authorized officials, defined data scope

INTERNATIONAL ORGANIZATIONS:
  UNICEF, UNESCO, World Bank, IFC: research partnership, SDG reporting, funding
  Integration model: Research Portal (Tier 2), aggregate reporting API
  Requirements: data use agreement, defined use case
```

## 10.2 Plugin Framework

```
PLUGIN FRAMEWORK ARCHITECTURE:

Plugin Types:
  Content Plugin: adds educational content to the resource library
  Assessment Plugin: adds assessment item types or delivery modalities
  Integration Plugin: connects external data sources (KNEC, EMIS, SIS)
  Analytics Plugin: adds analysis capabilities to the analytics layer
  Notification Plugin: adds notification channels (WhatsApp Business, custom LMS)

Plugin Runtime:
  Sandboxed execution environment (containerized, resource-limited)
  API-mediated data access (plugins never have direct DB access)
  Resource limits: 512MB memory, 1 CPU, 30-second execution timeout per invocation
  Network: outbound only to declared endpoints; no inbound except EduNexus callbacks

Plugin API:
  Plugins interact with EduNexus only through the Plugin API:
    client.curriculum.query()    → read curriculum data
    client.learner.read()        → read learner data (scope-limited)
    client.events.subscribe()    → receive educational events
    client.output.publish()      → publish content/analysis to EduNexus
  
  Plugins CANNOT:
    - Access the database directly
    - Access other schools' data
    - Modify curriculum competency definitions
    - Override consequence level classifications
    - Bypass teacher review workflows

Plugin Certification:
  Level 1 (Low Access): curriculum and public data only; self-service; immediate
  Level 2 (Medium Access): anonymized learner aggregates; 5-day review
  Level 3 (High Access): identified learner data; 30-day review + security audit

Plugin Marketplace:
  All Level 1-2 plugins listed in public marketplace
  Level 3 plugins: private marketplace (institutional procurement)
  Revenue model: 70/30 split (developer/EduNexus) for paid plugins
  Free plugins: no revenue share; hosting provided
```

---

# PART XI: SCALING ARCHITECTURE

## 11.0 The EduNexus Scaling Roadmap

EduNexus is designed to scale along a defined growth path, from pioneer deployment through national and eventually continental scale. Each stage introduces different architectural challenges requiring specific solutions.

```
SCALING STAGES:

Stage 1: PILOT (Current — 50 pioneer teachers)
  Learners: ~2,500
  Requests/day: ~10,000
  Architecture: Single region, single Supabase instance, Neo4j single node
  Bottleneck: None (well within capacity)
  AI: Shared inference endpoint (DeepSeek API)

Stage 2: COUNTY GROWTH (Year 1 — 2,000 schools, 1 county)
  Learners: ~250,000
  Requests/day: ~5M (assessments, sessions, events)
  Architecture: Multi-AZ, read replicas for PostgreSQL, Neo4j with read replicas
  Bottleneck: AI inference throughput, Neo4j write throughput
  AI: Dedicated inference cluster with queue management
  Key changes: Redis cache cluster, Kafka for event streaming, connection pooling (PgBouncer)

Stage 3: NATIONAL (Year 2-3 — 30,000 schools, Kenya-wide)
  Learners: ~4,000,000
  Requests/day: ~100M
  Architecture: Multi-region (Nairobi, Mombasa, Kisumu), database sharding, CDN
  Bottleneck: National graph computation, real-time analytics
  AI: Multi-region inference with regional model caching
  Key changes: Graph database sharding by county, analytical warehouse (ClickHouse)

Stage 4: EAST AFRICA (Year 4-5 — Kenya + Uganda + Tanzania)
  Learners: ~15,000,000
  Requests/day: ~500M
  Architecture: Multi-country, country-specific data residency, federated graph
  Bottleneck: Cross-country curriculum alignment, data sovereignty compliance
  AI: Country-specific models (Uganda curriculum, Tanzania curriculum)
  Key changes: Federated EKG, country-level data residency, UCG alignment layer

Stage 5: CONTINENTAL (Year 6-10 — Africa-wide)
  Learners: ~200,000,000
  Architecture: Continent-scale distributed system
  Technical requirement: Custom distributed graph database engine
  Key changes: Educational CDN, peer-to-peer offline capability
```

## 11.1 Database Scaling Architecture

```
DATABASE SCALING STRATEGY (National Stage):

POSTGRESQL SHARDING:
  Shard key: school_id (all learner, teacher, class records include school_id)
  Shard count: 32 (expandable to 256)
  Shard routing: consistent hashing on school_id
  Cross-shard queries: avoided by design (most queries are school-scoped)
  Global tables: curriculum, government_ref → replicated to all shards

READ REPLICA STRATEGY:
  Primary: all writes
  Replica set 1: teacher app queries (term plans, class lists)
  Replica set 2: analytics queries (dashboard, reporting)
  Replica set 3: AI context assembly (curriculum retrieval, learner state)
  
  Replication lag: < 500ms acceptable for AI context
                   < 50ms required for real-time teacher dashboards

NEO4J GRAPH DATABASE SCALING:
  Single-instance limit: ~1B nodes, ~4B edges (Neo4j Enterprise)
  At national scale: 4M learners × ~200 competency states = ~800M edges → within limit
  
  Sharding strategy (if needed):
    Shard by school_id for learner-specific subgraphs
    Curriculum graph: replicated to all shards (small, read-heavy)
    Cross-shard queries: for national analytics only (batch mode acceptable)

KAFKA SCALING:
  Partitioning: 
    learner-events: partitioned by learner_id → 256 partitions
    curriculum-events: partitioned by curriculum_id → 8 partitions
    school-events: partitioned by school_id → 64 partitions
  
  Retention: 
    Primary: 30 days hot storage
    Archive: S3-compatible object storage, indefinite (compressed)
  
  Consumer throughput:
    At national scale: 100M events/day = ~1,150 events/second peak
    Kafka handles: easily (Kafka benchmarks at millions/second per broker)
    Consumers scale: independently (competency-state-updater can have 64 instances)
```

## 11.2 AI Inference Scaling

```
AI INFERENCE SCALING:

INFERENCE DEMAND PROFILE:
  Peak demand: 8:00-17:00 school hours, Monday-Friday
  Peak/trough ratio: ~15:1 (school hours vs. weekend nights)
  Request types:
    Interactive (< 2s): ~60% of requests (tutoring, quick questions)
    Generation (< 30s): ~30% (lesson plans, assessments, reports)
    Batch (< 10m): ~10% (risk computation, analytics narratives, cron jobs)

SCALING STRATEGY:
  Interactive tier: 
    Model: DeepSeek-V3 or equivalent (optimized for latency)
    Deployment: GPU cluster with auto-scaling (scale on queue depth)
    Instance type: A10 GPU (24GB VRAM; 2x DeepSeek-V3 in 4-bit quantization)
    Scale target: maintain P95 latency < 1.5s
  
  Generation tier:
    Model: Primary LLM (highest quality)
    Deployment: GPU cluster, 15-minute scale-up latency acceptable
    Queue: Kafka-backed with priority queue (teacher-initiated > batch)
    Scale target: P95 latency < 15s
  
  Batch tier:
    Deployment: scheduled on off-peak GPU capacity
    Queue: scheduled jobs with deadline awareness
    Scale target: all batch jobs complete within scheduled window

MODEL CACHING:
  Curriculum contexts for each subject/grade combination: pre-computed and cached
  Hot learner states: cached in GPU memory for active sessions
  Model weights: loaded once per instance; no per-request loading
  Curriculum change: invalidates all cached curriculum contexts (full recomputation)
```

## 11.3 Offline-First Architecture

```
OFFLINE ARCHITECTURE REQUIREMENTS:

Kenya-specific context:
  ~60% of rural schools have unreliable internet connectivity
  Mobile data is primary connectivity (not fixed broadband)
  Data costs are significant (150-500 KSh/GB; teachers ration data)

OFFLINE DATA BUDGET (what to sync):
  Critical (always sync):
    Class learner list with photos: ~50KB per class
    Learner competency state snapshot: ~5KB per learner
    Current week curriculum plan: ~10KB per class
    Downloaded assessment instruments: ~100KB each
    
  Standard (sync on WiFi / sufficient data):
    Learner trajectory (90 days): ~50KB per learner per subject
    AI-pre-generated lesson plans (current week): ~200KB per class
    Offline practice question sets: ~500KB per subject
    
  Large (teacher-initiated sync):
    Portfolio artifacts: user-initiated
    Video resources: user-initiated; WiFi only

OFFLINE AI CAPABILITY:
  Full AI (requires connectivity): lesson plan generation, risk analysis, parent reports
  Offline AI (pre-generated, cached): 
    - Week's worth of daily lesson plan suggestions (generated on last sync)
    - Practice question sets for each subject (generated weekly)
    - Student risk summaries (pre-computed; shown with last-synced timestamp)
  
  Offline AI disclosure:
    All offline AI outputs labeled: "Generated [date]; may not reflect latest learner progress"
    Teacher is aware of data freshness; can choose to wait for connectivity before acting
```

---

# PART XII: GOVERNANCE

## 12.1 Engineering Governance

```
ENGINEERING GOVERNANCE FRAMEWORK:

ARCHITECTURAL DECISION RECORDS (ADRs):
  Every significant architectural decision is documented as an ADR:
    Context: what situation prompted the decision
    Decision: what was decided
    Rationale: why this decision vs. alternatives
    Consequences: what this decision implies for the future
    Status: proposed | accepted | deprecated | superseded
  
  ADRs are stored in docs/architecture/decisions/
  Every ADR links to this Canonical Reference Architecture

CHANGE MANAGEMENT:
  Non-breaking API changes: 2-week notice in developer changelog
  Breaking API changes: 3-month notice; deprecation timeline published
  Database schema changes: coordinated deployment with migration scripts
  Prompt template changes: ERB approval; staged rollout (not immediate)
  
DEPENDENCY MANAGEMENT:
  No direct Supabase-js imports in API routes (use service client factory)
  No AI model SDK calls outside lib/ai/ (use AI Orchestration Engine)
  No hardcoded costs, limits, or model names (use lib/payments/config.ts or lib/config/)
  No select('*') queries (column-explicit queries only)

CODE QUALITY GATES:
  TypeScript: strict mode; no 'any' types; explicit return types on all lib/ functions
  Testing: all lib/ functions have unit tests; all API routes have integration tests
  Security: OWASP Top 10 scan on every deployment
  Performance: AI response times tracked; p95 alert if > 150% of target
```

## 12.2 Security Governance

```
SECURITY GOVERNANCE:

THREAT MODEL (Educational Platform-Specific):
  
  T1: UNAUTHORIZED LEARNER DATA ACCESS
    Attacker: malicious teacher, parent, admin, external attacker
    Target: learner competency states, assessment responses, risk scores
    Controls: RLS, ABAC authorization, audit logging, anomaly detection
    Detection: access pattern monitoring, after-hours access alerts
  
  T2: AI PROMPT INJECTION
    Attacker: sophisticated learner attempting to manipulate AI outputs
    Target: AI tutoring sessions, parent communications
    Controls: input sanitization, context separation, safety layer
    Detection: safety event monitoring, teacher feedback collection
  
  T3: CURRICULUM DATA MANIPULATION
    Attacker: insider or compromised admin account
    Target: curriculum competency definitions, mastery models
    Controls: two-person approval for curriculum changes, audit trail
    Detection: curriculum change alerts to curriculum team
  
  T4: AI OUTPUT POISONING (via training data)
    Attacker: malicious content submission to influence future model behavior
    Controls: model isolation from user-submitted training; separate fine-tuning pipeline
    Detection: ongoing evaluation against standardized test sets
  
  T5: GOVERNMENT DATA MISUSE
    Attacker: government official exceeding authorized data scope
    Controls: k-anonymity enforcement, purpose limitation, access logging
    Detection: audit log review, data science anomaly detection on access patterns

INCIDENT RESPONSE:
  Level 1 (data exposure of individual learner record):
    Notify: affected family within 24 hours; Data Commissioner within 72 hours
    Remediate: revoke credential, patch vulnerability, audit for spread
  
  Level 2 (data exposure of class/school):
    Notify: affected institution, County Education Office, Data Commissioner immediately
    Remediate: full security investigation, system isolation if necessary
  
  Level 3 (national-scale breach):
    Notify: Ministry of Education, Data Commissioner, Cabinet Secretary
    Remediate: crisis response team; system shutdown if necessary; full forensic audit
```

## 12.3 Privacy Governance

```
KENYA DATA PROTECTION ACT 2019 COMPLIANCE:

Data Controller: EduNexus Kenya Limited
Data Protection Officer: Named DPO with direct board access

DATA PROCESSING LAWFUL BASES:
  Educational data collection: legitimate interest (educational mission) + contractual
  AI-assisted analysis: informed consent (captured at enrollment)
  Parent communications: consent (explicit opt-in)
  Government reporting: legal obligation (Education Act Cap. 211)
  Research: consent (learner/guardian for individual-level; anonymized = no consent needed)

ANNUAL COMPLIANCE CALENDAR:
  January: Annual Privacy Impact Assessment update
  March: Data use audit (what data was accessed, by whom, for what purpose)
  June: Data subject rights audit (were all access/correction/erasure requests handled?)
  September: Third-party processor audit (do all processors have current DPAs?)
  December: Board privacy report; DPO review
```

---

# PART XIII: FUTURE COMPUTING

## 13.1 Educational Digital Twins

The first wave of educational digital twins treats the learner model as a static snapshot. The next generation treats it as a dynamic simulation: a computational model of a specific learner that can be queried, reasoned about, and used to simulate educational interventions before they are applied.

```
EDUCATIONAL DIGITAL TWIN ARCHITECTURE (Phase 2):

LearnerDigitalTwin {
  // The persistent model
  competency_graph: CompetencyStateGraph,        // current knowledge state
  misconception_graph: MisconceptionGraph,        // identified misconceptions
  learning_style_model: LearningStyleProbDist,   // probabilistic style preferences
  engagement_model: EngagementTimeSeries,         // attention and motivation patterns
  
  // Simulation API
  simulate_intervention(intervention: Intervention, duration_weeks: Integer): SimulationResult
  project_trajectory(horizon_weeks: Integer, with_interventions: Intervention[]): Trajectory
  compare_pathways(pathways: CareerPathway[]): PathwayAlignmentProjection
  
  // Model accuracy
  calibration_score: Float,              // how well past simulations matched reality
  n_learner_days: Integer,               // how much data this model is based on
  confidence_overall: Float              // 0.0-1.0 overall model confidence
}

USE CASE: INTERVENTION SIMULATION
  Teacher asks: "If I spend 3 weeks on prerequisite reinforcement for linear equations,
                will the class be ready for Grade 9 algebraic reasoning?"
  
  System: for each learner in class:
    twin.simulate_intervention(
      prerequisite_reinforcement,
      duration_weeks=3,
      starting_from=current_state
    )
  
  Returns: {
    class_projected_readiness: MasteryDistribution,
    learners_expected_ready: Float,
    learners_still_at_risk: Float,
    estimated_cost_teacher_hours: Float,
    alternative_simulations: [{
      intervention: focused_small_group,
      projected_readiness: ...,
      estimated_cost: ...
    }]
  }
```

## 13.2 Learning Operating System

As EduNexus matures, its relationship to educational software shifts from "a product schools use" to "the operating system on which educational software runs."

```
LEARNING OPERATING SYSTEM ARCHITECTURE:

KERNEL (EduNexus Core):
  Process Management: AI orchestration — manages concurrent AI agents
  Memory Management: Educational Knowledge Graph — persistent knowledge
  File System: Evidence Store — all educational artifacts
  Networking: Event Bus — all inter-component communication
  Identity: Principal Management — authentication and authorization

SYSTEM CALLS (Platform APIs):
  curriculum.getCompetency(competency_id)      → retrieve curriculum fact
  learner.getState(learner_id, competency_id)  → retrieve learner state
  intelligence.reason(query, context)          → invoke reasoning engine
  evidence.record(evidence)                    → persist educational evidence
  notification.send(principal_id, message)     → deliver notification
  event.emit(event)                            → publish educational event

APPLICATIONS (Layer 6):
  Teacher App: runs on Learning OS; uses curriculum.* and learner.* system calls
  Learner App: runs on Learning OS; uses learner.* and intelligence.* system calls
  Parent App: runs on Learning OS; uses guardian-scoped learner.* system calls
  
  Third-party apps: same APIs; same security model; same educational correctness guarantees

DRIVER MODEL:
  Curriculum Drivers: KICD CBC driver, 8-4-4 driver, Cambridge IGCSE driver
  Identity Drivers: NEMIS driver, Google Workspace driver, Microsoft Entra driver
  Assessment Drivers: KNEC driver, local assessment driver
  Analytics Drivers: EMIS reporting driver, county dashboard driver
```

## 13.3 National Educational Knowledge Graph

At national scale, the EduNexus Knowledge Graph becomes the National Educational Knowledge Graph (NEKG): a national infrastructure resource comparable to the road network or the electrical grid.

```
NATIONAL EKG VISION:

The NEKG is:
  NOT a government surveillance system (individual data is never in the NEKG)
  NOT a school ranking system (no competitive performance data published)
  A public infrastructure for educational intelligence, governed as a public good

NEKG DATA (anonymized, aggregated):
  National curriculum implementation graph
  Population-level competency patterns (how many learners master competency X in term Y?)
  Intervention efficacy data (what works, for whom, in what context?)
  Curriculum-to-career connections (validated by employment outcomes)
  Universal Concept Graph (national curriculum mapped to international standards)

NEKG GOVERNANCE:
  Multi-stakeholder board: Ministry of Education, KICD, university consortium, teacher unions
  Data sovereignty: data stays in Kenya; NEKG is hosted on Kenya-based infrastructure
  Open access: NEKG research portal open to approved Kenyan researchers
  International alignment: NEKG maps to UNESCO's Global Education Framework

NEKG ENABLES:
  Any AI tutor: grounded in the authoritative national curriculum
  Any assessment: validated against national competency framework
  Any career counseling tool: connected to validated Kenya labour market data
  Any educational research: access to longitudinal population-level outcomes
```

## 13.4 Educational Foundation Models

The current EduNexus architecture uses general-purpose foundation models (DeepSeek, GPT-4, etc.) grounded in educational knowledge through context injection. The future will require educational foundation models: models trained on educational knowledge from the start.

```
EDUCATIONAL FOUNDATION MODEL ROADMAP:

Phase 1 (Current): General models + educational knowledge injection
  Architecture: Large general LLM + EKG context retrieval at inference time
  Quality: Good for generation; limited educational reasoning without context

Phase 2 (Near-term): Educational fine-tuning
  Architecture: Fine-tune general model on educational interaction data
  Training data: Teacher-validated curriculum explanations, socratic dialogues,
                 high-quality assessment feedback, misconception remediation examples
  Improvement: Better pedagogical style, lower hallucination on curriculum content

Phase 3 (Medium-term): Educational pre-training
  Architecture: Pre-train model on educational corpus + graph-structured curriculum data
  Training data: All open educational resources, research papers, curriculum documents
                 from 50+ countries in the Universal Concept Graph format
  Improvement: Educational reasoning as a native capability, not injected context

Phase 4 (Long-term): Curriculum-native models
  Architecture: Model architecture that natively represents the curriculum graph
  Research question: How do you embed graph structure into model weights?
  Potential: Model that can reason about prerequisite dependencies without context injection

EDUNEXUS ROLE:
  EduNexus does not need to build these models from scratch.
  EduNexus's role: curate high-quality educational fine-tuning data (from teacher decisions,
  validated AI outputs, intervention outcomes); participate in open educational AI research;
  evaluate and adopt models that demonstrate educational correctness advantages.
```

---

# FINAL CHAPTER: THE ARCHITECTURE BEYOND EDUNEXUS

## The New Computing Paradigm

This document has described, in technical depth, how EduNexus is built: its domains, engines, data architecture, intelligence systems, APIs, and governance. But the final question this document must address is not technical. It is civilizational.

**Is Educational Intelligence Infrastructure a new computing paradigm?**

We argue: yes. And understanding why matters for every architectural decision EduNexus will make in the next decade.

### What Makes a Computing Paradigm?

A new computing paradigm is not merely a new application. It is a new way of computing that: enables things that were previously impossible; creates a platform effect (others build on top); becomes infrastructure (the medium rather than the message); and proves to be irreversible (once societies adopt it, they organize around it).

Consider the precedents:

**Relational Databases** (1970s-1980s): Enabled reliable, queryable, consistent storage of structured data. Made it possible to build applications that would have required custom file formats before. Became infrastructure: today, relational databases are invisible plumbing under every organization. Irreversible: no organization returns to flat files.

**Operating Systems** (1960s-1970s): Enabled multiple applications to share hardware resources through a clean abstraction. Created a platform effect: developers built for the OS, not the hardware. Became infrastructure: OS is invisible; applications are the product. Irreversible: societies do not return to single-purpose hardware.

**The Web** (1990s): Enabled global hyperlinked information sharing through a simple open protocol. Created a platform effect: everyone built websites. Became infrastructure: the web is now the default distribution layer for information. Irreversible: we do not return to information-by-courier.

**Cloud Computing** (2000s-2010s): Enabled on-demand, scalable computing without hardware ownership. Created a platform effect: startups and enterprises build on cloud. Became infrastructure: most computing is cloud computing. Irreversible: organizations do not rebuild their own data centers.

**Artificial Intelligence / Machine Learning** (2010s-2020s): Enabled systems to perform tasks that previously required human cognition. Creating a platform effect: AI is being embedded in all software. Becoming infrastructure: AI is increasingly invisible plumbing. Irreversible trajectory: we will not remove intelligence from software.

### Educational Intelligence Infrastructure: The Sixth Paradigm

Each paradigm above solved a category of computing problem. Educational Intelligence Infrastructure solves the problem of **making educational knowledge machine-usable**.

Before Educational Intelligence Infrastructure: educational knowledge — what learners know, what the curriculum requires, what interventions work, what competencies lead to which careers — existed only as: paper records, human expertise, standardized examinations, and scattered research findings. This knowledge was local, non-queryable, non-composable, and not available to software systems.

Educational Intelligence Infrastructure makes educational knowledge: structured (in the EKG), queryable (through the Platform API), composable (through the Engines), continuously updated (through the Event Bus), and available as a platform (through the Developer Platform).

This is a state change in what is computable. Before: a learner's risk of failing Grade 9 could only be estimated by a teacher who knew the learner for three years. After: it is computable from structured evidence in 200ms. Before: an intervention's efficacy could only be guessed from teacher experience. After: it is measured from thousands of outcome records and matched to learner profiles.

### The Platform Effect

EduNexus as a platform already exhibits the network effect: the more teachers use it, the more teacher decision data improves prompts. The more learners use it, the more intervention outcome data calibrates the intervention engine. The more schools use it, the more curriculum effectiveness data validates the curriculum graph.

The Developer Platform extends this to an ecosystem: every curriculum-aligned app built on EduNexus adds content to the resource library; every integration plugin adds data to the analytical warehouse; every research partner adds evidence to the intervention efficacy database.

No single school, district, or even country can build this platform alone. The data needed for accurate educational intelligence is inherently distributed across millions of learners, thousands of schools, and decades of educational history. Infrastructure is the only model that can aggregate it at the scale needed for accuracy.

### The Irreversibility Argument

If EduNexus's vision is realized — if a complete, accurate, continuously updated Educational Knowledge Graph exists at national and eventually global scale — what school would choose to abandon it?

A school that has used the platform for five years has: its complete learner history in structured form; evidence-calibrated intervention efficacy data for its specific population; curriculum coverage analytics for eight school terms; risk prediction models calibrated to its school's context.

Leaving means returning to paper records, teacher intuition, and scattered spreadsheets. The information loss is too great. The transition cost is too high. And the students who need intervention most are the ones who would suffer from the degradation.

This is infrastructure lock-in — not lock-in by vendor dependency or data hostage-taking, but by the simple accumulation of irreplaceable institutional knowledge. EduNexus must therefore be designed as infrastructure that earns this trust by being open, standards-based, and exportable — so that the lock-in comes from value created, not data withheld.

### The Obligation

If EduNexus becomes the infrastructure for educational intelligence — if its curriculum graphs, learner models, and intervention efficacy databases become the foundation on which educational decisions are made — then EduNexus bears an obligation that no mere software product bears.

The obligation is this: **the infrastructure must be correct**.

A database is more dangerous when it is confidently wrong than when it is admittedly uncertain. An AI that generates fluent but educationally incorrect curriculum content at scale is more harmful than a teacher who gives incorrect explanations to thirty students — because the AI operates at millions of students simultaneously.

This is why educational correctness is Principle 2.1 of this architecture, not a footnote. This is why the Educational Review Board exists. This is why every AI output has a consequence level classification and a human review workflow. This is why calibration is a first-class engineering metric.

The architecture beyond EduNexus is the architecture of a world in which the educational intelligence layer is as reliable, as available, and as trusted as the internet itself. A world in which every learner, in every school, in every country, has access to educational intelligence that was previously available only to learners in the world's most well-resourced schools.

That is the architecture we are building.

That is why every architectural decision in this document is load-bearing.

---

## Appendix A: Canonical Object Quick Reference

| Domain | Object | Primary Key | Key Relationships |
|--------|--------|-------------|-------------------|
| Curriculum | CurriculumCompetency | UUID | REQUIRES_PREREQUISITE, DEVELOPS CoreCompetency |
| Competency | CompetencyState | UUID | ON learner, FOR competency, SUPPORTED_BY evidence |
| Assessment | AssessmentResponse | UUID | BY learner, ON item, MAPS_TO competency |
| Learning | LearningSession | UUID | BY learner, FOCUSES_ON competency |
| Teacher | TermPlan | UUID | BY teacher, FOR class, COVERING competencies |
| School | SchoolPerformanceSummary | school_id + term | AGGREGATES class performance |
| Intelligence | RiskProfile | UUID | FOR learner, COMPOSED_OF risk factors |
| Intelligence | InterventionRecord | UUID | TARGETS gap, BY teacher, FOR learner |

## Appendix B: Engine Input/Output Contract Reference

| Engine | Primary Input | Primary Output | Target Latency |
|--------|--------------|----------------|----------------|
| Curriculum | CompetencyID + LearnerState | LearningSequence | < 200ms |
| Assessment | Blueprint + LearnerState | AssessmentItems | < 500ms |
| Risk | LearnerID | RiskProfile | < 500ms |
| Intervention | GapAnalysis + SchoolContext | InterventionRanking | < 1s |
| KnowledgeGraph | GraphQuery | QueryResult | < 100ms (Class A) |
| AIOrchestration | OrchestrationRequest | AIOutput | < 15s (complex) |
| Analytics | AggregationQuery | AggregationResult | < 5s (materialized) |
| OfflineSync | DeltaRequest | DeltaResponse | < 5s |

## Appendix C: Event Catalogue Reference

| Domain | Event | Trigger | Downstream Effect |
|--------|-------|---------|-------------------|
| Curriculum | competency.updated | KICD revision | Invalidate curriculum cache, trigger competency state revalidation |
| Assessment | response.scored | Assessment completion | Trigger CompetencyStateUpdate |
| Competency | state.updated | Evidence arrival | Trigger RiskProfileUpdate, GapDetectionCheck |
| Intelligence | risk.threshold_crossed | Risk score change | Trigger teacher notification |
| Learning | gap.detected | CompetencyStateUpdate | Trigger InterventionReview |
| School | term.started | Calendar event | Initialize term plans, reset assessment schedules |

## Appendix D: Security Control Reference

| Threat | Control Layer | Mechanism |
|--------|--------------|-----------|
| Unauthorized data access | Authorization | ABAC policy engine + RLS |
| Prompt injection | Input safety | Injection pattern detection |
| AI output manipulation | Output validation | Citation verification + grounding check |
| Curriculum tampering | Change control | Two-person approval + immutable history |
| Government data overreach | Data architecture | k-anonymity + purpose limitation |
| Insider threat | Audit | Append-only, signed audit log |

## Appendix E: Compliance Reference

| Requirement | Source | EduNexus Implementation |
|-------------|--------|------------------------|
| Individual data protection | Kenya Data Protection Act 2019 | Privacy-by-design, data subject rights |
| Educational record retention | Kenya Education Regulations | 7-year retention minimum |
| AI transparency | ERB Policy | AI disclosure on all AI-generated outputs |
| Curriculum alignment | KICD mandate | Canonical curriculum graph; citation required |
| Assessment validity | KNEC standards | Psychometric properties tracked; IRT calibration |
| Interoperability | Government ICT Policy | Open standards (Ed-Fi, IMS, xAPI, OpenID) |

---

*EduNexus Canonical Reference Architecture v1.0*
*The supreme technical authority of the EduNexus platform.*
*All engineering decisions shall be explainable by reference to this document.*
*All deviations from this document shall be documented as Architecture Decision Records.*

---

*End of Document.*
# EduNexus Canonical Reference Architecture — Expansion

---

# PART IV EXPANSION: ADDITIONAL DOMAIN DETAIL

## 4.12 The Domain Interaction Model

Understanding how domains interact is as important as understanding what each domain does. EduNexus domains do not call each other directly. They interact through two mechanisms: **events** (asynchronous, one-to-many) and **APIs** (synchronous, one-to-one, with explicit authorization).

```
DOMAIN INTERACTION RULES:

Rule 1: NO DIRECT DATABASE ACCESS ACROSS DOMAIN BOUNDARIES
  The Curriculum Domain does NOT access the Teacher Domain's database tables.
  The Competency Domain does NOT access the Assessment Domain's database tables.
  Cross-domain data access always goes through the domain's service API.

Rule 2: STATE CHANGES EMIT EVENTS
  When the Assessment Domain records a new assessment response, it emits:
    assessment.response.scored { response_id, learner_id, competency_mapping }
  
  The Competency Domain subscribes to this event and triggers:
    CompetencyStateUpdate(learner_id, evidence_from_response)
  
  The Assessment Domain does NOT call the Competency Domain directly.
  The Competency Domain does NOT poll the Assessment Domain.

Rule 3: SYNCHRONOUS QUERIES USE DOMAIN APIs
  The AI Orchestration Engine needs curriculum context before generating.
  It calls: GET /curriculum/{id}/competencies/{competency_id}
  It does NOT query the curriculum database tables directly.

Rule 4: DOMAIN OWNS ITS CANONICAL OBJECTS
  Only the Curriculum Domain writes CurriculumCompetency records.
  Only the Competency Domain writes CompetencyState records.
  Only the Assessment Domain writes AssessmentResponse records.
  Other domains read via API or receive via events; they never write directly.

Rule 5: AGGREGATE QUERIES CROSS DOMAIN BOUNDARIES THROUGH THE ANALYTICS LAYER
  "Show me the risk distribution for my school sorted by competency gap coverage"
  This query spans: Competency Domain (risk), Assessment Domain (evidence), 
                    Curriculum Domain (coverage), School Domain (enrollment)
  
  It is NOT answered by one domain calling three others.
  It is answered by the Analytics Engine, which reads from the pre-aggregated warehouse.
```

### Cross-Domain Event Choreography: Full Example

The following traces the complete system response to a single assessment submission — showing how domain events flow through the system:

```
DOMAIN CHOREOGRAPHY: Assessment Submission

T=0ms: Learner submits assessment response
  AssessmentDeliveryService validates: learner in class, assessment event is open
  AssessmentResponse record created in Assessment Domain
  
T=5ms: assessment.response.submitted event emitted
  Subscribers: ScoringService (Assessment Domain)
  
T=150ms: ScoringService scores the response
  MCQ → immediate automated scoring
  Short answer → AI scoring via AI Orchestration Engine
  
T=800ms (MCQ path): assessment.response.scored event emitted
  { response_id, learner_id, item_id, raw_score, competency_mapping: [{competency_id, performance}] }
  
  Subscribers:
    - CompetencyStateUpdater (Competency Domain)
    - AnalyticsEventConsumer (Analytics)
    - TeacherNotificationFilter (Teacher Domain)

T=850ms: CompetencyStateUpdater receives assessment.response.scored
  Retrieves: current CompetencyState for learner × competency
  Runs: Bayesian update with new evidence
  
  If level unchanged: update confidence only → emit competency.confidence.updated
  If level changed upward: emit learning.milestone.achieved
  If level changed downward: emit learning.gap.detected (rare; usually means reassessment)

T=900ms: learning.milestone.achieved OR learning.gap.detected emitted
  
  If MILESTONE:
    Subscribers:
      - RiskEngine (Competency Domain): trigger RiskProfileUpdate
      - ParentCopilot (Experience Layer): queue parent milestone notification
      - LearnerCopilot (Experience Layer): personalize next session start message
  
  If GAP:
    Subscribers:
      - RiskEngine: trigger RiskProfileUpdate (gap → may increase risk score)
      - InterventionEngine: check if intervention already planned; if not, generate recommendation
      - TeacherNotificationFilter: assess whether gap warrants immediate teacher notification

T=1200ms: RiskEngine.update(learner_id) completes
  New risk score computed from updated competency state
  
  If risk crosses threshold (e.g., from MEDIUM to HIGH):
    intelligence.risk.threshold_crossed emitted
    Subscriber: TeacherNotificationService
    → Teacher notification queued: "Learner [name] has crossed HIGH risk threshold"
    → Added to teacher's daily review digest

T=1500ms: InterventionEngine completes (if gap detected)
  Intervention candidates ranked
  Top recommendation prepared for teacher review
  Consequence Level 3 → enters teacher review queue
  
  intelligence.recommendation.generated emitted
  Subscriber: TeacherNotificationService
  → Teacher review queue count updated in teacher app header badge

T=2000ms: All downstream processing complete
  Total event chain latency: < 2 seconds from assessment submission to:
    - Updated competency state
    - Updated risk profile
    - Teacher notified (if threshold crossed)
    - Intervention recommendation prepared (if gap detected)
    - Parent milestone notification queued (if milestone achieved)
    - Analytics warehouse updated (within 30 minutes, via Kafka lag)
```

This choreography represents EduNexus's real-time educational intelligence: a single assessment submission triggers a complete update of everything the system knows about that learner, propagated to all stakeholders within two seconds.

## 4.13 The Curriculum Domain in Detail: CBC Structure

The Kenya Competency-Based Curriculum (CBC) has a specific hierarchical structure that the Curriculum Domain must faithfully represent. Understanding this structure is prerequisite to understanding how the Curriculum Graph is organized.

```
CBC CURRICULUM HIERARCHY:

Level 1: CURRICULUM
  Kenya CBC (Junior Secondary, Grade 7-9)
  Kenya CBC (Senior Secondary, Grade 10-12)
  Kenya 8-4-4 (Form 3-4)
  Cambridge IGCSE (for international schools)

Level 2: LEARNING AREA
  Example: Mathematics
  Junior Secondary has 7 core learning areas + 3 optional

Level 3: STRAND
  Example (Mathematics): Numbers and Algebra
  Typically 3-6 strands per learning area

Level 4: SUB-STRAND
  Example: Algebraic Thinking
  Typically 2-5 sub-strands per strand

Level 5: COMPETENCY UNIT
  Example: Linear Equations and Inequalities
  Clusters related learning objectives

Level 6: LEARNING OBJECTIVE
  Example: Solve simple linear equations in one variable
  Specific, measurable learning targets

Level 7: CURRICULUM COMPETENCY (the assessable unit)
  Example: "The learner can solve linear equations with integer coefficients using
             inverse operations and verify the solution by substitution"
  This is the node in the EKG that competency states reference.

CROSS-CUTTING STRUCTURES (not hierarchical, but graphically connected):

Core Competencies (7 in CBC):
  Communication and Collaboration
  Critical Thinking and Problem Solving
  Creativity and Imagination
  Citizenship
  Digital Literacy
  Learning to Learn
  Self-Efficacy

Each CurriculumCompetency node has DEVELOPS edges to one or more CoreCompetency nodes.

Pertinent and Contemporary Issues (PCIs):
  Environmental Education
  Peace and Values Education
  Comprehensive Sexuality Education
  Financial Literacy
  HIV/AIDS Education
  Safety and Security
  Disaster Risk Reduction
  Learner Support Services

PCIs cross-cut the curriculum — they appear across learning areas and grades.
A single CurriculumCompetency can ADDRESSES multiple PCIs.
```

### CBC Grade 8 Mathematics — Curriculum Graph Excerpt

```
Grade 8 Mathematics Curriculum Graph (partial):

:LearningArea { code: "CBC-G8-MAT", name: "Mathematics" }

:Strand { code: "CBC-G8-MAT-NUM", name: "Numbers" }
:Strand { code: "CBC-G8-MAT-ALG", name: "Algebra" }
:Strand { code: "CBC-G8-MAT-GEO", name: "Geometry" }
:Strand { code: "CBC-G8-MAT-STA", name: "Statistics and Probability" }
:Strand { code: "CBC-G8-MAT-MEA", name: "Measurements" }

:SubStrand { code: "CBC-G8-MAT-ALG-EXP", name: "Algebraic Expressions" }
:SubStrand { code: "CBC-G8-MAT-ALG-LIN", name: "Linear Equations and Inequalities" }
:SubStrand { code: "CBC-G8-MAT-ALG-SEQ", name: "Sequences and Patterns" }

:CompetencyUnit { code: "CBC-G8-MAT-ALG-LIN-001", name: "Linear Equations" }

:CurriculumCompetency {
  code: "CBC-G8-MAT-ALG-LIN-001-C01",
  title: "Forming linear equations",
  description: "Form and solve simple linear equations from word problems",
  bloom_level: "Apply",
  expected_mastery_term: 1,
  expected_mastery_week: 6
}

:CurriculumCompetency {
  code: "CBC-G8-MAT-ALG-LIN-001-C02",
  title: "Solving linear equations — one variable",
  description: "Solve linear equations in one variable using inverse operations",
  bloom_level: "Apply",
  expected_mastery_term: 1,
  expected_mastery_week: 8
}

:CurriculumCompetency {
  code: "CBC-G8-MAT-ALG-LIN-001-C03",
  title: "Solving simultaneous linear equations",
  description: "Solve pairs of simultaneous linear equations using substitution and elimination",
  bloom_level: "Analyse",
  expected_mastery_term: 2,
  expected_mastery_week: 4
}

// Prerequisite relationships
(CBC-G8-MAT-ALG-LIN-001-C02)-[:REQUIRES_PREREQUISITE {strength: 0.9}]->(CBC-G8-MAT-ALG-LIN-001-C01)
(CBC-G8-MAT-ALG-LIN-001-C03)-[:REQUIRES_PREREQUISITE {strength: 0.95}]->(CBC-G8-MAT-ALG-LIN-001-C02)

// Cross-strand prerequisites
(CBC-G8-MAT-ALG-LIN-001-C01)-[:REQUIRES_PREREQUISITE {strength: 0.7}]->(CBC-G7-MAT-NUM-INT-003)
// Grade 8 algebra requires Grade 7 integer operations

// Core competency development
(CBC-G8-MAT-ALG-LIN-001-C03)-[:DEVELOPS {contribution: 0.6}]->(:CoreCompetency { code: "CC-CTPS" })
// Simultaneous equations develops Critical Thinking and Problem Solving
```

---

# PART V EXPANSION: ENGINE ALGORITHMS IN DEPTH

## 5.10 Recommendation Engine

The Recommendation Engine provides personalized suggestions across multiple dimensions: learning resources, next topics to study, practice activities, career-relevant competencies, and professional development for teachers.

### Recommendation Architecture

```
RECOMMENDATION ENGINE ARCHITECTURE:

RECOMMENDATION TYPES:
  RESOURCE: suggest a specific learning resource for a learner or class
  TOPIC: suggest the next competency for a learner to work on
  ACTIVITY: suggest a specific practice activity or project
  CAREER: suggest career pathways aligned with learner competency profile
  PD: suggest professional development for teacher (based on class gap patterns)

RETRIEVAL COMPONENT (for all recommendation types):
  Embedding index: all resources, activities, and content indexed by curriculum alignment
  Graph index: EKG traversal for prerequisite-appropriate content

RANKING COMPONENT:
  Collaborative filtering: "learners like this learner found resources like X effective"
  Content-based: curriculum alignment score × bloom level match × difficulty match
  Contextual: school resource level, connectivity level, time available
  Diversity: avoid recommending the same resource type repeatedly

RECOMMENDATION PIPELINE:
  Input: {learner_id, context, recommendation_type, count}

  1. PROFILE RETRIEVAL
     learner_profile = {competency_states, active_gaps, learning_preferences, history}
  
  2. CANDIDATE GENERATION (two-stage)
     Stage 1 (fast, broad): embedding similarity retrieval; top 50 candidates
     Stage 2 (quality filter): apply curriculum alignment, difficulty, context filters; top 20

  3. RANKING
     For each candidate:
       alignment_score = semantic_similarity(candidate.description, learner_gap.description)
       history_score = 1.0 - recent_exposure(candidate, learner_id)  // avoid repeats
       effectiveness_score = efficacy_records[candidate.type][learner_profile_bucket]
       diversity_score = diversity_bonus(candidate, already_recommended)
       
       final_score = 0.4*alignment + 0.2*history + 0.3*effectiveness + 0.1*diversity
  
  4. EXPLANATION GENERATION
     For top 3 candidates:
       explanation = "Recommended because: this activity targets [specific gap] 
                      at [appropriate bloom level] and has shown effectiveness for
                      learners with similar profiles ([N] learners, [X]% improvement rate)"
  
  5. FALLBACK (if insufficient data for collaborative filtering)
     Use content-based ranking only
     Set: evidence_strength = "limited" (disclose to teacher)
```

## 5.11 Portfolio Engine

The Portfolio Engine manages the collection, organization, analysis, and certification of learner portfolio evidence. Portfolio assessment is a central feature of CBC's competency-based approach: learners demonstrate competency through accumulated evidence, not only through terminal examinations.

### Portfolio Evidence Architecture

```
PORTFOLIO ENGINE OPERATIONS:

EVIDENCE COLLECTION:
  Sources:
    - Submitted work artifacts (essays, projects, presentations, recordings)
    - Assessment results (formal scores)
    - Teacher observation notes
    - Self-assessment records
    - Peer assessment records
    - AI-facilitated formative checks
  
  Authenticity Chain:
    Every artifact carries:
      submission_device_id: which device was used
      submission_timestamp: when it was submitted
      digital_signature: cryptographic signature for tamper detection
      ai_assistance_declared: did the learner declare AI assistance?
      ai_assistance_detected: system-detected AI assistance level (0.0-1.0)

EVIDENCE ANALYSIS:
  For each submitted artifact:
  
  Step 1: CONTENT ANALYSIS
    Extract: key concepts, skills demonstrated, vocabulary used
    Classify: bloom level demonstrated (using rubric + AI classification)
    Map: to curriculum competencies (by content similarity + rubric alignment)
  
  Step 2: AUTHENTICITY VALIDATION
    AI assistance detection:
      Perplexity analysis: unusual fluency may indicate AI drafting
      Stylometric consistency: does this artifact match learner's established writing style?
      Fact accuracy: are factual claims consistent with what the learner has studied?
    
    Result: ai_assistance_level (0.0-1.0)
    If ai_assistance_level > 0.7:
      Flag for teacher review
      Do NOT automatically disqualify (AI assistance is not banned; it is disclosed)
      Teacher decides: valid evidence | partial credit | not valid as independent work
  
  Step 3: EVIDENCE WEIGHTING
    Weight = quality_weight × recency_weight × authenticity_weight × diversity_weight
    
    quality_weight:
      teacher_validated_artifact = 1.0
      peer_assessed_artifact = 0.7
      self_assessed_artifact = 0.4
      ai_assessed_artifact_unvalidated = 0.5
    
    authenticity_weight:
      ai_assistance_level == 0: weight = 1.0
      ai_assistance_level 0-0.3: weight = 0.9
      ai_assistance_level 0.3-0.7: weight = 0.7
      ai_assistance_level > 0.7: weight = 0.3 (or as determined by teacher)
    
    diversity_weight: bonus for evidence of different types (process + product + reflection)

PORTFOLIO SUMMARY GENERATION:
  For each competency with ≥ 2 evidence items:
    Narrative = AI_generate(
      "Summarize the evidence for competency [code] from this portfolio.
       Reference only the provided evidence items by artifact ID.
       Assess: breadth (multiple contexts demonstrated), depth (bloom level),
               growth (improvement over time), authenticity."
      
      grounded_context = {evidence_items, competency_description, mastery_model}
    )
  
  Teacher reviews narrative before inclusion in official portfolio report.
  Level 3 consequence: teacher must approve before it becomes official record.
```

## 5.12 Scheduling Engine

The Scheduling Engine manages the temporal coordination of educational activities: timetabling, assessment scheduling, intervention scheduling, and staff scheduling.

```
SCHEDULING ENGINE:

TIMETABLE OPTIMIZATION:
  Input: {
    classes: AcademicClass[],
    teachers: Teacher[],
    subjects: Subject[],
    rooms: Room[],
    constraints: TimetableConstraint[]
  }
  
  Constraints (hard — must be satisfied):
    - A teacher cannot be in two classes simultaneously
    - A class cannot have two subjects simultaneously
    - Required periods per week per subject (per curriculum requirement)
    - Room capacity must accommodate class enrollment
  
  Preferences (soft — optimized):
    - Mathematics and Sciences before noon (cognitive demand scheduling)
    - No more than 3 consecutive periods without a break
    - Laboratory subjects in rooms with equipment
    - Minimize teacher movement between buildings
  
  Algorithm: Constraint satisfaction (backtracking with arc consistency)
              + Local search optimization (simulated annealing for soft constraints)
  
  Kenya-specific: Timetable respects Kenya school day: 8:00-17:30, 40-minute periods
                  Assembly periods: Monday 8:00-8:40 (whole school)
                  Games: Friday 14:00-17:00 (junior secondary)

ASSESSMENT CALENDAR COORDINATION:
  Input: {class_id, term_plan, assessment_requirements}
  
  Constraints:
    - Maximum 2 summative assessments per learner per week
    - CAT (Continuous Assessment Test) minimum spacing: 3 weeks apart
    - No summative assessment in week 1 of term (settling in)
    - No summative assessment in final week of term (marking closure)
  
  Optimization:
    - Distribute assessment load evenly across the term
    - Align assessment sequence with curriculum coverage schedule
    - Coordinate with whole-school assessment events (mid-term, end-of-term)
```

---

# PART VI EXPANSION: INTELLIGENCE ARCHITECTURE DEPTH

## 6.6 The Learner Memory Architecture

EduNexus maintains three types of learner memory, each serving a different intelligence purpose:

```
LEARNER MEMORY ARCHITECTURE:

TYPE 1: WORKING MEMORY (current session)
  Scope: the active learning session
  Storage: Redis (in-memory, ephemeral)
  Contents:
    - Full conversation history (all turns in this session)
    - Session scaffolding level (current and history within session)
    - Misconceptions identified in this session
    - Concepts covered in this session
    - Learner affect signals (confusion indicators, engagement level)
  
  TTL: session end + 24 hours (for reconnection after brief interruption)
  Cleared: when session is formally closed or 24 hours after last activity

TYPE 2: EPISODIC MEMORY (session summaries)
  Scope: history of learning sessions
  Storage: PostgreSQL (structured) + Learner Graph (EKG node)
  Contents (per session):
    - Date and competency focus
    - Session outcome: demonstrated understanding? scaffolding level reached?
    - Misconceptions addressed and resolution status
    - Teacher notes (if teacher added notes from session review)
    - Session-type: tutoring | practice | assessment_prep
  
  Retention: full history; bi-temporal
  Used for: context assembly for next session; trajectory analysis; teacher review

TYPE 3: SEMANTIC MEMORY (the knowledge model)
  Scope: what the learner knows (the competency graph)
  Storage: Neo4j EKG
  Contents:
    - CompetencyState nodes for every assessed competency
    - Evidence edges (linking to specific assessment events)
    - Misconception nodes with resolution status
    - Gap nodes with causal analysis
    - Trajectory snapshots
  
  Retention: full history; bi-temporal
  Used for: all intelligence computation; risk scoring; intervention matching; AI context

MEMORY RETRIEVAL FOR AI GENERATION:
  For a tutoring session on competency C:
  
  From Working Memory:
    → Last 5 session turns (verbatim) OR session summary if session > 10 turns
  
  From Episodic Memory:
    → Last 3 sessions on competency C (summary form)
    → Last session outcome: "In your last session, you had difficulty with sign conventions"
    → Any unresolved misconceptions from prior sessions on C
  
  From Semantic Memory:
    → Current CompetencyState on C and its prerequisites
    → Active gaps and their root causes
    → Evidence quality summary (how strong is the current assessment?)
  
  Combined into: Learner Context Module (in prompt)
  Total token budget: ≤ 2,000 tokens for learner memory
    (curriculum context typically uses 1,500-3,000 tokens; total budget ≤ 6,000)
```

## 6.7 Evaluation Framework

Every AI system in EduNexus is evaluated on a multi-dimensional scorecard before deployment. The evaluation framework is operationalized as automated tests run on every prompt template change and model change.

```
EDUCATIONAL AI EVALUATION FRAMEWORK:

DIMENSION 1: EDUCATIONAL CORRECTNESS
  Test: Generate explanations for N=100 curriculum competencies
  Graders: Expert curriculum validators (human)
  Metrics:
    - Curriculum accuracy: are all factual claims about the curriculum correct?
    - Bloom level appropriateness: does the explanation match the required cognitive level?
    - Prerequisite awareness: does the explanation appropriately scaffold prerequisites?
  Threshold: > 95% accuracy on all curriculum factual claims
  
DIMENSION 2: CURRICULUM ALIGNMENT
  Test: Submit 200 assessments; extract AI's curriculum alignment claims
  Graders: Automated (citation verification against EKG) + expert sample
  Metrics:
    - Citation accuracy: % of cited competency codes that exist in EKG
    - Alignment accuracy: % of claims that are valid for the cited competency
  Threshold: > 99% citation accuracy; > 92% alignment accuracy

DIMENSION 3: LEARNER APPROPRIATENESS
  Test: Generate explanations for learners at N=5 competency levels
  Graders: Developmental education experts
  Metrics:
    - Language accessibility: reading level appropriate to grade level
    - Cognitive load: explanation matches learner's current mastery level
    - Scaffolding validity: support level matches declared scaffolding tier
  Threshold: > 90% appropriate rating per level

DIMENSION 4: TEACHER ACCEPTANCE
  Measurement: Production data — teacher modification and rejection rates
  Metrics:
    - Acceptance rate: % of AI outputs used without modification
    - Modification rate: % modified (accepted with changes)
    - Rejection rate: % rejected (should be < 5%)
    - Time to review: median time teacher spends reviewing (proxy for quality — 
                       high quality requires less review time)
  Threshold: rejection rate < 5%; acceptance + modification rate > 95%

DIMENSION 5: SAFETY
  Test: Red team evaluation (adversarial prompts, boundary testing)
  Graders: AI safety engineers + education experts
  Metrics:
    - Safety layer bypass rate: % of adversarial attempts that reached delivery
    - PII leakage rate: % of outputs containing learner PII
    - Harmful content rate: % of outputs flagged by content filter
    - Assessment integrity violation rate: % of outputs that provided direct assessment answers
  Threshold: 0% for PII leakage; < 0.01% for harmful content; 0% for assessment integrity violations

DIMENSION 6: FAIRNESS
  Test: Same prompt with synthetic learner profiles varying by: gender, county, school type
  Graders: Automated + expert sample
  Metrics:
    - Response quality parity: Flesch-Kincaid score, response length, citation count
    - Recommendation diversity: does system recommend resources equitably across profiles?
    - Language quality parity: English vs. Kiswahili response quality comparison
  Threshold: < 0.05 normalized difference across demographic groups for quality metrics

DIMENSION 7: CALIBRATION
  Measurement: Production data — confidence scores vs. actual accuracy
  Metrics:
    - Expected Calibration Error (ECE): should be < 0.05
    - Overconfidence rate: % of high-confidence (> 0.8) outputs that were wrong
  Threshold: ECE < 0.05; overconfidence rate < 3%

EVALUATION CADENCE:
  On every prompt template change: run automated Dimensions 1, 2, 3, 5, 6, 7
  On every model change: full evaluation including human graders
  Weekly: Dimension 4 and 7 (production data monitoring)
  Monthly: ERB review of full evaluation scorecard
  Before national scale-out: all 7 dimensions at scale (with N=1000+ per category)
```

---

# PART VIII EXPANSION: API DEPTH

## 8.6 Government and National Integration APIs

EduNexus maintains dedicated integration interfaces for national systems that are distinct from the standard developer API in three ways: they are synchronous with national data pipelines, they operate on pseudonymized aggregate data, and they have formal governance agreements rather than self-service API keys.

```
GOVERNMENT INTEGRATION API:

NEMIS (National Education Management Information System) INTEGRATION:
  Direction: bidirectional
  EduNexus → NEMIS: enrollment numbers, completion rates, attendance summary (school-aggregate)
  NEMIS → EduNexus: school registration data, enrollment updates, teacher registration
  
  Protocol: REST webhook (NEMIS pushes enrollment updates; EduNexus pulls school reference data)
  Authentication: OAuth 2.0 client credentials (institutional, not personal)
  Data format: NEMIS XML schema (wrapped in JSON envelope for API compatibility)
  Frequency: nightly batch for aggregate reports; real-time webhook for enrollment events

KICD (Kenya Institute of Curriculum Development) INTEGRATION:
  Direction: bidirectional
  KICD → EduNexus: curriculum document updates, new curriculum versions, revision notices
  EduNexus → KICD: curriculum implementation data (anonymized aggregate)
                    "Here is how Grade 8 Mathematics competency X is being implemented 
                     across 10,000 classes — here are the common gaps and misconceptions"
  
  Protocol: Curriculum Version API (REST) — KICD has write access to curriculum domain
  Authentication: KICD administrative credentials + two-person approval
  Review process: All KICD curriculum changes must pass through curriculum versioning workflow

KNEC (Kenya National Examinations Council) INTEGRATION:
  Direction: KNEC → EduNexus (one-way; EduNexus does NOT push to KNEC)
  KNEC → EduNexus: KCSE and KCPE results (by school, pseudonymized at individual level)
  
  Protocol: Secure file transfer (SFTP) → EduNexus batch ingestion job
  Data format: KNEC standard CSV → mapped to EduNexus Assessment schema
  Frequency: annual (post-examination results release)
  
  Privacy note: Individual KNEC results are stored pseudonymized.
                EduNexus knows: school_id + grade_level + subject + score_bucket
                EduNexus does NOT know: individual_learner_name + individual_KCSE_score
                This is sufficient for curriculum effectiveness analysis.

COUNTY EDUCATION OFFICES (47 counties):
  Report API: GET /government/county/{county_id}/report?type={TYPE}&term={N}&year={Y}
  
  Types:
    enrollment_summary: total learners enrolled by grade and gender (aggregated)
    curriculum_coverage: % term plan completion by subject (school median, not individual)
    risk_summary: % of learners in each risk tier (county aggregate)
    intervention_activity: % of schools actively using intervention features
  
  Authentication: Named county official credential + named data access agreement
  Privacy: k-anonymity enforced (no county with < 10 schools reported individually)
```

## 8.7 Research API

```
RESEARCH API ARCHITECTURE:

TIER 2 RESEARCH ACCESS (Standard Research):
  Endpoint: https://research.edunexus.io/api/v1/
  Authentication: Research Token (issued after IRB approval verification)
  
  Available datasets:
    GET /cohorts          → available anonymized cohort definitions
    GET /cohorts/{id}/outcomes → aggregate outcome metrics for approved cohort
    
    POST /analysis/correlation
      body: {variable_1, variable_2, cohort_id, time_period}
      returns: Pearson correlation with confidence interval (minimum n=100 per cell)
    
    GET /interventions/efficacy
      params: {intervention_type, gap_type, grade_level}
      returns: effect size distribution (mean, SD, n, confidence interval)
    
    GET /curriculum/implementation
      params: {competency_id, grade_level, term, year}
      returns: distribution of mastery levels at competency-term combination

TIER 3 RESEARCH ACCESS (Longitudinal Research):
  Mechanism: Federated query — researcher submits query; EduNexus executes; result returned
  No raw data leaves the platform.
  
  Query language: EduNexus Research Query Language (ERQL) — a SQL-like language
    with privacy primitives:
    
    SELECT 
      cohort_year,
      grade_level,
      COUNT(*) as n,  // minimum 50; query fails if cell < 50
      AVG(term_2_mathematics_score) as avg_math,
      PERCENTILE(term_2_mathematics_score, 25) as p25,
      PERCENTILE(term_2_mathematics_score, 75) as p75
    FROM learner_trajectories
    WHERE cohort_year IN (2022, 2023)
      AND county_id = 'nairobi'
    GROUP BY cohort_year, grade_level
    HAVING COUNT(*) >= 50;  // enforced at engine level
    -- k-anonymity: all cells < 50 replaced with NULL
    -- Differential privacy: Gaussian noise added to all aggregate values
```

---

# PART IX EXPANSION: AI COPILOT DEPTH

## 9.6 Copilot Conversation Design Principles

```
CONVERSATION DESIGN: TEACHER COPILOT

OPENING CONTEXT (session start):
  Every Teacher Copilot session begins by silently loading:
    - Today's date + school term week
    - Teacher's classes this term
    - Any pending review queue items (count)
    - Any HIGH or CRITICAL risk learners flagged since last login
    - This week's curriculum plan position
  
  These are loaded but NOT narrated unless the teacher initiates a planning question.
  The Copilot does not lecture the teacher with information they didn't ask for.

INTENT-LED RESPONSES:
  Teacher: "Help me plan tomorrow's lesson"
  Copilot:
    → Retrieve: current term week, curriculum plan position, class competency state
    → Generate: lesson plan GROUNDED in actual class position
    → NOT: a generic lesson plan for the topic
    
  Teacher: "How are the kids doing with algebra?"
  Copilot:
    → Retrieve: class competency states for algebra strand
    → Analyze: distribution across mastery levels; top 3 gaps
    → Generate: brief, actionable summary
    → NOT: a verbose report full of statistics
    Format: "8B is doing well overall. [N] learners (37%) have mastered linear equations;
             [M] (45%) are developing. The main gap is sign convention errors in equation
             solving — [K] learners (31%) are showing this pattern. Want me to suggest
             a quick activity to address it?"

PROACTIVE INTELLIGENCE (when appropriate):
  The Copilot proactively surfaces CRITICAL information:
    - Risk threshold crossings (since last login)
    - Assessment review queue items > 48 hours old
    - Curriculum coverage gap (if teacher is > 1 week behind plan)
  
  The Copilot does NOT surface:
    - Medium or Low risk updates (unless teacher asks)
    - Detailed analytics unless teacher initiates
    - School-level data (Copilot serves one teacher's context)
  
  Proactive opening (when items exist):
    "Good morning! You have 2 learners who need attention:
     [Name] has crossed HIGH risk in mathematics — want to see the details?
     Also, [Name]'s assessment from Tuesday is still in your review queue."
  
  NOT:
    "Good morning! I've analyzed all 32 learners in your class and found
     numerous patterns and insights. Here is a comprehensive summary..."
    (This overwhelms and loses the teacher's trust immediately)

UNCERTAINTY HANDLING:
  When evidence is thin:
    "I don't have enough recent assessment data on [learner] to give you
     a confident picture of their algebra understanding. The last evidence
     is from 3 weeks ago. Would it help to do a quick diagnostic this week?"
  
  When curriculum question is ambiguous:
    "Are you asking about Grade 8 CBC linear equations (Term 1) or
     the Grade 9 version that includes systems? Just want to make sure
     I'm pulling the right curriculum context."

DECLINED REQUESTS:
  Teacher: "Which of my students is the least capable?"
  Copilot:
    "I'm not able to give you a ranking of students by capability — that's not
     how I think about learner intelligence. I can tell you which learners
     have the most gaps relative to where they should be this term, or which
     learners are at highest risk of not meeting term targets.
     Want to see that?"
  
  (EduNexus does not produce capability rankings. Competency progress is not capability.)
```

## 9.7 Learner Copilot Conversation Design

```
LEARNER COPILOT DESIGN PRINCIPLES:

ADAPTIVE COMMUNICATION:
  The Learner Copilot adapts its language to:
    Grade level (primary vs. secondary vocabulary)
    Demonstrated comprehension in the current session
    Language preference (English or Kiswahili)
    Cultural context (Kenyan examples, names, contexts throughout)
  
  Grade 7 example (simpler):
    "OK, so we need to find what number makes both sides of the equation balance.
     Think of it like a seesaw — if you have 2x + 3 = 11, and you want to keep
     the seesaw balanced while you find x, what do we do first?"
  
  Grade 10 example (more technical):
    "For this system of simultaneous equations, let's use elimination. 
     Multiply equation (1) by 3 to make the coefficient of y match equation (2).
     Then subtract equation (2) from 3×(equation 1) to eliminate y."

SOCRATIC APPROACH:
  The Learner Copilot rarely gives direct answers.
  
  Wrong approach:
    Learner: "What is the answer to 2x + 3 = 11?"
    Copilot: "x = 4"
    
  Correct approach:
    Learner: "What is the answer to 2x + 3 = 11?"
    Copilot: "Let's work through it. What's the first step when we want to get x by itself?"
    [if learner is stuck:]
    "Hint: We need to 'undo' the +3 first. What's the opposite of adding 3?"
    [if learner answers correctly:]
    "Exactly! So if we subtract 3 from both sides... what do we get?"
  
  Exception: When learner explicitly asks for verification of their answer after working
             through the problem, the Copilot confirms or gently corrects.

MOTIVATION AND AFFECT:
  The Copilot tracks and responds to learner engagement signals:
    - Response latency: long delays may indicate confusion or frustration
    - Error rate: multiple consecutive errors → scaffold down, encourage
    - Brief responses: may indicate disengagement → change activity type
  
  Encouragement style:
    NOT: "Great job! Amazing! You're so smart!" (empty praise)
    YES: "You got that right. Notice you used the correct approach this time —
          you didn't forget to subtract from both sides."
          (specific, process-praising, accurate)
  
  After struggle and success:
    "That was a hard one, but you got it. Let's do one more similar to make sure
     you've got the method solid."

REFUSING INAPPROPRIATE REQUESTS:
  Learner: "Just write my homework essay for me"
  Copilot:
    "I can't write your essay for you — that wouldn't help you learn, and it
     would be academic dishonesty. But I can absolutely help you:
     - Plan your argument structure
     - Give feedback on paragraphs you've written
     - Help you find the right vocabulary for your ideas
     - Explain the key concepts you need to include
     Where would you like to start?"
  
  Learner: "What are all the answers to tomorrow's test?"
  Copilot:
    "I can't share assessment answers — that would be cheating, and it would
     also mean you don't actually learn the material.
     But let's make sure you're genuinely ready for the test. What topic
     are you most worried about? We can practice that right now."
```

---

# PART XI EXPANSION: SCALING DEEP DIVES

## 11.4 Multi-Region Architecture

```
MULTI-REGION ARCHITECTURE (National Stage):

PRIMARY REGIONS (Kenya):
  Nairobi (primary): Central business, government, API gateway
  Mombasa (secondary): Coast region, Eastern Africa gateway
  Kisumu (tertiary): Nyanza/Western region

DATA RESIDENCY:
  All Kenya learner data: must remain in Nairobi or other Kenya-based data centers
  Government report data: Nairobi primary only
  AI inference: can use any region (compute, not storage)
  Curriculum content (non-PII): CDN-cacheable globally

REQUEST ROUTING:
  API requests → Route to nearest region (Anycast DNS)
  Write requests → Primary region (Nairobi) always
  Read requests → Nearest region with consistent read (async replication lag: < 1s)
  AI inference requests → Nearest region with capacity; fail over to any region

FAILOVER ARCHITECTURE:
  RTO (Recovery Time Objective): < 5 minutes for all services
  RPO (Recovery Point Objective): < 30 seconds for learner state; 0 for assessment submissions
  
  Strategy:
    Active-active: API serving (all regions serve traffic)
    Active-passive: Database writes (Nairobi primary; promote Mombasa replica on primary failure)
    Active-active: AI inference (all regions can serve inference requests)
    Active-passive: Event stream (primary Kafka cluster in Nairobi; mirror in Mombasa)

REGIONAL ISOLATION:
  Each school's data is bound to a primary region (based on county location)
  A school's primary region handles all writes for that school
  Reads can be served from any region (via replication)
  In regional failure: the school's writes fail until primary region recovers
                       (or manual failover is initiated by operations team)
```

## 11.5 Performance SLOs

```
SERVICE LEVEL OBJECTIVES:

INTERACTIVE PATHS (teacher/learner-facing, real-time):
  API Response Time:
    P50 (median): < 200ms
    P95: < 500ms
    P99: < 1,000ms
  
  AI Tutoring Response:
    P50: < 1,500ms (time-to-first-token)
    P95: < 3,000ms
    Full response: < 15s for complex generation
  
  Dashboard Load:
    P50: < 800ms
    P95: < 2,000ms (requires < 5s for materialized views)

BATCH PATHS (analytics, background intelligence):
  Nightly risk profile recomputation: all profiles updated within 2 hours
  Term-plan generation: < 30 seconds per class
  Curriculum coverage analysis: < 5 seconds per class
  Parent digest generation: < 60 seconds per learner

INFRASTRUCTURE AVAILABILITY:
  API availability: 99.9% per month (< 44 minutes downtime)
  AI availability: 99.5% per month (< 3.6 hours downtime; AI has higher failure modes)
  Data availability: 99.99% per month (< 4 minutes downtime; data must not be lost)

SLO MONITORING:
  Prometheus + Grafana: real-time SLO tracking dashboards
  Alerting: PagerDuty alert when SLO burn rate exceeds 5x (risk of missing monthly SLO)
  Incident review: every SLO breach has a written post-mortem within 5 days
```

---

# PART XII EXPANSION: GOVERNANCE IN DEPTH

## 12.4 Architecture Decision Record Examples

### ADR-001: Graph Database Selection

```
ARCHITECTURE DECISION RECORD 001

Title: Graph Database Selection for Educational Knowledge Graph

Status: Accepted

Date: 2024-01-15

Context:
  The EduNexus Educational Knowledge Graph requires a database that supports:
    - Property graphs with typed nodes and edges
    - Multi-hop traversal (up to 8 hops for prerequisite chains)
    - Temporal properties on both nodes and edges
    - Confidence weights on edges
    - Bi-temporal queries
    - ACID transactions for state changes
    - Horizontal read scaling
  
  Options evaluated:
    a) Neo4j Enterprise
    b) Amazon Neptune (managed)
    c) ArangoDB (multi-model)
    d) TigerGraph (distributed native graph)
    e) PostgreSQL + recursive CTEs (relational approximation)

Decision:
  Neo4j Enterprise for the initial deployment (Pilot through County stages).
  Evaluate TigerGraph for National stage if Neo4j single-instance limits are approached.

Rationale:
  Neo4j: strongest educational knowledge graph tooling; best Cypher query language;
         enterprise support; large community; proven at 1B+ node scale
  
  Amazon Neptune: rejected because Kenya data residency requirements preclude AWS
                  as the primary storage layer (Kenya does not have an AWS region)
  
  ArangoDB: rejected because multi-model adds complexity without graph-specific gains
  
  TigerGraph: strong at national scale but immature tooling and smaller community;
               revisit at National stage when scale requires it
  
  PostgreSQL CTEs: rejected because prerequisite chain traversal at 8+ hops with
                   temporal properties is impractical in relational form;
                   would require recursive CTEs with 8 joins — unacceptable latency

Consequences:
  - All curriculum graph queries use Cypher (Neo4j query language)
  - Graph query abstraction layer required (so queries can be ported to TigerGraph later)
  - Neo4j Enterprise license required (significant cost at National scale)
  - Neo4j Causal Cluster for HA (3 nodes minimum for write HA)
  
Links:
  - EduNexus Canonical Architecture Section 7.4
  - Scale analysis: docs/scale/graph-database-scale-analysis.md
  - Neo4j benchmark: docs/benchmarks/neo4j-prerequisite-chain-benchmark.md
```

### ADR-002: Event Streaming Platform

```
ARCHITECTURE DECISION RECORD 002

Title: Event Streaming Platform Selection

Status: Accepted

Date: 2024-01-20

Context:
  EduNexus requires event streaming for:
    - Assessment events (triggers competency state update)
    - Competency state events (triggers risk recomputation)
    - Risk threshold events (triggers teacher notification)
    - AI generation events (triggers audit logging)
  
  Requirements:
    - At-least-once delivery for state-mutating events
    - Event ordering within entity (learner_id partition)
    - 30-day event retention
    - Consumer group support (multiple independent consumers per topic)
    - Replay capability (replay from any offset)
    - High throughput (projected 1M events/day at County stage)

Decision:
  Apache Kafka (self-managed on Kubernetes).
  CloudEvents v1.0 as event envelope format.

Rationale:
  Kafka selected over:
    - AWS Kinesis: data residency concerns (no Kenya region)
    - Google Pub/Sub: same data residency concern
    - RabbitMQ: lacks event replay and long retention; designed for queues not streams
    - Redis Streams: lacks consumer groups at scale; durability concerns at County scale
  
  CloudEvents provides: standard event envelope; schema registry compatible;
                        interoperability with external systems (NEMIS, KICD webhooks)

Consequences:
  - Kafka operations expertise required (or managed Kafka service when available in Kenya)
  - CloudEvents wrapper around all events (slight overhead vs. raw JSON)
  - Consumer groups must be carefully designed to avoid processing loops
  - Schema registry required to prevent event schema drift

Links:
  - EduNexus Canonical Architecture Section 3.2, 5.9
  - Event catalogue: docs/architecture/event-catalogue.md
```

## 12.5 Curriculum Governance Process

```
CURRICULUM GOVERNANCE PROCESS:

The Curriculum Domain is special: it represents the authoritative national curriculum
specification. Changes to curriculum data have downstream effects on:
  - All learner competency state computations
  - All AI generation (curriculum context changes)
  - All assessment alignment
  - All intervention recommendations
  - Historical records (bi-temporal; prior records remain valid)

CURRICULUM CHANGE CATEGORIES:

Category 1 (Minor): Typo corrections, description clarifications (same competency)
  Process: Single KICD curriculum author submits; second KICD author approves
  Effect: Takes effect within 24 hours; cache cleared; no learner state recomputation
  Backward compatibility: always compatible

Category 2 (Structural): New competency added; competency deprecated; new prerequisite added
  Process: KICD curriculum committee review (minimum 3 members); ERB notification;
           30-day notice period for schools; migration guide prepared
  Effect: New curriculum version published with effective_from date
  Backward compatibility: learner records from prior version remain valid
  Migration: CompetencyVersionMigrationService maps prior-version states to new version

Category 3 (Major): Grade level changes; competency removal; major sequence restructuring
  Process: Full KICD revision process (public consultation); Ministry of Education approval;
           12-month notice period; full migration plan required
  Effect: New major curriculum version; schools migrate on published schedule
  Backward compatibility: bi-temporal records allow queries against old version
  Migration: National-scale recomputation of all affected competency states

CURRICULUM VERSION COMPATIBILITY:
  EduNexus simultaneously supports multiple curriculum versions:
    - Current: CBC-2023 (all new activity)
    - Legacy: CBC-2021, 8-4-4-2019 (read-only; no new learner states)
  
  Rationale: Students who started Grade 7 under CBC-2021 cannot be retroactively
             migrated to CBC-2023 mid-education. Their records remain on the curriculum
             they were enrolled under.
  
  Cross-version analysis: UCG alignment makes it possible to compare learners
  across curriculum versions by mapping both to the Universal Concept Graph.
```

---

# APPENDIX F: COMPLETE SYSTEM HEALTH INDICATORS

The following metrics constitute the EduNexus System Health Dashboard. When all indicators are green, the system is operating within specification.

```
EDUNEXUS SYSTEM HEALTH INDICATORS:

EDUCATIONAL QUALITY:
  ✓ AI Curriculum Citation Accuracy > 99%
  ✓ Risk Score ECE (Expected Calibration Error) < 0.05
  ✓ Teacher Acceptance Rate > 90% (acceptance + modification)
  ✓ Teacher Rejection Rate < 5%
  ✓ Level 5 Consequence Events: 0 delivered without human review
  ✓ ERB Approval Status: no unapproved Level 4-5 systems in production

SYSTEM PERFORMANCE:
  ✓ API P95 Latency < 500ms
  ✓ AI Tutoring Time-to-First-Token P95 < 3s
  ✓ Risk Profile Recomputation: all profiles < 24 hours stale
  ✓ Event Processing Lag: competency state update < 2s from assessment.scored event
  ✓ API Availability > 99.9% (rolling 30 days)

DATA INTEGRITY:
  ✓ Curriculum Version: all AI generation using current version
  ✓ Evidence Freshness: < 5% of active learners without assessment in 14 days
  ✓ Audit Coverage: 100% of AI operations have complete audit records
  ✓ Bi-temporal Consistency: no temporal gaps in any competency state history

SECURITY:
  ✓ No unauthorized access events (audit log scan)
  ✓ PII in logs: 0 incidents (automated scan)
  ✓ Certificate expiry: all TLS certificates > 30 days from expiry
  ✓ Dependency CVEs: no unpatched Critical CVEs

ECOSYSTEM:
  ✓ Developer API Uptime > 99.9%
  ✓ Webhook Delivery Rate > 99%
  ✓ Plugin Sandbox Escapes: 0

GOVERNANCE:
  ✓ ERB: meeting minutes published within 7 days of each meeting
  ✓ Privacy Impact Assessments: current (< 12 months old) for all Tier 1 features
  ✓ Data Subject Rights: all requests handled within 30 days
  ✓ Government Integration: NEMIS sync < 24 hours behind
```

---

*End of Expansion — append to docs/edunexus-canonical-architecture.md*
# EduNexus Canonical Reference Architecture — Expansion 2

---

# PART V EXPANSION 2: REPORTING AND CERTIFICATION ENGINES

## 5.13 Reporting Engine

The Reporting Engine generates formal educational reports for schools, parents, and government. Reports are distinct from dashboards: they are formal documents with defined audiences, defined formats, and defined governance requirements.

### Report Categories

```
REPORT TAXONOMY:

LEARNER-FACING REPORTS:
  Learner Progress Report (formative):
    Frequency: every 3 weeks
    Audience: learner, parent/guardian
    Format: one-page summary, plain language
    Content: competency progress, milestones achieved, focus areas
    AI role: generation + parent-language translation
    Consequence level: 3 (teacher reviews before release)
  
  Term Report:
    Frequency: end of each term (3 per year)
    Audience: parent/guardian, school records
    Format: official school report format
    Content: per-subject competency summary, attendance (if available),
             holistic development (core competencies), teacher comments
    AI role: draft generation + translation
    Consequence level: 4 (qualified teacher review + school administration approval)
  
  Portfolio Progress Report:
    Frequency: mid-term + end of year
    Audience: learner, parent, school, future institutions
    Format: structured portfolio summary
    Content: competency evidence summary, project highlights, growth narrative
    AI role: evidence synthesis + narrative generation
    Consequence level: 3 (teacher reviews; learner reviews own portfolio)

INSTITUTIONAL REPORTS:
  School Term Summary:
    Frequency: end of term
    Audience: school principal, Board of Governors, parent community
    Format: school report format
    Content: enrollment trends, curriculum coverage, risk distribution, 
             intervention activity, milestone achievement rates
    AI role: analysis + narrative generation (aggregated, no individual data)
    Consequence level: 2 (principal reviews; advisory only)
  
  HOD Subject Report:
    Frequency: monthly
    Audience: Head of Department, subject teachers
    Format: structured analytics report
    Content: subject-level coverage, common gaps, high-performing learner data,
             assessment quality metrics, resource utilization
    AI role: analysis + recommendations
    Consequence level: 2 (HOD reviews; advisory)

GOVERNMENT REPORTS:
  NEMIS Enrollment Report:
    Frequency: start of each term + on request
    Audience: Ministry of Education, County Education Office
    Format: NEMIS XML/JSON standard format
    Content: enrollment counts by grade, gender, school category
    AI role: none (structured data extraction only)
    Privacy: school-aggregate only; no individual learner data
  
  County Education Report:
    Frequency: quarterly
    Audience: County Director of Education, County Governor's office
    Format: county report template (PDF + structured data)
    Content: enrollment trends, learning outcome aggregates, equity indicators,
             resource distribution, risk population estimates
    AI role: narrative generation from anonymized aggregates
    Privacy: k-anonymity ≥ 10 enforced on all cells

RESEARCH REPORTS:
  Curriculum Effectiveness Brief:
    Frequency: annual
    Audience: KICD, researchers, Ministry
    Format: research brief format
    Content: which competencies are commonly mastered, which are commonly struggled,
             which interventions show strongest efficacy in Kenya context
    AI role: draft generation from warehouse analysis
    Privacy: fully anonymized; no school-identifiable data
```

### Report Generation Pipeline

```
REPORT GENERATION PIPELINE:

Input: {report_type, entity_id, period, format, language}

Phase 1: DATA ASSEMBLY (30-60s for complex reports)
  1.1 Retrieve all required data from relevant domains:
      For Term Report: learner competency states (all subjects), evidence summary,
                       attendance (if available), portfolio summary, prior term comparison
  
  1.2 Validate data completeness:
      Are there sufficient assessments to make claims? (minimum 3 per competency per term)
      Is the evidence recent enough? (no assessment more than 6 weeks old ideally)
      If data gaps: flag them; mark affected sections as "Insufficient data this term"
  
  1.3 Apply privacy rules:
      Learner-facing: include full detail (within scope of consent)
      Parent-facing: include full detail on their child(ren) only
      Government-facing: apply k-anonymity and differential privacy
      Research-facing: anonymize and aggregate per research tier

Phase 2: ANALYSIS (15-30s)
  2.1 Progress analysis: compare current to prior period and to curriculum expectations
  2.2 Narrative framing: identify 3 highlights, 2 focus areas, 1 key recommendation
  2.3 Equity check: ensure language and framing is equitable, non-stigmatizing
  2.4 Trend identification: improving / stable / declining per subject

Phase 3: GENERATION (15-30s)
  3.1 Draft main narrative in English (teacher comment style for term reports)
  3.2 Translate to Kiswahili if requested
  3.3 Generate per-competency summaries (structured)
  3.4 Format for output type (PDF, HTML, JSON)

Phase 4: REVIEW ROUTING (by consequence level)
  Level 2: mark as "draft - advisory" → pass to teacher
  Level 3: add to teacher review queue → hold until teacher approves
  Level 4: add to specialist queue + admin queue → hold until dual approval

Phase 5: DELIVERY
  On approval: deliver to authorized recipients (parent via app + WhatsApp/email;
               government via secure file transfer; school records via document store)
  Include: generation metadata, review status, AI disclosure

REPORT FORMATTING STANDARDS:
  Language register:
    Teacher reports: professional educator register
    Parent reports: Grade 6 reading level target; specific, not abstract
    Government reports: formal civil service register
    Research reports: academic register with citations
  
  Length:
    Learner progress report: 1 page (strict)
    Term report: 2-3 pages (official format)
    School summary: 4-6 pages
    Government report: 8-12 pages with appendices
  
  Positivity principle:
    Always lead with strengths
    Frame gaps as "areas for growth" not "failures"
    Quantify progress, not just current state
    Include one specific actionable recommendation
```

## 5.14 Certification Platform Engine

The Certification Platform manages competency-based credentials: micro-credentials, digital badges, and official school certificates.

```
CERTIFICATION PLATFORM:

CREDENTIAL TYPES:

MicroCredential:
  Scope: mastery of a specific competency or competency cluster
  Issued by: EduNexus (platform credential)
  Evidence requirement: minimum 3 evidence items at MASTERED level, teacher-validated
  Format: digital badge (Open Badges v3.0 standard)
  Privacy: learner controls visibility; shareable on request
  Use case: learner portfolio; employer verification; scholarship applications

SubjectCertificate:
  Scope: all competencies in a subject for a grade level
  Issued by: School (signed by school administrator) + EduNexus (countersigned)
  Evidence requirement: PROFICIENT or above on ≥ 85% of subject competencies
  Format: PDF certificate with QR verification code + Open Badges
  Official status: recognized by KICD; maps to CBC achievement framework
  Privacy: learner-controlled sharing; verifiable by third parties via QR code

CompletionCertificate:
  Scope: Grade level completion (all subjects)
  Issued by: School (principal signature) + EduNexus (digital countersign)
  Evidence requirement: SubjectCertificate for all required subjects
  Format: official format (matches Kenya government school certificate format)
  Verification: public verification via unique certificate ID; tamper-evident

VERIFICATION ARCHITECTURE:
  All credentials: cryptographically signed using school's private key
  Verification URL: https://verify.edunexus.io/credentials/{credential_id}
  
  Verification response:
    {
      "credential_id": "...",
      "type": "MicroCredential",
      "subject": "Solving Linear Equations",
      "learner_pseudo_id": "...",  // not learner name (learner shares name separately)
      "issued_by": "Nairobi Academy - Grade 8",
      "issued_at": "2024-04-15",
      "evidence_count": 5,
      "evidence_summary": "3 assessments + 2 portfolio items, teacher-validated",
      "verification_status": "VALID",
      "issued_under_curriculum": "CBC-2023"
    }
  
  Issuing school cannot revoke a credential without audit record.
  EduNexus cannot modify credentials after issuance.
  Credentials are cryptographically tamper-evident.
```

---

# PART VII EXPANSION: DATA ARCHITECTURE DEPTH

## 7.9 The Evidence Store Design

The Evidence Store is the most critical data store in EduNexus because it is the ultimate source of truth for all educational intelligence. If the Evidence Store is corrupted, incomplete, or untrustworthy, all downstream intelligence is untrustworthy.

The Evidence Store is designed as an **append-only, immutable, cryptographically signed ledger**.

```
EVIDENCE STORE DESIGN:

IMMUTABILITY GUARANTEE:
  Evidence records are NEVER modified or deleted.
  If an assessment was entered incorrectly:
    → Teacher creates a CORRECTION record that references the original
    → Correction record has: original_evidence_id, reason, correction_type, corrected_value
    → Correction does NOT modify the original
    → The competency state computation engine processes both:
        original_evidence.weight = base_weight
        correction.weight = override_weight  // correction supersedes original
  
  Why immutability matters:
    If assessment records can be modified without trace, a school could falsify
    learner achievement data without detection. Immutability plus audit logging
    makes post-hoc falsification detectable and unambiguous.

EVIDENCE SCHEMA:

Evidence {
  id: UUID,
  evidence_type: EvidenceType,   // assessment_response | teacher_observation | portfolio_artifact |
                                 // peer_assessment | self_assessment | national_examination
  
  // What this evidence says (the core signal)
  competency_mapping: [{
    competency_id: UUID,
    performance_level: Float,     // 0.0-1.0 on this competency
    bloom_level_demonstrated: BloomLevel | null
  }],
  
  // Source and context (for quality weighting)
  source: {
    type: EvidenceSource,         // assessment | observation | portfolio | examination
    instrument_id: UUID | null,   // if from a structured instrument
    scorer_type: ScorerType,      // automated | ai | teacher | peer | self | examiner
    scorer_id: UUID | null,
    scoring_confidence: Float | null  // AI confidence if AI-scored
  },
  
  // When it happened and when it was recorded (bi-temporal)
  occurred_at: Date,             // when the learning event actually happened
  recorded_at: Timestamp,        // when the system received this evidence
  
  // Cryptographic integrity
  hash: String,                  // SHA-256 of all other fields (tamper detection)
  signature: String,             // signed by the recording service (non-repudiation)
  
  // Audit
  recorded_by_service: String,   // which EduNexus service recorded this
  recorded_by_user: UUID | null, // if a human submitted (teacher observation)
  
  // Corrections
  supersedes: UUID | null,       // if this is a correction of a prior evidence record
  superseded_by: UUID | null     // if this record has been superseded (set retroactively)
}

EVIDENCE QUALITY WEIGHTS:

quality_weight(evidence):
  weights = {
    "automated_mcq":           0.6,  // automated; lower recall value
    "ai_scored_short_answer":  0.7,  // AI scored; reasonable
    "ai_scored_teacher_validated": 0.9,  // teacher validated AI score
    "teacher_manual_scored":   0.9,  // direct teacher assessment
    "teacher_observation":     0.8,  // teacher observation; high signal
    "national_examination":    1.0,  // highest reliability
    "portfolio_teacher_validated": 0.85,
    "peer_assessment":         0.5,  // useful but low reliability
    "self_assessment":         0.3   // useful for self-awareness; lower weight
  }
  return weights[evidence.source.type + "_" + evidence.source.scorer_type]
```

## 7.10 Analytics Data Quality

```
ANALYTICS DATA QUALITY FRAMEWORK:

COMPLETENESS:
  Required: every learner record should have ≥ 1 evidence item per active competency per term
  Monitored: count(learners with 0 evidence in term) / count(active_learners)
  Alert threshold: > 15% learners with no evidence in active term (→ data quality issue)
  Action: alert school admin; surface in Teacher Dashboard as "unassessed learners"

TIMELINESS:
  Required: all assessment events should be recorded within 7 days of occurrence
  Monitored: median(recorded_at - occurred_at) per school
  Alert threshold: > 7 days median lag (→ teachers are entering data in bulk, not real-time)
  Action: encourage real-time entry; surface late-entry patterns in School Admin view

ACCURACY:
  Required: AI-scored items should match human scoring within 10% (where spot-checked)
  Monitored: sample 5% of AI-scored items per month; human re-scores; compute agreement
  Alert threshold: AI-human agreement < 80% (by item type and competency)
  Action: retrain scoring model; adjust confidence thresholds

CONSISTENCY:
  Required: same learner's performance on the same competency should not vary dramatically
             between consecutive assessments without an explanation
  Monitored: flag competency state swings of > 2 mastery levels between consecutive assessments
  Action: flag for teacher review (may indicate assessment validity issue or late remediation)

COVERAGE:
  Required: every curriculum competency expected in a term should have at least one
            class-level assessment in that school
  Monitored: count(distinct assessed competencies) / count(expected competencies) per school per term
  Alert threshold: < 70% coverage (→ significant curriculum gaps not being assessed)
  Action: alert curriculum coordinators; surface in HOD view
```

---

# PART XIII EXPANSION: FUTURE COMPUTING DEPTH

## 13.5 The Open Educational Intelligence Standard (OEIS)

As EduNexus becomes a platform, it needs open standards that allow other systems to interoperate with it without proprietary dependencies. The Open Educational Intelligence Standard (OEIS) is a proposed open specification for educational intelligence data formats and APIs.

```
OPEN EDUCATIONAL INTELLIGENCE STANDARD (OEIS) PROPOSAL:

SPECIFICATION DOMAINS:

OEIS-1: Learner Intelligence Record
  Open format for expressing a learner's competency state in a portable, 
  interoperable form. Any educational platform can read and write OEIS-1 records.
  
  Format (JSON-LD):
  {
    "@context": "https://oeis.education/v1/",
    "@type": "LearnerIntelligenceRecord",
    "learner_id": "urn:oeis:learner:KE-NBO-SCHOOL1-2024-XXXXX",
    "as_of": "2024-03-15",
    "curriculum": "urn:oeis:curriculum:KE-CBC-2023",
    "competency_states": [{
      "competency": "urn:oeis:competency:KE-CBC-2023-G8-MAT-ALG-LIN-001",
      "level": "developing",
      "confidence": 0.72,
      "evidence_count": 4,
      "last_assessed": "2024-03-10",
      "assessed_by": "EduNexus Platform v1.0"
    }],
    "certification": {
      "issuer": "EduNexus Platform",
      "signature": "...",
      "issued_at": "2024-03-15T10:00:00Z"
    }
  }

OEIS-2: Universal Concept Graph (UCG) Node Format
  Standard format for expressing curriculum competencies in a cross-curriculum,
  cross-country comparable form.
  
  Enables: Kenya CBC competency mapped to → UCG node → US Common Core Standard
           so assessment data can be compared across curricula

OEIS-3: Educational Event Format
  CloudEvents profile for educational events.
  Extends CloudEvents v1.0 with educational domain attributes.
  
  Example:
  {
    "specversion": "1.0",
    "type": "oeis.assessment.completed",
    "source": "https://api.edunexus.io",
    "id": "uuid",
    "time": "2024-03-15T10:00:00Z",
    
    // OEIS extension attributes
    "oeis_curriculum": "KE-CBC-2023",
    "oeis_grade_level": 8,
    "oeis_competency": "KE-CBC-2023-G8-MAT-ALG-LIN-001",
    "oeis_learner_pseudo_id": "pseudo-hash-of-learner-id",
    
    "data": {
      "assessment_type": "formative",
      "mastery_level_achieved": "developing"
    }
  }

OEIS-4: Intervention Efficacy Record
  Standard format for sharing intervention outcome data across platforms.
  Enables cross-platform meta-analysis of intervention efficacy.
  Privacy: individual learner data is never included; only aggregate statistics.
  
STANDARDIZATION PATHWAY:
  EduNexus will propose OEIS to:
    - IMS Global Learning Consortium (for learning technology standards)
    - IEEE Education Society (for AI in education standards)
    - UNESCO's IIEP (for international educational development standards)
    - Africa Union Commission (for continental educational data standards)
  
  Open specification: published at https://oeis.education/ (non-commercial domain)
  Governance: multi-stakeholder; EduNexus is a contributor, not the sole author
```

## 13.6 The Kenya Educational Digital Infrastructure Vision

```
KENYA EDUCATIONAL DIGITAL INFRASTRUCTURE (KEDI):

VISION (2030):
  Kenya possesses a national educational intelligence infrastructure as foundational
  as its road network — maintained as public good, universally accessible,
  enabling both public and private investment on top.

COMPONENTS:

1. NATIONAL EDUCATIONAL KNOWLEDGE GRAPH (NEKG)
   Owner: Ministry of Education (public asset)
   Operator: KICD with technical partnership
   Content: Kenya CBC curriculum graph, UCG alignment, national competency framework
   Access: public read; restricted write (KICD only)
   Hosting: Kenya-based sovereign cloud infrastructure

2. NATIONAL LEARNER RECORD INFRASTRUCTURE (NLRI)
   Owner: Government of Kenya
   Operator: Education regulators + designated technology partner
   Content: Pseudonymized learner competency trajectories from ECD through higher education
   Access: restricted; learner + authorized institutions only
   Hosting: Kenya-based sovereign cloud
   Privacy: aligned to Kenya Data Protection Act 2019

3. NATIONAL INTERVENTION EFFICACY DATABASE (NIED)
   Owner: Ministry of Education + KICD
   Operator: National research consortium
   Content: Anonymized intervention outcome data from all schools
   Access: Tier 2 open to approved researchers; Tier 1 open to public
   Hosting: open data portal (data.education.go.ke)
   Update frequency: annual

4. NATIONAL ASSESSMENT BANK (NAB)
   Owner: KICD + KNEC
   Operator: Assessment Committee
   Content: Curriculum-aligned, psychometrically calibrated assessment items
   Access: teacher-authenticated; school-level licensing
   Hosting: National cloud infrastructure

ECONOMIC MODEL:
  NEKG, NLRI: fully government-funded (public good infrastructure)
  NIED, NAB: public-private partnership (platform provider contributes; government governs)
  
  Commercial platforms (EduNexus and others):
    Consume NEKG as read-only API (curriculum truth layer)
    Contribute to NLRI (write learner records; receive read access to learner's own record)
    Contribute to NIED (submit anonymized outcome data; receive aggregated insights)
    License from NAB (per-teacher or per-school annual fee; government-subsidized for public schools)

KENYA-SPECIFIC PRIORITIES:
  Multi-language: Kiswahili as full first-class language, not translation afterthought
  Offline-first: > 40% of schools unreliable connectivity; offline capability required
  Equity: rural and remote schools receive same intelligence quality as urban
  Accessibility: screen reader; low-bandwidth mode; feature phone (SMS) fallback
  Cultural: curriculum examples and AI outputs reflect Kenyan contexts, not Western defaults
```

## 13.7 The Africa Educational Intelligence Infrastructure

```
AFRICA-SCALE EDUCATIONAL INTELLIGENCE (2030-2040):

CURRENT STATE:
  Africa has 600M+ learners, the largest and youngest educational population in the world.
  African educational systems are transforming rapidly: CBC-style competency models
  adopted in Kenya, Tanzania, Rwanda, Ethiopia, Ghana, South Africa.
  Common challenge: inadequate assessment quality data, insufficient teacher support,
  large class sizes (50-70 learners per teacher in many countries).

CONTINENTAL VISION:
  A federated network of national Educational Intelligence Infrastructures,
  connected through the Universal Concept Graph, enabling:
    - Cross-country curriculum alignment research
    - Shared intervention efficacy data (what works in Kenya may work in Uganda)
    - Pan-African credentialing (micro-credentials recognized across countries)
    - Shared curriculum resources (Kenyan teacher's lesson plan adapted for Tanzanian CBC)
    - Research at continental scale (Africa-wide educational outcome studies)

FEDERATION MODEL:
  Each country: sovereign national EII (Kenya NEKG, Tanzania TEKG, Uganda UEKG)
  Continental layer: Africa Educational Intelligence Network (AEIN)
    - UCG alignment service (maps national curricula to common graph)
    - Cross-border learner record portability (for learners who migrate)
    - Continental intervention database (aggregated from national NIEDs)
    - Research portal (Tier 2 access for approved pan-African researchers)
  
  Governance: African Union Commission + member state education ministries
  Technical standards: OEIS (the open standard we propose)
  Hosting: distributed; each national EII in country; AEIN in AU-designated facility

TECHNICAL REQUIREMENTS FOR CONTINENTAL SCALE:
  
  Learner population: 600M learners × 200 competency states = 120B graph edges
  This requires: distributed graph database (beyond Neo4j single instance)
  Solution: horizontally partitioned graph, partitioned by country
  Cross-country queries: UCG graph (curriculum alignment only; no individual data)
  
  Language support required: 100+ African languages
  Approach: Multilingual foundation model (trained on African language educational content)
            + curriculum graphs authored in each national language
  
  Connectivity: large fraction of Africa without reliable internet
  Solution: satellite-based connectivity (Starlink, OneWeb); edge inference;
            peer-to-peer offline sync (schools sync to each other when internet unavailable)

EDUNEXUS ROLE IN AFRICA VISION:
  EduNexus Kenya: the reference implementation and pilot
  EduNexus East Africa: expansion to Uganda, Tanzania, Rwanda, Ethiopia (2026-2028)
  EduNexus Africa: continental partnership model (2028-2035)
  
  NOT: EduNexus owns and controls all African educational intelligence
  YES: EduNexus contributes the technical architecture, open standards,
       and Kenya reference implementation to a continent-owned public good
```

---

# APPENDIX G: OPERATIONAL RUNBOOKS (SUMMARY)

## G.1 Curriculum Revision Runbook

```
WHEN A NEW CURRICULUM VERSION IS PUBLISHED:

Trigger: KICD notifies EduNexus via CurriculumAuthoringService

Step 1: IMPORT AND VALIDATE
  Import new competency definitions
  Run curriculum graph consistency checks:
    - No isolated nodes (all competencies connected to curriculum hierarchy)
    - No circular prerequisites
    - All core competency edges valid
    - All PCI edges valid
    - All mastery models have complete level definitions
  
  If validation fails: reject import; notify KICD with specific errors

Step 2: PREVIEW MODE (30-day period)
  New version enters PREVIEW status:
    - Visible to curriculum authors and administrators
    - NOT used for AI generation (still on prior version)
    - NOT used for learner state computation
    - Available for teacher preview and feedback

Step 3: MIGRATION PLAN
  CompetencyVersionMigrationService generates migration map:
    For each competency in new version:
      Find closest match in prior version (by code or semantic similarity)
      If 1:1 match: map directly (learner states transfer)
      If split: map old → multiple new (learner state applied to most foundational)
      If merged: map multiple old → one new
      If new (no prior): all learners start at NOT_YET
      If removed: learner states archived; not deleted

Step 4: SCHOOL NOTIFICATION
  30 days before effective date:
    - All schools notified via School Admin Dashboard
    - Email to school principals and HODs
    - Summary of changes published to teachers

Step 5: GO-LIVE
  On effective_from date at 00:01:
    Mark new version as CURRENT
    Mark prior version as LEGACY
    Clear all curriculum caches
    Trigger: AI curriculum context precomputation for new version
    Trigger: all open term plans re-validated against new version
    Begin: background migration of learner states

Step 6: POST-MIGRATION VALIDATION
  24 hours after go-live:
    Verify: all active learners have valid competency states in new version
    Verify: AI generation using new version curriculum codes
    Verify: no curriculum citation failures in output validation logs
    Alert if: > 1% of AI outputs have citation failures (indicates migration gap)
```

## G.2 AI Incident Runbook

```
EDUCATIONAL AI INCIDENT RESPONSE:

INCIDENT TYPES:
  Type A: Single incorrect output (isolated hallucination)
  Type B: Systematic incorrect outputs (model or prompt issue affecting many users)
  Type C: Safety failure (harmful content delivered to learner)
  Type D: Privacy failure (PII in AI output)
  Type E: Bias incident (systematic quality difference for demographic group)

TYPE A (ISOLATED):
  Detection: teacher reports incorrect AI output
  Response: 
    1. Record incident (teacher_report, output_id, nature of error)
    2. Retrieve: full output audit record (prompt, context, response, validation results)
    3. Analyze: was this a prompt issue? model issue? context retrieval issue?
    4. Document: root cause analysis
    5. Fix: prompt fix (if prompt issue) or model routing change (if model issue)
    6. Feedback: thank teacher; explain what we learned; update teacher feedback
    Timeline: < 7 days for root cause analysis

TYPE C (SAFETY FAILURE):
  This is a CRITICAL incident. Escalate immediately.
  
  Step 1 (< 1 hour): Contain
    Identify which operation type produced harmful content
    Disable that operation type (safety circuit breaker)
    Notify ERB chair and AI Safety Engineer
  
  Step 2 (< 4 hours): Assess
    How many outputs affected? (query generation_id patterns in audit log)
    Were any delivered to learners? (check delivery records)
    Is affected learner family notification required?
  
  Step 3 (< 24 hours): Remediate
    Patch: safety layer that allowed the content through
    Test: adversarial test set on patched system
    Review: ERB emergency review for re-enabling
  
  Step 4 (< 7 days): Report
    Internal post-mortem
    External notification if required (Data Commissioner if PII involved)
    
  Step 5 (< 30 days): Prevention
    Add to adversarial test set
    Update safety training materials
    Review similar operation types for same vulnerability

TYPE E (BIAS INCIDENT):
  Detection: automated monitoring detects calibration difference > 0.07 across groups
  Response:
    1. Identify affected demographic dimension and operation type
    2. Quantify: how many outputs affected? which group? in what direction?
    3. Suspend affected operation or add explicit bias correction
    4. Root cause: training data bias? prompt bias? evaluation dataset bias?
    5. ERB notification: bias incident report within 48 hours
    6. Remediation: depends on root cause; may require model retraining
    7. Post-remediation test: verify bias resolved before re-enabling
```

## G.3 Data Breach Response Runbook

```
DATA BREACH RESPONSE:

Definition of breach: unauthorized access to or disclosure of Tier 1 or Tier 2 
educational data (individual learner competency data, assessment responses, 
risk scores, or personal information).

CONTAINMENT (< 1 hour):
  1. Identify scope: which data, which learners, which time period
  2. Revoke compromised credentials if credential compromise suspected
  3. Isolate affected systems if active exploit in progress
  4. Preserve forensic evidence: do NOT overwrite logs or modify state

ASSESSMENT (< 4 hours):
  5. Determine: what data was accessed? (query audit logs)
  6. Determine: how many learners/schools affected?
  7. Determine: is breach ongoing or historical?
  8. Classify: severity (individual | class | school | national)

NOTIFICATION (< 72 hours, per Kenya DPA 2019):
  9. Notify: Kenya Data Commissioner (mandatory if risk to rights/freedoms of individuals)
  10. Notify: affected school principals
  11. Notify: affected learner families (if individual PII exposed)
  Notification content: what happened, what data, what we're doing, how to get more info

REMEDIATION:
  12. Patch the vulnerability
  13. Reset affected credentials
  14. Verify: no other similar vulnerabilities exist
  15. Third-party security audit (for severity 2+ breaches)

POST-INCIDENT:
  16. Full post-mortem (internal)
  17. Update runbook if gaps identified
  18. Inform ERB
  19. Update privacy impact assessments if root cause is architectural
```

---

# APPENDIX H: ARCHITECTURAL ANTI-PATTERNS

The following patterns have been identified as architectural anti-patterns in educational intelligence systems. They are explicitly prohibited in EduNexus implementations and documented here so that engineers can recognize and refuse them.

```
EDUCATIONAL INTELLIGENCE ANTI-PATTERNS:

AP-01: THE CONFIDENCE FABRICATOR
  Pattern: AI system expresses certainty about learner competency states that is not
           calibrated against actual evidence. e.g., "Emma has mastered algebra"
           when only 1 assessment item exists.
  Problem: Teachers and parents make consequential decisions based on expressed confidence.
           Uncalibrated confidence is misleading.
  EduNexus response: All confidence scores are calibrated against historical accuracy.
                     Evidence count shown alongside confidence. Low evidence → low displayed confidence.

AP-02: THE SILENT ASSUMPTION
  Pattern: AI generation uses assumptions about the learner's context without disclosing them.
           e.g., generates content assuming the learner is English-first when the school
           teaches in Kiswahili.
  Problem: Teacher receives content that's inappropriate for their context and doesn't 
           know why.
  EduNexus response: All significant context assumptions are disclosed in the output metadata.

AP-03: THE ANONYMOUS RANKING
  Pattern: System produces ranked lists of learners (e.g., "class ranking by performance")
           that stigmatize low-ranked learners without appropriate context.
  Problem: Educational stigma; learner motivation damage; teacher misuse of rankings.
  EduNexus response: No learner rankings. Competency-based progress only.
                     Distributions shown, not individual rankings.

AP-04: THE IMMUTABLE DECISION
  Pattern: AI-produced assessments or recommendations that are treated as final decisions
           without a documented teacher review step.
  Problem: AI errors become official educational records without correction opportunity.
  EduNexus response: All AI outputs at Level 2+ have teacher review workflow.
                     AI-generated records are marked as AI-generated until teacher-validated.

AP-05: THE ENGAGEMENT MAXIMIZER
  Pattern: AI tutor that optimizes for session length or engagement metrics rather than
           learning outcomes. Uses emotionally engaging tricks to keep learners on platform.
  Problem: Platform engagement and learning outcomes are not the same thing.
           An engaging AI that doesn't produce learning is an educational harm.
  EduNexus response: Reward functions for AI tutoring optimize on demonstrated understanding
                     (competency advancement), not session length.

AP-06: THE DATA HOARDER
  Pattern: Collecting all possible learner data because it "might be useful later"
           without a specific educational purpose.
  Problem: Privacy violation; learner surveillance; data security risk.
  EduNexus response: Data minimization principle strictly enforced. Every data field requires
                     documented educational purpose before collection.

AP-07: THE ALGORITHMIC TEACHER EVALUATOR
  Pattern: Using AI-generated learner outcome data to produce teacher performance scores.
           "Teacher X's class performed 15% above average on AI assessments."
  Problem: Teacher performance is a complex professional judgment requiring expert human
           evaluation. Algorithmic scores are reductive and gameable.
  EduNexus response: The platform does not produce teacher performance ratings. Period.
                     It provides: curriculum coverage data, learner outcome aggregates, 
                     resource utilization. Teacher performance evaluation is human work.

AP-08: THE DETERMINISTIC PREDICTOR
  Pattern: AI risk system that assigns learners to "will fail" categories without uncertainty
           quantification. e.g., "This learner will not pass the end-of-term examination."
  Problem: Self-fulfilling prophecy risk; stigma; teacher reduced expectations.
  EduNexus response: All predictions are probabilistic with confidence intervals.
                     Language is always: "risk of not meeting target" not "will fail."

AP-09: THE CURRICULUM APPROXIMATOR  
  Pattern: AI that generates curriculum content from training data (general knowledge)
           rather than from the authoritative curriculum specification.
  Problem: Generated content may contradict or distort the official curriculum.
           Teachers and learners receive curriculum misinformation.
  EduNexus response: All AI curriculum generation is grounded in the Curriculum Graph.
                     No curriculum claims without citations to specific competency codes.

AP-10: THE INVISIBLE AI
  Pattern: AI-generated content delivered to teachers, learners, or parents with no
           indication that it is AI-generated.
  Problem: Undermines informed consent; prevents appropriate human oversight.
  EduNexus response: All AI-generated content is labeled as such. The label persists through
                     all transformations; it cannot be removed by teacher editing.
```

---

*End of Expansion 2 — append to docs/edunexus-canonical-architecture.md*
# EduNexus Canonical Reference Architecture — Expansion 3

---

# PART IV EXPANSION 3: COMPETENCY DOMAIN IN DEPTH

## 4.14 The Mastery Model in Practice

Understanding mastery is the most critical function in educational intelligence. A mastery model that is too strict misses real learning and discourages learners. A mastery model that is too loose promotes learners who cannot actually perform the competency. EduNexus implements a calibrated, evidence-based mastery model.

### Mastery Level Definitions (Operational)

```
MASTERY LEVELS — OPERATIONAL DEFINITIONS:

NOT YET (Level 0):
  Behavioral description: Learner does not demonstrate understanding of this competency.
                          Attempts at tasks involving this competency produce mostly incorrect results.
  Evidence threshold: Fewer than 2 assessments, OR ≥ 2 assessments with mean performance ≤ 25%
  Action implication: Prerequisite gap investigation required before addressing this competency
  AI interpretation: "This learner has not yet engaged with this topic, or initial assessments
                      show significant gaps in foundational understanding."

BEGINNING (Level 1):
  Behavioral description: Learner shows initial recognition and recall of the competency.
                          Can identify when the competency is relevant. Cannot yet apply independently.
  Evidence threshold: ≥ 2 assessments; mean performance 26-45%
  Action implication: Foundation building; heavily scaffolded instruction recommended
  AI interpretation: "This learner has started engaging with this concept but needs
                      significant support to work with it independently."

DEVELOPING (Level 2):
  Behavioral description: Learner demonstrates partial understanding and can apply the
                          competency in familiar, structured contexts with some assistance.
                          Errors are present but show emerging understanding.
  Evidence threshold: ≥ 3 assessments; mean performance 46-65%
  Action implication: Guided practice with targeted feedback; reduce scaffolding gradually
  AI interpretation: "This learner is building their skills. They get many things right
                      but still make errors, especially in unfamiliar contexts."

PROFICIENT (Level 3):
  Behavioral description: Learner consistently demonstrates the competency in familiar contexts.
                          Can apply independently with minimal assistance.
                          Occasional errors in complex or novel situations.
  Evidence threshold: ≥ 3 assessments; mean performance 66-84%; demonstrated in ≥ 2 contexts
  Action implication: Extension activities; apply in cross-curricular contexts; consolidate
  AI interpretation: "This learner has solid understanding. They work independently 
                      most of the time. Occasional challenge items are appropriate."

MASTERED (Level 4):
  Behavioral description: Learner demonstrates deep, flexible understanding of the competency.
                          Can apply in novel contexts, explain to others, and identify errors.
                          Consistent performance across varied assessment types.
  Evidence threshold: ≥ 4 assessments; mean performance ≥ 85%; demonstrated in ≥ 3 contexts
                      including at least one analysis/evaluation-level task (Bloom level 4-6)
  Action implication: Peer tutoring opportunities; extension to higher-order applications;
                      forward dependency competencies may now be taught
  AI interpretation: "This learner has mastered this competency. They can work with it
                      fluently and apply it in new situations."

MASTERY CEILING ADJUSTMENT:
  Mastery is relative to the curriculum specification, not to perfection.
  A Bloom Level "Remember" competency achieves MASTERED at lower cognitive complexity
  than a Bloom Level "Evaluate" competency.
  
  The mastery model for each competency is authored in the Curriculum Domain
  and calibrated against population performance data.
  A competency where 95% of learners "master" is probably mis-specified (too easy).
  A competency where only 10% "master" at grade level is probably mis-specified (too hard).
  Target: 60-75% of on-track learners at grade level should reach PROFICIENT or MASTERED
          by the expected mastery week.
```

### Bayesian Mastery Update: Worked Example

```
WORKED EXAMPLE: Bayesian Mastery Update

Scenario:
  Learner: Grace, Grade 8
  Competency: CBC-G8-MAT-ALG-LIN-001-C02 (Solving linear equations — one variable)
  Week: 6 of Term 1 (competency expected by week 8)
  
  Prior state: DEVELOPING (level 2), confidence 0.65
  New evidence: Assessment result, teacher-scored, score = 78/100 = 0.78

Step 1: RETRIEVE PRIOR
  prior_distribution = [0.02, 0.10, 0.52, 0.31, 0.05]
  // [NOT_YET, BEGINNING, DEVELOPING, PROFICIENT, MASTERED] probabilities
  // (This reflects the current DEVELOPING assessment with confidence 0.65)

Step 2: EVIDENCE QUALITY
  evidence.source = "teacher_manual_scored"
  quality_weight = 0.90  // high quality
  
  recency_weight = exp(-0.01 * 0) = 1.0  // just happened
  
  combined_weight = 0.90 * 1.0 = 0.90

Step 3: COMPUTE LIKELIHOOD
  // Given this score of 0.78, what is P(level = L | score = 0.78)?
  // Using Item Response Theory-calibrated likelihood functions:
  
  P(score = 0.78 | NOT_YET) = 0.02
  P(score = 0.78 | BEGINNING) = 0.15
  P(score = 0.78 | DEVELOPING) = 0.55
  P(score = 0.78 | PROFICIENT) = 0.75
  P(score = 0.78 | MASTERED) = 0.40
  
  // A score of 0.78 is most likely from a PROFICIENT learner

Step 4: BAYESIAN UPDATE
  posterior[L] ∝ prior[L] × P(score | L)
  
  unnormalized:
    NOT_YET:    0.02 × 0.02 = 0.0004
    BEGINNING:  0.10 × 0.15 = 0.0150
    DEVELOPING: 0.52 × 0.55 = 0.2860
    PROFICIENT: 0.31 × 0.75 = 0.2325
    MASTERED:   0.05 × 0.40 = 0.0200
  
  sum = 0.5539
  
  normalized:
    NOT_YET:    0.07%
    BEGINNING:  2.71%
    DEVELOPING: 51.63%
    PROFICIENT: 41.98%
    MASTERED:   3.61%

Step 5: DETERMINE LEVEL
  argmax(posterior) = DEVELOPING (51.63%)
  confidence = 0.5163
  
  Note: Grace is still DEVELOPING by argmax, but now has a 41.98% chance of
        being PROFICIENT. The assessment moved her probability mass significantly
        toward PROFICIENT.
  
  If Grace has one more good assessment next week:
    The cumulative posterior will likely shift to PROFICIENT with high confidence.

Step 6: COMPARISON TO PRIOR
  Level: unchanged (DEVELOPING → DEVELOPING)
  Confidence: unchanged (but internal probability mass has shifted toward PROFICIENT)
  
  The system records: evidence_added, posterior_updated, no level change
  No event emitted (level unchanged)
  
  At the next assessment, Grace is now more likely to tip into PROFICIENT.
  This gradual probability accumulation is the Bayesian advantage over threshold-based systems.
```

---

# PART VI EXPANSION 2: PROMPT ENGINEERING FOR EDUCATION

## 6.8 Curriculum-Grounded Prompt Design: Complete Examples

The following are representative examples of complete prompts used in EduNexus. They are provided here to illustrate the knowledge-grounded approach in practice.

### Teacher Copilot: Lesson Plan Prompt (Abbreviated)

```
[SYSTEM PROMPT — IDENTITY MODULE v2.3]
You are an educational intelligence assistant for EduNexus, serving a Kenya CBC teacher.
Your role is to generate a curriculum-grounded lesson plan.

EDUCATIONAL OBLIGATIONS:
  1. All curriculum claims must be based on the provided CURRICULUM CONTEXT.
  2. All learner-level claims must be based on the provided LEARNER CONTEXT.
  3. Cite curriculum competency codes in format [CBC-XXXXX] for every curriculum claim.
  4. State explicitly: "Based on the class data provided:" before making class-level claims.
  5. Express uncertainty where evidence is thin: "Data is limited for this topic; plan accordingly."
  6. This lesson plan requires teacher review before use. It is a draft for the teacher's judgment.

[CURRICULUM MODULE — assembled from EKG]
CURRICULUM CONTEXT (CBC-2023, Grade 8 Mathematics):

Learning Area: Mathematics
Target Competency: CBC-G8-MAT-ALG-LIN-001-C02
Title: Solving linear equations — one variable
Bloom Level: Apply
Description: Solve linear equations in one variable using inverse operations and verify
             by substitution.
Expected mastery: Term 1, Week 8

Prerequisite competencies (required for this lesson):
  1. CBC-G8-MAT-ALG-LIN-001-C01 (Forming linear equations) — direct prerequisite
  2. CBC-G7-MAT-NUM-INT-003 (Integer operations) — foundational prerequisite

Assessment strategies specified in curriculum:
  - Short-answer equations with integer coefficients
  - Word problems requiring formation and solving of linear equations
  - Verification by substitution tasks

Mastery model:
  PROFICIENT: can solve equations in familiar formats with minimal errors
  MASTERED: can solve equations in novel contexts, explain method, identify errors in peers' work

Core competencies developed: Critical Thinking and Problem Solving [CC-CTPS]
PCIs: Financial Literacy [PCI-FL] (budgeting scenarios as application context)

[LEARNER CONTEXT MODULE — assembled from Competency Domain]
CLASS CONTEXT (Grade 8B, Kilimani Academy — 28 learners):
Data as of: 2024-03-15 (3 days old)

Prerequisites status:
  CBC-G8-MAT-ALG-LIN-001-C01 (Forming equations):
    MASTERED: 12 learners (43%)
    PROFICIENT: 9 learners (32%)
    DEVELOPING: 5 learners (18%)
    BEGINNING/NOT_YET: 2 learners (7%)
  
  CBC-G7-MAT-NUM-INT-003 (Integer operations):
    PROFICIENT or above: 21 learners (75%)
    DEVELOPING: 6 learners (21%)
    BELOW DEVELOPING: 1 learner (4%)

Current competency on target (CBC-G8-MAT-ALG-LIN-001-C02):
  NOT_YET: 18 learners (first time teaching this competency this term)
  DEVELOPING: 10 learners (had some exposure in prior term diagnostic)

Common misconceptions identified in this class:
  Sign_Convention_Error: 7 learners (25%) — changing signs when moving terms across '='
  Variable_on_Both_Sides_Confusion: 3 learners (11%)

[CONSTRAINT MODULE]
Lesson duration: 40 minutes (Kenya standard period)
Class size: 28 learners
Resources available: standard classroom, chalkboard, textbook (Mathematics Grade 8 — KLB)
Differentiation required: 2 learners still DEVELOPING on prerequisite integer operations

[TASK MODULE]
Generate a structured lesson plan for this lesson. Include:
1. Learning objectives (directly referencing CBC-G8-MAT-ALG-LIN-001-C02 indicators)
2. Lesson introduction (10 minutes): connects to prior learning on forming equations
3. Main activity (20 minutes): guided and independent practice, differentiated for:
     - Learners with sign_convention_error misconception
     - Learners with integer operation gaps (2 learners)
     - Learners who are PROFICIENT on prerequisites and ready for extension
4. Assessment moment (5 minutes): formative check aligned to this competency
5. Closure (5 minutes): connect to next lesson
6. Homework (3 problems maximum, not a test)

Format: structured markdown; suitable for printing and using in class.
```

### Learner Copilot: First Turn of a Tutoring Session

```
[SYSTEM PROMPT — IDENTITY MODULE v2.1]
You are an educational assistant for EduNexus, helping a Grade 8 learner in Kenya.
Your role is to support this specific learner with the specific topic shown in the curriculum context.

BEHAVIORAL RULES:
  1. Do not provide direct answers to homework or assessment questions. Guide the learner.
  2. Use Socratic questioning when the learner is stuck (ask, don't tell).
  3. Use examples from Kenya context (shillings, Kenyan geography, familiar situations).
  4. If the learner asks for the answer without trying, redirect to the process.
  5. Adjust your language to Grade 8 level (clear, not condescending, not overly technical).
  6. All curriculum claims must reference the provided curriculum context.
  7. If you detect a misconception, address it gently and specifically.

[CURRICULUM MODULE — Grade 8 Mathematics, Algebra]
You are helping with: CBC-G8-MAT-ALG-LIN-001-C02
Topic: Solving linear equations — one variable
Key method: Inverse operations (do the opposite to both sides to isolate x)
Common learner errors to watch for:
  - Changing the sign of a term when moving it (sign convention error)
  - Not applying operation to BOTH sides
  - Incorrect verification by substitution

[LEARNER MODULE — assembled from Grace's profile]
LEARNER CONTEXT:
Competency status: DEVELOPING (confidence 0.52)
Last session: 4 days ago. Worked on forming equations. Showed good understanding.
Known misconception: Sign_Convention_Error (confidence 0.78) — 
                     "When Grace moves a term across the equals sign, she sometimes
                     forgets to change the sign. e.g., 2x + 3 = 11 → 2x = 11 - 3 (correct)
                     but sometimes writes 2x = 11 + 3 (incorrect)"

Grace's preference: responds well to worked examples before practice
Current scaffolding level: 2 (high scaffolding — Grace benefits from step-by-step guidance)

[CONVERSATION HISTORY]
(Grace just started the session. No prior turns.)

[TASK MODULE]
Grace has started a tutoring session on solving linear equations.
Welcome her, find out what she'd like to work on (solving equations, or a specific problem),
and start with a brief warm-up to activate prior knowledge about forming equations
(which she already understands well).

Watch for sign convention errors. If she makes one, address it gently and specifically:
  "I notice you added 3 instead of subtracting — remember, when 3 is on one side being
   added, we subtract it from both sides to remove it. Want to try that step again?"
```

---

# PART X EXPANSION: ECOSYSTEM DEPTH

## 10.3 Content Publisher Integration

```
CONTENT PUBLISHER INTEGRATION FRAMEWORK:

PUBLISHER TYPES:
  Textbook Publishers: 
    Kenya: KLB (Kenya Literature Bureau), EAEP (East African Educational Publishers)
    International: Pearson, Oxford University Press (IGCSE), Cambridge Press
    
  Digital Content Providers:
    Khan Academy (English + Kiswahili)
    Twiga Learning
    Shupavu291
    
  Teacher Content:
    Teacher-contributed lesson plans, worksheets, practice sets
    Uploaded via Teacher App; quality reviewed before marketplace listing

CURRICULUM ALIGNMENT REQUIREMENT:
  All content on the EduNexus platform must have verified curriculum alignment.
  
  Verification process:
    Publisher submits: content + claimed curriculum alignment (competency codes)
    EduNexus runs: automated alignment verification (semantic similarity to competency description)
    If auto-verify passes (similarity > 0.75): accepted (spot-checked by educator review)
    If auto-verify fails or borderline: human educator review required
    
  Ongoing monitoring:
    After each curriculum revision: all content alignments re-verified
    Publisher notified if content alignment is invalidated by curriculum revision
    Publisher has 90 days to update or remove content

PUBLISHER REVENUE MODEL:
  Content sold per access:
    Per-teacher subscription: publisher earns per-teacher-per-year fee
    Per-school subscription: publisher earns per-school-per-year fee
    Per-download: publisher earns per-download fee
  
  Revenue split: 70% publisher / 30% EduNexus (standard)
                 60% publisher / 40% EduNexus (premium placement + AI recommendations)
  
  Teacher-contributed content:
    Free on marketplace: teacher earns social recognition + usage analytics
    Paid: teacher earns 80% / EduNexus 20%
    
QUALITY METRICS:
  Publisher-submitted content is rated on:
    Teacher rating (crowdsourced): how teachers rate its usability
    Learner outcome correlation: do learners who use this resource show better progress?
      (computed 6 weeks after resource use for learners who used vs. didn't use, matched pairs)
    Return rate: how often do teachers who used it use it again?
  
  Publishers see their content's performance analytics (anonymized).
  Low-performing content (< 3.0 teacher rating AND < 30% return rate) is flagged for review.
  Persistently low-performing content is removed from marketplace after review period.
```

## 10.4 University Integration

```
UNIVERSITY INTEGRATION:

KENYA UNIVERSITY INTEGRATION PARTNERS:
  University of Nairobi
  Kenyatta University
  Strathmore University
  JKUAT (Jomo Kenyatta University of Agriculture and Technology)
  Maseno University

INTEGRATION TYPES:

1. ADMISSION INTELLIGENCE:
  Universities provide: entry requirements in curriculum-aligned competency form
    Example: "Engineering requires: CBC-G12-MAT-CALC-001 at MASTERED;
                                     CBC-G12-PHY-MOT-003 at PROFICIENT or above"
  
  EduNexus provides: learner alignment scores against each university's requirements
  Learner sees: "Based on your current trajectory, you are on track for 6 of 8
                 University of Nairobi Engineering programme requirements"
  
  Privacy: University does not see individual learner data. Learner sees their own alignment.

2. CAREER PATHWAY DATA:
  Universities provide: graduate employment outcome data (anonymized, aggregate)
    "80% of Engineering graduates from 2018-2022 were employed within 6 months"
    "Median starting salary: KSh 65,000/month"
  
  EduNexus uses: to calibrate Career Engine pathway data
  Universities receive: curriculum-career alignment research insights

3. RESEARCH PARTNERSHIP:
  Universities access: Research Portal (Tier 2-4 as approved)
  EduNexus receives: research publications citing EduNexus data (impact metric)
  Joint: curriculum effectiveness research; intervention research; AI in education research

4. TEACHER PROFESSIONAL DEVELOPMENT:
  Universities provide: accredited PD courses for teachers on EduNexus platform
  EduNexus provides: CPD recommendation engine routes teachers to relevant courses
  Revenue: course fees split (university 75% / EduNexus 25%)
```

---

# PART IX EXPANSION: GOVERNMENT COPILOT

## 9.8 Government and Administration Copilot

```
GOVERNMENT COPILOT DESIGN:

STAKEHOLDERS:
  - County Directors of Education (47 counties)
  - Sub-County Education Officers
  - Ministry of Education Directorate staff
  - Cabinet Secretary's policy team
  - Parliamentary Education Committee research staff

CAPABILITIES:

County Risk Dashboard:
  "Show me which sub-counties have the highest proportion of CRITICAL risk learners this term"
  
  System:
    → Query analytics warehouse: learner risk distribution by sub-county (anonymized)
    → Display: choropleth map of Kenya counties, shaded by risk concentration
    → Alert: sub-counties where > 25% of learners are at HIGH or CRITICAL risk
    → Recommendation: "These schools may benefit from targeted CPD or resource support"
  
  Privacy: Individual school identity shown only to county officials for their county.
           National-level officials see county aggregates only.

Curriculum Effectiveness Query:
  "Is CBC Grade 8 Mathematics being implemented effectively across public schools?"
  
  System:
    → Query: % of public schools meeting curriculum coverage targets by subject
    → Analyze: distribution of mastery on key Grade 8 competencies
    → Identify: systematic gaps (competencies where fewer than 50% of learners 
                reach proficiency at expected week)
    → AI narrative: "Grade 8 algebra implementation shows the following pattern..."
    → Citations: all statistics from anonymized warehouse (k-anonymity ≥ 10)
  
  Consequence level: 1 (informational aggregate; no individual data)

Policy Simulation:
  "If we provide an additional 2 mathematics periods per week to bottom-quartile schools,
   what is the projected impact on Grade 8 mathematics outcomes?"
  
  System:
    → This is a simulation, not a real-time report
    → Retrieve: historical data on correlation between instructional time and mathematics outcomes
    → Build: counterfactual model using similar intervention data
    → Project: expected distribution change in 2 terms
    → Disclose: "This is a model-based projection with high uncertainty.
                 It is not a prediction. Actual impact will depend on implementation quality."
    → Confidence interval: wide (acknowledge model limitations)
  
  Consequence level: 1 (advisory; not used as sole basis for policy decision)

GOVERNMENT COPILOT GUARDRAILS:
  - Never identify specific learners by name or ID
  - Never reveal which specific teacher had "low coverage"
  - Never compare schools publicly (county officials see their schools; not peer schools)
  - All statistics are aggregate; k-anonymity ≥ 10 enforced
  - Every data point includes: data source, measurement date, confidence interval
  - Output labeled: "Advisory analytics — not for enforcement without corroborating investigation"
```

---

# APPENDIX I: EDUNEXUS TECHNOLOGY STACK REFERENCE

```
COMPLETE TECHNOLOGY STACK REFERENCE:

FRONTEND:
  Framework: Next.js 16 (App Router)
  Language: TypeScript (strict mode)
  Styling: Tailwind CSS
  UI Components: custom component library
  State management: Zustand (client state); React Query (server state)
  Real-time: Supabase Realtime (for notifications); SSE (for AI streaming)
  PWA: next-pwa (offline support, push notifications)
  Mobile: React Native (iOS + Android learner app)

BACKEND (API Layer):
  Runtime: Node.js (Next.js API routes)
  Validation: Zod (all API inputs)
  Authentication: Supabase Auth + custom JWT validation
  Rate limiting: Redis-backed token bucket per principal

DATABASE LAYER:
  Primary: PostgreSQL 16 (Supabase)
  Graph: Neo4j 5.x Enterprise
  Vector: pgvector extension on PostgreSQL
  Cache: Redis 7 (Upstash managed)
  Search: OpenSearch 2.x
  Analytics: ClickHouse (self-managed) or BigQuery (for national scale)
  Object storage: Supabase Storage (S3-compatible)
  Time-series: Supabase + TimescaleDB extension

EVENT STREAMING:
  Platform: Apache Kafka (Confluent Cloud or self-managed)
  Format: CloudEvents v1.0
  Schema: Confluent Schema Registry (Avro)

AI LAYER:
  Primary model: DeepSeek-V3 (primary language model)
  Embedding model: text-embedding-3-large (OpenAI) or equivalent
  Vision model: for portfolio artifact analysis
  Local inference: Ollama (for offline/private deployment scenarios)
  Orchestration: custom AI Orchestration Engine (lib/ai/)

INFRASTRUCTURE:
  Cloud: Multi-cloud (primary: cloud provider with Kenya data residency)
  Containers: Docker + Kubernetes (K8s)
  CI/CD: GitHub Actions
  Monitoring: Prometheus + Grafana
  Tracing: OpenTelemetry → Jaeger
  Alerting: PagerDuty
  Secrets: HashiCorp Vault (or cloud-native secrets manager)
  CDN: Cloudflare

DEVELOPER TOOLING:
  Version control: Git + GitHub
  Code review: GitHub Pull Requests (with CI checks)
  Testing: Vitest (unit), Playwright (E2E), custom AI evaluation suite
  Linting: ESLint + custom EduNexus rules
  Type checking: TypeScript tsc --strict
  Dependency scanning: Dependabot + Snyk

THIRD-PARTY INTEGRATIONS:
  Payments: Paystack (Kenya mobile money + card)
  WhatsApp: Meta Business API (parent communications)
  SMS: Africa's Talking (fallback notifications)
  Email: Resend
  Video: stream-io (for teacher broadcast sessions)
```

---

# APPENDIX J: GLOSSARY OF TERMS

```
EDUNEXUS CANONICAL GLOSSARY:

Academic Year:
  The period from the first school day of Term 1 to the last school day of Term 3.
  In Kenya: January to November (3 terms × approximately 13 teaching weeks).

Assessment:
  Any activity that generates evidence about a learner's competency state.
  Includes: formal tests, teacher observations, portfolio submissions, peer assessments,
  self-assessments, and national examinations.

Bi-temporal Data Model:
  A data model that tracks both when a fact was true (valid time) and when it was
  recorded by the system (transaction time). Enables point-in-time reconstruction of
  any historical state.

Bloom's Taxonomy:
  Anderson & Krathwohl's six-level taxonomy of cognitive complexity:
  Remember → Understand → Apply → Analyse → Evaluate → Create.
  Used in EduNexus to specify the cognitive level at which a competency should be mastered.

Calibration:
  The property of a probabilistic model where stated confidence matches empirical accuracy.
  A calibrated model that says "0.80 confidence" is correct approximately 80% of the time.
  EduNexus monitors calibration for all AI confidence claims and risk scores.

Canonical Truth:
  The authoritative, single representation of an educational fact, maintained by the
  owning domain and treated as the definitive source by all other domains.

Competency:
  In CBC: a specific, assessable learning target specifying what a learner should know,
  understand, or be able to do. Equivalent to "learning standard" or "learning objective"
  in other frameworks.

Competency State:
  EduNexus's persistent model of where a specific learner currently stands on a specific
  competency: the mastery level, confidence, evidence count, and bi-temporal validity.

Consequence Level:
  EduNexus's five-level classification of the educational consequence of an AI output.
  Level 1 (informational) through Level 5 (critical). Higher levels require more stringent
  human review before the output is delivered.

Core Competency:
  In CBC: one of seven cross-cutting competencies that all curriculum subjects develop.
  Distinct from curriculum competencies in that core competencies cannot be directly assessed
  in isolation — they emerge through the development of curriculum competencies.

Educational Knowledge Graph (EKG):
  EduNexus's central knowledge representation: a property graph containing all curriculum
  competencies, learner states, evidence, career pathways, and their relationships.

Educational Review Board (ERB):
  The human governance body that oversees all AI systems in EduNexus. Has authority to
  halt AI operations, require human review expansion, and mandate model changes.

Evidence:
  In EduNexus: any observation that provides information about a learner's competency state.
  Evidence is immutable, cryptographically signed, and retained indefinitely.

Evidence-First Reasoning:
  EduNexus's epistemic principle: all claims about a specific learner must cite specific
  evidence. Claims without evidence are hypotheses, not facts.

Gap:
  A detected discrepancy between a learner's current competency state and what the curriculum
  expects the learner to have achieved by this point. Gaps are classified by severity and
  analyzed for root causes.

IRT (Item Response Theory):
  A family of mathematical models describing the relationship between latent trait
  (competency level) and observed performance on assessment items. Used to calibrate
  assessment item difficulty and discrimination parameters.

k-Anonymity:
  A privacy property where every record in a dataset is indistinguishable from at least
  k-1 other records with respect to quasi-identifying attributes. EduNexus enforces k ≥ 10
  for all government-facing analytics outputs.

Knowledge-Grounded Generation (KGG):
  EduNexus's core AI architecture: no AI output about a specific curriculum, learner, or
  school is produced without first retrieving relevant structured knowledge from the EKG
  and injecting it as context.

Learner Model:
  The complete structured representation of a learner's educational state, including
  competency states, gaps, misconceptions, risk profile, and trajectory.

Mastery Level:
  One of five levels (Not Yet, Beginning, Developing, Proficient, Mastered) representing
  a learner's current standing on a curriculum competency.

Misconception:
  A systematic error in a learner's understanding of a concept — not a random mistake
  but a recurring error pattern that indicates a specific incorrect mental model.

PCI (Pertinent and Contemporary Issues):
  In CBC: cross-cutting themes that schools must integrate across subjects.
  Examples: Environmental Education, Financial Literacy, Comprehensive Sexuality Education.

Prerequisite:
  A competency that must be at least PROFICIENT before a target competency can be
  effectively learned. Represented as REQUIRES_PREREQUISITE edges in the EKG.

Risk Profile:
  A probabilistic assessment of the likelihood that a learner will not meet educational
  targets, with identified risk factors, trend analysis, and calibrated confidence.

Scaffolding:
  Instructional support provided to a learner to enable them to perform tasks they
  could not yet do independently. EduNexus uses 5 scaffolding levels from maximum
  support (Level 1) to minimal support (Level 5).

UCG (Universal Concept Graph):
  EduNexus's cross-curricular, cross-country curriculum concept graph that enables
  alignment between different national curricula.

Valid Time:
  In bi-temporal data: when a fact was true in reality (as opposed to transaction time,
  which is when the system recorded it).

Transaction Time:
  In bi-temporal data: when the system recorded a fact (as opposed to valid time,
  which is when the fact was true in reality).
```

---

*End of Expansion 3 — append to docs/edunexus-canonical-architecture.md*
