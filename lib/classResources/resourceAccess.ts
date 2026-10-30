// lib/classResources/resourceAccess.ts
//
// Who may receive a signed download URL for a class resource
// (GET /api/resources/[id]/file-url). Moved verbatim out of the route so the
// rule can be tested against a real database — in particular that a learner
// removed from a class (lib/classes/removeClassMember.ts) can no longer
// obtain a NEW signed URL for that class's files. Behaviour is unchanged:
//
//   1. the teacher who uploaded the resource, or
//   2. a parent linked to the resource's class (class_students.parent_id), or
//   3. a learner whose own student record is on that class's roster.
//
// A URL issued before removal stays valid until its own short expiry
// (SIGNED_URL_TTL_SECONDS in the route); it cannot be revoked early.

import { createServiceClient } from '@/utils/supabase/service'

export type ClassResourceRef = { teacher_id: string; class_id: string }

type Deps = {
  /** Injected only by tests — production always uses the service client. */
  db?: ReturnType<typeof createServiceClient>
}

export async function canAccessClassResource(
  userId: string,
  resource: ClassResourceRef,
  deps: Deps = {}
): Promise<boolean> {
  const db = deps.db ?? createServiceClient()

  // Teacher who owns the resource
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('id', resource.teacher_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (teacher) return true

  // Parent linked to the resource's class
  const { data: parentLink } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', resource.class_id)
    .eq('parent_id', userId)
    .maybeSingle()
  if (parentLink) return true

  // Learner currently in the resource's class
  const { data: student } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!student) return false

  const { data: studentLink } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', resource.class_id)
    .eq('student_id', student.id)
    .maybeSingle()
  return !!studentLink
}
