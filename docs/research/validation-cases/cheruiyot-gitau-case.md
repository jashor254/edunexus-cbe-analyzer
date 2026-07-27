# Validation Case — Cheruiyot Gitau (Challenge / Intervention Case)

Frozen against `docs/research/living-blueprint-validation-freeze.md`. Do not alter after freezing.

- **Learner identifier (Core):** `d3b3249a-7e08-484f-bfeb-55b7f231269f`
- **Legacy student identifier:** `41f735d1-ddea-43a4-87f5-768b7f83a417`
- **School:** Mwatate Ridge Senior School (reference-school fixture; no real pilot school exists yet — disclosed, not hidden)
- **Class:** Grade 10 (as bridged via `students`/`teacher_classes`)
- **Rendered PDF:** `docs/research/validation-cases/cheruiyot-gitau-blueprint.pdf`

## Evidence Rows Used

| id | subject | score | CBC level | assessment type | year | term | source | created_at |
|---|---|---|---|---|---|---|---|---|
| `39b7cac3-...` | kiswahili_lugha | 35 | 2 | cat | 2026 | 2 | teacher_upload | 2026-07-09T11:51:07.930Z |
| `d07e7a20-...` | mathematics | 72 | 3 | cat | 2026 | **1** | teacher_upload | 2026-07-27T00:50:00.101Z |
| `7bed4b0c-...` | mathematics | 28 | 1 | cat | 2026 | **2** | teacher_upload | 2026-07-27T00:50:02.145Z |

All rows `lifecycle_state: auto_confirmed`. The two Mathematics rows are seeded across genuinely distinct terms (Phase 4B.1's comparable-context invariant requires this before any trend can be claimed) — see `scripts/reference-school/08-seed-teacher-validation-cases.ts` for exactly how and why this Evidence was added (real, additional Evidence through the canonical writer, not fabricated learner activity).

## Projection Output

- **Academic (per-subject):**
  - kiswahili_lugha: Level 2, trend `insufficient_data` (n=1, one effective period only)
  - mathematics: Level 1, trend **`declining`** (n=2, terms 1→2, Level 3→1)
- **Growth (comparable-context):** overall trend **`declining`**, `sourceSubject: mathematics` (the single valid context — kiswahili_lugha stays `insufficient_data`)
- **Risk:** `overallRiskLevel: critical`, 1 flag — `{ subject: mathematics, severity: critical, reason: "Below Expectation in mathematics and declining from prior evidence" }`

## Blueprint Payload (composed sections, key fields)

- **academicRecord.overallTrend:** `declining`
- **academicRecord.bySubject:** `[{kiswahili_lugha, L2, insufficient_data, n=1}, {mathematics, L1, declining, n=2}]`
- **learningStory.evidence:** "Across the available evidence, current capability is stronger in kiswahili_lugha and comparatively lower in mathematics."
- **learningStory.opportunity:** "The greatest current opportunity is to strengthen mathematics, where the present capability evidence is least secure. The live learning recommendation points to this next step: Continue with mathematics." (legitimate — Mathematics is genuinely below the capability threshold, per Phase 4B.1's `belowThreshold` distinction)
- **parentSummary.headline:** "Cheruiyot Gitau's progress this term needs attention."

## Coherence Result

**`PASS_WITH_WARNINGS`** — one warning:
> `recommendation_alignment`: "Risk reports a critical flag for mathematics ('Below Expectation in mathematics and declining from prior evidence'), but no approved action item addresses that subject."

This warning is expected and correct at freeze time: an action was proposed (below) but deliberately left un-approved so a validating teacher can make that decision live.

## Approved / Proposed Actions

- **Proposed** (status: `proposed`, not approved): *"Strengthen Mathematics foundations through targeted practice"* — rationale: "Mathematics evidence shows a decline from Level 3 to Level 1 across the last two assessments." Proposed by the learner's real bridged teacher (Achieng Nafula) via the canonical `proposeBlueprintAction`. Left undecided intentionally — Task 4 of the validation script asks the participating teacher to approve/reject/defer this live.
- **Approved actions at freeze time:** none.

## Known Setup Limitations

- Only one action exists for this learner (Mathematics remediation) — the Coordinated Action Plan's Learner/Teacher quadrants will show this action's fields once approved; Parent/Compass quadrants reflect the same general "no fabricated content" pattern as the other two cases (see each case's own note).
- Kiswahili remains `insufficient_data` (n=1) throughout — this is real and unchanged; it is not the subject under discussion for this case.
