# Sprint 12AB — Blueprint Canonicalization & Legacy Retirement

**Status: COMPLETE.**
**Mission**: resolve Sprint 12AA's one Critical finding — two independently-computed Blueprint engines reachable from live routes — without changing any educational calculation, ownership, or Constitution rule.

---

## PHASE 1 — Full Dependency Map

Grepped the entire repository (excluding `node_modules`, `.next`, `.claude`) for every term listed in the mission brief. Consolidated into two graphs:

### Canonical graph (unchanged by this sprint)
```
lib/learnerBlueprint/composeBlueprint.ts   ← the one composer
  ├─ composeIdentity, composeAcademicRecord, composeAttendance,
  │  composeLearningCompass, composeCareer, composePortfolio,
  │  composeAchievement, composeProjects, composeTeacherReflection,
  │  composeParentSummary, composeEducationalIdentity,
  │  composeGrowthTimeline, composeRecommendedNextSteps, composeMetadata
  ├─ lib/learnerBlueprint/snapshot.ts (createBlueprintSnapshot — freezes composeBlueprint() output)
  ├─ components/blueprint/{BlueprintView,BlueprintSectionCard,BlueprintStateMessage,sections,HistoricalBanner,EvidenceTrailPlaceholder}.tsx
  ├─ components/parent/ParentBlueprintView.tsx
  ├─ app/student/blueprint/[learnerId]/page.tsx  (calls composeBlueprint() directly)
  ├─ app/student/blueprint/[learnerId]/history/*  (reads snapshots, same payload shape)
  └─ app/(parent)/child/[learnerId]/*  (calls composeBlueprint() directly, via Parent Experience)
```

### Legacy graph (found before this sprint)
```
lib/learnerIntelligence/blueprint.ts (buildLearnerBlueprint)
  ├─ app/api/learner-intelligence/blueprint/route.ts   [only caller of buildLearnerBlueprint via HTTP]
  │   └─ components/teacher/LearnerBlueprint.tsx        [only caller of that API route]
  │       ├─ app/teacher/reports/blueprint/[studentId]/page.tsx   [live teacher route]
  │       └─ components/student/StudentBlueprint.tsx
  │           └─ app/(student)/blueprint/page.tsx                [live student self-serve route]
  ├─ scripts/generate-learner-blueprints.ts    [offline PDF demo generator, no route]
  └─ scripts/trace-consistency-audit.ts        [offline diagnostic script, no route]
```

Shared (not duplicated) infrastructure the legacy composer depends on and that must **not** be touched (used elsewhere across Career/Compass/Holiday, out of this sprint's scope per the FORBIDDEN list): `lib/learnerIntelligence/insight.ts`, `lib/learnerIntelligence/projectionAdapters.ts`, `lib/learnerIntelligence/careerIntelligence.ts`, `lib/learnerIntelligence/types.ts`, `lib/learnerIntelligence/pdfGenerator.tsx`.

No other files matched the mission's search-term list with a live composition role. `lib/academicClinic/pdfGenerator.tsx`, `lib/academicClinic/reportGenerator.ts`, and `components/DownloadClinicButton.tsx` reference the string "Learner Blueprint" only as report-title text inside the unrelated, independent Academic Clinic PDF — confirmed not a Blueprint composer (Phase 10, unchanged).

---

## PHASE 2 — Duplicate Computation, Named

| What computes | Owner | Can it call `composeBlueprint()`? | Can it be retired? |
|---|---|---|---|
| `buildLearnerBlueprint()` | `lib/learnerIntelligence/blueprint.ts` | No — different data shape (`becoming`/`opportunity`/`actions.{parent,teacher,learner}` vs. `sections.*`); redirecting its *routes* to the canonical route is the correct fix, not reshaping this function | Its two live routes: yes. The function itself: no — still used by two offline scripts (see Phase 3) |
| `app/api/learner-intelligence/blueprint/route.ts` | itself | N/A (thin API wrapper) | Yes — retired (Phase 4) |
| `components/teacher/LearnerBlueprint.tsx` / `components/student/StudentBlueprint.tsx` | themselves | N/A (presentation) | Yes — retired (Phase 4) |

No other independent Blueprint computation was found. In particular, Career (`lib/academicClinic/careerEngine.ts`, `lib/learnerIntelligence/careerIntelligence.ts`) and the six parallel parent-guidance generators flagged by Sprint 12AA are real, separate architectural issues but are **not** Blueprint-composition duplication — out of this sprint's scope per FORBIDDEN ("Do NOT redesign Career", "Do NOT redesign Parent Portal").

---

## PHASE 3 — Migration Decisions

| Consumer | Decision | Why |
|---|---|---|
| `app/teacher/reports/blueprint/[studentId]/page.tsx` | **Redirect** | Legacy `studentId` (from the class roster) is resolved to its bridged Core `learners.id` via `students.external_id` (Sprint 9F bridge, `repos.teachers.findExternalIdsByStudentIds`) and the page `redirect()`s into `app/student/blueprint/[learnerId]`, which already owns its own `requireSchoolStaff` auth check. No auth logic duplicated. |
| `app/(student)/blueprint/page.tsx` | **Redirect** | Self-serve "my own Blueprint" entry (no URL param). Resolves the signed-in user's own legacy student record via `repos.compass.findOwnedStudents` — the exact function `/api/learn/student` already used for this same "no explicit studentId" case — then bridges to Core and redirects. The 0-or-2+-owned-students edge case preserves the prior behaviour exactly (send the user to disambiguate elsewhere; this page never had its own picker). |
| `components/teacher/LearnerBlueprint.tsx` | **Delete** | Zero callers once the route above no longer renders it. |
| `components/student/StudentBlueprint.tsx` | **Delete** | Zero callers once the route above no longer renders it. |
| `app/api/learner-intelligence/blueprint/route.ts` | **Delete** | Its only caller (`LearnerBlueprint.tsx`) is deleted; grepped the whole repo for the literal string `learner-intelligence/blueprint` to confirm no other consumer (mobile app, webhook, etc.) exists. |
| `lib/learnerIntelligence/blueprint.ts` (+ `insight.ts`, `projectionAdapters.ts`, `types.ts`, `pdfGenerator.tsx`) | **Keep** | `insight.ts`/`projectionAdapters.ts`/`careerIntelligence.ts` are shared, load-bearing infrastructure for the *unrelated, in-scope-elsewhere* Career Intelligence system (touching them would violate "Do NOT redesign Career"). `blueprint.ts` and `pdfGenerator.tsx` specifically remain reachable only from `scripts/generate-learner-blueprints.ts` and `scripts/trace-consistency-audit.ts` — offline, manually-run tooling with zero live-route reachability, so they no longer create the "two truths shown to a real user" problem this sprint exists to fix. Retiring them fully would mean either rewriting two diagnostic scripts (redesign, out of scope) or building a canonical PDF generator (new feature, forbidden by the STOP CONDITION). |
| `scripts/generate-learner-blueprints.ts`, `scripts/trace-consistency-audit.ts` | **Keep, unmodified** | Same reasoning as above; both are explicitly read-only/offline and named in the regression test's whitelist (Phase 11) so any future accidental new live consumer of the legacy composer fails a test immediately. |

No silent decisions: every legacy consumer found in Phase 1 has one of the four dispositions above, with a stated reason.

---

## PHASE 4 — Route Migration

Both live routes that reached the legacy composer now redirect server-side into the one canonical route (`app/student/blueprint/[learnerId]`) instead of rendering their own presentation over legacy data:

- `app/teacher/reports/blueprint/[studentId]/page.tsx` — resolves legacy `studentId` → Core `learnerId` via the existing Sprint 9F bridge, then `redirect()`. Falls back to `BlueprintStateMessage kind="unavailable"` if the student was never bridged to Core (no silent crash).
- `app/(student)/blueprint/page.tsx` — resolves the signed-in user's own bridged learner, then `redirect()`. Same fallback behaviour for the 0-owned / 2+-owned / unbridged cases.

Both pages now do zero composition — no `composeBlueprint()` call, no reimplemented orchestration, no read of any Blueprint-shaped data at all. They are pure resolve-and-redirect. Verified by the Phase 11 regression test.

`app/api/learner-intelligence/blueprint/route.ts` deleted outright (its only caller was deleted in the same change).

---

## PHASE 5 — UI Migration

Every Blueprint surface a user can reach now renders the same `components/blueprint/BlueprintView.tsx` over the same `composeBlueprint()` payload:

- Teacher, entering via the class roster → redirected into the canonical route → `BlueprintView`.
- Student, self-serve → redirected into the canonical route → `BlueprintView`.
- Parent → already canonical (Sprint 12P/Q, unchanged) → `ParentBlueprintView.tsx` wrapping the same composed sections.
- Historical/Snapshot viewers → already canonical (Sprint 12K/L, unchanged).

Visibility/layout/permission differences (teacher vs. student vs. parent) remain exactly where they already lived — in the canonical route's own auth check and in `ParentBlueprintView`'s presentation choices — never duplicated per-audience composition.

---

## PHASE 6 — Duplicate Logic Removed

Deleted outright (safe — zero remaining callers, confirmed by grep before deletion):
- `app/api/learner-intelligence/blueprint/route.ts`
- `components/teacher/LearnerBlueprint.tsx`
- `components/student/StudentBlueprint.tsx`

Not deleted (per Phase 3's documented "Keep" decisions): `lib/learnerIntelligence/blueprint.ts` and its direct dependencies. This sprint does not maintain two live orchestration *pipelines* — it maintains one live pipeline (`composeBlueprint()`) and one **dead-to-users, offline-tooling-only** legacy function, which is the correct end state given the FORBIDDEN constraints.

---

## PHASE 7 — Snapshot Verification

Unchanged. `lib/learnerBlueprint/snapshot.ts::createBlueprintSnapshot()` still composes via `composeBlueprint()` and freezes the result; `getLatestBlueprintSnapshot()` still the one "latest" function; the DB-trigger immutability from Sprint 12K is untouched. The Historical Viewer (`app/student/blueprint/[learnerId]/history/*`) was never on the legacy graph and required no change. Confirmed via the existing `lib/learnerBlueprint/snapshot.test.ts` (unmodified, still passing).

---

## PHASE 8 — Parent Portal Verification

Unchanged and unaffected — `lib/parentExperience/` was never on the legacy Blueprint graph (Sprint 12AA Phase 8 already confirmed it composes nothing of its own). No parent-specific Blueprint builder existed before this sprint and none was introduced.

---

## PHASE 9 — Report Cards Verification

Unchanged. `lib/core/report-cards.ts` still calls `createBlueprintSnapshot()` at publication time (one of the three named snapshot trigger sites) and nothing else — Report Cards and Blueprint remain two independent artifacts, exactly as ADR-0008 Part 3 specifies. No code in `lib/core/report-cards.ts` was touched.

---

## PHASE 10 — Academic Clinic Verification

Unchanged, as instructed. `lib/academicClinic/` was confirmed in Phase 1 to reference "Learner Blueprint" only as report-title text in its own independent PDF generator — it is not, and was never, a Blueprint composer. No adapter was needed because Academic Clinic never called into either the legacy or canonical Blueprint composer. Documented here per the mission's "if adapters remain, document them" instruction: **none exist, none were needed.**

---

## PHASE 11 — Testing

New regression test: `lib/learnerBlueprint/canonicalComposer.architecture.test.ts` (4 tests, all passing). It walks the real source tree (no mocks) and enforces the exact invariant this sprint restores:

1. The legacy composer (`lib/learnerIntelligence/blueprint.ts`) has no importer outside a named, three-entry whitelist (itself + the two offline scripts).
2. No `app/**/page.tsx` or `app/**/route.ts` file imports the legacy composer.
3. `composeBlueprint` is defined exactly once in the entire repository.
4. Both migrated pages redirect into the canonical route and never call `composeBlueprint()` themselves.

This test fails loudly if a future change reintroduces a second live Blueprint composer or a new import of the legacy one outside the whitelist — the exact regression class this sprint exists to prevent.

Full regression pass performed:
- `npx tsc --noEmit -p .` — clean (0 errors; two stale `.next` generated-type errors cleared after `rm -rf .next`, unrelated to source).
- `npx eslint .` — 0 errors (37 pre-existing warnings in unrelated files, unchanged by this sprint).
- All 16 `composeBlueprint.pure.test.ts` tests — pass, unaffected.
- All 34 tests across every `lib/**/*.pure.test.ts` file — pass, unaffected.
- New `canonicalComposer.architecture.test.ts` — 4/4 pass.

No existing test referenced the deleted files (`LearnerBlueprint.tsx`, `StudentBlueprint.tsx`, the deleted API route) — confirmed by grep before deletion, so nothing needed updating on that front.

---

## PHASE 12 — Cleanup

- Both migrated page files carry a header comment explaining the Sprint 12AB decision and pointing at this document, so a future reader hitting `/teacher/reports/blueprint/[studentId]` or `/blueprint` understands immediately why the file is a thin redirect.
- No architecture doc previously claimed these two routes were canonical, so no ADR or prior sprint doc requires a correction.
- `docs/architecture/deprecation-registry.md` did not carry an entry for the dual-Blueprint-engine problem (Sprint 12AA Finding, registry gap #1) — not updated in this sprint because the registry's own scope is pre-deletion tracking of *tables/columns*, not route-level duplication; recommending this as a Sprint 12AA follow-up item rather than expanding the registry's scope inside a canonicalization sprint.
- No misleading terminology remains: every remaining reference to "Learner Blueprint" in `lib/learnerIntelligence/` now sits behind the documented, tested whitelist boundary rather than being reachable by surprise.

---

## Verification Checklist

- [x] One Blueprint composer exists (`lib/learnerBlueprint/composeBlueprint.ts`, verified by test)
- [x] Legacy Blueprint computation retired from every live route (2 routes migrated); the function itself kept, whitelisted, tested
- [x] Teacher routes migrated (`app/teacher/reports/blueprint/[studentId]/page.tsx`)
- [x] Student routes migrated (`app/(student)/blueprint/page.tsx`)
- [x] Parent routes — already canonical, unchanged, reverified
- [x] Snapshot Viewer — unchanged, reverified
- [x] Historical Viewer — unchanged, reverified
- [x] Report Cards — unchanged, reverified
- [x] Academic Clinic — unchanged, reverified (no adapter needed)
- [x] One orchestration pipeline reachable from any live route
- [x] No duplicated Blueprint logic on any live path
- [x] `tsc` clean
- [x] `eslint` clean (0 errors)
- [x] Full regression suite passes (composeBlueprint pure + all lib pure tests + new architecture test)

**Sprint 12AB is complete. Per the STOP CONDITION, no further domains (Competitions, Community Service, Leadership, Wellbeing, Innovation, Sprint 13) were started.**
