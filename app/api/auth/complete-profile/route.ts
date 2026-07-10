// app/api/auth/complete-profile/route.ts
// Sets the profile role for a freshly created email/password account.
// Mirrors the role upsert done in app/auth/callback/route.ts for OAuth signups —
// email/password signups have no callback redirect to hang that logic off of.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'

const BodySchema = z.object({
  role:          z.enum(['teacher', 'parent', 'student']),
  secondaryRole: z.enum(['teacher', 'parent']).optional(),
})

export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { role, secondaryRole } = parsed.data

  const db = createServiceClient()
  const { error } = await db.from('profiles').upsert(
    {
      id:             auth.user.id,
      role,
      ...(secondaryRole ? { secondary_role: secondaryRole } : {}),
      updated_at:     new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (error) {
    return NextResponse.json({ error: 'Failed to set up profile' }, { status: 500 })
  }

  if (secondaryRole === 'teacher') {
    await db.from('teachers').upsert(
      { user_id: auth.user.id },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
  }

  return NextResponse.json({ success: true })
}
