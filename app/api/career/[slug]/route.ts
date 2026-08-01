// app/api/career/[slug]/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import {
  getCareerBySlugWithCOS,
  getMatchesForStudent,
  searchOrGenerateCareer,
} from '@/lib/career/careerEngine'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { resolveFreshCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligence'
import type { CapabilityCareerMatch } from '@/lib/career/types'
import { buildCareerReadinessChains, buildCapabilityReadinessChains } from '@/lib/knowledgeGraph/careerReadiness'
import type { CareerReadinessReport } from '@/lib/knowledgeGraph/careerReadiness'

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

    let studentMatch      = null
    let capabilityMatch:   CapabilityCareerMatch | null = null
    let readinessReport:   CareerReadinessReport | null = null

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

        // Capability match — fast, deterministic, no tokens. Sourced live
        // from Projection via the one canonical resolver (same path Career
        // Intelligence, Capability Matches, and Parent Career Intelligence
        // use) rather than the separately-stored `career_capability_profiles`
        // snapshot, which could disagree with what those other surfaces
        // conclude from the same evidence.
        if (career.required_capabilities) {
          const resolved = await resolveFreshCapabilityProfile(studentId)
          if (resolved) {
            const report = computeCapabilityMatches(studentId, resolved.profile, [career])
            const allMatches = [
              ...report.primary,
              ...report.stretch,
              ...report.alternative,
              ...report.entrepreneurial,
            ]
            capabilityMatch = allMatches.find(m => m.career_slug === slug) ?? null
          }
        }

        // Knowledge graph readiness chains — surface which prerequisite topics block this career
        try {
          const { data: ctx } = await supabase
            .from('student_learning_context')
            .select('knowledge_root_causes')
            .eq('student_id', studentId)
            .maybeSingle()

          const rootCauses = (ctx?.knowledge_root_causes as import('@/lib/knowledgeGraph/types').RootCauseResult[] | null) ?? []

          if (rootCauses.length > 0) {
            if ((career.required_subjects ?? []).length > 0) {
              readinessReport = buildCareerReadinessChains(career.title, career.required_subjects, rootCauses)
            } else if (career.required_capabilities) {
              const capMap = Object.fromEntries(
                Object.entries(career.required_capabilities).map(([k, v]) => [k, { minimum: v.minimum, weight: v.weight }])
              )
              readinessReport = buildCapabilityReadinessChains(career.title, capMap, rootCauses)
            }
          }
        } catch (e) {
          console.error('[career/slug] readiness chain computation failed (non-fatal):', e)
        }
      }
    }

    return apiSuccess({ career, student_match: studentMatch, capability_match: capabilityMatch, readiness_report: readinessReport })
  } catch (err) {
    console.error('[career/slug]', err)
    return apiError('Failed to load career')
  }
}
