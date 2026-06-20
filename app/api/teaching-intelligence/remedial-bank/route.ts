// GET: Return remedial bank cards for the authenticated teacher
// Query params: ?sowId=uuid (optional — filters to a specific scheme)
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getRemedialBankForTeacher } from '@/lib/teachingIntelligence/remedialBank'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const { searchParams } = new URL(req.url)
    const sowId = searchParams.get('sowId') ?? undefined

    const cards = await getRemedialBankForTeacher(teacher.id, user.id, sowId)
    return apiSuccess({ cards })
  } catch (err: unknown) {
    console.error('[teaching-intelligence/remedial-bank]', err)
    return apiError(err instanceof Error ? err.message : 'Failed to load remedial bank')
  }
}
