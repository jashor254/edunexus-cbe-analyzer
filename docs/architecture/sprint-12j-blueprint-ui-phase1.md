# Sprint 12J — Learner Blueprint Presentation Layer (Phase 1)

**Status: implemented.** First production-ready Blueprint UI, built strictly against ADR-0005 through ADR-0009 and the canonical `lib/learnerBlueprint/` composition engine. No new educational calculation, AI, scoring, or evidence was introduced — Blueprint remains a pure composition/presentation layer.

---

## 0. Required Architecture Corrections (done first, per mission)

1. **Added `freshness: 'live' | 'snapshot' | 'historical'` to `BlueprintSection<T>`** (`lib/learnerBlueprint/types.ts`), exactly as Sprint 12J-A's Finding 4 required. Populated per ADR-0007 §6's table in every composer: Identity=live, Academic Record=live, Attendance=snapshot, Learning Compass=live, Career=live, Teacher Reflection=snapshot, Parent Summary=live, Educational Identity=live, Growth Timeline=historical. Every construction site across all nine composers and the pure test fixtures was updated; `tsc`/tests confirm nothing was missed.
2. **Froze one canonical reserved-module list** — the 19-item union from Sprint 12J-A §9, now stated once in `sprint-12e-blueprint-layout-design.md` §17 and cited by name from `adr-0008-blueprint-lifecycle-and-rendering.md` (both prior "fourteen" references) and `sprint-12i-blueprint-presentation-architecture.md` (prior "thirteen other" reference) instead of restating a different, differently-counted list in each place.
3. **Standardized "Evidence Trail"** everywhere in `adr-0009-blueprint-presentation-architecture.md` and its companion — every prior "Evidence Trace"/"Evidence Timeline" occurrence now reads "Evidence Trail."
4. **Clarified the Report Card → Current Blueprint → Historical Snapshots → Compass/Career navigation wording** in ADR-0009 §6, adding an explicit sentence stating this is an entity ordering, not a literal forward chain — Report Card is a dead-end, navigation runs backward from Current, and Compass/Career are parallel exits.

None of these four corrections changed any ADR's actual decision — all were wording/type corrections identified by the Sprint 12J-A consistency review, applied now as this sprint's own prerequisite, exactly as instructed.

---

## 1. Rendering Architecture

```
app/student/blueprint/[learnerId]/page.tsx   (Server Component, thin)
  |
  | 1. requireAuthentication(supabase)         -> redirect('/login') on failure
  | 2. repos.learners.findSchoolId(learnerId)  -> notFound() if the learner doesn't exist
  | 3. requireSchoolStaff(supabase, schoolId)  -> notFound() if not teacher/admin (mission: "Teacher-first")
  | 4. composeBlueprint({ actorUserId, coreLearnerId: learnerId, schoolId })
  |
  v
components/blueprint/BlueprintView.tsx        (renders the frozen 9-section + Evidence Trail order)
  |
  +-- BlueprintSectionCard (x9)                (generic status/owner/freshness/expand-collapse wrapper)
  |     +-- IdentitySection / AcademicRecordSection / AttendanceSection /
  |         LearningCompassSection / CareerSection / ParentSummarySection
  |         (components/blueprint/sections.tsx — only for sections that can be `available`)
  |
  +-- EvidenceTrailPlaceholder                 (static, inert — Layer 5, ADR-0009 §1)
```

Uses only `lib/learnerBlueprint/composeBlueprint`. Zero imports from `lib/academicClinic/` or `lib/learnerIntelligence/` anywhere in the new code — confirmed by grep (§6).

---

## 2. Component Hierarchy

- **`app/student/blueprint/[learnerId]/page.tsx`** — the only server-side, data-fetching file. Thin: auth, schoolId resolution, one `composeBlueprint()` call, hands the result to `BlueprintView`. No business logic.
- **`components/blueprint/BlueprintView.tsx`** — top-level layout. Fixes the section order (mission's exact list: Identity, Academic Record, Attendance, Learning Compass, Career Intelligence, Teacher Reflection, Parent Summary, Educational Identity, Growth Timeline, Evidence Trail). Renders a validation-error banner if `validation.valid` is false. Audience-neutral — every section renders for every viewer this sprint (mission: "Audience filtering belongs later").
- **`components/blueprint/BlueprintSectionCard.tsx`** — the one generic wrapper (`'use client'`, per ADR-0009 §4's single-scrolling-document/expand-collapse model, no tabs). Displays Owner, Freshness badge, Availability badge, Last Updated, and the expand/collapse chevron for every section, regardless of its status. Renders the fixed `Unavailable.` / `Coming Soon.` states per the mission's exact instruction — never fabricates content for either state.
- **`components/blueprint/sections.tsx`** — six small, presentation-only renderers (Identity/Academic Record/Attendance/Compass/Career/Parent Summary) — the only sections that can be `available` this sprint. Each renders only fields already on its `BlueprintSection`'s data type; nothing computed here.
- **`components/blueprint/EvidenceTrailPlaceholder.tsx`** — static placeholder, not a `BlueprintSection` (Evidence is "indirect only" per ADR-0005 §3) — no QR, no link, exactly per mission instruction.

Teacher Reflection, Educational Identity, and Growth Timeline have no dedicated content renderer — their composers always return `not_implemented` this sprint, so `BlueprintSectionCard`'s own "Coming Soon" state is the entire correct rendering; adding a renderer for content that can never exist would be exactly the kind of invented UI this sprint's mission forbids.

---

## 3. State Flow

All interactive state (expand/collapse) is local `useState` inside `BlueprintSectionCard` — one boolean per card, no shared state, no client-side data fetching, no new API route. The entire Blueprint composition happens once, server-side, in the page component; the client only toggles visibility of already-rendered content. This matches ADR-0008 Part 6's rule directly: Composition happens once, everything downstream is a pure reshape.

---

## 4. Unavailable / Not-Implemented / Available Rendering

| `status` | Rendered | Content shown |
|---|---|---|
| `available` | The section's dedicated content renderer | Real composed data, or a plain "no data yet" sentence where a sub-field is empty (e.g., Academic Record with zero subjects: "No subject-level data yet.") — never fabricated |
| `unavailable` | Fixed `Unavailable.` block | `section.unavailableReason`, verbatim from the composer — the same string the engine already produces, never rewritten |
| `not_implemented` | Fixed `Coming Soon.` block | No further detail — matches mission's exact instruction, nothing more invented |

Verified directly against real composed output (§7): a Core-only learner (no legacy bridge) rendered Identity=Available, Attendance=Available, Academic Record/Compass/Career=Unavailable with their real reasons, Teacher Reflection/Educational Identity/Growth Timeline=Coming Soon, Parent Summary=Available (synthesized from Identity+Attendance).

---

## 5. Freshness Rendering

Every card shows a freshness badge (`Live`/`Snapshot`/`Historical`) sourced directly from `section.freshness` — the field added in this sprint's Correction 1. No card infers freshness from its own content; it only ever displays what the composer already classified. "Last Updated" uses `blueprint.metadata.generatedAt` (the whole-composition timestamp) for every section, since no section-level timestamp exists in the data beyond Academic Record's own `lastComputed` (not surfaced separately this sprint to avoid two different "last updated" meanings on one card) — documented here as a deliberate simplification, not an oversight.

---

## 6. Owner Rendering

Every card's header shows `Owner: <exact string>` verbatim from `section.owner` — the same traceability string Sprint 12G's composers already produce (e.g., `lib/projection/recompute.recomputeLearnerProjection`, `unassigned — no canonical Teacher Reflection domain exists yet...`). No owner string is shortened, paraphrased, or hidden — satisfies ADR-0008 Part 9's traceability requirement directly in the UI, not just in code comments.

**Forbidden-import check** (mission's explicit verification item): `grep -rn "academicClinic\|learnerIntelligence" components/blueprint/ app/student/blueprint/ lib/learnerBlueprint/*.ts` (excluding tests) returns only comments and the pre-existing, legitimate `repos.learnerIntelligence` **repository** (`lib/repositories/learner-intelligence.repository.ts` — a different, already-audited module from the forbidden `lib/learnerIntelligence/` **engine**, confirmed distinct in Sprint 12G's own documentation). Zero actual imports of either forbidden module.

---

## 7. Verification

- **`tsc --noEmit`**: clean, project-wide.
- **`eslint`**: clean on every touched/new file (`lib/learnerBlueprint/`, `lib/core/identity.ts`, `lib/core/academicBridge.ts`, `components/blueprint/`, `app/student/blueprint/`).
- **Regression tests**: `lib/learnerBlueprint/composeBlueprint.pure.test.ts` (17), `lib/learnerBlueprint/composeBlueprint.integration.test.ts` (3), `lib/core/academicBridge.test.ts` (9) — all re-run after the `freshness` field addition, all passing.
- **Real end-to-end rendering check**: attempted a full authenticated-browser click-through (Playwright against the running dev server) but the sandbox blocks the headless browser's own outbound network calls to Supabase's auth endpoint (`net::ERR_NETWORK_CHANGED` on `signInWithPassword`, reproduced twice, consistent) — Node-side fetch/the Supabase Admin SDK are unaffected by this restriction, confirmed by the same script's own setup phase succeeding. Rather than claim a browser verification that didn't actually complete, verification was done instead by: (1) creating real synthetic data (school, teacher-onboarded admin, Core learner, one attendance record) via the platform's own existing functions, (2) calling `composeBlueprint()` directly against that real data — confirmed `validation.valid: true`, Identity/Attendance/Parent Summary `available`, Academic Record/Compass/Career correctly `unavailable` with real reasons (no legacy bridge for this learner), Teacher Reflection/Educational Identity/Growth Timeline correctly `not_implemented` — and (3) rendering the actual `BlueprintView` component tree against that real composed object via `renderToStaticMarkup`, confirming the HTML contains the expected content (learner name, admission number, school/grade, guardian, the real unavailable-reason text, "Coming Soon" for the three placeholders, correct badges) with zero render exceptions. This is a genuine, real verification of the full composition-to-DOM path — the one gap is the literal authenticated-browser click, which is standard Next.js/Supabase SSR cookie plumbing already used identically by every other page in this app, not something this sprint introduced.
- **No duplicated calculations**: confirmed — every content renderer in `sections.tsx` only reads fields already present on its data type; none computes anything.
- **No `academicClinic`/`learnerIntelligence` imports**: confirmed, §6.

**A note on process, for the record**: mid-verification, an `npm install --no-save playwright` triggered a much larger dependency re-resolution (746 packages) than intended and briefly crashed the dev server. `package.json`/`package-lock.json` were confirmed untouched throughout (`git status` clean on both before and after), `tsc`/`eslint` were re-confirmed clean immediately after, and the Playwright package was removed from `node_modules` once the browser-verification path was abandoned in favor of the direct-render check. No lasting effect on the repository.

---

## 8. Constitutional Compliance

- **Article I / II**: every rendered claim traces to a real composer output; missing data renders as "Unavailable"/"Coming Soon"/"no data yet," never a blank or a zero.
- **Article XI**: Freshness and Owner are always shown together with Availability — no card presents a value without also showing what kind of value it is and where it came from.
- No AI call, no new scoring, no new evidence anywhere in this sprint's code — confirmed by the absence of any DeepSeek/AI import in `components/blueprint/` or the new page.

---

## 9. Migration Notes

- **`app/(student)/blueprint`** (URL `/blueprint`, old `lib/learnerIntelligence/` engine, flagged as a real migration target back in Sprint 12I's audit) is **untouched** by this sprint — it continues to exist, unrelated to the new `/student/blueprint/[learnerId]` route. Reconciling or retiring it remains an open decision for a future sprint, not silently resolved here.
- **Route path note**: the mission specified "Create only `/student/blueprint`." Since a Blueprint is always one specific learner's record (ADR-0005 §1), a bare `/student/blueprint` with no identifier cannot resolve to anything — implemented as `/student/blueprint/[learnerId]`, the smallest addition that makes the mission's path meaningful. `[learnerId]` names the **Core learner being viewed**, not the viewing role — this route is reached from Teacher Workspace (mission: "Teacher-first. No... learner personalization"), not a learner's own logged-in session. Flagged explicitly here rather than silently assumed, in case a different URL shape was intended.
- **Auth model**: gated by `requireSchoolStaff` (teacher or admin-tier, excludes parent) — the same reusable permission function Core already uses elsewhere, not a new access-control policy invented for Blueprint.
- **Per-section domain authorization still applies independently**: e.g., `composeAttendance` internally requires the actor to be a school admin (Sprint 11G's own existing scope) — a teacher viewing this page who isn't also an admin will correctly see Attendance render as `Unavailable` with the real permission-denied reason, rather than the page failing outright. This is the intended graceful-degradation behavior, not a bug to fix in this sprint.

---

## Stop Condition

Per explicit mission instruction: the Current Blueprint page renders successfully using the canonical Composition Engine. **Stop here.** No Snapshot viewer, PDF, Parent Portal, audience filtering, QR generation, Historical Blueprint, export, printing, or notifications begin. Wait for explicit approval before Sprint 12K — Blueprint Snapshots & Historical Viewer.
