// app/api/organizations/[orgId]/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createInvitation, listInvitations, revokeInvitation } from '@/lib/organizations/invitations'
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
    const invitations = await listInvitations(orgId, user.id)
    // Never expose the token in list responses
    return NextResponse.json({
      invitations: invitations.map(({ token: _token, ...rest }) => rest),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch invitations'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

const postSchema = z.object({
  email:   z.string().email(),
  role:    z.string().min(1).default('member'),
  message: z.string().max(500).optional(),
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
    const invitation = await createInvitation({
      organization_id: orgId,
      email:           parsed.data.email,
      role:            parsed.data.role,
      message:         parsed.data.message,
      invited_by:      user.id,
    })

    // TODO: Send invitation email via lib/emails
    // await sendInvitationEmail(invitation)

    // Return without exposing token (should be sent via email only)
    const { token: _token, ...safeInvitation } = invitation
    return NextResponse.json({ invitation: safeInvitation }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create invitation'
    const status = message.includes('denied') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const deleteSchema = z.object({ invitation_id: z.string().uuid() })

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    await revokeInvitation(parsed.data.invitation_id, user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to revoke invitation'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
