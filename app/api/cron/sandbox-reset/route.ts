// GET /api/cron/sandbox-reset
// Runs daily. Purges sandbox usage_events beyond the retention window.
// Sandbox quota resets naturally each UTC day (enforceQuota counts today's events only).
// This cron keeps the DB lean by removing sandbox noise older than RETENTION_DAYS.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { logger } from '@/lib/observability/logger'

const RETENTION_DAYS = 7

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS)
  const cutoffIso = cutoff.toISOString()

  try {
    const { count, error } = await db
      .from('usage_events')
      .delete({ count: 'exact' })
      .eq('environment', 'sandbox')
      .lt('recorded_at', cutoffIso)

    if (error) throw new Error(error.message)

    logger.info('sandbox-reset completed', { deleted: count, cutoff: cutoffIso })
    return NextResponse.json({ ok: true, deleted: count, cutoff: cutoffIso })
  } catch (err) {
    logger.error('sandbox-reset failed', { error: err })
    return NextResponse.json({ error: 'Sandbox reset failed' }, { status: 500 })
  }
}
