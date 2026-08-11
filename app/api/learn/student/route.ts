// app/api/learn/student/route.ts
import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { tierToLevel } from '@/lib/compass/session'
import { readCompassAcademicProjection, resolveCompassSubjectRanking } from '@/lib/compass/learnerContext'
import { resolveCompassStudentAccess } from '@/lib/compass/ownership'
import { repos } from '@/lib/repositories'

function formatFirstName(name: string | null): string {
  return ((name ?? '').split(' ')[0] || 'there')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

const JUNIOR_SUBJECTS = [
  'mathematics', 'english', 'kiswahili',
  'integrated_science', 'social_studies',
  'agriculture_nutrition', 'pre_technical_studies',
  'creative_arts_sports', 'cre', 'business_studies',
]

// Left join — students without a learning_context row still load; shapeAndReturn
// handles the null ctx case and returns needsAssessment: true so the UI can prompt.
const SELECT = `
  id, name, grade, current_pathway, selected_subjects, teacher_id,
  student_learning_context (
    subject_tiers,
    recommended_pathway,
    sessions_without_improvement,
    subject_rest_until,
    compass_bridge
  )
`

export async function GET(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError('Unauthenticated', 401)

  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  // ── Explicit student selection ───────────────────────────────────────────────
  if (studentId) {
    const ownership = await resolveCompassStudentAccess(user.id, studentId)
    if (!ownership.allowed) return apiForbidden()

    const { data, error } = await db
      .from('students')
      .select(SELECT)
      .eq('id', studentId)
      .maybeSingle()

    if (error) {
      console.error('[learn/student] DB error:', error)
      return apiError('Failed to load student', 500)
    }
    if (!data) return apiError('Student not found', 404)

    return await shapeAndReturn(data as Record<string, unknown>)
  }

  // ── Auto-select or picker ────────────────────────────────────────────────────
  // First get a lightweight list of all students linked to this user.
  // TODO: when the parent dashboard Compass entry point is built, always
  // supply ?studentId= in the link so this picker is skipped entirely.
  let allStudents: Array<{ id: string; name: string | null; grade: number | null }>
  try {
    allStudents = await repos.compass.findOwnedStudents(user.id)
  } catch (err) {
    console.error('[learn/student] list error:', err)
    return apiError('Failed to load students', 500)
  }
  if (!allStudents || allStudents.length === 0) return apiError('Student not found', 404)

  // 2+ students → return picker list for the frontend to render a selector
  if (allStudents.length >= 2) {
    const students = allStudents.map(s => ({
      id:        s.id        as string,
      firstName: formatFirstName(s.name as string | null),
      grade:     (s.grade   as number | null) ?? 7,
    }))
    return apiSuccess({ picker: true, students })
  }

  // Exactly 1 student → load full data
  const { data, error } = await db
    .from('students')
    .select(SELECT)
    .eq('id', allStudents[0].id as string)
    .maybeSingle()

  if (error) {
    console.error('[learn/student] DB error:', error)
    return apiError('Failed to load student', 500)
  }
  if (!data) return apiError('Student not found', 404)

  return await shapeAndReturn(data as Record<string, unknown>)
}

// ── Shape a fully-fetched student row into the API response ───────────────────
//
// Async as of Phase 1 / P0-A: the per-subject levels shown on the picker
// are now resolved canonical-first (lib/compass/learnerContext.ts), the
// same resolution `/api/learn` uses for the tutoring prompt and
// `getNextSubject()` uses for ranking. All three switched together
// deliberately — a learner must not see "Level 2" on a card and then be
// taught at Level 3 in the session that card opens.
async function shapeAndReturn(data: Record<string, unknown>) {
  const raw = data.student_learning_context
  const ctx = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null

  const tiers         = (ctx?.subject_tiers  ?? {}) as Record<string, string>
  const compassBridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
  const pathwayRaw = (
    (ctx?.recommended_pathway as string | null) ??
    (data.current_pathway     as string | null)
  )
  const grade    = (data.grade as number | null) ?? 7
  const isJunior = grade <= 9

  const teacherSuggestedSubject = compassBridge.teacherSuggested
    ? (compassBridge.firstSubject as string | null)
    : null
  const teacherSuggestedConcept = compassBridge.teacherSuggested
    ? (compassBridge.firstConcept as string | null)
    : null

  // ── Canonical academic state (Phase 1 / P0-A) ────────────────────────────────
  // One read-only projection read; `ranking` carries the canonical level for
  // every subject Projection knows about, keyed by `sourceKey` — the
  // learner's own tier key where they have one, so nothing about how a
  // subject is addressed downstream changes.
  const { academic } = await readCompassAcademicProjection(data.id as string)
  const ranking = resolveCompassSubjectRanking({ academic, subjectTiers: tiers })
  const rankBySourceKey = new Map(ranking.map(r => [r.sourceKey, r]))

  // ── Access (Phase 2.5 / G-05) ────────────────────────────────────────────
  //
  // This used to bail out the moment `student_learning_context` was absent,
  // which made an Academic Clinic assessment the single key that opened
  // Compass. It locked out every learner whose evidence lives in the
  // canonical record instead — 476 of them at the time this was measured,
  // against 83 who had a Clinic row at all.
  //
  // Access now depends on whether we can actually offer this learner
  // anything to work on, not on which table the knowledge came from.
  // `ranking` is already the union of canonical Projection subjects and
  // legacy Clinic tiers, so:
  //   - canonical evidence only            -> available (Case A)
  //   - Clinic context only                -> available, legacy fallback (Case B)
  //   - both                               -> available; Projection sets the
  //                                           level, Clinic enriches (Case C)
  //   - neither                            -> genuinely nothing to offer (Case D)
  //
  // Case D is NOT an arbitrary policy gate: with no evidence and no tiers
  // there is no subject list to render and no level to teach to, so a
  // session would have to invent both. That is the one case where asking
  // for a diagnostic is the honest answer — and it is decided by absence of
  // content, not by absence of a Clinic row.
  //
  // Nothing here writes a `student_learning_context` row to grant access.
  if (ranking.length === 0) {
    return apiSuccess({
      id:              data.id as string,
      firstName:       formatFirstName(data.name as string | null),
      grade,
      isJunior,
      pathway:         pathwayRaw,
      subjects:        [],
      needsAssessment: true,
      hasTeacher:      Boolean(data.teacher_id),
    })
  }

  // ── Subject filtering ────────────────────────────────────────────────────────
  const selected = (data.selected_subjects as string[] | null) ?? []

  // Candidate keys are the union of the learner's tiers and the subjects
  // Projection has evidence for. A subject with real confirmed evidence but
  // no Clinic tier is one the learner should be able to pick — it is
  // already visible to every other consumer of Projection. The existing
  // filters below are unchanged, so this can only ever ADD a subject that
  // those filters already admit; no card that appeared before disappears.
  const candidateKeys = [...new Set([...Object.keys(tiers), ...ranking.map(r => r.sourceKey)])]

  const subjectKeys: string[] = isJunior
    ? candidateKeys.filter(k => JUNIOR_SUBJECTS.includes(k))
    : (selected.length > 0 ? selected : candidateKeys)

  // ── Sort weakest first, flag recommended ─────────────────────────────────────
  // Canonical level when Projection has one for this subject; the legacy
  // tier otherwise — including for a senior-selected subject that appears in
  // neither source, which keeps its previous tierToLevel('') behaviour
  // rather than vanishing from the list.
  const sorted = subjectKeys
    .map(k => ({ key: k, level: rankBySourceKey.get(k)?.level ?? tierToLevel(tiers[k] ?? '') }))
    .sort((a, b) => a.level - b.level)

  const recommendedKey = sorted[0]?.key ?? null

  const subjects = sorted.map(({ key, level }) => ({
    key,
    level,
    recommended:      key === recommendedKey,
    teacherSuggested: key === teacherSuggestedSubject,
    subtopic:         key === teacherSuggestedSubject
      ? teacherSuggestedConcept
      : null,
  }))

  const firstName = formatFirstName(data.name as string | null)

  return apiSuccess({
    id:        data.id as string,
    firstName,
    grade,
    isJunior,
    pathway:   pathwayRaw,
    subjects,
  })
}
