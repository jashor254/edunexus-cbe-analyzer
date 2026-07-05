// GET /api/organizations/[orgId]/billing/usage
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasPermission } from '@/lib/iam/permissions'
import { getUsageSummary, getCurrentMonthStart } from '@/lib/billing/usage'
import { getOrgSubscription } from '@/lib/billing/plans'

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

  const canRead = await hasPermission(user.id, orgId, 'billing:read')
  if (!canRead) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const periodStart = await getCurrentMonthStart()
    const periodEnd   = new Date()

    const [usage, subscription] = await Promise.all([
      getUsageSummary(orgId, periodStart, periodEnd),
      getOrgSubscription(orgId),
    ])

    return NextResponse.json({ usage, subscription })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch usage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
