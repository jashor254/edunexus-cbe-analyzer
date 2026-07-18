# ADR-0017 — Learner Wellbeing Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Wellbeing implementation sprint (Sprint 13G).** Design-freeze document only. No table, migration, repository, service, API, route, UI, portal, dashboard, notification, evidence ingestion, AI summarizer, wellbeing scoring, or recommendation engine was created or modified in producing it — confirmed: this document, `sprint-13f-learner-wellbeing-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Wellbeing implementation sprint (13G, not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: nothing. This is the first ADR in the series to freeze a domain built almost entirely on the *absence* of relationships to its siblings — it does not touch, reassign, or reinterpret any provisional row from ADR-0011/0012, because no prior ADR ever provisionally assigned Wellbeing to anything. There is nothing to supersede.
**Depends on / extends**: `adr-0005`–`adr-0009` (Blueprint ownership/composition discipline — this ADR is the first to deliberately *not* extend it, see Phase 7), `adr-0006-blueprint-educational-experience.md` §6 (Teacher Reflection's own frozen exclusion of "behaviour, discipline, counselling" — direct precedent this ADR inherits and formalizes), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern — this ADR deliberately departs from its default "Parent Experience reads X" rule, see Phase 7), `adr-0011` through `adr-0016` (the full canonical-domain series — read for what NOT to duplicate, and for the "no relationship, named explicitly" protection pattern ADR-0016 Phase 5 already used once, for Leadership↔Community Service, now used far more extensively here), `reference-architecture-specification.md` §3 (Canonical Domain Standards), §8 (Security Architecture), Educational Constitution — especially any article touching learner dignity, non-discrimination, and evidence-first discipline, all directly load-bearing for a domain of this sensitivity.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted, no assumption that Wellbeing does not exist)

Searched the entire codebase for every term the mission named (`wellbeing`, `well-being`, `well being`, `mental`, `wellness`, `support`, `counselling`, `counseling`, `guidance`, `safety`, `risk`, `concern`, `incident`, `health`, `medical`, `emotion`, `mood`, `stress`, `reflection`, `pastoral`, `care`, `guardian`, `bullying`, `welfare`) and read the actual implementation of every plausible hit, not just the filename.

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `wellbeing` / `well-being` / `well being` (exact terms) | **Zero hits anywhere in the codebase** — no file, comment, column, or type uses this word in any form. | Confirms no domain, partial or otherwise, uses this vocabulary at all. |
| `supabase/migrations/20260717150000_teacher_reflections.sql` header comment — "never behaviour, discipline, counselling, or AI-generated content" | Teacher Reflection's own migration explicitly and permanently excludes counselling from its scope, as a design decision made in Sprint 12O, long before this ADR. `lib/teacherReflection/reflection.ts`'s own header repeats the same exclusion (Phase 7: "never diagnosis, predictions, personality typing, medical claims"). | **Direct, load-bearing precedent, not a partial implementation.** Teacher Reflection already recognized that counselling/wellbeing content does not belong in an authored, externally-visible growth narrative — this ADR formalizes that boundary into a real domain rather than leaving it as an exclusion with nowhere for the excluded content to go. |
| `lib/projection/types.ts` — `RiskFlag`/`RiskValue` (`overallRiskLevel: 'normal' \| 'watch' \| 'at_risk' \| 'critical'`) | The Projection Engine's own academic-risk flagging — `subject`-scoped, evidence-backed, about **declining academic performance**, never emotional/psychological state. `lib/attentionFeed/panel.ts`'s one "concern" hit is a Monday Panel action label pointing at this same academic risk system. `lib/parentPulse/builder.ts`'s "concern"/"concerning" hits are about weak/declining **subjects**, read directly from `RiskFlag`. | Read in full and confirmed academic-only — a vocabulary-adjacent, not overlapping, system. Named explicitly here so a future implementer never confuses "risk" (academic, Projection-owned) with a wellbeing concern; this ADR's own domain must never read, write, or be confused with `RiskFlag`. |
| `lib/school/types.ts`/`lib/school/intelligence.ts` — `top_strand_concerns` | Curriculum-strand academic weakness aggregation (school-level analytics), unrelated to a learner's personal wellbeing. | Incidental word match, not a domain. |
| `lib/career/*`, `lib/academicClinic/*`, `lib/cbcCurriculum.ts`, `lib/sow/*` — `mental`, `wellness`, `counselling`, `guidance`, `medical`, `emotion`, `mood`, `stress`, `welfare` | Career-guidance demo/seed copy ("counsellor" as a career title, "mental health" as a career-cluster label), curriculum competency-verb vocabulary, and generic UI/marketing copy ("guidance" as in "career guidance," "safety" as in "type-safety"). All read in full. | Incidental word matches, not a domain. |
| `lib/lessonPlan/generator.ts` — `pastoral` | A single occurrence in lesson-plan generation prose (a CBC values-education reference), not a system. | Incidental word match. |
| `_frozen/eils/parentIntelligence.ts` and sibling `_frozen/eils/*` files — `concern` | Part of the **frozen, retired** EILS/EIR intelligence layer (moved to `_frozen/` in Sprint 12, per memory of this platform's own history — see `docs/architecture/` migration ledger). Read to confirm: these files reference academic/engagement "concerns," not psychological ones, and are explicitly out of the live codebase already. | Dead code, already excluded from the live system by an earlier decision; not a candidate owner. |
| Every other searched term (`bullying`, `incident` [outside unrelated holiday-return/legal-copy hits], `guardian` [Parent Experience's existing, unrelated identity concept], `health` [no hits beyond marketing copy]) | No matching table, module, or feature. Re-confirmed against the full migrations directory: no `wellbeing`, `support_plans`, `counselling_records`, `pastoral_care`, or `safeguarding` table exists anywhere. | — |

**Answer to Phase 1's questions**:
- **Does a Wellbeing domain already exist?** No — zero hits for the domain's own name, in any spelling.
- **Is there a partial implementation?** No stored data, no table, no repository. The one real artifact is a *documented exclusion* — Teacher Reflection's own migration and service both explicitly declare counselling/behaviour/discipline out of their scope, which is architectural evidence that this gap was already recognized once, in Sprint 12O, and correctly left unfilled rather than improvised.
- **Are there multiple competing systems?** No.
- **Are there merely vocabulary collisions?** Yes, several — `RiskFlag`/academic risk (Projection Engine), `top_strand_concerns` (school analytics), and generic marketing/curriculum use of "guidance"/"wellness"/"mental" — all read and confirmed unrelated.

**Conclusion: no canonical Learner Wellbeing domain exists, in whole or in part. A new domain is the correct, non-duplicative outcome — verified by exhaustive search, not assumed.**

---

## Phase 2 — Educational Definition (frozen)

**Learner Wellbeing is the school's confidential, evidence-informed record of support provided in response to a learner's non-academic, non-disciplinary need that may affect their safety, emotional state, or capacity to learn — a support relationship (raised, assessed, actively supported, reviewed, closed), never a diagnosis, a score, or a judgment about the learner's character or conduct.**

**The one educational truth that belongs only to Wellbeing**: *that support was needed, was provided, by whom, and with what outcome* — a fact no other domain in this platform is built to hold, because every other domain either (a) records something the learner *achieved or contributed* (Achievement, Portfolio, Projects, Competitions, Leadership, Community Service — all positive, externally-showcase-oriented), or (b) records something *measured about the learner's academic state* (Academic Record, Learning Compass, Attendance — all curriculum- or presence-anchored), or (c) records an *authored narrative about growth* meant to be shared (Teacher Reflection). None of these can, or should, hold "this learner needed support and here is what was done about it" — that fact requires its own domain, with its own, far stricter, privacy discipline.

**Distinguished from every sibling domain:**

| Domain | Why Wellbeing is not it |
|---|---|
| **Teacher Reflection** (ADR-0006 §6) | Teacher Reflection is authored, published, and meant to be read by the parent/student — a growth narrative. Wellbeing is the near-opposite: confidential by default, support-focused, and (Phase 7/8) almost never shown to the learner or parent in raw form. Teacher Reflection's own migration already excludes this content explicitly — this ADR is the fulfillment of that exclusion, not a contradiction of it. |
| **Behaviour** *(no domain exists yet)* | Behaviour, if ever built, would record conduct and its consequences — sanctions, incidents the learner caused. Wellbeing records support given *to* the learner, regardless of fault, and must never be conflated with, or triggered automatically by, a disciplinary event (Phase 4/6/7 — "no relationship, ever," frozen now for a domain that doesn't exist yet, precisely so its future implementers inherit this boundary). |
| **Attendance** (ADR-0003/0004) | Attendance measures presence in scheduled sessions. Wellbeing may *reference* attendance as context for a concern (Phase 7) but never computes, duplicates, or owns attendance data. |
| **Academic Record** (Projection Engine) | Measures curriculum mastery. Wellbeing must never influence academic ranking (Phase 6, Constitutional Constraint) and never reads or computes `RiskFlag`/academic risk itself — the two "risk" concepts are permanently distinct (Phase 1). |
| **Projects, Community Service, Leadership, Achievement, Portfolio, Competitions** | All positive, externally-showcase-oriented contribution/achievement domains, designed to eventually be seen by University/Employer audiences. Wellbeing has no showcase surface at all, ever (Phase 5/8) — the two domain families are structural opposites. |
| **Learning Compass** | Subject-mastery guidance. No relationship (Phase 7). |
| **Career Intelligence** | Career orientation, computed from achievement/capability signals. Wellbeing data must never feed career interpretation — a firm ethical boundary (Phase 6/7). |
| **Blueprint** | Blueprint composes a learner's visible academic/extracurricular profile from every other canonical domain. Wellbeing is the first domain in this series with **no Blueprint relationship at all** (Phase 7) — not summarized, not flagged, not referenced, in either direction. |
| **Parent Experience** | Every sibling domain is read by Parent Experience through Blueprint's summary. Wellbeing deliberately breaks this pattern (Phase 7/8) — there is no default parent-visible surface; any parent communication about a support plan happens through a separate, explicit, consent-gated channel, reserved and not designed here. |

---

## Phase 3 — Ownership Matrix (frozen — every field, exactly one owner: Learner Wellbeing)

| Concept | Owner | Notes |
|---|---:|---|
| **Support Plan** | Learner Wellbeing | The formal, structured record of an identified need being addressed — goals, active support, review, closure. The "entry" this domain revolves around. |
| **Wellbeing Check-in** | Learner Wellbeing | A deliberately **lighter-weight, distinct concept from a Support Plan** (Phase 5) — an informal touchpoint that may never escalate into a formal Plan. Two-tier by design: not every concern needs a full Plan, and forcing one would itself be a form of over-medicalizing a minor, transient need. |
| **Support Review** | Learner Wellbeing | A bounded, periodic confirming act during an Active Plan — internal-only content (Phase 8), never surfaced externally, mirroring the identical "Review" discipline ADR-0014/0015/0016 already established for their own domains, applied here with a far stricter visibility default. |
| **Support Conversation** | Learner Wellbeing | A logged record that a conversation occurred (who, when, general topic) — confidential by default; this ADR does not decide whether verbatim conversation content is ever stored (Phase 8/10 — reserved, a real future decision, not assumed here). |
| **External Referral** | Learner Wellbeing | A logged reference that a referral to an outside professional/service occurred (who, when, to whom) — **never** the outside party's own clinical/medical content, which this domain never stores (Phase 4). |
| **Support Goal** | Learner Wellbeing | Part of the Plan — what the support aims to achieve, recorded as a factual objective, never a clinical treatment goal. |
| **Support Outcome** | Learner Wellbeing | Recorded at Closure — what was observed/what changed, in plain, non-clinical, factual language; never "cured," "resolved psychologically," or similarly diagnostic phrasing. |
| **Support Status** | Learner Wellbeing | The lifecycle state itself (Phase 5). |
| **Support History** | Learner Wellbeing | Append-only audit trail, mirroring every sibling domain's `*_history` table discipline exactly — the one place this domain's technical pattern *does* match its siblings. |
| **Confidential Notes** | Learner Wellbeing | Free-text staff notes, append-only once written (never silently edited — a real information-integrity, not just access-control, protection), each carrying its own Visibility Classification (below). |
| **Visibility Classification** | Learner Wellbeing | A closed, frozen set of tiers (Phase 8) attached to the Plan and, where narrower, to an individual Note — never a free-for-all field, never inherited from any other domain's simpler "school-staff-read" model. |
| **Support Team** | Learner Wellbeing | The specific, named set of staff authorized on a given Plan — the actual access-control unit (Phase 8), a genuine departure from every sibling domain's blanket school-staff RLS pattern. |
| **Escalation Status** | Learner Wellbeing | A field independent of the main lifecycle status (Phase 5) — Not Escalated / Escalated to School Leadership / Escalated to External Authority — changeable at any point, always recorded with its own history entry, never inferred. |
| **Closure** | Learner Wellbeing | The terminal, immutable-once-reached record of how and why a Plan ended (Phase 5/7). |

**Nothing above is owned by any other domain.** No sibling domain gains a reference field into Wellbeing the way Achievement/Portfolio reference Competitions/Leadership/Community Service — Wellbeing is referenced by nothing (Phase 7).

---

## Phase 4 — Educational Philosophy (frozen)

**What Wellbeing is**: a confidential support-tracking domain — it exists so that when a school notices or is told a learner needs support beyond academics, that support is documented, followed through, reviewed, and closed with integrity, by accountable adults, traceably.

**What Wellbeing is explicitly NOT, and why:**

| Rejected concept | Why it is rejected |
|---|---|
| **Diagnosis** | EduNexus is an educational platform, not a clinical one. Only licensed professionals may diagnose. This domain records that support was given or a referral was made — never a diagnostic conclusion, ever, in any field. |
| **Psychology engine** | No computation, inference, or pattern-matching over a learner's psychological state occurs anywhere in this domain's ownership (Phase 3). A Support Plan is a record of human decisions and observations, never a computed profile. |
| **Medical record** | Medical records are a legally distinct category with their own regulatory regime. Wellbeing may log *that* a referral to a medical professional occurred (External Referral) but never stores the outside party's clinical content — the same "reference, never copy" discipline this whole ADR series already applies to Evidence, extended here to its most sensitive limit. |
| **Discipline system** | Support must never become, resemble, or be adjacent to punishment. Wellbeing has zero relationship to any future Behaviour/discipline domain (Phase 6/7) — this is the domain's single most important boundary. |
| **Attendance replacement** | Attendance remains sole owner of presence data (ADR-0003/0004). Wellbeing may reference it as context, never recompute or duplicate it. |
| **Teacher commentary replacement** | Teacher Reflection remains the one authored, growth-focused, externally-visible narrative. Confidential Notes are never surfaced as if they were Reflection content, and Reflection never gains access to Wellbeing content (Phase 7). |
| **AI emotional detector** | No AI infers mood, emotional state, or mental-health status from any signal — text, attendance pattern, academic decline, or anything else — anywhere in this domain (Phase 9, absolute). |
| **Surveillance system** | Wellbeing responds to concerns *raised by a human* (teacher, parent, learner, staff). It never scans other domains' data to auto-generate a concern, never algorithmically flags a learner, never runs in the background looking for signals (Phase 9/11). A concern with no human origin does not exist in this domain. |
| **Behaviour score / risk score** | No numeric score, rating, or aggregate "wellbeing level" is ever computed or stored for a learner, at the Plan level or across their whole record (Phase 3/6) — support status is qualitative and Plan-scoped only. |

---

## Phase 5 — Lifecycle (frozen; deliberately shaped for this domain, not copied from a sibling)

**Main line**: `Concern Raised → Initial Assessment → Support Plan Active → Review → Outcome Recorded → Closed`

Every prior canonical domain in this series ends with `Verification → Published` because every prior domain produces an externally-showcaseable claim. **Wellbeing has no such claim and therefore no Published state at all** — this is the single most important lifecycle decision in this ADR, made by explicit reasoning, not by mechanically reapplying the Achievement/Competition/Leadership/Community-Service pattern:

| Rejected state | Why it does not apply here |
|---|---|
| **Published** | There is no external audience (University, Employer, even Parent by default) this domain is building a verified, showcaseable credential for. "Closed" is this domain's true terminal state — confidential internally, never surfaced as a credential. |
| **Opportunity** (naming, not just structure, rejected) | Every other domain's first state ("Opportunity") is appropriately neutral-to-positive language for a competition, a leadership seat, a service placement. Applying that word to a wellbeing concern would be tonally wrong — "Concern Raised" names what actually happens: someone noticed or reported a need. |

| State | Why it exists |
|---|---|
| Concern Raised | The earliest state — a need is identified and recorded, by any staff member, a parent report, or (with appropriate support) the learner themselves. |
| Initial Assessment | A staff member reviews the concern to judge what kind of support, if any, is warranted — explicitly a triage judgment, never a diagnosis (Phase 4). |
| Support Plan Active | Real, ongoing support is being provided — the domain's core "over time" content, structurally similar to Leadership's/Community Service's Active Service phase, but privacy-gated far more strictly (Phase 8). |
| Review | A bounded, periodic check on how the plan is progressing — the same "live process vs. bounded confirming act" distinction ADR-0014/0015/0016 already established for their own domains. |
| Outcome Recorded | The support concludes with a recorded, factual observation of what changed — never diagnostic, never "resolved" in a clinical sense. |
| Closed | The Plan formally ends. Terminal and immutable (Phase 3/7), but — unlike Published elsewhere — remains permanently confidential, never becomes a visible credential. |

**Terminal branches — two, each independently justified:**

| Terminal branch | Reachable from | Why it exists |
|---|---|---|
| **No Action Needed** | Concern Raised (via Initial Assessment) | A real, honest outcome — the concern was checked and, on assessment, did not warrant a Support Plan. Preserving this as a distinct fact (rather than silently deleting the record) protects against the appearance that concerns are ignored, while never escalating a non-issue into a formal Plan it doesn't need. |
| **Withdrawn** | Support Plan Active or Review | The learner, parent, or school ends support before Outcome Recorded — for any reason (family choice, learner transfer, support no longer needed) — carrying only a neutral, factual reason, **never framed as failure**, mirroring the exact "Discontinued" discipline ADR-0015/0016 already froze for Leadership/Community Service, applied here with even more care given the subject matter. |

**Escalation Status is explicitly not a lifecycle state** (Phase 3) — it is a parallel field, changeable at any point from Concern Raised through Review, because escalation is a response to urgency, not a step in an orderly progression; forcing it into the main lifecline would misrepresent how real escalation actually happens (often suddenly, sometimes immediately at intake).

**Reopening**: a Closed or Withdrawn Plan is never un-terminaled. A new concern about the same learner always creates a new Concern Raised record, which may reference the prior Plan's Closure (a read-only link, never a mutation of the old record) — the identical immutability discipline every sibling domain already enforces for its own terminal states.

---

## Phase 6 — Constitutional Constraints (frozen, permanent)

1. **Support never becomes punishment.** No field, status, or process in this domain may trigger, inform, or resemble a disciplinary consequence.
2. **Support conversations never become evidence of misconduct.** Content logged here is permanently walled off from any process that could use it against the learner — enforced structurally by having zero relationship to any discipline/Behaviour concept (Phase 7), not by a policy note alone.
3. **Lack of wellbeing data never implies a learner's wellbeing is poor — or good.** Silence is silence, never evidence of anything, in either direction. No consumer of this domain (there are almost none, by design — Phase 7) may treat an absent record as a signal.
4. **Wellbeing never influences academic ranking, capability scoring, or Projection Engine output.** Zero relationship, either direction (Phase 7).
5. **AI never diagnoses.** Absolute, no exception (Phase 9).
6. **Teachers and staff remain accountable.** Every state transition, every Confidential Note, every Escalation change requires a named, attributable human actor — never a system-inferred action (mirrors, and exceeds, the "teacher accountability" discipline every sibling domain already requires).
7. **Every support action is traceable.** The append-only Support History (Phase 3) exists specifically so that "who knew what, and when" is always reconstructable — a genuinely different purpose from every sibling domain's history table, which mostly documents lifecycle status changes; here it is also an accountability and safeguarding record.
8. **Support is separated from discipline forever.** Not "for this sprint" — permanently. Any future Behaviour/discipline domain proposal must read this ADR and confirm it introduces no relationship to Wellbeing before it may be approved.
9. **No numeric score is ever produced.** (Restated from Phase 4, frozen here as a constitutional rule, not merely a design preference.)
10. **Visibility only ever tightens, never loosens, over time.** Closure does not relax access; a Note's individual restriction can be stricter than its Plan's default classification, never looser (Phase 8).

---

## Phase 7 — Relationships (frozen — reads / writes / references / none, for every relationship named)

| Relationship | Direction | Detail |
|---|---|---|
| Wellbeing ↔ Blueprint | **None, either direction.** | The first domain in this series with no Blueprint relationship at all — not summarized, not flagged, not referenced. Justified by Phase 2/8: Blueprint is a broadly-composed, relatively widely-read surface; even a bare "has active support: yes/no" flag there would create a stigmatizing, easily-over-shared signal this domain must never produce. |
| Wellbeing ↔ Parent Experience | **None via the general pattern.** Any parent communication about a Plan happens through a separate, explicit, consent-gated channel — **reserved, not designed** (Phase 10). | Deliberately breaks this series' otherwise-universal "Parent Experience reads X's Blueprint summary" rule. |
| Wellbeing ↔ Teacher Reflection | **None, either direction.** | Teacher Reflection's own migration already excludes this content (Phase 1); this ADR makes that exclusion permanent and mutual. |
| Wellbeing ↔ Attendance | **Wellbeing may reference Attendance** (read-only, one direction) as context for a concern. Attendance never reads or is influenced by Wellbeing. | E.g. "persistent unexplained absence" as context for why a concern was raised — a reference to Attendance's own existing published facts, never a recomputation. |
| Wellbeing ↔ Behaviour *(future, does not exist)* | **None, permanently.** | The most important boundary this ADR sets for a domain that doesn't exist yet — named now so a future Behaviour ADR inherits this constraint rather than inventing an entanglement under schedule pressure. |
| Wellbeing ↔ Community Service | **None, either direction.** | Different domain family entirely (confidential support vs. showcased contribution) — named explicitly rather than left to assumption. |
| Wellbeing ↔ Leadership | **None, either direction.** | Same reasoning as Community Service. |
| Wellbeing ↔ Projects | **None, either direction.** | Same reasoning. |
| Wellbeing ↔ Portfolio | **None, either direction.** | Same reasoning — Portfolio is a curated *showcase*; Wellbeing is never showcased. |
| Wellbeing ↔ Achievement | **None, either direction.** | Same reasoning — there is no "recognition" concept for a support record, unlike Competitions/Leadership/Community Service's Achievement relationship. |
| Wellbeing ↔ Career Intelligence | **None, either direction.** | A firm ethical boundary: confidential support history must never influence career orientation or matching. |
| Wellbeing ↔ Learning Compass | **None, either direction.** | Different concern entirely (subject mastery vs. personal support). |
| Wellbeing ↔ Evidence | **Wellbeing may reference Evidence** (read-only, one direction), e.g. a sudden academic decline noted as context for a concern. Evidence never reads Wellbeing. | The one relationship that does mirror the series' standard "reference, never copy" discipline — because Evidence itself carries no clinical or disciplinary content, only academic observation, so referencing it introduces no privacy risk in this direction. |

**No circular ownership. No duplicated truth. Wellbeing is, by design, the most relationship-sparse domain in this entire series** — this is a deliberate privacy-protecting outcome, not an oversight.

---

## Phase 8 — Privacy (frozen; this is the highest-privacy domain built so far)

**Visibility tiers (closed set, no free-for-all):**

| Tier | Default access | Notes |
|---|---|---|
| **Core Support Team** | Full access to a given Plan, including Confidential Notes | Named individuals authorized per-Plan (Phase 3's "Support Team" ownership) — never the blanket "any school staff member" RLS pattern every sibling domain uses. |
| **School Leadership** (Head Teacher / Deputy / safeguarding lead, once such a role is modeled) | Escalated Plans and Closure summaries; not necessarily every raw Note | Scoped to what leadership genuinely needs for oversight/safeguarding duty, not full raw access by default. |
| **General School Staff** (not on the Support Team) | **No access at all, by default.** | The sharpest departure from every sibling domain in this series — a teacher who is not on a given Plan's Support Team sees nothing about it, full stop. |
| **Parent** | No default access (Phase 7) | Only what is explicitly, separately communicated through a future, consent-gated channel — never a blanket read of the Plan itself. |
| **Learner** | Reserved, not decided here | The exact learner-facing visibility (e.g. whether a learner sees their own Plan's existence or goals) is a real, sensitive product decision explicitly deferred to the implementation sprint — but the frozen principle is: **never full raw Confidential Notes**, regardless of what else is decided. |
| **Future counsellor role** | Would sit inside Core Support Team once that role is modeled | Reserved (Phase 10), not designed. |
| **University / Employer / Public** | **No access, ever, under any circumstance.** | Unlike every sibling domain, there is no future "Published" state that could ever make this appropriate (Phase 5). |

**Historic visibility**: Closure never loosens access — a Plan's visibility tier the day it closes is exactly as strict as the day it opened, forever.

**Redaction**: an individual Confidential Note may carry a stricter Visibility Classification than its Plan's default (Phase 3) — always tightening, never loosening (Phase 6, Constraint 10).

**Publication**: explicitly and permanently rejected. Wellbeing has no external-facing surface, full stop — reaffirmed from Phase 5/7.

**Why this domain earns a stricter security model than every sibling**: every prior canonical domain (Achievement, Portfolio, Projects, Competitions, Leadership, Community Service) is, at its core, a record the school is *proud* to eventually show someone outside itself. Wellbeing records a vulnerability. The two categories of data cannot share a security model without the stricter one being silently weakened to match the looser one — this ADR refuses to let that happen.

---

## Phase 9 — AI Boundary (frozen, permanent)

**AI may:**
- Summarize a staff member's *own, already-written* notes, for that same staff member's own reference — never generate a new claim, never publish, never share the summary beyond who could already see the source notes.
- Highlight *structurally* missing fields (e.g. "this Plan has no recorded Support Goal yet") — a form-completeness check, never a content judgment.
- Assist with logistics (e.g. a reminder that a Review is due) — scheduling only, no content generation.

**AI must never:**
- Diagnose, or produce any output that could be read as a diagnosis.
- Infer depression, anxiety, self-harm risk, abuse, neglect, or trauma from any signal, in any domain, at any time.
- Infer or classify emotional state, mood, or personality from text, attendance, academic performance, or any combination of platform data.
- Produce a psychological conclusion of any kind.
- Compute or suggest a wellbeing score, risk score, or ranking of any kind (Phase 4/6).
- Auto-generate a concern, auto-raise a Plan, or auto-escalate — every Concern Raised, every Escalation Status change, must originate from a named human actor (Phase 6, Constraint 6).
- Read across a learner's other-domain data (Academic Record, Attendance, Achievement, etc.) to infer anything about their wellbeing — this domain has no relationship to those domains for exactly this reason (Phase 7), and AI may not create one through a back door.

This boundary is absolute and not subject to future loosening by an implementation sprint — any proposal to expand AI's role in this domain beyond the "may" list above requires its own, separately-approved ADR, explicitly amending this one, never a silent scope creep during implementation.

---

## Phase 10 — Reserved Future Extensions (named, not designed)

Peer Support, Counselling (a formal, licensed-role-backed capability), External Specialists, Medical Integration, Support Network, Family Engagement, Crisis Management, Safeguarding (a formal, regulatorily-informed capability — likely deserving its own ADR when proposed, given its stakes), Transition Support, Return-to-School Plans.

Each, when a real implementation sprint proposes it, requires its own reasoned decision about ownership and — especially for Safeguarding and Medical Integration — likely its own ADR given the regulatory and ethical stakes involved, not a casual extension of this one's frozen scope.

---

## Phase 11 — Risks and Architectural Protections

| Risk | Architectural protection |
|---|---|
| Privacy leakage | The Core-Support-Team-only default visibility tier (Phase 8) — no blanket school-staff access exists for this domain, unlike every sibling. |
| Discipline overlap | Zero relationship to any Behaviour/discipline concept, present or future (Phase 6/7, Constraint 8) — the domain's single most-repeated boundary in this ADR. |
| Teacher misuse | Support Team scoping (Phase 3/8) means only named, authorized staff can act on or view a given Plan — not any teacher who happens to teach the learner. |
| AI overreach | Phase 9's explicit, closed "may"/"must never" list, requiring its own ADR to expand. |
| Support becoming surveillance | The "no relationship to other domains" design (Phase 7) means Wellbeing cannot algorithmically watch other domains' data for signals — every concern must have a named human origin (Phase 4/9). |
| Parent visibility conflicts | No default parent access at all (Phase 7/8) — removes the conflict by removing the default, deferring any parent-facing capability to a future, explicitly-designed, consent-gated decision. |
| Medical-record confusion | Explicit rejection of medical-record status (Phase 4) — External Referrals log that a referral happened, never the outside party's clinical content. |
| Duplicate ownership | Phase 3's matrix gives every concept exactly one owner; Phase 7's "none" relationships prevent any sibling domain from also claiming a piece of this domain's content. |
| Constitutional violations | Phase 6's ten frozen constraints, each traceable to a specific risk this table names. |
| Future scaling (many learners, many Plans, long histories) | The append-only Support History and immutable Closure discipline (Phase 3/5/7) — the same proven pattern (Service/Repository/DB trigger, three layers) every sibling domain already validates works at scale, reserved here for the implementation sprint to build, not redesigned. |

---

## Phase 12 — Verification

- **Educational Constitution**: Evidence-first (concerns and outcomes are recorded facts, never fabricated — Phase 4/6), learner dignity (no diagnosis, no score, no surveillance — Phase 4/6/9), teacher accountability (every action attributable — Phase 6, Constraint 6).
- **Reference Architecture Specification**: §3 Canonical Domain Standards (single ownership, Phase 3) — satisfied with an unusually explicit "owned by nothing else" reinforcement (Phase 7) appropriate to the domain's sensitivity; §8 Security Architecture — this ADR proposes the first *stricter-than-standard* security model in the series (Phase 8), justified and bounded, not a deviation left unexplained.
- **ADR-0003 through ADR-0016**: no contradiction with any — Wellbeing relates to none of them except two narrow, one-directional, read-only references (Attendance, Evidence — Phase 7). Every prior ADR's own frozen ownership is reaffirmed unchanged.
- **Blueprint ownership** (ADR-0005/0006/0008): reaffirmed unchanged; Wellbeing is the first domain deliberately excluded from Blueprint composition entirely (Phase 7), a compliant exception, not a violation — Blueprint's "compose every canonical domain" discipline was never framed as unconditional in ADR-0008, and this ADR makes the boundary explicit rather than silently omitting the domain later.
- **Parent Experience** (ADR-0010): reaffirmed unchanged; this ADR's Phase 7 exception (no default parent read) is named and justified, not a silent gap.
- **Portfolio / Achievement / Projects / Competitions / Leadership / Community Service** (ADR-0011–0016): all reaffirmed completely unchanged — none gains or loses any field, relationship, or capability from this ADR.
- **One-domain-one-owner**: satisfied (Phase 3).
- **Evidence-first**: satisfied (Phase 4/6) — every claim in a Support Plan is a recorded human observation, never inferred or fabricated.
- **No duplicate ownership**: satisfied (Phase 3/7).
- **No duplicated calculations**: satisfied — this domain computes nothing (Phase 4/6, no score, no ranking).
- **No hidden intelligence**: satisfied — Phase 9's AI boundary is exhaustive and public within this document, nothing implicit.
- **No AI invention**: satisfied (Phase 9, absolute).
- **No second truth**: satisfied — Wellbeing references Attendance/Evidence but never restates or recomputes their facts (Phase 7).

---

## Stop Condition

This ADR, its companion sprint document, and one implementation-log entry are the only artifacts this sprint produces. No migration, table, repository, service, route, API, React component, UI, portal, dashboard, notification, evidence ingestion, AI summarizer, wellbeing scoring, or recommendation engine is designed or built here. Sprint 13G (Learner Wellbeing implementation) requires explicit approval before any of the above begins.
