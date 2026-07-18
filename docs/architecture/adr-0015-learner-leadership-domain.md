# ADR-0015 — Learner Leadership Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Leadership implementation sprint (Sprint 13D).** Design-freeze document only. No table, migration, repository, service, API, route, UI, election, voting, or messaging mechanism was created or modified in producing it — confirmed: this document, `sprint-13c-learner-leadership-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Leadership implementation sprint (13D, not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: `adr-0012-learner-achievement-domain.md` Phase 2's `leadership` `AchievementType` entry, **partially and explicitly** — see "Relationship to ADR-0012" below. Achievement's `leadership` type is not removed or renamed; what changes is that it becomes a *recognition-of-service* reference to this domain rather than a free-standing claim, the identical "provisional becomes a reference" pattern ADR-0014 already applied to Achievement's `competition` type. Does not supersede any other prior ADR.
**Depends on / extends**: `adr-0005`–`adr-0009` (Blueprint ownership/composition/presentation discipline), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern), `adr-0011-learner-portfolio-architecture.md` (Portfolio's frozen definition, its original provisional Leadership row), `adr-0012-learner-achievement-domain.md` (the verifiable-claim/raw-artefact split, and the `leadership` AchievementType this ADR disambiguates), `adr-0013-learner-projects-domain.md` (reference-not-copy precedent), `adr-0014-learner-competitions-domain.md` (the most directly analogous prior ADR — same audit method, same lifecycle-freeze discipline, same three-layer-immutability target architecture, applied one domain earlier), `reference-architecture-specification.md` §3, Educational Constitution.

---

## Why This ADR Exists

Exactly as ADR-0014 found for Competitions, "Leadership" already appears in the codebase — but only as a flat `AchievementType`/`AchievementCategory` value (ADR-0012), carrying just `title`/`description`/`awardingOrganization`/`awardDate`. ADR-0012's own Phase 2 text describes Leadership as something that should "carry a role title, scope, and duration" — but the *shipped* schema carries none of that; it uses the identical flat shape every other Achievement sub-type uses. A prefect's, house captain's, or club president's actual tenure — when they were selected, how long they served, what responsibilities they held, whether their service was reviewed and completed with integrity — has no home anywhere in the platform. Without a frozen owner, a future feature would either keep bolting fields onto Achievement's flat `leadership` type (forcing an ongoing, reviewable, multi-term service record into a domain designed for after-the-fact claims) or invent a second, uncoordinated system. This ADR freezes Leadership's definition, ownership, lifecycle, and every cross-domain relationship once, before a single table exists.

---

## Core Question

**A learner holds real, ongoing responsibility — a prefect position, a club presidency, a house captaincy — selected through some real process, serving over real time, reviewed and eventually completed. Achievement can record that they were recognized for it afterward. Neither Achievement nor Portfolio can represent the responsibility itself, its selection, its duration, or its review. Who owns that, and how does every domain that needs its outcome (Achievement, Portfolio, Blueprint, Parent Experience, Career Intelligence) read it without ever storing a second copy?**

**Answer**: a new canonical domain, **Learner Leadership**, owns the demonstrated-responsibility process a learner is selected into, serves in, and completes — from nomination through selection, active service, review, completion, verification, and publication — forever, evidence-backed, immutable once published. Achievement continues to own the *recognition* a leadership service may separately earn (an award *about* the leadership), but that recognition now references a Leadership Entry instead of standing alone. Everything else reads Leadership the same "ask, never compute" way it already reads Portfolio, Achievement, Projects, and Competitions.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted)

Searched the entire codebase for every term the mission named (`prefect`, `captain`, `leader`, `leadership`, `council`, `committee`, `monitor`, `representative`, `club offices`, `student government`, `responsibility`) and read the actual implementation of every plausible hit, not just the filename.

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType` includes `'leadership'`, `AchievementCategory` includes `'leadership'` | Two flat enum values on `learner_achievements`, carrying only the same fields every Achievement sub-type carries: `title`, `description`, `awardingOrganization`, `awardDate`, `verifyingDocumentReference`. No role, no selection process, no service duration, no review, no active/completed distinction. `sed`-confirmed against `lib/learnerAchievement/types.ts` in full — no `role`/`scope`/`duration` field exists anywhere in the shipped schema, despite ADR-0012 Phase 2's own text describing Leadership as carrying exactly those. | This is the *recognition claim*, correctly owned by Achievement (ADR-0012) for what it actually stores today — not a leadership-service-process implementation. The gap this ADR fills is everything Achievement's flat type cannot and should not represent. |
| `lib/repositories/project.repository.ts` — `ProjectCategory` includes `'leadership'` | A free-text-labeled Project category (a "leadership project," e.g. organizing a school event) — a Project, not a leadership *role*. | Confirms Projects and Leadership are adjacent but distinct — a leadership role may involve project work, but "leadership" as a Project category names the *work*, never the *responsibility held*. No change needed to Projects (out of scope, unchanged). |
| `lib/learnerPortfolio/types.ts` header comment: "Achievement domain (Awards, Certificates, Leadership, Competitions...)" | Confirms Portfolio has never owned Leadership in shipped code — ADR-0011's original provisional row was already superseded by ADR-0012 before Portfolio's first implementation sprint, identical to the Competitions situation ADR-0014 already documented. | — |
| `app/student/groups/[groupId]`, `components/academy/CohortView.tsx` — "leader"/"leadership" | Subject-based **study group** gamification (points/streaks) and Academy's own **teacher** professional-development cohort views — both already flagged as unrelated adjacent systems in ADR-0012's own Phase 1 audit. | No selection process, no service duration, no verified responsibility — gamified engagement metrics, a different domain entirely. |
| `lib/career/seedCareers.ts`, `lib/academicClinic/careerEngine.ts`, `lib/career/careerIntelligenceEngine.ts`, `lib/cbcCurriculum.ts`, `lib/sow/*` — `prefect`, `captain`, `council`, `responsibility`, generic "leadership" | Career-guidance demo/seed copy, curriculum competency-verb vocabulary ("demonstrates responsibility" as a CBC learning-outcome phrase), and lesson-plan generator prose. | Incidental word matches, not a domain. |
| Every other searched term (`committee`, `monitor` [outside the unrelated job/system-monitoring modules], `representative`, `student government`) | No matching table, module, or feature. Re-confirmed against the full migrations directory: no `leadership_roles`, `student_council`, `class_monitor`, or `prefect_body` table exists anywhere. | — |

**Answer to Phase 1's questions**:
- **Does any leadership capability already exist?** Only as a flat, after-the-fact Achievement claim type — no ongoing-responsibility process, selection record, or service duration exists anywhere.
- **If one exists, document it.** Documented above — Achievement's `leadership` type, correctly scoped to what it can represent (a recognition), never a service-process implementation.
- **If none exists, justify a new canonical domain.** Justified: no domain in this codebase can represent selection, active service duration, review, or completion of an ongoing responsibility. This is the identical justification pattern ADR-0012 (for Achievement), ADR-0013 (for Projects), and ADR-0014 (for Competitions) each already used one sprint earlier for their own domain.

**Conclusion: no canonical Learner Leadership domain exists. A new domain is the correct, non-duplicative outcome — verified, not assumed.**

---

## Phase 2 — Domain Definition (frozen)

**Learner Leadership is demonstrated responsibility held and exercised over time — a real position or role a learner is selected into, actively serves in, and completes — never popularity, a vote count, or a title alone.**

A title with no service behind it is not Leadership. A single popular moment (winning an election, being nominated) with no subsequent active service, review, or completion is not yet Leadership — it is, at most, a Nomination or Selection record awaiting service. This is the mission's own framing, frozen as the domain's first and permanent test: **does the record show responsibility exercised over a real period of time, reviewable and completable, or does it show only a title?** If only a title, it belongs, at most, to Achievement's recognition surface (Phase 7) — never to Leadership's own core record.

**Leadership is NOT:**

| Concept | Why it is not Leadership |
|---|---|
| **Achievement (recognition)** (ADR-0012) | Achievement records that a leadership service was *recognized* — an award, a certificate, a commendation about the role. Leadership records the *service itself* — the selection, the duration, the review, the completion. A recognition may exist with no separate Leadership Entry (an externally-awarded leadership prize with no EduNexus-tracked service record); a Leadership Entry may exist and complete with no recognition ever awarded. See Phase 7. |
| **Portfolio Item** (ADR-0011) | A Portfolio Item is the learner's own curated showcase of an artefact (a speech they wrote as club president, a photo from a leadership camp) — no selection process, no service duration, no review required. A Leadership Entry may be *referenced by* a Portfolio Item; it is never itself one. |
| **Project** (ADR-0013) | A Project is work with a goal and stages, undertaken and completed. A leadership role may *involve* project work (organizing an event as club president), but the role itself — being selected, serving a term, being reviewed — is not a Project. Projects' `leadership` category names the *work a leader did*, never the *responsibility held*; unchanged by this ADR. |
| **Competition Entry** (ADR-0014) | A Competition is a bounded, external, judged event. A Leadership role has no judges and no external competitive ranking — it is an internal school responsibility, reviewed by school staff, never "won" or "placed." |
| **Assessment / Evidence** (Core/Evidence domain) | Assessment is curriculum-anchored academic measurement. A Leadership Entry may *reference* Evidence rows as supporting context (a teacher's observation of the learner's conduct in the role) but is never itself an Evidence row and never feeds capability/knowledge computation. |
| **Disciplinary Record** | Explicitly rejected as a Leadership concept. A role ending early (Phase 4's "Discontinued" terminal branch) carries a neutral, factual note — never a disciplinary case file, never an allegation, never a sanction record. Disciplinary process, if ever built, is a separate, not-yet-designed domain; Leadership must never become its substitute (Phase 11: "disciplinary overlap" risk). |
| **Election / Voting Mechanism** | Rejected as a Leadership-owned concept for this ADR. Leadership records the *fact* of who was nominated and who was selected — never runs, tallies, or computes an election. Building an election/voting feature is explicitly forbidden by this sprint's Stop Condition and is not reserved as a future Leadership capability either — if ever built, it would be a separate, upstream input that merely produces the "Selected" fact Leadership records, never something Leadership computes itself (Phase 11: "popularity bias" risk). |

---

## Phase 3 — Ownership Matrix (frozen)

Every row below has exactly one owner.

| Concept | Owner | Notes |
|---|---|---|
| **Leadership Position** (the role's own descriptive facts: title, scope, body/council it belongs to) | **Learner Leadership** | Inline fields on the Leadership Entry, mirroring Competition's "no separate Event catalog" decision (ADR-0014 Phase 3) — a shared, reusable Position catalog (so "Head Prefect" is defined once per school rather than re-typed) is a named, future extension point, deferred until real duplicate-entry evidence justifies it, never built speculatively. |
| **Appointments** (who holds/held the position) | **Learner Leadership** | The Leadership Entry itself — one row per learner per term/tenure of a position, referencing Core `learners.id` directly. |
| **Elections** | **Not owned by this domain — explicitly rejected as a stored concept** (Phase 2). Leadership records only the *outcome fact* ("Selected"), supplied by whatever real-world or future upstream process determined it. | — |
| **Responsibilities** (what the role entails) | **Learner Leadership** | A descriptive field on the Entry — free text or a frozen vocabulary at implementation time, never computed. |
| **Acting Appointments** (temporary/interim service) | **Learner Leadership** | A boolean/flag field on the Entry, not a separate table — an acting appointment is the same Entry shape with a shorter, explicitly interim tenure, never a second lifecycle. |
| **Completed Service** (the historical fact that a term was served in full) | **Learner Leadership** | The Completion lifecycle phase's own output (Phase 4) — a recorded fact, never inferred from elapsed time alone. |
| **Leadership Reflections** | **Learner Leadership** — explicitly distinct from the general Teacher Reflection domain (`lib/teacherReflection/`). | A Leadership Reflection is scoped narrowly to the service itself (what did the learner learn/demonstrate in this specific role) and is owned, stored, and lifecycle-gated by Leadership. It is never merged with, aliased to, or read by the general per-term Teacher Reflection domain, which covers the whole learner's academic/behavioral term narrative — a deliberate boundary named now to prevent the exact terminology-drift/duplicated-concept risk Sprint 12P's audit already found and fixed once for parent actions. |
| **Mentor Verification** | **Learner Leadership** | A reference field to a school user (staff) who verifies the service — not a new identity system, mirroring Competition's Mentor field (ADR-0014 Phase 3) and Achievement's verifying-actor pattern (ADR-0012 Phase 9) exactly. |
| **Evidence References** | **Learner Leadership** references **Evidence** | Reference-only, never a copy of Evidence's own confidence/lifecycle machinery — identical to Achievement's Phase 5 rule and Competition's Phase 3 rule. |
| **Recognition** (an award/certificate *about* the leadership) | **Learner Achievement** references **Learner Leadership** | See Phase 7. Achievement owns the recognition claim; Leadership owns the service it recognizes. |
| **Historical Record** | **Learner Leadership** | The Historical lifecycle terminal state (Phase 4), reusing Blueprint's own "historical" freshness vocabulary deliberately, exactly as ADR-0014 already established for Competitions. |

No row above has more than one owner. No row above is owned by a domain this ADR was forbidden to touch.

---

## Phase 4 — Lifecycle (frozen, every state and transition reasoned)

**Main line**: `Nomination → Selection → Active Service → Review → Completion → Verification → Published → Historical`

Each adjacent pair was checked against the "reject unnecessary states" instruction:

| Check | Verdict |
|---|---|
| Nomination vs. Selection | **Not redundant.** Nomination is "considered for the role" (may never proceed); Selection is "confirmed into the role." Collapsing them would make every nomination a de facto appointment, which is false — a school may nominate three learners for one prefect seat. |
| Active Service vs. Review | **Not redundant.** Active Service is the real, ongoing tenure (weeks to a full year); Review is a discrete, bounded act (a staff member assessing the term) that happens at or near the end of service, not throughout it — the same "live process vs. a bounded confirming act" distinction ADR-0014 Phase 4 already reasoned for Competitions' Participation-vs-Judging pair. |
| Review vs. Completion | **Not redundant.** Review is the staff assessment; Completion is the factual close-out (the term ended, in good standing or otherwise) — a role can be Reviewed and still be ongoing (a mid-term check-in) before it later reaches Completion. |
| Completion vs. Verification | **Not redundant.** Completion is "the term is over, here is what happened." Verification is the same governance gate Achievement/Competitions both require before anything reaches Published — an authorized school actor confirming the completed-service record is trustworthy, never skipped. |

| Transition | Trigger | Actor |
|---|---|---|
| — → Nomination | A learner is put forward for a position | Teacher / School staff (or a future upstream process, e.g. an election result — never computed by this domain, see Phase 2) |
| Nomination → Selection | The learner is confirmed into the role | Teacher / School staff records confirmation |
| Nomination → **Not Selected** *(terminal branch)* | The learner was nominated but not chosen | Teacher / School staff |
| Selection → Active Service | The term of service begins | Teacher / School staff (or system-recorded on a named start date) |
| Active Service → Review | A staff member assesses the service (may occur once or repeatedly across a long tenure — see Known Gaps) | Teacher / School staff |
| Active Service / Review → **Discontinued** *(terminal branch)* | The role ends before Completion (resignation, role dissolved, term shortened) — carries a neutral, factual note only, never a disciplinary case record (Phase 2/11) | Teacher / School staff |
| Review → Completion | The term concludes as planned | Teacher / School staff records the close-out |
| Completion → Verification | The completed-service record is queued for confirmation | System-queued automatically on Completion entry, mirroring Competition's identical Results→Verification automatic transition (ADR-0014 Phase 4) |
| Verification → Published | An authorized school actor confirms the record is trustworthy | Teacher / School staff (verifying actor) |
| Verification → **Rejected** *(terminal branch)* | The claimed service cannot be confirmed | Teacher / School staff |
| Published → Historical | A defined dormancy period elapses after Publication (reusing Blueprint's "historical" vocabulary, ADR-0008) | System, time-based |
| Published → **Revoked** *(terminal branch)* | A previously verified/published record is later found invalid | School administrator |

Four terminal branches (`Not Selected`, `Discontinued`, `Rejected`, `Revoked`) — the same proportionate count ADR-0014 froze for Competitions, each independently justified above rather than copied by default. Once a record reaches `Published`, `Not Selected`, `Discontinued`, or `Rejected`, its core facts are immutable — the same three-layer discipline (Service/Repository/DB trigger) ADR-0012/0013/0014 each require, reserved here for the future implementation sprint to build.

---

## Phase 5 — Blueprint Relationship (frozen)

**Blueprint owns nothing. Leadership owns Leadership.** A future `composeLeadership()` reads one canonical summary function only, capped to exactly:

- **Current role** — the single active (Selection/Active Service-status) position, if any, `{title, scope}` only — no internal review notes, no start date detail beyond what's needed to confirm it's current.
- **Verified completed roles** — count and highlights of Published entries only.
- **Service summary** — the same count/latest/highest-scope shape every sibling domain's Blueprint field budget already uses (mirroring Achievement's `CATEGORY_RANK`-style highest-level pick, Competition's `latestCompetition`/`totalCompetitions` shape).
- **Leadership URL** — null until a future Leadership surface exists, matching every sibling domain's `profileUrl`/`portfolioUrl`/`projectsUrl`/`competitionsUrl` precedent exactly.

**Never**: meeting logs, disciplinary records (Leadership doesn't store these at all, Phase 2), staff evaluations/Review notes, or any unpublished Entry's internal detail. This is the identical "never expose judging/raw feedback/unpublished work" discipline mission Phase 7 already froze for Competitions in ADR-0014, applied here to Review notes and meeting logs specifically.

---

## Phase 6 — Portfolio Relationship (frozen)

**Portfolio references Leadership. Leadership never reads Portfolio.**

As with Competitions (ADR-0014 Phase 9), Portfolio's own category taxonomy has **no `leadership` slot today** — it was permanently reassigned to Achievement by ADR-0012, and Portfolio's `types.ts` header comment names this exclusion explicitly. There is currently no Portfolio category a `leadership_id` reference field would attach to. This ADR freezes the *eventual* relationship (a future Portfolio artefact — e.g. a speech, a photo, a reflection piece — could reference the Leadership Entry that produced it, mirroring `portfolioProjectLink.ts`'s exact pattern) without mandating Portfolio schema changes now; whether/when Portfolio gains a category slot for this is deferred to a future, Portfolio-domain-led decision, the same deferral discipline ADR-0013 and ADR-0014 each already used for their own Portfolio-adjacent relationships.

Portfolio stores artefacts (the learner's own curated showcase). Leadership stores verified service (the responsibility itself). These remain permanently separate — an artefact from a leadership role is never mistaken for, or merged with, the service record it came from.

---

## Phase 7 — Achievement Relationship (frozen)

**Leadership recognition and leadership service are different facts, and this ADR freezes why:**

- **Leadership recognition** (Achievement-owned) is a discrete, external or internal acknowledgment — "Most Outstanding Prefect 2026," a certificate, a commendation. It is awarded *once*, at a point in time, exactly like every other Achievement sub-type (a title/description/organization/date claim).
- **Leadership service** (Leadership-owned) is the ongoing responsibility itself — the selection, the months of active service, the review, the completion. It has duration, has an internal review process, and can be Discontinued — none of which a recognition claim can represent.

A learner can serve a full, well-reviewed term as house captain and receive no special recognition beyond the completed service record itself (Published, in Leadership). A learner can also receive an external "Young Leader Award" with no EduNexus-tracked service record at all (a standalone Achievement, no Leadership Entry behind it). Neither implies the other — this is precisely why they cannot be merged into one domain.

**Frozen boundary**: Achievement's existing `leadership` `AchievementType` gains an optional reference field pointing at the Leadership Entry it recognizes, going forward — the identical "provisional category becomes a reference" pattern ADR-0014 Phase 3 already froze for Achievement's `competition` type. As with Competitions (ADR-0014 Phase 8), this ADR does **not** mandate an immediate schema change to `learner_achievements` — that remains reserved for a future, Achievement-domain-led migration, consistent with this sprint's own architecture-only scope and "Do NOT modify Achievement" discipline.

---

## Phase 8 — Career Relationship (frozen)

**Career Intelligence may read verified Leadership. Leadership never computes employability. Career owns interpretation; Leadership owns facts.**

Identical, one-directional rule to ADR-0011's Career↔Portfolio relationship and ADR-0014 Phase 5's Career↔Competitions relationship: a future Career Intelligence enhancement could read a learner's Published Leadership record (e.g. "this learner completed two verified leadership terms") as additional evidence input — but the interpretation, weighting, and any resulting orientation-level judgment remains entirely Career Intelligence's own canonical computation (`lib/career/capabilityMatchEngine.ts`, unchanged by this ADR). Leadership never predicts a career, never stores a career-relevance score, never tags an Entry with a suitability judgment. This boundary is permanent, not just for this sprint — Career interpreting facts that Leadership merely records is the same division of labor this entire ADR series enforces everywhere (Portfolio, Achievement, Competitions all follow it identically).

---

## Phase 9 — Audience Matrix

| Field group | Learner | Parent | Teacher | School | University | Employer | Why |
|---|---|---|---|---|---|---|---|
| Current role | Yes | Yes | Yes | Yes | No | No | An in-progress responsibility is meaningful to the learner's own support network; not yet a verifiable completed claim for external audiences. |
| Completed service (Published) | Yes | Yes | Yes | Yes | Yes | Yes | The core verifiable claim — same visibility discipline as Achievement's/Competition's own published record. |
| Internal reviews (Review-phase notes) | No | No | Yes | Yes | No | No | A staff assessment of an ongoing term is coaching/oversight content, never learner- or parent-visible raw feedback, matching Competition's Judges/Feedback treatment (ADR-0014 Phase 7) — and never external-facing at all. |
| Reflections (Leadership Reflections, Phase 3) | Yes (own) | Yes (summary) | Yes | Yes | Reserved | Reserved | Primarily a growth signal for the learner and their support network; external-party visibility deferred, not yet a frozen need — identical reasoning to Competition's Judges/Feedback external-visibility deferral. |
| Evidence references | No (raw) | No (raw) | Yes | Yes | No | No | Internal-only, matching every sibling domain's Evidence-reference visibility rule — never rendered to any external or public surface. |

---

## Phase 10 — Reserved Extensions (named, not built)

The following are reserved as future Leadership sub-types/categories — matching ADR-0011 Phase 10's "named future slots only" discipline exactly, no schema, no code, no premature taxonomy commitment:

Student Parliament, House Leadership, Club Executive, Community Leadership, Faith Leadership, Sports Leadership, Digital Leadership, Peer Mentorship, Alumni Leadership.

Each, when a real implementation sprint proposes it, becomes either a new value in Leadership's own frozen category/position taxonomy (mirroring Competition's closed-enum-with-named-amendment-process discipline, ADR-0014 Phase 3) or, if fundamentally different in shape, a case for its own ADR — that classification decision is explicitly deferred to whichever future sprint actually proposes each one, not decided here.

---

## Phase 11 — Risks and Architectural Protections

| Risk | Architectural protection |
|---|---|
| Popularity bias | Leadership records demonstrated responsibility over time (Selection through Completion), never a vote count or popularity metric — no such field exists anywhere in the frozen ownership matrix (Phase 3), and elections/voting are explicitly rejected as a Leadership-owned concept (Phase 2). |
| Duplicated achievement | Achievement references Leadership rather than re-implementing role/duration/review fields itself (Phase 7) — the entire reason this ADR exists. |
| Duplicated portfolio | Portfolio references Leadership, never stores a second copy of an Entry's fields (Phase 6) — identical to the already-proven Portfolio→Projects/Competitions pattern. |
| Disciplinary overlap | Leadership has no disciplinary-record concept anywhere in its ownership matrix (Phase 2/3) — a "Discontinued" exit carries only a neutral factual note, never a case file; true disciplinary process is named as a reserved, separate, not-yet-designed domain, never Leadership's responsibility. |
| Unverifiable appointments | The mandatory Verification lifecycle phase (Phase 4) requires an authorized school actor's confirmation before any record can reach Published — no record skips Verification, mirroring Achievement's/Competition's non-negotiable gate exactly. |
| Title inflation | Leadership Position titles are frozen to a controlled vocabulary at implementation time (never arbitrary free text), the same closed-enum discipline Competition already applies to Level/Category (ADR-0014 Phase 3) — reserved for the implementation sprint to define, named here so it isn't left open by omission. |
| Missing evidence | Evidence references are reference-only and never fabricated (Phase 3); the implementation sprint is expected to require Evidence-or-verifying-reference before Verification can complete, mirroring Achievement's Phase 5 non-negotiable rule — named as an expectation here, to be enforced in code at implementation time. |
| Long-term history | Historical is the frozen, time-based terminal archival state (Phase 4); Published/terminal records are immutable, reserved to be enforced by a database trigger exactly as Achievement/Projects/Competitions already prove works. |

---

## Constitutional & Architectural Compliance

- **Evidence First** (Educational Constitution Article I) — a Leadership record is recorded only after Completion/Verification; Evidence references are never fabricated (Phase 3, mirroring ADR-0012 Phase 5/ADR-0014 Phase 3's identical rule).
- **Single ownership, no second calculation** (RAS §3) — Phase 3's matrix gives every concept exactly one owner.
- **Compose, never own** (ADR-0005/0006, extended by ADR-0011/0012/0013/0014) — Blueprint, Portfolio, and Career all only read/reference/summarize Leadership, never compute or duplicate it (Phase 5/6/8).
- **Reference, never copy** (ADR-0012 Phase 5) — Leadership's relationship to Evidence is reference-only (Phase 3); Achievement's relationship to Leadership is reference-only, going forward (Phase 7).
- **Teacher/school accountability** — every lifecycle transition from Nomination onward requires a named actor (Phase 4); the two purely time-based/system-queued transitions (Completion→Verification, Published→Historical) carry no verifiable claim of their own, mirroring Competition's identical two automatic transitions.
- **Portfolio remains compose-only** (ADR-0011, reaffirmed unchanged — Phase 6).
- **Achievement remains verification-only** (ADR-0012, reaffirmed unchanged — Phase 7).
- **Career remains interpretation-only, never fact-owning** (Phase 8, reaffirmed).
- **Parent Experience remains read-only** (ADR-0010) — not separately re-derived here since this ADR does not name a Parent Experience relationship the mission didn't ask for; Leadership's Blueprint summary (Phase 5) is the only surface Parent Experience would ever read, identical to every sibling domain.

---

## Verification Against Mission's Checklist

- [x] No code changed, no migration, no repository, no service, no UI
- [x] One canonical owner exists for every concept (Phase 3)
- [x] Blueprint remains compose-only (Phase 5)
- [x] Portfolio unchanged (Phase 6, category taxonomy untouched)
- [x] Achievement unchanged (Phase 7, no schema change mandated)
- [x] Career unchanged (Phase 8, no code touched)
- [x] Constitution compliant (Constitutional & Architectural Compliance section)
- [x] RAS compliant (§3 Canonical Domain Standards)

---

## Stop Condition

This ADR, its companion sprint document, and one implementation-log entry are the only artifacts this sprint produces. No election, voting, dashboard, analytics, leaderboard, badge, messaging, notification, certificate, parent feature, or AI summary is designed or built here. Sprint 13D (Learner Leadership implementation) requires explicit approval before any of the above begins.
