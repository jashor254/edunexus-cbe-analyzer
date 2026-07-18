# Sprint 12X — Learner Achievement Foundation (Re-Verification)

Sprint 12X's mission brief specifies the canonical Learner Achievement Domain per ADR-0012 — schema, repository, service, Blueprint summary integration, security, immutability, tests, documentation. **This is the same domain Sprint 12W already implemented and shipped**, one sprint prior (2026-07-18). Rather than re-implementing or duplicating that work — which would itself violate the "one owner, one write path" rule this domain exists to enforce — this sprint re-audits and re-verifies that Sprint 12W's implementation still satisfies every item in the 12X checklist, and identifies the one item (Phase 7) that cannot be safely built without violating this same brief's own Forbidden list.

---

## Phase 1 — Audit First (re-run, not assumed)

Re-ran the audit fresh against the current repo state:

| Search term | Result |
|---|---|
| award, achievement, competition, innovation, leadership, certificate/certification, recognition, community service, volunteer, accomplishment, badge, honor, prize, medal | No new hits beyond `lib/learnerAchievement/`/`lib/repositories/achievement.repository.ts` themselves and incidental unrelated matches already catalogued in Sprint 12W's own audit (marketing copy, PDF/document renderers, ranking-engine tie-break code, curriculum vocabulary) |
| `supabase/migrations/` | `20260718090000_learner_achievement.sql` — the one and only achievement schema, unchanged since 12W |
| `lib/repositories/achievement.repository.ts` | Present, unchanged |
| `lib/learnerAchievement/` | `achievement.ts`, `types.ts`, `validation.ts`, `achievement.integration.test.ts` — present, unchanged |
| `lib/learnerPortfolio/types.ts` `PORTFOLIO_CATEGORIES` | Still exactly `projects, creative_work, research, presentations, writing, design, photography, programming, media, other` — zero achievement-owned values |

**Conclusion: one canonical Achievement domain exists, unchanged, no duplicate has appeared.**

---

## Phase 2 — ADR-0012 Compliance (re-confirmed)

`docs/architecture/adr-0012-learner-achievement-domain.md` Status line already reads `IMPLEMENTED (2026-07-18, Sprint 12W)`. Ownership rules (Achievement owns Awards/Competitions/Leadership/Innovation/Community Service/Recognition/Certificates; Portfolio/Blueprint/Career are readers only) are exactly as frozen — Sprint 12W's own Phase 8 explicitly re-verified Portfolio's non-ownership; this sprint re-confirms that verification still holds (Phase 1 table above).

---

## Phases 3–6, 9–11 — Schema / Repository / Service / Blueprint Integration / Security / Tests / Documentation

All already exist, unchanged, and re-verified this sprint:

- **Schema**: `learner_achievements`/`achievement_media`/`achievement_tags`/`achievement_verification_history`, frozen six-state lifecycle (no stored "Expired" — `expires_at` remains derived, per Phase 4's ADR-0004-extending discipline).
- **Repository**: `AchievementRepository` — lifecycle-specific methods only (`create`, `updateDraft`, `verify`, `reject`, `publish`, `revoke`, `archive`, `findById`, `listForLearner`, `listPublished`), no generic mutate/delete.
- **Service**: `lib/learnerAchievement/achievement.ts` — validation, permission checks (`requireSchoolStaff`), lifecycle, versioning, verification history. No UI, no AI, no notifications.
- **Blueprint integration**: `composeAchievement()` wired into `composeBlueprint.ts`, summary-only (count, latest verified, highest-level, URL, availability) — never internal lifecycle state, never a raw record.
- **Security**: teacher verification only (structurally excludes learners/parents via `requireSchoolStaff`); published achievements immutable at three layers (repository, service, DB trigger) — same discipline as Report Cards, Teacher Reflection, Blueprint Snapshots, Portfolio.
- **Tests**: `achievement.integration.test.ts` — 7 tests (lifecycle, immutability, Evidence rule, reject-vs-revoke, Blueprint composition, cross-school isolation, permissions) — all still passing.

---

## Phase 7 — Portfolio Integration: flagged, not built

Sprint 12X's Phase 7 asks for "Portfolio now reads Achievement." This conflicts with this same brief's own Forbidden list ("Portfolio UI," "Portfolio redesign"):

- ADR-0012 Phase 6 explicitly reserves "a future Portfolio implementation reads Achievement's already-verified, already-published records" for a Portfolio-owned full digital surface that does not exist yet (Sprint 12V built only Portfolio's own raw-artefact domain and its Blueprint-facing summary — no Portfolio-owned aggregation/presentation layer).
- Building that consumption path today would require either standing up that not-yet-built Portfolio surface (= a Portfolio redesign, forbidden) or splicing Achievement data into Blueprint's existing Portfolio section — which would violate ADR-0011's own frozen rule that "an individual [section] renders in exactly one place" (ADR-0012 Phase 7's restatement of the same rule).

**What is already true and sufficient**: Portfolio owns zero achievement fields/categories (Phase 1 above), and Achievement already exposes the clean, canonical read APIs (`listPublished()`, `getAchievementSummary()`) that a future Portfolio implementation sprint will call when that surface is actually built — satisfying "no duplicated storage" and "one write path, many readers" without building a consumer that has nowhere real to render yet.

---

## Verification Checklist

- ✓ One canonical Achievement domain — confirmed unchanged (Phase 1).
- ✓ Portfolio owns no achievements — confirmed unchanged (Phase 1).
- ✓ Blueprint consumes only the canonical service — `composeAchievement()`, unchanged.
- ✓ Parent Experience unchanged architecturally — no parent code touched this sprint or last.
- ✓ No duplicated logic / no duplicated storage — confirmed by audit.
- ✓ Lifecycle immutable after publish — three-layer enforcement, unchanged, re-tested.
- ✓ Teacher verification enforced — unchanged.
- ✓ Repository has no generic mutation — unchanged.
- ✓ `tsc --noEmit` clean.
- ✓ `eslint` clean (0 errors; pre-existing warnings only, unrelated to this domain).
- ✓ All tests passing (Achievement suite: 7/7; full regression scope re-run: 53/53).

---

## Stop Condition

No new code was written this sprint — the canonical Achievement domain, repository, service, Blueprint integration, and tests already existed and passed re-verification. Per the mission's own Stop Condition and Forbidden list: no Achievement UI, uploads, certificates, evidence capture, or Portfolio consumption surface was built. Awaiting explicit direction before Sprint 12Y.
