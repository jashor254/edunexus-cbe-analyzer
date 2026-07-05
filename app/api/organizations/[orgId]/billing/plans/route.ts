// GET /api/organizations/[orgId]/billing/plans — list all plans
// POST /api/organizations/[orgId]/billing/plans — upgrade subscription
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasPermission } from '@/lib/iam/permissions'
import { listPlans, upgradePlan } from '@/lib/billing/plans'
import { z } from 'zod'

const upgradeSchema = z.object({
  plan_name: z.enum(['free', 'starter', 'pro', 'enterprise']),
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

  const canRead = await hasPermission(user.id, orgId, 'billing:read')
  if (!canRead) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const plans = await listPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch plans'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

  const canUpdate = await hasPermission(user.id, orgId, 'billing:update')
  if (!canUpdate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = upgradeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await upgradePlan(orgId, parsed.data.plan_name)
    return NextResponse.json({ subscription_id: result.subscription_id, plan: result.plan })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upgrade plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
