// app/api/sow/strands/route.ts
// GET: Return strands + substrands for a given learning area
// Query params: learningAreaId

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
} from '@/lib/api/response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const learningAreaId = url.searchParams.get('learningAreaId')?.trim()
    if (!learningAreaId) return apiBadRequest('Missing learningAreaId')

    const db = createServiceClient()

    // 1. Fetch all strands for this learning area
    const { data: strandsData, error: stErr } = await db
      .from('sow_strands')
      .select('id, title, order_index')
      .eq('learning_area_id', learningAreaId)
      .order('order_index')
      .limit(500)

    if (stErr) {
      console.error('[sow/strands] strands fetch:', stErr)
      return apiError('Failed to load strands')
    }

    if (!strandsData?.length) {
      return apiSuccess({ strands: [] })
    }

    // 2. Fetch all substrands with pagination (avoids PostgREST 1000-row cap)
    const strandIds = strandsData.map(s => s.id)
    const PAGE = 1000
    let from = 0
    const allSubstrands: Array<{ id: string; strand_id: string; title: string; order_index: number }> = []

    while (true) {
      const { data: page, error: subErr } = await db
        .from('sow_substrands')
        .select('id, strand_id, title, order_index')
        .in('strand_id', strandIds)
        .order('order_index')
        .range(from, from + PAGE - 1)

      if (subErr) {
        console.error('[sow/strands] substrands fetch:', subErr)
        return apiError('Failed to load substrands')
      }

      if (page) allSubstrands.push(...page)
      if (!page || page.length < PAGE) break
      from += PAGE
    }

    // 3. Group substrands by strand
    const subsByStrand: Record<string, Array<{ id: string; title: string }>> = {}
    for (const sub of allSubstrands) {
      if (!subsByStrand[sub.strand_id]) subsByStrand[sub.strand_id] = []
      subsByStrand[sub.strand_id].push({ id: sub.id, title: sub.title })
    }

    const strands = strandsData.map(s => ({
      id: s.id,
      title: s.title,
      substrands: subsByStrand[s.id] || [],
    }))

    const response = apiSuccess({ strands })
    response.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: any) {
    console.error('[sow/strands]', err)
    return apiError(err.message || 'Failed to load strands')
  }
}
