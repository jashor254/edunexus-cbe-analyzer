// app/api/early-access/register/route.ts
// Logs early access interest — no auth required (pre-signup funnel)

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'

type Plan = 'starter' | 'term' | 'premium'

const VALID_PLANS: Plan[] = ['starter', 'term', 'premium']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan, name, email, phone, studentGrade } = body as {
      plan: string
      name?: string
      email?: string
      phone?: string
      studentGrade?: number
    }

    if (!plan || !VALID_PLANS.includes(plan as Plan)) {
      return apiBadRequest(`plan must be one of: ${VALID_PLANS.join(', ')}`)
    }

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
