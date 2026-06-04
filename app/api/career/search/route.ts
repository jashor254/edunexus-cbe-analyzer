// app/api/career/search/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { searchCareers, getAllCareers } from '@/lib/career/careerEngine'
import type { CareerSearchFilters } from '@/lib/career/types'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  ai_impact_level: z.enum(['low', 'medium', 'high', 'transforming']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return apiError('Invalid query parameters', 400)
    }

    const filters: CareerSearchFilters = parsed.data as CareerSearchFilters

    const careers = (filters.q || filters.category || filters.ai_impact_level)
      ? await searchCareers(filters)
      : await getAllCareers()

    return apiSuccess({ careers })
  } catch (err) {
    console.error('[career/search]', err)
    return apiError('Failed to search careers')
  }
}
