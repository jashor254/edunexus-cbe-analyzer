// app/api/organizations/[orgId]/members/route.ts — GET members + PATCH role + DELETE remove
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrganizationMembers } from '@/lib/organizations/get'
import { updateMemberRole, removeMember } from '@/lib/organizations/update'
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
    const members = await getOrganizationMembers(orgId, user.id)
    return NextResponse.json({ members })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch members'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

const patchSchema = z.object({
  user_id: z.string().uuid(),
  role:    z.string().min(1),
})

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
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await updateMemberRole(orgId, user.id, parsed.data.user_id, parsed.data.role)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update role'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

const deleteSchema = z.object({ user_id: z.string().uuid() })

export async function DELETE(
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
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    await removeMember(orgId, user.id, parsed.data.user_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove member'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
