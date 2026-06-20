// app/api/admin/career/seed/route.ts
// POST — seeds the careers table with the 10 starter careers
// Protected: only admin role can call this

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { runSeed } from '@/lib/career/careerEngine'
import { seedCareersCOS } from '@/lib/career/seedCareers'

async function adminGuard(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, db: null }
  const db = createServiceClient()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { user: null, db: null }
  return { user, db }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await adminGuard(req)
    if (!user) return apiForbidden()

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'careers'

    if (mode === 'cos') {
      const result = await seedCareersCOS()
      return apiSuccess({ mode: 'cos', ...result })
    }

    const result = await runSeed()
    return apiSuccess({ mode: 'careers', ...result })
  } catch (err) {
    console.error('[admin/career/seed]', err)
    return apiError('Seed failed')
  }
}
