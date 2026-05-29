// app/api/parent/link-student/route.ts
// Verifies a student invite token and links the authenticated user as the parent.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiBadRequest,
} from '@/lib/api/response'

const BodySchema = z.object({
  student_id: z.string().uuid(),
  token:      z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const { student_id, token } = parsed.data
    const db = createServiceClient()

    // Verify invite token
    const { data: invite } = await db
      .from('student_invites')
      .select('id, student_id, parent_email, expires_at, used_at')
      .eq('token', token)
      .eq('student_id', student_id)
      .single()

    if (!invite) return apiBadRequest('Invalid invite link')
    if (invite.used_at) return apiBadRequest('This invite link has already been used')
    if (new Date(invite.expires_at) < new Date()) return apiBadRequest('This invite link has expired')

    // Load student — must not already have a parent linked
    const { data: student } = await db
      .from('students')
      .select('id, name, parent_user_id, user_id')
      .eq('id', student_id)
      .single()

    if (!student) return apiBadRequest('Student not found')

    // If already linked to this user, that's fine — idempotent
    if (student.parent_user_id && student.parent_user_id !== user.id) {
      return apiBadRequest('This student is already linked to another parent account')
    }

    // Mark invite used + link parent
    await Promise.all([
      db.from('student_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id),
      db.from('students')
        .update({
          parent_user_id:        user.id,
          parent_email:          student.parent_user_id ? undefined : (user.email ?? undefined),
          notification_email:    true,
        })
        .eq('id', student_id),
      // Also ensure token_balances row exists for new parent
      db.from('token_balances')
        .upsert({ user_id: user.id, balance: 3 }, { onConflict: 'user_id', ignoreDuplicates: true }),
    ])

    return apiSuccess({ student_id, student_name: student.name, linked: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[parent/link-student POST]', msg)
    return apiError('Internal server error')
  }
}
