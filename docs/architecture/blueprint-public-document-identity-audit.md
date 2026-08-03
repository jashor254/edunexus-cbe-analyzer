# Learner Blueprint — Public Document Identity Audit

**Date:** 2026-08-03
**Type:** Naming/identity audit. Not implementation, not UI redesign, not an Educational Intelligence sprint, not a branding exercise. No code changed.
**Scope, exactly as instructed:** what schools, teachers, learners and parents *see*. The internal architecture — `lib/learnerBlueprint/`, `composeBlueprint()`, "Blueprint" as an engineering concept — is explicitly out of scope and unaffected by anything in this document.
**Builds directly on:** the prior [Kenyan School Evolution Audit](blueprint-kenyan-school-evolution-audit.md), which already identified the document's own name as its single largest familiarity gap (12/14 language elements passed; the 2 failures were both naming). This audit resolves that specific open question with a decision, not another audit of the same finding.

---

## 1. Terminology Audit

Evaluated against real Kenyan school register — what a Principal, teacher, or parent already has a mental slot for, based on CBC's own official vocabulary (KICD assessment materials consistently use "learner" as the person and "progress" as the concept being reported) versus generic edtech/corporate phrasing:

| Candidate | Feels native in a Kenyan school? | Why |
|---|---|---|
| Learner Blueprint | **No** | "Blueprint" is architecture/engineering language — confirmed as the #1 finding of the prior audit |
| Learning Blueprint | **No** | Same core problem — "Blueprint" is still the noun doing the work |
| **Learner Progress Report** | **Yes — strongest candidate** | "Learner" is CBC's own official term for a student (not "pupil," not "student" — the curriculum itself renamed this); "Progress Report" is already a real, existing document type in Kenyan schools, term-by-term, immediately trusted with zero explanation needed |
| Learning Progress Report | Weaker | "Learning" as an adjective before "Progress" reads as translated-from-elsewhere edtech phrasing, not native school register — a subtle but real difference from "Learner Progress Report" |
| Learner Development Report | Workable, second choice | "Development" fits CBC's competency-based framing reasonably well, but carries a faint HR/performance-review connotation ("professional development") that "Progress" doesn't |
| Educational Progress Report | Weaker | "Educational" is redundant in front of "Progress Report" inside a school context — adds formality without adding clarity |
| Learner Growth Report | Workable, but narrower than it sounds | "Growth" is CBC-flavored (matches the platform's own growth-timeline language) but reads as narrower in scope than the actual four-page document — "growth" implies a single trend line, not an academic picture plus recommendations plus career direction |
| Academic Progress Report | Too narrow | Accurately describes Pages 1-2 only; actively undersells Page 3 (recommendations) and Page 4 (career direction, portfolio) — risks setting the wrong expectation before the reader even opens it |
| Educational Profile | **No** | "Profile" reads as a static record (a CV, a database entry) — wrong verb-feel for a document whose actual strength is *recommending what to do next*, not just describing who someone is |
| Learner Profile | **No** | Same problem as above, and additionally collides with how "profile" is already used elsewhere in edtech (a settings page, a social identity) — a real risk of the wrong mental model |

**Clear winner: "Learner Progress Report."** It is the only candidate that (a) uses CBC's own vocabulary correctly, (b) matches a document type Kenyan schools already produce and trust, and (c) doesn't narrow the reader's expectation below what the document actually delivers.

---

## 2. First Impression Test

**Title: "Learner Blueprint" (today).** A Principal's honest first reaction, unprimed: *"Is this a plan for something? A construction term? What is a Blueprint doing in a school report?"* Confusion first, curiosity second, trust deferred until after reading — exactly the wrong order for a document meant to be trusted on sight.

**Title: "Learner Progress Report" (recommended).** The same Principal's honest first reaction: *"This is a progress report for one of my learners."* No confusion, no translation step. Trust is immediate — the title alone does the work a subtitle would otherwise have to do. Curiosity shifts to the *content* ("let me see how this one is doing") rather than the *document type* ("let me figure out what this is") — the correct place for curiosity to land.

The difference is not cosmetic — it's the gap between a reader spending their first ten seconds decoding the document versus spending them reading it.

---

## 3. Audience Testing

| Audience | Reaction to "Learner Progress Report" | Reaction to "Learner Blueprint" (today) |
|---|---|---|
| Principal | Immediate — knows exactly what to expect and where to file it mentally | Pauses to figure out what kind of document this is before engaging with content |
| Teacher | Immediate — "progress report" is the same category of document they already write comments into | Slight hesitation — sounds like something from "the system," not from their own practice |
| Parent | Immediate — the single most trust-critical audience, and the one least equipped to decode unfamiliar terminology | Weakest reaction of any audience — a parent has the least context to resolve "Blueprint" into something reassuring |
| Learner | Neutral either way — a learner reading about their own progress isn't gatekept by the title | Neutral either way, same reasoning |
| Secretary | Immediate — filing/distributing a "Progress Report" requires no explanation to anyone asking what it is | Would likely need to explain the term to a parent asking "what is this" at the front office |
| Board Member | Immediate — a governance audience specifically benefits from a title that doesn't need defending before the content does | Weakest audience for this title — a board member is exactly who is most likely to ask "why does this document have an engineering name" |

**Every audience does at least as well, and the two most trust-sensitive audiences (Parent, Board Member) do meaningfully better, under the recommended title.**

---

## 4. Internal vs Public Language

**Must stay internal-only** (engineering/architecture vocabulary — confirmed present in the codebase, confirmed absent from anything a reader currently sees, per the prior audit's direct text search):

- Blueprint (as a document-facing word — the internal module/function names `lib/learnerBlueprint/`, `composeBlueprint()` are explicitly untouched by this audit)
- Educational Intelligence
- Projection
- Capability (the internal `exceptional`/`strong`/`capable`/`developing`/`emerging` scale — distinct from, and never to be confused with, the CBC-official `Exceeding/Meeting/Approaching/Below Expectations` labels the reader already sees, which are correctly public today)
- Evidence Model, Composition Engine, Coherence Engine
- Bridging / bridged (the Core↔legacy identity-resolution concept)
- Freshness, owner, confidence score, evidence maturity tier

**Should appear publicly instead** — and, per the prior audit's own findings, mostly already does:

- "Progress," "Where things stand," "What this suggests," "What helps next," "What's ahead" — the four page titles are already correctly public-safe language and need no change under this recommendation.
- "Subjects," "Levels" (CBC's own terms) — already correct.
- "Recommendation" / "the one thing that matters most" — already correct.
- The one place public language needs to replace internal language today: the Page 4 link currently reading "Explore the full **Career Intelligence** journey →" (confirmed, prior audit) should read as a plain destination description instead — this finding is restated here only because it is the same category of fix as the title change, not a new issue.

---

## 5. Future Growth

Tested against every named future addition — does "Learner Progress Report" still describe the document accurately once each lands?

- **Portfolio** — yes; a portfolio is naturally part of a learner's progress record, not a contradiction of the title.
- **Leadership** — yes; a leadership role is a form of progress, same reasoning.
- **Projects** — yes.
- **Career Intelligence** — yes, with a caveat worth naming: career direction is *informed by* progress, not itself a form of academic progress — but Page 4 already frames it correctly today as "an early, non-binding signal," which reads consistently under a "Progress Report" title (a progress report can reasonably include "and here's an early direction this progress points toward" as its final page) without needing the title itself to promise career guidance.
- **Longitudinal Evidence** — yes, this is arguably what "Progress" most directly refers to over time; the History view already exists and fits naturally under this name.
- **School Intelligence** — not applicable to this document's own title at all; School Intelligence (per the immediately preceding Principal Workspace audit) is a *different* document/surface entirely, at the school level rather than the learner level, and should carry its own name, not inherit this one.

**No future addition makes "Learner Progress Report" inaccurate.** The one growth path that requires a second, separate name (School Intelligence) already needed one regardless of what this document is called — not a mark against this recommendation.

---

## 6. Brand Relationship

Evaluated against the document's actual current header/footer design (`BlueprintView.tsx`'s `ReportHeader`/`ReportFooter`, confirmed by direct read):

| Element | Should it appear? | Where / how |
|---|---|---|
| School name | **Yes, prominently** | Already the dominant identity in the header today (`"{schoolName} · {document type}"`) — correct, keep as-is. This is the school's document to its own parent, not EduNexus's document with the school's name attached. |
| School logo | **Yes, when available** | Already conditionally rendered — correct, no change needed. |
| EduNexus | **Yes, but small and secondary** | Should read as quiet platform attribution (e.g., a small "prepared via EduNexus" in the footer, alongside the existing report ID / "CONFIDENTIAL" line) — never as the headline identity. A parent trusts their school, not a platform they've never heard of; EduNexus's job here is infrastructure, not brand. |
| Academic year / Term | **Yes** | Already present in the composed data (`identity.academicYearLabel`, `termLabel`) — should be visible in the header or immediately under the title, since "which term is this" is one of the first questions any reader of a progress report asks. |
| Version | **No, not publicly** | Internal-only, per §4 — a version number is architecture housekeeping, not something a parent needs to see. The existing report ID (`BP-XXXXXXXX-YYYYMMDD`) can stay as a small footer reference for support/audit purposes without needing to be labeled a "version" to the reader. |
| Document type label | **Yes — this is the title itself** | Per §1/§7, "Learner Progress Report" *is* the document-type label; no separate field is needed beyond the title doing that job. |

**Overall shape**: school identity dominant, EduNexus present but quiet, academic context (year/term) visible near the top, and internal versioning kept entirely out of the reader's view — matching the document's existing visual hierarchy almost exactly, with no structural change required, only the title-text change itself.

---

## 7. Final Recommendation

**Internal architecture name — unchanged:** `Blueprint` / `lib/learnerBlueprint/` / `composeBlueprint()`. Per this audit's own scope boundary, the engineering concept is sound, well-named for its actual job (a structured composition of many domains' evidence into one document), and changing it would be pure churn with zero reader-facing benefit. Nothing about this recommendation touches the architecture.

**Public document title: "Learner Progress Report."** The clear winner of §1's comparison — CBC-native vocabulary, immediately trusted by every audience tested in §3, remains accurate through every future addition tested in §5, and requires the smallest possible change (three display strings) to realize.

**Optional subtitle: "A clear picture of progress — and what happens next."** Chosen to do two jobs at once: it signals the document goes beyond a marks table (the "and what happens next" clause directly reflects Page 3's real strength, the single priority recommendation) without using a single word of internal vocabulary, and it mirrors the plain, warm register already established by the four existing page titles ("Where We Stand Today," "How We Help Next") — so the subtitle reads as if it belongs to the same document, not bolted onto a rebrand.

**Why this combination, and not a stronger/more technical alternative**: per the mission's own success criteria, the bar is "I know what this is" *before* reading, and "this is a much better report than what we use today" *after*. "Learner Progress Report" wins the first test by being unremarkable — it costs the reader nothing to recognize. The document itself, already audited twice in this engagement as editorially mature and decision-support strong, wins the second test entirely on its own merits once the reader is inside it. **The title's job is to get out of the way, not to impress — the content was already doing the impressing.**
