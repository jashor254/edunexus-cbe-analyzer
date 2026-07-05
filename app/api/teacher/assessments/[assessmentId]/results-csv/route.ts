import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiUnauthorized, apiForbidden, apiNotFound, apiError } from '@/lib/api/response'
import { getAssessmentById, getLearnerMarks } from '@/lib/assessments/getters'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const assessment = await getAssessmentById(assessmentId, teacher.id)
    if (!assessment) return apiNotFound('Assessment not found')

    const marks = await getLearnerMarks(assessmentId, teacher.id)

    const sorted = [...marks].sort((a, b) => {
      if (a.position === null && b.position === null) return 0
      if (a.position === null) return 1
      if (b.position === null) return -1
      return a.position - b.position
    })

    const q = (v: string) => `"${v.replace(/"/g, '""')}"`

    const headerCols = ['No', 'Name', 'Adm No', ...assessment.subjects, 'Total', 'Mean Score', 'Mean Grade', 'Position']
    const headerRow  = headerCols.map(q).join(',')

    const dataRows = sorted.map((m, i) => {
      const subjectCols = assessment.subjects.map((s) => {
        const score = m.subject_scores[s]
        return score !== undefined ? String(score) : ''
      })
      return [
        String(i + 1),
        m.student_name,
        m.admission_number || '',
        ...subjectCols,
        m.total_marks !== null ? String(m.total_marks) : '',
        m.mean_score  !== null ? m.mean_score.toFixed(1) : '',
        m.mean_grade  || '',
        m.position    !== null ? String(m.position) : '',
      ].map(q).join(',')
    })

    const csv      = [headerRow, ...dataRows].join('\n')
    const filename = `${assessment.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_results.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[results-csv GET]', msg)
    return apiError('Failed to generate results CSV')
  }
}
