// app/api/career/[slug]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { getCareerBySlug, getMatchesForStudent } from '@/lib/career/careerEngine'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { slug } = await params
    const career = await getCareerBySlug(slug)

    if (!career) return apiNotFound(`Career '${slug}' not found`)

    // Optionally attach match score if studentId provided
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    let studentMatch = null

    if (studentId) {
      // Verify student belongs to this user
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (student) {
        const matches = await getMatchesForStudent(studentId)
        studentMatch = matches.find((m) => m.career.slug === slug) ?? null
      }
    }

    return apiSuccess({ career, student_match: studentMatch })
  } catch (err) {
    console.error('[career/slug]', err)
    return apiError('Failed to load career')
  }
}
