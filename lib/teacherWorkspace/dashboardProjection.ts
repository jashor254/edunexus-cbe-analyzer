// lib/teacherWorkspace/dashboardProjection.ts
//
// Teacher Workspace Projection Extraction — extracted from
// app/teacher/dashboard/page.tsx, which previously queried `teachers` and
// `teacher_classes` directly with the service-role client inline in the
// page component.
//
// Deliberately still reads the legacy `teachers`/`teacher_classes` tables,
// unchanged — this sprint only creates the seam (a named service the page
// calls instead of querying directly). Redirecting this projection's
// *source* to Core `school_users`/`class_subjects` is the later, separate
// Core-redirect step described in
// docs/architecture/school-first-operating-model-audit.md and
// docs/architecture/application-layer-workspace-projection-audit.md — not
// part of this sprint, per its explicit scope boundary ("Do not combine
// refactoring with ownership migration").

import { createServiceClient } from '@/utils/supabase/service'

export type TeacherDashboardTeacher = {
  id: string
  full_name: string | null
  school: string | null
  subject: string | null
  pioneer_number: number | null
  is_verified: boolean | null
}

export type TeacherDashboardProjection = {
  teacher: TeacherDashboardTeacher | null
  activeClasses: number
}

export async function getTeacherDashboardProjection(userId: string): Promise<TeacherDashboardProjection> {
  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name, school, subject, pioneer_number, is_verified')
    .eq('user_id', userId)
    .single()

  if (!teacher) return { teacher: null, activeClasses: 0 }

  const { data: classes } = await db
    .from('teacher_classes')
    .select('id')
    .eq('teacher_id', teacher.id)

  return { teacher, activeClasses: (classes ?? []).length }
}
