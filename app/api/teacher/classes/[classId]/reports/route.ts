// app/api/teacher/classes/[classId]/reports/route.ts
// Returns all clinic reports generated for this class, with student + delivery status.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params

  const supabase = await createClient()
  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    throw err
  }

  const db = createServiceClient()

  const teacher = await resolveTeacher(userId)
  if (!teacher) return apiForbidden()

  // Verify class belongs to teacher
  try {
    await requireClassTeacher(supabase, classId)
  } catch {
    return apiForbidden()
  }

  const { data: cls } = await db
    .from('teacher_classes')
    .select('id, name, grade, subject')
    .eq('id', classId)
    .eq('teacher_id', teacher.id)
    .single()
  if (!cls) return apiForbidden()

  // Get all students in class
  const { data: links } = await db
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)
  const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id)

  if (studentIds.length === 0) {
    return apiSuccess({ reports: [], stats: { total: 0, whatsappSent: 0, emailSent: 0, parentOpened: 0 } })
  }

  // Get latest report per student
  const { data: reports } = await db
    .from('student_clinic_reports')
    .select('id, student_id, assessment_id, pdf_url, whatsapp_sent_at, email_sent_at, parent_opened_at, term, year, created_at')
    .in('student_id', studentIds)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })

  // Get student names
  const { data: students } = await db
    .from('students')
    .select('id, name, grade, parent_email, parent_phone')
    .in('id', studentIds)

  const studentMap = new Map((students ?? []).map((s: { id: string; name: string; grade: number; parent_email: string | null; parent_phone: string | null }) => [s.id, s]))

  // Deduplicate: latest report per student
  const latestPerStudent = new Map<string, typeof reports extends (infer T)[] | null ? T : never>()
  for (const r of (reports ?? [])) {
    if (!latestPerStudent.has((r as { student_id: string }).student_id)) {
      latestPerStudent.set((r as { student_id: string }).student_id, r)
    }
  }

  const rows = studentIds.map(sid => {
    const student = studentMap.get(sid)
    const report = latestPerStudent.get(sid)
    return {
      studentId:     sid,
      studentName:   student?.name ?? 'Unknown',
      grade:         student?.grade ?? 0,
      hasEmail:      !!student?.parent_email,
      hasPhone:      !!student?.parent_phone,
      reportId:      report ? (report as { id: string }).id : null,
      generatedAt:   report ? (report as { created_at: string }).created_at : null,
      term:          report ? (report as { term: number }).term : null,
      year:          report ? (report as { year: number }).year : null,
      pdfUrl:        report ? (report as { pdf_url: string | null }).pdf_url : null,
      whatsappSent:  report ? !!(report as { whatsapp_sent_at: string | null }).whatsapp_sent_at : false,
      emailSent:     report ? !!(report as { email_sent_at: string | null }).email_sent_at : false,
      parentOpened:  report ? !!(report as { parent_opened_at: string | null }).parent_opened_at : false,
    }
  })

  const stats = {
    total:         rows.filter(r => r.reportId).length,
    whatsappSent:  rows.filter(r => r.whatsappSent).length,
    emailSent:     rows.filter(r => r.emailSent).length,
    parentOpened:  rows.filter(r => r.parentOpened).length,
  }

  return apiSuccess({ reports: rows, stats, className: cls.name, grade: cls.grade })
}
