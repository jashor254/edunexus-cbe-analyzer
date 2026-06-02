// app/api/generate/route.ts
// Generic generation stub — gate with checkFeatureAccess pending full implementation.

import { NextResponse } from 'next/server'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'

const FEATURE: FeatureKey = 'learning_compass'

export async function POST(_req: Request) {
  const access = await checkFeatureAccess(FEATURE)
  if (access.allowed === false) {
    const status = access.reason === 'unauthenticated' ? 401 : 403
    return NextResponse.json({ error: access.reason }, { status })
  }

  try {
    // AI logic placeholder — implement the actual generation here
    const aiResponse = 'Hapa ni matokeo ya AI...'

    return NextResponse.json({ success: true, data: aiResponse })
  } catch (error) {
    console.error('[generate] error:', error)
    return NextResponse.json({ error: 'Server Error' }, { status: 500 })
  }
}
