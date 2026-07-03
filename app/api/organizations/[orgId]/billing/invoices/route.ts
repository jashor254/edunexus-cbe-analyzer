// GET /api/organizations/[orgId]/billing/invoices
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasPermission } from '@/lib/iam/permissions'
import { getInvoices } from '@/lib/billing/usage'

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

  const canRead = await hasPermission(user.id, orgId, 'billing:read')
  if (!canRead) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url    = new URL(req.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '12', 10), 50)

  try {
    const invoices = await getInvoices(orgId, limit)
    return NextResponse.json({ invoices })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
