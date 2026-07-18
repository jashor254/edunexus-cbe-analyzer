# Sprint 12K — Blueprint Snapshots & Historical Viewer

**Status: implemented.** Historical viewing only — no redesign of Blueprint, Report Cards, or the Composition Engine.

---

## 1. Storage Audit (done before writing any migration, per mission)

Checked every existing table with a "snapshot"/"report"/"payload"-shaped column against the mission's required snapshot model before writing new schema:

| Table | Why rejected |
|---|---|
| `school_intelligence_snapshots` | School-wide **weekly Analytics rollup** (`at_risk_count`, `avg_capability_dimensions`, etc.) — wrong domain (Analytics, not Blueprint), wrong grain (per-school, not per-learner), and mutable (`Update` shape exists) — a Blueprint Snapshot must be immutable. |
| `academic_reports` | Tied to `assessment_id`, keyed to legacy `student_id`, mutable (`Update` shape) — a single-assessment artifact, not a term/lifecycle snapshot. |
| `student_clinic_reports`, `clinic_reports` | Academic-Clinic-owned, legacy `student_id`-keyed — reusing either would cross a domain boundary this sprint may not touch (`lib/academicClinic/` is forbidden) and key Blueprint Snapshots to the wrong identity space (Core `learners.id`, per Sprint 12H). |
| `school_report_cards` | Deliberately a **different artifact** — ADR-0008 Part 3's three-way distinction (Report Card / Blueprint Snapshot / Current Blueprint) exists precisely so these never share storage; reusing it would collapse that distinction, not honor it. |

**Conclusion**: no existing mechanism fits. `blueprint_snapshots` is a genuinely new, minimal table — not a second "learner record" store (RAS §10.7/§10.8: owned exclusively by `lib/learnerBlueprint/`, nothing else may write to it).

---

## 2. Snapshot Lifecycle

```
Current Blueprint (always live, composeBlueprint())
      |
      | [one of the three ADR-0008 Part 3 triggers fires]
      |   - Report Card publication (app/api/core/reports/route.ts's
      |     publish action, standalone)
      |   - End of Term (lib/core/endOfTerm.ts's runEndOfTerm — publishes
      |     report cards as one of its own steps)
      |   - Graduation (lib/core/promotions.ts's runAnnualPromotion,
      |     promotion_type === 'graduated')
      v
createBlueprintSnapshot() — composes via the same composeBlueprint()
every other consumer uses, then freezes that exact result into one
blueprint_snapshots row. Awaited, but non-fatal: a snapshot failure is
caught and logged, never thrown — it can never block or roll back the
real operation (publish/end-of-term/graduation), which has already
succeeded by the time the snapshot is attempted.
      |
      v
blueprint_snapshots row — immutable forever from this point (§4)
```

No fourth trigger was invented. `end_of_term` and `report_card_publication` share one code path (`publishReportCards()`, now snapshot-type-parameterized) rather than firing twice for the same real event — see §6.

---

## 3. Snapshot Storage

New migration `20260717120000_blueprint_snapshots.sql`, applied to the real project (confirmed via `list_tables`/`get_advisors` — zero new security findings beyond the same `search_path`-mutable warning every other immutability-trigger function in this codebase already carries):

```sql
blueprint_snapshots (
  id, learner_id (-> learners, Core, ON DELETE CASCADE),
  school_id (-> schools, ON DELETE CASCADE),
  academic_year_id (-> academic_years, nullable),
  term_id (-> terms, nullable),
  snapshot_type CHECK IN ('report_card_publication','end_of_term','graduation'),
  blueprint_payload jsonb NOT NULL,   -- exactly composeBlueprint()'s output
  provenance jsonb NOT NULL,          -- { trigger, sourceRecordId, actorUserId }
  schema_version text NOT NULL,       -- lib/learnerBlueprint's BLUEPRINT_VERSION
  created_at, created_by (-> school_users, ON DELETE SET NULL)
)
```

`school_id` and `academic_year_id`/`term_id` (nullable) are additive beyond the mission's literal field list, needed for RLS tenant isolation and consistent with every other Core-adjacent table's convention — documented in the migration itself, not silently added.

**No derived analytics, no duplicate calculations stored** — `blueprint_payload` is exactly what `composeBlueprint()` returned, unmodified.

---

## 4. Immutability Rules

Enforced at three layers, matching `learner_evidence`'s own existing precedent (CLAUDE.md: "never mutated after creation... enforced by a database trigger, not just this rule"):

1. **Repository**: `BlueprintSnapshotRepository` has no `update`/`delete` method — the class only exposes `insert`/`findById`/`listForLearner`.
2. **RLS**: only a `SELECT` policy exists for the `authenticated` role; no `INSERT`/`UPDATE`/`DELETE` policy at all, so those are structurally impossible for any non-service-role caller.
3. **Database trigger**: `enforce_blueprint_snapshot_immutability()` unconditionally `RAISE EXCEPTION`s on any `UPDATE` or `DELETE`, **even from the service-role client** — the strongest of the three layers, since it can't be bypassed by a future service-layer bug. Verified directly against the real database (`lib/learnerBlueprint/snapshot.test.ts`): both an `UPDATE` and a `DELETE` attempted via the service-role client were rejected, and the row was confirmed unchanged afterward.

---

## 5. Schema Versioning

Every row records `schema_version` = `lib/learnerBlueprint/composeMetadata.ts`'s `BLUEPRINT_VERSION` at composition time. **No migration in this table may ever rewrite an existing row's `blueprint_payload` to a newer schema shape** — a future schema change ships as a new `BLUEPRINT_VERSION` value going forward only; old snapshots keep rendering under their original shape (the Historical Viewer's rendering is driven entirely by `BlueprintSectionCard`'s already-generic status/owner/freshness handling, which doesn't assume a fixed section set, so an older or newer payload shape degrades gracefully rather than breaking).

---

## 6. Rendering Flow — Shared Reuse, No Duplication

```
Sprint 12J's BlueprintView (unchanged core) now takes one new optional prop:

BlueprintView({ blueprint, validation, learnerId, historicalMeta? })
                                                    ^^^^^^^^^^^^^^
                                          absent  -> Current Blueprint
                                          present -> Historical Snapshot

historicalMeta present -> <HistoricalBanner> renders at the top (new,
  small component — "Historical Snapshot" + "Immutable" badges, snapshot
  date, academic year, term, snapshot type) + the header text switches to
  historical framing ("frozen, never recalculated").

Every BlueprintSectionCard, every per-section renderer
(IdentitySection/AcademicRecordSection/etc.) is byte-for-byte the same
code whether rendering the Current Blueprint or a stored Snapshot's
blueprint_payload — zero duplicated rendering logic, exactly per mission.
```

`app/student/blueprint/[learnerId]/history/[snapshotId]/page.tsx` fetches the stored row and passes `snapshot.blueprint_payload` straight into the same `BlueprintView` the Current Blueprint page uses — no second renderer exists anywhere in this codebase.

**One deliberate, honest exception**: the historical page does run `validateBlueprint()` against the stored payload before rendering. This is a pure structural check (are the required fields/owner strings present), not an educational recalculation — it never touches `blueprint_payload`'s content, only confirms its shape, so it doesn't violate "no recalculation." A hardcoded `{valid: true}` was considered and rejected as dishonest (it would assert something never actually checked).

---

## 7. Historical Navigation

```
Current Blueprint  --[View History →]-->  Snapshot List  --[open]-->  Selected Snapshot
Current Blueprint  <--[← Back to History reads back]--                Selected Snapshot --[← Back to History]--> Snapshot List
```

One-directional per the mission's diagram (Current → Historical Snapshots → Selected Snapshot), with only "navigate back" as the explicitly-permitted return path — no new cross-links were added anywhere to Compass, Career Intelligence, or Report Cards from any historical view. Report Cards remain a strict dead-end (a Blueprint Snapshot's own provenance records which report card triggered it, but nothing renders or links from the Snapshot into that Report Card this sprint — that citation link is explicitly Layer 4's own future work, ADR-0009 §9, not built here since PDF/print/export are all forbidden this sprint).

---

## 8. Rendering Rules — Verified

Confirmed directly (`lib/learnerBlueprint/snapshot.test.ts` + code review of `HistoricalBanner.tsx`): every stored snapshot's viewer displays **Historical Snapshot** label, **Snapshot Date**, **Academic Year**, **Term**, **Snapshot Type**, an **Immutable** badge, all inside a visually distinct amber-bordered banner absent from the Current Blueprint view — satisfying "Never appear identical to Current Blueprint" as a real visual difference, not just a data difference.

---

## 9. A Real Bug Found and Fixed During This Sprint

While wiring the graduation trigger, the test for it failed with a foreign-key violation: `learner_promotions.processed_by` already had an existing FK to `school_users(id)`, not the raw `auth.uid()` — but `createBlueprintSnapshot()`'s `actorUserId` needs a real `auth.uid()` for its internal permission checks (`composeBlueprint()` → `composeAttendance()` → `getLearnerAttendanceHistory`'s admin check). Passing `processedBy` straight through would have silently made every graduation-triggered snapshot's Attendance section report a false permission-denied "Unavailable." Fixed by adding `SchoolRepository.findSchoolUserById()` (the missing reverse lookup) and resolving the real actor id once, non-fatally, before the promotion loop in `lib/core/promotions.ts`. Caught by the new integration test, not discovered later.

---

## 10. Constitutional / RAS / ADR-0008 Compliance

- **RAS §10.7/§10.8**: one domain, one owner — `blueprint_snapshots` is written only by `lib/learnerBlueprint/snapshot.ts`; no other module inserts into it.
- **ADR-0008 Part 3**: implemented exactly — Report Card / Blueprint Snapshot / Current Blueprint remain three non-competing artifacts; only the three named triggers create a Snapshot; Snapshots are immutable once taken; the Current Blueprint is untouched by any of this (confirmed by the unchanged `composeBlueprint.pure.test.ts`/`composeBlueprint.integration.test.ts` suite, still 20/20 passing).
- **Educational Constitution Article XI**: the Historical Banner exists specifically so a stored Snapshot is never mistaken for live, current data — a number without a "this is historical" label would violate this Article; the banner is the fix.
- **No new educational calculation**: `createBlueprintSnapshot()` computes nothing — it calls `composeBlueprint()` (unchanged) and persists its output verbatim.

---

## 11. Verification

- `tsc --noEmit`: clean, project-wide.
- `eslint`: clean on every touched/new file.
- **New tests** (`lib/learnerBlueprint/snapshot.test.ts`, 4/4 passing against real synthetic data): snapshot creation stores the real composed payload correctly; immutability enforced at the database level for both UPDATE and DELETE, even via the service-role client; the report-card-publication trigger fires correctly end-to-end; the graduation trigger fires correctly end-to-end (after fixing the actor-id bug above).
- **Regression**: `composeBlueprint.pure.test.ts`/`composeBlueprint.integration.test.ts` (20/20, Sprint 12G/12H unchanged), `reportCardOwnership.security.test.ts`, `reportCardPublicationGuard.integration.test.ts`, `endOfTermFullChain.test.ts`, `granularEndOfTermFlow.test.ts`, `generateReportCards.ranking.test.ts`, `reportCardWithSubjects.test.ts`, `attendanceReportCardIntegration.test.ts` — full results in the implementation-log entry.
- **No duplicated calculations, composition, or rendering**: confirmed by code review — `createBlueprintSnapshot` has exactly one call into `composeBlueprint()`; `BlueprintView` has exactly one render path for both Current and Historical.

---

## Stop Condition

Per explicit mission instruction: Historical Blueprint viewing works correctly using immutable Blueprint Snapshots. **Stop here.** No Parent Portal, QR generation, PDF export, audience filtering, notifications, Behaviour, Portfolio, Analytics, Government sharing, or Employment record begins. Wait for explicit approval before Sprint 12L.
