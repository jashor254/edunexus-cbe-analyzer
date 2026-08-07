// lib/row/recordOfWork.ts
//
// Phase 1 — the single canonical writer for the Record of Work domain.
//
// Before this module there were two competing writers with four
// incompatible behaviours (docs/architecture/adr-0032-teaching-document-
// identity-contract.md §3): the interactive route wrote `teachers.id` and
// seeded from `scheme_lessons` with a plain INSERT; the Monday cron wrote
// `lesson_plans.teacher_id` (an auth-user id) and seeded from `lesson_plans`
// with an UPSERT. They could overwrite each other's owner and collide on
// `records_of_work_scheme_id_key`. Both routes now call this module instead.
//
// ── The two rules this module exists to enforce ─────────────────────────────
//
// 1. OWNERSHIP IS DERIVED, NEVER COPIED. When a scheme is involved, the
//    Record of Work's owner is read from `schemes_of_work.teacher_id` — the
//    canonical `teachers.id` — rather than passed in by the caller. That
//    makes it structurally impossible for a caller holding an auth-user id
//    to write it into `records_of_work.teacher_id`, which is exactly the
//    defect Phase 0 found in production. See ADR-0032 for the namespace map.
//
// 2. TEACHER-AUTHORED EVIDENCE IS NEVER MACHINE-WRITTEN. A Record of Work is
//    the teacher's record of *actual teaching*, not a second copy of the
//    plan. Automation may create and maintain structural/planning metadata;
//    it may never touch the fields the teacher authored. The mechanism is
//    deliberately structural rather than conditional: TEACHER_OWNED_ENTRY_
//    FIELDS are absent from the upsert payload entirely, so PostgREST's
//    ON CONFLICT DO UPDATE cannot name them. A conditional guard could be
//    forgotten at one call site; an absent column cannot be.
//
// ── Phase 2: evidence convergence (ADR-0032 §11) ────────────────────────────
//
// A Lesson Plan records what the teacher intends to teach and, after
// teaching, what they noted about that lesson. A Record of Work is the
// persistent professional record of what was actually taught. So Lesson Plan
// evidence may *initialise* a Record of Work entry — but the moment the
// Record of Work holds a teacher value, that value is authoritative:
//
//     lesson_plans.taught_date             ──fill-if-empty──▶ row_entries.date_taught
//     lesson_plans.teacher_self_evaluation ──fill-if-empty──▶ row_entries.reflection
//     (no mapping)                                            row_entries.remarks
//
//     EXISTING ROW VALUE  >  LESSON PLAN VALUE, always and permanently.
//
// Rule 2 above is NOT relaxed to achieve this. Convergence is a separate,
// guarded UPDATE pass (`convergeTeacherEvidence`) that runs after the machine
// upsert — it never adds a teacher-owned column to the upsert payload. Each
// UPDATE carries an optimistic guard on the exact value that was read, so a
// concurrent teacher edit wins the race rather than being clobbered.

import { createServiceClient } from '@/utils/supabase/service'

/**
 * Fields a teacher authors by hand in the Record of Work. No automated
 * process may ever include these in a write payload. Enforced by omission
 * (see the module header) and asserted by
 * lib/row/recordOfWorkIntegrity.integration.test.ts Test E.
 */
export const TEACHER_OWNED_ENTRY_FIELDS = ['date_taught', 'reflection', 'remarks'] as const

/**
 * Structural/planning metadata derived from the teaching documents.
 * Automation owns these and may refresh them on every synchronisation.
 */
export const MACHINE_OWNED_ENTRY_FIELDS = [
  'strand', 'substrand', 'learning_outcomes',
  'key_inquiry_questions', 'learning_resources', 'activities_summary', 'status',
] as const

/**
 * The only two Lesson Plan → Record of Work mappings authorised by Phase 2.
 * `remarks` is deliberately absent: it is teacher-owned and has no Lesson
 * Plan counterpart, so convergence must never touch it.
 */
export const CONVERGED_ENTRY_FIELDS = ['date_taught', 'reflection'] as const

export type RecordOfWorkEntrySource = 'lesson_plans' | 'scheme_lessons' | 'none'

// ── Empty-value semantics ───────────────────────────────────────────────────
// Derived from the live column definitions, not from JS truthiness, because
// both sides can represent "no value" in more than one way:
//
//   row_entries.date_taught   DATE, nullable, no default        -> empty iff NULL
//   row_entries.reflection    TEXT, nullable, DEFAULT ''        -> empty iff NULL, '' or whitespace
//   lesson_plans.taught_date  DATE, nullable                    -> present iff non-NULL
//   lesson_plans.teacher_self_evaluation TEXT, nullable         -> present iff non-blank

/** A date column is empty only when it is genuinely NULL. '' is not a valid DATE. */
function isEmptyDate(value: string | null | undefined): boolean {
  return value === null || value === undefined
}

/** A text column is empty when NULL, '', or whitespace-only (the '' default). */
function isEmptyText(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === ''
}

export type EnsureRecordOfWorkInput = {
  /** Owning scheme, or null for a manually-created Record of Work. */
  schemeId:       string | null
  /** MUST be `teachers.id`. Ignored when `schemeId` resolves an existing header. */
  teacherId:      string
  school:         string
  grade:          string
  learningArea:   string
  term:           string
  year:           number
  curriculumMode: string | null
  teacherName:    string
}

export type EnsureRecordOfWorkResult = {
  rowId: string
  /** True only when this call performed the INSERT. */
  created: boolean
}

export type SeedRecordOfWorkResult = {
  source:  RecordOfWorkEntrySource
  /** Number of structural entries written or refreshed. */
  seeded:  number
  /** Number of entries whose empty teacher-owned fields were initialised from a Lesson Plan. */
  converged: number
}

export type SyncRecordOfWorkResult = EnsureRecordOfWorkResult & SeedRecordOfWorkResult

type MachineEntry = {
  row_id:                string
  week:                  number
  lesson:                number
  strand:                string
  substrand:             string
  learning_outcomes:     string[]
  key_inquiry_questions: string[]
  learning_resources:    string[]
  activities_summary:    string[]
  status:                string
}

const UPSERT_BATCH = 200

/**
 * `row_entries.*` jsonb columns hold arrays, but `scheme_lessons` stores the
 * same information as free text (a real live divergence, not a modelling
 * choice — see ADR-0032 §5). Normalises either shape to an array so both
 * sources produce identical row shapes.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()]
  return []
}

/**
 * Resolves (or creates) the one Record of Work for a scheme.
 *
 * Get-or-create, never upsert: when a header already exists for `schemeId`
 * it is returned **untouched** — its owner and its header metadata both
 * survive. This is what makes the interactive route and the cron safe to run
 * in either order, and it is why `records_of_work_scheme_id_key` can never
 * surface a raw 23505 to a teacher.
 */
export async function ensureRecordOfWork(input: EnsureRecordOfWorkInput): Promise<EnsureRecordOfWorkResult> {
  const db = createServiceClient()

  if (input.schemeId) {
    const { data: existing, error: lookupErr } = await db
      .from('records_of_work')
      .select('id')
      .eq('scheme_id', input.schemeId)
      .maybeSingle()

    if (lookupErr) throw new Error(`ensureRecordOfWork: lookup failed — ${lookupErr.message}`)
    if (existing) return { rowId: existing.id as string, created: false }
  }

  const { data: inserted, error } = await db
    .from('records_of_work')
    .insert({
      teacher_id:      input.teacherId,
      scheme_id:       input.schemeId,
      school:          input.school,
      grade:           input.grade,
      learning_area:   input.learningArea,
      term:            input.term,
      year:            input.year,
      curriculum_mode: input.curriculumMode,
      teacher_name:    input.teacherName,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    // A concurrent caller may have won the race between the lookup above and
    // this insert. The unique constraint is the arbiter; re-read rather than
    // surfacing a duplicate-key error to a teacher.
    if (input.schemeId) {
      const { data: raced } = await db
        .from('records_of_work').select('id').eq('scheme_id', input.schemeId).maybeSingle()
      if (raced) return { rowId: raced.id as string, created: false }
    }
    throw new Error(`ensureRecordOfWork: insert failed — ${error?.message ?? 'no row returned'}`)
  }

  return { rowId: inserted.id as string, created: true }
}

/**
 * Writes the structural skeleton of a Record of Work: one entry per
 * `(week, lesson)` the scheme actually has.
 *
 * Source selection is deterministic and exists because production contains
 * both shapes (ADR-0032 §5): some schemes have `scheme_lessons` rows, some
 * have only `lesson_plans` (where `/api/sow/save`'s swallowed insert error
 * left `scheme_lessons` empty), and the richer source wins when both exist.
 *
 *   lesson_plans (richer — carries planning metadata)
 *     ↓ if none
 *   scheme_lessons
 *     ↓ if none
 *   no-op — never fabricate an empty document
 *
 * Only MACHINE_OWNED_ENTRY_FIELDS are written. Existing teacher-authored
 * values are untouched because their columns are not in the payload.
 */
export async function seedRecordOfWorkEntries(rowId: string, schemeId: string): Promise<SeedRecordOfWorkResult> {
  const db = createServiceClient()

  const { data: plans, error: planErr } = await db
    .from('lesson_plans')
    .select('week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, step_1, step_2, step_3')
    .eq('sow_id', schemeId)
    .order('week_number')
    .order('lesson_number')

  if (planErr) throw new Error(`seedRecordOfWorkEntries: lesson_plans read failed — ${planErr.message}`)

  let entries: MachineEntry[] = []
  let source: RecordOfWorkEntrySource = 'none'

  if (plans && plans.length > 0) {
    source = 'lesson_plans'
    entries = plans.map(p => ({
      row_id:                rowId,
      week:                  p.week_number as number,
      lesson:                p.lesson_number as number,
      strand:                (p.strand as string | null) ?? '',
      substrand:             (p.sub_strand as string | null) ?? '',
      learning_outcomes:     toStringArray(p.learning_outcomes),
      key_inquiry_questions: toStringArray(p.key_inquiry_questions),
      learning_resources:    toStringArray(p.learning_resources),
      activities_summary:    [p.step_1, p.step_2, p.step_3].filter((s): s is string => typeof s === 'string' && s.length > 0),
      status:                'planned',
    }))
  } else {
    const { data: lessons, error: lessonErr } = await db
      .from('scheme_lessons')
      .select('week, lesson, strand, substrand, learning_outcomes, key_inquiry_questions, learning_resources')
      .eq('scheme_id', schemeId)
      .order('week')
      .order('lesson')

    if (lessonErr) throw new Error(`seedRecordOfWorkEntries: scheme_lessons read failed — ${lessonErr.message}`)

    if (lessons && lessons.length > 0) {
      source = 'scheme_lessons'
      entries = lessons.map(l => ({
        row_id:                rowId,
        week:                  l.week as number,
        lesson:                l.lesson as number,
        strand:                (l.strand as string | null) ?? '',
        substrand:             (l.substrand as string | null) ?? '',
        learning_outcomes:     toStringArray(l.learning_outcomes),
        key_inquiry_questions: toStringArray(l.key_inquiry_questions),
        learning_resources:    toStringArray(l.learning_resources),
        activities_summary:    [],
        status:                'planned',
      }))
    }
  }

  if (entries.length === 0) return { source, seeded: 0, converged: 0 }

  for (let i = 0; i < entries.length; i += UPSERT_BATCH) {
    const { error } = await db
      .from('row_entries')
      .upsert(entries.slice(i, i + UPSERT_BATCH), { onConflict: 'row_id,week,lesson' })

    if (error) throw new Error(`seedRecordOfWorkEntries: upsert failed — ${error.message}`)
  }

  // Phase 2 — a separate, guarded pass. Deliberately NOT folded into the
  // upsert above: keeping the teacher-owned columns out of that payload is
  // Phase 1's structural protection, and it stays intact.
  const converged = await convergeTeacherEvidence(rowId, schemeId)

  return { source, seeded: entries.length, converged }
}

/**
 * Fill-if-empty convergence of Lesson Plan teaching evidence into the
 * Record of Work.
 *
 *   ROW field empty  + LP value present  ->  fill from the Lesson Plan
 *   ROW field present                    ->  preserve exactly, forever
 *   LP value empty                       ->  never erase the ROW value
 *
 * Matching is on the structural key the whole domain already uses:
 * `scheme + week + lesson`.
 *
 * Only `teacher_self_evaluation` is read for the reflection — never
 * `lesson_plans.reflection`, which holds AI-authored guiding questions
 * ("Were learners able to ...?") emitted verbatim by the generator, not a
 * teacher's evaluation. `teacher_self_evaluation` is written only by
 * `submitEvaluation()`, which refuses to run unless the plan is already
 * marked taught, so it is the final teacher-authored value.
 *
 * Each UPDATE carries an optimistic guard on the exact value that was read.
 * If a teacher writes to the entry between the read and the write, the guard
 * no longer matches, the update affects nothing, and the teacher wins.
 *
 * Returns the number of entries actually changed.
 */
export async function convergeTeacherEvidence(rowId: string, schemeId: string): Promise<number> {
  const db = createServiceClient()

  const [{ data: entries, error: entryErr }, { data: plans, error: planErr }] = await Promise.all([
    db.from('row_entries')
      .select('id, week, lesson, date_taught, reflection')
      .eq('row_id', rowId),
    db.from('lesson_plans')
      .select('week_number, lesson_number, taught_date, teacher_self_evaluation')
      .eq('sow_id', schemeId),
  ])

  if (entryErr) throw new Error(`convergeTeacherEvidence: row_entries read failed — ${entryErr.message}`)
  if (planErr)  throw new Error(`convergeTeacherEvidence: lesson_plans read failed — ${planErr.message}`)
  if (!entries?.length || !plans?.length) return 0

  const planByKey = new Map(
    plans.map(p => [`${p.week_number}:${p.lesson_number}`, p]),
  )

  let changed = 0

  for (const entry of entries) {
    const plan = planByKey.get(`${entry.week}:${entry.lesson}`)
    if (!plan) continue

    const rowDate = entry.date_taught as string | null
    const rowRefl = entry.reflection  as string | null
    const lpDate  = plan.taught_date  as string | null
    const lpEval  = plan.teacher_self_evaluation as string | null

    const patch: { date_taught?: string; reflection?: string } = {}
    if (isEmptyDate(rowDate) && !isEmptyDate(lpDate)) patch.date_taught = lpDate as string
    if (isEmptyText(rowRefl) && !isEmptyText(lpEval)) patch.reflection  = (lpEval as string)

    if (Object.keys(patch).length === 0) continue

    // Optimistic guard: re-assert the emptiness we observed, per column.
    let query = db.from('row_entries').update(patch).eq('id', entry.id)
    if (patch.date_taught !== undefined) query = query.is('date_taught', null)
    if (patch.reflection  !== undefined) {
      query = rowRefl === null
        ? query.is('reflection', null)
        : query.eq('reflection', rowRefl)
    }

    const { data: updated, error } = await query.select('id')
    if (error) throw new Error(`convergeTeacherEvidence: update failed — ${error.message}`)
    if (updated && updated.length > 0) changed += 1
  }

  return changed
}

// ── Canonical read model (Phase 3) ──────────────────────────────────────────

export type RecordOfWorkEntry = {
  week:               number
  lesson:             number
  date_taught:        string | null
  strand:             string
  substrand:          string
  activities_summary: string[]
  reflection:         string
  remarks:            string
  learning_outcomes:  string[]
}

export type StoredRecordOfWork = {
  rowId:          string
  schemeId:       string | null
  school:         string
  grade:          string
  learningArea:   string
  term:           string
  year:           number
  curriculumMode: string | null
  teacherName:    string
  entries:        RecordOfWorkEntry[]
}

/**
 * The one read model for the persistent Record of Work. Every Record of Work
 * *surface* — the editor UI, the single PDF download and the bulk export —
 * reads through this, so they cannot drift into three different definitions
 * of the same professional document again (ADR-0032 §12).
 *
 * Entries are returned in deterministic `week, lesson` order.
 *
 * Ownership: `teacherId` is a `teachers.id` and is required. Returns null
 * when the scheme has no Record of Work, or has one owned by someone else.
 */
export async function getRecordOfWorkForScheme(
  schemeId: string,
  teacherId: string,
): Promise<StoredRecordOfWork | null> {
  const db = createServiceClient()

  const { data: header, error: headerErr } = await db
    .from('records_of_work')
    .select('id, scheme_id, school, grade, learning_area, term, year, curriculum_mode, teacher_name')
    .eq('scheme_id', schemeId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (headerErr) throw new Error(`getRecordOfWorkForScheme: header read failed — ${headerErr.message}`)
  if (!header) return null

  const { data: entries, error: entryErr } = await db
    .from('row_entries')
    .select('week, lesson, date_taught, strand, substrand, activities_summary, reflection, remarks, learning_outcomes')
    .eq('row_id', header.id)
    .order('week')
    .order('lesson')

  if (entryErr) throw new Error(`getRecordOfWorkForScheme: entries read failed — ${entryErr.message}`)

  return {
    rowId:          header.id as string,
    schemeId:       (header.scheme_id as string | null) ?? null,
    school:         (header.school as string | null) ?? '',
    grade:          String(header.grade ?? ''),
    learningArea:   (header.learning_area as string | null) ?? '',
    term:           String(header.term ?? ''),
    year:           Number(header.year ?? 0),
    curriculumMode: (header.curriculum_mode as string | null) ?? null,
    teacherName:    (header.teacher_name as string | null) ?? '',
    entries: (entries ?? []).map(e => ({
      week:               e.week as number,
      lesson:             e.lesson as number,
      date_taught:        (e.date_taught as string | null) ?? null,
      strand:             (e.strand as string | null) ?? '',
      substrand:          (e.substrand as string | null) ?? '',
      activities_summary: toStringArray(e.activities_summary),
      reflection:         (e.reflection as string | null) ?? '',
      remarks:            (e.remarks as string | null) ?? '',
      learning_outcomes:  toStringArray(e.learning_outcomes),
    })),
  }
}

/**
 * "Work done" for a Record of Work row.
 *
 * The stored, canonical representation of what was covered in a lesson is
 * `row_entries.activities_summary` — the lesson's teaching steps, captured by
 * the canonical writer at synchronisation time. Earlier surfaces each derived
 * this differently from `lesson_plans` (first sentence of `step_1`; all three
 * steps joined; the substrand as a stand-in), which is exactly the divergence
 * Phase 3 exists to end. There is one derivation now, and it reads stored
 * data rather than re-deriving from the Lesson Plan.
 *
 * Falls back to the substrand when there are no stored activities — the case
 * for an entry seeded from `scheme_lessons`, which carries no teaching steps.
 * This matches what the previous renderer printed in the same situation, so
 * no document loses content.
 */
export function workDoneFor(entry: Pick<RecordOfWorkEntry, 'activities_summary' | 'substrand'>): string {
  const activities = entry.activities_summary.filter(a => a.trim().length > 0)
  if (activities.length > 0) return activities.join(' / ')
  return entry.substrand
}

/**
 * The automated synchronisation path (Monday cron). Derives the owner from
 * the scheme — never from `lesson_plans.teacher_id`, which is an auth-user
 * id and was the source of the production ownership defect.
 *
 * Safe to run repeatedly: `ensureRecordOfWork` will not re-create or
 * re-own an existing header, and `seedRecordOfWorkEntries` refreshes only
 * machine-owned columns.
 */
export async function syncRecordOfWorkForScheme(schemeId: string): Promise<SyncRecordOfWorkResult> {
  const db = createServiceClient()

  const { data: scheme, error: schemeErr } = await db
    .from('schemes_of_work')
    .select('id, teacher_id, school, grade, learning_area, term, year, curriculum_mode')
    .eq('id', schemeId)
    .single()

  if (schemeErr || !scheme) throw new Error(`syncRecordOfWorkForScheme: scheme ${schemeId} not found`)

  // schemes_of_work.teacher_id is already the canonical teachers.id.
  const teacherId = scheme.teacher_id as string

  const { data: teacher } = await db
    .from('teachers')
    .select('full_name')
    .eq('id', teacherId)
    .maybeSingle()

  const header = await ensureRecordOfWork({
    schemeId,
    teacherId,
    school:         (scheme.school as string | null) ?? '',
    grade:          String(scheme.grade ?? ''),
    learningArea:   (scheme.learning_area as string | null) ?? '',
    term:           String(scheme.term ?? '1'),
    year:           Number(scheme.year ?? new Date().getFullYear()),
    curriculumMode: (scheme.curriculum_mode as string | null) ?? null,
    teacherName:    (teacher?.full_name as string | null) ?? '',
  })

  const seeded = await seedRecordOfWorkEntries(header.rowId, schemeId)

  return { ...header, ...seeded }
}

/**
 * Phase 3 — immediate convergence for an *existing* Record of Work.
 *
 * Closes the latency gap: before this, a teacher who marked a lesson taught
 * on Wednesday did not see that evidence in an already-existing Record of
 * Work until the Monday cron ran. This is invoked from the teaching actions
 * that produce the evidence (mark-taught, taught, evaluation submission).
 *
 * Deliberately a no-op when the scheme has no Record of Work yet. Creating a
 * professional document as a side effect of marking one lesson taught would
 * be a surprising outcome for a teaching action; the Monday cron remains the
 * component that creates Records of Work, exactly as Phase 1 established.
 * That also keeps this call cheap and bounded for the common case.
 *
 * No new writer: this delegates to `syncRecordOfWorkForScheme`, so the
 * guarded fill-if-empty merge is the same one the cron uses.
 */
export async function syncRecordOfWorkIfExists(schemeId: string): Promise<SyncRecordOfWorkResult | null> {
  const db = createServiceClient()

  const { data: existing, error } = await db
    .from('records_of_work')
    .select('id')
    .eq('scheme_id', schemeId)
    .maybeSingle()

  if (error) throw new Error(`syncRecordOfWorkIfExists: lookup failed — ${error.message}`)
  if (!existing) return null

  return syncRecordOfWorkForScheme(schemeId)
}

/**
 * Fire-and-forget wrapper for the teaching-action routes.
 *
 * Failure semantics (Phase 3 Step 14): the teaching evidence has already been
 * persisted to `lesson_plans` by the time this runs. A synchronisation
 * failure must never make a successful mark-taught or evaluation report
 * failure to the teacher — the Monday cron is the standing fallback and will
 * converge the same evidence on its next pass. Failures are logged, never
 * swallowed silently, matching the `void publishEvent(...).catch(...)`
 * convention already used across this codebase.
 */
export function syncRecordOfWorkInBackground(schemeId: string, context: string): void {
  void syncRecordOfWorkIfExists(schemeId).catch((err: unknown) => {
    console.error(
      `[recordOfWork] background sync failed (${context}, scheme ${schemeId}):`,
      err instanceof Error ? err.message : String(err),
    )
  })
}
