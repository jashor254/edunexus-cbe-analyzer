// app/api/organizations/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createOrganization, isSlugAvailable } from '@/lib/organizations/create'
import { z } from 'zod'

const schema = z.object({
  name:          z.string().min(2).max(100),
  slug:          z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').optional(),
  type:          z.enum(['school','district','county','ministry','publisher','university','ngo','developer']),
  parent_id:     z.string().uuid().optional(),
  logo_url:      z.string().url().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  website:       z.string().url().optional(),
  country:       z.string().length(2).optional(),
  timezone:      z.string().optional(),
  locale:        z.string().optional(),
  currency:      z.string().length(3).optional(),
  settings:      z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data

  // Check slug availability if provided
  if (input.slug) {
    const available = await isSlugAvailable(input.slug)
    if (!available) {
      return NextResponse.json({ error: 'Slug is already taken' }, { status: 409 })
    }
  }

  try {
    const org = await createOrganization(input, user.id)
    return NextResponse.json({ organization: org }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create organization'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
