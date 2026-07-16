import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { getTeacherGradeScales, createGradeScale } from '@/lib/assessments/gradeScales'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const BandSchema = z.object({
  label:    z.string().min(1).max(10),
  minPct:   z.number().min(0).max(100),
  maxPct:   z.number().min(0).max(100),
  colorCls: z.string().min(1),
})

const CreateSchema = z.object({
  name:           z.string().min(1).max(80),
  curriculumHint: z.enum(['cbc', '844', 'custom']).default('custom'),
  bands:          z.array(BandSchema).min(2).max(20),
  isDefault:      z.boolean().optional(),
})

export async function GET() {
  try {
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

    const scales = await getTeacherGradeScales(teacher.id)
    return apiSuccess({ scales })
  } catch (e: unknown) {
    console.error('[grade-scales GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch grade scales')
  }
}

export async function POST(req: Request) {
  try {
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

    const parsed = CreateSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map((i) => i.message).join(', '))

    const scale = await createGradeScale(teacher.id, parsed.data)
    return apiSuccess({ scale }, 201)
  } catch (e: unknown) {
    console.error('[grade-scales POST]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to create grade scale')
  }
}
