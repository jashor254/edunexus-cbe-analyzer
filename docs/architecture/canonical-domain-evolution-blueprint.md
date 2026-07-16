# Phase A — Stage 2: Canonical Domain Evolution Blueprint

**Status: ARCHITECTURE ONLY. No code, no migration, no SQL, no schema change.** This document designs the target-state architecture Edunexus evolves toward. It takes the Stage 0 census, Stage 0.5 identity resolution, the Canonical Domain Registry, and the Deprecation Registry as settled, authoritative inputs and does not re-derive or re-litigate any finding in them — it builds forward from the "Current Accepted Facts" this task specified.

---

## 1. Executive Vision

Edunexus after Phase A is a platform with exactly two layers, cleanly separated, each internally singular.

The **Operating Layer** is the School Operating System: the canonical record of who a school's people, groups, and official academic events are. It answers institutional questions — which learner is enrolled in which class, which teacher taught which subject, what mark was recorded on which assessment, which report card was published — and it answers them exactly once per question, through exactly one table, one repository, one service, one API, per domain. Every record in this layer is owned by a School. Teachers, parents, and admins act on it through permissions; none of them own any of it. This layer's job is to be *trustworthy* — auditable, unambiguous, and institutionally correct — even if that makes it less flexible than the Intelligence Layer built on top of it.

The **Intelligence Layer** — Learning Evidence, the Projection Engine, capability/pathway/career reasoning, Compass, the Academic Clinic, Adaptive Learning — consumes the Operating Layer's canonical records as *input*, one-directionally, and never becomes a second source of truth for what officially happened. It is already the more architecturally mature of the two layers today (per Stage 0.5: the Fourth Law was found *not* violated anywhere in this audit series), and this blueprint's central discipline is to keep it that way while the Operating Layer catches up — not to touch it, not to re-anchor it, not to let its relative maturity tempt anyone into building new Operating-Layer features "the Intelligence way" (fast, evidence-driven, tolerant of ambiguity) instead of the Operating way (slow, canonical, institutionally exact).

The relationship between the two layers is a one-way pipe: Operating Layer records get converted into Learning Evidence (already true today, via `lib/assessments/evidence.ts`/`reportCardEvidence.ts`), Evidence feeds Projections, Projections feed Recommendations/Interventions/Predictions. Nothing flows backward. A prediction never rewrites an assessment. An intervention never edits a report card. This is not a new rule this blueprint invents — it is the Fourth Constitutional Law, restated as the organizing principle for everything that follows.

---

## 2. Canonical Domain Blueprint

Per the Sixth Constitutional Law ("Every educational concept has one canonical service") and "Evolution is preferred over replacement," each domain below names the table that **evolves into** canonical status, not a new table to be built. Where two tables exist today, the higher-usage one (per Stage 0.5's file-count evidence) is designated the evolution target, acquiring the better-designed table's institutionally-correct fields; the lower-usage table's real data migrates in, then it retires. This reverses the direction implied by the original Stage 4/5 plan, per Stage 0.5's ratified finding.

| Domain | Purpose | Canonical Table (evolution target) | Canonical Repository | Canonical Service | Canonical API | Canonical Ownership | Future Status |
|---|---|---|---|---|---|---|---|
| Schools | Root tenant | `schools` | `SchoolRepository` (exists: `lib/repositories/school.repository.ts`) | `lib/core/school.ts` | `app/api/core/school/**` | Self (root) | Already canonical — no change |
| Teachers | Person who teaches, acts on the school's behalf | `teachers`, evolving to acquire a real `school_id` FK (replacing the free-text `school` column) | `TeacherRepository`, narrowed (see §5) to own only `teachers`, not `classes` | `lib/core/teachers.ts` (new home for teacher-identity logic, split out of today's `lib/repositories/teacher.repository.ts`) | `app/api/core/teachers/**` | School | `teachers` evolves-canonical; `school_users` retires *as a membership table* but its role/permission semantics survive inside the evolved `teachers` row (see §8); `school_teachers` (0 rows, no confirmed callers per Stage 0.5) retires outright once its dead-code status is confirmed |
| Learners | The child being educated | `students`, evolving to acquire `school_id`, `admission_number`, lifecycle `status`/`admission_date`/`graduation_date` from `learners`' shape | `LearnerRepository` (rename/refocus of today's `lib/repositories/learner.repository.ts`, re-pointed at `students`) | `lib/core/learners.ts`, re-pointed at `students` | `app/api/core/learners/**` (new canonical home; `app/api/students/**` becomes a thin compatibility alias during the transition, per §4) | School | `students` evolves-canonical; `learners` retires after its 405 rows are reconciled into `students` (see §4's Learner Evolution Strategy) |
| Guardians | Parent/guardian of a learner | `learner_guardians`, re-pointed at the evolved `students` table once the Learner evolution lands | `GuardianRepository` (new — currently guardian logic is embedded inside `learner.repository.ts`) | `lib/core/guardians.ts` (new) | `app/api/core/guardians/**` | School (guardian records are school-issued institutional facts, not the guardian's own data) | `learner_guardians` evolves-canonical (already the best-designed of the three guardian tables per Stage 0.5); `student_guardians` retires once confirmed dead; `parent_profiles` is reclassified as a *user preference/subscription* extension table, not a Guardian identity table, and stays out of this domain entirely |
| Classes | A taught group of learners | `teacher_classes`, evolving to acquire `school_id`, `academic_year_id`, `stream_id`, `grade_id` from `classes`' shape | `ClassRepository` (new — today no dedicated repository exists; `classes` reads currently live inside `TeacherRepository` per Stage 0.5) | `lib/core/classes.ts`, re-pointed at `teacher_classes` | `app/api/core/classes/**` | School | `teacher_classes` evolves-canonical; `classes` retires after its 10 rows are reconciled in (small, low-risk relative to Learner) |
| Streams | A grade-level cohort within a school | `streams` | `ClassRepository` (streams and classes are tightly coupled, one repository) | `lib/core/classes.ts` | `app/api/core/classes/**` (streams are a sub-resource) | School | Already canonical — no legacy competitor exists (Stage 0.5 confirmed legacy never modeled Stream as an entity) |
| Subjects | A taught subject | `subjects` | `SubjectRepository` (new, or folded into `ClassRepository` if the domain proves too thin to warrant its own — a judgment call for whoever implements this, not resolved here) | `lib/core/subjects.ts` | `app/api/core/subjects/**` | School (subject *catalog* is school-scoped via `class_subjects`; the `subjects` table itself is a shared reference list, not owned by any one school) | Already canonical — no legacy competitor exists |
| Assessments | An official graded event | `class_assessments`, evolving to acquire `school_id`/`academic_year_id`/`term_id`/`created_by`/`updated_by` (per the already-approved execution plan's Stage 3) | `AssessmentRepository` (exists: `lib/repositories/assessment.repository.ts`, consolidated to be the *only* writer) | `lib/core/assessments.ts` (already correctly the intended canonical service per the original plan — this finding is unaffected by the Learner/Class reversal, since the service itself was always correctly designed, only its FK targets were wrong) | `app/api/core/assessments/**` | School | `class_assessments` evolves-canonical (no table-level competitor — only the service-level duplication with `lib/assessments/mutations.ts` applies here, already catalogued) |
| Marks | A learner's score on an assessment | `learner_marks`, evolving alongside `class_assessments` | `AssessmentRepository` (marks are a child concept of Assessment, one repository) | `lib/core/assessments.ts` | `app/api/core/assessments/**` | School | Same evolution path as Assessments |
| Attendance | Daily/period presence record | **None exists today** (Stage 0.5 confirmed: no `attendance` table in the schema) | `AttendanceRepository` (net-new) | `lib/core/attendance.ts` (net-new) | `app/api/core/attendance/**` (net-new) | School | Not a duplication to resolve — a genuine gap. Not in scope to build during Phase A per the Constitution's "only build foundations" instruction from the earlier stage; named here so future work has a canonical home to build into rather than inventing a fifth pattern |
| Report Cards | The official term summary document | `school_report_cards`, contingent on the Assessment/Marks evolution landing first (its `class_id`/`learner_id` FKs must point at the evolved canonical tables before it can be populated) | `ReportCardRepository` (new, split out of the report-generation logic currently embedded in `lib/core/report-cards.ts`) | `lib/core/report-cards.ts` | `app/api/core/reports/**` | School | `school_report_cards` evolves-canonical *in schema*, but only becomes functionally canonical once the Assessment→Learner identity chain is unbroken (per Stage 0.5's root-cause finding); the legacy AI auto-report pipeline (`lib/career/autoReportGenerator.ts`) retires once `school_report_cards` is proven to produce real output — not before, since it is currently the only path that works |
| Communication | Notifications, WhatsApp, email to parents/teachers | `notification_log` + existing `lib/notifications/`, `lib/whatsapp/` modules | `NotificationRepository` (exists) | `lib/notifications/*` | `app/api/notifications/**` | School (a communication record is an institutional artifact — "the school told this parent X" — even though the delivery channel is a third party) | Already reasonably canonical; not deeply investigated in this audit series, flagged for a future targeted pass rather than assumed clean |
| Academic Years | The yearly institutional container | `academic_years` | `SchoolRepository` (thin, tightly coupled to School) | `lib/core/school.ts` | `app/api/core/school/**` | School | Already canonical |
| Terms | The termly institutional container | `terms` (Stage 0.5 confirmed this table exists and is real, resolving the earlier "NOT YET DECIDED" registry item) | `SchoolRepository` | `lib/core/school.ts` | `app/api/core/school/**` | School | Already canonical |
| Learning Evidence | One-way record of what a learner has demonstrated | `learner_evidence` | `EvidenceRepository` (exists: `lib/repositories/evidence.repository.ts`) | `lib/intelligence/evidenceLifecycle.ts` | Internal only — not directly exposed as a school-admin-facing CRUD API, by design (Fourth Law) | Learner Profile, explicitly **not** School (per the Fourth Law and the existing Canonical Domain Registry) | Already canonical, untouched by this blueprint |
| Intelligence | Projections, capability, pathway, recommendations | `learner_projections` + `learner_profiles` + the broader `lib/intelligence/`/`lib/projection/`/`lib/career/` stack | `ProjectionRepository`, `LearnerIntelligenceRepository`, `LearnerModelRepository` (all exist) | `lib/projection/recompute.ts`, `lib/learnerRecord/timeline.ts` | Read-mostly, exposed via `app/api/learner-intelligence/**`, `app/api/career/**`, etc. | Learner Profile | Already canonical, untouched by this blueprint |
| Permissions | Who may act on what | Three systems today (`UserRole`, `SchoolUserRole`, `MemberRole` — already catalogued in the original examination audit, not re-litigated here) | `lib/iam/roles.ts` (already the correct home for the developer-platform half; the school-operating half needs a `PermissionRepository`, net-new, see §8) | Split — developer-platform via `lib/iam/`, school-operating via a new `lib/core/permissions.ts` | N/A — permissions are enforced inline in every domain API, not exposed as their own CRUD surface | N/A (permissions describe relationships between Users and Schools/Organizations, not an owned record themselves) | Needs the consolidation work described in §8, not previously scoped into Phase A's numbered stages — flagged here as a real gap this blueprint surfaces, not silently absorbed into the Learner/Class work |
| Notifications | (see Communication above — same domain, listed once) | — | — | — | — | — | — |

---

## 3. Domain Relationships (Dependency Map)

```
                         ┌─────────────┐
                         │   schools   │  (root ownership)
                         └──────┬──────┘
                 ┌──────────────┼───────────────────────────┐
                 ▼              ▼                            ▼
        ┌────────────────┐ ┌──────────┐              ┌──────────────┐
        │ academic_years  │ │ teachers │              │ subjects (ref)│
        │   → terms       │ └────┬─────┘              └──────────────┘
        └────────┬────────┘      │ assigned to
                 │                ▼
                 │        ┌───────────────┐        ┌──────────────┐
                 └───────►│ teacher_classes│◄───────┤   streams     │
                          │ (evolving)     │        └──────────────┘
                          └───────┬────────┘
                                  │ enrolls
                                  ▼
                          ┌───────────────┐        ┌──────────────┐
                          │   students     │◄───────┤learner_       │
                          │  (evolving)    │        │guardians      │
                          └───────┬────────┘        └──────────────┘
                    ┌─────────────┼─────────────────┐
                    ▼             ▼                  ▼
          ┌──────────────┐ ┌──────────────┐  ┌─────────────────┐
          │class_assessments│ learner_marks │  │school_report_cards│
          │ (evolving)     │ │(evolving)     │  │ (schema-evolved,  │
          └──────┬─────────┘ └──────┬────────┘  │ functionally      │
                  │                  │            │ blocked until the │
                  │                  │            │ chain above is    │
                  │                  │            │ unbroken)         │
                  │                  │            └───────────────────┘
                  └────────┬─────────┘
                           ▼ (one-way, Fourth Law)
                  ┌──────────────────┐
                  │  learner_evidence │
                  └─────────┬─────────┘
                           ▼ (one-way)
                  ┌──────────────────┐
                  │ learner_projections│
                  │  learner_profiles  │
                  └─────────┬─────────┘
                           ▼ (one-way)
                  ┌──────────────────┐
                  │  Recommendations, │
                  │  Interventions,   │
                  │  Predictions      │
                  │ (Compass, Career, │
                  │  Clinic, etc.)    │
                  └──────────────────┘
```

**Ownership**: every box above `learner_evidence` is School-owned. Every box from `learner_evidence` downward is Learner-Profile-owned, per the Fourth Law — this is the one ownership discontinuity in the diagram, and it's intentional, not a bug.

**Read paths**: Intelligence reads Operating-Layer tables only through the Evidence-writing functions (`lib/assessments/evidence.ts`, `reportCardEvidence.ts`) — it does not read `class_assessments`/`learner_marks` directly from any Intelligence module, a property this blueprint requires be preserved, not just observed as currently true.

**Write paths**: exactly one per domain box, per §6.

**Reporting paths**: `school_report_cards` reads from `class_assessments`/`learner_marks` (via `term_subject_summaries`), never from `learner_evidence`/`learner_projections` — a report card is an Operating-Layer artifact, not an Intelligence artifact, even though it summarizes the same underlying events Intelligence also consumes. This is worth stating explicitly because it's the one place in the diagram where two downstream consumers (Report Cards and Evidence) read the same upstream source (`class_assessments`/`learner_marks`) without either being downstream of the other — a fan-out, not a chain, and it must stay that way.

**Security boundaries**: the boundary between "School-owned, School-scoped RLS" and "Learner-Profile-owned, guardian/self-scoped RLS" runs exactly along the Fourth Law's line in the diagram above. Every box above the line should have a `school_users`-membership-style RLS policy (per §8); every box below it should have a learner/guardian-self-scoped policy, matching what `learner_evidence`/`learner_projections` already correctly do today.

---

## 4. Evolution Strategy

Per domain, for every duplicated pair identified in Stage 0/0.5:

### Learner: `students` (evolves) ← `learners` (retires)
- **Current state**: disjoint tables, no bridge, `learners` functionally isolated (per Stage 0.5).
- **Future state**: `students` acquires `school_id` (NOT NULL, FK'd), `admission_number`, lifecycle `status`/`admission_date`/`graduation_date` — the institutional fields `learners` has and `students` lacks.
- **Migration strategy**: Add the new columns to `students` (nullable initially). Reconcile the 405 `learners` rows against the 499 `students` rows — this is a data-matching exercise (name/DOB/admission-number heuristics), not a schema operation, and per Stage 0.5 it cannot be done blindly; it needs a human-reviewed matching pass. Backfill matched rows. For `learners` rows with no `students` match, decide (a human decision, not this blueprint's to make) whether they represent real children who need a new `students` row created, or whether they were test/seed data that can be discarded. Only once every real `learners` row has a `students` counterpart does `learners` retire.
- **Compatibility strategy**: during the transition, `LearnerRepository` (§5) presents one interface backed by `students`; any code still written against `lib/repositories/learner.repository.ts`'s current `learners`-backed methods gets repointed to the same interface, not maintained as a second implementation (per the Third Law).
- **Deprecation strategy**: `learners` (and `learner_enrollments`, `learner_guardians`'s FK target, `learner_promotions`, `learner_transfers`) get re-pointed to `students` one table at a time, each landing in the Deprecation Registry as `MIGRATING` then `OBSERVING` then `REMOVED`, per the registry's existing status vocabulary.
- **Rollback strategy**: since the new `students` columns are additive and `learners` is not touched until every row is reconciled, rollback at any point before the final `learners` drop is "stop backfilling, leave both tables as they are today" — no data loss risk until the drop itself, which per Rule 5 gets its own dry run.
- **Risk**: Critical (unchanged from Stage 0.5's assessment) — this is the single highest-risk migration in the whole blueprint, because it's the one with no deterministic join key.
- **Complexity**: Very High.

### Class: `teacher_classes` (evolves) ← `classes` (retires)
- **Current state**: disjoint, `classes` functionally isolated (1 file, per Stage 0.5), but with only 10 rows — far smaller in absolute terms than the Learner problem.
- **Future state**: `teacher_classes` acquires `school_id`, `academic_year_id`, `stream_id`, `grade_id`.
- **Migration strategy**: because both tables are small (13 vs. 10 rows) and this platform is pre-second-school-onboarding, reconciliation here is far more tractable than Learner's — likely a direct, mostly-manual mapping rather than a heuristic matching exercise, but that determination belongs to whoever executes this, not asserted here.
- **Compatibility/Deprecation/Rollback**: same shape as Learner, at lower risk given the smaller row counts.
- **Risk**: Critical, but tractable — smaller absolute blast radius than Learner.
- **Complexity**: High, contingent on Learner's evolution landing first (since `class_assessments`/`learner_marks` reference both).

### Guardian: `learner_guardians` (evolves, re-pointed) ← `student_guardians` (retires), `parent_profiles` (reclassified out of scope)
- **Current state**: `learner_guardians` is well-formed but FK'd to `learners`; `student_guardians` has 1 row, no enforced FK, no confirmed callers.
- **Future state**: `learner_guardians.learner_id` gets re-pointed to the evolved `students` table once the Learner evolution lands (a column rename or FK re-target, not a structural redesign — `learner_guardians`' own shape is already correct).
- **Migration strategy**: contingent on Learner; not independently schedulable, per Stage 0.5.
- **Risk**: Low in isolation, but blocked on a Critical dependency.
- **Complexity**: Low, once unblocked.

### Teacher-School Membership: `teachers` (evolves) ← `school_users`/`school_teachers` (retire, with a caveat)
- **Current state**: `teachers.school` is free text; `school_users` is well-formed but thin (2-file usage); `school_teachers` has 0 rows, 0 confirmed callers.
- **Future state**: `teachers` acquires a real `school_id` FK, replacing the free-text field. **Caveat, stated explicitly rather than smoothed over**: `school_users.role` (`school_admin`/`headteacher`/`deputy_headteacher`/`teacher`/`parent`) is genuinely used today for real authorization decisions (`app/api/core/classes` role gate, `app/api/core/reports` publish gate) — this role semantics must survive the evolution, likely by adding a `role` column to `teachers` rather than dropping `school_users` outright before its role data is preserved somewhere. This is a nuance the "usage outweighs naming" facts didn't fully resolve on their own — flagged for explicit design attention when this evolution is scheduled, not silently assumed solvable.
- **Risk**: High.
- **Complexity**: High, entangled with Permissions (§8).

### Assessment/Marks: no table-level duplication, service-level only
- **Current state**: `class_assessments`/`learner_marks` are the single physical pair; `lib/assessments/mutations.ts` and `lib/core/assessments.ts` both write to them.
- **Future state**: `lib/core/assessments.ts` becomes the sole writer, once its FK targets are correct (which requires the Learner/Class evolutions above to land first — this is why Assessment consolidation was always contingent, confirmed again here).
- **Migration/Compatibility/Deprecation/Rollback**: as already specified in the previously-approved execution plan's Stage 4 — unchanged by this blueprint, just correctly sequenced *after* Learner/Class now.
- **Risk**: High (was Medium in the original plan; revised per Stage 0.5).
- **Complexity**: Medium.

### Ranking: no table-level duplication, algorithm-level only
- **Current/Future/Migration**: unchanged from the previously-approved execution plan's Stage 2 — this blueprint does not touch it, and confirms (per §4's own review) that nothing about the Learner/Class reversal affects the Ranking Engine's design, since ranking operates within a class's own marks regardless of which Class table is canonical.
- **Risk**: Medium. **Complexity**: Low.

### Report Pipeline: legacy AI auto-report (works, non-canonical) vs. `school_report_cards` (canonical shape, non-functional)
- **Current state**: as found in Stage 0.
- **Future state**: `school_report_cards` becomes functionally canonical once Assessment/Learner/Class evolutions land; the legacy AI pipeline retires only after `school_report_cards` is *proven* (not assumed) to produce correct output for real data.
- **Compatibility strategy**: keep the legacy pipeline live and untouched until the replacement is proven — this is the one place in this blueprint where "evolution over replacement" means literally not touching the working system until its replacement has evidence behind it, not just a schema behind it.
- **Risk**: Critical. **Complexity**: Very High, and fully contingent on everything above it in this section.

---

## 5. Repository Architecture

One repository per domain, per the Sixth Law. Target state (additions/splits from today's `lib/repositories/`):

- **`SchoolRepository`** (exists) — owns `schools`, `academic_years`, `terms`. Unchanged.
- **`TeacherRepository`** (exists, **narrowed**) — owns `teachers` only. Its current incidental ownership of `classes` reads (found in Stage 0.5) is removed; that logic moves to the new `ClassRepository`.
- **`ClassRepository`** (**new**) — owns `teacher_classes` (evolving) and, during the transition window, both `classes` and `teacher_classes` behind one interface. Also owns `streams`. This is the single most important new repository this blueprint calls for, since Stage 0.5 found no dedicated repository for Class exists today at all.
- **`LearnerRepository`** (exists, **re-pointed**) — owns `students` (evolving) as canonical, presents the same interface `lib/core/learners.ts`'s three callers already use today so their call sites don't need to change shape, only what's underneath them.
- **`GuardianRepository`** (**new**, split out of `LearnerRepository`) — owns `learner_guardians`.
- **`SubjectRepository`** (**new**, or folded into `ClassRepository` — an implementation-time judgment call) — owns `subjects`, `class_subjects`.
- **`AssessmentRepository`** (exists) — owns `class_assessments`, `learner_marks`, `assessment_types`. Unchanged in scope, just confirmed as sole writer once Stage 4 (contingent) lands.
- **`ReportCardRepository`** (**new**, split out of the report-generation logic currently living directly inside `lib/core/report-cards.ts`) — owns `school_report_cards`, `term_subject_summaries`.
- **`AttendanceRepository`** (**new, net-new domain**) — not built during Phase A, named so a future implementer has a home rather than bolting attendance onto `ClassRepository` or `AssessmentRepository` out of convenience.
- **`EvidenceRepository`, `ProjectionRepository`, `LearnerIntelligenceRepository`, `LearnerModelRepository`** (all exist) — unchanged, this blueprint does not touch the Intelligence Layer's repository boundaries.
- **`NotificationRepository`** (exists) — unchanged.
- **`PermissionRepository`** (**new**) — see §8; today's authorization checks are inlined per-route rather than centralized in a repository, which is itself a "no canonical service" gap this blueprint surfaces for Permissions specifically.

**Rule enforced across all of the above**: no repository owns tables from more than one domain (fixing the `TeacherRepository`/`classes` violation found in Stage 0.5), and no domain is split across more than one repository (fixing the current lack of any `ClassRepository` at all).

---

## 6. Service Architecture

One canonical service per domain, living in `lib/core/` (the namespace this blueprint designates as the Operating Layer's home, since it's already where the better-designed half of today's duplicated pairs live):

- `lib/core/school.ts` — School, Academic Year, Term.
- `lib/core/teachers.ts` (**new**, split out of the class-creation logic currently inline in `app/api/teacher/classes/route.ts` and the identity logic scattered across `TeacherRepository`).
- `lib/core/classes.ts` (exists, re-pointed) — Classes, Streams.
- `lib/core/learners.ts` (exists, re-pointed) — Learners.
- `lib/core/guardians.ts` (**new**) — Guardians.
- `lib/core/subjects.ts` (**new** or folded into `classes.ts`).
- `lib/core/assessments.ts` (exists) — Assessments, Marks. Sole writer once Stage 4 lands; `lib/assessments/mutations.ts` retires (already the plan).
- `lib/ranking/rankingEngine.ts` (**new**, per the already-approved Stage 2) — the one service every ranking-consuming module calls, no exceptions.
- `lib/core/report-cards.ts` (exists) — Report Cards, once functionally unblocked.
- `lib/core/permissions.ts` (**new**) — see §8.
- Everything under `lib/intelligence/`, `lib/projection/`, `lib/learnerRecord/`, `lib/career/`, `lib/compass/`, `lib/adaptiveLearning/`, `lib/academicClinic/` — **untouched**, remains the Intelligence Layer, explicitly out of this blueprint's redesign scope per the Fourth Law and this task's own instruction to preserve the Intelligence Layer.

**No competing write paths rule**: once this architecture is realized, exactly one service function exists per write operation per domain. The test for "have we achieved this" is mechanical, not subjective: for any table in the Operating Layer, `grep -rn "\.from('<table>').insert\|.update\|.upsert"` across `lib/` should return matches from exactly one service file (plus its repository).

---

## 7. API Architecture

Ownership rule: **every API route belongs to exactly one of six categories below, and calls exactly one canonical service.** A route that needs data from two domains (e.g. a report card page needing both Assessment and Guardian data) composes two canonical service calls in the route/page layer — it does not reach into a second domain's repository directly, and it does not duplicate a second domain's business logic inline.

- **Teacher APIs** (`app/api/teacher/**`) — teacher-initiated actions on their own assigned classes/assessments, always scoped through `ClassRepository`/`AssessmentRepository`'s permission checks, never raw ownership checks against `teacher_id`.
- **School APIs** (`app/api/core/**`) — admin/headteacher-initiated institutional actions (class creation, report publishing, teacher assignment), always role-gated per §8.
- **Parent APIs** (`app/api/reports/report-card/**`, guardian-facing routes generally) — read-only, always scoped through `GuardianRepository`'s guardian-link check plus the `is_published` gate, matching the pattern already correctly implemented today for `school_report_cards`.
- **Learner APIs** (student-portal-facing routes, e.g. today's `app/api/students/**`, `app/api/assessments/**`) — self-scoped (`auth.uid() = user_id`), unaffected by the Operating-Layer evolution except for which underlying table backs them.
- **Admin APIs** (`app/api/admin/**`) — platform-operator actions, separate from School APIs (an EduNexus platform admin is not the same actor as a school's own `school_admin`), unaffected by this blueprint.
- **Internal APIs** (`app/api/cron/**`, webhook handlers, service-role-only routes) — never user-facing, always via `createServiceClient()`, per the existing `CLAUDE.md` rule this blueprint does not change.

---

## 8. Security Architecture

- **Authentication**: unchanged — Supabase Auth (`auth.users`), `auth.getUser()` at every route entry point, per the existing `CLAUDE.md` rule.
- **Authorization**: consolidated into `lib/core/permissions.ts` (§5/§6's new `PermissionRepository`/service), replacing today's per-route inline role checks. This directly closes the class of bug Stage 0 found twice (`app/api/core/assessments`, `app/api/core/reports` — one action checked correctly, its sibling didn't) by making the check a single reusable function (`requireSchoolRole(userId, schoolId, allowedRoles[])`) rather than a pattern every route author has to remember to copy correctly.
- **Database RLS**: every Operating-Layer table gets a policy of the shape already correctly implemented for `learners`/`learner_enrollments`/`school_report_cards`/`term_subject_summaries`/`streams` today (`EXISTS (SELECT 1 FROM school_users WHERE school_id = <table>.school_id AND user_id = auth.uid() AND is_active)`), **not** the shape currently on `classes` (`auth.uid() IS NOT NULL`, no scoping) — the `classes`/`assessment_types` RLS gaps found in Stage 0 are the negative example this blueprint designs away from, everywhere, permanently.
- **School Isolation**: enforced at both layers per the Fifth Constitutional Law — application-level via the consolidated `permissions.ts`, database-level via the RLS pattern above. Neither layer alone is sufficient (an app bug shouldn't mean cross-school data leaks; a missing app check shouldn't be the only thing standing between a request and another school's data).
- **Ownership Validation**: every write to an Operating-Layer table validates `school_id` matches the acting user's `school_users` membership, via the same consolidated permission check — not reimplemented per route.
- **Audit Trails**: `created_by`/`updated_by` (already in the approved execution plan's Stage 3) on every Operating-Layer table, populated from `auth.getUser()`, never trusted from the request body — per the existing `CLAUDE.md` rule and the Second Constitutional Law's ownership/attribution distinction.
- **Permission Model**: `SchoolUserRole` (`school_admin`/`headteacher`/`deputy_headteacher`/`teacher`/`parent`) becomes the one role vocabulary for the Operating Layer, replacing `teachers.role`'s free-text `'admin'`/`'teacher'` values (which Stage 0.5 flagged as an unverified escalation-risk pattern) — the free-text field retires as part of the Teacher-School Membership evolution in §4.
- **Future Moderation Hooks**: per the original execution plan's explicit instruction ("do not implement moderation or approval yet, only prepare the architecture"), this blueprint reserves `moderated_by`/`approved_by`/`published_by` as column names to be added *when* a moderation workflow is designed, not now — naming them here only so a future implementer doesn't invent a fourth naming convention for the same concept.

---

## 9. Intelligence Integration

Intelligence consumes Official Records exactly once, at the Evidence boundary, and never again reads Operating-Layer tables directly:

- **Assessments/Marks** → `lib/assessments/evidence.ts`/`reportCardEvidence.ts` → `learner_evidence` — already correct today, unaffected by this blueprint except that its `teacherId`/`studentId` inputs will eventually resolve through the evolved `students`/`teacher_classes` tables rather than being ambiguous about which Learner/Class identity they mean.
- **Attendance** → does not exist yet (§2); when built, it must follow the same one-way pattern — an `AttendanceRepository` write triggers an Evidence-writing function, exactly like Assessments do today, never a direct read from `lib/intelligence/`.
- **Behaviour** → not currently modeled as a distinct Operating-Layer domain in this audit series; flagged as an open question for whoever eventually builds it, not resolved here.
- **Learning Evidence** → `learner_projections`/`learner_profiles`, via `recomputeLearnerProjection`/`getLearnerTimeline` — already correct, untouched.

**The Fourth Law's enforcement mechanism, made concrete**: the only files permitted to write to `learner_evidence` are the small, named set already established (`lib/intelligence/evidenceLifecycle.ts` and its callers in `lib/assessments/`) — this blueprint does not add new writers, and any future Operating-Layer domain (Attendance, Behaviour, Communication) that wants to feed Intelligence must go through a new evidence-writing function of the same shape, never a direct table write from an Intelligence module into an Operating table, or vice versa.

---

## 10. Migration Roadmap

- **Immediate** (no dependency on anything else in this blueprint): the four security gaps already identified (Stage 1, expanded per Stage 0.5 — two RLS, two app-level).
- **Phase A** (this Phase, contingent ordering, revised from the original plan per Stage 0.5): Ranking Engine (Stage 2, independent) → Learner evolution (`students` acquires `learners`' fields, reconciliation) → Class evolution (`teacher_classes` acquires `classes`' fields, reconciliation) → Assessment/Marks service consolidation (contingent on both) → Report Pipeline cutover (contingent on all of the above, only after `school_report_cards` is *proven*, not assumed).
- **Phase B**: Teacher-School Membership evolution (`teachers` acquires `school_id`, role semantics preserved per §4's caveat) and the accompanying Permission consolidation (§8) — deliberately separated from Phase A because it touches every authorization check in the platform and deserves its own dedicated review, not to be rushed alongside the Learner/Class work.
- **Phase C**: Guardian evolution (contingent on Learner, but low complexity once unblocked); dead-code retirement of `school_teachers`/`student_guardians` once their zero-usage status is confirmed by the follow-up traces Stage 0.5 flagged as open.
- **Long-term**: Attendance domain (net-new build), Communication domain's formal audit (not yet performed to this series' rigor), Behaviour domain (undefined, needs its own scoping before it can even enter a roadmap).
- **What must never be migrated**: `learner_evidence`, `learner_projections`, `learner_profiles`, and everything downstream of them — the Intelligence Layer's identity anchor (`students.id`, soon to be the evolved canonical `students` table anyway, so this isn't even a re-anchoring, just a continuity guarantee) must never change without proof, per the Constitutional Law this task listed explicitly ("Intelligence identities are never changed without proof") — and no proof has been offered or is being offered here.
- **What must evolve**: every Operating-Layer table named in §2 as "(evolving)."

---

## 11. Technical Debt Register

| Item | Category | Priority |
|---|---|---|
| `students`/`learners` split | Architectural Debt | Critical |
| `teacher_classes`/`classes` split | Architectural Debt | Critical |
| `classes`/`assessment_types` RLS gaps | Architectural Debt (security) | Critical |
| Two app-level authorization gaps (`app/api/core/assessments`, `app/api/core/reports`) | Architectural Debt (security) | Critical |
| `teachers.school` free-text field (no real FK) | Architectural Debt | High |
| Duplicate `createAssessment` services | Architectural Debt | High |
| Three ranking implementations | Architectural Debt | Medium |
| Duplicated inline `toCbcLevel` closures | Temporary Debt (small, mechanical, just needs a stage assignment) | Medium |
| Legacy AI report pipeline surviving alongside non-functional `school_report_cards` | Intentional Debt (kept deliberately, since it's the only working path) — reclassify to Architectural Debt once `school_report_cards` is proven and the legacy path can retire | High |
| `school_teachers` (0 rows, 0 confirmed callers) | Permanent Debt candidate — likely safe to remove once confirmed dead, but "confirmed" isn't done yet | Low |
| `student_guardians` (1 row, no enforced FK) | Permanent Debt candidate, same caveat | Low |
| `parent_profiles` (0 rows, unclear purpose) | Future Risk — not yet classified, needs a purpose audit | Low |
| Attendance domain absence | Future Risk (a gap, not debt — nothing to pay down, but a known missing foundation) | Medium (rises if any feature work assumes it exists) |
| Permissions consolidation (three role systems, no unified `PermissionRepository`) | Architectural Debt | High |
| `teachers.role='admin'` escalation-path — unverified | Future Risk | Medium until verified, potentially Critical if verified exploitable |
| Circular dependency analysis — not performed | Future Risk (unknown unknown) | Medium |

---

## 12. Success Criteria

This architecture is realized only when every item below is independently verifiable against the live codebase — restated from the task's own list, mapped to this blueprint's specific mechanisms:

- [ ] Every entity has one canonical identity — verified by §4's evolutions landing (Learner, Class, Guardian, Teacher-School Membership) and §2's table showing no remaining "(evolving)" status.
- [ ] Every domain has one canonical repository — verified against §5's list, checked mechanically (no repository imports a table outside its named domain).
- [ ] Every domain has one canonical service — verified against §6's list, checked mechanically (the single-writer grep test in §6).
- [ ] Every domain has one canonical API — verified against §7's six-category ownership rule.
- [ ] Every official record belongs to a school — verified by every Operating-Layer table in §2 having a non-nullable, FK'd `school_id`.
- [ ] Every Intelligence component consumes canonical identities — verified by `learner_evidence`/`learner_projections`/`learner_profiles` all still resolving correctly through the evolved `students` table, with zero re-anchoring (per §10's "must never be migrated" list — the identity itself doesn't move, only what feeds it becomes correct).
- [ ] Every duplicated implementation has a retirement path — verified against §4's Evolution Strategy table, each row's Deprecation Registry status reaching `REMOVED`.
- [ ] Every Constitutional Law is satisfied — First (one identity per entity, §2/§4), Second (school ownership, §2's Ownership column), Third (permissions not ownership, §8), Fourth (Intelligence never replaces records, §9), Fifth (app+DB security, §8), Sixth (one service, §6), Seventh (evolution not replacement, §4 throughout), Eighth (usage outweighs naming, the entire reversal in §2 versus the original plan), Ninth (Intelligence identities unchanged without proof, §10), Tenth (future modules comply, this document itself is the compliance reference for future modules).

---

**This document proposes no implementation. It is the target architecture, offered for ratification. Per the Constraints, no file referenced above has been modified as part of producing this blueprint.**
