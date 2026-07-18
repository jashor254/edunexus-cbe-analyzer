# Sprint 12J-A — Blueprint Architecture Consistency Review

**Status: audit complete. Zero code, UI, route, repository, service, or migration touched.** This document itself contains the only writing this sprint produced, beyond the implementation-log entry.

**Reviewed together**: ADR-0003 (Attendance Domain), ADR-0004 (Attendance Integration), ADR-0005 (Blueprint Architecture), ADR-0006 (Educational Experience), ADR-0007 (Layout & Experience), ADR-0008 (Lifecycle & Rendering), ADR-0009 (Presentation Architecture), and every companion document (`sprint-12c` through `sprint-12i`), cross-referenced against the Educational Constitution, Reference Architecture Specification, Repository Architecture Standard, `learner-record-layer-decisions.md`, the shipped Blueprint Composition Engine (`lib/learnerBlueprint/`, Sprint 12G), and the Identity Bridge (`lib/core/identity.ts`, Sprint 12H).

**Method**: every finding below was verified against the actual current text of these files (grep + direct reads this session), not recalled from memory of having written them — several turned out to differ from what a summary-level recollection would have suggested.

---

## Verdict

**⚠ Minor wording corrections required.**

No structural, ownership, or computation conflict was found anywhere in the seven ADRs. Five real issues were found — three are documentation-only miscounts/drift, one is a wording-clarity gap that could mislead a future implementer, and one is a real (but non-contradictory) gap between what the architecture documents specify and what Sprint 12G's shipped code currently implements. None require reopening a ratified decision; all are corrections, not redesigns.

---

## 1. Inconsistency Matrix

| # | Area | Documents involved | Severity | Type |
|---|---|---|---|---|
| 1 | Educational Identity confidence bands miscounted as "three" when only two are named | ADR-0007, sprint-12e | ⚠ | Wording/arithmetic error |
| 2 | "Timeline" and "Evidence Trail/Trace/Timeline" — three distinct concepts under overlapping names | ADR-0005/0006 (Growth Timeline), ADR-0007 §11 (Evidence Trail), ADR-0008 §1 (Historical Timeline), ADR-0009 §6/Layer 5 (Evidence Trace, Evidence Timeline) | ⚠ | Terminology overload |
| 3 | "Fourteen reserved future modules" — two different lists (13 items and 15 items), both mislabeled "fourteen" | ADR-0007 §17/sprint-12e, ADR-0008/sprint-12f §5, ADR-0009/sprint-12i §11 | ⚠ | List drift / miscount |
| 4 | Per-section Live/Snapshot/Historical freshness is architecturally specified but not yet a field in the shipped type | ADR-0007 §6, ADR-0008 §6, vs. `lib/learnerBlueprint/types.ts` | ⚠ | Architecture-vs-code gap (not an ADR-vs-ADR contradiction) |
| 5 | The mission's own "Report Card → Snapshot → Current → Compass → Career" ordering could be misread as one literal forward navigation chain | This sprint's mission text vs. ADR-0009 §6/§9 (Report Card is a strict dead-end; Compass/Career are independent exits, not sequential stops) | ⚠ | Wording clarity, not a document defect |

No item rises to ❌. Every item is corrigible by editing existing text; none requires a new decision or reopens a section's ownership, freshness classification *rule* (only its *implementation status*), or navigation direction.

---

## 2. Terminology Audit

Checked: Blueprint, Snapshot, Report Card, Educational Identity, Growth Timeline, Attendance Health, Career Snapshot, Learning Compass, Teacher Reflection, Parent Summary, Current Blueprint, Historical Blueprint.

| Term | Meaning(s) found | Consistent? |
|---|---|---|
| Blueprint | The permanent longitudinal learner record (ADR-0005 §1), used identically in every document | ✅ |
| Snapshot | (a) `BlueprintMetadata.snapshotState: 'current'\|'snapshot'` value; (b) "Blueprint Snapshot" — the immutable frozen artifact (ADR-0008 Part 3); (c) ADR-0007's originally-considered-then-rejected state name "Snapshot Published" (ADR-0008 Part 2 explicitly rejects it, no lingering use found) | ✅ — (a) and (b) are the same concept at two levels (a type value naming the concept it flags); (c) was cleanly retired |
| Report Card | The official term assessment snapshot, Report-Cards-owned, always independent, never re-rendered inside Blueprint | ✅ — identical across ADR-0005 §5, ADR-0008 Part 3, ADR-0009 §9, with zero drift |
| Educational Identity | A single evidence-derived engagement-pattern label — consistent purpose, display rules, and limitations across ADR-0006 §9, ADR-0007 §9, ADR-0009 | ✅ purpose/limitations; ⚠ confidence-band count (Finding 1) |
| Growth Timeline | A Blueprint *section* listing milestones (ADR-0005 §2.9, ADR-0006 §10, ADR-0007 §10) | ⚠ — name collides with two other "Timeline" uses (Finding 2) |
| Attendance Health | A one-line plain-language attendance status, presentation-only, never a calculation | ✅ — identical across ADR-0006 §5, ADR-0007 §4, ADR-0009 §2 |
| Career Snapshot / "Career Intelligence snapshot" | Used generically ("one concise snapshot," ADR-0006 §4/§5) — lowercase, descriptive, never claims to be a `Blueprint Snapshot` artifact | ✅ on inspection — no document actually conflates the two, though the shared word invites a careless future misreading; noted as a soft risk, not a finding requiring correction |
| Learning Compass | The external domain Blueprint summarizes and links to, never absorbs | ✅ — identical across all seven ADRs |
| Teacher Reflection | The designed-but-unimplemented 5-subfield structure; consistently described as having no owning domain yet (ADR-0006 §6, ADR-0007 §7, and confirmed still true in Sprint 12G's `composeTeacherReflection.ts`) | ✅ — architecture and code agree exactly |
| Parent Summary | The presentation-only, non-owning synthesis section | ✅ — identical across ADR-0005 §2.8, ADR-0006 §7, ADR-0007 §8, and matches `composeParentSummary.ts`'s actual behavior |
| Current Blueprint | The always-live composition, never itself frozen except by taking a Snapshot | ✅ — identical across ADR-0008 Part 3, ADR-0009 §6 |
| Historical Blueprint | Used interchangeably with "Historical Snapshot" (ADR-0009 §6's heading says "Historical Blueprint (Snapshot)" — a parenthetical self-clarification, not a separate concept) | ✅ on close reading — ADR-0009 itself already disambiguates this one inline; no correction needed |

---

## 3. Ownership Audit

Every section in ADR-0005 §3's ownership matrix was traced through ADR-0006, ADR-0007, ADR-0008, ADR-0009, and the shipped `lib/learnerBlueprint/` code. Result: **zero duplicated ownership, zero new owning sections introduced by any later document.** ADR-0006's two additions (Educational Identity, Educational Philosophy) are both explicitly non-owning, restated identically in ADR-0007/0008/0009 without drift. ADR-0009's "Layer" concept (§1) is presentation-only and owns nothing — confirmed by its own text ("a layer either shows a section or doesn't — it never shows a different version of a layer"). Code-level confirmation: every `BlueprintSection<T>.owner` string in the shipped engine names exactly one domain function, and `sprint-12g`'s own documentation already confirmed via grep that `lib/learnerBlueprint/` issues zero raw table writes — reconfirmed this session (§7 below).

---

## 4. Lifecycle / Freshness Audit

ADR-0007 §6 and ADR-0008 §6 both classify sections as Live / Snapshot / Historical Snapshot, and the two tables agree on every row (Attendance=Snapshot, Learning Compass=Live, Career Intelligence=Live, Teacher Comment=Snapshot, Report Card=Historical Snapshot, Academic Record=Live). **No contradiction between the ADRs.**

**Finding 4 (architecture-vs-code gap)**: this three-value per-section classification does not yet exist as a field anywhere in `lib/learnerBlueprint/types.ts`. The shipped `BlueprintSection<T>` type has only `status: 'available'|'unavailable'|'not_implemented'` — no `freshness` field. The only `freshness` field that exists in code is `BlueprintMetadata.freshness: 'live'|'partial'`, a *different* concept (a whole-Blueprint aggregate describing whether every section composed successfully, not a per-section Live/Snapshot/Historical label). This is not an ADR-vs-ADR contradiction — Sprint 12G never claimed to implement per-section freshness labeling, and nothing in ADR-0008 required it to at that stage. It matters now because ADR-0009 §1 (Layer 4) requires Historical Snapshots to be "explicitly labeled as historical/immutable, never mistaken for the Current Blueprint" — which needs a per-section (or at minimum per-Blueprint-instance) freshness/historicity label the current type doesn't carry. **Recommendation**: before or during Sprint 12J's presentation work, add a `freshness: 'live' | 'snapshot' | 'historical'` field to `BlueprintSection<T>` (or an equivalent per-composition-instance flag), populated per ADR-0007 §6's table. This is a small, additive type change, not a redesign.

---

## 5. Navigation Audit

Traced the full chain this sprint's mission names — "Report Card → Blueprint Snapshot → Current Blueprint → Compass → Career" — against ADR-0009 §6 (Snapshot Presentation) and §9 (Report Card Relationship), the two documents that actually froze navigation direction.

**No contradiction found between ADR-0009 and any earlier ADR.** But **Finding 5**: the mission's own linear phrasing, read literally, does not match what ADR-0009 actually froze, and is worth flagging so a future implementer doesn't build the wrong thing from the mission text alone:
- ADR-0009 §9 froze Report Card as a **strict dead-end** — "it doesn't know Blueprint exists," zero embedded navigation, no forward link of any kind.
- Actual navigation direction is **backward from Current**: Current Blueprint → (term selector) → Historical Snapshot → (one citation link) → Report Card. Not the reverse.
- Compass and Career are **not** sequential stops after Report Card in a chain — they are independent, one-directional *exits* reachable from Current Blueprint (and from a Historical Snapshot, at the same Layer 2/3 depth), per §7/§8.

The mission's ordering is defensible read as "the four entities involved, outermost-to-innermost conceptually" rather than "click here, then here, then here" — but nothing in ADR-0009 currently states this distinction in so many words. **Recommendation**: add one clarifying sentence to ADR-0009 §6 (or the next document that references this chain) stating explicitly that the Report Card → Snapshot → Current ordering is directional-backward from Current, and that Compass/Career are parallel exits, not continuations of that chain.

---

## 6. Identity Audit

Traced: Core learner identity → Identity Resolver → Blueprint Composition → Presentation, checking for any bypass or second path.

**Confirmed clean, no bypass.** Grep of `lib/learnerBlueprint/*.ts` (excluding tests) confirms `resolveLegacyStudentId` is imported and called in exactly one place — `composeBlueprint.ts:15,40` — and every sub-composer (`composeAcademicRecord`, `composeLearningCompass`, `composeCareer`) receives an already-resolved `legacyStudentId: string | null` as a plain parameter, never calling the resolver itself. This matches ADR-0009's presentation-layer assumption (Composition happens once, before any audience/layer filtering — ADR-0008 Part 6, ADR-0009 §2's binding restatement) and Sprint 12H's own stated goal exactly. No second identity-resolution path exists anywhere in `lib/learnerBlueprint/`.

---

## 7. RAS Compliance Audit

- **No duplicated business logic**: confirmed — no composer re-implements a calculation another domain owns (verified against `sprint-12g`'s own grep results, re-run this session: zero imports of `extractCapabilityProfile`/`computeCapabilityProfile`/`calculateJuniorPathwayAffinity` anywhere in `lib/learnerBlueprint/`).
- **No duplicated ownership**: confirmed, §3 above.
- **No cross-domain calculations**: confirmed — every composer's only computation is presentation-level tallying already sanctioned by ADR-0004 §4 (e.g., Attendance's present/absent/late/excused count, identical in kind to Report Cards' own existing `toReportCardAttendance` pattern).
- **No Operating-Layer reads**: confirmed by grep this session — zero raw `.from(...)` calls in any `lib/learnerBlueprint/*.ts` composer file (one hit only in the integration test's teardown code, not composition logic, and one in a code comment referencing the table name for documentation purposes, not a query).
- **No architectural drift**: the five findings above are documentation/wording issues, not evidence of drift in the architecture's actual rules — every ADR from 0005 through 0009 still agrees on ownership, freshness rules, and navigation direction once the wording ambiguities are resolved.

---

## 8. Constitutional Audit

Every Article citation across ADR-0006 through ADR-0009 was checked against the actual text of `docs/sprint-25-educational-constitution-and-migration-strategy.md` this session:

| Article | Cited as | Verified wording | Match? |
|---|---|---|---|
| I | Evidence is the only currency of truth | (title matches) | ✅ |
| II | Missing evidence is never poor performance | (title matches) | ✅ |
| III | Confidence measures certainty, not ability | (title matches) | ✅ |
| V | Risk predicts support needs, never worth | (title matches) | ✅ |
| VI | AI explains evidence; it never invents it | (title matches) | ✅ |
| VIII | A teacher approves before a claim reaches a parent | (title matches) | ✅ |
| IX | Every recommendation must be traceable to its evidence | (title matches) | ✅ |
| X | Career guidance recommends possibility, never fixed destiny | (title matches) | ✅ |
| XI | A number without a name is not neutral | (title matches) | ✅ |

No misquote, no misattributed article, no citation of a non-existent article found anywhere in the Blueprint ADR series. Every Blueprint statement's evidence-first/AI-explains/missing-evidence/career-guidance/teacher-approval/confidence-labeling behavior traces to a real Article, correctly cited.

---

## 9. Future Compatibility Audit (Finding 3, detailed)

The "fourteen reserved future modules" claim, checked verbatim across three documents:

**ADR-0007 §17** (13 items, but the sentence says "these fourteen here"): Behaviour, Innovation, Leadership, Projects, Portfolio, Community Service, Entrepreneurship, Competitions, Sports, Arts, Wellbeing, AI Skills, Digital Literacy.

**ADR-0008 companion §5** (15 items, also called "fourteen"): Behaviour, Wellbeing, Portfolio, Innovation, Projects, Community Service, Leadership, Scholarships, Competitions, Entrepreneurship, Global Certifications, future AI tutors, future University pathways, future Employment Record, lifelong learning.

**Overlap**: Behaviour, Wellbeing, Portfolio, Innovation, Projects, Community Service, Leadership, Competitions, Entrepreneurship (9 items in both).
**Only in ADR-0007's list**: Sports, Arts, AI Skills, Digital Literacy.
**Only in ADR-0008's list**: Scholarships, Global Certifications, future AI tutors, future University pathways, future Employment Record, lifelong learning.

**ADR-0009 companion §11** compounds the error, referring to "Behaviour and the thirteen other ADR-0007 §17 reserved future modules" — ADR-0007 §17 only names 12 *other* items besides Behaviour, so this should read "twelve," not "thirteen."

**This sprint's own mission text** names an eighth, third variant: Behaviour, Portfolio, Projects, Innovation, Community Service, Leadership, Wellbeing, Future Skills (8 items) — a reasonable illustrative subset, not intended as an exhaustive list, but its partial overlap with two already-inconsistent "complete" lists shows how easily this number drifts further with each new document that touches it.

**None of this is a structural problem** — every module named in any list is correctly treated as reserved-only, no schema, no calculation, no section built, consistent with ADR-0005/0006/0007's "architecture only" discipline. It is a pure enumeration/counting inconsistency. **Recommendation**: the next document that touches this list (Sprint 12J or later) should establish one canonical, correctly-counted list — the union of both existing lists is **19 items**: Behaviour, Innovation, Leadership, Projects, Portfolio, Community Service, Entrepreneurship, Competitions, Sports, Arts, Wellbeing, AI Skills, Digital Literacy (the 13 from ADR-0007 §17) plus Scholarships, Global Certifications, future AI tutors, future University pathways, future Employment Record, lifelong learning (the 6 additional from ADR-0008's list not already in ADR-0007's) — cited identically by number and name from every future document, replacing the "fourteen" phrasing everywhere it currently appears.

Every reserved module, regardless of which list, still fits the Composition → Audience Filter → Renderer pipeline and the Evidence → Meaning → Action pattern without requiring an ADR change — reconfirmed this session, `sprint-12f`'s own per-domain compatibility table (§5) already demonstrated this generically (the pipeline's only dependency on a new domain is that it expose Evidence/Meaning/Action), and nothing in ADR-0009 narrows that.

---

## 10. Recommended Wording Corrections (complete list)

1. ADR-0007 line 29 and `sprint-12e` line 126: change "exactly three confidence bands" → "exactly two confidence bands" (Emerging, Established).
2. `sprint-12f` / ADR-0008 §1: consider renaming the lifecycle-diagram stage "Historical Timeline" to "Snapshot History" to disambiguate from the Growth Timeline section.
3. Standardize "Evidence Trail" (ADR-0007 §11) / "Evidence Trace" (ADR-0009 Layer 5) / "Evidence Timeline" (ADR-0009 §6/§9) to one term — recommend "Evidence Trail" (first-named, QR-facing, user-visible) — and update ADR-0009's two other usages to match.
4. ADR-0007 §17 / sprint-12e: "these fourteen here" → "these thirteen here" (13 actual items listed).
5. ADR-0008 companion §5: reconcile its 15-item list with ADR-0007 §17's 13-item list into one canonical, correctly-counted list (§9 above); stop calling either "fourteen."
6. ADR-0009 companion §11: "the thirteen other ADR-0007 §17 reserved future modules" → "the twelve other..." (pending the broader reconciliation in #5, this number will change again once one canonical list is adopted).
7. ADR-0009 §6 (or wherever this chain is next referenced): add one sentence clarifying that "Report Card → Snapshot → Current Blueprint → Compass → Career" describes entities, not a literal forward navigation chain — Report Card is a dead-end, navigation runs backward from Current, and Compass/Career are parallel exits.
8. `lib/learnerBlueprint/types.ts`: add a per-section (or per-composition) `freshness: 'live' | 'snapshot' | 'historical'` field before Sprint 12J's presentation work depends on rendering the Live/Snapshot/Historical label ADR-0007 §6/ADR-0008 §6 already specify. This is a code change, not a documentation correction — flagged here because the audit surfaced it, but it is not part of this sprint's own deliverable (architecture-only) and should be scoped explicitly, not made silently as a rider on this review.

None of these eight corrections change any ADR's actual decision — every one is either a miscount, a naming collision, or a clarifying addition to already-correct substance.

---

## 11. Zero-Code Verification

This sprint touched: `docs/architecture/sprint-12j-blueprint-consistency-review.md` (new) and `docs/engineering/implementation-log.md` (append). Confirmed via `git status`-equivalent review of this session's own edits — no `.ts`/`.tsx` file, migration, route, repository, or service was created or modified while producing this review. The eight recommended corrections above (§10) are documented as recommendations for future sprints to apply, not applied here.

---

## Stop Condition

Per explicit mission instruction: this document and the implementation-log entry are the complete deliverable. **Stop here.** No implementation begins as a result of this review. Wait for approval before the real Blueprint UI implementation sprint — and, per the mission's own framing, this review's verdict (⚠, not ❌) means that approval can reasonably proceed once the wording corrections in §10 are either applied or explicitly deferred with the user's knowledge; nothing found here blocks Sprint 12J on architectural grounds.
