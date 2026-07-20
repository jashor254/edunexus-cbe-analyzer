# ADR-0019 — Teacher Workspace Architecture

**Status: DRAFT — awaiting explicit approval before any implementation sprint begins.** This is a design decision record only. No table, migration, repository, service, route, UI, or test was created in producing it — this document, `sprint-prp1-teacher-workspace-foundation.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Teacher Workspace implementation sprint (unscheduled — pending approval).
**Supersedes**: nothing. Formalizes and corrects the existing de-facto shell (`app/teacher/layout.tsx` + `TeacherSidebar`/`TeacherBottomNav`), rather than replacing it.
**Depends on**: `docs/architecture/sprint-prp1-teacher-workspace-foundation.md` (the audit and design this ADR resolves into a decision), `canonical-domain-registry.md`, ADR-0003/0004 (Attendance).

---

## Section 1 — Problem Statement

Sprints 6 through 13I built EduNexus's constitutional domains: Schools, Attendance, Assessments, Report Cards, Evidence, Blueprint, Portfolio, Achievement, Projects, Competitions, Leadership, Community Service, Wellbeing, Innovation, Parent Experience, Compass, Career Intelligence, Teacher Reflection. Each domain, audited in isolation, is architecturally sound.

No sprint has ever asked whether a real teacher, on a real school day, can find and use these domains without already understanding the architecture underneath them. Sprint PRP-1's audit (see the sprint document this ADR depends on) found the answer is currently **no**, for reasons that are entirely navigational and presentational, not computational:

- Two nav items share the unqualified label "Reports," pointing at two different artifacts (an AI/Clinic-generated PDF vs. the canonical `school_report_cards` pipeline), with zero cross-linking.
- Assessment marks entry and Assessment lock/publish have no unifying nav entry at all — a teacher reaches them through unrelated drill-down paths.
- A real, schema-enforced teaching pipeline (Scheme of Work → Lesson Plans → Record of Work) is presented as three disconnected peer menu items.
- The one correctly-built "always-on intelligence, quietly presented" surface (Attention Feed / Today's Mission on `/teacher/dashboard`) has no siblings — every other intelligence surface (Insights, Monday Panel, Career Intelligence) is either missing a nav entry entirely or buried behind an unrelated page.
- A teacher with a dual parent/teacher role is dropped into a second, structurally unrelated navigation shell (`app/dashboard` + `DashboardNavbar`) with only a banner link bridging the two.
- Admin/School-Office tooling (`core-office`, `core-team`, `core-admissions`) is nested under `/teacher/core-*`, blurring what belongs to a classroom teacher's daily workspace versus a school administrator's.

**The Teacher Workspace is not a new domain.** It owns no canonical data, computes nothing, and introduces no new identity. It is the presentation and navigation layer that arranges already-canonical domains around how a teacher actually spends a school day.

---

## Section 2 — Goals

1. **One entry point.** A teacher opens EduNexus and lands on a single "My Day" surface that already tells them what matters today, extending the existing Attention Feed pattern rather than replacing it.
2. **Honest navigation.** No two nav items may share an ambiguous label for different underlying artifacts (fixes the "Reports" vs. "End of Term" collision named in Section 1).
3. **Guided, not scattered, workflows.** Where a real data dependency exists between domains (SOW → Lesson Plans → Record of Work), the navigation should reflect the sequence, not present three unrelated peers.
4. **Constitutional intelligence, adaptive presentation.** Adaptive Learning, Compass, and Career Intelligence continue computing exactly as built; only their visibility/prominence adapts to a school's paper/hybrid/digital readiness.
5. **Correct scope boundary.** School-Office/admin tooling is identified as out of the Teacher Workspace's identity, without requiring it to be moved this sprint.
6. **No regression.** Every route audited in Sprint PRP-1 as "fully built and live" keeps working exactly as it does today; this ADR reorganizes navigation and labeling, not underlying services.

---

## Section 3 — Non-Goals

Explicitly out of scope for this ADR, per the mission's Forbidden list and Sprint PRP-1's own findings:

- **No redesign** of Blueprint, Learning Compass, Career Intelligence, Portfolio, Projects, Competitions, Leadership, Community Service, Innovation, or Report Cards as domains — only how their existing teacher-facing entry points are labeled and reached.
- **No new intelligence algorithm, AI chat, notification system, mobile app, timetable engine, homework system, or behaviour system.**
- **No resolution of the Assessment domain's backend duplication** (`lib/assessments/mutations.ts` vs. `lib/core/assessments.ts`) — tracked separately in the Canonical Domain Registry as `TARGET (Phase A)`; this ADR only ensures both are honestly and separately reachable from the Workspace.
- **No Attendance Paper/Hybrid/Digital implementation** — Sprint PRP-1 names the gap (Attendance is digital-only today); *building* the paper/hybrid rungs is separately gated future work.
- **No move of `core-office`/`core-team`/`core-admissions`** out from under `/teacher/*` — Section 7 names this as a future, separately-approved School Office ADR, not executed here.
- **No fix to the `notification_log` read-back gap, the Settings/Setup duplicate-form gap, the dead `core-readiness` redirect, the orphaned `prerequisite-readiness`/`teaching-patterns` routes, or the Record-of-Work cron's lib-placement violation** — all named in Sprint PRP-1's summary as future, separately-gated small fixes.

Every item above is a **future integration or fix**, not a rejected concept — naming them here prevents them from being silently assumed solved by this ADR.

---

## Section 4 — Workspace Model

The Teacher Workspace is not a stored entity — it is a **composition layer** over existing canonical domains, expressed entirely as navigation structure and page composition. No new table is introduced.

| Section | Composed From (unchanged canonical domains) | Nav Status Today |
|---|---|---|
| **My Day** | `lib/attentionFeed/*` (Attention Feed, Today's Mission, Continue Working) | Exists, correct — the reference pattern |
| **My Classes** | Classes hub (`app/teacher/classes`) | Exists, correct |
| **Teaching** | SOW → Lesson Plans → Record of Work, presented as one guided sequence instead of three peers | Exists as 3 disconnected peer items — regroup, don't rebuild |
| **Attendance** | `lib/core/attendance.ts` | Exists, correct — most mature domain audited |
| **Assessment** | Marks entry (per class, legacy path) + lock/publish (`/teacher/core-term`, canonical path), presented as one section with two honestly-labeled steps | No unifying nav entry today — add one |
| **Reports** | Split: *Parent Communication / Clinic Reports* (AI path) vs. *Official Report Cards / End of Term* (canonical path) | Currently one ambiguous "Reports" item colliding with a separate "End of Term" item — relabel both |
| **Insights** | `/teacher/insights`, Monday Panel (promoted out of the per-class page), Career Intelligence | No nav entry today for Insights; Monday Panel and Career Intelligence are buried — add entries, presentation only |
| **Teaching Tools** | Documents, Assignments, Kiswahili Insha, AI Slides, Booklets | Exist, correct — demote to secondary grouping so they don't compete with the 7 primary sections |
| **Settings** | `/teacher/settings`, unified with Setup's form fields | Exists — fix duplicate-form issue as a small follow-up, not blocking this ADR |

**Explicitly excluded from the Workspace's identity** (Section 3): Academic Clinic (a parent/student self-service surface, not a teacher tool, despite adjacency), Academy (a separate teacher-upskilling product, kept linked but not embedded), `core-office`/`core-team`/`core-admissions` (School Office console, wrongly nested under `/teacher` today, out of this ADR's scope to relocate).

---

## Section 5 — Ownership Model

No new ownership concept is introduced. The Teacher Workspace does not own data; it arranges reads and links to domains that already have owners per the Canonical Domain Registry:

- **Attendance** data ownership: unchanged, per ADR-0003/0004.
- **Assessment/Report Card** data ownership: unchanged, per the Canonical Domain Registry's existing (if not-yet-fully-consolidated) entries.
- **Intelligence** (Adaptive Learning, Compass, Career Intelligence) computation ownership: unchanged — the Workspace only changes where and how prominently a teacher sees the *output*, never what is computed or from what inputs (Educational Constitution's explainability/evidence-first articles are unaffected).
- **Navigation/shell ownership**: `app/teacher/layout.tsx` + a to-be-formalized shared nav-taxonomy component, replacing the current split between `TeacherSidebar`'s and `TeacherBottomNav`'s independently-maintained item lists.

---

## Section 6 — Intelligence Presentation Model

Per Sprint PRP-1 Phase 4: Adaptive Learning, Learning Compass, and the Intelligence Engine are constitutional and always active — this ADR does not gate, delay, or simplify their computation for any school.

What varies by school readiness tier (paper-first / hybrid / highly digital) is **presentation confidence and prominence only**:

- Paper-first: intelligence surfaces show an explicit "as of [last entry date]" freshness signal and surface fewer, higher-confidence items — never a rebranding of the same computation as something less rigorous, only an honest freshness disclosure driven by how recently Evidence was actually entered.
- Hybrid: today's Attention Feed behavior, unchanged.
- Highly digital: currently-orphaned surfaces (Insights, Monday Panel, Career Intelligence) become eligible to surface proactively on My Day itself, not just behind a dedicated nav item, since underlying data is fresher.

This tiering is a **read-side heuristic on data recency**, not a new computed field, and does not require any change to `lib/adaptiveLearning`, `lib/projection`, `lib/career`, or `lib/compass`.

---

## Section 7 — Security Model

No new security primitive. Every Workspace section links to a route that already enforces its own authorization exactly as today (`requireSchoolMembership`, class-teacher checks, admin-tier gates). The Workspace's only security-relevant decision is navigational: `core-office`/`core-team`/`core-admissions` remain gated by `ADMIN_TIER_ROLES` exactly as today and are not exposed to non-admin teachers by this ADR — this ADR does not change who can reach them, only clarifies (in documentation, not code) that they are conceptually a different product surface.

---

## Section 8 — Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Rebuild the navigation shell from scratch** (new layout, new nav component, discard `TeacherSidebar`/`TeacherBottomNav`) | Sprint PRP-1's audit found the existing shell (`app/teacher/layout.tsx`) is already correctly wired to every `/teacher/*` route, auth-gated, and free of duplication. The problems found are taxonomy and labeling problems, not shell-architecture problems — replacing working infrastructure to fix a labeling issue would violate the Ten Engineering Rules' "never duplicate what already works" and introduce unnecessary migration risk. |
| **Merge "Reports" and "End of Term" into one nav item now** | Rejected per Sprint PRP-1 Phase 3/9: they are genuinely two different artifacts on two different canonical paths (Registry status `TARGET (Phase A)`, unresolved). Merging them into one link would misrepresent a real architectural duplication as already-solved, which is worse than two honestly-separate, clearly-labeled items. |
| **Fix the Assessment/Report-Card backend duplication as part of this ADR** | Explicitly out of scope (Section 3) — that consolidation is tracked in Phase A's own execution plan and is a backend/data-layer decision, not a navigation decision. Conflating the two would violate Guardian Mode's "don't redesign the system in normal implementation" rule. |
| **Move `core-office`/`core-team`/`core-admissions` out from under `/teacher` immediately** | A real fix, but a routing/URL-structure change with its own migration and bookmark-compatibility considerations, deserving its own scoped ADR (a "School Office" ADR) rather than being folded into a Teacher Workspace decision — keeps this ADR's blast radius to navigation/labeling only, per the mission's "stop after architecture, no implementation" instruction. |
| **Build the Attendance/Assessment Paper→Hybrid→Digital ladders now** | Rejected — these are genuine, separately-scoped feature builds (new fallback workflows, possibly new schema for deferred/batch entry), not navigation changes. Sprint PRP-1 names them as gaps; building them belongs to a future, separately-approved sprint, consistent with "start simple, grow later." |

---

## Section 9 — Constitution Review

| Area | Assessment |
|---|---|
| **Canonical domains** | No new canonical domain is introduced. The Teacher Workspace is a composition/navigation layer over existing domains (Section 4) — it does not become a new entry in the Canonical Domain Registry as a data owner, though a documentation-only row describing it as the teacher-facing composition layer should be added at implementation time. |
| **Repository ownership** | Unaffected — no new repository. |
| **RAS** | Consistent with the Reference Architecture Specification's existing separation of presentation from domain services; this ADR does not amend the RAS document itself. |
| **ADR interactions** | Does not conflict with ADR-0003/0004 (Attendance) — the Paper/Hybrid/Digital gap they left unscoped is named here, not resolved. Does not conflict with the Canonical Domain Registry's Assessment/Report-Card `TARGET (Phase A)` entries — this ADR presents both paths honestly rather than resolving the duplication. |
| **Identity** | No new identity concept. |
| **Security** | No new authorization primitive (Section 7). |
| **Migration impact** | None at the data layer. Navigation/labeling changes are UI-only; any implementation sprint executing this ADR should still follow small, single-responsibility commits per Phase B engineering mode. |
| **Backward compatibility** | Fully preserved — every existing route keeps working; this ADR only reorganizes how they are reached and labeled. |

---

## Section 10 — Implementation Roadmap (Not Authorized by This ADR Alone)

Each item below requires its own implementation-sprint approval, per Phase B mode — this ADR authorizes the *design*, not a blanket green light:

| Sprint (proposed, unscheduled) | Scope |
|---|---|
| **PRP-2** | Nav taxonomy unification — one shared section list consumed by both `TeacherSidebar` and `TeacherBottomNav`, replacing their independently-maintained item arrays. No new routes. |
| **PRP-3** | Relabel "Reports" → "Parent Communication / Clinic Reports" and "End of Term" → "Official Report Cards"; move KNEC export and SOW-generator links out of the Reports tab into Teaching Tools. |
| **PRP-4** | Add real nav entries for "Assessment" (linking marks-entry and end-of-term as one section) and "Insights" (surfacing `/teacher/insights`, Monday Panel, Career Intelligence). |
| **PRP-5** | Regroup Scheme of Work / Lesson Plans / Record of Work into one guided "Teaching" flow with forward/back navigation reflecting the real `sow_id` dependency chain. |
| **PRP-6** (separately scoped) | Attendance Paper/Hybrid/Digital ladder — a genuine feature build, not a navigation change; requires its own design review given the offline-data-entry implications. |
| **PRP-7** (separately scoped) | `notification_log` read-back UI, closing the "was the parent told" gap. |
| **School Office ADR** (separately scoped) | Formal relocation of `core-office`/`core-team`/`core-admissions` out from under `/teacher/*`. |

---

## Section 11 — Decision

**The Teacher Workspace becomes the formalized identity of the existing `app/teacher/layout.tsx` shell** — nine permanent sections (My Day, My Classes, Teaching, Attendance, Assessment, Reports, Insights, Teaching Tools, Settings), each composed from already-canonical domains, with no new data ownership, no new identity, and no change to what any domain computes.

- **Navigation is corrected, not rebuilt.** The existing sidebar/bottom-nav shell is retained and unified; ambiguous or missing nav entries are fixed (Section 4).
- **Intelligence stays constitutional; only presentation adapts** to school readiness tier (Section 6).
- **School-Office/admin tooling is identified as out of scope** for the Teacher Workspace's identity, deferred to a future, separately-approved ADR (Section 10).
- **No implementation begins under this ADR alone.** Each roadmap item (Section 10) requires its own Phase B-format implementation approval.

This directionality — composition layer over canonical domains, never a new domain itself — is the decision this ADR fixes. Any future proposal to give the Teacher Workspace its own data ownership, write path, or computed state requires a new ADR, not an extension of this one.

**Approval status: DRAFT.** No implementation sprint (PRP-2 onward) begins until this ADR is explicitly approved.
