// app/api/compass/topics/route.ts
// GET ?subject=mathematics&grade=8&curriculumType=cbc
// Returns strand+substrand tree from sow_strands + sow_substrands (single source of truth)

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { getTopicsForSubject } from '@/lib/compass/topicSelector'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const subject      = searchParams.get('subject')?.trim()
    const gradeStr     = searchParams.get('grade')
    const curriculum   = searchParams.get('curriculumType') ?? 'cbc'

    if (!subject) return apiBadRequest('subject is required')

    const grade = parseInt(gradeStr ?? '8', 10)
    if (isNaN(grade)) return apiBadRequest('grade must be a number')

    const topics = await getTopicsForSubject(subject, grade, curriculum)
    return apiSuccess({ topics })
  } catch (err) {
    console.error('[compass/topics]', err)
    return apiError('Failed to fetch topics')
  }
}
