# Sprint 9A — Phase 2: School Activation & Onboarding Engine Audit

**Mode: READ ONLY.** No schema, migration, route, repository, service, permission, or test was modified in producing this document. Per its own Constraints, this document proposes no code. All findings are cited to file:line, verified by direct grep/read this session (not carried over from a prior sprint's counts).

**Builds on**: `docs/architecture/sprint-8a-operating-system-implementation-blueprint.md` (Sprint 8A), `docs/architecture/sprint-8b-academic-year-simulation-audit.md` (Sprint 8B), `docs/architecture/sprint-8c-educational-operating-system-validation.md` (Sprint 8C), `docs/architecture/reference-architecture-specification.md` (RAS), `docs/architecture/adr/0002-canonical-teacher-identity.md` (ADR-0002).

**A note on scope, stated plainly before Part 1**: Sprint 8C's own Stop Condition (its final line) said any future approval "should authorize **implementation** against the roadmap already produced (Sprint 8A), not further audit." This document's own Constraints section says "No code. Read only." Both cannot be simultaneously true of the same piece of work — this document is, by its own constraints, another audit, not implementation, regardless of its framing. That is not a criticism of the request — the school-activation question genuinely was not fully scoped by Sprint 8A (which found the gap but did not trace the exact call chain) — but it should be named rather than silently absorbed, per this project's standing Architecture Guardian mode. This document proceeds as a **targeted, scoped audit of one specific subsystem** (school activation), narrower than the 8A–8C series' platform-wide sweep, and produces the one deliverable Sprint 8A's Part 6/Part 9 already called for: an exact, evidence-traced answer to "what does a school actually need to go from created to operating."

---

## Part 1 — School Creation

### 1.1 The only real, reachable creation path

| Layer | Location | Detail |
|---|---|---|
| Repository | `lib/repositories/school.repository.ts:81-92` | `SchoolRepository.create()` — raw INSERT into `schools`, sets `created_by`. |
| Service | `lib/core/school.ts:16-33` | `createSchool(input, creatorUserId)` — calls `repos.schools.create()`, publishes `organization.created` event, then calls `addSchoolUser(school.id, creatorUserId, 'school_admin', creatorUserId)` **in the same function call**. The creator becomes `school_admin` automatically — this is not a separate step a caller can skip or defer. |
| Route | `app/api/core/school/route.ts:48-66` | `POST /api/core/school`. Auth: `requireAuthentication(supabase)` only (line 57). **Any authenticated user may create a school.** The route's own comment (lines 62-63) states this explicitly. Body validated via Zod `CreateSchoolSchema` (lines 9-20). No admin-only gate at the API layer. |
| UI | `app/admin/core-schools/new/page.tsx` | The **only** page in the entire app that calls this route (confirmed: no other file under `app/` calls `api/core/school` for creation). Gated **client-side only** by a `NEXT_PUBLIC_ADMIN_EMAILS` env-var allowlist (lines 9, 38-44) — redirects to `/dashboard` if the signed-in user's email isn't listed. The page's own comment calls itself a "minimal internal onboarding form" (line 18-20). |

**Who can call it?** Technically, any authenticated user, via the API directly (the route has no role check). In practice, only whoever the operator has added to `NEXT_PUBLIC_ADMIN_EMAILS` can reach it through the one UI that exists.

**Is it reachable?** Yes, but only by a platform-operator, not by a school principal signing up unassisted. There is no public "register your school" page.

**Used in production?** Unknown from static code alone — no test or log evidence in this pass confirms a real school was created through this exact path outside the reference-school script. It is the only *code path* capable of creating a real, Core-schema school today.

**Hidden or dead?** Not dead (it is wired to a real route and a real, if gated, page). It is **effectively hidden from the actual customer** — a principal cannot find or use it; only the platform team can.

### 1.2 Legacy bridge — deliberately does not create schools

`ensureSchoolMembership(userId, schoolName)` (`lib/core/school.ts:59-86`), reached from `app/api/teacher/profile` at the legacy `app/teacher/setup` signup flow (per the function's own comment, lines 50, 56-58): looks up an existing `schools` row by case-insensitive name match; if found, adds the user as `teacher`. **If no match is found, it explicitly does not create a school** — the code comment (lines 53-58) states a silently-created school would be unreachable and unmanageable, and instead logs the unmatched name and returns `{ schoolId: null, created: false }`. This is a legacy teacher self-signup flow that can *join* an existing school by name-guessing but can never *create* one. It hardcodes `role: 'teacher'` (line 71) — an admin/principal self-signing-up here has no path to becoming `school_admin`.

### 1.3 Script/seeder path

`scripts/reference-school/01-seed-school.ts:14-48` inserts `schools` directly via a raw service-role Supabase client (not through `lib/core/school.ts`), idempotently (name lookup before insert). This is fixture/test infrastructure, not a product path.

### 1.4 Tests

`lib/repositories/findSchoolIdByTeacherId.integration.test.ts:38-56` creates a real throwaway `schools` row via `repos.schools.create()` purely as setup for an unrelated identity-resolution test (Sprint 4G) — it is not itself a test that `createSchool()`/the route/the UI work correctly. **No test in the repository exercises `POST /api/core/school` or `createSchool()` as its primary subject.**

**Determination [VERIFIED]**: exactly one production code path creates a real school (`createSchool()` → `POST /api/core/school` → `app/admin/core-schools/new/page.tsx`), and it is a platform-admin internal tool, not a self-service onboarding flow. A second path (`ensureSchoolMembership`) exists but is designed to *never* create a school, only join one by name. A principal signing up today, unassisted, **has no route to creating their school at all** — someone with platform-admin access must do it for them.

---

## Part 2 — Activation Flow

`createSchool()` (`lib/core/school.ts:16-33`) does exactly two things, and nothing else, in the same call: insert `schools`, insert one `school_users` row (`role='school_admin'`, the creator). Verified by reading the full function body — there is no branch, loop, or secondary call that touches `academic_years`, `terms`, `streams`, `subjects`, `grade_subjects`, `classes`, `departments`, or `school_settings`.

| Object | Auto-created with school? | How it's actually created | Gate |
|---|---|---|---|
| `academic_years` | **No** | `createAcademicYear()` (`lib/core/school.ts:142-147`) via `POST /api/core/academic-years` (`app/api/core/academic-years/route.ts:44-84`) | `requireSchoolAdmin` |
| `terms` | **No** | Same route, `type === 'term'` branch (lines 57-63) | `requireSchoolAdmin` |
| `grades` | **No — and not school-scoped at all** | `listGrades()` (`lib/core/classes.ts:6-8`) reads a **global, platform-wide, pre-seeded catalogue**. No per-school grade-creation route exists (`grep -rn "createGrade\|insertGrade"` → 0 matches). | N/A — not a per-school object |
| `streams` | **No** | `createStream()` (`lib/core/classes.ts:16-18`) via `POST /api/core/classes`, `type==='stream'` (`app/api/core/classes/route.ts:56-66`) | `requireSchoolAdmin` |
| `subjects` | **No — global catalogue, same as Grade** | `listSubjects()` (`lib/core/subjects.ts:4-6`) reads a platform-wide list | N/A — not a per-school object |
| `grade_subjects` (subject↔grade assignment, per school) | **No, but a bulk-seed helper exists** | `seedGradeSubjectsForSchool(schoolId)` (`lib/core/subjects.ts:38-68`) — bulk-inserts using CBC default compulsory/elective logic, but only reachable via `POST /api/core/subjects`, `action==='seed'` (`app/api/core/subjects/route.ts:86-95`) | `requireSchoolAdmin`, manual, never auto-called from `createSchool()` |
| Departments | **No — table/concept does not exist** | No creation path found anywhere | N/A |
| Teacher roles / `school_users` beyond the creator | **No** | `addSchoolUser()` (`lib/core/school-users.ts:19-42`), but no route exposes it for adding a *second* teacher (see Part 6) | N/A — no route |
| `school_settings` (grade boundaries, etc.) | **No — explicitly opt-in** | `upsertSchoolSettings()` (`lib/core/school.ts:125-130`); `resolveTeacherGradeBoundaries()`'s own comment (`lib/core/school.ts:99-111`) confirms: "a bridged school may not yet have a school_settings row (upsertSettings is opt-in, not auto-created on school creation)" | `requireSchoolAdmin` |
| Permissions/RBAC beyond the single `school_admin` role grant | **No** | N/A | N/A |

**Negative search, explicit**: `grep -rniE "bootstrap|provision|onboard|initializeSchool|activateSchool" lib/ app/api/` returns no hits for school-activation logic — only pre-existing, unrelated user-onboarding flags (`has_seen_onboarding`, `onboarding_completed` on user profile tables). **There is no "activate a new school" function anywhere in this codebase.**

**Determination [VERIFIED]**: activation is entirely manual, entirely un-orchestrated. Nine distinct objects (academic year, terms, streams, grade-subject assignment, classes, additional teachers, learners, enrollments, school settings) each require a separate, individually-authenticated API call, spread across at least five different route files (`academic-years`, `classes`, `subjects`, `learners`, and the school route itself), with zero code tying them into one sequence.

---

## Part 3 — Required Data Graph

```
School (schools)                                              [MANDATORY]
   │  auto: creator → school_users(role='school_admin')        [MANDATORY, automatic]
   ▼
Academic Year (academic_years)                                 [MANDATORY, MANUAL]
   ▼
Term (terms)                                                    [MANDATORY for endOfTerm; OPTIONAL for createAssessment —
   │                                                             see caveat below]
   ▼
Grade (grades)                                                  [MANDATORY input, but PRE-EXISTING — global catalogue,
   │                                                             never created per-school]
   ▼
Stream (streams)                                                [OPTIONAL — createClass() does not require stream_id
   │                                                             per the Core classes schema shape]
   ▼
Class (Core `classes`, via createClass(schoolId, {grade_id, academic_year_id, ...}))
   │                                                             [MANDATORY — requires grade_id AND academic_year_id
   │                                                             already resolved]
   ▼
Teacher Assignment (class_teacher_id → school_users.id, per RAS §3 Class row)
   │                                                             [MANDATORY for a class to have an owning teacher, but
   │                                                             NO ROUTE exists to add a second school_users row —
   │                                                             see Part 6 — so this node is currently UNREACHABLE for
   │                                                             any teacher other than the school's creator]
   ▼
Learner Enrollment
   │  admitLearner(schoolId, input) → learners + learner_guardians  [MANDATORY, POST /api/core/learners]
   │  enrollLearner(learnerId, {class_id, term_id, academic_year_id}) [MANDATORY, separate call, PATCH .../[id]]
   ▼
Assessment (class_assessments / learner_marks, via createAssessment())
   │                                                             [BROKEN — see 3.1 below: hard schema-level blocker]
   ▼
Evidence (learner_evidence)
   │                                                             [derived one-way from Assessment/Report per RAS §9 —
   │                                                             unreachable while Assessment is broken for Core schools]
   ▼
Projection (learner_projections, via recomputeLearnerProjection)
   │                                                             [works from zero evidence by design — not itself
   │                                                             broken, but starved: nothing to project for a
   │                                                             Core-only school, per 3.1]
   ▼
Report (school_report_cards / term_subject_summaries, via runEndOfTerm/generateReportCards)
   │                                                             [BLOCKED — requires all class assessments is_published,
   │                                                             which requires Assessment to work first]
   ▼
Promotion (Sprint 6D Workflow 10, per Sprint 8C Part 1)
   │                                                             [OUT OF SCOPE for this document — code exists, correctly
   │                                                             gated, deliberately not given a UI per a confirmed prior
   │                                                             scope decision, restated from Sprint 8C, not re-verified
   │                                                             here]
   ▼
Graduation / Archive
   │                                                             [OUT OF SCOPE — Sprint 8C Part 1 already found this
   │                                                             "absent, structurally," not re-investigated here]
```

### 3.1 The one hard, schema-level blocker in this whole graph

**`class_assessments.class_id` has a live foreign key to the *legacy* `teacher_classes` table, not Core's `classes` table** — confirmed directly against the schema (`supabase/marksheet_migration.sql:8`: `class_id uuid REFERENCES teacher_classes(id) ON DELETE CASCADE`; line 24, `learner_marks.class_id NOT NULL REFERENCES teacher_classes(id)`). `lib/core/assessments.ts` is written as though it targets Core's `classes` table, but the constraint says otherwise. This was independently discovered by the Reference School seed script's own author, who left it as a documented, unfixed comment (`scripts/reference-school/05-seed-assessments.ts:9-16`) and chose to **skip** assessment seeding for the reference school rather than patch the constraint unilaterally.

**Consequence**: for a school built entirely through the Core API surface (`createSchool` → `createClass`, a Core `classes.id`), `createAssessment()` cannot succeed against that class — inserting a `class_assessments` row with that `class_id` violates the live FK, because a Core `classes.id` does not exist in `teacher_classes`. This is not a defensive-code gap or a permissions gap; it is a schema mismatch that makes the downstream half of the dependency graph (Assessment → Report → Promotion) **structurally unreachable** for any school that exists only in Core, regardless of how correctly every upstream step (School → Year → Term → Class → Learner → Enrollment) is executed.

Sprint 8A's own dependency-graph work (Part 2, restated in Part J of this audit's supporting research) identified the *identity-space* version of this same root cause ("live Assessment data is under `students.id`, not Core `learners.id`") — this document adds the concrete schema-level symptom (`class_assessments.class_id` → `teacher_classes`) that Sprint 8A's higher-level framing did not cite directly.

### 3.2 The second blocker: admin-tier `createAssessment` throw

Independent of 3.1, `createAssessment()` (`lib/core/assessments.ts:74-104`) calls `resolveTeacher(userId)` (line 89) and throws if it returns null (lines 90-96): `"createAssessment: no teacher record found for this user — admin-created assessments are a known, unresolved gap (see ADR-0002)"`. The function's own comment (lines 65-76) names this as ADR-0002 Part 7's already-flagged, deliberately-unsolved scope boundary — the school's creator, who becomes `school_admin` automatically at creation (Part 1 above), has **no `teachers` row by default**, since `createSchool()` never creates one. A newly self-onboarded school admin therefore cannot create their own school's first assessment without first, separately, unofficially, acquiring a legacy `teachers` row — a step with no UI or route anywhere in Core.

**Classification of every node**:
- **Mandatory, currently reachable**: School, Academic Year, Term, Class (with pre-existing Grade as input).
- **Mandatory, currently unreachable for anyone but the school creator**: Teacher Assignment (no invite/add-teacher route — Part 6).
- **Mandatory, reachable**: Learner, Enrollment.
- **Mandatory, currently broken (schema-level)**: Assessment (§3.1), and by extension everything downstream of it — Report, and (functionally, for lack of real Evidence) Projection.
- **Optional**: Stream (not required by `createClass`'s current input shape), `grade_subjects` seeding (falls back to nothing if skipped — `class_subjects`/`grade_subjects` are not required inputs to `createAssessment`, which takes a free `subjects: string[]` per assessment instead), `school_settings` (falls back to 75/50/25 grade-boundary defaults if absent, per `lib/core/report-cards.ts:64-67`).
- **Missing entirely (no table/route)**: Departments, formal Teacher-invite mechanism, any per-school "activation" orchestration.
- **Out of scope for this document, restated from Sprint 8C without re-verification**: Promotion, Graduation, Archive.

---

## Part 4 — Current Activation State

For a school created today via `app/admin/core-schools/new/page.tsx`:

| Capability | Can it happen immediately? | Why / why not (cited) |
|---|---|---|
| Invite teachers | **No** | No route exists to add a second `school_users` row to an existing school. `find app/api/core -maxdepth 2` shows Core's full route surface (`school`, `assessments`, `classes`, `academic-years`, `learners`, `promotions`, `reports`, `subjects`, `transfers`) — **there is no `app/api/core/teachers` or `app/api/core/school-users` route at all.** `addSchoolUser()` (`lib/core/school-users.ts:19-42`) is only reached today from inside `createSchool()` itself. |
| Create classes | **Yes, mechanically** — but only after Academic Year is created first (`createClass` requires `academic_year_id`, `grade_id` as inputs, `lib/core/classes.ts:33-45`), and only by the sole `school_admin` (no other staff exist to do it, per the row above). |
| Enroll learners | **Yes, mechanically**, same caveat — `admitLearner`/`enrollLearner` both work (`lib/core/learners.ts:15-33,86-88`), but only the lone admin can drive the whole sequence, and enrollment additionally requires a Term and a Class to already exist. |
| Generate report cards | **No** | `runEndOfTerm()` (`lib/core/endOfTerm.ts:46-58`) requires every assessment for the class/term to be `is_published` first — and Assessment itself cannot be created for a Core-only school (§3.1). Report generation is unreachable, not merely difficult. |
| Run end of term | **No** | Same reason — `runEndOfTerm` depends on published assessments that cannot exist. |
| Use Compass | **Effectively no, though not "broken"** | Compass consumes Projection, which consumes confirmed Evidence. Evidence is derived from Assessment (per RAS §9's one-way Evidence-writing functions). With Assessment unreachable, there is no Evidence to write, so Compass has nothing to reason about — not a crash, but permanently empty for this school. |
| Run Learning Intelligence | **Runs cleanly but produces nothing** | `recomputeLearnerProjection()` (`lib/projection/recompute.ts:53-75`) has no special-case failure for zero evidence — a projector with no supporting evidence returns `null` for that dimension (line 58-59) and any stale row is deleted (line 64), rather than throwing. This is a deliberately clean design, but it means the correct behavior of an empty-by-necessity pipeline is indistinguishable, from the outside, from "nothing is wrong yet" — worth naming so a future engineer doesn't mistake silence for success. |

**Determination [VERIFIED]**: a brand-new school can reach School → Academic Year → Term → Class → Learner → Enrollment, entirely through its lone `school_admin`, with no help. It cannot add a second staff member, cannot create an assessment, and therefore cannot produce a report card, run end-of-term, or generate any Intelligence output. **Of the seven capabilities in Part 4's own question list, two work (Create classes, Enroll learners), one is technically reachable but practically pointless without more staff (the admin can theoretically teach everything alone), and four are hard-blocked (Invite teachers, Report cards, End of term, meaningful Compass/Intelligence output).**

---

## Part 5 — Identity Consistency (ADR-0002 Compliance)

ADR-0002 ratified `teachers.id` as the canonical Teacher-domain business identity, and `school_users` as the Permissions/membership domain's interim role field — two different tables answering two different questions, never one identity with two representations (ADR-0002 Part 1, decisive evidence, RAS §3 lines 60/73).

**What this audit found, checked directly against that ruling**:

- `createSchool()`'s automatic `addSchoolUser(..., 'school_admin', ...)` call is a **Permissions-domain** write (`school_users`), fully consistent with ADR-0002 — it never touches `teachers`, and does not need to, since `school_admin` is a membership/role concept, not a Teacher-domain identity claim.
- `createAssessment()`'s dependency on `resolveTeacher()` returning a `teachers.id` (`lib/core/assessments.ts:89`) is **exactly** the boundary ADR-0002 Part 7 already named as an unresolved, bounded edge case (admin-tier `school_users` rows with no `teachers` row) — this audit did not find a new violation here, only a live confirmation that the already-documented gap is the same one blocking school activation end-to-end. No new identity system was introduced to work around it; the error is a clear throw, not a silent fallback to a second identity space.
- No code encountered in this trace creates a second "teacher" or "school membership" table, reuses `school_users.id` where `teachers.id` is expected, or vice versa. The activation pipeline, as far as it currently reaches, respects ADR-0002's single-answer rule throughout.
- **The one open compliance question this audit surfaces, not resolved here**: any future "invite a teacher to a school" route (needed to close Part 4's blocking gap) will, per ADR-0002 and RAS §3, need to decide whether inviting a teacher creates a `school_users` row only (Permissions), a `teachers` row only, or both — and per ADR-0002's own unresolved Part 7, the second case (an admin/headteacher/deputy who is never meant to have a `teachers` row) needs its own explicit answer, not an assumption baked into the new route by whoever builds it first.

**Determination [VERIFIED]**: no new identity system, ownership violation, or ADR-0002 conflict was found anywhere in the activation pipeline as it exists today. The blocking gaps found in Parts 3–4 are capability gaps (missing routes, a schema FK pointed at the wrong table), not identity violations.

---

## Part 6 — Academic Structure Bootstrap

| Object | How created | Automatic / Manual / Seeded / Never |
|---|---|---|
| Grades | Global, platform-wide catalogue (`grades` table, confirmed live by `scripts/reference-school/02-seed-academics.ts:23-25` querying `.from('grades').select('id, code, name')`) | **Seeded once, platform-wide** — never created per-school, no per-school creation route exists |
| Subjects | Same — global catalogue (`lib/core/subjects.ts:4-6`, `listSubjects()`) | **Seeded once, platform-wide** |
| `grade_subjects` (which subjects apply to which grade, per school) | `seedGradeSubjectsForSchool(schoolId)` (`lib/core/subjects.ts:38-68`) applies CBC default compulsory/elective logic in bulk | **Manual, opt-in** — `POST /api/core/subjects` with `action:'seed'`, `requireSchoolAdmin`-gated; never auto-triggered |
| Streams | `createStream()` (`lib/core/classes.ts:16-18`) | **Manual**, one at a time, `POST /api/core/classes` with `type:'stream'` |
| Terms | Same route family as Academic Year (`app/api/core/academic-years/route.ts:57-63`) | **Manual**, one at a time, `requireSchoolAdmin`-gated |

**Determination [VERIFIED]**: Grade and Subject are correctly modeled as shared reference data (matching RAS §3's own "Subject | School (catalog: shared reference)" designation) — this is architecturally sound, not a gap. Streams and Terms, by contrast, are genuinely per-school data with **no bulk-creation helper at all** — a school needing three terms and three streams (the reference-school pattern) must make six separate manual API calls, one at a time, with no equivalent of `seedGradeSubjectsForSchool`'s bulk-seed convenience for either.

---

## Part 7 — Missing Activation Steps

Numbered, evidence-backed only:

1. **No public/principal-facing school-creation flow.** Only `app/admin/core-schools/new/page.tsx`, a platform-admin-gated internal tool, can create a school (Part 1).
2. **No orchestrated "activate a new school" function or route.** `createSchool()` creates exactly two rows; every other object (year, term, stream, grade-subject assignment, class, learner, enrollment) requires a separate, manually-triggered call across five-plus different route files (Part 2).
3. **No route to add a second teacher/staff member to an existing school.** `app/api/core/teachers` and `app/api/core/school-users` do not exist. `addSchoolUser()` is only reachable from inside `createSchool()` itself (Part 4).
4. **`class_assessments.class_id`'s foreign key targets the legacy `teacher_classes` table, not Core's `classes` table** — a hard schema-level block on ever creating an assessment against a Core-created class (§3.1). This blocks Assessment, and everything downstream of it (Report, End of Term).
5. **`createAssessment()` throws for any caller without a legacy `teachers` row**, which by construction includes the school-creating `school_admin` — a self-onboarded admin cannot create their own school's first assessment without an undocumented, out-of-band step (§3.2, restating ADR-0002 Part 7 as a live activation blocker, not merely a background identity concern).
6. **No bulk-seed helper for Terms or Streams**, unlike Grade-Subject assignment which has one (`seedGradeSubjectsForSchool`) — a school needing the standard three-terms/multiple-streams shape has no faster path than one-at-a-time manual calls (Part 6).
7. **No end-to-end test exercises the creation chain from zero.** `grep -rln "createSchool\|createAcademicYear\|createTerm\|createClass\|admitLearner" --include=*.test.ts .` returns zero matches for any test that unit/integration-tests these functions directly; the closest evidence (`scripts/reference-school/integration.test.ts`) is read-only against an *already-seeded* fixture, not a test of the creation path itself (Part 1.4, restated).
8. **Departments do not exist as a table or concept** — restated from Sprint 8C Part 2/8, not re-investigated here, but directly relevant: Academic Structure Bootstrap (Part 6) has no department-assignment step because there is nothing to assign to.

---

## Part 8 — Compare Against Real Schools

**[RESEARCH]** general knowledge of how Kenyan schools typically begin operations, not a repository finding:

| Real-school step | EduNexus equivalent | Gap |
|---|---|---|
| Admission office registers the school with the Ministry/county (NEMIS code, physical registration) | `CreateSchoolSchema` accepts a `nemis_code` field (`app/admin/core-schools/new/page.tsx` form, confirmed field present) but this is manual data entry, not integration with any external registry | No integration — acceptable, out of scope for this audit, correctly deferred per RAS §14's "Government Reporting... a read/export function... not a new identity" future-domain note |
| Academic office sets the term calendar for the year, ahead of the year starting | `createAcademicYear`/term creation exist and are correctly manual (a real school's academic office does set this by policy decision, not automation) — but there is no *bulk* "create a standard 3-term year" helper (Part 6, gap 6) | Missing convenience, not missing capability |
| Teacher assignment — HR/Deputy assigns teaching staff to the school and to specific classes | No route exists to add a second teacher at all (Part 7, gap 3) — a real school's Deputy/HR routinely does this as an ongoing operational task, not a one-time setup step | **Structural gap** — this is not a missing convenience, it is a missing capability the school will need every time it hires |
| Class creation — Dean/Academic office creates classes per grade/stream ahead of the year | `createClass` works, mechanically (Part 4) | Matches real-school practice, once Academic Year exists |
| Learner registration — Registrar admits and enrolls learners, typically in batches (a whole incoming cohort at once, not one at a time) | `admitLearner`/`enrollLearner` both operate one learner at a time — no batch-admission endpoint found (`grep -rn "admitLearner"` shows a single-learner signature at `lib/core/learners.ts:15`) | Missing convenience for a real, common real-school operation (bulk cohort admission) |
| Timetable — Deputy/Dean allocates periods, ahead of teaching starting | No Timetable domain exists (restated from Sprint 8C Part 8/9, "Core," not yet built) | Confirmed absent, correctly out of this document's scope per Sprint 8C's own prior classification |
| Department allocation — HOD structure set up, subjects grouped under departments | Departments do not exist (Part 7, gap 8) | Confirmed absent |

**Determination [RESEARCH + VERIFIED]**: the closest real-school analogue to EduNexus's current activation sequence is a school that has completed Admission and Academic-office setup (Year/Term/Class exist, mechanically) but has **no HR function** (cannot add staff) and **no ability to actually teach** (Assessment is schema-blocked) — a school that can be structurally configured but cannot yet run a single lesson to completion in the product.

---

## Part 9 — Implementation Roadmap

Each item: Reason, Dependencies, Risk, Expected impact. This section proposes no code — it orders the gaps found in Part 7 for whoever scopes the eventual implementation sprint, per this document's own Constraints.

### Immediate (blocks any real school from ever finishing a term)
1. **Fix the `class_assessments.class_id` FK to point at Core's `classes` table (§3.1, Part 7 gap 4).** *Reason*: this is the single hard blocker preventing Assessment → Report → Promotion from ever working for a Core-created school — everything else in this roadmap is moot if this isn't resolved. *Dependencies*: none upstream; this is itself the root blocker. *Risk*: schema migration touching a live, heavily-used table (`class_assessments` has 51+ file references per ADR-0002 Part 2) — must follow RAS §7's Add→Backfill→Verify→Observe→Remove sequence, not a same-step ADD+DROP. *Expected impact*: unblocks the entire back half of the dependency graph (§3, Part 3) for every future Core-only school.
2. **Resolve the admin-tier `createAssessment` throw (§3.2, ADR-0002 Part 7's already-named gap).** *Reason*: without this, even after item 1 is fixed, a solo school-admin still cannot create their own school's first assessment. *Dependencies*: a product decision (does an admin get a `teachers` row automatically, or does `createAssessment` accept a non-teacher caller under a different code path?) — explicitly named in ADR-0002 Part 7 as a separate, not-yet-made decision. *Risk*: low technically, but blocked on a decision, not code. *Expected impact*: closes the last hard block on a solo-admin school reaching its first assessment.

### Before Pilot (blocks a real school from onboarding without hand-holding)
3. **Build a teacher-invite route (Part 7 gap 3).** *Reason*: a school with only one user (the admin) cannot function as a real school — every pilot school will need at least a handful of teachers added. *Dependencies*: Part 5's open identity question (does inviting a teacher create a `teachers` row, a `school_users` row, or the correct combination per ADR-0002) must be answered first, or the route will re-introduce the exact ambiguity ADR-0002 closed. *Risk*: medium — touches Permissions/Teacher identity, the exact domain ADR-0002 governs; should be scoped with an explicit re-read of ADR-0002 Part 7 before design. *Expected impact*: closes Part 4's largest single capability gap.
4. **Give the school-creation flow a real, principal-facing UI (Part 7 gap 1), or explicitly decide it stays platform-admin-only for pilot.** *Reason*: the current form is a stated internal tool; whether pilot schools should self-register or be onboarded by the platform team is a product decision, not something this audit should assume either way. *Dependencies*: none technical; this is a product-scope question. *Risk*: low, reversible (a route/UI addition, not a schema change). *Expected impact*: determines whether "Sprint 9A Phase 3" (implementation) targets a self-serve flow or an admin-assisted one — materially changes the shape of the next sprint.

### Before 10 Schools
5. **Orchestrate the manual sequence (Part 7 gap 2) into a single guided flow** (year → terms → streams → classes), once items 1–4 land and the individual steps are proven correct in isolation. *Reason*: five-plus separate manual API calls per school does not scale past a handful of pilot schools onboarded by hand. *Dependencies*: items 1–4 (no point orchestrating a sequence that still dead-ends at the Assessment FK). *Risk*: low — this is composition of already-correct pieces, not new business logic, consistent with RAS §5's "services never duplicate" rule if built as a thin orchestration over the existing `lib/core/*` functions. *Expected impact*: turns a multi-day manual onboarding into a single guided setup.
6. **Add bulk-creation helpers for Terms and batch learner admission (Part 7 gap 6, Part 8 finding).** *Reason*: matches real registrar/academic-office practice (a whole cohort admitted together, a standard 3-term year set up in one action), reduces the number of individual API calls item 5's orchestration would otherwise need to make. *Dependencies*: item 5 benefits from these existing first, but is not strictly blocked by them. *Risk*: low. *Expected impact*: operational efficiency once several real schools are onboarding simultaneously.

### Before 100 Schools
7. **Write the end-to-end activation test this audit found missing (Part 7 gap 7).** *Reason*: at 100-school scale, a regression in any step of the activation chain is a much higher-cost incident than at pilot scale; there is currently zero automated coverage proving `createSchool → createAcademicYear → createClass → admitLearner → enrollLearner → createAssessment` works as a chain. *Dependencies*: items 1–2 (no point testing a chain that's known-broken at the Assessment step). *Risk*: low to build, but should be prioritized before scale, not after an incident. *Expected impact*: converts the reference-school script's manual, work-around-driven verification into a permanent regression guard.

### Later
8. **Departments (Part 7 gap 8, restated from Sprint 8C Part 8/9's "Core" classification).** *Reason*: already scoped and prioritized by Sprint 8C as a "Core" future domain, unlocking Academic Governance broadly — this audit found nothing that changes that prior classification, only confirms Academic Structure Bootstrap (Part 6) has no department-assignment step today because the domain doesn't exist. *Dependencies*: Sprint 8C's own roadmap, not re-derived here. *Risk/impact*: deferred to whichever future sprint scopes Departments specifically, per Sprint 8C's Stop Condition.

### Research
9. **The identity question flagged in Part 5** (what exactly happens, identity-wise, when a teacher is invited) needs its own short, targeted decision — likely a small addendum to ADR-0002 rather than a full new ADR, since ADR-0002 already ratified the underlying principle and only needs its Part 7 edge case formally closed, not reopened.

---

## Part 10 — Architectural Assessment

**Does the current activation model align with the RAS, ADR-0002, and the Constitution?**

- **RAS §3 (Canonical Domain Standards)**: Aligned. Every table this audit traced (School, Academic Year/Term, Class, Stream, Learner) is accessed through its RAS-designated repository/service (`SchoolRepository`/`lib/core/school.ts`, `ClassRepository`/`lib/core/classes.ts`, `LearnerRepository`/`lib/core/learners.ts`) — no cross-domain repository access was found in this trace. **No violation.**
- **RAS §6 (API Standards)**: Aligned for the routes that exist — each calls exactly one canonical service, validates with Zod, checks `auth.getUser()` first. **Not violated by what exists; violated by omission** — the *absence* of a teacher-invite route (Part 7 gap 3) isn't itself a standards violation (RAS §6 doesn't mandate every domain have a route today), but it is the concrete manifestation of RAS §3's own "Teacher | ... | Class, Assessment (as created_by), Permissions" allowed-consumers row never being reachable in practice for any teacher but the school's creator.
- **RAS §7 (Database Standards)**: **One direct violation, already-existing, confirmed by this audit, not newly introduced.** `class_assessments.class_id REFERENCES teacher_classes(id)` while the Core service layer (`lib/core/assessments.ts`) is written against Core's `classes` table is exactly the kind of table-vs-code mismatch §7's migration rules (Add→Backfill→Verify→Observe→Remove) exist to prevent — this predates this audit (found first by the reference-school seed script's author) and is not something this document is raising for the first time, but it is the single clearest RAS §7 non-compliance this trace encountered.
- **ADR-0002**: No new violation (Part 5). The admin-tier `createAssessment` throw is ADR-0002's own already-documented, deliberately-unresolved Part 7 edge case, not a new conflict this audit discovered.
- **Constitution**: Restating RAS §13's Evolution Policy ("prefer evolution over replacement... usage is evidence, schema elegance alone is not") — the activation pipeline as far as it reaches (School→Year→Term→Class→Learner→Enrollment) correctly evolves the Core schema rather than introducing a parallel one. The point where it breaks (§3.1's FK) is not a Constitutional violation in the "duplicate identity/duplicate write path" sense the First Law addresses — it's a straightforward, single, identifiable schema defect, narrower in scope than a full architectural conflict.

**If not — precise violation.** One precise, already-real (not newly introduced) violation: **`class_assessments.class_id`'s foreign key target contradicts the table it is written against**, per RAS §7. This is narrow enough to be an ADR-triggering "changes a canonical table's identity semantics" case *only if* the fix chosen is a rename/re-anchor of what `class_id` means (RAS §12) — a straightforward FK-repoint-plus-backfill migration, scoped and reviewed per RAS §7's existing migration rules, would not itself require a new ADR unless it also changes which table is canonical for Class (RAS §3 already names `teacher_classes (evolving)` as canonical for Class — a migration that finishes evolving `class_assessments` to point at the *evolved* target, consistent with that existing designation, is executing an already-ratified decision, not making a new one).

**Overall verdict**: the activation model, as far as it reaches, is architecturally compliant. It simply does not reach far enough — it stops one step before a school can complete a single assessment, for reasons that are precisely identified (Parts 3, 7) rather than diffuse.

---

## Answer to the Governing Question

**"If a principal signs up today, what exact sequence of system actions is required before teachers can start teaching?"**

They cannot sign up. A platform-admin-gated internal tool (`app/admin/core-schools/new/page.tsx`) must create the school on their behalf. After that:

1. Platform admin (or whoever holds the school's `school_admin` session) calls `POST /api/core/academic-years` to create an Academic Year.
2. Same admin calls the same route (`type:'term'`) to create each Term, one at a time — no bulk helper.
3. Same admin calls `POST /api/core/classes` (`type:'stream'`) to create Streams, one at a time, if wanted (optional — `createClass` doesn't require one).
4. Same admin calls `POST /api/core/classes` to create each Class, supplying a pre-existing global `grade_id` and the `academic_year_id` from step 1.
5. Same admin calls `POST /api/core/subjects` (`action:'seed'`) to bulk-assign the CBC default subject catalogue to the school's grades — the one step with a bulk helper.
6. Same admin calls `POST /api/core/learners` once per learner to admit them, then `PATCH /api/core/learners/[id]` (`action:'enroll'`) once per learner to enroll them into a class/term/year.
7. **At this point, no second teacher has been added — there is no route to do so.** The school's sole `school_admin` is the only user who can act.
8. Were that admin to attempt to create the school's first assessment (`POST` the assessments route), it would fail — first because `class_id` (a Core `classes.id`) violates the live FK to `teacher_classes` (§3.1), and independently because the admin has no `teachers` row and `resolveTeacher()` returns null (§3.2).

**Teachers cannot start teaching** in the product sense (recording an assessment) at any point in this sequence, for a school that exists purely in Core. The sequence above is real and mechanically works through step 6; it dead-ends at step 8, not because of a missing feature so much as a schema pointer left mid-migration.

---

## What This Document Does Not Do

Per its own Constraints: proposes no schema, code, migration, route, or test — Part 9's roadmap is prioritization and dependency ordering over evidence gathered in Parts 1–8, not a commitment or an implementation plan. Does not resolve the admin-tier teacher-identity question (Part 5, Part 9 item 9) — that remains ADR-0002 Part 7's own stated open scope boundary, restated, not re-decided, here. Does not re-investigate Promotion/Graduation/Archive, Departments, or the twelve-lifecycle-stage findings — those are restated from Sprint 8C where directly relevant to the dependency graph (Part 3) and otherwise left as that document's own closed findings. No ADR is raised: the one RAS §7 non-compliance found (§3.1's FK) is pre-existing and already independently discovered by the reference-school seed script, not a new canonical-domain conflict this document surfaces for the first time; a straightforward migration to complete Class's already-ratified "(evolving)" status resolves it without requiring a new architectural decision.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only `docs/architecture/sprint-9a-phase2-school-activation-audit.md` and the implementation-log entry were written.
- Every load-bearing claim in this document (the FK target, the `resolveTeacher` throw, the `ADMIN_EMAILS` gate, the route surface) was independently spot-verified this session by direct file read/grep, not carried over from the research pass without re-checking.

## Stop Condition

STOP after this document. Per its own framing note above, this is another audit, not implementation, regardless of the sprint's stated intent — Part 9's roadmap is ready to be scoped into an actual implementation sprint (starting with Immediate items 1–2), but that scoping and the explicit approval to write code should happen as its own deliberate step, consistent with Sprint 8C's Stop Condition and this project's standing Architecture Guardian / Phase B Engineering Execution modes.
