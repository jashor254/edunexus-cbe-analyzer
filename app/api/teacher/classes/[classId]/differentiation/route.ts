// POST   /api/teacher/classes/[classId]/differentiation — generate/regenerate
// GET    /api/teacher/classes/[classId]/differentiation — read the current draft/approved plan
//
// Classroom Differentiation (Adaptive Learning v2 Architecture §3/§9,
// docs/architecture/adaptive-learning-v2-architecture.md, FROZEN). A
// teacher generates a differentiation set after processing an assessment
// (a separate, sequenced call — not inlined into
// /api/teacher/assessments/process, which has its own established
// pipeline contract). Generating always produces a draft; nothing reaches
// a learner until /approve is called (see ./approve/route.ts).

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateClassDifferentiation, getClassDifferentiation } from '@/lib/adaptiveLearning/differentiation'
import { KE_CBC } from '@/lib/curriculum/regional/ke-cbc'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const BodySchema = z.object({
  subject:     z.string().min(1),
  term:        z.number().int().min(1).max(3).optional(),
  year:        z.number().int().min(2024).optional(),
  // Curriculum Integrity mandate: teacher-assigned Sub-Strand (Topic
  // Picker) — optional, but without it every generated task is honestly
  // subject-level only, carrying an explicit curriculumNotice.
  subStrandId: z.string().uuid().optional(),
})

const QuerySchema = z.object({
  subject: z.string().min(1),
  term:    z.coerce.number().int().min(1).max(3).optional(),
  year:    z.coerce.number().int().min(2024).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  try {
    const { classId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiForbidden()
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const now  = new Date()
    const term = parsed.data.term ?? KE_CBC.getCurrentTerm(now)
    const year = parsed.data.year ?? now.getFullYear()

    const plan = await generateClassDifferentiation({
      classId, teacherId: teacher.id, subject: parsed.data.subject, term, year,
      subStrandId: parsed.data.subStrandId ?? null,
    })

    return apiSuccess({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/classes/differentiation POST]', msg)
    return apiError('Failed to generate class differentiation')
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  try {
    const { classId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiForbidden()
    }

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const now  = new Date()
    const term = parsed.data.term ?? KE_CBC.getCurrentTerm(now)
    const year = parsed.data.year ?? now.getFullYear()

    const plan = await getClassDifferentiation({ classId, subject: parsed.data.subject, term, year })
    if (!plan) return apiSuccess({ plan: null })

    return apiSuccess({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/classes/differentiation GET]', msg)
    return apiError('Failed to fetch class differentiation')
  }
}
