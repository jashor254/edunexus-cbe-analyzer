// app/api/organizations/[orgId]/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/organizations/api-keys'
import { z } from 'zod'

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
    const keys = await listApiKeys(orgId, user.id)
    return NextResponse.json({ api_keys: keys })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch API keys'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

const postSchema = z.object({
  name:           z.string().min(1).max(100),
  description:    z.string().max(300).optional(),
  scopes:         z.array(z.string()).optional(),
  environment:    z.enum(['live', 'sandbox']).default('live'),
  expires_at:     z.string().datetime().optional(),
  rate_limit_rpm: z.number().int().min(1).max(1000).optional(),
  rate_limit_rpd: z.number().int().min(1).max(100000).optional(),
})

export async function POST(
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
  const parsed = postSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await createApiKey({
      organization_id: orgId,
      created_by:      user.id,
      ...parsed.data,
    })

    // raw_key is only returned here — never storable elsewhere
    return NextResponse.json({
      api_key: result.api_key,
      raw_key: result.raw_key,
      warning: 'Store this key now — it will not be shown again.',
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create API key'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const deleteSchema = z.object({ key_id: z.string().uuid() })

export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key_id = req.nextUrl.searchParams.get('key_id')
  const parsed = deleteSchema.safeParse({ key_id })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid key_id' }, { status: 400 })
  }

  try {
    await revokeApiKey(parsed.data.key_id, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to revoke key'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
