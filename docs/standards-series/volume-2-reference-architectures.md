# EduNexus Standards Series

## Volume 2 — Educational Intelligence Reference Architectures

**Edition 1.0 — June 2026**

---

> *Architecture is not about making things look good. It is about making things work.*

---

## Preface

A reference architecture is a complete, validated design for a class of software systems. It is not a high-level diagram with boxes and arrows. It is a working blueprint: system context, domain model, component design, API integration points, authentication model, offline strategy, AI usage, analytics approach, scaling characteristics, security posture, deployment model, and cost structure.

This volume provides reference architectures for ten categories of educational system. Each architecture is designed to integrate with an educational intelligence platform — consuming curriculum intelligence, learner models, assessment services, and AI generation — rather than reinventing them.

The reference architectures are not prescriptive. They are starting points. Real systems must adapt to organizational constraints, existing infrastructure, commercial models, and team capabilities. The value of a reference architecture is not that you build it exactly as specified — it is that you understand the problem space thoroughly before you begin, and that you have a tested foundation to deviate from with intention.

---

## Architecture 1 — School ERP

### System Context

A school ERP (Enterprise Resource Planning) system is the operational backbone of a school. It manages enrollment, attendance, timetabling, examinations, fees, HR, and reporting. It is the source of truth for the school's basic operational data.

The ERP must integrate with educational intelligence to connect operational data (who is attending, who is enrolled, who is assigned to which class) with learning intelligence (how those learners are progressing, which are at risk).

```
┌──────────────────────────────────────────────────────────────────┐
│                     School ERP System                            │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │Enrollment│  │Attendance│  │Timetable │  │   Fee Management ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Student Records     │  │  Staff Management                │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Bidirectional integration
                                 ▼
                    Educational Intelligence Platform
                    (learner models, risk scores, AI)
```

### Domain Model

```
School
  ├── Academic Years
  │     └── Terms
  │           └── Weeks
  ├── Grades
  │     └── Classes
  │           ├── Enrollments (Student ↔ Class)
  │           └── Assignments (Teacher ↔ Class ↔ Subject)
  ├── Students
  │     ├── Personal Record
  │     ├── Guardian Contacts
  │     ├── Enrollment History
  │     └── Fee Account
  ├── Staff
  │     ├── Employment Record
  │     ├── Qualifications
  │     └── Teaching Assignments
  └── Infrastructure
        ├── Rooms
        └── Timetable Slots
```

### API Integration with Intelligence Platform

**ERP → Intelligence Platform (push):**
- On enrollment: `POST /learners` with basic learner record
- On class assignment: `POST /learners/{id}/class-enrollments`
- On attendance record: `POST /learners/{id}/attendance-events`
- On teacher assignment: `POST /teachers/{id}/class-assignments`

**Intelligence Platform → ERP (pull or webhook):**
- On `learner.risk_score.elevated`: ERP welfare flag is raised for head teacher review
- On `learner.trajectory.declining`: ERP pastoral care record is updated
- On term end: ERP pulls aggregated progress summaries for official record

### Authentication

The ERP integrates as a service account with the intelligence platform. The service account has:
- `learner:write` — to push enrollment and attendance data
- `learner.risk:read` — to pull risk scores for welfare management
- `teacher.assignments:write` — to push class assignments
- `events.subscribe:learner.risk.*` — for real-time risk alert webhooks

### Offline Support

The ERP is a server-side system. It does not require offline support in the mobile sense. However, it must handle connectivity interruptions gracefully:

- Outbound events to the intelligence platform are queued and retried
- Incoming webhook events are acknowledged immediately and processed asynchronously
- The ERP's own database is the source of truth for operational data; intelligence platform data is advisory

### AI Usage

The school ERP uses AI generation sparingly:
- Automated letter generation (admission letters, fee reminders) using AI templates
- Attendance report narrative generation for head teacher dashboards
- Staff deployment recommendation (given teaching load data)

AI in the ERP is always supplementary and always human-reviewed before sending.

### Analytics

ERP analytics orient around operational metrics:
- Daily attendance rates by class and grade
- Fee collection rates
- Examination registration compliance
- Timetable utilization

These feed into the School Intelligence Dashboard separately from learning analytics.

### Scaling

A school ERP is low-volume: a school of 1,000 students generates perhaps 5,000–10,000 operational events per school day. The system does not require distributed scaling. A well-optimized relational database with appropriate indexes handles this volume comfortably.

A district-level ERP aggregating hundreds of schools scales horizontally at the integration layer, with a fan-out webhook processing architecture and read replicas for reporting.

### Security

- All personal data encrypted at rest with field-level encryption for sensitive fields (medical information, guardian contact details)
- All API traffic over TLS 1.3
- Fee transaction data compliant with PCI DSS
- Guardian contact data access limited to authorized administrative roles
- Student records access logged and auditable

### Deployment

Recommended deployment for a Kenyan school ERP:
- Application: containerized on a managed Kubernetes service (DigitalOcean, GCP, or AWS)
- Database: managed PostgreSQL (Supabase or similar)
- Storage: object storage for document uploads (fee receipts, admission forms)
- CDN: for the teacher and administrator web interface

For on-premise requirements (some government schools): containerized deployment on local server with periodic cloud sync.

### Cost Model

| Component | Estimated Monthly Cost (100-student school) |
|---|---|
| Application hosting | $20–40 |
| Database | $25–50 |
| Storage | $5–10 |
| Intelligence platform API | $10–30 |
| SMS notifications | $5–20 |
| **Total** | **$65–150** |

---

## Architecture 2 — Learning Management System

### System Context

An LMS manages the delivery of learning content, the assignment and collection of learner work, and the communication between teachers and learners in a structured digital environment. In a CBC context, the LMS must integrate tightly with the curriculum structure, the assessment engine, and the learner intelligence engine.

### Domain Model

```
Course (maps to: Teacher × Class × Subject × Term)
  ├── Modules (maps to: Strand × Sub-Strand)
  │     └── Lessons (maps to: Teaching Week × Sub-Strand)
  │           ├── Content Items
  │           │     ├── Text/Video/Audio resources
  │           │     └── Interactive activities
  │           └── Assessments
  │                 ├── Formative checks
  │                 └── Assignment submissions
  └── Grade Book
        └── Competency records
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LMS Application                          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │ Content    │  │ Assignment │  │    Grade Book          ││
│  │ Authoring  │  │ Management │  │    (Competency-based)  ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Learner Portal                              │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  Curriculum Engine    Learner Intelligence   AI Gateway
  (content alignment)  (learner model update) (content gen)
```

### Curriculum Integration

All course content is tagged with CBC curriculum references. The LMS integrates with the Curriculum Engine to:

- Validate that content tags are accurate
- Suggest curriculum tags for untagged content using AI alignment analysis
- Enforce curriculum coverage — a course must cover all required sub-strands for the subject/grade/term
- Display curriculum progress alongside content progress

Content alignment is validated on publication:
```
POST /curriculum/validate
{
  "content_type": "resource",
  "curriculum_refs": ["CBC_G8_MATHS_S3_SS2"],
  "content": "...",
  "validation_level": "alignment"
}
```

### Assessment Integration

LMS assessments feed results to the Assessment Engine and, through it, to the Learner Intelligence Engine:

```
POST /assessments/{id}/results
{
  "learner_id": "abc",
  "responses": [...],
  "completed_at": "2026-06-29T10:00:00Z"
}
```

The Assessment Engine evaluates responses, returns structured results, and triggers a competency state update in the Learner Intelligence Engine.

### AI Usage in LMS

- Content generation: teachers can generate draft content items using the AI API, tagged to specific curriculum positions
- Question generation: formative check questions generated for any content item
- Explanation generation: learners can request alternative explanations of content
- Feedback generation: automated draft feedback on submitted written work
- Summary generation: lesson summary generation from content items

All AI generation passes through the AI Gateway for curriculum grounding and quality validation.

### Offline Support

The LMS requires strong offline support for both teachers (content authoring in low-connectivity environments) and learners (content consumption and formative activity completion without internet).

Offline capability:
- Content items cached on device for offline viewing
- Formative assessment responses queued and synced when online
- Assignment submissions stored locally with retry on connectivity
- Grade book reads from local cache; writes queued

### Analytics

LMS analytics connect to the School Intelligence API:
- Content engagement rates (viewed, completed, time-on-page)
- Assignment completion rates and latency
- Assessment performance distribution
- Learner activity time distribution (time-of-day patterns, session length)

### Scaling

An LMS for a single school handles ~200–1,000 concurrent users at peak. This is easily handled by a single well-provisioned server. A district LMS serving 50 schools with 50,000 learners requires horizontal scaling:

- Stateless application layer behind a load balancer
- Read replicas for the learner activity database
- CDN for content delivery (video and image assets)
- Async job queue for AI generation and analytics aggregation

---

## Architecture 3 — Assessment Platform

### System Context

A specialized assessment platform manages the creation, delivery, marking, and analytics of formal assessments. It may serve a single school, a district, or (at national scale) an entire examination system.

### Domain Model

```
Assessment Bank
  └── Items
        ├── Item Type (MCQ, short answer, essay, project)
        ├── Curriculum Alignment
        ├── Difficulty Calibration
        └── Marking Scheme

Assessment Instrument
  ├── Items (selected from bank)
  ├── Delivery Configuration
  └── Rubrics

Assessment Session
  ├── Learner Responses
  ├── Marking Status
  └── Results

Result Analytics
  ├── Item Analysis
  ├── Class Performance
  └── Cohort Comparison
```

### Assessment Engine Integration

The assessment platform integrates with the platform Assessment Engine for:

- Curriculum alignment validation of assessment items
- Rubric generation for open-ended responses
- Automatic marking of structured response items
- Psychometric calibration (item difficulty and discrimination calculation)
- Competency state updates from assessment results

```
POST /assessments/items/validate-alignment
POST /assessments/rubrics/generate
POST /assessments/{id}/results/submit
GET  /assessments/{id}/analytics
```

### Adaptive Assessment Architecture

For sophisticated assessment platforms, adaptive assessment adjusts item difficulty based on the learner's real-time performance. The platform provides:

```
GET /learners/{id}/model?fields=competency_states
```

The assessment platform uses the current competency state to select items at an appropriate difficulty level, then updates the model after the session.

### Security for Assessment Contexts

- Assessment sessions must be authenticated and device-bound to prevent sharing
- Timed assessments enforce server-side timing, not client-side
- Response data is encrypted in transit and at rest
- Examination-grade deployments include anti-cheating measures (randomized item ordering, no copy-paste)
- All marked results are signed by the marking authority before being transmitted to the intelligence platform

### Scaling for National Examinations

A national examination system may deliver assessments to 500,000+ learners simultaneously. This requires:

- Assessment delivery as a stateless service with horizontal scaling
- Response storage using a write-optimized database (append-only log)
- Marking as an async batch process, not real-time
- Results publication as a bulk export, not individual API calls
- Load testing to verify 10× expected peak capacity before any major examination

---

## Architecture 4 — Parent Portal

### System Context

A parent portal provides guardians with visibility into their children's educational progress, communication with teachers, and access to school operational information. It must present complex educational data in accessible, non-specialist language.

### Domain Model

```
Parent Account
  ├── Children (linked learner records)
  │     ├── Progress Summary (per subject, per term)
  │     ├── Risk Status (translated to parent-appropriate language)
  │     ├── Recent Assessments
  │     ├── Portfolio Items
  │     └── Attendance Summary
  ├── Communication Inbox
  │     ├── Teacher Messages
  │     ├── School Announcements
  │     └── Automated Alerts
  └── School Information
        ├── Term Calendar
        ├── Fee Statements
        └── Event Notifications
```

### Intelligence API Usage

```
GET  /intelligence/learners/{id}/model?fields=trajectory,risk_profile
GET  /intelligence/learners/{id}/progress/timeline
GET  /learners/{id}/assessments?limit=10
GET  /learners/{id}/portfolio/evidence?status=approved
```

All intelligence data is transformed before display:
- Risk scores are never shown numerically to parents
- Performance levels are translated: "Meeting Expectation" becomes "Your child is performing well in this area"
- Trajectory direction is communicated: "improving", "stable", or "may benefit from additional support"

### AI Usage in Parent Portal

- Progress report generation: AI generates narrative progress reports from structured learner model data
- Communication drafting: teachers can draft parent communications using AI
- Question answering: parents can ask questions ("How is my child doing in mathematics?") and receive AI-generated answers from learner data

### Authentication

Parent authentication must be robust but accessible:
- Email/phone number registration with OTP verification
- Optional biometric login on mobile (fingerprint, face ID)
- Family account support: one parent account linked to multiple children
- Delegation: parents can grant read-only access to another guardian

### Privacy

Parent portals handle sensitive personal data for minors. Requirements:
- Parents can only see data for their own children
- Parent access is governed by the school — a school administrator can revoke a parent's access
- All parent access is logged
- Parents receive a privacy notice explaining what data they can see and how it is used
- Data retention matches the school's retention policy

### Mobile-First Design

Parent portals in Kenya must be designed mobile-first:
- The primary client is a smartphone with a small screen
- WhatsApp-native notifications are preferred over email for most communications
- Data usage should be minimized (lazy-load images, compress responses)
- Offline reading of cached progress data should work without connectivity

---

## Architecture 5 — Teacher Portal

### System Context

The teacher portal is the primary professional workspace for CBC teachers. It encompasses lesson planning, scheme of work management, record of work tracking, assessment creation, learner observation, class analytics, and professional development. It is the tool teachers use every day.

### Domain Model

```
Teacher Workspace
  ├── My Classes
  │     └── Class
  │           ├── Learner List (with risk indicators)
  │           ├── Assessment Records
  │           ├── Class Analytics
  │           └── Curriculum Progress
  ├── Planning
  │     ├── Schemes of Work
  │     ├── Lesson Plans
  │     └── Record of Work
  ├── Assessments
  │     ├── Assessment Bank (shared + personal)
  │     ├── Active Assessments
  │     └── Results
  └── Professional
        ├── CPD Portfolio
        ├── Observations Received
        └── Recommendations
```

### AI Integration Points

The teacher portal has more AI integration points than any other system:

| Task | AI Pattern | Frequency |
|---|---|---|
| Lesson plan generation | Teacher Copilot | Daily |
| Scheme of work | Copilot (full term) | Once per term |
| Assessment item generation | Assessment Generator | Weekly |
| Observation analysis | Observation Extractor | Daily |
| Risk recommendations | Risk Recommender | Weekly |
| Report comments | Comment Generator | End of term |
| Curriculum validation | Curriculum Validator | On demand |

All AI generation follows the draft review pattern: the teacher sees AI output as a draft and must approve before it becomes a final record.

### Offline Architecture

The teacher portal requires the most comprehensive offline support:

Cached for offline access:
- Class roster and learner profiles
- Scheme of work (read)
- Current lesson plan
- Blank assessment forms
- Prior assessment records

Queueable operations (execute offline, sync when online):
- Assessment recording (all three modes)
- Quick observations
- Lesson plan edits (not AI generation)
- Record of work updates

Online-only operations:
- AI generation
- School-wide analytics
- Communication with parents

### Performance Requirements

Teachers use the portal in short windows: ten minutes in a staffroom, five minutes before a lesson. Performance requirements:

- Initial load < 2 seconds on 3G
- Class roster load < 1 second
- Assessment record submission < 500ms (offline queue + background sync)
- AI generation: first token < 2 seconds, full plan in < 30 seconds

---

## Architecture 6 — Career Guidance Platform

### System Context

A career guidance platform helps learners explore career pathways, understand what competencies different careers require, and develop plans to build those competencies. In the CBC context, it connects CBC Senior School subject choices and competency profiles to Kenya's labor market and higher education pathways.

### Domain Model

```
Learner Career Profile
  ├── Current Competency Profile (from intelligence platform)
  ├── Career Interests (explicit: learner-stated)
  ├── Career Matches (computed: competency-based)
  ├── Pathway Plans
  │     └── Pathway
  │           ├── Target Career
  │           ├── Required Competencies
  │           ├── Current Gaps
  │           └── Development Actions
  └── Exploration History
        ├── Careers Viewed
        └── Simulations Run
```

### Career Intelligence API Usage

```
POST /intelligence/learners/{id}/careers/match
GET  /intelligence/learners/{id}/careers/trajectory
GET  /careers?subject_alignment=mathematics&grade=10
GET  /careers/{id}/competency-requirements
POST /intelligence/learners/{id}/growth/model?scenario=career_preparation
```

### Life Simulation Engine

The career platform includes a simulation feature: learners can see projected outcomes of different subject choice and pathway decisions. The intelligence platform's growth modeling API provides the data:

```
POST /intelligence/learners/{id}/growth/model
{
  "scenarios": [
    { "name": "STEM pathway", "subject_choices": [...] },
    { "name": "Arts pathway", "subject_choices": [...] }
  ],
  "horizon_years": 3
}
```

The platform visualizes these scenarios as diverging career trajectories, helping learners understand the downstream consequences of current choices.

### AI in Career Guidance

- Career narrative generation: AI generates personalized "what this career looks like" explanations calibrated to the learner's background
- Gap analysis narrative: AI explains what the learner needs to develop to reach a specific career, in motivating, actionable language
- Interview preparation: AI conducts mock interviews for target careers using the learner's competency profile as context

---

## Architecture 7 — Digital Library

### System Context

A digital library provides curated educational resources — textbooks, reference materials, reading materials, past papers, multimedia content — organized around the curriculum structure. It integrates with the intelligence platform to personalize recommendations and to ensure that content is accurately curriculum-aligned.

### Domain Model

```
Library Collection
  └── Resource
        ├── Metadata (title, author, publisher, level)
        ├── Content (text, PDF, video, audio, interactive)
        ├── Curriculum Alignment (CBC sub-strand references)
        ├── Reading Level Assessment
        └── Usage Analytics
```

### Personalization Integration

```
GET /intelligence/learners/{id}/model?fields=competency_states,trajectory
```

The library uses the learner's competency profile to:
- Surface resources aligned to sub-strands the learner is currently studying
- Recommend remedial resources for identified gaps
- Surface extension resources for areas of mastery
- Adjust recommended reading level based on learner language competency

### Curriculum Validation for Publishers

Publishers submitting content to the library use the Curriculum Validation API to validate alignment before submission:

```
POST /curriculum/validate
{
  "content_type": "resource",
  "curriculum_refs": [...],
  "content": "...",
  "validation_level": "alignment"
}
```

Content with alignment scores below threshold is flagged for review before publication.

### Offline Content Strategy

A digital library must support offline reading:
- Content is downloaded on WiFi and read offline
- Downloads are prioritized by curriculum relevance (content for the current week's lessons is auto-downloaded if below data limit)
- Downloaded content tracks reading progress for analytics
- Expired content is evicted from cache based on recency and curriculum relevance

---

## Architecture 8 — Government Dashboard

### System Context

A government education dashboard gives national and county education officers visibility into learning outcomes across all schools in their jurisdiction. It aggregates data from all connected schools and provides analytics at district, county, and national levels.

### Data Aggregation Architecture

The government dashboard does not access individual learner or school data directly. It accesses pre-computed aggregates via the School Intelligence API:

```
GET /intelligence/jurisdictions/{id}/dashboard
GET /intelligence/jurisdictions/{id}/schools/rankings
GET /intelligence/jurisdictions/{id}/curriculum-coverage
GET /intelligence/jurisdictions/{id}/risk/cohorts
GET /intelligence/jurisdictions/{id}/trends?from=2026-01-01&to=2026-06-29
```

### Privacy Architecture

Government access follows the principle of progressive disclosure:
- At national level: only national aggregates (no school-level data)
- At county level: county and school-level aggregates (no class-level data)
- At district level: district, school, and class-level aggregates (no individual learner data)
- Individual learner data: only accessible by the school itself and authorized welfare officers

### Alert System

The government dashboard includes an automated alert system:
- Schools where risk cohort exceeds 25% of enrollment
- Schools where curriculum coverage falls below 60% by mid-term
- Schools with no assessment data submitted in two weeks (possible data quality issue)
- Schools with attendance below 70%

Alerts route to the appropriate education officer level based on the geographic scope.

### Policy Simulation

A sophisticated government dashboard includes policy simulation capability: "If we deploy 500 additional mathematics teachers to the 100 highest-need schools, what is the projected impact on Grade 8 mathematics outcomes?"

This integrates with the Growth Modeling API and a teacher deployment model maintained separately by the government system.

---

## Architecture 9 — Research Platform

### System Context

An educational research platform provides accredited researchers with governed access to educational data for longitudinal studies, intervention evaluation, and policy research. It provides analytical tools for large-scale data analysis while maintaining strict privacy and ethical governance.

### Data Access Model

Research access is layered:

**Aggregate access (open to all accredited researchers):**
Pre-computed anonymized aggregates: national, county, school-type, year-of-study averages.

**Micro-data access (governed access):**
Anonymized individual-level longitudinal records for approved research projects. Access granted per-project with an ethics review.

**Linked data access (restricted access):**
Anonymized data linked across domains (education + employment outcomes). Access only for national research bodies with ministerial approval.

### Anonymization Architecture

All micro-data is anonymized before research access:
- Direct identifiers (name, school name, geographic identifiers below county level) are removed
- Quasi-identifiers (grade + gender + year) are assessed for re-identification risk using k-anonymity
- Small groups (< 5 learners) are suppressed
- Differential privacy noise is added to numerical aggregates

### Research API

```
GET  /research/aggregates?level=county&metric=competency_coverage&year=2026
POST /research/cohort-query (governed access, per-project token)
GET  /research/longitudinal/{cohort_id}/outcomes (governed access)
```

### Ethical Governance

All research access requires:
- Institutional ethics approval
- Data handling agreement
- Named researcher identification and vetting
- Purpose limitation (data used only for approved research)
- Output review before publication (checking for re-identification risk)
- Annual renewal

---

## Architecture 10 — School Operating System

### System Context

The school operating system is the complete digital infrastructure of a school, unifying all the functional systems described in Architectures 1–5 into a coherent platform with shared data, shared identity, and a unified experience for all stakeholders.

This is the most complex reference architecture. It is a meta-architecture: a design for how multiple systems integrate, not for a single system.

### Component Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    School Operating System                         │
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ School ERP  │  │    LMS      │  │ Assessment  │               │
│  │ (Arch 1)    │  │  (Arch 2)   │  │ Platform    │               │
│  └──────┬──────┘  └──────┬──────┘  │  (Arch 3)   │               │
│         │                │         └──────┬───────┘               │
│  ┌──────┴────────────────┴────────────────┴───────────────────┐   │
│  │                    Shared Identity (SSO)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐  │
│  │  Teacher    │  │           Event Bus                         │  │
│  │  Portal     │◄─┤  (connects all systems, routes events)      │  │
│  │  (Arch 5)   │  └─────────────────────────────────────────────┘  │
│  └──────┬──────┘                                                   │
│         │                                                          │
│  ┌──────▼──────┐  ┌─────────────┐                                 │
│  │  Parent     │  │ Digital     │                                 │
│  │  Portal     │  │ Library     │                                 │
│  │  (Arch 4)   │  │  (Arch 7)   │                                 │
│  └─────────────┘  └─────────────┘                                 │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ Shared intelligence integration
                                 ▼
                    Educational Intelligence Platform
```

### Shared Identity

All SOS components share a single identity provider:
- A teacher logs in once and accesses the ERP, LMS, Teacher Portal, and Assessment Platform with a single session
- A student logs in once and accesses the LMS, Digital Library, and Assessment Platform
- A parent logs in once and accesses the Parent Portal and (where permitted) the LMS

Single sign-on is implemented using the platform Identity service with OIDC.

### Event Bus Architecture

The event bus connects all SOS components:

| Event Producer | Event | Event Consumer |
|---|---|---|
| School ERP | enrollment.created | LMS, Teacher Portal |
| LMS | assignment.submitted | Assessment Platform |
| Assessment Platform | result.available | Intelligence Platform, Teacher Portal, Parent Portal |
| Intelligence Platform | risk_score.elevated | Teacher Portal, Parent Portal, School ERP |
| Teacher Portal | lesson_plan.approved | LMS, Record of Work |

The event bus ensures that a change in any component propagates to all interested components without tight coupling.

### Data Model Unification

Each component maintains its own domain model, but shares a canonical identifier scheme:
- Every learner has a single `learner_id` used across all components
- Every teacher has a single `teacher_id`
- Every class has a single `class_id`
- Every curriculum element has a single curriculum reference (e.g., `CBC_G8_MATHS_S3_SS2`)

These identifiers are issued by the intelligence platform's identity service, not by individual components.

### Deployment Model

An SOS deployed for a single school:
- Each component is independently deployable (microservice architecture)
- All components run on the same Kubernetes cluster
- Shared PostgreSQL database with component-specific schemas and RLS
- Shared Redis for session management and event queue
- Single ingress with path-based routing to each component

A district SOS serving 50 schools:
- Each school gets its own isolated tenant in the shared infrastructure
- Components share infrastructure but not data (tenant isolation enforced at the DB level)
- Control plane services (identity, event bus, analytics) are shared across tenants

### Security Architecture

The SOS is the most sensitive architecture because it combines all school data in one place:

- Every inter-component API call is authenticated (service account tokens)
- Tenant isolation is enforced at every database query (row-level security)
- All component-to-component communication uses encrypted channels within the cluster
- Audit logs for all data access are centralized and immutable
- Penetration testing is required before production deployment
- Data backup and recovery are tested quarterly

---

*EduNexus Standards Series — Volume 2: Educational Intelligence Reference Architectures*

*Edition 1.0 — June 2026*
