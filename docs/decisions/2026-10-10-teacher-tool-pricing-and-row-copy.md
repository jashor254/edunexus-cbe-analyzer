# Decision — Teacher-Tool Pricing Realism & Record-of-Work Copy Honesty

Date: 2026-10-10
Status: DECIDED (Stage 8 open)
Engine: /decide
Sibling: 2026-10-10-schemes-planning-bundle-pricing.md (this is the
"bundle contents / attached products" follow-up it flagged)

> DNA check: strengthens Gene 5 (Trust — stop claiming automation we refuse
> to do; stop pricing below cost) and Gene 2 (Evidence). No gene violated.

Founder input (verbatim intent, 2026-10-10):
- "the scheme flow is perfect" — SOW → one-week lesson plans → Record of Work
  is the correct, intended flow. Not in question.
- "the record shouldn't be produced before a lesson is taught."
- "the pricing to some products wasn't [realistic]."

This splits into TWO decisions, same root cause (one mechanical rate).

---

## 1. Decision Definition

- **In one sentence:** (A) Should the Record-of-Work *marketing copy* keep
  claiming the record is "kept up to date for you," and (B) should the
  attached teacher tools keep being priced off the single scheme-bundle
  token rate, or be priced per their own value/cost?
- **Why now:** Pilot (Kangai) is onboarding and prices are provisional — the
  cheapest moment to correct both before a teacher pays against a false
  promise or we sell a tool below its AI cost.
- **If we do nothing:** We ship copy that contradicts our own architecture
  (ADR-0032), and we keep a price table where a whole term of planning
  costs the same as one slide deck and 40 marked essays cost KES 2.50 each.
- **Desired outcome:** Copy that matches what the product actually does;
  prices that track value and stay above cost.

## 2. Evidence Review

- **Evidence for (A) — the RoW copy is false:**
  - `lib/row/recordOfWork.ts:20-27` + ADR-0032 §3: "A Record of Work is the
    teacher's record of *actual teaching*… Automation may create
    structural/planning metadata; it may **never** touch the fields the
    teacher authored." `TEACHER_OWNED_ENTRY_FIELDS = date_taught, reflection,
    remarks` are enforced-empty until the teacher fills them *after* teaching.
  - Marketing says the opposite: pricing page `:129` "Record of Work — kept
    up to date **for you**"; `:485-486` "the Record of Work keeps itself up
    to date **behind you**"; teachers page similar. The system deliberately
    does NOT do this. The copy oversells automation of teacher-authored
    evidence — and would, if believed, invite a teacher to treat a
    pre-filled record as a true record of teaching that never happened.
  - This is the founder's point "the record shouldn't be produced before a
    lesson is taught" — the product already honours it; only the copy breaks
    it.
- **Evidence for (B) — the derived prices are unrealistic:**
  - `lib/payments/config.ts:127` — one rate (`TEACHER_KES_PER_TOKEN = 50`)
    drives every teacher tool (`:135`). At 2 tokens each, these all land at
    KES 100: Scheme Bundle (a full term), Lesson Slides (one deck), Remedial
    Plan (one class), Class Reports (**every** learner in a class), Insha
    Pack (**40** essays). Holiday Plan is KES 50.
  - Consequences the rate can't see: (i) a full term of planning = one slide
    deck in price; (ii) Insha Pack = KES 2.50/essay, below plausible AI
    marking cost; (iii) Class Reports scales per-learner in cost but is flat
    in price.
- **Evidence we do not have:**
  - **Per-feature AI cost.** We have no logged KES cost per
    `slides_generate` / `kiswahili_insha_pack` / `class_reports_generate`
    call. Without it we cannot prove which tools are below cost — only that
    the flat rate makes it likely. (CLAUDE.md requires token-usage logging;
    this is where to read it.)
  - **Any willingness-to-pay data.** 0 teacher payments ever
    (project-academy-gap-research).

## 3. Assumption Audit

| Assumption | Status | Validation |
|---|---|---|
| RoW is teacher-authored, not machine-written | Validated | ADR-0032 + code |
| The copy currently claims otherwise | Validated | pricing/teachers page strings |
| Flat token rate under-prices high-cost tools (insha, class reports) | Likely | True per-call AI cost not yet read from logs |
| Mechanical derivation was chosen for internal consistency, not value | Validated | config.ts:118-127 comment |
| Teachers perceive these tools as equal value at equal price | Rejected | A term plan ≠ one slide deck |

## 4. Options

**(A) RoW copy**
- A1 — Rewrite copy to "a Record of Work that fills its structure from your
  plan — you confirm what you actually taught." (truthful; keeps the
  time-saving benefit that is real)
- A2 — Delete the RoW line from the bundle sell entirely.
- Do Nothing — keep "kept up to date for you."

**(B) Attached-tool pricing**
- B1 — Keep mechanical derivation (status quo).
- B2 — Decouple: set each attached tool's price independently from a
  value + floor-above-AI-cost basis; keep only the Scheme Bundle on its own
  number. (Requires reading per-feature AI cost first.)
- B3 — Keep derivation but raise the per-tool token counts so cost-heavy
  tools (insha, class reports) cost more — a cheaper partial fix.
- Do Nothing — flat KES 100 everything.

## 5. Trade-off Analysis

| Option | Customer impact | Eng effort | Risk | Flexibility | Alignment |
|---|---|---|---|---|---|
| A1 rewrite | Honest, still attractive | ~15 min copy | None | High | Best (Gene 5) |
| A2 delete | Loses a real benefit | low | mild under-sell | — | OK |
| A Do Nothing | False promise on trust page | none | High | — | Violates Gene 5 |
| B1 status quo | Some tools below cost | none | High (margin) | Low | Weak |
| B2 decouple | Prices match value | Medium — needs cost data | Low | High | Best |
| B3 raise tokens | Partial correction | Low | Medium | Medium | OK interim |
| B Do Nothing | Possible per-use losses | none | High | — | Weak |

## 6. Second-Order Effects (leading: A1 + B2)

- **A1:** Removes a copy/architecture contradiction permanently; the real
  benefit (structure pre-filled from the plan, teacher confirms) is still
  sold, just truthfully.
- **B2:** Breaks the "one rate" elegance — tools become individually
  reasoned. That is *more* maintenance but *correct*; a flat rate that
  silently loses money per insha pack is worse debt than a few explicit
  prices. Needs the AI-cost logging CLAUDE.md already mandates, so it also
  forces that gap closed.
- 1yr: margin per tool becomes knowable; pricing stops being an accident of
  token arithmetic.

## 7. Decision

- **Recommended:**
  - **(A) → A1 now.** Rewrite the Record-of-Work copy everywhere to stop
    claiming automatic maintenance; state that the teacher confirms actual
    teaching. Zero-cost, pure trust gain, aligns copy with ADR-0032.
  - **(B) → B2, gated on evidence.** Decouple attached-tool prices from the
    scheme-bundle rate — but first **read per-feature AI cost from the
    token-usage logs** and set each tool's price on value + a floor above its
    cost. Interim: if a tool is provably below cost before that work lands
    (insha pack is the prime suspect), apply B3 to that one tool only.
  - The **Scheme Bundle price stays provisional** per the sibling decision —
    this decision does not set it; it stops *other* products from being
    dragged to it by arithmetic.
- **Why now:** A1 is free and removes a live false claim. B2 is the correct
  structure but must not be done on a guess — hence gated on cost data we are
  already required to log.
- **Why not the others:** B1/Do-Nothing keeps probable per-use losses and a
  price that ignores value. A2 throws away a real benefit.
- **Confidence:** High on A1 (verified contradiction). Medium on B2 (right
  direction; blocked on reading AI-cost logs we haven't pulled yet).
- **Still missing:** Per-feature AI cost per call; any willingness-to-pay.
- **Success measured by:** (1) No marketing string claims the RoW maintains
  itself. (2) Every attached tool's price is justified by a logged cost floor
  and a value rationale, not by `TOKEN_COSTS × 50`.

### Bias check
- **Engineering-elegance attachment:** the single-rate derivation is
  *pretty* (config.ts comment even celebrates it) — that elegance is why
  mispricing went unnoticed. Naming it is why B2 beats B1.

## 8. Learning Loop (after first paid cohort / cost read)

- Was it correct:
- What surprised us:
- Which assumptions were wrong:
- Should future decisions change:
