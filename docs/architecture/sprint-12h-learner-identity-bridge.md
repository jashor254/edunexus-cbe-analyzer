# Sprint 12H — Canonical Learner Identity Bridge

**Status: implemented.** Infrastructure sprint, identity resolution only — no domain logic changed in Learning Compass, Career Intelligence, Projection, Evidence, Attendance, Report Cards, Academic Clinic, or Blueprint composition.

---

## 0. The single most important finding: a bridge already existed

The mission's own premise — "eliminate this architectural split... determine whether a canonical relationship already exists somewhere... do not assume, verify every dependency" — was correct to insist on an audit before designing anything, because **the audit found the premise itself was half wrong.** Sprint 12G's own grep for a linking column (`legacy_student_id`/`core_learner_id`) found nothing and concluded no bridge existed. That grep searched for the wrong names. A real linking mechanism (`external_id`, already provisioned on `students`/`teacher_classes`/`class_assessments`) and a real bridge module (`lib/core/academicBridge.ts`, built Sprint 9F/9G, already live in production) already existed, including a pure read-only resolver — `resolveLegacyStudentId(coreLearnerId)` — already used by three existing wrapper functions (`getBridgedLearnerTimeline`, `getBridgedCareerIntelligence`, `getBridgedCompassAccess`).

**Consequence**: Sprint 12G's `composeBlueprint.ts` had, unknowingly, built a second identity-handling path (`BlueprintIdentifiers.legacyStudentId: string | null`, supplied by the caller) instead of reusing the one that already existed. That is exactly the "duplicate bridge logic" this sprint's mission was commissioned to prevent — it had already happened, one sprint earlier, inside the very engine that first surfaced the gap. This sprint's real job turned out to be smaller and different than "build a bridge": **promote the existing resolver to its rightful canonical home, and fix Sprint 12G's Blueprint engine to use it instead of its own ad hoc parameter.**

---

## 1. Challenging the assumption a bridge is needed at all (per the mission's explicit instruction)

The mission asked, explicitly: if the audit shows the platform can converge on one identity without a permanent bridge, recommend that instead. The audit's answer: **convergence is the correct long-term direction and is already the platform's own stated plan** — `docs/architecture/learning-intelligence-migration-strategy.md` already scopes a full 14-phase migration (Phase 0 through Phase 13, "Delete Legacy Schema") to retire `students.id` entirely in favor of `learners.id`. That document already explicitly *rejects* a permanent bridging adapter as an acceptable end-state (§3) — `academicBridge.ts`'s own header quotes this rejection and labels itself "EXPLICITLY TEMPORARY," a scoped, user-approved exception, not a template.

**Why convergence cannot happen in this sprint**: the audit found ~30 tables with a foreign key into `students`, ~306 `studentId` references across eight service directories (`learnerModel`, `holiday`, `career`, `compass`, `projection`, `intelligence`, `academicClinic`, `adaptiveLearning`), 57 API routes keyed on `studentId`, and several studentId-keyed repositories with dozens of methods each. Migrating all of this to `learners.id` is precisely what the 14-phase strategy document already scopes as a multi-sprint, multi-phase project — gated behind its own Phase 0 (migrating real teacher/student data into Core), which has not started. Attempting any part of that migration here would necessarily mean changing Learning Compass, Career Intelligence, Projection, and Evidence logic — all explicitly forbidden by this sprint's own scope ("Identity only," "no domain logic changes"). Recommending convergence *now* would violate the sprint's own constraints; recommending it as the eventual target (which the platform has already decided) while keeping the existing temporary bridge as the correct interim state is the only self-consistent answer.

**Recommendation, stated plainly**: do not build new bridge infrastructure. Do not attempt convergence this sprint. Use the existing, already-approved, already-scoped-for-retirement bridge — correctly, from exactly one place — until `learning-intelligence-migration-strategy.md`'s Phase 11 makes it unnecessary.

---

## 2. Audit Summary

Full detail from the dispatched audit (file:line citations, exact counts) is preserved in this sprint's session; key facts:

| Question | Finding |
|---|---|
| Where is `learners.id` authoritative? | 6 genuine FKs (`learner_enrollments`, `learner_guardians`, `learner_promotions`, `learner_transfers`, `school_report_cards`, `term_subject_summaries`) + 12 frozen EILS/EIR tables (dead code, not counted toward live scope) |
| Where is `students.id` authoritative? | ~27 tables with a `student_id` column, plus 3 tables (`learner_evidence`, `learner_projections`, `evidence_projection_events`) whose column is misleadingly named `learner_id` but FKs to `students` — ~30 total, this is where real production Evidence/Projection/Career/Compass/Holiday-Planner data lives |
| Repositories/services keyed to `students.id` | `career.repository.ts`, `compass.repository.ts` (straddles both), `learner-model.repository.ts`, `learner-intelligence.repository.ts`, `assessment.repository.ts`; ~306 `studentId` references across `lib/learnerModel`, `lib/holiday`, `lib/career`, `lib/compass`, `lib/projection`, `lib/intelligence`, `lib/academicClinic`, `lib/adaptiveLearning` |
| API routes | 57 routes reference `studentId`; 8 reference `learnerId` |
| Existing mapping | **Yes** — `external_id` column (already provisioned, not new) + `lib/core/academicBridge.ts`'s `resolveLegacyStudentId`/`ensureBridgedLearner`/`ensureBridgedClass` (Sprint 9F/9G, already live) |
| Duplicate identity utilities | Sprint 12G's `BlueprintIdentifiers.legacyStudentId` caller-supplied parameter — the one duplication this sprint fixes |
| Convergence scale | Already scoped as a named 14-phase project (`learning-intelligence-migration-strategy.md`), gated behind an unstarted Phase 0 — hundreds of files, not this sprint |

---

## 3. Design Decision

**Promote, don't invent.** `resolveLegacyStudentId(coreLearnerId: string): Promise<string | null>` moved from `lib/core/academicBridge.ts` into `lib/core/identity.ts` — the module whose own existing header already declares itself "meant to be the only place [identity resolution] happens going forward." `academicBridge.ts` now imports it back (`export { resolveLegacyStudentId } from '@/lib/core/identity'`), so its three existing wrapper functions (`getBridgedLearnerTimeline`, `getBridgedCareerIntelligence`, `getBridgedCompassAccess`) need zero changes — same function, same behavior, new canonical home, single source of truth.

No new table. No new column. No new synchronizer. No copied learner data. The existing `external_id` mechanism and its existing lazy-creation path (`ensureBridgedLearner`, unchanged, still lives only in `academicBridge.ts`, still only called by the write-side flows that already called it) remain exactly as they were — this sprint touches only the **read** side, and only its location, not its logic.

**Blueprint stays a pure consumer.** `lib/learnerBlueprint/composeBlueprint.ts` now calls `resolveLegacyStudentId(ids.coreLearnerId)` itself, once, at the top of composition — never `ensureBridgedLearner` (which creates a legacy shadow row). Blueprint composing a report must never have the side effect of creating identity state; that would make it an identity resolver, which the mission explicitly forbids. `BlueprintIdentifiers` no longer accepts a caller-supplied `legacyStudentId` at all — the defensive `legacyStudentId ?? null` pattern the mission named is gone because the field itself is gone; every consumer of `composeBlueprint()` now supplies only the Core identity, exactly as the mission's target diagram (`identity → resolver → all domains`) specified.

---

## 4. Identity Flow (before / after)

```
BEFORE (Sprint 12G)                          AFTER (Sprint 12H)

caller                                       caller
  |                                            |
  | must already know legacyStudentId          | supplies only coreLearnerId
  | (or pass null)                             |
  v                                            v
composeBlueprint({ coreLearnerId,            composeBlueprint({ coreLearnerId,
  legacyStudentId })                            actorUserId, schoolId })
  |                                            |
  | passes legacyStudentId straight            | calls lib/core/identity.ts::
  | through to sub-composers                   |   resolveLegacyStudentId(coreLearnerId)
  |                                            |     -> looks up students.external_id
  v                                            v
composeAcademicRecord(legacyStudentId)       legacyStudentId (string | null)
composeLearningCompass(legacyStudentId)        |
composeCareer(legacyStudentId)                 v
                                              composeAcademicRecord(legacyStudentId)
No other domain shared this lookup —        composeLearningCompass(legacyStudentId)
academicBridge.ts had its own separate      composeCareer(legacyStudentId)
copy of the same logic.
                                              Same lookup lib/core/academicBridge.ts's
                                              own getBridgedLearnerTimeline/
                                              getBridgedCareerIntelligence/
                                              getBridgedCompassAccess now call too —
                                              one function, every consumer.
```

---

## 5. Why the Chosen Bridge Is Canonical

1. **It already existed and was already load-bearing** — three production wrapper functions depended on it before this sprint touched anything. Building a parallel mechanism (a new table, a new column) would have created a second source of truth for the exact fact ("does this Core learner have a legacy identity") this resolver already answers correctly.
2. **It uses already-provisioned schema** (`external_id`), not a new concept — satisfies "do not invent unnecessary infrastructure" directly.
3. **It is read-only and side-effect-free** — the promoted function never creates a bridge, only looks one up; the write-side (`ensureBridgedLearner`) stays exactly where it was, called only by the flows that legitimately need to guarantee a legacy identity exists (assessment recording), never by a read-only report composer.
4. **Its new home matches the codebase's own stated intent** — `lib/core/identity.ts`'s header already declared itself the canonical identity-resolution module before this sprint; this is a promotion into an already-designated destination, not a new architectural layer.
5. **It has an already-documented retirement path** (§6) — a bridge invented fresh for this sprint would need that path designed from scratch; this one already had it.

---

## 6. Rejected Alternatives

- **New bridge table** (`learner_identity_bridge(core_learner_id, legacy_student_id)`) — rejected. Would duplicate what `students.external_id` already does, and the mission explicitly says "do not create another learner table."
- **New column on `learners`** (`legacy_student_id`) — rejected. Would create a second linking mechanism alongside the existing `external_id` on `students`, doubling maintenance for zero new capability, and pointing the wrong direction relative to the platform's own stated retirement plan (see §6).
- **Full convergence this sprint** (retire `students.id`, repoint every table/repo/route to `learners.id`) — rejected, not because it's the wrong end-state (it is the *correct* one, per §1) but because it is out of this sprint's scope by the mission's own explicit rules, already scoped elsewhere as a 14-phase project, and gated behind prerequisites (Phase 0) that haven't started.
- **A brand-new `resolveLearnerIdentity()` wrapper function that just calls `resolveLegacyStudentId()` internally** — considered, rejected as unnecessary indirection. The mission's own example name was illustrative, not a requirement; adding a wrapper around an already-correctly-named, already-tested function would itself be the "unnecessary infrastructure" the mission warns against. The promoted `resolveLegacyStudentId` *is* the one canonical resolver.

---

## 7. Future Retirement Path for Legacy Student Identity

Unchanged from, and explicitly deferred to, `docs/architecture/learning-intelligence-migration-strategy.md`'s existing 14-phase plan:
- **Phase 0** (not started): migrate real teacher/student data into Core. Prerequisite to everything else.
- **Phase 5**: port Learner Model onto Core identity.
- **Phase 11**: port Compass onto a Core-native `LearnerContext` — the document itself notes this is gated behind a Phase 2 "identity-reconciliation design" that doesn't yet exist, and flags a live landmine worth carrying forward: `compass_sessions.learner_id` is neither `students.id` nor `learners.id` — it's `auth.uid()` directly, with no FK at all. Any future identity-convergence sprint must resolve this separately; it is out of this sprint's scope to touch (Compass logic is explicitly forbidden here).
- **Phase 13**: delete the legacy schema entirely — at which point `lib/core/academicBridge.ts` and the promoted `resolveLegacyStudentId` both become dead code and should be deleted, not repurposed. `academicBridge.ts`'s own header already says this; this sprint changes nothing about that plan, only where the read-only half of it lives.

This sprint does not accelerate or start any of these phases. It makes the interim state (two identity spaces, one resolver) internally consistent instead of silently duplicated, nothing more.

---

## 8. Constitutional / RAS / ADR Compliance

- **First Constitutional Law** (one canonical identity per real-world entity) — not violated by keeping two *tables*, because there remains exactly **one canonical resolution path** between them after this sprint (there were, before this sprint, two: Sprint 12G's caller-supplied parameter and `academicBridge.ts`'s internal lookup). The law is about resolution paths converging to one answer, which now holds.
- **ADR-0002** (Teacher identity) — untouched; this sprint's scope is Learner identity only, and `academicBridge.ts`'s own header already confirms it adds no second Teacher identity.
- **ADR-0005 §2.1/§3** — Identity remains Core-owned; this sprint does not change Identity's owner, only how Blueprint reaches the legacy space for the *other* sections that need it.
- **ADR-0006/ADR-0008** — no educational-experience or lifecycle rule touched; this is purely an identity-plumbing change beneath the composition engine ADR-0008 already specified.
- **Repository Architecture Standard / RAS §10.7-10.8** — no new duplicated business logic, no new cross-domain ownership; if anything, this sprint *removes* a duplication (Sprint 12G's second lookup).
- **Learner Record Layer Decision 3** — not overturned. This sprint does not resolve the deferred convergence decision; it only ensures the *interim* state (which Decision 3 already sanctions) is implemented once, not twice.

---

## 9. Verification

- `tsc --noEmit`: clean, project-wide (not just `lib/learnerBlueprint/` — confirmed by running without a path filter).
- `eslint`: clean on `lib/learnerBlueprint/`, `lib/core/academicBridge.ts`, `lib/core/identity.ts`.
- Regression: `lib/core/academicBridge.test.ts` (pre-existing, covers `ensureBridgedClass`/`ensureBridgedLearner`/`resolveLegacyStudentId` and the three `getBridged*` wrappers) re-run unchanged — proves the promotion didn't alter behavior for any existing caller.
- New/updated Blueprint integration tests (`lib/learnerBlueprint/composeBlueprint.integration.test.ts`): the two Sprint 12G tests updated to the new `BlueprintIdentifiers` shape (no caller-supplied `legacyStudentId`); **one new test** using `academicBridge.ts`'s own `ensureBridgedClass`/`ensureBridgedLearner` to create a real bridge, then proving `composeBlueprint()` — via its internal call to the promoted resolver — correctly transitions Academic Record/Learning Compass/Career from `unavailable` (no bridge) to `available` (bridge resolved, real domain calls attempted). This directly closes the "known test-coverage limitation" Sprint 12G's own documentation flagged honestly at the time.
- No duplicated identity utilities remain — confirmed by grep: exactly one definition of `resolveLegacyStudentId` exists (`lib/core/identity.ts`), `academicBridge.ts` re-exports rather than redefines.

---

## Stop Condition

Per explicit mission instruction: the canonical identity bridge (promoted, not newly built), the fix to Blueprint's identity handling, verification, and this document are the complete deliverable. **Stop here.** No Blueprint UI, PDF, Parent Portal, QR generation, Educational Identity, or Learning Compass/Career Intelligence enhancement begins. Wait for explicit approval before Sprint 12I — Learner Blueprint Presentation Layer.
