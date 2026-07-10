// app/api/learner-intelligence/career/route.ts
// Returns Career Intelligence for one student — broad career-family exploration
// for Junior (Grade 7–9), specific evidence-based career matches for Senior
// (Grade 10–12). See lib/learnerIntelligence/careerIntelligence.ts.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth/isAdmin'
import { getStudentAccessInfo } from '@/lib/learnerModel'
import { isTeacherOfLearner } from '@/lib/api/middleware'
import { buildCareerIntelligence } from '@/lib/learnerIntelligence/careerIntelligence'

const QuerySchema = z.object({
  studentId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = QuerySchema.safeParse({
      studentId: req.nextUrl.searchParams.get('studentId'),
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { studentId } = parsed.data

    const access = await getStudentAccessInfo(studentId)
    if (!access) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const isOwner = user.id === access.user_id || user.id === access.parent_user_id
    if (!isOwner && !(await isTeacherOfLearner(studentId, user.id)) && !(await isAdmin(user.id, user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const careerIntelligence = await buildCareerIntelligence(studentId)
    return NextResponse.json({ careerIntelligence })
  } catch (err) {
    console.error('[learner-intelligence/career]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to build Career Intelligence.' }, { status: 500 })
  }
}
