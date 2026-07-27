# Validation Case — Chebet Rotich (Uncertainty / Mixed-Evidence Case)

Frozen against `docs/research/living-blueprint-validation-freeze.md`. Do not alter after freezing.

- **Learner identifier (Core):** `f01f9abc-a250-474a-814c-34b8269003fa`
- **Legacy student identifier:** `afaec28a-7526-473a-a4d1-f08d9e9f43f6`
- **School:** Mwatate Ridge Senior School (reference-school fixture; no real pilot school exists yet — disclosed, not hidden)
- **Rendered PDF:** `docs/research/validation-cases/chebet-rotich-blueprint.pdf`

## Evidence Rows Used

| id | subject | score | CBC level | assessment type | year | term | source | created_at |
|---|---|---|---|---|---|---|---|---|
| `f48ee4e6-...` | kiswahili_lugha | 63 | 3 | cat | 2026 | 2 | teacher_upload | 2026-07-09T11:51:07.930Z |
| `8e21b3d0-...` | mathematics | 45 | 2 | cat | 2026 | 2 | teacher_upload | 2026-07-27T00:50:14.967Z |

Both rows `lifecycle_state: auto_confirmed`. Deliberately only one evidence point per subject — this is the case designed to keep genuine uncertainty visible, not to force a false trend.

## Projection Output

- **Academic (per-subject):**
  - kiswahili_lugha: Level 3, trend `insufficient_data` (n=1)
  - mathematics: Level 2, trend `insufficient_data` (n=1)
- **Growth (comparable-context):** overall trend **`insufficient_data`** — neither subject has 2 distinct effective periods, so no direction is claimed at any level (per-subject or overall)
- **Risk:** `overallRiskLevel: normal`, 0 flags

## Blueprint Payload (composed sections, key fields)

- **academicRecord.overallTrend:** `insufficient_data`
- **academicRecord.bySubject:** `[{kiswahili_lugha, L3, insufficient_data, n=1}, {mathematics, L2, insufficient_data, n=1}]`
- **learningStory.evidence:** "Across the available evidence, current capability is stronger in kiswahili_lugha and comparatively lower in mathematics." (a *current-level* comparison, not a trend claim — Mathematics is genuinely recorded at a lower level than Kiswahili right now)
- **learningStory.opportunity:** "The greatest current opportunity is to strengthen mathematics, where the present capability evidence is least secure. The live learning recommendation points to this next step: Continue with mathematics."
- **parentSummary.headline:** "Chebet Rotich is still building a fuller evidence picture this term."

## Coherence Result

**`PASS`** — zero findings.

## Approved / Proposed Actions

- **Proposed or approved actions at freeze time:** none.

## Known Setup Limitations

- This case's `learningStory.opportunity` still names Mathematics as the subject to strengthen, from a single data point per subject. This is a *current-level* claim (Mathematics genuinely scores lower than Kiswahili today), not a *trend* claim — `overallTrend` correctly stays `insufficient_data`, satisfying Phase 4B.1's specific invariant. Whether a single-data-point current-level comparison should itself carry additional hedging language was flagged as an open question in `docs/architecture/comparable-context-growth-correction-phase4b1.md` §15, out of that phase's scope. Facilitators and observing teachers should treat this as a live, open question worth this case's own validation attention, not a known defect being hidden.
- No action has been proposed for this learner — Task 4 cannot be exercised for this case unless the facilitator proposes one live.
