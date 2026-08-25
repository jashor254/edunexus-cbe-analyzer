// app/api/career/[slug]/route.ts
//
// Career Contradiction Closure Sprint (2026-08-03) — the legacy
// `student_match` field (backed by the deprecated, AI-generated
// `getMatchesForStudent()`) is removed: it had zero UI consumers (confirmed
// by direct search), so this is dead-weight removal, not a behavior change
// for anyone. `capability_match` — already the canonical, deterministic
// `computeCapabilityMatches()` path `app/student/career/[slug]/page.tsx`
// actually renders — is preserved, and now additionally respects the
// Career Principle grade gate (`careerModeForGrade`) it was previously
// missing: a Junior learner no longer receives a specific-career alignment
// score, matching the same Junior/Senior boundary every other Career
// surface already obeys.
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { getCareerBySlugWithCOS } from '@/lib/career/careerEngine'
import { requestCareerKnowledge } from '@/lib/career/knowledgeRequests'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { careerModeForGrade } from '@/lib/learnerIntelligence/careerIntelligence'
import { resolveFreshCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { canAccessLegacyStudent } from '@/lib/core/permissions'
import type { CapabilityCareerMatch } from '@/lib/career/types'
import { buildCareerReadinessChains, buildCapabilityReadinessChains } from '@/lib/knowledgeGraph/careerReadiness'
import type { CareerReadinessReport } from '@/lib/knowledgeGraph/careerReadiness'
import { publishEvent } from '@/lib/events/publish'

export const dynamic = 'force-dynamic'

// What the learner clicked to get here — analytics only (Phase 9.1 §8), never
// used for any access-control or intelligence decision. Falls back to 'other'
// rather than rejecting the request when an entry point doesn't pass one.
const KNOWN_SOURCES = new Set(['search', 'explorer', 'career_match', 'signal', 'other'])
function resolveSource(raw: string | null): string {
  return raw && KNOWN_SOURCES.has(raw) ? raw : 'other'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const source = resolveSource(searchParams.get('source'))
    const career = await getCareerBySlugWithCOS(slug)

    // No exact slug match. This used to generate a career inline and persist it,
    // then fall through and run `computeCapabilityMatches` against it — scoring
    // a real learner's alignment to an AI-authored career whose capability
    // minimums nobody had checked. It now returns the same provisional outline
    // the search route does, and never reaches the match engine below.
    if (!career) {
      try {
        const result = await requestCareerKnowledge(slug.replace(/-/g, ' '), user.id)
        if (result.status === 'provisional') {
          return apiSuccess({
            career: null,
            provisional: true,
            preview: result.preview,
            capability_match: null,
            readiness_report: null,
          })
        }
        if (result.status === 'rate_limited') {
          return apiNotFound(`Career '${slug}' not found`)
        }
        return apiSuccess({ career: result.career, provisional: false, capability_match: null, readiness_report: null })
      } catch (genErr) {
        console.error('[career/slug] knowledge request failed', genErr)
        return apiNotFound(`Career '${slug}' not found`)
      }
    }

    // Analytics only — a canonical career the learner actually opened.
    // Never mutates learner_evidence/Projection/capability/interest state
    // (Phase 9.1 §12/§35 Guard A).
    void publishEvent({
      event_type:    'student.career_result.opened',
      resource_type: 'career',
      resource_id:   career.slug,
      actor_id:      user.id,
      payload:       { careerSlug: career.slug, careerId: career.id, source },
    }).catch(err => console.error('[events] student.career_result.opened:', err instanceof Error ? err.message : String(err)))

    const studentId = searchParams.get('studentId')

    let capabilityMatch:   CapabilityCareerMatch | null = null
    let readinessReport:   CareerReadinessReport | null = null

    if (studentId) {
      const allowed = await canAccessLegacyStudent(user.id, studentId)
      // Service client, not the request-scoped `supabase` above: RLS on
      // `students`/`student_learning_context` only recognizes
      // `auth.uid() = user_id`, which an institutional learner's Phase 1C
      // compatibility row never has set (see canAccessLegacyStudent) — the
      // same reason /api/student/home/route.ts and assignmentDiscovery.ts
      // already read through the service client post-authorization.
      const db = createServiceClient()
      const student = allowed
        ? (await db.from('students').select('id, grade').eq('id', studentId).maybeSingle()).data
        : null

      if (student) {
        // Capability match — fast, deterministic, no tokens. Sourced live
        // from Projection via the one canonical resolver (same path Career
        // Intelligence, Capability Matches, and Parent Career Intelligence
        // use) rather than the separately-stored `career_capability_profiles`
        // snapshot, which could disagree with what those other surfaces
        // conclude from the same evidence.
        //
        // Career Principle gate: a Junior learner (`exploration` mode) never
        // receives a specific-career alignment score — only Senior
        // (`planning` mode) resolves to one specific matched career. This
        // mirrors `careerModeForGrade`'s own boundary, never re-derived.
        const grade = student.grade as number | null
        const isJunior = grade !== null && careerModeForGrade(grade) === 'exploration'

        if (!isJunior && career.required_capabilities) {
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
          const { data: ctx } = await db
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

    return apiSuccess({ career, capability_match: capabilityMatch, readiness_report: readinessReport })
  } catch (err) {
    console.error('[career/slug]', err)
    return apiError('Failed to load career')
  }
}
