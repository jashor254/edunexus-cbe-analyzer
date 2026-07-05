// app/api/cron/cleanup-users/route.ts
// ✅ Protected by middleware.ts (Bearer token check)
// ✅ Double-checks auth here as backup
// ✅ Proper error handling

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { getErrorMessage } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export async function POST(request: NextRequest) {
  // Create service client per-request to avoid shared state across serverless invocations
  const supabase = createServiceClient()
  try {
    // ✅ Double-check auth (middleware handles first layer)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'

    if (!isVercelCron && (!cronSecret || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.info('[cron/cleanup-users] Starting cleanup job')

    // ============================================================
    // 1. Expire free analyses
    // ============================================================
    const { error: expireError } = await supabase.rpc('expire_free_analyses')
    if (expireError) {
      console.error('[cron/cleanup-users] expire_free_analyses error:', expireError.message)
      // Non-fatal - continue
    }

    // ============================================================
    // 2. Mark users for deletion
    // ============================================================
    const { error: markError } = await supabase.rpc('mark_users_for_deletion')
    if (markError) {
      console.error('[cron/cleanup-users] mark_users_for_deletion error:', markError.message)
      // Non-fatal - continue
    }

    // ============================================================
    // 3. Cleanup marked users
    // ============================================================
    const { data: cleanupResults, error: cleanupError } = await supabase.rpc('cleanup_marked_users')
    if (cleanupError) {
      console.error('[cron/cleanup-users] cleanup_marked_users error:', cleanupError.message)
      throw cleanupError // Fatal - report this
    }

    const stats = cleanupResults?.[0] || {
      deleted_count: 0,
      idle_deleted: 0,
      unverified_deleted: 0
    }

    console.info('[cron/cleanup-users] Complete:', stats)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: stats
    })

  } catch (error: unknown) {
    console.error('❌ Cleanup job failed:', getErrorMessage(error))
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// ✅ Health check - public is fine
export async function GET() {
  return NextResponse.json({
    status: 'active',
    job: 'cleanup-users',
    timestamp: new Date().toISOString()
  })
}

export const dynamic = 'force-dynamic'