# Sprint 12G — Learner Blueprint Composition Engine

**Status: implemented.** First code sprint in the Blueprint series (12A-12F were architecture-only). Scope strictly held to `lib/learnerBlueprint/` per mission — no UI, PDF, routes, repositories, services, or database changes.

---

## 1. Architecture

`lib/learnerBlueprint/` implements exactly the ADR-0008 rendering pipeline's Composition stage — the single point where canonical-domain data enters the Blueprint. Every file has one job:

| File | Role |
|---|---|
| `types.ts` | The one canonical `LearnerBlueprint` type, `BlueprintSection<T>` wrapper, `BlueprintIdentifiers` |
| `composeIdentity.ts` | Identity ← Core (`lib/core/learners`, `lib/core/school`) |
| `composeAcademicRecord.ts` | Academic Record ← Projection Engine (`lib/projection/recompute`) |
| `composeAttendance.ts` | Attendance ← Attendance service (`lib/core/attendance`) |
| `composeLearningCompass.ts` | Learning Compass ← Compass service (`lib/compass/session`) + holiday-plan read |
| `composeCareer.ts` | Career ← Career service (`lib/career/careerEngine`) |
| `composeTeacherReflection.ts` | Placeholder — `not_implemented` (§4) |
| `composeParentSummary.ts` | Presentation composition over already-composed sections — no new source |
| `composeEducationalIdentity.ts` | Placeholder — `not_implemented` (§4) |
| `composeGrowthTimeline.ts` | Placeholder — `not_implemented`, `[]` |
| `composeMetadata.ts` | Provenance stamp — no persistence |
| `validation.ts` | `validateBlueprint()` — explicit result, never throws for expected partial states |
| `composeBlueprint.ts` | Orchestrator — the one function every future consumer calls |

Every section is wrapped in `BlueprintSection<T> = { status, owner, data, unavailableReason? }` — the mechanism that makes "no silent failures" and "never fabricate values" enforceable in the type system, not just a code-review convention.

---

## 2. Composition Flow

```
composeBlueprint(ids: BlueprintIdentifiers)
  |
  +-- Promise.all([composeIdentity, composeAcademicRecord, composeAttendance,
  |                composeLearningCompass, composeCareer])   (concurrent — each
  |                already catches its own failure internally, never throws
  |                up to the orchestrator)
  |
  +-- composeTeacherReflection() / composeEducationalIdentity() /
  |   composeGrowthTimeline()                                (pure, synchronous placeholders)
  |
  +-- composeParentSummary(identity.data?.learnerName, academicRecord, attendance)
  |                                                           (presentation-only, depends on
  |                                                            already-composed sections)
  |
  +-- composeMetadata({ sectionStatuses, ownerVersions, ... })
  |
  +-- assemble LearnerBlueprint
  |
  +-- validateBlueprint(blueprint) -> { valid, errors }
  |
  v
{ blueprint, validation }
```

Composition happens once. Nothing downstream of this function (a future UI/PDF/Portal consumer) may re-fetch or recompute — this is the exact rule ADR-0008 Part 6 named and this sprint's mission enforces by scope ("no consumer may compose Blueprint independently").

---

## 3. Dependency Graph

```
composeBlueprint
  |-- composeIdentity        -> lib/core/learners.{getLearner,getLearnerHistory}
  |                          -> lib/core/school.{getSchool,getCurrentAcademicYear,getCurrentTerm}
  |-- composeAcademicRecord  -> lib/projection/recompute.recomputeLearnerProjection
  |-- composeAttendance      -> lib/core/attendance.getLearnerAttendanceHistory
  |-- composeLearningCompass -> lib/compass/session.getNextSubject
  |                          -> repos.learnerIntelligence.findPublishedHolidayPlan
  |-- composeCareer          -> lib/career/careerEngine.getMatchesForStudent
  |-- composeTeacherReflection  (no dependency — no owning domain exists)
  |-- composeEducationalIdentity (no dependency — architecture-only per ADR-0006 §9)
  |-- composeGrowthTimeline     (no dependency — future sprint)
  |-- composeParentSummary   -> (composeAcademicRecord's + composeAttendance's already-composed output only)
  `-- composeMetadata           (no dependency — pure)
```

Zero raw `.from(...)` table reads anywhere in `lib/learnerBlueprint/` — confirmed by grep. Zero reinvented calculations (`extractCapabilityProfile`/`computeCapabilityProfile`/`calculateJuniorPathwayAffinity` — none imported).

---

## 4. Findings

**The most significant discovery this sprint made**: `docs/architecture/learner-record-layer-decisions.md` Decision 3 already documents, as a deliberate and still-open architectural decision, that Core's `learners.id` and the legacy `students.id` (used by Projection, Compass, Career, Learner Model) are **two unbridged identity spaces** — no linking column exists anywhere in the schema. ADR-0005 assigned Identity to Core and Academic Record/Compass/Career to domains keyed on the legacy space, without naming this gap. This sprint makes it structural rather than papered over: `BlueprintIdentifiers` carries both `coreLearnerId` (required) and `legacyStudentId` (nullable), and `composeAcademicRecord`/`composeLearningCompass`/`composeCareer` all short-circuit to an explicit `unavailable` section — never a fabricated value, never a crash — whenever `legacyStudentId` is `null`. Every real learner admitted through Core today has no legacy student row, so **every Blueprint composed for a genuinely new Core learner will show Academic Record, Learning Compass, and Career as unavailable until Decision 3's own named trigger (Learner Model migration Phase 5+) resolves the bridge.** This is not a bug in this sprint's code — it is the honest current state of the platform, now visible in the type system instead of silently absent.

**Two ADR-0006 fields have no canonical source function anywhere in the codebase**, confirmed by exhaustive search:
1. **Teacher Reflection** (ADR-0006 §6, ADR-0007 §7) — no domain, table, service, or repository implements the 5-subfield structure. The only adjacent field, `school_report_cards.class_teacher_comment`, is Report-Cards-owned and reference-only per ADR-0005 §5. `composeTeacherReflection()` always returns `not_implemented`.
2. **Learning Readiness** (ADR-0006 §3) and **Future Readiness** (ADR-0006 §4) — no Compass-owned readiness-label function and no Career-owned readiness-label function exist. The only adjacent raw values (`match_score`) are numeric and Article XI forbids rendering a bare number as a neutral label — both stay `null` rather than being invented here.

None of these three are implementation gaps in this sprint's engine — they are real, previously-undocumented gaps in the domains Blueprint depends on, surfaced by actually trying to wire the composition rather than assumed away.

---

## 5. Failure Handling / Availability Model

Every I/O composer (`composeIdentity`, `composeAcademicRecord`, `composeAttendance`, `composeLearningCompass`, `composeCareer`) wraps its own logic in try/catch and returns `{ status: 'unavailable', owner, data: null, unavailableReason }` on any failure — a thrown `PermissionDeniedError`, a network error, a nonexistent id, or (for the two legacy-space composers) a `null legacyStudentId`. `composeBlueprint` runs all five concurrently via `Promise.all` over promises that never reject, so **one domain failing never destroys the whole Blueprint** — confirmed by the integration test's nonexistent-learner case, where Identity alone goes unavailable while the function still returns a fully-shaped, valid-per-its-own-rules result object rather than throwing.

---

## 6. Ownership Matrix (as implemented)

| Section | Owner | Status this sprint |
|---|---|---|
| Identity | Core | Available (when `coreLearnerId` resolves) |
| Academic Record | Assessments, via Projection Engine | Available only when `legacyStudentId` is bridged |
| Attendance | Attendance service | Available (admin-tier actor only, per Sprint 11G's existing scope) |
| Learning Compass | Compass service | Available (partial fields) only when `legacyStudentId` is bridged |
| Career | Career service | Available (partial fields) only when `legacyStudentId` is bridged |
| Teacher Reflection | Unassigned (no domain yet) | Always `not_implemented` |
| Parent Summary | None — presentation only | Available when at least one source section is |
| Educational Identity | Unassigned (deliberately, ADR-0006 §9) | Always `not_implemented` |
| Growth Timeline | None — future extension point | Always `not_implemented`, `[]` |

No duplicated ownership: `composeBlueprint` itself owns nothing, computes nothing, persists nothing — confirmed by the absence of any `.insert`/`.update`/`.upsert` call anywhere in `lib/learnerBlueprint/`.

---

## 7. Validation Flow

`validateBlueprint(blueprint)` checks, in order: Identity is `available` (the one required section — ADR-0005 §2.1, Identity anchors everything else); every section declares a non-empty `owner` string and a valid `status`; `metadata` is complete (`blueprintVersion`, `generatedAt`, `snapshotState`, `freshness`, `evidenceWindow.end`); `metadata.snapshotState` is `'current'` (this engine only ever produces the live composition — Snapshot-taking per ADR-0008 Part 3 is a distinct, not-yet-built concern with its own trigger moments). Returns `{ valid, errors }` — never throws for a normal partial Blueprint, since partial availability is expected behavior, not an error condition.

---

## 8. Extension Points

- **Legacy identity bridge** (§4) — once Decision 3's named trigger resolves, `composeAcademicRecord`/`composeLearningCompass`/`composeCareer` need no change; they already accept `legacyStudentId` as a parameter, only the caller supplying it changes.
- **Teacher Reflection domain** — once built, `composeTeacherReflection()` becomes an I/O composer following the same try/catch pattern as the other five; the placeholder's `owner` string is intentionally descriptive enough to be findable when that sprint starts.
- **Educational Identity computation** — deliberately not pre-empted; whichever future sprint decides the owning domain replaces the placeholder, following the same pattern.
- **Growth Timeline generation** — same pattern; `GrowthTimelineEntry[]` is already the target shape.
- **Attendance Trend/Health/Risk/Support** and **Compass Learning Readiness** and **Career Future Readiness** — each composer's `notes` array documents exactly which ADR-0006/0007 fields are pending a canonical source, so a future sprint building that source doesn't have to re-discover the gap.

---

## 9. ADR Compliance

- **ADR-0005** (§3 ownership matrix) — every section reads exactly one owning domain; §6.
- **ADR-0006** (Principle Two: compose, never duplicate/recalculate) — no composer re-derives a value its owning domain didn't itself produce; Educational Identity and Growth Timeline are not pre-empted (§9 limitations honored).
- **ADR-0007** (§14 audience filtering) — not implemented this sprint by design (composition precedes filtering per the pipeline, ADR-0008 Part 6); the composed object is audience-agnostic, ready for a future Audience Filter stage to consume.
- **ADR-0008** (Part 5/6: three-question composition, Composition-then-filter pipeline, Part 12 invariants 1-5/9-12) — directly implemented; `not_implemented`/`unavailable` sections satisfy invariant 10 ("no educational statement without evidence") by producing no statement at all rather than a guessed one.
- **ADR-0004 §4** (derived value computed by consumer at read time) — Attendance's present/absent/late/excused tally follows the same pattern Report Cards already established, not a new calculation.
- **RAS §9** — Academic Record reads via Projection Engine only, never a direct Operating-Layer table; confirmed by grep, zero `class_assessments`/`learner_marks` references anywhere in `lib/learnerBlueprint/`.

## 10. Constitution Compliance

- **Article I** (Evidence is the only currency of truth) / **Article II** (missing evidence is never poor performance) — every `unavailable`/`not_implemented` section is explicit, never a blank or zero standing in for missing evidence.
- **Article XI** (a number without a name is not neutral) — `futureReadiness`/`learningReadiness` stay `null` rather than exposing a raw `match_score`.
- **Article VI/IX** — no AI call anywhere in `lib/learnerBlueprint/`; Parent Summary is a deterministic template over structured fields, never a generated paragraph, per explicit mission instruction.

---

## 11. Verification

- `tsc --noEmit`: clean, zero errors in `lib/learnerBlueprint/`.
- `eslint`: clean, zero warnings/errors in `lib/learnerBlueprint/`.
- Tests: 17 pure unit tests (`composeBlueprint.pure.test.ts`, DB-free logic: validation, metadata freshness, parent summary templating, placeholders, legacy-identity short-circuits) + 2 integration tests against real synthetic Supabase data (`composeBlueprint.integration.test.ts`: partial-but-valid Blueprint for a Core-only learner with real attendance records; nonexistent-learner never throws). All 19 pass.
- No duplicated calculations, no direct Attendance/Career/Compass table queries — confirmed by grep (§3).
- **Known test-coverage limitation, stated rather than hidden**: because no real learner in this environment has a bridged `legacyStudentId` (§4's finding), the `available` code path for Academic Record/Learning Compass/Career (as opposed to their `unavailable`-when-null path, which *is* tested) is verified by type-checking and code review only, not exercised end-to-end against real Projection/Compass/Career data in this sprint's test suite. This is a direct, honest consequence of the identity-bridge gap this sprint surfaced, not an oversight.

---

## Stop Condition

Per explicit mission instruction: the Composition Engine, tests, this document, and the implementation-log entry are the complete deliverable. **Stop here.** No Parent Portal, Blueprint UI, PDF, QR generation, University/Employer/Learner/Teacher views, Snapshot storage, Educational Identity intelligence, or Growth Timeline generation begins. Wait for explicit approval before Sprint 12H — Blueprint Presentation Layer.
