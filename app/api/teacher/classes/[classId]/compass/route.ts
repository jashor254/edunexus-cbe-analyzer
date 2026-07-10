import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { getPendingReview } from '@/lib/intelligence/evidenceLifecycle'
import { MASTERY_EXTRACTION_METHOD } from '@/lib/compass/evidenceClaimTypes'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

export type PendingCompassEvidence = {
  id:              string
  subject:         string
  claimType:       'engagement' | 'mastery'
  createdAt:       string
  evidenceConfidence: number
  rawInputRef:     string
}

function classifyClaim(extractionMethod: string): 'engagement' | 'mastery' {
  return extractionMethod === MASTERY_EXTRACTION_METHOD ? 'mastery' : 'engagement'
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'exceeds_expectations':     return 'Exceeds'
    case 'meets_expectations':       return 'Meets'
    case 'approaching_expectations': return 'Approaching'
    case 'below_expectations':       return 'Below'
    default:                         return 'No data'
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const teacherClasses = await repos.schools.findTeacherClasses([teacher.id])
    const ownsClass = teacherClasses.some(c => c.id === classId)
    if (!ownsClass) return apiNotFound('Class not found')

    const studentLinks = await repos.schools.findClassStudents([classId])
    const studentIds = studentLinks.map(s => s.student_id)

    if (studentIds.length === 0) return apiSuccess({ students: [] })

    // Batch: students + all their compass sessions in two queries
    const [studentsResult, sessionsResult, pendingByStudent] = await Promise.all([
      db.from('students')
        .select('id, name, grade')
        .in('id', studentIds),
      db.from('compass_sessions')
        .select('id, learner_id, session_state, last_subject, updated_at')
        .in('learner_id', studentIds)
        .order('updated_at', { ascending: false }),
      // One pending-review lookup per roster student — a class roster is small
      // (tens, not thousands), so this stays a simple loop rather than a new
      // batch repository method (per Wave 2's "reuse existing repositories,
      // no new query shapes" instruction — getPendingReview already exists).
      Promise.all(studentIds.map(id => getPendingReview({ learnerId: id }))),
    ])

    const pendingEvidenceByStudent: Record<string, PendingCompassEvidence[]> = {}
    studentIds.forEach((id, i) => {
      pendingEvidenceByStudent[id] = pendingByStudent[i]
        .filter(row => row.evidence_source === 'compass_session')
        .map(row => ({
          id:                 row.id,
          subject:             row.subject,
          claimType:           classifyClaim(row.extraction_method),
          createdAt:           row.created_at,
          evidenceConfidence:  row.evidence_confidence,
          rawInputRef:         row.raw_input_ref,
        }))
    })

    const studentList = studentsResult.data || []
    const allSessions = sessionsResult.data || []

    // Latest session per student (already sorted desc by updated_at)
    const latestSession: Record<string, typeof allSessions[0]> = {}
    for (const s of allSessions) {
      if (!latestSession[s.learner_id]) latestSession[s.learner_id] = s
    }

    // Batch: latest assistant message (parentInsight) for each session
    const sessionIds = Object.values(latestSession).map(s => s.id)
    const latestInsight: Record<string, string> = {}

    if (sessionIds.length > 0) {
      const { data: messages } = await db
        .from('compass_messages')
        .select('session_id, metadata, created_at')
        .in('session_id', sessionIds)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })

      for (const msg of (messages || [])) {
        const insight = (msg.metadata as Record<string, string>)?.parentInsight
        if (!latestInsight[msg.session_id] && insight) {
          latestInsight[msg.session_id] = insight
        }
      }
    }

    const students = studentList.map(student => {
      const session = latestSession[student.id] ?? null
      const state   = (session?.session_state as Record<string, any>) ?? null
      const learner = (state?.learner as Record<string, any>) ?? null

      return {
        id:                 student.id,
        name:               student.name,
        grade:              student.grade,
        hasCompassData:     !!session,
        lastActive:         session?.updated_at ?? null,
        lastSubject:        session?.last_subject ?? null,
        compassTier:        state?.currentTier    ?? null,
        tierLabel:          state?.currentTier ? tierLabel(state.currentTier as string) : null,
        subjectTiers:       (state?.subjectTiers   as Record<string, string>) ?? {},
        strengths:          (learner?.strengths    as string[]) ?? [],
        challenges:         (learner?.challenges   as string[]) ?? [],
        masteredConcepts:   (state?.masteredConcepts   as string[]) ?? [],
        strugglingConcepts: (state?.strugglingConcepts as string[]) ?? [],
        confidenceLevel:    (state?.confidenceLevel    as string)  ?? null,
        latestInsight:      session ? (latestInsight[session.id] ?? null) : null,
        pendingEvidence:    pendingEvidenceByStudent[student.id] ?? [],
      }
    })

    // Students with compass data first
    students.sort((a, b) => {
      if (a.hasCompassData && !b.hasCompassData) return -1
      if (!a.hasCompassData && b.hasCompassData) return 1
      return 0
    })

    return apiSuccess({ students })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[teacher/classes/compass GET]', msg)
    return apiError('Internal server error')
  }
}
