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
  /**
   * Phase 1 (Teacher Workspace Convergence) — how many Schemes of Work this
   * teacher has.
   *
   * This exists because the dashboard previously used `activeClasses` to
   * decide whether a teacher had *started using EduNexus at all*, which was
   * wrong: the Phase 0 audit proved the teaching chain has zero coupling to
   * teacher_classes, so an independent teacher can have schemes, lesson
   * plans, taught lessons and a Record of Work while `activeClasses` stays
   * 0 forever. Scheme count is the honest signal for "has this teacher begun
   * their professional work".
   *
   * Resolved server-side (a `head`-only count alongside the existing classes
   * query, run in parallel) rather than client-side so first-run vs
   * returning block selection happens before render — no flash, and no new
   * API route. It reads schemes_of_work only; no SOW domain logic, schema or
   * coupling is introduced.
   */
  activeSchemes: number
}

export async function getTeacherDashboardProjection(userId: string): Promise<TeacherDashboardProjection> {
  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name, school, subject, pioneer_number, is_verified')
    .eq('user_id', userId)
    .single()

  if (!teacher) return { teacher: null, activeClasses: 0, activeSchemes: 0 }

  const [{ data: classes }, { count: schemeCount }] = await Promise.all([
    db.from('teacher_classes')
      .select('id')
      .eq('teacher_id', teacher.id),
    db.from('schemes_of_work')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id),
  ])

  return {
    teacher,
    activeClasses: (classes ?? []).length,
    activeSchemes: schemeCount ?? 0,
  }
}
