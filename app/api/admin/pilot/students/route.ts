import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()
    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) return apiForbidden()

    const service = createServiceClient()

    // 1. All pilot tracking rows + student info
    const { data: tracking, error: trackingError } = await service
      .from('pilot_tracking')
      .select(`
        id,
        student_id,
        term,
        year,
        whatsapp_sent_at,
        parent_name,
        parent_phone,
        feedback_notes,
        feedback_received_at,
        students (
          id,
          name,
          grade,
          school,
          curriculum_type,
          parent_first_name,
          parent_phone
        )
      `)
      .order('student_id')

    if (trackingError) return apiError(trackingError.message)
    if (!tracking || tracking.length === 0) return apiSuccess({ students: [] })

    const studentIds = tracking.map((t) => t.student_id)

    // 2. Latest clinic report per student (for term/year)
    const { data: reports } = await service
      .from('student_clinic_reports')
      .select('id, student_id, term, year, report_data, pdf_url, created_at, whatsapp_sent_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    // 3. Shared report tokens per student
    const { data: shared } = await service
      .from('shared_reports')
      .select('student_id, token, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    // Index by student_id (take most recent per student)
    const reportByStudent = new Map<string, typeof reports extends (infer T)[] | null ? T : never>()
    for (const r of reports ?? []) {
      if (!reportByStudent.has(r.student_id)) {
        reportByStudent.set(r.student_id, r)
      }
    }

    const sharedByStudent = new Map<string, string>()
    for (const s of shared ?? []) {
      if (!sharedByStudent.has(s.student_id)) {
        sharedByStudent.set(s.student_id, s.token)
      }
    }

    type Student = {
      id: string
      name: string
      grade: number
      school: string | null
      curriculum_type: string
      parent_first_name: string | null
      parent_phone: string | null
    }

    const students = tracking.map((t) => {
      const student = t.students as unknown as Student | null
      const report = reportByStudent.get(t.student_id) ?? null
      const shared_token = sharedByStudent.get(t.student_id) ?? null

      // Extract from report_data jsonb
      const reportData = report?.report_data as Record<string, unknown> | null
      const clinicalOverview = reportData?.clinicalOverview as Record<string, unknown> | null
      const pathwayAnalysis = reportData?.pathwayAnalysis as Record<string, unknown> | null
      const priorityAreas = clinicalOverview?.priorityAreas as Array<Record<string, unknown>> | null

      const overall_level = clinicalOverview?.overallCompetencyLevel ?? null
      const top_pathway = pathwayAnalysis?.recommendedPathway ?? null
      const priority_subject = priorityAreas?.[0]?.subject ?? null

      return {
        // Tracking
        tracking_id: t.id,
        term: t.term,
        year: t.year,
        whatsapp_sent_at: t.whatsapp_sent_at,
        parent_name: t.parent_name ?? student?.parent_first_name ?? null,
        parent_phone: t.parent_phone ?? student?.parent_phone ?? null,
        feedback_notes: t.feedback_notes,
        feedback_received_at: t.feedback_received_at,
        // Student
        student_id: t.student_id,
        name: student?.name ?? '',
        grade: student?.grade ?? 0,
        school: student?.school ?? null,
        curriculum_type: student?.curriculum_type ?? '',
        // Report
        report_id: report?.id ?? null,
        generated_at: report?.created_at ?? null,
        shared_token,
        pdf_url: report?.pdf_url ?? null,
        overall_level,
        top_pathway,
        priority_subject,
      }
    })

    return apiSuccess({ students: students.sort((a, b) => a.name.localeCompare(b.name)) })
  } catch (err) {
    console.error('[admin/pilot/students]', err)
    return apiError('Server error')
  }
}
