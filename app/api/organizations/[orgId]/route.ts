// app/api/organizations/[orgId]/route.ts — GET (fetch org) + PATCH (update org)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrganization } from '@/lib/organizations/get'
import { updateOrganization } from '@/lib/organizations/update'
import { z } from 'zod'

const updateSchema = z.object({
  name:          z.string().min(2).max(100).optional(),
  logo_url:      z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  website:       z.string().url().nullable().optional(),
  timezone:      z.string().optional(),
  locale:        z.string().optional(),
  currency:      z.string().length(3).optional(),
  settings:      z.record(z.string(), z.unknown()).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId } = await params

  try {
    const org = await getOrganization(orgId, user.id)
    return NextResponse.json({ organization: org })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Not found'
    const status = message === 'Access denied' ? 403 : 404
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const org = await updateOrganization(orgId, user.id, parsed.data)
    return NextResponse.json({ organization: org })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
