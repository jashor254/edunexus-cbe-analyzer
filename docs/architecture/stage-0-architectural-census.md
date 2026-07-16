# Phase A — Stage 0: Architectural Census

**Status: READ-ONLY. Complete.** No code modified, no schema changed, no migration written or applied. Every fact below is sourced from a live query against the production Supabase database (`mcp__supabase__list_tables`, `mcp__supabase__get_advisors`, `mcp__supabase__execute_sql`, all read-only) or a direct grep/read of the current codebase — never inferred, never estimated. Where evidence was insufficient to state something as fact, it is marked `UNVERIFIED` rather than guessed.

**Top-line result: this census overturns a load-bearing assumption in the previously-approved Phase A execution plan.** The plan designated `lib/core/assessments.ts`/`lib/core/report-cards.ts` (the "Core" pipeline) as canonical on architectural grounds. Production data proves that pipeline has **never successfully produced a report card** — `school_report_cards` and `term_subject_summaries` both have **zero rows** — and the code contains a specific, identifiable reason why: it writes `students.id` values into a column foreign-keyed to a *different, unrelated* `learners` table. This is detailed in §1 and is the single most important finding in this document. Recommended stage reordering is in the Final Deliverable.

---

## 1. Domain Ownership Census

| Domain | Canonical (per registry intent) | Duplicate(s) | Owner (schema fact) | Current Status | Risk | Migration Complexity |
|---|---|---|---|---|---|---|
| **Learner / Student** | Registry marked `students` canonical, `learners` unmentioned | `students` (499 rows, legacy) **and** `learners` (405 rows, Core) — two entirely separate tables, **no foreign key or join column links them** (verified: `learners`' full column list has no `student_id`/`external_id`/legacy-reference column) | `students.school_id`: does not exist (no such column). `learners.school_id`: exists, NOT NULL. | **UNKNOWN duplication not previously identified in any prior audit or the current registry.** | **Critical** | **High** — no deterministic mapping exists between the 499 `students` rows and 405 `learners` rows; a migration must either match by name/admission-number heuristically (lossy, error-prone) or treat them as genuinely disjoint populations (implying real families have two disconnected records) |
| **Class** | `classes` (Core) | `teacher_classes` (legacy, 13 rows) vs `classes` (Core, 10 rows) — as previously found | `classes.school_id` exists. `teacher_classes` has no `school_id` at all. | Confirmed as previously audited | High | High (Stage 5, already deferred) |
| **Class Roster** | `class_students` (Core FK space) | Two tables named `class_students`: legacy FK space `class_id → teacher_classes.id` (485 rows total in the single physical table — see note below) vs. Core's `learner_enrollments` (405 rows) which is the *actual* Core roster table, not a second `class_students` — **correction to the previous audit**: Core does not use a second `class_students` table, it uses `learner_enrollments`, a differently-named table. There is only one physical `class_students` table, and it belongs entirely to the legacy/`teacher_classes` FK space. | `class_students.class_id → teacher_classes.id` only (single FK target, verified) | The "duplicate `class_students`" framing in the prior audit and Deprecation Registry entry #3 is **partially inaccurate** — see correction note below. | Medium (was previously scoped High under a mistaken premise) | Lower than previously estimated, since there is no second `class_students` table to reconcile — only `class_students` (legacy) vs. `learner_enrollments` (Core), which are differently named and were never at risk of the "same name, different FK target" landmine as described |
| **Assessment / Marks** | `class_assessments`+`learner_marks` (Core, per plan) | `lib/assessments/mutations.ts::createAssessment` vs. `lib/core/assessments.ts::createAssessment`, both targeting the **same physical tables** `class_assessments`/`learner_marks` | `class_assessments.class_id → teacher_classes.id` (not `classes.id`). `learner_marks.student_id → students.id` (not `learners.id`). **Both marks-bearing tables are wired to the legacy Learner/Class tables at the FK level, not to Core's `learners`/`classes`.** | Confirmed duplication of *service* logic (as before); **correction**: the *tables* were never actually shared with Core's `learners`/`classes` domain the way the registry implies — they share a name-space with "Core" services but their FK reality is 100% legacy | Critical (revised up from the prior audit's classification, because of the FK-target discovery) | High — consolidating "onto Core" as planned would require re-pointing `class_assessments.class_id` and `learner_marks.student_id` FKs to `classes`/`students`... except neither of those columns can reference `learners` without first solving the Learner duplication above |
| **Ranking** | Not yet built (`lib/ranking/rankingEngine.ts`, Stage 2 pending) | `buildPositionMap`, `report-cards.ts` inline sort, `updateClassPositions`, `cohortQueries.ts` combination — confirmed still present, unchanged since the prior audit | N/A | Confirmed, unchanged | Medium (real-world blast radius smaller than assumed — see §6) | Low (Stage 2, self-contained) |
| **Report Card** | `school_report_cards` (Core) | Legacy AI auto-report pipeline (`lib/career/autoReportGenerator.ts` etc., operating on `assessments`, 89 rows) vs. Core's `generateReportCards` (operating on `term_subject_summaries`/`school_report_cards`, **0 rows each**) | `school_report_cards.school_id`/`.learner_id → learners.id`/`.class_id → classes.id` — fully Core-shaped ownership | **The "Core" side of this duplication has never executed successfully in production.** The legacy AI pipeline is the only one that has ever produced a report artifact (against `assessments`' 89 rows). | Critical | High — see §1's headline finding |
| **School Ownership** | `schools` (1 row) | None — single canonical table, not duplicated | N/A (root of ownership) | Valid, canonical | Low | N/A |

**Correction note on Class Roster**: the previous audit and Deprecation Registry entry #3 described "two `class_students` tables sharing a name, different FK targets." Direct schema inspection this pass shows there is exactly **one** physical `class_students` table, and its only FK target is `teacher_classes.id`. Core's roster equivalent is a differently-named table, `learner_enrollments` (`class_id → classes.id`, `learner_id → learners.id`). The underlying problem (two disconnected roster systems) is real and unchanged in severity, but the specific "same table name, different target" landmine described previously does not exist as stated — flagged here as a correction, not swept under the rug, per the requirement to never silently update a finding.

---

## 2. Database Census

Full column/FK/RLS inventory pulled via `mcp__supabase__list_tables(verbose=true)` against the live project (188 total public tables; below is every table touched by the examination/school-management domain).

| Table | Rows | Purpose | Owner column | Missing FK / ownership gap | Index/FK note |
|---|---:|---|---|---|---|
| `schools` | 1 | Root tenant | — (is the root) | None | — |
| `academic_years` | 1 | Core year | `school_id` NOT NULL | None | FK indexed (not flagged by advisor) |
| `terms` | 3 | Core term (**previously unconfirmed table — now confirmed to exist**, resolving the "NOT YET DECIDED" item in the Canonical Domain Registry) | `school_id` NOT NULL | None | `academic_year_id`, `school_id` FKs present |
| `teachers` | 45 | Legacy teacher profile | none — `school` is free text, confirmed still true | **No `school_id` FK column exists at all** (not just unpopulated — the column doesn't exist in the schema) | `user_id → auth.users.id` |
| `school_users` | 48 | Core school membership | `school_id` NOT NULL | None | Both `user_id`/`school_id` FKs present |
| `students` | 499 | Legacy learner | `teacher_id` nullable (20 rows null), no `school_id` column | **No `school_id` column exists** | `teacher_id → teachers.id` |
| `learners` | 405 | Core learner | `school_id` NOT NULL | None (well-formed) | — |
| `learner_enrollments` | 405 | Core roster | `school_id` NOT NULL | None | `learner_id`,`class_id`,`term_id`,`academic_year_id` all FK'd |
| `classes` | 10 | Core class | `school_id` nullable (column allows null, though populated in all 10 current rows — not verified as enforced NOT NULL at schema level) | `school_id` is nullable, not NOT NULL — a schema-level gap even though currently populated | `academic_year_id`,`class_teacher_id → school_users.id`,`stream_id`,`grade_id` all FK'd |
| `teacher_classes` | 13 | Legacy class | none — no `school_id` column | **No `school_id` column exists** | `teacher_id → teachers.id` |
| `streams` | 3 | Core stream | `school_id` NOT NULL | None | — |
| `class_subjects` | 144 | Core subject-teacher assignment | `school_id` NOT NULL | None | `class_id → classes.id`, `teacher_id → school_users.id`, `subject_id → subjects.id` |
| `class_teachers` | 1 | A **third**, apparently unused, class-teacher assignment table — not referenced in either the prior audit or the current plan | none visible | `teacher_id → auth.users.id` (a third distinct identity space for "teacher," alongside `teachers.id` and `school_users.id`) | 1 row total — likely vestigial/experimental, flagged as `UNVERIFIED` usage, needs a code-reference check before any classification |
| `class_students` | 485 | Legacy roster | via `class_id → teacher_classes.id` | Owned only transitively through `teacher_classes`, which itself has no school | `student_id → students.id`, `parent_id → auth.users.id` |
| `assessments` | 89 | Legacy per-student assessment (feeds AI auto-report) | `student_id → students.id`, no school concept | No `school_id`, no `class_id` at all | `student_id`,`user_id` FK'd |
| `class_assessments` | 11 | Marks-entry assessment definition | `teacher_id → teachers.id` | **No `school_id`, `academic_year_id`, `term_id` columns exist yet** (Stage 3 of the plan proposes adding these — confirmed still not present) | `class_id → teacher_classes.id` (not `classes.id`) |
| `learner_marks` | 476 | Per-student marks | `teacher_id → teachers.id` | Same gap as `class_assessments` | `class_id → teacher_classes.id`, `student_id → students.id` |
| `assessment_types` | 270 | Assessment category (exam/CAT/etc.) | Hybrid: `school_id` nullable + `teacher_id` nullable | **0 of 270 rows have `school_id` set; all 270 are teacher-scoped** — the school-scoped half of this table's design is entirely unused in production | Both FKs present when populated |
| `term_subject_summaries` | **0** | Core term aggregation | `school_id`,`learner_id → learners.id`,`class_id → classes.id`,`term_id → terms.id`, all NOT NULL | Table is well-formed; the gap is that nothing has ever successfully written to it (§1) | — |
| `school_report_cards` | **0** | Core report card | Same shape as above, `learner_id → learners.id` | Same — well-formed, never populated | — |
| `learner_promotions` | 0 | Core promotion | `learner_id → learners.id`, `from_class_id`/`to_class_id → classes.id` | Well-formed, unused | — |
| `student_promotions` | 0 | Legacy promotion | `student_id → students.id`, `from_class_id`/`to_class_id → teacher_classes.id` | Well-formed, unused | `promoted_by → auth.users.id` (missing covering index — flagged by the performance advisor) |
| `learner_evidence` | 407 | Evidence Domain (untouched by Phase A, confirmed) | `learner_id → students.id` (confirms Evidence Domain uses **`students`, the legacy table**, not `learners`) | 4 FK columns (`erased_by`,`retracted_by`,`reviewed_by`,`superseded_by`) flagged by the performance advisor as missing a covering index | — |

**Orphan/data-quality facts (exact counts, via `execute_sql`):**
- Teachers with zero `school_users` membership: **6 of 45** (39 have exactly one active membership; 0 have more than one — trivial today only because there is exactly 1 school in the whole database).
- Students with `teacher_id IS NULL`: **20 of 499**.
- Students with the legacy free-text `school` field null/empty: **478 of 499**.
- `learner_marks` with `position IS NULL`: **410 of 476** (86%) — the ranking computation is rarely persisted at all, a separate finding from the tie-handling bug.
- `learner_marks` rows affected by an actual tied-position bug: **20 rows across 10 assessments** — real, but a smaller blast radius than the unqualified severity language in the original audit implied; both facts are true simultaneously (the bug is real, and it's rare because ranking is rarely computed in the first place).

---

## 3. Service Census

Reconciled against the file-level inventory already gathered from direct codebase reads this session (`lib/assessments/*`, `lib/core/*`), re-verified against this pass's schema facts:

- **Canonical-per-registry-intent, confirmed to exist and be well-formed as code**: `lib/core/classes.ts`, `lib/core/report-cards.ts`, `lib/ranking/` (does not exist yet — Stage 2 pending).
- **Duplicate**: `lib/assessments/mutations.ts::createAssessment` vs. `lib/core/assessments.ts::createAssessment` — confirmed still both present, both live, both callable.
- **Legacy, functionally load-bearing (holds all real production marks data) despite being architecturally "non-canonical"**: `lib/assessments/mutations.ts`, `lib/assessments/gradeCalculator.ts`, `lib/assessments/analytics.ts` — these operate on the 476 real `learner_marks` rows; `lib/core/assessments.ts`'s `computeTermSummaries`/`lib/core/report-cards.ts`'s `generateReportCards` operate on tables with 0 rows.
- **Unused / never-successfully-executed in production** (new finding, not previously flagged): `lib/core/assessments.ts::computeTermSummaries`, `lib/core/report-cards.ts::generateReportCards` — code exists, is presumably reachable via routes, but has produced zero output rows against real data.
- **Hidden dependency identified**: `lib/core/assessments.ts:82` writes `learner_id: r.student_id` — a direct, silent assumption that a `students.id` value is valid where the schema requires a `learners.id`. `lib/repositories/assessment.repository.ts:1048` contains the same pattern (`student_id: s.learner_id`). This is not a naming inconsistency — it is a live foreign-key mismatch given the schema fact in §1/§2 that `students` and `learners` are disjoint tables.
- **Circular dependencies**: `UNVERIFIED` — not checked in this pass; would require a full import-graph analysis, out of scope for a read-only Stage 0 given the time budget, flagged as an open item rather than asserted clean.
- **`class_teachers` table's owning service**: `UNVERIFIED` — no code reference was located for this table in the greps performed this session; before Phase A's registry can classify it, a dedicated `grep -r "class_teachers"` pass across `lib/`/`app/` is needed. Flagged, not guessed at.

---

## 4. API Census

Reconciled against the previously-audited route list, re-checked against this pass's RLS findings (§7):

| Endpoint | Canonical? | Authorization model (app-level, from prior audit) | Tenant isolation (RLS-level, this pass) | Risk |
|---|---|---|---|---|
| `app/api/core/classes` (`POST`) | Yes, for Core | Role-gated (`school_admin`/`headteacher`/`deputy_headteacher`) | Underlying `classes` table's only RLS `SELECT` policy is `auth.uid() IS NOT NULL` with **no school scoping at all** — see §7 | **Critical**, newly discovered this pass |
| `app/api/core/assessments` (`POST`) | Duplicate-adjacent (calls the Core service, but that service targets tables FK'd to legacy `teacher_classes`) | Membership-only, no role gate (confirmed previously) | `class_assessments` RLS is teacher-owner-scoped, not school-scoped — consistent with its legacy FK reality | High (compounding: both the app-level role gap and the fact that "school ownership" for this table isn't schema-enforceable yet since it has no `school_id` column) |
| `app/api/core/reports` (`POST` update action) | Yes, for Core | Membership-only where siblings are admin-gated (confirmed previously) | `school_report_cards` RLS correctly school-scoped via `school_users` | High (app-level gap only; RLS itself is sound for this table) |
| `app/api/teacher/assessments/**` (~12 routes) | No — legacy | Ownership-scoped correctly (teacher owns via `teachers.user_id`) | `learner_marks`/`class_assessments` RLS correctly teacher-scoped | Low (functionally correct, architecturally the "wrong" long-term home) |
| `app/api/teacher/classes` (`POST`) | No — legacy | Ownership-scoped correctly | `teacher_classes` RLS correctly teacher-scoped (plus an `admin`-role bypass, see §7) | Low-Medium |

---

## 5. Workflow Census

| Workflow | Beginning | End | Source of truth (schema-verified) | Duplicate path | Broken path |
|---|---|---|---|---|---|
| Class creation | Teacher or school-admin action | `teacher_classes` or `classes` row | Two disjoint tables, no bridge (confirmed §1) | Yes | No — both paths individually work |
| Learner enrollment | Student/learner added to a class | `class_students` (legacy) or `learner_enrollments` (Core) | Two disjoint tables (see §1 correction), both fully populated in proportion to their respective class systems | Yes | No |
| Assessment creation | Teacher creates an assessment | `class_assessments` row | One physical table, two service implementations, FK'd to `teacher_classes` regardless of which service is used | Service-level yes, table-level no | No |
| Marks entry | Teacher enters/uploads marks | `learner_marks` rows | One physical table, FK'd to `students`/`teacher_classes` | No | No — this is the one workflow with real, working production data (476 rows) |
| Ranking | Marks saved, position computed | `learner_marks.position` | Populated for only 14% of rows (§2) | Three implementations (confirmed) | Partially — computed rarely, and wrong when tied |
| Report generation | Term summary computed → report card generated | `term_subject_summaries` → `school_report_cards` (Core) **or** `assessments` → AI auto-report (legacy) | **The Core path is broken end-to-end** — confirmed by 0 rows plus the identified `student_id`/`learner_id` FK-mismatch root cause (§1/§3). The legacy AI path is the only one that has ever worked. | Yes | **Yes — confirmed broken, not merely duplicated** |
| Evidence ingestion | Assessment/report card saved | `learner_evidence` rows (407, real data) | `lib/assessments/evidence.ts`/`reportCardEvidence.ts`, keyed to `students.id` | No (Evidence Domain intentionally untouched by Phase A) | No |
| Promotion | End of year/term | `student_promotions` (legacy) or `learner_promotions` (Core) | Both tables exist, **both have 0 rows** — promotion has never been used through either path in production | Yes | Unproven either way (no data either direction, not confirmed broken like report generation, just confirmed unused) |

---

## 6. Data Quality Census

All counts below are exact, from `execute_sql`, not estimated:

- Missing school relationships: `teachers` (no `school_id` column, 45 rows affected), `students` (no `school_id` column, 499 rows affected), `teacher_classes` (no `school_id` column, 13 rows affected), `assessments`/`class_assessments`/`learner_marks` (no `school_id` column yet, 89/11/476 rows affected respectively).
- Null ownership fields: `students.teacher_id` null for 20/499 rows; `assessment_types.school_id` null for 270/270 rows (100%, since the school-scoped half of that table is entirely unused).
- Duplicate identifier risk: `students` and `learners` both use `gen_random_uuid()`/`uuid_generate_v4()` independently — no collision risk between the two ID spaces, but also no way to know if a given `learners` row and a given `students` row describe the same real child.
- Orphaned records: none found at the FK-constraint level (Postgres FK constraints prevent true orphans for every relationship checked) — the "orphan" risk in this system is entity-level (a `students` row with no `learners` counterpart, or vice versa), not referential-integrity-level.
- Historical inconsistencies: `term_subject_summaries`/`school_report_cards`/`learner_promotions`/`student_promotions` all have 0 historical rows — there is no "historical inconsistency" to find in Core's report/promotion history because there is no history yet.

---

## 7. Security Census

Pulled from `mcp__supabase__get_advisors(type="security")` (full 956-lint run, filtered) and direct `pg_policies` inspection — this is the first time in the Phase A series that RLS policies themselves (as opposed to application-level `auth.getUser()` checks) have been examined.

**Critical, newly discovered this pass:**
- **`classes` table RLS `SELECT` policy (`"classes: authenticated read"`) has `qual: auth.uid() IS NOT NULL` — no school-scoping condition at all.** Any authenticated user on the platform — any teacher, parent, or student, regardless of which school they belong to — can read every row of the `classes` table across every school. This is a genuine cross-tenant data exposure at the database's last line of defense, more severe than either of the two application-level gaps found in the original audit, because it bypasses application code entirely (any direct Supabase client call from an authenticated session can read it).
- **`assessment_types` table RLS `SELECT` policy (`"assessment_types_school_scoped_read_only"`) has `qual: school_id IS NOT NULL` — also no school-scoping to the requesting user.** Currently zero real-world exposure (0 rows have `school_id` set), but the policy itself would leak cross-school assessment-type data the moment that column starts being populated, which Stage 3/4 of the plan may cause.

**High, confirmed from prior audit (unchanged):** the two application-level authorization gaps in `app/api/core/assessments` (POST) and `app/api/core/reports` (POST update action).

**Medium, newly surfaced, not concluded (flagged, not guessed):**
- `students` and `teacher_classes` both have an `"Admin full access"` RLS policy gated on `teachers.role = 'admin'`. Live data shows exactly 1 teacher row has `role='admin'` (of 45). A grep for code paths that write `teachers.role` found no user-facing route that lets a caller set their own role to `'admin'` — but this was a single grep pass, not an exhaustive audit of every teacher-profile-update code path, so it is reported as `UNVERIFIED (no self-service escalation path found in this pass)`, not as "confirmed safe."
- `class_teachers.teacher_id → auth.users.id` is a third, distinct identity representation for "teacher" (alongside `teachers.id` and `school_users.id`) — its RLS/usage was not verified in this pass (table usage itself is `UNVERIFIED`, per §3).

**Other advisor findings (lower priority, catalogued for completeness, not previously known):**
- `idempotency_keys` and `job_queues` have RLS enabled with zero policies (effectively deny-all for non-service-role access) — informational, not a gap, but worth knowing since it means only the service-role client can touch them.
- Several `INSERT`-only `WITH CHECK (true)` policies exist on content/marketing tables (`early_access_leads`, `insights_newsletter_subscribers`, `kicd_curriculum_lessons`, `sow_*` tables, `pilot_tracking`, `notification_log`, `parent_profiles`, `capability_history`) — these are outside the examination/school-management domain this census scopes to, listed here only because the advisor run surfaced them; **not evaluated for whether they're intentional** (several look like deliberate public-write patterns, e.g. newsletter signup) — out of scope for this document's recommendation.
- `pg_trgm` extension installed in the `public` schema rather than a dedicated schema — a Postgres best-practice finding, unrelated to tenant isolation.
- Several `SECURITY DEFINER` functions (`auth_is_group_member`, `auth_is_guardian_of`, `auth_is_teacher_of_student`, `auth_owns_student`, `auth_teacher_id`, `is_admin`, `increment_insights_view`) are callable by `authenticated`/`anon` roles — these are likely intentional (they look like the RLS helper functions used *inside* other policies, e.g. `auth_is_teacher_of_student` is exactly the kind of helper a correct `class_assessments`-style policy would use), but this was not verified function-by-function in this pass.

---

## 8. Architectural Duplication Census

| Duplication | Canonical recommendation | Migration difficulty | Risk | Recommended Phase |
|---|---|---|---|---|
| `students` vs `learners` (**new**) | Not yet determinable from evidence alone — needs a human decision on whether these represent genuinely separate populations (e.g. `learners` = only the one Core-onboarded school's roster, `students` = everyone else) or the same children recorded twice | **Very High** — no deterministic join key exists | **Critical** | Must precede Stage 4/5, not addressed by either as currently scripted |
| `teacher_classes` vs `classes` | `classes` | High | High | Stage 5 (as planned) |
| `class_students` vs `learner_enrollments` (corrected framing, see §1) | `learner_enrollments`, contingent on the `students`/`learners` resolution above | High | High | Stage 5, contingent |
| `lib/assessments/mutations.ts::createAssessment` vs `lib/core/assessments.ts::createAssessment` | `lib/core/assessments.ts`, **but this recommendation is now conditional** — the Core function writes to a table (`term_subject_summaries` via `computeTermSummaries`) that cannot accept real data until the Learner duplication is resolved, per §1/§3 | High (revised up) | Critical (revised up) | Stage 4, **should not proceed until the `students`/`learners` question is resolved**, per this census's recommended reordering |
| Ranking implementations | `lib/ranking/rankingEngine.ts` (new) | Low | Medium (smaller real blast radius than assumed, per §2/§6 — still worth fixing, less urgent than believed) | Stage 2 (unaffected by this census's other findings — can proceed as planned) |
| Report pipelines (Core `school_report_cards` vs. legacy AI auto-report) | **Cannot recommend Core as canonical given it has never produced a row in production** — recommend re-opening this decision rather than treating it as settled | Very High | Critical | Needs explicit re-scoping, not assignable to a numbered stage as currently defined |
| `class_assessments`/`learner_marks` FK targets (legacy `teacher_classes`/`students`) vs. the "Core ownership" framing in the registry | Needs the school_id/academic_year_id/term_id columns Stage 3 proposes, **plus** a decision on whether `class_id`/`student_id` get re-pointed to Core tables (impossible before the Learner question resolves) or stay pointed at legacy tables with Core columns bolted alongside | High | Critical | Stage 3 can still proceed for the additive columns; the FK re-pointing implied by "one canonical table" cannot |

---

## 9. Canonical Domain Registry Validation

Comparing `docs/architecture/canonical-domain-registry.md` against this census's live evidence:

| Registry Entry | Validation Result | Note |
|---|---|---|
| School | **VALID** | 1 row, root of ownership, no duplication |
| Academic Year / Term | **PARTIAL → now resolvable** | The registry marked Term `NOT YET DECIDED`; this census confirms a `terms` table exists (3 rows, correctly FK'd to `academic_years`/`schools`) — registry should be updated to `VALID` for Term specifically |
| Class / Stream | **PARTIAL, as registry stated** | Confirmed accurate |
| Class Roster / Learner Membership | **CONFLICTING** | The registry's description of the duplication (two `class_students` tables, same name) does not match schema reality (one `class_students` table, one differently-named `learner_enrollments` table) — registry needs the correction noted in §1 |
| Learner (Student) | **CONFLICTING — most severe validation failure in this census** | The registry treats `students` as canonical with an open question about school-ownership enforcement; it does not mention `learners` at all. The registry is missing an entire entity. This is not a partial gap, it's an omission that this census is surfacing for the first time. |
| Assessment | **CONFLICTING** | The registry describes `class_assessments`/`learner_marks` as the "target" canonical tables under School ownership without noting they are FK'd to `teacher_classes`/`students`, not `classes`/`learners` — the registry's "target" framing implied more convergence with Core than the schema actually has |
| Ranking | **VALID (as a target, not yet built)** | Registry's own status marking (`TARGET (Phase A)`) already correctly reflects that this doesn't exist yet — no correction needed |
| Report Card | **CONFLICTING** | Registry marks the Core pipeline `CANONICAL` for "the Core pipeline itself" — this census shows that pipeline has never produced a row; `CANONICAL` should be downgraded to reflect that structural correctness and production-proven correctness are different claims |
| Learning Intelligence / Evidence Domain | **VALID** | Confirmed untouched, confirmed still keyed to `students` (not `learners`) — consistent with the registry, and itself informative: the Evidence Domain's choice of `students` over `learners` is one more data point suggesting `students` is the more "real" / populated table in current practice |

---

## 10. Deprecation Registry Validation

Comparing `docs/architecture/deprecation-registry.md` against this census:

- **Entry #1** (`createAssessment` duplication): still accurately `IDENTIFIED`, but its Reason/Replacement text should be amended per §8's conditional note — recommend not changing status, but flagging the caveat.
- **Entry #2** (`teacher_classes`): accurate, unchanged.
- **Entry #3** (`class_students` "legacy FK space" vs "Core FK space"): **needs correction** — as detailed in §1, there is no second `class_students` table. The entry should be rewritten to describe `class_students` (legacy, real) vs. `learner_enrollments` (Core, real, differently named) rather than implying two same-named tables.
- **Entry #4** (ranking): accurate, unchanged; the tie-blast-radius number (20 rows / 10 assessments) can now be added as a concrete data point.
- **Entry #5** (duplicated `toCbcLevel` closures): accurate, unchanged, still needs a stage assignment per the open item already flagged in the execution plan.
- **Entry #6** (legacy AI report pipeline vs. Core `school_report_cards`): **the census substantially strengthens this entry's severity** — it should be reclassified from "two competing pipelines, no direction chosen" to "one pipeline is the only one that has ever worked in production; the other is 0-rows and has an identified root-cause bug," which changes the nature of the decision from an architecture-taste question to a correctness question.
- **Missing entry, should be added**: the `students`/`learners` duplication (§1/§8) has no Deprecation Registry entry at all, since it was unknown before this census. It cannot yet specify a "Replacement," per Rule 5 — it needs its own investigation before it can even be written up as `IDENTIFIED` with a real recommendation, but its *existence* should be logged now rather than waiting.

---

## 11. Architectural Health Score

Each score is 0-10, explained with the specific evidence behind it — not a vibe rating.

| Dimension | Score | Explanation |
|---|---:|---|
| Domain consistency | **3/10** | Two fully disjoint Learner tables and two fully disjoint Class tables both in live use simultaneously, with the marks-bearing tables loyal to the legacy pair and the report-generation tables loyal to the Core pair — this is the deepest form of domain inconsistency this census could find. |
| Ownership consistency | **3/10** | Where School ownership exists, it's implemented correctly (`learners`, `classes`, `streams`, `terms`, `school_users` all NOT NULL `school_id`, correctly FK'd). But the tables actually holding real production marks data (`teachers`, `students`, `teacher_classes`, `class_assessments`, `learner_marks`) have **no `school_id` column at all** — not unpopulated, structurally absent. |
| Security | **4/10** | Two newly-discovered RLS-level cross-tenant read gaps (`classes`, `assessment_types`) are more severe than the previously-known application-level gaps, because they bypass application code. The two previously-known app-level gaps remain unfixed. Offsetting this: most of Core's RLS (`learners`, `learner_enrollments`, `school_report_cards`, `term_subject_summaries`, `school_users`, `streams`) is correctly, consistently school-scoped — the security posture is bimodal (mostly solid, with two sharp exceptions), not uniformly weak. |
| Data integrity | **5/10** | Zero orphaned rows at the referential-integrity level (Postgres FK constraints are doing their job everywhere they exist) — but 86% of `learner_marks` never get a computed position, 100% of `assessment_types` use only the teacher-scoped half of a school/teacher hybrid design, and the entire Core report/promotion pipeline has zero historical rows despite the schema being fully built out for it. |
| Duplication | **2/10** | The lowest score in this census. Beyond the previously-known Class/Ranking/Assessment-service duplication, this pass found an entirely new, previously-unaudited Learner-table duplication with no bridging mechanism, which is architecturally more serious than anything found before it. |
| Maintainability | **4/10** | The Core half of the codebase (`lib/core/*`) is clean and well-structured *as code* — the maintainability problem is not code quality, it's that the code operates on a schema whose foreign keys don't point where the code (and the architecture documents) assume they point. This is a subtler, more dangerous maintainability risk than messy code, because it doesn't show up in a code review. |
| Scalability | **5/10** | At current pilot scale (1 school, 45 teachers, 499+405 learners across two tables) none of these gaps have caused a visible production incident — this census exists precisely because the platform is small enough that "0 rows in `school_report_cards`" hasn't yet been noticed as a user-facing failure. Scalability risk is not about load, it's about how much worse every one of these findings gets once a second school onboards through Core and the `students`/`learners` question can no longer be deferred. |
| Technical debt | **3/10** | High volume, and now includes one Critical-severity item (`students`/`learners`) that was completely unknown before this census — technical debt in this codebase is not fully catalogued yet, which is itself a debt-adjacent risk (you cannot pay down what you haven't found). |
| **Overall architecture** | **3.6/10** (unweighted mean of the above) | The number matters less than what it's built from: this is not a codebase suffering from sloppy code (the Core half, read in isolation, is well-written) — it is a codebase where two structurally sound systems were built for the same problem, at different times, without knowledge of each other's schema decisions, and never reconciled. That is a coordination/process failure more than an engineering-skill failure, and the fix is the same either way: resolve the Learner duplication before anything else in Phase A proceeds. |

---

## Final Deliverable

### Executive Summary

The Phase A execution plan, as previously approved, was built on the assumption that `lib/core/assessments.ts`/`lib/core/report-cards.ts` represent a working, school-owned canonical pipeline that merely needs legacy call sites migrated onto it. This census found that assumption is false in one specific, evidenced way: the Core report-generation pipeline has never produced a single row of output in production (`term_subject_summaries` and `school_report_cards` are both empty), and the code contains an identifiable reason why — it assumes `students.id` and `learners.id` are interchangeable, when they are, in fact, primary keys of two entirely separate, unlinked tables. This is a new discovery, not previously surfaced by the original audit or either prior planning pass.

Separately, this census found a real, currently-exploitable cross-tenant data exposure at the RLS layer on the `classes` table (any authenticated user, any school, can read all classes) — more severe than the two previously-known application-level authorization gaps, and not previously known.

Both findings change what "canonical" can mean for Stage 4/5 until they're resolved.

### Critical Findings
1. `students` (499 rows) and `learners` (405 rows) are two disjoint, unlinked tables representing "learner," with no schema-level bridge. **New.**
2. `classes` table RLS `SELECT` policy has no school-scoping — a live cross-tenant data exposure. **New.**
3. Core's report-generation pipeline (`term_subject_summaries`, `school_report_cards`) has zero production rows, with an identified root cause (`learner_id: student_id` FK mismatch) rather than an unexplained gap. **New**, though the duplication itself (two report pipelines) was previously known.
4. The two previously-known application-level authorization gaps (`app/api/core/assessments` POST, `app/api/core/reports` update action) remain unfixed — carried forward, not new.

### Migration Blockers
- Stage 4 (consolidate `createAssessment` onto the Core implementation) is blocked: the Core implementation cannot produce correct output until the Learner duplication is resolved, since its downstream aggregation writes `student_id` values into a `learner_id`-FK'd column.
- Stage 5 (Class Domain consolidation) is blocked on the same dependency for any roster migration that needs to resolve which `class_students`/`learner_enrollments` rows describe the same real students.
- Neither blocker was visible before this census; both are schema-evidenced, not inferred.

### Unexpected Discoveries
- The `students`/`learners` duplication (not previously known to any prior audit in this project's memory).
- The `classes`/`assessment_types` RLS-level tenant-isolation gaps (not previously known; more severe than the previously-known app-level gaps).
- `class_teachers`, a third, apparently-unused teacher-class-assignment table with a third distinct teacher-identity FK space (`auth.users.id`, alongside `teachers.id` and `school_users.id`) — usage `UNVERIFIED`, flagged for follow-up, not classified.
- The previous audit's description of "two `class_students` tables sharing a name" does not match schema reality — corrected in §1, without erasing the original (real, differently-shaped) finding.
- The real-world blast radius of the ranking tie-handling bug is smaller than the unqualified language in the original audit suggested (20 of 476 rows, because 86% of rows never get a position computed at all) — a downward revision, reported honestly rather than left uncorrected.

### Architecture Risks
- Proceeding with Stage 4/5 as originally scripted, without resolving the Learner duplication first, would consolidate the codebase onto a pipeline that structurally cannot write correct data — the census's central risk.
- The `classes` RLS gap is live today, independent of any Phase A stage — it does not need Phase A's sequencing to be exploited, and arguably should be treated with more urgency than Stage 1's two already-known gaps.

### Recommended Stage 1 Adjustments
Stage 1 was scoped to the two known application-level gaps. Recommend expanding Stage 1 to include the two newly-found RLS-level gaps (`classes` SELECT policy, `assessment_types` SELECT policy), since Rule 6 ("Security before architecture") applies equally to a gap found in Stage 0 as to one found in the original audit — there is no principled reason to fix one security gap now and defer a more severe one to a later stage just because of when it was discovered.

### Recommended Stage Reordering
Insert a new stage — **Stage 0.5, "Learner Identity Resolution"** — between the (adjusted) Stage 1 and Stage 2, before Stage 4 is attempted. Its job is singular: determine, with evidence (not inference), whether `students` and `learners` represent the same population recorded twice, disjoint populations, or something in between, and produce a plan for the same Add → Backfill → Verify → Observe → Remove sequence the Seventh Law requires — before Stage 4 designates any Core service "canonical" for real. Stage 2 (Ranking Engine) is unaffected by this finding and can proceed in its originally planned position, since it doesn't depend on which Learner table is canonical.

### Recommended Registry Updates
- Canonical Domain Registry: add a Learner entity split disclosure (currently missing entirely); correct the Term entry to `VALID` now that `terms` is confirmed to exist; correct the Class Roster entry per §1; downgrade the Report Card entry's `CANONICAL` claim to reflect zero production rows.
- Deprecation Registry: correct entry #3's description; strengthen entry #6's severity language; add a new entry for the `students`/`learners` duplication (logged as discovered, `Replacement: TBD pending Stage 0.5`, per Rule 5's requirement not to guess at a destructive-migration answer before it's been audited).

### Unknowns Requiring Human Decisions
1. **Do `students` and `learners` represent the same real children, or genuinely different populations?** This cannot be answered from schema alone — it requires either a data-matching exercise (name/DOB/admission-number heuristics, with a human reviewing ambiguous matches) or direct knowledge of how the one Core-onboarded school's data was seeded relative to the legacy `students` table. This is the single most consequential open question blocking Phase A's remaining stages.
2. Whether the legacy AI auto-report pipeline (the only one that has ever worked) should become the interim canonical report path while Core's is fixed, or whether Core's should be fixed first before either is called canonical — a product/sequencing decision, not an architectural one this census can resolve alone.
3. What `class_teachers` (1 row, third teacher-identity space) actually is — needs a code-reference investigation before it can be classified as live, vestigial, or experimental.
4. Whether `teachers.role = 'admin'`'s RLS bypass pattern has any self-service escalation path — this census found none in one grep pass but did not exhaustively verify every teacher-profile-update route; recommend a dedicated, narrowly-scoped follow-up check before treating it as closed.

**This Architectural Census is complete. No fix, migration, or code change has been made. Awaiting review and approval before Phase A proceeds — per the finding above, recommend that approval include explicit sign-off on inserting Stage 0.5 before Stage 4 is attempted.**
