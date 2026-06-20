// app/api/students/[studentId]/route.ts
// DELETE — Scenario A: parent permanently deletes their own student
// PATCH  — Scenario B: parent unlinks themselves from a teacher-managed student

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound,
} from '@/lib/api/response'

type Params = { params: Promise<{ studentId: string }> }

// ── DELETE — permanently remove a parent-created student ──────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: student } = await db
      .from('students')
      .select('id, user_id, added_by')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiNotFound('Student not found')

    // Only the parent who created the student can delete — never teacher-managed
    if (student.user_id !== user.id) return apiForbidden()
    if (student.added_by === 'teacher') {
      return apiError('Teacher-managed students cannot be deleted. Use unlink instead.', 400)
    }

    const { error } = await db.from('students').delete().eq('id', studentId)
    if (error) throw error

    return apiSuccess({ deleted: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[students/[studentId] DELETE]', msg)
    return apiError('Failed to remove student')
  }
}

// ── PATCH — unlink parent from a teacher-managed student ──────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: student } = await db
      .from('students')
      .select('id, parent_user_id, added_by')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiNotFound('Student not found')

    // Must be linked to this parent and must be teacher-managed
    if (student.parent_user_id !== user.id) return apiForbidden()
    if (student.added_by !== 'teacher') {
      return apiError('Only teacher-managed students can be unlinked. Use delete instead.', 400)
    }

    const { error } = await db
      .from('students')
      .update({ parent_user_id: null, parent_email: null, notification_email: false })
      .eq('id', studentId)

    if (error) throw error

    return apiSuccess({ unlinked: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[students/[studentId] PATCH]', msg)
    return apiError('Failed to unlink student')
  }
}
