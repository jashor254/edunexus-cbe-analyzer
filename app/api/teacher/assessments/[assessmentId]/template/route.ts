import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiUnauthorized, apiForbidden, apiNotFound, apiError } from '@/lib/api/response'
import { getAssessmentById } from '@/lib/assessments/getters'

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

    // Pre-populate with enrolled students if any exist
    const { data: classStudents } = await db
      .from('class_students')
      .select('students(name)')
      .eq('class_id', assessment.class_id)

    const studentNames: string[] = (classStudents || [])
      .map(cs => (cs.students as unknown as { name: string } | null)?.name as string)
      .filter(Boolean)

    const headers = ['No', 'Name', 'Adm No', ...assessment.subjects, 'Total', 'Mean Score', 'Mean Grade', 'Position']
    const headerRow = headers.map((h) => `"${h}"`).join(',')

    const emptyCols = assessment.subjects.map(() => '').join(',')

    const dataRows =
      studentNames.length > 0
        ? studentNames.map((name, i) => `"${i + 1}","${name}",,${emptyCols},,,, `)
        : Array.from({ length: 30 }, (_, i) => `"${i + 1}",,, ${emptyCols},,,,`)

    const csv = [headerRow, ...dataRows].join('\n')
    const filename = `${assessment.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_template.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[template GET]', msg)
    return apiError('Failed to generate template')
  }
}
