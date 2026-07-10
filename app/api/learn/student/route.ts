// app/api/learn/student/route.ts
import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { tierToLevel } from '@/lib/compass/session'
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

    return shapeAndReturn(data as Record<string, unknown>)
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

  return shapeAndReturn(data as Record<string, unknown>)
}

// ── Shape a fully-fetched student row into the API response ───────────────────
function shapeAndReturn(data: Record<string, unknown>) {
  const raw = data.student_learning_context
  const ctx = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null

  // No assessment done yet — tell the UI to redirect to onboarding
  if (!ctx) {
    const grade     = (data.grade as number | null) ?? 7
    const firstName = formatFirstName(data.name as string | null)
    return apiSuccess({
      id:             data.id as string,
      firstName,
      grade,
      isJunior:       grade <= 9,
      pathway:        null,
      subjects:       [],
      needsAssessment: true,
      hasTeacher:     Boolean(data.teacher_id),
    })
  }

  const tiers         = (ctx.subject_tiers  ?? {}) as Record<string, string>
  const compassBridge = (ctx.compass_bridge ?? {}) as Record<string, unknown>
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

  // ── Subject filtering ────────────────────────────────────────────────────────
  const selected = (data.selected_subjects as string[] | null) ?? []

  const subjectKeys: string[] = isJunior
    ? Object.keys(tiers).filter(k => JUNIOR_SUBJECTS.includes(k))
    : (selected.length > 0 ? selected : Object.keys(tiers))

  // ── Sort weakest first, flag recommended ─────────────────────────────────────
  const sorted = subjectKeys
    .map(k => ({ key: k, level: tierToLevel(tiers[k] ?? '') }))
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
