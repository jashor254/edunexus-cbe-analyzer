// app/api/career/search/track/route.ts
//
// Career search demand telemetry (Phase 9.1). Reports outcomes the client
// already computed from a real /api/career/search response — this route
// never re-runs the DB search or triggers unknown-career AI generation, so
// it cannot create duplicate LLM cost or duplicate canonical-search load.
// The client debounces when it calls this (app/student/career/page.tsx),
// which is what keeps "a learner searching" from becoming one event per
// keystroke — see docs/architecture/phase9-career-discovery-audit.md §36/§37.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiBadRequest, apiUnauthorized, apiError } from '@/lib/api/response'
import { publishEvent } from '@/lib/events/publish'

export const dynamic = 'force-dynamic'

const TrackSchema = z.object({
  query:       z.string().max(200).default(''),
  category:    z.string().max(60).default(''),
  pathway:     z.string().max(60).default(''),
  resultCount: z.number().int().min(0),
})

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await req.json().catch(() => null)
    const parsed = TrackSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('Invalid search-tracking payload')

    const { query, category, pathway, resultCount } = parsed.data
    const normalizedQuery = normalize(query)

    // Nothing meaningful was searched (e.g. every field cleared) — do not
    // record a blank event.
    if (!normalizedQuery && !category && !pathway) {
      return apiSuccess({ tracked: false })
    }

    void publishEvent({
      event_type:    'student.career_search.performed',
      resource_type: 'career_search',
      resource_id:   normalizedQuery || `${category}:${pathway}`,
      actor_id:      user.id,
      payload:       { query, normalizedQuery, category, pathway, resultCount },
    }).catch(err => console.error('[events] student.career_search.performed:', err instanceof Error ? err.message : String(err)))

    if (resultCount === 0) {
      void publishEvent({
        event_type:    'student.career_search.no_result',
        resource_type: 'career_search',
        resource_id:   normalizedQuery || `${category}:${pathway}`,
        actor_id:      user.id,
        payload:       { query, normalizedQuery, category, pathway },
      }).catch(err => console.error('[events] student.career_search.no_result:', err instanceof Error ? err.message : String(err)))
    }

    return apiSuccess({ tracked: true })
  } catch (err) {
    console.error('[career/search/track]', err)
    return apiError('Failed to record search event')
  }
}
