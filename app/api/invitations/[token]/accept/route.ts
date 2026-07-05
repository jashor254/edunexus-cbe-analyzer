// app/api/invitations/[token]/accept/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { acceptInvitation, previewInvitation } from '@/lib/organizations/invitations'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Login required to view invitation' }, { status: 401 })
  }

  const { token } = await params
  try {
    const invitation = await previewInvitation(token)
    if (!invitation) return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 })
    return NextResponse.json({ invitation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch invitation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 })
  }

  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 })
  }

  const userEmail = user.email ?? ''

  try {
    const result = await acceptInvitation(token, user.id, userEmail)
    return NextResponse.json({
      success: true,
      organization_id: result.organization_id,
      role: result.role,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept invitation'
    const status =
      message.includes('not found') ? 404 :
      message.includes('expired') ? 410 :
      message.includes('different email') ? 403 :
      400
    return NextResponse.json({ error: message }, { status })
  }
}
