// app/api/sow/kicd-context/route.ts
// GET: Return KICD enrichment data for AI generation context
// Query params: subject (learning area name, partial match)

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const subject = url.searchParams.get('subject')?.trim()
    if (!subject) return apiBadRequest('Missing subject')

    const db = createServiceClient()

    const [{ data: area }, { data: strands }] = await Promise.all([
      db.from('sow_learning_areas')
        .select('kicd_subject_data')
        .ilike('name', `%${subject}%`)
        .limit(1)
        .maybeSingle(),
      db.from('sow_strands')
        .select('title, kicd_data')
        .ilike('title', `%${subject}%`),
    ])

    return apiSuccess({
      kicdArea: area ?? null,
      kicdStrands: strands ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load KICD context'
    return apiError(message)
  }
}
