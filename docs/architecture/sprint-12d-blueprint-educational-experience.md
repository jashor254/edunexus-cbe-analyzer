# Sprint 12D — Learner Blueprint Educational Experience (Design Freeze)

**Status: architecture only. No code, table, migration, repository, service, route, or UI was created or modified in producing this document.**

**Companion to**: `adr-0006-blueprint-educational-experience.md` (the binding decision — read that first for the Core Question, the three Principles, and the Constitutional grounding). This document is the reference detail beneath it — every table and rationale here is non-binding narrative *except* where it restates a rule ADR-0006 already states as binding, in which case the ADR governs.

---

## 1. Core Question, restated

Within five minutes, a reader of the Blueprint should understand **who this learner is becoming** — an evidence-grounded trajectory, not a static scorecard. Every section below is scoped by asking: does this field help answer that question, or does it belong to some other domain's own deep experience.

---

## 2. Section-by-Section Review

For each section: Purpose, Owner, Audience, Paper or Digital, Snapshot or Live, QR or Full Content, Maximum recommended size, Reason for inclusion.

### 2.1 Identity
- **Purpose**: ground every other section in who this learner is and where — without this, nothing else is interpretable.
- **Owner**: Core (School/Class/Guardian domains).
- **Audience**: all five (Teacher, Parent, Learner, University, Employer) — universal entry context.
- **Paper or Digital**: Paper (always present, minimal).
- **Snapshot or Live**: Live (current enrollment state).
- **QR or Full**: Full content — this is inherently short, nothing to defer.
- **Maximum size**: 3-4 lines.
- **Reason for inclusion**: without name/school/class/guardian context, every other section is unanchored.

### 2.2 Academic Record
- **Purpose**: show current standing and trajectory, not just the latest score.
- **Owner**: Assessments domain, via the Projection Engine (per ADR-0006 §"Decisions Summary" item 1 and ADR-0005 §2.2 — must read via `recomputeLearnerProjection()`, never a direct Operating-Layer table).
- **Audience**: all five, but depth varies — a Teacher/Parent wants subject detail; a University/Employer wants the growth trend and CBC competency summary, not raw marks.
- **Paper or Digital**: Paper (summary: overall performance, growth trend, 1-2 sentence competency highlight) + Digital (full subject-by-subject breakdown, historical performance).
- **Snapshot or Live**: Live.
- **QR or Full**: Paper carries the summary directly (no QR needed for something this central); a QR to the full historical breakdown is optional, not required.
- **Maximum size**: half a page on paper.
- **Reason for inclusion**: this is the closest thing to "how is this learner doing academically" — central to the Core Question, cannot be QR-only.

### 2.3 Attendance Summary
- **Purpose**: answer "is this learner present enough to learn" — educational, not administrative (§5 below expands this).
- **Owner**: Attendance domain — Blueprint reads only Attendance's own published summary (ADR-0005 §2.3, ADR-0004 §4).
- **Audience**: Teacher, Parent primarily; University/Employer see only the paper-level trend, not risk detail.
- **Paper or Digital**: Paper (Attendance Trend, one-line Attendance Health statement) + Digital (Attendance Risk detail, Learning Time Lost breakdown, Support Recommendation).
- **Snapshot or Live**: Snapshot (Attendance's own published summary, not per-record live computation inside Blueprint).
- **QR or Full**: Paper summary is full-content (short enough not to need deferral); Support Recommendation and Learning Time Lost detail can be QR-linked if the paper summary alone doesn't fit.
- **Maximum size**: 2-3 lines on paper.
- **Reason for inclusion**: attendance is learning time — its educational meaning, not its administrative tally, belongs in a document about who the learner is becoming.

### 2.4 Learning Compass
- **Purpose**: show what the learner is actively working on right now and what's next — not the mechanism.
- **Owner**: Learning Compass — Blueprint never recalculates (ADR-0005 §2.4, ADR-0006 Principle Two).
- **Audience**: Teacher, Parent, Learner — University/Employer generally don't need this section at all (§12 reading order).
- **Paper or Digital**: Paper (Current Learning Focus, Learning Readiness label, one-line Next Recommended Action, Holiday Programme availability flag) + Digital via QR (full Compass session, mastery map, practice history, AI tutoring).
- **Snapshot or Live**: Live.
- **QR or Full**: QR to full Compass experience — mandatory, not optional (§3 below explains why).
- **Maximum size**: 3-4 lines on paper.
- **Reason for inclusion**: shows the learner is actively supported and has a next step, without turning Blueprint into a second Compass.

### 2.5 Career Intelligence
- **Purpose**: one forward-looking signal, not a career report.
- **Owner**: Career Intelligence — one insight only (ADR-0005 §2.5, ADR-0006 Principle Two).
- **Audience**: Learner (motivational), Parent (context), University/Employer (the highest-value section for these two audiences — §12).
- **Paper or Digital**: Paper (Emerging Career Cluster, Strength Profile headline, one-line AI Outlook, Future Readiness label) + Digital via QR (full career match report, alternative pathways, market data).
- **Snapshot or Live**: Live.
- **QR or Full**: QR mandatory for anything beyond the four headline fields (§4 below).
- **Maximum size**: 3-4 lines on paper.
- **Reason for inclusion**: signals trajectory without overclaiming a fixed destiny (Educational Constitution Article X).

### 2.6 Teacher Reflection
- **Purpose**: a specific, current adult's read on this specific learner — the section a generic school report never has.
- **Owner**: the learner's current teacher, at time of writing (snapshot).
- **Audience**: Parent primarily, Learner secondarily, Teacher (next term's teacher reading the prior one's reflection).
- **Paper or Digital**: Paper — this section's whole value is being short and specific enough to read on paper.
- **Snapshot or Live**: Snapshot (§6 below).
- **QR or Full**: Full content, no QR — deferring a human's reflection behind a QR code would defeat its purpose.
- **Maximum size**: 5-6 lines total across its five subfields.
- **Reason for inclusion**: the one section that is unambiguously a human, not a system, speaking about the learner — anchors the whole Blueprint as an educational document, not a dashboard printout.

### 2.7 Parent Summary
- **Purpose**: let a busy parent understand the learner in under a minute.
- **Owner**: none independently — presentation transform over the sections above (ADR-0005 §2.8).
- **Audience**: Parent, exclusively.
- **Paper or Digital**: Paper.
- **Snapshot or Live**: inherits its sources' freshness, must not claim a different "as of" time (ADR-0005 §6).
- **QR or Full**: Full content — this section exists specifically so a parent doesn't have to scan anything.
- **Maximum size**: half a page (§7 below).
- **Reason for inclusion**: without a dedicated plain-language section, a busy parent reads nothing, defeating the whole document's purpose for that audience.

### 2.8 Growth Timeline
- **Purpose**: show trajectory over time, not a single moment.
- **Owner**: none independently — composes milestones from every domain above (ADR-0005 §2.9).
- **Audience**: Parent (long-view), Learner (motivational — "look how far I've come"), University (multi-year pattern).
- **Paper or Digital**: Digital only at first implementation (future extension point — not built this sprint); a future paper rendering would be a condensed 3-5 milestone strip at most.
- **Snapshot or Live**: Live, append-only (each milestone is itself a snapshot at the moment it occurred, but the timeline view is always current).
- **QR or Full**: QR from paper to the full digital timeline once built.
- **Maximum size**: not applicable this sprint (reserved, not implemented — §10).
- **Reason for inclusion**: the single clearest expression of "who this learner is becoming" as a trend rather than a point-in-time — the most direct answer to the Core Question, deferred to a future sprint deliberately so the other sections are solid first.

---

## 3. Learning Compass Integration — what belongs and why

**Belongs**: Current Learning Focus, Learning Readiness, Holiday Programme Available (flag), Next Recommended Action, QR code to full Compass.

**Never belongs**: adaptive lesson content, practice history, AI tutoring transcripts, mastery maps, individual learning sessions.

**Why**: Compass is an ongoing, session-based, deeply interactive experience — its value is in the interaction, not a static summary of it. Reprinting practice history or a mastery map inside Blueprint would (a) violate ADR-0006 Principle Two — Blueprint would be re-presenting Compass's internal state at a level of detail only Compass itself should own, risking staleness the moment the learner's next session changes it, and (b) defeat Principle Three — a mastery map or session transcript cannot be made concise without losing its meaning, so it does not belong on paper and doesn't need to on digital either, since Compass's own surface already renders it. Blueprint's job is to prove the learner *is* being supported and show the single most useful next step — not to be a second window into Compass.

---

## 4. Career Intelligence Integration — what belongs and why

**Belongs (maximum one concise snapshot)**: Emerging Career Cluster, Strength Profile (headline only), AI Outlook (one line), Future Readiness (label), QR code to the full report.

**Never belongs**: the full career match list, alternative pathway comparisons, market/salary data, the complete AI-generated career narrative.

**Why the rest belongs elsewhere**: Career Intelligence's full report is itself a considered, evidence-graded document (per `sprint-23-canonical-consolidation`'s hardened AI-grounding rules) meant to be read and explored at its own pace, with its own confidence framing per career. Compressing it into Blueprint would either truncate that framing (misrepresenting confidence, violating Educational Constitution Article XI) or bloat Blueprint into exactly the "career report" ADR-0006 Principle Three and the mission explicitly forbid. A single snapshot plus a QR code preserves both: Blueprint stays a five-minute read, and the full report stays intact and correctly framed on its own surface.

---

## 5. Attendance Integration — educational, not administrative

**Framing principle**: the numbers Attendance already computes (present/absent/percentage) exist administratively inside Attendance itself; Blueprint's job is to translate them into what they mean for learning, per the Core Question.

| Field | Meaning | Paper / Digital / QR |
|---|---|---|
| Attendance Trend | improving / stable / declining, over the recent period | Paper |
| Attendance Health | one-line plain-language read ("consistently present," "a few missed weeks," "attendance needs attention") | Paper |
| Attendance Risk | whether current attendance pattern puts learning outcomes at risk | Digital (detail), one-word flag on Paper only if risk is real — never shown as a bare "at risk" without the Support Recommendation alongside it, per Educational Constitution Article V (risk predicts support needs, never worth) |
| Learning Time Lost | estimated instructional time missed, translated from raw absence counts | Digital |
| Support Recommendation | what's being done or suggested in response to a risk signal | Digital, paired with any paper-visible risk flag |

**Rule carried forward from ADR-0005 §2.3**: none of this is a new attendance calculation. "Trend," "Health," and "Risk" are presentation labels over Attendance's own published summary output — if Attendance's own summary function doesn't yet produce a value granular enough to support one of these labels, that is a gap for Attendance's own domain to close (a future ADR-0004-governed Attendance enhancement), not something Blueprint computes itself.

---

## 6. Teacher Reflection — design

**Sections**: Teacher Reflection (opening statement), Learner Strengths, Growth Area, Recommended Support, Parent Partnership (what the parent can do), Holiday Focus.

**Maximum length**: one short sentence to two per subfield; 5-6 lines total across all five — deliberately shorter than a typical current "teacher comment" field, because Blueprint is not the place for a full narrative (that remains the Report Card's or a dedicated parent-conference context's job).

**Educational purpose**: replace the generic, often boilerplate "comment" field pattern with a structured prompt that forces specificity — a teacher filling in "Growth Area" cannot default to a vague sentence the way an open comment box invites.

**Who writes it**: the learner's current teacher, exclusively — never auto-generated wholesale, never written by an administrator on the teacher's behalf.

**Whether AI assists**: AI may assist with drafting suggestions (e.g., surfacing relevant evidence to reference, suggesting phrasing) but the teacher remains the sole accountable author of the final text — directly per Educational Constitution Article VI (AI explains evidence, never invents it) and Article VIII (a teacher approves before a claim reaches a parent). This mirrors the same AI-assistance boundary the platform already applies elsewhere (career-guidance prompt hardening, `sprint-23-canonical-consolidation`) — AI drafts, evidence grounds, a human approves.

---

## 7. Parent Experience — design principles

- **Maximum**: half a page.
- **Language**: no CBC/educational jargon — "developing," "exceeding," "strand," "competency" translated into plain language a parent without teaching background understands immediately.
- **Structure**: lead with one plain-language sentence on how the learner is doing overall, follow with the single most important thing to know this term (drawn from whichever section — Academic Record, Attendance, or Teacher Reflection — currently has the most decision-relevant signal), close with one concrete thing the parent can do.
- **Tone**: informative, never alarming — even when Attendance Risk or a Growth Area is present, phrased as "here's what would help," never "here's what's wrong."
- **Principle**: a parent who reads only this section, and nothing else in the Blueprint, should still walk away understanding their child's current educational situation and one thing they can do about it.

---

## 8. Learner Experience — design principles

- **Tone**: motivated, guided, supported — never judged. No section visible to the learner should present a number without an accompanying next step.
- **Language**: age-appropriate, encouraging, second-person ("you're building strong momentum in..." not "the student demonstrates...").
- **Purpose**: the learner-facing view exists to make the learner feel ownership of their own trajectory — Learning Compass's "Next Recommended Action" and Career Intelligence's snapshot both serve this directly, giving the learner something to do, not just something to be told.
- **What is deliberately withheld or reframed for the learner audience**: raw risk flags and teacher-only recommended-support language are reframed as encouragement and next steps for this audience, never removed outright (per Educational Constitution Article II — the learner should never be shown a number stripped of the context that missing evidence isn't poor performance).

---

## 9. Educational Identity (new section — architecture only, not implemented)

- **Purpose**: answer, in a single evidence-grounded phrase, *how* this learner engages with learning — not what they scored, not who they are as a person.
- **Evidence source**: patterns already present in existing evidence across Assessments, Learning Compass sessions, and Teacher Reflection — e.g., a consistent pattern of exploring multiple solution paths before settling on one might support "Curious Explorer"; a pattern of returning to and completing challenging tasks despite setbacks might support "Persistent Builder." Educational Identity introduces **no new data source** — it is a derived label over evidence the other sections already read, computed by whichever domain the eventual implementation sprint designates as its owner (an explicit open decision, not resolved here — this ADR only defines the concept and its constraints, not its computing owner, deliberately, since assigning ownership before the underlying evidence pattern-matching logic is designed would risk the same premature-implementation problem ADR-0005 avoided for other sections).
- **Educational meaning**: describes an engagement pattern to help a teacher or parent understand *how* to support the learner further, not a fixed trait — a learner's Educational Identity phrase should be able to change over time as new evidence accumulates, exactly like every other Blueprint section's freshness classification (Live, not permanent).
- **Limitations (must be stated wherever Educational Identity is shown, not just in this document)**:
  - Not a personality assessment — no psychometric instrument, no self-report questionnaire feeds it.
  - Not a fixed label — must be re-derivable and capable of changing as evidence changes (Educational Constitution Article III: confidence measures certainty, not ability — applies here as "the label measures an observed pattern, not a fixed trait").
  - Must have an explicit "insufficient evidence" state — a learner with sparse evidence must show no confident-sounding label rather than a guessed one, per Article II, mirroring exactly the confidence=0 handling `project-learner-blueprint-v1` already established for capability insights.
  - Must never be used for ranking, comparison between learners, or any decision with stakes (placement, discipline, opportunity access) — it exists solely to help an adult understand and support the individual learner, never to sort learners against each other.
- **Why this differs from labels or personality tests**: a personality test claims to describe a stable trait independent of context; Educational Identity claims only to describe an observed pattern in this learner's specific evidence, this term, revisable as new evidence arrives — the same evidence-first, non-permanent, confidence-labeled discipline every other Blueprint section already follows, extended to a qualitative rather than quantitative field.
- **Explicitly not decided by this document**: which domain computes it, what the minimum evidence threshold is, and the exact label taxonomy — all deferred to the first implementation sprint, which must re-read this section's limitations before designing any of those.

---

## 10. Growth Timeline — design

**Belongs**: academic milestones (e.g., a CBC competency newly reached), attendance milestones (e.g., a term of consistent attendance), Learning Compass milestones (e.g., completing a holiday programme), teacher reflections (each term's reflection becomes a timeline entry), career discoveries (a new Career Intelligence insight worth noting), achievements (recognitions already recorded elsewhere in the platform).

**Never belongs**: raw individual assessment scores (these live in Academic Record, not the Timeline — the Timeline shows *milestones*, not a log of every data point), anything from the reserved Behaviour domain until Behaviour itself is implemented and ratified, any entry not traceable to an existing evidence source or domain event (no manually-typed-in "note" field that bypasses every other section's evidence discipline).

**Rationale for exclusions**: a Timeline that includes every raw score becomes an unreadable log, defeating its purpose (showing trajectory, not data); a Timeline that allows free-text notes outside the evidence chain would reintroduce exactly the unverified-claim risk the whole Educational Constitution exists to prevent.

---

## 11. QR Philosophy

Any experience that is inherently long-form, ongoing, or interactive stays entirely on its own digital surface — Blueprint never reprints it, regardless of how valuable it is. This applies uniformly to: Learning Compass (full sessions, mastery maps), Career Intelligence (full report), Portfolio, Projects, and Evidence (once any of these are built). The QR code is the *only* bridge from Blueprint's necessarily-short paper form into these deep experiences — never a "see more" link that leads to another static document, always a link into the live, owning domain's own surface. This is the mechanism, not a courtesy: it is what makes Principle Three ("paper is concise, digital is deep") actually enforceable rather than aspirational, by giving every section an explicit escape valve instead of pressure to cram more onto the page.

---

## 12. Blueprint Reading Order, per audience

Blueprint does not force every audience through an identical top-to-bottom sequence; each audience's natural entry point differs:

- **Teacher**: Identity → Academic Record → Attendance → Teacher Reflection (their own prior entries) → Learning Compass — a teacher wants standing and history first, reflection second, support status last.
- **Parent**: Parent Summary (first, always) → Teacher Reflection → Academic Record → Attendance → Learning Compass/Career Intelligence snapshots — a busy parent needs the plain-language summary before anything else.
- **Learner**: Learner-facing framing of Learning Compass (Next Recommended Action) → Career Intelligence snapshot → Academic Record → Growth Timeline — motivational and forward-looking sections first, not a scorecard first.
- **University**: Identity → Academic Record (full historical depth) → Career Intelligence snapshot → Growth Timeline — an external evaluator wants trajectory and standing, not day-to-day support detail (Attendance Risk, Compass session detail are not shown at all to this audience, or shown only as an aggregate trend, per §2.3/§2.4's audience notes).
- **Employer**: Career Intelligence snapshot → Academic Record summary → Growth Timeline — the inverse emphasis of University, career-signal first.

**Principle**: reading order is a presentation-layer decision, not a data-ownership one — it does not change which domain owns which section (§2), only which section renders first for a given audience, decided at implementation time by the audience context the Blueprint is opened in.

---

## 13. Educational Philosophy

**"What the Learner Blueprint believes about learning."** — permanent, fixed section, not derived from any domain, present in every Blueprint regardless of audience:

> Learning is growth. A single score is a data point, not a verdict.
>
> Marks are evidence — one form among several, never the whole picture of a learner.
>
> Attendance matters because learning time matters — presence is a precondition for growth, not a measure of worth.
>
> Career emerges over time. No learner's future is fixed by a Grade 7 assessment; every career insight this document shows is a possibility, not a destiny.
>
> AI supports learning — it explains evidence that already exists; it never invents a fact about a learner it cannot trace.
>
> Teachers remain central. No system replaces a teacher's judgment; every reflection in this document is a specific teacher's, not an algorithm's.
>
> Parents are partners. This document exists so a parent can act alongside the school, not simply be informed by it.
>
> Every learner can improve. Nothing in this document is a ceiling.

This text is fixed (not per-learner generated) and grounds every other section's tone — any future implementation that drifts from it (e.g., a section that presents a score as a verdict, or a label that reads as fixed destiny) is a violation of this ADR, not just a style inconsistency.

---

## 14. Future Extension Points (reserved only)

Behaviour, Portfolio, Projects, Competitions, Innovation, Community Service, Leadership, Wellbeing.

No schema, no calculation, no section design decided for any of these here — this is an architectural reservation of the section-slot pattern (purpose/owner/audience/paper-or-digital/freshness/QR/size, per §2's table shape) that a future ADR must fill in per domain, exactly as ADR-0005 reserved Behaviour and this document now extends that reservation list without deciding any of them.

---

## 15. Verification Checklist

- Every section has exactly one owner, or is explicitly declared non-owning (Parent Summary, Growth Timeline, Educational Philosophy, Educational Identity's presentation) — §2, §9, §13.
- No duplicated ownership — confirmed, no section in §2 introduces a second computation of another domain's value.
- Paper remains concise — every §2 row states a paper maximum size; largest is Academic Record's half page.
- Digital remains rich — §3, §4, §11 confirm full experiences remain intact on their own surfaces, never flattened.
- Blueprint never replaces Report Cards — unchanged from ADR-0005 §5, not re-litigated here.
- Blueprint never replaces Learning Compass — §3's exclusion list.
- Blueprint never replaces Career Intelligence — §4's "one snapshot only" rule.
- Educational Constitution compliance — Articles I, II, III, V, VI, VIII, X, XI each cited against a specific decision above (§5, §6, §9, §13).
- ADR-0005 / ADR-0004 / RAS compliance — restated, not amended, throughout; no new direct Operating-Layer read, no new cross-domain ownership introduced.

---

## 16. Stop Condition

Per explicit mission instruction: this document, ADR-0006, and the implementation-log entry are the complete deliverable. **Stop here.** No implementation, no Blueprint UI, no PDF work, no Parent Portal, no QR generation, no Educational Identity computation, no AI summaries, no Timeline build. Wait for explicit approval before the first Blueprint implementation sprint.
