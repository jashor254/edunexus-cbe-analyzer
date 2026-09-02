// lib/teacherWorkspace/dashboardProjection.ts
//
// Teacher Workspace Projection Extraction — extracted from
// app/teacher/dashboard/page.tsx, which previously queried `teachers` and
// `teacher_classes` directly with the service-role client inline in the
// page component.
//
// CONVERGENCE (class_subjects → Teacher Workspace): this projection now
// carries BOTH sources, for different populations, because they answer
// different questions:
//
//   `teachingContext` — the INSTITUTIONAL answer, from Core
//                       school_users → class_subjects. Authoritative for any
//                       teacher with an active school membership.
//   `activeClasses`   — the LEGACY count from teacher_classes. Still correct
//                       for a Solo Teacher's own private classes, and still
//                       what the legacy class surfaces read.
//
// They are deliberately NOT merged into one number. A school teacher's
// institutional assignment count and a solo teacher's private class count are
// different facts, and summing them would let a stray private class make an
// unassigned school teacher look assigned — the exact dual-truth failure
// Phase 8 of this convergence exists to prevent.
//
// The remaining legacy read below is the evidence/roster half, which cannot
// redirect yet: assessments, marks, gradebook and Compass are all keyed to the
// legacy id space (`teacher_classes.id`/`students.id`) and only the lazy,
// single-purpose `lib/core/academicBridge.ts` links them to Core ids. See
// docs/architecture/teacher-workspace-core-cutover-readiness.md §5.

import { createServiceClient } from '@/utils/supabase/service'
import { resolveTeachingContext, type TeachingContext } from '@/lib/core/teachingAssignments'

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
  /**
   * The institutional answer: is this a school teacher, and what has the
   * school assigned them? Resolved from Core `school_users`/`class_subjects`,
   * never from `teacher_classes`.
   *
   * `kind:'solo'` for a teacher with no active school membership — their
   * private workspace behaviour is unchanged.
   */
  teachingContext: TeachingContext
}

export async function getTeacherDashboardProjection(userId: string): Promise<TeacherDashboardProjection> {
  const db = createServiceClient()

  // The institutional read is keyed on the AUTH user, not on the legacy
  // `teachers` row, so it is resolved independently of (and in parallel with)
  // the legacy identity lookup. A school teacher whose legacy `teachers` row
  // is missing still has real assignments; the two lookups must not be chained.
  const [{ data: teacher }, teachingContext] = await Promise.all([
    db.from('teachers')
      .select('id, full_name, school, subject, pioneer_number, is_verified')
      .eq('user_id', userId)
      .maybeSingle(),
    resolveTeachingContext(userId),
  ])

  if (!teacher) return { teacher: null, activeClasses: 0, activeSchemes: 0, teachingContext }

  const [{ data: classes }, { count: schemeCount }] = await Promise.all([
    db.from('teacher_classes')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active'),
    db.from('schemes_of_work')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id),
  ])

  return {
    teacher,
    activeClasses: (classes ?? []).length,
    activeSchemes: schemeCount ?? 0,
    teachingContext,
  }
}
