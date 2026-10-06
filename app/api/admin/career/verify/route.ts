// app/api/admin/career/verify/route.ts
//
// Human re-verification of an EXISTING canonical career (FIX 6).
//
// The review route (../review) is how an AI draft becomes canonical; this one
// is how a person confirms facts that are already in the corpus — the rows
// whose provenance was never recorded, or anything gone stale. It records
// `verification_source = 'human'` with today's date. Same gate as the review
// route; no AI path reaches it.
//
// POST { slug, note } — note is required: what was checked, against which source.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { markCareerHumanVerified } from '@/lib/career/knowledgeRequests'

export const dynamic = 'force-dynamic'

const VerifySchema = z.object({
  slug: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(2000),
})

type VerifyResponse = { slug: string; verificationSource: 'human' }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const reviewer = await requireGrowthUser(supabase).catch(() => null)
    if (!reviewer) return apiForbidden()

    const body = await req.json().catch(() => null)
    const parsed = VerifySchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid verification request — slug and a note are required', 400)

    const { slug, note } = parsed.data
    await markCareerHumanVerified(slug, reviewer.id, note)

    const response: VerifyResponse = { slug, verificationSource: 'human' }
    return apiSuccess(response)
  } catch (err) {
    console.error('[admin/career/verify] verification failed', err)
    return apiError(err instanceof Error ? err.message : 'Failed to verify career knowledge')
  }
}
