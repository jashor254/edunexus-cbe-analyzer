// lib/teacherWorkspace/classListProjection.ts
//
// Teacher Workspace Projection Extraction — extracted from
// app/api/teacher/classes/route.ts GET. Same response shape as before
// (each class row plus student_count/avg_level), but the original's
// `Promise.all` over every class (one class_students query + one
// assessments query per class, i.e. 2N+1 total round trips) is replaced
// with 3 batched queries total, following the pattern already established
// in lib/gradebook/gradebook.ts and lib/attentionFeed/aggregate.ts.

import { createServiceClient } from '@/utils/supabase/service'
import { computeClassListStats, type ClassListProjectionRow } from './classListProjectionPure'

export async function getTeacherClassListProjection(teacherId: string): Promise<ClassListProjectionRow[]> {
  const db = createServiceClient()

  const { data: classes, error } = await db
    .from('teacher_classes')
    .select(`
      *,
      class_students(count)
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getTeacherClassListProjection: ${error.message}`)
  if (!classes || classes.length === 0) return []

  const classIds = classes.map(c => c.id as string)

  const { data: studentLinks } = await db
    .from('class_students')
    .select('class_id, student_id')
    .in('class_id', classIds)

  const studentIds = Array.from(new Set((studentLinks ?? []).map(l => l.student_id as string)))

  const { data: assessments } = studentIds.length
    ? await db
        .from('assessments')
        .select('student_id, subject_scores')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ student_id: string; subject_scores: Record<string, number> }> }

  return computeClassListStats(
    classes,
    (studentLinks ?? []) as Array<{ class_id: string; student_id: string }>,
    (assessments ?? []) as Array<{ student_id: string; subject_scores: Record<string, number> }>,
  )
}
