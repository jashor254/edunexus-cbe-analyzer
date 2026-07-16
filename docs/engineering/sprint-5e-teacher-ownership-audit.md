# Sprint 5E Closure — Teacher Ownership Decision Audit

**Mode**: READ ONLY. No code, test, or schema files were modified. This document is the sprint's only deliverable.

## 1. Executive Summary

`class_assessments` is a single physical table shared by two architecturally distinct callers: the legacy teacher-facing surface (anchored on `teachers.id`) and Core, which was retrofitted onto the same table by additive `ALTER TABLE` (`supabase/migrations/20260629_core_foundation.sql:617-628`) without reconciling its identity anchor. `teacher_id` is `NOT NULL`, FK'd to `teachers(id)` (confirmed live), and is the active row-ownership filter for 9+ legacy repository methods and the table's only RLS policy. It is not "unused" or "pure audit metadata" anywhere in the codebase — but it is **entirely unused by Core's own read/write/analytics paths**, which scope exclusively by `class_id`/`school_id` instead. Core's own newer, native table (`classes`) already solved this exact identity question for a different column — `class_teacher_id uuid REFERENCES school_users(id)` (`20260629_core_foundation.sql:260`) — establishing that Core's architectural intent is `school_users.id` as the identity anchor for Core-native constructs. `class_assessments.teacher_id` is the one column on this shared table that was never reconciled to that pattern. This is a genuine architectural gap, not an implementation oversight — it requires either a schema change (out of this sprint's scope) or a standing bridge/resolution convention (Option A or B below) to close cleanly. No option is cost-free; the evidence below is presented for a decision, not a recommendation to implement.

## 2. Current Execution Flow Diagram

```
HTTP POST /api/core/assessments  (app/api/core/assessments/route.ts:93-138)
  │
  ├─ requireAuthentication(supabase)                          → CurrentUser { id: auth.users.id }      [route.ts:130]
  │
  ├─ requireCanManageAssessment(supabase, schoolId, class_id)  [route.ts:54-57, 131]
  │     │
  │     ├─ requireSchoolMembership → resolveMembership → getSchoolUser(userId, schoolId)
  │     │     → school_users row { id, school_id, user_id, role }                         [identity.ts:160-163]
  │     │
  │     └─ canManageAssessment(client, schoolId, classId)                                  [permissions.ts:140-149]
  │           ├─ IF admin-tier role (school_admin/headteacher/deputy_headteacher):
  │           │     return true — resolveTeacher() is NEVER called on this branch.
  │           │
  │           └─ ELSE (must prove class-teacher ownership):
  │                 requireClassTeacher(client, classId)                                   [permissions.ts:96-111]
  │                   ├─ resolveTeacher(user.id) → teachers row { id, user_id, ... }        [identity.ts:113-122]
  │                   │     (throws ResourceOwnershipError if none — request never reaches
  │                   │      createAssessment at all in that case)
  │                   └─ checks teacher_classes.teacher_id = teacher.id for this classId
  │                 — the resolved `teacher.id` is discarded here; only a boolean survives.
  │
  ├─ getSchoolUser(userId, schoolId) — called a SECOND time, independently   [route.ts:136]
  │     → school_users row { id, ... }
  │
  └─ createAssessment({ ...input, teacher_id: schoolUser.id })               [route.ts:137]
        │
        └─ lib/core/assessments.ts:66-82 createAssessment
              └─ repos.assessments.createCoreAssessment(input)               [assessments.ts:80]
                    └─ INSERT INTO class_assessments (..., teacher_id, ...)  [assessment.repository.ts:1006-1033]
                          teacher_id = schoolUser.id  (a school_users.id)
                          FK target: teachers(id)      ← MISMATCH, insert fails for any
                                                          real school_users.id/teachers.id pair
```

## 3. Teacher Ownership Trace

**Where teacher identity first becomes available**: `requireAuthentication` resolves `auth.users.id` at `route.ts:130` — this is a bare auth identity, not yet a teacher.

**Transformation chain, with exact evidence**:

| Step | Identity produced | File:Line | Evidence |
|---|---|---|---|
| 1 | `auth.users.id` (`userId`) | `route.ts:130` | `userId = (await requireAuthentication(supabase)).id` |
| 2a | `school_users` row (via `resolveMembership`) | `identity.ts:160-163` | `resolveMembership` calls `getSchoolUser(userId, schoolId)`; used only for role-checking, discarded after |
| 2b | `teachers` row, **only if caller is not admin-tier** | `permissions.ts:98`, inside `requireClassTeacher`, called from `canManageAssessment:144` | `const teacher = await resolveTeacher(user.id)` — throws if null; **result discarded, only survives as a boolean up through `canManageAssessment`** |
| 3 | `school_users` row, resolved again | `route.ts:136` | `const schoolUser = await getSchoolUser(userId, schoolId)` — a second, independent call to the same lookup as step 2a |
| 4 | write | `route.ts:137` → `assessments.ts:80` → `assessment.repository.ts:1021-1030` | `teacher_id: schoolUser.id` inserted directly; FK target is `teachers(id)`, not `school_users(id)` |

**Key fact, evidenced**: for a caller who is the class's own teacher (not an admin), a valid `teachers.id` **is** computed during this exact request (step 2b) — and thrown away. For a caller who is a school admin/headteacher/deputy_headteacher, `resolveTeacher` is **never invoked at all** in this request (`permissions.ts:141-142` returns `true` before reaching the `requireClassTeacher` call), and there is no guarantee such a user has a `teachers` row (admins are not necessarily teachers).

**Is `createCoreAssessment()` a pure business service, identity-aware service, or persistence helper?** Evidenced answer: it is a **pure persistence helper** — `lib/repositories/assessment.repository.ts:1006-1033` performs no identity resolution, no lookup beyond the literal `.insert()`; it trusts every field of `input` verbatim. `lib/core/assessments.ts:66-82`'s `createAssessment` (the domain-service layer directly above it) is also currently a **pure passthrough** — it performs no identity resolution either (confirmed: zero calls to `resolveTeacher`/`getSchoolUser`/`identity.ts` anywhere in `lib/core/assessments.ts` as it stands today). Neither layer is identity-aware today. This was not always true — a prior, since-reverted implementation made `lib/core/assessments.ts::createAssessment` identity-aware by calling `resolveTeacher` internally; it was reverted in the previous sprint specifically because "the decision of who resolves identity" was judged to be an architectural question, not an implementation detail to settle unilaterally (docs/engineering/implementation-log.md, "Sprint 5E Correction" entry).

**Is `teacher_id` a required business invariant, audit metadata, legacy compatibility, or unused?** Evidenced answer: **it depends on which surface is asked, and the two surfaces disagree** — see §4.

## 4. Downstream Dependency Analysis

Every reader of `class_assessments.teacher_id`, found by exhaustive repository-wide search (`grep -rn "teacher_id"` across `lib/`, `app/`, plus a live `pg_policy` query for RLS):

| Consumer | File:Line | Classification | Evidence |
|---|---|---|---|
| `findAssessmentById` | `assessment.repository.ts:150-161` | **Required** (legacy surface) | `.eq('teacher_id', teacherId)` — the sole ownership filter; without a correct `teacher_id`, a teacher cannot fetch their own assessment |
| `findAssessmentsByTeacher` | `assessment.repository.ts:164-179` | **Required** | `.eq('teacher_id', teacherId)` — the entire "my assessments" list is scoped by this column |
| `findAssessmentsByClass` | `assessment.repository.ts:181-193` | **Required** | `.eq('teacher_id', teacherId)` in addition to `class_id` |
| `findAssessmentContext` | `assessment.repository.ts:195-243` | **Required** (for the fetch filter); **passthrough/unused** (as a returned field, line 240) | Filter at line 207; the returned `teacher_id: raw.teacher_id` (line 240) is never read by any caller for a decision — confirmed by tracing `AssessmentContext` consumers |
| `updateAssessment` | `assessment.repository.ts:126-149` | **Required** | `.eq('teacher_id', teacherId)` gates which row a PATCH can touch |
| `findAssessmentsByClassSummary`-style method, `assessment.repository.ts:416-419` | **Required** | `.eq('teacher_id', teacherId)` |
| Max-score / search lookups, `assessment.repository.ts:1259-1262, 1294-1297` | **Required** | Both `.eq('teacher_id', teacherId)` |
| `recordAssessmentEvidence` | `lib/assessments/evidence.ts:53-60` | **Required** (as a filter, passed in) | `findAssessmentById(assessmentId, teacherId)`/`findMarksByAssessment(assessmentId, teacherId)` — `teacherId` here is a parameter supplied by the caller (already resolved via `resolveTeacher` at the route, e.g. `app/api/teacher/assessments/[assessmentId]/marks/route.ts`), used purely as an ownership filter |
| RLS policy `"Teachers manage own assessments"` on `class_assessments` | live `pg_policy`, `polqual`: `teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())` | **Required by design, but currently unenforced in practice** | This is the table's *only* RLS policy. Every code path that touches this table goes through `BaseRepository`'s service-role client (`lib/repositories/base.ts:4-9`), which bypasses RLS entirely — confirmed no client component anywhere queries `class_assessments` directly (`grep` across `app/**/*.tsx`, `components/**/*.tsx` returns zero matches). The policy therefore encodes the table's *design intent* (teacher-owned) without being a live enforcement mechanism today. |
| `CORE_ASSESSMENT_COLS`-based methods: `listAssessmentsByClass`, `createCoreAssessment`, `publishAssessmentById`, term-summary/score methods (`assessment.repository.ts:987-1300`, the "Core assessments" section) | **Unused** | None of these methods filter by `teacher_id` — all scope by `class_id`/`is_published`/`school_id` (via the calling service) exclusively. `teacher_id` is included in `CORE_ASSESSMENT_COLS` (line 987-988) and returned in API responses, but no frontend page currently consumes `/api/core/assessments` at all (`grep` for the route path across `app/**/*.tsx` returns zero matches) |
| `lib/ranking/*`, `lib/grading/*` | **Unused** | Zero references to `teacher_id` in either directory |
| `lib/projection/*`, `lib/career/*`, `lib/learnerRecord/*`, `lib/intelligence/*` (production code) | **Unused** | Zero references in production files; only appear in integration-test fixtures, not consumed |
| `lib/core/endOfTerm.ts`, `lib/core/report-cards.ts`, `lib/assessments/pdfRenderer.ts`, `lib/assessments/analytics.ts`, `lib/assessments/reportCardEvidence.ts` | **Unused** | Zero references to `teacher_id` (confirmed by grep; `endOfTerm.ts:8` only mentions it in a comment contrasting legacy vs. Core schemas) |

**Summary classification**: `teacher_id` is a **required business invariant for the legacy teacher-facing surface** (active row-ownership filter, 9 call sites, the table's designed RLS boundary) and simultaneously **unused, write-only legacy-compatibility baggage for the Core surface** (never filtered on, never read back for a decision, no UI consumer exists for the field in Core's own API response). Both are true at once, of the same column, because it is one physical table serving two architectures.

## 5. Option A Evaluation — Route Resolves Teacher Once

*Route → `resolveTeacher()` → `createCoreAssessment()`*

- **Advantages**: identity resolution stays at the HTTP/orchestration layer, matching every other Batch A-D migrated teacher route's existing convention (`app/api/teacher/assessments/[assessmentId]/route.ts:27,64` already does exactly this: `resolveTeacher(userId)` in the route, passed down). `createCoreAssessment()`/`lib/core/assessments.ts` stay pure persistence/business functions with no identity awareness, consistent with their current, evidenced shape (§3). The route already computes a `teacher.id` for admin-tier-bypassed, teacher-authored requests inside `requireClassTeacher` (§3, step 2b) — Option A would mean stopping that value from being thrown away, not inventing a new lookup for that specific case.
- **Disadvantages**: for a school-admin-authored request (§3, step 2b's "never called" branch), there is still no guaranteed `teachers.id` — an admin may have no `teachers` row at all. Option A does not, by itself, answer what happens then (NULL is impossible — column is `NOT NULL`; the request would have to either be rejected or a resolution decision made for admins specifically, which is a second sub-decision this option doesn't resolve).
- **Architectural consistency**: high — matches the existing, already-ratified pattern used by every other migrated teacher-facing route (Batch A-D, `docs/engineering/implementation-log.md`).
- **Constitution/RAS compliance**: consistent with `lib/core/identity.ts`'s own stated design ("this module is meant to be the only place [identity resolution] happens going forward," `identity.ts:7`) and RAS §3's Identity/Permissions domain split — identity resolution belongs in `identity.ts`/route composition, not buried in a repository.
- **CLAUDE.md compliance**: consistent with "API routes are thin — call `lib/` functions only, no inline business logic" *only if* the route calls `resolveTeacher` (a `lib/core/identity.ts` function) rather than embedding new logic — which is exactly what this option is.
- **Future maintenance cost**: Low — one call site, no new abstractions.
- **Migration cost**: None (no schema change; a resolved id is just passed through an existing parameter).
- **Backward compatibility**: Full for teacher-authored requests. **Unresolved** for admin-authored requests (see Disadvantages) — this is the open sub-question, not fabricated evidence of a clean answer.
- **Hidden risks**: silently changes `class_assessments.teacher_id`'s semantics from "whoever created this row" toward "the class's actual teacher" for admin-created rows if a fallback (e.g., "resolve the class's own teacher via `teacher_classes`, not the creating admin") is chosen without deliberate discussion — CLAUDE.md's own rule that `teacher_id`/actor-id columns mean "who entered this," never "who owns this," cuts against inventing a non-obvious substitute identity here.

## 6. Option B Evaluation — `createCoreAssessment()` Resolves Teacher Internally

- **Advantages**: guarantees correctness regardless of caller — no route can forget the resolution step, since it can't reach the repository without it succeeding or throwing.
- **Disadvantages**: turns a **persistence helper** (evidenced in §3: zero identity logic today) into an **identity-aware repository method** — this is the exact shape the previous implementation took, and the exact shape that was reverted last sprint for expanding scope beyond a pure integrity fix. Repository methods elsewhere in this codebase (`findAssessmentById`, `updateAssessment`, etc., §4) accept an already-resolved `teacherId` as a parameter; none of them resolve identity internally — Option B would make `createCoreAssessment` architecturally inconsistent with every sibling method in the same repository class.
- **Architectural consistency**: Low — no other method in `AssessmentRepository` does its own identity resolution; this would be the only one.
- **Constitution/RAS compliance**: tension with CLAUDE.md's "ALL database calls go through `lib/` functions only" read together with "Components are UI only — zero business logic" pattern of layering identity/authorization above data access, not inside it; also tension with the same repeated design principle in `lib/core/permissions.ts`'s own header comment (`permissions.ts:1-22`): identity and authorization are deliberately kept out of the functions that just answer "is this true"/"write this row."
- **CLAUDE.md compliance**: weaker than Option A on "repository methods should be thin" grounds, though CLAUDE.md does not explicitly forbid this.
- **Future maintenance cost**: Higher — every other repository method that might need the same identity-resolution-on-write pattern in future would face an inconsistent precedent (some methods resolve identity, most don't).
- **Migration cost**: None (no schema change).
- **Backward compatibility**: Same unresolved admin-authored-request question as Option A.
- **Hidden risks**: couples `lib/repositories/assessment.repository.ts` to `lib/core/identity.ts`, a dependency direction not present anywhere else in this repository class — a repository importing an identity-resolution module is a new architectural edge, not merely a new function call.

## 7. Option C Evaluation — Core-Created Assessments Legitimately Exist Without Teacher Ownership

- **Advantages**: would resolve the identity-mismatch question by declaring it out of scope — no resolution logic needed anywhere.
- **Disadvantages**: **not implementable today without a schema change.** `class_assessments.teacher_id` is `NOT NULL` with a `REFERENCES teachers(id)` FK (confirmed live, §1). A row cannot be inserted without *some* non-null value satisfying that FK — "no teacher ownership" is not a state the current schema can represent. This directly conflicts with this sprint's own absolute rule ("no schema changes"), which makes Option C self-contradictory as stated for this sprint.
- **Architectural consistency**: contradicts Core's own established pattern for exactly this kind of relationship — `classes.class_teacher_id` (`20260629_core_foundation.sql:260`) is nullable (`REFERENCES school_users(id)`, no `NOT NULL`), meaning Core's native design already allows "no teacher assigned yet" for classes. If Option C were the intended direction, `class_assessments.teacher_id` would need to become nullable to match — a schema change, explicitly out of scope.
- **Constitution/RAS compliance**: **UNKNOWN** — no architecture document reviewed (`academic-evidence-layer.md`, `learner-record-layer-decisions.md`, `reference-architecture-specification.md`) states a position on whether an assessment can exist without a teacher of record; this is a genuine gap in the ratified documentation, not something to infer.
- **CLAUDE.md compliance**: N/A — CLAUDE.md's "every table must have..." rules don't address optional ownership; no rule directly supports or forbids this.
- **Future maintenance cost**: **UNKNOWN** without knowing how many other systems assume `teacher_id` is present and non-null (§4 shows at least 9 call sites do, all on the legacy surface) — making it nullable would require auditing and hardening all 9 for a null case, a nontrivial follow-on cost not measured here.
- **Migration cost**: A real migration is required (`ALTER COLUMN teacher_id DROP NOT NULL`, and likely dropping/altering the FK or the RLS policy) — this alone disqualifies Option C from being executable inside this sprint's rules.
- **Backward compatibility**: Would be full for existing rows (all currently non-null); would require every one of the 9 required-consumer call sites in §4 to add null-handling, which they do not have today.
- **Hidden risks**: the RLS policy (§4) has no `WITH CHECK` override for a null `teacher_id` scenario — a null-`teacher_id` row would be **invisible to every teacher** under that policy (nothing satisfies `teacher_id = (their teachers.id)`), and no compensating "school-admin can see unowned assessments" policy exists. Silently adopting Option C without addressing this would create assessments no teacher-facing UI could ever surface, even though the RLS gate is not currently enforced (§4) — a landmine for the day someone does route a client-side query through it.

## 8. Recommendation

**None offered.** Per the sprint's explicit instruction ("Recommendation only if directly supported by evidence"), the evidence in §5-§7 supports ruling in Options A and B as schema-compatible and immediately implementable, and ruling out Option C as not executable without a migration — but does not, by itself, decide between A and B, nor answer the open admin-authored-request sub-question common to both. Those are judgment calls this document deliberately leaves to you.

## 9. Risk Assessment

- **Architecture risk**: Low for A/B (no schema change, no new domain); Option C carries structural risk since it's not actually executable without one.
- **Business risk**: Core assessment creation via the API route remains completely non-functional (confirmed: every real attempt fails on the `teacher_id` FK, per the previous sprint's finding) until one of A/B is chosen and implemented — this document does not change that state, it only clarifies the decision needed to fix it.
- **Migration risk**: None for A/B; Option C requires one, explicitly out of this sprint's rules.
- **Security risk**: None identified from this audit alone — the RLS policy gap (§4, §7) is a pre-existing, currently-unenforced condition, not introduced or worsened by anything in this document.
- **Performance risk**: Negligible for A/B — one additional indexed single-row lookup (`resolveTeacher`), already paid elsewhere in the same request in the non-admin case (§3).

## 10. Statement

READ ONLY.
No implementation performed.
No files modified.
Sprint 5F intentionally not started.
