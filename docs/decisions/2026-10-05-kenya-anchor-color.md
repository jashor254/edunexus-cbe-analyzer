# Decision: EduNexus Kenya-rooted anchor color

Date: 2026-10-05 · Mode: /decide · Status: Decided (Stage 8 open)

## 1. Decision Definition
- The decision, in one sentence: Adopt one Kenya-rooted anchor color (`ochre`,
  terracotta earth tone) for the neutral/school-default state, instead of
  leaning on amber everywhere.
- Why now: DESIGN.md anti-slop audit item #6 is the last visual-system gap;
  high-end edutech (Khan, Coursera, Duolingo) anchors on one real hue and ours
  had no Kenyan one.
- What happens if we do nothing: amber stays the universal default → reads as
  generic warm SaaS, undercutting "Kenyan but world-class."
- Desired outcome: a distinct, WCAG-safe anchor that reads as unmistakably
  Kenyan and does not collide with the existing audience colors.

## 2. Evidence Review
- Evidence for: all candidates pass >=3:1 UI contrast on the dark app surface
  (#020817) and white dashboard (dataviz validator). The audit itself named
  terracotta/ochre, savanna gold, forest green.
- Evidence against: no Voice-of-Customer data on Kenyan teacher color
  preference.
- Evidence we do not have: teacher reaction; real local photography (the
  non-color half of item #6).

## 3. Assumption Audit
| Assumption | Status | Validation plan |
|---|---|---|
| Earth-ochre reads as "Kenyan" to the audience | Likely | Confirm with Kangai pilot teachers |
| A new anchor won't confuse the audience-color map | Likely | Scope to school/neutral only |
| Terracotta is distinct enough from amber | Validated | Red-brown vs yellow-gold, different hue family |

## 4. Options
- Option A: Terracotta/ochre (#C65D3B, deep #A8431F) — Maasai ochre, murram roads, Rift soil.
- Option B: Savanna gold (#D98324) — too close to amber (teacher) → collision.
- Option C: Deep forest green (#2D6A4F) — collides with teal (family) + success-green.
- Do Nothing: amber stays the default.

## 5. Trade-off Analysis
Terracotta (A): highest distinctiveness (no collision), highest "Kenyan"
legibility, low eng cost (one token scale), low risk (additive). B and C fail
on collision with reserved colors. Do-nothing is zero-cost but forfeits the
differentiation the audit exists to create.

## 6. Second-Order Effects
6 months: recognizable non-generic identity on school/org surfaces. 1 year:
becomes "the EduNexus earth tone." 3 years: anchors a Kenyan visual language.
Technical-debt risk: low (token-based). Focus-dilution risk: low if confined to
the school/neutral role — the discipline to enforce.

## 7. Decision
- Recommended option: A — Terracotta/ochre, named `ochre` in code with a
  comment tying it to murram / Maasai ochre (naming-as-grounding).
- Why this one, now: only candidate with zero semantic collision + strongest
  local read; cheap and reversible as a token.
- Why not the others: B and C collide with existing reserved colors.
- Confidence: Medium-High — color theory and contrast are solid; only gap is
  teacher reaction, validatable at the pilot.
- Still missing: Kangai teacher reaction; local photography.
- Success is measured by: school/neutral surfaces stop defaulting to amber; a
  Kangai teacher recognizes the tone as "ours / Kenyan."

## 8. Learning Loop
(filled in after outcome — pending Kangai pilot reaction)
- Was it correct:
- What surprised us:
- Which assumptions were wrong:
- Should future decisions change:
