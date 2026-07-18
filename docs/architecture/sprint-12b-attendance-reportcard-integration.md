# Sprint 12B — Attendance → Report Card Integration

**Status: Complete.** Report Cards now consume Attendance through the canonical Attendance service; every report surface renders the same, immutable, generation-time snapshot. **Awaiting explicit approval before Sprint 12C.**

**Implements**: ADR-0004's first gated integration, exactly as its own roadmap named it.

---

## Phase 1 — Audit

| Expected finding | What actually exists |
|---|---|
| `school_report_cards.days_present`/`days_absent` | Real columns, present since the table's own original migration — confirmed unchanged. |
| Who writes them | **Nobody, in practice.** `generateReportCards`'s `rows` array never included these two columns before this sprint — they were only reachable via `updateReportCard` (the `action:'update'` branch of `PATCH /api/core/reports`), and grep across the entire `app/` tree found **zero UI callers** of that action with these fields — a fully-built, schema-validated, permission-gated write path with nobody ever calling it (confirmed again this sprint, matching Sprint 11A's original finding — nothing had changed in the interim). |
| Who reads them | Exactly one renderer: `app/(parent)/report-card/page.tsx:144-147`, which already handles `null` gracefully (`report.days_present ?? '—'`) — always showed `— present / — absent` in practice, since nothing populated the columns. |
| Report generation | `generateReportCards` (`lib/core/report-cards.ts`) computes `overall_score`/`overall_cbc_level`/`position_in_class` fresh every call and upserts; never touched attendance fields. |
| Report publication | `publishReportCards` only flips `is_published`/`published_at` — never touched, and still doesn't touch, any content field (score, level, position, or now attendance). |
| Parent report rendering | Exists (`app/(parent)/report-card/page.tsx`), displays `days_present`/`days_absent` as-is — required **zero code change**, since it was always going to render whatever the columns contained. |
| Teacher report rendering | **Does not exist as a distinct surface.** The only teacher-facing report-card-adjacent page (`app/teacher/core-term/page.tsx`) is a workflow/action page (lock → compute → generate → publish buttons, a class-wide count of generated/published cards) — it never renders a single learner's report content, so there was nothing to wire attendance into on the teacher side beyond the generation action itself. |
| PDF generation / Printed report | **Do not exist for Core report cards at all.** `updatePdfUrl` (`lib/core/report-cards.ts`) has zero callers anywhere in the codebase — confirmed by grep. Every other `pdf_url` reference in the app belongs to a completely separate legacy "Academic Clinic" reports system (a different table entirely), not `school_report_cards`. Nothing exists here to integrate attendance into. |
| Duplicate truth | **None found**, before or after this sprint — `days_present`/`days_absent` had exactly one (unreachable) write path and one reader; no second copy of "attendance for a report" existed anywhere (no cache, no other table, no client-side computation). |

**Consequence for scope**: two of the six expected surfaces (Teacher report rendering as a distinct viewer, PDF/Print) don't exist in this codebase at all. Building them would be new Report Card feature surface far beyond "integrate attendance into report cards" — explicitly out of this sprint's "nothing else" scope. This sprint wires the two real, reachable surfaces (generation, parent rendering) and states plainly that the other two have nothing to wire into yet.

---

## Phase 2 — Canonical Read Path (as built)

```
Attendance Service (lib/core/attendance.ts)
  getAttendanceStatusCountsForClass(actorUserId, schoolId, classId, termId)
        ↓  one bulk call, computed fresh, never stored
Report Cards Service (lib/core/report-cards.ts)
  toReportCardAttendance() — Report Cards' own present/absent interpretation
        ↓  included in the upsert row, once, at generation time
school_report_cards.days_present / days_absent
  (an immutable snapshot from this point on — see Phase 6)
        ↓
Rendered Report Card (app/(parent)/report-card/page.tsx — unchanged, reads the column as-is)
```

This is the mission's own required shape, built exactly as specified — never the forbidden `Attendance → days_present → Report Card` shortcut through a second computation living outside Attendance's or Report Cards' own service layer.

---

## Sequence Diagram

```
Admin (school_admin/headteacher/deputy)
   │  POST /api/core/reports  { action: (generate) }
   ▼
app/api/core/reports/route.ts
   │  requireSchoolAdmin(schoolId)  → generatedByUserId
   ▼
generateReportCards(generatedByUserId, schoolId, classId, termId, gradeBoundaries)
   │
   │  (existing, unmodified) publish guard, enrollments, term summaries, ranking
   │
   ├──▶ getAttendanceStatusCountsForClass(generatedByUserId, schoolId, classId, termId)
   │        │
   │        │  assertClassAccess (admin, or class's own teacher — shared with
   │        │  listAttendanceSessionsForClass, not re-derived)
   │        ▼
   │    repos.attendance.listSessionsForClass(classId, schoolId)   [existing]
   │    repos.attendance.listRecordsForSessions(sessionIds)        [new, Sprint 12B — bulk, avoids N+1]
   │        │
   │        ▼
   │    { learnerId: { present, absent, late, excused } }  — raw counts, computed fresh
   │
   ├──▶ toReportCardAttendance(counts[learnerId])  — Report Cards' own present/absent mapping
   │        present + late  → days_present
   │        absent + excused → days_absent
   │        no data at all  → null / null  (never a fabricated 0)
   │
   ▼
repos.schools.upsertReportCards(rows)   — days_present/days_absent now included every time
   │
   ▼
school_report_cards  (draft, is_published = false)
   │
   │  (existing, unmodified) publishReportCards() — flips is_published/published_at only
   ▼
Published report — days_present/days_absent already fixed from generation time, untouched by publish
   │
   ▼
app/(parent)/report-card/page.tsx  — renders the stored value, unchanged code
```

---

## Historical Semantics Decision (Phase 6)

**Decision: computed once, at generation time, stored as an immutable snapshot — never recomputed on view.**

This was not a fresh architectural choice invented for this sprint — it is the **existing, already-established precedent** for every other computed field on `school_report_cards`:

- `overall_score`, `overall_cbc_level`, `position_in_class`, `total_learners` are all computed once inside `generateReportCards` and stored. Viewing a report card (parent or otherwise) has never recomputed these — it reads the stored value, full stop, whether the card is a draft or published.
- Regeneration (permitted only while a card is still a draft — the existing publish guard refuses to regenerate anything already published) recomputes and overwrites these fields fresh each time, same as it always has.

Attendance follows this exact precedent, not a new one: `days_present`/`days_absent` are computed fresh **every time `generateReportCards` runs** (so a draft regenerated the next day reflects that day's Attendance data), and become fixed the moment the card is published, exactly like every sibling field. A published report card is a historical record — re-opening it six months later shows the attendance figures as they stood at generation time, not a live recalculation. This is what "publication snapshot" already meant on this table before Attendance existed; this sprint did not invent an inconsistency, it matched one.

**One resulting, explicitly-accepted trade-off**: the pre-existing manual-edit path (`updateReportCard`'s `days_present`/`days_absent` fields, still reachable via `PATCH /api/core/reports` `action:'update'`) remains available as a human override after generation — but if the card is a draft and gets regenerated again, the fresh computation overwrites that manual edit, exactly as regeneration already overwrites `overall_score`/`overall_cbc_level`/`position_in_class` (fields that were never protected from regeneration either). Only `class_teacher_comment`/`headteacher_comment` are protected from regeneration-overwrite (they were never included in `generateReportCards`'s upsert payload) — attendance was deliberately **not** given that same protection, since this sprint treats it as a computed field, not a manually-entered one, matching score/level/position rather than comments.

---

## Phase 3 — Service Integration

One new Attendance-owned function, added because the audit proved nothing existing covered a bulk, per-learner, per-class status breakdown:

```ts
// lib/core/attendance.ts
export async function getAttendanceStatusCountsForClass(
  actorUserId: string, schoolId: string, classId: string, termId: string,
): Promise<Record<string, AttendanceStatusCounts>>
```

- Reuses `getClass`, `isSchoolAdmin`, `getSchoolUser` exactly as `listAttendanceSessionsForClass` already does — the shared check was extracted into a small private helper (`assertClassAccess`) so this function doesn't re-inline a third copy of the same six lines.
- Reuses the existing `listSessionsForClass` repository method unchanged.
- Required exactly **one** new repository method: `listRecordsForSessions(sessionIds: string[])` — a bulk, `IN (...)`-scoped read, added specifically to avoid looping the existing single-session `listRecordsForSession` once per session (ADR-0004 §6 rule 6's anticipated risk, now avoided in practice, not just in principle).
- Computed fresh on every call. No summary table, no cache, no new column on any Attendance table.
- Report Cards never queries `AttendanceRepository` directly — `lib/core/report-cards.ts` imports only `getAttendanceStatusCountsForClass` from `lib/core/attendance.ts`.

`generateReportCards`'s signature gained one new leading parameter, `actorUserId: string` — required because every Attendance read needs an authorized actor (ADR-0003/ADR-0004), and Report Cards has no legitimate way to manufacture one; it must be the same admin already verified by the calling route. This threaded through two callers: `app/api/core/reports/route.ts` (the `generate` action, already calls `requireSchoolAdmin` — its returned `userId` is passed straight through) and `lib/core/endOfTerm.ts`'s `runEndOfTerm` (gained an `actorUserId` field on `EndOfTermInput`, threaded from `app/api/core/school/end-of-term/route.ts`'s own `requireSchoolAdmin` call).

---

## Phase 4 — Report Generation

`generateReportCards` now calls `getAttendanceStatusCountsForClass` once per generation run (not once per learner — one bulk call covers the whole class), then maps each learner's raw counts through `toReportCardAttendance()` (Report Cards' own function, living in `lib/core/report-cards.ts`, not Attendance) before including the result in the same `rows` array already being upserted. No duplicated query, no duplicated calculation — the counting happens exactly once, inside Attendance; the present/absent interpretation happens exactly once, inside Report Cards.

---

## Phase 5 — Report Rendering

| Surface | Change |
|---|---|
| Parent report view | **Zero code change** — already rendered `days_present ?? '—'`/`days_absent ?? '—'`; now receives real numbers (or a real `null`) instead of always-null. |
| Teacher report view | Does not exist as a distinct viewer (Phase 1) — nothing to change. |
| PDF generation | Does not exist for Core report cards (Phase 1) — nothing to change. |
| Printed report | Same as PDF — no such surface exists. |

Every surface that *does* exist renders the exact same stored value — there was never a second computation to reconcile, since only one reader (`getReportCard`/`listClassReportCards`) has ever existed for this table's content.

---

## Ownership Proof

- **Attendance owns Attendance**: `attendance_sessions`/`attendance_records` were not written to anywhere in this sprint's code — grep-confirmed zero `INSERT`/`UPDATE`/`DELETE` against either table outside `lib/repositories/attendance.repository.ts`, which itself was touched only to add one new **read** method (`listRecordsForSessions`).
- **Report Cards never writes Attendance**: confirmed by the same grep — `lib/core/report-cards.ts` only ever *calls* `getAttendanceStatusCountsForClass` (a read), never anything from `AttendanceRepository`.
- **Report Cards never summarizes attendance into another table**: `days_present`/`days_absent` are Report Cards' *own* columns, on Report Cards' *own* table, computed by Report Cards' own code — not a new table, not a cache, not a second copy of Attendance's truth. Attendance's own tables remain the only place a raw attendance fact is stored.
- **Report Cards computes attendance only when generating**: `toReportCardAttendance()` is called exactly once, inside `generateReportCards` — never inside a read/render path (`getReportCard`/`listClassReportCards` do no computation at all; they return whatever was stored).

---

## Regression Verification

All against real (synthetic, cleaned-up) data via `npx tsx --env-file=.env.local --test`, re-run after the fixes below, all green:

| Test file | Result |
|---|---|
| `lib/core/attendanceReportCardIntegration.test.ts` (**new this sprint**) | ✔ — proves `days_present=2` (present+late), `days_absent=2` (absent+excused) for a learner with 4 real attendance records across 4 sessions, and `null`/`null` for an enrolled learner with zero sessions (never a fabricated `0`). |
| `lib/core/reportCardOwnership.security.test.ts` | ✔ all 11 (cross-school exploit-blocking, ownership checks — all pre-existing, unaffected). |
| `lib/core/reportCardPublicationGuard.integration.test.ts` | ✔ all 5 (publish-guard integrity — unaffected). |
| `lib/core/granularEndOfTermFlow.test.ts` | ✔ (lock→compute→generate→publish, step by step). |
| `lib/core/endOfTermFullChain.test.ts` | ✔ (the full assessment→report→publish→re-run journey). |

**A real, blocking gap was found and fixed mid-sprint**: the Attendance schema migration (`20260717_attendance_domain_schema.sql`, written in Sprint 11B) had never been applied to the real Supabase project — every prior Attendance sprint verified logic against an isolated disposable Postgres container specifically to avoid touching real infrastructure without explicit approval. The moment Report Cards started calling the Attendance service at runtime, `endOfTermFullChain.test.ts` and `granularEndOfTermFlow.test.ts` failed with `Could not find the table 'public.attendance_sessions'` — a genuine production gap this sprint's own work exposed, not a test artifact. **Asked the user explicitly**; approved; applied the migration to the real project via `mcp__supabase__apply_migration`, verified via `mcp__supabase__list_tables` (both tables now present, RLS enabled, 0 rows) and `mcp__supabase__get_advisors` (zero new security advisories — every advisory returned pre-dates this migration). Re-ran both previously-failing tests; both now pass. This means **Sprint 12B is also the sprint that made Attendance actually reachable in production** — a necessary, disclosed, approved side effect of being the first real consumer.

Three existing test fixtures needed a one-line addition each (`repos.schools.addSchoolUser(schoolId, authUserId, 'school_admin')`) because they had never needed a real admin membership row before — `generateReportCards` now requires one (to pass Attendance's own ownership check), exactly matching what the real `/api/core/reports` route already requires in production. Not a workaround: this brought the test fixtures in line with a real-world precondition they had previously been able to skip only because `generateReportCards` had no authorization dependency of its own before this sprint.

`tsc --noEmit`: clean across the whole project. `eslint`: clean, zero warnings, on every touched file.

---

## ADR Compliance

- **ADR-0003** §4 (computed-on-read Summary) — `getAttendanceStatusCountsForClass` computes fresh every call; §13 (Attendance consumes nothing) — confirmed unchanged, Attendance still imports nothing from Report Cards.
- **ADR-0004** §1 (Attendance owns Attendance) — no write path opened; §2 (read direction, service-only) — Report Cards calls only `lib/core/attendance.ts`'s exports; §4 (derived data policy) — Report Cards computes its own present/absent mapping, Attendance never decides it; §5 (no stored summary) — `days_present`/`days_absent` are Report Cards' pre-existing columns being *populated*, not a new summary artifact; §6 rule 6 (bulk read for a performance concern) — `listRecordsForSessions` added exactly as anticipated, not a per-learner loop.
- **Repository Architecture Standard** — one new repository method, persistence-only, no business logic; Report Cards never imports `AttendanceRepository`.

---

## Future Extension Points

- **Manual-override protection**: if a future sprint decides `days_present`/`days_absent` manual edits should survive regeneration (like comments do), that's a `generateReportCards` upsert-payload change — a small, separately-scoped decision, not made here.
- **Session-locking interaction**: if Attendance ever gains a "locked session" concept (an open item since Sprint 11H), report generation could, in a future sprint, choose to only count locked sessions — not decided or assumed here.
- **`getAttendanceStatusCountsForClass` reuse**: this function is generic enough that Sprint 12C (Parent Portal) or 12D (Evidence/Intelligence) could call it too, without needing a new Attendance function — flagged for whoever picks up those sprints, not committed to here.
