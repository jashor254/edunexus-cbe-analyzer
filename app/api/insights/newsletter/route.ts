import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { subscribeToNewsletter } from '@/lib/insights/newsletter'

const BodySchema = z.object({
  email: z.string().email().max(255),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  try {
    await subscribeToNewsletter(parsed.data.email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
  }
}
