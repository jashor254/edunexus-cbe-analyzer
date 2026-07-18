// lib/core/schoolActivation.ts
//
// Sprint 9B — the orchestration layer docs/architecture/
// sprint-9a-phase2-school-activation-audit.md found missing: a school
// created via createSchool() (lib/core/school.ts) gets exactly two rows
// (schools, one school_users) and nothing else — every downstream object
// (academic year, terms, streams, classes, settings) required a separate,
// manually-triggered call with no orchestrating function anywhere.
//
// This module composes the *existing* lib/core/school.ts and
// lib/core/classes.ts functions into one deterministic pipeline. It
// introduces no new business logic those modules don't already own, no new
// repository query beyond one additive existence-check method
// (SchoolRepository.findSettingsOrNull), and no schema change.
//
// Scope boundary, deliberate (per the sprint's own instruction): activation
// stops at "school ready for teachers" — Academic Year → Terms → Grades
// (resolved, not created — see below) → Streams → Classes → Settings. It
// never creates a learner, an assessment, a report, or touches Evidence/
// Projection. It also does not fix the class_assessments.class_id →
// teacher_classes FK mismatch (docs/architecture/sprint-9a-phase2-
// school-activation-audit.md §3.1) — that is explicitly out of scope here.
//
// Idempotency strategy: every step checks for an existing row before
// inserting. academic_years/terms/streams/school_settings all have a live
// DB UNIQUE constraint the existence check mirrors; `classes` has no
// UNIQUE constraint at all (confirmed live), so its existence check is the
// *only* thing preventing duplicate classes — this is intentional, not an
// oversight (adding one would be a schema change, out of scope this
// sprint).
//
// Failure behavour: steps run in dependency order and the pipeline stops
// at the first failing step. There is no cross-table transaction (the
// Supabase JS client doesn't span one across these tables without an RPC,
// which would itself be a schema-adjacent change out of scope). Recovery
// is via idempotent retry, not rollback: calling activateSchool() again
// after a partial failure skips every already-created object and resumes
// at the failed step — this is what "avoid partial activation where
// practical" means in a system without multi-table transactions.

import {
  getSchool,
  listAcademicYears,
  createAcademicYear,
  listTerms,
  createTerm,
  getSchoolSettingsOrNull,
  upsertSchoolSettings,
} from '@/lib/core/school'
import {
  listGrades,
  listStreams,
  createStream,
  listClasses,
  createClass,
} from '@/lib/core/classes'
import type { School, AcademicYear, Term, Grade, Stream, ClassWithDetails } from '@/types/core'

// ── Input shape ─────────────────────────────────────────────────────────────

export type SchoolActivationInput = {
  /** Defaults to a Jan 1 – Dec 31 year matching the current calendar year. */
  academicYear?: { name: string; start_date: string; end_date: string }
  /**
   * Explicit override for which global Grade codes (e.g. ['G7','G8','G9'])
   * this school sets up classes for. If omitted, resolved from the
   * school's school_type — see resolveDefaultGradeCategories(). Required
   * (no default) for a school_type this resolver can't confidently map,
   * including the DB's 'special' value — guessing an age range for a
   * special-needs school is exactly the kind of silent assumption this
   * platform's architecture rules exist to prevent.
   */
  gradeCodes?: string[]
  /**
   * Stream names to create (e.g. ['East','West']). Omit entirely for a
   * single-stream school — Core's `classes.stream_id` is nullable, so
   * "no streams" is a fully valid, first-class shape, not a degraded one.
   */
  streamNames?: string[]
}

// ── Result shape ────────────────────────────────────────────────────────────

export type ActivationStepName =
  | 'academic_year'
  | 'terms'
  | 'grades'
  | 'streams'
  | 'classes'
  | 'school_settings'

export type ActivationStepStatus = 'created' | 'already_exists' | 'skipped' | 'failed'

export type ActivationStepResult = {
  step: ActivationStepName
  status: ActivationStepStatus
  detail: string
  /** Number of objects created or found by this step, where applicable. */
  count?: number
}

export type ActivationResult = {
  schoolId: string
  status: 'complete' | 'failed'
  steps: ActivationStepResult[]
  failedStep?: ActivationStepName
  error?: string
}

// ── Grade default resolution (pure — no DB write) ──────────────────────────

// Maps a school's school_type to the Grade categories (already-defined in
// the `grades` table's own CHECK constraint, see supabase/migrations/
// 20260629_core_foundation.sql + 20260707_senior_secondary_grades.sql) it
// serves by default. This is a config default, not a curriculum rule this
// module invents: every category referenced here already exists as a real,
// seeded `grades.category` value.
//
// Defensive against a discovered, out-of-scope schema/type drift
// (documented in docs/engineering/implementation-log.md's Sprint 9B
// entry): the live `schools_school_type_check` constraint only allows
// 'primary' | 'secondary' | 'mixed' | 'special', but types/core.ts's
// SchoolType and the CreateSchoolSchema Zod validator both use a different
// set ('public_primary', etc.) that would fail that constraint if ever
// inserted. This map covers both sets so it keeps working regardless of
// which side of that mismatch eventually gets fixed, and any other value —
// including 'special', where guessing is unsafe — falls through to
// "no default, caller must pass gradeCodes explicitly."
const SCHOOL_TYPE_GRADE_CATEGORIES: Record<string, string[]> = {
  primary:                ['pre_primary', 'lower_primary', 'upper_primary'],
  public_primary:         ['pre_primary', 'lower_primary', 'upper_primary'],
  private_primary:        ['pre_primary', 'lower_primary', 'upper_primary'],
  secondary:              ['junior_secondary', 'senior_secondary'],
  mixed:                  ['pre_primary', 'lower_primary', 'upper_primary', 'junior_secondary', 'senior_secondary'],
  public_comprehensive:   ['pre_primary', 'lower_primary', 'upper_primary', 'junior_secondary', 'senior_secondary'],
  private_comprehensive:  ['pre_primary', 'lower_primary', 'upper_primary', 'junior_secondary', 'senior_secondary'],
}

/**
 * Resolves which Grade rows (from the global catalogue) this school's
 * activation should create classes for. Pure function over an already-
 * fetched Grade list — makes no DB call of its own, independently
 * testable without a database.
 *
 * Throws if no gradeCodes override is given and the school's school_type
 * has no known default — this is intentional: an unrecognized or 'special'
 * school_type should block activation with a clear message, not silently
 * guess an institutional structure.
 */
export function resolveDefaultGrades(
  allGrades: Grade[],
  schoolType: string | null | undefined,
  gradeCodesOverride?: string[]
): Grade[] {
  if (gradeCodesOverride && gradeCodesOverride.length > 0) {
    const byCode = new Map(allGrades.map(g => [g.code, g]))
    const resolved = gradeCodesOverride.map(code => {
      const grade = byCode.get(code)
      if (!grade) throw new Error(`resolveDefaultGrades: unknown grade code "${code}"`)
      return grade
    })
    return resolved
  }

  const categories = schoolType ? SCHOOL_TYPE_GRADE_CATEGORIES[schoolType] : undefined
  if (!categories) {
    throw new Error(
      `resolveDefaultGrades: no default grade range known for school_type "${schoolType ?? 'null'}" — pass gradeCodes explicitly in SchoolActivationInput.`
    )
  }
  return allGrades.filter(g => categories.includes(g.category))
}

// ── Term defaults (pure — no DB write) ──────────────────────────────────────

/** Splits an academic year's date range into 3 equal-ish terms (1/2/3). */
export function resolveDefaultTermDates(
  academicYearStart: string,
  academicYearEnd: string
): Array<{ term_number: 1 | 2 | 3; start_date: string; end_date: string }> {
  const start = new Date(academicYearStart)
  const end = new Date(academicYearEnd)
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  const dayFor = (offset: number) => {
    const d = new Date(start)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const third = Math.floor(totalDays / 3)
  return [
    { term_number: 1, start_date: dayFor(0),           end_date: dayFor(third) },
    { term_number: 2, start_date: dayFor(third + 1),    end_date: dayFor(third * 2) },
    { term_number: 3, start_date: dayFor(third * 2 + 1), end_date: dayFor(totalDays) },
  ]
}

function defaultAcademicYearInput(): { name: string; start_date: string; end_date: string } {
  const year = new Date().getFullYear()
  return { name: String(year), start_date: `${year}-01-01`, end_date: `${year}-12-31` }
}

// ── Individual, independently-testable pipeline steps ───────────────────────
//
// Each step function takes only what it needs and returns an
// ActivationStepResult plus whatever the next step needs — no step reaches
// past its own repository/service boundary, and none duplicates a query
// another step already made.

export async function ensureAcademicYear(
  schoolId: string,
  input?: SchoolActivationInput['academicYear']
): Promise<{ result: ActivationStepResult; academicYear: AcademicYear }> {
  const desired = input ?? defaultAcademicYearInput()
  const existing = (await listAcademicYears(schoolId)).find(y => y.name === desired.name)
  if (existing) {
    return {
      academicYear: existing,
      result: { step: 'academic_year', status: 'already_exists', detail: `Academic year "${existing.name}" already exists.`, count: 1 },
    }
  }
  const created = await createAcademicYear(schoolId, desired)
  return {
    academicYear: created,
    result: { step: 'academic_year', status: 'created', detail: `Created academic year "${created.name}".`, count: 1 },
  }
}

export async function ensureDefaultTerms(
  schoolId: string,
  academicYear: AcademicYear
): Promise<{ result: ActivationStepResult; terms: Term[] }> {
  const existing = await listTerms(schoolId, academicYear.id)
  const existingByNumber = new Map(existing.map(t => [t.term_number, t]))
  const defaults = resolveDefaultTermDates(academicYear.start_date, academicYear.end_date)

  const terms: Term[] = []
  let createdCount = 0
  for (const def of defaults) {
    const already = existingByNumber.get(def.term_number)
    if (already) {
      terms.push(already)
      continue
    }
    const created = await createTerm(schoolId, {
      academic_year_id: academicYear.id,
      term_number: def.term_number,
      name: `Term ${def.term_number} ${academicYear.name}`,
      start_date: def.start_date,
      end_date: def.end_date,
    })
    terms.push(created)
    createdCount += 1
  }

  const status: ActivationStepStatus = createdCount === 0 ? 'already_exists' : 'created'
  return {
    terms,
    result: {
      step: 'terms',
      status,
      detail: createdCount === 0
        ? `All ${terms.length} terms already existed.`
        : `Created ${createdCount} of ${terms.length} terms (rest already existed).`,
      count: terms.length,
    },
  }
}

export async function ensureDefaultGrades(
  schoolType: School['school_type'] | string | null | undefined,
  gradeCodesOverride?: string[]
): Promise<{ result: ActivationStepResult; grades: Grade[] }> {
  const allGrades = await listGrades()
  const grades = resolveDefaultGrades(allGrades, schoolType, gradeCodesOverride)
  return {
    grades,
    result: {
      step: 'grades',
      // Grade is global reference data (RAS §3: Subject/Grade are shared
      // catalogue, not School-owned) — this step never writes a row, it
      // only resolves which already-seeded grades apply to this school.
      status: 'skipped',
      detail: `Resolved ${grades.length} grade(s) from the global catalogue (no write — Grade is shared reference data).`,
      count: grades.length,
    },
  }
}

export async function ensureStreams(
  schoolId: string,
  streamNames?: string[]
): Promise<{ result: ActivationStepResult; streams: Stream[] }> {
  if (!streamNames || streamNames.length === 0) {
    return {
      streams: [],
      result: { step: 'streams', status: 'skipped', detail: 'No streams requested — single-stream school.', count: 0 },
    }
  }

  const existing = await listStreams(schoolId)
  const existingByName = new Map(existing.map(s => [s.name, s]))
  const streams: Stream[] = []
  let createdCount = 0
  for (const name of streamNames) {
    const already = existingByName.get(name)
    if (already) {
      streams.push(already)
      continue
    }
    const created = await createStream(schoolId, name)
    streams.push(created)
    createdCount += 1
  }

  const status: ActivationStepStatus = createdCount === 0 ? 'already_exists' : 'created'
  return {
    streams,
    result: {
      step: 'streams',
      status,
      detail: createdCount === 0
        ? `All ${streams.length} streams already existed.`
        : `Created ${createdCount} of ${streams.length} streams (rest already existed).`,
      count: streams.length,
    },
  }
}

export async function ensureClasses(
  schoolId: string,
  academicYear: AcademicYear,
  grades: Grade[],
  streams: Stream[]
): Promise<{ result: ActivationStepResult; classes: ClassWithDetails[] }> {
  const existing = await listClasses(schoolId, academicYear.id)
  const key = (gradeId: string, streamId: string | null) => `${gradeId}:${streamId ?? 'none'}`
  const existingByKey = new Map(existing.map(c => [key(c.grade_id ?? '', c.stream_id), c]))

  // One class per grade if no streams were set up; one class per
  // grade × stream otherwise — matches the reference-school precedent
  // (scripts/reference-school/02-seed-academics.ts: 3 grades × 3 streams).
  const combinations: Array<{ grade: Grade; stream: Stream | null }> =
    streams.length === 0
      ? grades.map(grade => ({ grade, stream: null }))
      : grades.flatMap(grade => streams.map(stream => ({ grade, stream })))

  const classes: ClassWithDetails[] = []
  let createdCount = 0
  for (const { grade, stream } of combinations) {
    const already = existingByKey.get(key(grade.id, stream?.id ?? null))
    if (already) {
      classes.push(already)
      continue
    }
    const displayName = stream ? `${grade.name} ${stream.name}` : grade.name
    const created = await createClass(schoolId, {
      grade_id: grade.id,
      stream_id: stream?.id,
      academic_year_id: academicYear.id,
      display_name: displayName,
    })
    classes.push(created)
    createdCount += 1
  }

  const status: ActivationStepStatus = createdCount === 0 ? 'already_exists' : 'created'
  return {
    classes,
    result: {
      step: 'classes',
      status,
      detail: createdCount === 0
        ? `All ${classes.length} classes already existed.`
        : `Created ${createdCount} of ${classes.length} classes (rest already existed).`,
      count: classes.length,
    },
  }
}

export async function ensureSchoolSettings(schoolId: string): Promise<{ result: ActivationStepResult }> {
  const existing = await getSchoolSettingsOrNull(schoolId)
  if (existing) {
    return { result: { step: 'school_settings', status: 'already_exists', detail: 'School settings already exist — left untouched.', count: 1 } }
  }
  // Deliberately no field overrides here — the table's own DB defaults
  // (curriculum_type='cbc', grade_boundaries=75/50/25, etc., per
  // supabase/migrations/20260629_core_foundation.sql:112-129) are exactly
  // what upsertSchoolSettings' own callers already treat as the safe
  // fallback (lib/core/school.ts:99-111's resolveTeacherGradeBoundaries
  // comment). Activation materializes the row; it does not invent new
  // defaults the schema doesn't already own.
  await upsertSchoolSettings(schoolId, {})
  return { result: { step: 'school_settings', status: 'created', detail: 'Created school settings with schema defaults.', count: 1 } }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Runs the full activation pipeline for an existing school:
 *   Academic Year → Terms → Grades (resolved) → Streams → Classes → Settings
 *
 * Every step is idempotent — safe to call repeatedly, including after a
 * partial failure (see module header for the rollback/retry rationale).
 * Stops at the first failing step; later steps are never attempted once one
 * fails, and the returned report says exactly which step failed and why.
 */
export async function activateSchool(
  schoolId: string,
  input: SchoolActivationInput = {}
): Promise<ActivationResult> {
  const steps: ActivationStepResult[] = []

  let school: School
  try {
    school = await getSchool(schoolId)
  } catch (err) {
    return {
      schoolId,
      status: 'failed',
      steps,
      error: `activateSchool: school ${schoolId} not found — ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  try {
    const { result: yearResult, academicYear } = await ensureAcademicYear(schoolId, input.academicYear)
    steps.push(yearResult)

    const { result: termsResult, terms: _terms } = await ensureDefaultTerms(schoolId, academicYear)
    steps.push(termsResult)
    void _terms // terms aren't needed by any later step in this pipeline; kept for report symmetry only

    const { result: gradesResult, grades } = await ensureDefaultGrades(school.school_type, input.gradeCodes)
    steps.push(gradesResult)

    const { result: streamsResult, streams } = await ensureStreams(schoolId, input.streamNames)
    steps.push(streamsResult)

    const { result: classesResult } = await ensureClasses(schoolId, academicYear, grades, streams)
    steps.push(classesResult)

    const { result: settingsResult } = await ensureSchoolSettings(schoolId)
    steps.push(settingsResult)

    return { schoolId, status: 'complete', steps }
  } catch (err) {
    const failedStep = steps.length < 6
      ? (['academic_year', 'terms', 'grades', 'streams', 'classes', 'school_settings'] as const)[steps.length]
      : undefined
    const message = err instanceof Error ? err.message : String(err)
    if (failedStep) {
      steps.push({ step: failedStep, status: 'failed', detail: message })
    }
    return { schoolId, status: 'failed', steps, failedStep, error: message }
  }
}

// ── Status (derived, not persisted — see Sprint 9B implementation log) ──────

export type SchoolActivationStatus = 'CREATED' | 'INITIALIZED' | 'ACTIVE'

/**
 * No activation-state column exists on `schools` (confirmed live — only
 * `is_active: boolean`, an enabled/disabled flag, not a lifecycle stage).
 * Per this sprint's explicit "do not invent schema changes" instruction,
 * status is computed on demand from existing rows rather than persisted:
 *
 *   CREATED     — school exists, no academic year yet.
 *   INITIALIZED — academic year + terms exist, no classes yet.
 *   ACTIVE      — at least one class exists.
 *
 * This is intentionally cheap (three small reads) and safe to call as
 * often as needed; it is not a substitute for a persisted status column if
 * a future sprint needs to filter/index schools by activation state at
 * scale — see the implementation log's "Known limitations" for when that
 * would warrant revisiting (schema-additive only, no ADR needed per RAS
 * §12 — it wouldn't change School's canonical identity).
 */
export async function getSchoolActivationStatus(schoolId: string): Promise<SchoolActivationStatus> {
  const years = await listAcademicYears(schoolId)
  if (years.length === 0) return 'CREATED'

  const currentOrFirst = years.find(y => y.is_current) ?? years[0]
  const [terms, classes] = await Promise.all([
    listTerms(schoolId, currentOrFirst.id),
    listClasses(schoolId, currentOrFirst.id),
  ])

  if (classes.length > 0) return 'ACTIVE'
  if (terms.length > 0) return 'INITIALIZED'
  return 'INITIALIZED' // year exists without terms is still past "just created"
}
