// app/api/eir/knowledge-base/route.ts
// GET  /api/eir/knowledge-base              — full knowledge base report
// GET  /api/eir/knowledge-base?type=findings&pillar=&subject=&grade=
// POST /api/eir/knowledge-base              — propose a hypothesis (admin only)

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import {
  buildKnowledgeBaseReport,
  getFindings,
  proposeHypothesis,
} from '@/_frozen/eir'
import { getUserRole } from '@/lib/auth/getRole'
import type { ResearchPillar } from '@/_frozen/eir'

const QuerySchema = z.object({
  type:    z.enum(['report', 'findings']).default('report'),
  pillar:  z.string().optional(),
  subject: z.string().optional(),
  grade:   z.coerce.number().int().min(1).max(12).optional(),
  limit:   z.coerce.number().int().min(1).max(50).optional(),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const role = await getUserRole(user.id)
    if (!role || !['teacher', 'admin', 'school_admin'].includes(role)) {
      return apiForbidden()
    }

    const url    = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) return apiError(parsed.error.message, 400)

    const { type, pillar, subject, grade, limit } = parsed.data

    if (type === 'findings') {
      const findings = await getFindings({
        pillar: pillar as ResearchPillar | undefined,
        subject,
        grade,
        limit,
      })
      return apiSuccess({ findings })
    }

    const report = await buildKnowledgeBaseReport()
    return apiSuccess(report)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get knowledge base')
  }
}

const ProposeBodySchema = z.object({
  pillar:      z.enum([
    'misconception', 'trajectory', 'intervention', 'personalization',
    'career', 'kg_evolution', 'risk', 'explainability', 'validation', 'general',
  ]),
  title:       z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  tags:        z.array(z.string()).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const role = await getUserRole(user.id)
    if (!role || !['admin', 'school_admin'].includes(role)) {
      return apiForbidden()
    }

    const body   = await req.json()
    const parsed = ProposeBodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.message, 400)

    const hypothesis = await proposeHypothesis({
      pillar:       parsed.data.pillar as ResearchPillar,
      title:        parsed.data.title,
      description:  parsed.data.description,
      proposedBy:   'admin',
      tags:         parsed.data.tags,
    })

    return apiSuccess(hypothesis, 201)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to propose hypothesis')
  }
}
