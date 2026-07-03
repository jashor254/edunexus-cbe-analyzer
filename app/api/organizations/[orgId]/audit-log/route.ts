// app/api/organizations/[orgId]/audit-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuditLog } from '@/lib/iam/audit'
import { assertPermission } from '@/lib/iam/permissions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId } = await params

  try {
    await assertPermission(user.id, orgId, 'audit:read')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit         = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset        = Number(searchParams.get('offset') ?? 0)
  const action        = searchParams.get('action') ?? undefined
  const resource_type = searchParams.get('resource_type') ?? undefined
  const from          = searchParams.get('from') ?? undefined
  const to            = searchParams.get('to') ?? undefined

  try {
    const logs = await getAuditLog(orgId, { limit, offset, action, resource_type, from, to })
    return NextResponse.json({ logs, count: logs.length, limit, offset })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch audit log'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
