// app/api/admin/career/seed/route.ts
// POST — seeds the careers table with the 10 starter careers
// Protected: only admin role can call this

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { runSeed } from '@/lib/career/careerEngine'

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') return apiForbidden()

    const result = await runSeed()
    return apiSuccess(result)
  } catch (err) {
    console.error('[admin/career/seed]', err)
    return apiError('Seed failed')
  }
}
