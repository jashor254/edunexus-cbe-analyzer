# Living Blueprint — Validation Freeze

**Purpose:** the exact product version all three teacher-validation sessions (Phase 4B.2) must be run against. No production code, Projection, Blueprint composition, Coherence, Assignment, Compass, Review, or PDF styling changes are permitted between sessions. If a fix is ever needed after a session reveals a real defect, it must go through a new, explicit phase — not a silent edit here.

## Frozen State

- **Git commit (HEAD):** `b0a2ae75c885cc15265dd639866e51dd69086540`
- **Branch:** `main`
- **Freeze timestamp:** 2026-07-27T02:01:48Z (working tree state recorded below is as of this timestamp)
- **Working tree:** dirty — this branch has been under active, uncommitted Phase 4A / 4A-conformance / 4B / 4B.1 development all in the same working tree (per this project's own "Main Branch Discipline" practice — direct-to-main, commits deferred). No commit was made as part of this freeze; the founder has not authorized one. If a commit is wanted before or after validation, that is a separate, explicit decision.

### Relevant modified/added files (the actual delta being tested, beyond commit `b0a2ae7`)

**Coherence Engine + Phase 4A/4A-conformance (new, untracked):**
`lib/learnerBlueprint/coherence/` (full directory), `lib/learnerBlueprint/actionPlan/` (full directory), `docs/architecture/blueprint-intelligence-coherence-engine.md`, `docs/architecture/educational-intelligence-validation-report.md`, plus the supporting `blueprint-*-phase*.md` architecture docs and `lib/repositories/blueprintActionItem*.repository.ts` / `blueprintActionReview.repository.ts` / `blueprintCompassDelivery.repository.ts`.

**Phase 4B.1 comparable-context growth correction (modified):**
`lib/projection/growthProjector.ts`, `lib/projection/types.ts`, `lib/learnerBlueprint/composeLearningStory.ts`, `lib/learnerBlueprint/composeParentSummary.ts`, `lib/learnerBlueprint/types.ts`, `lib/learnerBlueprint/coherence/rules/narrativeAlignment.ts`, `lib/learnerBlueprint/coherence/rules/evidenceSufficiency.ts`, `lib/learnerBlueprint/coherence/rules/textSignals.ts`, `components/blueprint/BlueprintView.tsx`, `components/blueprint/sections.tsx`.

**Phase 4B.1 comparable-context growth correction (new):**
`lib/projection/growthProjector.test.ts`, `docs/architecture/comparable-context-growth-correction-phase4b1.md`.

**Reference-school validation-case seeding (new, this research track):**
`scripts/reference-school/08-seed-teacher-validation-cases.ts`, `docs/research/` (this directory).

**Test files modified as part of the above (not behavior changes to production code):**
`lib/learnerBlueprint/composeLearningStory.test.ts`, `lib/learnerBlueprint/composeBlueprint.pure.test.ts`, `lib/learnerBlueprint/composeGrowthTimeline.test.ts`, `lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts`, `lib/projection/engine.test.ts`, `lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts`, `components/blueprint/BlueprintView.test.tsx`.

**Other uncommitted files present in the working tree, unrelated to the Living Blueprint / Coherence Engine / Growth Projection track** (Growth Engine / Pilot Acquisition work, RLS-hardening work, manuscript chapters, etc. — listed for completeness of "if the working tree is dirty, list every relevant modified file," but not exercised by anything in the validation script): `app/api/teacher/assignments/route.ts`, `app/api/teacher/students/[studentId]/compass-topic/route.ts`, `app/student/blueprint/[learnerId]/page.tsx`, `app/student/layout.tsx`, `app/teacher/core-office/page.tsx`, `docs/architecture/migration-ledger.md`, `docs/architecture/security.md`, `lib/compass/compassEvidenceLoop.integration.test.ts`, `lib/config/uploads.ts`, `lib/core/errors.ts`, `lib/core/permissions.ts` (+ its test), `lib/core/school.ts`, `lib/repositories/compass.repository.ts`, `lib/repositories/index.ts`, `lib/testing/lmsRoutes.http.integration.test.ts`, `package.json`, `proxy.ts`, `scripts/reference-school/06-seed-legacy-bridge.ts`, plus several `docs/manuscript/` chapters and `scripts/growth/` outreach files. None of these touch Blueprint composition, Projection, Coherence, or the PDF export path.

## Migration State

15 migration files present under `supabase/migrations/`, up to and including `20260727090000_core_academic_rls_write_hardening.sql`. All are untracked in git (uncommitted, same working-tree state as above). Direct `supabase migration list` verification was unavailable in this environment (no CLI access token configured) — instead, the tables/columns these migrations introduce (`blueprint_action_items`, `blueprint_action_item_history`, `blueprint_action_reviews`, `blueprint_compass_deliveries`) were confirmed live and functioning by the passing 25/25 `lifecycle.integration.test.ts` run recorded below, which reads and writes all of them against the real database.

## Component Versions

- **Blueprint composer version:** `1.0.0-composition-engine` (`lib/learnerBlueprint/composeMetadata.ts::BLUEPRINT_VERSION`)
- **Coherence rule version:** `1.0.0` (`lib/learnerBlueprint/coherence/types.ts::COHERENCE_RULE_VERSION`)
- **Growth projection version:** `growth-v2-comparable-context` (`lib/projection/growthProjector.ts::GROWTH_PROJECTION_VERSION`) — the Phase 4B.1 corrected algorithm
- **Validation script version:** `docs/research/living-blueprint-teacher-validation-script.md` as it stands at this freeze (last content change: Phase 4B, learner-case table and pre-session checklist; not modified during Phase 4B.1 or this freeze)

## Test Results at Freeze (re-run fresh, this session, immediately before freezing)

**Pure test suite** (`lib/projection/growthProjector.test.ts`, `lib/projection/engine.test.ts`, `lib/learnerBlueprint/composeLearningStory.test.ts`, `lib/learnerBlueprint/composeBlueprint.pure.test.ts`, `lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts`, `components/blueprint/BlueprintView.test.tsx`):
**93/93 pass.**

**Live-database integration suite** (`lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts`, including test `11b` — the coherence-FAIL-blocks-approval boundary):
**25/25 pass.**

**TypeScript:** `npx tsc --noEmit -p .` — clean, 0 errors.

**ESLint:** `npx eslint lib/projection/ lib/learnerBlueprint/ components/blueprint/` — 0 errors, 1 pre-existing warning in `components/blueprint/review/BlueprintReviewWorkspace.tsx` (a `react-hooks/set-state-in-effect` warning, unrelated to and untouched by any Living Blueprint / Coherence / Growth Projection work).

## What This Freeze Certifies

Every teacher session in Phase 4B.2 evaluates the product exactly as it stood at the moment these numbers were captured: the Phase 4B.1 comparable-context growth correction is live, the Coherence Engine's defense-in-depth extensions are live, no Action Plan quadrant was artificially filled, and the coherence-FAIL-blocks-approval boundary is intact and re-verified. No code in the Blueprint/Projection/Coherence/Assignment/Compass/Review/PDF path may change until Phase 4B.2's three sessions are complete and reported.
