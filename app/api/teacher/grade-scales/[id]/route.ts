import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { updateGradeScale, deleteGradeScale } from '@/lib/assessments/gradeScales'

const BandSchema = z.object({
  label:    z.string().min(1).max(10),
  minPct:   z.number().min(0).max(100),
  maxPct:   z.number().min(0).max(100),
  colorCls: z.string().min(1),
})

const UpdateSchema = z.object({
  name:           z.string().min(1).max(80).optional(),
  curriculumHint: z.enum(['cbc', '844', 'custom']).optional(),
  bands:          z.array(BandSchema).min(2).max(20).optional(),
  isDefault:      z.boolean().optional(),
})

async function getTeacher(user: { id: string }) {
  const db = createServiceClient()
  const { data } = await db.from('teachers').select('id').eq('user_id', user.id).single()
  return data
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const teacher = await getTeacher(user)
    if (!teacher) return apiForbidden()

    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map((i) => i.message).join(', '))

    const scale = await updateGradeScale(id, teacher.id, parsed.data)
    return apiSuccess({ scale })
  } catch (e: unknown) {
    console.error('[grade-scales PUT]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to update grade scale')
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const teacher = await getTeacher(user)
    if (!teacher) return apiForbidden()

    await deleteGradeScale(id, teacher.id)
    return apiSuccess({ deleted: true })
  } catch (e: unknown) {
    console.error('[grade-scales DELETE]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to delete grade scale')
  }
}
