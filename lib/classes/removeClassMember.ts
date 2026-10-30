// lib/classes/removeClassMember.ts
//
// Lets a Solo Teacher remove a learner from their own class roster
// (DELETE /api/teacher/classes/[classId]/students/[studentId]).
//
// Security audit 2026-10-30, F-02: class membership (`class_students`) is
// the authorization boundary for every classroom surface — materials,
// resources and their signed file URLs, announcements, calendar,
// assignments, submissions — and joining by code is immediate. Teachers had
// no way to undo a membership they did not recognise; this is that way.
//
// Removes ONLY the one roster row. The learner's `students` record, marks,
// Evidence and submissions are untouched: every historical table references
// students.id, never class_students.id (see the repository method's notes).
//
// Core-bridged classes (teacher_classes.external_id set) are refused: their
// roster is owned by the school's Core enrolment and re-synchronised from
// it, so a legacy-side delete would be silently undone or desynchronise the
// bridge. Those learners are removed through the school's Core roster.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireClassTeacher } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'

export type RemoveClassMemberResult =
  | { status: 'removed' }
  | { status: 'not_member' }
  | { status: 'managed_by_school' }

type Deps = {
  /** Injected only by tests — production always uses the service client. */
  db?: ReturnType<typeof createServiceClient>
}

/**
 * @param client the caller's user-scoped client — authenticates them.
 * @throws ResourceOwnershipError (via requireClassTeacher) if the caller does not teach this class.
 */
export async function removeClassMember(
  client: SupabaseClient,
  classId: string,
  studentId: string,
  deps: Deps = {}
): Promise<RemoveClassMemberResult> {
  const db = deps.db ?? createServiceClient()

  await requireClassTeacher(client, classId, db)

  const { data: cls, error } = await db
    .from('teacher_classes')
    .select('id, external_id')
    .eq('id', classId)
    .maybeSingle()
  if (error) throw new Error(`removeClassMember: class lookup failed: ${error.message}`)
  if (!cls) return { status: 'not_member' }
  if (cls.external_id) return { status: 'managed_by_school' }

  const removed = await repos.teachers.removeLegacyClassRosterMembershipForStudents(classId, [studentId])
  return removed > 0 ? { status: 'removed' } : { status: 'not_member' }
}
