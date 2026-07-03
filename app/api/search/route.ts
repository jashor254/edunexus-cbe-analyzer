// GET /api/search?q=...&types=sow,lesson_plan&limit=20
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { search } from '@/lib/search'
import type { SearchResourceType } from '@/lib/search/types'

const VALID_TYPES = new Set<SearchResourceType>(['sow', 'lesson_plan', 'assessment', 'learner', 'class', 'career'])

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url   = new URL(req.url)
  const q     = url.searchParams.get('q') ?? ''
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)

  const typesParam = url.searchParams.get('types')
  const types = typesParam
    ? (typesParam.split(',').filter(t => VALID_TYPES.has(t as SearchResourceType)) as SearchResourceType[])
    : undefined

  if (!q.trim()) {
    return NextResponse.json({ query: '', results: [], total: 0, by_type: {} })
  }

  try {
    const results = await search(q, user.id, { types, limit })
    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
