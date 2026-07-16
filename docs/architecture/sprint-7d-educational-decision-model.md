# Sprint 7D — Educational Decision Model

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. This document combines two distinct kinds of content, kept clearly separated throughout: **repository evidence** (marked VERIFIED/restated, cited to Sprints 6A–7C) and **external research** (Parts 3 and 9, marked **[RESEARCH]**, general knowledge of international educational-AI guidance — not repository findings and never to be cited elsewhere as such). No ADR is raised.

**Builds on**: Sprint 6G (Decision & Authority Model — the direct predecessor to this sprint, covering nearly identical ground at the code level) and 7A–7C (the operating-system blueprint, domain architecture, and organizational research). This sprint's distinct contribution is treating each decision as a **first-class architectural object** (Part 5's Catalogue), adding external responsible-AI research as an explicit comparison point (Part 3/9), and describing — not designing — how the platform's existing pieces could combine into one explainable decision model (Part 7).

---

## Part 1 — Every Educational Decision Made in a School

Organized by category, per the sprint's own grouping. Restated from 6G Part 1's Decision Inventory and 7A/7C's actor/decision research where already catalogued; extended with categories those sprints did not organize by (Leadership, National) and decisions surfaced only by 7C's organizational research (moderation sign-off, collective promotion ratification).

**Administrative**: Admission, Enrollment, Withdrawal, Transfer, Fee-related holds (not modeled in EduNexus, per 7A Part 1, but a real decision in most schools), School creation/configuration, Academic Year/Term setup, Class allocation, Role/permission grants.

**Academic**: Assessment creation, Assessment marking, Assessment publish, Assessment moderation sign-off (HOD-level, per 7C Part 6), Report Card content, Report Card publish (Principal sign-off, per 7C Part 6), Promotion (collective, staff-ratified per 7C Part 6's research), Graduation, Subject allocation, Curriculum sequencing (scheme of work).

**Student Welfare**: Evidence confirmation, Guidance & Counselling referral/intervention (not modeled, 7C Part 7), Learning Support/accommodation decisions (partially modeled via Adaptive Learning, 7C Part 8), Medical incident response (not modeled), Behaviour/discipline escalation (not modeled), Career guidance (modeled, but per 7C Part 7's research, structurally misplaced as an AI-only decision rather than a Guidance-function decision).

**Leadership**: Department/staffing structure decisions (not modeled — no Department domain exists, 7A/7B/7C), Academic policy (assessment calendar, moderation standards — not modeled), Discipline escalation to suspension/expulsion (not modeled, 7A Part 4), School-wide intervention prioritization ("School Intelligence," restated 6H Part 7 as having no reachable consumer).

**Teacher**: Marking/grading, Lesson/scheme content choices, Differentiation/grouping (Adaptive Learning), Evidence review (confirm/reject), Class-level pastoral judgment calls (day-to-day, unrecorded per 7C Part 7's "Pastoral" row).

**Parent**: Guardian linking (self), Notification opt-in, Career-guidance receipt (a decision to *engage with*, not *make*, since EduNexus's Career Intelligence output arrives fully formed with no parent input step, restated 6G Part 7).

**National**: Curriculum content (KICD-owned, restated 7C Part 5), National examination administration and results (KNEC-owned), Certification/transcript validity (a national-level guarantee a school's own certificate/transcript ultimately depends on) — all three are **external to EduNexus's own decision authority by design**, restated 7A Part 2's finding that KNEC/KICD integration is content/labeling only, never a live decision-authority relationship.

---

## Part 2 — Decision Attributes

Full attribute table for the decisions with the richest evidence base (restated and extended from 6G Parts 1/5/9); decisions with no code form at all (Discipline, Medical, Guidance, Finance) are addressed in Part 4/5 rather than given a full row here, since most of these ten attributes are vacuously "absent" for them.

| Decision | Owner | Evidence required | Information inputs | Human judgement | AI assistance | Approval chain | Appeal | Audit trail | Lifecycle |
|---|---|---|---|---|---|---|---|---|---|
| Admission | Class teacher | None — a single write | Learner details entered by teacher | Full (the teacher's own decision to add the learner) | None | None | None found | `created_at`/`teacher_id` attribution only | Create, no further stages (6D Workflow 1) |
| Assessment publish | Same actor as creation/marking | None beyond the marks themselves | Marks | Full | None | Self (no second reviewer) | None found | `is_published` boolean, no `published_by`/reason (6G Part 9) | Create→mark→publish, no archive |
| Evidence confirmation | Teacher (mastery) / system account (engagement) | Confidence score, trust-tier ceiling | Assessment marking event or Compass session content | Full for mastery claims; delegated-to-rule for engagement facts | Confidence scoring, claim extraction | Teacher confirm/reject, DB-trigger-enforced | Retraction (`retractEvidence`) functions as an appeal mechanism, restated 6G Part 5 | **Full — the platform's only complete audit trail** (`reviewed_by`, `reviewed_at`, `review_reason`, `supersedes`/`superseded_by`) | Complete: create→review→confirm/reject→retract/erase (6G Part 10) |
| Career recommendation | **AI, autonomously** | None — no gate at all | Confirmed Evidence via Projection/capability extraction | **None** | **Full — decides and executes** | **None** | **None found** | **None — zero trust/confidence/reviewer column** (6G Part 9) | Generate→persist→serve, no review (6G Part 3) |
| Report Card publish (Core) | Admin-tier, unreachable | Lock check (all assessments published) | Term averages, rankings | Full, nominally | None in the decision itself | Single-actor | None found | `is_published`/`published_at`, no `published_by` (6G Part 9) | Generate→publish, no archive; stops at Review per 6G Part 10 |
| Promotion | Nobody, in practice | None — never exercised | N/A | Nominally full | None | Nominal admin/teacher gate | None found | `processed_by`+`reason` exist, unpopulated | Never proceeds past Proposal (6G Part 10) |
| Adaptive Learning grouping | Teacher (approve/adjust) | Class/assessment data | Roster, marks | Full at the approval step | Grouping proposal generation | Explicit draft→approve endpoint | Teacher can adjust before publish (functions as a pre-emptive appeal) | `is_published`/`published_at`, no `published_by` | Draft→approve/adjust→publish — the cleanest lifecycle in the series (6G Part 3, restated 7B) |
| Holiday/Remedial Plan publish | Teacher, or 3-day auto-publish fallback | Projection | Learner projection data | Full if teacher acts; delegated-to-timeout otherwise | Draft generation | Teacher approve, or timeout | None found for a post-publish appeal | `is_published`/`published_at`, actor not distinguished from fallback (6G Part 9) | Draft→approve-or-timeout→publish |
| Guardian linking | Parent (self) | Invite token validity | Token, learner ID | Full (self-decision) | None | Self-approval | No unlink path found | Creation timestamp only | Create→indefinite, no unlink (6F Part 1) |

---

## Part 3 — International Practice: Human, AI-Assisted, Automated, Never-Automated **[RESEARCH — not repository evidence]**

*General knowledge of international educational-AI guidance, reasoned against the decision categories in Part 1. Not a repository finding.*

**Must remain human**: any decision with a durable, individual consequence for a specific learner that cannot be meaningfully reversed without harm — expulsion, formal SEN/disability classification, safeguarding/medical-incident judgment calls, and final graduation certification. International guidance in this space (UNESCO's and the OECD's published positions on AI in education, both of which consistently emphasize human oversight for high-stakes decisions) treats these as **decisions AI must never make alone**, regardless of how confident a model is, because the harm from a wrong high-stakes decision is asymmetric and the learner/family's right to a human, accountable decision-maker is treated as close to non-negotiable in this literature.

**May be AI-assisted**: formative assessment interpretation (flagging a pattern a teacher should look at), differentiation/grouping suggestions, career-exploration prompts (as *input to* a human guidance conversation, not as the guidance itself), lesson-content drafting, scheduling optimization. This is the largest category in the literature — AI as a force-multiplier for a human who retains the actual judgment.

**May be automated** (with human override always available): routine, low-stakes, easily-reversible computations — ranking/averaging (pure math, not judgment), notification dispatch, term-date calculations, auto-confirmation of low-risk, high-trust data entry (the kind of rule EduNexus's own Evidence trust-tier system already implements for teacher-attested facts, per 6G Part 4). International guidance generally does not treat these as ethically fraught, since they are computations over already-human-decided facts, not judgments in their own right.

**Should never be automated**: anything resembling a final, individual, high-stakes decision about a learner's educational trajectory made *without* a named, accountable human — this is the category international guidance treats most consistently across sources: not "AI should be very accurate before deciding," but "a human must be the one who decides, however good the AI's input is." Career guidance sits closer to this category than a typical EdTech vendor's marketing would suggest, precisely because (per 7C Part 7's research) a real school treats career guidance as *part of* the broader, confidentiality-bound, human-judgment-only Guidance & Counselling function — not a separable, lower-stakes recommendation.

---

## Part 4 — EduNexus Audit Against the Decision Model

**[Repository evidence, restated from 6G/7A/7B/7C, reorganized under this sprint's specific four questions]**

**Which decisions already exist (reachable, exercised in production)?** Admission, Class Allocation, Assessment (create/mark/publish), Evidence confirmation, Adaptive Learning approval, Holiday/Remedial Plan approval, Guardian linking, Career recommendation (exists and executes, though see below on ownership) — restated 6G Part 1/2.

**Which are missing entirely (no code form)?** Discipline/Suspension/Expulsion, Medical incident response, Guidance & Counselling referral, Fee-related holds, Department/staffing decisions, Year-level pastoral escalation — restated 7A Part 4, 7C Part 8, none newly discovered this session.

**Which are duplicated?** Report Card publish (two independently-computed pipelines, restated 6F Part 6), Promotion (two dormant tables, restated 6D/6G).

**Which are unreachable (code exists, no UI/actor path)?** Report Card publish (Core), Promotion, Graduation, Withdrawal, Transfer — restated 6D/6E/6G throughout.

**Which are incorrectly owned?** **Career recommendation is this document's sharpest finding, extending 6G Part 3/7C Part 7**: it is currently owned by AI alone, with no human decision-maker anywhere in the chain — and per Part 3's research above, this is not merely a governance gap (as 6G characterized it) but a **category error**: a decision international practice would place in the "must remain human, AI-assisted only" bucket is instead fully automated in EduNexus, with the added complication (7C Part 7) that its real-world home (Guidance & Counselling) does not exist as a domain at all, so there is no natural human owner to hand the decision back to even if the platform wanted to.

---

## Part 5 — Educational Decision Catalogue

Every decision from Part 1, as a first-class object with a stable identifier, status, and pointer to its full Part 2 attributes where one exists.

| ID | Decision | Category | Status | Full attributes |
|---|---|---|---|---|
| ED-01 | Admission | Administrative | Exists, unreviewed | Part 2 |
| ED-02 | Enrollment | Administrative | Exists (bundled with ED-01) | Part 2 (via ED-01) |
| ED-03 | Withdrawal | Administrative | Exists, unreachable, incomplete | 6D Workflow 12 |
| ED-04 | Transfer | Administrative | Exists, unreachable, correctly modeled | 6D Workflow 13 |
| ED-05 | Fee-related hold | Administrative | **Absent — no domain** | 7A Part 1 |
| ED-06 | School creation/configuration | Administrative | Exists, unreachable | 6E Part 3 |
| ED-07 | Academic Year/Term setup | Administrative | Exists, Core-only | 6C, restated 6D Workflow 15 |
| ED-08 | Class allocation | Administrative | Exists, self-service | 6D Workflow 3 |
| ED-09 | Role/permission grant | Administrative | Exists in code, provably ungrantable for admin-tier roles | 6E Part 1 |
| ED-10 | Assessment creation | Academic | Exists, production-grade | Part 2 |
| ED-11 | Assessment marking | Academic | Exists, production-grade | Part 2 |
| ED-12 | Assessment publish | Academic | Exists, no second reviewer | Part 2 |
| ED-13 | Assessment moderation sign-off | Academic | **Absent operationally, dormant schema fragment** | `assessment_quality_flags`, 6C/6E/7B/7C |
| ED-14 | Report Card content generation | Academic | Exists, duplicated (two pipelines) | 6F Part 6 |
| ED-15 | Report Card publish | Academic | Exists (legacy, unclear gate) / unreachable (Core) | Part 2 |
| ED-16 | Promotion | Academic | Exists in code, zero live rows | Part 2 |
| ED-17 | Graduation | Academic | Exists in code (Core only), unreachable, structurally impossible in legacy table | 6C/6D/6E |
| ED-18 | Subject allocation | Academic | **Never persisted as a decision** | 6D Workflow 5 |
| ED-19 | Curriculum sequencing (SOW) | Academic | Exists, AI-assisted, teacher-owned | 7A Part 2, 7C Part 5 |
| ED-20 | Evidence confirmation | Student Welfare | Exists, reference-quality | Part 2 |
| ED-21 | Guidance & Counselling referral/intervention | Student Welfare | **Absent — no domain, territory occupied by ungoverned AI (ED-25)** | 7C Part 7/8 |
| ED-22 | Learning Support / accommodation decision | Student Welfare | **Partially modeled** — Adaptive Learning grouping exists, no persisted individual accommodation record | 7C Part 7/9 |
| ED-23 | Medical incident response | Student Welfare | **Absent** | 7A Part 1 |
| ED-24 | Behaviour/discipline escalation | Student Welfare | **Absent, no code form of any kind** | 7A Part 4 |
| ED-25 | Career recommendation | Student Welfare | **Exists, incorrectly owned (AI alone, no human)** | Part 2/4, this document's sharpest finding |
| ED-26 | Department/staffing structure | Leadership | **Absent — no domain** | 7A/7B/7C |
| ED-27 | Academic policy (calendar, moderation standards) | Leadership | **Absent as a distinct decision** — folded silently into whichever admin-tier action touches it, none of which are reachable | Restated from ED-06/ED-09's unreachability |
| ED-28 | Discipline escalation to suspension/expulsion | Leadership | **Absent, no code form** | 7A Part 4 |
| ED-29 | School-wide intervention prioritization ("School Intelligence") | Leadership | **Exists as read-only analytics, no reachable decision-maker to act on it** | 6H Part 7 |
| ED-30 | Marking/grading (teacher-level) | Teacher | Exists (same as ED-11) | Part 2 |
| ED-31 | Differentiation/grouping | Teacher | Exists, cleanest lifecycle in the platform | Part 2 |
| ED-32 | Guardian linking | Parent | Exists, three non-communicating mechanisms | Part 2, 6D Workflow 9 |
| ED-33 | Notification opt-in | Parent | Exists | 6F Part 1 |
| ED-34 | Curriculum content authorship | National (KICD) | **External to EduNexus by design — content-consumption only** | 7A Part 2, 7C Part 5 |
| ED-35 | National examination administration/results | National (KNEC) | **External to EduNexus by design — export-format labeling only, no live integration** | 7A Part 2 |

**This catalogue's purpose, stated explicitly**: any future feature that touches a decision should reference its ED-number and check its current Status/Owner against Part 8's principles before writing code — the same function 6G's Decision Responsibility Matrix already serves, extended here with stable IDs and the fuller welfare/leadership/national categories 6G did not organize by.

---

## Part 6 — AI Classification Per Subsystem

For every AI subsystem this series has audited, classified per the sprint's own six-way scale (Suggest / Recommend / Predict / Warn / Explain / Never Decide) — restated and reclassified from 6E Part 7/6G Part 3's existing autonomy findings, mapped onto this sprint's specific vocabulary. Where repository evidence shows a subsystem exceeding "Never Decide" (i.e., it actually does decide), that is stated explicitly, per the sprint's own instruction.

| Subsystem | Suggest | Recommend | Predict | Warn | Explain | **Decides (evidence-shown exception)** |
|---|---|---|---|---|---|---|
| Compass chat tutor | ✅ (tutoring content) | — | — | — | Partial — no confidence/explanation metadata found attached to chat responses | — |
| Compass evidence extraction | — | — | ✅ (mastery inference) | — | ✅ — confidence score, trust tier, `review_reason` field | — |
| Projection | — | — | ✅ (capability/risk/knowledge state) | — | Partial — the computation is deterministic and traceable to its Evidence inputs, but no explanation *text* was found generated alongside a projection value | — |
| **Career Intelligence** | ✅ (nominally, "recommend" in its own naming) | ✅ | ✅ (fit scoring) | — | Partial — narrative text is generated, but with no confidence/uncertainty framing found (restated 6G Part 3's "no trust marker" finding) | **✅ — confirmed by repository evidence: writes directly to `careers`/`career_matches` with no gate, restated 6G Part 3/9** |
| Adaptive Learning | ✅ | ✅ (groupings) | — | — | Implicit — the draft is visibly distinct from the teacher-approved version | — |
| Holiday/Remedial Planning | ✅ | ✅ | — | — | Partial | — |
| Academic Clinic | — | — | — | — | ✅ — deterministic, its entire purpose is producing an explainable diagnostic report (restated 6E Part 7) | — |
| Academy AI Judge | — | — | — | — | UNKNOWN | UNKNOWN — not resolved by any prior sprint (restated 6E Part 7) |
| Future School/Operational/Administrative Intelligence | N/A — does not exist | N/A | N/A | N/A | N/A | N/A |

**The one confirmed "Decides" cell in this table is Career Intelligence** — every other AI subsystem this series has ever audited stays within Suggest/Recommend/Predict/Explain, with a human step before its output takes effect. This is the same finding 6G Part 3 already made, restated here specifically because this sprint's classification scheme is designed to make a violation of "AI never decides" immediately visible in a single table cell, rather than requiring a paragraph of prose to surface it.

---

## Part 7 — Decision Intelligence: How the Pieces Could Combine

**Description, not implementation or design — using only the components this series has already found to exist, describing how they relate to each other in an explainable decision model.**

The platform already has every *component* a real explainable decision model needs, individually well-built, currently disconnected from each other except along the one chain (Evidence→Projection) that already works:

- **Assessment** is the raw observation layer — a mark, a submission, a session. It answers "what happened."
- **Evidence** is the confirmed-fact layer — the same observation, but only once it has passed a confidence/trust check and (for AI-inferred claims) a human confirmation. It answers "what do we actually know, and how sure are we."
- **Projection** is the interpreted-state layer — a computation over confirmed Evidence only, answering "what does this imply about the learner's current capability/risk/knowledge."
- **Learning** (Compass) is a *producer* of raw observations (session content) that feeds back into Evidence via extraction — not itself part of the decision chain, but its upstream source.
- **Career** is, today, a *consumer* of Projection that short-circuits the rest of this chain — it reads Projection's output and, instead of producing a further *interpreted* layer for a human to decide from, produces a *decided* output directly (Part 4/6's finding).
- **Teacher observation** — the day-to-day pastoral/behavioral judgment 7C Part 7 describes as "rarely formally recorded" — is, per this series' evidence, the one input this chain has **no ingestion point for at all**. A teacher's informal sense that a learner is struggling has no path into Evidence unless it happens to also be reflected in a mark or a Compass session.
- **Human judgement** currently enters this chain at exactly two points with real teeth: Evidence's confirm/reject gate, and Adaptive Learning/Holiday Planning's approve/adjust gate. Every other point where a decision is made either has no human gate (Career) or has a gate nobody can reach (Report Card publish, Promotion).

**What an explainable decision model, built only from these existing pieces, would look like described (not designed)**: a decision surfaced to a human decision-maker would show (a) the Evidence rows underlying it, each with its own confidence/trust tier already visible in the schema (6G Part 9); (b) the Projection computation those Evidence rows produced, itself traceable back to (a); (c) whatever Recommendation-layer output (Career, Adaptive Learning, Holiday Planner) was generated from (b), **explicitly not yet acted on**; and (d) a single, named human actor's decision, recorded with the same `reviewed_by`/`reviewed_at`/`review_reason` shape Evidence already uses, closing the loop. **Every piece of this already exists in the codebase except (d) being applied consistently, and (c) never bypassing (d) the way Career Intelligence currently does.** This is a description of extending an existing, working pattern to the places it does not yet reach — not a new pattern.

---

## Part 8 — Educational Decision Principles

Extending 6G Part 12's authority findings and 7A/7B's design principles/laws with principles specific to this sprint's decision-catalogue lens — each grounded in a cited finding, not asserted abstractly:

1. **Evidence before prediction.** *Grounded in*: Projection's exclusive read of confirmed Evidence only (restated throughout) — the one place this principle is fully real.
2. **Teachers remain accountable, even when AI assists.** *Grounded in*: 6G Part 12's finding that Teacher Authority is EduNexus's dominant, near-total governing philosophy by elimination — this principle names what the evidence already shows is true in practice, and asks that future work preserve it deliberately rather than by accident.
3. **AI explains; humans decide.** *Grounded in*: the Part 6 table's single "Decides" exception (Career Intelligence) being the platform's one clear violation of an otherwise-consistent pattern.
4. **Every educational decision is reviewable.** *Grounded in, and currently violated for most decisions*: only Evidence and (partially) Adaptive Learning/Holiday Planning have a review step at all (Part 2) — this principle states the target, not the current state.
5. **Every recommendation is traceable to the evidence that produced it.** *Grounded in*: Evidence's `supersedes`/`superseded_by` lineage and Projection's exclusive-confirmed-evidence-read are both real, traceable chains; Career Intelligence's output, by contrast, has no such lineage (6G Part 9) — the principle is proven achievable by the first case and violated by the second.
6. **Confidence is never certainty.** *Grounded in*: Evidence's own `evidence_confidence` field is a 0–100 score, never a boolean — the schema itself already encodes this principle where it applies; it should extend to Career Intelligence's fit-scoring, which currently presents no confidence framing at all (Part 6).
7. **A decision with no named human owner is not a decision — it is an unattended default.** *Grounded in*: Career Intelligence (Part 4's "incorrectly owned" finding) and the entire Absent-domain category (Discipline, Medical, Guidance) — restated from 7B Law 19/20.
8. **National-level decisions (curriculum content, exam results) are consumed, never re-decided.** *Grounded in*: EduNexus's KICD/KNEC relationship being content/export-only, never a live decision-authority integration (Part 1, restated 7A Part 2) — the platform correctly does not attempt to override a national exam result or curriculum content, and this principle names that restraint as intentional and worth preserving as new domains are built.
9. **A dormant governance mechanism (a moderation table, a comment column) is evidence of prior intent — activate it before building a new one.** *Grounded in*: `assessment_quality_flags` and `headteacher_comment` (restated 6G Part 6, 7A Part 4, 7C Part 6) — both are schema fossils of a decision-governance step a prior design pass believed was needed.
10. **A decision's audit trail is not optional infrastructure — it is the decision's proof that it happened correctly.** *Grounded in*: the stark contrast between Evidence (full trail) and every other decision this catalogue lists (thin-to-none, Part 2/5) — restated from 6G Part 9's bimodal traceability finding, reframed as a principle rather than only an observation.

---

## Part 9 — Comparison Against External Guidance **[RESEARCH — clearly distinguished from repository evidence throughout]**

*General knowledge of UNESCO, OECD, and broader responsible-AI-in-education guidance, compared against this document's Part 1–8 findings. Not a repository investigation — no claim in this Part should be read as a code-grounded fact.*

**UNESCO**: published guidance on AI in education consistently emphasizes a human-rights-centered, "keep humans in the loop for consequential decisions" framing, with particular emphasis on protecting vulnerable learners from opaque, unreviewable automated decisions. EduNexus's Evidence/Projection chain (Part 7) is, where it is actually used as designed, broadly consistent with this framing — confirmable, traceable, human-reviewable. Career Intelligence's current shape (Part 4/6) is the one place this document found to sit in tension with that guidance's emphasis, since a career-trajectory-shaping recommendation delivered to a minor with no adult review is close to the kind of "opaque, unreviewable automated decision" this guidance cautions against, even though EduNexus's own narrative output is not opaque in a *technical* sense (it is a readable report) — the concern in this literature is more about the absence of a reviewing human than about the AI's output being uninterpretable.

**OECD**: guidance in this space tends to frame AI-in-education risk in terms of accountability chains — who is responsible when an AI-assisted decision turns out to be wrong. Read against this document's Part 2 findings, EduNexus's accountability chain is strong for Evidence (a named, timestamped human reviewer) and effectively absent for Career Intelligence (no named actor at all could be held accountable for a specific recommendation, since none reviewed it before it reached the student).

**Responsible AI, generally**: the common thread across most published frameworks in this space — explainability, human oversight, proportionate automation to the stakes involved, and non-discrimination/fairness monitoring — maps reasonably well onto this document's own Part 8 principles (which were derived independently, from repository evidence, then are now being checked against this external framing rather than copied from it). The one gap this comparison surfaces that Part 8 did not independently derive: **fairness/bias monitoring across a learner population** (e.g., does Career Intelligence systematically under-recommend certain career families for certain demographic groups) has no repository evidence either way, because no prior sprint in this series investigated it — flagged here as a genuinely open question this document cannot answer from the evidence available, not as a finding.

**Human oversight, specifically**: the international literature's consistent position is that oversight must be *meaningful* (a human with the time, information, and authority to actually change the outcome) rather than *nominal* (a rubber-stamp click). Checked against this document's Part 2 findings, EduNexus's one strong example (Evidence confirm/reject) is meaningful oversight — a teacher can genuinely reject a claim, and the schema shows this happens (`reviewed_reason`, restated 6G). Adaptive Learning's approve/adjust gate is similarly meaningful (the teacher can substantively change the grouping, not just approve or reject wholesale). Holiday Planner's 3-day auto-publish fallback is a borderline case worth naming honestly: it preserves a genuine review window, but if unused, the outcome converts from "human decided" to "timeout decided" — closer to nominal oversight in the specific case where the fallback fires, though the window itself is a real, substantively usable opportunity while it is open.

**Educational ethics, generally**: the field's typical emphasis on a learner's right to a human educator's judgment about their own trajectory (as distinct from a purely technical accuracy question) is the clearest external validation this comparison found for treating Career Intelligence's ownership question (Part 4) as more serious than a typical "add a review step" bug fix — the literature frames this specific category of decision (career/trajectory guidance for a minor) as one where the *process* of arriving at the recommendation (who was involved, whether the learner/family had input) matters independently of whether the recommendation itself turns out to be accurate.

---

## What This Document Does Not Do

Per its own scope: it designs no schema, workflow, or approval-gate implementation for any decision in the Part 5 catalogue. Part 7's description of how Evidence/Projection/Recommendation/Human-judgement could combine is explicitly a description of an already-existing pattern's extension, not a system design with data models, APIs, or UI. Part 3 and Part 9 are external research, clearly marked, and must not be treated as repository findings by any future document. No ADR is raised — this sprint identifies one sharpened governance concern (Career Intelligence's ownership, Part 4/6/9) that Sprint 6G already found and this document extends with external comparison, not a new canonical-domain conflict.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only this document and the implementation log entry were written.

## Stop Condition

STOP after this document. No implementation, schema, or migration performed. Any future work on the decisions catalogued here — especially Career Intelligence's ownership question, sharpened across Sprints 6G/7C/7D — requires separate scoping and explicit approval.
