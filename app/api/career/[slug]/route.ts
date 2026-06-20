// app/api/career/[slug]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import {
  getCareerBySlugWithCOS,
  getMatchesForStudent,
  searchOrGenerateCareer,
  getCapabilityProfile,
} from '@/lib/career/careerEngine'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import type { CapabilityCareerMatch } from '@/lib/career/types'

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
    let career = await getCareerBySlugWithCOS(slug)

    // No exact slug match — generate on the fly so links never dead-end
    if (!career) {
      try {
        career = await searchOrGenerateCareer(slug.replace(/-/g, ' '))
      } catch (genErr) {
        console.error('[career/slug] generation failed', genErr)
      }
    }

    if (!career) return apiNotFound(`Career '${slug}' not found`)

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')

    let studentMatch   = null
    let capabilityMatch: CapabilityCareerMatch | null = null

    if (studentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (student) {
        // Legacy AI match (kept for backward compat)
        const matches = await getMatchesForStudent(studentId)
        studentMatch = matches.find((m) => m.career.slug === slug) ?? null

        // Capability match — fast, deterministic, no tokens
        if (career.required_capabilities) {
          const profile = await getCapabilityProfile(studentId)
          if (profile) {
            const report = computeCapabilityMatches(studentId, profile, [career])
            const allMatches = [
              ...report.primary,
              ...report.stretch,
              ...report.alternative,
              ...report.entrepreneurial,
            ]
            capabilityMatch = allMatches.find(m => m.career_slug === slug) ?? null
          }
        }
      }
    }

    return apiSuccess({ career, student_match: studentMatch, capability_match: capabilityMatch })
  } catch (err) {
    console.error('[career/slug]', err)
    return apiError('Failed to load career')
  }
}
