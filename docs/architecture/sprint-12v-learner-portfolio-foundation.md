# Sprint 12V — Learner Portfolio Foundation (Implementation)

The first Learner Portfolio implementation sprint, building against `adr-0011-learner-portfolio-architecture.md` and `adr-0012-learner-achievement-domain.md` (both flipped from DRAFT to Approved as part of this sprint).

---

## Phase 1 — Ownership Audit (done first, before any code)

Re-verified ADR-0011/0012's own Phase 1 audits against the current state of the repo (a full session had passed; things could have changed):

| Area searched | Result |
|---|---|
| `lib/storage/`, `lib/uploads/`, `lib/files/`, `lib/media/`, `lib/evidence/`, `lib/projects/`, `lib/attachments/` | None exist |
| `lib/academy/portfolio.ts` + related | Confirmed unrelated — Academy's *teacher* professional-development badge system, not learner-facing |
| `app/api/**/upload*`, `**/media*`, `**/portfolio*` | Only one unrelated assessment mark-sheet upload route |
| Repo-wide grep "portfolio" | Only teacher-badge code, AI career-advice prose ("build a portfolio"), SOW pedagogy vocabulary, test fixture strings — no domain code |
| Migrations | No `portfolio*`/`achievement*` tables existed before this sprint |
| `lib/repositories/index.ts` (27 repos before this sprint) | None owned portfolio/artefacts/achievements |
| `capabilityMatchEngine.ts` / `careerIntelligence.ts` | Zero portfolio references — no premature ADR-0011-Phase-6-style read existed |
| Blueprint composer | Canonical is `lib/learnerBlueprint/composeBlueprint.ts` — no portfolio field/stub existed |

**No duplicate ownership found.** A new domain was the correct, verified outcome — confirming, not assuming, ADR-0011/0012's own conclusions still held.

**One unexpected finding, unrelated to Portfolio**: two Blueprint composers currently coexist — canonical `lib/learnerBlueprint/composeBlueprint.ts` (used by current parent/student pages) and a legacy `lib/learnerIntelligence/blueprint.ts` (still live behind one API route). This sprint integrates Portfolio into the canonical one only.

---

## Two Deviations Flagged and Resolved Before Implementation

Per the standing Architecture Guardian operating mode, two ambiguities were surfaced to the user rather than silently resolved:

1. **ADR status**: both ADR-0011 and ADR-0012 were still marked `Status: DRAFT — awaiting explicit approval`. Confirmed with the user that this sprint brief constitutes that approval — both ADR headers were flipped to Approved.
2. **Category conflict**: the sprint brief's Phase 5 category list included `Innovation`, but ADR-0012 Phase 3 explicitly supersedes ADR-0011 and assigns "Innovation records" to the (not-yet-built) Achievement domain, not Portfolio. Confirmed with the user: **dropped `Innovation`** from Portfolio's canonical categories, matching the ratified ADR-0012 supersession exactly. `Research` was not superseded and remains a Portfolio category (the raw artefact, not a verifiable claim).

Final canonical Portfolio categories: `projects`, `creative_work`, `research`, `presentations`, `writing`, `design`, `photography`, `programming`, `media`, `other`.

---

## Phase 2 — Canonical Portfolio Domain

```
lib/repositories/portfolio.repository.ts   — table access only (matches the codebase's established
                                              repository convention: all repos live in lib/repositories/,
                                              registered in index.ts as `repos.portfolios` — not the
                                              sprint brief's literal suggested lib/portfolio/ path, which
                                              would have created a second repository-organization
                                              structure alongside the one every other domain already uses)
lib/learnerPortfolio/types.ts              — domain types, PortfolioItem/PortfolioSummary shapes
lib/learnerPortfolio/validation.ts         — field-level validation (title required, length limits,
                                              canonical category enforcement)
lib/learnerPortfolio/portfolio.ts          — the service: permission checks, lifecycle transitions,
                                              Blueprint-facing summary
lib/learnerPortfolio/portfolio.integration.test.ts
```

One domain. One repository. One service. Nothing duplicated.

---

## Phase 3 — Schema

`supabase/migrations/20260717160000_learner_portfolio.sql`:

- `learner_portfolios` — one container per learner (`UNIQUE (learner_id)`), `learner_id`/`school_id` FKs.
- `portfolio_items` — the entry itself: `category` (CHECK-constrained to the ten canonical values above), `title`, `description`, `reflection`, `supporting_evidence_ids uuid[]` (reference-not-copy, mirroring `learner_projections`' own pattern per ADR-0011 Phase 7), `status`, attribution/verification/publish/archive fields.
- `portfolio_media` — link-out URLs only, no file bytes, no bucket (ADR-0011 explicitly deferred storage strategy; out of this sprint's scope).
- `portfolio_tags` — free-form tags per item.

Every item belongs to `learner_id` + `school_id` directly (denormalized, matching `teacher_reflections`' own convention) plus `portfolio_id`. RLS: school-staff read-only policies on all four tables; every write goes through the service-role client, no write policy for `authenticated`.

---

## Phase 4 — Lifecycle

`Draft → Submitted → Verified → Published → Archived`, with `Rejected` reachable from `Submitted` (matching the sprint brief's five named states plus the verification workflow's reject action). No `Expired`/`Revoked` states — those belong to the Achievement domain's stricter verifiable-claim model (ADR-0012 Phase 4), not to Portfolio's raw-artefact model.

Enforced by a DB trigger (`enforce_portfolio_item_immutability`): once `published`, the only legal further change is the transition to `archived`; every other field edit, and every DELETE on a `published` or `archived` row, is rejected — even bypassing the service layer entirely (proven in the integration test via a raw `db.from('portfolio_items').update(...)` call).

---

## Phase 5 — Categories

Implemented exactly the sprint brief's list minus `Innovation` (see "Deviations" above): Projects, Creative Work, Research, Presentations, Writing, Design, Photography, Programming, Media, Other. Awards, Certificates, Leadership, Competitions, Community Service, and Innovation are excluded — all now Achievement-domain-owned per ADR-0012.

---

## Phase 6 — Ownership Rules

Every `PortfolioItem` (`lib/learnerPortfolio/types.ts`) owns exactly: `title`, `description`, `reflection`, `media` (link-out URLs), `tags`, `supportingEvidenceIds` (reference, never a copy), `createdBy`/`verifiedBy` (attribution only, never an access gate — CLAUDE.md), `status`, and timestamps. Nothing else — no marks, scores, achievements, career predictions, or teacher-reflection content lives on this row.

---

## Phase 7 — Blueprint Integration

`lib/learnerBlueprint/composePortfolio.ts` reads `getPortfolioSummary()` only — never the repository, never raw tables. Returns exactly the ADR-0011 Phase 4 field budget: `publishedCount`, `latestItem`, `featuredItem`, `portfolioUrl`. No curation/pinning mechanism exists yet, so `featuredItem` is the most recent published item — never a fabricated distinct selection — documented in code as a known gap, not silently invented. Wired into `composeBlueprint.ts` as a new section, alongside `career`/`teacherReflection`, degrading to `unavailable` on any failure without affecting sibling sections (every existing composer's contract, unchanged).

---

## Phase 8 — Parent Experience

No new code. Parent Portal pages already read `composeBlueprint()`'s output; they now receive the `portfolio` section automatically, with zero direct Portfolio-table reads — satisfying "Parent Portal reads Portfolio only through Blueprint" structurally.

---

## Phase 9 — Snapshot Integration

Not touched this sprint. Blueprint Snapshots (`lib/learnerBlueprint/snapshot.ts`) already freeze whatever the Current Blueprint shows at snapshot time, section by section — Portfolio's new section is captured by that existing mechanism automatically, with no Portfolio-specific snapshot code needed.

---

## Phase 10 — Verification Workflow

`lib/learnerPortfolio/portfolio.ts`: `submitItem` (Draft → Submitted), `verifyItem` (Submitted → Verified, teacher-attributed via `school_users.id`), `rejectItem` (Submitted → Rejected, reason required), `publishItem` (Verified → Published only — publishing an unverified item is rejected). No AI verification, no automatic approval — every state transition past Draft requires an authenticated school-staff actor (`requireSchoolStaff`).

---

## Phase 11/12 — Repository & Service Discipline

`PortfolioRepository`: `findOrCreatePortfolio`, `createItem`, `updateDraftItem`, `submitItem`, `verifyItem`, `rejectItem`, `publishItem`, `archiveItem`, `findItemById`, `listAllItems`, `listPublishedItems`, `addMedia`/`listMedia`, `addTag`/`listTags` — one named method per lifecycle transition, no generic `update()`/`delete()`, no `deletePublished`/`updatePublished`.

Business rules live in the service, not the repository: cannot publish an unverified item, cannot edit a published item (clean error before the DB trigger's raw exception), cannot archive anything but a published item, cannot verify/reject an item that hasn't been submitted.

---

## Phase 13 — Security

Every write action calls `requireSchoolStaff` — no inline permission checks. RLS enforces school-tenant isolation as the second layer. Attribution (`created_by`/`verified_by`) resolved via `repos.teachers.findSchoolUser`, matching `teacherReflection`'s existing pattern exactly, never trusted from request input.

---

## Phase 14 — Testing

`lib/learnerPortfolio/portfolio.integration.test.ts` — 7 tests, all passing against real synthetic Supabase data (cleaned up via `after()`): full lifecycle + both immutability layers, reject workflow, canonical-category enforcement (proving `innovation`/`awards` are rejected), mixed-category multi-item listing, empty-portfolio + published-summary Blueprint composition (asserting the exact field budget), cross-school isolation, permission checks. Two existing pure-test fixtures updated for the new required `LearnerBlueprint.portfolio` field.

---

## Verification Against Mission's Checklist

- Portfolio has exactly one owner — `lib/learnerPortfolio/` + `PortfolioRepository`, confirmed by Phase 1's audit.
- Blueprint composes Portfolio without owning it — `composePortfolio()` reads a summary only, never a full item.
- Achievement remains separate — no achievement-owned category exists in Portfolio's schema or types.
- Report Cards never read Portfolio — confirmed, no import added anywhere in `lib/core/report-cards.ts` or callers.
- Career Intelligence only references Portfolio — not touched this sprint (no read added yet; Portfolio has no career-facing read path to misuse).
- Parent Experience reads through Blueprint only — structural, via the existing `composeBlueprint()` consumer pattern.
- Snapshot stores summaries only — via the existing, unmodified Snapshot mechanism.
- No duplicate upload system created — none exists; `portfolio_media` is link-out URLs only.
- No duplicate storage layer introduced — none exists.
- No duplicate repository introduced — `PortfolioRepository` is the one and only Portfolio repository, registered once in `lib/repositories/index.ts`.
- Ownership boundaries match ADR-0011 and ADR-0012 — confirmed by the Innovation-category deviation being caught and corrected before implementation, not after.
- `tsc --noEmit` passes on all Portfolio/Blueprint files touched.
- ESLint passes.
- Full regression suite (existing pure/integration tests touched by this sprint) passes.

---

## Stop Condition

Per explicit mission instruction: **stop here.** Portfolio domain, Blueprint integration, tests, and documentation are complete. Not begun: Achievement implementation, Portfolio UI, Portfolio uploads interface, QR generation, Portfolio analytics, AI portfolio review, Employer portal, University portal, Student editing experience. Awaiting explicit approval before Sprint 12W.
