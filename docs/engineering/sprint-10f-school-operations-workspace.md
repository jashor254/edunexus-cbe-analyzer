# Sprint 10F — School Operations Workspace

**Type**: UI orchestration. No production business logic, schema, migration, or new orchestrator was added. Zero new API routes — every workflow card, checklist item, and status pill on the new landing page reads an existing route Sprint 10E already built (`/api/core/academic-readiness`, `/api/core/teachers?list=true`, `/api/core/classes`, `/api/core/assessments`, `/api/core/reports`).

**Mission**: Sprint 10E proved four backend capabilities could be reached through real screens. Sprint 10F does not add a fifth — it stops those screens from being four more isolated pages a user has to already know the URL for, by making `app/teacher/core-readiness` the one canonical "School Operations" workspace every operational screen is reachable from and returns to.

## What changed

**One landing page, not a new one.** Phase 1's audit of every operational page added in Sprint 10E (`core-team`, `core-admissions`, `core-readiness`, `core-term`, `core-term/status`) found nothing to build a duplicate of — `core-readiness` was already the closest thing to a workspace root, so it was expanded in place rather than replaced. Renamed in the nav from "School Setup" to "School Operations" to match.

**Six workflow cards**, each composed from an existing call, no new calculation beyond a plain count/percentage over already-computed fields:
- School Activation — `activationStatus` from `getSchoolAcademicReadiness()`. Informational only; no page exists to re-run activation for an existing school, so this card is not a link (Phase 1's "do not build duplicates" — building one would duplicate `app/admin/core-schools/new`'s job for a case that doesn't exist yet).
- Teachers — active/pending counts from `/api/core/teachers?list=true`, links to `core-team`.
- Learners — enrolled count + readiness flag from `getSchoolAcademicReadiness()`, links to `core-admissions`.
- Classes — count + grades-in-use from `getSchoolAcademicReadiness()`. No dedicated Core class-management screen exists anywhere in the repo (confirmed by search — `app/teacher/classes` is the legacy, non-Core tree); building one would be new scope this sprint's mission explicitly forbids, so this card is informational only, same as School Activation.
- Assessments — classes-locked count, links to `core-term`.
- End of Term — classes-reported count, links to `core-term/status`.

**One operational checklist**, six items (Academic Year, Terms, Teachers, Subjects, Classes, Learners) — exactly what `getSchoolAcademicReadiness()` reports, no more. "Assessment Ready" and "Compass Ready," present in the sprint's own example, were deliberately **not** added: no existing endpoint computes either at school scope (`eligibleForAssessment`/`eligibleForCompass` in `lib/core/learnerOnboarding.ts::getLearnerReadiness()` are per-learner only). Inventing a school-wide aggregate for either would have been new business logic, which this sprint's mission forbids — omitted and documented rather than fabricated.

**One shared breadcrumb** (`components/core/OperationalBreadcrumb.tsx`): "School Operations > <page>" on every operational screen, replacing each page's previous one-off "← Back to X" link. Not a routing change — every route is exactly where it was.

**One de-duplication**: the per-class assessment/report completion computation previously lived only inline in `core-term/status`'s effect. `core-readiness`'s End of Term and Assessments cards need the same summary, so it was extracted to `lib/core/client/termStatus.ts::fetchClassTermStatuses()` and both screens now call the one function — composing the same three existing routes it always did, not a new query.

## Explicitly out of scope, and why

Sprint 10D's audit found other orphan screens beyond the Core operational chain — `buildPrincipalDashboard()` (no page at all), `app/teacher/insights` (legacy `teacher_classes`-backed analytics), `app/(parent)/career-report` (parent-facing career intelligence). None were wired into this workspace. They sit outside the Core School/Teacher/Learner operational chain this sprint's mission scopes to (school activation → teachers → learners → readiness → assessments → end of term), and two of them (`insights`, `career-report`) are Intelligence-domain screens this sprint's "no intelligence changes" rule puts off limits. Wiring them in would be scope creep into a different feature, not workspace orchestration of what already exists in this chain.

## Verification

`tsc --noEmit` and `eslint` clean on every touched/new file. Live dev-server check: all five operational pages compile and correctly redirect unauthenticated requests (307, matching pre-existing behavior). No duplicate `href` values across either nav component (checked directly). Zero new API routes were added, so no new route-level surface to regress. As in Sprint 10E, a full logged-in click-through as a real admin-tier Core user was not performed — no test credentials were available this session; flagged rather than assumed.

See `docs/engineering/implementation-log.md` for the formal sprint entry (files touched, rollback considerations).
