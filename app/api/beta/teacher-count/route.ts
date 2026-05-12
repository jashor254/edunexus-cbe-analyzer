import { createServiceClient } from '@/utils/supabase/service'
import { NextResponse } from 'next/server'

const TOTAL = 500

export async function GET() {
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('beta_stats')
      .select('value')
      .eq('key', 'teacher_signups')
      .single()

    const claimed   = data?.value ?? 0
    const remaining = Math.max(0, TOTAL - claimed)

    return NextResponse.json({ claimed, total: TOTAL, remaining })
  } catch {
    return NextResponse.json({ claimed: 0, total: TOTAL, remaining: TOTAL })
  }
}
