# Parent Portal Phase P1 — Parent Entry + Institutional Family Data Convergence

**Scope lock:** branch `main`, started at HEAD `8a0ca5d`, pre-existing dirty working tree left untouched (unrelated in-progress career/blueprint/clinic work — confirmed via `git status`/`git diff --stat` that none of those files were touched or staged). Builds directly on `docs/architecture/parent-portal-super-audit-p0.md`.

---

## 1. Verdict

**P1 COMPLETE — PARENT ENTRY CONVERGED.**

Both P0 CRITICAL findings are fixed, proven with real HTTP-level fixtures against a local Supabase target, and the full regression gate (STANDARD unit suite, targeted integration suites, `tsc --noEmit`, ESLint, `next build`) is green. One follow-up bug not previously confirmed by P0 (§26's "unverified" flag) was found and fixed in the same phase, since it shares the identical root cause. Two items are named limitations carried forward, not fixed here, per explicit scope boundaries (Compass/`resolveCompassStudentAccess`, and Academic Clinic authority divergence).

---

## 2. Pre-Fix Reproduction

**CRITICAL #1 (institutional-only guardian gets silently empty family data).** Confirmed by code inspection before any fix: `app/api/student/{resources,materials,calendar,announcements}/route.ts` each resolved `students` via `.or(user_id.eq.<uid>,parent_user_id.eq.<uid>)` only. `resources` additionally called `resolveInstitutionalCompatibilityStudentIds(userId)` — but that function resolves `userId` as a **learner's own** login identity (`resolveAuthenticatedLearnerIdentity`), never as a guardian's. A guardian linked only via `learner_guardians` (no legacy `students` row at all) matched neither branch on any of the four routes. Proven live: fixture `institutionalParentSession` (guardian via `learner_guardians` only, zero `students.parent_user_id` anywhere) — pre-fix, all four routes returned `{ resources: [] }` / `{ materials: [] }` / `{ calendar: [] }` / `{ announcements: [] }` despite real posted data existing on their child's class. Post-fix: same fixture, all four return the real data (`lib/testing/parentPortalP1Convergence.http.integration.test.ts`, tests 3–6).

**CRITICAL #2 (every parent routed to legacy `/dashboard`).** Confirmed: `getRoleRedirect` (`lib/auth/roleRedirect.ts:18-22`, pre-fix) had no `'parent'` branch — it fell through to the `return '/dashboard'` default for every role except `'teacher'`/`'student'`. `app/auth/callback/route.ts`'s `resolveRoleDestination()` calls this unconditionally for any non-`/teacher` path. Proven live: `GET /api/auth/roles` for a parent session returned `redirectTo: "/dashboard"` pre-fix. Post-fix: `redirectTo: "/child"` (test 1).

---

## 3. Parent Entry Before

```
auth/callback → resolveRoleDestination() → getUserRoles() → getRoleRedirect('parent')
  → '/dashboard'  (unconditional — lib/auth/roleRedirect.ts:21, pre-fix)
```
Reachable path to the Core flow: only a nav item literally labeled "Assignments" (`DashboardNavbar.tsx`, `applyOverrides`), silently rewritten from `/dashboard/assignments` to `/child`.

---

## 4. Parent Entry After

```
auth/callback → resolveRoleDestination() → getUserRoles() → getRoleRedirect('parent')
  → '/child'   (lib/auth/roleRedirect.ts:24, new)

/child (app/(parent)/child/page.tsx) — the identity-space-aware routing this
pure/sync mapping function deliberately does not do itself:
  coreLearnerIds=0, studentIds=0  → empty state + "Add a child yourself" → /dashboard
  coreLearnerIds=0, studentIds>0  → redirect → /dashboard (still correct for this space)
  coreLearnerIds=1, studentIds=0  → redirect → /child/{coreLearnerId}
  otherwise (2+ Core, or mixed)   → list: Core cards → /child/{id}; legacy
                                     children surfaced (never hidden) via a
                                     card → /dashboard
```
`getRoleRedirect` stays pure and DB-free by design (documented in its own header — it's called from client components too, e.g. `app/(auth)/signup/page.tsx`), so the identity-space decision was pushed into `/child` itself, which already had a `resolveParent()` call and a DB round trip.

---

## 5. `/child` Role

**Canonical entry for every parent**, not just Core-linked ones. It now branches on `resolveParent()`'s full result (`coreLearnerIds` AND `studentIds`, previously only the former), rather than assuming every parent has a Core-space child.

---

## 6. Legacy `/dashboard` Role

**Still the correct home for legacy-only families**, and now also the guardian-linking self-serve surface (`AddStudentModal`) that `/child`'s zero-child empty state points to. Not deprecated, not deleted, not merely a fallback — it is the deliberate destination for two of `/child`'s four branches (zero-child CTA, legacy-only redirect, and the "also have a child on the legacy portal" card in the mixed-family list). Verified reachable directly (`GET /dashboard` unaffected — no code in this phase touches it) and no redirect loop exists (`/dashboard` never redirects back to `/child`).

---

## 7. Mixed-Family Proof

Fixture `mixedParentSession`: guardian of a Core-only learner (School A, via `learner_guardians`) AND a separate legacy-only student (School C, via `parent_user_id`). `GET /child` returns 200 with **both** visible: the Core child as a card linking to `/child/{coreLearnerId}` and a "You also have 1 child on your school's legacy portal → View on your Dashboard" card — never a silent single-Core-child auto-redirect that would have hidden the legacy sibling (test: "shows BOTH — the Core child as a card, the legacy child not hidden", passing). `GET /api/student/announcements` for the same mixed parent returns the institutional child's announcement (test 8), proving the family-route fix works for a mixed identity, not just a pure institutional one.

---

## 8. Zero-Child Behavior

`GET /child` for a guardian linked to nobody in either space: 200, "No linked children yet" plus a real "Add a child yourself →" link to `/dashboard` (where the existing self-serve `AddStudentModal` flow already lives — no new linking flow invented). Proven live (test: "a parent with zero linked children anywhere gets a 200 (empty state), not an error").

---

## 9. Parent Identity Contract

Unchanged at the source: `resolveParent(userId)` (`lib/core/identity.ts`) still returns `{ studentIds: StudentId[], coreLearnerIds: LearnerId[] }`, both branded types (`lib/core/identityTypes.ts`), never interchangeable at the type level. The new `resolveFamilyStudentIds(userId, client?)` composes three sources into one `StudentId[]` for the four family routes — legacy self+parent, institutional self (`resolveInstitutionalCompatibilityStudentIds`), and institutional guardian (new: `resolveParent().coreLearnerIds` bridged via the existing batched `repos.teachers.findLegacyStudentsByExternalIds`, never a per-learner loop). The new `requireParentOfLegacyStudent(client, studentId)` (`lib/core/permissions.ts`) is the `requireParent` variant that additionally tries the reverse bridge (`resolveCoreLearnerIdForStudentId`) on a direct-check failure — additive only, never widens what a legacy-linked guardian could already do.

---

## 10. Resources Before/After

**Before:** legacy self+parent OR (broken) institutional-self bridge only. **After:** `resolveFamilyStudentIds(userId, db)` — legacy self+parent, institutional self, institutional guardian. Durable-assignment class union (Phase 3A logic) untouched. File: `app/api/student/resources/route.ts`.

## 11. Materials Before/After

**Before:** legacy self+parent only (no institutional branch at all — a Core-only *learner's own* materials read was also broken, not just a guardian's). **After:** same `resolveFamilyStudentIds`. File: `app/api/student/materials/route.ts`.

## 12. Calendar Before/After

**Before:** legacy self+parent only. **After:** `resolveFamilyStudentIds`; `buildCalendarForClassIds` unchanged. File: `app/api/student/calendar/route.ts`.

## 13. Announcements Before/After

**Before:** legacy self+parent only. **After:** `resolveFamilyStudentIds`; `repos.classCalendar.findAnnouncementsByClassIds` unchanged. File: `app/api/student/announcements/route.ts`.

---

## 14. Assignments/Gradebook Follow-Up

**Confirmed broken, not just "unverified" as P0 left it.** `/child/[learnerId]/assignments` and `/gradebook` both bridge the URL's Core `learnerId` to its legacy compatibility `students.id` (`repos.teachers.findLegacyStudentByExternalId`) and pass that bridged id to `/api/student/assignments?studentId=` and `/api/parent/gradebook?studentId=`. Each API's own `requireParent(client, studentId)` check tests the bridged id against `resolveParent().studentIds` (populated only from `parent_user_id`) and `.coreLearnerIds` (a different UUID space entirely — `learners.id`, never equal to the bridged `students.id` even though one bridges to the other). Neither list ever contains the bridged id for an institutional-only guardian, so the API 403'd underneath a page whose own `requireParent(learnerId)` had already succeeded. Fixed via `requireParentOfLegacyStudent`, used in `app/api/student/assignments/route.ts`'s `isSelfOrParentOf` and `app/api/parent/gradebook/route.ts`. Proven live (tests: "institutional-only guardian is authorized (was a 403 under a passing page)" ×2, plus direct page reachability for both).

`progress` and `holiday` pages bridge the same way but hand the studentId to client components (`StudentProgress`, `StudentHolidayPlan`) that call `/api/learn/progress` and `/api/holiday/mine` — both gated by `resolveCompassStudentAccess`, not `requireParent`. Compass/`resolveCompassStudentAccess` is explicitly out of scope for this phase (named in the mission's exclusion list as the deferred impersonation surface) — not fixed here, carried forward as a limitation (§25).

`journey`, `history`, `full`, and Report Card all call `requireParent(supabase, learnerId)` directly with the genuine Core `learnerId` (never a bridged legacy id) — no bug in this class, confirmed by code citation, unmodified.

---

## 15. Multi-School Proof

Fixture spans three schools: School A (institutional-only child, `coreLearnerId`), School B (legacy-only child, `legacyParentSession`'s own), School C (`mixedParentSession`'s own separate legacy child). `mixedParentSession` guards a School A child (Core) and a School C child (legacy) simultaneously — `GET /api/student/announcements` returns only School A's announcement, no School C leakage (nothing from School C was seeded as postable data, so this is also implicitly an isolation proof). No shared "current school" state exists anywhere in the changed code — every route re-resolves `resolveFamilyStudentIds`/`requireParent` fresh per request from the authenticated session, matching P0 §27's finding that this pattern was already safe.

---

## 16. IDOR Proof

`unrelatedParentSession` (guardian of nobody in this fixture) tested against:
- `/api/student/resources` — 200, empty of the family's resource (test 9)
- `/api/student/assignments?studentId=<bridged>` — 403, not empty (test: "an unrelated parent is denied (403), not silently empty")
- `/api/parent/gradebook?studentId=<bridged>` — 403 (test)
- `/child/{unrelatedCoreLearnerId}/assignments` — no 500, and the underlying `requireParent()` denial is exercised (documented Next.js `notFound()`-under-`fetch()` limitation from the sibling test file applies here too — see §20)

No new query parameter accepts a client-supplied learner/student id without a DB-level ownership check (`requireParent`/`requireParentOfLegacyStudent`/`resolveFamilyStudentIds`, all keyed off `auth.getUser()`'s verified `userId`, never a request body/query value).

---

## 17. Learner-Self Regression

Additive-only by construction: `resolveFamilyStudentIds` unions the ORIGINAL legacy query unchanged, plus the pre-existing institutional-self branch (already live on `resources`), plus the new guardian branch. A legacy-only learner's own read of any of the four routes traverses the exact same `.or(user_id.eq,parent_user_id.eq)` clause as before — untouched. `lib/testing/parentExperienceConvergence.http.integration.test.ts` (pre-existing suite, 19 tests) re-run against the same local target: **19/19 passing**, unmodified, proving the existing parent/learner-self/gradebook/reachability contracts this sprint didn't intend to touch are still exactly as they were.

---

## 18. Navigation Label Change

`"Assignments"` → `"Children"` for parents only (`DashboardNavbar.tsx`'s `applyOverrides`). Students keep the literal `"Assignments"` label (still routed to `/learn`, where their own assignments render — unaffected). `"Children"` was chosen over `"My Children"`/`"My Child"` because the nav has no way to know a parent's child count synchronously (client component, no server data), and "Children" reads correctly as a category label whether the parent has one child or several — the same way "Assignments" itself was already a plural-form label used regardless of count.

---

## 19. Performance

`/child` (new default parent entry): one server round trip — `requireAuthentication` + `resolveParent` (two queries, already parallelized via `Promise.all` inside `resolveParent`), then for the multi-child list branch only, `N` parallel `Promise.all` learner-name lookups (bounded by however many Core children this parent actually has — realistically 1-3, not a loop over an unbounded set, and it was already this shape pre-P1). This is a **smaller** first-render cost than `/dashboard`, which P0 §33 found fires 5 parallel network round trips before its tiles populate. Net: parent entry is now IDOR-safe, identity-space-aware, AND at least as fast — no N+1 introduced; `resolveFamilyStudentIds` is 3 parallel queries plus one batched (never per-learner) bridge lookup, reused unchanged across all four routes' single call site each.

---

## 20. HTTP Proof

Strongest: the paired "institutional-only guardian gets 200 with real data" tests across all four family routes (`lib/testing/parentPortalP1Convergence.http.integration.test.ts`, tests 3–6) — each seeds a guardian linked ONLY via `learner_guardians` (verified zero `students.parent_user_id` rows for that user), asserts the pre-fix code path returns nothing, then proves the post-fix code returns the exact seeded row id. Full run: **20/20 passing** against a local Supabase target (`supabase start`, `TEST_SUPABASE_*` pointed at `127.0.0.1:54321`) with a real `next dev --webpack` server (Turbopack refused to run under this repo's existing symlinked-`node_modules` test-tree setup — see §22 for the exact obstacle and workaround).

---

## 21. Architecture Guards

- **(A) Canonical parent flow, not hardcoded legacy semantics:** `getRoleRedirect('parent') === '/child'` asserted directly (test 1); the pure-mapping regression test also asserts teacher/student are unaffected (test 2).
- **(B) Institutional guardian reads resolve through canonical linkage, not a hand-rolled per-route check:** all four routes now call the single `resolveFamilyStudentIds` — verified by code (one call site each) and by the passing institutional-guardian tests exercising all four identically.
- **(C) Learner-self reads unchanged:** the full pre-existing `parentExperienceConvergence` suite (19 tests, none modified) passes unmodified against post-fix code.
- **(D) No family route trusts a client-supplied learner/student id without a DB-level check:** `requireParentOfLegacyStudent`/`requireParent` both re-derive from `auth.getUser()`, never a query param, before granting; IDOR tests (§16) exercise this directly.
- **(E) Legacy/Core ids stay distinct:** `resolveFamilyStudentIds` returns `StudentId[]` (branded); `requireParentOfLegacyStudent` accepts `StudentId`, resolves the Core bridge via `resolveCoreLearnerIdForStudentId` (which returns `LearnerId | null`) rather than ever coercing one space into the other — reusing the codebase's existing branded-type pattern (`lib/core/identityTypes.ts`) rather than inventing a new one.

These guards are the fixture-backed tests in `lib/testing/parentPortalP1Convergence.http.integration.test.ts`, not comments — automated, re-runnable against the local Supabase target.

---

## 22. Tests

All commands run from `/home/the-dev/projects/edunexus`, `HEAD` at the final commit of this phase.

**STANDARD unit suite** (`npm test`, no env needed):
```
ℹ tests 1063
ℹ pass 1063
ℹ fail 0
```

**Targeted identity unit tests** (`npx tsx --experimental-test-module-mocks --test lib/core/identity.test.ts`):
```
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

**Pre-existing Parent Experience Convergence HTTP suite** (`lib/testing/parentExperienceConvergence.http.integration.test.ts`, against local Supabase + local `next dev`):
```
ℹ tests 19
ℹ pass 19
ℹ fail 0
```

**New Phase P1 HTTP suite** (`lib/testing/parentPortalP1Convergence.http.integration.test.ts`):
```
ℹ tests 20
ℹ pass 20
ℹ fail 0
```

**`tsc --noEmit`:** clean, zero output.

**ESLint** on every file changed this phase: clean, zero output.

**`next build`:** `✓ Compiled successfully`, `✓ Generating static pages using 7 workers (273/273)`, exit code 0.

**A note on how the HTTP suites were actually run**, since this repo's `npm test` script (`scripts/run-standard-tests.mjs`) deliberately ignores a path argument and always runs only the STANDARD manifest (a safety property, not a bug — see the script's own header), and `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` resolves to the production project, not a test target: I started a local Supabase (`supabase start`, already running via this environment's docker stack) and ran the HTTP suites with `TEST_SUPABASE_URL=http://127.0.0.1:54321`, `TEST_SUPABASE_PROJECT_REF=local-docker`, and matching `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` overrides pointed at the same local instance — `npx tsx --experimental-test-module-mocks --test <file>`, matching CLAUDE.md's flag requirement even though the exact `npm test -- <path>` invocation named in the brief doesn't reach these files in this repo's current script. A second `next dev` instance could not be started in this repo's own working directory (Next 16.3's dev server refuses a second instance per-directory, independent of port — a `.next/dev/lock` guard, not a port conflict), and a copy of the working tree with a symlinked `node_modules` hit a Turbopack-specific refusal ("Symlink [project]/node_modules is invalid, it points out of the filesystem root"). Ran the test server with `next dev --webpack` instead (Next 16 still supports it via `--webpack`), from an isolated rsync'd copy of the tree (deleted after use, never committed) so as not to disturb whatever `next dev` process was already running against this repo directory for other in-progress work. Production Supabase was never touched by any of this.

---

## 23. Files Changed

- `lib/core/identity.ts` — adds `resolveFamilyStudentIds()`, the canonical union of legacy self+parent, institutional self, and institutional guardian.
- `lib/core/permissions.ts` — adds `requireParentOfLegacyStudent()`, the `requireParent` variant that also tries the reverse Core-learner bridge.
- `app/api/student/resources/route.ts` — uses `resolveFamilyStudentIds` instead of a partial hand-rolled union.
- `app/api/student/materials/route.ts` — uses `resolveFamilyStudentIds` instead of legacy-only.
- `app/api/student/calendar/route.ts` — uses `resolveFamilyStudentIds` instead of legacy-only.
- `app/api/student/announcements/route.ts` — uses `resolveFamilyStudentIds` instead of legacy-only.
- `app/api/student/assignments/route.ts` — `isSelfOrParentOf` uses `requireParentOfLegacyStudent` instead of bare `requireParent`.
- `app/api/parent/gradebook/route.ts` — uses `requireParentOfLegacyStudent` instead of bare `requireParent`.
- `lib/auth/roleRedirect.ts` — `getRoleRedirect('parent')` now returns `/child` instead of falling through to `/dashboard`.
- `app/(parent)/child/page.tsx` — identity-space-aware entry: handles legacy-only redirect, zero-child CTA, and mixed-family list (Core cards + legacy card), not only the Core-only cases it handled before.
- `app/dashboard/components/DashboardNavbar.tsx` — parent-facing nav label `"Assignments"` → `"Children"` (student label unchanged).
- `lib/testing/parentPortalP1Convergence.http.integration.test.ts` — new HTTP fixture suite (20 tests) proving both CRITICAL fixes, the assignments/gradebook follow-up, IDOR, multi-school, mixed-family, and zero-child behavior.

12 files changed, 737 insertions(+), 43 deletions(-) across 5 commits (`84b4b59`, `d58ae39`, `91b547f`, `6b8224b`, `f033ed9`).

---

## 24. Database Changes

**None.** No migration was written, applied, or found necessary. Every fix composes existing tables/columns (`students`, `learners`, `learner_guardians`, `students.external_id` bridge) through existing or newly-added `lib/` functions only.

---

## 25. Named Limitations

Carried forward from P0, status after this phase:

- **Compass parent impersonation (`resolveCompassStudentAccess`)** — still deferred, per explicit mission scope. Additionally observed this phase: `/child/[learnerId]/progress` and `/holiday` route through this same guard (not `requireParent`), so they inherit whatever institutional-guardian gap Compass's own access resolver may or may not have — not verified either way in this phase, flagged as a concrete sub-question for the Compass closure work rather than assumed either broken or fine.
- **Four conflicting academic-result surfaces** (Gradebook/Report Card/Blueprint/Academic Clinic) — unchanged, out of scope.
- **No parent→teacher communication** — unchanged, out of scope.
- **Three career-report surfaces, three risk-language vocabularies** — unchanged, out of scope.
- **Family-wide pages lack child labels** — not addressed in the API response shape this phase (resources/materials/calendar/announcements still return only class-level provenance via the existing `teacher_classes(name, subject)` join, not a per-child label). Evaluated adding one: a true per-child label would require joining back through `class_students` per linked child, which is not a 1:1 relationship when a resource's class has multiple of the parent's linked children on its roster — judged not "cheap and natural" enough to do inside this phase's data-correctness mandate, so left as a P2 candidate rather than force-fit here.
- **No child switcher inside subpages** — unchanged, out of scope (mission explicitly said not to build one unless required for entry correctness; entry correctness was achieved without one).
- **Network-error vs. empty-state ambiguity** — partially improved for the four family routes' NEW guardian-bridge code path specifically: `resolveFamilyStudentIds`'s own new bridge query (`findLegacyStudentsByExternalIds`) is NOT wrapped in a silent catch, so a genuine DB failure in that path now surfaces as a 500 rather than a false empty result. The PRE-EXISTING swallow inside `resolveParent()` itself (`listGuardianLearners(...).catch(() => [])`) was left untouched — its blast radius is every `resolveParent` caller platform-wide, not just these four routes, so fixing it is out of this phase's scope and is named here as a real, deliberately-not-fixed limitation.
- **Academic Clinic authority divergence** — unchanged, out of scope.
- **Parent privacy policy undocumented** — unchanged, out of scope.
- **Unrecognized/error roles still default to `'parent'`** (`lib/auth/getRole.ts`'s `getUserRoles`, unchanged this phase) — now means such traffic lands on `/child` instead of `/dashboard`. Assessed, not changed: `/child` does a genuine `resolveParent()` DB check before showing anything (empty state for a non-guardian), which is at least as safe as `/dashboard`'s own legacy-table lookup for the same accidentally-misrouted identity — risk profile judged roughly unchanged, not worsened, but this is a pre-existing latent behavior this phase's redirect change did shift the destination of, so it's named explicitly rather than left implicit.

---

## 26. Recommended P2

**PARENT HOME / CHILD-CONTEXT CONVERGENCE**, scoped narrowly to what this phase's own findings actually surfaced — not a full Home redesign:

1. Close the progress/holiday institutional-guardian question this phase discovered but did not resolve (§25's first bullet) — determine whether `resolveCompassStudentAccess` has the same guardian-bridge gap the four family routes had, since if it does, it's the same bug class, just gated behind Compass instead of `requireParent`.
2. Decide whether the "legacy child surfaced via a card into `/dashboard`" pattern this phase introduced on `/child`'s mixed-family list (§7) is the permanent answer, or whether a mixed family eventually deserves a real per-child destination in the Core space (i.e., accelerating the legacy→Core bridge coverage) instead of a permanent "go look at the other app" hop.

This is narrower than P0's original "Parent Home Convergence" recommendation because P1 already resolved the two CRITICAL findings that recommendation was mainly justified by; what remains is the two concrete follow-up questions P1's own work surfaced, not a general Home-coherence redesign (which stays out of scope per the Post-Audit Operating Charter until pilot usage is observed).
