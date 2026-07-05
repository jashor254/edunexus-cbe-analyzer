// app/api/organizations/[orgId]/roles/route.ts — list, create, update, delete custom roles
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listAvailableRoles } from '@/lib/iam/permissions'
import { createCustomRole, updateCustomRole, deleteCustomRole } from '@/lib/iam/roles'
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
    const roles = await listAvailableRoles(orgId)
    return NextResponse.json({ roles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch roles'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

const postSchema = z.object({
  name:        z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()),
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
    const role = await createCustomRole(orgId, user.id, parsed.data as Parameters<typeof createCustomRole>[2])
    return NextResponse.json({ role }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create role'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const patchSchema = z.object({
  role_id:     z.string().uuid(),
  name:        z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).optional(),
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

  const { role_id, ...updates } = parsed.data

  try {
    const role = await updateCustomRole(role_id, user.id, orgId, updates as Parameters<typeof updateCustomRole>[3])
    return NextResponse.json({ role })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update role'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const deleteSchema = z.object({ role_id: z.string().uuid() })

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
    await deleteCustomRole(parsed.data.role_id, user.id, orgId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete role'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
