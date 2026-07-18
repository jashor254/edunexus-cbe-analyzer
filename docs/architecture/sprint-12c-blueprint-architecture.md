# Sprint 12C — Learner Blueprint Architecture Freeze

**Status: architecture only. No code, migration, repository, service, route, or UI was created, renamed, or modified in producing this document.**

**Companion to**: `adr-0005-learner-blueprint-architecture.md` (the binding decision — read that first). This document expands each section's fields, ownership, and rendering intent; the ADR is the enforceable rule, this document is the reference detail beneath it.

---

## 1. Purpose

Define, permanently, what the Learner Blueprint is before any of the five planned integrations (Parent Portal, Learning Compass, Career Intelligence, Behaviour, Evidence/Intelligence) begin. This mirrors what Sprint 12A did for Attendance before Sprint 12B could safely integrate it — freeze the shape and the ownership rules first, implement second.

---

## 2. Canonical Blueprint Sections

### 2.1 Identity
- Learner profile (name, DOB where applicable, admission number)
- School, Grade, Class
- Admission details
- Guardian summary
- **Owner**: Core (School/Class/Guardian domains). **Freshness**: live read of current enrollment state.

### 2.2 Academic Record
- Overall performance
- Subject performance
- Growth trend
- CBC competencies
- Historical performance (references, not recomputation, of past report cards)
- **Owner**: Assessments domain, via the Projection Engine. **Freshness**: live — must be reconstructed via `recomputeLearnerProjection()`, per RAS §9, never a direct read of `assessments`/`class_assessments`. This is the exact gap `sprint-12c-academic-clinic-hardening.md` found already open in `lib/academicClinic/`; this ADR does not fix that gap (out of scope, architecture-only) but records the rule the eventual fix must satisfy.

### 2.3 Attendance Summary
- Days Present, Days Absent, Attendance percentage, Trend
- **Owner**: Attendance domain. **No attendance business logic lives in Blueprint** — Blueprint consumes only published attendance summaries, the same discipline Report Cards already follows (Sprint 12B: `getAttendanceStatusCountsForClass`, computed fresh by the consumer from Attendance's raw data, per ADR-0004 §4). **Freshness**: Snapshot — Blueprint does not recompute per-record attendance itself; it reads Attendance's own summary function output.

### 2.4 Learning Compass
- Learning readiness, current mastery, recommended learning path, holiday learning plan, adaptive learning readiness
- **Owner**: Learning Compass. **Blueprint never recalculates these** — it reads Compass's own canonical output. **Freshness**: Live.

### 2.5 Career Intelligence
- Career readiness summary, top strengths, suggested pathways, future opportunities
- **One concise insight only.** Blueprint must never duplicate the complete Career Intelligence report (the same "one insight only" discipline as §2.4, and the direct rationale for the QR strategy, §6). **Owner**: Career Intelligence. **Freshness**: Live.

### 2.6 Behaviour
- **Reserved. No implementation, no schema, no calculation defined by this ADR.** Placeholder section only, to prevent a future Behaviour sprint from needing to re-litigate where it fits in Blueprint's structure.

### 2.7 Teacher Insights
- Teacher narrative, strengths, areas for improvement, recommended interventions
- **Owner**: the authoring teacher, at time of writing. **Freshness**: Snapshot — authored text is not recomputed retroactively.

### 2.8 Parent Summary
- Simple language, readable, short, no educational jargon.
- **Owner**: none independently — this is a presentation transform over §2.1-2.7's data, not a new data source. **Freshness**: inherits the freshness of whichever underlying section it summarizes; must not claim a different "as of" time than its sources.

### 2.9 Learner Growth Timeline
- Major milestones: academic progress, attendance milestones, Learning Compass milestones.
- **Future extension point only** — not implemented this sprint. Composes milestones from the domains above; owns none of them, same as every other section.

---

## 3. Domain Ownership Matrix

(Restated from ADR-0005 §3 for reference completeness.)

| Domain | Owner | Consumed by Blueprint? |
|---|---|---|
| Assessment | Assessments domain | Yes |
| Attendance | Attendance domain | Yes (published summaries only) |
| Learning Compass | Compass domain | Yes (one insight) |
| Career Intelligence | Career Intelligence domain | Yes (one insight) |
| Behaviour | Reserved | Future only |
| Evidence | Evidence domain | Indirect only, via Projection |
| Report Cards | Report Cards domain | Reference only |
| Notifications | Notifications domain | No |
| Analytics | Analytics domain | No |

---

## 4. Data Freshness Table

(Restated from ADR-0005 §6.)

| Section | Freshness |
|---|---|
| Attendance | Snapshot |
| Learning Compass | Live |
| Career Intelligence | Live |
| Teacher Comment | Snapshot |
| Report Card reference | Historical Snapshot |
| Academic Record | Live (via Projection Engine) |

---

## 5. Report Card vs. Blueprint

| | Report Card | Blueprint |
|---|---|---|
| Scope | One term | Longitudinal, spans terms |
| Nature | Official assessment snapshot | Composed learner record |
| Can exist without the other? | Yes — a report card requires no Blueprint | Yes — a Blueprint can span report cards, or exist before any are published |
| Recomputes the other's scoring? | No | No — Blueprint references report cards, never recalculates their contents |

---

## 6. QR Code Strategy

Printed/exported Blueprint stays short. Where a domain's full experience is inherently digital and ongoing (Learning Compass, Career Intelligence), the printed page carries one short summary line plus a QR code to that domain's live surface, rather than reprinting the domain's full report inline. This is the direct enforcement mechanism for §2.4/§2.5's "one insight only, never duplicate the full report" rule — a hard page-budget constraint, not just a style preference. QR code **generation** is explicitly out of scope for this sprint (architecture-only); this section defines the strategy future implementation must follow.

---

## 7. Open Reconciliation Item (flagged, not resolved this sprint)

`sprint-12c-academic-clinic-hardening.md` (the prior audit this session) found `lib/academicClinic/` and `lib/learnerIntelligence/` are two independently-computed pipelines today — different capability computation, different pathway computation, different report structure, zero shared code. This ADR's terminology freeze (Academic Clinic Engine = internal, Learner Blueprint = public product) describes where the codebase should converge, not where it already is.

Separately, an **uncommitted worktree** (`.claude/worktrees/agent-aedf323a0b5ed2eb3`, branch `worktree-agent-aedf323a0b5ed2eb3`) already contains new files in `lib/learnerIntelligence/` (`reportGenerator.ts`) and a new route (`app/api/learner-intelligence/pdf/route.ts`) — territory this ADR designates as the Blueprint's home. This was surfaced once already (end of the prior audit turn) and remains unanswered. **Recommendation**: before scoping Sprint 12D (or any sprint that touches `lib/learnerIntelligence/`), resolve what that worktree is and whether it should be merged, rebased onto this ADR's definitions, or abandoned. Proceeding without checking risks two independent efforts landing conflicting changes in the same files.

---

## 8. What Is Explicitly Not Done This Sprint

Per mission scope: no Learning Compass integration, no Career Intelligence integration, no Attendance-into-Blueprint integration, no Behaviour implementation, no Evidence integration, no QR generation, no Parent Portal work, no Notifications work, no Analytics work, no new API/service/repository/UI, no database changes, no code rename. This document and ADR-0005 are the complete deliverable for this sprint alongside the implementation-log entry.

---

## 9. Stop Condition

ADR-0005, this document, and the implementation-log entry are complete. Per the mission's explicit instruction: **stop here.** Do not begin Parent Portal, Learning Compass integration, or Career Intelligence integration. Wait for explicit approval before Sprint 12D — and per §7 above, resolve the worktree question before that approval is sought.
