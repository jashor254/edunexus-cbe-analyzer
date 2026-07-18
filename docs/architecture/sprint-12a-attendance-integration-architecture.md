# Sprint 12A — Attendance Integration Architecture (Audit + ADR)

**Status: Complete — architecture and documentation only.** No production code, migration, repository, service, API, or UI was written or modified. **Awaiting explicit approval before Sprint 12B.**

**Produces**: ADR-0004 (`docs/architecture/adr-0004-attendance-integration-principles.md`) and this document.

**Method**: every classification below is grounded in the actual current codebase, re-read this sprint (not assumed from prior sprints' summaries) — in particular the Reference Architecture Specification's already-ratified Intelligence Standards (§9) and its existing, reserved Attendance row (§3, line 69), both of which anticipated most of this ADR's conclusions before Attendance was even built.

---

## Phase 1 — Dependency Audit

| Subsystem | Current relationship | Existing coupling | Required future coupling | Direction |
|---|---|---|---|---|
| **Report Cards** | None — `school_report_cards.days_present`/`days_absent` are unpopulated placeholder columns (confirmed Sprint 11A). | Zero code coupling; only a coincidental column-name relationship. | Report Cards reads Attendance at generation time to compute its own `days_present`/`days_absent`. | Attendance → Report Cards (read-only). |
| **Evidence** | None — the reserved `EvidencePayload` union variant `{kind:'attendance'}` (`learner-record-layer-decisions.md` §32-39) has never been constructed. | Zero. | Attendance may, in a future sprint, call Evidence's own existing write functions to produce evidence rows. | Attendance → Evidence (one-way write, via Evidence's own API — Evidence still owns Evidence). |
| **Intelligence** (Projection/`learner_projections`) | None, and per RAS §9 must remain none *directly*. | Zero — RAS already forbids any Intelligence module reading an Operating-Layer table directly. | Consumes Attendance exclusively via Evidence, never `attendance_sessions`/`attendance_records` directly. | Attendance → Evidence → Intelligence (never direct). |
| **Compass** | None. | Zero — Compass is itself an Intelligence module under the same RAS §9 rule. | Same as Intelligence — via Evidence only, if ever. | Attendance → Evidence → Compass (never direct). |
| **Parent Portal** | Indirect, non-functional — `app/(parent)/report-card/page.tsx` already displays `days_present`/`days_absent`, always empty since nothing populates the underlying columns yet. | Via Report Cards' existing (unpopulated) fields only; never directly with Attendance. | A dedicated, read-only, own-learner-only attendance view. | Attendance → Parent Portal (read-only, scoped). |
| **Teacher Dashboard** | None — no attendance widget exists there today. | Zero. | Possibly a "take today's attendance" shortcut/reminder — read-only. | Attendance → Teacher Dashboard (read-only, if ever built). |
| **School Office** | **Real, already built** — the Attendance Administration workspace (Sprints 11G–11I) reads Attendance live through the canonical service functions. | Direct, read-only, via `listAttendanceSessionsForSchool`/`getSessionCompletionState` — the intended read surface, not a shortcut. | None beyond what exists — this relationship is already complete per Sprint 11I's production-readiness verdict. | Attendance → School Office (read-only, complete). |
| **Academic Office** | Real — hosts the navigation entry point into Attendance Administration (Sprint 11G). | Navigation-level only; Academic Office itself reads no attendance data. | None. | N/A (navigation, not a data dependency). |
| **Analytics** | None. | Zero — the existing `AnalyticsRepository` serves other domains (e.g. assessment cohort analytics), never Attendance. | Explicitly not designed by this ADR; every Attendance sprint to date has repeatedly forbidden percentages/trends. | Undefined/deferred — requires its own future ADR if ever pursued. |
| **Notifications** | None. | Zero — `NotificationRepository`/`lib/events` exist and are used by other domains (e.g. `organization.member.invited`), never Attendance. | A future absence-alert could publish through the existing event bus. | Attendance → Events → Notifications (deferred, one-way). |
| **Learner Timeline** (`getLearnerTimeline`) | None — attendance is not merged into the canonical timeline today (it currently merges Evidence + promotions only). | Zero. | **Automatic, for free**, once Attendance produces Evidence rows — the Timeline's own established contract is "extend by feeding Evidence, never reimplement the merge." No new Timeline code would be needed. | Attendance → Evidence → Learner Timeline (indirect, automatic once Evidence integration lands). |
| **Career Intelligence** | None. | Zero — consumes capability/evidence data, not attendance. | Not currently planned; a soft consistency signal is conceivable but not designed here. | Undefined/deferred. |
| **Behaviour** | Does not exist as a domain (confirmed Sprints 11A and 11I). | N/A. | N/A until a Behaviour domain is ever built, and its own relationship to Attendance separately decided. | N/A. |
| **Promotion** | None — `runAnnualPromotion` has no attendance input today (confirmed Sprint 10H). | Zero. | A real school-policy question (attendance-threshold-gated promotion) — a product decision, not an architecture question this ADR resolves. | Undefined/deferred. |
| **Risk Detection** (Projection `RiskValue`) | None direct. | Zero direct; indirectly, once Attendance feeds Evidence, Projection's existing risk computation would automatically gain an attendance-informed signal — again, no new Risk-Detection code needed. | Same automatic-once-Evidence-lands pattern as Learner Timeline. | Attendance → Evidence → Projection risk (indirect, automatic, deferred until Evidence integration). |
| **Academic Readiness** (`getSchoolAcademicReadiness`) | None — the six existing readiness dimensions (year/term/subjects/classes/teachers/learners) do not include attendance. Sprint 11G/11H's Operational Checklist deliberately added "attendance sessions created today" as a **separate, inline boolean**, not a modification to `getSchoolAcademicReadiness` itself (re-confirmed by re-reading Sprint 11G's own documentation this sprint). | None beyond the above. | Not currently planned; a 7th readiness dimension is conceivable but not designed here. | Undefined/deferred. |

---

## Phase 2 — Boundary Audit

**General rule, applying to every subsystem above** (the specific answers ADR-0004 codifies):

| Question | Answer |
|---|---|
| **Who owns the truth?** | Attendance alone, permanently — `attendance_sessions`/`attendance_records`, written only by `lib/core/attendance.ts`. |
| **Who reads?** | Any authorized consumer, always through `lib/core/attendance.ts`'s exported functions — never `AttendanceRepository` directly, never a raw query. |
| **Who writes?** | Only Attendance's own service functions. The one exception: Attendance itself may call Evidence's own existing write functions to produce evidence — Evidence still owns Evidence; this is not a second write path into Attendance. |
| **Who computes?** | The consumer, at read time, from Attendance's raw data — e.g. Report Cards computes its own `days_present` definition; Attendance never computes another domain's derived value. |
| **Who summarizes?** | Nobody, ever, as a stored artifact — every consumer computes fresh on read, mirroring ADR-0003 §4's rule inside Attendance, now generalized to every downstream domain. |
| **Who caches?** | Nobody, by default — a genuine future performance need requires its own ADR amendment before any caching is introduced, never a silent default. |
| **Who never touches Attendance?** | Every Intelligence-layer module (`lib/projection/`, `lib/career/`, `lib/compass/`, `lib/academicClinic/`, `lib/adaptiveLearning/`) — never directly, per the RAS's already-ratified §9, which already named Attendance's Evidence-only relationship before Attendance was built. |

---

## Phase 3 — Integration Matrix

| Subsystem | Consumes Attendance? | Writes Attendance? | Reads Live? | Uses Summary? | Future Sprint |
|---|---|---|---|---|---|
| Report Cards | Yes (future) | No | Yes | No — computes own `days_present` | 12B |
| Evidence | Produces from (future) | No (Attendance writes *to* Evidence, via Evidence's own functions) | Yes | No | 12D (as the first deliverable of that sprint) |
| Intelligence / Projection | Yes (future, indirect) | No | No — reads Evidence, never Attendance directly | No | 12D (downstream, automatic) |
| Compass | Yes (future, indirect, if ever) | No | No — via Evidence only | No | Not scheduled |
| Parent Portal | Yes (future) | No | Yes, scoped to own learner | No | 12C |
| Teacher Dashboard | Not planned | No | — | — | Not scheduled |
| School Office | **Yes (built)** | No | **Yes** | No | Complete (Sprint 11G–11I) |
| Academic Office | Navigation only | No | No | No | Complete (Sprint 11G) |
| Analytics | Not designed | No | — | — | 12E (deferred) |
| Notifications | Not designed | No | — | — | 12F (deferred) |
| Learner Timeline | Yes (future, indirect, automatic) | No | No — via Evidence only | No | 12D (downstream, automatic) |
| Career Intelligence | Not planned | No | — | — | Not scheduled |
| Behaviour | N/A (domain doesn't exist) | No | — | — | Not scheduled |
| Promotion | Not planned (product decision pending) | No | — | — | Not scheduled |
| Risk Detection | Yes (future, indirect, automatic) | No | No — via Evidence → Projection | No | 12D (downstream, automatic) |
| Academic Readiness | Not planned | No | — | — | Not scheduled |

Example read from the matrix, matching the mission's own worked example: **Attendance → Report Cards** — Attendance owns; Report Cards consumes; read only; Sprint 12B.

---

## Phase 4 — Architecture Risks

| Risk | Description | Mitigation (codified in ADR-0004) |
|---|---|---|
| **Circular dependencies** | A consumer (e.g. Report Cards) tries to "correct" attendance data by writing back to Attendance directly, or Attendance's service starts importing from a consumer domain to resolve some edge case. | §1/§2 — no domain may write Attendance except Attendance; Attendance's own service imports nothing from any consumer, confirmed true today and made a permanent constraint. |
| **Duplicate ownership** | Two domains each believing they own "days present" — Attendance's raw records vs. a Report-Card-cached figure that silently becomes the de facto source of truth once enough code depends on it. | §4 — derived values belong entirely to the consumer that computes them; Attendance's raw data is always the one truth underneath. |
| **Duplicate summaries** | A future Analytics or Notifications sprint stores its own "attendance rate" table, then Report Cards stores a different one for its own purposes, and the two drift. | §5 — no summary is ever stored, by anyone, without a separate ADR amendment to this one first. |
| **Caching risks** | A consumer caches a computed value across requests for performance, and a later edit to the underlying attendance record doesn't invalidate it — silently stale data presented as current. | §5/§6 — no caching across requests without a dedicated ADR amendment; request-scoped memoization inside a single computation is fine, a stored/cross-request cache is not. |
| **Identity risks** | A consumer resolves "is this the right teacher/school/learner" via a legacy identity bridge (`teachers`/`teacher_classes`) instead of Attendance's own Core-identity functions, reintroducing exactly the dual-identity confusion ADR-0002 exists to prevent. | §6 rule 5 — every consumer reuses the same canonical Core identity functions Attendance itself uses. |
| **Security risks** | A consumer queries `attendance_sessions`/`attendance_records` directly "just for one read," bypassing the ownership-chain check `lib/core/attendance.ts` enforces. | §2/§6 rule 4 — every read goes through Attendance's exported functions; RLS remains a backstop, never the sole gate. |
| **Performance risks** | A batch operation (e.g. generating 40 report cards) calls a single-item Attendance read function 40 times, each doing multiple internal reads (as `getSessionCompletionState` already does — 3 reads per call). | §6 rule 6 — a genuine batch need is solved by a new, purpose-built Attendance-owned bulk read function, added by that integration sprint to `lib/core/attendance.ts`, never by the consumer looping or caching around the existing single-item function. |
| **Repository violations** | A consumer imports `AttendanceRepository` directly for convenience, bypassing the service layer's ownership/validation logic entirely. | §2, and the Repository Architecture Standard generally — explicitly named as the single most likely violation a future integration sprint could introduce "for simplicity." |
| **Service-layer violations** | A consumer re-implements status validation or the ownership chain instead of calling Attendance's own functions, drifting out of sync when Attendance's rules evolve. | §6 rule 3 — no duplicated ownership-chain or status-validation logic anywhere outside `lib/core/attendance.ts`. |

No risk above requires a schema change, a new table, or a new architectural layer to mitigate — every mitigation is a rule for how future sprints call the *existing* Attendance service, which is exactly why this can be settled now, before any integration code exists.

---

## Phase 5 — ADR-0004

See `docs/architecture/adr-0004-attendance-integration-principles.md` for the full text: ownership, read/write direction, derived-data policy, summary policy, six integration rules, future extension rules, explicit non-goals, five rejected alternatives, and six success criteria. Status: **DRAFT**, pending this sprint's approval.

---

## Phase 6 — Roadmap

| Sprint | Integration | Direction | Rationale for sequencing |
|---|---|---|---|
| **12B** | Attendance → Report Cards | Read-only; Report Cards computes `days_present`/`days_absent` itself. | Lowest-friction integration — the two columns already exist and are already wired for write via `updateReportCard()` (Sprint 11A's own finding); this is a "populate an existing seam," not new surface area. |
| **12C** | Attendance → Parent Portal | Read-only, scoped to the parent's own learner. | The Parent Portal's report-card page already renders (empty) `days_present`/`days_absent` — 12B makes that display accurate; 12C is where a dedicated attendance view, if wanted, would be designed on its own terms. |
| **12D** | Attendance → Intelligence | Via Evidence only (ADR-0004 §2's mandatory exception). | This sprint's real first deliverable is Attendance producing evidence rows through Evidence's existing write functions — Intelligence (Projection, Learner Timeline, Risk Detection, Career Intelligence) then consumes them automatically through the pipeline that already exists, unmodified. Framed as "Intelligence" in the mission's own roadmap example, but architecturally this is an Evidence-production sprint whose consumers happen to be Intelligence-layer. |
| **12E** | Attendance → Analytics | Not yet designed. | Deferred pending a real, demonstrated school need — consistent with this platform's own "prove it with real data before generalizing" practice, and with every prior Attendance sprint's repeated refusal to build percentages/trends speculatively. |
| **12F** | Attendance → Notifications | Not yet designed. | Deferred pending explicit product/policy decisions (alert frequency, opt-in, channel) that are not architecture questions this ADR — or any architecture sprint — can resolve on its own. |

Roadmap only — no implementation begins until each sprint is separately approved, per ADR-0004 §7's "this ADR is a gate, not a one-time checklist."

---

## Dependency Graph

```
attendance_sessions / attendance_records   (owned exclusively by lib/core/attendance.ts)
        │
        │  read-only, via lib/core/attendance.ts's exported functions only
        ▼
   ┌────────────┬─────────────┬───────────────┬───────────────┐
   │            │             │                               │
Report Cards  Parent Portal  School Office            Evidence (future write,
(12B)         (12C)          (built, Sprint 11G-11I)   via Evidence's own functions)
                                                                │
                                                                │ existing, unmodified pipeline
                                                                ▼
                                                   Projection / Learner Timeline /
                                                   Risk Detection / Career Intelligence
                                                   (12D, automatic once Evidence lands)

Analytics (12E) and Notifications (12F): not yet designed, deferred.
Teacher Dashboard, Compass, Behaviour, Promotion, Academic Readiness: not scheduled.
```

## Ownership Graph

```
Attendance domain
  owns: attendance_sessions, attendance_records
  writes to: itself only, plus (future) Evidence via Evidence's own API
  never writes: Report Cards, Parent Portal, Analytics, Notifications, Intelligence, Promotion, Behaviour
  never reads from: any consumer domain (no reverse dependency)

Every consumer domain
  owns: its own derived computation over Attendance's raw data
  never owns: an attendance fact itself
  never writes: attendance_sessions, attendance_records
```

---

## ADR References

- **ADR-0002** (`docs/architecture/adr/0002-canonical-teacher-identity.md`) — identity resolution every future integration must reuse, never bridge through legacy identity.
- **ADR-0003** (`docs/architecture/adr-0003-attendance-domain.md`) — the canonical domain this ADR's integration rules protect; §4 (computed-on-read Summary) and §13 (Attendance consumes nothing) are the two sections ADR-0004 most directly generalizes outward.
- **ADR-0004** (this sprint's own output) — the constitutional gate for every integration sprint from 12B onward.
- **Reference Architecture Specification** §3 (Attendance's reserved row, already anticipating "Evidence, one-way, when built") and §9 (Intelligence Standards, already forbidding direct Operating-Layer reads by any Intelligence module) — both pre-existing, ratified documents this sprint discovered already answer much of what it was asked to design, rather than needing to invent it fresh.

---

## Constitution Compliance

- **No domain may write Attendance except Attendance itself** (the mission's own stated constraint) — codified as ADR-0004 §1, with the one narrow, already-precedented exception (Attendance producing Evidence through Evidence's own functions) explicitly justified, not silently smuggled in.
- **Repository Architecture Standard** — every integration rule in ADR-0004 §6 exists specifically to prevent a future sprint from bypassing the service layer "for convenience," which Sprint 11I's audit found zero evidence of happening so far, and which this ADR exists to keep true going forward.
- **No new canonical domain, identity, or architectural layer was introduced** — this sprint is pure documentation of rules governing existing domains' future relationships, satisfying its own "no architectural redesign" constraint.
- **No code, migration, repository, service, API, or UI was touched** — confirmed: the only files this sprint produced are ADR-0004, this document, and the implementation log entry.
