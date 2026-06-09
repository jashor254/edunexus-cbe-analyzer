import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'Mathematics',
  english: 'English',
  kiswahili: 'Kiswahili',
  integrated_science: 'Integrated Science',
  social_studies: 'Social Studies',
  creative_arts_sports: 'Creative Arts & Sports',
  pre_technical_studies: 'Pre-Technical Studies',
  agriculture: 'Agriculture',
  business_studies: 'Business Studies',
  geography: 'Geography',
  history: 'History & Citizenship',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Below Expectations',
  2: 'Approaching Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name, school')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('classId')
    const term = searchParams.get('term')
    const year = searchParams.get('year')

    if (!classId) return apiError('classId is required', 400)

    // Verify class belongs to teacher
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, name, grade, subject')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiForbidden()

    // Get all students in class
    const { data: studentLinks } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)

    const studentIds = (studentLinks || []).map((s: any) => s.student_id)

    if (studentIds.length === 0) {
      return apiError('No students in this class', 400)
    }

    const { data: students } = await db
      .from('students')
      .select('id, name, grade')
      .in('id', studentIds)
      .order('name', { ascending: true })

    // Get assessments
    let assessmentQuery = db
      .from('assessments')
      .select('student_id, subject_scores, term, year')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    if (term) assessmentQuery = assessmentQuery.eq('term', parseInt(term))
    if (year) assessmentQuery = assessmentQuery.eq('year', parseInt(year))

    const { data: assessments } = await assessmentQuery

    // Build latest per student
    const latestAssessment: Record<string, any> = {}
    ;(assessments || []).forEach((a: any) => {
      if (!latestAssessment[a.student_id]) {
        latestAssessment[a.student_id] = a
      }
    })

    // Build CSV rows
    const headers = [
      'Student Name',
      'Admission No',
      'Grade',
      'Subject',
      'Strand',
      'Sub-Strand',
      'Assessment Level (1-4)',
      'Performance Label',
      'Teacher Comments',
      'Term',
      'Year',
      'School',
    ]

    const rows: string[][] = [headers]

    ;(students || []).forEach((student: any, idx: number) => {
      const assessment = latestAssessment[student.id]
      const scores = assessment?.subject_scores as Record<string, number> | undefined

      if (scores) {
        Object.entries(scores).forEach(([subject, score]) => {
          const level = Math.round(score) as 1 | 2 | 3 | 4
          rows.push([
            student.name,
            `ADM${String(idx + 1).padStart(3, '0')}`,
            String(student.grade),
            SUBJECT_LABELS[subject] || subject,
            SUBJECT_LABELS[subject] || subject,
            '',
            String(level),
            LEVEL_LABELS[level] || String(level),
            level <= 2 ? 'Needs additional support' : level === 3 ? 'On track' : 'Excelling',
            assessment.term ? String(assessment.term) : term || '',
            assessment.year ? String(assessment.year) : year || '',
            teacher.school,
          ])
        })
      } else {
        // No assessment — still include student with empty scores
        rows.push([
          student.name,
          `ADM${String(idx + 1).padStart(3, '0')}`,
          String(student.grade),
          cls.subject,
          cls.subject,
          '',
          '',
          '',
          'No assessment recorded',
          term || '',
          year || '',
          teacher.school,
        ])
      }
    })

    const csv = rows.map(row => row.map(escapeCSV).join(',')).join('\n')
    const filename = `KNEC_CBA_${cls.name.replace(/\s+/g, '_')}_Term${term || 'All'}_${year || new Date().getFullYear()}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: unknown) {
    console.error('[teacher/reports/knec-export GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
