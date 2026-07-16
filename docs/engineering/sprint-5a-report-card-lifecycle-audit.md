# Sprint 5A — Report Card Publication Lifecycle Audit

**Type**: Read-only architecture audit. NO CODE MODIFIED.
**Scope**: The Core `school_report_cards` lifecycle (generate → publish → view), and the legacy AI clinic-report pipeline (`student_clinic_reports`) for comparison. Opens a new chapter after the Grading Domain series (Sprints 3D, 4C0, 4C1, 4E-4I, now closed).
**Method**: Every claim below is grounded in the live repository at the time of this audit (2026-07-15), re-verified against current line numbers — not copied from prior audit docs without re-checking.

---

## Part 1 — Lifecycle diagram

### 1.1 Core system (`school_report_cards`)

```
[Teacher enters marks]
        │
        ▼
class_assessments rows created/scored
(lib/core/assessments.ts)
        │
        ▼
Assessment published — is_published=true on class_assessments
(lib/core/assessments.ts::publishAssessment)
        │
        ▼
runEndOfTerm() lock check: ALL assessments for class/term must be
published, else 409 { reason: 'unpublished_assessments' }
(lib/core/endOfTerm.ts:50-58)
        │
        ▼
computeTermSummaries()  → writes term_subject_summaries
(lib/core/assessments.ts, called from endOfTerm.ts:64)
        │
        ▼
generateReportCards()  → upserts school_report_cards, is_published:false
(lib/core/report-cards.ts:8-93; called from endOfTerm.ts:65
 OR directly via POST /api/core/reports default action, app/api/core/reports/route.ts:100-112)
        │
        ├──► [DRAFT STATE: is_published = false]
        │        viewable by any active school staff member
        │        (app/api/core/reports/route.ts GET, requireSchoolMembership only)
        │
        ▼
publishReportCards()  → UPDATE is_published=true, published_at=now()
  WHERE is_published = false  (only flips currently-unpublished rows)
(lib/core/report-cards.ts:104-122; called from endOfTerm.ts:66
 OR directly via POST /api/core/reports action:'publish', requireSchoolAdmin)
        │
        ▼
[PUBLISHED STATE: is_published = true]
        │
        ├──► emits event 'teacher.report_card.published' (lib/events, fire-and-forget)
        │
        ▼
Parent views via GET /api/reports/report-card
  (app/api/reports/report-card/route.ts:46-47 — explicit is_published check, 404 if not)
        │
        ▼
Teacher/admin may later call updateReportCard() to edit
  class_teacher_comment / headteacher_comment / days_present / days_absent
  (lib/core/report-cards.ts:96-102 — grade/level fields NOT in the allowed set)
        │
        ▼
[REGENERATION PATH — no state guard]
A second call to generateReportCards() for the same class_id/term_id
UPSERTs school_report_cards ON CONFLICT (learner_id, term_id),
overwriting overall_score / overall_cbc_level / position_in_class AND
resetting is_published back to false (row-construction always sets
is_published:false, lib/core/report-cards.ts:86) — regardless of whether
the row was already published. See Part 4.1.
  → If reached via runEndOfTerm(), publishReportCards() runs immediately
    after in the same call, so is_published ends up true again — but the
    grade content is still silently overwritten (Part 4.1/4.3).
  → If reached via direct POST /api/core/reports (generate action, no
    accompanying publish call), the row is left in draft state indefinitely,
    even though it was previously published and possibly already viewed/
    downloaded by a parent.
```

There is **no unpublish, archive, lock, or delete transition anywhere in the codebase** for `school_report_cards` — confirmed by `grep -rn "is_published" lib/core/report-cards.ts lib/repositories/school.repository.ts` returning only the generate (set false), publish (set true), and the two read-side filter/select usages already covered above. No `DELETE FROM school_report_cards` or soft-delete column exists.

**No frontend UI currently calls either `/api/core/reports` (generate/publish/update) or `/api/core/school/end-of-term`** — `grep -rn "core/reports\|api/core/school/end-of-term" app --include=*.tsx` (excluding the parent-facing routes) returns no matches. Both are reachable today only via direct authenticated API calls by a school-admin-tier user; there is no in-product button that triggers regeneration. This matters for Part 4's reachability ranking.

### 1.2 Legacy AI clinic-report pipeline (`student_clinic_reports`) — for comparison

```
Teacher selects assessmentIds → POST /api/teacher/classes/[classId]/generate-reports
  (requireClassTeacher; requireAuthentication)
        │
        ▼
Async job inserted (jobs table, status:'processing'), processed via
Next.js `after()` background callback
        │
        ▼
generateClassReports() → per-student → buildClinicReport()
  (lib/career/clinicReportBuilder.ts, lib/career/autoReportGenerator.ts)
        │
        ▼
career.repository.ts upserts student_clinic_reports
  — TWO different upsert methods exist with DIFFERENT onConflict keys:
      line 310: .upsert(row, { onConflict: 'student_id' })
      line 443: .upsert(row, { onConflict: 'student_id,assessment_id' })
  (lib/repositories/career.repository.ts:308-311, 441-444)
        │
        ▼
[NO PUBLICATION CONCEPT] — student_clinic_reports has no is_published,
status, or equivalent column at all (lib/database.types.ts:8187-8228 — full
column list: assessment_id, class_id, created_at, email_sent_at, id,
parent_opened_at, pdf_url, report_data, student_id, teacher_id, term,
whatsapp_sent_at, year — no publication/state field of any kind)
        │
        ▼
pdf_url set via scripts/upload-reports-storage.ts (one-off operator script,
per supabase/migrations/20260710120000_sprint15_corrections.sql:157-171),
or presumably by the report-generation pipeline itself
        │
        ▼
Parent/teacher view via:
  - app/api/reports/clinic/[reportId]/url/route.ts (signed URL, ownership
    checked via a 4-branch bespoke check per implementation-log's Sprint 1B
    Batch B entry — not fully migrated to requireParent)
  - app/dashboard/clinic/reports/[studentId]/page.tsx
  - app/teacher/classes/[classId]/reports (listing, app/api/teacher/classes/[classId]/reports/route.ts)
```

**Where a parent could see either system**: the two systems are keyed to entirely different tables (`school_report_cards` for Core learners, `student_clinic_reports` for legacy `students`) and served by disjoint route trees (`/api/reports/report-card*` vs. `/api/reports/clinic/*`, `/dashboard/clinic/*`). A given real family could plausibly see **both** if their school has both legacy (`students`/`teacher_classes`) and Core (`learners`/`classes`) data — `docs/architecture/deprecation-registry.md` entry #6 documents this as an unresolved, "Not Yet Decided" duplication. This audit found no code that reconciles or cross-references the two; a parent's UI experience depends entirely on which route/page they land on, not on any unified "your child's report card" concept.

---

## Part 2 — State machine

| Candidate state | Real column/constraint? | Evidence |
|---|---|---|
| **Draft** | Real — `is_published boolean NOT NULL DEFAULT false` | `supabase/migrations/20260629_core_foundation.sql:704` |
| **Published** | Real — `is_published = true`, `published_at timestamptz` | Same CREATE TABLE, lines 704-705; set by `publishReportCards` (`lib/repositories/school.repository.ts:331-346`) |
| **Unpublished (reverted)** | Real column value, but no dedicated transition function — only reachable as a **side effect** of a second `generateReportCards` upsert (Part 1.1, Part 4.1), never an intentional "unpublish" action | No `unpublishReportCards` function exists anywhere (`grep -rn "unpublish" lib/core/report-cards.ts lib/repositories/school.repository.ts` → no matches) |
| **Archived** | **Aspirational / does not exist** | No column, no flag, no separate table. An "old" published report card is structurally indistinguishable from a "current" one — both just have `is_published = true`. `terms.is_current` distinguishes terms, not report cards. |
| **Locked / Immutable** | **Aspirational / does not exist as an enforced state** — no CHECK constraint, trigger, or RLS rule prevents writing to a row where `is_published = true`. Immutability is only an emergent property of which *fields* `updateReportCard` happens to allow (`class_teacher_comment`, `headteacher_comment`, `days_present`, `days_absent` — never `overall_score`/`overall_cbc_level`), not of the row's publication state | `lib/core/report-cards.ts:96-102`; no DB trigger found (`grep -rn "school_report_cards" supabase/migrations/*.sql` shows only the one `CREATE TABLE` + index + RLS block + generic `updated_at` trigger, no bespoke immutability trigger) |
| **Deleted** | **Does not exist** | No delete function, no soft-delete column, `ON DELETE CASCADE` only exists on the FKs *from* `school_report_cards` to `schools`/`learners` (i.e. deleting a school or learner cascades, nothing deletes a report card directly) |
| **Duplicate rows for same learner/term** | **Structurally prevented** — `UNIQUE (learner_id, term_id)` | `supabase/migrations/20260629_core_foundation.sql:708`, enforced by `upsertReportCards`'s `onConflict: 'learner_id,term_id'` (`lib/repositories/school.repository.ts:311`) |

**Summary**: only two states are real and enforced at the schema level — `is_published = false` (draft) and `is_published = true` (published) — via one boolean column, no CHECK constraint restricting the transition direction (nothing prevents `true → false`), and no enum. Everything else asked about in the brief (archived, locked, deleted) is aspirational; the code and schema have no concept of them.

---

## Part 3 — Transition audit table

| Transition | Who can trigger | API route | Repository method | Function | DB write |
|---|---|---|---|---|---|
| Generate (create/upsert draft) | School admin/headteacher/deputy-headteacher (`requireSchoolAdmin`) | `POST /api/core/reports` (default action) — `app/api/core/reports/route.ts:100-112`; also `POST /api/core/school/end-of-term` (`requireSchoolAdmin`, `app/api/core/school/end-of-term/route.ts:34-40`) | `SchoolRepository.upsertReportCards` (`lib/repositories/school.repository.ts:297-313`) | `generateReportCards` (`lib/core/report-cards.ts:8-93`), or via `runEndOfTerm` (`lib/core/endOfTerm.ts:65`) | `school_report_cards` UPSERT ON CONFLICT `(learner_id, term_id)` — writes `overall_score, overall_cbc_level, position_in_class, total_learners, is_published:false, generated_at` |
| Publish | School admin/headteacher/deputy-headteacher (`requireSchoolAdmin`) | `POST /api/core/reports` (action:`'publish'`) — `route.ts:69-79`; also via `runEndOfTerm` (`endOfTerm.ts:66`) | `SchoolRepository.publishReportCards` (`school.repository.ts:331-346`) | `publishReportCards` (`report-cards.ts:104-122`) | `school_report_cards` UPDATE `is_published=true, published_at=now()` WHERE `school_id, term_id[, class_id], is_published=false` |
| Unpublish (explicit) | **Nobody — no route/function exists** | — | — | — | — |
| Update comment/attendance | Admin-tier only (`requireSchoolMembership` + `canEditReport`, itself delegating to `canPublishReport`) — `app/api/core/reports/route.ts:89-94`. Note: comment in the route explicitly flags this as a "Stage 0 census gap #2" fix that tightened this from membership-only to admin-gated | `POST /api/core/reports` (action:`'update'`) — `route.ts:81-98` | `SchoolRepository.updateReportCard` (`school.repository.ts:315-329`) | `updateReportCard` (`report-cards.ts:96-102`) | `school_report_cards` UPDATE, restricted to `class_teacher_comment, headteacher_comment, days_present, days_absent` (both the TS `Pick<>` type and the Zod `UpdateSchema` at `route.ts:21-28` enforce this field set) |
| Regenerate (implicit — a second Generate call) | Same as Generate — no distinct guard or route | Same route as Generate | Same as Generate | Same as Generate | Same UPSERT — **overwrites** an existing row including a previously-published one; see Part 4.1 |
| Delete | **Nobody — no route/function exists** | — | — | — | — |
| View by teacher/staff | Any active school member, any role (`requireSchoolMembership`) — **not scoped to "does this teacher teach this class,"** broader than CLAUDE.md's usual per-teacher ownership convention but consistent with the RLS policy's own design (`school_report_cards_staff`, "any active school_users member") | `GET /api/core/reports?learnerId&termId` or `?classId&termId` | `SchoolRepository.findReportCardWithSubjects` / `listClassReportCards` (`school.repository.ts:348-366`, `410-419`) | `getReportCard` / `listClassReportCards` (`report-cards.ts:124-136`) | SELECT, no `is_published` filter — drafts are visible to any staff member |
| View by parent | Registered guardian only (`requireParent`, guardian-link via `learner_guardians`) | `GET /api/reports/report-card?learnerId&termId` | `SchoolRepository.findReportCardWithSubjects` | `getReportCard` | SELECT, **app-layer** `is_published` gate at `app/api/reports/report-card/route.ts:47` (`if (!report || !report.is_published) return apiError(..., 404)`) — see Part 4.6 on why this is the *only* real gate |
| Set PDF URL | Anyone able to call the function — **`updatePdfUrl` is defined but never invoked anywhere in the app** | — (dead code) | `SchoolRepository.updateReportPdfUrl` (`school.repository.ts:421-427`) | `updatePdfUrl` (`report-cards.ts:138-140`) | `grep -rn "updatePdfUrl(" app lib --include=*.ts` (excluding its own definition/repository) returns **no call sites** — this transition is unreachable in the current Core system |

No other routes touch `school_report_cards` — confirmed via `grep -rln "school_report_cards\|upsertReportCards\|publishReportCards" app/ lib/` (excluding stale `.claude/worktrees/` copies): only `app/api/core/reports/route.ts`, `lib/core/report-cards.ts`, `lib/core/endOfTerm.ts`, `lib/repositories/school.repository.ts`, and two test files (`lib/core/toCbcLevel.grading.regression.test.ts`, `lib/core/generateReportCards.ranking.test.ts`). No route exists under `app/api/teacher/classes/[classId]/reports/**` or `generate-reports/**` for the Core system — those paths belong exclusively to the legacy clinic-report pipeline (Part 1.2).

---

## Part 4 — Integrity audit

### 4.1 Can any action overwrite a published report? — **YES, confirmed still live**

`generateReportCards` (`lib/core/report-cards.ts:8-93`) contains no read or check of the existing `is_published` value anywhere in its body — `grep -n "is_published" lib/core/report-cards.ts` returns exactly one hit, line 86, which **sets** `is_published: false` unconditionally on every row it constructs, never reads the prior value first. `upsertReportCards` (`lib/repositories/school.repository.ts:297-313`) performs `.upsert(rows, { onConflict: 'learner_id,term_id' })` against the `UNIQUE (learner_id, term_id)` constraint (`supabase/migrations/20260629_core_foundation.sql:708`), so a second Generate call for the same `class_id`/`term_id` **updates the existing row in place** — overwriting `overall_score`, `overall_cbc_level`, `position_in_class`, `total_learners`, `generated_at`, and resetting `is_published` to `false` and (implicitly, since the upserted row omits it) `published_at` — regardless of whether the row was previously published.

**No guard exists anywhere in the call chain.** Checked every layer:
- Route layer: `app/api/core/reports/route.ts`'s default (Generate) branch, lines 100-112, checks only `requireSchoolAdmin` — no query for existing published state before calling `generateReportCards`.
- Service layer: `generateReportCards` itself, as above.
- Repository layer: `upsertReportCards`, as above — a bare upsert, no `WHERE is_published = false` clause the way `publishReportCards` uses.
- Database layer: no CHECK constraint, no trigger (`grep -rn "school_report_cards" supabase/migrations/*.sql` shows only the plain `CREATE TABLE`/index/RLS/generic-`updated_at`-trigger block — no bespoke BEFORE UPDATE trigger).

This matches and **re-confirms** the Sprint 4C0 finding (`docs/engineering/sprint-4c0-grading-policy-integration.md` Part 5.4) against current code — nothing in Sprints 4C1 through 4I (which did touch this file, adding the Grading Engine integration comment at lines 31-41) added a guard. **Rank: Critical.** Reachability: requires an already-privileged school-admin-tier account, but no unusual privilege escalation — an admin re-clicking "Generate" (or a retried/duplicated automation call) after a report card was already published is a plausible, ordinary operator mistake, not a contrived attack. There is currently no frontend UI wired to this route (Part 1.1), which lowers *accidental* reachability today, but the API is fully live and callable by any admin-tier token holder, including any future UI or automation that gets wired to it without awareness of this gap.

### 4.2 Can anything modify historical grades? — **NO, via the update path**

`updateReportCard`'s type signature restricts `updates` to `Pick<SchoolReportCard, 'class_teacher_comment' | 'headteacher_comment' | 'days_present' | 'days_absent'>` (`lib/core/report-cards.ts:96-99`), and the API layer's `UpdateSchema` Zod schema independently enforces the same four fields (`app/api/core/reports/route.ts:21-28`) — `overall_score`/`overall_cbc_level`/`position_in_class` are not accepted by either layer. **Proven** for this specific path.

However, **the Generate path (4.1) is itself an unguarded way to modify "historical" grades** — it is not a modification via `updateReportCard`, but it has the same effect (changed `overall_score`/`overall_cbc_level` on an existing, previously-final row). The two findings are related but distinct: 4.2 confirms the *comment/attendance* update endpoint cannot touch grades; 4.1 confirms the *generate* endpoint can, silently.

### 4.3 Can publication status be silently reset? — **YES, same root cause as 4.1**

Confirmed above: any second Generate call resets `is_published` to `false` for every learner in that class/term, including already-published rows. **Rank: Critical** (same finding as 4.1, different angle — see Part 6 for why one fix closes both).

One partial mitigation exists **only along the `runEndOfTerm` path**: `endOfTerm.ts:65-66` calls `generateReportCards` immediately followed by `publishReportCards` in the same function invocation, so if End-of-Term is re-run for a class/term that was already published, the cards end up `is_published = true` again by the time the function returns — but the underlying grade values were still silently overwritten first (4.1 still applies), and there is a real (if narrow) window between the two awaited calls where a parent polling `/api/reports/report-card` at that exact moment would receive a 404 for a report card they'd previously been able to view. The **direct** `POST /api/core/reports` Generate action has no such self-healing — a report card generated (only) via that route, after already being published, is left in `is_published:false` indefinitely.

### 4.4 Can report cards be duplicated? — **NO, proven**

`UNIQUE (learner_id, term_id)` (`supabase/migrations/20260629_core_foundation.sql:708`) is a real, enforced database constraint, and `upsertReportCards`'s `onConflict: 'learner_id,term_id'` (`school.repository.ts:311`) matches it exactly, so the upsert always updates the single existing row rather than erroring or inserting a duplicate. **Proven.**

(Contrast: the legacy `student_clinic_reports` table has **two different repository methods using two different `onConflict` keys** — `'student_id'` (`career.repository.ts:310`) vs. `'student_id,assessment_id'` (`career.repository.ts:443`) — this audit found no `UNIQUE` constraint definition for that table in the migrations directory to confirm which, if either, is actually backed by a real DB constraint; flagged as **UNKNOWN — no evidence found** whether the legacy table can produce duplicate/conflicting rows depending on which upsert path is used. This is a legacy-system finding, out of this sprint's primary scope but worth carrying forward.)

### 4.5 Can regeneration happen silently, with no audit trail? — **YES, confirmed**

`generateReportCards` (`lib/core/report-cards.ts:8-93`) contains **zero `publishEvent` calls** — confirmed by reading the entire function body; the only `publishEvent` call in the file is inside `publishReportCards` (lines 114-119), emitting `'teacher.report_card.published'`. There is no equivalent `'teacher.report_card.generated'` or `.regenerated` event, and no way to distinguish, from the event stream or any other audit log, a first-time generation from a second (overwriting) one. This repository has no generic `audit_log` table for `school_report_cards` (the only `*_audit_log` table found, `evidence_audit_log`, belongs to the separate Learner Evidence domain per CLAUDE.md's architecture rules and is unrelated to report cards). **Rank: High** — this doesn't cause corruption by itself, but it means 4.1/4.3's corruption, if it occurs, leaves no trace anywhere to detect or investigate after the fact.

### 4.6 Can unpublished/draft cards be exposed to parents? — **NO for the dedicated parent route; the guard is app-layer, not RLS**

The parent-facing route `GET /api/reports/report-card` explicitly checks `if (!report || !report.is_published) return apiError('Report card not available', 404)` (`app/api/reports/report-card/route.ts:47`) before returning any data. **Proven** for that route.

Important caveat found during this audit: **all repository access goes through `createServiceClient()`** (`lib/repositories/base.ts:8`, `SchoolRepository extends BaseRepository`), which uses the Supabase **service role** and bypasses Row Level Security entirely. This means the `school_report_cards_parent_published` RLS policy (`supabase/migrations/20260629_core_foundation.sql:731-740`, requiring `is_published = true` AND a `learner_guardians` link with `can_receive_reports = true`) provides **zero actual protection** for any traffic that flows through `repos.schools` — which is all of it, per CLAUDE.md's own mandated pattern ("Server-side DB: always use `createServiceClient()`"). The RLS policy is not wrong, but it is **decorative** for this table under the codebase's own architecture rules; the *entire* enforcement burden for "parents only see published reports" rests on the single `if (!report.is_published)` line in the route handler. If that one line were ever removed, refactored away, or bypassed by a new route reusing `getReportCard` without re-adding the check, there is no second layer (RLS or otherwise) that would catch it. **Rank: Medium** — currently correct and the only real gate, but it's a single point of failure with no defense-in-depth, which is worth naming even though nothing is broken today.

The staff-facing route (`GET /api/core/reports`) has no `is_published` filter at all — but this is intentional (staff, including class teachers and admins, are expected to see drafts before publishing), consistent with the `school_report_cards_staff` RLS policy's own design (any active school member, `FOR ALL`). Not a finding, just noted for completeness per Part 3's table.

### 4.7 Can parent-visible history be corrupted? — **YES, as a consequence of 4.1**

If a report card was published, a parent viewed or downloaded it, and then a second Generate call silently overwrote its `overall_score`/`overall_cbc_level` (4.1) — the parent's already-seen values and the current database row now disagree. On the specific question of a cached/stale PDF disagreeing with the live row: **this risk does not currently materialize in practice**, because `updatePdfUrl`/`updateReportPdfUrl` (`report-cards.ts:138-140`, `school.repository.ts:421-427`) is **never called anywhere in the app** (Part 3's last table row) — `pdf_url` is a schema column with no live writer for the Core report-card system, so there is no PDF artifact to go stale. The corruption risk that *does* exist is simpler: a parent who saw "EE" on screen (or via a screenshot, a WhatsApp forward, a verbal report) on one visit could see "ME" on a later visit for the exact same term, with nothing in the product explaining why, and no audit trail (4.5) to reconstruct what happened. **Rank: High** (same underlying cause as 4.1/4.3, this is the user-facing consequence).

---

## Part 5 — Domain invariants

| Invariant | Verdict | Evidence |
|---|---|---|
| Published reports are immutable | **Violated** | Part 4.1/4.3 — a second `generateReportCards` call overwrites `overall_score`/`overall_cbc_level`/`is_published` on an already-published row with no guard at any layer. |
| Parents only see published reports | **Proven** (for the current single enforcement point) | `app/api/reports/report-card/route.ts:47`'s explicit `is_published` check, verified as the sole gate since RLS is bypassed by the service-role client (Part 4.6). "Proven" describes current behavior; Part 4.6 notes it is a single point of failure, not defense-in-depth. |
| Generation cannot corrupt historical records | **Violated** | Same root cause as row 1 — generation and corruption are not separable in the current design; every "generate" is also an unguarded "overwrite-if-exists." |
| Publication is explicit (nothing publishes as a side effect) | **Partially Proven** | The direct `POST /api/core/reports` publish action is explicit and admin-gated (Proven in isolation). But `runEndOfTerm` (`lib/core/endOfTerm.ts:65-66`) calls `generateReportCards` **and then immediately** `publishReportCards` in the same function, with no separate confirmation step between draft creation and publication — an admin invoking "End of Term" publishes report cards as a bundled consequence of a broader workflow, not via a distinct, deliberate "now publish these" action. Whether this counts as a violation depends on whether End-of-Term is considered one atomic business action (arguably yes, by product intent) or two (generate, then publish) that happen to be wired together without a human checkpoint in between (arguably a gap) — this audit found no code or doc confirming which was intended, so it is marked Partially Proven rather than a clean Proven/Violated. |
| Historical reports remain reproducible | **Partially Proven, with a named caveat** | `overall_cbc_level`/`cbc_level` are stored once at generation time, never recomputed on read (re-confirmed: `grep -rn "overall_cbc_level\|cbc_level" lib/ app/` excluding tests shows every read path selects the stored column directly — `school.repository.ts:27` `REPORT_COLS`, `:348-365` `findReportCardWithSubjects`, no `toCbcLevel`/`gradeScore` call in any read path). So a report, once generated, does not silently drift just from `school_settings.grade_boundaries` changing later — reproducibility of the *displayed* value holds. But reproducibility from *first principles* (could you regenerate byte-identical output from the same historical inputs?) does not hold cleanly: `school_settings.grade_boundaries` is a live, mutable, unversioned single value (no effective-dating, per Sprint 4C0 Part 4's Option A/B/C analysis, still unresolved) — if a school changes its boundaries and then any code path re-runs `generateReportCards` for a past term (which nothing currently prevents, per 4.1), the "reproduced" report would use *today's* boundaries, not the boundaries in force when the term was actually open, silently producing a different result than the original. |

---

## Part 6 — Smallest future fixes

Scoped to the smallest change that closes each Critical/High finding — no redesign, no schema overhaul, no code drafted:

1. **Closes 4.1 / 4.3 / 4.7 (Critical/Critical/High)** — a guard clause before `generateReportCards`'s upsert (or inside `upsertReportCards` itself) that refuses to overwrite a row where `is_published = true` for that `learner_id`/`term_id`, unless the caller explicitly opts into "force regenerate" via a separate, distinctly-named, higher-privilege action. This is the single fix Sprint 4C0 already identified as the prerequisite; it remains the smallest thing that would close both the score-overwrite and the publish-reset symptoms, since they share one root cause.
2. **Closes 4.5 (High)** — an event emission (matching the existing `publishEvent` convention already used by `publishReportCards`) inside `generateReportCards`, distinguishing a first-time generation from a regeneration of an existing row (e.g. by checking whether a row already existed for that `learner_id`/`term_id` before the upsert). Independent of fix #1 — even with a guard in place, knowing *that* a regeneration was attempted (and blocked, or allowed under a force flag) is its own value for auditability.
3. **Closes the Part 5 "Publication is explicit" ambiguity** — a product decision (not a code change) on whether `runEndOfTerm`'s combined generate+publish is intended as one atomic action or should require a separate confirmation step; if the latter, splitting the workflow into two admin-facing actions would close the ambiguity.
4. **Reduces (does not eliminate) the Part 4.6 single-point-of-failure** — since RLS is bypassed by the service-role client everywhere in this codebase (an established, deliberate CLAUDE.md pattern, not itself a bug), the only realistic hardening is discipline/tests around the one `is_published` check in the parent route — e.g. a regression test asserting a draft report card 404s for a parent — rather than a schema change.
5. **Not required by any Critical/High finding, but flagged for completeness** — `updatePdfUrl` is dead code for the Core system (Part 3, Part 4.7); no fix is needed unless/until something starts calling it, at which point the staleness question in 4.7 would need to be revisited.

---

## Part 7 — Executive verdict

**Is the current Report Card lifecycle production-safe? No — not for the specific scenario of report-card regeneration after publication.** The generate-and-view lifecycle is otherwise sound: parents cannot see drafts (Part 5, row 2, Proven), grades cannot be edited via the comment/attendance endpoint (Part 4.2, Proven), and duplicate rows are structurally impossible (Part 4.4, Proven). The one open integrity gap is narrow in *trigger surface* (requires an already-privileged school-admin-tier action, and no UI currently wires up the vulnerable endpoint) but unbounded in *blast radius* if triggered (silently rewrites grades and un-publishes for an entire class's report cards with zero audit trail).

**Single highest-risk integrity issue**: `generateReportCards` (`lib/core/report-cards.ts:8-93`, specifically the unconditional `is_published: false` at line 86) combined with `upsertReportCards`'s unconditional `ON CONFLICT (learner_id, term_id)` upsert (`lib/repositories/school.repository.ts:297-313`) — a second Generate call for any already-published class/term silently overwrites stored grades and resets publication status, reachable via `POST /api/core/reports` (`app/api/core/reports/route.ts:100-112`, admin-gated but otherwise unguarded) with no confirmation, no audit event, and no rollback path.

**Smallest future implementation needed**: a capability to detect, at generation time, that a report card row for a given learner/term already exists and is published, and either refuse the overwrite or require a distinct, explicitly-named "force regenerate" action gated separately from ordinary "generate" — paired with an audit event so any regeneration that does occur is discoverable after the fact.
