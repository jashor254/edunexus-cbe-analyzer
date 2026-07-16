# ADR 0002: Canonical Teacher Identity for Assessment-Domain Business Identity

**Status: APPROVED** (scope: which identity table is canonical for "who is the teacher of record" in the Assessment domain and its immediate neighbors — see Decision for exact scope boundary). READ ONLY. No code, test, migration, or repository was modified in producing this ADR.

---

## Part 1 — Historical Reconstruction

All dates from `git log --diff-filter=A` against `supabase/*.sql`/`supabase/migrations/*.sql`, verified against actual file content at each commit (not inferred from commit messages alone).

| Question | Answer | Evidence |
|---|---|---|
| **Which came first?** | `teachers` — by 86 days. | `teachers` table first created in commit `f1df303d` (2026-04-03, "Teacher portal, IGCSE support…"), confirmed via `git log -S"CREATE TABLE IF NOT EXISTS teachers"`. `class_assessments`/`learner_marks` (FK'd to `teachers.id`) followed in commit `cb5f49796` (2026-05-26, `supabase/marksheet_migration.sql:6-19`). `school_users` (and Core generally) did not exist until commit `025641cfa` (2026-06-28, `supabase/migrations/20260629_core_foundation.sql`) — 33 days after `class_assessments`, 86 days after `teachers` itself. |
| **Why was the second introduced?** | Core was built as a deliberately separate, additive multi-tenant layer for PP1–Grade 9 school management — not to replace `teachers`. | The migration's own header states this explicitly: *"Comprehensive school management layer for PP1–Grade 9 schools. **100% additive — zero modifications to existing OS tables or logic.**"* (`20260629_core_foundation.sql:1-7`). The commit message repeats it: *"Zero modifications to existing OS tables or logic."* `school_users` was created to answer a different question — school-scoped role/membership — not to be a Teacher-domain replacement. |
| **Was migration ever intended?** | No formal migration was ever scheduled specifically for Teacher identity. An *informal* intent to eventually address it exists, bundled with the Learner/Class identity questions. | `docs/architecture/stage-0.5-canonical-identity-resolution.md` Part 4 lists "Teacher-School membership" with the same interim/target framing as Learner/Class, and Part 5/"Required Phase Changes" #1 explicitly groups it: *"Insert a Learner & Class Identity Resolution phase… Class has the identical shape of problem"* — Teacher-School membership is listed in the same violations table (Part 5, First Law row 3) but is never given its own dedicated phase or execution-plan stage. No `docs/architecture/adr/*.md` predating this one addresses Teacher identity at all (only `0001-class-students-parent-id-guardian-mechanism.md` exists, and it concerns Guardian, not Teacher). |
| **Was migration abandoned?** | UNKNOWN, more precisely: never formally started, so "abandoned" would overstate it. No evidence of a started-then-stopped migration effort was found (no dead migration file, no reverted PR referencing this, no commit removing partial Teacher-identity-migration work). | Absence of evidence, not evidence of absence — stated explicitly per this ADR's rule against inferring. |
| **Was dual-write ever planned?** | UNKNOWN — no evidence found. | No architecture document, code comment, or migration references a dual-write mechanism for `teachers`/`school_users` specifically. (Contrast with e.g. `docs/architecture/migration-ledger.md`'s documented dual-read patterns for Projection/legacy risk fields — no equivalent exists for Teacher identity.) |
| **Was any ADR previously approved?** | No. | `docs/architecture/adr/` contains exactly one file, `0001-class-students-parent-id-guardian-mechanism.md`, which is itself still `DRAFT — NOT APPROVED` and concerns the Guardian domain, not Teacher. This is the first Teacher-identity ADR. |

**One additional, decisive piece of historical/architectural evidence, not a "reconstruction" question but directly resolving Part 4's central question**: the Reference Architecture Specification — already ratified, predating this ADR — has **already named the canonical table for the Teacher domain**:

> `Teacher | School | teachers (evolving) | TeacherRepository | lib/core/teachers.ts | app/api/core/teachers/** | School-scoped RLS | School | Class, Assessment (as created_by), Permissions | —` (`docs/architecture/reference-architecture-specification.md:60`)

`school_users` appears in the RAS exactly once, and not as a Teacher-domain candidate — it is named as the **Permissions domain's** interim role field:

> `Permissions | — (relationship, not owned data) | school_users role field (interim), consolidated model (target, §8) | PermissionRepository (reserved) | lib/core/permissions.ts (reserved) | …` (`reference-architecture-specification.md:73`)

This is the single most important fact in this ADR: the RAS already treats "who is the teacher" (Teacher domain, line 60) and "does this user have a role in this school" (Permissions domain, line 73) as **two different questions answered by two different tables**, not one identity with two representations. Sprint 5D/5E's confusion arose from `app/api/core/assessments/route.ts` answering the first question with the second table's id.

---

## Part 2 — Repository-Wide Identity Audit

Method: `grep -rl` across `lib/`, `app/`, `scripts/` (excluding `*.test.ts`), for exact call patterns, re-run fresh in this session (not reused from a prior sprint's possibly-stale counts).

| Reference type | File count | Representative evidence |
|---|---:|---|
| `.from('teachers')` | 51 | `lib/repositories/teacher.repository.ts`, `lib/core/identity.ts:113-122` |
| `resolveTeacher(...)` calls | 45 | `lib/core/permissions.ts:96-111` (`requireClassTeacher`), every Batch A-D teacher route |
| `.from('school_users')` | 6 | `lib/repositories/teacher.repository.ts:247-256` (`findSchoolUser`) |
| `getSchoolUser(...)` calls | 3 | `lib/core/school-users.ts:5-10`, `lib/core/identity.ts:160-163` (`resolveMembership`) |
| `teacher_id` (any table/column) | 122 | see classification below |
| `class_teacher_id` | 6 | `lib/core/classes.ts:39,50,69`, Core's `classes` table only |
| `teacher_classes` | 42 | legacy Class domain, `lib/repositories/teacher.repository.ts`, `lib/core/permissions.ts:96-111` |

**Classification of `teacher_id`/`teachers.id` occurrences** (by function/purpose, not by raw grep count — a single file often serves more than one purpose):

| Classification | Count (files) | Evidence |
|---|---:|---|
| **Canonical business identity** (the actual "who is the teacher of record") | ~15 | `lib/repositories/assessment.repository.ts` (9 methods filtering `.eq('teacher_id', teacherId)`: lines 143, 158-159, 172, 190-191, 207, 418, 532, 1261, 1296); `lib/academicClinic/assessmentPipeline.ts:292`; `lib/adaptiveLearning/differentiation.ts:64,108`; `lib/assessments/topical.ts:41` (`strand_assessments.teacher_id`) |
| **Authorization only** | ~5 | `lib/core/permissions.ts:96-111` (`requireClassTeacher`); the live RLS policy `"Teachers manage own assessments"` on `class_assessments` (`teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())`, confirmed via `pg_policy`) |
| **Audit metadata / passthrough, no decision made on it** | 1 | `lib/repositories/assessment.repository.ts:240` (`findAssessmentContext` returns `teacher_id: raw.teacher_id` but no caller reads it for a decision) |
| **Legacy compatibility** (column exists because the table is shared/retrofitted, not because Core needs it) | ~4 | `class_assessments.teacher_id` (Core's `createCoreAssessment` writes it but never filters by it); `assessment_types.teacher_id`; `assessment_quality_flags.teacher_id` |
| **Intelligence Layer** | 0 | Zero references in `lib/projection/`, `lib/career/` (`capabilityExtractor.ts` and siblings), `lib/learnerRecord/` (production code; test-only fixtures excluded) |
| **Reporting** | 1 | `lib/school/intelligence.ts:40,44-45,163,208,332,351-352` — School Intelligence (principal-facing aggregate reporting) reads/anonymizes `teachers.id`, confirming even principal-level reporting is anchored to legacy identity |
| **Repository only** (no business meaning beyond being a DB column) | ~2 | `lib/repositories/assessmentType.repository.ts` (`AssessmentTypeRow.teacher_id`) |
| **Unknown** | 0 | Every occurrence found was traceable to one of the above; none required an `UNKNOWN` classification |

**Classification of `school_users.id`/`class_teacher_id` occurrences**:

| Classification | Count (files) | Evidence |
|---|---:|---|
| **Canonical business identity** | 2 | `lib/core/classes.ts:39,50,69` — Core's own `classes.class_teacher_id → school_users.id`, the one place Core correctly uses this id space for a teacher-assignment concept |
| **Authorization only** | 4 | `lib/core/identity.ts:160-163` (`resolveMembership`), `lib/core/permissions.ts` (`requireSchoolMembership`, `requireSchoolAdmin`, `requireSchoolStaff`, `canManageAssessment`'s admin-tier branch) |
| **Legacy compatibility** | 0 | N/A — `school_users` is the newer table; nothing legacy depends on it |
| **Intelligence Layer** | 0 | Zero references anywhere in `lib/projection/`, `lib/career/`, `lib/learnerRecord/`, `lib/academicClinic/`, `lib/adaptiveLearning/`, `lib/compass/` (all confirmed via direct grep this session) |
| **Reporting** | 0 | `lib/school/intelligence.ts` (School Intelligence reporting) uses `teachers.id` exclusively, not `school_users.id` |
| **Repository only** | 1 | `lib/repositories/teacher.repository.ts:247-256` (`findSchoolUser`) |
| **Unknown** | 0 | — |

---

## Part 3 — Dependency Graph

```
Authentication (auth.users.id)
   │  required, one-way (every downstream node needs this; nothing feeds back)
   ▼
school_users               ← REQUIRED for: role/membership authorization (requireSchoolMembership,
   │                           canManageAssessment's admin branch), Core's classes.class_teacher_id
   │  optional, one-way      ← OPTIONAL for: Teacher-domain business identity — a school_users row
   ▼                           exists independent of whether its holder is ever resolved as a teachers row
teachers                   ← REQUIRED for: every legacy-surface authorization/scoping filter (9+ repo
   │                           methods), the class_assessments RLS policy, Academic Clinic, Adaptive
   │                           Learning, Learning Compass ownership, School Intelligence reporting
   │  required, one-way
   ▼
teacher_classes             ← REQUIRED: FK'd directly to teachers.id (teacher_classes.teacher_id
   │                           NOT NULL REFERENCES teachers(id)); this is the de-facto-canonical Class
   │                           table per requireClassTeacher's own design comment (permissions.ts:88-95)
   │  required, one-way
   ▼
class_assessments            ← REQUIRED: teacher_id NOT NULL REFERENCES teachers(id) (confirmed live via
   │                           information_schema); class_id REFERENCES teacher_classes(id)
   │  optional / LEGACY, one-way (reports do not require teacher_id to already be correct — they read
   │                           class_assessments' *content*, not its ownership column)
   ▼
reports (school_report_cards / term_subject_summaries / legacy AI report pipeline)
   │  ZERO arrow — no dependency found
   ▼
intelligence (learner_evidence / learner_projections / capabilityExtractor / recomputeLearnerProjection)
```

**Arrow classification, evidenced**:
- **Authentication → school_users**: required, one-way. Every school-scoped action needs a membership row; nothing about `school_users` feeds back into raw auth.
- **school_users → teachers**: **optional, one-way, and currently the crux of the gap**. Nothing enforces that a `school_users` row has a corresponding `teachers` row — live data confirms this (Part 4 evidence, Sprint 5E/5D). The arrow exists in practice (39 of 39 `role='teacher'` rows happen to have one) but is not a schema-enforced relationship.
- **teachers → teacher_classes**: required, one-way. `teacher_classes.teacher_id` is `NOT NULL REFERENCES teachers(id)`.
- **teacher_classes → class_assessments**: required, one-way. `class_assessments.class_id REFERENCES teacher_classes(id)` (live FK, confirmed via `information_schema` in the prior sprint's audit).
- **class_assessments → reports**: **legacy/optional, one-way**. Report generation (both the Core `school_report_cards` path and the legacy AI path) reads assessment *content* (`subject_scores`/`marks`), not `teacher_id` — confirmed zero references to `teacher_id` in `lib/core/report-cards.ts`, `lib/core/endOfTerm.ts`, `lib/assessments/pdfRenderer.ts`.
- **reports → intelligence**: **no arrow found**. Confirmed zero references to `teacher_id`/`school_users` in `lib/projection/`, `lib/career/`, `lib/learnerRecord/` production code. Teacher identity does not propagate into Intelligence at all, in either direction.

---

## Part 4 — Option Analysis

### Option A — `teachers.id` remains canonical

- **Architecture**: Matches the RAS's already-ratified Teacher-domain designation (`reference-architecture-specification.md:60`) and Stage 0.5's independently-derived recommendation (same "evolve the heavily-used legacy table, don't migrate onto the isolated new one" pattern found for Learner/Class).
- **Security**: No change to the existing RLS policy (`teacher_id = teachers.id for auth.uid()`) — already-battle-tested, if currently unenforced in practice (service-role bypass, per Sprint 5E's audit).
- **RAS compliance**: Direct compliance — this *is* the RAS's stated position, not merely compatible with it.
- **Constitution compliance**: Consistent with the First Law's evolving-not-duplicating intent as applied to Learner/Class in Stage 0.5; no violation identified.
- **CLAUDE.md compliance**: Consistent with "identity resolution belongs in `lib/core/identity.ts`" (already the case — `resolveTeacher`); no new violation.
- **Repository complexity**: Lowest of the three options — no new lookup table, no new repository, reuses `resolveTeacher()` exactly as `requireClassTeacher` already does.
- **Migration cost**: None for the identity model itself. `teachers` is annotated "(evolving)" in the RAS, meaning it is expected to eventually gain institutional fields (e.g. a real `school_id` FK, currently a free-text `school` column per `data-migration-strategy.md:15`) — that evolution is a separate, already-flagged, not-yet-scheduled piece of work, not created by this decision.
- **Future maintenance**: Low — one canonical identity for the entire legacy-anchored surface (assessments, marks, Academic Clinic, Adaptive Learning, Compass, School Intelligence reporting).
- **Testing impact**: Minimal — every existing test fixture already builds `teachers` rows (`lib/core/permissions.classownership.test.ts`, `permissions.assessmentbatch.test.ts`, `lib/core/coreAssessmentTypeIntegrity.test.ts`, etc.); no fixture rework needed.
- **Backward compatibility**: Full for the 39-of-39 `role='teacher'` `school_users` rows that already have a matching `teachers` row (live data, this session). **Not full** for admin-tier `school_users` rows: live data confirms **0 of 9** `school_admin`/`headteacher`/`deputy_headteacher` rows have a `teachers` row — Option A alone does not answer what happens when such a user creates an assessment (an open, real, currently-existing case, not hypothetical).
- **Pilot-school impact**: Low-to-none for the 39 real teacher accounts; the 9 admin accounts represent a genuine, live gap this option does not close by itself.
- **Risk of divergence**: Low — `teachers.id` is already the single, consistently-used anchor across every legacy-surface consumer found in Part 2.
- **Future Intelligence Layer compatibility**: Highest of the three — Ranking, Grading, Evidence, Projection, Career Intelligence, Academic Clinic, Adaptive Learning, and Learning Compass all either use `teachers.id` exclusively or don't reference teacher identity at all (Part 5); none reference `school_users.id` anywhere.

### Option B — `school_users.id` becomes canonical

- **Architecture**: Contradicts the RAS's existing, ratified Teacher-domain table designation (`teachers`, line 60) — would require either amending the RAS or accepting an inconsistency between this ADR and an already-approved document.
- **Security**: Would require rewriting the `class_assessments` RLS policy (and any equivalent on `teacher_classes`/`students`, not audited for RLS in this pass) to key off `school_users.id` instead of `teachers.id` — a live security-surface change, not a no-op.
- **RAS compliance**: Direct conflict, as stated above — would require an amendment to `reference-architecture-specification.md:60,73` merging the Teacher and Permissions domains' identity source.
- **Constitution compliance**: UNKNOWN — no Constitution document reviewed in this pass takes a position on Teacher domain identity specifically (only Learner/Class are discussed at that level of detail in Stage 0.5).
- **CLAUDE.md compliance**: No direct conflict, but "no duplicate constant definitions/logic" cuts against introducing a second identity path for something 96 files already do one way.
- **Repository complexity**: Highest — every one of the ~15 canonical-business-identity call sites in Part 2 (all 9 `AssessmentRepository` methods, Academic Clinic, Adaptive Learning, Compass's `resolveTeacherOwnership`) would need to change what "the teacher" means, simultaneously.
- **Migration cost**: Very high — see Part 6.
- **Future maintenance**: Higher — `school_users.id` has zero current footprint in Intelligence/reporting/pedagogical code (Part 2); adopting it as canonical creates the migration burden without any evidence it already serves those consumers better.
- **Testing impact**: Every teacher-fixture-building test in the codebase (at minimum `permissions.classownership.test.ts`, `permissions.assessmentbatch.test.ts`, `assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `coreAssessmentTypeIntegrity.test.ts`) would need new or modified fixtures.
- **Backward compatibility**: Would break for the 47 real live `teachers` rows unless a bridge/backfill runs first — and 8 of those 47 (47 minus the 39 with a matching `school_users` row) have **no** `school_users` row at all, meaning Option B has the mirror-image gap of Option A's admin-edge-case, just on the opposite side (teachers with no `school_users` row instead of admins with no `teachers` row).
- **Pilot-school impact**: Higher than Option A — affects more of the currently-working legacy surface (assessments, marks, Academic Clinic, Adaptive Learning, Compass), not just the currently-broken Core creation path.
- **Risk of divergence**: High during any transition period — two identity spaces would need to be kept in sync across 96+ files rather than the current, evidenced single-anchor pattern.
- **Future Intelligence Layer compatibility**: Lowest — would require introducing `school_users.id` into Academic Clinic, Adaptive Learning, and Learning Compass, none of which reference it today, for no evidenced benefit.

### Option C — Permanent dual identity

- **Architecture**: This is, in effect, **the current de facto state**, not a proposal — `teachers.id` and `school_users.id` already coexist permanently, serving different domains (Teacher vs. Permissions, per the RAS). The open question this ADR was convened to answer is specifically *which one is canonical for Teacher-domain business identity*, not whether both tables may continue to exist (they clearly may — `school_users` also serves Permissions, a role this ADR does not touch).
- **Security**: No change from today, for better or worse — the RLS-bypass-via-service-role gap found in Sprint 5E's audit remains exactly as it is.
- **RAS compliance**: Compliant, if read narrowly (the RAS already has both tables, for different domains) — but if "permanent dual identity" means *treating both as equally valid answers to "who is the teacher of record"* (the actual ambiguity Sprint 5D/5E exposed), that directly contradicts the RAS's single-answer designation at line 60.
- **Constitution compliance**: Conflicts with the First Law (Canonical Identity) as applied elsewhere in this codebase (Stage 0.5's entire framing of Learner/Class treats "two tables answering the same question" as a violation to resolve, not a state to make permanent).
- **CLAUDE.md compliance**: Directly conflicts with "No duplicate constant definitions across files" applied at the identity level — accepting permanent dual identity for the *same question* is the identity-layer equivalent of the duplicate-mapping problem already found and flagged in Sprint 5D (`docs/engineering/sprint-5d-assessment-type-audit.md` §6).
- **Repository complexity**: Would require every future canonical-business-identity call site to explicitly decide, case by case, which id space applies — the exact copy-paste-prone failure mode `lib/core/permissions.ts`'s own header comment (`permissions.ts:8-13`) was written to prevent for authorization, generalized to identity.
- **Migration cost**: Zero upfront, but this option defers cost rather than eliminating it — every future feature touching "who is the teacher" re-incurs the Sprint 5D/5E discovery cost.
- **Future maintenance**: Highest ongoing cost of the three — no other identity question in this codebase (Learner, Class) has been left in this state without an explicit interim/target designation (Stage 0.5 gave both an evolving-target answer even before full migration).
- **Testing impact**: Would require every new test to explicitly assert *which* identity a given code path uses, since no default could be assumed.
- **Backward compatibility**: Full, by construction (nothing changes).
- **Pilot-school impact**: None immediately, but leaves the exact bug this ADR series exists to close (Sprint 5D → 5E → this ADR) permanently unresolved for any *future* Assessment-domain or adjacent feature.
- **Risk of divergence**: Highest — explicitly the risk this option accepts rather than closes.
- **Future Intelligence Layer compatibility**: Same as Option A in practice (Intelligence already only ever sees `teachers.id` where it sees anything) — but without ever formally saying so, leaving every future Intelligence-adjacent feature to re-discover this independently.

---

## Part 5 — Future Architecture Compatibility

Evidence only, per subsystem (all confirmed via direct grep this session, production code only, test fixtures excluded):

| Subsystem | `teachers.id` references | `school_users.id` references | Reading |
|---|---:|---:|---|
| Ranking Engine (`lib/ranking/`) | 0 | 0 | Teacher identity irrelevant to either option |
| Grading Engine (`lib/grading/`) | 0 | 0 | Teacher identity irrelevant to either option |
| Evidence Engine (`lib/intelligence/`) | 0 (production) | 0 | Anchored to `students.id` per Stage 0.5's Fourth Law finding — teacher identity doesn't reach this layer at all |
| Projection Engine (`lib/projection/`) | 0 | 0 | Same — confirmed no reference in `recompute.ts`/`engine.ts` |
| Career Intelligence (`lib/career/`) | 0 (`seedCareers.ts`'s hit is an unrelated text string, not an identity reference) | 0 | Same |
| Academic Clinic (`lib/academicClinic/`) | 1 (`assessmentPipeline.ts:292`) | 0 | Uses `teachers.id` exclusively where teacher identity is needed at all |
| Adaptive Learning (`lib/adaptiveLearning/differentiation.ts`) | 2 (lines 64, 108) | 0 | Same |
| Learning Compass (`lib/compass/ownership.ts`) | Multiple — the entire ownership model (`resolveTeacherOwnership`, lines 31-38) | 0 | Same, and this is the closest analog to the exact question this ADR answers — Compass already resolved it in favor of `teachers.id` |
| Reference School (`scripts/reference-school/`) | 8 files, including a purpose-built `schoolUserIdToLegacyTeacherId` bridge map (`06-seed-legacy-bridge.ts:263`) | Same 8 files (both ids appear, bridged) | The reference-school build *already* treats `teachers.id` as the target identity that `school_users.id` must be resolved into, not the reverse — direct precedent for Option A |
| Core Foundation (`supabase/migrations/20260629_core_foundation.sql`) | N/A (introduces `school_users`) | N/A | Explicitly additive per its own header (Part 1) — never asserted `school_users` should replace `teachers` |

**Reading**: every subsystem that references teacher identity at all — Academic Clinic, Adaptive Learning, Learning Compass, and the Reference School build process itself — already independently converged on `teachers.id`. Ranking, Grading, Evidence, and Projection don't reference teacher identity at all, meaning they are agnostic to this decision by construction, not because it was deliberately kept out (per the Fourth Law's clean anchoring, already noted in Stage 0.5). This is a consistent pattern across every one of the ten systems named in Part 5's requested list, with zero contradicting data points found.

---

## Part 6 — Migration Impact

**If Option A were adopted** (i.e., ratify the status quo, close the gap only where it's actually broken — Core's assessment creation):
- **Files requiring eventual attention**: 1 production file (`lib/core/assessments.ts` — the previously-reverted `createAssessment`, per `docs/engineering/implementation-log.md`'s "Sprint 5E Correction" entry) + 1 route (`app/api/core/assessments/route.ts`), to correctly resolve `teachers.id` for the *teacher-role* case, plus a **separate, explicit decision** (not resolved by this ADR) for the admin-tier case (9 live users with no `teachers` row).
- **Repositories**: 0 new repositories; reuses `lib/core/identity.ts::resolveTeacher` and `lib/assessments/mutations.ts::resolveOrCreateAssessmentType`, both already exported and tested.
- **Migrations**: 0 required for the identity decision itself. The RAS's "(evolving)" annotation on `teachers` implies a *future*, separately-scoped schema evolution (e.g. a real `school_id` FK) — not triggered by this ADR.
- **Tests**: 0 existing tests need to change; new tests would be scoped to whatever Sprint 5F designs for the two remaining call sites.
- **Risk**: Low — this is the already-dominant pattern; risk is concentrated entirely in the admin-tier edge case, which is bounded (9 known users, not an unknown quantity).

**If Option B were adopted** (i.e., `school_users.id` becomes canonical for Teacher-domain business identity):
- **Files requiring eventual migration**: at minimum, every file in Part 2's "canonical business identity" and "authorization only" rows for `teachers.id` — **51 files** referencing `.from('teachers')` directly, **45 files** calling `resolveTeacher()`, `lib/compass/ownership.ts`'s entire ownership model, `lib/academicClinic/assessmentPipeline.ts`, `lib/adaptiveLearning/differentiation.ts`, `lib/school/intelligence.ts`'s reporting layer, and `lib/repositories/assessment.repository.ts`'s 9 filtering methods — **conservatively 60+ distinct files**, before accounting for indirect callers of any of them.
- **Repositories**: `lib/repositories/assessment.repository.ts`, `lib/repositories/teacher.repository.ts`, `lib/repositories/assessmentType.repository.ts` would all need their teacher-scoping logic rewritten.
- **Migrations**: at minimum, `class_assessments.teacher_id`, `learner_marks.teacher_id`, `strand_assessments.teacher_id`, `assessment_types.teacher_id`, `assessment_quality_flags.teacher_id`, and `teacher_classes.teacher_id` itself would all need their FK target changed from `teachers(id)` to `school_users(id)` (or a mapping layer maintained permanently, which is Option C in disguise) — 6+ schema migrations, plus a backfill for the 8 of 47 `teachers` rows with no matching `school_users` row.
- **Tests**: every test file building a `teachers` fixture for ownership purposes (at minimum the 4 named in Option B's evaluation above) would need rework.
- **Risk**: High — touches the entire currently-working legacy teacher surface (assessments, marks, Academic Clinic, Adaptive Learning, Compass) that Option A leaves untouched, for a currently-broken Core path that affects zero production rows today (per Sprint 5E's finding).

---

## Part 7 — Decision

**APPROVED.**

**Option A — `teachers.id` remains the canonical Teacher-domain business identity** — is the decision, on the following converging, independently-sourced evidence:

1. Historical precedence: `teachers` predates `school_users` by 86 days, and Core was built explicitly additive, never intended to replace it (Part 1).
2. The Reference Architecture Specification — already ratified, prior to this ADR — already names `teachers (evolving)` as the canonical Teacher-domain table, and `school_users` as the Permissions domain's interim role field, a *different* domain (Part 1, decisive evidence).
3. Stage 0.5's independent, evidence-based investigation reached the same conclusion for the same reason (usage-gap evidence: 96-vs-2 files then, ~96-vs-9 files now) applied to Learner and Class identity (Part 1, Part 2).
4. Every subsystem in Part 5's required list that references teacher identity at all — Academic Clinic, Adaptive Learning, Learning Compass, and the Reference School build process — already independently converged on `teachers.id`, with zero contradicting data points.
5. Live pilot data shows this is low-risk for the population that matters most today: 39 of 39 `school_users` rows with `role='teacher'` already have a matching `teachers` row (Part 4).

**This decision does not, by itself, resolve**: what a Core assessment-creation request should do when the caller is a school admin/headteacher/deputy_headteacher with no `teachers` row (9 live users, 0-of-9 currently having one). This is a real, evidenced, unresolved case — not glossed over — but it is a narrower, *implementation*-scoped question (what should `createCoreAssessment` do for this specific role set) that belongs to whichever future sprint designs the fix, not a reason to withhold the canonical-identity decision itself. The identity question ("which table is canonical") and the implementation question ("what do we do for the one role that doesn't have a row in that table") are evidenced separately in this document and should remain separately decided.

---

## Risk Assessment

- **Architecture risk**: Low — ratifies the already-dominant, already-RAS-stated pattern; introduces no new domain or table.
- **Security risk**: None — no RLS or authorization logic changes as a result of this ADR itself.
- **Migration risk**: None from this decision (Option A requires no migration); the separately-flagged admin-edge-case carries its own small, bounded risk (9 known users) for whichever sprint addresses it.
- **Pilot risk**: Low — 39 of 39 real teacher-role users already satisfy the decision without further work; the 9 admin-role users are unaffected by anything performed by *this* document.
- **Divergence risk**: This decision directly reduces future divergence risk by giving every future Assessment-domain (and adjacent) feature a single, evidenced, ratified answer to "which identity is canonical," closing exactly the ambiguity that produced Sprint 5D and 5E's back-and-forth.

---

## Deliverables

1. This document — `docs/architecture/adr/0002-canonical-teacher-identity.md`.
2. Implementation Log entry — added to `docs/engineering/implementation-log.md`.

## Statement

READ ONLY.
No implementation performed.
No files modified (other than this ADR and the implementation log entry).
Sprint 5F intentionally not started.
