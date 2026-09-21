---
name: decide
description: Structure a major EduNexus decision through the 8-stage Decision Engine (definition, evidence, assumptions, options incl. Do Nothing, trade-offs, second-order effects, decision, learning loop) and record it in docs/decisions/. Use for calls that are expensive to reverse, commit real time or money, or where the founder is visibly uncertain — product, pricing, GTM, partnerships, architecture, hiring. Not for routine daily calls. Triggers on /decide or "should we / should I" questions of that weight.
---

# /decide — Decision Engine

This engine does not make the decision. It structures it so incomplete
evidence, urgency, optimism, feature excitement, FOMO and hidden assumptions
are visible before they drive action.

`$ARGUMENTS` is the decision. If empty, ask for it in one sentence.

## Step 0 — Is this the right tool?

Reserve the full engine for decisions that are expensive to reverse, commit
real time or money, or where the founder is visibly uncertain. If the
decision is a small daily call, say so in one line and answer it directly in
three lines or fewer — running eight stages on a small call is the kind of
process overhead this company exists to avoid.

Then run the DNA Test from `docs/edunexus-dna.md` (read it, don't recall it):
- Does it strengthen at least one DNA gene?
- Does it violate any DNA gene?

A clear DNA violation ends here with ❌ and the gene named. Only genuinely
close calls continue.

## Step 1 — Gather real evidence before writing anything

Evidence is verifiable or it is an assumption. Before Stage 2, actually
look:

- `docs/edunexus-constitution.md`, `docs/edunexus-dna.md`,
  `docs/edunexus-company-roadmap-2026-2030.md` — the standing constraints
- `docs/decisions/` — has this or a neighbouring decision been made before?
- Growth Engine data (`growth_schools`, `growth_activities` via the
  `/growth` routes or Supabase) — real pilot, outreach and conversation
  counts when the decision touches sales or pilots
- The code — real implementation cost when the decision touches product
- Memory — Voice of Customer, Sales Playbook, Market Intelligence entries

If there is no evidence for a load-bearing claim, that absence is the
finding. Write "no evidence" — never fabricate a customer quote, a pilot
count, a cost estimate or a founder state to fill the stage.

## Step 2 — The eight stages, always in this order

```
## 1. Decision Definition
- The decision, in one sentence:      (if it can't be one sentence, split it
                                       and run the engine on each)
- Why now:
- What happens if we do nothing:
- Desired outcome:

## 2. Evidence Review
Verifiable only — customer conversations, pilot observations, engineering
metrics, financial data, usage, implementation cost, support history.
- Evidence for:
- Evidence against:
- Evidence we do not have:

## 3. Assumption Audit
| Assumption | Status | Validation plan (if Unknown) |
Status ∈ Validated / Likely / Unknown / Rejected. Unknowns get a plan, not
a guess.

## 4. Options
- Option A:
- Option B:
- Option C:
- Do Nothing:                          (always present, always evaluated)

## 5. Trade-off Analysis
| Option | Customer impact | Founder effort | Eng. complexity | Cost | Risk | Time | Maintainability | Strategic alignment | Flexibility |
No option is "best" without its trade-offs shown.

## 6. Second-Order Effects
For the leading option(s): 6 months / 1 year / 3 years; technical-debt
risk; trust risk; onboarding-complexity risk; focus-dilution risk.

## 7. Decision
- Recommended option:
- Why this one, now:
- Why not the others:
- Confidence:                          (Low / Medium / High — and why)
- Still missing:
- Success is measured by:

## 8. Learning Loop                    (filled in later, after outcome)
- Was it correct:
- What surprised us:
- Which assumptions were wrong:
- Should future decisions change:
```

## Bias check — name it when you see it

Actively call out, by name, any of these that may be shaping the call:
confirmation bias · sunk cost · recency bias · shiny-object · perfectionism ·
scope creep · founder attachment · fear-driven. One line each, only when
genuinely present.

## Step 3 — Record it

When Stage 7 is reached on a real (not hypothetical) decision, write the
journal entry to `docs/decisions/YYYY-MM-DD-<slug>.md` containing Stages 1–7
verbatim and an empty Stage 8. Create the folder on first use. Do not record
decisions that were only explored or abandoned before Stage 7.

When the user later reports the outcome, reopen that file and complete
Stage 8 — that is what makes the journal worth keeping.

## Final rule

Never confuse confidence with correctness. The strongest decision combines
evidence, reasoning, and the stated willingness to revisit it when reality
disagrees.
