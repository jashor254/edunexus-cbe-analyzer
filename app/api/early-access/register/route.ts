// app/api/early-access/register/route.ts
// Logs early access interest — no auth required (pre-signup funnel)

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'

type Plan = 'starter' | 'term' | 'premium'

const RegisterSchema = z.object({
  plan:         z.enum(['starter', 'term', 'premium']),
  name:         z.string().trim().min(1).optional(),
  email:        z.string().email().optional(),
  phone:        z.string().trim().min(1).optional(),
  studentGrade: z.number().int().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = RegisterSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { plan, name, email, phone, studentGrade } = parsed.data

    const service = createServiceClient()

    const { error } = await service.from('early_access_leads').insert({
      plan: plan as Plan,
      name:          name          || null,
      email:         email         || null,
      phone:         phone         || null,
      student_grade: studentGrade  || null,
      status:        'interested',
    })

    if (error) {
      console.error('early_access_leads insert error:', error)
      return apiError('Failed to log interest', 500)
    }

    return apiSuccess({ message: 'Logged' })

  } catch (err) {
    console.error('early-access register error:', err)
    return apiError('Internal Server Error', 500)
  }
}
