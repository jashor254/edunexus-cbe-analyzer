# ADR-0016 — Learner Community Service Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Community Service implementation sprint (Sprint 13F).** Design-freeze document only. No table, migration, repository, service, API, route, UI, or upload mechanism was created or modified in producing it — confirmed: this document, `sprint-13e-community-service-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Community Service implementation sprint (13F, not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: `adr-0012-learner-achievement-domain.md` Phase 2's `community_service` `AchievementType` entry, **partially and explicitly** — see "Relationship to ADR-0012" below. Achievement's `community_service` type is not removed or renamed; it becomes a *recognition-of-service* reference to this domain, going forward — the identical "provisional becomes a reference" pattern ADR-0014/0015 already applied to Achievement's `competition`/`leadership` types. Does not supersede any other prior ADR.
**Depends on / extends**: `adr-0005`–`adr-0009` (Blueprint ownership/composition/presentation discipline), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern), `adr-0011-learner-portfolio-architecture.md` (Portfolio's frozen definition, its original provisional Community Service row), `adr-0012-learner-achievement-domain.md` (the verifiable-claim/raw-artefact split, and the `community_service` AchievementType this ADR disambiguates, including its own folding of Citizenship and Environmental into Community Service), `adr-0013-learner-projects-domain.md` (reference-not-copy precedent), `adr-0014-learner-competitions-domain.md` (the "no separate catalog," "system-queued automatic transition," and terminal-branch-justification discipline this ADR reapplies), `adr-0015-learner-leadership-domain.md` (the most directly analogous prior ADR — an ongoing, reviewable, time-based service/responsibility record, the closest structural sibling this domain has), `reference-architecture-specification.md` §3, Educational Constitution.

---

## Why This ADR Exists

As with Competitions and Leadership before it, "Community Service" already appears in the codebase — but only as a flat `AchievementType`/`AchievementCategory` value (ADR-0012), carrying just `title`/`description`/`awardingOrganization`/`awardDate`. ADR-0012's own Phase 2 text describes Community Service as something that should "carry hours, activity type, verifying party" — but the *shipped* schema carries none of that; it uses the identical flat shape every other Achievement sub-type uses. ADR-0012 also folded Citizenship and Environmental action into Community Service as classification concepts, not storage — a decision this ADR does not revisit. A learner's sustained volunteering at a clinic, a term of weekly environmental clean-ups, or an ongoing mentorship commitment — when it started, how long it continued, what was verified, what was reflected on — has no home anywhere in the platform. Without a frozen owner, a future feature would either keep bolting fields onto Achievement's flat `community_service` type or invent a second, uncoordinated system. This ADR freezes Community Service's definition, ownership, lifecycle, and every cross-domain relationship once, before a single table exists.

---

## Core Question

**A learner contributes real, sustained time and effort to benefit others or the environment — not a role held, not a competition entered, not a project built, but service rendered over time. Achievement can record that the service was recognized afterward. No existing domain can represent the service itself: its cause, its duration, its verification, its honest accounting of hours that were never meant to be a scoreboard. Who owns that, and how does every domain that needs its outcome (Achievement, Portfolio, Blueprint, Parent Experience, Career Intelligence) read it without ever storing a second copy?**

**Answer**: a new canonical domain, **Learner Community Service**, owns the verified service a learner renders over time — from the moment an opportunity is identified through commitment, active service, review, completion, verification, and publication — forever, evidence-backed, immutable once published. Achievement continues to own the *recognition* a service record may separately earn, but that recognition now references a Community Service Entry instead of standing alone. Everything else reads Community Service the same "ask, never compute" way it already reads Portfolio, Achievement, Projects, Competitions, and Leadership.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted)

Searched the entire codebase for every term the mission named (`volunteering`, `service`, `outreach`, `charity`, `environment`, `clean-up`, `tree planting`, `civic`, `church`, `mosque`, `temple`, `NGO`, `mentorship`, `blood donation`, `social impact`, `community`, `public service`) and read the actual implementation of every plausible hit, not just the filename.

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType` includes `'community_service'`, `AchievementCategory` includes `'community_service'` | Two flat enum values on `learner_achievements`, carrying only the same fields every Achievement sub-type carries: `title`, `description`, `awardingOrganization`, `awardDate`, `verifyingDocumentReference`. No hours, no activity type, no verifying-party structure, no ongoing-engagement concept — despite ADR-0012 Phase 2's own text describing Community Service as carrying exactly "hours, activity type, verifying party." `sed`-confirmed against `lib/learnerAchievement/types.ts`: no `hours`/`activity_type` field exists anywhere in the shipped schema. | This is the *recognition claim*, correctly owned by Achievement (ADR-0012) for what it actually stores today — not a service-record implementation. |
| `lib/repositories/project.repository.ts` — `ProjectCategory` includes `'community'` and `'environmental'` | Free-text-labeled Project categories (the *work* — e.g. a community clean-up organized as a bounded project with a goal and stages), not the ongoing service relationship itself. | Confirmed adjacent, not overlapping — a Project may be community- or environment-themed work; Community Service is the sustained act of serving, which may or may not be organized as a single bounded Project. No change needed to Projects. |
| `lib/learnerPortfolio/types.ts` header comment: "Achievement domain (Awards, Certificates, Leadership, Competitions...Community Service...)" | Confirms Portfolio has never owned Community Service in shipped code — ADR-0011's original provisional row was already superseded by ADR-0012 before Portfolio's first implementation sprint, identical to the Competitions/Leadership situation. | — |
| `adr-0012-learner-achievement-domain.md` Phase 8 — "Citizenship → folded into Community Service," "Environmental → folded into Community Service" | Two classification decisions, not storage decisions — ADR-0012 explicitly reasoned that civic participation and environmental action are both, structurally, service activities, not distinct achievement types. This ADR does not revisit that folding; it inherits it as the frozen boundary for what counts as Community Service in the first place. | Confirms scope, does not create a competing domain. |
| `lib/career/seedCareers.ts`, `lib/career/parentIntelligence.ts`, `lib/academicClinic/careerEngine.ts`, `lib/cbcCurriculum.ts` — `volunteer`, `NGO`, `charity`, `outreach`, `civic`, `church`, `mosque`, `mentorship`, `public service` | Career-guidance demo/seed copy (e.g. "NGO worker" as a career title), curriculum competency vocabulary, and career-clinic report prose. | Incidental word matches, not a domain. |
| `lib/environment/` (`types.ts`, `context.ts`, `index.ts`) | The platform's own runtime/deployment **environment** configuration module (dev/staging/production) — a pure infrastructure naming collision with the word "environment," nothing to do with environmental service. | Confirmed by reading: exports `ENVIRONMENT`, config resolution, no service/volunteering concept anywhere. |
| Every other searched term (`clean-up`, `tree planting`, `temple`, `blood donation`, `social impact`) | No matching table, module, or feature — incidental or zero hits. Re-confirmed against the full migrations directory: no `community_service`, `service_hours`, `volunteering`, or `outreach` table exists anywhere. | — |

**Answer to Phase 1's questions**:
- **Does any existing system already own Community Service?** No — only the flat, after-the-fact Achievement claim type, correctly scoped to what it can represent.
- **Genuine ownership?** None found.
- **Partial ownership?** Achievement's `community_service` type (recognition only, documented above).
- **Vocabulary collisions?** `lib/environment/` (infrastructure config, unrelated); `ProjectCategory`'s `community`/`environmental` values (adjacent work-categorization, unrelated to the service relationship itself).
- **Architectural gaps?** No domain represents sustained service over time, its verification, or its honest hours-recording — the entire reason this ADR exists.

**Conclusion: no canonical Learner Community Service domain exists. A new domain is the correct, non-duplicative outcome — verified, not assumed, matching the identical discipline this ADR series has now applied five times.**

---

## Phase 2 — Domain Definition (frozen)

**Learner Community Service is verified, sustained contribution of a learner's time and effort to benefit others or the environment, beyond personal or academic obligation — demonstrated through an ongoing engagement, reviewed and completed, never claimed by title or hour count alone.**

**Why Community Service is its own educational domain** (not merged into an existing one): it is the only domain that must represent *unselfish, outward-facing contribution rendered over time*, with its own honest-accounting discipline (hours are data, never a target) that no sibling domain shares.

**Community Service is NOT:**

| Concept | Why it is not Community Service |
|---|---|
| **Leadership** (ADR-0015) | Leadership is a position or responsibility *held* — selected into, served in, with authority or duty attached. Community Service is contribution *rendered* — no selection process, no authority, no seat to fill. A club president is Leadership; a learner who spent every Saturday volunteering at a clinic is Community Service. The two may co-occur (an Environmental Club President who also personally logs clean-up hours) but they are never the same row — one captures the role, the other the service, and neither is inferred from the other (Phase 5/8). |
| **Achievement (recognition)** (ADR-0012) | Achievement records that service was *recognized* — an award, a certificate, a commendation about the contribution. Community Service records the *contribution itself* — the engagement, its duration, its verification. A learner can serve extensively and receive no special recognition; a learner can receive an external "Young Volunteer Award" with no EduNexus-tracked service record at all. See Phase 5. |
| **Projects** (ADR-0013) | A Project is bounded work with a goal and completion — it may be community- or environment-themed (`ProjectCategory`'s `community`/`environmental` values), but it is the *thing built*, not the *ongoing act of serving*. A Community Service engagement may reference a Project it grew out of (Phase 5) but is never itself a Project row. |
| **Portfolio Item** (ADR-0011) | A Portfolio Item is the learner's own curated showcase of an artefact (a photo, a reflection piece from a service trip) — no verification, no hours, no ongoing-engagement lifecycle. A Community Service Entry may be *referenced by* a Portfolio Item; it is never itself one. |
| **Behaviour** *(no domain exists in this codebase)* | Named here only to state explicitly that Community Service is not, and must never become, a behavioral or disciplinary record. It is a positive-contribution record exclusively — it has no concept of conduct, sanction, or incident, and never will (Phase 8's "disciplinary overlap"-adjacent risk, named for completeness even though no such domain exists yet to collide with). |
| **Attendance** (ADR-0003/0004) | Attendance measures presence in scheduled academic sessions. Community Service measures contribution outside that context entirely — even when service happens during a school-sanctioned activity, Attendance never computes, infers, or represents anything about service, and Community Service never reads or writes Attendance. |

---

## Phase 3 — Ownership Matrix (frozen)

**What Community Service owns:**

| Concept | Owner | Notes |
|---|---:|---|
| **Service Activity** (the engagement's own descriptive facts: organization, cause/category, location) | **Learner Community Service** | Inline fields on the Entry, mirroring Competition's/Leadership's "no separate catalog" decision — a shared, reusable Organization/Cause catalog is a named, future extension point, deferred until real duplicate-entry evidence justifies it. |
| **Service Engagement / Entry** (the concrete, lifecycle-bearing row) | **Learner Community Service** | One row per sustained engagement — mirrors Leadership's "the responsibility itself" model, not a per-hour transaction log (Phase 4). |
| **Commitment** (the learner's formal undertaking to serve) | **Learner Community Service** | The Commitment lifecycle phase's own recorded fact (Phase 4). |
| **Active Service period** (start date, ongoing duration) | **Learner Community Service** | Recorded fact, never inferred. |
| **Review** (a staff/verifying-party check-in during the engagement) | **Learner Community Service** | Internal-only content (Phase 7), never surfaced externally, mirroring Leadership's Review-notes treatment exactly. |
| **Completion** (the factual close-out) | **Learner Community Service** | Recorded once, at the Completion phase. |
| **Verified Hours** (the cumulative, recorded time contributed) | **Learner Community Service** | A recorded fact, never a target, quota, ranking input, or badge threshold (Phase 6 Principle 2) — this constraint is architectural, not aspirational: no field anywhere in this ownership matrix computes a rank, percentile, or "hours needed" gap. |
| **Reflection** | **Learner Community Service** — explicitly distinct from Teacher Reflection and Leadership Reflection | Scoped narrowly to this service engagement, same isolation discipline ADR-0015 Phase 3 already froze for Leadership Reflection. |
| **Mentor / Verifying Party** | **Learner Community Service** | A reference field (school user, or an external verifying-party reference for off-site service) — not a new identity system, mirroring Leadership's Mentor Verification field exactly. |
| **Evidence References** | **Learner Community Service** references **Evidence** | Reference-only, never a copy of Evidence's own confidence/lifecycle machinery. |
| **Historical Record** | **Learner Community Service** | The Historical lifecycle terminal state, reusing Blueprint's "historical" freshness vocabulary. |

**What Community Service explicitly never owns:**

| Concept | Actual owner | Why named here |
|---|---:|---|
| Leadership positions/roles | Learner Leadership (ADR-0015) | Prevents the exact "double-counting with Leadership" risk named in Phase 8 — no field, flag, or derived value on a Community Service Entry ever represents holding a position. |
| Recognition / awards for service | Learner Achievement (ADR-0012) | See Phase 5. Community Service never issues its own certificate or award concept. |
| Project deliverables / goals | Learner Projects (ADR-0013) | A referenced Project's own fields are never duplicated onto a Community Service Entry (Phase 5). |
| Portfolio artefacts | Learner Portfolio (ADR-0011) | Community Service never stores a showcase photo/write-up as its own concept — Portfolio references Community Service, never the reverse (Phase 5). |
| Attendance / presence records | Attendance domain (ADR-0003) | Named explicitly so a future implementation sprint never conflates "hours served" with "sessions attended." |
| Career interpretation / employability signal | Career Intelligence (`lib/career/`) | Community Service records facts only; it never computes suitability, ranking, or a career-fit score (Phase 5/6). |
| Disciplinary / behavioral records | No domain exists yet; reserved as a separate, future, not-yet-designed domain if ever built | Community Service must never become a substitute for it, mirroring ADR-0015 Phase 2/11's identical Leadership boundary. |

---

## Phase 4 — Lifecycle (frozen, every state and terminal branch justified; unnecessary states explicitly rejected)

**Main line**: `Opportunity → Commitment → Active Service → Review → Completion → Verification → Published → Historical`

This eight-state shape deliberately mirrors Leadership's (ADR-0015 Phase 4) rather than Competition's — Community Service is structurally a **sustained, ongoing relationship**, not a bounded, judged event, and the mission itself instructs: "the lifecycle should reflect service over time, not merely participation." Each state:

| State | Why it exists |
|---|---|
| Opportunity | A service opportunity is identified/proposed for this specific learner — the earliest, editable draft state, mirroring Competition's/Leadership's identical first state. |
| Commitment | The learner formally undertakes to serve — a discrete, real act distinct from merely being aware an opportunity exists. |
| Active Service | The real, ongoing period of serving — may span weeks to a full year, the domain's core "over time" content. |
| Review | A staff/verifying party checks in on the ongoing service — a bounded, discrete confirming act, not the service itself (identical "live process vs. bounded confirming act" distinction ADR-0014/0015 already reasoned for their own Participation/Active-Service-vs-Review pairs). |
| Completion | The factual close-out — the engagement ended, in whatever state it actually reached. |
| Verification | The mandatory governance gate before any claim can be trusted externally — non-negotiable, mirroring every sibling domain's identical rule (Phase 6 Principle 5: "verified service outranks self-report"). |
| Published | The claim is now externally visible and immutable. |
| Historical | Time-based archival, reusing Blueprint's own vocabulary. |

**Terminal branches — three, each independently justified; a fourth was explicitly considered and rejected:**

| Terminal branch | Reachable from | Why it exists |
|---|---|---|
| **Discontinued** | Active Service or Review | The engagement ends before Completion (the learner moves, the organization closes, the commitment lapses) — carries only a neutral, factual note, **never a disciplinary record** (Phase 2/8). Mirrors Leadership's identical Discontinued branch. |
| **Rejected** | Verification | The claimed service cannot be confirmed — the same non-negotiable outcome every sibling domain's Verification gate allows. |
| **Revoked** | Published | A previously verified/published record is later found invalid. |

**Rejected as unnecessary** (mission Phase 4: "reject unnecessary states"): a **"Not Undertaken"** terminal branch, mirroring Leadership's "Not Selected." Leadership needs "Not Selected" because a Nomination represents a real decision made by *someone else* (the school choosing among candidates) — silence would misrepresent a genuine, recorded event. An Opportunity for service has no equivalent scarcity or third-party decision to record: if a learner never commits, there is no decision to preserve, only an absence of one. The existing "delete legal only in the earliest state" rule (mirroring every sibling domain, Phase 7) already handles an abandoned Opportunity correctly — a distinct terminal status would record a non-event as if it were one, which this ADR explicitly declines to do.

**Automatic transition**: Completion → Verification is system-queued automatically, with no human actor (mirroring the identical pattern ADR-0014/0015 Phase 4 already froze for Competitions/Leadership), recorded as its own real, auditable state even though no one manually triggers it.

Once a record reaches `Published`, `Discontinued`, or `Rejected`, its core facts are immutable — the same three-layer discipline (Service/Repository/DB trigger) every sibling domain in this series requires, reserved here for the future implementation sprint to build.

---

## Phase 5 — Cross-Domain Relationships (frozen, one direction only per row, no circular ownership, no duplicated truth)

| Relationship | Direction | Detail |
|---|---|---|
| Community Service ↔ Blueprint | **Blueprint summarizes Community Service.** Never the reverse. | A future `composeCommunityService()`, capped to: current engagement, verified completed count, latest, URL — deliberately **never a headline hours total** (Phase 6 Principle 2), matching every sibling domain's summary-only field-budget discipline. |
| Community Service ↔ Portfolio | **Portfolio references Community Service.** Community Service never reads Portfolio. | Mirrors `portfolioProjectLink.ts`'s exact pattern. Portfolio's category taxonomy has no `community_service` slot today (permanently reassigned to Achievement by ADR-0012) — the identical honest gap ADR-0014/0015 already named for Competitions/Leadership; any future Portfolio schema change is deferred to a Portfolio-domain-led decision. |
| Community Service ↔ Achievement | **Achievement references Community Service.** Community Service never reads or writes Achievement. | Achievement's existing `community_service` type gains an optional reference field to a Community Service Entry, going forward — not built this sprint, identical deferral to ADR-0014/0015 Phase 7/8. |
| Community Service ↔ Leadership | **No ownership relationship, either direction.** Named explicitly to prevent double-counting (Phase 8). | Neither domain reads, writes, or derives from the other. A Leadership role that also involves service work never auto-generates a Community Service record, and vice versa — each fact must be independently entered and independently verified. |
| Community Service ↔ Projects | **A Community Service Entry may reference a Project**, one direction only. Never touches Projects' own fields, verification, or lifecycle. | Mirrors Competition's identical Project-reference pattern (ADR-0014 Phase 5) — e.g. an ongoing environmental Project a learner also logs service hours against. |
| Community Service ↔ Competitions | **No relationship, either direction.** | Different domains entirely — Competitions is bounded, external, judged events; Community Service is non-competitive, sustained contribution. Named explicitly so this is never assumed rather than decided. |
| Community Service ↔ Career Intelligence | **Career Intelligence may read verified Community Service** as evidence input. Community Service never reads Career, never computes employability. | Identical one-directional rule already proven for Portfolio/Competitions/Leadership. |
| Community Service ↔ Parent Experience | **Parent Experience reads Community Service** (via Blueprint's summary). Never computes, never writes. | Same discipline already confirmed for every sibling domain. |
| Community Service ↔ Report Cards | **Never reads, never writes, either direction.** | Reaffirms the hard boundary ADR-0008 Part 3 established and every subsequent ADR in this series has upheld without exception. |
| Community Service ↔ Snapshots | **Blueprint Snapshots transitively include Community Service's summary** once its Blueprint composer exists, the same way every other section is already captured — Community Service never builds its own snapshot mechanism, never duplicates Blueprint Snapshot's immutability engine. | One-directional: Snapshot reads (transitively, via Blueprint); Community Service never reads Snapshot. |
| Community Service ↔ Evidence | **Community Service references Evidence.** Evidence never reads or writes Community Service. | Reference-only, identical to every sibling domain's Phase 3/5 rule. |

No row above creates a cycle. No row above allows a second domain to independently compute or store a fact Community Service already owns (or vice versa).

---

## Phase 6 — Educational Principles (frozen)

1. **Service is demonstrated, not claimed.** A claim of service carries no trust until Verification confirms it — mirrors the Educational Constitution's evidence-first mandate directly.
2. **Hours alone never define contribution.** Hours are a recorded fact, never a target, quota, leaderboard input, or badge threshold — no field anywhere in this domain's ownership matrix (Phase 3) computes a rank or percentile from hours.
3. **Reflection never replaces evidence.** A learner's or mentor's reflection is context and growth signal, never a substitute for a verifying party's confirmation that the service actually occurred.
4. **Participation ≠ impact.** Merely beginning an engagement is not itself a contribution worth publishing — Review and Completion capture what was actually done, never inferred from Active-Service duration alone.
5. **Verified service outranks self-report.** An unverified, self-reported claim is never treated with the trust of a verified one — the Verification gate (Phase 4) is non-negotiable before Published, identical to every sibling domain's rule.
6. **Compulsory service is recorded honestly, never inflated to appear voluntary.** *(Justified by, and directly preventing, Phase 8's "compulsory-service inflation" risk.)* If a school mandates a service requirement, that context is preserved as a recorded fact — reserved as a future field at implementation time — never silently erased to make participation look more voluntary or admirable than it was.

No further principles are invented beyond the five the mission named plus this one, directly justified by a named Phase 8 risk.

---

## Phase 7 — Visibility Matrix

| Field group | Learner | Parent | Teacher | School | University | Employer | Public |
|---|---|---|---|---|---|---|---|
| Current engagement | Yes | Yes | Yes | Yes | No | No | No |
| Completed service (Published) | Yes | Yes | Yes | Yes | Yes | Yes | Reserved |
| Internal reviews (Review-phase notes) | No | No | Yes | Yes | No | No | No |
| Reflections | Yes (own) | Yes (summary) | Yes | Yes | Reserved | Reserved | No |
| Evidence references | No (raw) | No (raw) | Yes | Yes | No | No | No |
| Verified hours (as a recorded fact, never a ranking) | Yes | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |

**"Public" visibility is named but reserved, not decided** — no public-facing surface (a school website community-impact page, for instance) is built or implied by this ADR; a future, separately-approved sprint would need to justify it against Phase 6's "hours alone never define contribution" principle before any public aggregate is ever shown.

**Paper vs. digital**: Completed service (Published) is the one field group meaningful on paper — a headline line ("120 verified hours, Kajiado Community Clinic, 2026") on a printed report/summary — mirroring exactly the "1 line/entry paper" treatment ADR-0011 Phase 9 already froze for Competitions-adjacent Portfolio sections. Everything else (current engagement, internal reviews, reflections, evidence) is digital-only, never rendered to paper.

---

## Phase 8 — Risks and Architectural Protections

| Risk | Architectural protection |
|---|---|
| Popularity bias | Community Service records verified engagement and outcome, never a popularity/visibility metric — no vote, like, or ranking field exists anywhere in the ownership matrix (Phase 3). |
| Compulsory-service inflation | Principle 6 (Phase 6) — compulsory context is preserved as fact, never erased; reserved as a field at implementation time so this isn't left to informal convention. |
| Unverifiable claims | The mandatory Verification lifecycle phase (Phase 4) requires an authorized verifying party's confirmation before any record can reach Published — no record skips it. |
| Double-counting with Leadership | Phase 5's explicit "no ownership relationship, either direction" rule — neither domain derives from or auto-populates the other; each fact is independently entered and independently verified. |
| Portfolio duplication | Portfolio references Community Service, never stores a second copy of an Entry's fields (Phase 5) — the identical, already-proven Portfolio→Projects/Competitions/Leadership pattern. |
| Evidence quality | Evidence references are reference-only, never fabricated (Phase 3); the future implementation sprint is expected to require Evidence-or-verifying-reference before Verification can complete, mirroring Achievement's Phase 5 non-negotiable rule. |
| Future AI misuse | No AI is used, referenced, or reserved anywhere in this domain's ownership matrix, lifecycle, or relationships (Phase 3–5) — Reflection is stored verbatim, Review notes are stored verbatim, hours are recorded facts. Any future proposal to AI-summarize or AI-verify service content would require its own, separately-approved ADR; this one grants no standing permission for it. |

---

## Phase 9 — Constitutional & Architectural Compliance

- **Evidence First** (Educational Constitution Article I) — a Community Service record is recorded only after Completion/Verification; Evidence references are never fabricated (Phase 3, mirroring ADR-0012 Phase 5/ADR-0014/0015's identical rule).
- **Single ownership, no second calculation** (RAS §3) — Phase 3's matrix gives every concept exactly one owner, including an explicit "never owns" table naming every adjacent domain's boundary.
- **Compose, never own** (ADR-0005/0006, extended by ADR-0011/0012/0013/0014/0015) — Blueprint, Portfolio, and Career all only read/reference/summarize Community Service, never compute or duplicate it (Phase 5).
- **Reference, never copy** (ADR-0012 Phase 5) — Community Service's relationship to Evidence is reference-only; Achievement's relationship to Community Service is reference-only, going forward (Phase 5).
- **Blueprint ownership discipline** (ADR-0005 §2/ADR-0008) — Blueprint's future summary is capped exactly as every sibling domain's is: count/latest/current/URL, never a full record, never a headline hours metric (Phase 5/6).
- **ADR-0011** — reaffirmed unchanged; Portfolio's category taxonomy is not modified by this ADR.
- **ADR-0012** — reaffirmed unchanged in its shipped form; only the future, deferred reference field is named (Phase 5), not built.
- **ADR-0013** — reaffirmed unchanged; Projects is referenced, never redesigned (Phase 5).
- **ADR-0014** — reaffirmed unchanged; Competitions has no relationship to Community Service at all (Phase 5), named explicitly rather than left ambiguous.
- **ADR-0015** — reaffirmed unchanged; Leadership has no ownership relationship to Community Service (Phase 5), the specific architectural protection against double-counting (Phase 8).

---

## Verification Against Mission's Checklist

- [x] No code changed, no schema changed, no repository created, no lifecycle implemented
- [x] Architecture only
- [x] Guardian Mode maintained throughout
- [x] One canonical owner established for every concept (Phase 3)
- [x] Constitution compliant (Phase 9)
- [x] RAS compliant (Phase 9, §3 Canonical Domain Standards)

---

## Stop Condition

This ADR, its companion sprint document, and one implementation-log entry are the only artifacts this sprint produces. No database, upload mechanism, verification workflow, dashboard, UI, report, Blueprint integration, Portfolio integration, Achievement integration, or AI summary is designed or built here. Sprint 13F (Learner Community Service implementation) requires explicit approval before any of the above begins.
