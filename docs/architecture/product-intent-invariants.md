# Product Intent Invariants — the Executable Product Constitution

**Phase**: H3A. **Depends on**: Harness Foundation v1 (H1), H2A–H2E's intelligence-layer assurance. **Purpose**: this document is not a new design — it is the record of product decisions EduNexus already made, now pointed at the executable proof that keeps them true. A change can be technically correct and still move EduNexus toward the wrong product; this register is what catches that.

Format per invariant: ID, statement, why it matters, canonical owner, proof, status.

---

## PROD-SCH-001 — School owns institutional membership

**Statement**: Institutional membership (`school_users` rows) can only be created through an authorized school-controlled administrative path — never by a teacher self-declaring, self-typing a school name, or any other unauthorized route.

**Why it matters**: institutional membership is the root of school-covered access, class assignment authority, and administrative visibility into learner data. A self-provisioning path is a direct entitlement/privacy bypass, not a cosmetic bug.

**Canonical owner**: school admin invitation flow (`app/api/school/...` invite/accept routes) and the DB-level RLS/grant hardening from `20260812190000_close_self_declared_admin_escalation.sql`.

**Proof (EXISTING)**:
- `lib/testing/teacherSelfJoin.http.integration.test.ts` tests 1, 2, 12, 14a, 14b — ordinary teacher cannot self-join by typing a school name (exact or case/whitespace-varied), profile submission creates no `school_users` row, a self-typed name grants no covered access.
- `lib/testing/schoolHandoff.http.integration.test.ts` tests 1–9b — only an existing school admin can invite; an ordinary user/anon/wrong-school admin cannot; an invitee cannot alter the role/school they were invited with; a user cannot accept a membership never extended to them.
- `lib/core/schoolEntitlement.test.ts` tests 22, 22b, 24 — a teacher cannot self-activate their own school's entitlement, cannot create a school pre-set to entitled, and neither can an ordinary authenticated user or anon.

**Status**: EXISTING — NO NEW TEST.

---

## PROD-SCH-002 — School owns classes and teaching assignments; a class survives teacher replacement

**Statement**: A class belongs to the school, not to the teacher currently assigned to it. Teacher departure, transfer, or replacement must never delete, orphan, or silently reassign class/learner identity.

**Why it matters**: this is the structural difference between "a teacher's private gradebook" and "a school's institutional record" — the exact product positioning EduNexus depends on for multi-teacher schools and continuity across staff turnover.

**Canonical owner**: `class_students`/`teacher_class_assignments`-style current-vs-historical assignment model (`lib/core/teacherLifecycle.ts` and its repository layer).

**Proof (EXISTING)**:
- `lib/core/teacherLifecycle.test.ts` tests 3+4, 5, 8, 9+10, 11+12, 13, 14, "Peter transfers to School B" — deactivating a teacher closes their current assignment but leaves it historically intact; the school's entitlement, the class, and the learners are completely unchanged; a replacement teacher inherits the vacant post without touching the departed teacher's historical row; exactly one CURRENT teacher exists per class+subject, enforced at the DB level (test 23).
- `app/api/teacher/classes/institutionOwnershipEnforcement.http.integration.test.ts` — class creation stamps the real school, a second class from the same teacher reuses the resolved school, and historical school-less classes are repaired consistently rather than silently left inconsistent.

**Status**: EXISTING — NO NEW TEST.

---

## PROD-TCH-001 — Account existence does not imply institutional membership

**Statement**: A valid EduNexus teacher account, on its own, confers no institutional context, no school-covered access, and no administrative authority. Institutional context only exists once an authorized school admin establishes it.

**Why it matters**: conflating "has an account" with "belongs to a school" would let any registered teacher claim resources (tokens, class-creation authority, learner visibility) that should require an actual school relationship.

**Canonical owner**: `lib/core/schoolEntitlement.ts` (coverage resolution), `lib/testing/teacherSelfJoin.http.integration.test.ts`'s own fixture design.

**Proof (EXISTING)**:
- `lib/core/schoolEntitlement.test.ts` test 4 — "a Solo Teacher is never school-covered, leaving the personal paths reachable"; test 158–166.
- `lib/testing/teacherSelfJoin.http.integration.test.ts` test 5 — "a Solo Teacher completes their profile with no membership and no school."

**Status**: EXISTING — NO NEW TEST.

---

## PROD-TCH-002 — No teacher-facing action may silently create or activate a school membership

**Statement**: Regression form of PROD-SCH-001/TCH-001, stated as a standing guard: no future teacher-facing route/action (profile edit, invite acceptance, class creation, etc.) may reintroduce an auto-provisioning path (`ensureSchoolMembership()`-style name-matching, invite-side auto-activation, or similar).

**Why it matters**: this exact class of bug (self-declared admin escalation) was found and closed once already (`20260812190000_close_self_declared_admin_escalation.sql`) — the regression risk is real, not hypothetical, and the fix's durability depends on tests that would catch a reintroduction, not just a point-in-time patch.

**Canonical owner**: same as PROD-SCH-001.

**Proof (EXISTING)**:
- `lib/testing/teacherSelfJoin.http.integration.test.ts` tests 3, 4, 8, 10 — a departed teacher cannot re-attach via profile edit; a teacher cannot attach to a different school via profile edit; a teacher cannot choose their own institutional role; an existing active membership survives a profile edit untouched (proving the edit path cannot mutate membership at all, not just that it currently doesn't).

**Status**: EXISTING — NO NEW TEST.

**Regression this catches**: a developer adding a "quick-join your school" convenience feature to the profile-edit form, or an invite-acceptance handler that activates membership before the invited party confirms.

---

## PROD-LRN-001 / PROD-LRN-002 — Learner continuity through organizational change

**Statement**: School ownership changes who *administers* the learner, never whether the learner retains continuous intelligence history. Teacher departure, class reassignment, and annual grade progression must not erase or fragment `learner_evidence`, `learner_projections`, or year-over-year subject history.

**Why it matters**: EduNexus's core value proposition is a continuous intelligence record of a learner across time — school-first administration was a *governance* model change (H2D/ADR-0029 era), never intended to make the learner's own history subordinate to whichever organizational structure currently manages them.

**Canonical owner**: `lib/core/yearProgression.ts`, `lib/core/teacherLifecycle.ts`.

**Proof (EXISTING)**:
- `lib/core/yearProgression.test.ts` — "learner identity is unchanged by promotion — same `learners.id`, same bridged `students.id`"; "Term 1/2/3 Mathematics history for Jane remains distinct and unchanged after promotion"; repeater and stream-change scenarios preserve prior-year history while creating a genuinely new current placement, never overwriting the old one.
- `lib/core/teacherLifecycle.test.ts` tests 9+10, 20+21 — "learners and the class itself are unchanged" by staff departure; "the whole lifecycle created no payment records and changed no learner data."

**Status**: EXISTING — NO NEW TEST.

---

## PROD-EVD-001 — Evidence-first: sparse evidence is not the same as no evidence

**Statement**: If at least one admissible educational signal exists anywhere in a learner's canonical record, learner-intelligence surfaces may express low confidence or a provisional interpretation, but must not claim there is no evidence, and must not silently produce an empty/absent report when partial evidence exists.

**Why it matters**: collapsing "sparse" to "nothing" throws away real signal a teacher or parent could act on, and is the single easiest way for a well-intentioned defensive-coding change ("just return null if data looks incomplete") to quietly break the platform's evidence-first promise.

**Canonical owner**: distributed by surface — `lib/learnerBlueprint/composeAcademicRecord.ts` (Blueprint), `lib/career/capabilityExtractor.ts` (capability math), `lib/compass/prompt.ts` (Compass, H2E), `lib/career/careerIntelligenceEngine.ts` (Career Intelligence Report, this phase).

**Proof**:
- Blueprint: **EXISTING** — H2B's `BLP-EVD-001` finding, proven at `lib/learnerBlueprint/composeBlueprint.integration.test.ts:243-244` and `classBlueprintPure.test.ts`.
- capabilityExtractor: **EXISTING** — H2A/H2B's `CAP-003`, `lib/career/capabilityExtractor.test.ts`.
- Compass: **EXISTING** — H2E's `AI-CMP-002`, `lib/compass/aiGroundingContract.integration.test.ts` (a no-evidence learner gets an explicit provisional caveat in the AI prompt, never a bare confident-looking level).
- Career Intelligence Report: **was ABSENT (zero test coverage for `buildCareerIntelligenceReport()` existed before this phase) — now EXISTING.** New file `lib/career/careerIntelligenceEvidenceFirst.integration.test.ts` proves: a learner with zero signal in either of the function's two backbones (legacy Clinic/`assessments` and canonical Projection/`learner_evidence`) still returns a real, structured, non-crashing report; sparse evidence in *either one* backbone alone still populates real strengths/challenges, never collapsing to an "insufficient data" empty state.

**Status**: PARTIAL → EXISTING (this phase closes the one real gap).

---

## PROD-BILL-001 / PROD-BILL-002 / PROD-BILL-003 — School coverage is institutional, not personal

**Statement**:
- BILL-001: an active teacher covered by an active school entitlement uses covered features (e.g. SOW generation) without personal token deduction.
- BILL-002: school entitlement applies strictly through institutional membership — it does not convert every teacher account into school-covered access.
- BILL-003: a parent/teacher role overlap does not grant school coverage in the absence of an active school membership.

**Why it matters**: this is the commercial boundary the entire school-covered pricing model depends on; a leak in either direction (a covered teacher charged personally, or an uncovered account receiving covered access) is a direct billing-integrity defect.

**Canonical owner**: `lib/core/schoolEntitlement.ts`.

**Proof (EXISTING, exceptionally thorough)**:
- `lib/core/schoolEntitlement.test.ts` — 27+ scenarios: active membership + active/expired/suspended/absent entitlement (tests 5–8); inactive membership + active entitlement is NOT covered (test 9); a parent membership at an entitled school does not confer teacher coverage (test 9b, = BILL-003); departure removes coverage without touching identity/history/school/colleagues (tests 10–14); replacement inherits entitlement with no payment (tests 15–17); transfer: coverage follows the school, never the teacher (tests 18–21); expiry evaluated at read time, never cached (line 327).
- `lib/testing/sowGenerateContract.http.integration.test.ts` test 6 — "a school-covered teacher generates lessons and is charged nothing," the exact canonical-feature proof the brief named.
- `lib/testing/teacherSelfJoin.http.integration.test.ts` test 14a/14b (BILL-002 negative/positive pair), test 11 (BILL-003: "a teacher who is also a parent keeps their parent context intact").

**Status**: EXISTING — NO NEW TEST.

---

## PROD-HUM-001 — AI-generated learner-impacting output remains advisory until a designated review boundary is crossed

**Statement**: Where architecture marks an AI-generated output as requiring review, that output cannot become authoritative/deliverable solely because generation succeeded — an explicit human (or system-designated) confirmation step is required.

**Why it matters**: this is the boundary that keeps AI as an assistive layer rather than a second, unreviewed source of learner truth (H2E's central question) — and it is a real, already-built product decision across multiple surfaces, not a hypothetical to design now.

**Canonical owner**: `lib/compass/evidence.ts` (Compass mastery claims), `lib/assignments/variantGeneration.ts` (adaptive assignment drafts), Holiday Planner's publish gate.

**Proof (EXISTING)**:
- `lib/compass/compassEvidenceLoop.integration.test.ts` — Compass's self-reported mastery claims are always tier-1, confidence-capped at 60, forced `pending_review`, and explicitly excluded from auto-confirm (H2E's `AI-GRD-001`).
- `lib/assignments/variantGeneration.integration.test.ts` — "approval obeys the DB partial unique constraint," "manual teacher edits preserve provenance... `generated_by` flips to `teacher_edited`" — every AI-generated variant enters as a draft requiring explicit teacher approval before becoming deliverable, enforced at the DB level, not just convention.
- Holiday Planner's teacher-approve-before-publish gate (Holiday Plans Publish Gate, prior sprint — AI only rewrites phrasing of a deterministically-computed plan, never facts, and nothing publishes without teacher approval).

**Status**: EXISTING — NO NEW TEST.

---

## PROD-INT-001 — School system coexistence (integration positioning)

**Statement candidate**: "A school can become intelligence-active without configuring unrelated finance/website/SMS integrations."

**Audit finding**: no toggle, optional-integration flag, or coexistence-mode code was found anywhere in onboarding (`app/dashboard/assessments/add`, school-admin invite flow, entitlement resolution). EduNexus simply never requires those integrations in the first place — there is no code path that *could* fail this invariant, because the alternative (mandatory finance/website/SMS setup) was never built. This is current positioning language, not an encoded behavioral contract with two distinguishable states to test between.

**Status**: **NOT EXECUTABLE.** Not tested — asserting "the thing that doesn't exist doesn't block onboarding" would be a vacuous/marketing-language test, exactly what H3A's scope lock prohibits. Revisit only if a future phase actually builds an optional external-integration surface with a real bypass path to protect.

---

## Summary

| ID | Status |
|---|---|
| PROD-SCH-001 | EXISTING |
| PROD-SCH-002 | EXISTING |
| PROD-TCH-001 | EXISTING |
| PROD-TCH-002 | EXISTING |
| PROD-LRN-001/002 | EXISTING |
| PROD-EVD-001 | PARTIAL → EXISTING (1 new test file, Career Intelligence Report) |
| PROD-BILL-001/002/003 | EXISTING |
| PROD-HUM-001 | EXISTING |
| PROD-INT-001 | NOT EXECUTABLE |

**H3A's real finding**: EduNexus's product-intent boundaries were already extraordinarily well-protected by prior sprints (institutional membership, class ownership, teacher lifecycle, learner continuity, billing coverage, and human-review gates all have deep, real, DB-backed proof predating this phase). The one genuine, previously-unproven gap — `buildCareerIntelligenceReport()`'s evidence-first behavior — is now closed. This register exists so that fact is discoverable in one place instead of scattered across a dozen test files' git history.
