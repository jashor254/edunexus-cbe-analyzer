# Sprint 12E — Learner Blueprint Layout and Experience Design Freeze

**Status: architecture only. No code, UI, PDF, QR generation, AI implementation, or domain integration was created or modified in producing this document.**

**Companion to**: `adr-0007-blueprint-layout-and-experience.md` (the binding decision — read that first). This document is the reference detail beneath it; the ADR governs wherever the two conflict.

---

## 1. Blueprint Cover Page

**Included, in fixed top-to-bottom order:**
1. School logo + school colours (top band)
2. Learner photo (if on file; graceful placeholder silhouette if not — never a broken image)
3. Learner name, Admission Number, Current Class, Academic Year, Current Term
4. Blueprint Version, Generated date, Last Updated date (provenance stamp, small, bottom corner — see §12)
5. QR verification code (proves this document is current — see §11)
6. School Motto (if configured)
7. Three one-line educational headline fields: **Educational Identity** label (or insufficient-evidence placeholder, per §9), **Learning Stage** (e.g. "CBC Junior — Grade 8"), **Growth Status** (one word: e.g. "Steady," "Accelerating," "Needs Support" — sourced from Academic Record's trend, not a new calculation)

**Explicitly excluded from the cover**: Learner Motto (not a field anything currently owns — deferred, not decided, until a domain is named for learner-authored content), **Current Readiness** as a standalone cover field (redundant with Growth Status and Learning Compass's own readiness label already shown in its own section — showing it twice risks the two drifting out of sync, so the cover shows only the aggregate Growth Status), any subject score, any full section content.

**Rationale**: the cover's only job is orientation — who is this, is this document current, what's the one-line educational headline. Anything more turns the cover into a second summary competing with Parent Summary (ADR-0006 §7), which already owns "understand the learner quickly."

**Future addition slot**: one reserved line beneath the headline fields for a future school-configurable "highlight" (e.g., a competition result) — not decided further this sprint.

---

## 2. Identity Section

**Order**: Learner name → Admission Number → School → Grade/Class → Academic Year/Term → Guardian summary (name + relationship, contact deferred to Parent Portal, out of scope).

**Layout**: single compact block, no more than 4 lines, immediately below the cover on the first content page (distinct from the cover itself — the cover is orientation, this section is the anchor for everything that follows).

**Fields**: exactly the six above, per ADR-0005 §2.1 — no additions.

**Visibility**: identical across all five audiences (Teacher/Parent/Learner/University/Employer) — Identity is the one section with no audience-scoping, since every audience needs the same anchor.

**Future additions**: a reserved line for a future "learner interests" field, contingent on a future domain owning that data — not decided further.

---

## 3. Academic Record

**Included**:
- Overall performance: one summary line (CBC level or equivalent) plus a small **sparkline** (single-line trend graphic, no axis labels, no gridlines) showing the last 3-4 terms — not a full chart. Dense bar/line charts with axes are explicitly excluded from paper; a full chart is a digital-only, QR-linked view (per §11).
- Subject performance: compact table, subject name + current level + one trend arrow (↑ stable → ↓) per subject. The trend arrow is Academic Record's own existing trend computation (already established by ADR-0006's Academic Record ownership), never a Blueprint-computed arrow.
- CBC competencies: top 2-3 competency highlights only, one line each, in plain language (not raw competency codes).
- Teacher observations: a **single cross-reference line** ("See Teacher Reflection →") — never a second copy of Teacher Reflection's text inside Academic Record. This prevents the exact duplication risk ADR-0006 Principle Two forbids.
- Published report cards: listed by term as citations only ("Term 2 2026 — published, view full report card →"), never re-rendered inline (per ADR-0005 §5, Blueprint references report cards, never recomputes them).
- Overall progression: one plain-language sentence synthesizing the trend (e.g., "steady improvement across three terms"), sourced from the same trend data as the sparkline, not a separate calculation.

**Word/visual budget on paper**: half a page maximum (per ADR-0006 §2.2), meaning at most: 1 summary line + 1 sparkline + subject table (max 8-10 rows, scrollable/paginated digitally if more subjects exist) + 3 competency lines + 1 cross-reference + report card citations + 1 progression sentence.

**Future extension points**: a reserved row for a future "subject-of-focus" highlight (tied to Learning Compass's Current Learning Focus, cross-referenced not duplicated) — not decided further.

---

## 4. Attendance

Extending ADR-0006 §5's five fields with exact word/colour budget:

| Field | Word budget | Colour rule |
|---|---|---|
| Attendance Trend | 1 word + arrow (mirrors Academic Record's arrow convention) | Neutral grey — trend alone is not a risk signal |
| Attendance Health | 1 short sentence (max ~10 words) | Green/amber/red **only paired with the text label**, never colour alone (accessibility — see §15) |
| Attendance Risk | shown only if genuinely at risk; 1 short phrase | Amber/red, always paired with Support Recommendation on the same line or immediately adjacent — never shown isolated (Educational Constitution Article V: risk predicts support needs, never worth) |
| Learning Time Lost | 1 phrase, digital only | No colour — factual statement |
| Support Recommendation | 1 short phrase, digital only, always paired with any visible Risk flag | No colour — actionable text |

**Paper**: Trend + Health only (2-3 lines total, per ADR-0006 §2.3's budget). **Digital**: adds Risk, Learning Time Lost, Support Recommendation. **Colour budget overall**: at most two colour-coded elements on the paper page (Health's colour, and Risk's colour if shown) — never a colour-saturated attendance block; colour is an accent, text always carries the actual meaning independently (WCAG-aligned, ties to §15).

---

## 5. Learning Compass

Fixed, exactly the five fields ADR-0006 §3 already named — no additions, no subtractions:

Holiday Programme (availability flag only) → Current Goal → Current Readiness (label, not score) → Current Learning Focus (one phrase) → Recommended Action (one phrase) → QR to full Compass.

**Layout**: single compact block, 3-4 lines on paper (per ADR-0006 §2.4), QR code placed at the end of the block, visually paired with a one-line call to action ("Continue your learning journey — scan to open Compass").

**Nothing more** — per the mission's explicit instruction, this section freezes the five fields and adds no sixth.

---

## 6. Career Intelligence

Fixed, exactly the five fields ADR-0006 §4 already named:

Career Cluster → Future Readiness (label) → AI Outlook (one line, hedged per confidence — Educational Constitution Article X, never framed as destiny) → Strength Snapshot (headline only) → QR to full report.

**Layout**: mirrors §5's treatment — compact block, 3-4 lines, QR with a call to action ("Explore careers matched to your strengths — scan to open").

**Nothing else** — same discipline as §5.

---

## 7. Teacher Reflection

- **Maximum length**: 6 lines total across the five subfields (Teacher Reflection opener, Strengths, Growth Area, Recommended Support, Parent Partnership, Holiday Focus — per ADR-0006 §6), roughly 1 sentence per subfield.
- **Minimum length**: each subfield requires at least a short phrase (not blank) before the reflection can be marked complete — an empty subfield is worse than no section at all, since it reads as the teacher having nothing to say about the learner.
- **Writing guide** (five prompting questions shown to the teacher while authoring, not shown in the final Blueprint): "What does this learner do well that evidence supports?" / "What's one specific area to grow?" / "What support would help most?" / "What could the parent do at home?" / "What's the focus for the coming holiday?"
- **Approval workflow**: teacher authors → teacher explicitly confirms/submits → reflection becomes visible in the Blueprint only after that confirmation (no auto-publish of a draft, no administrator override to publish on a teacher's behalf) — matches Educational Constitution Article VIII exactly.
- **Tone**: specific and constructive, per ADR-0006 §6/§8 — never generic, never judgmental language even in the Growth Area subfield.
- **Language**: plain language, no jargon, consistent with the same standard as Parent Summary (§8).
- **Future AI assistance**: AI may surface relevant evidence or suggest phrasing while the teacher drafts; final text is always the teacher's, confirmed by their own submit action — no AI-authored subfield may bypass the same approval workflow. Not implemented this sprint.

---

## 8. Parent Summary

**The 60-second read, operationalized as a fixed three-part template**:
1. One headline sentence: overall standing, plain language ("Amani is doing well and showing steady improvement this term.")
2. One detail sentence: the single most decision-relevant signal this term, drawn from whichever of Academic Record/Attendance/Teacher Reflection currently has the most relevant signal (per ADR-0006 §7) — never all three at once.
3. One action sentence: a concrete, specific thing the parent can do ("Encourage 20 minutes of reading most evenings" rather than "support your child's learning").

**Maximum**: half a page, three sentences plus the Identity anchor already shown above it — no bullet list of every section, no restating of Attendance/Academic Record/Compass/Career fields verbatim (those live in their own sections; Parent Summary synthesizes, it does not duplicate — Principle Two).

---

## 9. Educational Identity

- **Examples** (illustrative only, not an exhaustive taxonomy — final label set is an implementation-time decision, deliberately left open per ADR-0006 §9): Curious Explorer, Independent Learner, Creative Problem Solver, Persistent Builder, Collaborative Thinker, Reflective Learner.
- **Limitations** (must display alongside the label wherever shown, not buried in documentation): a one-line disclaimer — "Based on observed learning patterns, not a personality type. This can change as new evidence emerges."
- **Display rules**: the label is never shown alone — always paired with one short supporting evidence phrase (e.g., "Persistent Builder — returns to challenging problems until solved"). Never shown in a list ranking learners against each other. Never shown with a numeric score.
- **Confidence rules**: exactly three confidence bands — **Emerging** (early pattern, limited evidence), **Established** (consistent pattern across multiple evidence points), and no third numeric tier — never a percentage or raw confidence number shown to a parent/learner/teacher (Educational Constitution Article XI: label the confidence, don't expose a bare number). An internal/audit-only confidence value may exist in underlying data per ADR-0006 §9's evidence-sourcing rule, but it is never rendered directly.
- **Insufficient evidence behaviour**: if evidence is too sparse to support any label, Blueprint shows an explicit placeholder — "Still building an educational picture" — never a guessed label, never a blank space that reads as an error (Educational Constitution Article II).
- **Future evolution**: the label may change term to term as evidence accumulates; a future Growth Timeline entry (§10) may note a past label transition, but this is not decided or built this sprint.

---

## 10. Growth Timeline

**Belongs** (per ADR-0006 §10, given exact treatment here): academic milestones, achievements, attendance milestones, career discoveries, learning (Compass) milestones, teacher reflections — each rendered as one entry in a chronological visual strip (a horizontal or vertical milestone marker, not a dense log table).

**Treatment**: each entry = one date + one short label + one icon/category colour (category, not risk — a neutral colour-coding per domain, e.g. Academic/Attendance/Compass/Career/Reflection each get a distinct but neutral hue, never a red/amber/green risk palette on this section, since the Timeline celebrates trajectory, it does not flag risk).

**Maximum entries per event**: exactly one Timeline entry per underlying triggering event — no duplicate entries for the same evidence rendered from two domains' perspectives (e.g., a competency milestone that's also referenced in a teacher reflection produces one Timeline entry, cross-linked, not two).

**Scope this sprint**: digital-only (per ADR-0006 §10 and §2.8) — no paper rendering decided; a future condensed paper strip (3-5 entries) is a possible future decision, not made here.

**Future additions**: entries from any of the fourteen reserved future modules (§17) once implemented, following the same one-entry-per-event rule.

---

## 11. QR Experience

Nine named destinations, each mapped to exactly one owning domain's own existing or future surface — Blueprint never renders a QR that points at a Blueprint-internal page restating domain data:

| QR destination | Owning surface | Status |
|---|---|---|
| Learning Compass | Compass's own live session/dashboard surface | Existing domain |
| Career Intelligence | Career Intelligence's own full report surface | Existing domain |
| Portfolio | Portfolio's own surface | Reserved future module (§17) |
| Projects | Projects' own surface | Reserved future module (§17) |
| Innovation | Innovation's own surface | Reserved future module (§17) |
| Evidence Trail | Evidence domain's own surface (once a learner/parent-facing evidence view exists) | Indirect-only per ADR-0005 §3 — QR reserved, not built |
| Digital Transcript | Academic Record's full historical view (a digital-only extension of §3, not a new domain) | Existing domain (extended view) |
| Holiday Programme | Learning Compass's holiday programme surface | Existing domain |
| Future Skills | reserved, no owning domain named yet | Reserved future module (§17) |

**Rule**: a QR destination with no owning domain yet (Portfolio, Projects, Innovation, Future Skills) is a reserved slot in the Blueprint's QR layout, not an active QR — it renders as absent/greyed until its owning domain exists, never as a broken link.

---

## 12. School Branding and Provenance

- **School colours**: applied to the cover band and section header rules only — never to body text or data (colour-as-decoration, not colour-as-meaning, distinct from §4's risk-colour rule).
- **Logo placement**: top-left of the cover, fixed position across all curriculum variants (§13).
- **Watermark**: a light, non-intrusive school-crest watermark on every printed page, primarily an authenticity/anti-forgery cue, never obscuring content.
- **Verification QR**: proves the document is current as of its Generated/Last Updated stamp — links to a verification surface that confirms "this Blueprint Version, generated this date, is authentic and current." This is provenance, not a new data domain.
- **Digital signature**: a cryptographic/system-level provenance marker (mechanism not decided this sprint — implementation detail), distinct from the human signature blocks below.
- **Principal signature / Teacher signature / Official stamp**: reserved signature blocks on the printed cover or closing page, human-authored/approved artifacts (mirrors Teacher Reflection's approval workflow, §7) — not auto-generated, not decided further this sprint (whether digital or wet-ink signature is an implementation-time decision).

**Rule restated from the ADR**: none of the above is a new data domain — all provenance/branding, presentation of existing school/actor identity, never a computation.

---

## 13. Curriculum Variants

**One architecture, differently rendered:**

| Variant | Rendering difference |
|---|---|
| CBC Junior (Grade 7-9) | Full section set; Academic Record emphasizes competencies over raw levels; Career Intelligence shown as broad career-family exploration (per existing Junior/Senior gating already established in Career Intelligence's own domain) |
| CBC Senior (Grade 10-12) | Full section set; Career Intelligence shown as specific pathway matches; Academic Record includes pathway-readiness framing |
| 8-4-4 (Form 3-4) | Academic Record adapted to 8-4-4 grading terminology; other sections unchanged |
| International Schools (general) | Same section set; branding/terminology adapts to school configuration (§12) |
| Cambridge (future, reserved) | Academic Record's subject/level terminology adapts to Cambridge's own grading; no other change decided |
| IB (future, reserved) | Academic Record's terminology adapts to IB's own assessment language; no other change decided |

**Rule**: variance is confined to which sections appear (e.g., Career Intelligence's Junior/Senior emphasis, already an existing Career Intelligence domain decision, not a new Blueprint one) and terminology/emphasis within a section — never to ownership (§3 of ADR-0005 is curriculum-invariant) or computation (each domain's own calculation is unchanged by curriculum; only its presentation label changes, e.g. "CBC Level 4" vs. a future Cambridge grade letter).

---

## 14. Audience Views

One Blueprint, five audience-scoped views — extending ADR-0006 §12's reading *order* into full visibility rules:

| Section | Teacher | Parent | Learner | University | Employer |
|---|---|---|---|---|---|
| Cover + Identity | full | full | full | full | full |
| Academic Record | full | full | full (learner-toned) | full (historical emphasis) | summary only |
| Attendance | full (incl. Risk/Support) | Trend + Health only | Trend only, encouraging tone | Trend only, aggregate | not shown |
| Learning Compass | full | full | full (motivational tone) | not shown | not shown |
| Career Intelligence | full | full | full (motivational tone) | full | full |
| Teacher Reflection | full (own + history) | full | learner-safe reframing (per ADR-0006 §8) | not shown | not shown |
| Parent Summary | shown (context) | full (primary entry point) | not shown | not shown | not shown |
| Educational Identity | full | full | full | shown (label + evidence phrase only) | shown (label + evidence phrase only) |
| Growth Timeline | full | full | full | full | summary only |

**Rule**: this table decides *visibility*, never a second Blueprint — one underlying document, one data source per section, rendering rules applied at view time. No audience-specific data is computed separately; the same live/snapshot data (per ADR-0005 §6) is filtered, not recalculated, per audience.

---

## 15. Printing Rules

- **Default/canonical format**: A4 portrait — the reference format every other rendering derives from.
- **Booklet**: a secondary rendering (multi-page fold), same content, repaginated — decided as a *future* rendering option, not built this sprint.
- **Digital-only**: the full-depth rendering (all QR destinations active, Growth Timeline visible, full Academic Record history) — the canonical "true" experience; paper is always a subset of digital, never the reverse.
- **Landscape**: not adopted — portrait is the fixed orientation for consistency with standard school report conventions.
- **Black & White**: the entire design must remain legible and meaningful in black & white — every colour-coded element (Attendance Health/Risk, §4; branding, §12) must carry its meaning in text/pattern/icon independent of colour, not colour alone. This is a hard design constraint, not a nice-to-have, restated as binding.
- **Colour**: used only as an accent/aid (Health/Risk pairing, branding, Timeline category hues) — never the sole channel of meaning, per the Black & White rule above.
- **Accessibility**: digital rendering must meet WCAG-aligned contrast/alt-text/screen-reader-order standards; the black-and-white-safe design directly serves low-vision/colour-blind accessibility as well as print economics.

---

## 16. Mobile Experience

**Single governing rule**: the same section ownership and content applies on every device — only layout density changes, never truth. A phone view collapses each section into an expandable card (Cover/Identity always expanded, other sections collapsed by default, tap to expand); a tablet/desktop portal view shows more sections expanded by default given the larger viewport; the PDF export is the fixed A4 rendering (§15) regardless of the device that requested it; offline behaviour shows the most recently synced snapshot with a visible "last updated" timestamp (reusing the provenance stamp, §1/§12) rather than a blank or error state, and clearly marks itself as potentially stale until reconnected.

**No device gets a different data subset** — a phone user sees the same Attendance Risk flag a desktop user does; only how much is expanded by default differs.

---

## 17. Future Modules (reserved, no implementation)

**Canonical list, frozen by Sprint 12J per the Sprint 12J-A consistency review's Finding 3 — this is now the one list every future document cites, by name and count, replacing every prior partial/miscounted enumeration:** Behaviour, Wellbeing, Portfolio, Innovation, Projects, Community Service, Leadership, Entrepreneurship, Competitions, Sports, Arts, AI Skills, Digital Literacy, Scholarships, Global Certifications, future AI tutors, future University pathways, future Employment Record, lifelong learning — **19 items.**

Each reserved as a future section-slot (following ADR-0006 §14's pattern: purpose/owner/audience/paper-or-digital/freshness/QR/size, to be filled in by its own future ADR when that domain is built) and as a potential future QR destination (§11) and Growth Timeline entry source (§10). No schema, calculation, or display rule decided for any of these nineteen here.

---

## 18. Final Educational Walkthrough

**Teacher**: opens Blueprint from the class roster → sees Cover (learner photo, Growth Status headline) → Identity confirms the right learner → scans Academic Record for current standing and the trend sparkline → checks Attendance (full detail, including any Risk/Support flags — this is the one audience seeing full Attendance detail) → reviews their own prior Teacher Reflection entries before writing a new one, guided by the five writing-guide prompts (§7) → glances at Learning Compass to confirm the learner's next recommended action aligns with what they'll suggest in the reflection → closes having both informed themselves and contributed to the record.

**Parent**: opens Blueprint (likely via a portal link or printed copy sent home) → Parent Summary is the very first content read after Identity (§14's reading order) → three sentences tell them how their child is doing, what matters most this term, and one thing to do → if they want more, they continue to Academic Record (full) and Attendance (Trend + Health only, no alarming Risk language unless genuinely present and paired with Support) → Learning Compass and Career Intelligence snapshots give forward-looking context, each with a QR if they want to go deeper on their phone → closes in under a few minutes with a clear, non-jargon understanding and no sense of being handed a raw scorecard.

**Learner**: opens Blueprint (likely digital, on their own device or with a teacher/parent) → sees their own photo and Educational Identity label with its supporting evidence phrase, framed as recognition, not evaluation → Learning Compass's Recommended Action gives them something concrete to do next → Career Intelligence's snapshot is framed motivationally, "careers matched to your strengths," never as pressure → Academic Record is shown in learner-toned language (encouraging, growth-framed) → Growth Timeline (if built) lets them see their own trajectory, reinforcing "every learner can improve" (Educational Philosophy, ADR-0006 §13) → closes feeling seen and guided, never judged.

**University**: receives Blueprint (likely digital, possibly as part of an application) → Identity anchors the learner → Academic Record's full historical depth and CBC competency summary is the primary content, giving a multi-term view no single report card provides → Career Intelligence's snapshot (full detail for this audience) shows evidenced strength areas and interest signals, framed as possibility not destiny (Article X) → Growth Timeline (full, per §14) shows sustained trajectory rather than a single snapshot → Attendance and Learning Compass session detail are not shown at all — this audience needs standing and trajectory, not day-to-day support mechanics → closes with an evidence-grounded, multi-year picture of the applicant beyond a single transcript.

**Employer**: receives Blueprint (likely a graduate/school-leaver context) → Career Intelligence's snapshot is the primary entry point (§14's audience-first ordering, inverse of University's emphasis) → Academic Record shown as summary only (overall standing, not subject-by-subject depth) → Growth Timeline (summary) shows trajectory and sustained achievement → Attendance and Learning Compass are not shown → closes with a career-signal-first, evidence-grounded read that avoids either overclaiming ("this person will definitely succeed at X") or underrepresenting the learner's demonstrated growth.

---

## Verification Checklist

- Every section has one owner (Cover/Branding/QR-experience explicitly declared non-owning, presentation-only) — §1, §11, §12.
- No duplicated ownership — confirmed throughout; every layout decision operates on already-owned data.
- QR destinations defined — §11, nine named, each single-owner-mapped.
- Report Card remains independent — §3 (citation-only), unchanged from ADR-0005 §5.
- Attendance remains independent — §4 (presentation-only over Attendance's published summary), unchanged from ADR-0004 §4.
- Learning Compass remains independent — §5 (five fixed fields, QR to full experience), unchanged from ADR-0006 §3.
- Career Intelligence remains independent — §6, unchanged from ADR-0006 §4.
- Educational Constitution compliance — Articles II, V, VIII, X, XI each cited against a specific decision (§4, §7, §9, §15).
- ADR-0003/0004/0005/0006/RAS compliance — restated, not amended, throughout.

---

## Stop Condition

Per explicit mission instruction: this document, ADR-0007, and the implementation-log entry are the complete deliverable. **Stop here.** No Blueprint UI, PDF, QR generation, AI implementation, or domain integration begins. Wait for explicit approval before the first Blueprint implementation sprint.
