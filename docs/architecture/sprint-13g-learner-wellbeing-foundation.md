# Sprint 13G — Learner Wellbeing Foundation (Canonical Domain Implementation)

Implements ADR-0017 (Approved). Guardian Mode remained active throughout. This sprint's own mission text is unusually explicit that "the objective is not to build counselling software" — every implementation choice below stays inside that boundary and cites the ADR phase it executes.

---

## Phase 1 — Mandatory Architecture Audit

Re-swept the repository for `wellbeing`, `counseling`, `counselling`, `wellness`, `welfare`, `support`, `pastoral`, `safeguarding`, `student support`, `concern`, `case management`, and re-confirmed via `find`/`grep` across the whole tree (excluding `node_modules`/`.next`/`.claude`) that:

- No Wellbeing implementation existed anywhere except the Sprint 13F architecture documents themselves.
- No duplicate repository, service, counselling module, confidential-notes system, or hidden wellbeing table existed.
- No Blueprint dependency, Parent Experience dependency, or Behaviour dependency existed (confirmed both by grep and, after implementation, by the dedicated `wellbeingBoundary.architecture.test.ts` suite — see Phase 7/8/9 below).

Nothing shipped between Sprint 13F and this sprint changed the plan.

---

## Phase 2 — Canonical Schema

`supabase/migrations/20260721090000_learner_wellbeing.sql` — additive only, applied to the live project after explicit user approval. **Three tables, not the two the mission suggested as an example** — a deliberate, justified departure: ADR-0017 Phase 3 names "Support Team" as its own owned concept, and the mission's own Phase 6 mandates a Support-Team-scoped security model, which requires a real membership table (`wellbeing_support_team`) beyond `learner_wellbeing_cases`/`learner_wellbeing_updates`. This is a necessary consequence of implementing Phase 6 correctly, not a speculative extra — documented explicitly rather than silently added.

- `learner_wellbeing_cases` — the lifecycle-bearing entity: `case_type` (the two-tier `check_in`/`support_plan` model), `concern_summary`, `status` (8 values), `escalation_status` (3 values, independent field), phase-owned facts (`support_goal`, `support_outcome`, `no_action_reason`, `withdrawn_reason`), `default_visibility_classification` (the case-level default tier), and attribution fields. **No diagnosis field, no score field, no risk field exists anywhere in this table.**
- `wellbeing_support_team` — the actual access-control unit (see Phase 6).
- `learner_wellbeing_updates` — one append-only stream combining both the lifecycle-transition audit trail (every sibling domain's `*_history` discipline) and the qualitative content (Support Review, Support Conversation, External Referral, Confidential Notes), each row carrying its own optional `visibility_classification` override.

Every field has exactly one owner (this domain); every FK points at a canonical table (`learners`, `schools`, `school_users`); no ownership is duplicated from any sibling domain.

---

## Phase 3 — Lifecycle

Implemented exactly ADR-0017 Phase 5's frozen states — no more, no fewer:

- Main line: `concern_raised → initial_assessment → support_plan_active → review → outcome_recorded → closed`.
- Terminal branches: `no_action_needed` (from `initial_assessment`), `withdrawn` (from `support_plan_active` or `review`).
- **No `verification` state. No `published` state.** `outcome_recorded → closed` is a direct transition — verified explicitly in the integration test suite by asserting the closed case object has no `verifiedBy`/`publishedAt` field at all, and that `WellbeingRepository` has no `publish()` method.
- `escalation_status` is implemented as an independent column, changeable via its own `setEscalation()` method at any non-terminal status — never a lifecycle state, exactly as ADR-0017 Phase 5 froze it. Verified: escalating a case never changes its main `status`.

---

## Phase 4 — Repository

`lib/repositories/wellbeing.repository.ts` — `WellbeingRepository`, registered as `repos.wellbeing`.

- One named method per lifecycle transition (`beginAssessment`, `markNoActionNeeded`, `activateSupportPlan`, `reviewCase`, `withdrawCase`, `recordOutcome`, `closeCase`, `setEscalation`).
- No generic `update()`/`delete()`/`mutate()` — proven by a reflection-based test (Phase 11).
- Repository owns persistence only — no permission check, no visibility-tightening validation, no support-team gating logic lives here; every method comment says so explicitly, and `listForLearner`/`listUpdates` return unfiltered rows with an explicit comment that the caller (service layer) is responsible for gating.

---

## Phase 5 — Domain Service

`lib/learnerWellbeing/{types,validation,wellbeing}.ts`. The service owns lifecycle validation, transition rules, ownership enforcement, and field validation — no AI, no diagnosis, no scoring, no emotional inference, no behaviour logic, no attendance logic anywhere in this module (grep-verified in `wellbeingBoundary.architecture.test.ts`, Phase 7 below).

`validation.ts`'s own header explicitly documents the same honest limitation Teacher Reflection's validation already states (ADR-0006 §6): whether a concern summary is written in appropriately factual, non-diagnostic language is human editorial judgment, never something automated validation can verify without an AI content-classification step — which ADR-0017 Phase 9 forbids outright.

---

## Phase 6 — Security

**This is the one canonical domain in the entire series whose access control is not `requireSchoolStaff`.** `lib/learnerWellbeing/wellbeing.ts` defines its own, stricter gate: `requireSupportTeamMembership(client, schoolId, caseId)`, layered *on top of* ordinary school membership — a caller must first be a legitimate school staff member, and second, be a named row in `wellbeing_support_team` for that specific case. `requireSchoolStaff` is used only for the one action that cannot yet have a Support Team (`raiseConcern` — the raiser is automatically added to the new case's team as `core_team`, since they must be able to see the case they just created).

Verified, not assumed:
- **Teacher cannot read confidential cases unless explicitly allowed** — proven twice: once at the application layer (`findCaseById` throws) and once at the raw DB layer (a direct Supabase `.select()` as the non-team teacher returns zero rows under RLS, independent of the service layer entirely).
- **Parent cannot read** — an account with no `school_users` row at all is denied at the very first gate (`requireSchoolMembership`), before any Support-Team check is even reached.
- **Learner cannot read** — same denial path as Parent.
- **Blueprint cannot read** — see Phase 7.

The two-tier visibility model (`core_team`/`school_leadership`) is enforced twice: at the DB level (RLS policy on `learner_wellbeing_updates` checks the caller's own team role against each row's effective classification) and at the service level (`listUpdates()` filters again, since the repository itself performs no access control per Phase 4's discipline). Both layers were exercised in the integration suite, not just one.

---

## Phase 7 — Blueprint Boundary Verification

`lib/learnerWellbeing/wellbeingBoundary.architecture.test.ts` proves, by walking the real source tree:

- No file under `lib/learnerBlueprint/` imports or references Wellbeing in any form.
- `composeBlueprint.ts`'s own import list contains no `wellbeing` entry.
- `LearnerBlueprint`'s own type shape (`lib/learnerBlueprint/types.ts`) has no wellbeing-shaped field.
- No file under `lib/learnerBlueprint/` contains the strings "Wellbeing Status", "Support Needed", or "Risk Level", in any casing.

The integration suite adds a live-data proof on top of the static one: `composeBlueprint()` is called before and after a learner gains an active Wellbeing case, and the full section-by-section output (every status, every shape) is asserted identical — not merely "no error," but byte-for-byte the same Blueprint.

---

## Phase 8 — Parent Boundary Verification

The same architecture test proves no file under `lib/parentExperience/` imports or references Wellbeing in any form. No code was added to Parent Portal, Parent Experience, Parent Actions, Notifications, or Parent Summary — confirmed zero reads, and none were added, per the mission's explicit "do not add any" instruction.

---

## Phase 9 — Behaviour Boundary Verification

A dedicated test asserts that no `lib/learnerBehaviour`, `lib/behaviour`, or `lib/discipline` directory exists in the codebase at all — Wellbeing has nothing to accidentally couple to, verified rather than assumed, exactly as ADR-0017 Phase 7 anticipated for a domain that doesn't exist yet. A second test asserts `lib/learnerWellbeing/` itself imports nothing from Blueprint, Parent Experience, Teacher Reflection, Portfolio, Achievement, Projects, Competitions, or Leadership — the domain is, by design, the most import-sparse in this entire series.

---

## Phase 10 — Immutability

All three layers, mirroring the proven pattern from Portfolio/Projects/Competitions/Leadership/Community Service exactly:

1. **Repository** — no generic update/delete exists to bypass a check by accident.
2. **Service** — every transition function checks `existing.status` before writing.
3. **Database trigger** — `enforce_wellbeing_case_immutability()`: `closed`/`no_action_needed`/`withdrawn` are all fully immutable (there is no further legal transition past any of them — no `published` state to carve out a narrow exception the way every sibling domain's trigger does, since Closed is genuinely the end). DELETE is legal only while `status = 'concern_raised'`.

**Proven with tests against the raw DB, bypassing the service entirely, using the service-role client itself** (`db = createServiceClient()`) — the mission's explicit "even under service-role" requirement. A raw `UPDATE`/`DELETE` against a closed case, and a raw `UPDATE`/`DELETE` against any `learner_wellbeing_updates` row (append-only, unconditionally, even on a still-open case), are both asserted to fail with the trigger's own exception message.

---

## Phase 11 — Integration Tests

`lib/learnerWellbeing/wellbeing.integration.test.ts` — 10 tests against real synthetic Supabase data, all passing:

1. Full lifecycle (all six main-line states), asserting no `verifiedBy`/`publishedAt` field exists, full ordered update stream, DB-level immutability on both the case and its updates, even under service-role.
2. No Action Needed terminal branch — reachable only from Initial Assessment.
3. Withdrawn terminal branch — reachable only from Support Plan Active/Review.
4. Escalation Status independence — set at multiple points, never changes the main lifecycle status, blocked once terminal.
5. Support-Team-scoped access — a real, active teacher at the same school is denied both at the service layer and via a raw RLS-gated DB read; access is proven to begin only once explicitly granted by a `core_team` member, and only a `core_team` member may grant or revoke it.
6. Visibility-tier filtering — a `school_leadership`-role member never sees `core_team`-classified content; the "tighten only" override rule is proven to reject a loosening attempt.
7. Parent/learner denial — an account with no school membership at all is denied at the first gate.
8. Cross-school isolation.
9. Repository behaviour — reflection-based proof of no generic mutators and no `publish()` method.
10. **Blueprint regression** (mission's explicit Phase 7 requirement, proven with live data, not just statically) — `composeBlueprint()` output is identical before and after a Wellbeing case exists for the same learner.

All 10 tests pass, plus the 7 static boundary tests (Phase 7/8/9) — 17 new tests total. The full existing `lib/**/*.pure.test.ts` suite (34 tests) and the Sprint 12AB architecture test (4 tests) were re-run and pass unaffected — **no Blueprint test fixture needed any change this sprint**, since (unlike every prior domain sprint) `LearnerBlueprint`'s type was never touched.

---

## Phase 12 — Constitutional Verification

- **Article I (Evidence remains the only truth)**: every field in `learner_wellbeing_cases`/`learner_wellbeing_updates` is a recorded human observation or decision — no computed, inferred, or AI-generated value exists anywhere in the schema.
- **Article II (Missing evidence never implies poor wellbeing)**: this domain has no summary, aggregate, or Blueprint presence at all (Phase 7) — there is no surface anywhere that could misread an absent case as a signal, satisfying this article by architectural omission rather than a runtime check.
- **Article VI (AI invents nothing)**: zero AI calls, zero AI imports, anywhere in `lib/learnerWellbeing/` — verified by the same import-boundary test that checks for Blueprint/Parent Experience coupling.
- **Article VIII (Human ownership remains mandatory)**: every lifecycle transition requires an authenticated, support-team-verified human actor; `raised_by`/`assessed_by`/`escalated_by`/`actor_school_user_id` are populated on every write, never left to a system-inferred default.
- **RAS**: single ownership (Phase 2 schema), no second calculation (this domain computes nothing), no hidden intelligence (Phase 5/9), no duplicated ownership with ADR-0011 through ADR-0016 (verified — no sibling domain's table, repository, or service was touched).

---

## Verification Checklist

- [x] Canonical ownership — one repository, one service, three tables, every field owned once
- [x] One lifecycle — six main states, two terminal branches, no Verification, no Published
- [x] Immutable closed records — proven at the DB layer, under service-role
- [x] Support-team security — proven at both the service and RLS layers
- [x] Zero AI — grep-verified
- [x] Zero Blueprint reads — grep-verified statically and proven with live data
- [x] Zero Parent reads — grep-verified
- [x] Zero Behaviour coupling — verified that no Behaviour module even exists
- [x] RLS enforced — proven with a raw, non-team-member read returning zero rows
- [x] DB trigger enforced — proven against raw UPDATE/DELETE, even under service-role
- [x] Constitution compliant (Phase 12)
- [x] RAS compliant (Phase 12)
- [x] `tsc --noEmit` clean
- [x] ESLint clean (0 errors on all new/changed files)
- [x] All new tests passing (17/17: 10 integration + 7 boundary)
- [x] Full regression suite passing (34 pure tests + 4 architecture tests, unaffected)

---

## Known Gaps, Named Rather Than Hidden

- The `default_visibility_classification`/per-update override model implements ADR-0017 Phase 8's two named tiers (`core_team`, `school_leadership`) exactly; the three tiers ADR-0017 also named as reserved/future (Parent, Learner, future Counsellor) have no implementation and no table column — deliberately, per ADR-0017 Phase 8's own "reserved, not decided here."
- No UI, no counselling workflow, no notification, no email/SMS, no AI summary, no dashboard — all explicitly forbidden by the Stop Condition, none built.
- `wellbeing_support_team` membership removal (`removeSupportTeamMember`) is a real DELETE (not append-only) — a deliberate, narrow exception: team membership is current-authorization state, not part of the confidential case record itself, so it does not need the same append-only discipline as `learner_wellbeing_updates`. Named explicitly here so a future reviewer does not mistake this for an oversight.

**Sprint 13G is complete. Per the STOP CONDITION, Sprint 13H was not started — no UI, no Blueprint/Parent Experience/Report Cards/Attendance/Career Intelligence/Learning Compass exposure of any kind was built.**
