# Sprint 12C — Academic Clinic Canonical Data Hardening (Phase 1: Audit)

**Status: Phase 1 complete (audit only). No code, migration, repository, service, route, or test was created or modified in producing this document.**

**Precedes**: Sprint 12C Phases 2-7 (canonical input model, canonical reconstruction, route simplification, token integrity, capability consistency documentation, security hardening).
**Supersedes**: nothing.
**Depends on / grounds every finding in**: `reference-architecture-specification.md` §9 (Intelligence Standards — names `lib/academicClinic/` explicitly), §10.7-10.8 (no duplicated business logic, no cross-domain ownership), §11 (Code Review Checklist); `adr-0004-attendance-integration-principles.md` (template for what "canonical consumer" correctness looks like); `academic-evidence-layer.md`, `evidence-domain-model.md` (what canonical Evidence/Projection reconstruction is supposed to look like — the pattern Blueprint already follows and Academic Clinic does not).

---

## 0. Verdict in one paragraph

Academic Clinic is not one pipeline — it is **three independent report-producing systems** (`lib/academicClinic/*`, `lib/career/clinicReportBuilder.ts`+`clinicPdfRenderer.tsx`, and a fourth in-progress migration visible in an uncommitted worktree) sharing one formula library (`lib/pathwayCalculator.ts`) but not sharing canonical state reconstruction. `lib/academicClinic/` itself issues no raw SQL, but its sole score-history source — `repos.assessments.findAssessmentForPipeline`, a direct pass-through onto `assessments.subject_scores` — is exactly the pattern RAS §9 line 145 names `lib/academicClinic/` as forbidden from doing. Three of six entry points have serious trust-boundary defects, one of which (any teacher can trigger a real parent notification for a student they don't teach) is a live authorization gap, not a hypothetical.

---

## 1. Entry points

| # | Path | Method | Trigger |
|---|---|---|---|
| 1 | `app/academic-clinic/page.tsx` | client component | Parent/self-service user opens `/academic-clinic`, generates a report client-side |
| 2 | `app/api/academic-clinic/pdf/route.ts` | POST | "Download" from #1 — client-built report sent back for PDF rendering only |
| 3 | `app/api/clinic/download/route.tsx` | POST | `DownloadReportButton` on `app/dashboard/clinic/reports/[studentId]/page.tsx` |
| 4 | `app/api/parent/assessments/process/route.ts` | POST | Parent adds a self-service assessment for a teacherless student |
| 5 | `app/api/teacher/assessments/process/route.ts` | POST | Teacher runs "process assessment" (single student or whole class) |
| 6 | `app/dashboard/clinic/reports/[studentId]/page.tsx` | RSC | User navigates to a specific student's clinic report page |

No other file in the repo imports from `lib/academicClinic/` — confirmed exhaustive by grep.

---

## 2. Callers, per export

- **`runAssessmentPipeline`** (`lib/academicClinic/assessmentPipeline.ts:71`) ← `app/api/parent/assessments/process/route.ts:69`, `app/api/teacher/assessments/process/route.ts:90`
- **`generateReport`/`calculateVitals`/`generateActionPlan`/`generateJuniorGuidance`/`generateSeniorGuidance`/`formatSubjectName`** (`lib/academicClinic/reportGenerator.ts`) ← `app/academic-clinic/page.tsx:5-12`, `app/api/clinic/download/route.tsx:5-12`, `app/dashboard/clinic/reports/[studentId]/page.tsx:24-37`, and internally by `assessmentPipeline.ts:8-16`
- **`generateAcademicClinicPDF`** (`lib/academicClinic/pdfGenerator.tsx`) ← `app/api/academic-clinic/pdf/route.ts:4,31`, `app/api/clinic/download/route.tsx:13,200`, `assessmentPipeline.ts:18,229`
- **`CareerEngine`** (`lib/academicClinic/careerEngine.ts:2536`) ← `assessmentPipeline.ts:17,147` (seniors only), `reportGenerator.ts:3,395`
- **`calculateJuniorPathwayAffinity`** (`lib/pathwayCalculator.ts:431`) ← `assessmentPipeline.ts:7,121`, `reportGenerator.ts:4,1395`, self at `pathwayCalculator.ts:837`, and — outside academicClinic entirely — `lib/career/clinicReportBuilder.ts:13,742`

---

## 3. Trust boundaries, per route

| Route | Auth check | Ownership check | Verdict |
|---|---|---|---|
| `app/api/academic-clinic/pdf/route.ts` | `auth.getUser()`, 401 if absent (17-23) | **None at all** — no `studentId`, no DB lookup, no comparison to `user.id` anywhere in the route | **Critical.** `ReportSchema` (line 25) is `z.object({ report: z.object({ studentProfile: ... }).passthrough() }).passthrough()` — `.passthrough()` at both levels means every field (scores, career matches, clinical narrative) is accepted verbatim from any authenticated caller and rendered into a signed-looking PDF. |
| `app/api/clinic/download/route.tsx` | `auth.getUser()` (25-30) | `studentId` checked against `user_id` (45-50) — correct | **High.** `assessments`/`profile` (line 33) have no Zod schema and are never cross-checked against the DB. `studentId` ownership proves the caller owns *a* student with that id, not that `assessments` describes that student's real data. |
| `app/api/parent/assessments/process/route.ts` | `requireAuthentication` (44-50) | `isSelfOrParentOf()` via `lib/core/permissions` (61-67) | **Clean.** Body is `{assessment_id, student_id}` only (Zod-typed, 36-39); all score data pulled server-side by id. |
| `app/api/teacher/assessments/process/route.ts` | `requireAuthentication` + `resolveTeacher` (36-45) | `requireClassTeacher()` on the **class** path (70) only | **Critical.** Single-`student_id` path (64-66) has **no ownership check whatsoever** — no `class_students` lookup, nothing. Any teacher can pass any `student_id` and trigger the full pipeline against a student they don't teach. |
| `app/dashboard/clinic/reports/[studentId]/page.tsx` | `auth.getUser()` → redirect (50-51) | `students.user_id` check (56-61) | Clean. |
| `app/academic-clinic/page.tsx` | client-side, relies on RLS | RLS-only, no explicit app-level check | Acceptable given RLS is the intended boundary, but entirely dependent on `assessments`/`students` RLS policy correctness — not independently verified in this audit. |

**Finding severity ranking**: (1) `academic-clinic/pdf` route — no ownership check of any kind; (2) `teacher/assessments/process` single-student path — no ownership check, and it *actively notifies a real parent* on the caller's behalf; (3) `clinic/download` — ownership checked but content not.

---

## 4. Direct database reads

`lib/academicClinic/*` itself issues zero raw `.from(...)` calls (confirmed by grep across all four files). All DB access is one hop away, through repositories:

| Repo function | Table | Layer | Note |
|---|---|---|---|
| `findStudentForPipeline` (`career.repository.ts:394`) | `students` | Operating | benign identity read |
| `findAssessmentForPipeline` (`assessment.repository.ts:1353`) | `assessments`, raw `subject_scores` | **Operating** | **the §9 violation** — feeds `assessmentPipeline.ts:93` directly, never through `recomputeLearnerProjection()` |
| `upsertStudentLearningContext` | `student_learning_context` | Intelligence (write) | fine |
| `upsertStudentClinicReport` | `student_clinic_reports` | Intelligence (write) | fine |
| `findMarketCacheById`/`upsertMarketCacheById` | `career_market_cache` | Intelligence cache | fine |

Route-level direct reads (outside `lib/academicClinic/` but inside the pipeline surface):

- `app/api/clinic/download/route.tsx`: `students` (45-50), `subscriptions` (63-68), `token_balances` (72-94), `token_usage` insert (105-113)
- `app/dashboard/clinic/reports/[studentId]/page.tsx`: `students` (56-61), `assessments` (68-72), **`user_tokens`** (167-171 — see §12.3), `subscriptions` (173-178)
- `app/academic-clinic/page.tsx`: `students`, `assessments` (client-side, RLS-gated)
- `app/api/teacher/assessments/process/route.ts`: `class_students` (75-78), `assessments` inside `triggerLearnerModelUpdate` (136-141)
- `app/api/parent/assessments/process/route.ts`: `students` (61-65)

**§9 verdict**: `lib/academicClinic/`'s business logic (`analyzePerformance`, `calculateJuniorPathwayAffinity`, `CareerEngine.analyze`) is unconditionally driven by a direct Operating-Layer read (`assessments.subject_scores` via `findAssessmentForPipeline`), never by `recomputeLearnerProjection()`. RAS §9 line 145 names `lib/academicClinic/` explicitly as a module that must never do this. This is a confirmed, live violation of an already-ratified rule — not a duplication risk, a spec violation.

---

## 5. Request-body dependencies affecting report content

| Route | Field | Effect |
|---|---|---|
| `academic-clinic/pdf` | `report` (whole object, `.passthrough()`) | Becomes the PDF verbatim — scores, levels, trends, career matches, narrative text, all client-supplied, zero server recomputation |
| `clinic/download` | `assessments` | Drives `subjectProgress`/trend/velocity (135-167) → `calculateVitals`/`generateActionPlan`/guidance → PDF. Never re-fetched from DB. |
| `clinic/download` | `profile` | Required by the route's presence check (35-40) but **never actually read** — `studentProfile` is built entirely from the DB-fetched `student` row (174-183). Dead/misleading input. |
| `teacher/assessments/process` | `student_id` (single-student path) | No ownership re-check (§3) — arbitrary student, real notification sent. |

---

## 6. Duplicated calculations

| Calculation | Copies |
|---|---|
| Trend (`improving`/`declining`/`stable`) | `app/academic-clinic/page.tsx:70-83`, `app/api/clinic/download/route.tsx:143-147`, `app/dashboard/clinic/reports/[studentId]/page.tsx:105-109` — **three independent inline implementations**; `assessmentPipeline.ts:100` doesn't compute it at all, hardcodes `'stable'` |
| Velocity | `clinic/download/route.tsx:150-157`, `dashboard/clinic/reports/[studentId]/page.tsx:112-119` — two near-identical copies; `assessmentPipeline.ts:101` hardcodes `0` |
| Capability/subject-score profile | academicClinic's `CareerEngine.matchCareers`/`analyze` uses its own `cbcScores` matching, never `extractCapabilityProfile()` — the canonical function (`lib/career/capabilityExtractor.ts:236`) used by Blueprint, `careerEngine.ts` (the *other* one), `careerIntelligenceEngine.ts`, `updater.ts`, and two `/api/career/*` routes |
| Pathway readiness | Same function (`calculateJuniorPathwayAffinity`) reused across academicClinic and `clinicReportBuilder.ts`, but fed **differently-sourced `scores`** in each caller — same formula, divergent "canonical" answers depending on entry point |
| Report/PDF generation | `lib/academicClinic/reportGenerator.ts`+`pdfGenerator.tsx` **and** a structurally separate parallel system `lib/career/clinicReportBuilder.ts` (984 lines) + `lib/career/clinicPdfRenderer.tsx` (881 lines), triggered by `app/api/career/clinic-report/route.ts`, also used by `careerIntelligenceEngine.ts`/`autoReportGenerator.ts` |
| Career engine | Two unrelated files both named `careerEngine.ts` — `lib/academicClinic/careerEngine.ts` (own `CAREER_DATABASE`, `matchCareers`) vs `lib/career/careerEngine.ts` (`getCareerBySlug`, `getMatchesForStudent`, uses `extractCapabilityProfile`) — collision risk on future edits |

---

## 7. Capability calculation paths reachable from academicClinic

Exactly one path, and it is non-canonical: `assessmentPipeline.ts:151-159` builds `cbcScores` via a locally-defined `normalizeSeniorScores()` (lines 28-50, itself inline business logic that duplicates a normalizer rather than sharing one) → `CareerEngine.analyze()` (`lib/academicClinic/careerEngine.ts:2811-2854`) → `this.matchCareers()`. `reportGenerator.ts:395` independently instantiates a second `new CareerEngine()` for senior guidance — same non-canonical path. Neither call site ever reaches `extractCapabilityProfile()`/`computeCapabilityProfile()`.

---

## 8. Pathway calculation paths reachable from academicClinic

- `assessmentPipeline.ts:121` — `calculateJuniorPathwayAffinity(scores)`, `scores` = single latest assessment's raw `subject_scores`, not a projection-reconstructed history.
- `reportGenerator.ts:1395` — same function, called again on whatever `subjects: SubjectProgress[]` the caller (any of the three UI-facing routes) has independently rebuilt from its own raw-`assessments` read (§4/§6) — so the "canonical" formula runs against as many as four independently-computed inputs across the six entry points.

---

## 9. Token deduction

Only `app/api/clinic/download/route.tsx` deducts tokens (90-114), and it does so **before** PDF generation succeeds (deduct at 92-103, generate at 200). The `catch` (215-221) returns a 500 on generation failure but performs **no rollback** — confirmed token-loss-on-failure bug, not theoretical, since the unvalidated `assessments`/`profile` body (§5) can plausibly produce a shape the generator doesn't expect. `token_usage` is also inserted (105-113) before success is confirmed.

The access **check** that gates whether the download button even renders (`dashboard/clinic/reports/[studentId]/page.tsx:167-171`) reads `user_tokens` — the legacy table CLAUDE.md explicitly forbids — while the actual **deduction** reads `token_balances`. Two different tables for the same feature, can disagree.

No other entry point deducts tokens.

---

## 10. PDF generation call chains

- **Chain A (teacher/parent pipeline, notifies)**: route → `runAssessmentPipeline()` → `reportGenerator.ts` compute functions → `generateAcademicClinicPDF()` → buffer attached to `sendReportEmail`/`sendReportWhatsApp`, never returned over HTTP.
- **Chain B (`/api/clinic/download`)**: route → inline trend/velocity (§6) → `reportGenerator.ts` compute functions → `generateAcademicClinicPDF()` → bytes streamed as the HTTP response.
- **Chain C (`/api/academic-clinic/pdf`)**: `app/academic-clinic/page.tsx` computes the entire report **client-side** → POSTs the finished object → route calls `generateAcademicClinicPDF()` directly, skipping all server-side recomputation → bytes returned.

Chain C is where "report computation" and "PDF rendering" are most cleanly decoupled, which is exactly why it is the entry point with zero ownership/content verification (§3).

---

## 11. Notification triggers

Only Chain A, only when `notify: true` (teacher route only; parent route passes `notify: false`).

- **Email** (`lib/email/reportEmail.ts:24`) and **WhatsApp** (`lib/whatsapp/reportNotify.ts:23`) content — `studentName`/`grade`/`term`/`year` — is DB-sourced, not client-body-derived. Both dedup per `student_id`+`term`+`year`.
- WhatsApp additionally sends `teacherName` = the *calling* teacher's own resolved name (`teacher/assessments/process/route.ts:60`). Combined with the missing ownership check on the single-`student_id` path (§3), a teacher who does not teach the student can trigger a real WhatsApp message to that student's real parent, naming themselves as "Your Teacher."
- Delivery status persistence (`upsertStudentClinicReport`, `assessmentPipeline.ts:288-301`) fails silently (empty catch) — minor, can desync a teacher's "was this sent" view from reality.
- Both channels are correctly gated by the student's own notification-preference flags, which are not client-suppliable.

---

## 12. Additional findings (not explicitly requested, surfaced during the trace)

1. **A third, fully separate report system exists**: `lib/career/clinicReportBuilder.ts` + `lib/career/clinicPdfRenderer.tsx`, triggered via `app/api/career/clinic-report/route.ts`, reusing `lib/pathwayCalculator.ts` but with its own report shape, PDF renderer, and capability path. This was not in scope's original file list. **A fourth is in flight right now**: an uncommitted worktree (`.claude/worktrees/agent-aedf323a0b5ed2eb3`, branch `worktree-agent-aedf323a0b5ed2eb3`) contains `lib/learnerIntelligence/reportGenerator.ts` and `app/api/learner-intelligence/pdf/route.ts` — an apparently separate, currently-uncommitted migration of this exact area by a different agent run. **This needs to be reconciled with whoever owns that worktree before Phase 2 begins** — Sprint 12C and that work will collide if both proceed independently.
2. Two unrelated files both named `careerEngine.ts` (§6) — flagged again here as a naming/collision risk worth a rename in a later phase, not fixed now (audit-only).
3. `dashboard/clinic/reports/[studentId]/page.tsx:167-171` reads the legacy `user_tokens` table, directly contradicting CLAUDE.md's "Always read balances from `token_balances` table (not the legacy `user_tokens` table)" rule.
4. `app/api/clinic/download/route.tsx` has 3 `any` types (121, 137, 138) — CLAUDE.md violation.
5. The old `Promise.allSettled` positional-unpacking bug (previously flagged in a separate audit pass) is confirmed **already fixed** at `assessmentPipeline.ts:237-285` — named slots, results read by name. No action needed.

---

## 13. Scope note for Phase 2

Per the mission statement, Phase 2 onward is scoped to `lib/academicClinic/`, `app/api/clinic/`, and related Academic Clinic helpers, and must not modify Blueprint/Projection/Evidence/Attendance/Report Cards/Career Explorer/Compass unless a genuine blocker is discovered. This audit surfaces one likely blocker already: **canonical reconstruction requires going through `recomputeLearnerProjection()`**, exactly as Blueprint does — that is a read dependency on the Projection Engine, not a modification of it, so it should not require touching out-of-scope code. The `clinicReportBuilder.ts`/`clinicPdfRenderer.tsx` parallel system and the in-flight worktree migration are explicitly **not** in Sprint 12C's stated scope (`lib/career/`, `lib/learnerIntelligence/`) — flagged for a follow-up decision, not folded into this sprint's Phase 2-7 work.

---

## 14. Files referenced

`lib/academicClinic/{assessmentPipeline,careerEngine,reportGenerator,pdfGenerator,types}.ts(x)`, `lib/pathwayCalculator.ts`, `lib/repositories/{career,assessment}.repository.ts`, `app/api/academic-clinic/pdf/route.ts`, `app/api/clinic/download/route.tsx`, `app/api/{teacher,parent}/assessments/process/route.ts`, `app/academic-clinic/page.tsx`, `app/dashboard/clinic/reports/[studentId]/page.tsx`, `components/clinic/DownloadReportButton.tsx`, `lib/career/{clinicReportBuilder,clinicPdfRenderer,capabilityExtractor,careerEngine}.ts(x)`, `lib/email/reportEmail.ts`, `lib/whatsapp/reportNotify.ts`.
