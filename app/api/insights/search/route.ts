import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchArticles } from '@/lib/insights/search'

const QuerySchema = z.object({
  q:     z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = QuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  try {
    const results = await searchArticles(parsed.data.q, parsed.data.limit)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
