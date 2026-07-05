import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { incrementViewCount } from '@/lib/insights/articles'

const BodySchema = z.object({ slug: z.string().min(1).max(200) })

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  try {
    await incrementViewCount(parsed.data.slug)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 })
  }
}
