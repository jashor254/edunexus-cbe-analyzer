# Sprint 12W — Learner Achievement Foundation (Implementation)

Implements the canonical Learner Achievement Domain exactly as frozen in `adr-0012-learner-achievement-domain.md`, flipping that ADR from Approved to Implemented.

---

## Phase 1 — Audit First (done, no code written until confirmed)

Re-verified ADR-0012's own audit against the current repo state — a full sprint (12V, Learner Portfolio) had landed since it was written, so this was a genuine re-check, not a rubber stamp:

| Area searched | Result |
|---|---|
| Repo-wide grep: award, achievement, certificate, badge, competition, innovation, leadership, community service, recognition, honour, prize, distinction | Every real hit falls into three buckets, none a duplicate risk: Sprint 12V's own `lib/learnerPortfolio/` files (deliberately documenting Achievement as out-of-scope), `lib/career/seedCareers.ts` (static career-advice prose, not a data concept), and UI/copy incidentals (curriculum subject names, generic "badge" UI pills) |
| `supabase/migrations/` | No table matching achievements/awards/certificates/competitions/leadership_roles/badges/recognitions |
| `lib/repositories/index.ts` (27 repositories before this sprint) | None achievement-scoped |
| `lib/learnerPortfolio/types.ts` + its migration | Confirmed: Portfolio's ten categories (`projects, creative_work, research, presentations, writing, design, photography, programming, media, other`) contain zero achievement-owned concepts — both files carry comments explicitly reserving Awards/Certificates/Leadership/Competitions/Community Service/Innovation for this domain |
| `capabilityMatchEngine.ts` / `careerIntelligence.ts` | Zero achievement references |
| `composeBlueprint.ts` / `types.ts` | Zero achievement field/stub before this sprint |
| `components/organizations/sandbox-badge.tsx` | Confirmed: a static UI pill, no backing table |

**No duplicate ownership found.** A new domain was the correct, verified outcome.

---

## One Deviation Flagged and Resolved

The sprint brief's own Phase 5 (a single merged category list) and Phase 4 (a 5-state Draft→Submitted→Verified→Published→Archived diagram) both conflict with what ADR-0012 actually froze:

- **ADR-0012 Phase 2** freezes **Achievement Type** (`certificate, competition, leadership, community_service, innovation, creative_work, participation`) as a field *separate* from **Phase 8**'s **Category** (`academic, leadership, innovation, community_service, creative_arts, sports, entrepreneurship, research, technology, other`). The brief's list conflates the two into one field, dropping `entrepreneurship`/`research`/`technology`/`creative_arts` and adding `competition`/`certification`/`award` where they don't belong as categories.
- **ADR-0012 Phase 4** freezes exactly six states — Draft, Verified, Published, Rejected, Revoked, Archived — with explicit reasoning for each, and **no "Submitted" state at all** (submission is the same action as a teacher's verify/reject decision, not a separate queued state). The brief's diagram both adds an unfrozen "Submitted" state and omits two ADR-frozen ones (`Rejected`, `Revoked`) — the latter is explicitly named in ADR-0012 Phase 11 as the mechanism that prevents the "fake certificates" risk.

Because the mission's own opening line is "Implement the canonical Learner Achievement Domain **exactly as frozen in ADR-0012**," this was resolved by implementing the ADR's actual frozen fields and lifecycle, not the brief's simplified restatement of them — documented here rather than silently substituted, matching the precedent set in Sprint 12V for genuine ADR/brief conflicts.

---

## Phase 2 — Database

`supabase/migrations/20260718090000_learner_achievement.sql`:

- `learner_achievements` — `achievement_type` and `category` as two separate CHECK-constrained enums (Phase 2/8); `supporting_evidence_ids uuid[]` (reference-not-copy, Phase 5) plus `verifying_document_reference` for pre-Evidence-system external claims; `awarding_organization`, `award_date`, `expires_at` (data, never a stored "Expired" status, per Phase 4's ADR-0004-derived discipline); `status` across the frozen six values; `version` (monotonic, incremented every transition); full attribution/verification/rejection/publication/revocation/archival fields.
- `achievement_media` — link-out URLs only, no file bytes, no bucket (Forbidden list).
- `achievement_tags` — free-form tags per achievement.
- `achievement_verification_history` — append-only audit trail of every lifecycle transition (Phase 11's "Version history" testing requirement), itself immutable via trigger (no UPDATE/DELETE ever).

Every achievement belongs to exactly one `learner_id` + `school_id` (denormalized, matching `learner_portfolios`/`teacher_reflections`' convention). RLS: school-staff read-only on all four tables; every write goes through the service-role client.

---

## Phase 3 — Repository

`lib/repositories/achievement.repository.ts` — `AchievementRepository`, registered as `repos.achievements`. Exposes exactly: `create`, `updateDraft`, `verify`, `reject`, `publish`, `revoke`, `archive`, `findById`, `listForLearner`, `listPublished`, plus `addMedia`/`listMedia`, `addTag`/`listTags`, `recordTransition`/`listHistory`. No generic `update()`/`mutate()`/`delete()` on achievements — no `deletePublished` path exists at all.

---

## Phase 4 — Service Layer

`lib/learnerAchievement/achievement.ts` — the exact ADR-0012 lifecycle:

```
Draft ──(teacher verify)──▶ Verified ──(teacher publish)──▶ Published ──▶ Archived
  │                                                              │
  └──(teacher reject)──▶ Rejected                                └──(found false)──▶ Revoked
```

Responsibilities: lifecycle validation, permission checks (`requireSchoolStaff` on every write — structurally excludes learners and parents, satisfying Phase 10's "no learner may publish, no parent may modify" via the existing shared permission service rather than a duplicated check), versioning (incremented and logged to `achievement_verification_history` on every transition), the mandatory Phase 5 evidence-or-verifying-document rule enforced before `verifyAchievement()` succeeds, and business rules (cannot publish unverified, cannot revoke/archive anything but published, cannot edit anything but draft — clean errors before the DB trigger's raw exception). No AI, no Blueprint logic, no Parent logic, no Portfolio logic anywhere in this module.

Published achievements are immutable across all three layers: repository (no generic mutate), service (business-rule rejection), and database trigger (`enforce_achievement_immutability`) — proven in the integration test via a raw `db.from('learner_achievements').update(...)` bypass attempt.

---

## Phase 5 — Categories

Implemented ADR-0012's actual frozen fields (see "One Deviation" above): Achievement Type (`certificate, competition, leadership, community_service, innovation, creative_work, participation`) and Category (`academic, leadership, innovation, community_service, creative_arts, sports, entrepreneurship, research, technology, other`) — both CHECK-constrained, no free-text category explosion.

---

## Phase 6 — Blueprint Integration

`lib/learnerBlueprint/composeAchievement.ts` reads `getAchievementSummary()` only. Returns exactly the ADR-0012 Phase 6/7 field budget: `achievementCount`, `latestVerifiedAchievement`, `highestLevelAchievement` (via a fixed, documented category ranking — `CATEGORY_RANK` in `lib/learnerAchievement/types.ts` — never a fabricated score), `profileUrl`, `available`. Wired into `composeBlueprint.ts` alongside `career`/`portfolio`/`teacherReflection`, degrading to `unavailable` on any failure without affecting sibling sections.

---

## Phase 7 — Parent Experience

No new code. Parent Portal pages already read `composeBlueprint()`'s output; they now receive the `achievement` section automatically, with zero direct Achievement-table reads.

---

## Phase 8 — Portfolio Relationship (explicitly verified)

Re-read `lib/learnerPortfolio/types.ts` and its migration this sprint: Portfolio's category enum is unchanged and contains zero achievement-owned values. Portfolio has no import of, or reference to, any Achievement table, repository, or service. **Portfolio owns nothing achievement-related; Achievement owns Achievement.**

---

## Phase 9 — Career Relationship

Not integrated this sprint (per mission instruction — "do not integrate"). `getAchievementSummary()` and `listPublished()` are clean, canonical read APIs a future Career Intelligence sprint can call; nothing in `lib/career/` or `lib/learnerIntelligence/careerIntelligence.ts` was touched.

---

## Phase 10 — Security

Every write action calls `requireSchoolStaff` — no inline permission checks, no duplicated authorization logic. RLS enforces school-tenant isolation as the second layer. `recorded_by`/`verified_by`/`revoked_by` resolved via `repos.teachers.findSchoolUser`, never trusted from request input. Published achievements are immutable (Phase 4). No learner-facing write path exists at all — every mutation requires school-staff membership, which structurally excludes both learners and parents.

---

## Phase 11 — Testing

`lib/learnerAchievement/achievement.integration.test.ts` — 7 tests, all passing against real synthetic Supabase data (cleaned up via `after()`): full lifecycle + service/DB immutability + append-only history, the central Phase 5 evidence rule (both failure and the document-reference-alone success case), reject-vs-revoke as distinct terminal states with revocation removing external visibility even after publication, canonical type/category enforcement, Blueprint composition (empty + summary, asserting the exact field budget), cross-school isolation, permission failures. Two existing pure-test fixtures updated for the new required `LearnerBlueprint.achievement` field.

---

## Verification Checklist

- ✓ One canonical Achievement owner — `lib/learnerAchievement/` + `AchievementRepository`, confirmed by Phase 1's audit.
- ✓ Portfolio no longer owns achievement data — never did (Sprint 12V was built with this exclusion in mind); re-verified explicitly this sprint (Phase 8 above).
- ✓ Blueprint only composes — `composeAchievement()` reads a summary only, never a full record.
- ✓ Parent Experience unchanged — no new parent code, structural inheritance via Blueprint.
- ✓ No duplicated business logic — lifecycle/validation/versioning live only in `lib/learnerAchievement/achievement.ts`.
- ✓ One repository — `AchievementRepository`, registered once.
- ✓ One service — `lib/learnerAchievement/achievement.ts`.
- ✓ Published immutable — three layers (repository, service, DB trigger), proven in tests.
- ✓ Tests passing — 7/7 integration, plus the full existing regression suite.
- ✓ `tsc --noEmit` clean.
- ✓ ESLint clean.

---

## Stop Condition

Per explicit mission instruction: **stop here.** Achievement Domain exists, Blueprint consumes its official summary, tests pass, documentation is written. Not begun: Achievement UI, upload interface, media gallery, Portfolio redesign/editor, Career integration, QR codes, notifications, certificate PDFs, leaderboards, gamification, badges, AI achievement generation, analytics, student submission workflow, parent editing. Awaiting explicit approval before Sprint 12X.
