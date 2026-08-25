# Parent Portal Super Audit — Phase P0

**Scope lock:** branch `main`, HEAD `8a0ca5d` (`fix: align assignment read surfaces with canonical eligibility`), pre-existing dirty working tree left untouched (unrelated in-progress work across career/blueprint/clinic modules — not part of this audit). Audit-only: no product code, migrations, or permissions were changed. Method: static code inspection via four parallel research passes, all findings cited `file:line`.

---

## 1. Verdict

**PARENT EXPERIENCE FUNCTIONAL BUT FRAGMENTED.**

The security/access-control layer is genuinely solid — no confirmed IDOR, correct read/write separation, deliberate evidence-tier design. But the *product* is an accretion of independently-built surfaces: two parallel parent home systems (only one of which is actually reachable), four disagreeing "how is my child doing academically" surfaces, three overlapping career-report pages, and three independent risk-language vocabularies. It is not "coherent" and it is not "critical access/identity gaps" — it is safe but incoherent, plus one real institutional-guardian data gap and one bounded impersonation surface.

---

## 2. Parent Route Map

### Core/institutional parent surfaces — `app/(parent)/**`

| Route | Purpose | Guard | Child context | Inbound links | Live? |
|---|---|---|---|---|---|
| `/child` | Entry: resolves guardian→learner(s), redirects/lists | `resolveParent()` | none (session lookup) | `/dashboard` "My Assignments" tile; nav "Assignments" override | Live, but the **only** entry point to this whole flow |
| `/child/[learnerId]` | Parent Home (Blueprint teaser cards) | `requireParent(supabase, learnerId)`, 404 on mismatch | URL param, re-verified every request | `/child` list | Live |
| `/child/[learnerId]/full` | Full Blueprint | `requireParent` | URL param | Home teaser cards | Live |
| `/child/[learnerId]/assignments`, `/gradebook`, `/progress`, `/holiday`, `/journey`, `/history[/snapshotId]` | Per-domain child views | `requireParent` per page | URL param | Home cards | Live (assignments/gradebook institutional-guardian coverage unverified) |
| `/resources` | Family-wide class resources | `requireAuthentication` in the API routes it calls | none — family-wide | nav (parent-only), dashboard tile | Live, **partially broken for institutional-only guardians** |
| `/calendar` | Family-wide calendar+announcements | same | none | nav (parent-only), dashboard tile | Live, **broken for institutional-only guardians** |
| `/report-card` | Published report card per child | `/api/reports/report-card/mine` (Core-aware) | in-page selector, `learner_id`+`school_id` per row | dashboard tile | Live, correctly multi-school-aware |
| `/career-intelligence` | Parent career view | route-level owner/parent check | via student selector | dashboard "Career Explorer" tile | Live |
| `/career-intelligence-report` | "Full" AI-narrative career report | — | — | linked from `/career-intelligence` | Live |
| `/career-report` | Alternate "full" career report (408 lines) | — | — | **no inbound link found anywhere** | **Orphaned** |

### Legacy "Solo" parent surface

| Route | Purpose | Guard | Child context | Inbound | Status |
|---|---|---|---|---|---|
| `/dashboard` | Legacy parent home: My Students, Compass activity, Quick Actions, Recent Assessments | layout-level auth | none — family-wide aggregation | **every parent lands here first** (see §3) | Live — the real entry point |
| `/dashboard/clinic` → `/dashboard/clinic/reports/[studentId]` | Academic Clinic | legacy `students.user_id` ownership | selector | dashboard tile | Live |
| `/dashboard/assignments` | Old assignments view | — | never resolves to a specific child | rewritten to `/child` at render time via `applyOverrides()` | Dead-by-design / superseded string, never actually rendered |

### Orphaned duplicate

`app/academic-clinic/page.tsx` — a second, fully client-side Academic Clinic implementation with **zero inbound navigation anywhere**, reachable only by typing the URL; it duplicates `/dashboard/clinic/reports/[studentId]` on a different (legacy, unaugmented) code path.

---

## 3. Entry / Login Flow

```
auth/callback → resolveRoleDestination() → getUserRoles() → getRoleRedirect(primary)
  teacher → /teacher/dashboard
  student → /student
  parent (and any unrecognized/error role, which silently defaults to 'parent') → /dashboard
```

**Every parent, regardless of whether their child is a legacy `students` row or a Core `learners` row, lands on `/dashboard` — the legacy Solo home.** The IDOR-safe, multi-school-aware, architecturally-correct Core flow (`/child`) is reachable only through one Quick Actions tile mislabeled "My Assignments," or the nav's "Assignments" link (which is silently rewritten from `/dashboard/assignments` to `/child` at render time). There is no nav item literally labeled "Home" or "My Child" pointing at `/child`.

- **One child:** `/dashboard` shows one card; `/child` explicitly redirects straight to `/child/{id}`.
- **Multiple children:** `/dashboard` lists all in one grid; `/child` lists cards to pick from — a genuinely well-designed affordance, but nothing on `/dashboard` signals "you have 2 children" before the parent finds `/child`.
- **No linked children:** `/child` shows static "No linked children yet" text with **no CTA** (no "contact your school," no invite flow) — a dead end.
- **Institutional child:** only reachable via `/child`, invisible from `/dashboard`'s own student grid (which queries the legacy table only).
- **Legacy child:** visible on `/dashboard` immediately; also reachable via `/child` if a corresponding Core row exists.

A parent with one legacy child and one institutional child sees them on two entirely separate, non-cross-linked pages, with nothing indicating "you also have a child at a school portal."

---

## 4. Navigation Map

Single shared component (`DashboardNavbar`) renders across both `/dashboard` and `app/(parent)/**`.

| Destination | Label shown | Class |
|---|---|---|
| `/learn` | "Compass" | PRIMARY |
| `/career-intelligence` (override) | "Careers" | PRIMARY |
| `/dashboard/clinic` | "Clinic" | PRIMARY |
| `/child` (override of `/dashboard/assignments`) | **"Assignments"** | PRIMARY, **role-confused label** — actually the child's whole Home/picker |
| `/resources`, `/calendar` (parent-only, top nav only) | "Resources", "Calendar" | PRIMARY but **absent from the mobile bottom tab bar** |
| `/pricing` | "Upgrade" | SECONDARY |
| Bottom nav duplicates: Home/Compass/Clinic/Assignments/Careers | — | DUPLICATE of top nav |

Labels are otherwise parent-friendly and non-technical (no leaked "Blueprint"/"Core learner" jargon into this shared nav, unlike the student nav). The one real UX defect: **"Assignments" is the only path to the parent's actual Home page**, and Resources/Calendar are unreachable from mobile's bottom tab bar.

---

## 5. Multi-Child Model

- **Selection:** only on `/child` (list of cards). No switcher exists on any subpage — a parent inside `/child/{A}/gradebook` must edit the URL bar to reach child B; nothing links back to `/child` or `/dashboard` from any `/child/[learnerId]/*` subpage.
- **Persistence:** pure URL param, not cookie/session/global state. Every Core page re-derives `schoolId` and re-runs `requireParent()` fresh per request — **no risk found of Child A's data rendering under Child B's context.**
- **Family-wide pages are the actual risk surface:** `/resources` and `/calendar` deliberately aggregate across every linked child with **no per-child label** on any resource/event card — a two-child parent can't tell which child an item belongs to (UX gap, not a security bug — the data legitimately belongs to that parent).
- **Legacy `/dashboard`:** no explicit switcher either; implicit via per-card `?student=` query params, also URL-driven, no stale-context risk found.

---

## 6. Identity Model

```
auth user (Supabase auth.users.id)
   ├─ legacy: students.parent_user_id = userId ──► students.id   (Solo flow)
   └─ Core:   learner_guardians.user_id = userId ──► learners.id  (institutional flow)

resolveParent(userId) unions both → { studentIds, coreLearnerIds }
requireParent(client, anyLearnerId) checks both spaces, re-verified on EVERY request → 404 if neither matches
```

This is the canonical, IDOR-safe resolver and it is used correctly everywhere in the Core flow. **A third, undocumented guardian-link mechanism exists**: `class_students.parent_id`, used directly by `/api/parent/alerts` and the Clinic signed-URL route, but **not modeled by `resolveParent`/`requireParent`**. Not a current vulnerability — but a future migration of either route onto the canonical function without folding this in would *silently narrow* (break, not leak) guardian access.

---

## 7. Home Audit

Canonical parent Home: `/child/[learnerId]` — fed by exactly **one** `composeBlueprint()` call, no duplicate computation. ~9 independent teaser cards + one action block:

| Card | Actionable | Duplicate? |
|---|---|---|
| Today's Actions | Yes (priority-tagged) | No — this is the actionability layer |
| This Term / From the Teacher | No | Overlaps Today's Actions conceptually |
| Learning Time (attendance) | No | Same number shown twice when attendance is low (also in Today's Actions) |
| Learning Compass | No | Overlaps "Continue Holiday Learning" action |
| Career Exploration | No | Overlaps "Explore Career Journey" action |
| Assignments / Gradebook / Compass Progress / Holiday Plan | Link only | Compass Progress overlaps Learning Compass card |
| How Has My Child Grown? | Link only | No |

Coverage of the 7 candidate parent jobs: **"needs attention"** and **"what should I do"** are well covered (Today's Actions). **"Is my child okay"** requires reading 6+ cards to assemble a picture — no single status signal. **"What changed recently"** is weak on Home itself. **"What work is due"** has no due/overdue count at the top level. **"Where is my child improving/struggling"** lives in Career Intelligence/Academic Record, not surfaced here. **"Do I need to contact a teacher"** — not covered at all (no such capability exists, §17).

---

## 8. Parent Job Verdict

**COLLECTION OF FEATURES, leaning CHILD MONITOR, with a genuine but partial LEARNING SUPPORT TOOL layer.**

Evidence: Home is architecturally disciplined internally (single canonical data call) but is a flat menu of ~9 destinations spanning independently-evolved sub-apps — a feature-inventory pattern, not one synthesized parent job. Two whole report-generation systems exist for near-identical purposes (Academic Clinic vs. Blueprint vs. Report Card). The LEARNING SUPPORT layer is real and deliberate (`lib/parentExperience/actions.ts` is explicitly "what can the parent do next," Career Intelligence explicitly frames itself as "How to Support Them" / "Conversation Starters"). CHILD MONITOR dominates numerically — five of ~11 Home surfaces are pure observation with no attached action. Not REPORT VIEWER or NOTICEBOARD alone (those are one tab among many). Not ADMIN PORTAL (no billing/settings surfaced).

---

## 9. Permission Matrix

| Capability | Learner | Parent | Enforcement |
|---|---|---|---|
| View Blueprint | Yes | Yes | `requireParent` / `canViewLearnerRecord` |
| View assignments | Yes | Yes, read-only | `requireParent`; zero submit routes found |
| View grades/gradebook | Yes | Yes | `requireParent`, reuses teacher's `buildGradebook()` unmodified |
| View Career Intelligence | Yes | Yes | manual owner-or-parent check (not yet on canonical helper, tech debt) |
| View resources/calendar | Yes | Yes (partial, §29) | read-only |
| **Open Compass** | Yes | **Yes — same code path, no distinction** | `resolveCompassStudentAccess` grants parent and learner equal standing — **see §10, genuine impersonation surface** |
| Submit assignment / answer quiz | Yes | **No** | keyed to enrolled-student identity only |
| **Create learner Evidence** | Yes | **Yes — deliberately, tier-1 capped** | `/api/parent/assessments/process` (correct, capped design); Compass session-end (bounded impersonation, §10) |
| Save/alter career interest | Yes | **No** | `/api/career/interest` denies parents entirely (no `includeParent` flag) |
| Trigger adaptive action | **No** | **No** | staff-only `canManageLearnerRecordCore`, no self/parent branch exists |

The two cells where a parent could act *as* the learner: Compass (real, bounded) and the parent-observation evidence pipeline (by design, correctly capped).

---

## 10. Parent → Evidence Boundary

| Path | Classification | Notes |
|---|---|---|
| `/api/parent/assessments/process` → `persistEvidenceBatch()` | **DELIBERATE PARENT EVIDENCE** | `evidence_source='parent_observation'`, trust tier 1, confidence capped at 60 (auto-confirm threshold is 85), always `pending_review`. Correctly implemented per the Evidence Domain's own rules. |
| Compass session (parent-driven) → `/api/learn/end` → `recordCompassSessionEvidence` | **IMPERSONATION RISK** | `resolveCompassStudentAccess` treats parent and learner as equally privileged on one Compass session — a parent can drive a full tutoring session and the resulting `learner_evidence` is attributed to the child. `initiatedBy` (parent's real id) is recorded only on the `ingestion_run`, never as a discriminating `evidence_source` — a teacher reviewing pending evidence cannot tell a parent-run session from the child's own. Bounded by the tier-1/pending_review ceiling (cannot auto-confirm), but XP/level/session-count state IS applied unconditionally and shown to the learner as their own progress. |
| `/api/career/capability` → recompute-and-save capability snapshot | **INDIRECT EFFECT** | Writes only a derived, re-derivable snapshot; creates no new evidence row. |
| `/api/career/match`, `/api/career/growth` | **NO EFFECT** | Read-only; both actually deny parents (missing `includeParent`). |
| `whatsapp-optin`, `link-student`, `link-guardian` | **NO EFFECT** | Contact-preference/linking rows only, no touch to evidence/projection/risk/tier. |

**Net:** exactly one designed, correctly-capped parent-evidence producer; one genuine but bounded impersonation gap (Compass) that the architecture already has the vocabulary to close (add an `evidence_source` discriminator, matching the existing `parent_observation` pattern) but hasn't yet.

---

## 11. Assignments

Parent view (`ParentAssignmentsClient.tsx`) hits the exact same `/api/student/assignments` route the learner's own device calls. Shows title/subject/due date/overdue/submission status/score/teacher feedback. **Confirmed zero write capability** — no submit modal, no file upload, no POST/PUT anywhere in the client; the file's own header comment states this is deliberate ("visibility, not administrative control"). Parent role is correctly OBSERVE-only.

---

## 12. Gradebook / Results

**Four independently-computed "how is this learner doing" surfaces, all parent-reachable, that disagree:**

1. **Gradebook** — raw numeric scores only, no CBC level, via `buildGradebook()`.
2. **Report Card** — marks *and* `cbc_level` from `term_subject_summaries`.
3. **Blueprint's Academic Record** — Projection-sourced (the canonical engine).
4. **Academic Clinic** — independently recomputes CBC levels **client-side** from a rolling 5-assessment window on the legacy `students`/`assessments` tables (`Math.max(1, Math.min(4, Math.round(score)))`), entirely bypassing Projection.

A parent can see four different numeric/level pictures of the same learner, computed by four different code paths, with no cross-reference between them. This is an independent CBC-threshold calculation in a parent-reachable surface (Academic Clinic) — flagged per the audit brief's own instruction, not re-litigated.

---

## 13. Blueprint

Canonical: `ParentBlueprintView` via `composeBlueprint()`, explicitly documented as "exactly the same Blueprint... no parent-specific Blueprint." Duplicate-in-substance: Academic Clinic (`/dashboard/clinic/reports/[studentId]`) independently reproduces strengths/action-plan/career-matches/holiday-plan on an entirely different data/permission model (legacy `students.user_id` ownership vs. Core `requireParent`).

Action safety is **genuinely enforced by code**, not just claimed: `RecommendedNextStepsSection` takes an explicit `viewer` prop and gates link destinations via `isActionDestinationValidForViewer()`; parent-facing components route through `lib/parentExperience/terminology.ts` rather than raw internal values. Reused learner components (`StudentProgress`, `StudentHolidayPlan`) correctly branch copy on a `theme` prop ("Your Progress" → "Child's Progress") — verified role-aware, not accidental reuse.

---

## 14. Risk / Needs-Attention Language

No raw `HIGH RISK`/`LOW CAPABILITY` strings found anywhere in parent surfaces. But **three independent vocabularies exist** for the same underlying signal:

1. `lib/parentExperience/terminology.ts` — the frozen Blueprint translation table ("Risk Flag" → "Needs Extra Support").
2. `lib/parentPulse/builder.ts` — a **separate** inline phrasing implementation for WhatsApp/Parent Pulse, computed from the same Projection risk field but with its own strings ("Needs attention: ${concern}").
3. `career-intelligence-report`'s own untranslated copy ("Subjects requiring intervention" — clinical wording, doesn't route through either translation table).

Source is confirmed canonical (Projection) for Blueprint and Parent Pulse both — **except** Academic Clinic, which computes its own "Needs Attention" badges from locally-derived subject levels, not Projection (§12).

---

## 15. Career Intelligence

`/api/parent/career-intelligence` is strictly read-only (confirmed by full file read — one `GET` handler, no mutation). The parent-facing page has **zero** `<input>`/`<textarea>`/`<select>` for interest data and zero interest-submission calls. `/career-report`'s one `POST /api/career/match` call only *recomputes matches from existing state* — it cannot alter learner-reported interests. **Verified: parents cannot answer interest-discovery questions or alter learner interests through any traced route.**

---

## 16. Career Signals

Reachable by parents via all three career pages; wording is genuinely audience-aware ("Understand your child's capability profile," "Conversation Starters," "Weekly Habits That Help") — not learner copy reused. No new signal design proposed, per scope.

---

## 17. Academic Clinic

Two entry points on **two different permission models**: the orphaned `app/academic-clinic/page.tsx` (zero inbound links, fully client-side, legacy `students.user_id` ownership) and the actively-linked `app/dashboard/clinic/reports/[studentId]/page.tsx` (same ownership model, server-rendered, plus a canonical-career augmentation the orphan never received). Both independently reproduce Blueprint's ground (academic levels, trend, career matches, action plan, holiday plan) from a different source, with a third label vocabulary ("Emerging/Developing/Proficient/Exemplary") for the same CBC levels Gradebook shows as raw numbers.

---

## 18. Calendar

`/calendar` reuses `/api/student/calendar` unchanged — same shape as the learner's own calendar. Assignment due dates ARE surfaced (kind `assignment_due`). Assessment dates/meetings have no distinct `kind` value — would render as generic `event`, indistinguishable, and no evidence such entries are even populated. **No per-child label on any entry** despite aggregating across all linked children server-side. Read-only, confirmed. **Broken for institutional-only guardians** (§29).

---

## 19. Resources

`/resources` is a byte-for-byte read-only reuse of the learner's own resources page — "Class Resources," no parent-specific framing, summarization, or "how to use this with your child" layer, per its own header comment. This is genuinely learner resources re-exposed without adaptation, not adapted parent support material. Whether that distinction matters is a live open product question — resources are largely inert files/notes where the gap may be low-cost, but no parent-specific curation exists today.

---

## 20. Communication

**Announcements/Calendar:** read-only, no reply/acknowledge UI anywhere.

**Teacher Communication: no path found, anywhere in the audited surfaces, for a parent to contact a teacher, request a meeting, reply to feedback, or acknowledge an intervention.** Confirmed by absence across all 24 `app/(parent)/**` files and all 8 `app/api/parent/**` routes. This is a straightforward reportable gap.

**WhatsApp boundary:** `lib/parentPulse/builder.ts` (WhatsApp-facing) and `lib/parentExperience/actions.ts` (portal-facing) are **two independently-timed selectors over the same Projection data** — a WhatsApp cron run and an on-demand portal request. They can legitimately disagree at any given moment (e.g., Parent Pulse messages "Needs attention: Maths" from a cron snapshot while the portal, computed moments later, already shows "All Good"). Structural characteristic, not an observed bug.

---

## 21. Parent Observations

Real, deliberately designed feature: `/dashboard/assessments/add` → `/api/parent/assessments/process` → `assessments` row tagged `source='parent'` → `recordReportCardAssessmentEvidence()` resolves `evidence_source='parent_observation'`, trust tier 1, confidence-capped below the auto-confirm threshold, always `pending_review` until a teacher explicitly confirms via the sanctioned lifecycle function. What a parent can report: subject-level CBC scores/marks, same shape as a teacher's report-card entry — **no free-text observation field found.** Exactly the intended shape for a non-teacher-attested claim.

---

## 22. Interventions

**No dedicated "intervention" feature exists for parents.** The nearest analog — approved Blueprint action items, projected read-only via `toParentView()` — shows only `status='approved'` AND `visibility` in `parent_visible`/`shared`, exposing `observation`/`whatTheSchoolWillDo`/`homeSupport`/`reviewDate`/`successIndicator`. No acknowledge/comment/progress-update route exists. `teacherNotes`/`evidenceBasis` are structurally absent from the type, not just filtered. Correctly staff-authored-only.

---

## 23. Adaptive Actions

Confirmed: parents **cannot** approve, defer, reject, propose, or trigger delivery of any adaptive action. `canManageLearnerRecordCore` is staff-only by construction (no self/parent branch exists, unlike its sibling `canViewLearnerRecord`). Parents see only the already-`approved` subset via a projection function that performs no authorization decision of its own (correctly relies on the route-level gate). Product semantics hold.

---

## 24. Compass

**The one genuine, exploitable-by-design impersonation surface in the portal.** A parent can select any linked child and drive a full Compass tutoring session identically to the learner — `resolveCompassStudentAccess` grants `via: 'parent'` equal standing to `via: 'learner'`, and nothing in the session payload, evidence row, or XP/level state distinguishes who was actually typing. Session-history visibility to parents (`/api/parent/compass-activity`) is itself correctly scoped and intentional — the gap is upstream, at session-drive time, not at the read-visibility layer. Bounded by the tier-1/pending_review evidence ceiling; not bounded for XP/level/session-count UI state, which is written and displayed to the learner unconditionally regardless of who ran the session.

---

## 25. Child Privacy / Age Boundary

Learner reflections: **zero parent-facing references found** — not exposed anywhere. Compass conversations: only aggregated session metadata (subject, XP, level movement, plain-language summary) is exposed via `/api/parent/compass-activity` — never raw transcript content. Career profile detail: a fairly complete derived capability/career view **is** parent-visible by design (strengths, growth areas, red flags, conversation starters). Private notes: none found reachable. This looks like a deliberate design choice (curated/derived surfaces only, raw learner voice never exposed) but is not documented anywhere as an explicit privacy policy — worth the team confirming it's intentional rather than incidental.

---

## 26. Institutional vs. Legacy

Confirmed asymmetry across the four family-wide `/api/student/*` routes parent pages reuse:

| Route | Institutional bridge added? | Consequence for Core-only guardian |
|---|---|---|
| `/api/student/resources` | Nominally yes, but the bridge only resolves a **learner's own** login identity, not a guardian's — doesn't actually help parents | Files tab still effectively legacy-only |
| `/api/student/materials` | No | Notes tab returns empty |
| `/api/student/calendar` | No | Calendar returns empty |
| `/api/student/announcements` | No | Announcements return empty |

**A parent whose child exists only in Core (no legacy `students` row) gets silently empty Calendar/Announcements/Notes/Resources — indistinguishable from "nothing posted yet."** This is the single most concrete, reproducible institutional-vs-legacy gap found in the whole audit.

Contrast: `/child/[learnerId]/*` (Blueprint family) and `/report-card` are correctly Core-aware and work for both spaces. The gap is specifically these four legacy student-portal routes, extended once for a learner's own identity but never for a guardian's.

Unverified (flagged for follow-up, not confirmed): whether `/child/[learnerId]/assignments` and `/gradebook` hit the same guardian-vs-learner identity gap via their own use of the compatibility bridge.

---

## 27. Multi-School Parent

Walked Child A (School A) / Child B (School B): **safe across every flagship surface tested.** Every `/child/[learnerId]/*` page re-derives `schoolId` fresh from the URL param — no shared/global "current school" concept exists to leak across children. Report Card is explicitly multi-school-safe by construction (`school_id` carried per learner row). Resources/Calendar hardcode no single school (aggregate across all classes of all linked children) — but inherit the institutional-guardian gap above, so a Core-only Child B at School B would show zero resources/calendar entries regardless of School A's data, which could misleadingly read as "School B has nothing going on."

---

## 28. Authorization / IDOR Audit

Checked every parent-reachable route touching Blueprint, assignments, grades, resources, Career Intelligence, and Clinic reports for a DB-level ownership check keyed to the requested learner/student id (not just an auth check).

**No confirmed IDOR found.** Every route either performs a genuine ownership check (`requireParent`, `canAccessLegacyStudent`, or an equivalent multi-branch check) or fails closed — several career routes (`/career/interest`, `/career/growth`, `/career/match`) are actually *over*-restrictive, denying parents entirely because they omit the opt-in `includeParent` flag. One route (`/api/parent/career-intelligence`) uses a hand-rolled ownership check instead of the canonical helper — functionally correct (also backed by RLS), flagged as tech debt, not a live IDOR. `/api/reports/clinic/[reportId]/url` returns the same 403 for "doesn't exist" and "not yours," correctly avoiding an existence-leak side channel.

---

## 29. Parent Impersonation Risks

Every call site of `requireLearnerAccess` (9 files) was verified to be GET/page/PDF-read only — no mutating route reuses this guard. **The actual impersonation-capable guard is `resolveCompassStudentAccess`** (§24), used by design on mutating Compass routes because Compass predates and sits outside the Core `requireLearnerAccess`/`requireParent` family. This is the one confirmed impersonation risk in the audit, contained by evidence trust-tier ceilings but not by any actor-distinguishing field.

---

## 30. Data Authority Table

| Concept | Canonical authority | Flag |
|---|---|---|
| Capability/knowledge state, risk | `recomputeLearnerProjection()` | Consumed correctly everywhere audited |
| Blueprint (all sections) | `composeBlueprint()` | Single source for every parent page |
| Growth trajectory | Two parallel mechanisms: snapshot-diff milestones (exposed) + Projection growth window (computed every render, never rendered) | Wasted compute, not a second truth in front of the parent |
| Career interpretation | Three distinct engines behind three URLs (`composeCareer`, `resolveFreshCapabilityProfile`, AI-narrative report) | Each individually reads canonical data — but a parent sees differently-framed content depending on entry point |
| Assignments, gradebook | Same routes/functions the learner/teacher surfaces use, filtered | No independent logic |
| Report card, attendance | `getReportCard()`, `composeAttendance()` | Single path each |
| Academic Clinic's academic levels/career matches | **Independent** — legacy `students`/`assessments`, own `CAREER_DATABASE`, client-recomputed CBC thresholds | The one confirmed canonical-authority violation in the parent-visible surface set |

No parent-facing component was found doing local capability/risk/readiness computation outside the canonical chain (§32 of the working audit) — the redundancy that exists is at the **entry-point level** (multiple pages hitting different-but-individually-valid engines), not at the computation level, with the single exception of Academic Clinic.

---

## 31. Dead / Orphan Surfaces

- **`app/(parent)/career-report/page.tsx`** — fully built (408 lines), zero inbound links anywhere in the codebase.
- **`app/academic-clinic/page.tsx`** — zero inbound links, reachable only by typing the URL.
- **`app/dashboard/assignments`** — literal route string kept in nav constants but never actually rendered (rewritten to `/child` at render time via `applyOverrides()`).
- All `app/api/parent/*` routes have at least one live caller — none orphaned.
- No no-op CTAs or TODO-stub handlers found anywhere in parent surfaces.

---

## 32. Mobile Audit

Overall mobile-first in pattern: centered narrow columns, full-width tap-target cards, `focus-visible` rings, no fixed-pixel-width classes found anywhere in the parent tree. Gradebook table correctly wraps in `overflow-x-auto`. The one non-responsive pattern found: `/report-card`'s summary grid (`grid-cols-2`, no breakpoint variant) — a plausible but unconfirmed squeeze point on narrow phones, the only grid in the parent surface set without a responsive escape hatch.

---

## 33. Low-Connectivity Audit

**Parent Home is close to ideal**: one server-side composed call (`composeBlueprint()`) delivers the whole page in one round trip, no client-side waterfall. Weak points found:
- Navigating Home → Full Picture recomputes the entire Blueprint a second time within seconds (no short-lived cache between sibling pages).
- All three career pages independently re-fetch `/api/students/list` on mount — same roster call, three times, no shared cache.
- `/dashboard` (the actual entry point) fires 5 parallel network round trips before its tiles populate — not sequential, but a real cost before any useful content appears, on the very first screen a parent sees.
- No `select('*')`/oversized-payload patterns found in the parent-specific API routes.

---

## 34. Navigation Graph

```
Auth callback → getRoleRedirect('parent') → /dashboard  [ALWAYS]

/dashboard (legacy, real entry point)
  ├─ /learn, /career-intelligence, /dashboard/clinic     working
  ├─ /child  (labeled "Assignments" — role-confused)      working, ONLY entry to Core flow
  ├─ /resources                                           working, legacy-data-only (§26)
  ├─ /calendar                                             BROKEN for institutional children (§26)
  ├─ per-student tiles (?student=X)                        working
  └─ /report-card, /child (Quick Actions)                  working

/child  (Core entry, orphaned from primary nav)
  ├─ 0 children → dead end, no CTA
  ├─ 1 child → redirect
  └─ N children → picker
       └─ /child/{id}  (Parent Home)
             ├─ /full, /assignments, /gradebook, /progress, /holiday, /journey→/history
             └─ NO link back to /child or /dashboard from any subpage   ORPHAN gap
```

---

## 35. Product Coherence Verdict

**"Here are the EduNexus modules that happen to mention my child," not "here is what matters about my child and how I can help."**

Supporting evidence: two full parallel parent-home systems ship simultaneously with the wrong one as the default entry point; four disagreeing academic-result surfaces; three overlapping career-report pages; three independent risk-language vocabularies; Academic Clinic operating on an entirely separate data/ownership model from everything else. The one part of the portal with genuine architectural discipline and a real "coherent job" feel is the Blueprint pathway itself (`composeBlueprint` → `ParentBlueprintView` → `ParentActionCard`, with viewer-aware, terminology-translated, parent-safe action wording) — but it's one good layer surrounded by accreted duplicates.

---

## 36. Top-10 Ranked Gaps

| # | Severity | Gap |
|---|---|---|
| 1 | **CRITICAL** | Institutional-only guardians get silently empty Calendar/Announcements/Notes/(mostly) Resources — no error, indistinguishable from "nothing posted." (§26) |
| 2 | **CRITICAL** | Every parent is routed to the legacy `/dashboard` on login, never to the correctly-designed, IDOR-safe, multi-school-aware `/child` flow — reachable only via a mislabeled "Assignments" nav item. (§3) |
| 3 | **HIGH** | Compass allows a parent to drive a tutoring session indistinguishable from the learner's own — evidence, XP, and progress state are attributed to the child with no actor discriminator. (§10, §24) |
| 4 | **HIGH** | Four independently-computed academic-result surfaces (Gradebook, Report Card, Blueprint, Academic Clinic) disagree in data source and vocabulary for the same learner. (§12) |
| 5 | **HIGH** | No path exists anywhere for a parent to contact a teacher, request a meeting, or respond to feedback — the loop back to the school never closes. (§20) |
| 6 | **MEDIUM** | Three overlapping career-report pages (one fully orphaned) and three independent risk-language vocabularies exist with no convergence. (§14, §16, §31) |
| 7 | **MEDIUM** | Assignments/gradebook/career-page loading clients collapse "network failure" and "genuinely nothing to show" into the identical empty-state UI — misleading on the low-connectivity connections this platform targets. |
| 8 | **MEDIUM** | Family-wide Resources/Calendar show no per-child label — a two-child parent can't tell which child an item belongs to. (§5, §18) |
| 9 | **LOW** | No child-switcher link exists inside `/child/[learnerId]/*` subpages; `/child` with zero linked children is a dead end with no CTA. (§5) |
| 10 | **LOW** | A canonical Projection-sourced growth-trajectory signal is computed on every Blueprint render and never rendered — wasted compute, stale "not_implemented" comment. |

---

## 37. Test Coverage Matrix

| Domain | Unit | Integration | HTTP | Multi-child | Institutional |
|---|---|---|---|---|---|
| Identity / child-context | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| `/child` picker | ❌ | ❌ | ❌ | ❌ | ❌ |
| Parent Home | ❌ | ⚠️ indirect | ⚠️ not in the HTTP loop | ❌ | ❌ |
| Assignments | ❌ | ❌ | ✅ | ❌ | ❌ |
| Gradebook | ❌ | ❌ | ✅ strong (200/403/400) | ❌ | ❌ |
| Career (all 3 pages + APIs) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Calendar / Resources | ❌ | ❌ | ⚠️ reachability only | ❌ | ❌ |
| Journey / history | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Report card | — | — | ❌ | ❌ | ❌ |

**Most significant untested boundaries:** the multi-child picker (`/child`) has zero coverage — no test drives `resolveParent()` with >1 linked learner, the very first identity decision a two-child family hits; all three career pages/APIs are completely untested from an HTTP angle despite looking correct on inspection; report card has zero test coverage despite being a primary dashboard destination.

---

## 38. Database Changes

**None.** Audit-only, no migrations proposed or applied.

---

## 39. Files Changed

**None (product code).** This audit document only: `docs/architecture/parent-portal-super-audit-p0.md`.

---

## 40. Recommended Next Phase

**P1 — Parent Entry Convergence:** fix the routing defect (§2/§3) so a parent lands on the correct flow for their child's identity space, and close the institutional-guardian data gap on Calendar/Announcements/Materials (§26). This is the smallest change that removes both CRITICAL findings, requires no redesign of Home's content, and unblocks every other surface from working correctly for institutional families before any further phase touches Home layout, career convergence, or communication features.
