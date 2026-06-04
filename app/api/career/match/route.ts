// app/api/career/match/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { getMatchesForStudent } from '@/lib/career/careerEngine'
import { generateCareerMatches } from '@/lib/career/matchEngine'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  studentId: z.string().uuid(),
  force: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId, force } = parsed.data

    // Verify student belongs to this user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, grade, date_of_birth')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (studentError || !student) return apiForbidden()

    // Return cached matches unless forced refresh
    if (!force) {
      const existing = await getMatchesForStudent(studentId)
      if (existing.length > 0) {
        return apiSuccess({ matches: existing, source: 'cached' })
      }
    }

    // Load assessment scores
    const { data: assessments } = await supabase
      .from('assessments')
      .select('subject, score')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(30)

    // Aggregate latest score per subject
    const subjectScores: Record<string, number> = {}
    for (const a of assessments ?? []) {
      const subject = (a.subject as string).toLowerCase()
      if (!subjectScores[subject]) {
        subjectScores[subject] = a.score as number
      }
    }

    // Load interests
    const { data: interestRows } = await supabase
      .from('student_career_interests')
      .select('career_slug, notes')
      .eq('student_id', studentId)
      .order('explored_at', { ascending: false })
      .limit(10)

    const interests = (interestRows ?? []).map((r) => r.career_slug as string).filter(Boolean)

    const age = student.date_of_birth
      ? Math.floor((Date.now() - new Date(student.date_of_birth as string).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 14

    const result = await generateCareerMatches({
      student_id: studentId,
      student_name: student.name as string,
      grade: student.grade as number,
      age,
      subject_scores: subjectScores,
      interests,
    })

    const matches = await getMatchesForStudent(studentId)
    return apiSuccess({ matches, source: 'generated', generated_at: result.generated_at })
  } catch (err) {
    console.error('[career/match]', err)
    return apiError('Failed to generate career matches. Please try again.')
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

    // Verify student belongs to this user
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiForbidden()

    const matches = await getMatchesForStudent(studentId)
    return apiSuccess({ matches })
  } catch (err) {
    console.error('[career/match GET]', err)
    return apiError('Failed to load career matches')
  }
}
