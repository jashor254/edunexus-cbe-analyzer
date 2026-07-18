# ADR-0003 — Canonical Attendance Domain

**Status: DRAFT — awaiting explicit approval before Sprint 11B.** This is a design decision record only. No table, migration, repository, service, route, UI, or test was created in producing it — confirmed: this document and the implementation-log entry are the only files touched.

**Precedes**: Sprint 11B onward (implementation).
**Supersedes**: nothing.
**Depends on**: `docs/architecture/sprint-11a-attendance-domain-foundation.md` (the audit this ADR resolves into a decision).

---

## Section 1 — Problem Statement

Sprint 11A's repository-wide audit found no Attendance domain anywhere in EduNexus: no table, no repository, no service, no route, no UI, no workflow. The only trace is `days_present`/`days_absent` on `school_report_cards` — columns with a fully-built write path (`updateReportCard()`, `/api/core/reports` `action:'update'`) that no UI has ever called — and a privacy policy that already claims EduNexus Core collects attendance data no code actually produces.

Attendance must become a first-class Core domain, not a field bolted onto an existing one, because it answers a different question than every domain that might be tempted to absorb it:

- **Attendance ≠ Report Cards.** A report card is a term-boundary artifact generated once and published. Attendance is a daily operational fact, generated continuously. Storing attendance only as two report-card summary fields (the current state) makes it impossible to ever ask "was Tuesday's attendance taken," "who was late three times this month," or "what was attendance like before this term's report card existed" — the summary destroys the record it's supposed to summarize.
- **Attendance ≠ Evidence.** `learner_evidence` (per `docs/architecture/academic-evidence-layer.md`) exists to answer "what do we know about a learner's academic capability, confirmed through a review lifecycle." Attendance is not a capability claim requiring review — it is a same-day operational fact a teacher records once. Evidence may *consume* attendance later (Section 9); attendance is not itself a kind of Evidence today.
- **Attendance ≠ Behaviour.** No Behaviour domain exists in this codebase (confirmed in Sprint 11A). Attendance is not a proxy for behaviour, and conflating the two would import discipline/conduct semantics this domain does not need and this ADR explicitly rejects (Section 3).
- **Attendance ≠ Intelligence.** Attendance is a raw operational fact, not a derived insight. It must be true independent of any learner-intelligence computation ever running. Intelligence (Projection, Compass, Career Intelligence) may read attendance as an input; attendance must never depend on Intelligence to exist or be correct — inverting that dependency would violate the same Evidence-first / Intelligence-separation principle already codified for the Learner Record Layer.

**Attendance is operational truth.** It is a fact about what happened in a class on a given day, owned by the school, recorded by the teacher currently responsible for that class, independent of what anyone later computes from it. Everything else — Report Cards, Evidence, Intelligence, Parent Communication — may consume this truth. Attendance consumes nothing (Section 13).

---

## Section 2 — Goals

1. **Daily attendance** — a teacher can record, for one class on one school day, each learner's status.
2. **Class attendance** — a school admin/headteacher can see today's (or any day's) attendance across every class.
3. **Historical attendance** — attendance for a learner or class can be queried across any date range, term, or year, without re-deriving it from anything else.
4. **Teacher ownership** — attendance is recorded by the teacher currently responsible for a class, using the existing Core class-teacher relationship, not a new identity concept.
5. **School isolation** — attendance never crosses school boundaries; reuses existing `requireSchoolMembership`/`requireSchoolAdmin` exactly as every other Core domain.
6. **Auditability** — every Attendance Record states who marked it and when, and corrections are additive, not silent overwrites (mirrors the Evidence Lifecycle's "never mutate, only supersede" principle already codified in CLAUDE.md for `learner_evidence`).
7. **Future integration** — the domain model must not foreclose Report Card, Evidence, Parent Communication, or Intelligence consumption later, without requiring any of those integrations to be built now.

---

## Section 3 — Non-Goals

Explicitly out of scope for this ADR and for Sprint 11B–11I as currently planned:

- **Behaviour tracking / discipline** — no Behaviour domain exists; attendance status (`late`, `absent`) is not a disciplinary judgment and carries no conduct semantics.
- **Medical system** — no health/nurse-visit tracking; an `excused` status may reference a reason string, never a medical record.
- **Transport system** — bus/transport logistics are not attendance; a learner not on a bus is not this domain's concern.
- **Guidance & Counselling** — no such domain exists in the codebase (confirmed in Sprint 11A); not designed against here.
- **Evidence computation** — attendance is not converted into `learner_evidence` rows by this ADR; that remains a reserved, future, separately-approved integration (Section 9).
- **Career Intelligence** — no mechanical link is built; attendance is not consumed by capability/career computation in this phase.
- **Report generation** — `days_present`/`days_absent` are not wired to real Attendance data by this ADR; that is Sprint 11G, separately gated.
- **Parent messaging** — no notification, SMS, or alert is built; that is Sprint 11I, separately gated.
- **Analytics** — no dashboard, chart, or trend computation is built.
- **AI** — no DeepSeek call, prompt, or AI-derived insight touches attendance in this phase.

Every item above is a **future integration**, not a rejected concept — each has a named future Sprint in Section 12, gated on its own approval, not assumed by building the foundation.

---

## Section 4 — Canonical Domain Model

Three canonical responsibilities, not necessarily three stored tables:

| Entity | Responsibility | Storage |
|---|---|---|
| **Attendance Session** | "Was attendance taken for this class, on this day, and by whom." A session exists once a teacher opens attendance-marking for a class/day; its existence is itself a fact worth recording (distinguishing "no session = not yet taken" from "session exists, all present"). | **Stored.** One row per `class_id` + `date` (+ `school_id`/`term_id` for isolation and reporting, denormalized the same way `school_assessments` denormalizes `term_id`/`year`). |
| **Attendance Record** | "What was learner X's status in session Y." The atomic fact — one row per learner per session. | **Stored.** One row per `session_id` + `learner_id`. Never mutated after creation except to append a correcting record — mirrors the Evidence Lifecycle's supersede-not-edit rule. |
| **Attendance Summary** | "How many days present/absent/late/excused did learner X have this term/year." | **Not stored as a separate table.** Computed on read from Attendance Records, exactly as `fetchClassTermStatuses()` computes class-term status from `school_assessments`/`school_report_cards` today without a separate stored summary table. This avoids a second write path for the same fact — the Ten Engineering Rules' "never create another write path" applies directly. |

Attendance History (multi-term/year Summary) and Attendance Exceptions (Records with `status` in `late`/`excused`/`early_departure`, or `absent` with a reason) are **not separate entities** — History is Summary over a wider date range; Exceptions is a filter over Records. Neither gets its own table or write path.

---

## Section 5 — Ownership Model

```
School
  └─▶ Academic Year
        └─▶ Term
              └─▶ Class
                    └─▶ Attendance Session
                          └─▶ Attendance Record
                                └─▶ Learner
```

Every level above already exists in Core except the two new ones (Session, Record). No new ownership system is introduced:

- **School** ownership: `school_id` on every new table, isolated via the existing `requireSchoolMembership`/`requireSchoolAdmin` (`lib/core/permissions.ts`) — the same functions every other Core route already calls.
- **Teacher** ownership of the *act of marking*: resolved via the existing class-teacher relationship (`classes.class_teacher_id` / current class-teacher assignment), the same mechanism `requireClassTeacher`-style checks already use for Assessments.
- **Learner** ownership of the *record itself*: per the standing CLAUDE.md rule already codified for evidence — `marked_by` (the teacher) means "who entered this," never "who owns this or may read this downstream." A learner's attendance history does not become inaccessible when the marking teacher transfers or leaves. Read access for a currently-teaching teacher is resolved via `class_students` (does this teacher currently teach this class), exactly as required for evidence in `docs/architecture/academic-evidence-layer.md` §3 — **never** by matching `marked_by`.

No second identity table, no parallel role, no new membership concept is introduced anywhere in this model.

---

## Section 6 — Status Model

**Canonical statuses**: `present`, `absent`, `late`, `excused`.

| Status | Meaning |
|---|---|
| `present` | Learner was in class for the full session. |
| `absent` | Learner was not in class; no reason recorded (the default, unexcused case). |
| `late` | Learner arrived after the session started. |
| `excused` | Learner's absence has a recorded reason (a plain text field, not a medical/discipline record — see Section 3). |

**Rejected alternatives**:
- **A fifth `early_departure` status**: Sprint 11A's audit and the sprint brief both list Early Departure as a concept, but it describes a *timing detail* of an otherwise-present learner (left early), not a mutually exclusive attendance outcome the way `present`/`absent`/`late`/`excused` are. Modeling it as a status would make `present` and `early_departure` ambiguous (is a learner who left early "present" or not?). **Decision: defer `early_departure` to an optional timestamp field on the Attendance Record (`left_at`) in a future sprint, not a fifth status**, keeping the status enum a clean, mutually-exclusive partition.
- **Free-text status**: rejected — a fixed enum is required so Summary counts are meaningful and comparable across schools; matches the `is_published`-style boolean/enum convention already used throughout Core rather than introducing free text where a closed set suffices.
- **Numeric/percentage status** (e.g. "80% present" for a half-day): rejected as premature — no half-day or multi-period session concept exists yet; a single daily status per learner per class matches the granularity every other Core domain (daily class, not period-level) currently operates at. Period-level granularity is a future extension, not blocked by this model, but not built now.

---

## Section 7 — Lifecycle

```
Academic Year
  └─▶ Term
        └─▶ School Day (a date within the term's start_date/end_date — no new table; derived, exactly as Sprint 10H's "School Day" concept in the Academic Office lifecycle was already documented as derived, not stored)
              └─▶ Class (existing `classes` table)
                    └─▶ Attendance Session (new — created when a teacher opens attendance-marking for a class/day; existence alone answers "was attendance taken")
                          └─▶ Teacher marks attendance (Attendance Records created, one per learner in the class, per Section 4)
                                └─▶ Attendance locked (the session is marked complete — mirrors Assessment locking's `is_published` pattern; a locked session's Records are corrected only by superseding, never edited in place, per Section 2 goal 6)
                                      └─▶ Historical archive (no separate archival step or table — locked sessions and their Records simply accumulate; Summary/History are always computed on read, never a second stored truth, exactly as Section 4 specifies)
```

This is not a new lifecycle shape — it mirrors the Assessment → Report Card pipeline already built and proven in Core (`school_assessments` → locked → `computeTermSummaries` → `school_report_cards`), reusing the same pattern rather than inventing a new one.

---

## Section 8 — Security Model

| Concern | Model |
|---|---|
| **School isolation** | Every new table carries `school_id`; every route calls `requireSchoolMembership`/`requireSchoolAdmin` first, per CLAUDE.md's Security Rules — no new isolation primitive. |
| **Teacher ownership** | A teacher may create/edit an Attendance Session and its Records only for a class they currently teach (checked the same way class-teacher assignment gates Assessment actions today). Per Section 5, this check is *never* satisfied by "did I mark this row" — it is always "do I currently teach this class." |
| **Admin visibility** | `school_admin`/`headteacher`/`deputy_headteacher` (admin-tier, the same tier gating School Office/Academic Office since Sprint 10G) may read Attendance Summary/History across every class in their school — no new tier, reuses `ADMIN_TIER_ROLES`. |
| **Parent visibility** | A parent may read only their own child's Attendance Summary/History, via the existing parent-learner relationship already enforced for report cards — no new relationship model. |
| **Student visibility** | Not applicable. No student-facing login/session model exists in Core today (confirmed in Sprint 11A); attendance is not exposed to a surface that does not exist. |
| **Audit trail** | Every Attendance Record carries `marked_by` + `marked_at` (who/when, for provenance only, never for access control per Section 5) and is never mutated after creation — corrections are new Records superseding old ones, mirroring the trigger-enforced immutability already in place for `learner_evidence`. Whether attendance correction needs the identical DB-trigger enforcement Evidence has, or an application-level rule is sufficient for a first version, is left to Sprint 11B's own design — not decided here. |

Every mechanism above is a reuse of an existing Core pattern. No new security primitive, table, or role is introduced.

---

## Section 9 — Integration Boundaries

```
Attendance
  └─▶ Evidence
        └─▶ Projection
              └─▶ Compass
                    └─▶ Career Intelligence

Attendance ──▶ Report Cards
Attendance ──▶ Parent notifications
Attendance ──▶ Academic Clinic
Attendance ──▶ Promotion
```

Each arrow is a **future, separately-approved consumer**, not a dependency Attendance itself has. Concretely:

- **Attendance → Evidence**: the `EvidencePayload` union already reserves a `{ kind: 'attendance'; status; date }` variant (`docs/architecture/learner-record-layer-decisions.md:39`) — a future sprint could emit Evidence rows from Attendance Records through the existing `evidenceLifecycle.ts` write path, without Attendance needing to know Evidence exists.
- **Evidence → Projection → Compass → Career Intelligence**: this chain already exists for other Evidence sources today; Attendance would join it only by producing Evidence, never by being read directly by Projection/Compass/Career Intelligence.
- **Attendance → Report Cards**: `days_present`/`days_absent` are already reserved columns; a future sprint (11G) populates them from computed Attendance Summary instead of manual entry — Report Cards depends on Attendance, not the reverse.
- **Attendance → Parent notifications, Academic Clinic, Promotion**: each is a future read-only consumer of Attendance Summary/History; none is built now, and each requires its own approval given the operational/policy weight of e.g. attendance-gated promotion.

**Attendance itself consumes nothing.** It has no dependency on Evidence, Intelligence, Report Cards, or any other domain to be recorded or to be correct. This directionality is the core of the Decision in Section 13 and must not be inverted by any future sprint without a new ADR.

---

## Section 10 — Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Single attendance table** (Session and Record merged into one row per learner per day, with session-level fields like "was attendance taken at all" duplicated onto every learner row) | Cannot cleanly express "a session was opened but nobody marked yet" vs. "no session exists" without a sentinel row per learner before any marking happens; also cannot express session-level facts (locked/unlocked, opened-by) without repeating them on every learner row, inviting inconsistency. Two tables (Section 4) express both without duplication. |
| **Attendance as a JSON blob** (e.g. one `attendance` jsonb column on `classes` or `school_report_cards` holding `{date: {learnerId: status}}`) | Violates CLAUDE.md's Database Rules directly (`NEVER use select('*')`, implicit "no untyped blob columns" convention observed everywhere else in Core); makes per-learner history queries, indexing, and RLS impossible to express — a school could not enforce per-row access control inside a blob. Rejected outright, not a close call. |
| **Attendance inside the learner record** (a column or array on `learners`) | Attendance is a per-class, per-day fact, not a learner-scoped one — a learner enrolled in multiple classes across a transfer mid-year needs attendance scoped to the class they were actually in that day, not a single running field on the learner row. Also reintroduces the exact "who owns this becomes unclear when circumstances change" problem the `teacher_id` rule already exists to prevent, one level up (on the learner instead of the teacher). |
| **Attendance inside report cards** (the status quo — `days_present`/`days_absent` as the only representation) | This is what exists today (Sprint 11A finding) and is precisely the problem this ADR exists to fix: a term-boundary summary with no underlying daily record cannot answer "was Tuesday's attendance taken," cannot be corrected without regenerating the whole report card, and conflates a continuously-produced operational fact with a once-per-term generated artifact. |
| **Attendance as Evidence** (every Attendance Record is itself a `learner_evidence` row from day one) | Rejected for now per Section 1/Section 3 — Evidence's review lifecycle (`confirmReview`/`rejectReview`/`retractEvidence`) exists to adjudicate uncertain academic claims; a teacher's same-day attendance mark is not an uncertain claim needing review. Forcing every attendance mark through Evidence's heavier lifecycle would slow the one workflow (daily marking) that most needs to be fast, and conflates "operational fact" with "reviewed academic claim." The reserved `EvidencePayload` variant (Section 9) leaves this door open as a *derived* future integration, not the primary storage. |
| **Attendance inside Behaviour** | No Behaviour domain exists (Sprint 11A); this alternative is moot until one does, and even then Section 1 already distinguishes the two by definition — attendance is not a behavioural judgment. |
| **One row per learner only** (no Session concept, just standalone Attendance Records keyed by learner+class+date) | Loses the ability to answer "was attendance taken for this class today at all" as a distinct fact from "who was present" — a class with zero Records on a given day would be indistinguishable from "attendance not taken yet" vs. "every learner happened to be marked and then all records were somehow lost." The Session table makes "taken/not taken" and "locked/unlocked" first-class, queryable facts, matching how `school_assessments` publication state is tracked independently of individual scores. |

---

## Section 11 — Constitution Review

| Area | Assessment |
|---|---|
| **Canonical domains** | Attendance becomes a new canonical domain, alongside Schools/Teachers/Learners/Classes/Assessments/Report Cards/Evidence in the Canonical Domain Registry. It does not merge into or redefine any existing domain's identity. |
| **Repository ownership** | A new `AttendanceRepository` (`lib/repositories/attendance.repository.ts`), following the exact `BaseRepository`-extension pattern already used by `SchoolRepository`/`TeacherRepository`/`LearnerRepository` — additive, not a pattern change. |
| **RAS** | Consistent with the Reference Architecture Specification's existing per-domain table (Domain \| Owner \| Table \| Repository \| Service \| Routes \| Security \| Relationships) — Attendance slots into that table the same way Assessments already does. This ADR does not amend the RAS document itself; a follow-up documentation change (not code) should add Attendance's row to it before Sprint 11B. |
| **ADR interactions** | Does not conflict with ADR-0001 (Guardian/`class_students.parent_id`) or ADR-0002 (canonical Teacher identity, `teachers` table). Attendance's teacher-ownership check (Section 5) explicitly reuses whatever ADR-0002 ultimately settles as canonical for "who teaches this class" — this ADR does not re-litigate that question. |
| **Identity** | No new identity concept. Learner identity, Teacher identity, School identity, and Class identity are all reused as-is. |
| **Security** | Reuses `requireSchoolMembership`/`requireSchoolAdmin` exactly; no new authorization primitive (Section 8). |
| **Migration impact** | This is the first real schema migration proposed since the Core buildout (Sprint 9). Pure Add (two new tables) — no existing table is altered except that Report Card integration (Sprint 11G, separately gated) will *populate*, not restructure, the already-existing `days_present`/`days_absent` columns. Follows Add → Backfill → Verify → Observe → Deprecate → Delete: here, Add is the only step needed at first (no existing data to backfill, nothing to deprecate). |
| **Performance** | Bounded write volume (one Session + up to one Record per learner, per class, per school day) — indexes required on `school_id`, `class_id`, `term_id` per CLAUDE.md's Database Rules, to be specified at Sprint 11B, not here. |
| **Backward compatibility** | Fully preserved — no existing route, table, or UI is changed by this ADR itself; the privacy-policy claim (currently overstated, per Sprint 11A) becomes accurate once Sprint 11B–11G land, rather than requiring a walk-back. |

---

## Section 12 — Implementation Roadmap

Each sprint below is separately gated on its own review — this ADR authorizes the *design*, not a blanket green light to run all of them without checkpoints.

| Sprint | Scope |
|---|---|
| **11B** | Schema — `attendance_sessions` + `attendance_records` tables, migration, RLS policies, required indexes. No app code. |
| **11C** | Repository — `lib/repositories/attendance.repository.ts`, extending `BaseRepository`, explicit `_COLS`, registered in `index.ts`. No business logic. |
| **11D** | Core service — `lib/core/attendance.ts` (open session, mark attendance, get session records, get class/learner summary), following the `assessments.ts`/`report-cards.ts` shape. |
| **11E** | Teacher UI — a "Mark Attendance" screen, reusing the existing class-picker pattern from `core-term/page.tsx`. |
| **11F** | School Office / Academic Office integration — replace the inert `FutureModule` "Attendance" placeholder (`app/teacher/core-office/academic/page.tsx:323`) with a real `WorkflowCard`, per Sprint 10H's "one canonical entry" convention. |
| **11G** | Report Card integration — populate `days_present`/`days_absent` from computed Attendance Summary at report-generation time. Closes the privacy-policy gap. |
| **11H** | Evidence integration — construct the reserved `EvidencePayload` `kind:'attendance'` variant through `evidenceLifecycle.ts`, if and when a real downstream need (Projection/Compass/Career Intelligence consumption) is demonstrated, per this codebase's standing "start simple, grow later" / "no evidence this is needed yet" philosophy. |
| **11I** | Parent notifications — attendance-related parent communication (e.g. absence alerts), scoped and approved independently given the product/policy decisions involved (frequency, opt-in, channel). |

Sprints 11H and 11I in particular should not be scheduled until 11B–11G are live and observed with real school data, consistent with this project's standing "prove it with real data before generalizing" practice.

---

## Section 13 — Decision

**Attendance becomes a canonical operational domain**, with its own tables (`attendance_sessions`, `attendance_records`), its own repository, its own service, and its own routes — not a field on Report Cards, not a kind of Evidence, not a Behaviour concept, and not an Intelligence output.

**Attendance is the source of truth.** It is recorded once, by the teacher currently responsible for a class, on the day it happens, and is never silently overwritten — only superseded.

- **Evidence consumes Attendance** (future, gated — Sprint 11H).
- **Report Cards consume Attendance** (future, gated — Sprint 11G).
- **Intelligence consumes Attendance** (future, indirectly, via Evidence → Projection → Compass → Career Intelligence — never directly, and never before 11H).
- **Attendance consumes nothing.** No domain's existence, correctness, or availability is a precondition for recording or reading attendance.

This directionality (Section 9) is the decision this ADR fixes. Any future sprint proposing to invert it — making Attendance depend on Evidence, Intelligence, or Report Cards to function — requires a new ADR, not a design note.

**Approval status: DRAFT.** Sprint 11B (schema) does not begin until this ADR is explicitly approved.
