# Learner Blueprint — Kenyan School Evolution Audit

**Date:** 2026-08-03
**Type:** Product philosophy and evolution audit. Not implementation, not UI redesign, not an Educational Intelligence redesign, not a feature sprint. No code changed.
**Question this answers:** would a Kenyan Principal, reading this today, say *"this feels like a better report card"* — or *"this is an AI report I don't understand"*? Grounded directly in the real rendered labels of `components/blueprint/BlueprintView.tsx` and `blueprintNarrative.ts`, not a hypothetical redesign.

---

## 1. Executive Verdict

**The document mostly earns "better report card." The product's own name works against it.**

Every page title, every CBC badge, every section heading inside the four pages was checked against real Kenyan classroom vocabulary, and the overwhelming majority pass cleanly — Page 1's subject badges literally use KICD's own official rubric words ("Exceeding Expectations," "Meeting Expectations," "Approaching Expectations," "Below Expectations") rather than inventing new language, which is exactly right. The prose avoids "AI," "algorithm," "confidence score," and "prediction" entirely — confirmed directly, zero occurrences in either rendering file.

But the single word appearing most often on the page — in the header, the footer, and the document's own name — is **"Blueprint."** That is architecture/engineering language, not Kenyan school language. A Kenyan report card is a "Report Form," a "Progress Report," or an "End of Term Report." "Blueprint" is the one naming choice standing between this document and an unprompted "this feels familiar" reaction — and it's a naming choice, not a content problem, meaning it's fixable without touching a single fact the document reports.

Second finding, smaller but real: Page 4's career-journey link literally reads "Explore the full **Career Intelligence** journey →" — the one place internal product branding (the word "Intelligence") leaks directly into reader-facing text, in an otherwise disciplined document that never says "AI" anywhere else.

Third finding, structural not cosmetic: the CBC level system (`CBC_LEVEL_LABEL`, `BlueprintView.tsx`) is hardcoded to a 4-value scale (`1 | 2 | 3 | 4`, confirmed in `lib/learnerBlueprint/types.ts`), with no curriculum-aware branching found anywhere in the academic Projection pipeline. This is fine for a CBC-only school today; it is a real, concrete timelessness gap the moment an 8-4-4 or Cambridge school (both already named as `CurriculumType` values elsewhere in the platform) tries to use it.

---

## 2. Familiarity Audit

Walking every section a Kenyan reader actually sees, in document order:

| Section (as labeled on the page) | Kenyan-familiar? | Note |
|---|---|---|
| "Where We Stand Today" (Page 1 title) | **Yes** | Plain, warm, no jargon |
| CBC subject badges ("Exceeding Expectations" etc.) | **Yes, exactly** | Verbatim KICD rubric language — the single strongest familiarity choice in the whole document |
| "What the Evidence Suggests" (Page 2 title) | **Mostly yes** | "Evidence" is a slightly formal word for a parent, but not technical or AI-flavored — a reasonable, honest word, not a jargon risk |
| "Movement over time" (growth box) | **Yes** | Plain English |
| "What the teacher has noticed" (teacher reflection box) | **Yes, warm** | Reads like something a real teacher would say, not a system output |
| "How We Help Next" (Page 3 title) | **Yes** | Active, warm, service-oriented — arguably the best-titled page in the document |
| "The one thing that matters most right now" | **Yes** | Plain, urgent without being alarming |
| "Then, in order" | **Yes, simple** | |
| "What we're watching" (risk box) | **Yes** | Gentle, non-clinical framing of concern — avoids "risk," "flag," or "alert" entirely in the visible label |
| "What May Be Emerging" (Page 4 title) | **Mostly yes** | Slightly more abstract than Pages 1-3, but still plain English, no jargon |
| "Four ways this direction could open" (career doors) | **Yes** | |
| "How this field is changing" (AI-change box) | **Yes as a label**, but see §7 — the content inside sometimes needs to discuss AI/automation as a real career-relevant topic, which is different from the *system* sounding AI-generated |
| **"Learner Blueprint" (document title, repeated in header/footer)** | **No — the single weakest point** | Not used in Kenyan schools; reads as a tech/product name before it reads as an educational document |
| "Explore the full Career Intelligence journey →" | **No** | The one literal leak of internal branding ("Intelligence") into reader-facing text |
| "CONFIDENTIAL" / report ID footer | **Acceptable** | Formal but not alien — report cards commonly carry serials/stamps too |

**By count: 12 of 14 checked elements pass cleanly. The 2 that don't are both naming, not content — and both are one-line fixes, not redesigns.**

---

## 3. Evolution Roadmap

Mapped against what the composed data *actually* returns for a real, currently-enrolled learner (Victor Gitau, Grade 10, verified this engagement) — not a hypothetical:

| Section | Day One | After one term | After one year | Only after years of evidence |
|---|---|---|---|---|
| Identity (name, school, class, guardian) | ✓ | | | |
| Academic Record (CBC levels per subject) | ✓ (as soon as one assessment exists) | Richer (trend becomes computable, needs 2+ rounds) | | |
| Learning Compass (current focus) | ✓ | | | |
| Parent Summary | ✓ | | | |
| Risk / "What we're watching" | ✓ but usually empty early | Meaningful once enough evidence exists to compute a real signal | | |
| Growth Timeline / trajectory | | ✓ (needs 2+ temporally distinct assessment rounds by construction) | Richer with more rounds | |
| Teacher Reflection | Only if a teacher has published one | ✓ typically | | |
| Career direction (Page 4) | Degrades honestly to "still coming into focus" | | ✓ typically meaningful by here | Richer with more subject evidence |
| Portfolio / Achievement / Projects / Competitions / Leadership / Innovation | Empty, correctly hidden (confirmed live: all six were `unavailable` for a real Grade 10 learner with a normal evidence record) | | Starts appearing as items are actually published | Fullest once a learner has accumulated real extracurricular record |
| Blueprint History (cross-term comparison) | | | ✓ (needs at least two prior snapshots to be meaningful) | Richer over years |

**This is not a proposal — this is what the system already does.** Every "hidden until real" behavior above was confirmed against a real learner this engagement, not designed here. The prior Application Layer audit already named this as Projection Invariant behavior (`status !== 'available'` sections don't render, confirmed in `BlueprintView.tsx`'s own conditional gates). The mission's Part 2 concern — "should mature naturally, not arrive fully populated" — is **already true by construction**, which is the strongest single finding in this audit.

---

## 4. Permanent Blueprint Sections

Per the mission's own split, evaluated against what would actually break the document's identity if removed or fundamentally changed:

**Should remain permanent** (the "report card schools wish they had" core):
- Learner identity
- Academic picture (the CBC-badge grid — the one element every Kenyan reader will look for first, per §2)
- Learning story / narrative interpretation (currently the *unrendered* `composeLearningStory` field feeds this conceptually; the *rendered* equivalent is `describeAcademicPicture`/`describeVariation` — either way, "what does this mean in plain words" must never disappear)
- Recommendations ("How We Help Next" — the single priority action is the page's strongest feature and should never be diluted into a list)
- Evidence summary (in spirit — the *quantity* of evidence backing a claim, even if never a raw percentage, per the Evidence Trust findings of the Decision Experience audit)
- Parent guidance (Parent Summary headline)
- Teacher insight (Teacher Reflection box)

**May evolve freely without threatening the document's identity:**
- Portfolio, Projects, Leadership, Innovation, Competitions, Achievement (Page 4's "future evidence" grid — already designed to grow or shrink silently)
- Career Intelligence's depth (doors, AI-change framing, exploration suggestions — already gated by grade band, §6)
- Longitudinal trends (growth timeline, History view)
- Anything genuinely new a future capability adds (community contribution, wellbeing — noted in the prior Decision Experience audit as correctly, deliberately absent today) belongs here, never folded into the permanent core above.

---

## 5. Progressive Intelligence Plan

Mapped to the mission's own example ladder, against what's real today:

1. **Current performance** — ✓ live today (Page 1).
2. **Recommendations** — ✓ live today (Page 3's priority action).
3. **Learning patterns** — ✓ live today, but only in the page's prose (`describeVariation`), never presented as a labeled "pattern" concept — correctly folded into plain narrative rather than surfaced as a new UI concept.
4. **Capability development** — Exists as a real Projection concept (`capability.value.overallLevel`) but is **not shown anywhere in the rendered document** (confirmed — `composeLearningStory`, the field that reads it, isn't rendered by `BlueprintView.tsx` at all, per the prior Application Layer audit). This is the correct place for it to surface next, once a school is ready for a second layer of interpretation beyond CBC levels.
5. **Intervention history** — Exists as real data (Action Plan lifecycle) but has no learner-facing "here's what's been tried" summary in the document itself.
6. **Growth trajectory** — ✓ partially live today (the "Movement over time" box), but described in plain prose, not graphed or scored — the right level of maturity for where the audience is now.
7. **Career Intelligence** — ✓ live today, already the most "advanced" section in the current document, already correctly gated by grade band so it doesn't overreach for a Junior learner.
8. **Predictive insights** — **Correctly absent.** No predictive claim was found anywhere in the rendered document — every hedge word ("early signal," "may sharpen or change") exists specifically to avoid this. This is the ceiling this document should approach last, not first, exactly per the mission's own ordering.

**The document today sits almost exactly at rungs 1-3 and 6-7 of this ladder, skips 4-5 (data exists, not surfaced), and correctly refuses rung 8.** That's a coherent, defensible position for "Version 1," not a gap to rush closed.

---

## 6. Report Card Relationship

**What should remain familiar**: the subject-by-subject CBC-level grid (Page 1) is, functionally, a report card's core table — keep it exactly as central as it is today.

**What should replace the traditional report card**: the single biggest improvement over a traditional Kenyan report card is Page 3's one priority action — a typical report card lists marks and leaves interpretation entirely to the reader; this document does the interpretation. That's the genuine value proposition, and it's real, not aspirational.

**What should complement it, not replace it**: Career direction (Page 4) and the "future evidence" grid (Portfolio etc.) are additions a report card never had — correctly presented as a later page, after the familiar academic picture, not competing with it for the reader's first attention.

**What should only appear after schools become comfortable**: capability-level language (rung 4 above), intervention history, and any richer Coherence/confidence framing belong here — introduced only once a school has lived with the plain academic-picture-plus-recommendation version for a while.

**Nothing in the current document discards a familiar concept without replacing it with something at least as clear** — confirmed by the Academic Record grid's continued centrality; this audit found no removed report-card concept to flag.

---

## 7. Language Recommendations

Ranked by leverage, all naming-only, none requiring new logic:

1. **Rename the document itself**, or at minimum its externally-visible label, away from "Blueprint" toward something a Kenyan school already has a mental slot for — "Learner Report," "Progress Report," "Learner Record" are all closer to existing vocabulary while losing nothing about what the document actually contains. This is the single highest-leverage change in this entire audit — it touches three lines of display text (`BlueprintView.tsx`'s header/title/footer strings) and changes the reader's very first impression before they've read a single fact.
2. **Rewrite the one literal branding leak** — "Explore the full Career Intelligence journey →" — to something that describes the destination rather than naming the internal product ("Explore this direction further →" loses nothing).
3. Everything else audited in §2 already uses familiar language and needs no change — this is not a broad rewrite, it is two sentences.

---

## 8. Audience Understanding Audit

| Audience | Understands without explanation? | Basis |
|---|---|---|
| Principal | Yes | Confirmed directly in the prior Decision Experience audit's meeting simulation — read the real document aloud with no confusion |
| Teacher | Yes | Teacher Reflection box speaks in a teacher's own voice; nothing requires system knowledge to read |
| Parent | Yes, with the one caveat above | Parent Summary is plain and warm; the only stumble point is the document's own name, not its content |
| Learner | Yes | Career framing (Page 4) is hedged and age-appropriate; CBC badges are the same language used in class |
| Secretary | Likely yes, not directly tested this session | The document requires no institutional-admin knowledge to read — flagged as probable, not confirmed by direct simulation |
| Deputy Principal | Yes | Same reasoning as Principal — no role-specific technical knowledge required anywhere in the document |
| Board Member | Yes for the content, no for defending it under questioning | Matches the Decision Experience audit's Evidence Trust finding exactly: the *prose* is understandable to a board member, but if pressed on "how do you know," there's no on-page citation to point to — an audience-understanding pass, not a comprehension failure |

**No section anywhere in the rendered document requires AI knowledge or technical training** — confirmed directly, zero instances of "algorithm," "AI," "model," "confidence score," or "prediction" anywhere in either rendering file.

---

## 9. Timelessness Assessment

**CBC evolves**: the document's prose is largely resilient (plain-language description of strength/challenge, not tied to specific CBC terminology beyond the four rubric labels) — but `CBC_LEVEL_LABEL`/`CBC_LEVEL_ACCENT` (`BlueprintView.tsx:50-62`) are a hardcoded 4-value lookup keyed literally `1|2|3|4`. A CBC rubric revision that added or renamed a level would require a code change here specifically — a real, narrow, identifiable seam, not a systemic risk.

**8-4-4 disappears / another curriculum arrives**: `types/core.ts` already defines `CurriculumType = 'cbc' | '844' | 'igcse'` at the schema level — the platform already anticipates this. But `lib/learnerBlueprint/types.ts`'s `latestLevel: 1 | 2 | 3 | 4` and the academic Projection pipeline that computes it show no curriculum-aware branching found in this pass — meaning today, a non-CBC school's academic picture would either be silently forced onto a CBC-shaped scale or fail to render meaningfully. This is the single largest genuine timelessness gap this audit found, and it's structural, not cosmetic — worth a dedicated future architecture pass, not a quick fix.

**Cambridge / international schools adopt EduNexus**: the same gap applies, doubled — Cambridge doesn't use a 1-4 scale at all (IGCSE grades, Cambridge Primary "stages"). The document's *shape* (identity → academic picture → interpretation → recommendation → future direction) would still make sense to a Cambridge school; the *labels* inside the academic picture specifically would not, today.

**The document's identity survives all of these scenarios conceptually** — its four-question structure (where do we stand, why, what next, what's emerging) is curriculum-agnostic by design. Only the CBC-level display component is curriculum-coupled, and it's narrow enough to name precisely rather than treat as a systemic flaw.

---

## 10. Blueprint Evolution Philosophy

A four-version maturity ladder, each version a strict superset of the last — nothing in a later version removes or renames what a school already trusts from an earlier one:

**Version 1 — Simple** *(this is where the document is today)*: Identity, CBC academic picture, one priority recommendation, plain-language "what we're watching," warm parent summary, honest "not yet enough evidence" states wherever data is thin. Indistinguishable in *feel* from a very good report card. Ships under a renamed, familiar document title (§7.1).

**Version 2 — Richer**: Cross-term History (already real, currently one click away rather than front-and-center — promote it), the Portfolio/Achievement/Projects grid populated as real school life accumulates, capability-level language (§5 rung 4) introduced gently as a second interpretive layer alongside — never replacing — the CBC grid.

**Version 3 — Intelligent**: Intervention history made visible ("here's what's been tried, here's what worked"), growth trajectory graphed rather than only narrated, Learning Compass patterns surfaced explicitly rather than folded silently into prose. This is the version where the document starts to feel meaningfully smarter than a report card — but only after two versions of trust-building, never on Day One.

**Version 4 — Institution-wide Educational Intelligence**: the Principal Workspace / School Intelligence / Learner Directory funnel named in the immediately preceding audit becomes real, connecting many learners' Blueprints into a school-level decision system. Predictive framing remains deliberately withheld even here, per §5's rung 8 — "institution-wide" describes *reach* across learners, not a license to start predicting outcomes for any single one.

**Each version is additive.** A Version 4 school's Version-1-trained Principal should still recognize every page they learned to read three years earlier.

---

## 11. Final Readiness Score: **8/10**

**Content: 9/10.** The overwhelming majority of the document already speaks fluent, familiar Kenyan-school language, matures gracefully rather than arriving overwhelming, and structurally refuses to overreach into predictive or AI-flavored territory. The academic picture's CBC-literal labeling is the single best decision in the whole design.

**Held back by two small, named, fixable things**: the document's own name ("Blueprint") and one literal branding leak ("Career Intelligence" in a link) are the entire gap between "very good" and "excellent" on this audit's own terms. Both are naming-only. Per the mission's own success criteria — "the correct answer should always be 'this feels like a better report card'" — today's honest answer is *"almost entirely yes, with one word getting in the way before the reader even starts."*
