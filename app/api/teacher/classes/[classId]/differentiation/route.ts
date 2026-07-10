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
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateClassDifferentiation, getClassDifferentiation } from '@/lib/adaptiveLearning/differentiation'
import { KE_CBC } from '@/lib/curriculum/regional/ke-cbc'

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

async function verifyClassOwnership(db: ReturnType<typeof createServiceClient>, classId: string, teacherId: string): Promise<boolean> {
  const { data: cls } = await db
    .from('teacher_classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle()
  return !!cls
}

export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    if (!(await verifyClassOwnership(db, classId, teacher.id))) return apiForbidden()

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    if (!(await verifyClassOwnership(db, classId, teacher.id))) return apiForbidden()

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
