# Edunexus Reference Architecture Specification (RAS)

**Status: NORMATIVE.** This document codifies the architecture already ratified across the Architecture Constitution, the Canonical Domain Registry, the Deprecation Registry, the Stage 0 Architectural Census, the Stage 0.5 Canonical Identity Resolution, the Canonical Domain Evolution Blueprint, and the Phase A Execution Plan. It introduces no new findings, no new designs, and no new decisions — it converts what those documents established into the standard every future contributor, human or AI, follows when building on Edunexus. Where this document and an earlier one appear to disagree, the earlier evidentiary documents govern the *facts*; this document governs the *rule* derived from them, and any apparent conflict should be treated as a drafting error in this document to be corrected, not a reason to re-open the underlying finding.

---

## 1. Purpose

Edunexus grows by contributors — human and AI — who were not present for the Stage 0/0.5 investigations and have no first-hand memory of why `students` evolves and `learners` retires, why `class_assessments` must carry a `school_id`, or why Intelligence never reads an Operating-Layer table directly. Left undocumented, every one of those decisions is one accidental PR away from being silently re-violated by someone who didn't know it was a decision at all — which is exactly how the platform arrived at two Learner tables and two Class tables in the first place: not through carelessness, but through good engineers making locally reasonable choices with no visibility into a prior, equally reasonable choice made elsewhere.

This specification exists to make that impossible going forward. It is the single place a contributor checks before creating a table, a repository, a service, or an API route — not to re-derive the reasoning (that lives in the documents this one codifies), but to get the answer fast enough that following the standard is easier than not following it.

---

## 2. Architectural Layers

```
Presentation Layer          (pages, components — UI only, zero business logic)
        ↓
Application Layer           (API routes — thin, auth-check + one service call)
        ↓
Domain Services             (lib/core/*, lib/ranking/* — business rules, one per domain)
        ↓
Repositories                (lib/repositories/* — one per domain, query-only)
        ↓
Canonical Domains           (the tables named in §3 — School-owned, RLS-enforced)
        ↓
Database                    (Postgres/Supabase — the enforcement floor)
        ↓
Evidence Layer              (learner_evidence — one-way, append-only, Learner-Profile-owned)
        ↓
Projection Layer            (learner_projections, learner_profiles — computed from Evidence)
        ↓
Educational Intelligence    (capability, pathway, career, Compass, Clinic reasoning)
        ↓
Recommendations / Interventions   (surfaced to teachers, parents, learners)
```

**Responsibilities:**
- **Presentation** renders state and captures input. It calls Application Layer routes only. It never queries Supabase directly, per the existing `CLAUDE.md` rule this specification does not change.
- **Application** authenticates (`auth.getUser()`), authorizes (via the consolidated permission check, §8), and delegates to exactly one Domain Service call. It contains no business logic of its own.
- **Domain Services** own business rules — grading math, ranking, report generation, ownership assignment. They are the only layer permitted to compose more than one repository call into a single operation.
- **Repositories** are query-only — they translate domain operations into table access and back, and own exactly one domain's tables (§4).
- **Canonical Domains** are the tables themselves — School-owned, RLS-enforced, the tables named canonical in §3.
- **Database** is Postgres/Supabase, the final enforcement point — every rule stated in §7/§8 that matters for correctness or security must be enforced here too, not only in application code, per the Fifth Constitutional Law.
- **Evidence Layer** onward is the Intelligence side of the Fourth Constitutional Law's boundary — everything from `learner_evidence` down is Learner-Profile-owned, and nothing above the boundary reads directly from anything below it, or vice versa, except through the one-way Evidence-writing functions.

**No layer may bypass another without explicit justification.** A justification, if one is ever needed, is a comment at the bypass site citing this document and stating the specific reason — not silence. In practice, this should almost never be needed: the six documents this specification codifies do not describe any legitimate case for a layer skip in the current architecture.

---

## 3. Canonical Domain Standards

This table restates the Canonical Domain Registry and Evolution Blueprint's decisions in standards form. It is not a re-derivation — see those documents for the evidence behind each row.

| Domain | Owner | Canonical Table | Canonical Repository | Canonical Service | Canonical API | Security Boundary | Dependencies | Allowed Consumers | Forbidden Consumers |
|---|---|---|---|---|---|---|---|---|---|
| School | Self | `schools` | `SchoolRepository` | `lib/core/school.ts` | `app/api/core/school/**` | Root — no parent scope | None | All domains | — |
| Academic Year / Term | School | `academic_years`, `terms` | `SchoolRepository` | `lib/core/school.ts` | `app/api/core/school/**` | School-scoped RLS | School | Assessment, Class, Report Card | — |
| Teacher | School | `teachers` (evolving) | `TeacherRepository` | `lib/core/teachers.ts` | `app/api/core/teachers/**` | School-scoped RLS | School | Class, Assessment (as `created_by`), Permissions | — |
| Learner | School | `students` (evolving) | `LearnerRepository` | `lib/core/learners.ts` | `app/api/core/learners/**` | School-scoped RLS + guardian self-scope | School | Class (enrollment), Assessment, Guardian, Evidence (one-way) | Any module writing Learner data from outside `LearnerRepository` |
| Guardian | School | `learner_guardians` | `GuardianRepository` | `lib/core/guardians.ts` | `app/api/core/guardians/**` | School-scoped RLS + self (`user_id`) | Learner | Report Card (read), Notifications | — |
| Class | School | `teacher_classes` (evolving) | `ClassRepository` | `lib/core/classes.ts` | `app/api/core/classes/**` | School-scoped RLS | School, Teacher | Assessment, Learner (enrollment) | Any repository other than `ClassRepository` reading/writing `teacher_classes`/`classes` |
| Stream | School | `streams` | `ClassRepository` | `lib/core/classes.ts` | `app/api/core/classes/**` (sub-resource) | School-scoped RLS | School | Class | — |
| Subject | School (catalog: shared reference) | `subjects` | `SubjectRepository` | `lib/core/subjects.ts` | `app/api/core/subjects/**` | Read-open reference data; `class_subjects` assignment is school-scoped RLS | Class | Assessment, Class | — |
| Assessment / Marks | School | `class_assessments`, `learner_marks` | `AssessmentRepository` | `lib/core/assessments.ts` | `app/api/core/assessments/**` | School-scoped RLS | School, Class, Learner, Term | Ranking Engine, Report Card, Evidence (one-way) | Any second `createAssessment`/marks-write implementation |
| Ranking | — (computation, not owned data) | N/A | N/A | `lib/ranking/rankingEngine.ts` | Consumed internally, not a route | N/A | Assessment | Report Card, class analytics views | Any inline ranking/position sort outside the engine |
| Report Card | School | `school_report_cards`, `term_subject_summaries` | `ReportCardRepository` | `lib/core/report-cards.ts` | `app/api/core/reports/**` | School-scoped RLS (staff) + guardian-scoped RLS (published only) | Assessment, Ranking, Learner, Guardian | Guardian read, Evidence (one-way) | — |
| Attendance | School | Not yet built | `AttendanceRepository` (reserved) | `lib/core/attendance.ts` (reserved) | `app/api/core/attendance/**` (reserved) | School-scoped RLS (when built) | Class, Learner | Evidence (one-way, when built) | Building this domain inside `ClassRepository` or `AssessmentRepository` for convenience |
| Communication | School | `notification_log` + channel-specific tables | `NotificationRepository` | `lib/notifications/*` | `app/api/notifications/**` | School-scoped RLS | Learner, Guardian, Teacher | — | — |
| Learning Evidence | Learner Profile | `learner_evidence` | `EvidenceRepository` | `lib/intelligence/evidenceLifecycle.ts` | Internal only | Learner/guardian-scoped RLS | Assessment, Report Card (one-way in) | Projection Layer | Any School-scoped write; any Operating-Layer read of this table for institutional (non-Intelligence) purposes |
| Projection / Intelligence | Learner Profile | `learner_projections`, `learner_profiles` | `ProjectionRepository`, `LearnerIntelligenceRepository`, `LearnerModelRepository` | `lib/projection/recompute.ts`, `lib/learnerRecord/timeline.ts` | `app/api/learner-intelligence/**`, `app/api/career/**`, etc. | Learner/guardian-scoped RLS | Evidence | Compass, Clinic, Career, Adaptive Learning | Direct writes from Operating-Layer services |
| Permissions | — (relationship, not owned data) | `school_users` role field (interim), consolidated model (target, §8) | `PermissionRepository` (reserved) | `lib/core/permissions.ts` (reserved) | Enforced inline via the shared check, no dedicated CRUD route | N/A | User, School | Every domain's Application Layer | Per-route reimplementation of a role check |

---

## 4. Repository Standards

Every repository:
- **Owns exactly one domain**, as listed in §3's Canonical Repository column. A repository importing or querying a table outside its named domain is a standards violation, full stop, regardless of how small or convenient the query seems (this is precisely how `TeacherRepository` came to own `classes` reads, per the Evolution Blueprint's finding).
- **Never implements business logic.** Grading math, ranking, eligibility rules, ownership assignment — all of it lives in the Domain Service that calls the repository, never in the repository itself. A repository method answers "what does the database say," not "what should happen."
- **Never performs authorization.** A repository trusts the caller has already authorized the operation (via the Application Layer's permission check, §8). It does not re-check roles or school membership itself — mixing the two makes it unclear which layer is actually responsible when a check is missing, which is exactly the failure mode Stage 0 found twice.
- **Never duplicates queries.** If two services need the same read, they call the same repository method — a second, near-identical query in a second file is a standards violation to be caught at review (§11), not tolerated as a convenience.

**Naming convention**: `<Domain>Repository`, PascalCase, one class per file at `lib/repositories/<domain>.repository.ts`, registered once in `lib/repositories/index.ts`'s `repos` object under a camelCase key matching the domain name.

**Lifecycle**: a repository is created when a domain is named canonical in §3 and doesn't yet have one (e.g. `ClassRepository`, `GuardianRepository`, `PermissionRepository` — all reserved, not yet built, per the Evolution Blueprint's §5). A repository is retired only when its domain's table is fully deprecated per the Deprecation Registry's `REMOVED` status — never before, and never partially (a repository is not allowed to exist "half-migrated," pointing at two tables indefinitely; the transitional dual-table period described in the Evolution Blueprint's §4 is bounded and ends in a single canonical table).

---

## 5. Service Standards

Every service:
- **Owns business rules** — the one place grading, ranking, report-generation, and ownership-assignment logic is allowed to live.
- **Is stateless.** A service function takes its inputs (including the acting user's identity, resolved from `auth.getUser()` by the caller, never re-derived inside the service from ambient state) and returns its output; it does not hold session or request state across calls.
- **Is deterministic where possible.** Ranking, grading, and report aggregation must produce the same output for the same input every time (this is the concrete requirement behind the Ranking Engine's test plan in the Execution Plan's Stage 2 — a tie-handling bug is, among other things, a determinism bug relative to what a human would expect). Where a service genuinely cannot be deterministic (an AI-generated report narrative, for instance), that non-determinism must be isolated to a clearly named sub-function, not spread through the whole service.
- **Never directly exposes database tables.** A service's public interface is domain-shaped (`createAssessment(input): Assessment`), not table-shaped (`insertRow('class_assessments', row)`) — callers should never need to know the underlying table name to use a service correctly.
- **Never duplicates another service.** Before writing a new service function, check §3's Canonical Service column — if one already exists for the domain, extend it. This is the Fifth Constitutional Law from the earlier stages ("verify whether a canonical implementation already exists"), restated as a service-layer rule.

---

## 6. API Standards

- **Route ownership**: every route belongs to exactly one of the six categories the Evolution Blueprint's §7 defined (Teacher, School, Parent, Learner, Admin, Internal APIs) and calls exactly one canonical service per domain touched. A route needing two domains' data composes two service calls at the route layer; it does not reach into a second domain's repository.
- **Validation**: every request body is validated with Zod before being passed to a service, per the existing `CLAUDE.md` rule.
- **Authentication**: `auth.getUser()` first, `401` if absent — no route is exempt.
- **Authorization**: the consolidated permission check (§8), never a per-route reimplementation. A route with a role restriction calls the shared check with the required role list; it does not write its own `if (role !== 'admin')` inline.
- **Error handling**: `{ error: string }` with the correct HTTP status, per the existing `CLAUDE.md` rule — `401` for missing auth, `403` for authorization failure, `404` for missing resource, `422`/`400` for validation failure, `500` reserved for genuinely unexpected failures, never used to paper over an unhandled authorization or validation case.
- **Versioning**: not currently in use anywhere in the platform; if a breaking API change is ever needed, it is versioned via a new route path segment (`app/api/v2/...`), never a silent behavior change on an existing path — reserved as a rule for when it's first needed, not retrofitted now.
- **Audit logging**: every mutating route on a canonical domain populates `created_by`/`updated_by` from the authenticated user, per §7/§8.
- **Response consistency**: a given resource shape (e.g. "an Assessment") is serialized identically by every route that returns it — defined once in the owning service's return type, not re-shaped ad hoc per route.
- **No duplicated endpoints**: before adding a route, check §3's Canonical API column — if a route already exists for the domain and action, extend it (add a query parameter, an action variant) rather than creating a parallel route, unless the two routes genuinely serve different consumer categories (e.g. a Teacher-facing and a Parent-facing view of the same domain are legitimately two routes, per the ownership-category rule above — that is not duplication, it's correct category separation).

---

## 7. Database Standards

- **Canonical identities**: one UUID primary key per canonical entity, per §3 — no second table may claim to represent the same real-world entity (the First Constitutional Law, enforced at the schema level).
- **Foreign keys**: every relationship between canonical tables is an enforced FK, never a plain UUID column with no constraint (the `student_guardians` table found in Stage 0.5 — plain columns, no enforced FK — is the negative example this rule exists to prevent going forward).
- **Indexes**: every FK column is indexed, per the existing `CLAUDE.md` rule — checked mechanically via `mcp__supabase__get_advisors(type="performance")`'s `unindexed_foreign_keys` lint before any migration is considered complete.
- **Soft deletes**: not currently a platform-wide pattern (most tables use hard deletes or a `status`/`is_active` flag inconsistently); where a canonical domain needs "deleted but recoverable" semantics, use an explicit `status` enum column (matching `learners.status`'s existing pattern) rather than a bare `deleted_at` timestamp or a physical delete, to keep the audit trail (§8) intact.
- **Audit columns**: every canonical table carries `created_at`, `updated_at` (existing platform-wide rule), plus `created_by`, `updated_by` (uuid, FK to `auth.users.id`) on every table that records an institutional event (Assessment, Marks, Report Card, Class, Guardian assignment) — populated from the authenticated actor, never the request body.
- **Ownership columns**: every canonical Operating-Layer table carries a non-nullable, FK'd `school_id` — the Second Constitutional Law made mechanically checkable. A canonical table without this column is, by definition, not yet fully evolved per the Evolution Blueprint's §4, and any new table must be built with it from day one — no new table is ever created without a `school_id` again, regardless of how "obviously scoped" it seems at creation time (this is exactly the reasoning gap that produced `teachers`/`students`/`teacher_classes` without one).
- **Migration rules**: every migration touching a canonical table follows the Seventh Constitutional Law's sequence — Audit → Understand → Add → Backfill → Verify → Observe → Remove. No migration may combine an `ADD` and a `DROP` for the same conceptual change in one step; they are always separate migrations, separated by an observation window.
- **Deprecation rules**: a table or column being retired is recorded in the Deprecation Registry before any code stops calling it, tracked `IDENTIFIED → MIGRATING → OBSERVING → REMOVED`, and is never dropped while any repository still references it (checked mechanically via a repo-wide grep before the final `REMOVED` migration is written).
- **Schema evolution principles**: additive by default; a breaking schema change (rename, type change, drop) requires an approved ADR (§12) citing which repositories/services are affected and their migration plan — schema changes are never "just" a database concern, they are always also a code-ownership concern per §4.

---

## 8. Security Standards

- **Authentication**: Supabase Auth, `auth.getUser()` at every Application Layer entry point — unchanged from existing platform practice, restated here as the permanent floor.
- **Authorization**: a single, shared permission-evaluation function (`lib/core/permissions.ts`, reserved per the Evolution Blueprint's §8) — `requireSchoolRole(userId, schoolId, allowedRoles[])` or equivalent — called by every route that needs a role check, never reimplemented per route. This is the single most important rule in this section: the two authorization gaps found in Stage 0 existed because the check was copy-pasted per route instead of shared, and one copy was correct while its sibling wasn't. A shared function makes that class of bug structurally impossible, not just less likely.
- **Database RLS**: every canonical Operating-Layer table's RLS policy follows the pattern already correct on `learners`/`learner_enrollments`/`school_report_cards`/`streams` (`EXISTS (SELECT 1 FROM school_users WHERE school_id = <table>.school_id AND user_id = auth.uid() AND is_active)`) — never the unscoped pattern found on `classes` (`auth.uid() IS NOT NULL`). Every new RLS policy is checked against `mcp__supabase__get_advisors(type="security")` before being considered complete.
- **Permission evaluation**: role checks always evaluate against the requesting user's *current* school membership (`school_users`, or its evolved successor per the Evolution Blueprint's Phase B), never against a cached or client-supplied role value.
- **School isolation**: enforced at both the Application Layer (shared permission check) and the Database Layer (RLS) — the Fifth Constitutional Law made concrete as a two-layer requirement, neither layer alone sufficient, per the Security Architecture section of the Evolution Blueprint.
- **Privilege escalation prevention**: no code path allows a user to set their own role (the `teachers.role='admin'` pattern flagged `UNVERIFIED` in Stage 0.5 is exactly the shape of risk this rule exists to prevent going forward — role changes are always a School-Admin-initiated action on another user, never self-service).
- **Audit trails**: `created_by`/`updated_by` on every mutation of a canonical table, per §7 — this is the Second Constitutional Law's attribution half, made mechanically enforced.
- **Sensitive operations** (report publishing, role changes, evidence erasure) require both a role check *and* an audit log entry beyond the standard `created_by`/`updated_by` — e.g. the existing `learner_evidence` erasure trail (`erased_by`, `erasure_reason`) is the model every future sensitive operation should follow.

---

## 9. Intelligence Standards

- **How Intelligence consumes evidence**: exclusively through `learner_evidence`, written one-way by the small, named set of Evidence-writing functions in `lib/assessments/` and `lib/intelligence/evidenceLifecycle.ts`. No Intelligence module (`lib/projection/`, `lib/career/`, `lib/compass/`, `lib/academicClinic/`, `lib/adaptiveLearning/`) reads an Operating-Layer table (`class_assessments`, `learner_marks`, `school_report_cards`, etc.) directly, ever.
- **How Intelligence must never own official records**: no Intelligence module writes to a canonical Operating-Layer table under any circumstance. A prediction, recommendation, or intervention is stored in an Intelligence-owned table (`learner_projections`, or a future recommendation/intervention table following the same ownership pattern) — never as a field bolted onto `class_assessments` or `school_report_cards`.
- **How predictions are generated**: from `learner_projections`, computed by `recomputeLearnerProjection`, itself computed from `learner_evidence` — the existing, already-correct pipeline, unchanged by this specification.
- **How interventions are produced**: surfaced from Intelligence-layer reasoning (Compass, Clinic, Remedial) back to the teacher/parent/learner as a *recommendation*, never as a silent write back into the Operating Layer — an intervention that requires an official record to change (e.g. a remedial plan that should adjust a report card comment) always routes back through a human, acting through the normal School-owned Report Card service, never through a direct Intelligence-to-Operating write.
- **How recommendations are stored**: in Intelligence-owned tables, versioned by `projector_type`/`projection_version` (matching `learner_projections`' existing shape) so a recommendation's provenance — which evidence, which model/reasoning version — is always reconstructable.
- **How reasoning remains reproducible**: every projection/recommendation records `supporting_evidence_ids`, `confidence`, `evidence_count`, `confidence_formula_version` (matching `learner_evidence`/`learner_projections`' existing columns) — a future contributor asking "why did the system recommend this" must always be answerable from stored data, never require re-running an AI call to find out.

---

## 10. Engineering Rules

Mandatory, no exceptions without an approved ADR (§12):

1. **One domain, one repository.** (§4)
2. **One domain, one service.** (§5)
3. **One domain, one canonical API ownership category per consumer type.** (§6)
4. **One canonical identity per real-world entity.** (First Constitutional Law)
5. **One Ranking Engine.** No inline sort/position logic anywhere outside `lib/ranking/rankingEngine.ts`.
6. **One Report Pipeline.** Once `school_report_cards` is proven functional (Evolution Blueprint §4), the legacy AI auto-report pipeline retires — until then, exactly one of the two is authoritative for parent-facing output at any given time, never both simultaneously presenting as canonical.
7. **No duplicated business logic.** Grading, ranking, eligibility, and ownership rules exist in exactly one function each.
8. **No cross-domain ownership.** A repository or service that reaches into another domain's tables directly (rather than calling that domain's repository/service) is a standards violation regardless of convenience.
9. **No table without a school_id**, for any new Operating-Layer table, from this point forward, no exceptions.
10. **No self-service role escalation.** Role changes are always another actor's action, never the acted-upon user's own request.

---

## 11. Code Review Checklist

Every pull request touching the Operating Layer or Intelligence Layer must answer, explicitly, in the PR description or review:

- [ ] Does this introduce duplication of a table, repository, service, or API that already exists per §3?
- [ ] Does this violate a Constitutional Law (First through Tenth)?
- [ ] Does this create another write path to a canonical table (i.e., does a second function now insert/update/upsert the same table)?
- [ ] Does it introduce another identity for an entity already canonical per §3?
- [ ] Does it bypass the shared authorization check (§8) with an inline role check instead?
- [ ] Does it preserve Intelligence separation (§9) — no Intelligence module writing to an Operating table, no Operating module reading `learner_evidence`/`learner_projections` for institutional decisions?
- [ ] Does it respect canonical ownership — does every new/modified row have a correct, non-guessed `school_id`, and correct `created_by`/`updated_by` from the authenticated actor?

A "no" to the first six, and a "yes" to the seventh, is required to merge. A reviewer who cannot answer one of these questions from the PR alone should ask for it to be made explicit, not guess.

---

## 12. Architecture Decision Records (ADR)

A lightweight ADR is required for any change that:
- Introduces a new canonical domain not listed in §3.
- Proposes an exception to any Engineering Rule in §10.
- Changes a canonical table's identity semantics (a rename, a PK change, a re-anchoring of what the identity *means*).
- Retires a domain from the Deprecation Registry (the ADR is the `REMOVED`-transition record).

**Format** (stored as `docs/architecture/adr/NNNN-title.md`, sequentially numbered):
- **Context** — what problem or gap prompted this, citing the relevant evidence (a census finding, a production incident, a new product requirement).
- **Decision** — the specific choice made.
- **Alternatives** — what else was considered, and why it wasn't chosen.
- **Trade-offs** — what this decision costs, not just what it buys.
- **Consequences** — what changes as a result (which repositories/services/APIs are affected, per §4-§6).
- **Approval** — who ratified it and when, matching the pattern this entire document series has already established (each Phase A stage requiring explicit user approval before proceeding).

No ADR is required for ordinary feature work that stays entirely within an existing canonical domain's established repository/service/API — the ADR process exists to protect the architecture from *drift*, not to slow down routine development.

---

## 13. Evolution Policy

Restated from the Seventh Constitutional Law as the platform's permanent operating policy, not a one-time Phase A instruction:

- **Prefer evolution over replacement.** A table with real production data and real usage evolves to acquire what it's missing; it is not abandoned in favor of a newer, better-designed but unused table, regardless of how much cleaner the newer table's schema is. (This is the specific lesson the Learner/Class reversal in the Evolution Blueprint exists to institutionalize — usage is evidence, schema elegance alone is not.)
- **Prefer compatibility over rewrites.** A consuming module's interface (a repository or service's public function signatures) should survive an underlying table migration unchanged wherever possible — callers should not need to change because the schema underneath their dependency changed shape.
- **Prefer evidence over assumptions.** No architectural claim ("this table is canonical," "this pipeline works," "this is unused") is accepted without a query or a grep behind it — the standing practice this entire document series has modeled and that must continue.
- **Deprecate before deleting.** Every retirement is recorded in the Deprecation Registry before any removal code is written.
- **Observe before removing.** Every migration's final removal step follows an observation window (per §7's migration rules) — no removal ships in the same change as the migration that made it possible.

---

## 14. Future Expansion

New domains fit into the Operating Layer/Intelligence Layer split established in §2, following the pattern §3 already defines for Attendance (reserved, not yet built):

| Future Module | Layer | Fits As |
|---|---|---|
| Timetable | Operating | A new canonical domain — `TimetableRepository`, `lib/core/timetable.ts`, School-owned, `school_id`-scoped from day one, no legacy table to reconcile since none exists |
| Finance | Operating | Same pattern — School-owned billing/fee records; must not be conflated with the existing `payments`/`token_balances` tables, which are platform-subscription concerns, not school-fee concerns — a genuinely new domain |
| Library | Operating | Same pattern — School-owned; likely depends on Learner (borrower) and Subject (catalog categorization) |
| Transport | Operating | Same pattern — School-owned; depends on Learner, Class |
| Health | Operating | Same pattern, with an additional sensitivity note: health records likely need a stricter RLS/audit standard than §8's baseline (closer to `learner_evidence`'s erasure-trail rigor than a typical Operating table) — flagged for explicit design attention when this domain is scoped, not resolved here |
| AI Tutor | Intelligence | Consumes Evidence/Projections exactly like Compass/Clinic today; produces Recommendations, never writes Operating records |
| Parent Intelligence | Intelligence | Same — a read/reasoning layer over existing Projections, not a new identity or Operating domain |
| Career Intelligence | Intelligence | Already exists (`lib/career/`) — new work here extends the existing canonical service, per Engineering Rule 7, rather than creating a parallel one |
| School Intelligence | Intelligence | Aggregates across many learners' Projections for a School-level view — reads only, no new Operating writes; School-level aggregation belongs in the Intelligence Layer, not as a new Operating table, since it's derived/computed, not a primary record |
| Government Reporting (e.g. NEMIS submissions) | Operating (export) | A read/export function over existing canonical Operating tables (Learner, Class, Assessment) — not a new identity, not a new domain, just a new consumer/API category (a "Government API," a seventh category alongside §6's six, if and when this is built) |

**General rule for future modules**: if it records something that officially happened at a school, it is Operating — School-owned, `school_id`-scoped, RLS-enforced per §8, with a canonical repository/service/API triad per §3. If it reasons about, predicts, or recommends based on what already happened, it is Intelligence — Learner-Profile-owned (or School-aggregate-scoped for institution-level reasoning), consuming Evidence/Projections, never writing back to Operating tables.

---

## 15. Definition of Architectural Completion

The architecture is healthy — and this specification's rules are being followed — only when, checked against the live codebase and live database, not asserted:

- [ ] Every domain in §3 is canonical (no remaining "(evolving)" status, per the Evolution Blueprint's tracking).
- [ ] Every identity is unique — no two tables represent the same real-world entity.
- [ ] Every service has one responsibility, matching §3's Canonical Service column exactly.
- [ ] Every repository owns one domain, matching §3's Canonical Repository column exactly, verified by the mechanical check in §4 (no cross-domain table access).
- [ ] Every API has one owner per consumer category, per §6.
- [ ] Every official record belongs to a school — every Operating-Layer table has a non-nullable, FK'd `school_id`.
- [ ] Every Intelligence component consumes canonical records — traced from `learner_evidence` through to every recommendation-producing module, with no direct Operating-table reads found.
- [ ] Every Constitutional Law (First through Tenth) is satisfied, checked individually, not as a single aggregate judgment.
- [ ] No duplicated write paths remain — the single-writer grep test (Evolution Blueprint §6) passes for every canonical table.
- [ ] No orphan domains exist — every table in the live database maps to a row in §3, or is explicitly logged in the Deprecation Registry as retiring.

This is not a one-time checklist to satisfy and forget. It is the standing definition of "the architecture is in a good state," to be re-checked whenever a future audit (in the spirit of Stage 0) is warranted — this specification does not claim the architecture is complete today; it claims that *this* is what complete looks like, and the preceding documents in this series describe the path from where the platform is now to that state.

---

**This specification is normative from ratification forward. It introduces no new findings and changes no code. Future contributors — human or AI — building on Edunexus follow this document; when it is silent on a specific case, they follow the six documents it codifies; when those are also silent, they raise an ADR (§12) rather than guessing.**
