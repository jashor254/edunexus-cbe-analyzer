# Decision — Schemes / Term Planning Bundle Pricing & Drift Protection

Date: 2026-10-10
Status: DECIDED (Stage 8 open)
Engine: /decide

> DNA check: strengthens Gene 5 (Trust Compounds — honest, consistent pricing)
> and Gene 1 (Teacher-Centered — affordability for a teacher who has never
> paid us). Violates no gene. Proceeds.

---

## 1. Decision Definition

- **The decision, in one sentence:** What should the final Term Planning
  Bundle ("schemes bundle") price be, and how do we keep the pricing page
  truthful while that number is still provisional?
- **Why now:** The price is unfinalized (`lib/payments/config.ts` = KES 100)
  yet it already appears **as hardcoded prose** in three places on the
  pricing page — FAQ ×2 and the family comparison. The moment the number
  changes, the page contradicts itself. Self-contradiction is the exact tell
  that made the competitor site (McTaba Labs) read as vibecoded.
- **What happens if we do nothing:** We finalize the price later, update
  `config.ts`, the price *cards* update automatically, but the FAQ still says
  "KES 100" in prose → a visible contradiction on our most trust-sensitive
  page.
- **Desired outcome:** A defended final price for the anchor product, and a
  page that cannot drift from `config.ts` no matter how often the provisional
  number moves.

## 2. Evidence Review

- **Evidence for acting:**
  - `lib/payments/config.ts:127` — `TEACHER_KES_PER_TOKEN = priceKes / tokens`.
    The bundle price is **not a standalone number**: it is the anchor rate
    that *every other teacher tool* derives from (`config.ts:135`
    `priceKes = TOKEN_COSTS[feature] * TEACHER_KES_PER_TOKEN`). Change the
    bundle from 100 → X and Class Reports, Slides, Remedial, Holiday and the
    Insha Pack all re-price proportionally. This raises the stakes: it is a
    product-line pricing decision wearing a one-field disguise.
  - `app/(marketing)/pricing/page.tsx:212, 216` (FAQ) and `:660-661` (family
    comparison) hardcode "KES 100" / "KES 2,499" / "KES 15,000+" as literal
    text, bypassing the single-source-of-truth the price *cards* respect.
  - Architecture already rewards config-derivation: cards at `:132`, `:181`,
    `:491` read `TEACHER_PLANNING_BUNDLE.priceKes` live. The prose is the
    only leak.
- **Evidence against / for caution:**
  - KES 100 is memorable, frictionless, and the lowest plausible paid step —
    good for a first-ever paid action from a teacher.
- **Evidence we do not have:**
  - **Zero payment history.** Memory `project-academy-gap-research` records
    "0 payments ever." We have **no price-elasticity signal** — no teacher
    has ever paid any amount. Any claim that KES 100 is "too low" or "right"
    is an assumption, not evidence.
  - No Kangai pilot willingness-to-pay data yet (pilot onboarding in
    progress).

## 3. Assumption Audit

| Assumption | Status | Validation plan |
|---|---|---|
| Teachers will pay *something* per subject/term | Unknown | First Kangai paid cohort; watch first 10 real transactions |
| KES 100 is low enough to not block the first purchase | Likely | Below a single matatu fare; psychologically trivial |
| Re-pricing teacher tools off the bundle rate is acceptable | Validated | By design in `config.ts`; tools are proportional to token cost |
| Prose prices will drift when config changes | Validated | Confirmed: `:212/:216/:660` are literals, not interpolated |
| The page must look internally consistent to earn school/teacher trust | Validated | Gene 5; and the competitor comparison that triggered this |

## 4. Options

- **Option A — Keep KES 100 as the final price, and de-hardcode the prose.**
  Lock 100 now; make FAQ + comparison interpolate `config.ts`.
- **Option B — Defer the final number, but de-hardcode the prose now.**
  Treat 100 as provisional; remove every literal price from prose so the
  number can move freely without ever contradicting the page. Finalize the
  price after the first Kangai paid signal.
- **Option C — Raise/restructure the bundle price now** (e.g. KES 150–200),
  de-hardcode, accept the proportional re-price of all teacher tools.
- **Do Nothing —** leave 100 provisional AND leave the prose hardcoded.

## 5. Trade-off Analysis

| Option | Customer impact | Founder effort | Eng complexity | Cost | Risk | Flexibility | Strategic alignment |
|---|---|---|---|---|---|---|---|
| A Lock 100 + de-hardcode | Clear, cheap entry | Low | Trivial | — | Locks price with 0 elasticity data | Low (committed) | OK |
| B Defer + de-hardcode | Same as A to the user | Low | Trivial | — | Lowest — number stays free to move | **High** | **Best** — evidence-first (Gene 2) |
| C Raise now + de-hardcode | Higher first-purchase friction | Medium | Low | Re-prices tool line | High — raising a price we've never validated | Medium | Weak — no evidence to raise |
| Do Nothing | Future contradiction on trust page | None | — | — | High — vibecoded-tell on our own site | — | Violates Gene 5 |

## 6. Second-Order Effects (leading option: B)

- **6 months:** First real transactions give the elasticity data we lack
  today; the final price is set on evidence, not a guess. Page never
  contradicted itself in the interim.
- **1 year:** The bundle rate is the stable anchor the whole teacher tool
  line hangs off; changing it is a deliberate, documented act, not an
  accidental prose edit.
- **3 years:** Config-derived prose is the house norm — no price ever lives
  in two places.
- **Technical-debt risk:** Removed, not added (one fewer source of truth).
- **Trust risk:** Reduced — this is the whole point.
- **Focus-dilution risk:** None; ~20-minute change.

## 7. Decision

- **Recommended option: B — keep KES 100 provisional, de-hardcode every
  literal price in the pricing-page prose now, and finalize the number only
  after the first Kangai paid signal.**
- **Why this one, now:** We have *zero* payment evidence (Gene 2 says
  evidence sets direction, not optimism), so committing a final price today
  is premature — but the *drift risk is real today*. B removes the risk
  immediately while keeping the number free to move the moment we have a
  reason to move it. It costs ~20 minutes.
- **Why not the others:** A locks a price we can't yet defend. C raises a
  price we've never validated and drags the whole tool line with it —
  pure assumption. Do Nothing leaves the self-contradiction that started
  this.
- **Confidence: High** on the de-hardcode (verified, mechanical, pure
  upside). **Medium** on deferring the final number (correct discipline, but
  dependent on the pilot producing payment data on a known timeline).
- **Still missing:** Any real willingness-to-pay data. One honest paid
  transaction is worth more than this entire document.
- **Success is measured by:** (1) No literal price string remains in pricing
  prose — every price interpolates `config.ts`. (2) The final bundle price is
  set from the first ≥10 real teacher transactions at Kangai, not from a
  guess.

### Bias check
- **Perfectionism / anchoring:** KES 100 "feels right" only because it's the
  number already in the file — that's anchoring, not evidence. Naming it is
  why B (defer) beats A (lock).
- No sunk-cost or shiny-object pressure present.

## 8. Learning Loop (fill after first paid cohort)

- Was it correct:
- What surprised us:
- Which assumptions were wrong:
- Should future decisions change:
