# EduNexus Standards Series

## Volume 1 — Educational Intelligence Design Patterns (EIDP)

**Edition 1.0 — June 2026**

---

> *A pattern describes a problem that occurs over and over again in our environment, and then describes the core of the solution to that problem, in such a way that you can use this solution a million times over, without ever doing it the same way twice.*
>
> — Christopher Alexander, A Pattern Language

---

## Preface

This volume documents reusable architectural patterns for educational intelligence systems.

These patterns have been extracted from the design and operation of production educational platforms. They represent solutions to recurring problems — problems that every team building educational software eventually encounters, often independently, often expensively.

A design pattern is not a code template. It is a named, documented solution to a class of problems in a given context. The value of a pattern is not that it provides copy-pasteable code. Its value is that it gives a team a shared vocabulary, a proven solution structure, and an explicit analysis of the tradeoffs involved.

A pattern called "Teacher Copilot" communicates instantly to any practitioner what architectural concerns are involved: AI generation, curriculum grounding, teacher workflow integration, streaming UX, human review, and quality validation. Without the pattern name, every team that encounters this problem must rediscover these concerns through painful experience.

This volume aims to spare educational technology teams that experience.

### How to Read This Volume

Each pattern follows the same structure:

- **Pattern Name and Classification** — The canonical name and the pattern family it belongs to
- **Context** — The broader situation in which the pattern applies
- **Problem** — The specific problem the pattern addresses, stated precisely
- **Forces** — The competing concerns that make the problem difficult
- **Solution** — The core insight that resolves the forces
- **Architecture** — The structural components and their relationships
- **API Design** — How this pattern is exposed through an API surface
- **Data Model** — The data structures the pattern requires
- **AI Considerations** — How AI capabilities integrate with the pattern
- **Security** — Security requirements specific to this pattern
- **Offline Support** — How the pattern behaves without network connectivity
- **Tradeoffs** — What is gained and what is sacrificed by adopting this pattern
- **Example Implementation** — A concrete reference implementation

### Pattern Classification

Patterns in this volume are classified by their primary concern:

- **[GEN]** — Generation patterns: AI content creation
- **[ASSESS]** — Assessment patterns: evaluation and measurement
- **[INTEL]** — Intelligence patterns: analytics and insight
- **[SYNC]** — Synchronization patterns: offline and distributed state
- **[FLOW]** — Workflow patterns: process and action coordination
- **[ENGAGE]** — Engagement patterns: stakeholder communication and motivation

---

## Pattern 1 — Teacher Copilot [GEN]

### Context

Teachers spend a disproportionate amount of their time on administrative and planning tasks rather than teaching. In Kenya, a secondary school teacher teaches 35–40 hours per week and is expected to produce lesson plans for every lesson, maintain a scheme of work for every term, update a record of work weekly, generate assessment instruments, and write report comments for 150–400 students per term. This volume of administrative output is incompatible with thoughtful, individualized preparation.

AI generation can dramatically reduce the time burden of these tasks. But naive AI generation — calling a general-purpose AI model and asking it to "write a lesson plan for Grade 8 Mathematics" — produces output that is educationally unreliable, curriculum-misaligned, and often culturally inappropriate.

### Problem

**How do you provide AI generation for teacher planning tasks in a way that is educationally trustworthy, curriculum-grounded, and integrated with the teacher's actual context?**

### Forces

- **Quality vs. Speed.** A teacher needs the generation to be fast enough to be useful in a planning session, but accurate enough to be trusted without extensive editing.
- **Curriculum accuracy vs. generality.** General AI models know education in the abstract. They do not know the specific learning outcomes for CBC Grade 8 Mathematics Strand 3.2.
- **Automation vs. agency.** Teachers must remain the professional decision-makers. AI output that positions itself as the answer, rather than a starting draft, erodes professional authority and produces passive acceptance of mediocre content.
- **Context richness vs. latency.** The more context fed to the AI (learner data, prior lessons, class composition), the better the output — but the more data must be retrieved, which adds latency.
- **Streaming vs. completeness.** Streaming responses give the teacher immediate feedback but make it harder to validate the complete output before display.

### Solution

**Separate the AI generation concern from the curriculum grounding concern. Ground the generation request with structured curriculum data before it reaches the AI model. Return the AI response as a draft that requires teacher approval before becoming a plan.**

The Teacher Copilot pattern has three components:

1. **Context Assembler** — Retrieves the curriculum data, class context, and prior lesson data relevant to the generation request before any AI call is made.
2. **Grounded Generator** — Calls the AI model with a system prompt that includes the assembled curriculum context, pedagogical constraints, and formatting requirements.
3. **Draft Manager** — Stores the AI output as a draft, never as a final document, and enforces a human review step before the draft is published.

### Architecture

```
Teacher Request
      │
      ▼
┌─────────────────┐
│ Context Assembler│
│ ─────────────── │
│ Curriculum data  │◄──── Curriculum Engine
│ Class data       │◄──── Learner Intelligence
│ Prior lesson     │◄──── Plan History
└────────┬────────┘
         │ Enriched context
         ▼
┌─────────────────┐
│ Grounded        │
│ Generator       │──── AI Gateway ──── AI Model
│ ─────────────── │
│ System prompt   │
│ Quality guards  │
│ Stream output   │
└────────┬────────┘
         │ Draft content
         ▼
┌─────────────────┐
│ Draft Manager   │
│ ─────────────── │
│ Store as draft  │
│ Notify teacher  │
│ Enforce review  │
│ Publish on      │
│ approval        │
└─────────────────┘
```

### API Design

```
POST /ai/lesson-plans/generate
{
  "teacher_id": "string",
  "class_id": "string",
  "curriculum": {
    "type": "CBC",
    "grade": 8,
    "subject": "mathematics",
    "strand_id": "S3",
    "sub_strand_id": "SS2"
  },
  "duration_minutes": 80,
  "prior_lesson_id": "string?",
  "context_richness": "standard | full",
  "stream": true
}

Response (draft):
{
  "draft_id": "draft_abc123",
  "status": "draft",
  "stream_url": "/ai/lesson-plans/drafts/draft_abc123/stream",
  "curriculum_context": { ... },
  "generated_at": "2026-06-29T10:00:00Z"
}

POST /ai/lesson-plans/drafts/{id}/approve
{
  "teacher_id": "string",
  "edits": { ... }  // optional teacher edits before approval
}
```

### Data Model

```sql
CREATE TABLE lesson_plan_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id),
  class_id     uuid NOT NULL REFERENCES classes(id),
  curriculum   jsonb NOT NULL,
  content      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'draft',  -- draft | approved | archived
  ai_model     text NOT NULL,
  ai_tokens    integer NOT NULL,
  context_hash text NOT NULL,  -- hash of the context used for generation
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### AI Considerations

- Always include the exact learning outcomes and performance indicators in the system prompt, not paraphrases.
- Include a negative constraint: "Do not reference learning outcomes not listed in this context."
- Validate generated content references against the curriculum before returning the draft.
- Track teacher edits to drafts: the delta between generated content and approved content reveals where the AI falls short.
- Never generate a complete lesson plan without the curriculum context. A fallback to unconstrained generation degrades educational trust.

### Security

- Only the teacher who owns the class may generate lesson plans for that class.
- The `teacher_id` must be verified from auth context, never from the request body.
- Drafts are private until approved. Only the originating teacher and school administrators may read drafts.
- AI generation endpoints must be rate-limited independently from read endpoints, as generation is significantly more expensive.

### Offline Support

Lesson plan generation requires network connectivity. The pattern should:

- Store approved plans in local cache for offline viewing and minor editing.
- Queue generation requests made offline and execute when connectivity is restored.
- Display a clear indicator when the teacher is working offline so they know generation is unavailable.
- Allow teachers to create and edit plans manually offline, with the AI generation option clearly marked as deferred.

### Tradeoffs

| Gained | Sacrificed |
|---|---|
| Curriculum accuracy in AI output | Additional latency for context assembly |
| Teacher agency through draft review | Slightly more complex UX (draft approval step) |
| Quality improvement through edit tracking | Storage cost for draft history |
| Protection against AI hallucination | Cannot offer instant final generation |

### Example Implementation

See the EduNexus open-source lesson plan generator reference application at `github.com/edunexus/examples/lesson-plan-generator`.

---

## Pattern 2 — Assessment Recording [ASSESS]

### Context

Competency-based assessment requires teachers to record observations, scores, and evidence against specific learning outcomes and performance indicators. This recording is qualitatively different from score entry in an examination-based system: it requires mapping a teacher's professional judgment onto a structured competency framework, for multiple learners, across multiple sub-strands, in a workflow that must be fast enough to be sustainable in a busy school.

### Problem

**How do you capture structured competency assessments from teachers in a way that is accurate, fast, and usable in real classroom conditions?**

### Forces

- **Structure vs. speed.** A fully structured form (one field per performance indicator per learner) is accurate but slow. A freeform interface is fast but loses structure.
- **Granularity vs. cognitive load.** The richer the data captured, the more cognitive effort required from the teacher.
- **Synchronous vs. asynchronous recording.** Recording during the lesson requires the teacher to split attention. Recording after the lesson relies on memory.
- **Individual vs. whole-class entry.** Entering observations for one student at a time is thorough but does not support the common classroom reality of noting the same outcome for multiple students.

### Solution

**Support three recording modes that trade off structure against speed, and allow teachers to choose based on context. All modes produce the same structured output for the learner model.**

The three recording modes:

1. **Observation mode** — The teacher writes a narrative observation. AI extracts structured competency assessments from the narrative.
2. **Quick mark mode** — The teacher selects a performance level (Below/Approaching/Meeting/Exceeding) for each learner against a single sub-strand.
3. **Bulk assignment mode** — The teacher selects a group of learners and assigns the same performance level to all, then adjusts individual exceptions.

### Architecture

```
Teacher Input (any mode)
         │
         ▼
┌──────────────────────┐
│ Assessment Recorder  │
│ ──────────────────── │
│ Mode: Observation    │──► Observation Extractor (AI)
│ Mode: Quick Mark     │──► Direct structure mapping
│ Mode: Bulk Assignment│──► Group assignment + exceptions
└────────┬─────────────┘
         │ Structured assessment records
         ▼
┌──────────────────────┐
│ Competency Updater   │
│ ──────────────────── │
│ Validate records     │
│ Update learner model │
│ Trigger events       │
└──────────────────────┘
```

### Data Model

```sql
CREATE TABLE assessment_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES learners(id),
  teacher_id      uuid NOT NULL REFERENCES teachers(id),
  class_id        uuid NOT NULL REFERENCES classes(id),
  curriculum_ref  jsonb NOT NULL,  -- strand, sub_strand, learning_outcome ids
  performance_level text NOT NULL, -- below | approaching | meeting | exceeding
  evidence_type   text NOT NULL,   -- observation | test | portfolio | peer
  evidence_text   text,
  source_mode     text NOT NULL,   -- observation | quick_mark | bulk
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON assessment_records (learner_id);
CREATE INDEX ON assessment_records (teacher_id);
CREATE INDEX ON assessment_records (class_id);
```

### AI Considerations

Observation mode uses AI to extract structured competency assessments from free text. The AI must:
- Reference only curriculum elements that are real and applicable to the teacher's context.
- Return confidence scores alongside each extraction.
- Flag extractions where the observation evidence is ambiguous.
- Never fabricate evidence — if the observation does not support a competency claim, do not make it.

### Security

- A teacher may only record assessments for learners in their own classes.
- Assessment records are immutable after 48 hours — edits create amendment records, not updates.
- School administrators may view but not modify teacher assessment records.

### Offline Support

Assessment recording is the most critical pattern for offline support. Teachers are frequently in classrooms without reliable connectivity.

- The mobile SDK must support full offline recording in all three modes.
- Offline records are stored locally with a sync queue.
- When connectivity is restored, records are synced with conflict resolution (the local record is canonical if recorded during an offline period).
- The UI must clearly indicate offline status and the number of unsynced records.

### Tradeoffs

| Gained | Sacrificed |
|---|---|
| Teacher flexibility across recording styles | Complexity of supporting three modes |
| Consistent learner model regardless of mode | AI extraction introduces error risk in observation mode |
| Fast whole-class recording via bulk mode | Bulk mode loses individual nuance |

---

## Pattern 3 — Offline Classroom Sync [SYNC]

### Context

Schools in emerging markets frequently have unreliable internet connectivity. A teacher using an educational application in a classroom may have no connectivity for hours at a time. Data that cannot be recorded offline is data that will never be recorded — teachers will not return after the fact to fill in gaps.

### Problem

**How do you design a data synchronization architecture that allows full educational application functionality without network connectivity, while maintaining data consistency when connectivity is restored?**

### Forces

- **Completeness vs. complexity.** Full offline support requires local storage, conflict resolution, and sync queues — all of which add significant engineering complexity.
- **Optimistic vs. pessimistic updates.** Optimistic updates (write locally, sync later) give the best UX but require robust conflict resolution. Pessimistic updates (require connectivity) are simple but unusable offline.
- **Data volume vs. storage constraints.** Syncing all data to the device is comprehensive but may exceed device storage. Selective sync is more practical but may cause unexpected data gaps.
- **Conflict resolution philosophy.** Last-write-wins is simple but loses data. Manual resolution is correct but burdensome. Domain-specific resolution rules (the teacher is authoritative for their class during an offline period) balance correctness and usability.

### Solution

**Implement a local-first data architecture with domain-specific conflict resolution rules. Define clearly which data is synced to the device, which operations are queueable, and which require online connectivity.**

Three categories of data:

1. **Always local** — Data that the teacher is the sole author of: assessment records they are creating, lesson plans they are drafting. These are optimistic: write locally, sync when online.
2. **Cached read** — Data the teacher reads but does not author: learner profiles, curriculum structure, class rosters. These are cached on device with TTL and refreshed when online.
3. **Online only** — Data that requires real-time consistency: AI generation, school-wide analytics, payment operations. These operations are blocked offline with a clear message.

### Architecture

```
Application Layer
    │
    ├── Local Store (SQLite / Room / Core Data)
    │     ├── Write queue (always-local operations)
    │     ├── Read cache (cached-read data)
    │     └── Sync metadata (last sync timestamps)
    │
    └── Sync Engine
          ├── Connectivity monitor
          ├── Upload processor (flush write queue)
          ├── Download processor (refresh cache)
          └── Conflict resolver
```

### Conflict Resolution Rules

For assessment records: if a record was created offline for a class the teacher owns, the local record is authoritative. Server records for the same learner/sub-strand in the same period are merged, not overwritten.

For lesson plan drafts: if a draft was edited both locally (offline) and remotely (e.g., on a different device) during the offline period, both versions are preserved and the teacher is presented with a diff and asked to reconcile.

For class rosters and learner profiles: the server is authoritative. Local cached versions are replaced on next sync.

### Data Model (Sync Queue)

```sql
CREATE TABLE sync_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation    text NOT NULL,   -- create | update | delete
  entity_type  text NOT NULL,   -- assessment_record | lesson_plan_draft | etc
  entity_id    uuid NOT NULL,
  payload      jsonb NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  synced_at    timestamptz,
  sync_error   text
);
```

### Security

- The local store must be encrypted at rest using the device's secure enclave.
- Sync operations use the same authentication as online operations — tokens are stored securely and refreshed transparently.
- Data in the sync queue must not include fields the teacher is not authorized to write.

### Tradeoffs

| Gained | Sacrificed |
|---|---|
| Full functionality without network | Engineering complexity of sync engine |
| No data loss during connectivity gaps | Conflict resolution edge cases require careful design |
| Excellent UX in low-connectivity environments | Increased device storage requirement |

---

## Pattern 4 — Curriculum Validation [GEN]

### Context

Educational software frequently embeds curriculum references: lesson plans, assessments, learning resources, and digital textbooks all reference specific learning outcomes, sub-strands, and performance indicators. In a system without a shared curriculum engine, these references are often inaccurate — authors write from memory, copy from unofficial sources, or reference curriculum elements that have been revised.

### Problem

**How do you ensure that educational content accurately references real curriculum elements and does not make claims that conflict with the authoritative curriculum?**

### Forces

- **Coverage vs. accuracy.** Checking only top-level references (subject, grade) is fast but misses specific errors. Checking down to performance indicator level is accurate but slow.
- **Pre-submission vs. continuous.** Validating content before submission catches errors early but adds friction to the authoring workflow. Continuous validation (as-you-type) is responsive but expensive.
- **Hard rejection vs. warnings.** Rejecting content with curriculum errors stops bad content from entering the system but may be too strict for content in draft state.

### Solution

**Implement a multi-level curriculum validation service that operates at different granularities for different contexts, and returns structured validation results that distinguish errors from warnings.**

Validation levels:

1. **Reference validation** — Checks that cited curriculum identifiers exist (strand id, sub-strand id, learning outcome id). Fast. Always on.
2. **Alignment validation** — Checks that the content of the lesson/assessment actually addresses the cited curriculum elements. Requires AI assessment. On submission or explicit request.
3. **Coverage validation** — Checks that all required learning outcomes in a sub-strand are addressed by a scheme of work. Operates at scheme level, not individual lesson level.

### Architecture

```
Content (lesson plan, assessment, resource)
          │
          ▼
┌──────────────────────┐
│ Reference Validator  │◄──── Curriculum Engine (sync lookup)
│ ──────────────────── │
│ Check all cited IDs  │
│ Return: valid/invalid│
└────────┬─────────────┘
         │
         ▼ (if valid)
┌──────────────────────┐
│ Alignment Validator  │◄──── AI Gateway (async)
│ ──────────────────── │
│ Content vs. outcomes │
│ Return: alignment %  │
└────────┬─────────────┘
         │
         ▼ (for schemes of work)
┌──────────────────────┐
│ Coverage Validator   │◄──── Curriculum Engine (coverage rules)
│ ──────────────────── │
│ All outcomes covered?│
│ Return: gap list     │
└──────────────────────┘
```

### API Design

```
POST /curriculum/validate
{
  "content_type": "lesson_plan | assessment | scheme_of_work | resource",
  "curriculum_refs": [
    { "type": "CBC", "grade": 8, "subject": "mathematics", "strand_id": "S3", "sub_strand_id": "SS2" }
  ],
  "content": "string | object",
  "validation_level": "reference | alignment | coverage"
}

Response:
{
  "valid": true,
  "validation_level": "alignment",
  "results": {
    "reference": { "passed": true, "errors": [] },
    "alignment": {
      "score": 0.87,
      "outcomes_addressed": [...],
      "outcomes_missing": [...],
      "warnings": ["Content addresses S3.SS2 but not S3.SS1 prerequisite — confirm learners have prerequisite mastery"]
    }
  }
}
```

### Tradeoffs

| Gained | Sacrificed |
|---|---|
| Accurate curriculum alignment in all content | AI alignment validation adds latency |
| Systematic prevention of curriculum errors | May surface false positives for deliberately creative content |
| Coverage assurance for schemes of work | Coverage validation requires complete scheme, not partial |

---

## Pattern 5 — Risk-Based Intervention [INTEL]

### Context

Schools typically become aware of a learner's difficulties after failure has already occurred — after a poor examination result, after parental complaint, after the learner has stopped attending. The data to identify risk much earlier is usually available: attendance patterns, assignment completion rates, formative assessment trends, teacher observations. But it is not systematically analyzed, and even when analyzed, it does not automatically trigger action.

### Problem

**How do you systematically identify learners at risk before they fail, and translate that identification into coordinated action across teachers, school administrators, and parents?**

### Forces

- **Sensitivity vs. specificity.** A model that flags everyone is not useful. A model that misses genuine cases is not safe. The threshold and the model design are critical.
- **Alert vs. overwhelm.** Too many alerts cause alert fatigue — teachers stop reading them. Too few miss genuine cases.
- **System action vs. teacher action.** Some responses to risk can be automated (parent notification). Others require professional teacher judgment (classroom support, referral). The system must not substitute for that judgment.
- **Privacy vs. transparency.** Sharing risk scores across stakeholders raises legitimate privacy concerns that must be governed carefully.

### Solution

**Implement a layered intervention model: the system detects, scores, and prioritizes risk; it generates intervention recommendations; it routes those recommendations to the appropriate human actors; and it tracks whether interventions are implemented and whether they work.**

The risk pipeline:

1. **Detection** — Continuous monitoring of incoming data for risk signals.
2. **Scoring** — Computing a risk score that aggregates signals with appropriate weights.
3. **Prioritization** — Ranking at-risk learners by urgency within a class or school.
4. **Recommendation** — Generating specific, actionable intervention recommendations.
5. **Routing** — Directing recommendations to the appropriate actor (teacher, head teacher, parent).
6. **Tracking** — Recording whether interventions are implemented and measuring their effect.

### Architecture

```
Data Signals
(assessments, attendance, engagement)
          │
          ▼
┌─────────────────┐
│ Risk Detector   │◄──── Streaming event subscription
│ ─────────────── │
│ Pattern matching│
│ Threshold gates │
└────────┬────────┘
         │ Risk signals
         ▼
┌─────────────────┐
│ Risk Scorer     │
│ ─────────────── │
│ Weighted model  │
│ Historical data │
│ Peer comparison │
└────────┬────────┘
         │ Risk scores
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Prioritizer     │     │ Recommender     │
│ ─────────────── │     │ ─────────────── │
│ Rank by urgency │     │ Suggest actions │
│ Deduplicate     │     │ Assign to actor │
└────────┬────────┘     └────────┬────────┘
         └───────────┬───────────┘
                     ▼
           ┌─────────────────┐
           │ Router & Tracker│
           │ ─────────────── │
           │ Notify actors   │
           │ Track follow-up │
           │ Measure effect  │
           └─────────────────┘
```

### Data Model

```sql
CREATE TABLE learner_risk_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id   uuid NOT NULL REFERENCES learners(id),
  score        integer NOT NULL CHECK (score >= 0 AND score <= 100),
  level        text NOT NULL,  -- low | moderate | elevated | critical
  factors      jsonb NOT NULL,
  model_version text NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interventions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid NOT NULL REFERENCES learners(id),
  risk_score_id   uuid NOT NULL REFERENCES learner_risk_scores(id),
  assigned_to     uuid NOT NULL,
  assigned_role   text NOT NULL,  -- teacher | head_teacher | parent
  recommendation  jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  implemented_at  timestamptz,
  outcome_score   integer,  -- effectiveness score after follow-up
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### AI Considerations

Risk scoring may use ML models, rule-based systems, or a combination. Any model must:
- Be interpretable: the teacher must understand why a learner is flagged.
- Be calibrated: a score of 70 should mean roughly the same risk across different schools and contexts.
- Be updated: as interventions are implemented and outcomes are measured, the model improves.
- Be auditable: every score must be traceable to its input signals.

### Privacy and Governance

- Risk scores are classified data. They are visible to the teacher, the head teacher, and (in aggregate summary form) to school administrators.
- Parents should not see numerical risk scores — they should see translated communications ("Your child may benefit from extra support in mathematics this term").
- Risk scores must not be shared across schools or used for comparisons that could stigmatize learners.

### Tradeoffs

| Gained | Sacrificed |
|---|---|
| Early identification before failure | Risk of false positives causing unnecessary concern |
| Coordinated multi-actor response | Requires intervention workflow discipline to be effective |
| Measurable intervention effectiveness | Outcome measurement requires follow-up data collection |

---

## Pattern 6 — AI Lesson Planning [GEN]

### Context

Lesson planning is the most time-consuming teacher administrative task. A well-designed lesson plan requires selection of appropriate content, sequencing of activities, differentiation for different learner needs, preparation of assessment checks, and alignment to the scheme of work. Each plan takes a skilled teacher 20–40 minutes to prepare thoughtfully.

### Problem

**How do you reduce the time cost of lesson planning while preserving the educational quality that comes from teacher professional judgment?**

(See Pattern 1 — Teacher Copilot for the core pattern. This pattern documents the specific AI lesson planning sub-pattern in detail.)

### Forces

- **Time savings vs. quality.** Speed is only valuable if the output is good enough to accept with light editing. A plan that requires rewriting saves no time.
- **Personalization vs. generality.** A generic plan for "Grade 8 Mathematics" is less useful than a plan calibrated to the specific class, with the specific knowledge of which sub-strands have been covered.
- **Prescription vs. creativity.** A plan that scripts every teacher action constrains professional creativity. A plan that provides a framework empowers it.

### Solution

**Generate a structured lesson plan skeleton with curriculum-grounded content for each section, differentiation suggestions based on class learner intelligence, and explicit empty spaces for teacher professional additions.**

Plan structure:

1. **Learning Objectives** — Generated directly from curriculum learning outcomes. Exact, not paraphrased.
2. **Prior Knowledge Activation** — Generated based on prerequisite sub-strands and learner model data.
3. **Main Teaching Activity** — Framework generated; specific examples are placeholders for teacher to personalize.
4. **Formative Assessment Check** — Generated aligned to performance indicators.
5. **Differentiation** — Remedial and extension suggestions generated from learner intelligence.
6. **Closure** — Generated summary activity.
7. **Resources** — Scaffolded list; teacher confirms availability.

### AI Considerations

The system prompt for lesson plan generation must include:
- Exact learning outcomes (verbatim from curriculum document, not paraphrased)
- Performance indicators for each outcome
- Class risk summary (percentage at each performance level)
- Prior lesson context
- CBC pedagogical principles (activity-based learning, inquiry-based approaches)
- Kenyan context guidance (use locally relevant examples)
- Explicit instruction: "Do not invent learning outcomes. Use only those listed."

---

## Pattern 7 — Competency Progression [INTEL]

### Context

Competency-based curriculum systems require tracking learner progress across a network of interconnected competencies rather than against a linear syllabus. A learner who has not mastered Sub-Strand 3.1 should not move to Sub-Strand 3.2 that depends on it. A learner who has mastered all sub-strands in a strand should be offered extension into a related strand.

### Problem

**How do you model competency progression in a way that reflects real prerequisite relationships, adapts to individual learner trajectories, and provides actionable information to teachers?**

### Forces

- **Graph complexity vs. usability.** The full curriculum prerequisite graph is complex. Exposing full complexity to teachers is overwhelming. Simplifying it loses important information.
- **Mastery thresholds vs. continuous assessment.** Is a learner "ready" for the next sub-strand when they score 70%? 80%? After one assessment or three? The threshold definition materially affects the learner experience.
- **Synchronous vs. asynchronous progression.** In a class of 40 learners, should instruction wait until all learners are ready? Should the class progress together even if some learners haven't mastered prerequisites?

### Solution

**Model competency states as a continuous probability distribution over performance levels, not a binary ready/not-ready gate. Surface the distribution to teachers as a class visualization. Identify prerequisite gaps that affect current instruction and surface them as teacher action items.**

Competency state representation:

```json
{
  "learner_id": "abc",
  "sub_strand_id": "CBC_G8_MATHS_S3_SS2",
  "state": {
    "level": "approaching_expectation",
    "confidence": 0.83,
    "evidence_count": 7,
    "evidence_span_days": 21,
    "trajectory": "improving",
    "prerequisite_states": {
      "CBC_G8_MATHS_S3_SS1": { "level": "meeting_expectation", "confidence": 0.91 }
    }
  }
}
```

### Data Model

```sql
CREATE TABLE competency_states (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id        uuid NOT NULL REFERENCES learners(id),
  curriculum_ref    text NOT NULL,   -- canonical curriculum element identifier
  performance_level text NOT NULL,
  confidence        numeric(5,4) NOT NULL,
  evidence_count    integer NOT NULL DEFAULT 0,
  trajectory        text NOT NULL,   -- improving | stable | declining
  last_evidence_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, curriculum_ref)
);
```

---

## Pattern 8 — Portfolio Assessment [ASSESS]

### Context

CBC places significant emphasis on portfolio-based assessment — learners accumulate evidence of competency over time through completed work, project outputs, teacher observations, and peer assessments. Managing a portfolio for 40 learners across 8 subjects requires digital infrastructure that paper-based systems cannot provide.

### Problem

**How do you build a digital portfolio system that captures rich evidence types, links evidence to curriculum competencies, and produces a coherent learner portrait over time?**

### Forces

- **Evidence richness vs. storage cost.** Photos, videos, and audio recordings are rich evidence but expensive to store.
- **Learner agency vs. teacher control.** Learners should be able to add their own evidence, but the evidence must be approved before it counts.
- **Curriculum alignment vs. creative expression.** Not all good learning fits neatly into a curriculum reference.

### Solution

**Build a portfolio as a curated evidence collection with explicit curriculum links. Separate evidence submission (learner action), evidence review (teacher action), and evidence publication (system action).**

Portfolio evidence types:
- Text (written work, reflection)
- Image (completed work, project photo)
- Audio (oral presentation recording)
- Video (performance, project demonstration)
- Link (external resource, published work)
- Teacher observation (linked from assessment records)
- Peer assessment (validated by teacher)

### Data Model

```sql
CREATE TABLE portfolio_evidence (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id       uuid NOT NULL REFERENCES learners(id),
  submitted_by     uuid NOT NULL,  -- learner or teacher
  evidence_type    text NOT NULL,
  content          jsonb NOT NULL,  -- type-specific content
  curriculum_refs  jsonb,           -- optional curriculum links
  status           text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON portfolio_evidence (learner_id);
```

---

## Pattern 9 — Parent Engagement [ENGAGE]

### Context

Parental engagement is one of the strongest predictors of learner outcomes. Yet most educational applications treat parents as passive recipients of information rather than active participants in the learning process. Effective parent engagement requires timely, relevant, actionable communication — not bulk newsletters or end-of-term reports.

### Problem

**How do you design a parent communication architecture that delivers relevant, actionable information at the right time through the right channel, without overwhelming parents or requiring significant teacher effort?**

### Forces

- **Frequency vs. fatigue.** Too many messages cause parents to disengage. Too few miss important moments.
- **Positive vs. negative framing.** Communicating only when there is a problem creates anxiety. Communicating only successes misses important concerns.
- **Specificity vs. privacy.** Specific communications ("Your child scored 45% on algebra") are more actionable but more sensitive than general ones ("Your child may benefit from additional support").
- **Channel preference.** Different parents prefer different channels: WhatsApp, SMS, email, in-app notification. A single-channel strategy excludes some parents.

### Solution

**Implement an event-driven parent notification system that triggers communications based on learner events, uses templates that transform educational data into parent-appropriate language, and respects channel preferences and frequency limits.**

Notification triggers:
- Risk level elevation (critical: immediate; elevated: weekly summary)
- Significant competency milestone achieved (positive event: immediate)
- Assessment result available (configurable: immediate or weekly)
- Attendance concern (configurable threshold)
- Term report available (immediate)
- Intervention assigned (immediate)

### Architecture

```
Learner Events
      │
      ▼
┌──────────────────┐
│ Notification     │
│ Router           │
│ ──────────────── │
│ Evaluate triggers│
│ Check frequency  │
│ Check preference │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Message Generator│◄──── AI Gateway (personalisation)
│ ──────────────── │
│ Select template  │
│ Fill with data   │
│ Translate to     │
│ parent language  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Channel Dispatcher│
│ ──────────────── │
│ WhatsApp         │
│ SMS              │
│ Email            │
│ In-app           │
└──────────────────┘
```

### Privacy

- Parent communications must never include numerical risk scores.
- Communications must not compare learners ("below average").
- All AI-generated parent communications require a human-readable review before sending (or use pre-approved template-based generation only).

---

## Pattern 10 — School Analytics [INTEL]

### Context

School administrators and head teachers need visibility into school-wide patterns: which subjects are struggling, which teachers need support, which cohort of learners requires intervention. This visibility has traditionally come from examination results — lagged, coarse, and available only at the end of a term.

### Problem

**How do you provide school administrators with real-time, actionable visibility into learning outcomes without requiring them to process individual learner data for hundreds of students?**

### Forces

- **Granularity vs. overwhelming.** Showing every learner's data to the head teacher is technically possible but practically useless. Aggregation is necessary.
- **Real-time vs. accuracy.** Real-time aggregates may be incomplete (not all assessments entered). Delayed aggregates are more accurate but less actionable.
- **Individual privacy vs. administrative need.** Aggregates that reveal small groups can effectively reveal individual data.

### Solution

**Build a hierarchical analytics model that provides pre-computed aggregates at each level of the school hierarchy — class, subject, grade, school — updated on a configurable cadence. Surface these aggregates through a dashboard oriented around action triggers, not data tables.**

Analytics hierarchy:
```
School
  ├── Grade 7
  │     ├── 7A (Class)
  │     │     ├── Mathematics
  │     │     │     ├── Strand 1 average: Meeting (87%)
  │     │     │     └── Strand 3 average: Approaching (45%) ⚠️
  │     │     └── Science
  │     └── 7B (Class)
  └── Grade 8
```

Action triggers in the dashboard:
- Red: >20% of learners at critical risk in any class
- Amber: Curriculum coverage falling behind in any class
- Amber: Teacher has not recorded assessments in >2 weeks
- Green: Class average improved >10% over prior period

### Privacy Safeguards

- Aggregates with fewer than 5 learners are suppressed to prevent individual identification.
- Teachers only see analytics for their own classes.
- Head teachers see school-wide aggregates and class-level summaries but not individual learner data unless they click through for pastoral purposes.

---

## Pattern 11 — Career Intelligence [INTEL]

### Context

The CBC curriculum explicitly intends to prepare learners for career success, not just examination performance. Yet the connection between classroom competencies and real-world career pathways is rarely made explicit for learners or teachers. A student studying mathematics in Grade 10 rarely understands which career pathways that competency opens or closes.

### Problem

**How do you connect a learner's competency profile to career intelligence in a way that is motivating, accurate, and actionable?**

### Forces

- **Inspiration vs. accuracy.** Showing a learner that they could be an engineer is motivating. But if their current competency profile makes engineering inaccessible without significant development, the inspiration may feel hollow or misleading.
- **Current state vs. potential.** Career matching based on current competency levels is accurate but may be unnecessarily limiting. Matching based on projected trajectory is more inspiring but less certain.
- **Individual vs. structural.** Career advice must acknowledge that career opportunities are shaped by structural factors (access, geography, family circumstance) that a competency profile cannot capture.

### Solution

**Generate career matches based on a learner's current competency profile and projected trajectory, with explicit gap analysis showing what development would be needed for each pathway. Frame all career intelligence as pathway exploration, not destiny.**

Career match output:
```json
{
  "learner_id": "abc",
  "career_matches": [
    {
      "career": "Secondary School Mathematics Teacher",
      "match_score": 0.82,
      "match_basis": "strong_current_competency",
      "required_competencies": [...],
      "current_gap": "small",
      "development_path": [...]
    },
    {
      "career": "Software Engineer",
      "match_score": 0.61,
      "match_basis": "trajectory_projection",
      "current_gap": "moderate",
      "development_path": [...]
    }
  ]
}
```

---

## Pattern 12 — Learning Trajectory Prediction [INTEL]

### Context

Understanding where a learner is today is valuable. Predicting where they will be in three months — given current trajectory and available interventions — is more valuable. It enables proactive rather than reactive educational management.

### Problem

**How do you predict a learner's educational trajectory in a way that is accurate enough to be actionable, interpretable enough to be trustworthy, and appropriately uncertain so as not to over-determine a learner's future?**

### Forces

- **Prediction accuracy vs. interpretability.** Complex ML models may be more accurate than simple models but harder for teachers to understand and trust.
- **Confidence vs. usefulness.** A highly uncertain prediction is technically honest but not actionable. An overconfident prediction may be harmful.
- **Historical patterns vs. intervention effect.** A trajectory prediction that does not account for the effect of potential interventions is less useful than one that models intervention scenarios.

### Solution

**Predict trajectories as probability distributions over future competency states, not as point estimates. Model multiple scenarios: baseline (no intervention), standard intervention, targeted intervention. Communicate uncertainty explicitly.**

### Prediction Output

```json
{
  "learner_id": "abc",
  "prediction_horizon_weeks": 8,
  "scenarios": {
    "baseline": {
      "projected_level": "approaching_expectation",
      "confidence_interval": { "low": "below", "high": "approaching" },
      "probability": 0.68
    },
    "standard_intervention": {
      "projected_level": "meeting_expectation",
      "probability": 0.74,
      "required_actions": [...]
    }
  },
  "model_version": "2026-06",
  "computed_at": "2026-06-29T10:00:00Z"
}
```

---

## Pattern 13 — Student Digital Portfolio [ASSESS]

### Context

This pattern extends Pattern 8 (Portfolio Assessment) with the additional dimension of learner-facing portfolio presentation — the portfolio as a personal record of achievement that the learner owns and can share with teachers, parents, universities, and employers.

### Problem

**How do you design a learner-owned portfolio that is educationally meaningful, shareable across contexts, and persistent across school changes?**

### Solution

**Issue portfolio credentials as verifiable digital credentials linked to the learner's identity, not to any specific school's system. Allow the learner to share specific subsets of their portfolio with specified recipients.**

Portfolio credentials are cryptographically signed by the issuing educational authority, allowing recipients to verify authenticity without contacting the issuing school.

---

## Pattern 14 — Observation Workflow [FLOW]

### Context

Teachers observe learner behaviour continuously throughout the school day. Most of these observations are never recorded — they inform the teacher's intuitions but do not enter any data system. Structured observation recording captures these professional insights in a form that can improve learner models and inform intervention decisions.

### Problem

**How do you make structured observation recording fast enough to be used in real classroom conditions, where a teacher has seconds rather than minutes to capture a note?**

### Forces

- **Capture speed vs. structure.** A fully structured form is too slow for real-time capture. Voice notes are fast but unstructured.
- **Interruption vs. completeness.** Pausing teaching to record an observation is disruptive. Waiting until after class loses precision.
- **Privacy vs. richness.** Some observations (about family situations, health, behaviour) are sensitive and require careful handling.

### Solution

**Implement a quick-capture mode that accepts voice, text, or emoji-based observation codes, with AI-powered structuring applied after the observation is saved. Never require the teacher to interrupt their teaching to complete a structured form.**

Quick capture modes:
- Voice note (transcribed and structured by AI post-capture)
- Freehand text note (structured by AI post-capture)
- Observation codes (configurable quick-tap codes: ✓ Active participation, ✗ Struggles independently, ★ Exceptional contribution)

Post-capture structuring runs as a background job and presents the structured version to the teacher for review at the end of the lesson.

---

## Pattern 15 — Educational Notification Pattern [ENGAGE]

### Context

Educational systems generate many events that are relevant to different stakeholders: learners, teachers, parents, administrators. Delivering the right notification to the right person at the right time, through the right channel, is an infrastructure challenge that most educational applications solve poorly — they either send too much, too little, or too generically.

### Problem

**How do you design a notification architecture that is domain-aware (understands educational context), persona-aware (differentiates between teacher, parent, and learner communications), and channel-aware (uses the appropriate delivery mechanism for each stakeholder)?**

### Solution

**Implement a notification routing engine that maps educational events to notification templates by persona and channel, with configurable delivery rules and frequency limits per persona.**

Notification routing rules:
```
Event: learner.risk_score.critical
  → Teacher: In-app (immediate) + Summary email (daily digest)
  → Head Teacher: In-app (immediate)
  → Parent: WhatsApp/SMS (immediate, parent-language template)
  → Learner: (no notification — teacher-mediated communication)

Event: assessment.result.available
  → Teacher: In-app (immediate)
  → Parent: In-app / WhatsApp (configurable: immediate or weekly digest)
  → Learner: In-app (immediate, learner-friendly template)
```

### Frequency Control

- Each persona-channel combination has a configurable maximum frequency.
- A parent cannot receive more than 3 WhatsApp messages per week from a single school unless the messages are critical.
- Frequency limits are enforced at the routing engine level, not at the channel level.

---

## Appendix — Pattern Quick Reference

| Pattern | Class | Primary Problem |
|---|---|---|
| Teacher Copilot | GEN | AI generation with curriculum grounding |
| Assessment Recording | ASSESS | Structured competency capture at classroom speed |
| Offline Classroom Sync | SYNC | Full functionality without network |
| Curriculum Validation | GEN | Ensuring content is curriculum-accurate |
| Risk-Based Intervention | INTEL | Early identification and coordinated action |
| AI Lesson Planning | GEN | Time reduction with quality preservation |
| Competency Progression | INTEL | Non-linear competency tracking |
| Portfolio Assessment | ASSESS | Rich evidence collection and curation |
| Parent Engagement | ENGAGE | Timely, relevant, actionable parent communication |
| School Analytics | INTEL | Actionable school-wide visibility |
| Career Intelligence | INTEL | Competency-to-career pathway connection |
| Learning Trajectory Prediction | INTEL | Proactive outcome prediction |
| Student Digital Portfolio | ASSESS | Learner-owned portable achievement record |
| Observation Workflow | FLOW | Real-time teacher observation capture |
| Educational Notification Pattern | ENGAGE | Domain-aware, persona-aware notification routing |

---

*EduNexus Standards Series — Volume 1: Educational Intelligence Design Patterns*

*Edition 1.0 — June 2026*
