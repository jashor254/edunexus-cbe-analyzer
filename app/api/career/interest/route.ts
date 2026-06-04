// app/api/career/interest/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { saveCareerInterest, getInterestsForStudent } from '@/lib/career/careerEngine'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  studentId: z.string().uuid(),
  careerSlug: z.string().min(1),
  interestLevel: z.number().int().min(1).max(5).default(3),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('studentId and careerSlug are required')

    const { studentId, careerSlug, interestLevel, notes } = parsed.data

    // Verify student belongs to this user
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiForbidden()

    const interest = await saveCareerInterest(studentId, careerSlug, interestLevel, notes)
    return apiSuccess({ interest })
  } catch (err) {
    console.error('[career/interest POST]', err)
    return apiError('Failed to save career interest')
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiForbidden()

    const interests = await getInterestsForStudent(studentId)
    return apiSuccess({ interests })
  } catch (err) {
    console.error('[career/interest GET]', err)
    return apiError('Failed to load career interests')
  }
}
