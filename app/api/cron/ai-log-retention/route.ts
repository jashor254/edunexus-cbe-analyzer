// app/api/cron/ai-log-retention/route.ts
// Anonymises ai_call_logs prompt/response text older than 90 days, matching
// the retention period already published in the privacy policy
// (app/(marketing)/legal/privacy/page.tsx). The row itself (feature, model,
// latency, token_count, success, created_at) is kept for cost/usage
// analytics — only the free-text prompt/response content, which can contain
// student names/scores, is cleared. Same auth pattern as the other cron
// jobs in this directory (see cleanup-users/route.ts).
//
// GET is what Vercel Cron actually calls (it always issues a GET request to
// the scheduled path — see friday-generation/route.ts and
// generate-record-of-work/route.ts for the same convention). Previously GET
// only returned a static status ping, so the retention logic below — only
// ever wired to POST — never ran on schedule. POST is kept, unchanged, for
// manual invocation/testing.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { getErrorMessage } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

const RETENTION_DAYS = 90

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  return isVercelCron || (!!cronSecret && timingSafeEqualString(authHeader, `Bearer ${cronSecret}`))
}

async function anonymizeStaleAiLogs(): Promise<{ anonymisedCount: number }> {
  const supabase = createServiceClient()

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ai_call_logs')
    .update({ prompt: null, response: null })
    .lt('created_at', cutoff)
    .not('prompt', 'is', null)
    .select('id')

  if (error) throw error

  const anonymisedCount = data?.length ?? 0
  console.info('[cron/ai-log-retention] anonymised rows:', anonymisedCount)

  return { anonymisedCount }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { anonymisedCount } = await anonymizeStaleAiLogs()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      anonymisedCount,
    })
  } catch (error: unknown) {
    console.error('❌ AI log retention job failed:', getErrorMessage(error))
    return NextResponse.json(
      { success: false, error: getErrorMessage(error), timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { anonymisedCount } = await anonymizeStaleAiLogs()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      anonymisedCount,
    })
  } catch (error: unknown) {
    console.error('❌ AI log retention job failed:', getErrorMessage(error))
    return NextResponse.json(
      { success: false, error: getErrorMessage(error), timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
